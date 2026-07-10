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

def scrape_html_timetable(route_url):
    try:
        full_url = f"{BASE_URL}{route_url}" if route_url.startswith("/") else route_url
        response = requests.get(full_url, headers=SCRAPE_HEADERS, timeout=15)
        
        if response.status_code != 200:
            print(f"  -> Server blocked the HTML request! HTTP Status: {response.status_code}")
            return []
            
        soup = BeautifulSoup(response.text, 'html.parser')
        
        tables = soup.find_all('table')
        if not tables:
            print(f"  -> Page loaded, but no <table> elements were found in the HTML.")
            return []
            
        all_rows = []
        print(f"  -> Found {len(tables)} tables on the page. Extracting data...")
        
        for index, table in enumerate(tables):
            trs = table.find_all('tr')
            print(f"  -> [DEBUG] Table {index + 1} has {len(trs)} <tr> rows.")
            
            # --- DIAGNOSTIC TRIGGER ---
            # If the table has 1 or 0 rows, print the raw HTML so we can see what's going on
            if len(trs) <= 1:
                print(f"  -> [CRITICAL] Table {index + 1} is empty or irregular. Raw HTML snippet:")
                print("--------------------------------------------------")
                print(str(table)[:800]) # Prints the first 800 characters of the table HTML
                print("--------------------------------------------------")
            
            headers = []
            thead = table.find('thead')
            if thead:
                headers = [th.get_text(strip=True) for th in thead.find_all('th')]
                
            tbody = table.find('tbody') or table
            for tr in tbody.find_all('tr'):
                cells = tr.find_all(['td', 'th'])
                row_data = []
                for cell in cells:
                    text = cell.get_text(separator=", ", strip=True)
                    if re.search(r'(\d{2}:\d{2}),\s*(\d{2}:\d{2})', text):
                        text = re.sub(r'(\d{2}:\d{2}),\s*(\d{2}:\d{2})', r'\1 arr<br>\2 dep', text)
                    row_data.append(text)
                    
                if row_data:
                    if not headers:
                        headers = row_data
                        continue
                    
                    row_dict = {}
                    for i, val in enumerate(row_data):
                        if i < len(headers):
                            key = headers[i].lower().replace(" ", "_")
                            row_dict[key] = val
                    all_rows.append(row_dict)
                    
        return all_rows
    except Exception as e:
        print(f"  -> Failed parsing HTML structure: {e}")
        return []

def main():
    print("Initiating global automated route & timetable synchronization loop...")
    route_cache = load_existing_cache()
    
    try:
        response = requests.get(VEHICLES_API_URL, timeout=15)
        response.raise_for_status()
        try:
            data = response.json()
        except ValueError:
            print(f"CRITICAL ERROR: API returned HTML instead of JSON. Server output preview:\n{response.text[:300]}")
            return
            
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

    print(f"Discovered {len(discovered_routes)} operational routes across tracking channels.")

    cache_modified = False
    for route_id, route_url in discovered_routes.items():
        if route_id in route_cache and "timetable" in route_cache[route_id] and len(route_cache[route_id]["timetable"]) > 0:
            continue
            
        print(f"\nSyncing registry and timetable for Route ID: {route_id}")
        try:
            api_res = requests.get(f"https://www.mybustimes.cc/api/operator/route/{route_id}/", timeout=10)
            if api_res.status_code == 200:
                try:
                    route_data = api_res.json()
                except ValueError:
                    print(f"  -> API returned invalid JSON for route {route_id}. Skipping.")
                    continue
                
                timetable_matrix = scrape_html_timetable(route_url)
                route_data["timetable"] = timetable_matrix
                
                if len(timetable_matrix) > 0:
                    print(f"  -> SUCCESS: Scraped {len(timetable_matrix)} scheduling rows.")
                else:
                    print("  -> FAILED: Timetable array is empty.")
                    
                route_cache[route_id] = route_data
                cache_modified = True
            else:
                print(f"  -> Skipping route {route_id}: API status {api_res.status_code}")
        except Exception as e:
            print(f"  -> Error during synchronization: {e}")

    if cache_modified or not os.path.exists(CACHE_FILE_NAME):
        try:
            with open(CACHE_FILE_NAME, "w", encoding="utf-8") as f:
                json.dump(route_cache, f, indent=2, ensure_ascii=False)
            print(f"\nGlobal sync complete. Static registry holds {len(route_cache)} entries.")
        except Exception as e:
            print(f"\nFile writing block error: {e}")
    else:
        print("\nAll active network route assets perfectly mirror static cache records.")

if __name__ == "__main__":
    main()
