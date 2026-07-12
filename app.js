document.addEventListener("DOMContentLoaded", () => {
    injectGlobalStyling();
    injectFictionalWarning();
    
    initMobileMenu();
    
    if (document.getElementById('api-data-results')) initOperatorPage();
    if (document.getElementById('live-fleet-container')) initLiveFleetPage();
    if (window.location.pathname.includes('/route')) initRoutePage();
    if (document.getElementById('network-map')) initNetworkMap();
});

/* ==========================================
   GLOBAL WARNING & STYLING INJECTOR
   ========================================== */
function injectGlobalStyling() {
    const style = document.createElement('style');
    style.innerHTML = `
        /* Fictional Warning Banner */
        .fictional-warning-banner { background-color: #dc2626; color: #ffffff; text-align: center; padding: 14px 20px; font-size: 1.25rem; font-family: system-ui, -apple-system, sans-serif; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; width: 100%; position: sticky; top: 0; z-index: 999999; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
        
        .route-page-layout { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr); gap: 30px; width: 100%; }
        @media (max-width: 1200px) { .route-page-layout { grid-template-columns: 1fr; } }
        
        .timetable-column { min-width: 0; }
        .map-column { min-width: 0; }

        .day-tabs-container { display: flex; gap: 10px; margin-bottom: 25px; overflow-x: auto; padding-bottom: 10px; }
        .day-tab-btn { padding: 12px 24px; background: #e2e8f0; color: #1e293b; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 0.95rem; white-space: nowrap; transition: 0.2s; }
        .day-tab-btn:hover { background: #cbd5e1; }
        .day-tab-btn.active { background: var(--primary); color: white; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
        .route-detail-map { height: 750px; width: 100%; border-radius: 12px; position: sticky; top: 80px; z-index: 1; border: 2px solid #edf2f7; background: #f8fafc; }
    `;
    document.head.appendChild(style);

    // Full Width Screen Override
    if (window.location.pathname.includes('/route')) {
        const fullWidthStyle = document.createElement('style');
        fullWidthStyle.innerHTML = `
            body, html { overflow-x: hidden; }
            main, .container, .wrapper, #route-detail-container { 
                max-width: 96% !important; 
                width: 100% !important; 
                margin: 0 auto !important; 
                padding-left: 2% !important;
                padding-right: 2% !important;
            }
        `;
        document.head.appendChild(fullWidthStyle);
    }
}

function injectFictionalWarning() {
    const warningBanner = document.createElement('div');
    warningBanner.className = 'fictional-warning-banner';
    warningBanner.innerHTML = '⚠️ WARNING: THIS IS A FICTIONAL PROJECT. THESE BUSES AND TIMETABLES ARE NOT REAL. ⚠️';
    document.body.prepend(warningBanner);
}

/* ==========================================
   MOBILE MENU LOGIC
   ========================================== */
function initMobileMenu() {
    const toggleBtn = document.querySelector('.mobile-toggle');
    const nav = document.querySelector('.main-nav');
    if (toggleBtn && nav) {
        toggleBtn.addEventListener('click', (e) => { e.stopPropagation(); nav.classList.toggle('is-open'); toggleBtn.classList.toggle('is-active'); });
        document.addEventListener('click', (e) => {
            if (!nav.contains(e.target) && !toggleBtn.contains(e.target) && nav.classList.contains('is-open')) {
                nav.classList.remove('is-open');
                toggleBtn.classList.remove('is-active');
            }
        });
    }
}

/* ==========================================
   GLOBAL ROUTE CACHE ENGINE
   ========================================== */
let SWIFT_ROUTE_CACHE = {};
let IS_CACHE_INITIALIZED = false;

async function ensureGlobalRouteCacheLoaded() {
    if (IS_CACHE_INITIALIZED) return;
    try {
        const res = await fetch(`./global_routes_cache.json?t=${new Date().getTime()}`);
        if (res.ok) SWIFT_ROUTE_CACHE = await res.json();
    } catch (e) { console.warn("Static global_routes_cache.json unavailable."); }
    finally { IS_CACHE_INITIALIZED = true; }
}

function injectLocalRouteData(record) {
    if (record.service && record.service.url) {
        const match = record.service.url.match(/\/route\/(\d+)\/?/);
        if (match && match[1]) record._extractedRouteId = match[1];
    }
}

