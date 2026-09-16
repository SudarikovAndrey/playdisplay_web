/* ЯДРО И МОДУЛИ — расстановка подключаемых возможностей по кольцу вокруг центра.
 *
 * Зачем скрипт, если это оформление: углы зависят от ЧИСЛА модулей. Четырнадцать
 * штук — это шаг 25.7°, и в CSS такие углы пришлось бы вписывать руками каждому
 * пункту, а при добавлении пятнадцатого переписывать все.
 *
 * Что важно:
 *
 *  • ЭЛЛИПС, А НЕ ОКРУГ. Свободное место под слайдом шире, чем выше (примерно 1240×470),
 *    и на круге подписи снизу и сверху вылезли бы за экран. Радиусы 42 % и 40 % от
 *    середины совпадают с рамкой .core-map::before — числа в двух местах, и менять
 *    их надо вместе.
 *
 *  • ПЕРВЫЙ МОДУЛЬ СТОИТ СВЕРХУ (−90°), а не справа: кольцо читается сверху по
 *    часовой, как циферблат. От нуля градусов порядок начинается сбоку и выглядит
 *    случайным.
 *
 *  • НА ТЕЛЕФОНЕ РАССТАНОВКА СНИМАЕТСЯ ПОЛНОСТЬЮ. CSS переводит карту в список, но
 *    инлайновые left/top остались бы на элементах и перебили бы его — поэтому при
 *    узком экране их надо СТИРАТЬ, а не просто не ставить.
 *
 *  • Пояснение показывается и по наведению, и по фокусу с клавиатуры: карта из
 *    четырнадцати кнопок, доступная только мышью, — это четырнадцать недоступных
 *    кнопок.
 */
(function () {
  'use strict';

  var RX = 42, RY = 40;      // радиусы в процентах от середины (см. .core-map::before)

  function setup(map) {
    var items = map.querySelectorAll('.core-map__ring li');
    var note = map.querySelector('.core-map__note');
    var base = note ? note.textContent : '';
    var n = items.length;
    if (!n) return;

    function place() {
      var narrow = window.innerWidth <= 900;
      for (var i = 0; i < n; i++) {
        var li = items[i];
        if (narrow) { li.style.left = ''; li.style.top = ''; continue; }
        var a = -Math.PI / 2 + (i / n) * Math.PI * 2;
        li.style.left = (50 + Math.cos(a) * RX).toFixed(2) + '%';
        li.style.top = (50 + Math.sin(a) * RY).toFixed(2) + '%';
      }
    }

    function tell(btn) {
      if (!note) return;
      var i = btn && btn.querySelector('i');
      note.textContent = i ? i.textContent : base;
      for (var k = 0; k < n; k++) {
        var b = items[k].querySelector('button');
        if (b) b.classList.toggle('is-on', b === btn);
      }
    }

    for (var i = 0; i < n; i++) {
      var btn = items[i].querySelector('button');
      if (!btn) continue;
      btn.addEventListener('mouseenter', function () { tell(this); });
      btn.addEventListener('focus', function () { tell(this); });
      btn.addEventListener('mouseleave', function () { tell(null); });
      btn.addEventListener('blur', function () { tell(null); });
      /* На таче наведения нет вовсе: нажатие на модуль показывает его пояснение
         в середине карты и оставляет там, пока не нажмут другой. */
      btn.addEventListener('click', function () { tell(this); });
    }

    place();
    addEventListener('resize', place, { passive: true });
  }

  /* Каталог кита вставляет демонстрации ПОСЛЕ чтения описи, поэтому init открыт
     наружу и зовётся повторно. Уже поднятые карты помечены — иначе на каждую кнопку
     повесился бы второй обработчик, а слушатель resize завёлся бы дважды. */
  function init() {
    var maps = document.querySelectorAll('[data-core-map]');
    for (var i = 0; i < maps.length; i++) {
      if (maps[i].hasAttribute('data-core-live')) continue;
      maps[i].setAttribute('data-core-live', '');
      setup(maps[i]);
    }
  }

  window.kitCoreMap = init;
  if (document.readyState !== 'loading') init();
  else addEventListener('DOMContentLoaded', init);
})();
