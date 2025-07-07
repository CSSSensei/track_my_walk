let map;
let editableLayers;
let drawControl;
let flatpickrInstance;
let photoMarker = null;

// --- Utility Functions ---

function showToast(message, type = 'info', duration = 3000) {
    const toast = document.getElementById('toastMessage');
    toast.textContent = message;
    toast.className = `toast-message visible ${type}`;

    if (toast.timeoutId) {
        clearTimeout(toast.timeoutId);
    }
    toast.timeoutId = setTimeout(() => {
        toast.classList.remove('visible');
        toast.textContent = ''; // Очищаем текст после скрытия
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
            if (geoJsonLayer.getBounds().isValid()) {
                 map.fitBounds(geoJsonLayer.getBounds());
            } else {
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
        showToast('Маршрут на карте изменен.', 'info');
    });
    map.on(L.Draw.Event.DELETED, function (event) {
        showToast('Маршрут на карте удален.', 'info');
    });

    // Обработчик клика для установки координат фото
    map.on('click', function(e) {
        const photosSection = document.getElementById('photosSection');
        // Только если секция фото видна и поля фото активны
        if (photosSection && photosSection.style.display === 'block') {
            if (photoMarker) {
                map.removeLayer(photoMarker);
            }
            photoMarker = L.marker(e.latlng).addTo(map);
            document.getElementById('photoLat').value = e.latlng.lat.toFixed(6);
            document.getElementById('photoLon').value = e.latlng.lng.toFixed(6);
            showToast('Координаты для фото выбраны.', 'info');
        }
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
    // Также очищаем маркер фото и его поля
    if (photoMarker) {
        map.removeLayer(photoMarker);
        photoMarker = null;
    }
    document.getElementById('photoLat').value = '';
    document.getElementById('photoLon').value = '';
}

// --- API Interactions ---

async function saveWalk(event) {
    event.preventDefault();

    const walkId = document.getElementById('walkId').value;
    const name = document.getElementById('name').value;
    const dateInput = document.getElementById('date').value;
    const description = document.getElementById('description').value;
    const path_geojson = getGeoJsonFromMap();  // строка

    if (!name || !dateInput) {
        showToast('Пожалуйста, заполните Название и Дату.', 'error');
        return;
    }
    if (!walkId && !path_geojson) {
        showToast('Для новой прогулки необходимо нарисовать маршрут на карте.', 'error');
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
            const geojsonObj = JSON.parse(path_geojson); // Парсим GeoJSON строку в объект
            const coordinatesToSend = geojsonObj.type === "LineString" ? geojsonObj.coordinates : (geojsonObj.type === "Point" ? [geojsonObj.coordinates] : []);

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

        const result = await response.json();
        const newWalkId = walkId || result.id; // Получаем ID новой прогулки, если она была добавлена

        showToast(`Прогулка успешно ${walkId ? 'обновлена' : 'добавлена'}!`, 'success');

        setTimeout(() => {
            window.location.href = `/walk/${walkId}`;
        }, 1500);
    } catch (error) {
        console.error('Error saving walk:', error);
        showToast(`Ошибка при сохранении прогулки: ${error.message}`, 'error');
    }
}

// --- Photo Management Logic ---

// Функция для переключения видимости секции фото
function togglePhotosSection() {
    const photosSection = document.getElementById('photosSection');
    const toggleBtn = document.getElementById('togglePhotosBtn');
    if (photosSection.style.display === 'none' || photosSection.style.display === '') {
        photosSection.style.display = 'block';
        toggleBtn.textContent = 'Скрыть управление фото';
        if (currentWalkId) {
            loadPhotosForWalk(currentWalkId);
        }
    } else {
        photosSection.style.display = 'none';
        toggleBtn.textContent = `Управление фото (${currentWalkId})`;
        if (photoMarker) {
            map.removeLayer(photoMarker);
            photoMarker = null;
        }
        document.getElementById('photoLat').value = '';
        document.getElementById('photoLon').value = '';
    }
    setTimeout(() => {
        map.invalidateSize();
    }, 10);
}


async function uploadPhoto() {
    const walkId = currentWalkId; // Берем ID прогулки из глобальной переменной
    const photoFile = document.getElementById('photoUploadInput').files[0];
    const description = document.getElementById('photoDescription').value.trim();
    const latitude = document.getElementById('photoLat').value;
    const longitude = document.getElementById('photoLon').value;

    if (!walkId) {
        showToast('Ошибка: ID прогулки не найден. Пожалуйста, сохраните прогулку сначала.', 'error');
        return;
    }
    if (!photoFile) {
        showToast('Выберите файл фотографии.', 'error');
        return;
    }
    if (!latitude || !longitude) {
        showToast('Укажите координаты для фотографии, кликнув на карту.', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('photo', photoFile);
    formData.append('walk_id', walkId);
    formData.append('description', description);
    formData.append('latitude', latitude);
    formData.append('longitude', longitude);

    try {
        const response = await fetch('/admin/upload_photo', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();

        if (response.ok) {
            showToast(result.message, 'success');
            // Очистка полей формы фото после загрузки
            document.getElementById('photoUploadInput').value = '';
            document.getElementById('photoDescription').value = '';
            document.getElementById('photoLat').value = '';
            document.getElementById('photoLon').value = '';
            if (photoMarker) {
                map.removeLayer(photoMarker);
                photoMarker = null;
            }
            await loadPhotosForWalk(walkId);
        } else {
            showToast(result.error || 'Ошибка загрузки фото.', 'error');
        }
    } catch (error) {
        showToast('Ошибка сети при загрузке фото: ' + error.message, 'error');
        console.error('Fetch error:', error);
    }
}

async function loadPhotosForWalk(walkId) {
    const photosDiv = document.getElementById('uploadedPhotos');
    photosDiv.innerHTML = '<h3>Загруженные фото для этой прогулки:</h3>';

    if (!walkId) {
        photosDiv.innerHTML += '<p>Невозможно загрузить фотографии без ID прогулки.</p>';
        return;
    }

    map.eachLayer(function(layer) {
        if (layer instanceof L.Marker && layer !== photoMarker) {
            if (layer._icon && layer._icon.classList.contains('photo-marker')) {
                map.removeLayer(layer);
            }
        }
    });


    try {
        const response = await fetch(`/walk/${walkId}/photos`);
        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.error || `HTTP error! Status: ${response.status}`);
        }
        const photos = await response.json();

        if (photos && photos.length > 0) {
            photos.forEach(photo => {
                const existingPhotoMarker = L.marker([photo.latitude, photo.longitude]).addTo(map);
                existingPhotoMarker._icon.classList.add('photo-marker');
                existingPhotoMarker.bindPopup(`<b>${photo.description || 'Фотография'}</b><br><img src="${photo.url}" style="width:150px; height:auto;">`);

                // Добавляем миниатюру в секцию uploadedPhotos
                const imgContainer = document.createElement('div');
                imgContainer.className = 'photo-thumbnail-container';

                const img = document.createElement('img');
                img.src = photo.url;
                img.alt = photo.description || 'Фотография';
                imgContainer.appendChild(img);

                const p = document.createElement('p');
                p.textContent = photo.description || 'Без описания';
                imgContainer.appendChild(p);

                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'Удалить';
                deleteBtn.className = 'delete-photo-btn';
                deleteBtn.onclick = async () => {
                    if (confirm('Вы уверены, что хотите удалить эту фотографию?')) {
                        await deletePhoto(photo.id);
                    }
                };
                imgContainer.appendChild(deleteBtn);

                photosDiv.appendChild(imgContainer);
            });
        } else {
            photosDiv.innerHTML += '<p>Пока нет загруженных фотографий.</p>';
        }
    } catch (error) {
        showToast(`Ошибка загрузки фото: ${error.message}`, 'error');
        console.error('Error loading photos:', error);
    }
}

async function deletePhoto(photoId) {
    try {
        const response = await fetch(`/admin/photos/${photoId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        if (response.ok) {
            showToast('Фотография успешно удалена!', 'success');
            await loadPhotosForWalk(currentWalkId);
            return true;
        } else {
            const errorResult = await response.json();
            showToast(errorResult.error || 'Ошибка при удалении фотографии.', 'error');
            return false;
        }
    } catch (error) {
        showToast('Ошибка сети при удалении фото: ' + error.message, 'error');
        console.error('Delete photo error:', error);
        return false;
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

    const togglePhotosBtn = document.getElementById('togglePhotosBtn');
    if (togglePhotosBtn) {
        togglePhotosBtn.addEventListener('click', togglePhotosSection);
    }

    if (!currentWalkId) {
        if (togglePhotosBtn) {
            togglePhotosBtn.style.display = 'none';
        }
    }
});