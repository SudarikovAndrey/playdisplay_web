/* СТОПКА ЭКРАНОВ ИГРЫ: телефон как живой предмет, а не скриншот.
 *
 * Зачем: на первом экране компреда стояла одна статичная картинка игры. Партнёр видит
 * ОДИН экран и достраивает по нему всё остальное. Стопка показывает игру набором —
 * магазин, босс, район, гараж, драка, банда — и делает это за него.
 *
 * Как устроено:
 *  • Экраны лежат друг за другом В ГЛУБИНУ (translateZ), а не рядом: это стопка карт в
 *    руке, и она читается как объём с первого взгляда.
 *  • Передний уходит ПОВОРОТОМ ОТ СЕБЯ и в сторону, остальные подтягиваются вперёд.
 *    Уход именно поворотом, а не сдвигом: сдвиг читался бы как слайдер, а здесь предмет.
 *  • Стопка НАКЛОНЯЕТСЯ ЗА КУРСОРОМ. Наклон маленький (до 7°) и сглажен: большой
 *    превращает первый экран в аттракцион и мешает читать заголовок рядом.
 *
 * Проверено и важно:
 *  • Смена идёт только пока экран в виду и вкладка активна — иначе браузер держит и
 *    перерисовывает то, чего никто не видит.
 *  • Позиции считаются ОДНОЙ функцией для всех карт, а не анимациями по отдельности:
 *    иначе при быстром переключении карты расходятся и стопка рассыпается.
 *  • Кадры грузятся по очереди: первый сразу, остальные после его загрузки. Шесть
 *    экранов по 200 КБ в начале страницы задерживают первый показ.
 */
(function () {
  'use strict';

  function setup(deck) {
    var cards = [].slice.call(deck.querySelectorAll('[data-deck-card]'));
    if (cards.length < 2) return;

    var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var top = 0;
    var timer = null;
    var HOLD = Number(deck.getAttribute('data-hold')) || 3600;

    /* Раскладка стопки. k — насколько карта позади передней. */
    function place(instant) {
      for (var i = 0; i < cards.length; i++) {
        var k = (i - top + cards.length) % cards.length;
        var c = cards[i];
        c.style.transition = instant ? 'none' : '';
        if (k === 0) {
          c.style.transform = 'translate3d(0,0,0) rotateY(0deg) scale(1)';
          c.style.opacity = '1';
          c.style.zIndex = '5';
          c.style.filter = 'none';
        } else if (k <= 2) {
          /* Две ближние карты видны краем — по ним и понятно, что это стопка */
          c.style.transform = 'translate3d(' + (k * 26) + 'px,' + (k * -14) + 'px,' + (k * -120) + 'px) rotateY(-' + (k * 7) + 'deg) scale(' + (1 - k * 0.02) + ')';
          c.style.opacity = String(1 - k * 0.28);
          c.style.zIndex = String(5 - k);
          c.style.filter = 'brightness(' + (1 - k * 0.22) + ')';
        } else {
          /* Дальние прячем совсем: шесть полупрозрачных слоёв дают кашу, а не глубину */
          c.style.transform = 'translate3d(70px,-40px,-380px) rotateY(-22deg) scale(.94)';
          c.style.opacity = '0';
          c.style.zIndex = '0';
        }
      }
    }

    function next() {
      var leaving = cards[top];
      /* Уход передней карты: поворот от себя и в сторону. Класс снимается по окончании
         перехода, иначе следующая раскладка застаёт карту в чужом состоянии. */
      leaving.classList.add('is-leaving');
      setTimeout(function () { leaving.classList.remove('is-leaving'); }, 620);
      top = (top + 1) % cards.length;
      place();
    }

    /* ── НАКЛОН ЗА КУРСОРОМ ────────────────────────────────────────────── */
    var tx = 0, ty = 0, cx = 0, cy = 0, raf = null;
    function loop() {
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      deck.style.setProperty('--tilt-x', cy.toFixed(2) + 'deg');
      deck.style.setProperty('--tilt-y', cx.toFixed(2) + 'deg');
      raf = (Math.abs(tx - cx) > 0.01 || Math.abs(ty - cy) > 0.01) ? requestAnimationFrame(loop) : null;
    }
    if (!reduced && matchMedia('(pointer: fine)').matches) {
      addEventListener('pointermove', function (e) {
        var r = deck.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight) return;
        tx = ((e.clientX - (r.left + r.width / 2)) / innerWidth) * 14;
        ty = -((e.clientY - (r.top + r.height / 2)) / innerHeight) * 10;
        if (!raf) raf = requestAnimationFrame(loop);
      }, { passive: true });
    }

    /* Щелчок листает вручную: если человек уже потянулся к стопке, ждать три секунды
       незачем. */
    deck.addEventListener('click', function () { next(); restart(); });

    function restart() { clearInterval(timer); timer = setInterval(next, HOLD); }
    function stop() { clearInterval(timer); timer = null; }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        (es[0].isIntersecting && es[0].intersectionRatio > 0.25) ? restart() : stop();
      }, { threshold: [0, 0.25, 1] }).observe(deck);
    } else {
      restart();
    }
    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : restart(); });

    /* Кадры по очереди: первый уже в разметке, остальные подставляем, когда он готов */
    function chain(i) {
      if (i >= cards.length) return;
      var src = cards[i].getAttribute('data-src');
      if (!src) { chain(i + 1); return; }
      cards[i].addEventListener('load', function () { chain(i + 1); }, { once: true });
      cards[i].addEventListener('error', function () { chain(i + 1); }, { once: true });
      cards[i].setAttribute('src', src);
    }
    var first = cards[0];
    if (first.complete && first.naturalWidth) chain(1);
    else first.addEventListener('load', function () { chain(1); }, { once: true });

    place(true);
  }

  function init(scope) {
    var list = (scope || document).querySelectorAll('[data-phone-deck]');
    for (var i = 0; i < list.length; i++) setup(list[i]);
  }

  window.kitPhoneDeck = init;
  if (document.readyState !== 'loading') init(document);
  else addEventListener('DOMContentLoaded', function () { init(document); });
})();
