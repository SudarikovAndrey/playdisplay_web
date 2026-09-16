/* ПЕРЕКЛЮЧАЕМЫЕ СЦЕНАРИИ — одна система, показанная в нескольких задачах.
 *
 * Что важно:
 *
 *  • ПАНЕЛИ НЕ УДАЛЯЮТСЯ И НЕ ПРЯЧУТСЯ ЧЕРЕЗ display. Все лежат в одной ячейке сетки
 *    (см. .switcher__panels), высота блока равна самой высокой панели и не меняется
 *    при переключении. В режиме слайдов прыжок высоты сбивает прилипание, а на
 *    обычной странице под рукой прыгает всё, что ниже.
 *
 *  • КЛАВИАТУРА ОБЯЗАТЕЛЬНА: вкладки — это role="tablist", и стрелки влево-вправо
 *    должны переключать, иначе содержание второй и третьей вкладки недоступно без мыши.
 *
 *  • О ПЕРЕКЛЮЧЕНИИ СООБЩАЕМ СОБЫТИЕМ `kit:switch`, а не зовём чужой код напрямую:
 *    на странице с облаком точек (kit/js/trace.js) сцена перестраивается под выбранный
 *    сценарий, но сам переключатель про облако знать не должен.
 */
(function () {
  'use strict';

  function setup(box) {
    var tabs = box.querySelectorAll('[role="tab"]');
    var panels = box.querySelectorAll('[role="tabpanel"]');
    if (!tabs.length || tabs.length !== panels.length) return;
    var id = box.getAttribute('data-switcher') || '';

    function show(i, focus) {
      for (var k = 0; k < tabs.length; k++) {
        var on = k === i;
        tabs[k].setAttribute('aria-selected', on ? 'true' : 'false');
        /* В ленте вкладок в порядок обхода Tab входит только выбранная — так
           устроен паттерн tablist: внутри ленты ходят стрелками. */
        tabs[k].tabIndex = on ? 0 : -1;
        panels[k].classList.toggle('is-off', !on);
      }
      if (focus) tabs[i].focus();
      document.dispatchEvent(new CustomEvent('kit:switch', { detail: { id: id, index: i } }));
    }

    for (var i = 0; i < tabs.length; i++) {
      (function (n) {
        tabs[n].addEventListener('click', function () { show(n, false); });
        tabs[n].addEventListener('keydown', function (e) {
          var k = e.key, j = -1;
          if (k === 'ArrowRight' || k === 'ArrowDown') j = (n + 1) % tabs.length;
          else if (k === 'ArrowLeft' || k === 'ArrowUp') j = (n - 1 + tabs.length) % tabs.length;
          else if (k === 'Home') j = 0;
          else if (k === 'End') j = tabs.length - 1;
          if (j < 0) return;
          e.preventDefault();
          show(j, true);
        });
      })(i);
    }

    /* Начальное состояние берём из разметки: выбранной считается та вкладка, у
       которой aria-selected="true" — иначе при печати страницы без скрипта
       содержание первой панели теряется. */
    var start = 0;
    for (i = 0; i < tabs.length; i++) if (tabs[i].getAttribute('aria-selected') === 'true') start = i;
    show(start, false);
  }

  /* Как и у карты модулей: каталог вставляет демонстрации позже, init зовут второй
     раз, и без пометки на кнопках оказалось бы по два обработчика. */
  function init() {
    var boxes = document.querySelectorAll('[data-switcher]');
    for (var i = 0; i < boxes.length; i++) {
      if (boxes[i].hasAttribute('data-switcher-live')) continue;
      boxes[i].setAttribute('data-switcher-live', '');
      setup(boxes[i]);
    }
  }

  window.kitSwitcher = init;
  if (document.readyState !== 'loading') init();
  else addEventListener('DOMContentLoaded', init);
})();
