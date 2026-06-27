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

  themeIcon.style.filter = 'brightness(0) invert(1)';
}

function handleStickyHeader() {
  const stickyHeader = document.getElementById('sticky-header-container');
  if (!stickyHeader) return;

  const startup = document.querySelector('.startup_container');

  if (startup) {
    const passedStartup = startup.getBoundingClientRect().bottom <= 80;
    stickyHeader.classList.toggle('revealed', passedStartup);
    stickyHeader.classList.toggle('scrolled', passedStartup);
  } else {
    stickyHeader.classList.add('revealed');
    stickyHeader.classList.toggle('scrolled', window.scrollY > 30);
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

  const currentTheme = document.documentElement.classList.contains('dark-mode') ? 'dark' : 'light';
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

  const siteTitleLink = document.querySelector('.site-title a');
  const isIndexPage = document.getElementById('stats-section');
  if (siteTitleLink && isIndexPage) {
    siteTitleLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  window.addEventListener('scroll', handleStickyHeader);
  handleStickyHeader();
}
