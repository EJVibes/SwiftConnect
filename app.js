document.addEventListener("DOMContentLoaded", async () => {
    // 1. Get the operator name from the URL (e.g., operator.html?op=Swift+Connecting+Wales)
    const urlParams = new URLSearchParams(window.location.search);
    const targetOperator = urlParams.get('op');

    if (!targetOperator) {
        document.getElementById('api-content').innerHTML = "<p>No operator selected.</p>";
        return;
    }

    // 2. Fetch ALL pages from the API
    let allOperators = [];
    let nextUrl = "https://www.mybustimes.cc/api/operator/?operator_name__icontains=Swift+Connecting";

    try {
        while (nextUrl) {
            const response = await fetch(nextUrl);
            const data = await response.json();
            allOperators = allOperators.concat(data.results);
            nextUrl = data.next; // Moves to page 2, 3, etc., until null
        }

        // 3. Find the specific operator in the combined data
        const operatorData = allOperators.find(op => 
            op.operator_name.toLowerCase() === targetOperator.toLowerCase()
        );

        if (operatorData) {
            renderOperator(operatorData);
        } else {
            document.getElementById('operator-name').innerText = "Operator Not Found";
            document.getElementById('api-content').innerHTML = "<p>Could not locate this division in the database.</p>";
        }

    } catch (error) {
        console.error("API Error:", error);
        document.getElementById('api-content').innerHTML = "<p>Error connecting to the live network database.</p>";
    }
});

function renderOperator(data) {
    // Update Text
    document.getElementById('operator-name').innerText = data.operator_name;
    document.getElementById('operator-code').innerText = `Operator Code: ${data.operator_code || 'N/A'}`;
    
    // Output the API data into the content box
    let contentHtml = `<ul style="list-style: none; padding: 0;">`;
    for (const [key, value] of Object.entries(data)) {
        // Filter out empty or raw URL fields for cleaner display
        if (value && key !== 'url') {
            const formattedKey = key.replace(/_/g, ' ').toUpperCase();
            contentHtml += `<li style="margin-bottom: 10px;"><strong>${formattedKey}:</strong> ${value}</li>`;
        }
    }
    contentHtml += `</ul>`;
    document.getElementById('api-content').innerHTML = contentHtml;

    // Determine Logo and Theme based on Name
    const nameLower = data.operator_name.toLowerCase();
    const bodyEl = document.body;
    const logoEl = document.getElementById('operator-logo');

    if (nameLower.includes('express')) {
        bodyEl.setAttribute('data-theme', 'swift-express');
        logoEl.src = 'swiftlogo_express.png';
    } else if (nameLower.includes('wrekin')) {
        bodyEl.setAttribute('data-theme', 'wrekin');
        logoEl.src = 'WREKIN CONNECT.png';
    } else if (nameLower.includes('electric')) {
        bodyEl.setAttribute('data-theme', 'swift-electric');
        logoEl.src = 'swiftlogo_new.png';
    } else if (nameLower.includes('classic') || nameLower.includes('preservation')) {
        bodyEl.setAttribute('data-theme', 'swift-classic');
        logoEl.src = 'swift_black.png'; // Using the black swallow icon
    } else {
        bodyEl.setAttribute('data-theme', 'swift-base');
        logoEl.src = 'frontswiftlogo_new.png';
    }
}
