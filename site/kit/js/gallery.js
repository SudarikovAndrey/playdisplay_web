/* ПОЛНОЭКРАННАЯ ГАЛЕРЕЯ: один экран, листание стрелками, точками и пальцем.
 *
 * Зачем блок: рассказ из пяти кадров не обязан занимать пять экранов прокрутки. В
 * презентации это отдельная остановка — «посмотрите, что это за игра» — и человек листает
 * её сам, в своём темпе, не теряя места в документе.
 *
 * ЛЕНТА ДВИЖЕТСЯ ШТАТНОЙ ПРОКРУТКОЙ, а не transform: так бесплатно работают палец на
 * телефоне, тачпад, колесо с Shift и клавиши, а браузер сам доводит кадр до места
 * (scroll-snap). Своя реализация «перелистывания» неизбежно теряет один из этих способов.
 *
 * Что здесь важно и проверено:
 *  • Точки и стрелки СЛЕДЯТ за прокруткой, а не наоборот: если человек листает пальцем,
 *    подсветка обязана переехать сама.
 *  • Клавиши работают, только когда галерея в кадре: иначе стрелки крадут управление у
 *    страницы, и документ перестаёт листаться с клавиатуры.
 *  • Обработчик прокрутки пассивный и через requestAnimationFrame: без этого на длинной
 *    ленте подсветка дёргается.
 */
(function () {
  'use strict';

  function setup(root) {
    var track = root.querySelector('[data-gallery-track]');
    var items = track ? track.children : null;
    if (!track || !items || !items.length) return;

    var dotsHost = root.querySelector('[data-gallery-dots]');
    var prev = root.querySelector('[data-gallery-prev]');
    var next = root.querySelector('[data-gallery-next]');
    var counter = root.querySelector('[data-gallery-counter]');
    var dots = [];
    var index = 0;

    if (dotsHost) {
      for (var i = 0; i < items.length; i++) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'gallery__dot';
        b.setAttribute('aria-label', 'Кадр ' + (i + 1));
        (function (n) { b.addEventListener('click', function () { go(n); }); })(i);
        dotsHost.appendChild(b);
        dots.push(b);
      }
    }

    /* ЛИСТАЕМ СВОИМ ЦИКЛОМ, А НЕ behavior: 'smooth'.
       Штатная плавная прокрутка внутри этой ленты не работает: страница сама живёт в
       режиме слайдов с прилипанием, и её механика гасит вложенную плавную прокрутку –
       замер показывал scrollLeft = 0 после нажатия на стрелку. Свой цикл с мгновенными
       шагами доезжает всегда и заодно даёт одинаковую скорость во всех браузерах.
       Цель считаем как «номер × ширина кадра»: offsetLeft отсчитывается от ближайшего
       позиционированного предка (это сама галерея, а не лента) и после первой прокрутки
       показывает положение кадра НА ЭКРАНЕ, а не в ленте. */
    var anim = null;
    function go(n) {
      n = Math.max(0, Math.min(items.length - 1, n));
      var from = track.scrollLeft;
      var to = n * track.clientWidth;
      if (Math.abs(to - from) < 1) return;
      if (anim) cancelAnimationFrame(anim);
      /* ПРИЛИПАНИЕ НА ВРЕМЯ ХОДА СНИМАЕМ. Без этого браузер сам подтягивает ленту к
         ближайшему кадру, и наша плавная дорожка обрывается рывком в самом конце —
         именно это читалось как «галерея листается резко». */
      track.classList.add('is-animating');
      var t0 = performance.now(), dur = 460;
      (function step(now) {
        var k = Math.min(1, (now - t0) / dur);
        /* Выезд с торможением: кадр стартует живо и мягко встаёт на место. Симметричная
           кривая на ходу в один экран читается вяло в начале и всё равно резко в конце. */
        var e = 1 - Math.pow(1 - k, 3);
        track.scrollLeft = from + (to - from) * e;
        if (k < 1) anim = requestAnimationFrame(step);
        else { anim = null; track.classList.remove('is-animating'); }
      })(t0);
    }

    function paint() {
      /* Текущий кадр считаем ПО ПОЛОЖЕНИЮ ЛЕНТЫ, а не по счётчику нажатий: палец и
         тачпад двигают ленту мимо наших кнопок, и счётчик разошёлся бы с картинкой. */
      var w = track.clientWidth || 1;
      var n = Math.round(track.scrollLeft / w);
      if (n === index) return;
      index = n;
      for (var i = 0; i < dots.length; i++) dots[i].setAttribute('aria-current', i === index ? 'true' : 'false');
      if (counter) counter.textContent = ('0' + (index + 1)).slice(-2) + ' / ' + ('0' + items.length).slice(-2);
      if (prev) prev.disabled = index === 0;
      if (next) next.disabled = index === items.length - 1;
    }

    var ticking = false;
    track.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; paint(); });
    }, { passive: true });

    if (prev) prev.addEventListener('click', function () { go(index - 1); });
    if (next) next.addEventListener('click', function () { go(index + 1); });

    /* Клавиши — только пока галерея на экране: иначе она перехватывает стрелки у
       страницы, и по документу становится нельзя ходить с клавиатуры. */
    var visible = false;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting && es[0].intersectionRatio > 0.55;
      }, { threshold: [0, 0.55, 1] }).observe(root);
    }
    addEventListener('keydown', function (e) {
      if (!visible) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
    });

    // первичная отрисовка состояния
    index = -1;
    paint();
  }

  function init(scope) {
    var list = (scope || document).querySelectorAll('[data-gallery]');
    for (var i = 0; i < list.length; i++) setup(list[i]);
  }

  window.kitGallery = init;          // страницы, где галерея приходит позже, зовут сами
  if (document.readyState !== 'loading') init(document);
  else addEventListener('DOMContentLoaded', function () { init(document); });
})();
