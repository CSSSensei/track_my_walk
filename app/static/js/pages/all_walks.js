import { applySavedTheme } from '../common/theme.js';

let allWalks = [];
let currentSort = 'date_desc';

function initAllWalksPage() {
  applySavedTheme();
  setupSortButtons();
  fetchAllWalksAndDisplay();
}

function setupSortButtons() {
  const dropdownBtn = document.getElementById('sort-dropdown-btn');
  const dropdownContent = document.getElementById('sort-dropdown-content');
  const selectedText = document.getElementById('sort-selected-text');
  if (!dropdownBtn || !dropdownContent || !selectedText) return;

  const sortArrow = dropdownBtn.querySelector('.sort-arrow');

  dropdownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownContent.classList.toggle('show');
    if (sortArrow) sortArrow.textContent = dropdownContent.classList.contains('show') ? '↑' : '↓';
  });

  document.querySelectorAll('.sort-option').forEach((option) => {
    option.addEventListener('click', () => {
      currentSort = option.dataset.sort;
      selectedText.textContent = option.textContent;
      dropdownContent.classList.remove('show');
      if (sortArrow) sortArrow.textContent = '↓';
      sortAndDisplayWalks();
    });
  });

  document.addEventListener('click', () => {
    dropdownContent.classList.remove('show');
    if (sortArrow) sortArrow.textContent = '↓';
  });
}

function sortAndDisplayWalks() {
  if (allWalks.length === 0) return;

  const sortedWalks = [...allWalks];

  switch (currentSort) {
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
  if (!allWalksContainer) return;

  allWalksContainer.innerHTML = '';

  walks.forEach((walk) => {
    const walkCard = document.createElement('div');
    walkCard.classList.add('all-walk-card');
    walkCard.dataset.walkId = walk.id;

    const walkDate = new Date(walk.date * 1000).toLocaleDateString('ru-RU');

    let descriptionHTML = '';
    if (walk.description) {
      descriptionHTML =
        walk.description.length > 100
          ? `<p>${walk.description.substring(0, 100)}...</p>`
          : `<p>${walk.description}</p>`;
    }

    walkCard.innerHTML = `
      <h4>${walk.name || 'Без названия'}</h4>
      <p>${walkDate} — ${walk.distance.toFixed(2)} км</p>
      ${descriptionHTML}
    `;

    walkCard.addEventListener('click', () => {
      window.location.href = `/walk/${walk.id}`;
    });

    allWalksContainer.appendChild(walkCard);
  });
}

async function fetchAllWalksAndDisplay() {
  const allWalksContainer = document.getElementById('all-walks-grid');

  try {
    const response = await fetch('/walks');
    allWalks = await response.json();
    sortAndDisplayWalks();
  } catch (error) {
    console.error('Error fetching all walks:', error);
    if (allWalksContainer) {
      allWalksContainer.innerHTML =
        '<p>Не удалось загрузить прогулки. Пожалуйста, попробуйте позже.</p>';
    }
  }
}

document.addEventListener('DOMContentLoaded', initAllWalksPage);
