let map;
let editableLayers;
let drawControl;
let flatpickrInstance;

// --- Utility Functions ---

function showToast(message, type = 'info', duration = 3000) {
    const toast = document.getElementById('toastMessage');
    toast.textContent = message;
    toast.className = `toast-message visible ${type}`;

    setTimeout(() => {
        toast.classList.remove('visible');
    }, duration);
}

function convertUnixToDateTimeLocal(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

// --- Map Initialization and Drawing Logic ---

function initMap(initialGeoJson = null) {
    if (map) {
        map.remove();
    }
    map = L.map('map').setView([55.751244, 37.618423], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    editableLayers = new L.FeatureGroup();
    map.addLayer(editableLayers);

    if (initialGeoJson) {
        try {
            const geoJsonLayer = L.geoJSON(initialGeoJson, {
                style: function() {
                    return {
                        color: '#FF0000',
                        weight: 4,
                        opacity: 0.8
                    };
                }
            }).addTo(editableLayers);
            // Если есть геометрия, центрируем карту на ней
            if (geoJsonLayer.getBounds().isValid()) {
                 map.fitBounds(geoJsonLayer.getBounds());
            } else {
                // Если нет валидных границ (например, пустой GeoJSON), центрируем на дефолтных
                map.setView([55.751244, 37.618423], 10);
            }
        } catch (e) {
            console.error("Error parsing initial GeoJSON:", e);
            showToast("Ошибка при загрузке данных карты.", "error");
        }
    }

    if (drawControl) {
        map.removeControl(drawControl);
    }
    drawControl = new L.Control.Draw({
        edit: {
            featureGroup: editableLayers,
            remove: true
        },
        draw: {
            polyline: {
                shapeOptions: {
                    color: '#FF0000'
                }
            },
            polygon: false,
            rectangle: false,
            circle: false,
            marker: false,
            circlemarker: false
        }
    });
    map.addControl(drawControl);

    map.on(L.Draw.Event.CREATED, function (event) {
        editableLayers.clearLayers();
        editableLayers.addLayer(event.layer);
    });
    map.on(L.Draw.Event.EDITED, function (event) {
        // Данные уже обновлены в editableLayers
        showToast('Маршрут на карте изменен.', 'info');
    });
    map.on(L.Draw.Event.DELETED, function (event) {
        // Данные уже удалены из editableLayers
        showToast('Маршрут на карте удален.', 'info');
    });
}

function getGeoJsonFromMap() {
    if (editableLayers.getLayers().length === 0) {
        return null;
    }
    const layers = editableLayers.getLayers();
    if (layers.length > 0) {
        const firstLayer = layers[0];
        if (firstLayer instanceof L.Polyline || firstLayer instanceof L.Marker) {
            return JSON.stringify(firstLayer.toGeoJSON());
        }
    }
    return null;
}

function clearMapLayers() {
    if (editableLayers) {
        editableLayers.clearLayers();
        showToast('Карта очищена.', 'info');
    }
}

// --- API Interactions ---

async function saveWalk(event) {
    event.preventDefault();

    const walkId = document.getElementById('walkId').value;
    const name = document.getElementById('name').value;
    const dateInput = document.getElementById('date').value;
    const description = document.getElementById('description').value;
    const path_geojson = getGeoJsonFromMap();

    if (!name || !dateInput || !path_geojson) {
        showToast('Пожалуйста, заполните все обязательные поля (Название, Дата, Маршрут на карте).', 'error');
        return;
    }


    const walkData = {
        name: name,
        date: dateInput,
        description: description,
        path_geojson: path_geojson
    };

    try {
        let response;
        if (walkId) {
            response = await fetch(`/admin/walks/${walkId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(walkData)
            });
        } else {
            const coordinatesToSend = path_geojson.type === "LineString" ? geojsonObj.coordinates : (geojsonObj.type === "Point" ? [geojsonObj.coordinates] : []);

            response = await fetch('/admin/add_walk', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name,
                    date: dateInput,
                    description: description,
                    coordinates: coordinatesToSend
                })
            });
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        showToast(`Прогулка успешно ${walkId ? 'обновлена' : 'добавлена'}!`, 'success');

        setTimeout(() => {
            window.location.href = `/walk/${walkId}`;
        }, 1500);
    } catch (error) {
        console.error('Error saving walk:', error);
        showToast(`Ошибка при сохранении прогулки: ${error.message}`, 'error');
    }
}

// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
    flatpickrInstance = flatpickr("#date", {
        enableTime: true,
        dateFormat: "Y-m-d H:i:S",
        altFormat: "Y-m-d H:i",
        locale: "ru",
        time_24hr: true,
    });

    if (initialWalkData && initialWalkData.path_geojson) {
        initMap(initialWalkData.path_geojson);
    } else {
        initMap();
    }

    document.getElementById('walkForm').addEventListener('submit', saveWalk);
    document.getElementById('clearMapBtn').addEventListener('click', clearMapLayers);
});