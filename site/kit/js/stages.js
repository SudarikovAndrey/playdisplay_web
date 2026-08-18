/* ПЯТЬ СБОРОК ОДНОЙ МАШИНЫ: переключение кнопками.
 *
 * Зачем блок: прокачку нельзя объяснить словами так, как показывает один взгляд —
 * одна и та же машина в пяти состояниях, и человек сам щёлкает по ним туда-обратно.
 *
 * Что здесь важно и проверено:
 *
 *  • КАДРЫ ГРУЗЯТСЯ ЗАРАНЕЕ. Без этого первое переключение показывает пустое место:
 *    кадр весит сотню килобайт, а смена идёт за 0,22 с. Предзагрузка запускается, когда
 *    блок попал в кадр, а не при загрузке страницы: в презентации двадцать экранов, и
 *    тянуть полмегабайта заранее ради слайда, до которого могут не дойти, незачем.
 *
 *  • ТЕНЬ ШИРЕ У ТЯЖЁЛЫХ СБОРОК. Мелочь, но именно она делает переключение физическим:
 *    у «Легенды» колёса шире, чем у «Стока», и пятно контакта обязано это показать.
 *    Числа взяты замером габарита по альфе каждого кадра, а не на глаз.
 *
 *  • Кнопки — настоящие <button> с aria-pressed, и переключение работает стрелками:
 *    это ряд из пяти состояний одного предмета, по нему естественно ходить с клавиатуры.
 */