async function patchMissingRoutesOnTheFly(trackingRecords) {
    const missingRouteIds = new Set();
    trackingRecords.forEach(record => {
        if (record._extractedRouteId && !SWIFT_ROUTE_CACHE[record._extractedRouteId]) missingRouteIds.add(record._extractedRouteId);
    });
    if (missingRouteIds.size > 0) {
        const fetchPromises = Array.from(missingRouteIds).map(async (routeId) => {
            try {
                const res = await fetch(`https://www.mybustimes.cc/api/operator/route/${routeId}/`);
                if (res.ok) SWIFT_ROUTE_CACHE[routeId] = await res.json();
            } catch (e) {}
        });
        await Promise.all(fetchPromises);
    }
}

/* ==========================================
   BRANDING SYSTEM
   ========================================== */
function applyBrandingEngine(operatorName) {
    if (!operatorName) return;
    const normalize = operatorName.toLowerCase();
    const bodyDom = document.body;
    const globalLogo = document.getElementById('dynamic-logo');
    const visualAccent = document.getElementById('branding-accent');
    bodyDom.setAttribute('data-theme', 'swift-base');
    if (globalLogo) globalLogo.src = 'Swift Connect Icon Black.png';
    if (visualAccent) visualAccent.src = 'Swift Connect Long White.png';

    if (normalize.includes('wrekin')) {
        bodyDom.setAttribute('data-theme', 'wrekin');
        if (visualAccent) visualAccent.src = 'Wrekin Connect White Long.png';
    } else if (normalize.includes('railway') || normalize.includes('rail')) {
        bodyDom.setAttribute('data-theme', 'swift-base'); 
        if (visualAccent) visualAccent.src = 'Swift Connect White Full.png';
    } else if (normalize.includes('preservation') || normalize.includes('classic')) {
        bodyDom.setAttribute('data-theme', 'swift-classic');
        if (visualAccent) visualAccent.src = 'Swift Short White.png';
    } else if (normalize.includes('express')) {
        bodyDom.setAttribute('data-theme', 'swift-express');
        if (visualAccent) visualAccent.src = 'Swift Connect Express.png';
    }
}

/* ==========================================
   OPERATOR SUBPAGE LOGIC
   ========================================== */
async function initOperatorPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const targetOperator = urlParams.get('op');
    if (!targetOperator) { showOperatorError(); return; }

    if (targetOperator.toLowerCase().includes('express')) {
        const expressProfile = { operator_name: "Swift Express", operator_code: "Multi-Operator", region_name: "Cross-Network" };
        applyBrandingEngine(expressProfile.operator_name);
        renderOperatorMetrics(expressProfile);
        triggerRouteFetch(null, expressProfile.operator_name);
        return; 
    }

    let unifiedDataset = [];
    let queryTarget = encodeURIComponent(targetOperator);
    let apiEndpointUrl = `https://www.mybustimes.cc/api/operator/?operator_name__icontains=${queryTarget}`;

    try {
        while (apiEndpointUrl) {
            const fetchResponse = await fetch(apiEndpointUrl);
            if (!fetchResponse.ok) throw new Error("Network response error.");
            const structuredPayload = await fetchResponse.json();
            if (structuredPayload.results) unifiedDataset = unifiedDataset.concat(structuredPayload.results);
            apiEndpointUrl = structuredPayload.next; 
        }

        const matchedProfile = unifiedDataset.find(item => item.operator_name.trim().toLowerCase() === targetOperator.trim().toLowerCase());
        if (matchedProfile) {
            applyBrandingEngine(matchedProfile.operator_name);
            renderOperatorMetrics(matchedProfile);
            triggerRouteFetch(matchedProfile.operator_code, matchedProfile.operator_name);
        } else if (unifiedDataset.length > 0) {
            applyBrandingEngine(unifiedDataset[0].operator_name);
            renderOperatorMetrics(unifiedDataset[0]);
            triggerRouteFetch(unifiedDataset[0].operator_code, unifiedDataset[0].operator_name);
        } else { showOperatorError(); }
    } catch (networkError) { showOperatorError(); }
}

