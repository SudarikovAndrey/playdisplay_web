/* ГЛАВНЫЙ МЯЧ НА ПЕРВОМ ЭКРАНЕ — облако точек, как глобус на playdisplay.com.
 *
 * Мяч в книге один, а спорт в музее не один: каждые четыре секунды облако
 * перекрашивается в следующий мяч — футбол, гольф, теннис, бейсбол, волейбол,
 * баскетбол. Это и есть мысль концепции: мяч — проводник, дисциплины сменяются,
 * а игра остаётся. По клику мяч меняется сразу, не дожидаясь своей секунды.
 *
 * Что здесь важно по существу:
 *
 *  1. Точки распределены по сфере СПИРАЛЬЮ ФИБОНАЧЧИ. Наивный способ (случайные широта
 *     и долгота) сгущает точки у полюсов — сфера выглядит как клубок ниток.
 *
 *  2. Точек 27 000 и они мелкие. Рисуем их НЕ через arc(): круг с заливкой стоит на
 *     порядок дороже прямоугольника, и на таком количестве кадр не укладывался в 16 мс.
 *     Точка — это fillRect меньше пикселя: браузер сам сглаживает её по дробным
 *     координатам, и получается мягкая пылинка, а не квадрат.
 *
 *  3. Прозрачность НЕ ставится каждой точке отдельно. globalAlpha на 27 000 значений —
 *     это 27 000 смен состояния контекста. Вместо этого яркость округляется до шести
 *     ступеней, и на каждую ступень заранее собрана готовая строка rgba(): в кадре
 *     меняется только fillStyle, причём повторяющимися значениями, которые браузер
 *     кэширует.
 *
 *  4. Рисунок каждого мяча считается ОДИН раз и хранится как Uint8Array с ролью точки
 *     (0 — поле, 1 — полутон, 2 — шов). Считать заново каждый кадр нельзя: у гольфа это
 *     поиск ближайшей из 380 лунок, у тенниса и бейсбола — ближайшей из 240 точек шва.
 *     Таблицы строятся порциями по кадрам: первый мяч готов сразу, остальные успевают
 *     собраться задолго до своей очереди (у нас на это четыре секунды).
 *
 *  5. Смена идёт ФРОНТОМ по экрану, а не общим затуханием: точка переключается на новый
 *     рисунок, когда фронт до неё дошёл, и у каждой точки свой сдвиг — поэтому граница
 *     не линия, а рассыпающийся край. Каждая точка при этом рисуется РОВНО ОДИН раз:
 *     смешивать два цвета в кадре означало бы рисовать облако дважды.
 *
 *  6. Вращение полное и непрерывное, вокруг наклонённой оси: мяч в игре не замирает.
 *     Курсор лишь чуть подкручивает скорость и наклон — «живой», но не управляемый объект.
 *
 *  7. Глубина — двумя проходами (сначала дальняя половина, потом ближняя), без сортировки.
 */
