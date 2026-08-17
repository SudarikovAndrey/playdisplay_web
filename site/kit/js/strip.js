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

    /* ШАГ – РОВНО ОДНА КАРТОЧКА. Раньше стрелка листала 85 % экрана: за один щелчок
       уезжало четыре карточки, и это читалось как прокрутка списка, а не как
       перелистывание. Шаг берём из настоящего расстояния между карточками (ширина плюс
       промежуток), а не из ширины ленты. */
    function pitch() {
      /* Тоже по раскладке: у повёрнутой карточки экранная коробка уже настоящей, и шаг
         пополз бы вместе с углом поворота. */
      var kids = strip.children;
      if (kids.length > 1) {
        var d = kids[1].offsetLeft - kids[0].offsetLeft;
        if (d > 8) return Math.round(d);
      }
      return kids.length ? Math.round(kids[0].offsetWidth) : 240;
    }

    /* Целимся В КРАЙ КАРТОЧКИ, а не в «текущее плюс шаг»: иначе после тяги, которая
       остановилась между карточками, лента продолжала ехать вразнобой. */
    function snapTarget(dir) {
      var p = pitch();
      var i = Math.round(strip.scrollLeft / p);
      var next = i + dir;
      if (Math.abs(strip.scrollLeft - i * p) > p * 0.12) next = dir > 0 ? Math.ceil(strip.scrollLeft / p) : Math.floor(strip.scrollLeft / p);
      return next * p;
    }

    /* ОБЪЁМ КОЛОДЫ. Карточка стоит ровно, пока видна целиком; как только край ленты
       начинает её резать – отворачивается в глубину и темнеет. Считаем именно ДОЛЮ
       ОБРЕЗКИ, а не расстояние до центра: по расстоянию первая карточка при нулевой
       прокрутке оказывалась «далёкой» и гасла, хотя стоит на месте и видна вся. */
    var deck = strip.hasAttribute('data-strip-deck');
    var flat = matchMedia('(prefers-reduced-motion: reduce)').matches;
    function shape() {
      if (!deck || flat) return;
      /* ГЕОМЕТРИЮ БЕРЁМ ИЗ РАСКЛАДКИ (offsetLeft/offsetWidth), А НЕ ИЗ getBoundingClientRect.
         Это не придирка, а причина рывков: getBoundingClientRect возвращает коробку УЖЕ
         ПОВЁРНУТОЙ карточки, она у повёрнутой уже – значит доля обрезки считается больше,
         карточка поворачивается сильнее, коробка ещё уже. Замкнутый круг: за два кадра
         угол улетал в предел, и колода дёргалась вместо плавного поворота.
         offsetLeft и offsetWidth преобразований не видят вовсе. */
      var kids = strip.children;
      if (!kids.length) return;
      var base = kids[0].offsetLeft;
      var view = strip.clientWidth;
      for (var i = 0; i < kids.length; i++) {
        var el = kids[i];
        var x = el.offsetLeft - base - strip.scrollLeft;   // левый край карточки в видимой части
        var w = el.offsetWidth;
        var hidden = Math.max(0, -x) - Math.max(0, x + w - view);
        var k = Math.max(-1, Math.min(1, hidden / Math.max(1, w)));
        var a = Math.abs(k);
        el.style.transform = 'perspective(1500px) translateZ(' + (-a * 74).toFixed(1) + 'px) '
          + 'rotateY(' + (k * 26).toFixed(1) + 'deg) scale(' + (1 - a * 0.04).toFixed(3) + ')';
        el.style.filter = 'brightness(' + (1 - a * 0.42).toFixed(3) + ')';
        el.style.opacity = (1 - a * 0.32).toFixed(3);
      }
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
        shape();
        if (k < 1) anim = requestAnimationFrame(frame); else { anim = null; paint(); }
      })(t0);
    }

    function paint() {
      var max = strip.scrollWidth - strip.clientWidth;
      if (prev) prev.disabled = strip.scrollLeft <= 2;
      if (next) next.disabled = strip.scrollLeft >= max - 2;
      shape();
    }

    if (prev) prev.addEventListener('click', function () { to(snapTarget(-1)); });
    if (next) next.addEventListener('click', function () { to(snapTarget(1)); });

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
      shape();
      var now = performance.now(), dt = now - lastT;
      if (dt > 0) speed = (e.clientX - lastX) / dt;   // пикселей на миллисекунду
      lastX = e.clientX; lastT = now;
      e.preventDefault();
    });

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      strip.classList.remove('is-dragging');
      /* Бросок доводится ДО КРАЯ КАРТОЧКИ, а не до произвольного места: колода должна
         останавливаться на карточке, иначе теряется ощущение, что листаешь предметы.
         Инерция короткая – длинный выбег читается как «уехало само». */
      var p = pitch();
      if (Math.abs(speed) > 0.28) {
        var fling = strip.scrollLeft - speed * 200;
        to(Math.round(fling / p) * p);
      } else {
        to(Math.round(strip.scrollLeft / p) * p);
      }
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
    /* Ещё раз после шрифтов: до их загрузки высота карточек другая, и доля обрезки
       считалась по старой ширине */
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { bleed(); paint(); });
  }

  function init(scope) {
    var list = (scope || document).querySelectorAll('[data-strip]');
    for (var i = 0; i < list.length; i++) setup(list[i]);
  }

  window.kitStrip = init;
  if (document.readyState !== 'loading') init(document);
  else addEventListener('DOMContentLoaded', function () { init(document); });
})();
