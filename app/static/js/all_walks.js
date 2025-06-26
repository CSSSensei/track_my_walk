// app/static/js/all_walks.js
document.addEventListener('DOMContentLoaded', initAllWalksPage);

function applyTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode')    ;
    } else {
        document.body.classList.remove('dark-mode');
    }
}

function initAllWalksPage() {
    applyTheme(); // Apply theme on load
    fetchAllWalksAndDisplay();
}

async function fetchAllWalksAndDisplay() {
    try {
        const response = await fetch('/walks'); // Fetch all walks (already sorted by date DESC)
        const walks = await response.json();
        const allWalksContainer = document.getElementById('all-walks-grid');
        allWalksContainer.innerHTML = ''; // Clear previous content

        if (walks.length === 0) {
            allWalksContainer.innerHTML = '<p>Пока нет записанных прогулок.</p>';
            return;
        }

        walks.forEach(walk => {
            const walkCard = document.createElement('div');
            walkCard.classList.add('all-walk-card');
            walkCard.dataset.walkId = walk.id; // Store walk ID for navigation

            const walkDate = new Date(walk.date * 1000).toLocaleDateString('ru-RU'); // Convert timestamp to date string

            walkCard.innerHTML = `
                <h4>${walk.name || 'Без названия'}</h4>
                <p>${walkDate} — ${walk.distance.toFixed(2)} км</p>
                ${walk.description ? `<p>${walk.description.substring(0, 100)}...</p>` : ''}
            `;
            walkCard.addEventListener('click', () => {
                window.location.href = `/walk/${walk.id}`; // Navigate to single walk page
            });
            allWalksContainer.appendChild(walkCard);
        });

    } catch (error) {
        console.error('Error fetching all walks:', error);
        document.getElementById('all-walks-grid').innerHTML = '<p>Не удалось загрузить прогулки. Пожалуйста, попробуйте позже.</p>';
    }
}
