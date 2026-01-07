import { getSavedTheme, setTheme } from './theme.js';

function setThemeIcon(theme) {
  const themeIcon = document.getElementById('themeIcon');
  if (!themeIcon) return;

  if (theme === 'dark') {
    themeIcon.src =
      'https://img.icons8.com/external-glyph-silhouettes-icons-papa-vector/78/external-Light-Mode-interface-glyph-silhouettes-icons-papa-vector.png';
    themeIcon.alt = 'Switch to light mode';
  } else {
    themeIcon.src = 'https://img.icons8.com/ios-filled/50/do-not-disturb-2.png';
    themeIcon.alt = 'Switch to dark mode';
  }
}

function updateIconColor() {
  const themeIcon = document.getElementById('themeIcon');
  if (!themeIcon) return;

  const isScrolled = window.scrollY > 30;

  if (document.body.classList.contains('dark-mode')) {
    if (isScrolled) {
      themeIcon.style.filter =
        'invert(100%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(100%) contrast(100%)';
    } else {
      themeIcon.style.filter =
        'invert(67%) sepia(98%) saturate(354%) hue-rotate(51deg) brightness(97%) contrast(101%)';
    }
  } else {
    themeIcon.style.filter =
      'invert(0%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(0%) contrast(100%)';
  }
}

function handleStickyHeader() {
  const stickyHeader = document.getElementById('sticky-header-container');
  if (!stickyHeader) return;

  if (window.scrollY > 30) {
    stickyHeader.classList.add('scrolled');
  } else {
    stickyHeader.classList.remove('scrolled');
  }

  updateIconColor();
}

function applyThemeWithIcon(defaultTheme = 'dark') {
  const savedTheme = getSavedTheme();
  const theme = savedTheme ?? defaultTheme;

  setTheme(theme);
  setThemeIcon(theme);
  updateIconColor();
}

function toggleTheme(defaultTheme = 'dark') {
  const themeIcon = document.getElementById('themeIcon');
  if (themeIcon) themeIcon.classList.add('hide-icon');

  const currentTheme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
  const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';

  setTimeout(() => {
    setTheme(nextTheme);
    setThemeIcon(nextTheme);

    if (themeIcon) themeIcon.classList.remove('hide-icon');

    updateIconColor();

    const themeSwitchSound = document.getElementById('themeSwitchSound');
    if (themeSwitchSound) {
      try {
        themeSwitchSound.currentTime = 0;
        themeSwitchSound.play().catch(() => {});
      } catch {}
    }
  }, 200);
}

export function initPublicHeader({ defaultTheme = 'dark' } = {}) {
  applyThemeWithIcon(defaultTheme);

  document.getElementById('themeToggle')?.addEventListener('click', () => toggleTheme(defaultTheme));

  window.addEventListener('scroll', handleStickyHeader);
  handleStickyHeader();
}