function renderOperatorMetrics(dataRecord) {
    document.getElementById('operator-title-name').innerText = dataRecord.operator_name || 'Unknown Operator';
    document.getElementById('operator-badge-code').innerText = `ID: ${dataRecord.operator_code || 'SWFT'}`;
    function extractRegionName(obj) {
        if (obj === null || typeof obj !== 'object') return null;
        for (const [key, value] of Object.entries(obj)) {
            if (key === 'region_name') return value;
            if (typeof value === 'object') {
                const nestedResult = extractRegionName(value);
                if (nestedResult) return nestedResult;
            }
        }
        return null;
    }
    let regionDisplay = extractRegionName(dataRecord);
    if (regionDisplay === null || regionDisplay === undefined || String(regionDisplay).trim() === '') regionDisplay = "Not Provided by API";

    const html = `
        <div class="operator-meta-banner">
            <div class="meta-box"><span class="meta-label">Operator Name</span><strong class="meta-value">${dataRecord.operator_name || 'N/A'}</strong></div>
            <div class="meta-box"><span class="meta-label">Operator Code</span><strong class="meta-value">${dataRecord.operator_code || 'N/A'}</strong></div>
            <div class="meta-box"><span class="meta-label">Region Name</span><strong class="meta-value">${regionDisplay}</strong></div>
        </div>
        <div class="routes-section-wrapper">
            <h3 class="routes-section-title">Registered Network Routes</h3>
            <div id="routes-container" class="routes-flex-box"><p>Fetching routes from database...</p></div>
        </div>
    `;
    document.getElementById('api-data-results').innerHTML = html;
    document.getElementById('api-loading-state').classList.add('hidden');
    document.getElementById('api-data-results').classList.remove('hidden');
}

function triggerRouteFetch(operatorCode, operatorName) {
    if (operatorName.toLowerCase().includes("express")) fetchExpressRoutes();
    else fetchStandardRoutes(operatorCode, operatorName);
}

async function fetchStandardRoutes(operatorCode, operatorName) {
    const container = document.getElementById('routes-container');
    if (!operatorCode) { container.innerHTML = `<p class="error-box">No Operator Code found to query routes.</p>`; return; }
    try {
        const res = await fetch(`https://www.mybustimes.cc/api/operator/route/?operator_code=${operatorCode}&limit=200`);
        const data = await res.json();
        let routes = data.results || [];
        if (operatorName.toLowerCase().includes('railway')) routes = routes.filter(r => r.route_num !== 'X45' && r.route_num !== 'X46');
        renderRouteList(routes, container);
    } catch (e) { container.innerHTML = `<p class="error-box">Could not load routes from the network.</p>`; }
}

async function fetchExpressRoutes() {
    const container = document.getElementById('routes-container');
    container.innerHTML = '<p>Loading targeted Swift Express network lines...</p>';
    try {
        let expressUrl = 'https://www.mybustimes.cc/api/operator/route/?id=&route_name__icontains=Swift+Express&route_num__icontains=&operator_code=&has_stops=unknown&stops_have_cords=unknown';
        let expressRoutes = [];
        while (expressUrl) {
            const res = await fetch(expressUrl);
            const data = await res.json();
            expressRoutes = expressRoutes.concat(data.results || []);
            expressUrl = data.next;
        }
        const uniqueRoutesMap = new Map();
        expressRoutes.forEach(r => { if (r.route_num) uniqueRoutesMap.set(r.route_num, r); });
        renderRouteList(Array.from(uniqueRoutesMap.values()), container);
    } catch (e) { container.innerHTML = `<p class="error-box">Failed to fetch specified dynamic express records.</p>`; }
}

function renderRouteList(routes, container) {
    let filteredRoutes = routes.filter(r => {
        const num = (r.route_num || '').toString().trim();
        const name = (r.route_name || '').toString().toLowerCase();
        if (num === '?') return false;
        if (r.hidden === true || r.is_hidden === true || name.includes('hidden')) return false;
        return true;
    });
    if (!filteredRoutes || filteredRoutes.length === 0) { container.innerHTML = '<p style="color: var(--secondary);">No active routes found for this division.</p>'; return; }
    filteredRoutes.sort((a, b) => {
        const numA = a.route_num ? a.route_num.toString() : '';
        const numB = b.route_num ? b.route_num.toString() : '';
        return numA.localeCompare(numB, undefined, {numeric: true, sensitivity: 'base'});
    });
    let html = '';
    filteredRoutes.forEach(r => {
        const routeId = r.id || '';
        const routeNum = r.route_num || '?';
        const routeName = r.route_name ? ` (${r.route_name})` : '';
        const start = r.inbound_destination || 'Unknown Start';
        const end = r.outbound_destination || 'Unknown Destination';
        const borderCol = r.route_colour ? (r.route_colour.startsWith('#') ? r.route_colour : `#${r.route_colour}`) : 'var(--primary)';
        let operatorLinkHtml = '';
        if (r.operator_name) {
            const encodedOp = encodeURIComponent(r.operator_name.trim());
            operatorLinkHtml = `<a href="operator?op=${encodedOp}" class="route-pill-operator" onclick="event.stopPropagation();">Division: ${r.operator_name}</a>`;
        }
        html += `
            <div class="route-pill route-pill-interactive" style="border-left-color: ${borderCol};" onclick="window.location.href='route?id=${routeId}'">
                <strong>${routeNum}${routeName}</strong>
                <span class="route-pill-dest">${start} &rarr; ${end}</span>
                ${operatorLinkHtml}
            </div>
        `;
    });
    container.innerHTML = html;
}

