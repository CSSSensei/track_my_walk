// app/static/js/index.js
let map;
let geoJsonLayers = []; // To store Leaflet GeoJSON layers for clearing/updating

// Function to apply theme based on localStorage
function updateIconColor() {
    const themeIcon = document.getElementById('themeIcon');
    const isScrolled = window.scrollY > 50;

    if (document.body.classList.contains('dark-mode')) {
        if (isScrolled) {
            // Тёмная тема + скролл - белая иконка
            themeIcon.style.filter = 'invert(100%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(100%) contrast(100%)';
        } else {
            // Тёмная тема без скролла - зелёная иконка
            themeIcon.style.filter = 'invert(67%) sepia(98%) saturate(354%) hue-rotate(51deg) brightness(97%) contrast(101%)';
        }
    } else {
        // Светлая тема - чёрная иконка
        themeIcon.style.filter = 'invert(0%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(0%) contrast(100%)';
    }
}

function applyTheme() {
    const savedTheme = localStorage.getItem('theme');
    const themeIcon = document.getElementById('themeIcon');

    if (savedTheme === null || savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        if (savedTheme === null) {
            localStorage.setItem('theme', 'dark');
        }
        themeIcon.src = 'https://img.icons8.com/external-glyph-silhouettes-icons-papa-vector/78/external-Light-Mode-interface-glyph-silhouettes-icons-papa-vector.png';
        themeIcon.alt = 'Switch to light mode';
    } else {
        document.body.classList.remove('dark-mode');
        themeIcon.src = 'https://img.icons8.com/ios-filled/50/do-not-disturb-2.png';
        themeIcon.alt = 'Switch to dark mode';
    }

    updateIconColor();
}

function handleStickyHeader() {
    const stickyHeader = document.getElementById('sticky-header-container');
    if (window.scrollY > 50) {
        stickyHeader.classList.add('scrolled');
    } else {
        stickyHeader.classList.remove('scrolled');
    }
    updateIconColor();
}

function toggleTheme() {
    const body = document.body;
    const themeIcon = document.getElementById('themeIcon');
    const themeSwitchSound = document.getElementById('themeSwitchSound');


    themeIcon.classList.add('hide-icon');

    setTimeout(() => {
        body.classList.toggle('dark-mode');
        const currentTheme = body.classList.contains('dark-mode') ? 'dark' : 'light';
        localStorage.setItem('theme', currentTheme);

        if (currentTheme === 'dark') {
            themeIcon.src = 'https://img.icons8.com/external-glyph-silhouettes-icons-papa-vector/78/external-Light-Mode-interface-glyph-silhouettes-icons-papa-vector.png';
            themeIcon.alt = 'Switch to light mode';
            themeIcon.style.width = '30px';
            themeIcon.style.height = '30px';
        } else {
            themeIcon.src = 'https://img.icons8.com/ios-filled/50/do-not-disturb-2.png';
            themeIcon.alt = 'Switch to dark mode';
            themeIcon.style.width = '22px';
            themeIcon.style.height = '22px';
        }

        themeIcon.classList.remove('hide-icon');
        updateIconColor();

        if (themeSwitchSound) {
            themeSwitchSound.currentTime = 0; // Сбрасываем звук в начало, чтобы можно было быстро кликать
            themeSwitchSound.play().catch(e => console.error("Error playing sound:", e)); // Добавляем catch для обработки ошибок (например, если пользователь еще не взаимодействовал со страницей)
        }

    }, 200);
}

// Initialize the Leaflet Map
function initMap() {
    applyTheme(); // Apply theme on load
    setupSecretAdminClick();

    // Center map on Moscow
    map = L.map('map').setView([55.751244, 37.618423], 10);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    fetchWalksAndDisplay();
    fetchRecentWalks();

    // event listener for theme toggle button
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);

    // Add scroll event listener for sticky header
    window.addEventListener('scroll', handleStickyHeader);
    // Call it once on load to set initial state if page is already scrolled
    handleStickyHeader();
}

function animateCounter(elementId, endValue, duration, isDistance = false) {
    const element = document.getElementById(elementId);
    if (!element) return;

    let startTimestamp = null;
    const startValue = 0;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        let currentValue;

        if (isDistance) {
            // For distance, use toFixed(2)
            currentValue = (startValue + progress * (endValue - startValue)).toFixed(2);
            element.textContent = currentValue + ' км';
        } else {
            // For counts, round to integer
            currentValue = Math.floor(startValue + progress * (endValue - startValue));
            element.textContent = currentValue;
        }


        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };

    window.requestAnimationFrame(step);
}

