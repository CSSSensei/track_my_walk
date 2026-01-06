export function setupSecretClick({
  elementId = 'copyrightText',
  requiredClicks = 3,
  timeoutMs = 500,
  onTrigger,
} = {}) {
  const el = document.getElementById(elementId);
  if (!el || typeof onTrigger !== 'function') return;

  let clickCount = 0;
  let clickTimeout;

  el.addEventListener('click', () => {
    clickCount += 1;
    clearTimeout(clickTimeout);

    clickTimeout = window.setTimeout(() => {
      clickCount = 0;
    }, timeoutMs);

    if (clickCount === requiredClicks) {
      clickCount = 0;
      clearTimeout(clickTimeout);
      onTrigger();
    }
  });
}
