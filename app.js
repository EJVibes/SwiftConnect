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

    // INTERCEPT: Swift Express is a cross-network brand, not a single operator.
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

    // Standard lookup for normal regional divisions
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
    // Debug helper to print the live API response to the browser console
    console.log("Division API Payload Received:", dataRecord);

    document.getElementById('operator-title-name').innerText = dataRecord.operator_name || 'Unknown Operator';
    document.getElementById('operator-badge-code').innerText = `ID: ${dataRecord.operator_code || 'SWFT'}`;

    // STRICT EXTRACTION: Targeting exactly "region_name" with no confusing fallbacks
    let regionDisplay = dataRecord.region_name;
    
    // Safety check: Only applies "System Wide" if the value is explicitly null, undefined, or empty
    if (regionDisplay === null || regionDisplay === undefined || String(regionDisplay).trim() === '') {
        regionDisplay = "System Wide";
    }

    // Layout order: Routes on top, metadata boxes underneath
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
            <div class="data-label">Operating Region</div>
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

        // Manual exclusion rule for the "Swift Connecting Railway" ghosts
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
        // Direct integration of target API parameter configuration
        let expressUrl = 'https://www.mybustimes.cc/api/operator/route/?id=&route_name__icontains=Swift+Express&route_num__icontains=&operator_code=&has_stops=unknown&stops_have_cords=unknown';
        let expressRoutes = [];

        // Handle structural API pagination changes automatically
        while (expressUrl) {
            const res = await fetch(expressUrl);
            if (!res.ok) throw new Error("Target pipeline integration error.");
            const data = await res.json();
            expressRoutes = expressRoutes.concat(data.results || []);
            expressUrl = data.next;
        }

        // Deduplicate output collections accurately via unique identifier fields
        const uniqueRoutesMap = new Map();
        expressRoutes.forEach(r => {
            if (r.route_num) {
                // Keep the record containing the unique route structure configuration
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

    // Alphanumeric sorting logic for route numbers
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
        
        // Generate clickable link block conditionally if operator metadata exists
        let operatorLinkHtml = '';
        if (r.operator_name) {
            const encodedOp = encodeURIComponent(r.operator_name.trim());
            operatorLinkHtml = `<a href="?op=${encodedOp}" class="route-pill-operator">Division: ${r.operator_name}</a>`;
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
