/* ГОРИЗОНТАЛЬНАЯ ЛЕНТА: стрелки, вылет за края экрана, листание тягой.
 *
 * Зачем: лента карточек листается пальцем сама, но на компьютере с мышью человек не
 * догадывается, что её можно двигать – колесо крутит страницу, а не ленту. Поэтому здесь
 * три вещи, и каждая требует замера, поэтому живёт в скрипте, а не в стилях.
 *
 *  1. ВЫЛЕТ ЗА ОБА КРАЯ. Лента должна уходить за края экрана, а не обрываться по краю
 *     текстовой колонки – так видно, что карточек больше, чем видно. В чистом CSS это
 *     не считается: колонка не центрирована в окне (слева боковая полоса разделов),
 *     поэтому приёмы вида calc(50% - 50vw) дают промах на половину полосы и заодно
 *     растягивают документ по горизонтали.
 *     Влево вылет идёт до края ОБЛАСТИ СОДЕРЖАНИЯ, а не до края окна: под полосой
 *     разделов карточки оказались бы под меню.
 *     Замеряем РОДИТЕЛЯ обёртки: у него нет наших отрицательных полей, и замер не
 *     начинает гоняться за собственным результатом.
 *
 *  2. СТРЕЛКИ. Прокрутка внутри ленты идёт СВОИМ ЦИКЛОМ, а не behavior: 'smooth'.
 *     Причина та же, что у полноэкранной галереи: страница в режиме слайдов гасит
 *     вложенную плавную прокрутку, и лента остаётся на месте.
 *
 *  3. ЛИСТАНИЕ ТЯГОЙ. Указатель тянет ленту, как палец. Три подвоха:
 *     • прилипание (scroll-snap) на время тяги СНИМАЕТСЯ – иначе лента дёргается к
 *       ближайшей карточке при каждом движении и за курсором не идёт;
 *     • после тяги на карточках гасится отклик на курсор, иначе они прыгают под рукой;
 *     • щелчок по ссылке внутри карточки нельзя терять: клик отменяем только если
 *       рука реально уехала (больше шести пикселей).
 */
(function () {
  'use strict';

  function setup(strip) {
    var wrap = strip.closest('[data-strip-wrap]') || strip.parentNode;
    var host = wrap.parentNode;
    var main = document.querySelector('main') || document.body;
    var prev = wrap.querySelector('[data-strip-prev]');
    var next = wrap.querySelector('[data-strip-next]');
    var anim = null;

    function bleed() {
      var r = host.getBoundingClientRect();
      /* Левая граница – НЕ край окна и не край main. Полоса разделов лежит поверх
         страницы (position: fixed) и в раскладке места не занимает: замер по main давал
         ноль, и карточки уезжали под меню. Считаем от правого края полосы.
         Но только пока она СТОЛБИК: на узком экране та же полоса разворачивается в
         горизонтальную ленту во всю ширину, и её правый край – это край окна. По нему
         вылет получался нулевым, лента упиралась в текстовую колонку. Отличаем по форме:
         столбик выше, чем шире. */
      var nav = document.querySelector('.chapter-nav');
      var safe = 0;
      if (nav) {
        var nr = nav.getBoundingClientRect();
        var column = nr.height > nr.width;
        if (nr.width > 0 && nr.height > 0 && column && getComputedStyle(nav).position === 'fixed') safe = nr.right + 10;
      }
      var left = Math.max(0, Math.round(r.left - Math.max(safe, main.getBoundingClientRect().left)));
      var right = Math.max(0, Math.round(window.innerWidth - r.right));
      wrap.style.setProperty('--bleed-l', left + 'px');
      wrap.style.setProperty('--bleed-r', right + 'px');
    }

    function step() {
      /* Шаг – 85 % видимой ширины: целый экран карточек за раз теряет ориентир,
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

    /* ── ЛИСТАНИЕ ТЯГОЙ ─────────────────────────────────────────────────── */
    var dragging = false, startX = 0, startLeft = 0, moved = 0, lastX = 0, lastT = 0, speed = 0;

    strip.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch') return;      // на телефоне тянет сам браузер, и лучше
      if (e.button !== 0) return;
      dragging = true; moved = 0; speed = 0;
      startX = lastX = e.clientX;
      startLeft = strip.scrollLeft;
      lastT = performance.now();
      if (anim) { cancelAnimationFrame(anim); anim = null; }
      strip.classList.add('is-dragging');
      strip.setPointerCapture(e.pointerId);
    });

    strip.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX;
      moved = Math.max(moved, Math.abs(dx));
      strip.scrollLeft = startLeft - dx;
      var now = performance.now(), dt = now - lastT;
      if (dt > 0) speed = (e.clientX - lastX) / dt;   // пикселей на миллисекунду
      lastX = e.clientX; lastT = now;
      e.preventDefault();
    });

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      strip.classList.remove('is-dragging');
      /* Инерция короткая и только на заметном броске: длинный выбег на ленте из карточек
         читается как «уехало само», а не как продолжение движения руки */
      if (Math.abs(speed) > 0.35) to(strip.scrollLeft - speed * 220);
      else paint();
    }
    strip.addEventListener('pointerup', endDrag);
    strip.addEventListener('pointercancel', endDrag);
    strip.addEventListener('lostpointercapture', endDrag);
    /* Клик отменяем только если рука реально уехала: иначе ссылки внутри карточек
       перестали бы нажиматься */
    strip.addEventListener('click', function (e) { if (moved > 6) { e.preventDefault(); e.stopPropagation(); } }, true);
    strip.addEventListener('dragstart', function (e) { e.preventDefault(); });

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
