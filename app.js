document.addEventListener("DOMContentLoaded", () => {
    // Determine which page we are on by checking for unique elements
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
    const resultsContainer = document.getElementById('api-data-results');
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
        while (apiEndpointUrl) {
            const fetchResponse = await fetch(apiEndpointUrl);
            if (!fetchResponse.ok) throw new Error("Network response error from server.");
            
            const structuredPayload = await fetchResponse.json();
            
            if (structuredPayload.results && Array.isArray(structuredPayload.results)) {
                unifiedDataset = unifiedDataset.concat(structuredPayload.results);
            }
            apiEndpointUrl = structuredPayload.next; 
        }

        const matchedProfile = unifiedDataset.find(item => 
            item.operator_name.trim().toLowerCase() === targetOperator.trim().toLowerCase()
        );

        if (matchedProfile) {
            applyBrandingEngine(matchedProfile.operator_name);
            renderOperatorPayload(matchedProfile);
        } else if (unifiedDataset.length > 0) {
            applyBrandingEngine(unifiedDataset[0].operator_name);
            renderOperatorPayload(unifiedDataset[0]);
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

    // Default Configuration
    bodyDom.setAttribute('data-theme', 'swift-base');
    globalLogo.src = 'frontswiftlogo_new.png';
    if(visualAccent) visualAccent.src = 'swift_front_new.png';

    // Theme Overrides mapping to repo files exactly
    if (normalize.includes('wrekin')) {
        bodyDom.setAttribute('data-theme', 'wrekin');
        globalLogo.src = 'WREKIN CONNECT.png';
        if(visualAccent) visualAccent.src = 'WREKIN CONNECT.png';
    } 
    else if (normalize.includes('railway') || normalize.includes('rail')) {
        bodyDom.setAttribute('data-theme', 'swift-rail');
        globalLogo.src = 'swiftlogo_new.png';
        if(visualAccent) visualAccent.src = 'swift_white.png';
    } 
    else if (normalize.includes('preservation') || normalize.includes('classic')) {
        bodyDom.setAttribute('data-theme', 'swift-classic');
        globalLogo.src = 'swift_black.png';
        if(visualAccent) visualAccent.src = 'swift_black.png';
    } 
    else if (normalize.includes('express')) {
        bodyDom.setAttribute('data-theme', 'swift-express');
        globalLogo.src = 'swiftlogo_express.png';
        if(visualAccent) visualAccent.src = 'swiftlogo_express.png';
    }
}

function renderOperatorPayload(dataRecord) {
    document.getElementById('operator-title-name').innerText = dataRecord.operator_name;
    document.getElementById('operator-badge-code').innerText = `ID: ${dataRecord.operator_code || 'SWFT'}`;

    let clearGridHtml = '';
    for (const [key, value] of Object.entries(dataRecord)) {
        if (key !== 'url' && key !== 'id') {
            const structuralLabel = key.replace(/_/g, ' ').toUpperCase();
            const cleanDisplayValue = (value !== null && value !== '') ? value : 'Not Registered';
            clearGridHtml += `
                <div class="data-item-row">
                    <div class="data-label">${structuralLabel}</div>
                    <div class="data-value">${cleanDisplayValue}</div>
                </div>
            `;
        }
    }

    document.getElementById('api-data-results').innerHTML = clearGridHtml;
    document.getElementById('api-loading-state').classList.add('hidden');
    document.getElementById('api-data-results').classList.remove('hidden');
}

function showOperatorError() {
    document.getElementById('api-loading-state').classList.add('hidden');
    document.getElementById('api-error-state').classList.remove('hidden');
    document.getElementById('operator-title-name').innerText = "Network Error";
}

/* ==========================================
   LIVE FLEET TRACKING LOGIC
   ========================================== */
async function initLiveFleetPage() {
    const container = document.getElementById('live-fleet-container');
    const loading = document.getElementById('fleet-loading');
    
    // The specific API endpoint requested
    const apiUrl = "https://www.mybustimes.cc/api/group/Swift%20Connect%20Group/vehicles/?ymax=30.48007424755997&ymin=26.45160913140478&xmax=-12.811894525114468&xmin=-18.483100793077682&limit=5000";

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error("Could not fetch fleet data.");
        
        const data = await response.json();
        const vehicles = data.results || data; // Handle depending on exact DRF pagination structure
        
        if (vehicles.length === 0) {
            container.innerHTML = '<p class="error-box">No vehicles currently active in this sector.</p>';
        } else {
            let html = '<div class="data-grid fleet-grid">';
            vehicles.forEach(vehicle => {
                // Ensure data points exist before rendering
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
        console.error("Fleet API Error:", error);
        container.innerHTML = '<p class="error-box">Error connecting to the live tracking satellite.</p>';
    } finally {
        loading.classList.add('hidden');
    }
}