function showOperatorError() {
    document.getElementById('api-loading-state').classList.add('hidden');
    document.getElementById('api-error-state').classList.remove('hidden');
}

/* ==========================================
   ROUTE DETAIL PAGE LOGIC (DAY TABS & MAP)
   ========================================== */
function buildTableHtml(records) {
    if (!records || records.length === 0) return '';
    let headersSet = new Set();
    records.forEach(row => { Object.keys(row).forEach(k => { if (typeof row[k] !== 'object' && !Array.isArray(row[k])) headersSet.add(k); }); });
    let headers = Array.from(headersSet);
    if (headers.length === 0) headers = Object.keys(records[0]);
    
    let tableHtml = `<div style="overflow-x: auto; width: 100%; border-radius: var(--radius-soft); border: 1px solid #edf2f7; margin-bottom: 40px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                        <table class="route-data-table" style="margin: 0; width: 100%; text-align: center; white-space: nowrap;">
                            <thead><tr>`;
    headers.forEach(h => {
        let formattedKey = h.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        if (h.toLowerCase().startsWith('col_')) formattedKey = '';
        tableHtml += `<th style="text-align: center; background-color: var(--primary); color: white; padding: 15px;">${formattedKey}</th>`;
    });
    tableHtml += `</tr></thead><tbody>`;
    records.forEach(row => {
        tableHtml += `<tr>`;
        headers.forEach(h => { tableHtml += `<td style="padding: 12px; border-bottom: 1px solid #edf2f7; background-color: white;">${row[h] !== null && row[h] !== undefined && row[h] !== '' ? row[h] : '-'}</td>`; });
        tableHtml += `</tr>`;
    });
    tableHtml += `</tbody></table></div>`;
    return tableHtml;
}

function renderDayTables(dayData) {
    if (!dayData || !Array.isArray(dayData)) return '';
    let fullHtml = '';
    dayData.forEach(dir => {
        fullHtml += `<h3 style="margin: 0 0 15px 0; color: var(--dark); font-size: 1.3rem;">${dir.direction}</h3>`;
        fullHtml += buildTableHtml(dir.data);
    });
    return fullHtml;
}

