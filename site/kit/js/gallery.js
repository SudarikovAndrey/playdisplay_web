/* ПОЛНОЭКРАННАЯ ГАЛЕРЕЯ: один экран, листание стрелками, точками и пальцем.
 *
 * ДВИЖОК — ТРЕК НА ТРАНСФОРМАЦИИ, А НЕ КОНТЕЙНЕР ПРОКРУТКИ. Так сделана карусель кейсов
 * на главной сайта, и причина именно в надёжности: у прокрутки есть промежуточные
 * положения, и лента застревает между кадрами. Мы прошли этот путь целиком —
 * proximity-прилипание, своя доводка по остановке, снятие прилипания на время анимации, —
 * и каждый раз оставалась щель, в которой лента «не листается». Здесь щели нет вовсе:
 * положение задаётся индексом, промежуточных состояний не существует, а плавность даёт
 * один переход CSS.
 *
 * Что осталось важным:
 *  • ПАЛЕЦ И МЫШЬ ТЯНУТ ТРЕК. На время тяги переход снимается, иначе кадр идёт за рукой
 *    с запаздыванием. Порог смены — 15 % ширины: меньше читается как случайное движение.
 *  • Клавиши работают, только когда галерея в кадре: иначе стрелки крадут управление у
 *    страницы, и по документу становится нельзя ходить с клавиатуры.
 *  • Колесо перехватывается только при ГОРИЗОНТАЛЬНОМ движении (тачпад): вертикальное
 *    принадлежит странице, и красть его нельзя.
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
    var last = items.length - 1;

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

    function place(px, animate) {
      track.style.transition = animate ? '' : 'none';
      track.style.transform = 'translate3d(' + px + 'px,0,0)';
    }

    function go(n, animate) {
      index = Math.max(0, Math.min(last, n));
      place(-index * root.clientWidth, animate !== false);
      for (var i = 0; i < dots.length; i++) dots[i].setAttribute('aria-current', i === index ? 'true' : 'false');
      if (counter) counter.textContent = ('0' + (index + 1)).slice(-2) + ' / ' + ('0' + items.length).slice(-2);
      if (prev) prev.disabled = index === 0;
      if (next) next.disabled = index === last;
    }

    if (prev) prev.addEventListener('click', function () { hinted = true; go(index - 1); });
    if (next) next.addEventListener('click', function () { hinted = true; go(index + 1); });

    /* ── ТЯГА ПАЛЬЦЕМ И МЫШЬЮ ──────────────────────────────────────────── */
    var dragging = false, startX = 0, startY = 0, dx = 0, decided = false, horizontal = false;

    track.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      dragging = true; decided = false; horizontal = false; dx = 0;
      startX = e.clientX; startY = e.clientY;
      track.style.transition = 'none';
    });

    track.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var mx = e.clientX - startX, my = e.clientY - startY;
      /* НАПРАВЛЕНИЕ РЕШАЕТСЯ ОДИН РАЗ. Без этого вертикальный свайп по кадру уводил и
         страницу, и трек одновременно, и оба движения выглядели рваными. */
      if (!decided && (Math.abs(mx) > 6 || Math.abs(my) > 6)) {
        decided = true;
        horizontal = Math.abs(mx) > Math.abs(my);
      }
      if (!horizontal) return;
      dx = mx;
      /* У краёв тянется вдвое туже: это подсказка «дальше кадров нет», привычная по
         нативным листалкам. */
      if ((index === 0 && dx > 0) || (index === last && dx < 0)) dx *= 0.45;
      place(-index * root.clientWidth + dx, false);
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    function release() {
      if (!dragging) return;
      dragging = false;
      var w = root.clientWidth || 1;
      if (horizontal && Math.abs(dx) > w * 0.15) go(index + (dx < 0 ? 1 : -1));
      else go(index);
      dx = 0;
    }
    track.addEventListener('pointerup', release);
    track.addEventListener('pointercancel', release);
    track.addEventListener('pointerleave', release);
    /* Клик по ссылке внутри кадра нельзя терять: отменяем только после настоящей тяги */
    track.addEventListener('click', function (e) { if (Math.abs(dx) > 6) { e.preventDefault(); e.stopPropagation(); } }, true);
    track.addEventListener('dragstart', function (e) { e.preventDefault(); });

    /* Колесо горизонтальное (тачпад) — с паузой между шагами, иначе одно движение
       пальцами пролистывает всю галерею. */
    var wheelLock = 0;
    root.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      var now = Date.now();
      if (now - wheelLock < 420) { e.preventDefault(); return; }
      wheelLock = now;
      go(index + (e.deltaX > 0 ? 1 : -1));
      e.preventDefault();
    }, { passive: false });

    /* ── ВЕРТИКАЛЬНАЯ ПРОКРУТКА ЛИСТАЕТ КАДРЫ, ПОКА ОНИ НЕ КОНЧИЛИСЬ ──────
       На слайде с галереей прокрутка вниз сначала проходит кадры, и только на последнем
       отдаёт страницу дальше. Наверх — то же в обратную сторону. Иначе кадры со второго
       по пятый не видит никто: человек листает презентацию вниз и проезжает слайд,
       считая, что там одна картинка.
       Раньше вертикальное колесо мы НЕ трогали сознательно («прокрутка принадлежит
       странице»), и это правило остаётся верным везде, кроме этого случая: здесь
       перехват не крадёт движение, а тратит его на содержание того же слайда.

       Три условия, без которых перехват вредит:
        • Слайд должен СТОЯТЬ НА МЕСТЕ (доля видимости выше 0.85). На середине
          перелистывания страница уже едет, и перехват дёргал бы её назад. Долю считаем
          ГЕОМЕТРИЕЙ В МОМЕНТ СОБЫТИЯ, а не берём у наблюдателя пересечений: наблюдатель
          сообщает только о переходах через заданные пороги, и между ними его последнее
          значение устаревает. Один getBoundingClientRect на прокрут стоит дешевле, чем
          перехват, сработавший не вовремя.
        • Пауза между шагами. Тачпад за один жест присылает десятки событий, и без паузы
          галерея проскакивает целиком — то есть ровно то, что мы лечим.
        • Отпускаем ЗАРАНЕЕ, а не после лишнего шага: на последнем кадре событие вниз
          уходит странице целиком, без preventDefault.
       Касание не перехватываем вовсе: на телефоне вертикальный свайп — единственный
       способ листать документ, и отбирать его нельзя. Кадры там листаются пальцем
       по горизонтали. */
    var vLock = 0;
    var host = root.closest('.slide') || root;
    function onScreen() {
      var r = root.getBoundingClientRect();
      if (r.height <= 0) return 0;
      return (Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) / r.height;
    }
    host.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;      // горизонталь — не наше дело
      if (onScreen() < 0.85) return;                             // слайд ещё не встал
      var down = e.deltaY > 0;
      if (down ? index >= last : index <= 0) return;              // кадры кончились — отдаём страницу
      e.preventDefault();
      var now = Date.now();
      if (now - vLock < 520) return;
      vLock = now;
      hinted = true;                                              // человек листает сам, подсказка не нужна
      go(index + (down ? 1 : -1));
    }, { passive: false });

    /* Клавиши — только пока галерея на экране.
       Заодно ПОДСКАЗКА: при первом появлении стрелка «вперёд» подталкивается и обводится
       кольцом. Тихая стрелка на краю кадра теряется, и человек уходит со слайда, не поняв,
       что здесь ещё несколько кадров. Играет один раз и только пока он не листал сам. */
    var visible = false, hinted = false;
    function hint() {
      if (hinted || index > 0) return;
      hinted = true;
      root.classList.add('is-hinting');
      setTimeout(function () { root.classList.remove('is-hinting'); }, 4400);
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting && es[0].intersectionRatio > 0.55;
        if (visible) hint();
      }, { threshold: [0, 0.55, 1] }).observe(root);
    }
    addEventListener('keydown', function (e) {
      if (!visible) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
    });

    /* Ширина кадра меняется вместе с окном: положение пересчитываем без анимации,
       иначе трек «переезжает» сам при повороте телефона. */
    addEventListener('resize', function () { go(index, false); });
    go(0, false);
  }

  function init(scope) {
    var list = (scope || document).querySelectorAll('[data-gallery]');
    for (var i = 0; i < list.length; i++) setup(list[i]);
  }

  window.kitGallery = init;
  if (document.readyState !== 'loading') init(document);
  else addEventListener('DOMContentLoaded', function () { init(document); });
})();
