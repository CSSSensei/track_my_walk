// app/static/js/index.js
let map;
let geoJsonLayers = []; // To store Leaflet GeoJSON layers for clearing/updating

// Function to apply theme based on localStorage
function applyTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
}

// Initialize the Leaflet Map
function initMap() {
    applyTheme(); // Apply theme on load

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
}

// Function to toggle theme
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const currentTheme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
    localStorage.setItem('theme', currentTheme);
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
                    }
                }).addTo(map);
                geoJsonLayers.push(geoJsonLayer);

                if (typeof walk.distance === 'number') {
                    totalDistanceKm += walk.distance;
                }
            }
        });

        // Update stats
        document.getElementById('totalWalks').textContent = walks.length;
        document.getElementById('totalDistance').textContent = totalDistanceKm.toFixed(2) + ' км'; // Format to 2 decimal places

        // Optionally, zoom map to fit all features
//        if (geoJsonLayers.length > 0) {
//            const group = new L.featureGroup(geoJsonLayers);
//            map.fitBounds(group.getBounds());
//        }

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
        const response = await fetch('/upload', {
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


document.querySelectorAll('.stat-card').forEach(card => {
    card.addEventListener('mousemove', function(e) {
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left; // x position within the element
        const y = e.clientY - rect.top;  // y position within the element

        // Update the position of the gradient
        this.style.setProperty('--mouse-x', `${x}px`);
        this.style.setProperty('--mouse-y', `${y}px`);
    });
});

document.addEventListener('DOMContentLoaded', initMap);