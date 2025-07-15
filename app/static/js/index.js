let map;
let geoJsonLayers = [];

const creatureContainer = document.querySelector('.dolboeb');
const randomWalkSection = document.querySelector('.random-walk-section');
const goGopherSvg = document.querySelector('.dolboeb-svg');

const animatedPupilLeft = document.querySelector('#pupil-left .animated-pupil');
const animatedPupilRight = document.querySelector('#pupil-right .animated-pupil');
const eyeballLeft = document.getElementById('eyeball-left');
const eyeballRight = document.getElementById('eyeball-right');
const pupilsGroup = document.getElementById('pupils');
const eyeballsGroup = document.getElementById('eyeballs');
const eyelidsClosedGroup = document.getElementById('eyelids-closed');
const eyelidsPart2Group = document.getElementById('eyelids-part-2');
const callToActionButton = document.querySelector('.button-go-walk');

let creatureVisible = false;
let eyesBounced = false;
let isSquinting = false;

// Function to apply theme based on localStorage
function updateIconColor() {
    const themeIcon = document.getElementById('themeIcon');
    const isScrolled = window.scrollY > 30;

    if (document.body.classList.contains('dark-mode')) {
        if (isScrolled) {
            themeIcon.style.filter = 'invert(100%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(100%) contrast(100%)';
        } else {
            themeIcon.style.filter = 'invert(67%) sepia(98%) saturate(354%) hue-rotate(51deg) brightness(97%) contrast(101%)';
        }
    } else {
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
    if (window.scrollY > 30) {
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
            themeSwitchSound.currentTime = 0;
            themeSwitchSound.play().catch(e => console.error("Error playing sound:", e));
        }

    }, 200);
}

function isElementInViewport(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return (
        rect.top <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.bottom >= 0 &&
        rect.left <= (window.innerWidth || document.documentElement.clientWidth) &&
        rect.right >= 0
    );
}

function handleCreatureScroll() {
    if (!randomWalkSection || !creatureContainer || !goGopherSvg || !animatedPupilLeft || !animatedPupilRight) {
        return;
    }

    if (isElementInViewport(randomWalkSection) && !creatureVisible) {
        creatureVisible = true;
        creatureContainer.classList.add('visible');

        setTimeout(() => {
            if (!eyesBounced) {
                goGopherSvg.classList.add('landed');
                eyesBounced = true;

                setTimeout(() => {
                    goGopherSvg.classList.remove('landed');
                }, 500);
            }
        }, 800);
    }
}

function handleCreatureMouseMove(e) {
    if (eyesBounced && creatureVisible && goGopherSvg && animatedPupilLeft && animatedPupilRight && eyeballLeft && eyeballRight && pupilsGroup && eyeballsGroup) {
        const svgRect = goGopherSvg.getBoundingClientRect();
        const mouseX = e.clientX - svgRect.left;
        const mouseY = e.clientY - svgRect.top;

        function getSvgElementCenter(element) {
            const bbox = element.getBBox();
            const ctm = element.getCTM();

            const svgPoint = goGopherSvg.createSVGPoint();
            svgPoint.x = bbox.x + bbox.width / 2;
            svgPoint.y = bbox.y + bbox.height / 2;

            const transformedPoint = svgPoint.matrixTransform(ctm);
            return { x: transformedPoint.x, y: transformedPoint.y };
        }

        const centerLeftEye = getSvgElementCenter(eyeballLeft);
        const centerRightEye = getSvgElementCenter(eyeballRight);

        const maxMove = 26; // Максимальное смещение зрачка в пикселях (в координатах SVG)

        function calculatePupilOffset(pupilElement, centerX, centerY) {
            const deltaX = mouseX - centerX;
            const deltaY = mouseY - centerY;

            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            let offsetX = 0;
            let offsetY = 0;

            if (distance > 0) {
                offsetX = (deltaX / distance) * Math.min(distance, maxMove);
                offsetY = (deltaY / distance) * Math.min(distance, maxMove);
            }

            pupilElement.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
        }

        calculatePupilOffset(animatedPupilLeft, centerLeftEye.x, centerLeftEye.y);
        calculatePupilOffset(animatedPupilRight, centerRightEye.x, centerRightEye.y);
    }
}


