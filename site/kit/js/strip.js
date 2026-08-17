/* ГОРИЗОНТАЛЬНАЯ ЛЕНТА: стрелки и вылет за колонку.
 *
 * Зачем: лента карточек (отзывы, кадры, что угодно) листается пальцем и тачпадом сама,
 * но на компьютере с мышью человек не догадывается, что её можно двигать – колесо крутит
 * страницу, а не ленту. Стрелки делают возможность видимой.
 *
 * Два дела, оба требуют замера, поэтому живут в скрипте, а не в стилях:
 *
 *  1. ЛИСТАНИЕ. Прокрутка внутри ленты идёт СВОИМ ЦИКЛОМ, а не behavior: 'smooth'.
 *     Причина та же, что у полноэкранной галереи: страница в режиме слайдов гасит
 *     вложенную плавную прокрутку, и лента остаётся на месте.
 *
 *  2. ВЫЛЕТ ВПРАВО. Лента должна уходить за край экрана, а не обрываться по краю
 *     текстовой колонки – так видно, что карточек больше, чем видно. В чистом CSS это
 *     не считается: колонка не центрирована в окне (слева боковая полоса разделов,
 *     она сдвигает всю колонку), поэтому приёмы вида calc(50% - 50vw) дают промах на
 *     половину полосы и заодно растягивают документ по горизонтали.
 *     Замеряем расстояние от правого края РОДИТЕЛЯ до края окна и отдаём его в CSS
 *     переменной --bleed. Родитель, а не сама лента: отрицательное поле у ребёнка
 *     не меняет коробку родителя, и замер не начинает гоняться за собственным
 *     результатом.
 */
(function () {
  'use strict';

  function setup(strip) {
    var host = strip.parentNode;
    var bar = document.querySelector('[data-strip-nav="' + (strip.getAttribute('data-strip') || '') + '"]')
           || strip.parentNode.querySelector('[data-strip-nav]');
    var prev = bar ? bar.querySelector('[data-strip-prev]') : null;
    var next = bar ? bar.querySelector('[data-strip-next]') : null;
    var anim = null;

    function bleed() {
      /* Мерим родителя: у него нет нашего отрицательного поля, поэтому число не плывёт */
      var r = host.getBoundingClientRect();
      var gap = Math.max(0, Math.round(window.innerWidth - r.right));
      strip.style.setProperty('--bleed', gap + 'px');
    }

    function step() {
      /* Шаг – 85 % видимой ширины: полный экран карточек за раз теряет ориентир,
         человек не понимает, где он остановился */
      return Math.max(160, Math.round(strip.clientWidth * 0.85));
    }

    function to(target) {
      var from = strip.scrollLeft;
      var max = strip.scrollWidth - strip.clientWidth;
      target = Math.max(0, Math.min(max, target));
      if (Math.abs(target - from) < 1) return;
      if (anim) cancelAnimationFrame(anim);
      var t0 = performance.now(), dur = 360;
      (function frame(now) {
        var k = Math.min(1, (now - t0) / dur);
        var e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        strip.scrollLeft = from + (target - from) * e;
        if (k < 1) anim = requestAnimationFrame(frame); else { anim = null; paint(); }
      })(t0);
    }

    function paint() {
      var max = strip.scrollWidth - strip.clientWidth;
      if (prev) prev.disabled = strip.scrollLeft <= 2;
      if (next) next.disabled = strip.scrollLeft >= max - 2;
    }

    if (prev) prev.addEventListener('click', function () { to(strip.scrollLeft - step()); });
    if (next) next.addEventListener('click', function () { to(strip.scrollLeft + step()); });

    var ticking = false;
    strip.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; paint(); });
    }, { passive: true });

    addEventListener('resize', function () { bleed(); paint(); });
    bleed();
    paint();
  }

  function init(scope) {
    var list = (scope || document).querySelectorAll('[data-strip]');
    for (var i = 0; i < list.length; i++) setup(list[i]);
  }

  window.kitStrip = init;
  if (document.readyState !== 'loading') init(document);
  else addEventListener('DOMContentLoaded', function () { init(document); });
})();
