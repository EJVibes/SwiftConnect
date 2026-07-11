import os
import re
import json
import requests
from bs4 import BeautifulSoup

VEHICLES_API_URL = "https://www.mybustimes.cc/api/group/Swift%20Connect%20Group/vehicles/?ymax=56.96749375372495&ymin=22.98020869942421&xmax=26.253456525775164&xmin=-46.11789196263385&limit=5000"
CACHE_FILE_NAME = "global_routes_cache.json"
BASE_URL = "https://www.mybustimes.cc"

SCRAPE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5"
}

def load_existing_cache():
    if os.path.exists(CACHE_FILE_NAME):
        try:
            with open(CACHE_FILE_NAME, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Starting fresh cache ledger: {e}")
    return {}

def parse_table_html(soup):
    tables = soup.find_all('table')
    if not tables: return []
    
    all_directions = []
    
    for table in tables:
        rows = table.find_all('tr')
        if not rows: continue
        
        # 1. Build a raw grid of all text in the table
        raw_grid = []
        for tr in rows:
            cells = tr.find_all(['td', 'th'])
            row_text = []
            for cell in cells:
                text = cell.get_text(separator=", ", strip=True)
                # Format arr/dep times cleanly
                if re.search(r'(\d{2}:\d{2}),\s*(\d{2}:\d{2})', text):
                    text = re.sub(r'(\d{2}:\d{2}),\s*(\d{2}:\d{2})', r'\1 arr<br>\2 dep', text)
                row_text.append(text)
                
            # Keep rows that aren't completely blank
            if any(t and t != "-" for t in row_text):
                raw_grid.append(row_text)

        if not raw_grid: continue

        # 2. Smart Column Profiler: Detect which columns are Stop Names vs Times
        num_cols = max(len(r) for r in raw_grid)
        label_indices = []
        
        for col_idx in range(num_cols):
            time_count, text_count = 0, 0
            for row in raw_grid:
                if col_idx < len(row):
                    val = row[col_idx]
                    if val and val != "-":
                        if re.search(r'\d{1,2}:\d{2}', val):
                            time_count += 1
                        else:
                            text_count += 1
            
            # If a column is primarily text, it is a Stop Name column
            if text_count > time_count or (time_count == 0 and text_count > 0):
                label_indices.append(col_idx)
                
        if not label_indices:
            label_indices = [0]

        # 3. Slice the horizontal table into individual directions
        for idx_pos, start_col in enumerate(label_indices):
            # Cut from this Stop Name column up to the next Stop Name column
            end_col = label_indices[idx_pos + 1] if idx_pos + 1 < len(label_indices) else num_cols
            
            dir_rows = []
            headers = ["stop_name"] + [f"col_{i}" for i in range(1, end_col - start_col)]
            last_valid_stop = ""
            
            for row in raw_grid:
                while len(row) < end_col: row.append("-") # Pad uneven rows
                
                sub_row = row[start_col:end_col]
                stop_name = sub_row[0]
                
                # Filter out generic website headers from becoming data rows
                if stop_name.lower() in ["stop name", "stops", "bus stop"]:
                    continue
                    
                if stop_name and stop_name != "-":
                    row_dict = {}
                    has_times = False
                    for i, val in enumerate(sub_row):
                        key = headers[i] if i < len(headers) else f"col_{i}"
                        row_dict[key] = val
                        if i > 0 and val != "-": has_times = True
                        
                    # Only append the row if this specific direction has times scheduled
                    if has_times:
                        dir_rows.append(row_dict)
                        last_valid_stop = stop_name

            if dir_rows:
                # Dynamically generate the clean title (e.g. "Towards Aeropuerto Norte")
                dest = last_valid_stop.title()
                dir_name = f"Towards {dest}" if dest else "Timetable"
                all_directions.append({
                    "direction": dir_name,
                    "data": dir_rows
                })

    return all_directions

def scrape_html_timetable(route_url):
    """Fetches the page and runs the smart parsing logic directly."""
    try:
        full_url = f"{BASE_URL}{route_url}" if route_url.startswith("/") else route_url
        response = requests.get(full_url, headers=SCRAPE_HEADERS, timeout=15)
        if response.status_code != 200: return []
        
        soup = BeautifulSoup(response.text, 'html.parser')
        # We no longer need to scrape dates/tabs because the page holds all directions side-by-side
        return parse_table_html(soup)
    except Exception as e:
        print(f"  -> Failed parsing HTML structure: {e}")
        return []

def main():
    print("Initiating FORCE RE-SCRAPE of all routes (Horizontal Splitter Active)...")
    route_cache = load_existing_cache()
    
    try:
        response = requests.get(VEHICLES_API_URL, timeout=15)
        response.raise_for_status()
        data = response.json()
        vehicles = data.get("results", data) if isinstance(data, dict) else data
    except Exception as e:
        print(f"Network error: Could not fetch active tracking fleet: {e}")
        return

    discovered_routes = {}
    for record in vehicles:
        service = record.get("service") or {}
        url_path = service.get("url") or ""
        match = re.search(r"/route/(\d+)/?", url_path)
        if match:
            route_id = match.group(1)
            discovered_routes[route_id] = url_path

    print(f"Discovered {len(discovered_routes)} operational routes.")

    for route_id, route_url in discovered_routes.items():
        print(f"\nForce Syncing Route ID: {route_id}")
        try:
            api_res = requests.get(f"https://www.mybustimes.cc/api/operator/route/{route_id}/", timeout=10)
            if api_res.status_code == 200:
                raw_data = api_res.json()
                
                route_num = str(raw_data.get("route_num", "")).strip()
                route_name = str(raw_data.get("route_name", "")).strip().lower()
                is_hidden = raw_data.get("hidden") or raw_data.get("is_hidden") or "hidden" in route_name
                
                if route_num == "?" or is_hidden:
                    print(f"  -> Skipping HTML scrape. Route is hidden.")
                    continue
                
                slim_route_data = {
                    "id": raw_data.get("id", route_id),
                    "route_num": raw_data.get("route_num", ""),
                    "route_name": raw_data.get("route_name", ""),
                    "inbound_destination": raw_data.get("inbound_destination", ""),
                    "outbound_destination": raw_data.get("outbound_destination", ""),
                    "operator_name": raw_data.get("operator_name") or raw_data.get("operator", ""),
                    "route_colour": raw_data.get("route_colour", ""),
                    "timetable": []
                }
                
                timetable_matrix = scrape_html_timetable(route_url)
                slim_route_data["timetable"] = timetable_matrix
                
                if timetable_matrix:
                    print(f"  -> SUCCESS: Scraped {len(timetable_matrix)} directional sets.")
                else:
                    print("  -> FAILED: Timetable array is empty.")
                    
                route_cache[route_id] = slim_route_data
            else:
                print(f"  -> Skipping route {route_id}: API status {api_res.status_code}")
        except Exception as e:
            print(f"  -> Error during synchronization: {e}")

    try:
        with open(CACHE_FILE_NAME, "w", encoding="utf-8") as f:
            json.dump(route_cache, f, separators=(',', ':'), ensure_ascii=False)
        print(f"\nForce sync complete. Static registry holds {len(route_cache)} entries.")
    except Exception as e:
        print(f"\nFile writing block error: {e}")

if __name__ == "__main__":
    main()
