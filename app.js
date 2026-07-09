document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById('api-data-results')) {
        initOperatorPage();
    }
    if (document.getElementById('live-fleet-container')) {
        initLiveFleetPage();
    }
    if (document.getElementById('network-map')) {
        initNetworkMap();
    }
});

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

function applyBrandingEngine(operatorName) {
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
    } 
    else if (normalize.includes('railway') || normalize.includes('rail')) {
        bodyDom.setAttribute('data-theme', 'swift-rail');
        if (visualAccent) visualAccent.src = 'Swift Connect White Full.png';
    } 
    else if (normalize.includes('preservation') || normalize.includes('classic')) {
        bodyDom.setAttribute('data-theme', 'swift-classic');
        if (visualAccent) visualAccent.src = 'Swift Short White.png';
    } 
    else if (normalize.includes('express')) {
        bodyDom.setAttribute('data-theme', 'swift-express');
        if (visualAccent) visualAccent.src = 'Swift Connect Express.png';
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
        <div class="data-item-row" style="grid-column: span 2; background: transparent; border: none; padding: 0; margin-bottom: 30px;">
            <div class="data-label" style="margin-bottom: 15px;">Registered Routes</div>
            <div id="routes-container" class="routes-flex-box">
                <p>Fetching routes from database...</p>
            </div>
        </div>
        <div class="data-item-row">
            <div class="data-label">Operator Name</div>
            <div class="data-value">${dataRecord.operator_name || 'N/A'}</div>
        </div>
        <div class="data-item-row">
            <div class="data-label">Operator Code</div>
            <div class="data-value">${dataRecord.operator_code || 'N/A'}</div>
        </div>
        <div class="data-item-row" style="grid-column: span 2;">
            <div class="data-label">Region Name</div>
            <div class="data-value">${regionDisplay}</div>
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
        console.error("Route Fetch Error:", e);
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
            if (!res.ok) throw new Error("Target pipeline integration error.");
            const data = await res.json();
            expressRoutes = expressRoutes.concat(data.results || []);
            expressUrl = data.next;
        }

        const uniqueRoutesMap = new Map();
        expressRoutes.forEach(r => {
            if (r.route_num) {
                uniqueRoutesMap.set(r.route_num, r);
            }
        });
        const finalRoutes = Array.from(uniqueRoutesMap.values());

        renderRouteList(finalRoutes, container);
    } catch (e) {
        console.error("Express Target Fetch Error:", e);
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
        const routeNum = r.route_num || '?';
        const routeName = r.route_name ? ` (${r.route_name})` : '';
        const start = r.inbound_destination || 'Unknown Start';
        const end = r.outbound_destination || 'Unknown Destination';
        const borderCol = r.route_colour ? (r.route_colour.startsWith('#') ? r.route_colour : `#${r.route_colour}`) : 'var(--primary)';
        
        let operatorLinkHtml = '';
        if (r.operator_name) {
            const encodedOp = encodeURIComponent(r.operator_name.trim());
            operatorLinkHtml = `<a href="operator.html?op=${encodedOp}" class="route-pill-operator">Division: ${r.operator_name}</a>`;
        }
        
        html += `
            <div class="route-pill" style="border-left-color: ${borderCol}">
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
   LIVE FLEET TRACKING LOGIC
   ========================================== */
async function initLiveFleetPage() {
    const container = document.getElementById('live-fleet-container');
    const loading = document.getElementById('fleet-loading');
    
    const apiUrl = "https://www.mybustimes.cc/api/group/Swift%20Connect%20Group/vehicles/?ymax=56.96749375372495&ymin=22.98020869942421&xmax=26.253456525775164&xmin=-46.11789196263385&limit=5000";

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error("Could not fetch fleet data.");
        const data = await response.json();
        
        const trackingRecords = data.results || data; 
        
        if (trackingRecords.length === 0) {
            container.innerHTML = '<p class="error-box">No vehicles currently active in this sector.</p>';
        } else {
            let html = '<div class="data-grid fleet-grid">';
            
            trackingRecords.forEach(record => {
                let fleetNum = 'N/A';
                let reg = 'UNKNOWN REG';

                if (record.vehicle && record.vehicle.name) {
                    const nameParts = record.vehicle.name.split('-');
                    if (nameParts.length >= 2) {
                        fleetNum = nameParts[0].trim();
                        reg = nameParts.slice(1).join('-').trim(); 
                    } else {
                        fleetNum = record.vehicle.name.trim();
                    }
                }
                
                const route = record.route || 'Not in service';
                const dest = record.destination || 'Depot';
                const operator = record.operator_name || record.operator || 'Swift Connect';
                const featuresList = (Array.isArray(record.features) ? record.features.join(', ') : record.features) || 'None specified';

                html += `
                    <div class="card fleet-card">
                        <p style="margin-bottom: 4px; font-size: 1.05rem;"><strong>Route:</strong> ${route}</p>
                        <p style="margin-bottom: 12px; font-size: 0.95rem;"><strong>To:</strong> ${dest}</p>
                        
                        <h3 style="color: var(--primary); margin-bottom: 6px; font-size: 1.3rem;">${fleetNum}</h3>
                        <p style="display: inline-block; background-color: #FFFF00; color: black; border: 1px solid #ccc; padding: 4px 10px; border-radius: 6px; font-weight: 800; font-family: monospace; font-size: 0.9rem; margin-bottom: 10px;">${reg}</p>
                        
                        <p style="margin-bottom: 5px; font-size: 0.85rem; color: var(--secondary);"><strong>Features:</strong> ${featuresList}</p>
                        
                        <hr style="margin:15px 0 10px 0; border:0; border-top:1px solid #edf2f7;">
                        <p style="margin:0; font-size:0.9rem; color:var(--secondary); font-weight: bold;">${operator}</p>
                    </div>
                `;
            });
            html += '</div>';
            container.innerHTML = html;
        }
    } catch (error) {
        console.error("Live Fleet Error:", error);
        container.innerHTML = '<p class="error-box">Error connecting to the live tracking satellite.</p>';
    } finally {
        loading.classList.add('hidden');
    }
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

    const apiUrl = "https://www.mybustimes.cc/api/group/Swift%20Connect%20Group/vehicles/?ymax=56.96749375372495&ymin=22.98020869942421&xmax=26.253456525775164&xmin=-46.11789196263385&limit=5000";

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error("Could not fetch map fleet data.");
        const data = await response.json();
        const vehicles = data.results || data;

        const boundsData = [];

        vehicles.forEach(record => {
            const lat = record.lat || record.latitude || record.y;
            const lng = record.lon || record.lng || record.longitude || record.x;

            if (lat && lng) {
                let fleetNum = 'N/A';
                let reg = 'UNKNOWN REG';

                if (record.vehicle && record.vehicle.name) {
                    const nameParts = record.vehicle.name.split('-');
                    if (nameParts.length >= 2) {
                        fleetNum = nameParts[0].trim();
                        reg = nameParts.slice(1).join('-').trim();
                    } else {
                        fleetNum = record.vehicle.name.trim();
                    }
                }

                const route = record.route || 'Not in service';
                const dest = record.destination || 'Depot';
                const operator = record.operator_name || record.operator || 'Swift Connect';
                const featuresList = (Array.isArray(record.features) ? record.features.join(', ') : record.features) || 'None specified';

                const marker = L.marker([lat, lng]).addTo(map);
                boundsData.push([lat, lng]);

                const popupHtml = `
                    <div style="font-family: inherit; color: #0b1922; min-width: 220px;">
                        <p style="margin: 0 0 5px 0; font-size: 1.05rem;"><strong>Route:</strong> ${route}</p>
                        <p style="margin: 0 0 12px 0; font-size: 0.95rem;"><strong>To:</strong> ${dest}</p>
                        
                        <h3 style="margin: 0 0 6px 0; color: #2292ef; font-size: 1.2rem;">${fleetNum}</h3>
                        <p style="margin: 0 0 10px 0; display: inline-block; background: #FFFF00; color: black; padding: 3px 8px; border-radius: 4px; font-weight: 800; font-size: 0.85rem; border: 1px solid #ccc; font-family: monospace;">${reg}</p>
                        
                        <p style="margin: 0 0 5px 0; font-size: 0.85rem; color: #4a5d6c;"><strong>Features:</strong> ${featuresList}</p>

                        <hr style="margin: 12px 0; border: 0; border-top: 1px solid #ccc;">
                        <p style="margin: 0; font-size: 0.85rem; color: #4a5d6c; font-weight: bold;">${operator}</p>
                    </div>
                `;
                marker.bindPopup(popupHtml);
            }
        });

        if (boundsData.length > 0) {
            map.fitBounds(boundsData, { padding: [30, 30] });
        }

    } catch (error) {
        console.error("Map rendering error:", error);
        mapContainer.innerHTML = '<div style="padding: 40px; text-align: center; color: #e53e3e; font-weight: bold;">Could not connect to map rendering satellite.</div>';
    }
}
