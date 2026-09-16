/* РЕЖИМ СЛАЙДОВ: гарантированное проявление и листание стрелками.
 *
 * Включается сам, если на <html> стоит класс deck.
 *
 *  • ПУСТОЙ СЛАЙД — САМАЯ ДОРОГАЯ ОШИБКА ПРЕЗЕНТАЦИИ. Проявление кита
 *    (reveal-cursor.js) держится на IntersectionObserver, и это верно для книги,
 *    которую читают прокруткой. В колоде слайдов по документу ПРЫГАЮТ: ссылка в
 *    полосе разделов, клавиша End, восстановление позиции при перезагрузке. Слайд,
 *    мимо которого проскочили быстрее, чем наблюдатель успел сообщить, остаётся с
 *    opacity: 0 — и человек, вернувшись к нему, видит пустой экран с одним номером.
 *    Поймано при проверке: прыжок по трём слайдам подряд оставил четвёртый пустым.
 *    Здесь страховка простая и без наблюдателя: всё, что попало в кадр, показываем.
 *
 *  • СТРЕЛКИ ВЛЕВО-ВПРАВО. Вверх-вниз браузер листает сам, а боковые стрелки для
 *    презентации привычнее: рука на них и лежит, когда рассказывают. Своей анимации
 *    не пишем — прокручиваем к началу слайда и отдаём ход прилипанию.
 *
 *  • В ПОЛЯХ ВВОДА СТРЕЛКИ НЕ ПЕРЕХВАТЫВАЕМ: иначе в форме на слайде нельзя
 *    двигать курсор по строке.
 */
(function () {
  'use strict';

  function init() {
    if (!document.documentElement.classList.contains('deck')) return;
    var slides = document.querySelectorAll('.slide');
    if (!slides.length) return;

    /* ── Страховка проявления ─────────────────────────────────────────────── */
    var SEL = '.reveal, .diagram, .art-frame';
    var ticking = false;

    function show() {
      ticking = false;
      var h = window.innerHeight;
      for (var i = 0; i < slides.length; i++) {
        var b = slides[i].getBoundingClientRect();
        /* Кадром считаем всё, что хоть краем видно: слайд, показанный наполовину,
           уже читают, и появляться на глазах ему поздно. */
        if (b.bottom < 0 || b.top > h) continue;
        var list = slides[i].querySelectorAll(SEL);
        for (var k = 0; k < list.length; k++) list[k].classList.add('is-visible');
      }
    }

    function tick() { if (!ticking) { ticking = true; requestAnimationFrame(show); } }

    addEventListener('scroll', tick, { passive: true });
    addEventListener('resize', tick);
    addEventListener('load', tick);
    tick();

    /* ── Листание стрелками ───────────────────────────────────────────────── */
    addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      /* Внутри ленты вкладок стрелки — её собственное управление (switcher.js) */
      if (t && t.closest && t.closest('[role="tablist"]')) return;

      var y = window.pageYOffset || document.documentElement.scrollTop || 0;
      var cur = 0, i;
      for (i = 0; i < slides.length; i++) {
        /* Текущим считаем слайд, чьё начало ближе всего сверху: при прилипании
           это ровно тот, что стоит в кадре. */
        if (slides[i].offsetTop <= y + 2) cur = i;
      }
      var next = e.key === 'ArrowRight' ? cur + 1 : cur - 1;
      if (next < 0 || next >= slides.length) return;
      e.preventDefault();
      window.scrollTo({ top: slides[next].offsetTop, behavior: 'smooth' });
    });
  }

  window.kitDeck = init;
  if (document.readyState !== 'loading') init();
  else addEventListener('DOMContentLoaded', init);
})();
