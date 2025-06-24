let map;
let geoJsonLayers = []; // To store Leaflet GeoJSON layers for clearing/updating

// Function to calculate distance between two lat/lng points using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    return distance;
}

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

                // Calculate distance for this walk
                if (geojsonData.type === "LineString" && geojsonData.coordinates && geojsonData.coordinates.length > 1) {
                    let walkDistance = 0;
                    for (let i = 0; i < geojsonData.coordinates.length - 1; i++) {
                        const p1 = geojsonData.coordinates[i];
                        const p2 = geojsonData.coordinates[i+1];
                        // Remember GeoJSON coordinates are [longitude, latitude]
                        walkDistance += calculateDistance(p1[1], p1[0], p2[1], p2[0]);
                    }
                    totalDistanceKm += walkDistance;
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