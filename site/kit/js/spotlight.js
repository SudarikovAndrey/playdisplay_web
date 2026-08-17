/* КУРСОР ОСВЕЩАЕТ КАДР.
 *
 * Зачем: у кадров галереи есть затемнение — оно нужно, чтобы читались подписи, но кадр от
 * него глохнет. Пятно света под курсором возвращает кадру глубину и превращает затемнение
 * из потери в приём: человек сам «наводит фонарь» и разглядывает картинку.
 *
 * КАК СДЕЛАНО, И ПОЧЕМУ НЕ НАКЛАДКОЙ. Осветлять белой полупрозрачной накладкой нельзя:
 * она поднимает и тени, кадр становится молочным, а вместе с ним выцветают подписи.
 * Здесь лежит ВТОРАЯ КОПИЯ кадра, осветлённая фильтром, и она проявляется сквозь маску
 * радиальным градиентом под курсором. Тени в осветлённой копии остаются тенями, а свет
 * фар и блики разгораются сами — потому что у ярких пикселей запас яркости больше.
 * Тот же приём, что у рентгена купола в книге «Музей Мяча»: слой в полный размер с тем же
 * object-fit, чтобы совпасть с базой пиксель в пиксель при любых пропорциях окна.
 *
 * СИЛА РАСТЁТ К ЦЕНТРУ КАДРА. Просили именно так: в центре, где светят фары, эффект должен
 * работать активнее. Считается доля расстояния от центра до края, поэтому у краёв, где идут
 * подписи и стрелки, свет почти не мешает.
 *
 * Маска — радиальный градиент, а не clip-path: у clip-path край всегда резкий.
 */
(function () {
  'use strict';

  var fine = matchMedia('(pointer: fine)').matches;
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setup(host) {
    var base = host.querySelector('img, video');
    if (!base) return;

    /* Копию кадра создаём скриптом, а не держим в разметке: она — часть механики, а не
       содержания, и дублировать <img> руками у каждого кадра значит однажды забыть
       поправить object-position в одном из двух мест. */
    var lit = document.createElement('img');
    lit.className = 'gallery__lit';
    lit.setAttribute('aria-hidden', 'true');
    lit.alt = '';
    lit.src = base.currentSrc || base.src;
    /* Точка обрезки должна совпадать с базовой до пикселя, иначе освещённый слой «плывёт»
       относительно кадра. Берём вычисленное значение, а не атрибут: у кадров оно задано
       инлайном и может быть любым. */
    lit.style.objectPosition = getComputedStyle(base).objectPosition;
    host.insertBefore(lit, base.nextSibling);

    var raf = null, mx = 50, my = 50, k = 0;

    function draw() {
      raf = null;
      host.style.setProperty('--mx', mx.toFixed(2) + '%');
      host.style.setProperty('--my', my.toFixed(2) + '%');
      host.style.setProperty('--lit-k', k.toFixed(3));
    }
    function schedule() { if (!raf) raf = requestAnimationFrame(draw); }

    host.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      var r = host.getBoundingClientRect();
      mx = ((e.clientX - r.left) / r.width) * 100;
      my = ((e.clientY - r.top) / r.height) * 100;
      // Доля расстояния до центра: 1 в центре, 0 у угла
      var dx = (mx - 50) / 50, dy = (my - 50) / 50;
      var d = Math.min(1, Math.sqrt(dx * dx + dy * dy) / Math.SQRT2);
      k = 0.35 + 0.65 * (1 - d) * (1 - d);      // к центру сила растёт быстрее, чем линейно
      schedule();
    });
    host.addEventListener('pointerleave', function () { k = 0; schedule(); });
  }

  function init(scope) {
    if (!fine || reduced) return;      // без курсора и при выключенной анимации света нет
    var list = (scope || document).querySelectorAll('[data-spotlight]');
    for (var i = 0; i < list.length; i++) setup(list[i]);
  }

  window.kitSpotlight = init;
  if (document.readyState !== 'loading') init(document);
  else addEventListener('DOMContentLoaded', function () { init(document); });
})();