(function () {
  var cv = document.getElementById('ballCanvas');
  if (!cv || !cv.getContext) return;
  var ctx = cv.getContext('2d');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var N = innerWidth < 700 ? 11000 : 27000;
  var P = new Float32Array(N * 3);
  var JIT = new Float32Array(N);            // свой сдвиг точки во фронте смены
  var GOLD = Math.PI * (3 - Math.sqrt(5));

  // Точки СБИТЫ со спирали случайным сдвигом, и это обязательно. Ровная спираль
  // Фибоначчи хороша на трёх тысячах точек, а на двадцати семи её витки становятся
  // главным узором на шаре: сквозь муар не читались ни швы футбола, ни лунки гольфа.
  // Сдвиг — доля среднего расстояния между точками (оно же ~ sqrt(4π/N)), поэтому
  // облако остаётся ровным, но перестаёт быть решёткой.
  var EPS = 0.62 * Math.sqrt(4 * Math.PI / N);
  for (var i = 0; i < N; i++) {
    var t = (i + 0.5) / N;
    var y = 1 - 2 * t;
    var r = Math.sqrt(Math.max(0, 1 - y * y));
    var a = GOLD * i;
    var x = Math.cos(a) * r + (Math.random() - 0.5) * EPS;
    var z = Math.sin(a) * r + (Math.random() - 0.5) * EPS;
    y += (Math.random() - 0.5) * EPS;
    var len = Math.sqrt(x * x + y * y + z * z) || 1;      // возвращаем точку на сферу
    P[i * 3] = x / len; P[i * 3 + 1] = y / len; P[i * 3 + 2] = z / len;
    JIT[i] = Math.random();
  }

  // ================= рисунки мячей =================

  // --- футбол: панели последних чемпионатов. Швы — три наклонённых больших круга,
  //     изогнутых волной по долготе: прямые швы читались бы как школьный глобус
  var PLANES = [[0, 1, 0], [0.87, 0.3, 0.39], [-0.52, 0.34, 0.78]];
  function football(x, y, z) {
    var lon = Math.atan2(z, x), lat = Math.asin(Math.max(-1, Math.min(1, y)));
    var bend = 0.22 * Math.sin(3 * lon + 1.7 * lat) + 0.12 * Math.sin(2 * lat - 0.6);
    var best = 1;
    for (var k = 0; k < 3; k++) {
      var n = PLANES[k];
      var d = Math.abs(x * n[0] + y * n[1] + z * n[2] + bend * 0.35);
      if (d < best) best = d;
    }
    return best < 0.034 ? 2 : (best < 0.07 ? 1 : 0);
  }

  // --- гольф: решётка лунок. Центры — та же спираль Фибоначчи, только редкая:
  //     лунки ложатся ровно, без сгущения у полюсов
  var DIMPLE = (function () {
    var K = 380, arr = new Float32Array(K * 3);
    for (var j = 0; j < K; j++) {
      var yy = 1 - 2 * (j + 0.5) / K;
      var rr = Math.sqrt(Math.max(0, 1 - yy * yy));
      var aa = GOLD * j;
      arr[j * 3] = Math.cos(aa) * rr; arr[j * 3 + 1] = yy; arr[j * 3 + 2] = Math.sin(aa) * rr;
    }
    return arr;
  })();
  function golf(x, y, z) {
    var m = -1;
    for (var j = 0; j < DIMPLE.length; j += 3) {
      var dot = x * DIMPLE[j] + y * DIMPLE[j + 1] + z * DIMPLE[j + 2];
      if (dot > m) m = dot;
    }
    var d = Math.sqrt(Math.max(0, 2 - 2 * m));      // расстояние по хорде до центра лунки
    // Границы взяты по замеру, а не на глаз: при 380 центрах медиана расстояния 0.073,
    // максимум 0.139. Узкие лунки (порог 0.05) давали 24 % тусклых точек, разбросанных
    // по белому шару — рисунок читался шумом. Лунка должна занимать примерно половину
    // площади, тогда между лунками остаётся СЕТКА рёбер, а она и опознаётся как гольф.
    if (d < 0.072) return 0;                        // дно лунки — тусклое, читается ямкой
    if (d < 0.098) return 2;                        // ребро между лунками — самое светлое
    return 1;                                       // стык трёх лунок
  }

  // --- теннис и бейсбол: у них ОДИН И ТОТ ЖЕ шов — «теннисная кривая». Она лежит на
  //     единичной сфере точно: x²+y²+z² = ((1−λ)+λ)² = 1 при любом λ, проверяется
  //     раскрытием. Расстояние считаем перебором по 240 её точкам — аналитического
  //     решения нет, а таблица роли строится один раз
  var SEAMPTS = (function () {
    var K = 240, L = 0.2, arr = new Float32Array(K * 3), z0 = 2 * Math.sqrt(L * (1 - L));
    for (var j = 0; j < K; j++) {
      var s = j / K * Math.PI * 2;
      arr[j * 3] = (1 - L) * Math.cos(s) + L * Math.cos(3 * s);
      arr[j * 3 + 1] = (1 - L) * Math.sin(s) - L * Math.sin(3 * s);
      arr[j * 3 + 2] = z0 * Math.sin(2 * s);
    }
    return arr;
  })();
  var _sd = 0, _si = 0;                              // ближайшее расстояние и номер точки шва
  function nearSeam(x, y, z) {
    var m = -1, mi = 0;
    for (var j = 0; j < SEAMPTS.length; j += 3) {
      var dot = x * SEAMPTS[j] + y * SEAMPTS[j + 1] + z * SEAMPTS[j + 2];
      if (dot > m) { m = dot; mi = j / 3; }
    }
    _sd = Math.sqrt(Math.max(0, 2 - 2 * m)); _si = mi;
  }
  function tennis(x, y, z) {
    nearSeam(x, y, z);
    return _sd < 0.05 ? 2 : (_sd < 0.088 ? 1 : 0);
  }
  function baseball(x, y, z) {
    nearSeam(x, y, z);
    if (_sd > 0.055) return 0;
    // стежки: короткие штрихи вдоль шва, а не сплошная линия
    return (_si % 8) < 4 && _sd < 0.036 ? 2 : 1;
  }

  // --- волейбол: шесть групп полос, как на гранях куба. Определяем «грань» по самой
  //     большой координате, внутри грани — три полосы; направление полос у соседних
  //     граней разное, поэтому мяч и читается волейбольным
  function volley(x, y, z) {
    var ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
    var mx = Math.max(ax, ay, az);
    var mid = ax + ay + az - mx - Math.min(ax, ay, az);
    if (mx - mid < 0.05) return 0;                   // ребро куба — глубокий шов, почти пропуск
    var w = mx === ax ? y : (mx === ay ? z : x);     // поперечная координата полосы
    var aw = Math.abs(w);
    if (Math.abs(aw - 0.26) < 0.026) return 0;       // разрез между полосами
    return aw > 0.26 ? 1 : 2;                        // крайние полосы в цвете, средняя белая
  }

  // --- баскетбол: два перпендикулярных больших круга плюс третий, изогнутый волной.
  //     Три ровных круга дали бы пляжный мяч; изгиб даёт узнаваемый баскетбольный шов
  function basket(x, y, z) {
    var lat = Math.asin(Math.max(-1, Math.min(1, y)));
    var d = Math.min(Math.abs(y), Math.abs(x), Math.abs(z + 0.34 * Math.sin(2 * lat)));
    return d < 0.024 ? 0 : (d < 0.05 ? 1 : 2);       // шов — пропуск, поле — самое яркое
  }

  /* Роль 0/1/2 у каждого мяча своя, и это не путаница, а следствие фона. Книга
   * почти чёрная, поэтому тёмная точка не рисует линию — она рисует ПРОПУСК. У мяча
   * со светлым полем (гольф, волейбол, баскетбол) шов и есть провал: ему отдана
   * самая тусклая роль. У мяча с тёмным полем (футбол) наоборот — шов светлый.
   * Поэтому яркость `al` и размер `sz` задаются каждому мячу отдельно: одна общая
   * шкала делала футбол читаемым, а гольф — тёмным шаром в белых крапинах.
   */
  var BALLS = [
    { name: 'футбол',    fn: football, col: ['#4560e0', '#9fb4ff', '#f4f8ff'],
      al: [0.46, 0.74, 1.00], sz: [0.95, 1.10, 1.45] },
    { name: 'гольф',     fn: golf,     col: ['#4a5a71', '#cfdcec', '#ffffff'],
      al: [0.22, 0.62, 0.98], sz: [0.88, 1.00, 1.20] },
    { name: 'теннис',    fn: tennis,   col: ['#cbe94b', '#eefaa6', '#ffffff'],
      al: [0.62, 0.84, 1.00], sz: [0.95, 1.10, 1.40] },
    { name: 'бейсбол',   fn: baseball, col: ['#e6eefa', '#f4a596', '#ff5138'],
      al: [0.60, 0.82, 1.00], sz: [0.92, 1.10, 1.40] },
    { name: 'волейбол',  fn: volley,   col: ['#1d2952', '#6f8ae4', '#f2f7ff'],
      al: [0.18, 0.76, 0.96], sz: [0.90, 1.05, 1.10] },
    { name: 'баскетбол', fn: basket,   col: ['#1a1109', '#f4b277', '#e8802c'],
      al: [0.14, 0.66, 0.94], sz: [0.90, 1.05, 1.10] }
  ];

  // ================= палитра с запечённой прозрачностью =================
  // шесть ступеней яркости на роль: в кадре меняется только fillStyle, и повторяющимися
  // строками, которые браузер разбирает один раз
  var LEV = 6;
  function bake(hex) {
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255, out = [];
    for (var k = 0; k < LEV; k++) {
      out.push('rgba(' + r + ',' + g + ',' + b + ',' + ((k + 0.5) / LEV).toFixed(3) + ')');
    }
    return out;
  }
  for (i = 0; i < BALLS.length; i++) {
    BALLS[i].pal = [bake(BALLS[i].col[0]), bake(BALLS[i].col[1]), bake(BALLS[i].col[2])];
  }

  // ================= таблицы роли, порциями по кадрам =================
  var build = -1, buildAt = 0, CHUNK = 2200;
  function table(k) {
    var b = BALLS[k];
    if (b.tab) return b.tab;
    if (build !== k) { build = k; buildAt = 0; b.part = new Uint8Array(N); }
    return null;
  }
  function buildStep() {
    if (build < 0) return;
    var b = BALLS[build], end = Math.min(N, buildAt + CHUNK);
    for (var j = buildAt; j < end; j++) b.part[j] = b.fn(P[j * 3], P[j * 3 + 1], P[j * 3 + 2]);
    buildAt = end;
    if (end >= N) { b.tab = b.part; b.part = null; build = -1; }
  }
  // первый мяч нужен уже в первом кадре — считаем его сразу
  (function () { var b = BALLS[0], u = new Uint8Array(N);
    for (var j = 0; j < N; j++) u[j] = b.fn(P[j * 3], P[j * 3 + 1], P[j * 3 + 2]);
    b.tab = u; })();

  // ================= смена мячей =================
  // «каждые четыре секунды» — это ПЕРИОД целиком, вместе с переходом, а не пауза плюс
  // переход: иначе мяч менялся бы раз в 4,85 с
  var PERIOD = 4, WIPE = 0.85, HOLD = PERIOD - WIPE;
  var cur = 0, nxt = -1, hold = 0, wipe = 0;

  function want(k) {                          // просим следующий мяч, ждём его таблицу
    if (nxt >= 0 || k === cur) return;
    if (table(k)) {
      nxt = k; wipe = 0; hold = 0;
      cv.dataset.ball = BALLS[k].name;        // видно в инспекторе, какой мяч на экране
    }
  }
  function nextBall() { want((cur + 1) % BALLS.length); }

  // клик по мячу — сразу следующий. Канвас лежит под текстом (z-index), поэтому
  // заголовок и ссылки кликаются по-прежнему
  cv.style.pointerEvents = 'auto';
  cv.style.cursor = 'pointer';
  cv.dataset.ball = BALLS[0].name;
  var queued = false;                         // клик во время перехода не теряем, а ждём им
  cv.addEventListener('click', function (e) {
    e.preventDefault();
    if (nxt >= 0) { queued = true; return; }
    hold = HOLD; nextBall();
  });

  // ================= сцена =================
  var rot = 0, tilt = -0.32, spin = 0.16;    // рад/с — оборот примерно за 40 секунд
  var px = 0, py = 0, tx = 0, ty = 0;
  var W = 0, H = 0, DPR = 1, R = 0;

  function fit() {
    DPR = Math.min(devicePixelRatio || 1, 2);
    var rect = cv.getBoundingClientRect();
    W = Math.max(1, Math.round(rect.width));
    H = Math.max(1, Math.round(rect.height));
    cv.width = Math.round(W * DPR);
    cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    R = Math.min(W, H) * 0.46;
  }
  fit();
  addEventListener('resize', fit, { passive: true });

  addEventListener('pointermove', function (e) {
    tx = (e.clientX / innerWidth - 0.5) * 2;
    ty = (e.clientY / innerHeight - 0.5) * 2;
  }, { passive: true });

  // за кадром не считаем: мяч висит на первом экране, а книга длинная
  var live = true;
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (es) { live = es[0].isIntersecting; }).observe(cv);
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) last = 0; });

  // Страховка на слабой машине. 27 000 точек — это осознанно много, и на быстром
  // ноутбуке кадр укладывается, но проверять это гаданием нельзя. Считаем средний кадр
  // за секунду, и если он вышел за 20 мс, берём каждую вторую точку. Прореживание идёт
  // ШАГОМ по спирали Фибоначчи, а не обрезкой конца массива: точки упорядочены от полюса
  // к полюсу, и обрезка срезала бы мячу низ, а шаг оставляет ровное облако вполовину реже.
  var stride = 1, tsum = 0, tcnt = 0;

  var last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (!live) return;
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;

    if (stride === 1) {
      tsum += dt; tcnt++;
      if (tcnt >= 60) {
        if (tsum / tcnt > 0.02) stride = 2;
        tsum = 0; tcnt = 0;
      }
    }

    buildStep();                              // добираем таблицу следующего мяча

    if (nxt >= 0) {
      wipe += dt;
      if (wipe >= WIPE) {
        cur = nxt; nxt = -1; wipe = 0;
        if (queued) { queued = false; hold = HOLD; nextBall(); }
      }
    } else {
      hold += dt;
      if (hold >= HOLD) { hold = 0; nextBall(); }
      else if (hold > HOLD - 1.6) table((cur + 1) % BALLS.length);   // готовим заранее
    }

    px += (tx - px) * 0.05; py += (ty - py) * 0.05;
    if (!reduce) rot += (spin + px * 0.06) * dt;
    var tl = tilt + py * 0.22;

    var cr = Math.cos(rot), sr = Math.sin(rot);
    var ct = Math.cos(tl), st = Math.sin(tl);
    var cx = W / 2, cy = H / 2;

    var A = BALLS[cur], B = nxt >= 0 ? BALLS[nxt] : null;
    var tabA = A.tab, tabB = B ? B.tab : null, palA = A.pal, palB = B ? B.pal : null;
    var alA = A.al, alB = B ? B.al : null, szA = A.sz, szB = B ? B.sz : null;
    // фронт идёт по экрану слева направо и с запасом за края, чтобы дошёл до всех точек
    var front = B ? (wipe / WIPE) * 1.34 - 0.17 : -1;

    ctx.clearRect(0, 0, W, H);
    for (var pass = 0; pass < 2; pass++) {
      for (var q = 0; q < N; q += stride) {
        var x = P[q * 3], y0 = P[q * 3 + 1], z = P[q * 3 + 2];
        var x1 = x * cr + z * sr, z1 = z * cr - x * sr;      // вокруг оси Y
        var y1 = y0 * ct - z1 * st, z2 = z1 * ct + y0 * st;  // наклон оси
        var far = z2 < 0;
        if ((pass === 0) !== far) continue;

        var depth = (z2 + 1) / 2;                            // 0 дальняя, 1 ближняя
        var role, pal, al, sz;
        if (B && (x1 + 1) * 0.5 + JIT[q] * 0.16 - 0.08 < front) {
          role = tabB[q]; pal = palB; al = alB; sz = szB;
        } else {
          role = tabA[q]; pal = palA; al = alA; sz = szA;
        }

        var a = al[role] * (0.3 + depth * 0.7);
        if (far) a *= 0.42;
        var lev = a * LEV | 0; if (lev > LEV - 1) lev = LEV - 1;
        if (lev < 0) lev = 0;

        // размер почти не падает с глубиной: сильное уменьшение делало дальние точки
        // меньше пикселя, браузер размазывал их сглаживанием, и рисунок на полусфере,
        // отвёрнутой от нас, исчезал совсем
        var s = sz[role] * (0.82 + depth * 0.36);
        ctx.fillStyle = pal[role][lev];
        ctx.fillRect(cx + x1 * R, cy + y1 * R, s, s);
      }
    }
  }
  requestAnimationFrame(frame);
})();
