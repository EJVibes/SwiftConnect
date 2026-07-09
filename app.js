document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById('api-data-results')) {
        initOperatorPage();
    }
    if (document.getElementById('live-fleet-container')) {
        initLiveFleetPage();
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

    let unifiedDataset = [];
    let queryTarget = encodeURIComponent(targetOperator);
    let apiEndpointUrl = `https://www.mybustimes.cc/api/operator/?operator_name__icontains=${queryTarget}`;

    try {
        // Sweep pagination
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

    // Default configuration
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
    document.getElementById('operator-title-name').innerText = dataRecord.operator_name;
    document.getElementById('operator-badge-code').innerText = `ID: ${dataRecord.operator_code || 'SWFT'}`;

    // Strictly looking for region_name as requested
    const regionDisplay = dataRecord.region_name || 'System Wide';

    const html = `
        <div class="data-item-row">
            <div class="data-label">Operator Name</div>
            <div class="data-value">${dataRecord.operator_name}</div>
        </div>
        <div class="data-item-row">
            <div class="data-label">Operator Code</div>
            <div class="data-value">${dataRecord.operator_code || 'N/A'}</div>
        </div>
        <div class="data-item-row" style="grid-column: span 2;">
            <div class="data-label">Operating Region</div>
            <div class="data-value">${regionDisplay}</div>
        </div>
        <div class="data-item-row" style="grid-column: span 2; background: transparent; border: none; padding: 0; margin-top: 15px;">
            <div class="data-label">Registered Routes</div>
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
        fetchStandardRoutes(operatorCode);
    }
}

async function fetchStandardRoutes(operatorCode) {
    const container = document.getElementById('routes-container');
    if (!operatorCode) {
        container.innerHTML = `<p class="error-box">No Operator Code found to query routes.</p>`;
        return;
    }
    
    try {
        const res = await fetch(`https://www.mybustimes.cc/api/operator/route/?operator_code=${operatorCode}&limit=200`);
        const data = await res.json();
        renderRouteList(data.results || [], container);
    } catch (e) {
        console.error("Route Fetch Error:", e);
        container.innerHTML = `<p class="error-box">Could not load routes from the network.</p>`;
    }
}

async function fetchExpressRoutes() {
    const container = document.getElementById('routes-container');
    container.innerHTML = '<p>Sweeping entire network for Express routes (#C31B6B)... This may take a moment.</p>';
    
    try {
        // 1. Fetch ALL operators under "Swift Connecting"
        let opsUrl = 'https://www.mybustimes.cc/api/operator/?operator_name__icontains=Swift+Connecting';
        let allOps = [];
        while (opsUrl) {
            const res = await fetch(opsUrl);
            const data = await res.json();
            allOps = allOps.concat(data.results);
            opsUrl = data.next;
        }

        // 2. Fetch routes for all those operators concurrently
        const routePromises = allOps
            .filter(op => op.operator_code) // Ensure they have a code before fetching
            .map(op => fetch(`https://www.mybustimes.cc/api/operator/route/?operator_code=${op.operator_code}&limit=200`)
                .then(r => r.json())
                .catch(() => ({results: []}))
            );
            
        const routesDataArray = await Promise.all(routePromises);

        // 3. Filter strictly by route_colour #C31B6B
        let expressRoutes = [];
        routesDataArray.forEach(data => {
            if (data.results) {
                const matched = data.results.filter(r => 
                    r.route_colour && r.route_colour.toUpperCase().includes('C31B6B')
                );
                expressRoutes = expressRoutes.concat(matched);
            }
        });

        // 4. Remove exact duplicates based on route_num
        const uniqueRoutesMap = new Map();
        expressRoutes.forEach(r => {
            if (r.route_num) {
                uniqueRoutesMap.set(r.route_num, r);
            }
        });
        const finalRoutes = Array.from(uniqueRoutesMap.values());

        renderRouteList(finalRoutes, container);
    } catch (e) {
        console.error("Express Sweep Error:", e);
        container.innerHTML = `<p class="error-box">Failed to sweep express routes.</p>`;
    }
}

function renderRouteList(routes, container) {
    if (!routes || routes.length === 0) {
        container.innerHTML = '<p style="color: var(--secondary);">No active routes found for this division.</p>';
        return;
    }

    // Alphanumeric sorting logic for route numbers (e.g., 1, 2, 2A, 10)
    routes.sort((a, b) => {
        const numA = a.route_num ? a.route_num.toString() : '';
        const numB = b.route_num ? b.route_num.toString() : '';
        return numA.localeCompare(numB, undefined, {numeric: true, sensitivity: 'base'});
    });

    let html = '';
    routes.forEach(r => {
        // Target specific keys requested
        const routeNum = r.route_num || '?';
        const routeName = r.route_name ? ` (${r.route_name})` : '';
        const start = r.inbound_destination || 'Unknown Start';
        const end = r.outbound_destination || 'Unknown Destination';
        const borderCol = r.route_colour ? (r.route_colour.startsWith('#') ? r.route_colour : `#${r.route_colour}`) : 'var(--primary)';
        
        html += `
            <div class="route-pill" style="border-left-color: ${borderCol}">
                <strong>${routeNum}${routeName}</strong>
                <span class="route-pill-dest">${start} &rarr; ${end}</span>
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
    const apiUrl = "https://www.mybustimes.cc/api/group/Swift%20Connect%20Group/vehicles/?ymax=30.48007424755997&ymin=26.45160913140478&xmax=-12.811894525114468&xmin=-18.483100793077682&limit=5000";

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error("Could not fetch fleet data.");
        const data = await response.json();
        const vehicles = data.results || data; 
        
        if (vehicles.length === 0) {
            container.innerHTML = '<p class="error-box">No vehicles currently active in this sector.</p>';
        } else {
            let html = '<div class="data-grid fleet-grid">';
            vehicles.forEach(vehicle => {
                const fleetNum = vehicle.fleet_number || 'N/A';
                const reg = vehicle.registration || 'Unknown Reg';
                const route = vehicle.route || 'Not in service';
                const dest = vehicle.destination || 'Depot';
                const operator = vehicle.operator || 'Swift Connect';

                html += `
                    <div class="card fleet-card">
                        <h3>Vehicle ${fleetNum}</h3>
                        <p class="badge">${reg}</p>
                        <hr style="margin:10px 0; border:0; border-top:1px solid #edf2f7;">
                        <p><strong>Route:</strong> ${route}</p>
                        <p><strong>To:</strong> ${dest}</p>
                        <p style="margin-top:10px; font-size:0.85rem; color:var(--secondary)">${operator}</p>
                    </div>
                `;
            });
            html += '</div>';
            container.innerHTML = html;
        }
    } catch (error) {
        container.innerHTML = '<p class="error-box">Error connecting to the live tracking satellite.</p>';
    } finally {
        loading.classList.add('hidden');
    }
}