(function () {
  'use strict';

  function setup(root) {
    var cars = root.querySelectorAll('[data-stage-car]');
    var buttons = root.querySelectorAll('[data-stage]');
    /* ПОДПИСЬ ИЩЕМ ПО СВОЕМУ АТРИБУТУ. Сначала и у кнопок, и у подписи стоял один
       data-stage-note: querySelector находил первую КНОПКУ, и show() затирал её разметку
       своим текстом. Атрибуты у данных и у места вывода обязаны различаться. */
    var note = root.querySelector('[data-stage-caption]');
    var dice = root.querySelector('[data-stage-dice]');
    var sndClick = root.getAttribute('data-snd-click');
    var sndSwap = root.getAttribute('data-snd-swap');
    var shadow = root.querySelector('.stages__shadow');
    var wave = root.querySelector('.stages__wave');
    if (!cars.length) return;

    // Доля ширины кадра, которую занимает пятно контакта. Из замера альфы: у стока
    // колёса стоят уже, у экспедиционных сборок шире.
    var WIDTH = [0.62, 0.66, 0.70, 0.73, 0.74];
    var current = 0;

    function show(n) {
      n = Math.max(0, Math.min(cars.length - 1, n));
      current = n;
      /* Кадр запрошенной сборки подставляем ЗДЕСЬ, а не только в предзагрузке. Предзагрузка
         висит на появлении блока в кадре, а это событие может не прийти вовсе — например
         в фоновой вкладке браузер не обновляет отрисовку, и наблюдатель молчит. Тогда
         нажатие показывало бы пустое место. Один лишний вызов setAttribute дешевле
         сломанного переключателя. */
      var want = cars[n].getAttribute('data-src') || cars[n].getAttribute('src');
      if (want && !cars[n].getAttribute('src')) cars[n].setAttribute('src', want);
      for (var i = 0; i < cars.length; i++) cars[i].classList.toggle('is-on', i === n);
      for (var j = 0; j < buttons.length; j++) buttons[j].setAttribute('aria-pressed', j === n ? 'true' : 'false');
      /* Подпись версии живёт в data-атрибуте самого кадра, когда кнопок нет */
      var own = cars[n].getAttribute('data-stage-note');
      /* setProperty ждёт СТРОКУ: число уходило в пустоту молча, и тень не менялась. */
      if (shadow) shadow.style.setProperty('--shadow-w', String(WIDTH[n] || 0.7));
      if (note) note.textContent = own || (buttons[n] ? buttons[n].getAttribute('data-stage-note') : '') || '';
      /* ВОЛНА СВЕТА ПО КУЗОВУ. Маской служит сама картинка новой сборки, поэтому свет
         бежит по силуэту машины, а не по прямоугольнику кадра.
         Класс снимается и ставится заново с принудительным чтением offsetWidth: без него
         браузер не считает это новой анимацией, и при быстрых нажатиях волна проходила
         один раз, а дальше не показывалась вовсе. */
      /* ЗРЕЛИЩНАЯ СМЕНА. Машина снята в три четверти спереди-слева, поэтому поворот
         идёт вокруг вертикальной оси и опирается на КОЛЁСА (transform-origin у земли):
         так предмет разворачивается, а не крутится вокруг своей середины. Перспектива
         на сцене — иначе rotateY читается как сжатие по ширине.
         Класс снимается и ставится заново с чтением offsetWidth: без него браузер не
         считает это новой анимацией, и при быстрых нажатиях эффект проходит один раз. */
      var box = root.querySelector('.stages__stage');
      if (box) {
        box.classList.remove('is-swapping');
        void box.offsetWidth;
        box.classList.add('is-swapping');
      }
      if (wave && want !== null) {
        var url = cars[n].getAttribute('src') || want;
        if (url) {
          /* АДРЕС ДЛЯ МАСКИ ОБЯЗАН БЫТЬ АБСОЛЮТНЫМ. url() внутри пользовательской
             переменной браузер разрешает относительно ФАЙЛА СТИЛЕЙ, в котором переменная
             подставляется, а не относительно страницы: относительный
             assets/tuning/stage-1.webp превращался в /kit/css/assets/tuning/stage-1.webp
             и давал 404 на каждое переключение — в консоли их набралось больше тысячи.
             Та же грабля уже описана в theme-street.css про фактуру картона. */
          var abs = new URL(url, document.baseURI).href;
          wave.style.setProperty('--car', 'url("' + abs + '")');
          wave.classList.remove('is-running');
          void wave.offsetWidth;
          wave.classList.add('is-running');
        }
      }
    }

    for (var i = 0; i < buttons.length; i++) {
      (function (n) {
        buttons[n].addEventListener('click', function () { show(n); });
        buttons[n].addEventListener('keydown', function (e) {
          if (e.key === 'ArrowRight') { e.preventDefault(); show(current + 1); buttons[Math.min(buttons.length - 1, current)].focus(); }
          if (e.key === 'ArrowLeft') { e.preventDefault(); show(current - 1); buttons[Math.max(0, current)].focus(); }
        });
      })(i);
    }

    /* ── КУБИК: СЛУЧАЙНАЯ ВЕРСИЯ ─────────────────────────────────────────
       Двенадцать кнопок с названиями версий читаются как таблица настроек, а не как
       игра. Кубик превращает выбор в бросок: одно действие, каждый раз другой результат.
       ПОВТОР НЕ ДОПУСКАЕМ: выпавшая та же машина выглядит как «кнопка не сработала». */
    function playSound(src) {
      if (!src) return;
      try {
        var a = new Audio(src);
        a.volume = 0.42;                 // тише голоса на защите: звук здесь — акцент, а не событие
        var p = a.play();
        if (p && p.catch) p.catch(function () {});   // браузер вправе отказать до первого касания
      } catch (e) { /* без звука эффект всё равно работает */ }
    }

    if (dice) {
      dice.addEventListener('click', function () {
        var n = current;
        if (cars.length > 1) { while (n === current) n = Math.floor(Math.random() * cars.length); }
        dice.classList.remove('is-rolling');
        void dice.offsetWidth;
        dice.classList.add('is-rolling');
        playSound(sndClick);
        /* Машина меняется НЕ мгновенно, а на середине броска кубика: сначала слышно и
           видно бросок, потом появляется результат. */
        setTimeout(function () { show(n); playSound(sndSwap); }, 210);
      });
    }

    /* Предзагрузка по появлению блока в кадре: рано — лишние полмегабайта, поздно —
       первое переключение покажет пустое место. */
    function preload() {
      for (var i = 0; i < cars.length; i++) {
        var src = cars[i].getAttribute('data-src');
        if (src && !cars[i].getAttribute('src')) cars[i].setAttribute('src', src);
      }
    }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        if (es[0].isIntersecting) { preload(); io.disconnect(); }
      }, { rootMargin: '600px' });
      io.observe(root);
    } else {
      preload();
    }

    show(0);
  }

  function init(scope) {
    var list = (scope || document).querySelectorAll('[data-stages]');
    for (var i = 0; i < list.length; i++) setup(list[i]);
  }

  window.kitStages = init;
  if (document.readyState !== 'loading') init(document);
  else addEventListener('DOMContentLoaded', function () { init(document); });
})();
