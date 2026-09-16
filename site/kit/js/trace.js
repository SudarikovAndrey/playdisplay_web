/* СКВОЗНАЯ ТРАЕКТОРИЯ — одно облако точек, которое перестраивается от слайда к слайду.
 *
 * Зачем: презентация, где на каждом экране своя отдельная картинка, читается как
 * набор слайдов. Презентация, где ОДНО облако точек меняет форму, читается как один
 * рассказ: линия пути человека обрывается на втором экране и продолжается на третьем
 * теми же точками. Метафора работает только если точки те же самые — поэтому облако
 * живёт в неподвижном канвасе поверх фона и под содержанием, а слайды лишь говорят
 * ему, какую форму принять.
 *
 * Как пользоваться:
 *
 *   <section class="slide" data-trace="s03" data-trace-box="0.08,0.12,0.94,0.88">
 *
 *   kitTrace.scene('s03', function (S) { return [ ...элементы... ]; });
 *   kitTrace.start();
 *
 * Построитель сцены получает S = {w, h, v, box} и возвращает список ЭЛЕМЕНТОВ формы
 * в долях рамки (0..1 внутри data-trace-box). Движок сам раскидывает по ним точки
 * пропорционально весу и сам ведёт переход между сценами по прокрутке.
 *
 * Что здесь важно и проверено:
 *
 *  • КАНВАС — ПЕРВЫЙ РЕБЁНОК <body>, как у искр. У слайдов position: relative без
 *    z-index: среди позиционированных элементов побеждает тот, кто НИЖЕ в разметке.
 *    Слой, приписанный в конец, лёг бы поверх текста.
 *
 *  • ТОЧКА ИДЁТ К ЦЕЛИ СГЛАЖИВАНИЕМ, а не ставится в вычисленную позицию. Прямая
 *    подстановка даёт рывок на каждом щелчке колеса (прокрутка приходит ступенями) и
 *    не умеет показать смену сценария на месте, где прокрутка не двигается вовсе.
 *    Сглаживание решает оба случая одной строкой: цель меняется как угодно резко,
 *    точка доезжает за ~0.2 с.
 *
 *  • ФОРМЫ СЧИТАЮТСЯ В ДОЛЯХ РАМКИ, а не в пикселях: тот же набор сцен обязан
 *    работать и на 2560, и на 390 — иначе для телефона пришлось бы держать вторую
 *    копию всех десяти сцен.
 *
 *  • РАЗБРОС ТОЧЕК ДЕТЕРМИНИРОВАН (свой генератор с зерном). На Math.random каждая
 *    пересборка (поворот экрана, смена сценария) переставляла бы ВСЕ точки заново, и
 *    вместо «форма подстроилась» получалась бы вспышка хаоса.
 *
 *  • ЦВЕТ БЕРЁТСЯ ИЗ ТАБЛИЦЫ НА КАДР. Доля перехода между сценами одна на всё облако,
 *    поэтому у пары ролей и ступени прозрачности цвет один — строку rgba() достаточно
 *    собрать один раз за кадр, а не тысячу. Без этого кадр уходит на склейку строк.
 *
 *  • ПРОЗРАЧНОСТЬ ОКРУГЛЯЕТСЯ ДО 12 СТУПЕНЕЙ — тот же приём, что у мяча в книге:
 *    глаз ступеней не видит, а таблица цветов остаётся маленькой.
 *
 *  • ПРИ prefers-reduced-motion КАДРОВОГО ЦИКЛА НЕТ ВОВСЕ: точки ставятся в цель и
 *    перерисовываются только на прокрутку. Движение здесь — украшение, а не смысл.
 */
