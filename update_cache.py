import os
import re
import json
import requests

VEHICLES_API_URL = "https://www.mybustimes.cc/api/group/Swift%20Connect%20Group/vehicles/?ymax=56.96749375372495&ymin=22.98020869942421&xmax=26.253456525775164&xmin=-46.11789196263385&limit=5000"
CACHE_FILE_NAME = "global_routes_cache.json"

def load_existing_cache():
    if os.path.exists(CACHE_FILE_NAME):
        try:
            with open(CACHE_FILE_NAME, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Warning: Could not read existing cache file ({e}). Starting fresh.")
    return {}

def save_cache(cache_data):
    try:
        with open(CACHE_FILE_NAME, "w", encoding="utf-8") as f:
            json.dump(cache_data, f, indent=2, ensure_ascii=False)
        print(f"Successfully saved {len(cache_data)} routes to {CACHE_FILE_NAME}")
    except Exception as e:
        print(f"Error saving cache file: {e}")

def main():
    print("Starting global route cache sync...")
    route_cache = load_existing_cache()
    
    # 1. Fetch live tracking fleet records
    try:
        response = requests.get(VEHICLES_API_URL, timeout=15)
        response.raise_for_status()
        data = response.json()
        vehicles = data.get("results", data) if isinstance(data, dict) else data
    except Exception as e:
        print(f"Critical Error: Failed to fetch active vehicles data: {e}")
        return

    # 2. Extract active route IDs using regex mapping
    active_route_ids = set()
    for record in vehicles:
        service = record.get("service") or {}
        url_path = service.get("url") or ""
        
        match = re.search(r"/route/(\d+)/?", url_path)
        if match:
            active_route_ids.add(match.group(1))

    print(f"Found {len(active_route_ids)} unique route IDs currently running on the network.")

    # 3. Fetch missing details incrementally
    updated = False
    for route_id in active_route_ids:
        if route_id in route_cache:
            continue  # Already stored in server cache, skip API hit
            
        print(f"New route detected! Fetching details for ID: {route_id}")
        try:
            route_res = requests.get(f"https://www.mybustimes.cc/api/operator/route/{route_id}/", timeout=10)
            if route_res.status_code == 200:
                route_cache[route_id] = route_res.json()
                updated = True
            else:
                print(f"Skipping route {route_id}: Received HTTP status {route_res.status_code}")
        except Exception as e:
            print(f"Failed to fetch details for route ID {route_id}: {e}")

    # 4. Write back to disk if updates occurred
    if updated or not os.path.exists(CACHE_FILE_NAME):
        save_cache(route_cache)
    else:
        print("Cache is already completely up to date. No writes required.")

if __name__ == "__main__":
    main()
