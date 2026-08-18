/* ДВА КАДРА НА ОДНОМ МЕСТЕ: медленная смена по кругу.
 *
 * Зачем: у некоторых доводов один кадр не показывает всего. Вторая картинка на том же
 * месте, приходящая сама, добавляет второй смысл, но не отнимает ни экрана, ни клика.
 *
 * Что важно и проверено:
 *  • СМЕНА ИДЁТ ТОЛЬКО ПОКА КАДР В ВИДУ. Таймер, работающий на всех слайдах сразу,
 *    заставляет браузер держать в памяти и перерисовывать то, чего никто не видит;
 *    в презентации на двадцать экранов это заметно по вентилятору.
 *  • ПЕРЕХОД ДОЛГИЙ, А ПАУЗА КОРОТКАЯ. Быстрый кроссфейд между двумя пейзажами читается
 *    как рывок или ошибка загрузки; медленный — как дыхание кадра.
 *  • При выключенной анимации (prefers-reduced-motion) смена не идёт вовсе: показывается
 *    первый кадр.
 */
(function () {
  'use strict';

  function setup(root) {
    var shots = root.querySelectorAll('[data-fade-shot]');
    if (shots.length < 2) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var hold = Number(root.getAttribute('data-fade-hold')) || 3000;
    var i = 0, timer = null;

    function step() {
      i = (i + 1) % shots.length;
      for (var n = 0; n < shots.length; n++) shots[n].classList.toggle('is-on', n === i);
      /* Кадр подставляем в момент показа: до этого он не нужен, а грузить оба сразу
         значит удвоить вес слайда, до которого могут не дойти. */
      var next = shots[(i + 1) % shots.length];
      var src = next.getAttribute('data-src');
      if (src && !next.getAttribute('src')) next.setAttribute('src', src);
    }

    function start() { if (!timer) timer = setInterval(step, hold); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        (es[0].isIntersecting && es[0].intersectionRatio > 0.35) ? start() : stop();
      }, { threshold: [0, 0.35, 1] }).observe(root);
    } else {
      start();
    }
  }

  function init(scope) {
    var list = (scope || document).querySelectorAll('[data-fade]');
    for (var i = 0; i < list.length; i++) setup(list[i]);
  }

  window.kitCrossfade = init;
  if (document.readyState !== 'loading') init(document);
  else addEventListener('DOMContentLoaded', function () { init(document); });
})();