window.switchTimetableDay = function(dayName) {
    document.querySelectorAll('.day-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.day-tab-btn[data-day="${dayName}"]`).classList.add('active');
    document.getElementById('timetable-dynamic-content').innerHTML = renderDayTables(window.currentRouteTimetable[dayName]);
};

async function initRoutePage() {
    const urlParams = newSearchParams(window.location.search);
    const routeId = urlParams.get('id');

    const loadingState = document.getElementById('route-loading');
    const errorState = document.getElementById('route-error-state');
    const container = document.getElementById('route-detail-container');
    const titleHeader = document.getElementById('route-page-title');
    const subHeader = document.getElementById('route-page-subtitle');

    if (!routeId) { loadingState.classList.add('hidden'); errorState.classList.remove('hidden'); return; }

    try {
        const apiRes = await fetch(`https://www.mybustimes.cc/api/operator/route/${routeId}/`);
        if (!apiRes.ok) throw new Error("Could not fetch route map data");
        const liveMapData = await apiRes.json();

        const num = (liveMapData.route_num || '').toString().trim();
        const name = (liveMapData.route_name || '').toString().toLowerCase();
        if (num === '?' || liveMapData.hidden === true || liveMapData.is_hidden === true || name.includes('hidden')) throw new Error("Hidden Route");

        const opName = liveMapData.operator_name || liveMapData.operator || 'Unknown Operator';
        applyBrandingEngine(opName); 

        const combinedRoute = `${liveMapData.route_num || ''} ${liveMapData.route_name || ''}`.trim();
        let titleString = combinedRoute;
        if (liveMapData.inbound_destination) titleString += ` - ${liveMapData.inbound_destination}`;
        if (liveMapData.outbound_destination) titleString += ` - ${liveMapData.outbound_destination}`;
        titleHeader.innerText = titleString;
        subHeader.innerText = `Operated by ${opName}`;

        await ensureGlobalRouteCacheLoaded();
        let timetableSectionHtml = `<div class="timetable-placeholder"><p>Timetable data currently unavailable. The system may still be scraping this route.</p></div>`;
        
        if (SWIFT_ROUTE_CACHE[routeId] && SWIFT_ROUTE_CACHE[routeId].timetable_by_day) {
            const dataObj = SWIFT_ROUTE_CACHE[routeId].timetable_by_day;
            const days = Object.keys(dataObj);
            
            if (days.length > 0) {
                window.currentRouteTimetable = dataObj;
                let tabsHtml = `<div class="day-tabs-container">`;
                days.forEach((day, idx) => {
                    tabsHtml += `<button class="day-tab-btn ${idx === 0 ? 'active' : ''}" data-day="${day}" onclick="switchTimetableDay('${day}')">${day}</button>`;
                });
                tabsHtml += `</div>`;
                timetableSectionHtml = tabsHtml + `<div id="timetable-dynamic-content">${renderDayTables(dataObj[days[0]])}</div>`;
            }
        } else if (SWIFT_ROUTE_CACHE[routeId] && Array.isArray(SWIFT_ROUTE_CACHE[routeId].timetable) && SWIFT_ROUTE_CACHE[routeId].timetable.length > 0) {
            timetableSectionHtml = `<div id="timetable-dynamic-content">${renderDayTables(SWIFT_ROUTE_CACHE[routeId].timetable)}</div>`;
        }

        const html = `
            <div class="card" style="padding: 0; overflow: hidden; background-color: transparent; box-shadow: none;">
                <div class="route-page-layout">
                    
                    <div class="timetable-column" style="background-color: white; padding: 35px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                        <h2 style="color: var(--primary); margin: 0 0 25px 0;">Route Timetable</h2>
                        ${timetableSectionHtml}
                    </div>

                    <div class="map-column">
                        <div id="route-detail-map" class="route-detail-map"></div>
                    </div>

                </div>
            </div>
        `;

        container.innerHTML = html;
        loadingState.classList.add('hidden');
        container.classList.remove('hidden');

        if (typeof L !== 'undefined') {
            const map = L.map('route-detail-map').setView([52.5, -2.0], 11);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);

            let mapBounds = [];
            let drawColor = '#2292ef'; 
            if (liveMapData.route_colour && typeof liveMapData.route_colour === 'string') {
                drawColor = liveMapData.route_colour.startsWith('#') ? liveMapData.route_colour : `#${liveMapData.route_colour}`;
            }

            // Universal Geo-Finder: Scans the entire API response recursively for coordinates
            let mapPaths = [];
            let mapStops = [];

            function findMapData(obj) {
                if (!obj || typeof obj !== 'object') return;
                
                if (Array.isArray(obj)) {
                    // Check if it's an array of raw coordinates e.g. [[lat, lon], [lat, lon]]
                    if (obj.length > 1 && Array.isArray(obj[0]) && typeof obj[0][0] === 'number') {
                        let path = [];
                        obj.forEach(coord => {
                            if(Array.isArray(coord) && coord.length >= 2) {
                                // Maps to UK boundaries to guarantee Lat/Lon orientation
                                let lat = Math.abs(coord[0]) > 49 ? coord[0] : coord[1];
                                let lon = Math.abs(coord[0]) > 49 ? coord[1] : coord[0];
                                path.push([lat, lon]);
                            }
                        });
                        if (path.length > 1) mapPaths.push(path);
                        return;
                    }
                    obj.forEach(child => findMapData(child));
                } else {
                    if ((obj.latitude || obj.lat) && (obj.longitude || obj.lon)) {
                        mapStops.push(obj);
                    }
                    Object.values(obj).forEach(child => findMapData(child));
                }
            }

            findMapData(liveMapData);

            if (mapPaths.length > 0 || mapStops.length > 0) {
                mapPaths.forEach(path => {
                    const polyline = L.polyline(path, { color: drawColor, weight: 5, opacity: 0.8 }).addTo(map);
                    mapBounds.push(polyline.getBounds());
                });

                mapStops.forEach(stop => {
                    let lat = stop.latitude || stop.lat;
                    let lon = stop.longitude || stop.lon;
                    if (lat && lon) {
                        L.circleMarker([lat, lon], {
                            radius: 5, color: '#1e293b', fillColor: 'white', fillOpacity: 1, weight: 2
                        }).addTo(map).bindPopup(`<strong>${stop.name || stop.stop_name || 'Stop'}</strong>`);
                    }
                });

                if (mapBounds.length > 0) {
                    const group = new L.featureGroup(mapBounds.map(b => L.rectangle(b)));
                    map.fitBounds(group.getBounds(), { padding: [40, 40] });
                }
            } else {
                const mapDiv = document.getElementById('route-detail-map');
                const overlay = document.createElement('div');
                overlay.innerHTML = '<div style="position:absolute; top:0; left:0; right:0; bottom:0; background:rgba(255,255,255,0.85); z-index:999; display:flex; align-items:center; justify-content:center; text-align:center; padding:20px; border-radius:12px;"><strong style="font-size:1.2rem; color:var(--dark);">GPS Pathing Data is currently unavailable for this route.</strong></div>';
                mapDiv.style.position = 'relative';
                mapDiv.appendChild(overlay);
            }
        } else {
            document.getElementById('route-detail-map').innerHTML = `<div style="display: flex; align-items: center; justify-content: center; height: 100%; text-align: center; color: #64748b; font-weight: bold; padding: 20px;">Interactive Map System offline.</div>`;
        }

    } catch (e) {
        console.error("Route Loading Error: ", e);
        loadingState.classList.add('hidden');
        container.classList.add('hidden');
        errorState.classList.remove('hidden');
    }
}

