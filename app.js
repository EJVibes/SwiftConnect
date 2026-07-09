document.addEventListener("DOMContentLoaded", () => {
    initMobileMenu();
    
    if (document.getElementById('api-data-results')) {
        initOperatorPage();
    }
    if (document.getElementById('live-fleet-container')) {
        initLiveFleetPage();
    }
    if (document.getElementById('network-map')) {
        initNetworkMap();
    }
    if (window.location.pathname.includes('route.html')) {
        initRoutePage();
    }
});

/* ==========================================
   MOBILE MENU LOGIC
   ========================================== */
function initMobileMenu() {
    const toggleBtn = document.querySelector('.mobile-toggle');
    const nav = document.querySelector('.main-nav');
    
    if (toggleBtn && nav) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            nav.classList.toggle('is-open');
            toggleBtn.classList.toggle('is-active');
        });
        
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
        if (res.ok) {
            SWIFT_ROUTE_CACHE = await res.json();
            console.log("Global static routes cache loaded successfully.");
        }
    } catch (e) {
        console.warn("Static global_routes_cache.json unavailable. Falling back to dynamic fetching.", e);
    } finally {
        IS_CACHE_INITIALIZED = true;
    }
}

function injectLocalRouteData(record) {
    if (record.service && record.service.url) {
        const match = record.service.url.match(/\/route\/(\d+)\/?/);
        if (match && match[1]) {
            record._extractedRouteId = match[1];
        }
    }
}