(function () {
  'use strict';

  var TAU = Math.PI * 2;

  /* ── РОЛИ ТОЧЕК ─────────────────────────────────────────────────────────
     Роль — это и цвет, и размер, и право светиться бегущей волной. Их держим
     ровно четыре: больше глаз не различает на точке в полтора пикселя.
       space — среда, фон, архитектура: почти не видна
       line  — сам путь человека: самое светлое
       node  — узел, точка касания: фирменный синий
       ghost — то, что потеряно или ещё не случилось: холодная тень            */
  var ROLES = ['space', 'line', 'node', 'ghost'];
  var RGB_DARK = [
    [126, 145, 190],
    [216, 228, 255],
    [122, 145, 255],
    [92, 104, 132]
  ];
  /* СВЕТЛАЯ ТЕМА — НЕ ИНВЕРСИЯ ТЁМНОЙ. На чёрном точка светится, и роль «путь»
     самая СВЕТЛАЯ; на бумаге светить нечем, и самой заметной становится самая
     ТЁМНАЯ точка. Поэтому вторая таблица, а не инверсия первой: инверсия дала бы
     бледно-голубой путь на белом, то есть почти невидимый. */
  var RGB_LIGHT = [
    [126, 140, 170],
    [24, 32, 52],
    [43, 73, 214],
    [158, 168, 188]
  ];
  var RGB = RGB_DARK;
  var ROLE_A = [0.52, 1.0, 0.95, 0.66];   // своя яркость роли
  var ROLE_S = [1.0, 1.15, 1.75, 1.0];    // свой размер роли

  var STEPS = 12;                          // ступеней прозрачности

  /* ── ГЕНЕРАТОР С ЗЕРНОМ ────────────────────────────────────────────────
     Простейший LCG: одинаковое зерно даёт одинаковую россыпь при каждой
     пересборке, поэтому поворот экрана не перемешивает облако. */
  function rng(seed) {
    var s = (seed | 0) || 1;
    return function () {
      s = (s * 1664525 + 1013904223) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  }

  /* ── ВЫБОРКА ТОЧКИ НА ЭЛЕМЕНТЕ ФОРМЫ ───────────────────────────────────
     u — доля вдоль элемента (0..1), r — генератор для разброса поперёк.
     Возвращает [x, y, t], где t — положение вдоль элемента для бегущей волны. */
  function sample(el, u, r, out) {
    var x = 0, y = 0, t = u, i, seg, d, k, a;

    if (el.k === 'path') {
      /* Путь задан ломаной; идём по ней с равномерным шагом ПО ДЛИНЕ, а не по
         числу звеньев: иначе на коротком звене точки густеют, и излом читается
         как узел, которого в замысле нет. */
      var p = el.p, L = el._L;
      if (!L) {
        L = el._L = [0];
        for (i = 1; i < p.length; i++) {
          d = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
          L.push(L[i - 1] + d);
        }
      }
      var total = L[L.length - 1] || 1, want = u * total;
      seg = 1;
      while (seg < L.length - 1 && L[seg] < want) seg++;
      k = (want - L[seg - 1]) / ((L[seg] - L[seg - 1]) || 1);
      x = p[seg - 1][0] + (p[seg][0] - p[seg - 1][0]) * k;
      y = p[seg - 1][1] + (p[seg][1] - p[seg - 1][1]) * k;
      /* Разброс поперёк — иначе путь выглядит начерченной линейкой, а не следом */
      var w = el.w == null ? 0.012 : el.w;
      x += (r() - 0.5) * w;
      y += (r() - 0.5) * w;

    } else if (el.k === 'dot') {
      /* Сгусток: квадратный корень от случайного числа даёт РОВНУЮ плотность по
         кругу. Без корня точки копятся в середине, и узел выглядит кляксой. */
      a = r() * TAU;
      d = Math.sqrt(r()) * (el.r == null ? 0.03 : el.r);
      x = el.x + Math.cos(a) * d;
      y = el.y + Math.sin(a) * d * (el.ry == null ? 1 : el.ry);
      t = -1;

    } else if (el.k === 'ring') {
      a = (el.from == null ? 0 : el.from) + u * ((el.to == null ? 1 : el.to) - (el.from == null ? 0 : el.from));
      x = el.cx + Math.cos(a * TAU) * el.rx * (1 + (r() - 0.5) * 0.06);
      y = el.cy + Math.sin(a * TAU) * el.ry * (1 + (r() - 0.5) * 0.06);
      t = a;

    } else if (el.k === 'grid') {
      /* Сетка среды: точки стоят по линиям, но с дрожанием — ровная сетка читается
         как разлинованная бумага и спорит с текстом. */
      var cols = el.cols || 8, rows = el.rows || 5;
      i = Math.floor(r() * cols * rows);
      var cx = i % cols, cy = (i / cols) | 0;
      if (r() < 0.5) {
        x = el.x0 + (el.x1 - el.x0) * (cx / (cols - 1 || 1));
        y = el.y0 + (el.y1 - el.y0) * ((cy + r()) / rows);
      } else {
        x = el.x0 + (el.x1 - el.x0) * ((cx + r()) / cols);
        y = el.y0 + (el.y1 - el.y0) * (cy / (rows - 1 || 1));
      }
      t = -1;

    } else if (el.k === 'rect') {
      /* Контур: обходим четыре стороны по периметру */
      var W2 = el.x1 - el.x0, H2 = el.y1 - el.y0, per = 2 * (W2 + H2), s = u * per;
      if (s < W2) { x = el.x0 + s; y = el.y0; }
      else if (s < W2 + H2) { x = el.x1; y = el.y0 + (s - W2); }
      else if (s < 2 * W2 + H2) { x = el.x1 - (s - W2 - H2); y = el.y1; }
      else { x = el.x0; y = el.y1 - (s - 2 * W2 - H2); }
      x += (r() - 0.5) * 0.008;
      y += (r() - 0.5) * 0.008;

    } else { /* scatter */
      x = el.x0 + r() * (el.x1 - el.x0);
      y = el.y0 + r() * (el.y1 - el.y0);
      t = -1;
    }

    out[0] = x; out[1] = y; out[2] = t;
    return out;
  }

  /* ── ДВИЖОК ────────────────────────────────────────────────────────────── */
  var builders = {};      // id сцены → построитель
  var variants = {};      // id сцены → номер варианта
  var started = false;

  var cv, ctx, dpr = 1, W = 0, H = 0, N = 0;
  var px, py;                              // текущие координаты точек (пиксели)
  var scenes = [];                         // {id, el, snap, box, dim, tx, ty, tr, ts, tf}
  var raf = null, tPrev = 0, tNow = 0;
  var still = false;                       // режим «без движения»

  function pick(el, name, def) {
    var v = el.getAttribute(name);
    if (!v) return def;
    var parts = v.split(',');
    for (var i = 0; i < parts.length; i++) parts[i] = parseFloat(parts[i]);
    return parts;
  }

  function collect() {
    var nodes = document.querySelectorAll('[data-trace]');
    scenes = [];
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i], id = el.getAttribute('data-trace');
      if (!builders[id]) continue;
      scenes.push({
        id: id,
        host: el,
        box: pick(el, 'data-trace-box', [0.06, 0.12, 0.94, 0.88]),
        boxM: pick(el, 'data-trace-box-m', null),
        dim: parseFloat(el.getAttribute('data-trace-dim') || '1'),
        snap: 0
      });
    }
  }

  /* Пересборка целей всех сцен. Зовётся на resize и на смену варианта. */
  function build(only) {
    var narrow = W < 900;
    for (var s = 0; s < scenes.length; s++) {
      var sc = scenes[s];
      if (only != null && only !== s) continue;
      var box = (narrow && sc.boxM) ? sc.boxM : sc.box;
      var bx = box[0] * W, by = box[1] * H, bw = (box[2] - box[0]) * W, bh = (box[3] - box[1]) * H;

      var list = builders[sc.id]({
        w: W, h: H, narrow: narrow,
        v: variants[sc.id] || 0
      }) || [];

      /* Раскладка точек по элементам пропорционально весу. Веса нормируем, остаток
         отдаём последнему элементу: иначе при округлении вниз несколько десятков
         точек остаются без цели и висят в нуле координат. */
      var total = 0, i, j;
      for (i = 0; i < list.length; i++) { list[i]._w = list[i].weight == null ? 1 : list[i].weight; total += list[i]._w; }
      if (!total) total = 1;

      /* Проверяем ДЛИНУ, а не наличие: число точек меняется вместе с размером окна,
         и массив прошлого размера пережил бы пересборку молча, оставив хвост точек
         с чужими целями. */
      if (!sc.tx || sc.tx.length !== N) {
        sc.tx = new Float32Array(N); sc.ty = new Float32Array(N);
        sc.tr = new Uint8Array(N); sc.tf = new Float32Array(N); sc.tv = new Float32Array(N);
      }
      var tx = sc.tx, ty = sc.ty, tr = sc.tr, tf = sc.tf, tv = sc.tv;

      var out = [0, 0, 0], k = 0;
      for (i = 0; i < list.length; i++) {
        var elm = list[i];
        elm._L = null;
        var cnt = (i === list.length - 1) ? (N - k) : Math.round(N * elm._w / total);
        var r = rng(s * 7919 + i * 131 + 17);
        var role = ROLES.indexOf(elm.role || 'space'); if (role < 0) role = 0;
        for (j = 0; j < cnt && k < N; j++, k++) {
          /* Доля вдоль элемента берётся РАВНОМЕРНО по счётчику, а не случайно:
             случайные доли на линии дают проплешины и комки. */
          sample(elm, cnt > 1 ? j / (cnt - 1) : 0.5, r, out);
          tx[k] = bx + out[0] * bw;
          ty[k] = by + out[1] * bh;
          tr[k] = role;
          tf[k] = elm.flow ? out[2] : -1;
          tv[k] = elm.flow || 0;
        }
      }
      while (k < N) { tx[k] = bx + bw * 0.5; ty[k] = by + bh * 0.5; tr[k] = 0; tf[k] = -1; tv[k] = 0; k++; }
    }
  }

  function measure() {
    for (var i = 0; i < scenes.length; i++) {
      var b = scenes[i].host.getBoundingClientRect();
      scenes[i].snap = b.top + (window.pageYOffset || document.documentElement.scrollTop || 0);
    }
  }

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    /* Число точек — от площади окна. Постоянное число на телефоне превращается в
       кашу, а на большом экране рассыпается в редкий пунктир. */
    var want = Math.round((W * H) / 1250);
    want = Math.max(420, Math.min(1800, want));
    if (want !== N) {
      N = want;
      /* Точки заводим заново и ставим в середину экрана: при первом показе облако
         СЛЕТАЕТСЯ в первую сцену, а не появляется готовым — это и есть вход в рассказ.
         Массивы целей обнуляем, их пересоберёт build() ниже под новое число точек. */
      px = new Float32Array(N); py = new Float32Array(N);
      for (var i = 0; i < N; i++) { px[i] = W * (0.35 + 0.3 * (i / N)); py[i] = H * 0.62; }
      for (i = 0; i < scenes.length; i++) { scenes[i].tx = null; }
    }
    build();
    measure();
    draw(true);
  }

  /* Кто сейчас на экране и насколько мы между ним и следующим */
  function where() {
    var y = window.pageYOffset || document.documentElement.scrollTop || 0;
    var i = 0;
    for (var s = scenes.length - 1; s >= 0; s--) {
      if (y >= scenes[s].snap - H * 0.5) { i = s; break; }
    }
    var f = 0;
    if (i < scenes.length - 1) {
      var d = scenes[i + 1].snap - scenes[i].snap;
      f = d > 0 ? (y - scenes[i].snap) / d : 0;
      f = f < 0 ? 0 : (f > 1 ? 1 : f);
      f = f * f * (3 - 2 * f);      // мягкий вход и выход: середина перехода быстрее краёв
    }
    return [i, f];
  }

  /* ── КАДР ──────────────────────────────────────────────────────────────── */
  var cache = new Array(4 * 4 * STEPS);

  function colour(ra, rb, f, step) {
    var key = (ra * 4 + rb) * STEPS + step;
    var c = cache[key];
    if (c) return c;
    var r = Math.round(RGB[ra][0] + (RGB[rb][0] - RGB[ra][0]) * f);
    var g = Math.round(RGB[ra][1] + (RGB[rb][1] - RGB[ra][1]) * f);
    var b = Math.round(RGB[ra][2] + (RGB[rb][2] - RGB[ra][2]) * f);
    c = cache[key] = 'rgba(' + r + ',' + g + ',' + b + ',' + ((step + 1) / STEPS).toFixed(3) + ')';
    return c;
  }

  function draw(snapTo) {
    if (!scenes.length) return;
    var w = where(), i = w[0], f = w[1];
    var A = scenes[i], B = scenes[Math.min(i + 1, scenes.length - 1)];
    var dim = A.dim + (B.dim - A.dim) * f;
    var narrow = W < 900;
    if (narrow) dim *= 0.6;                 // за текстом в одну колонку облако должно молчать

    var k = snapTo ? 1 : 1 - Math.pow(0.0016, Math.min(0.05, (tNow - tPrev) / 1000));
    var time = tNow / 1000;

    /* Таблицу цветов берём по теме КАЖДЫЙ КАДР и сбрасываем кэш строк: тему
       переключают на ходу (kit/js/theme.js), и облако обязано перекраситься
       вместе со страницей, а не после перезагрузки. */
    var wantLight = document.body.classList.contains('theme-light');
    if (wantLight !== (RGB === RGB_LIGHT)) RGB = wantLight ? RGB_LIGHT : RGB_DARK;
    /* На бумаге точке нечем светиться: то же значение прозрачности читается слабее,
       чем на чёрном, где точка добавляет свет. Небольшая надбавка выравнивает вес. */
    if (wantLight) dim *= 1.18;
    for (var c = 0; c < cache.length; c++) cache[c] = null;
    ctx.clearRect(0, 0, W, H);

    for (var n = 0; n < N; n++) {
      var gx = A.tx[n] + (B.tx[n] - A.tx[n]) * f;
      var gy = A.ty[n] + (B.ty[n] - A.ty[n]) * f;
      px[n] += (gx - px[n]) * k;
      py[n] += (gy - py[n]) * k;

      var ra = A.tr[n], rb = B.tr[n];
      var a = (ROLE_A[ra] + (ROLE_A[rb] - ROLE_A[ra]) * f) * dim;

      /* БЕГУЩАЯ ВОЛНА — это и есть «данные идут по маршруту». Голова кометы
         острая (шестая степень), хвост длинный: равномерная синусоида читается
         как мигание гирлянды, а не как движение. */
      var fl = f < 0.5 ? A.tf[n] : B.tf[n];
      if (fl >= 0 && !still) {
        var sp = f < 0.5 ? A.tv[n] : B.tv[n];
        var u = (fl - time * sp * 0.22) % 1; if (u < 0) u += 1;
        var head = 0.52 + 1.30 * Math.pow(1 - u, 6);
        a *= head > 1 ? 1 : head;
      }
      if (a <= 0.02) continue;
      if (a > 1) a = 1;

      var step = (a * STEPS) | 0; if (step > STEPS - 1) step = STEPS - 1;
      var s = (ROLE_S[ra] + (ROLE_S[rb] - ROLE_S[ra]) * f) * (narrow ? 1.05 : 1.25);
      ctx.fillStyle = colour(ra, rb, f, step);
      ctx.fillRect(px[n] - s * 0.5, py[n] - s * 0.5, s, s);
    }
  }

  function frame(t) {
    tPrev = tNow; tNow = t;
    draw(false);
    raf = requestAnimationFrame(frame);
  }

  function run() { if (!raf && !still) { tNow = tPrev = performance.now(); raf = requestAnimationFrame(frame); } }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

  /* ── ВНЕШНИЙ ИНТЕРФЕЙС ─────────────────────────────────────────────────── */
  var API = {
    scene: function (id, build) { builders[id] = build; },

    /* Смена варианта сцены (например, три сценария на одном экране). Пересобираем
       только эту сцену — точки доедут до новых мест сглаживанием сами. */
    variant: function (id, v) {
      variants[id] = v;
      for (var i = 0; i < scenes.length; i++) {
        if (scenes[i].id === id) { build(i); if (still) draw(true); }
      }
    },

    start: function () {
      if (started) return;
      started = true;
      cv = document.createElement('canvas');
      cv.className = 'trace-layer';
      cv.setAttribute('aria-hidden', 'true');
      document.body.insertBefore(cv, document.body.firstChild);
      ctx = cv.getContext('2d');
      if (!ctx) return;

      still = matchMedia('(prefers-reduced-motion: reduce)').matches;
      collect();
      resize();

      addEventListener('resize', function () { resize(); }, { passive: true });
      addEventListener('scroll', function () {
        /* В покойном режиме кадрового цикла нет — рисуем прямо на прокрутку */
        if (still) draw(true);
      }, { passive: true });
      /* Высота слайдов меняется от шрифтов и картинок, приехавших позже: замер
         повторяем после полной загрузки, иначе привязка сцен к экранам уезжает. */
      addEventListener('load', function () { measure(); draw(true); });
      document.addEventListener('visibilitychange', function () { document.hidden ? stop() : run(); });
      /* В покойном режиме кадров нет вовсе, поэтому смену темы надо дорисовать руками */
      document.addEventListener('kit:theme', function () { if (still) draw(true); });
      run();
      if (still) draw(true);
    },

    /* Замер заново — когда страница меняет высоту сама (открылась вкладка и т.п.) */
    remeasure: function () { measure(); }
  };

  window.kitTrace = API;
})();
