/**
 * Swift Connect Group - API Orchestration & Branding Router
 */

document.addEventListener("DOMContentLoaded", async () => {
    // Only execute logic if on the operator details layout page
    const resultsContainer = document.getElementById('api-data-results');
    if (!resultsContainer) return;

    // 1. Extract Target Parameter Name from Window Query Parameters
    const urlParams = new URLSearchParams(window.location.search);
    const targetOperator = urlParams.get('op');

    if (!targetOperator) {
        showErrorState();
        return;
    }

    // Initialize Global Scoped Collection
    let unifiedDataset = [];
    
    // Dynamically query based on operator search text to ensure matching scope compatibility
    let queryTarget = encodeURIComponent(targetOperator);
    let apiEndpointUrl = `https://www.mybustimes.cc/api/operator/?operator_name__icontains=${queryTarget}`;

    try {
        // 2. Comprehensive Pagination Loop (Ensures all matching data pages are swept)
        while (apiEndpointUrl) {
            const fetchResponse = await fetch(apiEndpointUrl);
            if (!fetchResponse.ok) throw new Error("Network response error from server.");
            
            const structuredPayload = await fetchResponse.json();
            
            if (structuredPayload.results && Array.isArray(structuredPayload.results)) {
                unifiedDataset = unifiedDataset.concat(structuredPayload.results);
            }
            
            // Move pointer location directly to next validation page property
            apiEndpointUrl = structuredPayload.next; 
        }

        // 3. Pinpoint Precise Match 
        const matchedProfile = unifiedDataset.find(item => 
            item.operator_name.trim().toLowerCase() === targetOperator.trim().toLowerCase()
        );

        if (matchedProfile) {
            applyBrandingEngine(matchedProfile.operator_name);
            renderPayloadContent(matchedProfile);
        } else {
            // Fallback match configuration layer if name spelling matches partially
            if(unifiedDataset.length > 0) {
                applyBrandingEngine(unifiedDataset[0].operator_name);
                renderPayloadContent(unifiedDataset[0]);
            } else {
                showErrorState();
            }
        }

    } catch (networkError) {
        console.error("Critical Fetch Error: ", networkError);
        showErrorState();
    }
});

/**
 * Parses and evaluates target naming patterns to apply custom icons & hex variables
 * @param {string} operatorName 
 */
function applyBrandingEngine(operatorName) {
    const normalize = operatorName.toLowerCase();
    const bodyDom = document.body;
    const globalLogo = document.getElementById('dynamic-logo');
    const visualAccent = document.getElementById('branding-accent');

    // Default configuration assumptions
    bodyDom.setAttribute('data-theme', 'swift-base');
    globalLogo.src = 'frontswiftlogo_new.png';
    if(visualAccent) visualAccent.src = 'swift_front_new.png';

    // Route Processing Engine
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
    // Regional configurations utilize default base livery styles
}

/**
 * Builds standard metadata elements cleanly into structural display grids
 * @param {Object} dataRecord 
 */
function renderPayloadContent(dataRecord) {
    const loadingBlock = document.getElementById('api-loading-state');
    const resultsBlock = document.getElementById('api-data-results');
    const titleHeader = document.getElementById('operator-title-name');
    const badgeCodeField = document.getElementById('operator-badge-code');

    // Update text elements
    titleHeader.innerText = dataRecord.operator_name;
    badgeCodeField.innerText = `ID: ${dataRecord.operator_code || 'SWFT'}`;

    let clearGridHtml = '';

    // Loop through properties to dynamically build out the UI data fields
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

    resultsBlock.innerHTML = clearGridHtml;

    // Transition views smoothly
    loadingBlock.classList.add('hidden');
    resultsBlock.classList.remove('hidden');
}

/**
 * Toggles interface view states on catch exceptions
 */
function showErrorState() {
    document.getElementById('api-loading-state').classList.add('hidden');
    document.getElementById('api-error-state').classList.remove('hidden');
    document.getElementById('operator-title-name').innerText = "Network Error";
    document.getElementById('operator-badge-code').innerText = "ERROR";
}
