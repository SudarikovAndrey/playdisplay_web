/* СТЕНА ВЫВЕСОК. Разметка даёт только список <img>; ряды, координаты и высоту
   считает этот файл, потому что раскладка зависит от фактической ширины колонки,
   а её в вёрстке не знает никто.

   Ряды идут встык, как на настоящей стене: сплошная кладка с рваным краем.
   Ровная сетка из полусотни одинаковых плашек читается как таблица – глаз
   скользит по ней и не останавливается, ради чего всё и затевалось.

   Курсор задаёт «внимание»: чем ближе вывеска, тем крупнее, ярче и прямее.
   Стена при этом всё время чуть покачивается – неподвижная стена выглядит
   картинкой, а не местом.

   Стиль ES5 – как во всём ките. */
(function () {
  'use strict';

  var AR = 1024 / 261;      // пропорция вывески; по файлам разброс меньше процента
  var POWER = 1.7;          // во сколько раз растёт вывеска ровно под курсором
  var RADIUS = 420;         // радиус внимания в пикселях раскладки
  var DIM = 0.58;           // насколько притушены дальние
  var INERTIA = 0.16;       // 1 – мгновенно; меньше – тяжелее и живее
  var SWAY = 1;             // амплитуда покачивания

  // Стена живёт, только пока её видно: иначе полсотни transform в каждом кадре
  // продолжают считаться на всей странице и без толку греют батарею.
  function each(list, fn) { for (var i = 0; i < list.length; i++) fn(list[i], i); }

  function build(root) {
    var imgs = root.querySelectorAll('img');
    if (!imgs.length) return;

    // На грубом указателе наводить внимание нечем; движение при этом тоже лишнее,
    // поэтому стена просто раскладывается и замирает в полном цвете.
    var live = window.matchMedia &&
               window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
               !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var cards = [];
    each(imgs, function (img, i) {
      var card = document.createElement('div');
      card.className = 'signwall__card';
      img.parentNode.insertBefore(card, img);
      card.appendChild(img);
      var dim = document.createElement('div'); dim.className = 'signwall__dim';
      var glow = document.createElement('div'); glow.className = 'signwall__glow';
      card.appendChild(dim); card.appendChild(glow);

      // Фаза и период у каждой вывески свои: с общей фазой стена пульсирует
      // в такт и превращается в анимированный баннер.
      cards.push({
        el: card, dim: dim, glow: glow,
        base: 0.86 + rnd(i * 7.13) * 0.30,
        phase: rnd(i * 3.77) * Math.PI * 2,
        speed: 0.28 + rnd(i * 11.3) * 0.34,
        tilt: (rnd(i * 5.19) - 0.5) * 2.6,
        w: 0, h: 0, cx: 0, cy: 0, inf: 0, z: -1
      });
    });

    function rnd(n) { var s = Math.sin(n * 12.9898 + 1) * 43758.5453; return s - Math.floor(s); }

    function layout() {
      var cs = window.getComputedStyle(root);
      var pad = parseFloat(cs.paddingLeft) || 0;
      var cardW = parseFloat(cs.getPropertyValue('--sw-card')) || 300;
      var gap = parseFloat(cs.getPropertyValue('--sw-gap')) || 10;
      var wide = root.clientWidth - pad * 2;
      if (wide <= 0) return;

      var y = pad, row = [], rowW = 0, maxH = 0, i, c;

      function flush() {
        if (!row.length) return;
        // Ряды центрируются все, включая последний: прижатый к краю хвост
        // читается как сбой раскладки, а не как рваная кладка.
        var x = pad + (wide - rowW) / 2;
        // Своя переменная, а не общая c: flush вызывается ИЗ цикла раскладки,
        // и затирание c стоило каждой третьей карточки - она теряла размеры
        // и разворачивалась в натуральные 1024 px поверх соседей.
        for (var k = 0; k < row.length; k++) {
          var rc = row[k];
          rc.el.style.left = x + 'px';
          rc.el.style.top = (y + (maxH - rc.h) / 2) + 'px';
          rc.el.style.width = rc.w + 'px';
          rc.el.style.height = rc.h + 'px';
          rc.cx = x + rc.w / 2; rc.cy = y + (maxH - rc.h) / 2 + rc.h / 2;
          x += rc.w + gap;
        }
        y += maxH + gap * 1.6;
        row = []; rowW = 0; maxH = 0;
      }

      for (i = 0; i < cards.length; i++) {
        c = cards[i];
        c.w = cardW * c.base; c.h = c.w / AR;
        if (rowW + c.w > wide && row.length) flush();
        row.push(c); rowW += c.w + gap;
        if (c.h > maxH) maxH = c.h;
      }
      flush();

      // Высоту ставим руками: карточки вынуты из потока, сам контейнер её не знает.
      root.style.height = (y - gap * 1.6 + pad) + 'px';
      if (root.className.indexOf('is-ready') < 0) root.className += ' is-ready';
    }

    var mx = -1e9, my = -1e9, running = false, visible = false;

    function frame(t) {
      if (!running) return;
      var time = t * 0.001;
      var box = root.getBoundingClientRect();
      var wx = mx - box.left, wy = my - box.top;
      var i, c, dx, dy, d2, u, target, f, breath, s, rot, dyf, nz;

      for (i = 0; i < cards.length; i++) {
        c = cards[i];
        dx = c.cx - wx; dy = c.cy - wy; d2 = dx * dx + dy * dy;
        target = 0;
        if (d2 < RADIUS * RADIUS) {
          u = 1 - Math.sqrt(d2) / RADIUS;
          target = u * u * (3 - 2 * u);          // мягкий спад вместо линейного
        }
        c.inf += (target - c.inf) * INERTIA;
        f = c.inf;

        breath = Math.sin(time * c.speed + c.phase);
        // base уже сидит в ширине карточки, второй раз его умножать нельзя
        s = (1 + f * (POWER - 1)) * (1 + breath * 0.006 * SWAY);
        // Под курсором вывеска выпрямляется: как будто поворачивается к зрителю.
        rot = c.tilt * (1 - f * 0.9) + breath * 0.55 * SWAY;
        dyf = breath * 2.4 * SWAY - f * 6;

        c.el.style.transform = 'translate3d(0,' + dyf.toFixed(2) + 'px,0) rotate(' +
                               rot.toFixed(3) + 'deg) scale(' + s.toFixed(4) + ')';
        c.dim.style.opacity = (DIM * (1 - f)).toFixed(3);
        c.glow.style.opacity = (f * f).toFixed(3);

        // Слои переставляем только при смене: правка z-index заставляет браузер
        // пересобирать порядок наложения, и делать это каждый кадр незачем.
        nz = (f * 200) | 0;
        if (nz !== c.z) { c.z = nz; c.el.style.zIndex = nz; }
      }
      requestAnimationFrame(frame);
    }

    function start() { if (!running) { running = true; requestAnimationFrame(frame); } }
    function stop() { running = false; }

    layout();
    if (window.addEventListener) {
      window.addEventListener('resize', layout, false);
      // Картинки приезжают лениво и меняют ничего в раскладке, но первая из них
      // может прийти позже первого замера – тогда высота останется от заглушки.
      // Картинки приезжают лениво и вразнобой; пересчитывать раскладку
      // на каждую из полусотни незачем, хватает одного отложенного прохода.
      var pending = 0;
      each(imgs, function (img) {
        if (!img.complete) img.addEventListener('load', function () {
          if (pending) clearTimeout(pending);
          pending = setTimeout(layout, 60);
        }, false);
      });
    }
    if (!live) return;              // дальше только то, что нужно курсору

    document.addEventListener('mousemove', function (e) {
      mx = e.clientX; my = e.clientY;
      if (visible) start();
    }, false);

    if (window.IntersectionObserver) {
      new IntersectionObserver(function (ents) {
        visible = ents[0].isIntersecting;
        if (visible) start(); else stop();
      }, { rootMargin: '120px' }).observe(root);
    } else { visible = true; start(); }
  }

  function init() {
    var roots = document.querySelectorAll('[data-signwall]');
    for (var i = 0; i < roots.length; i++) build(roots[i]);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, false);
  } else { init(); }
})();