/* ==========================================
   LIVE FLEET TRACKING LOGIC (GRID VIEW)
   ========================================== */
async function initLiveFleetPage() {
    const container = document.getElementById('live-fleet-container');
    const loading = document.getElementById('fleet-loading');
    const apiUrl = "https://www.mybustimes.cc/api/group/Swift%20Connect%20Group/vehicles/?ymax=56.96749375372495&ymin=22.98020869942421&xmax=26.253456525775164&xmin=-46.11789196263385&limit=5000";

    async function loadFleetGrid() {
        try {
            const response = await fetch(apiUrl);
            const data = await response.json();
            const trackingRecords = data.results || data; 
            if (trackingRecords.length === 0) { container.innerHTML = '<p class="error-box">No vehicles currently active in this sector.</p>'; return; }

            await ensureGlobalRouteCacheLoaded();
            trackingRecords.forEach(record => injectLocalRouteData(record));
            await patchMissingRoutesOnTheFly(trackingRecords);

            let html = '<div class="data-grid fleet-grid">';
            trackingRecords.forEach(record => {
                const vehObj = record.vehicle || {};
                let fleetNum = 'N/A', reg = 'UNKNOWN REG';
                if (vehObj.name) {
                    const nameParts = vehObj.name.split('-');
                    if (nameParts.length >= 2) { fleetNum = nameParts[0].trim(); reg = nameParts.slice(1).join('-').trim(); } 
                    else { fleetNum = vehObj.name.trim(); }
                }

                const vehUrl = vehObj.url ? `https://www.mybustimes.cc${vehObj.url}` : '#';
                const routeUrl = record._extractedRouteId ? `route?id=${record._extractedRouteId}` : 'route';
                let routeDisplay = record.route || 'Not in service';
                if (record._extractedRouteId && SWIFT_ROUTE_CACHE[record._extractedRouteId]) {
                    const rData = SWIFT_ROUTE_CACHE[record._extractedRouteId];
                    const rNum = rData.route_num || '';
                    const rName = rData.route_name ? ` (${rData.route_name})` : '';
                    if (rNum || rName) routeDisplay = `${rNum}${rName}`.trim();
                }

                const dest = record.destination || 'Depot';
                const operator = vehObj.operator_name || record.operator_name || record.operator || 'Swift Connect';
                const opUrl = `operator?op=${encodeURIComponent(operator)}`;
                
                let rawFeatures = vehObj.features || record.features || '';
                let featuresList = 'None specified';
                if (Array.isArray(rawFeatures)) rawFeatures = rawFeatures.join(', ');
                if (typeof rawFeatures === 'string' && rawFeatures.trim() !== '') featuresList = rawFeatures.replace(/<br\s*\/?>/gi, ', ');

                html += `
                    <div class="card fleet-card">
                        <p style="margin-bottom: 4px; font-size: 1.05rem;"><strong>Route:</strong> <a href="${routeUrl}" style="color: var(--primary); text-decoration: none; font-weight: bold;">${routeDisplay}</a></p>
                        <p style="margin-bottom: 12px; font-size: 0.95rem;"><strong>To:</strong> ${dest}</p>
                        <a href="${vehUrl}" target="_blank" style="text-decoration: none; display: block; transition: opacity 0.2s;" onmouseover="this.style.opacity=0.8" onmouseout="this.style.opacity=1">
                            <h3 style="color: var(--primary); margin-bottom: 6px; font-size: 1.3rem;">${fleetNum}</h3>
                            <p style="display: inline-block; background-color: #FFFF00; color: black; border: 1px solid #ccc; padding: 4px 10px; border-radius: 6px; font-weight: 800; font-family: monospace; font-size: 0.9rem; margin-bottom: 10px;">${reg}</p>
                        </a>
                        <p style="margin-bottom: 5px; font-size: 0.85rem; color: var(--secondary);"><strong>Features:</strong> ${featuresList}</p>
                        <hr style="margin:15px 0 10px 0; border:0; border-top:1px solid #edf2f7;">
                        <p style="margin:0; font-size:0.9rem; font-weight: bold;"><a href="${opUrl}" style="color: var(--secondary); text-decoration: none; border-bottom: 1px dashed var(--secondary);">${operator}</a></p>
                    </div>
                `;
            });
            html += '</div>';
            container.innerHTML = html;
        } catch (error) { container.innerHTML = '<p class="error-box">Error connecting to the live tracking satellite.</p>'; } 
        finally { loading.classList.add('hidden'); }
    }
    await loadFleetGrid();
    setInterval(loadFleetGrid, 60000);
}

