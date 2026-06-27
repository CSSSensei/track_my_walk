(function () {
  const stars = Array.prototype.slice.call(
    document.querySelectorAll('.site-background .bg-star')
  );
  if (!stars.length) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const depths = stars.map((s) => parseFloat(s.dataset.depth) || 0.3);
  let sy = window.scrollY || 0, raf = null;

  function render() {
    raf = null;
    for (let i = 0; i < stars.length; i++) {
      const ty = -sy * depths[i] * 0.25;
      stars[i].style.transform = 'translate3d(0, ' + ty.toFixed(1) + 'px, 0)';
    }
  }

  function schedule() {
    if (raf === null) raf = window.requestAnimationFrame(render);
  }

  window.addEventListener('scroll', function () {
    sy = window.scrollY || 0;
    schedule();
  }, { passive: true });

  render();
})();
