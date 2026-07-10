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
    """Extracts rows and headers from the raw BeautifulSoup object."""
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
            if all(cell.name == 'th' for cell in first_row_cells):
                headers = [cell.get_text(strip=True) for cell in first_row_cells]
                rows = rows[1:] 
            else:
                headers = ["Stop Name"] + [f"Bus {i}" for i in range(1, len(first_row_cells))]

        for tr in rows:
            cells = tr.find_all(['td', 'th'])
            if not cells: continue
            
            row_data = []
            for cell in cells:
                text = cell.get_text(separator=", ", strip=True)
                # Formats XX:XX, XX:XX into Arr/Dep
                if re.search(r'(\d{2}:\d{2}),\s*(\d{2}:\d{2})', text):
                    text = re.sub(r'(\d{2}:\d{2}),\s*(\d{2}:\d{2})', r'\1 arr<br>\2 dep', text)
                row_data.append(text)
                
            if row_data:
                row_dict = {}
                for i, val in enumerate(row_data):
                    key = headers[i].lower().replace(" ", "_") if i < len(headers) else f"col_{i}"
                    row_dict[key] = val
                all_rows.append(row_dict)
    return all_rows

def scrape_html_timetable(route_url):
    """Scrapes the default direction, then hunts for the opposite direction links."""
    directions_data = []
    try:
        full_url = f"{BASE_URL}{route_url}" if route_url.startswith("/") else route_url
        response = requests.get(full_url, headers=SCRAPE_HEADERS, timeout=15)
        if response.status_code != 200: return []
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # 1. Parse Default Page
        default_data = parse_table_html(soup)
        if default_data:
            active_dir_name = "Service Timetable"
            selected_opt = soup.find('option', selected=True)
            if selected_opt:
                active_dir_name = selected_opt.get_text(strip=True)
            
            directions_data.append({
                "direction": active_dir_name,
                "data": default_data
            })

        # 2. Hunt for Inbound/Outbound Tabs
        dir_urls = {}
        for a in soup.find_all('a', href=True):
            if 'direction=' in a['href'] and a['href'] not in route_url:
                name = a.get_text(strip=True)
                if name: dir_urls[name] = a['href']
                
        for opt in soup.find_all('option', value=True):
            if 'direction=' in opt['value'] and not opt.has_attr('selected'):
                name = opt.get_text(strip=True)
                if name: dir_urls[name] = opt['value']

        # 3. Scrape the discovered directions
        for name, href in dir_urls.items():
            print(f"    -> Scraping discovered direction: {name}")
            dir_full = full_url.split("?")[0] + href if href.startswith("?") else (f"{BASE_URL}{href}" if href.startswith("/") else href)
            
            dir_res = requests.get(dir_full, headers=SCRAPE_HEADERS, timeout=15)
            if dir_res.status_code == 200:
                dir_soup = BeautifulSoup(dir_res.text, 'html.parser')
                dir_data = parse_table_html(dir_soup)
                if dir_data:
                    directions_data.append({
                        "direction": name,
                        "data": dir_data
                    })
                    
        return directions_data
    except Exception as e:
        print(f"  -> Failed parsing HTML structure: {e}")
        return []

def main():
    print("Initiating FORCE RE-SCRAPE of all routes...")
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
                route_data = api_res.json()
                
                route_num = str(route_data.get("route_num", "")).strip()
                route_name = str(route_data.get("route_name", "")).strip().lower()
                is_hidden = route_data.get("hidden") or route_data.get("is_hidden") or "hidden" in route_name
                
                if route_num == "?" or is_hidden:
                    print(f"  -> Skipping HTML scrape. Route is hidden.")
                    route_data["timetable"] = []
                else:
                    timetable_matrix = scrape_html_timetable(route_url)
                    route_data["timetable"] = timetable_matrix
                    if timetable_matrix:
                        print(f"  -> SUCCESS: Scraped {len(timetable_matrix)} directional sets.")
                    else:
                        print("  -> FAILED: Timetable array is empty.")
                    
                route_cache[route_id] = route_data
            else:
                print(f"  -> Skipping route {route_id}: API status {api_res.status_code}")
        except Exception as e:
            print(f"  -> Error during synchronization: {e}")

    try:
        with open(CACHE_FILE_NAME, "w", encoding="utf-8") as f:
            json.dump(route_cache, f, indent=2, ensure_ascii=False)
        print(f"\nForce sync complete. Static registry holds {len(route_cache)} entries.")
    except Exception as e:
        print(f"\nFile writing block error: {e}")

if __name__ == "__main__":
    main()