// Fetch all walks from the backend and display them on the main map
async function fetchWalksAndDisplay() {
    // Clear existing GeoJSON layers before drawing new ones
    geoJsonLayers.forEach(layer => map.removeLayer(layer));
    geoJsonLayers = [];

    let totalDistanceKm = 0;

    try {
        const response = await fetch('/walks');
        const walks = await response.json();

        walks.forEach(walk => {
            if (walk.path_geojson) {
                const geojsonData = JSON.parse(walk.path_geojson);

                // Add GeoJSON LineString to map
                const geoJsonLayer = L.geoJSON(geojsonData, {
                    style: function (feature) {
                        return {
                            color: '#FF0000', // Red color for walk paths
                            weight: 4,
                            opacity: 0.8
                        };
                    },
                    onEachFeature: function (feature, layer) {
                        layer.walkId = walk.id;

                        layer.on('mouseover', function () {
                            layer.setStyle({
                                color: '#00FF00',
                                weight: 5,       // Slightly thicker on hover
                                opacity: 1.0     // Fully opaque on hover
                            });
                        });

                        layer.on('mouseout', function () {
                            layer.setStyle({
                                color: '#FF0000', // Revert to red on mouse out
                                weight: 4,
                                opacity: 0.8
                            });
                        });

                        layer.on('click', function (e) {
                            window.location.href = `/walk/${e.target.walkId}`;
                        });

                        // ПОДСКАЗКА ПРИ НАВЕДЕНИИ
                        const walkDate = new Date(walk.date * 1000).toLocaleDateString('ru-RU');
                        const tooltipContent = `<b>${walk.name || 'Без названия'}</b><br>${walkDate} — ${walk.distance.toFixed(2)} км`;

                        layer.bindTooltip(tooltipContent, {
                            permanent: false, // Подсказка исчезает, когда курсор уходит
                            direction: 'auto',
                            className: 'walk-tooltip' // Класс для стилизации подсказки
                        });
                    }
                }).addTo(map);
                geoJsonLayers.push(geoJsonLayer);

                if (typeof walk.distance === 'number') {
                    totalDistanceKm += walk.distance;
                }
            }
        });

        animateCounter('totalWalks', walks.length, 750);
        animateCounter('totalDistance', totalDistanceKm, 750, true);

    } catch (error) {
        console.error('Error fetching walks:', error);
    }
}


// New function to fetch and display the 4 most recent walks
async function fetchRecentWalks() {
    try {
        const response = await fetch('/walks'); // Fetch all walks (sorted by date DESC from backend)
        const walks = await response.json();
        const recentWalksContainer = document.getElementById('recent-walks-list');
        recentWalksContainer.innerHTML = ''; // Clear previous content

        // Display up to 4 most recent walks
        walks.slice(0, 3).forEach(walk => {
            const walkCard = document.createElement('div');
            walkCard.classList.add('recent-walk-card');
            walkCard.dataset.walkId = walk.id; // Store walk ID for navigation

            const walkDate = new Date(walk.date * 1000).toLocaleDateString('ru-RU'); // Convert timestamp to date string

            walkCard.innerHTML = `
                <h4>${walk.name || 'Без названия'}</h4>
                <p>${walkDate} — ${walk.distance.toFixed(2)} км</p>
            `;
            walkCard.addEventListener('click', () => {
                window.location.href = `/walk/${walk.id}`; // Navigate to single walk page
            });
            recentWalksContainer.appendChild(walkCard);
        });

    } catch (error) {
        console.error('Error fetching recent walks:', error);
    }
}

// Function to handle file upload (existing functionality)
async function uploadFile() {
    const fileInput = document.getElementById('locationHistoryFile');
    const uploadStatus = document.getElementById('uploadStatus');
    const file = fileInput.files[0];

    if (!file) {
        uploadStatus.textContent = 'Пожалуйста, выберите JSON файл.';
        uploadStatus.style.color = 'orange';
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    uploadStatus.textContent = 'Загрузка...';
    uploadStatus.style.color = 'blue';

    try {
        const response = await fetch('/admin/upload', {
            method: 'POST',
            body: formData,
        });

        const result = await response.json();

        if (response.ok) {
            uploadStatus.textContent = result.message;
            uploadStatus.style.color = 'green';
            // Refresh map and recent walks after successful upload
            fetchWalksAndDisplay();
            fetchRecentWalks();
        } else {
            uploadStatus.textContent = `Ошибка: ${result.message}`;
            uploadStatus.style.color = 'red';
        }
    } catch (error) {
        console.error('Error during upload:', error);
        uploadStatus.textContent = 'Произошла ошибка при загрузке файла.';
        uploadStatus.style.color = 'red';
    }
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
                window.location.href = `/admin/`;

                clickCount = 0; // Сбрасываем счетчик после активации
                clearTimeout(clickTimeout); // Очищаем таймаут после успешного срабатывания
            }
        });
    }
}

document.querySelectorAll('.stat-card').forEach(card => {
    const textLayer = card.querySelector('.text-layer');

    card.addEventListener('mousemove', function(e) {
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Обновление позиции свечения
        this.style.setProperty('--mouse-x', `${x}px`);
        this.style.setProperty('--mouse-y', `${y}px`);

        // Параллакс-эффект (разная глубина)
        const normalizedX = (x / rect.width - 0.5) * 2;
        const normalizedY = (y / rect.height - 0.5) * 2;

        // Разная сила вращения для слоев
        const glassRotateY = normalizedX * 35;
        const glassRotateX = -normalizedY * 35;

        const textRotateY = normalizedX; // Текст вращается слабее
        const textRotateX = -normalizedY;

        // Применяем вращение
        this.style.transform = `scale(1.05) rotateX(${glassRotateX}deg) rotateY(${glassRotateY}deg)`;
        textLayer.style.transform = `translateZ(30px) scale(1.10) rotateX(${textRotateX}deg) rotateY(${textRotateY}deg)`;
    });

    card.addEventListener('mouseleave', function() {
        // Плавный возврат в исходное состояние
        this.style.transform = 'scale(1) rotateX(0) rotateY(0)';
        textLayer.style.transform = 'translateZ(30px) scale(1) rotateX(0) rotateY(0)';

        // Плавное исчезновение свечения
        setTimeout(() => {
            this.style.removeProperty('--mouse-x');
            this.style.removeProperty('--mouse-y');
        }, 300);
    });
});

document.addEventListener('DOMContentLoaded', initMap);