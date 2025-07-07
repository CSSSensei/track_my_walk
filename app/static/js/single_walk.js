document.addEventListener('DOMContentLoaded', initSingleWalkPage);

function applyTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
}

function initSingleWalkPage() {
    applyTheme();
    initSingleWalkMap();
    setupSecretAdminClick();
    setupPhotoGallery();
}

function initSingleWalkMap() {
    if (!walkData) {
        console.error('Walk data not found!');
        return;
    }

    // Display the formatted date
    const dateElement = document.getElementById('walkDate');
    if (dateElement) {
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

    // Initialize map
    map = L.map(mapContainer).setView([0, 0], 2);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Create a marker cluster group for photos
    const photoMarkers = L.markerClusterGroup();

    // Add photos to map if they exist
    if (walkData.photos && walkData.photos.length > 0) {
        walkData.photos.forEach(photo => {
            if (photo.latitude && photo.longitude) {
                // Использовать photo.thumbnail_url если доступно, иначе photo.url
                const imageUrl = photo.thumbnail_url || photo.url;

                const photoIcon = L.divIcon({
                    className: 'photo-marker', // Класс для общего стиля маркера
                    html: `<div class="photo-marker-inner"><img src="${imageUrl}" alt="Фото"></div>`,
                    iconSize: [50, 50], // Увеличиваем размер иконки для лучшей видимости
                    iconAnchor: [25, 50] // Центрируем иконку
                });

                const marker = L.marker([photo.latitude, photo.longitude], {
                    icon: photoIcon
                }).bindPopup(`
                    <div class="photo-popup">
                        <img src="${photo.url}" alt="Фото с прогулки" class="photo-popup-img">
                        ${photo.timestamp ? `<p class="photo-time">${new Date(photo.timestamp).toLocaleString()}</p>` : ''}
                        ${photo.description ? `<p class="photo-description">${photo.description}</p>` : ''}
                    </div>
                `);

                photoMarkers.addLayer(marker);
            }
        });
        map.addLayer(photoMarkers);
    }

    if (walkData.path_geojson) {
        try {
            const geoJsonLayer = L.geoJSON(walkData.path_geojson, {
                style: function (feature) {
                    return {
                        color: '#4CAF50',
                        weight: 5,
                        opacity: 0.9
                    };
                },
                pointToLayer: function (feature, latlng) {
                    if (feature.properties && feature.properties.isStart) {
                        return L.circleMarker(latlng, {
                            radius: 8,
                            fillColor: "#007bff",
                            color: "#000",
                            weight: 1,
                            opacity: 1,
                            fillOpacity: 0.8
                        }).bindPopup("Начало маршрута");
                    }
                    if (feature.properties && feature.properties.isEnd) {
                        return L.circleMarker(latlng, {
                            radius: 8,
                            fillColor: "#dc3545",
                            color: "#000",
                            weight: 1,
                            opacity: 1,
                            fillOpacity: 0.8
                        }).bindPopup("Конец маршрута");
                    }
                    return null;
                }
            }).addTo(map);

            // Fit map to show both route and photos
            const bounds = geoJsonLayer.getBounds();
            if (walkData.photos && walkData.photos.length > 0) {
                bounds.extend(photoMarkers.getBounds());
            }

            if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: [50, 50] });
            } else {
                console.warn("Bounds are invalid, using default view");
                map.setView([55.751244, 37.618423], 10);
            }

        } catch (e) {
            console.error('Error parsing GeoJSON data:', e);
            mapContainer.innerHTML = '<p>Не удалось отобразить маршрут на карте.</p>';
            map.setView([55.751244, 37.618423], 10);
        }
    } else {
        mapContainer.innerHTML = '<p>Данные маршрута отсутствуют для этой прогулки.</p>';
        map.setView([55.751244, 37.618423], 10);
    }
}

