// app/static/js/single_walk.js
document.addEventListener('DOMContentLoaded', initSingleWalkMap);

function initSingleWalkMap() {
    // walkData is passed from Flask in single_walk.html
    if (!walkData) {
        console.error('Walk data not found!');
        return;
    }

    // Display the formatted date
    const dateElement = document.getElementById('walkDate');
    if (dateElement) {
        // Assuming walk.date is a Unix timestamp (seconds since epoch)
        const date = new Date(walkData.date * 1000);
        dateElement.textContent = date.toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }


    let map;
    const mapContainer = document.getElementById('singleWalkMap');

    if (!mapContainer) {
        console.error("Map container 'singleWalkMap' not found.");
        return;
    }

    // Initialize map - default view (will be adjusted by fitBounds later)
    map = L.map(mapContainer).setView([0, 0], 2);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    if (walkData.path_geojson) {
        try {
            const geojsonData = JSON.parse(walkData.path_geojson);

            const geoJsonLayer = L.geoJSON(geojsonData, {
                style: function (feature) {
                    return {
                        color: '#4CAF50', // Green color for single walk path
                        weight: 5,
                        opacity: 0.9
                    };
                },
                // Add circles for start/end points or markers
                pointToLayer: function (feature, latlng) {
                    if (feature.properties && feature.properties.isStart) {
                        return L.circleMarker(latlng, {
                            radius: 8,
                            fillColor: "#007bff", // Blue for start
                            color: "#000",
                            weight: 1,
                            opacity: 1,
                            fillOpacity: 0.8
                        });
                    }
                    if (feature.properties && feature.properties.isEnd) {
                        return L.circleMarker(latlng, {
                            radius: 8,
                            fillColor: "#dc3545", // Red for end
                            color: "#000",
                            weight: 1,
                            opacity: 1,
                            fillOpacity: 0.8
                        });
                    }
                    return null; // Don't draw other points
                }
            }).addTo(map);

            // Fit map to the bounds of the GeoJSON layer
            if (geoJsonLayer.getBounds().isValid()) {
                map.fitBounds(geoJsonLayer.getBounds());
            } else {
                console.warn("GeoJSON layer bounds are invalid, cannot fit map. Check coordinates.");
                // Fallback to a default view if bounds are invalid
                map.setView([55.751244, 37.618423], 10);
            }

        } catch (e) {
            console.error('Error parsing GeoJSON data for single walk:', e);
            mapContainer.innerHTML = '<p>Не удалось отобразить маршрут на карте.</p>';
            map.setView([55.751244, 37.618423], 10); // Default view on error
        }
    } else {
        mapContainer.innerHTML = '<p>Данные маршрута отсутствуют для этой прогулки.</p>';
        map.setView([55.751244, 37.618423], 10); // Default view if no geojson
    }
}
