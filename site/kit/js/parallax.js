(() => {
  const progress = document.getElementById('readingProgress');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const deck = document.documentElement.classList.contains('deck');
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

  /* ─── РЕЖИМ ПРЕЗЕНТАЦИИ: СЧИТАЕМ ОТ СЛАЙДА, А НЕ ОТ ЭЛЕМЕНТА ──────────────
     В книге страница едет лентой, и «расстояние элемента до середины экрана» — честная
     мера. В презентации со прилипанием это НЕ ТАК, и разница принципиальная: у слайда,
     стоящего на своём месте, заголовок находится у верхней кромки, то есть далеко от
     середины экрана — и получал бы постоянный сдвиг. Композиция каждого слайда съезжала
     бы В ПОКОЕ, а её тут подбирали по высоте до пикселя (первый экран умещается в 899
     при окне 900 — см. components.css).
     Поэтому мерой служит смещение САМОГО СЛАЙДА от центра экрана: у прилипшего слайда
     оно равно нулю, значит все его элементы стоят ровно там, где сверстаны, а расходятся
     слоями только во время перелистывания. Ровно тогда параллакс и нужен.

     ЗНАК РАЗНЫЙ, И ЭТО ГЛАВНОЕ В ОЩУЩЕНИИ ГЛУБИНЫ. Минус — слой едет МЕДЛЕННЕЕ страницы
     (так ведёт себя далёкий фон), плюс — БЫСТРЕЕ (так ведёт себя предмет у самого носа).
     Если у всех слоёв один знак, разница читается как «текст немного пружинит». */
  const DECK_TAGS = [
    /* Заголовочный блок разбираем по строкам: надзаголовок, мысль, пояснение уезжают с
       разной скоростью, и текст перестаёт быть монолитом. */
    { sel: '.slide-head > .overline', amount: 0.045, cap: 40 },
    { sel: '.slide-head > h2',        amount: 0.075, cap: 60 },
    { sel: '.slide-head > p',         amount: 0.105, cap: 74 },
    /* Содержательные блоки — плотнее и «ближе» к зрителю, чем заголовок */
    { sel: '.slide-shell > p, .slide-note, .stats-grid, .concept-cards, .offer-card, '
         + '.metric-rows, .compare, .collection-diagram, .stages__panel, .steps, .cards',
      amount: 0.13, cap: 84 },
    /* Отдельные кадры и ролики: сильнее всего, но не больше трети экрана */
    { sel: '.split-media img, .split-media video, .split-media figure', amount: 0.19, cap: 130 },
    /* Персонаж в углу — передний план: едет БЫСТРЕЕ содержания, отсюда объём */
    { sel: '.corner-hero', amount: -0.12, cap: 96 }
  ];
  /* Куда параллакс не суём: у этих блоков СВОЙ transform, и два правила на одно свойство
     гасят друг друга. Галерея — трек на трансформации, стопка экранов — наклон за
     курсором, сцена сборок — своё центрирование, стена вывесок и полоса — свой сдвиг. */
  const SKIP = '[data-gallery-track], .gallery, .phone-deck, .stages__stage, .signwall, '
             + '.strip-wrap, .crossfade, .vctl';

  if (deck) {
    DECK_TAGS.forEach(({ sel, amount, cap }) => {
      document.querySelectorAll(sel).forEach((el) => {
        if (el.dataset.parallax || el.closest(SKIP)) return;
        el.dataset.parallax = String(amount);
        el.dataset.parallaxCap = String(cap);
        /* Плавность своя и КОРОТКАЯ. У .reveal переход на transform длится 0.9 с — с ним
           слой тянется за прокруткой как на резинке. Переход переписываем ПОЛНОСТЬЮ:
           короткая запись про один transform снесла бы у .reveal проявление и размытие. */
        el.classList.add('parallax-deck');
      });
    });
  }

  const parallaxItems = [...document.querySelectorAll('[data-parallax]')];

  const update = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? Math.min(1, window.scrollY / max) : 0;
    if (progress) progress.style.width = `${ratio * 100}%`;

    if (!reduced) {
      parallaxItems.forEach((item) => {
        const rect = item.getBoundingClientRect();
        if (rect.bottom < -100 || rect.top > window.innerHeight + 100) return;
        const own = Number(item.dataset.parallax || 0);
        let raw, limit;
        if (deck) {
          /* Мера — смещение слайда, а не элемента: у прилипшего слайда сдвиг ровно ноль */
          const host = item.closest('.slide') || item.closest('section') || item;
          const hr = host.getBoundingClientRect();
          raw = (hr.top + hr.height / 2 - window.innerHeight / 2) * -own;
          limit = Number(item.dataset.parallaxCap || 90);
        } else {
          // У текстовых слоёв первого экрана и вступления коэффициент уже подобран под их
          // строки — усиливать их нельзя: они разъезжаются и НАЕЗЖАЮТ ДРУГ НА ДРУГА,
          // пока прокрутка не дошла до места. Усиление — только для картинок.
          const amount = item.closest('.hero, .opening-statement') ? own : own * STRONG;
          raw = (rect.top + rect.height / 2 - window.innerHeight / 2) * -amount;
          // И всё равно с ограничителем: на длинной странице сдвиг иначе уходит в сотни
          // пикселей и любая вёрстка рано или поздно сталкивается сама с собой. Предел
          // согласован с отступом сверху у полноэкранных кадров (см. components.css):
          // сдвиг не должен съедать весь воздух до заголовка.
          limit = 95;
        }
        const offset = Math.max(-limit, Math.min(limit, raw));
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