async function patchMissingRoutesOnTheFly(trackingRecords) {
    const missingRouteIds = new Set();
    trackingRecords.forEach(record => {
        if (record._extractedRouteId && !SWIFT_ROUTE_CACHE[record._extractedRouteId]) {
            missingRouteIds.add(record._extractedRouteId);
        }
    });

    if (missingRouteIds.size > 0) {
        const fetchPromises = Array.from(missingRouteIds).map(async (routeId) => {
            try {
                const res = await fetch(`https://www.mybustimes.cc/api/operator/route/${routeId}/`);
                if (res.ok) SWIFT_ROUTE_CACHE[routeId] = await res.json();
            } catch (e) {
                console.warn(`Failed to dynamically patch route ID: ${routeId}`, e);
            }
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

    if (!targetOperator) {
        showOperatorError();
        return;
    }

    if (targetOperator.toLowerCase().includes('express')) {
        const expressProfile = {
            operator_name: "Swift Express",
            operator_code: "Multi-Operator",
            region_name: "Cross-Network" 
        };
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
            if (structuredPayload.results) {
                unifiedDataset = unifiedDataset.concat(structuredPayload.results);
            }
            apiEndpointUrl = structuredPayload.next; 
        }

        const matchedProfile = unifiedDataset.find(item => 
            item.operator_name.trim().toLowerCase() === targetOperator.trim().toLowerCase()
        );

        if (matchedProfile) {
            applyBrandingEngine(matchedProfile.operator_name);
            renderOperatorMetrics(matchedProfile);
            triggerRouteFetch(matchedProfile.operator_code, matchedProfile.operator_name);
        } else if (unifiedDataset.length > 0) {
            applyBrandingEngine(unifiedDataset[0].operator_name);
            renderOperatorMetrics(unifiedDataset[0]);
            triggerRouteFetch(unifiedDataset[0].operator_code, unifiedDataset[0].operator_name);
        } else {
            showOperatorError();
        }
    } catch (networkError) {
        console.error("API Error: ", networkError);
        showOperatorError();
    }
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

    if (regionDisplay === null || regionDisplay === undefined || String(regionDisplay).trim() === '') {
        regionDisplay = "Not Provided by API";
    }

    const html = `
        <div class="operator-meta-banner">
            <div class="meta-box">
                <span class="meta-label">Operator Name</span>
                <strong class="meta-value">${dataRecord.operator_name || 'N/A'}</strong>
            </div>
            <div class="meta-box">
                <span class="meta-label">Operator Code</span>
                <strong class="meta-value">${dataRecord.operator_code || 'N/A'}</strong>
            </div>
            <div class="meta-box">
                <span class="meta-label">Region Name</span>
                <strong class="meta-value">${regionDisplay}</strong>
            </div>
        </div>

        <div class="routes-section-wrapper">
            <h3 class="routes-section-title">Registered Network Routes</h3>
            <div id="routes-container" class="routes-flex-box">
                <p>Fetching routes from database...</p>
            </div>
        </div>
    `;

    document.getElementById('api-data-results').innerHTML = html;
    document.getElementById('api-loading-state').classList.add('hidden');
    document.getElementById('api-data-results').classList.remove('hidden');
}

function triggerRouteFetch(operatorCode, operatorName) {
    if (operatorName.toLowerCase().includes("express")) {
        fetchExpressRoutes();
    } else {
        fetchStandardRoutes(operatorCode, operatorName);
    }
}

async function fetchStandardRoutes(operatorCode, operatorName) {
    const container = document.getElementById('routes-container');
    if (!operatorCode) {
        container.innerHTML = `<p class="error-box">No Operator Code found to query routes.</p>`;
        return;
    }
    
    try {
        const res = await fetch(`https://www.mybustimes.cc/api/operator/route/?operator_code=${operatorCode}&limit=200`);
        const data = await res.json();
        let routes = data.results || [];

        if (operatorName.toLowerCase().includes('railway')) {
            routes = routes.filter(r => r.route_num !== 'X45' && r.route_num !== 'X46');
        }

        renderRouteList(routes, container);
    } catch (e) {
        container.innerHTML = `<p class="error-box">Could not load routes from the network.</p>`;
    }
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
        expressRoutes.forEach(r => {
            if (r.route_num) uniqueRoutesMap.set(r.route_num, r);
        });
        
        renderRouteList(Array.from(uniqueRoutesMap.values()), container);
    } catch (e) {
        container.innerHTML = `<p class="error-box">Failed to fetch specified dynamic express records.</p>`;
    }
}

function renderRouteList(routes, container) {
    if (!routes || routes.length === 0) {
        container.innerHTML = '<p style="color: var(--secondary);">No active routes found for this division.</p>';
        return;
    }

    routes.sort((a, b) => {
        const numA = a.route_num ? a.route_num.toString() : '';
        const numB = b.route_num ? b.route_num.toString() : '';
        return numA.localeCompare(numB, undefined, {numeric: true, sensitivity: 'base'});
    });

    let html = '';
    routes.forEach(r => {
        const routeId = r.id || '';
        const routeNum = r.route_num || '?';
        const routeName = r.route_name ? ` (${r.route_name})` : '';
        const start = r.inbound_destination || 'Unknown Start';
        const end = r.outbound_destination || 'Unknown Destination';
        const borderCol = r.route_colour ? (r.route_colour.startsWith('#') ? r.route_colour : `#${r.route_colour}`) : 'var(--primary)';
        
        let operatorLinkHtml = '';
        if (r.operator_name) {
            const encodedOp = encodeURIComponent(r.operator_name.trim());
            operatorLinkHtml = `<a href="operator.html?op=${encodedOp}" class="route-pill-operator" onclick="event.stopPropagation();">Division: ${r.operator_name}</a>`;
        }
        
        html += `
            <div class="route-pill route-pill-interactive" style="border-left-color: ${borderCol};" onclick="window.location.href='route.html?id=${routeId}'">
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
   ROUTE DETAIL PAGE LOGIC 
   ========================================== */

async function fetchAndRenderTimetable(routeId) {
    try {
        let records = [];

        // 1. ALWAYS check the static Python-generated cache first
        await ensureGlobalRouteCacheLoaded();
        if (SWIFT_ROUTE_CACHE[routeId] && Array.isArray(SWIFT_ROUTE_CACHE[routeId].timetable) && SWIFT_ROUTE_CACHE[routeId].timetable.length > 0) {
            records = SWIFT_ROUTE_CACHE[routeId].timetable;
        }

        // 2. If the cache is empty, attempt a dynamic browser fetch
        if (records.length === 0) {
            const urlsToTry = [
                `https://www.mybustimes.cc/api/get_timetables/?route_id=${routeId}`,
                `https://www.mybustimes.cc/api/get_timetables/?route=${routeId}`,
                `https://www.mybustimes.cc/api/get_timetables/${routeId}/`
            ];

            for (const url of urlsToTry) {
                try {
                    const res = await fetch(url);
                    if (res.ok) {
                        const data = await res.json();
                        // Array hunter
                        if (Array.isArray(data)) records = data;
                        else if (data.results && Array.isArray(data.results)) records = data.results;
                        else if (data.data && Array.isArray(data.data)) records = data.data;
                        
                        if (records.length > 0) break; 
                    }
                } catch (e) {
                    console.warn(`Dynamic fetch failed (likely CORS) on ${url}`);
                }
            }
        }

        if (records.length === 0) {
            return `
                <div class="timetable-placeholder">
                    <h3 style="margin-bottom: 10px; color: var(--dark);">Timetable data currently unavailable.</h3>
                    <p>The network API has not synchronized a timetable for this specific route.</p>
                </div>
            `;
        }

        // Generic Table Builder - Extracts headers dynamically
        let headers = Object.keys(records[0]).filter(k => typeof records[0][k] !== 'object' && !Array.isArray(records[0][k]));
        
        // Safety net: if all keys were weirdly formatted, just grab all keys
        if (headers.length === 0) {
            headers = Object.keys(records[0]);
        }
        
        let tableHtml = `<div style="overflow-x: auto; border-radius: var(--radius-soft); border: 1px solid #edf2f7;"><table class="route-data-table" style="margin: 0; width: 100%; text-align: center; white-space: nowrap;"><thead><tr>`;
        
        headers.forEach(h => {
            const formattedKey = h.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            tableHtml += `<th style="text-align: center; background-color: var(--primary); color: white; padding: 15px;">${formattedKey}</th>`;
        });
        tableHtml += `</tr></thead><tbody>`;
        
        records.forEach(row => {
            tableHtml += `<tr>`;
            headers.forEach(h => {
                let val = row[h];
                if (typeof val === 'object' && val !== null) {
                    val = JSON.stringify(val); // Safety to prevent rendering [object Object]
                }
                tableHtml += `<td style="padding: 12px; border-bottom: 1px solid #edf2f7;">${val !== null && val !== undefined && val !== '' ? val : '-'}</td>`;
            });
            tableHtml += `</tr>`;
        });
        
        tableHtml += `</tbody></table></div>`;
        return tableHtml;

    } catch (e) {
        console.error("Timetable Fetch Error:", e);
        return `
            <div class="timetable-placeholder">
                <p>Error connecting to timetable databanks.</p>
            </div>
        `;
    }
}