// Initialize the Leaflet Map
function initMap() {
    // Center map on Moscow
    map = L.map('map').setView([55.751244, 37.618423], 10);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    fetchWalksAndDisplay();
    fetchRecentWalks();
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
            currentValue = (startValue + progress * (endValue - startValue)).toFixed(2);
            element.textContent = currentValue + ' км';
        } else {
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
    geoJsonLayers.forEach(layer => map.removeLayer(layer));
    geoJsonLayers = [];

    let totalDistanceKm = 0;

    try {
        const response = await fetch('/walks');
        const walks = await response.json();

        walks.forEach(walk => {
            if (walk.path_geojson) {
                const geojsonData = walk.path_geojson;

                const geoJsonLayer = L.geoJSON(geojsonData, {
                    style: function (feature) {
                        return {
                            color: '#FF0000',
                            weight: 4,
                            opacity: 0.8
                        };
                    },
                    onEachFeature: function (feature, layer) {
                        layer.walkId = walk.id;

                        layer.on('mouseover', function () {
                            layer.setStyle({
                                color: '#00FF00',
                                weight: 5,
                                opacity: 1.0
                            });
                        });

                        layer.on('mouseout', function () {
                            layer.setStyle({
                                color: '#FF0000',
                                weight: 4,
                                opacity: 0.8
                            });
                        });

                        layer.on('click', function (e) {
                            window.location.href = `/walk/${e.target.walkId}`;
                        });

                        const walkDate = new Date(walk.date * 1000).toLocaleDateString('ru-RU');
                        const tooltipContent = `<b>${walk.name || 'Без названия'}</b><br>${walkDate} — ${walk.distance.toFixed(2)} км`;

                        layer.bindTooltip(tooltipContent, {
                            permanent: false,
                            direction: 'auto',
                            className: 'walk-tooltip'
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
        const response = await fetch('/walks');
        const walks = await response.json();
        const recentWalksContainer = document.getElementById('recent-walks-list');
        recentWalksContainer.innerHTML = '';

        walks.slice(0, 3).forEach(walk => {
            const walkCard = document.createElement('div');
            walkCard.classList.add('recent-walk-card');
            walkCard.dataset.walkId = walk.id;

            const walkDate = new Date(walk.date * 1000).toLocaleDateString('ru-RU');

            walkCard.innerHTML = `
                <h4>${walk.name || 'Без названия'}</h4>
                <p>${walkDate} — ${walk.distance.toFixed(2)} км</p>
            `;
            walkCard.addEventListener('click', () => {
                window.location.href = `/walk/${walk.id}`;
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
    let clickTimeout;

    if (copyrightElement) {
        copyrightElement.addEventListener('click', () => {
            clickCount++;
            clearTimeout(clickTimeout);
            clickTimeout = setTimeout(() => {
                clickCount = 0;
            }, 500);

            if (clickCount === requiredClicks) {
                window.location.href = `/admin/`;

                clickCount = 0
                clearTimeout(clickTimeout);
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

        this.style.setProperty('--mouse-x', `${x}px`);
        this.style.setProperty('--mouse-y', `${y}px`);

        const normalizedX = (x / rect.width - 0.5) * 2;
        const normalizedY = (y / rect.height - 0.5) * 2;

        const glassRotateY = normalizedX * 35;
        const glassRotateX = -normalizedY * 35;

        const textRotateY = normalizedX;
        const textRotateX = -normalizedY;

        this.style.transform = `scale(1.05) rotateX(${glassRotateX}deg) rotateY(${glassRotateY}deg)`;
        textLayer.style.transform = `translateZ(30px) scale(1.10) rotateX(${textRotateX}deg) rotateY(${textRotateY}deg)`;
    });

    card.addEventListener('mouseleave', function() {
        this.style.transform = 'scale(1) rotateX(0) rotateY(0)';
        textLayer.style.transform = 'translateZ(30px) scale(1) rotateX(0) rotateY(0)';

        setTimeout(() => {
            this.style.removeProperty('--mouse-x');
            this.style.removeProperty('--mouse-y');
        }, 300);
    });
});


// Main DOMContentLoaded listener
document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('scroll', handleCreatureScroll);
    document.addEventListener('mousemove', handleCreatureMouseMove);
    handleCreatureScroll();
    initMap();

    applyTheme();
    setupSecretAdminClick();
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    window.addEventListener('scroll', handleStickyHeader);
    handleStickyHeader();

    function startSquint() {
        if (!isSquinting) {
            isSquinting = true;
            goGopherSvg.classList.add('squinted');
        }
    }

    function stopSquint() {
        if (isSquinting) {
            isSquinting = false;
            goGopherSvg.classList.remove('squinted');
        }
    }

    if (callToActionButton) {
        callToActionButton.addEventListener('mouseenter', startSquint);
        callToActionButton.addEventListener('mouseleave', stopSquint);
    }
});