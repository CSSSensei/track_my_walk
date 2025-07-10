let map;
let marker; // Для начальной точки, выбранной на карте
let routeLayer; // Для отображения маршрута
let currentRouteCoords = null;

document.querySelector('.route-info').style.backgroundColor = 'var(--card-bg)';
document.querySelector('.route-info').style.border = '1px solid var(--card-border)';
document.querySelector('.route-info').style.borderRadius = '12px';
document.querySelector('.route-info').style.padding = '20px';

function applyTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode')    ;
    } else {
        document.body.classList.remove('dark-mode');
    }
}


// Инициализация карты
function initMap() {
    applyTheme();
    map = L.map('map').setView([55.75, 37.6], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    map.on('click', function(e) {
        const startPointMode = document.getElementById('start-point-mode').value;
        if (startPointMode === 'map') {
            if (marker) {
                map.removeLayer(marker);
            }
            marker = L.marker(e.latlng).addTo(map);
            document.getElementById('start-lon').value = e.latlng.lng.toFixed(6);
            document.getElementById('start-lat').value = e.latlng.lat.toFixed(6);
        }
    });
}

document.addEventListener('DOMContentLoaded', initMap);

function showLoading() {
    document.getElementById('loading-overlay').classList.add('active');
    document.getElementById('map').classList.add('blurred');
}

function hideLoading() {
    document.getElementById('loading-overlay').classList.remove('active');
    document.getElementById('map').classList.remove('blurred');
}

document.getElementById('start-point-mode').addEventListener('change', function() {
    const startPointMode = this.value;
    const startPointCoordsDiv = document.getElementById('start-point-coords');
    const startLonInput = document.getElementById('start-lon');
    const startLatInput = document.getElementById('start-lat');

    startLonInput.value = '';
    startLatInput.value = '';

    if (marker) {
        map.removeLayer(marker);
        marker = null;
    }

    if (startPointMode === 'current') {
        startPointCoordsDiv.style.display = 'block';
        startLonInput.disabled = true;
        startLatInput.disabled = true;
        // Запрос геолокации
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function(position) {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                startLonInput.value = lon.toFixed(6);
                startLatInput.value = lat.toFixed(6);
                const currentLatLng = L.latLng(lat, lon);
                map.setView(currentLatLng, 13); // Перемещаем карту к текущему положению
                marker = L.marker(currentLatLng).addTo(map);
            }, function(error) {
                console.error("Error getting geolocation:", error);
                alert("Не удалось получить текущее местоположение. Пожалуйста, разрешите доступ к геолокации или выберите точку на карте.");
                document.getElementById('start-point-mode').value = 'map';
                startPointCoordsDiv.style.display = 'block';
                startLonInput.disabled = false;
                startLatInput.disabled = false;
            });
        } else {
            alert("Ваш браузер не поддерживает геолокацию. Выберите точку на карте.");
            document.getElementById('start-point-mode').value = 'map';
            startPointCoordsDiv.style.display = 'block';
            startLonInput.disabled = false;
            startLatInput.disabled = false;
        }
    } else if (startPointMode === 'map') {
        startPointCoordsDiv.style.display = 'block';
        startLonInput.disabled = false;
        startLatInput.disabled = false;
        alert("Нажмите на карту, чтобы выбрать начальную точку.");
    } else { // 'none'
        startPointCoordsDiv.style.display = 'none';
        startLonInput.disabled = true;
        startLatInput.disabled = true;
    }
});

// Обработка отправки формы
document.getElementById('recommendation-form').addEventListener('submit', async function(event) {
    event.preventDefault();

    const timeMinutes = parseInt(document.getElementById('time-minutes').value);
    const angle = parseInt(document.getElementById('angle').value);
    const segments = parseInt(document.getElementById('segments').value);
    const startPointMode = document.getElementById('start-point-mode').value;

    let startPoint = null;
    if (startPointMode === 'current' || startPointMode === 'map') {
        const startLon = parseFloat(document.getElementById('start-lon').value);
        const startLat = parseFloat(document.getElementById('start-lat').value);
        if (isNaN(startLon) || isNaN(startLat)) {
            showError("Пожалуйста, укажите корректные координаты начальной точки.");
            return;
        }
        startPoint = [startLon, startLat];
    }

    document.querySelector('.route-info').style.display = 'none';
    document.getElementById('error-message').style.display = 'none';
    if (routeLayer) {
        map.removeLayer(routeLayer);
    }

    showLoading();

    try {
        const response = await fetch('/api/recommend_route', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                time_minutes: timeMinutes,
                angle: angle,
                segments: segments,
                start_point: startPoint
            })
        });

        const data = await response.json();

        if (response.ok) {
            currentRouteCoords = data.path_geojson;

            const durationMinutes = (data.duration / 60).toFixed(0);
            const distanceKm = (data.distance / 1000).toFixed(2);

            document.getElementById('route-duration').textContent = durationMinutes;
            document.getElementById('route-distance').textContent = distanceKm;
            document.querySelector('.route-info').style.display = 'block';

            if (routeLayer) {
                map.removeLayer(routeLayer);
            }
            const leafletCoords = currentRouteCoords.map(coord => [coord[1], coord[0]]);
            routeLayer = L.polyline(leafletCoords, {color: '#388E3C', weight: 5}).addTo(map);
            map.fitBounds(routeLayer.getBounds());

        } else {
            showError(data.error || "Произошла ошибка при получении маршрута.");
        }
    } catch (error) {
        console.error("Ошибка при выполнении запроса:", error);
        showError("Не удалось связаться с сервером. Пожалуйста, попробуйте еще раз.");
    } finally {
        hideLoading();
    }
});

function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    errorDiv.style.color = '#dc3545';
    errorDiv.style.backgroundColor = 'rgba(220, 53, 69, 0.1)';
    errorDiv.style.borderLeft = '4px solid #dc3545';
    errorDiv.style.borderRadius = '8px';
    errorDiv.style.padding = '15px';
    errorDiv.style.marginTop = '20px';
}


document.getElementById('copy-route-coords').addEventListener('click', function() {
    if (currentRouteCoords) {
        // Формируем GeoJSON LineString вручную для копирования
        const geoJsonOutput = {
            "type": "LineString",
            "coordinates": currentRouteCoords
        };
        const geoJsonString = JSON.stringify(geoJsonOutput, null, 2);

        const routeTextarea = document.getElementById('route-geojson');
        routeTextarea.value = geoJsonString;
        routeTextarea.style.display = 'block';
        routeTextarea.select();
        document.execCommand('copy');
        routeTextarea.style.display = 'none';
        alert("Координаты маршрута скопированы в буфер обмена!");
    } else {
        alert("Нет маршрута для копирования.");
    }
});