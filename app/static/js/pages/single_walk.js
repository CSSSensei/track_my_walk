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
  let touchStartX = 0;
  let touchStartY = 0;
  let touchEndX = 0;
  let touchEndY = 0;

  const overlay = document.createElement('div');
  overlay.className = 'fullscreen-photo-overlay';
  overlay.style.display = 'none';

  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'fullscreen-content-wrapper';

  const carouselContainer = document.createElement('div');
  carouselContainer.className = 'carousel-container';

  const description = document.createElement('div');
  description.className = 'photo-description-fullscreen';

  contentWrapper.appendChild(carouselContainer);
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

  function createCarouselItems() {
    carouselContainer.innerHTML = '';
    walkData.photos.forEach((photo, index) => {
      const item = document.createElement('div');
      item.className = `carousel-item ${index === currentPhotoIndex ? 'active' : ''}`;
      item.dataset.index = String(index);

      const img = document.createElement('img');
      img.src = photo.url;
      img.className = 'fullscreen-photo';
      img.alt = photo.description || 'Фото с прогулки';

      item.appendChild(img);
      carouselContainer.appendChild(item);
    });
  }

  function updateDescription(index) {
    const photo = walkData.photos[index];
    description.textContent = photo?.description || '';
  }

  function showFullscreenPhoto(index) {
    currentPhotoIndex = index;
    createCarouselItems();
    updateDescription(index);
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function goToPhoto(newIndex, direction) {
    if (newIndex < 0 || newIndex >= walkData.photos.length) return;

    const items = carouselContainer.querySelectorAll('.carousel-item');
    items.forEach((item) => {
      item.classList.remove('prev', 'next', 'active');
    });

    items[currentPhotoIndex].classList.add(direction === 'left' ? 'prev' : 'next');
    items[newIndex].classList.add('active', direction === 'left' ? 'next' : 'prev');

    carouselContainer.classList.add(`swipe-${direction}`);

    setTimeout(() => {
      currentPhotoIndex = newIndex;
      updateDescription(newIndex);

      carouselContainer.classList.remove('swipe-left', 'swipe-right');
      items.forEach((item) => {
        item.classList.remove('prev', 'next');
        item.classList.toggle('active', Number(item.dataset.index) === newIndex);
      });
    }, 500);
  }

  carouselContainer.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  });

  carouselContainer.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    touchEndY = e.changedTouches[0].screenY;
    handleSwipe();
  });

  function handleSwipe() {
    const diffX = touchStartX - touchEndX;
    const diffY = touchStartY - touchEndY;

    if (Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX > 50) {
        goToPhoto((currentPhotoIndex + 1) % walkData.photos.length, 'left');
      } else if (diffX < -50) {
        goToPhoto((currentPhotoIndex - 1 + walkData.photos.length) % walkData.photos.length, 'right');
      }
    }
  }

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    overlay.style.display = 'none';
    document.body.style.overflow = '';
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.style.display = 'none';
      document.body.style.overflow = '';
    }
  });

  prevBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    goToPhoto((currentPhotoIndex - 1 + walkData.photos.length) % walkData.photos.length, 'right');
  });

  nextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    goToPhoto((currentPhotoIndex + 1) % walkData.photos.length, 'left');
  });

  document.addEventListener('keydown', (e) => {
    if (overlay.style.display === 'flex') {
      if (e.key === 'ArrowLeft') {
        goToPhoto((currentPhotoIndex - 1 + walkData.photos.length) % walkData.photos.length, 'right');
      } else if (e.key === 'ArrowRight') {
        goToPhoto((currentPhotoIndex + 1) % walkData.photos.length, 'left');
      }
    }
  });

  photoThumbnails.forEach((thumbnail, index) => {
    thumbnail.addEventListener('click', (e) => {
      e.preventDefault();
      showFullscreenPhoto(index);

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
