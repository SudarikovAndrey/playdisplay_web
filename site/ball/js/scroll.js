(() => {
  const progress = document.getElementById('readingProgress');
  const parallaxItems = [...document.querySelectorAll('[data-parallax]')];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let ticking = false;

  const update = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? Math.min(1, window.scrollY / max) : 0;
    if (progress) progress.style.width = `${ratio * 100}%`;

    if (!reduced) {
      parallaxItems.forEach((item) => {
        const rect = item.getBoundingClientRect();
        if (rect.bottom < -100 || rect.top > window.innerHeight + 100) return;
        const amount = Number(item.dataset.parallax || 0);
        const offset = (rect.top + rect.height / 2 - window.innerHeight / 2) * -amount;
        item.style.setProperty('--parallax-y', `${offset.toFixed(1)}px`);
      });
    }
    ticking = false;
  };

  const requestUpdate = () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  };

  addEventListener('scroll', requestUpdate, { passive: true });
  addEventListener('resize', requestUpdate);
  requestUpdate();
})();
