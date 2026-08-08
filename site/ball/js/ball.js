/* ГЛАВНЫЙ МЯЧ НА ПЕРВОМ ЭКРАНЕ — облако точек, как глобус на playdisplay.com.
 *
 * Почему точками, а не картинкой или CSS-сферой: точка — язык всей студии, и мяч,
 * собранный из точек, читается как продолжение сайта, а не как вставка. Прежний мяч был
 * сложен из градиентов и пятиугольников CSS: он не вращался, а лишь наклонялся за курсором.
 *
 * Что здесь важно по существу:
 *  1. Точки распределены по сфере СПИРАЛЬЮ ФИБОНАЧЧИ. Наивный способ (случайные широта и
 *     долгота) сгущает точки у полюсов — сфера выглядит как клубок ниток.
 *  2. Рисунок панелей — как у мячей последних чемпионатов: несколько крупных изогнутых
 *     панелей, разделённых широкими швами. Шов считается расстоянием до трёх наклонённых
 *     больших кругов, а «изгиб» даётся волной по долготе — прямые швы выглядели бы как
 *     школьный глобус, а не как современный мяч.
 *  3. Вращение ПОЛНОЕ и непрерывное, вокруг наклонённой оси: мяч в игре не замирает.
 *     Курсор лишь чуть подкручивает скорость и наклон — «живой», но не управляемый объект.
 *  4. Рисуем в канвас 2D ортографической проекцией и сортируем по глубине через два
 *     проходa (дальняя половина тусклее). Три.js ради одной сферы тянуть незачем.
 */
(function () {
  var cv = document.getElementById('ballCanvas');
  if (!cv || !cv.getContext) return;
  var ctx = cv.getContext('2d');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- облако точек ----------
  var N = innerWidth < 700 ? 1500 : 3200;
  var P = new Float32Array(N * 3);      // координаты на единичной сфере
  var SEAM = new Float32Array(N);       // 1 — точка на шве, 0 — в середине панели
  var GOLD = Math.PI * (3 - Math.sqrt(5));

  function seamValue(x, y, z) {
    // три наклонённых больших круга + волна по долготе: швы получаются изогнутыми
    var lon = Math.atan2(z, x), lat = Math.asin(Math.max(-1, Math.min(1, y)));
    var bend = 0.22 * Math.sin(3 * lon + 1.7 * lat) + 0.12 * Math.sin(2 * lat - 0.6);
    var planes = [
      [0.00, 1.00, 0.00],
      [0.87, 0.30, 0.39],
      [-0.52, 0.34, 0.78]
    ];
    var best = 1;
    for (var i = 0; i < planes.length; i++) {
      var n = planes[i];
      var d = Math.abs(x * n[0] + y * n[1] + z * n[2] + bend * 0.35);
      if (d < best) best = d;
    }
    return best;                        // 0 — точно на шве
  }

  for (var i = 0; i < N; i++) {
    var t = (i + 0.5) / N;
    var y = 1 - 2 * t;
    var r = Math.sqrt(Math.max(0, 1 - y * y));
    var a = GOLD * i;
    var x = Math.cos(a) * r, z = Math.sin(a) * r;
    P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z;
    var s = seamValue(x, y, z);
    SEAM[i] = s < 0.055 ? 1 : (s < 0.1 ? 0.45 : 0);
  }

  // ---------- сцена ----------
  var rot = 0, tilt = -0.32, spin = 0.16;   // рад/с — оборот примерно за 40 секунд
  var px = 0, py = 0, tx = 0, ty = 0;       // сглаженный курсор
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
    new IntersectionObserver(function (es) { live = es[0].isIntersecting; })
      .observe(cv);
  }
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) last = 0;
  });

  var last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (!live) return;
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;

    px += (tx - px) * 0.05; py += (ty - py) * 0.05;
    if (!reduce) rot += (spin + px * 0.06) * dt;     // курсор чуть подкручивает
    var tl = tilt + py * 0.22;

    var cr = Math.cos(rot), sr = Math.sin(rot);
    var ct = Math.cos(tl), st = Math.sin(tl);
    var cx = W / 2, cy = H / 2;

    ctx.clearRect(0, 0, W, H);
    // два прохода: сначала дальняя половина, потом ближняя — глубина без сортировки
    for (var pass = 0; pass < 2; pass++) {
      for (var i = 0; i < N; i++) {
        var x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
        var x1 = x * cr + z * sr, z1 = z * cr - x * sr;      // вокруг оси Y
        var y1 = y * ct - z1 * st, z2 = z1 * ct + y * st;    // наклон оси
        var far = z2 < 0;
        if ((pass === 0) !== far) continue;
        var sx = cx + x1 * R, sy = cy + y1 * R;
        var depth = (z2 + 1) / 2;                            // 0 дальняя точка, 1 ближняя
        var seam = SEAM[i];
        var size = (seam ? 1.9 : 1.25) * (0.55 + depth * 0.75);
        var alpha = (seam ? 0.85 : 0.4) * (0.16 + depth * 0.84);
        if (far) alpha *= 0.42;
        ctx.globalAlpha = alpha;
        // шов светлый, панель — в синеве бренда
        ctx.fillStyle = seam === 1 ? '#eaf1ff' : (seam ? '#9fb6ff' : '#3f5bd8');
        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, 6.283);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
  requestAnimationFrame(frame);
})();
