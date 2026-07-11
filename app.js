document.addEventListener("DOMContentLoaded", () => {
    initMobileMenu();
    if (document.getElementById('api-data-results')) initOperatorPage();
    if (document.getElementById('live-fleet-container')) initLiveFleetPage();
    if (window.location.pathname.includes('/route')) initRoutePage();
    if (document.getElementById('network-map')) initNetworkMap();
});

function initMobileMenu() {
    const toggleBtn = document.querySelector('.mobile-toggle');
    const nav = document.querySelector('.main-nav');
    if (toggleBtn && nav) {
        toggleBtn.addEventListener('click', (e) => { e.stopPropagation(); nav.classList.toggle('is-open'); toggleBtn.classList.toggle('is-active'); });
    }
}

async function ensureGlobalRouteCacheLoaded() {
    if (IS_CACHE_INITIALIZED) return;
    try {
        const res = await fetch(`./global_routes_cache.json?t=${new Date().getTime()}`);
        if (res.ok) SWIFT_ROUTE_CACHE = await res.json();
    } catch (e) { console.warn("Cache unavailable."); }
    finally { IS_CACHE_INITIALIZED = true; }
}

function buildTableHtml(records) {
    if (!records || records.length === 0) return '';
    let headersSet = new Set();
    records.forEach(row => { Object.keys(row).forEach(k => { if (typeof row[k] !== 'object' && !Array.isArray(row[k])) headersSet.add(k); }); });
    let headers = Array.from(headersSet);
    let tableHtml = `<div style="overflow-x: auto; border-radius: var(--radius-soft); border: 1px solid #edf2f7; margin-bottom: 30px;"><table class="route-data-table" style="margin: 0; width: 100%; text-align: center; white-space: nowrap;"><thead><tr>`;
    headers.forEach(h => {
        let key = h.toLowerCase().startsWith('col_') ? '' : h.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        tableHtml += `<th style="text-align: center; background-color: var(--primary); color: white; padding: 15px;">${key}</th>`;
    });
    tableHtml += `</tr></thead><tbody>`;
    records.forEach(row => {
        tableHtml += `<tr>`;
        headers.forEach(h => { tableHtml += `<td style="padding: 12px; border-bottom: 1px solid #edf2f7;">${row[h] || '-'}</td>`; });
        tableHtml += `</tr>`;
    });
    return tableHtml + `</tbody></table></div>`;
}

async function fetchAndRenderTimetable(routeId) {
    await ensureGlobalRouteCacheLoaded();
    const route = SWIFT_ROUTE_CACHE[routeId];
    if (!route || !route.timetable.length) return `<p>Timetable unavailable.</p>`;
    let html = '';
    route.timetable.forEach(dir => {
        html += `<h3 style="margin: 0 0 15px 0; color: var(--dark);">${dir.direction}</h3>` + buildTableHtml(dir.data);
    });
    return html;
}

// ... (Rest of your original logic, keeping the new clean URL structure)
