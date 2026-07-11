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
    
    all_rows = []
    for table in tables:
        rows = table.find_all('tr')
        if not rows: continue
        
        headers = []
        thead = table.find('thead')
        if thead:
            headers = [th.get_text(strip=True) for th in thead.find_all('th')]
        else:
            first_row_cells = rows[0].find_all(['th', 'td'])
            if all(cell.name == 'th' for cell in first_row_cells) or (first_row_cells and first_row_cells[0].name == 'th'):
                headers = [cell.get_text(strip=True) for cell in first_row_cells]
                rows = rows[1:] 
            else:
                headers = ["Stop Name"] + [f"col_{i}" for i in range(1, len(first_row_cells))]

        for tr in rows:
            cells = tr.find_all(['td', 'th'])
            if not cells: continue
            
            row_data = []
            for cell in cells:
                text = cell.get_text(separator=", ", strip=True)
                if re.search(r'(\d{2}:\d{2}),\s*(\d{2}:\d{2})', text):
                    text = re.sub(r'(\d{2}:\d{2}),\s*(\d{2}:\d{2})', r'\1 arr<br>\2 dep', text)
                row_data.append(text)
                
            if row_data:
                row_dict = {}
                for i, val in enumerate(row_data):
                    key = headers[i].lower().replace(" ", "_") if i < len(headers) and headers[i] else f"col_{i}"
                    row_dict[key] = val
                all_rows.append(row_dict)
    return all_rows

def scrape_html_timetable(route_url):
    directions_data = []
    try:
        full_url = f"{BASE_URL}{route_url}" if route_url.startswith("/") else route_url
        response = requests.get(full_url, headers=SCRAPE_HEADERS, timeout=15)
        if response.status_code != 200: return []
        
        soup = BeautifulSoup(response.text, 'html.parser')
        dir_links = {}
        
        selects = soup.find_all('select')
        for select in selects:
            options = select.find_all('option')
            if len(options) > 0:
                for opt in options:
                    val = opt.get('value', '')
                    name = opt.get_text(strip=True)
                    name = re.sub(r'\s*\(.*?\)', '', name).strip()
                    name = re.sub(r'\s*[-–]\s*\d{1,2}[/\\]\d{1,2}[/\\]\d{2,4}.*', '', name).strip()
                    
                    if val and name:
                        if not val.startswith("?") and not val.startswith("/") and not val.startswith("http"):
                            val = f"?direction={val}"
                        dir_links[name] = val
                break 

        if not dir_links:
            for a in soup.find_all('a', href=True):
                href = a['href']
                if 'direction=' in href or 'dir=' in href:
                    name = a.get_text(strip=True)
                    name = re.sub(r'\s*\(.*?\)', '', name).strip()
                    if name: dir_links[name] = href

        # Deduplicate links to prevent infinite loops or bloated repeated scans
        unique_urls = set()
        filtered_links = {}
        for name, href in dir_links.items():
            if href not in unique_urls:
                unique_urls.add(href)
                filtered_links[name] = href

        if not filtered_links:
            data = parse_table_html(soup)
            if data:
                directions_data.append({"direction": "Timetable", "data": data})
        else:
            for name, href in filtered_links.items():
                print(f"    -> Scraping discovered direction: {name}")
                if href.startswith("?"):
                    dir_full = full_url.split("?")[0] + href
                elif href.startswith("/"):
                    dir_full = f"{BASE_URL}{href}"
                else:
                    dir_full = href
                    
                dir_res = requests.get(dir_full, headers=SCRAPE_HEADERS, timeout=15)
                if dir_res.status_code == 200:
                    dir_soup = BeautifulSoup(dir_res.text, 'html.parser')
                    dir_data = parse_table_html(dir_soup)
                    if dir_data:
                        directions_data.append({"direction": name, "data": dir_data})
                        
        return directions_data
    except Exception as e:
        print(f"  -> Failed parsing HTML structure: {e}")
        return []

def main():
    print("Initiating FORCE RE-SCRAPE of all routes (with strict data limits)...")
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
                
                # --- THE DATA DIET ---
                # We surgically extract ONLY the fields we need and throw away everything else (like giant map coordinates)
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
        # --- THE MINIFIER ---
        # separators=(',', ':') removes all blank spaces and compresses the file size significantly
        with open(CACHE_FILE_NAME, "w", encoding="utf-8") as f:
            json.dump(route_cache, f, separators=(',', ':'), ensure_ascii=False)
        print(f"\nForce sync complete. Static registry holds {len(route_cache)} entries.")
    except Exception as e:
        print(f"\nFile writing block error: {e}")

if __name__ == "__main__":
    main()
