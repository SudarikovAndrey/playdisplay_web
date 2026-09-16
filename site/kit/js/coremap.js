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
 *  • РАСШИФРОВКА ПОЯВЛЯЕТСЯ У САМОГО МОДУЛЯ, а не в середине карты. В середине
 *    глазу приходилось уезжать от того, на что он навёл, и обратно — на четырнадцати
 *    модулях это четырнадцать поездок. Рядом с курсором текст читается там же, где
 *    рука.
 *
 *  • ПОДПИСЬ ВЫНЕСЕНА ИЗ КНОПКИ НАРУЖУ (в <li>), хотя в разметке лежит внутри неё.
 *    Причина простая: выбранный модуль увеличивается масштабом, а масштаб забрал бы
 *    с собой и текст расшифровки — она стала бы крупнее остальных на те же 20 %.
 *    В разметке текст остаётся внутри кнопки: на телефоне он показывается прямо под
 *    названием, и два места должны питаться одним источником.
 *
 *  • СОСЕДИ РАЗЪЕЗЖАЮТСЯ ОТ ВЫБРАННОГО, и сила сдвига падает с расстоянием
 *    (экспонента, полуспад около 100 px). Одинаковый сдвиг для всех выглядит как
 *    «кольцо дёрнулось», а не как «вокруг освободилось место».
 *
 *  • ОКНО РАСШИФРОВКИ ПРИЖИМАЕТСЯ К РАМКЕ КАРТЫ. У модулей по краям эллипса половина
 *    окна уходила бы за кадр; сдвиг считается в пикселях по замеру, а не углом.
 *
 *  • НА ТЕЛЕФОНЕ РАССТАНОВКА СНИМАЕТСЯ ПОЛНОСТЬЮ. CSS переводит карту в список, но
 *    инлайновые left/top остались бы на элементах и перебили бы его — поэтому при
 *    узком экране их надо СТИРАТЬ, а не просто не ставить.
 *
 *  • Расшифровка показывается и по наведению, и по фокусу с клавиатуры: карта из
 *    четырнадцати кнопок, доступная только мышью, — это четырнадцать недоступных
 *    кнопок.
 */
(function () {
  'use strict';

  var RX = 42, RY = 40;      // радиусы в процентах от середины (см. .core-map::before)
  var PUSH = 30;             // на сколько пикселей отодвигается ближайший сосед
  var FALL = 105;            // расстояние полуспада этого сдвига, пиксели
  var TIP = 220;             // ширина окна расшифровки, пиксели (совпадает с CSS)

  function setup(map) {
    var items = map.querySelectorAll('.core-map__ring li');
    var n = items.length;
    if (!n) return;

    var pos = [];            // положение модулей в долях карты — считаем один раз на раскладку

    /* Расшифровку вынимаем из кнопки в сам пункт: иначе её увеличит масштаб выбранного */
    for (var j = 0; j < n; j++) {
      var note = items[j].querySelector('button > i');
      if (note) items[j].appendChild(note);
    }

    function narrow() { return window.innerWidth <= 900; }

    function place() {
      pos = [];
      for (var i = 0; i < n; i++) {
        var li = items[i];
        if (narrow()) { li.style.left = ''; li.style.top = ''; li.style.transform = ''; continue; }
        var a = -Math.PI / 2 + (i / n) * Math.PI * 2;
        var x = 50 + Math.cos(a) * RX, y = 50 + Math.sin(a) * RY;
        pos.push([x, y]);
        li.style.left = x.toFixed(2) + '%';
        li.style.top = y.toFixed(2) + '%';
        /* Модулям нижней половины окно расшифровки открывается ВВЕРХ: снизу у них
           край карты, и окно ушло бы под следующий блок страницы. */
        li.classList.toggle('up', y > 55);
      }
    }

    function clear() {
      for (var i = 0; i < n; i++) {
        items[i].classList.remove('is-on');
        items[i].style.transform = '';
        var b = items[i].querySelector('button');
        if (b) b.classList.remove('is-on');
        var t = items[i].querySelector('i');
        if (t) t.style.marginLeft = '';
      }
    }

    function open(idx) {
      if (narrow()) return;                 // на телефоне расшифровка видна всегда
      var box = map.getBoundingClientRect();
      var W = box.width, H = box.height;
      var cx = pos[idx][0] / 100 * W, cy = pos[idx][1] / 100 * H;

      for (var i = 0; i < n; i++) {
        var li = items[i], btn = li.querySelector('button');
        if (i === idx) {
          li.classList.add('is-on');
          li.style.transform = '';
          if (btn) btn.classList.add('is-on');
          continue;
        }
        li.classList.remove('is-on');
        if (btn) btn.classList.remove('is-on');
        var dx = pos[i][0] / 100 * W - cx, dy = pos[i][1] / 100 * H - cy;
        var d = Math.sqrt(dx * dx + dy * dy) || 1;
        var k = PUSH * Math.exp(-d / FALL);
        /* Базовый translate(-50%,-50%) обязан остаться: он и ставит пункт на точку */
        li.style.transform = 'translate(-50%, -50%) translate(' +
          (dx / d * k).toFixed(1) + 'px, ' + (dy / d * k).toFixed(1) + 'px)';
      }

      /* Окно расшифровки не должно вылезать за рамку карты: считаем сдвиг замером */
      var tip = items[idx].querySelector('i');
      if (tip) {
        var left = cx - TIP / 2, shift = 0;
        if (left < 8) shift = 8 - left;
        else if (left + TIP > W - 8) shift = (W - 8) - (left + TIP);
        tip.style.marginLeft = (-TIP / 2 + shift).toFixed(1) + 'px';
      }
    }

    for (var i = 0; i < n; i++) {
      (function (idx) {
        var btn = items[idx].querySelector('button');
        if (!btn) return;
        btn.addEventListener('mouseenter', function () { open(idx); });
        btn.addEventListener('focus', function () { open(idx); });
        btn.addEventListener('mouseleave', clear);
        btn.addEventListener('blur', clear);
        /* На таче наведения нет: нажатие открывает расшифровку и оставляет её,
           пока не нажмут другой модуль. */
        btn.addEventListener('click', function () { open(idx); });
      })(i);
    }

    place();
    addEventListener('resize', function () { clear(); place(); }, { passive: true });
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
