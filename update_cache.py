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
        except Exception:
            pass
    return {}

def parse_table_html(soup):
    tables = soup.find_all('table')
    if not tables: return []
    all_directions = []
    
    for table in tables:
        rows = table.find_all('tr')
        if not rows: continue
        
        raw_grid = []
        for tr in rows:
            cls_str = " ".join(tr.get('class', []))
            th_cells = tr.find_all('th')
            if th_cells:
                cls_str += " " + " ".join(th_cells[0].get('class', []))
            
            # Identify Timing Points via HTML Classes
            is_timing = 'major' in cls_str.lower() or 'timing' in cls_str.lower()
            
            cells = tr.find_all(['td', 'th'])
            row_text = []
            for cell in cells:
                text = cell.get_text(separator=", ", strip=True)
                if re.search(r'(\d{2}:\d{2}),\s*(\d{2}:\d{2})', text):
                    text = re.sub(r'(\d{2}:\d{2}),\s*(\d{2}:\d{2})', r'\1 arr<br>\2 dep', text)
                row_text.append(text)
                
            if any(t and t != "-" for t in row_text): 
                raw_grid.append({'text': row_text, 'is_timing': is_timing})

        if not raw_grid: continue

        # Filter out non-timing points to declutter the UI (falls back to all stops if none are marked)
        has_explicit_timing = any(r['is_timing'] for r in raw_grid)
        filtered_grid = [r['text'] for r in raw_grid if (not has_explicit_timing) or r['is_timing']]

        num_cols = max(len(r) for r in filtered_grid)
        label_indices = []
        for col_idx in range(num_cols):
            time_count, text_count = 0, 0
            for row in filtered_grid:
                if col_idx < len(row):
                    val = row[col_idx]
                    if val and val != "-":
                        if re.search(r'\d{1,2}:\d{2}', val): time_count += 1
                        else: text_count += 1
            if text_count > time_count or (time_count == 0 and text_count > 0): label_indices.append(col_idx)
                
        if not label_indices: label_indices = [0]

        for idx_pos, start_col in enumerate(label_indices):
            end_col = label_indices[idx_pos + 1] if idx_pos + 1 < len(label_indices) else num_cols
            dir_rows = []
            headers = ["stop_name"] + [f"col_{i}" for i in range(1, end_col - start_col)]
            last_valid_stop = ""
            
            for row in filtered_grid:
                while len(row) < end_col: row.append("-")
                sub_row = row[start_col:end_col]
                stop_name = sub_row[0]
                if stop_name.lower() in ["stop name", "stops", "bus stop"]: continue
                if stop_name and stop_name != "-":
                    row_dict = {}
                    has_times = False
                    for i, val in enumerate(sub_row):
                        key = headers[i].lower().replace(" ", "_") if i < len(headers) and headers[i] else f"col_{i}"
                        row_dict[key] = val
                        if i > 0 and val != "-": has_times = True
                    if has_times:
                        dir_rows.append(row_dict)
                        last_valid_stop = stop_name

            if dir_rows:
                dest = last_valid_stop.title()
                all_directions.append({"direction": f"Towards {dest}" if dest else "Timetable", "data": dir_rows})
    return all_directions

def get_day_links(soup):
    date_links = {}
    selects = soup.find_all('select')
    for sel in selects:
        opts = sel.find_all('option')
        if any('date=' in o.get('value', '') for o in opts) or 'date' in sel.get('name', '').lower():
            for opt in opts:
                val = opt.get('value')
                name = opt.get_text(strip=True)
                # Strips out strict dates to categorize by pure weekday string
                clean_name = re.sub(r'\s*\d{1,2}\s+[A-Za-z]+\s+\d{4}.*', '', name).strip()
                clean_name = re.sub(r'\s*\d{1,2}\s+[A-Za-z]+.*', '', clean_name).strip()
                if not clean_name: clean_name = name 
                
                if val and clean_name not in date_links:
                    if not val.startswith("?") and not val.startswith("/") and not val.startswith("http"):
                        val = f"?date={val}"
                    date_links[clean_name] = val
            break
    return date_links

def scrape_html_timetable(route_url):
    try:
        full_url = f"{BASE_URL}{route_url}" if route_url.startswith("/") else route_url
        response = requests.get(full_url, headers=SCRAPE_HEADERS, timeout=15)
        if response.status_code != 200: return {}
        
        soup = BeautifulSoup(response.text, 'html.parser')
        day_links = get_day_links(soup)
        
        timetable_by_day = {}
        
        if not day_links:
            data = parse_table_html(soup)
            if data: timetable_by_day["Standard Service"] = data
        else:
            for day_name, day_href in day_links.items():
                day_full_url = (full_url.split("?")[0] + day_href) if day_href.startswith("?") else (f"{BASE_URL}{day_href}" if day_href.startswith("/") else day_href)
                day_res = requests.get(day_full_url, headers=SCRAPE_HEADERS, timeout=15)
                if day_res.status_code == 200:
                    day_soup = BeautifulSoup(day_res.text, 'html.parser')
                    day_data = parse_table_html(day_soup)
                    if day_data:
                        timetable_by_day[day_name] = day_data
                        
        return timetable_by_day
    except Exception as e:
        print(f"  -> Failed: {e}")
        return {}

def main():
    print("Initiating Smart Cache Differential Scanner...")
    route_cache = load_existing_cache()
    
    try:
        data = requests.get(VEHICLES_API_URL, timeout=15).json()
        vehicles = data.get("results", data) if isinstance(data, dict) else data
    except Exception as e: return
    
    discovered = {}
    for r in vehicles:
        m = re.search(r"/route/(\d+)/?", r.get("service", {}).get("url", ""))
        if m: discovered[m.group(1)] = r.get("service", {}).get("url", "")

    # Incremental logic: Find only routes not in cache
    missing_routes = {rid: url for rid, url in discovered.items() if rid not in route_cache}
    
    if not missing_routes:
        print(f"All {len(discovered)} active routes are already cached. Sleeping.")
        return
        
    print(f"Discovered {len(missing_routes)} missing routes. Commencing targeted extraction.")

    for route_id, route_url in missing_routes.items():
        try:
            raw = requests.get(f"https://www.mybustimes.cc/api/operator/route/{route_id}/", timeout=10).json()
            if str(raw.get("route_num", "")).strip() == "?" or raw.get("hidden"): continue
            
            slim = {k: raw.get(k, "") for k in ["id", "route_num", "route_name", "inbound_destination", "outbound_destination", "operator_name", "route_colour"]}
            print(f"  -> Scraping Timetables & Days for Route: {slim['route_num']}")
            slim["timetable_by_day"] = scrape_html_timetable(route_url)
            
            route_cache[route_id] = slim
        except Exception as e: 
            print(f"Error {route_id}: {e}")
            
    with open(CACHE_FILE_NAME, "w", encoding="utf-8") as f: 
        json.dump(route_cache, f, separators=(',', ':'), ensure_ascii=False)
        
    print(f"Targeted extraction complete. Static registry holds {len(route_cache)} entries.")

if __name__ == "__main__": main()
