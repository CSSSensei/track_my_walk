(() => {
  'use strict';

  const qs = (selector, root = document) => root.querySelector(selector);

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (c) => {
      switch (c) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        case "'":
          return '&#39;';
        default:
          return c;
      }
    });
  }

  function showToast(message, type = 'info', duration = 3000) {
    const toast = qs('#toastMessage');
    if (!toast) return;

    toast.textContent = message;
    toast.className = `toast-message visible ${type}`;

    if (toast._timeoutId) {
      clearTimeout(toast._timeoutId);
    }

    toast._timeoutId = setTimeout(() => {
      toast.classList.remove('visible');
    }, duration);
  }

  function formatWalkDate(unixSeconds) {
    if (!unixSeconds) return '';
    const date = new Date(unixSeconds * 1000);
    return date.toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  async function fetchWalks() {
    try {
      const response = await fetch('/walks', {
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const walks = await response.json();
      renderWalksTable(Array.isArray(walks) ? walks : []);
    } catch (error) {
      console.error('Error fetching walks:', error);
      showToast('Не удалось загрузить список прогулок.', 'error');
    }
  }

  async function deleteWalk(walkId) {
    if (!walkId) return;

    if (!confirm('Вы уверены, что хотите удалить эту прогулку?')) {
      return;
    }

    try {
      const response = await fetch(`/admin/walks/${walkId}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || payload.message || `HTTP ${response.status}`);
      }

      showToast('Прогулка успешно удалена.', 'success');
      await fetchWalks();
    } catch (error) {
      console.error('Error deleting walk:', error);
      showToast(`Ошибка при удалении прогулки: ${error.message}`, 'error');
    }
  }

  function renderWalksTable(walks) {
    const tableBody = qs('#walksTable tbody');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    if (walks.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="5">Прогулок пока нет.</td></tr>';
      return;
    }

    for (const walk of walks) {
      const row = document.createElement('tr');

      row.innerHTML = `
        <td>${escapeHtml(walk.id ?? '')}</td>
        <td>${escapeHtml(walk.name ?? '')}</td>
        <td>${escapeHtml(formatWalkDate(walk.date))}</td>
        <td>${Number(walk.distance ?? 0).toFixed(2)}</td>
        <td class="walk-actions"></td>
      `;

      const actionsCell = row.querySelector('.walk-actions');

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.textContent = 'Редактировать';
      editBtn.className = 'edit-button';
      editBtn.addEventListener('click', () => {
        window.location.href = `/admin/edit-walk/${walk.id}`;
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.textContent = 'Удалить';
      deleteBtn.className = 'control-button-group button';
      deleteBtn.style.marginLeft = '10px';
      deleteBtn.addEventListener('click', () => deleteWalk(walk.id));

      if (actionsCell) {
        actionsCell.append(editBtn, deleteBtn);
      }

      tableBody.appendChild(row);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const addWalkBtn = qs('#addWalkBtn');
    if (addWalkBtn) {
      addWalkBtn.addEventListener('click', () => {
        window.location.href = '/admin/';
      });
    }

    const refreshWalksBtn = qs('#refreshWalksBtn');
    if (refreshWalksBtn) {
      refreshWalksBtn.addEventListener('click', fetchWalks);
    }

    fetchWalks();
  });
})();
