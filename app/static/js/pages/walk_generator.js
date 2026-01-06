import { applySavedTheme } from '../common/theme.js';

let map;
let marker;
let routeLayer;
let currentRouteCoords = null;

function initMap() {
  applySavedTheme();

  map = L.map('map').setView([55.75, 37.6], 10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  map.on('click', (e) => {
    const startPointMode = document.getElementById('start-point-mode')?.value;
    if (startPointMode === 'map') {
      if (marker) map.removeLayer(marker);
      marker = L.marker(e.latlng).addTo(map);

      const lonInput = document.getElementById('start-lon');
      const latInput = document.getElementById('start-lat');
      if (lonInput) lonInput.value = e.latlng.lng.toFixed(6);
      if (latInput) latInput.value = e.latlng.lat.toFixed(6);
    }
  });
}

function showLoading() {
  document.getElementById('loading-overlay')?.classList.add('active');
  document.getElementById('map')?.classList.add('blurred');
}

function hideLoading() {
  document.getElementById('loading-overlay')?.classList.remove('active');
  document.getElementById('map')?.classList.remove('blurred');
}

function showError(message) {
  const errorDiv = document.getElementById('error-message');
  if (!errorDiv) return;

  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  errorDiv.style.color = '#dc3545';
  errorDiv.style.backgroundColor = 'rgba(220, 53, 69, 0.1)';
  errorDiv.style.borderLeft = '4px solid #dc3545';
  errorDiv.style.borderRadius = '8px';
  errorDiv.style.padding = '15px';
  errorDiv.style.marginTop = '20px';
}

function showCopyNotification() {
  const notification = document.getElementById('copy-notification');
  if (!notification) return;

  notification.classList.add('show');
  setTimeout(() => {
    notification.classList.remove('show');
  }, 2000);
}

function setupStartPointMode() {
  const startPointModeEl = document.getElementById('start-point-mode');
  if (!startPointModeEl) return;

  startPointModeEl.addEventListener('change', function () {
    const startPointMode = this.value;
    const startPointCoordsDiv = document.getElementById('start-point-coords');
    const startLonInput = document.getElementById('start-lon');
    const startLatInput = document.getElementById('start-lat');

    if (startLonInput) startLonInput.value = '';
    if (startLatInput) startLatInput.value = '';

    if (marker) {
      map.removeLayer(marker);
      marker = null;
    }

    if (startPointMode === 'current') {
      if (startPointCoordsDiv) startPointCoordsDiv.style.display = 'block';
      if (startLonInput) startLonInput.disabled = true;
      if (startLatInput) startLatInput.disabled = true;

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            if (startLonInput) startLonInput.value = lon.toFixed(6);
            if (startLatInput) startLatInput.value = lat.toFixed(6);

            const currentLatLng = L.latLng(lat, lon);
            map.setView(currentLatLng, 13);
            marker = L.marker(currentLatLng).addTo(map);
          },
          (error) => {
            console.error('Error getting geolocation:', error);
            alert(
              'Не удалось получить текущее местоположение. Пожалуйста, разрешите доступ к геолокации или выберите точку на карте.'
            );
            startPointModeEl.value = 'map';
            if (startPointCoordsDiv) startPointCoordsDiv.style.display = 'block';
            if (startLonInput) startLonInput.disabled = false;
            if (startLatInput) startLatInput.disabled = false;
          }
        );
      } else {
        alert('Ваш браузер не поддерживает геолокацию. Выберите точку на карте.');
        startPointModeEl.value = 'map';
        if (startPointCoordsDiv) startPointCoordsDiv.style.display = 'block';
        if (startLonInput) startLonInput.disabled = false;
        if (startLatInput) startLatInput.disabled = false;
      }
    } else if (startPointMode === 'map') {
      if (startPointCoordsDiv) startPointCoordsDiv.style.display = 'block';
      if (startLonInput) startLonInput.disabled = false;
      if (startLatInput) startLatInput.disabled = false;
      alert('Нажмите на карту, чтобы выбрать начальную точку.');
    } else {
      if (startPointCoordsDiv) startPointCoordsDiv.style.display = 'none';
      if (startLonInput) startLonInput.disabled = true;
      if (startLatInput) startLatInput.disabled = true;
    }
  });
}

function setupFormSubmit() {
  const form = document.getElementById('recommendation-form');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const timeMinutes = parseInt(document.getElementById('time-minutes')?.value ?? '', 10);
    const angle = parseInt(document.getElementById('angle')?.value ?? '', 10);
    const segments = parseInt(document.getElementById('segments')?.value ?? '', 10);
    const startPointMode = document.getElementById('start-point-mode')?.value;

    let startPoint = null;
    if (startPointMode === 'current' || startPointMode === 'map') {
      const startLon = parseFloat(document.getElementById('start-lon')?.value ?? '');
      const startLat = parseFloat(document.getElementById('start-lat')?.value ?? '');
      if (Number.isNaN(startLon) || Number.isNaN(startLat)) {
        showError('Пожалуйста, укажите корректные координаты начальной точки.');
        return;
      }
      startPoint = [startLon, startLat];
    }

    const routeInfo = document.querySelector('.route-info');
    if (routeInfo) routeInfo.style.display = 'none';
    const errorMessage = document.getElementById('error-message');
    if (errorMessage) errorMessage.style.display = 'none';

    if (routeLayer) map.removeLayer(routeLayer);

    showLoading();

    try {
      const response = await fetch('/api/generate_route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          time_minutes: timeMinutes,
          angle,
          segments,
          start_point: startPoint,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        currentRouteCoords = data.path_geojson;

        const durationMinutes = (data.duration / 60).toFixed(0);
        const distanceKm = (data.distance / 1000).toFixed(2);

        const durationEl = document.getElementById('route-duration');
        const distanceEl = document.getElementById('route-distance');
        if (durationEl) durationEl.textContent = durationMinutes;
        if (distanceEl) distanceEl.textContent = distanceKm;

        if (routeInfo) routeInfo.style.display = 'block';

        if (data.link) {
          const shareLink = document.getElementById('share-route-link');
          if (shareLink) shareLink.href = data.link;

          const hiddenLink = document.getElementById('route-link');
          if (hiddenLink) hiddenLink.value = data.link;
        }

        if (routeLayer) map.removeLayer(routeLayer);

        const leafletCoords = currentRouteCoords.map((coord) => [coord[1], coord[0]]);
        routeLayer = L.polyline(leafletCoords, { color: '#388E3C', weight: 5 }).addTo(map);
        map.fitBounds(routeLayer.getBounds());
      } else {
        showError(data.error || 'Произошла ошибка при получении маршрута.');
      }
    } catch (error) {
      console.error('Ошибка при выполнении запроса:', error);
      showError('Не удалось связаться с сервером. Пожалуйста, попробуйте еще раз.');
    } finally {
      hideLoading();
    }
  });
}

function setupCopyRouteCoords() {
  const copyBtn = document.getElementById('copy-route-coords');
  if (!copyBtn) return;

  copyBtn.addEventListener('click', () => {
    if (!currentRouteCoords) {
      alert('Нет маршрута для копирования.');
      return;
    }

    const geoJsonOutput = { type: 'LineString', coordinates: currentRouteCoords };
    const geoJsonString = JSON.stringify(geoJsonOutput, null, 2);

    navigator.clipboard
      .writeText(geoJsonString)
      .then(() => {
        showCopyNotification();
      })
      .catch((err) => {
        console.error('Ошибка при копировании:', err);
        alert('Не удалось скопировать маршрут');
      });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  setupStartPointMode();
  setupFormSubmit();
  setupCopyRouteCoords();
});
