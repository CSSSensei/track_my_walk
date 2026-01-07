import { applySavedTheme } from '../common/theme.js';
import { setupSecretClick } from '../common/secret_admin_click.js';

const walkData = (() => {
  const el = document.getElementById('walkDataJson');
  if (!el) return null;
  try {
    return JSON.parse(el.textContent || 'null');
  } catch (e) {
    console.error('Failed to parse walkDataJson', e);
    return null;
  }
})();

let mapInstance = null;

function initSingleWalkPage() {
  applySavedTheme();
  initSingleWalkMap();
  setupSecretAdminClick();
  setupPhotoGallery();
}

function initSingleWalkMap() {
  if (!walkData) {
    console.error('Walk data not found');
    return;
  }

  const dateElement = document.getElementById('walkDate');
  if (dateElement) {
    const date = new Date(walkData.date * 1000);
    dateElement.textContent = date.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  const mapContainer = document.getElementById('singleWalkMap');
  if (!mapContainer) {
    console.error("Map container 'singleWalkMap' not found.");
    return;
  }

  mapInstance = L.map(mapContainer).setView([0, 0], 2);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(mapInstance);

  const photoMarkers = L.markerClusterGroup();

  if (walkData.photos && walkData.photos.length > 0) {
    walkData.photos.forEach((photo) => {
      if (photo.latitude && photo.longitude) {
        const imageUrl = photo.thumbnail_url || photo.url;

        const photoIcon = L.divIcon({
          className: 'photo-marker',
          html: `<div class="photo-marker-inner"><img src="${imageUrl}" alt="Фото"></div>`,
          iconSize: [50, 50],
          iconAnchor: [25, 50],
        });

        const marker = L.marker([photo.latitude, photo.longitude], { icon: photoIcon }).bindPopup(`
          <div class="photo-popup">
            <img src="${photo.url}" alt="Фото с прогулки" class="photo-popup-img">
            ${photo.timestamp ? `<p class="photo-time">${new Date(photo.timestamp).toLocaleString()}</p>` : ''}
            ${photo.description ? `<p class="photo-description">${photo.description}</p>` : ''}
          </div>
        `);

        photoMarkers.addLayer(marker);
      }
    });

    mapInstance.addLayer(photoMarkers);
  }

  if (!walkData.path_geojson) {
    mapContainer.innerHTML = '<p>Маршрут отсутствует</p>';
    mapInstance.setView([55.751244, 37.618423], 10);
    return;
  }

  try {
    const routeGroup = L.layerGroup({ snakingPause: 200 }).addTo(mapInstance);

    const bounds = L.latLngBounds();

    if (walkData.path_geojson.type === 'LineString' && walkData.path_geojson.coordinates) {
      const lineCoordinates = walkData.path_geojson.coordinates.map((coord) => [coord[1], coord[0]]);

      const animatedLine = L.polyline([], {
        color: '#4CAF50',
        weight: 5,
        opacity: 0.9,
        snakingSpeed: 500,
      }).addTo(routeGroup);

      routeGroup.addLayer(animatedLine);
      animatedLine.setLatLngs(lineCoordinates);
      lineCoordinates.forEach((latlng) => bounds.extend(latlng));

      setTimeout(() => {
        if (typeof routeGroup.snakeIn === 'function') {
          routeGroup.snakeIn();
          animatedLine.snakeIn();
        }
      }, 500);
    }

    if (bounds.isValid()) {
      mapInstance.fitBounds(bounds, { padding: [0, 0] });
    }
  } catch (e) {
    console.error('Error:', e);
    mapContainer.innerHTML = '<p>Ошибка отображения маршрута</p>';
    mapInstance.setView([55.751244, 37.618423], 10);
  }
}

function setupPhotoGallery() {
  const photoThumbnails = document.querySelectorAll('.photo-thumbnail');
  if (!photoThumbnails.length || !walkData?.photos?.length) return;

  let currentPhotoIndex = 0;

  const overlay = document.createElement('div');
  overlay.className = 'fullscreen-photo-overlay';
  overlay.style.display = 'none';

  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'fullscreen-content-wrapper';

  const carouselViewport = document.createElement('div');
  carouselViewport.className = 'carousel-container';
  carouselViewport.setAttribute('role', 'group');
  carouselViewport.setAttribute('aria-label', 'Просмотр фотографий');

  const description = document.createElement('div');
  description.className = 'photo-description-fullscreen';

  contentWrapper.appendChild(carouselViewport);
  contentWrapper.appendChild(description);
  overlay.appendChild(contentWrapper);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'photo-close-btn';
  closeBtn.type = 'button';
  closeBtn.innerHTML = '&times;';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'photo-nav-btn prev';
  prevBtn.type = 'button';
  prevBtn.innerHTML = '&larr;';

  const nextBtn = document.createElement('button');
  nextBtn.className = 'photo-nav-btn next';
  nextBtn.type = 'button';
  nextBtn.innerHTML = '&rarr;';

  overlay.appendChild(closeBtn);
  overlay.appendChild(prevBtn);
  overlay.appendChild(nextBtn);
  document.body.appendChild(overlay);

  let trackEl = null;

  let isPointerDown = false;
  let isHorizontalDrag = false;
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let startTimeMs = 0;
  let startTranslateX = 0;
  let currentTranslateX = 0;

  function getViewportWidth() {
    return carouselViewport.getBoundingClientRect().width || window.innerWidth;
  }

  function clampIndex(index) {
    return Math.max(0, Math.min(index, walkData.photos.length - 1));
  }

  function baseTranslateForIndex(index) {
    return -index * getViewportWidth();
  }

  function setTrackTranslate(x, { animate } = { animate: true }) {
    if (!trackEl) return;
    trackEl.style.transition = animate ? 'transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none';
    trackEl.style.transform = `translate3d(${x}px, 0, 0)`;
  }

  function updateDescription(index) {
    const photo = walkData.photos[index];
    description.textContent = photo?.description || '';
  }

  function updateNavButtons() {
    prevBtn.disabled = currentPhotoIndex <= 0;
    nextBtn.disabled = currentPhotoIndex >= walkData.photos.length - 1;
  }

  function preloadAround(index) {
    [index - 1, index + 1].forEach((i) => {
      if (i < 0 || i >= walkData.photos.length) return;
      const img = new Image();
      img.src = walkData.photos[i].url;
    });
  }

  function createCarouselItems() {
    carouselViewport.innerHTML = '';

    trackEl = document.createElement('div');
    trackEl.className = 'carousel-track';

    walkData.photos.forEach((photo, index) => {
      const slide = document.createElement('div');
      slide.className = 'carousel-slide';
      slide.dataset.index = String(index);

      const img = document.createElement('img');
      img.src = photo.url;
      img.className = 'fullscreen-photo';
      img.alt = photo.description || 'Фото с прогулки';
      img.draggable = false;

      slide.appendChild(img);
      trackEl.appendChild(slide);
    });

    carouselViewport.appendChild(trackEl);
  }

  function setIndex(index, { animate } = { animate: true }) {
    currentPhotoIndex = clampIndex(index);
    currentTranslateX = baseTranslateForIndex(currentPhotoIndex);
    setTrackTranslate(currentTranslateX, { animate });
    updateDescription(currentPhotoIndex);
    updateNavButtons();
    preloadAround(currentPhotoIndex);
  }

  function openFullscreen(index) {
    currentPhotoIndex = clampIndex(index);

    createCarouselItems();
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    requestAnimationFrame(() => {
      setIndex(currentPhotoIndex, { animate: false });
    });
  }

  function closeFullscreen() {
    overlay.style.display = 'none';
    document.body.style.overflow = '';
    isPointerDown = false;
    isHorizontalDrag = false;
    pointerId = null;
  }

  function computeRubberBand(x) {
    const viewportWidth = getViewportWidth();
    const minX = -((walkData.photos.length - 1) * viewportWidth);
    const maxX = 0;

    if (x > maxX) {
      return maxX + (x - maxX) * 0.35;
    }
    if (x < minX) {
      return minX + (x - minX) * 0.35;
    }
    return x;
  }

  function onPointerDown(e) {
    if (!trackEl) return;

    isPointerDown = true;
    isHorizontalDrag = false;
    pointerId = e.pointerId;

    startX = e.clientX;
    startY = e.clientY;
    lastX = e.clientX;
    startTimeMs = performance.now();

    startTranslateX = currentTranslateX;

    carouselViewport.setPointerCapture(pointerId);
    setTrackTranslate(currentTranslateX, { animate: false });
  }

  function onPointerMove(e) {
    if (!isPointerDown || e.pointerId !== pointerId) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (!isHorizontalDrag) {
      if (Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy) + 2) {
        isHorizontalDrag = true;
      } else if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        isPointerDown = false;
        try {
          carouselViewport.releasePointerCapture(pointerId);
        } catch {}
        pointerId = null;
        return;
      }
    }

    if (!isHorizontalDrag) return;

    e.preventDefault();

    lastX = e.clientX;

    const nextTranslate = computeRubberBand(startTranslateX + dx);
    currentTranslateX = nextTranslate;
    setTrackTranslate(currentTranslateX, { animate: false });
  }

  function onPointerUpOrCancel(e) {
    if (!isPointerDown || e.pointerId !== pointerId) return;

    const viewportWidth = getViewportWidth();
    const dx = (lastX || e.clientX) - startX;
    const dt = Math.max(1, performance.now() - startTimeMs);
    const velocity = dx / dt;

    isPointerDown = false;

    try {
      carouselViewport.releasePointerCapture(pointerId);
    } catch {}
    pointerId = null;

    if (!isHorizontalDrag) {
      setIndex(currentPhotoIndex, { animate: true });
      return;
    }

    isHorizontalDrag = false;

    const distanceThreshold = viewportWidth * 0.18;
    const velocityThreshold = 0.5;

    let nextIndex = currentPhotoIndex;

    if (dx < -distanceThreshold || velocity < -velocityThreshold) {
      nextIndex = currentPhotoIndex + 1;
    } else if (dx > distanceThreshold || velocity > velocityThreshold) {
      nextIndex = currentPhotoIndex - 1;
    }

    setIndex(nextIndex, { animate: true });
  }

  carouselViewport.addEventListener('pointerdown', onPointerDown);
  carouselViewport.addEventListener('pointermove', onPointerMove, { passive: false });
  carouselViewport.addEventListener('pointerup', onPointerUpOrCancel);
  carouselViewport.addEventListener('pointercancel', onPointerUpOrCancel);

  carouselViewport.addEventListener('dragstart', (e) => e.preventDefault());

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeFullscreen();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeFullscreen();
  });

  prevBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setIndex(currentPhotoIndex - 1, { animate: true });
  });

  nextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setIndex(currentPhotoIndex + 1, { animate: true });
  });

  document.addEventListener('keydown', (e) => {
    if (overlay.style.display !== 'flex') return;

    if (e.key === 'Escape') {
      closeFullscreen();
    } else if (e.key === 'ArrowLeft') {
      setIndex(currentPhotoIndex - 1, { animate: true });
    } else if (e.key === 'ArrowRight') {
      setIndex(currentPhotoIndex + 1, { animate: true });
    }
  });

  window.addEventListener('resize', () => {
    if (overlay.style.display !== 'flex') return;
    setIndex(currentPhotoIndex, { animate: false });
  });

  photoThumbnails.forEach((thumbnail, index) => {
    thumbnail.addEventListener('click', (e) => {
      e.preventDefault();
      openFullscreen(index);

      const lat = parseFloat(thumbnail.dataset.lat);
      const lng = parseFloat(thumbnail.dataset.lng);

      if (mapInstance && !Number.isNaN(lat) && !Number.isNaN(lng)) {
        mapInstance.setView([lat, lng], 15);
        mapInstance.eachLayer((layer) => {
          if (layer instanceof L.MarkerClusterGroup) {
            layer.eachLayer((marker) => {
              const markerLatLng = marker.getLatLng();
              if (markerLatLng.lat === lat && markerLatLng.lng === lng) {
                marker.openPopup();
              }
            });
          } else if (layer instanceof L.Marker) {
            const markerLatLng = layer.getLatLng();
            if (markerLatLng.lat === lat && markerLatLng.lng === lng) {
              layer.openPopup();
            }
          }
        });
      }
    });
  });
}

function setupSecretAdminClick() {
  setupSecretClick({
    onTrigger: () => {
      if (walkData?.id) {
        window.location.href = `/admin/edit-walk/${walkData.id}`;
      } else {
        alert('Ошибка: ID прогулки не найден для перенаправления.');
      }
    },
  });
}

document.addEventListener('DOMContentLoaded', initSingleWalkPage);
