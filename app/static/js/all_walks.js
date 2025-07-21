// app/static/js/all_walks.js
document.addEventListener('DOMContentLoaded', initAllWalksPage);
let allWalks = [];
let currentSort = 'date_desc';

function applyTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode')    ;
    } else {
        document.body.classList.remove('dark-mode');
    }
}

function initAllWalksPage() {
    applyTheme();
    setupSortButtons();
    fetchAllWalksAndDisplay();
}

function setupSortButtons() {
    const dropdownBtn = document.getElementById('sort-dropdown-btn');
    const dropdownContent = document.getElementById('sort-dropdown-content');
    const selectedText = document.getElementById('sort-selected-text');
    const sortArrow = dropdownBtn.querySelector('.sort-arrow');

    dropdownBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        dropdownContent.classList.toggle('show');
        sortArrow.textContent = dropdownContent.classList.contains('show') ? '↑' : '↓';
    });

    document.querySelectorAll('.sort-option').forEach(option => {
        option.addEventListener('click', function() {
            currentSort = this.dataset.sort;
            selectedText.textContent = this.textContent;
            dropdownContent.classList.remove('show');
            sortArrow.textContent = '↓';
            sortAndDisplayWalks();
        });
    });

    document.addEventListener('click', function() {
        dropdownContent.classList.remove('show');
        sortArrow.textContent = '↓';
    });
}

function sortAndDisplayWalks() {
    if (allWalks.length === 0) return;

    const sortedWalks = [...allWalks];

    switch(currentSort) {
        case 'date_asc':
            sortedWalks.sort((a, b) => a.date - b.date);
            break;
        case 'distance_asc':
            sortedWalks.sort((a, b) => a.distance - b.distance);
            break;
        case 'distance_desc':
            sortedWalks.sort((a, b) => b.distance - a.distance);
            break;
        case 'date_desc':
        default:
            sortedWalks.sort((a, b) => b.date - a.date);
    }

    displayWalks(sortedWalks);
}

function displayWalks(walks) {
    const allWalksContainer = document.getElementById('all-walks-grid');
    allWalksContainer.innerHTML = '';

    walks.forEach(walk => {
        const walkCard = document.createElement('div');
        walkCard.classList.add('all-walk-card');
        walkCard.dataset.walkId = walk.id;

        const walkDate = new Date(walk.date * 1000).toLocaleDateString('ru-RU');

        walkCard.innerHTML = `
            <h4>${walk.name || 'Без названия'}</h4>
            <p>${walkDate} — ${walk.distance.toFixed(2)} км</p>
            ${walk.description ? `<p>${walk.description.substring(0, 100)}...</p>` : ''}
        `;

        walkCard.addEventListener('click', () => {
            window.location.href = `/walk/${walk.id}`;
        });

        allWalksContainer.appendChild(walkCard);
    });
}

async function fetchAllWalksAndDisplay() {
    try {
        const response = await fetch('/walks');
        allWalks = await response.json();
        sortAndDisplayWalks();
    } catch (error) {
        console.error('Error fetching all walks:', error);
        document.getElementById('all-walks-grid').innerHTML = '<p>Не удалось загрузить прогулки. Пожалуйста, попробуйте позже.</p>';
    }
}