function setupPhotoGallery() {
    const photoThumbnails = document.querySelectorAll('.photo-thumbnail');
    let currentPhotoIndex = 0;

    // Создаем элементы для полноэкранного просмотра
    const overlay = document.createElement('div');
    overlay.className = 'fullscreen-photo-overlay';
    overlay.style.display = 'none';

    const container = document.createElement('div');
    container.className = 'fullscreen-photo-container';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'photo-close-btn';
    closeBtn.innerHTML = '&times;';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'photo-nav-btn prev';
    prevBtn.innerHTML = '&larr;';

    const nextBtn = document.createElement('button');
    nextBtn.className = 'photo-nav-btn next';
    nextBtn.innerHTML = '&rarr;';

    const img = document.createElement('img');
    img.className = 'fullscreen-photo';

    const description = document.createElement('div');
    description.className = 'photo-description-fullscreen';

    container.appendChild(closeBtn);
    container.appendChild(prevBtn);
    container.appendChild(nextBtn);
    container.appendChild(img);
    container.appendChild(description);
    overlay.appendChild(container);
    document.body.appendChild(overlay);

    // Функция для показа фото в полноэкранном режиме
    function showFullscreenPhoto(index) {
        if (index >= 0 && index < photoThumbnails.length) {
            currentPhotoIndex = index;
            const photo = walkData.photos[index];
            img.src = photo.url;
            img.alt = photo.description || 'Фото с прогулки';
            description.textContent = photo.description || '';
            overlay.style.display = 'flex';
            document.body.style.overflow = 'hidden'; // Блокируем прокрутку страницы
        }
    }

    // Обработчики событий
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
        showFullscreenPhoto((currentPhotoIndex - 1 + photoThumbnails.length) % photoThumbnails.length);
    });

    nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showFullscreenPhoto((currentPhotoIndex + 1) % photoThumbnails.length);
    });

    // Обработка нажатий клавиш
    document.addEventListener('keydown', (e) => {
        if (overlay.style.display === 'flex') {
            if (e.key === 'Escape') {
                overlay.style.display = 'none';
                document.body.style.overflow = '';
            } else if (e.key === 'ArrowLeft') {
                showFullscreenPhoto((currentPhotoIndex - 1 + photoThumbnails.length) % photoThumbnails.length);
            } else if (e.key === 'ArrowRight') {
                showFullscreenPhoto((currentPhotoIndex + 1) % photoThumbnails.length);
            }
        }
    });

    // Добавляем обработчики для миниатюр
    photoThumbnails.forEach((thumbnail, index) => {
        thumbnail.addEventListener('click', function(e) {
            e.preventDefault();
            showFullscreenPhoto(index);

            // Оригинальная логика для карты (если нужно)
            const lat = parseFloat(this.dataset.lat);
            const lng = parseFloat(this.dataset.lng);
            const mapInstance = L.DomUtil.get('singleWalkMap')._leaflet_map;

            if (mapInstance && !isNaN(lat) && !isNaN(lng)) {
                mapInstance.setView([lat, lng], 15);
                mapInstance.eachLayer(layer => {
                    if (layer instanceof L.MarkerClusterGroup) {
                        layer.eachLayer(marker => {
                            const markerLatLng = marker.getLatLng();
                            if (markerLatLng.lat === lat && markerLatLng.lng === lng) {
                                marker.openPopup();
                            }
                        });
                    } else if (layer instanceof L.Marker && layer.getLatLng().lat === lat && layer.getLatLng().lng === lng) {
                        layer.openPopup();
                    }
                });
            }
        });
    });
}

function setupSecretAdminClick() {
    const copyrightElement = document.getElementById('copyrightText');
    let clickCount = 0;
    const requiredClicks = 3; // Количество кликов для активации
    let clickTimeout; // Для сброса счетчика

    if (copyrightElement) {
        copyrightElement.addEventListener('click', () => {
            clickCount++;
            clearTimeout(clickTimeout);
            clickTimeout = setTimeout(() => {
                clickCount = 0; // Сбрасываем счетчик, если между кликами прошло более 500 мс
            }, 500);
            if (clickCount === requiredClicks) {
                if (walkData && walkData.id) {
                    window.location.href = `/admin/edit-walk/${walkData.id}`; // Исправлено на admin/edit_walk
                } else {
                    console.error('Не удалось получить ID прогулки для перенаправления.');
                    alert('Ошибка: ID прогулки не найден для перенаправления.');
                }
                clickCount = 0; // Сбрасываем счетчик после активации
                clearTimeout(clickTimeout); // Очищаем таймаут после успешного срабатывания
            }
        });
    }
}