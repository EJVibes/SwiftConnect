import os
import re
import json
import requests
from bs4 import BeautifulSoup

VEHICLES_API_URL = "https://www.mybustimes.cc/api/group/Swift%20Connect%20Group/vehicles/?ymax=56.96749375372495&ymin=22.98020869942421&xmax=26.253456525775164&xmin=-46.11789196263385&limit=5000"
CACHE_FILE_NAME = "global_routes_cache.json"
BASE_URL = "https://www.mybustimes.cc"

def load_existing_cache():
    if os.path.exists(CACHE_FILE_NAME):
        try:
            with open(CACHE_FILE_NAME, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Starting fresh cache ledger: {e}")
    return {}

def scrape_html_timetable(route_url):
    """
    Visits the web page layout for the route, finds ALL timetable HTML tables
    (Inbound & Outbound), parses them into a clean data array, and formats the times.
    """
    try:
        full_url = f"{BASE_URL}{route_url}" if route_url.startswith("/") else route_url
        response = requests.get(full_url, timeout=15)
        if response.status_code != 200:
            return []
            
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Grab ALL tables on the page to ensure we get both Inbound and Outbound directions
        tables = soup.find_all('table')
        if not tables:
            return []
            
        all_rows = []
        
        for table in tables:
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
                    
                    # Intercepts 'XX:XX, XX:XX' and converts to Arr/Dep format with a line break
                    if re.search(r'(\d{2}:\d{2}),\s*(\d{2}:\d{2})', text):
                        text = re.sub(r'(\d{2}:\d{2}),\s*(\d{2}:\d{2})', r'\1 arr<br>\2 dep', text)
                        
                    row_data.append(text)
                    
                if row_data:
                    # If there wasn't a standard <thead>, treat the first row as the headers
                    if not headers:
                        headers = row_data
                        continue
                    
                    # Zip headers and row data into a dictionary
                    row_dict = {}
                    for i, val in enumerate(row_data):
                        if i < len(headers):
                            # Clean up header names to be used as keys
                            key = headers[i].lower().replace(" ", "_")
                            row_dict[key] = val
                    all_rows.append(row_dict)
                    
        return all_rows
    except Exception as e:
        print(f"Failed parsing HTML structure at {route_url}: {e}")
        return []

def main():
    print("Initiating global automated route & timetable synchronization loop...")
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

    print(f"Discovered {len(discovered_routes)} operational routes across tracking channels.")

    cache_modified = False
    for route_id, route_url in discovered_routes.items():
        if route_id in route_cache and "timetable" in route_cache[route_id] and len(route_cache[route_id]["timetable"]) > 0:
            continue
            
        print(f"Syncing registry and timetable for Route ID: {route_id}")
        try:
            api_res = requests.get(f"https://www.mybustimes.cc/api/operator/route/{route_id}/", timeout=10)
            if api_res.status_code == 200:
                route_data = api_res.json()
                
                # Run the HTML scraper
                timetable_matrix = scrape_html_timetable(route_url)
                route_data["timetable"] = timetable_matrix
                
                if len(timetable_matrix) > 0:
                    print(f"Successfully scraped {len(timetable_matrix)} scheduling rows.")
                else:
                    print("Timetable format empty or unaligned on target canvas.")
                    
                route_cache[route_id] = route_data
                cache_modified = True
            else:
                print(f"Skipping route {route_id}: HTTP API status {api_res.status_code}")
        except Exception as e:
            print(f"Failed processing synchronization step for route ID {route_id}: {e}")

    if cache_modified or not os.path.exists(CACHE_FILE_NAME):
        try:
            with open(CACHE_FILE_NAME, "w", encoding="utf-8") as f:
                json.dump(route_cache, f, indent=2, ensure_ascii=False)
            print(f"Global sync complete. Static registry holds {len(route_cache)} entries.")
        except Exception as e:
            print(f"File writing block error: {e}")
    else:
        print("All active network route assets perfectly mirror static cache records.")

if __name__ == "__main__":
    main()
