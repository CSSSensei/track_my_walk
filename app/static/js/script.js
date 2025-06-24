let map;
let geoJsonLayers = []; // To store Leaflet GeoJSON layers for clearing/updating

// Initialize the Leaflet Map
function initMap() {
    // Center map on Moscow
    map = L.map('map').setView([55.751244, 37.618423], 10);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    fetchWalksAndDisplay();
}

// Fetch walks from the backend and display them on the map
async function fetchWalksAndDisplay() {
    // Clear existing GeoJSON layers before drawing new ones
    geoJsonLayers.forEach(layer => map.removeLayer(layer));
    geoJsonLayers = [];

    let totalDistanceKm = 0;

    try {
        const response = await fetch('/walks');
        const walks = await response.json();

        walks.forEach(walk => {
            if (walk.path_geojson) {
                const geojsonData = JSON.parse(walk.path_geojson);

                // Add GeoJSON LineString to map
                const geoJsonLayer = L.geoJSON(geojsonData, {
                    style: function (feature) {
                        return {
                            color: '#FF0000', // Red color for walk paths
                            weight: 4,
                            opacity: 0.8
                        };
                    }
                }).addTo(map);
                geoJsonLayers.push(geoJsonLayer);

                if (typeof walk.distance === 'number') {
                    totalDistanceKm += walk.distance;
                }
            }
        });

        // Update stats
        document.getElementById('totalWalks').textContent = walks.length;
        document.getElementById('totalDistance').textContent = totalDistanceKm.toFixed(2) + ' км'; // Format to 2 decimal places

        // Optionally, zoom map to fit all features
//        if (geoJsonLayers.length > 0) {
//            const group = new L.featureGroup(geoJsonLayers);
//            map.fitBounds(group.getBounds());
//        }

    } catch (error) {
        console.error('Error fetching walks:', error);
    }
}

document.querySelectorAll('.stat-card').forEach(card => {
    card.addEventListener('mousemove', function(e) {
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left; // x position within the element
        const y = e.clientY - rect.top;  // y position within the element

        // Update the position of the gradient
        this.style.setProperty('--mouse-x', `${x}px`);
        this.style.setProperty('--mouse-y', `${y}px`);
    });
});

document.addEventListener('DOMContentLoaded', initMap);