/* ==========================================
   INTERACTIVE NETWORK MAP LOGIC
   ========================================== */
async function initNetworkMap() {
    const mapContainer = document.getElementById('network-map');
    if (!mapContainer) return;
    const map = L.map('network-map').setView([52.5, -2.0], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
    const markersLayer = L.layerGroup().addTo(map);
    const activeMarkers = {}; 
    const apiUrl = "https://www.mybustimes.cc/api/group/Swift%20Connect%20Group/vehicles/?ymax=56.96749375372495&ymin=22.98020869942421&xmax=26.253456525775164&xmin=-46.11789196263385&limit=5000";

    function getBusIcon(hexColor, heading) {
        return L.divIcon({
            className: '', 
            html: `
                <div style="transform: rotate(${heading}deg); transform-origin: center; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 200" width="28" height="56" style="filter: drop-shadow(0px 3px 4px rgba(0,0,0,0.5));">
                        <path d="M 10 180 A 10 10 0 0 0 20 190 L 80 190 A 10 10 0 0 0 90 180 L 90 70 C 90 30, 80 10, 65 10 Q 50 5, 35 10 C 20 10, 10 30, 10 70 Z" fill="${hexColor}" stroke="#111" stroke-width="4" />
                        <path d="M 13 65 C 13 35, 25 18, 38 14 Q 50 10, 62 14 C 75 18, 87 35, 87 65 Q 50 75, 13 65 Z" fill="#1a1a1a" />
                        <rect x="25" y="100" width="50" height="35" rx="4" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2"/>
                        <line x1="35" y1="105" x2="65" y2="105" stroke="#94a3b8" stroke-width="2"/>
                        <line x1="35" y1="110" x2="65" y2="110" stroke="#94a3b8" stroke-width="2"/>
                        <line x1="35" y1="115" x2="65" y2="115" stroke="#94a3b8" stroke-width="2"/>
                        <line x1="35" y1="120" x2="65" y2="120" stroke="#94a3b8" stroke-width="2"/>
                        <line x1="35" y1="125" x2="65" y2="125" stroke="#94a3b8" stroke-width="2"/>
                        <rect x="18" y="182" width="64" height="8" rx="2" fill="#1a1a1a" />
                        <circle cx="28" cy="17" r="4" fill="#FFFF00" />
                        <circle cx="72" cy="17" r="4" fill="#FFFF00" />
                        <rect x="40" y="150" width="20" height="20" rx="3" fill="none" stroke="#111" stroke-width="2" stroke-opacity="0.3"/>
                    </svg>
                </div>
            `,
            iconSize: [28, 56], iconAnchor: [14, 28], popupAnchor: [0, -28]
        });
    }

    async function loadMapData(isInitialLoad = false) {
        try {
            const response = await fetch(apiUrl);
            const data = await response.json();
            const vehicles = data.results || data;

            await ensureGlobalRouteCacheLoaded();
            vehicles.forEach(record => injectLocalRouteData(record));
            await patchMissingRoutesOnTheFly(vehicles);

            const currentVehicleIds = new Set();
            const boundsData = [];

            vehicles.forEach(record => {
                const lat = record.lat || record.latitude || record.y;
                const lng = record.lon || record.lng || record.longitude || record.x;

                if (lat && lng) {
                    const vehObj = record.vehicle || {};
                    let fleetNum = 'N/A', reg = 'UNKNOWN REG';
                    if (vehObj.name) {
                        const nameParts = vehObj.name.split('-');
                        if (nameParts.length >= 2) { fleetNum = nameParts[0].trim(); reg = nameParts.slice(1).join('-').trim(); }
                        else { fleetNum = vehObj.name.trim(); }
                    }
                    if (fleetNum === 'N/A') return;
                    currentVehicleIds.add(fleetNum);

                    const heading = record.heading || vehObj.heading || 0;
                    let iconColor = vehObj.colour || record.colour || '#2292ef';
                    if (!iconColor.startsWith('#') && /^[0-9A-F]{3,6}$/i.test(iconColor)) iconColor = '#' + iconColor;
                    else if (!iconColor.startsWith('#')) iconColor = '#2292ef'; 

                    const vehUrl = vehObj.url ? `https://www.mybustimes.cc${vehObj.url}` : '#';
                    const routeUrl = record._extractedRouteId ? `route?id=${record._extractedRouteId}` : 'route';
                    let routeDisplay = record.route || 'Not in service';
                    if (record._extractedRouteId && SWIFT_ROUTE_CACHE[record._extractedRouteId]) {
                        const rData = SWIFT_ROUTE_CACHE[record._extractedRouteId];
                        const rNum = rData.route_num || '';
                        const rName = rData.route_name ? ` (${rData.route_name})` : '';
                        if (rNum || rName) routeDisplay = `${rNum}${rName}`.trim();
                    }

                    const dest = record.destination || 'Depot';
                    const operator = vehObj.operator_name || record.operator_name || record.operator || 'Swift Connect';
                    const opUrl = `operator?op=${encodeURIComponent(operator)}`;
                    
                    let rawFeatures = vehObj.features || record.features || '';
                    let featuresList = 'None specified';
                    if (Array.isArray(rawFeatures)) rawFeatures = rawFeatures.join(', ');
                    if (typeof rawFeatures === 'string' && rawFeatures.trim() !== '') featuresList = rawFeatures.replace(/<br\s*\/?>/gi, ', ');

                    const busIcon = getBusIcon(iconColor, heading);
                    boundsData.push([lat, lng]);

                    const popupHtml = `
                        <div style="font-family: inherit; color: #0b1922; min-width: 220px;">
                            <p style="margin: 0 0 5px 0; font-size: 1.05rem;"><strong>Route:</strong> <a href="${routeUrl}" style="color: #2292ef; text-decoration: none; font-weight: bold;">${routeDisplay}</a></p>
                            <p style="margin: 0 0 12px 0; font-size: 0.95rem;"><strong>To:</strong> ${dest}</p>
                            <a href="${vehUrl}" target="_blank" style="text-decoration: none; display: block; transition: opacity 0.2s;" onmouseover="this.style.opacity=0.8" onmouseout="this.style.opacity=1">
                                <h3 style="margin: 0 0 6px 0; color: #2292ef; font-size: 1.2rem;">${fleetNum}</h3>
                                <p style="margin: 0 0 10px 0; display: inline-block; background: #FFFF00; color: black; padding: 3px 8px; border-radius: 4px; font-weight: 800; font-size: 0.85rem; border: 1px solid #ccc; font-family: monospace;">${reg}</p>
                            </a>
                            <p style="margin: 0 0 5px 0; font-size: 0.85rem; color: #4a5d6c;"><strong>Features:</strong> ${featuresList}</p>
                            <hr style="margin: 12px 0; border: 0; border-top: 1px solid #ccc;">
                            <p style="margin: 0; font-size: 0.85rem; font-weight: bold;"><a href="${opUrl}" style="color: #4a5d6c; text-decoration: none; border-bottom: 1px dashed #4a5d6c;">${operator}</a></p>
                        </div>
                    `;

                    if (activeMarkers[fleetNum]) {
                        const existingMarker = activeMarkers[fleetNum];
                        existingMarker.setLatLng([lat, lng]);
                        existingMarker.setIcon(busIcon);
                        existingMarker.getPopup().setContent(popupHtml); 
                    } else {
                        const newMarker = L.marker([lat, lng], { icon: busIcon }).addTo(markersLayer);
                        newMarker.bindPopup(popupHtml);
                        activeMarkers[fleetNum] = newMarker;
                    }
                }
            });

            for (const activeFleetId in activeMarkers) {
                if (!currentVehicleIds.has(activeFleetId)) {
                    markersLayer.removeLayer(activeMarkers[activeFleetId]);
                    delete activeMarkers[activeFleetId];
                }
            }
            if (isInitialLoad && boundsData.length > 0) map.fitBounds(boundsData, { padding: [30, 30] });
        } catch (error) {
            if (isInitialLoad) mapContainer.innerHTML = '<div style="padding: 40px; text-align: center; color: #e53e3e; font-weight: bold;">Could not connect to map rendering satellite.</div>';
        }
    }
    await loadMapData(true);
    setInterval(() => loadMapData(false), 60000);
}