async function initRoutePage() {
    const urlParams = new URLSearchParams(window.location.search);
    const routeId = urlParams.get('id');

    const loadingState = document.getElementById('route-loading');
    const errorState = document.getElementById('route-error-state');
    const container = document.getElementById('route-detail-container');
    const titleHeader = document.getElementById('route-page-title');
    const subHeader = document.getElementById('route-page-subtitle');

    if (!routeId) {
        loadingState.classList.add('hidden');
        errorState.classList.remove('hidden');
        return;
    }

    try {
        const res = await fetch(`https://www.mybustimes.cc/api/operator/route/${routeId}/`);
        if (!res.ok) throw new Error("Could not fetch route");
        const data = await res.json();

        function extractOperatorName(obj) {
            if (obj === null || typeof obj !== 'object') return null;
            for (const [key, value] of Object.entries(obj)) {
                if (key === 'operator_name') return value;
                if (typeof value === 'object') {
                    const nestedResult = extractOperatorName(value);
                    if (nestedResult) return nestedResult;
                }
            }
            return null;
        }

        const opName = extractOperatorName(data) || data.operator || 'Unknown Operator';
        applyBrandingEngine(opName); 

        // Safely construct the exact format requested
        const routeNum = data.route_num || '';
        const routeName = data.route_name || '';
        const start = data.inbound_destination || '';
        const end = data.outbound_destination || '';

        const combinedRoute = `${routeNum} ${routeName}`.trim();
        let titleString = combinedRoute;
        if (start) titleString += ` - ${start}`;
        if (end) titleString += ` - ${end}`;

        // Set Headers: "{route_num} {route_name} - {inbound} - {outbound}"
        titleHeader.innerText = titleString;
        subHeader.innerText = `Operated by ${opName}`;

        // Fetch Timetable from the dynamic array hunter / cache
        const timetableHtml = await fetchAndRenderTimetable(routeId);

        // Render purely the Timetable Card (Meta Data Table entirely removed)
        const html = `
            <div class="card" style="padding: 0; overflow: hidden;">
                <div style="padding: 25px 35px; background-color: #f8fafc; border-bottom: 2px solid #edf2f7;">
                    <h2 style="color: var(--primary); margin: 0;">Route Timetable</h2>
                </div>
                <div style="padding: 35px;">
                    ${timetableHtml}
                </div>
            </div>
        `;

        container.innerHTML = html;
        loadingState.classList.add('hidden');
        container.classList.remove('hidden');

    } catch (e) {
        console.error(e);
        loadingState.classList.add('hidden');
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
            
            if (trackingRecords.length === 0) {
                container.innerHTML = '<p class="error-box">No vehicles currently active in this sector.</p>';
                return;
            }

            await ensureGlobalRouteCacheLoaded();
            trackingRecords.forEach(record => injectLocalRouteData(record));
            await patchMissingRoutesOnTheFly(trackingRecords);

            let html = '<div class="data-grid fleet-grid">';
            
            trackingRecords.forEach(record => {
                const vehObj = record.vehicle || {};
                let fleetNum = 'N/A';
                let reg = 'UNKNOWN REG';

                if (vehObj.name) {
                    const nameParts = vehObj.name.split('-');
                    if (nameParts.length >= 2) {
                        fleetNum = nameParts[0].trim();
                        reg = nameParts.slice(1).join('-').trim(); 
                    } else {
                        fleetNum = vehObj.name.trim();
                    }
                }

                const vehUrl = vehObj.url ? `https://www.mybustimes.cc${vehObj.url}` : '#';
                const routeUrl = record._extractedRouteId ? `route.html?id=${record._extractedRouteId}` : 'route.html';
                
                let routeDisplay = record.route || 'Not in service';
                if (record._extractedRouteId && SWIFT_ROUTE_CACHE[record._extractedRouteId]) {
                    const rData = SWIFT_ROUTE_CACHE[record._extractedRouteId];
                    const rNum = rData.route_num || '';
                    const rName = rData.route_name ? ` (${rData.route_name})` : '';
                    if (rNum || rName) routeDisplay = `${rNum}${rName}`.trim();
                }

                const dest = record.destination || 'Depot';
                const operator = vehObj.operator_name || record.operator_name || record.operator || 'Swift Connect';
                const opUrl = `operator.html?op=${encodeURIComponent(operator)}`;
                
                let rawFeatures = vehObj.features || record.features || '';
                let featuresList = 'None specified';
                if (Array.isArray(rawFeatures)) rawFeatures = rawFeatures.join(', ');
                if (typeof rawFeatures === 'string' && rawFeatures.trim() !== '') {
                    featuresList = rawFeatures.replace(/<br\s*\/?>/gi, ', ');
                }

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
            
        } catch (error) {
            container.innerHTML = '<p class="error-box">Error connecting to the live tracking satellite.</p>';
        } finally {
            loading.classList.add('hidden');
        }
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

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

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
            iconSize: [28, 56],
            iconAnchor: [14, 28],
            popupAnchor: [0, -28]
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
                    
                    let fleetNum = 'N/A';
                    let reg = 'UNKNOWN REG';
                    if (vehObj.name) {
                        const nameParts = vehObj.name.split('-');
                        if (nameParts.length >= 2) {
                            fleetNum = nameParts[0].trim();
                            reg = nameParts.slice(1).join('-').trim();
                        } else {
                            fleetNum = vehObj.name.trim();
                        }
                    }
                    
                    if (fleetNum === 'N/A') return;
                    currentVehicleIds.add(fleetNum);

                    const heading = record.heading || vehObj.heading || 0;
                    let rawColour = vehObj.colour || record.colour || '2292ef';
                    
                    let iconColor = rawColour;
                    if (!iconColor.startsWith('#') && /^[0-9A-F]{3,6}$/i.test(iconColor)) {
                        iconColor = '#' + iconColor;
                    } else if (!iconColor.startsWith('#')) {
                        iconColor = '#2292ef'; 
                    }

                    const vehUrl = vehObj.url ? `https://www.mybustimes.cc${vehObj.url}` : '#';
                    const routeUrl = record._extractedRouteId ? `route.html?id=${record._extractedRouteId}` : 'route.html';

                    let routeDisplay = record.route || 'Not in service';
                    if (record._extractedRouteId && SWIFT_ROUTE_CACHE[record._extractedRouteId]) {
                        const rData = SWIFT_ROUTE_CACHE[record._extractedRouteId];
                        const rNum = rData.route_num || '';
                        const rName = rData.route_name ? ` (${rData.route_name})` : '';
                        if (rNum || rName) routeDisplay = `${rNum}${rName}`.trim();
                    }

                    const dest = record.destination || 'Depot';
                    const operator = vehObj.operator_name || record.operator_name || record.operator || 'Swift Connect';
                    const opUrl = `operator.html?op=${encodeURIComponent(operator)}`;
                    
                    let rawFeatures = vehObj.features || record.features || '';
                    let featuresList = 'None specified';
                    if (Array.isArray(rawFeatures)) rawFeatures = rawFeatures.join(', ');
                    if (typeof rawFeatures === 'string' && rawFeatures.trim() !== '') {
                        featuresList = rawFeatures.replace(/<br\s*\/?>/gi, ', ');
                    }

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

            if (isInitialLoad && boundsData.length > 0) {
                map.fitBounds(boundsData, { padding: [30, 30] });
            }

        } catch (error) {
            if (isInitialLoad) {
                mapContainer.innerHTML = '<div style="padding: 40px; text-align: center; color: #e53e3e; font-weight: bold;">Could not connect to map rendering satellite.</div>';
            }
        }
    }

    await loadMapData(true);
    setInterval(() => loadMapData(false), 60000);
}
