(() => {
  const progress = document.getElementById('readingProgress');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let ticking = false;

  /* ПАРАЛЛАКС КАРТИНОК СИЛЬНЕЕ, И ЕГО ТЕПЕРЬ ПОЛУЧАЮТ ВСЕ КАРТИНКИ.
     Атрибут data-parallax стоял ровно у трёх иллюстраций из двенадцати, и значения были
     0.025-0.045 — сдвиг на десяток пикселей за целый экран прокрутки, то есть эффекта
     не видно вовсе. Множитель поднят, а рамкам без атрибута он проставляется здесь же:
     держать это в разметке значило бы дописывать атрибут к каждой новой картинке. */
  const STRONG = 2.8, DEFAULT = 0.05;
  document.querySelectorAll('.art-frame, .content-art, .diagram').forEach((el) => {
    if (!el.dataset.parallax) el.dataset.parallax = String(DEFAULT);
  });
  const parallaxItems = [...document.querySelectorAll('[data-parallax]')];

  const update = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? Math.min(1, window.scrollY / max) : 0;
    if (progress) progress.style.width = `${ratio * 100}%`;

    if (!reduced) {
      parallaxItems.forEach((item) => {
        const rect = item.getBoundingClientRect();
        if (rect.bottom < -100 || rect.top > window.innerHeight + 100) return;
        // У текстовых слоёв первого экрана и вступления коэффициент уже подобран под их
        // строки — усиливать их нельзя: они разъезжаются и НАЕЗЖАЮТ ДРУГ НА ДРУГА,
        // пока прокрутка не дошла до места. Усиление — только для картинок.
        const own = Number(item.dataset.parallax || 0);
        const amount = item.closest('.hero, .opening-statement') ? own : own * STRONG;
        const raw = (rect.top + rect.height / 2 - window.innerHeight / 2) * -amount;
        // И всё равно с ограничителем: на длинной странице сдвиг иначе уходит в сотни
        // пикселей и любая вёрстка рано или поздно сталкивается сама с собой. Предел
        // согласован с отступом сверху у полноэкранных кадров (см. components.css):
        // сдвиг не должен съедать весь воздух до заголовка.
        const offset = Math.max(-95, Math.min(95, raw));
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
