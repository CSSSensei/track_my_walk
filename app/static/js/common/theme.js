const STORAGE_KEY = 'theme';

export function getSavedTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === 'dark' || saved === 'light' ? saved : null;
}

export function setTheme(theme) {
  localStorage.setItem(STORAGE_KEY, theme);
  document.body.classList.toggle('dark-mode', theme === 'dark');
}

export function applySavedTheme(defaultTheme = 'dark') {
  const saved = getSavedTheme();
  setTheme(saved ?? defaultTheme);
}
