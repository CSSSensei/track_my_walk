let map;
let drawnRoute = [];
let polyline = null;
let flatpickrInstance;

function initMap() {
    map = L.map('map').setView([55.751244, 37.618423], 12); // Moscow centre

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    map.on('click', function(e) {
        drawnRoute.push([e.latlng.lng, e.latlng.lat]);
        updateRoute();
    });
}

// Update the rendered route
function updateRoute() {
    if (polyline) map.removeLayer(polyline);

    if (drawnRoute.length > 0) {
        // Leaflet.polyline requires L objects.LatLng(latitude, longitude)
        // Therefore, we convert [lon, lat] back to L.LatLng(lat, lon)
        const latLngs = drawnRoute.map(coord => L.latLng(coord[1], coord[0]));
        polyline = L.polyline(latLngs, {color: '#e94560', weight: 4, opacity: 0.8}).addTo(map);
    }
}

function clearMap() {
    drawnRoute = [];
    if (polyline) map.removeLayer(polyline);
    showMessage('Карта очищена.', 'info');
    document.getElementById('coordinatesString').value = ''; // Also clear the row field
}

function removeLastPoint() {
    if (drawnRoute.length > 0) {
        drawnRoute.pop();
        updateRoute();    // Remake route
        showMessage('Последняя точка удалена.', 'info');
    } else {
        showMessage('Маршрут пуст, нет точек для удаления.', 'error');
    }
}

async function submitWalk() {
    const name = document.getElementById('name').value.trim();
    const description = document.getElementById('description').value.trim();
    const walkDate = document.getElementById('walkDate').value;

    if (!name || !description) {
        showMessage('Название и описание обязательны!', 'error');
        return;
    }

    if (drawnRoute.length < 1) {
        showMessage('Маршрут должен содержать хотя бы 1 точку. Нарисуйте на карте или введите строкой.', 'error');
        return;
    }

    const data = {
        name: name,
        description: description,
        coordinates: drawnRoute,
        date: walkDate
    };

    try {
        const response = await fetch('/admin/add_walk', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        const result = await response.json();

        if (response.ok) {
            showMessage(result.message, 'success');
            clearForm();
        } else {
            // The server should return hresult.error in case of an error
            showMessage(result.error || 'Произошла ошибка на сервере.', 'error');
        }
    } catch (error) {
        showMessage('Ошибка сети или сервера: ' + error.message, 'error');
        console.error('Fetch error:', error);
    }
}

function showMessage(text, type = 'info') {
    const msgDiv = document.getElementById('message');
    msgDiv.textContent = text;
    msgDiv.className = 'toast-message';

    if (type) {
        msgDiv.classList.add(type);
    }

    if (text) {
        msgDiv.classList.add('visible');
    } else {
        msgDiv.classList.remove('visible');
        return;
    }

    setTimeout(() => {
        msgDiv.classList.remove('visible');
        // Optional: clear the text after opening, so as not to take up memory
        // setTimeout(() => msgDiv.textContent = '', 500); // Slight delay after disappearing
    }, 5000);
}

function parseCoordinatesString() {
    const coordsString = document.getElementById('coordinatesString').value.trim();
    if (!coordsString) {
        showMessage('Строка координат пуста.', 'error');
        return;
    }

    let parsedCoords = [];
    // Используем регулярное выражение для поиска всех пар координат в формате [x, y]
    const coordPattern = /\[\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*\]/g;
    let match;

    while ((match = coordPattern.exec(coordsString)) !== null) {
        const lon = parseFloat(match[1]);
        const lat = parseFloat(match[2]);
        if (!isNaN(lon) && !isNaN(lat)) {
            parsedCoords.push([lon, lat]);
        }
    }

    if (parsedCoords.length < 1) {
        showMessage('Не найдено корректных координат в формате [долгота, широта]. Пример: [37.6176, 55.7512], [37.6200, 55.7530]', 'error');
        return;
    }

    drawnRoute = parsedCoords;
    updateRoute();
    showMessage('Маршрут загружен из строки!', 'success');
}

// Clearing the form after successful submission
function clearForm() {
    document.getElementById('name').value = '';
    document.getElementById('description').value = '';
    document.getElementById('coordinatesString').value = '';
    flatpickrInstance.clear();
    clearMap();
}

// Initializing the map and Flatpickr after loading the DOM
document.addEventListener('DOMContentLoaded', function() {
    initMap();

    flatpickrInstance = flatpickr("#walkDate", {
        enableTime: true,
        dateFormat: "Y-m-d H:i",
        defaultDate: "today",
        locale: "ru",
        // defaultHour: new Date().getHours(),
        // defaultMinute: new Date().getMinutes()
    });
});
