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

  var GOLD = Math.PI * (3 - Math.sqrt(5));

  /* Облако точек. Их ДВА: большое для шара на первом экране и маленькое для курсора.
   *
   * Сначала курсор брал каждую девятую точку большого облака — и это была ошибка,
   * видимая сразу: у шага по спирали Фибоначчи снова проступают её витки, и вместо
   * футбольных панелей на курсоре крутились концентрические полосы. Спираль надо
   * строить под своё число точек, и сбивать её случайным сдвигом ТОЖЕ под своё:
   * сдвиг задан долей среднего расстояния между точками (~sqrt(4π/n)), поэтому на
   * трёх тысячах он в три раза крупнее, чем на двадцати семи, — как и требуется.
   */
  function makeCloud(n) {
    var P = new Float32Array(n * 3), J = new Float32Array(n);
    var EPS = 0.62 * Math.sqrt(4 * Math.PI / n);
    for (var i = 0; i < n; i++) {
      var t = (i + 0.5) / n;
      var y = 1 - 2 * t;
      var r = Math.sqrt(Math.max(0, 1 - y * y));
      var a = GOLD * i;
      var x = Math.cos(a) * r + (Math.random() - 0.5) * EPS;
      var z = Math.sin(a) * r + (Math.random() - 0.5) * EPS;
      y += (Math.random() - 0.5) * EPS;
      var len = Math.sqrt(x * x + y * y + z * z) || 1;     // возвращаем точку на сферу
      P[i * 3] = x / len; P[i * 3 + 1] = y / len; P[i * 3 + 2] = z / len;
      J[i] = Math.random();                                 // свой сдвиг во фронте смены
    }
    return { n: n, P: P, J: J, tab: [] };
  }

  var N = innerWidth < 700 ? 11000 : 27000;
  var BIG = makeCloud(N);                                   // шар первого экрана
  var SMALL = makeCloud(innerWidth < 700 ? 1600 : 3000);    // курсор
  var P = BIG.P, JIT = BIG.J;
  // огрубление рисунка: у курсора мяч в семь раз мельче, значит и шов должен быть
  // в разы шире в долях радиуса, иначе он уходит в один пиксель
  BIG.wide = 1;
  SMALL.wide = 2.6;

  /* ================= рисунки мячей =================
   *
   * ШИРИНА РИСУНКА ЗАВИСИТ ОТ РАЗМЕРА МЯЧА. Все пороги ниже заданы в единицах сферы,
   * то есть в долях радиуса. На шаре в 860 пикселей шов толщиной 0.028 радиуса — это
   * 12 пикселей, всё видно; на курсоре в 120 пикселей — меньше двух, и баскетбольный
   * мяч выглядел ровно оранжевым шаром без единого шва. Поэтому у маленького облака
   * рисунок огрубляется множителем WIDE, а у гольфа заодно РЕЖЕТСЯ ЧИСЛО ЛУНОК: шире
   * сделать лунку недостаточно, их 380 штук, и растянутые лунки просто съели бы мяч.
   * Число подобрано из того, что среднее расстояние между центрами падает как 1/√K.
   */
  var WIDE = 1;

  /* --- футбол: НАСТОЯЩАЯ раскройка — 12 пятиугольников и 20 шестиугольников
   *     (усечённый икосаэдр). Прежняя версия рисовала швы тремя наклонёнными большими
   *     кругами с волной: издалека похоже на панели последних чемпионатов, но мяч
   *     футбольным не читался — не было ни пятиугольников, ни правильной сетки.
   *
   *     Считается это без всякой геометрии граней. Раскройка мяча — это диаграмма
   *     Вороного 32 точек: центры пятиугольников — вершины икосаэдра, центры
   *     шестиугольников — вершины додекаэдра (они же центры граней икосаэдра).
   *     Панель точки = её ближайший центр; шов = место, где два ближайших центра
   *     почти равноудалены. Шов при этом получается ровной ширины сам собой.
   */
  var SOCCER = (function () {
    var f = (1 + Math.sqrt(5)) / 2, g = 1 / f, pts = [], kind = [];
    function add(x, y, z, k) {
      var l = Math.sqrt(x * x + y * y + z * z);
      pts.push(x / l, y / l, z / l); kind.push(k);
    }
    var s, u;
    for (s = -1; s <= 1; s += 2) for (u = -1; u <= 1; u += 2) {      // икосаэдр → 12
      add(0, s, u * f, 0); add(s, u * f, 0, 0); add(u * f, 0, s, 0);
    }
    var a, b, c;
    for (a = -1; a <= 1; a += 2) for (b = -1; b <= 1; b += 2) for (c = -1; c <= 1; c += 2) add(a, b, c, 1);
    for (s = -1; s <= 1; s += 2) for (u = -1; u <= 1; u += 2) {      // додекаэдр → 20
      add(0, s * g, u * f, 1); add(s * g, u * f, 0, 1); add(u * f, 0, s * g, 1);
    }
    return { p: new Float32Array(pts), k: kind };
  })();
  function football(x, y, z) {
    var p = SOCCER.p, b1 = -2, b2 = -2, k1 = 0;
    for (var j = 0; j < p.length; j += 3) {
      var dot = x * p[j] + y * p[j + 1] + z * p[j + 2];
      if (dot > b1) { b2 = b1; b1 = dot; k1 = SOCCER.k[j / 3]; }
      else if (dot > b2) b2 = dot;
    }
    // порог взят замером: разница скалярных произведений до первого и второго центра
    // растёт от нуля на самой границе, и 0.009 отдаёт шву около 13 % площади. На глаз
    // здесь ошибиться легко — 0.055 съедало 70 % шара, и мяч был одним сплошным швом
    if (b1 - b2 < 0.009 * WIDE) return 0; // равноудалена от двух панелей — это шов
    return k1 === 0 ? 1 : 2;              // пятиугольник темнее, шестиугольник светлее
  }

  // --- гольф: решётка лунок. Центры — та же спираль Фибоначчи, только редкая:
  //     лунки ложатся ровно, без сгущения у полюсов
  function dimples(K) {
    var arr = new Float32Array(K * 3);
    for (var j = 0; j < K; j++) {
      var yy = 1 - 2 * (j + 0.5) / K;
      var rr = Math.sqrt(Math.max(0, 1 - yy * yy));
      var aa = GOLD * j;
      arr[j * 3] = Math.cos(aa) * rr; arr[j * 3 + 1] = yy; arr[j * 3 + 2] = Math.sin(aa) * rr;
    }
    return arr;
  }
  // у мелкого мяча лунок должно быть МЕНЬШЕ, а не только шире: среднее расстояние
  // между центрами падает как 1/√K, отсюда и делитель
  var DIM_BIG = dimples(380), DIM_SMALL = dimples(Math.round(380 / (SMALL.wide * SMALL.wide)));
  var DIMPLE = DIM_BIG;
  BIG.dim = DIM_BIG;
  SMALL.dim = DIM_SMALL;
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
    if (d < 0.072 * WIDE) return 0;                 // дно лунки — тусклое, читается ямкой
    if (d < 0.098 * WIDE) return 2;                 // ребро между лунками — самое светлое
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
  function nearCurve(arr, x, y, z) {
    var m = -1, mi = 0;
    for (var j = 0; j < arr.length; j += 3) {
      var dot = x * arr[j] + y * arr[j + 1] + z * arr[j + 2];
      if (dot > m) { m = dot; mi = j / 3; }
    }
    _sd = Math.sqrt(Math.max(0, 2 - 2 * m)); _si = mi;
  }
  function tennis(x, y, z) {
    nearCurve(SEAMPTS, x, y, z);
    return _sd < 0.05 * WIDE ? 2 : (_sd < 0.088 * WIDE ? 1 : 0);
  }
  // бейсбол: белый мяч, тонкая борозда шва и КРАСНЫЕ СТЕЖКИ поперёк неё. Первая версия
  // закрашивала красным всю полосу вдоль шва — получался «мяч с красной лентой», и
  // рядом с теннисным (у него тот же шов) их было не различить
  function baseball(x, y, z) {
    nearCurve(SEAMPTS, x, y, z);
    if (_sd < 0.017 * WIDE) return 0;                // сама борозда — почти пропуск
    // шаг стежков тоже крупнеет: на мелком мяче девять точек кривой — это полстежка
    var per = Math.round(9 * WIDE), on = Math.round(4 * WIDE);
    if (_sd < 0.065 * WIDE && (_si % per) < on) return 2;
    return 1;                                        // белая кожа
  }

  // --- волейбол: шесть групп полос, как на гранях куба. Определяем «грань» по самой
  //     большой координате, внутри грани — три полосы; направление полос у соседних
  //     граней разное, поэтому мяч и читается волейбольным
  function volley(x, y, z) {
    var ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
    var mx = Math.max(ax, ay, az);
    var mid = ax + ay + az - mx - Math.min(ax, ay, az);
    if (mx - mid < 0.05 * WIDE) return 0;            // ребро куба — глубокий шов, почти пропуск
    var w = mx === ax ? y : (mx === ay ? z : x);     // поперечная координата полосы
    var aw = Math.abs(w);
    if (Math.abs(aw - 0.26) < 0.026 * WIDE) return 0; // разрез между полосами
    return aw > 0.26 ? 1 : 2;                        // крайние полосы в цвете, средняя белая
  }

  /* --- баскетбол: четыре шва — экватор, меридиан и два изогнутых кольца между ними.
   *
   *     Прежняя версия мерила расстояние «до плоскости с волной»: |z + 0.34·sin(2·lat)|.
   *     Это не расстояние до кривой, а значение функции, и там, где её уровень идёт по
   *     поверхности почти касательно, полоса раздувается — на шаре появлялись тёмные
   *     КЛИНЬЯ вместо швов. Именно это и было видно как ошибка. Теперь швы заданы
   *     выборкой точек самих кривых, и ширина всюду одинаковая — как у тенниса.
   */
  var BASKETPTS = (function () {
    var K = 150, A = 0.42, out = [], j, t;
    for (j = 0; j < K; j++) { t = j / K * Math.PI * 2; out.push(Math.cos(t), 0, Math.sin(t)); }
    for (j = 0; j < K; j++) { t = j / K * Math.PI * 2; out.push(Math.cos(t), Math.sin(t), 0); }
    // «меридианные» кольца с волной: долгота гуляет по широте, поэтому шов изогнут
    [Math.PI / 4, 3 * Math.PI / 4].forEach(function (L) {
      for (var i2 = 0; i2 < K; i2++) {
        var s = i2 / K * Math.PI * 2, lon = L + A * Math.sin(2 * s), c = Math.cos(s);
        out.push(c * Math.cos(lon), Math.sin(s), c * Math.sin(lon));
      }
    });
    return new Float32Array(out);
  })();
  function basket(x, y, z) {
    nearCurve(BASKETPTS, x, y, z);
    // шов — пропуск, поле — самое яркое
    return _sd < 0.028 * WIDE ? 0 : (_sd < 0.055 * WIDE ? 1 : 2);
  }

  /* Роль 0/1/2 у каждого мяча своя, и это не путаница, а следствие фона. Книга
   * почти чёрная, поэтому тёмная точка не рисует линию — она рисует ПРОПУСК. У мяча
   * со светлым полем (гольф, волейбол, баскетбол) шов и есть провал: ему отдана
   * самая тусклая роль. У мяча с тёмным полем (футбол) наоборот — шов светлый.
   * Поэтому яркость `al` и размер `sz` задаются каждому мячу отдельно: одна общая
   * шкала делала футбол читаемым, а гольф — тёмным шаром в белых крапинах.
   */
  // Порядок не случайный: у тенниса и бейсбола ОДИН И ТОТ ЖЕ шов, и подряд они читались
  // как один мяч, который зачем-то покраснел. Теперь между ними два других.
  var BALLS = [
    { name: 'футбол',    fn: football, col: ['#0b1230', '#2b3fa8', '#d3e2ff'],
      al: [0.10, 0.52, 0.98], sz: [0.88, 1.00, 1.25] },
    { name: 'баскетбол', fn: basket,   col: ['#1a1109', '#f4b277', '#e8802c'],
      al: [0.12, 0.66, 0.94], sz: [0.88, 1.05, 1.10] },
    { name: 'теннис',    fn: tennis,   col: ['#cbe94b', '#eefaa6', '#ffffff'],
      al: [0.62, 0.84, 1.00], sz: [0.95, 1.10, 1.40] },
    { name: 'волейбол',  fn: volley,   col: ['#1d2952', '#6f8ae4', '#f2f7ff'],
      al: [0.18, 0.76, 0.96], sz: [0.90, 1.05, 1.10] },
    { name: 'бейсбол',   fn: baseball, col: ['#171d2c', '#eef3fb', '#ff3a20'],
      al: [0.10, 0.80, 1.00], sz: [0.88, 0.98, 1.60] },
    { name: 'гольф',     fn: golf,     col: ['#4a5a71', '#cfdcec', '#ffffff'],
      al: [0.22, 0.62, 0.98], sz: [0.88, 1.00, 1.20] }
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

  /* ================= таблицы роли =================
   * Роль точки (поле / полутон / шов) считается ОДИН раз на облако и мяч: у гольфа это
   * поиск ближайшей из 380 лунок, у бейсбола и баскетбола — ближайшей из сотен точек
   * кривой. Каждый кадр такое не посчитать.
   *
   * Большое облако набирается порциями по кадрам: полная таблица — это до 20 мс, а
   * пропущенный кадр виден. Маленькому облаку курсора хватает одного прохода (доли
   * миллисекунды), и он делается сразу, когда мяч понадобился: ждать на разлёте нечем.
   */
  function fillTable(cl, k) {
    var b = BALLS[k], u = new Uint8Array(cl.n), P2 = cl.P;
    WIDE = cl.wide; DIMPLE = cl.dim;             // рисунок под размер этого мяча
    for (var j = 0; j < cl.n; j++) u[j] = b.fn(P2[j * 3], P2[j * 3 + 1], P2[j * 3 + 2]);
    WIDE = 1; DIMPLE = DIM_BIG;
    cl.tab[k] = u;
    return u;
  }
  function smallTable(k) { return SMALL.tab[k] || fillTable(SMALL, k); }

  var build = -1, buildAt = 0, buildBuf = null, CHUNK = 2200;
  function table(k) {                          // таблица большого облака, если готова
    if (BIG.tab[k]) return BIG.tab[k];
    if (build !== k) { build = k; buildAt = 0; buildBuf = new Uint8Array(N); }
    return null;
  }
  function buildStep() {
    if (build < 0) return;
    var b = BALLS[build], end = Math.min(N, buildAt + CHUNK);
    for (var j = buildAt; j < end; j++) buildBuf[j] = b.fn(P[j * 3], P[j * 3 + 1], P[j * 3 + 2]);
    buildAt = end;
    if (end >= N) { BIG.tab[build] = buildBuf; buildBuf = null; build = -1; }
  }
  fillTable(BIG, 0);                           // первый мяч нужен уже в первом кадре

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

  var mx = innerWidth * 0.72, my = innerHeight * 0.3;   // курсор в пикселях окна
  addEventListener('pointermove', function (e) {
    tx = (e.clientX / innerWidth - 0.5) * 2;
    ty = (e.clientY / innerHeight - 0.5) * 2;
    mx = e.clientX; my = e.clientY;
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
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    // шар за кадром не рисуем, а КУРСОР работает на всей книге — поэтому кадр целиком
    // больше не пропускаем, пропускается только отрисовка первого экрана
    if (!live) { drawCursor(dt); return; }

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

    // фронт идёт по экрану слева направо и с запасом за края, чтобы дошёл до всех точек
    var front = nxt >= 0 ? (wipe / WIPE) * 1.34 - 0.17 : -1;
    ctx.clearRect(0, 0, W, H);
    paint(ctx, BIG, W / 2, H / 2, R, rot, tl, cur, nxt, front, stride, 0, 1);

    drawCursor(dt);
  }
  requestAnimationFrame(frame);

  /* ================= общая отрисовка облака =================
   * Одним кодом рисуется и шар на первом экране, и курсор-мяч: различаются они только
   * центром, радиусом, прореживанием и разлётом. Второй экземпляр этих сорока строк
   * означал бы, что каждую настройку внешнего вида надо помнить в двух местах.
   *   expand — разлёт: точка уезжает от центра по своему направлению, у каждой свой
   *            коэффициент (JIT), поэтому облако рвётся неровно, а не раздувается шаром;
   *   fade   — общая прозрачность, ею гасим облако на разлёте.
   */
  function paint(c, cl, cx, cy, RR, rt, tl, kA, kB, front, step, expand, fade) {
    var cr = Math.cos(rt), sr = Math.sin(rt), ct = Math.cos(tl), st = Math.sin(tl);
    var A = BALLS[kA], B = kB >= 0 ? BALLS[kB] : null;
    var P = cl.P, JIT = cl.J, n = cl.n;
    var tabA = cl.tab[kA], palA = A.pal, alA = A.al, szA = A.sz;
    var tabB = B ? cl.tab[kB] : null, palB = B ? B.pal : null, alB = B ? B.al : null, szB = B ? B.sz : null;
    if (!tabA) return;
    for (var pass = 0; pass < 2; pass++) {
      for (var q = 0; q < n; q += step) {
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

        var a = al[role] * (0.3 + depth * 0.7) * fade;
        if (far) a *= 0.42;
        var lev = a * LEV | 0; if (lev > LEV - 1) lev = LEV - 1;
        if (lev < 0) lev = 0;

        // размер почти не падает с глубиной: сильное уменьшение делало дальние точки
        // меньше пикселя, браузер размазывал их сглаживанием, и рисунок на полусфере,
        // отвёрнутой от нас, исчезал совсем
        var s = sz[role] * (0.82 + depth * 0.36);
        var g = expand ? 1 + expand * (0.45 + JIT[q] * 1.9) : 1;
        c.fillStyle = pal[role][lev];
        c.fillRect(cx + x1 * RR * g, cy + y1 * RR * g, s, s);
      }
    }
  }

  /* ================= КУРСОР-МЯЧ =================
   * Курсор на книге — тот же мяч из точек, только маленький: 15 % высоты экрана.
   * Коснулся строки текста — разлетелся на точки и собрался уже следующим мячом.
   *
   * Три решения, которые тут неочевидны.
   *
   * 1. Точки берутся ИЗ ТОГО ЖЕ облака шагом по спирали, а не считаются заново. Значит
   *    и таблицы ролей общие: курсор ничего не пересчитывает, ему достаётся готовое.
   *
   * 2. «Коснулся строки», а не блока. У абзаца рамка — прямоугольник во всю ширину
   *    колонки, и по ней мяч взрывался в пустом воздухе справа от короткой последней
   *    строки. Настоящие строки даёт Range.getClientRects() — по ним и проверяем.
   *
   * 3. Проверка идёт по девяти точкам (центр и восемь по окружности) и не каждый кадр:
   *    попадание считает браузер, и на каждом кадре это лишняя работа впустую.
   */
  var fine = !window.matchMedia || matchMedia('(pointer: fine)').matches;
  var cc = null, cctx = null, CW = 0, CH = 0, CR = 0;
  var ci = 0, crot = 0, cx2 = mx, cy2 = my;
  var burst = -1, switched = false, cool = 0, armed = true, lastEl = null;
  var OUTT = 0.3, INN = 0.55;
  var TEXTY = ' H1 H2 H3 H4 P LI BLOCKQUOTE FIGCAPTION DT DD ';

  if (fine && !reduce) {
    cc = document.createElement('canvas');
    cc.className = 'ball-cursor';
    cc.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cc);
    cctx = cc.getContext('2d');
    smallTable(0);
    document.documentElement.classList.add('has-ball-cursor');
    fitCursor();
    addEventListener('resize', fitCursor, { passive: true });
  }

  function fitCursor() {
    if (!cc) return;
    CW = innerWidth; CH = innerHeight;
    cc.width = Math.round(CW * DPR); cc.height = Math.round(CH * DPR);
    cc.style.width = CW + 'px'; cc.style.height = CH + 'px';
    cctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    CR = CH * 0.075;                            // диаметр — 15 % высоты экрана
  }

  function lineHit(x, y, r) {
    for (var k = 0; k < 9; k++) {
      var ang = k * Math.PI / 4;
      var qx = k === 8 ? x : x + Math.cos(ang) * r * 0.92;
      var qy = k === 8 ? y : y + Math.sin(ang) * r * 0.92;
      if (qx < 0 || qy < 0 || qx > CW || qy > CH) continue;
      var el = document.elementFromPoint(qx, qy);
      while (el && TEXTY.indexOf(' ' + el.tagName + ' ') < 0) el = el.parentElement;
      if (!el || !el.textContent || !el.textContent.trim()) continue;
      var rng = document.createRange();
      rng.selectNodeContents(el);
      var rects = rng.getClientRects();
      for (var j = 0; j < rects.length; j++) {
        var b = rects[j];
        if (b.width < 2 || b.height < 2) continue;
        var nx = Math.max(b.left, Math.min(x, b.right));
        var ny = Math.max(b.top, Math.min(y, b.bottom));
        if ((x - nx) * (x - nx) + (y - ny) * (y - ny) < r * r) return el;
      }
    }
    return null;
  }

  var probe = 0;
  function drawCursor(dt) {
    if (!cc) return;

    cx2 += (mx - cx2) * 0.24; cy2 += (my - cy2) * 0.24;
    crot += 0.55 * dt;

    // Взрыв — на КАСАНИЕ, а не на присутствие. Первая версия проверяла только паузу
    // между взрывами: курсор, оставленный на строке, разлетался каждую секунду без конца.
    // Теперь строка «разряжается»: повторно рвёт только другая строка или возврат
    // после выхода в пустое место. Пауза оставлена короткой — от мельтешения при
    // быстром проходе по абзацу.
    if (cool > 0) cool -= dt;
    if (++probe % 4 === 0) {
      var over = lineHit(cx2, cy2, CR);
      if (!over) { armed = true; lastEl = null; }
      else if (burst < 0 && cool <= 0 && (armed || over !== lastEl)) {
        burst = 0; switched = false; armed = false; lastEl = over; cool = 0.45;
      }
    }

    var expand = 0, fade = 1;
    if (burst >= 0) {
      burst += dt;
      if (burst < OUTT) {                        // разлёт
        var t1 = burst / OUTT;
        expand = 1.7 * (1 - (1 - t1) * (1 - t1));   // резко вначале, потом мягче
        fade = 1 - t1 * 0.94;
      } else if (burst < OUTT + INN) {           // сборка — уже следующим мячом
        if (!switched) { switched = true; nextCursorBall(); }
        var t2 = (burst - OUTT) / INN;
        expand = 1.7 * (1 - t2) * (1 - t2);
        fade = 0.06 + 0.94 * t2;
      } else {
        burst = -1;
      }
    }

    cctx.clearRect(0, 0, CW, CH);
    paint(cctx, SMALL, cx2, cy2, CR, crot, -0.28, ci, -1, -1, 1, expand, fade);
  }

  function nextCursorBall() {
    ci = (ci + 1) % BALLS.length;
    smallTable(ci);                            // маленькая таблица считается мгновенно
    if (cc) cc.dataset.ball = BALLS[ci].name;
  }
})();
