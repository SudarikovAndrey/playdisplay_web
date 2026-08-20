/* СЛОИ В УГЛУ ОТВЕЧАЮТ НА КУРСОР.
 *
 * Зачем: прокрутка разводит слои по глубине только во время перелистывания, а на стоящем
 * слайде сцена замирает. Курсор возвращает ей объём: мелкие предметы уходят за мышью
 * заметно, фигура — почти нет. Это тот же приём, что наклон стопки экранов на первом
 * экране, но здесь у каждого слоя своя амплитуда, и потому читается глубина, а не наклон
 * плоской картинки.
 *
 * Что важно:
 *
 *  • ПРЕОБРАЗОВАНИЯ РАЗВЕДЕНЫ ПО ТРЁМ ЭЛЕМЕНТАМ. Прокрутка двигает обёртку слоя,
 *    курсор — вложенную обёртку, покачивание — саму картинку. Все три пишут в transform,
 *    и на одном элементе любые два из них затирали бы друг друга.
 *
 *  • СКРИПТ ПИШЕТ ТОЛЬКО ДВА ЧИСЛА (--mx и --my, от −1 до 1) НА КОНТЕЙНЕР, а насколько
 *    сдвинуть каждый слой, решает CSS своей амплитудой. Иначе пришлось бы держать
 *    в скрипте таблицу слоёв — и она разошлась бы со стилями при первой же правке.
 *
 *  • ЗНАЧЕНИЕ ДОГОНЯЕТ КУРСОР, а не прыгает за ним: без сглаживания предметы дёргаются
 *    на каждое движение мыши и выглядят приклеенными к ней. Цикл останавливается, когда
 *    догнал, — незачем крутить кадры вхолостую.
 *
 *  • Только при настоящем курсоре (pointer: fine). На касании события приходят рывками
 *    от места нажатия, и сцена дёргалась бы вместо плавного отклика.
 */
(function () {
  'use strict';

  function setup(cast) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!matchMedia('(pointer: fine)').matches) return;

    var tx = 0, ty = 0, cx = 0, cy = 0, raf = null, near = false;

    function loop() {
      cx += (tx - cx) * 0.09;
      cy += (ty - cy) * 0.09;
      cast.style.setProperty('--mx', cx.toFixed(4));
      cast.style.setProperty('--my', cy.toFixed(4));
      raf = (Math.abs(tx - cx) > 0.002 || Math.abs(ty - cy) > 0.002) ? requestAnimationFrame(loop) : null;
    }

    addEventListener('pointermove', function (e) {
      /* Считаем от середины ЭКРАНА, а не от середины сцены: сцена прижата к правому краю,
         и от её середины левая половина экрана давала бы почти постоянный крайний отклик. */
      var r = cast.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) { near = false; return; }
      near = true;
      tx = Math.max(-1, Math.min(1, (e.clientX - innerWidth / 2) / (innerWidth / 2)));
      ty = Math.max(-1, Math.min(1, (e.clientY - innerHeight / 2) / (innerHeight / 2)));
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });

    /* Курсор ушёл из окна — сцена возвращается в исходное положение, а не остаётся
       вывернутой в ту сторону, где мышь покинула экран. */
    addEventListener('pointerleave', function () { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(loop); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && raf) { cancelAnimationFrame(raf); raf = null; }
    });
  }

  function init(scope) {
    var list = (scope || document).querySelectorAll('[data-cast]');
    for (var i = 0; i < list.length; i++) setup(list[i]);
  }

  window.kitCast = init;
  if (document.readyState !== 'loading') init(document);
  else addEventListener('DOMContentLoaded', function () { init(document); });
})();
