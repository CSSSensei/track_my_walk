let map;
let editableLayers;
let drawControl;
let currentWalkId = null; // null for add, ID for edit
let flatpickrInstance; // Для управления Flatpickr

// --- Utility Functions ---

function showToast(message, type = 'info', duration = 3000) {
    const toast = document.getElementById('toastMessage');
    toast.textContent = message;
    toast.className = `toast-message visible ${type}`; // Reset classes and add new ones

    setTimeout(() => {
        toast.classList.remove('visible');
    }, duration);
}

function convertUnixToDateTimeLocal(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000); // Convert seconds to milliseconds
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

function convertDateTimeLocalToUnix(dateTimeLocalString) {
    if (!dateTimeLocalString) return null;
    // Flatpickr возвращает YYYY-MM-DD HH:MM:SS, но input type="datetime-local" может быть YYYY-MM-DDTHH:MM
    const date = new Date(dateTimeLocalString);
    return Math.floor(date.getTime() / 1000); // Convert milliseconds to seconds
}

// --- Map Initialization and Drawing Logic ---

function initMapForEdit(initialGeoJson = null) {
    if (map) {
        map.remove(); // Удаляем старый экземпляр карты, если он есть
    }
    map = L.map('map').setView([55.751244, 37.618423], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    editableLayers = new L.FeatureGroup();
    map.addLayer(editableLayers);

    if (initialGeoJson) {
        try {
            const geoJsonObj = JSON.parse(initialGeoJson);
            const geoJsonLayer = L.geoJSON(geoJsonObj, {
                style: function() {
                    return {
                        color: '#FF0000', // Red color for paths
                        weight: 4,
                        opacity: 0.8
                    };
                }
            }).addTo(editableLayers);
            // Если есть геометрия, центрируем карту на ней
            if (geoJsonLayer.getBounds().isValid()) {
                 map.fitBounds(geoJsonLayer.getBounds());
            }
        } catch (e) {
            console.error("Error parsing initial GeoJSON:", e);
            showToast("Ошибка при загрузке данных карты.", "error");
        }
    }

    // Инициализация Leaflet.draw
    if (drawControl) {
        map.removeControl(drawControl); // Удаляем старый контрол, если есть
    }
    drawControl = new L.Control.Draw({
        edit: {
            featureGroup: editableLayers,
            remove: true
        },
        draw: {
            polyline: {
                shapeOptions: {
                    color: '#FF0000' // Цвет при рисовании
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

    // Обработчики событий Leaflet.draw
    map.on(L.Draw.Event.CREATED, function (event) {
        editableLayers.addLayer(event.layer);
    });
    map.on(L.Draw.Event.EDITED, function (event) {
        // Данные уже обновлены в editableLayers
    });
    map.on(L.Draw.Event.DELETED, function (event) {
        // Данные уже удалены из editableLayers
    });
}

function getGeoJsonFromMap() {
    if (editableLayers.getLayers().length === 0) {
        return null; // Нет нарисованных или загруженных слоев
    }
    // Если есть только один слой и это LineString
    if (editableLayers.getLayers().length === 1 && editableLayers.getLayers()[0] instanceof L.Polyline) {
        return JSON.stringify(editableLayers.getLayers()[0].toGeoJSON());
    }
    // Если есть несколько слоев или не только LineString, можно вернуть FeatureCollection
    // Для нашего случая, где мы ожидаем одну прогулку (LineString или Point),
    // лучше обработать это, взяв первый слой или явно запрашивать полилинию
    // Для простоты, здесь мы возьмем только первый LineString, если их несколько,
    // или первый маркер, если это Point.
    const layers = editableLayers.getLayers();
    if (layers.length > 0) {
        for (const layer of layers) {
            if (layer instanceof L.Polyline || layer instanceof L.Marker) { // Leaflet Marker для Point
                return JSON.stringify(layer.toGeoJSON());
            }
        }
    }
    return null; // Ничего подходящего не найдено
}

// --- Form Management ---

function showWalkForm(walk = null) {
    document.getElementById('walkFormModal').style.display = 'block';
    const formTitle = document.getElementById('formTitle');
    const walkIdInput = document.getElementById('walkId');
    const nameInput = document.getElementById('name');
    const dateInput = document.getElementById('date');
    const descriptionInput = document.getElementById('description');

    if (walk) {
        // Редактирование существующей прогулки
        formTitle.textContent = 'Редактировать';
        currentWalkId = walk.id;
        walkIdInput.value = walk.id;
        nameInput.value = walk.name;
        dateInput.value = convertUnixToDateTimeLocal(walk.date); // Преобразуем timestamp
        descriptionInput.value = walk.description;
        initMapForEdit(walk.path_geojson); // Загружаем существующий GeoJSON на карту
    } else {
        // Добавление новой прогулки
        formTitle.textContent = 'Добавить';
        currentWalkId = null;
        walkIdInput.value = '';
        nameInput.value = '';
        dateInput.value = '';
        descriptionInput.value = '';
        initMapForEdit(); // Инициализируем пустую карту для рисования
    }
    // Перезапускаем Flatpickr, чтобы он применился к новому input
    if (flatpickrInstance) {
        flatpickrInstance.destroy();
    }
    flatpickrInstance = flatpickr("#date", {
        enableTime: true,
        dateFormat: "Y-m-d H:i:S",
        locale: "ru", // Локализация на русский
    });
}

function hideWalkForm() {
    document.getElementById('walkFormModal').style.display = 'none';
    document.getElementById('walkForm').reset(); // Очистить форму
    if (map) {
        map.remove(); // Удалить карту из DOM
        map = null;
    }
    editableLayers = null;
    drawControl = null;
    currentWalkId = null;
}

// --- API Interactions ---

async function fetchWalks() {
    try {
        const response = await fetch('/walks');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const walks = await response.json();
        renderWalksTable(walks);
    } catch (error) {
        console.error('Error fetching walks:', error);
        showToast('Не удалось загрузить список прогулок.', 'error');
    }
}

async function saveWalk(event) {
    event.preventDefault(); // Предотвращаем стандартную отправку формы

    const name = document.getElementById('name').value;
    const date = document.getElementById('date').value; // Дата уже в нужном формате
    const description = document.getElementById('description').value;
    const path_geojson = getGeoJsonFromMap();

    if (!name || !date || !path_geojson) {
        showToast('Пожалуйста, заполните все обязательные поля (Название, Дата, Путь на карте).', 'error');
        return;
    }

    const walkData = {
        name: name,
        date: date, // Отправляем как строку
        description: description,
        path_geojson: path_geojson // Это уже JSON-строка
    };

    try {
        let response;
        if (currentWalkId) {
            // Обновление существующей прогулки (PUT)
            response = await fetch(`/walks/${currentWalkId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(walkData)
            });
        } else {
            // Добавление новой прогулки (POST)
            // При добавлении нам нужно отправить координаты, не GeoJSON строку
            // Чтобы API /add_walk работал
            const geojsonObj = JSON.parse(path_geojson);
            const coordinatesToSend = geojsonObj.type === "LineString" ? geojsonObj.coordinates : (geojsonObj.type === "Point" ? [geojsonObj.coordinates] : []);

            response = await fetch('/admin/add_walk', { // Использовать /admin/add_walk
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name,
                    date: date,
                    description: description,
                    coordinates: coordinatesToSend // Отправляем координаты как массив
                })
            });
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        showToast(`Прогулка успешно ${currentWalkId ? 'обновлена' : 'добавлена'}!`, 'success');
        hideWalkForm();
        fetchWalks(); // Обновляем список прогулок
    } catch (error) {
        console.error('Error saving walk:', error);
        showToast(`Ошибка при сохранении прогулки: ${error.message}`, 'error');
    }
}


async function deleteWalk(walkId) {
    if (!confirm('Вы уверены, что хотите удалить эту прогулку?')) {
        return;
    }

    try {
        const response = await fetch(`/admin/walks/${walkId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }

        showToast('Прогулка успешно удалена.', 'success');
        fetchWalks(); // Обновляем список
    } catch (error) {
        console.error('Error deleting walk:', error);
        showToast(`Ошибка при удалении прогулки: ${error.message}`, 'error');
    }
}

// --- Rendering Logic ---

function renderWalksTable(walks) {
    const tableBody = document.querySelector('#walksTable tbody');
    tableBody.innerHTML = ''; // Очищаем таблицу перед заполнением

    if (walks.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5">Прогулок пока нет.</td></tr>';
        return;
    }

    walks.forEach(walk => {
        const row = tableBody.insertRow();
        row.insertCell().textContent = walk.id;
        row.insertCell().textContent = walk.name;
        // Преобразование Unix timestamp в читабельный формат даты/времени
        const date = new Date(walk.date * 1000);
        row.insertCell().textContent = date.toLocaleDateString('ru-RU', {
            year: 'numeric', month: 'numeric', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        row.insertCell().textContent = walk.distance.toFixed(2);

        const actionsCell = row.insertCell();
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Редактировать';
        editBtn.classList.add('edit-button');
        editBtn.addEventListener('click', () => {
            window.location.href = `/admin/edit-walk/${walk.id}`;
        });
        actionsCell.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Удалить';
        deleteBtn.classList.add('control-button-group', 'button'); // Применяем класс из CSS
        deleteBtn.style.marginLeft = '10px'; // Небольшой отступ
        deleteBtn.addEventListener('click', () => deleteWalk(walk.id));
        actionsCell.appendChild(deleteBtn);
    });
}

// --- Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    fetchWalks(); // Загружаем прогулки при загрузке страницы

    document.getElementById('addWalkBtn').addEventListener('click', () => window.location.href = '/admin');
    document.getElementById('refreshWalksBtn').addEventListener('click', fetchWalks);
    document.getElementById('cancelEditBtn').addEventListener('click', hideWalkForm);
    document.getElementById('walkForm').addEventListener('submit', saveWalk);
});