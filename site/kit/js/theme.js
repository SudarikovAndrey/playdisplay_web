/* ПЕРЕКЛЮЧАТЕЛЬ СВЕТЛОЙ ТЕМЫ.
 *
 * Кнопка рядом с «во весь экран»; тема — класс theme-light на <body>
 * (см. kit/css/theme-light.css).
 *
 *  • ВЫБОР ЗАПОМИНАЕТСЯ (localStorage). Презентацию открывают несколько раз подряд,
 *    и каждый раз переключать свет — раздражение, а не настройка.
 *
 *  • ПЕРВЫЙ ВЫБОР ДЕЛАЕТ СИСТЕМА: если человек ничего не выбирал, берём
 *    prefers-color-scheme. Кит тёмный, поэтому по умолчанию остаётся тёмным —
 *    светлым он становится только у того, у кого светлая система.
 *
 *  • О СМЕНЕ СООБЩАЕМ СОБЫТИЕМ `kit:theme`. Холсты (облако точек в trace.js)
 *    рисуют своими цветами, из CSS их не достать — пусть слушают и перекрашиваются
 *    сами, а переключатель про них не знает.
 *
 *  • НАДПИСЬ НА КНОПКЕ — ДЕЙСТВИЕ, А НЕ СОСТОЯНИЕ. «Светлая тема» на тёмной
 *    странице значит «включить светлую»; после нажатия она становится «тёмная».
 *    Кнопка-состояние («сейчас темно») заставляет гадать, что будет по нажатию.
 */
(function () {
  'use strict';

  var KEY = 'pd_theme';

  function apply(light, tell) {
    document.body.classList.toggle('theme-light', light);
    var btn = document.querySelector('.theme-toggle');
    if (btn) {
      btn.setAttribute('aria-pressed', light ? 'true' : 'false');
      var label = btn.querySelector('[data-theme-label]');
      if (label) label.textContent = light ? 'Тёмная тема' : 'Светлая тема';
      btn.setAttribute('aria-label', light ? 'Включить тёмную тему' : 'Включить светлую тему');
    }
    if (tell) document.dispatchEvent(new CustomEvent('kit:theme', { detail: { light: light } }));
  }

  function init() {
    var btn = document.querySelector('.theme-toggle');
    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) { /* приватный режим — просто без памяти */ }
    var light = saved === null
      ? matchMedia('(prefers-color-scheme: light)').matches
      : saved === 'light';
    /* На старте событие НЕ шлём: холсты ещё не собраны, а свой цвет они возьмут
       при первой же отрисовке — см. трактовку темы в trace.js. */
    apply(light, false);
    if (!btn) return;

    btn.addEventListener('click', function () {
      light = !document.body.classList.contains('theme-light');
      apply(light, true);
      try { localStorage.setItem(KEY, light ? 'light' : 'dark'); } catch (e) {}
    });
  }

  window.kitTheme = init;
  if (document.readyState !== 'loading') init();
  else addEventListener('DOMContentLoaded', init);
})();
