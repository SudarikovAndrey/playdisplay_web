// ============================================================================
// PlayDisplay — ПРОЦЕДУРНЫЙ МИР ТРАССЫ (по ТЗ от 28.07)
// ----------------------------------------------------------------------------
// Ядро генерации: граф маршрута → план уровня по правилам → чанки-ситуации →
// облако точек слоями + ОТДЕЛЬНАЯ упрощённая коллизия.
//
// Чистая математика и TypedArray. Ни Three.js, ни DOM здесь нет: этот файл
// одинаково работает в главном потоке, в Web Worker и в Node (для тестов).
// Тот, кто вызывает, сам заливает готовые массивы в GPU.
//
// ПОЧЕМУ ТАК, А НЕ КАК БЫЛО (по замерам аудита):
//   • чанк был 24 юнита — в него не влезает ни каньон, ни тоннель, ни каверна.
//     Отсюда и «примитивы, разбросанные повсюду»: места под форму просто не было.
//     Теперь чанк 140–260 юнитов (ТЗ §3).
//   • формы спавнились по вероятности на чанк → до 16 форм в секунду из словаря
//     в три фигуры. Теперь состав уровня решает план по правилам фаз (ТЗ §7).
//   • 51 draw call при трёх формах, потому что каждая форма — свой THREE.Points
//     со своим материалом. Теперь на чанк отдаётся ОДИН слитый буфер (ТЗ §10).
//
// ГЕОМЕТРИЯ: вместо полноценного SDF — пол + потолок + список солидов.
// Этого хватает на все требуемые ситуации (тоннель = пол+потолок сомкнулись,
// арка/мост = солид над коридором, каверна = высокий потолок с дырой), и это
// в разы дешевле и предсказуемее, чем raymarch. ТЗ §9 разрешает SDF только на
// этапе генерации; здесь та же идея, но в аналитическом виде.
// ============================================================================
(function (root) {
'use strict';

// ─── базовая математика ─────────────────────────────────────────────────────
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clamp01 = v => clamp(v, 0, 1);
const smoothstep = (a, b, t) => { t = clamp01((t - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const mix = lerp;

// Детерминированный RNG: один и тот же seed обязан давать один и тот же уровень
// (ТЗ §36.15). Mulberry32 — быстрый и с приличным распределением.
function makeRng(seed) {
  let s = (seed | 0) || 1;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// хеш-шум (тот же, что в игре — чтобы фактура мира не «поехала» относительно сцены)
function hash(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function noise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  return hash(xi, zi) * (1 - u) * (1 - v) + hash(xi + 1, zi) * u * (1 - v)
       + hash(xi, zi + 1) * (1 - u) * v + hash(xi + 1, zi + 1) * u * v;
}
function fbm(x, z, oct, gain) {
  let a = 0, amp = 1, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { a += noise(x * f, z * f) * amp; n += amp; amp *= (gain || 0.5); f *= 2.03; }
  return a / n;
}
function ridged(x, z, oct, sharp) {
  let a = 0, amp = 1, f = 1, n = 0;
  for (let i = 0; i < oct; i++) {
    let v = 1 - Math.abs(noise(x * f, z * f) * 2 - 1);
    a += Math.pow(v, sharp || 2) * amp; n += amp; amp *= 0.52; f *= 2.05;
  }
  return a / n;
}

// ─── КОНФИГ. ТЗ §35: все параметры снаружи, магических чисел в коде нет ──────
const CONFIG = {
  chunk: { lenMin: 140, lenMax: 260, transition: 24 },   // §3 длина, §31 зона стыковки
  world: { behind: 1, ahead: 4, halfWidth: 110 },         // §19 сколько чанков держим
  ship:  { floorClear: 7, ceilClear: 7, radius: 2.2, yMin: 3, yMax: 52 },
  // §12: плотность НЕ равномерная. Вдоль коридора густо, на периферии редко —
  // это и даёт детализацию без роста общего числа точек.
  density: {
    base: 0.53,            // шаг сетки у самого коридора (юнитов между точками)
    farMul: 3.4,           // во сколько раз шаг крупнее на периферии
    nearBand: 46,          // полуширина «густой» полосы вокруг маршрута
    farBand: 105,          // где плотность выходит на минимум
    lodStep: [1, 1.5, 2.3, 3.6],  // §22: множитель шага на LOD 0..3
    lodEdges: [1, 0.6, 0.15, 0],  // доля акцентных точек по LOD
    ceilMul: 1.35,         // потолок реже пола: он дальше от глаза и не несёт формы
    budget: 420000,        // §23 бюджет активных точек (на референсе 342k)
    // ПЯТНИСТАЯ ПЛОТНОСТЬ: раньше плотность падала ТОЛЬКО монотонно от оси к краю
    // (far), и при равномерном шаге сетки это читалось как ровная пыль по всему
    // кадру — «жидко», даже когда общий бюджет точек был выше референса. На
    // референсе плотность идёт СГУСТКАМИ — где-то заметно гуще, где-то почти
    // пусто, и именно эта пятнистость даёт ощущение фактуры породы, а не тумана.
    clumpFreq: 0.02,       // масштаб пятен (в юнитах^-1) — крупнее, чем micro/meso
    clumpMin: 0.56         // минимальная вероятность сохранить точку в «пустом» пятне
  },
  // §11 четыре слоя. A/B/C уходят в ОДИН буфер (различаются атрибутами role/size),
  // D (атмосфера) живёт отдельно и геометрией не считается.
  layer: { SURFACE: 0, SILHOUETTE: 1, EDGE: 2, SOLID: 3 },
  // §15 размеры и яркости по ролям. РАЗБРОС УВЕЛИЧЕН НАМЕРЕННО: на референсе кромки
  // гребней — почти белые и заметно крупнее, чем тусклая мелкая заливка склона.
  // При старом разбросе (1.4×/1.6×) на расстоянии в игре кромка и заливка сливались
  // в одинаковую морось — рельеф не читался, хотя бюджет точек был выполнен.
  look: {
    sizeSurface: 0.78, sizeSilh: 2.1, sizeEdge: 2.7, sizeSolid: 1.3,
    // На референсе освещённые склоны почти белые, а теневые уходят в тёмную бирюзу.
    // Поднял яркость и усилил контраст света (litPow<1 растягивает верх диапазона).
    brSurface: 0.5, brSilh: 1.5, brEdge: 1.9, brSolid: 1.05, litPow: 0.5, litFloor: 0.05,
    edgeLo: 0.55, edgeHi: 1.9,   // §переход по градиенту непрерывный, не бинарный порог
    faceShade: 0.42,       // затенение заливки крутых граней (кромку рисует контур)
    tintRoute: 0.3         // насколько ближе к цвету биома точки у маршрута
  },
  fork: { splitAt: 0.28, mergeAt: 0.84, spread: 52, riskNarrow: 0.55 },
  // ПРИРОДНАЯ ДИСТОРСИЯ (domain warp). Аналитические формы — стены, тор арки, капсулы —
  // сами по себе идеально ровные, и глаз мгновенно читает «примитив». Лечится не
  // добавлением шума К ВЫСОТЕ (это даёт лишь шершавость поверх той же ровной формы),
  // а искажением САМОЙ ОБЛАСТИ ВЫБОРКИ: спрашиваем высоту не в точке (x,z), а в
  // сдвинутой на fbm. Тогда «ровная» стена изгибается, дуга арки становится
  // выветренной, а колонна — кривой. Два масштаба: крупный гнёт силуэт, мелкий грызёт край.
  warp: { bigAmp: 26, bigFreq: 0.0042, smallAmp: 7, smallFreq: 0.017, solid: 3.2 },
  // ОТСЕЧЕНИЕ НЕВИДИМОГО (§12 «меньше точек за камерой и на дальних поверхностях»).
  // Летим на −z, поэтому дальние скаты гребней не видны никогда. Плюс горизонтная
  // проверка: точка в яме за близким гребнем не видна тоже. Это не только бюджет —
  // именно это даёт слоистые силуэты, ради которых всё и делается.
  // eyeBack — на каком удалении стоит камера при проверке. С 34 юнитами проверка была
  // почти бесполезна (перекрытия случаются на сотне и дальше): отсекала 10k, стала 18k,
  // и при этом СТАЛА БЫСТРЕЕ — меньше точек доходит до тяжёлого сэмплинга стеканий.
  cull: { enabled: true, backface: 0.06, horizon: true, steps: 16, eyeUp: 20, eyeBack: 140 },
  // ВЕРТИКАЛЬНЫЕ СТЕКАНИЯ на крутых гранях: на референсе обрывы «текут» вниз
  // колоннами точек. Сетка по (x,z) на вертикали вырождается, поэтому доливаем вдоль стены.
// prob — доля крутых точек,которых стекает колонна. Без неё стекания давали
  // 109k точек на чанк из 157k: стена превращалась в монолит и съедала весь бюджет.
  // На референсе обрывы «текут» ПРЕРЫВИСТО, отдельными струями — так и честнее, и дешевле.
  // prob 0.6 → 0.3 (29.07): вместе со сплошным акцентом по уклону стекания доливали
  // крутые грани до сплошного белого сугроба — теперь струи реже, стена дышит
  stripes: { slope: 1.5, step: 1.6, maxLen: 32, jitter: 0.6, prob: 0.3, maxN: 14 },
  // КОНТУРНЫЕ ЛИНИИ — главный приём референса. Форму там рисуют квази-непрерывные
  // ЦЕПОЧКИ ярких точек вдоль гребней и кромок обрывов (как штрих в скетче), а заливка
  // склонов тёмная и редкая. Статистическая перекраска отдельных точек сетки (edgeK)
  // даёт крапинку, а не линию: точки кромки не соседствуют. Поэтому отдельный проход:
  // идём по кэшу высот, находим гребни (локальный максимум поперёк трассы с заметным
  // превосходством prom) и кромки (полка → крутой скат), и укладываем ВДОЛЬ них точки
  // с мелким шагом step. Плюс горизонтали террас на крутых гранях (band) — слоистость
  // породы из переднего плана референса.
  ridge: {
    enabled: true,
    step: 1.1,        // шаг цепочки по z (юнитов) — почти сплошная линия
    silBand: 0.14,    // ширина силуэтной полосы над порогом отсечения (nDotV)
    prom: 2.8,        // минимальное превосходство гребня над окрестностью ±3 ячейки
    curv: 0.9,        // порог выпуклого перегиба (d²h/dx²) для кромки
    band: 9,          // шаг горизонталей террас по высоте
    bandEps: 0.42,    // толщина горизонтали
    jitter: 0.5,      // джиттер точек цепочки — не лазерный пунктир
    size: 2.4,        // размер точки контура (близко к sizeEdge)
    brBase: 1.15, brVar: 0.75,   // яркость: почти белая на выраженных гребнях
    budget: 11000,    // потолок точек контура на чанк
    streamProb: 0.3, streamN: 18 // струи вниз от кромок обрывов
  },
  // §7 фазы сложности и правила сборки
  phases: ['INTRO', 'LEARN', 'CHOICE', 'PRESSURE', 'RELEASE', 'COMBINATION', 'CLIMAX']
};

// ─── ТИПЫ ЧАНКОВ ────────────────────────────────────────────────────────────
const T = {
  TRANSITION: 'TRANSITION', CANYON: 'CANYON', GORGE: 'GORGE', TUNNEL: 'TUNNEL',
  ARCH: 'ARCH', SPIRES: 'SPIRES', CLIFF: 'CLIFF', BRIDGE: 'BRIDGE',
  CAVERN: 'CAVERN', FORK: 'FORK'
};

// ============================================================================
// ГРАФ МАРШРУТА (ТЗ §5). Геометрия строится ВОКРУГ него — поэтому проходимость
// не «проверяется потом», а гарантирована по построению.
// ============================================================================
function buildRoute(chunks) {
  const nodes = [], edges = [];
  let z = 0;
  // НЕПРЕРЫВНОСТЬ ВЫСОТ (§31 «без швов»): каждый чанк начинается на той высоте,
  // на которой кончился предыдущий. Без этого на стыке был уступ до 53 юнитов —
  // мир распадался на несвязанные куски. Обрыв честно уводит уровень вниз, но
  // держим в коридоре высот корабля, иначе трасса ушла бы под пол.
  let yLevel = 20;
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    c.zStart = z;
    c.zEnd = z + c.length;
    // Тянем к типовой высоте, но не рвём стык: 35% в сторону характера типа.
    // Обрыву нужен запас сверху, иначе нырять некуда — ему поднимаем минимум.
    c.yBase = clamp(yLevel + (c.yPref - 20) * 0.35, 14, 34);
    if (c.type === T.CLIFF) c.yBase = Math.max(c.yBase, 26);
    if (c.type === T.TRANSITION) c.yBase = lerp(c.yBase, 22, 0.4);
    // осевая линия чанка: плавная змейка, амплитуда от типа (в ущелье почти прямо)
    c.axis = axisFor(c);
    yLevel = clamp(c.axis(1)[1], 14, 34);
    nodes.push({ id: c.id, position: [c.axis(0)[0], c.axis(0)[1], z], radius: c.corridorW,
                 speedTarget: c.speedTarget, difficulty: c.difficulty, tags: [c.type] });
    if (i > 0) edges.push({ from: chunks[i - 1].id, to: c.id,
      routeType: c.risk ? 'risk' : 'safe', width: c.corridorW,
      curvature: c.curve, verticality: c.vertical, rewardMultiplier: c.risk ? 2 : 1 });
    z = c.zEnd;
  }
  return { nodes, edges, length: z };
}

// Осевая линия. РАЗДЕЛЕНА НА ДВЕ: center(t) — геометрическая середина чанка,
// вокруг неё лепится форма; axis(t) — линия ПОЛЁТА, она может уходить с середины.
// Разделение понадобилось из-за развилки: там ось обязана идти по одной из ветвей,
// а разделитель растёт по середине. Пока их путали, коридор влетал в разделитель
// (тест ловил «пол близко» 360 раз на 40 сидах).
function axisFor(c) {
  const r = makeRng(c.seed ^ 0x51ed);
  const ax = (r() - 0.5) * 2, ay = (r() - 0.5) * 2;
  const ph = r() * 6.283;
  c.center = function (t) {
    const x = Math.sin(t * Math.PI * c.curve + ph) * c.sway * ax;
    let y = c.yBase + Math.sin(t * Math.PI * 1.3 + ph * 0.7) * c.vertical * 6 * ay;
    if (c.type === T.CLIFF) {
      // ОБРЫВ (§6.7): нырок задаётся ТОЛЬКО здесь. Раньше он дублировался ещё и
      // в floor(), уклон складывался вдвое и коридор становился непролётным.
      y -= smoothstep(0.34, 0.62, t) * c.drop;
    }
    return [x, y];
  };
  // смещение линии полёта с середины: только у развилки, по безопасной ветке
  c.branchX = function (t) {
    if (c.type !== T.FORK) return 0;
    const s = smoothstep(CONFIG.fork.splitAt, 0.55, t) * smoothstep(CONFIG.fork.mergeAt, 0.66, t);
    return -c.params.spread * s;
  };
  return function (t) { const m = c.center(t); return [m[0] + c.branchX(t), m[1]]; };
}

// ============================================================================
// ПЛАН УРОВНЯ (ТЗ §7). Не случайная цепочка: правила фаз, «новое сначала
// показываем безопасно», после сложного — передышка, два узких подряд нельзя.
// ============================================================================
function planLevel(seed, count) {
  const r = makeRng(seed);
  const out = [];
  let seen = {};            // что игрок уже видел — «новое сначала безопасно»
  let lastNarrow = false;   // §7: не ставить подряд несколько узких
  let sinceRest = 0;

  const seq = ['INTRO', 'LEARN', 'LEARN', 'CHOICE', 'PRESSURE', 'RELEASE',
               'COMBINATION', 'PRESSURE', 'CLIMAX'];
  const n = count || 40;
  for (let i = 0; i < n; i++) {
    const phase = seq[Math.min(seq.length - 1, Math.floor(i / 2))];
    const prog = i / n;                       // 0..1 — общее усложнение
    let type;

    if (i === 0) type = T.TRANSITION;
    else if (phase === 'INTRO') type = r() < 0.5 ? T.TRANSITION : T.CANYON;
    else if (phase === 'RELEASE' || sinceRest >= 3) type = T.TRANSITION;
    else {
      // словарь растёт по фазам: приёмы вводятся по одному
      let pool = [T.CANYON, T.SPIRES];
      if (phase !== 'LEARN') pool = pool.concat([T.ARCH, T.BRIDGE]);
      if (phase === 'CHOICE' || phase === 'COMBINATION' || phase === 'CLIMAX') pool.push(T.FORK);
      if (phase === 'PRESSURE' || phase === 'COMBINATION' || phase === 'CLIMAX')
        pool = pool.concat([T.GORGE, T.TUNNEL, T.CLIFF, T.CAVERN]);
      type = pool[Math.floor(r() * pool.length) % pool.length];
      // §7 два узких подряд запрещены
      const narrow = (type === T.TUNNEL || type === T.GORGE);
      if (narrow && lastNarrow) type = T.CANYON;
    }
    const narrow = (type === T.TUNNEL || type === T.GORGE);
    const isRest = (type === T.TRANSITION);
    // §7 «новый элемент сначала показывается безопасно»: первый раз — шире и мягче
    const firstTime = !seen[type];
    seen[type] = true;

    out.push(makeChunkDef({
      index: i, seed: (seed * 2654435761 + i * 40503) | 0, type: type,
      phase: phase, progress: prog, firstTime: firstTime, rng: r
    }));
    lastNarrow = narrow;
    sinceRest = isRest ? 0 : sinceRest + 1;
  }
  return out;
}

// параметры конкретного чанка: тип + фаза + прогресс → числа
function makeChunkDef(o) {
  const r = makeRng(o.seed);
  const easy = o.firstTime ? 0.55 : 1;          // первый показ — мягче
  const d = clamp01(o.progress * 0.9 + 0.1) * easy;
  const len = Math.round(lerp(CONFIG.chunk.lenMin, CONFIG.chunk.lenMax, r()));
  const def = {
    id: o.type.toLowerCase() + '_' + o.index,
    yPref: 20,          // типовая желаемая высота; итоговую задаёт buildRoute (непрерывность)
    index: o.index, type: o.type, seed: o.seed, phase: o.phase,
    length: len, difficulty: d, firstTime: o.firstTime,
    // общие геометрические параметры
    corridorW: 0, sway: 0, curve: 0, vertical: 0, yBase: 0, drop: 0,
    risk: false, speedTarget: lerp(160, 300, d),
    params: {}
  };
  // тип задаёт «характер» — вот здесь и живёт разница ситуаций
  switch (o.type) {
    case T.TRANSITION:
      def.corridorW = lerp(52, 40, d); def.sway = 16; def.curve = 1.1;
      def.vertical = 0.5; def.yBase = 20;
      def.params = { wallH: lerp(26, 44, d), landmark: r() < 0.7 };
      break;
    case T.CANYON:
      def.corridorW = lerp(46, 30, d); def.sway = 22; def.curve = 1.6;
      def.vertical = 0.7; def.yBase = 17;
      def.params = { wallH: lerp(52, 88, d), depth: lerp(26, 48, d),
        roughness: lerp(0.3, 0.8, r()), upperRoute: true, lowerRoute: true };
      break;
    case T.GORGE:
      def.corridorW = lerp(26, 17, d); def.sway = 12; def.curve = 2.2;
      def.vertical = 0.9; def.yBase = 15; def.risk = true;
      def.params = { wallH: lerp(64, 96, d), ledges: 2 + Math.floor(r() * 3),
        roughness: lerp(0.5, 1, r()) };
      break;
    case T.TUNNEL:
      def.corridorW = lerp(24, 16, d); def.sway = 14; def.curve = 1.8;
      def.vertical = 0.8; def.yBase = 22; def.risk = true;
      def.params = { radius: lerp(19, 13, d), radiusVar: lerp(0.1, 0.35, r()),
        irregularity: lerp(0.2, 0.6, r()), sideOpenings: r() < 0.5 ? 1 : 2,
        ceilingBreaks: r() < 0.6 ? 1 : 0 };
      break;
    case T.ARCH:
      def.corridorW = lerp(44, 32, d); def.sway = 18; def.curve = 1.3;
      def.vertical = 0.6; def.yBase = 19;
      def.params = { span: lerp(46, 34, d), thick: lerp(4.6, 3.2, d),
        holeR: lerp(13, 9, d), count: 1 + (r() < 0.35 ? 1 : 0) };
      break;
    case T.SPIRES:
      def.corridorW = lerp(48, 34, d); def.sway = 24; def.curve = 1.7;
      def.vertical = 0.6; def.yBase = 18;
      def.params = { count: Math.round(lerp(7, 16, d)), hMin: 22, hMax: lerp(52, 78, d),
        lean: lerp(0.12, 0.34, r()), cap: lerp(0.2, 0.6, r()) };
      break;
    case T.CLIFF:
      def.corridorW = lerp(50, 38, d); def.sway = 14; def.curve = 1.0;
      def.vertical = 0.4; def.yBase = 30; def.drop = lerp(20, 34, d);
      def.params = { edgeSharp: lerp(0.5, 1, d), farOpen: true };
      break;
    case T.BRIDGE:
      def.corridorW = lerp(46, 34, d); def.sway = 16; def.curve = 1.2;
      def.vertical = 0.7; def.yBase = 21;
      def.params = { gapW: lerp(58, 80, d), deckW: lerp(13, 8, d),
        deckH: lerp(26, 32, d), thick: lerp(3.4, 2.4, d) };
      break;
    case T.CAVERN:
      def.corridorW = lerp(60, 46, d); def.sway = 20; def.curve = 1.2;
      def.vertical = 0.8; def.yBase = 22;
      def.params = { hallW: lerp(78, 96, d), ceilH: lerp(56, 76, d),
        pillar: true, roofHole: r() < 0.75, sideTunnels: 1 + Math.floor(r() * 2) };
      break;
    case T.FORK:
      def.corridorW = lerp(44, 34, d); def.sway = 10; def.curve = 0.9;
      def.vertical = 0.6; def.yBase = 20;
      def.params = { spread: CONFIG.fork.spread, safeW: lerp(34, 26, d),
        riskW: lerp(20, 14, d), riskDrop: lerp(10, 20, d), dividerH: lerp(34, 52, d) };
      break;
  }
  def.yPref = def.yBase;
  return def;
}

// ============================================================================
// ПОЛЕ ЧАНКА: пол, потолок, солиды.
// floor(x, t) — высота пола;  ceil(x, t) — низ потолка (Infinity = открытое небо);
// solids — примитивы, из которых лепятся арки/мосты/шпили/колонны.
// Такой набор покрывает все ситуации из ТЗ и остаётся дешёвым и проверяемым.
// ============================================================================
function chunkField(def) {
  const P = def.params, A = def.axis, C = def.center, r = makeRng(def.seed ^ 0x7f31);
  const L = def.length;
  const solids = [];
  const rough = (P.roughness != null ? P.roughness : 0.5);

  // мелкая фактура: ТЗ §8 — micro noise НЕ создаёт основные формы, только шершавость
  const micro = (x, zw) => (fbm(x * 0.05, zw * 0.05, 3, 0.5) - 0.5) * 2.2 * (0.4 + rough);
  // meso: гребни и выступы на стенах
  const meso = (x, zw) => ridged(x * 0.012, zw * 0.012, 3, 2.2);

  // ── DOMAIN WARP: гнём саму область, в которой спрашиваем форму ────────────
  // Ключевой приём против «видны чистые примитивы». Смещение общее для пола и
  // потолка и для солидов — иначе тоннель разъехался бы со своими же стенами.
  const Wp = CONFIG.warp;
  const wSeed = (def.seed & 1023) * 0.37;
  function warpX(x, zw) {
    return (fbm(x * Wp.bigFreq + wSeed, zw * Wp.bigFreq, 3, 0.55) - 0.5) * 2 * Wp.bigAmp
         + (fbm(x * Wp.smallFreq + 31 + wSeed, zw * Wp.smallFreq + 17, 2, 0.5) - 0.5) * 2 * Wp.smallAmp;
  }
  function warpZ(x, zw) {
    return (fbm(x * Wp.bigFreq + 71 + wSeed, zw * Wp.bigFreq + 53, 3, 0.55) - 0.5) * 2 * Wp.bigAmp
         + (fbm(x * Wp.smallFreq + 97 + wSeed, zw * Wp.smallFreq + 61, 2, 0.5) - 0.5) * 2 * Wp.smallAmp;
  }

  // база стен: чем дальше от оси, тем выше — это и есть «каньон»
  function wallProfile(dx, wallH, w) {
    const t = clamp01((Math.abs(dx) - w) / Math.max(1, w * 0.9));
    return smoothstep(0, 1, t) * wallH;
  }

  const F = {
    def: def,
    micro: micro,
    // КРУПНАЯ форма пола, без мелкой фактуры. Разделение нужно для кэша: базу
    // считаем на редкой решётке и интерполируем, а micro добавляем на каждую
    // точку — иначе шершавость смазалась бы. ТЗ §8: micro не создаёт формы.
    floorBase: function (x0, t0) {
      // ДИСТОРСИЯ: спрашиваем форму в СМЕЩЁННОЙ точке — это и ломает «чистый примитив».
      // НО искажение до 33 юнитов способно надвинуть стену прямо на трассу, поэтому
      // у коридора оно погашено в ноль и набирает силу только за его пределами:
      // где искажение декоративно — оно есть, где функционально — его нет.
      const zwT = def.zStart + t0 * L;
      const dxTrue = x0 - C(t0)[0];               // неискажённое расстояние до оси
      const wMask = smoothstep(def.corridorW * 0.95, def.corridorW * 2.3, Math.abs(dxTrue));
      const x = x0 + warpX(x0, zwT) * wMask;
      const t = clamp01(t0 + warpZ(x0, zwT) * wMask / L);
      const zw = def.zStart + t * L;
      const m = C(t);                             // геометрическая середина чанка
      const dx = x - m[0];
      let h = m[1] - 12;                          // пол под серединой
      const w = def.corridorW;
      switch (def.type) {
        case T.TRANSITION:
          h += wallProfile(dx, P.wallH, w * 1.5) + meso(x, zw) * 4;
          break;
        case T.CANYON:
        case T.GORGE: {
          // дно ровное, стены круто вверх; ЛЕДЖИ в ущелье — боковые выступы
          h += wallProfile(dx, P.wallH, w) + meso(x, zw) * 6 * rough;
          if (def.type === T.GORGE && P.ledges) {
            const lg = Math.sin(t * Math.PI * P.ledges * 2) * 0.5 + 0.5;
            if (Math.abs(dx) > w * 0.8 && Math.abs(dx) < w * 1.35)
              h -= lg * 7;                        // полка, на которую можно поднырнуть
          }
          break;
        }
        case T.TUNNEL: {
          // пол тоннеля — нижняя половина трубы
          const rr = P.radius * (1 + Math.sin(t * Math.PI * 3) * P.radiusVar);
          const q = clamp01(Math.abs(dx) / rr);
          h -= Math.sqrt(Math.max(0, 1 - q * q)) * rr * 0.55;
          h += wallProfile(dx, 70, rr * 1.05);    // за трубой — глухая порода
          break;
        }
        case T.ARCH:
          h += wallProfile(dx, P.span * 0.55, w) + meso(x, zw) * 5;
          break;
        case T.SPIRES:
          h += wallProfile(dx, 26, w * 1.3) + ridged(x * 0.006, zw * 0.006, 4, 1.9) * 16;
          break;
        case T.CLIFF: {
          // ОБРЫВ: нырок уже заложен в center(t) — здесь только стены и фактура.
          // Дублировать спуск нельзя: складывались два уклона и коридор ломался.
          h += wallProfile(dx, 30, w * 1.4) + meso(x, zw) * 4;
          break;
        }
        case T.BRIDGE: {
          // ПРОПАСТЬ поперёк: пол проваливается, сверху перемычка (в solids).
          // Коридор в пропасть НЕ опускается — за это отвечает ограничение уклона
          // в buildCorridor: трасса идёт над провалом, а не сползает в него.
          const g = 1 - smoothstep(0.3, 0.5, t) * smoothstep(0.8, 0.6, t);
          h -= (1 - g) * 70;
          h += wallProfile(dx, 34, w * 1.3);
          break;
        }
        case T.CAVERN:
          h += wallProfile(dx, 80, P.hallW * 0.5) + meso(x, zw) * 5;
          break;
        case T.FORK: {
          // РАЗВИЛКА: два коридора расходятся, между ними растёт разделитель
          const s = smoothstep(CONFIG.fork.splitAt, 0.55, t) * smoothstep(CONFIG.fork.mergeAt, 0.66, t);
          const sp = P.spread * s;
          const dSafe = Math.abs(dx + sp), dRisk = Math.abs(dx - sp);
          const hSafe = wallProfile(dSafe, 40, P.safeW * 0.5);
          const hRisk = wallProfile(dRisk, 46, P.riskW * 0.5);
          h += Math.min(hSafe, hRisk);
          // сложный путь ниже — «короче, но рискованнее» (§6.10)
          if (dRisk < P.riskW * 0.6) h -= P.riskDrop * s;
          if (s > 0.01 && Math.abs(dx) < sp * 0.55) h += P.dividerH * s;  // разделитель
          break;
        }
      }
      // ── ОБЩИЙ РЕЛЬЕФ ПО ВСЕЙ ШИРИНЕ ──────────────────────────────────────
      // Раньше пол у трассы был ПЛОСКИЙ, а «горы» начинались только за коридором —
      // поэтому кадр читался пустым и примитивным. Ridged-пики идут по всему полю,
      // усиливаясь от оси к периферии, а дальний план к горизонту дополнительно
      // поднимается: это и есть «разноуровневый рельеф создаёт глубину и масштаб».
      // Внутри ЗАКРЫТЫХ типов рельеф не добавляем: у тоннеля пол — это низ трубы, и
      // пики внутри неё съедали просвет (тест ловил 10 непроходимых чанков из 40).
      // В каверне оставляем немного — как фактуру дна зала, но не как форму.
      const sky = def.type === T.TUNNEL ? 0 : (def.type === T.CAVERN ? 0.25 : 1);
      const relFar = (0.28 + 0.72 * smoothstep(w * 0.7, w * 2.4, Math.abs(dxTrue))) * sky;
      h += ridged(x * 0.0075, zw * 0.0075, 5, 2.4) * 48 * relFar;
      h += ridged(x * 0.021 + 37, zw * 0.021 + 11, 3, 3.2) * 15 * relFar;
      h += smoothstep(w * 2.0, CONFIG.world.halfWidth, Math.abs(dxTrue)) * 40 * sky
           * (0.35 + 0.65 * fbm(x * 0.004 + 61, zw * 0.004 + 29, 3, 0.55));
      // ── ГАРАНТИРОВАННЫЙ ПРОХОД ───────────────────────────────────────────
      // Рельеф добавлен и над трассой тоже, поэтому ложбину вдоль ИСТИННОЙ оси
      // (не искажённой дисторсией) вычитаем в конце: иначе пики закрыли бы коридор.
      const lvl = m[1] - 12;
      const carve = Math.exp(-(dxTrue * dxTrue) / (2 * (w * 0.66) * (w * 0.66)));
      if (h > lvl) h -= carve * (h - lvl) * 0.92;
      return h;
    },
    // полная высота пола = крупная форма + мелкая фактура
    floor: function (x, t) { return F.floorBase(x, t) + micro(x, def.zStart + t * L); },
    // низ потолка. Infinity — открытое небо (тогда точки потолка не сэмплим).
    ceil: function (x, t) {
      const a = C(t), dx = x - a[0];
      switch (def.type) {
        case T.TUNNEL: {
          const rr = P.radius * (1 + Math.sin(t * Math.PI * 3) * P.radiusVar);
          const q = clamp01(Math.abs(dx) / rr);
          let c = a[1] - 12 + Math.sqrt(Math.max(0, 1 - q * q)) * rr * 1.15;
          // РАЗЛОМЫ В СВОДЕ (§6.4 ceilingBreaks): дыры, через которые видно небо —
          // тоннель перестаёт быть трубой и получает ориентиры
          if (P.ceilingBreaks) {
            const br = Math.sin(t * Math.PI * 4.5) * 0.5 + 0.5;
            if (br > 0.86) return Infinity;
          }
          c += (fbm(x * 0.06, t * 40, 2, 0.5) - 0.5) * 4 * P.irregularity;
          return c;
        }
        case T.CAVERN: {
          // КАВЕРНА: высокий свод; дыра в потолке — вертикальный выход наружу
          if (Math.abs(dx) > P.hallW * 0.52) return Infinity;
          if (P.roofHole) {
            const d2 = Math.hypot(dx, (t - 0.5) * L * 0.5);
            if (d2 < 22) return Infinity;
          }
          const q = clamp01(Math.abs(dx) / (P.hallW * 0.5));
          return a[1] - 12 + P.ceilH * (0.55 + 0.45 * Math.sqrt(Math.max(0, 1 - q * q)));
        }
      }
      return Infinity;
    },
    solids: solids
  };

  // ── СОЛИДЫ по типам: то, что нельзя выразить полом и потолком ─────────────
  // Все — капсулы (отрезок + радиус) или сферы: коллизия по ним считается точно
  // и дёшево (ТЗ §18), а точки сэмплим по их поверхности.
  const addCap = (a, b, rad, kind) => solids.push({ k: 'cap', a: a, b: b, r: rad, kind: kind });
  const addTorus = (c, R, rt, yaw, kind) => solids.push({ k: 'tor', c: c, R: R, rt: rt, yaw: yaw, kind: kind });

  if (def.type === T.ARCH) {
    for (let i = 0; i < P.count; i++) {
      const t = 0.42 + i * 0.3, a = C(t);
      const zc = def.zStart + t * L;
      const fy = F.floor(a[0], t);
      // арка = тор, поставленный поперёк трассы: центральное отверстие = проём
      addTorus([a[0], fy + P.holeR + 2, zc], P.holeR + P.thick, P.thick, (r() - 0.5) * 0.4, 'arch');
    }
  }
  if (def.type === T.BRIDGE) {
    const t = 0.5, a = C(t), zc = def.zStart + t * L;
    // ПЕРЕМЫЧКА поперёк пропасти. Палуба идёт ВЫШЕ линии полёта: пролетаем под
    // мостом, как на референсе. Отсчёт от оси, а не от пола — пол в этом месте
    // провален на 70, и от него палуба оказалась бы на уровне трассы.
    const y = a[1] + P.deckH;
    addCap([a[0] - P.gapW * 0.5, y, zc], [a[0] + P.gapW * 0.5, y, zc], P.thick, 'deck');
    // опоры вниз, в пропасть — читается как каменный мост, а не парящая палка
    for (const s of [-1, 1]) {
      const x = a[0] + s * P.gapW * 0.34;
      addCap([x, y - 1, zc], [x, y - 34, zc + (r() - 0.5) * 8], P.thick * 0.8, 'pier');
    }
  }
  if (def.type === T.SPIRES) {
    for (let i = 0; i < P.count; i++) {
      const t = 0.1 + 0.8 * ((i + 0.5) / P.count);
      const a = C(t);
      // §6.6 слалом: иглы по бокам коридора, середина всегда свободна
      const side = (i % 2 ? 1 : -1);
      const off = def.corridorW * (0.62 + r() * 0.55) * side;
      const x = a[0] + off, zc = def.zStart + t * L + (r() - 0.5) * 20;
      const fy = F.floor(x, t);
      const ht = lerp(P.hMin, P.hMax, r());
      const lx = (r() - 0.5) * 2 * P.lean * ht, lz = (r() - 0.5) * 2 * P.lean * ht;
      addCap([x, fy - 3, zc], [x + lx, fy + ht, zc + lz], 2.6 + r() * 2, 'spire');
    }
  }
  if (def.type === T.CAVERN && P.pillar) {
    const t = 0.5, a = C(t), zc = def.zStart + t * L;
    const fy = F.floor(a[0] + P.hallW * 0.22, t);
    // центральная колонна: вокруг неё круговой маршрут (§6.9)
    addCap([a[0] + P.hallW * 0.22, fy - 4, zc], [a[0] + P.hallW * 0.22, fy + P.ceilH, zc], 7, 'pillar');
  }
  if (def.type === T.FORK) {
    // на сложном пути — низкая перемычка: заставляет поднырнуть (§6.10)
    const t = 0.6, a = C(t), zc = def.zStart + t * L;
    const x = a[0] + P.spread;
    const fy = F.floor(x, t);
    addCap([x - 14, fy + 15, zc], [x + 14, fy + 15, zc], 2.4, 'lowbar');
  }
  return F;
}

// ============================================================================
// КОРИДОР: безопасная трубка вокруг маршрута. ТЗ §18 — коллизия отдельно от
// точек. Здесь же и валидируем: коридор обязан быть свободен.
// ============================================================================
function buildCorridor(def, F) {
  const N = 24, pts = [];
  const dz = def.length / N;
  const MAX_SLOPE = 0.55;          // не круче ~29° — это и есть «нет скачка высоты» (§30)
  for (let i = 0; i <= N; i++) {
    const t = i / N, a = def.axis(t);
    const fy = F.floor(a[0], t);
    const cy = F.ceil(a[0], t);
    // желаемая высота: над полом с запасом, но не выше потолка минус запас
    let y = fy + CONFIG.ship.floorClear + 4;
    if (isFinite(cy)) y = Math.min(y, cy - CONFIG.ship.ceilClear);
    y = clamp(y, CONFIG.ship.yMin + 2, CONFIG.ship.yMax - 2);
    pts.push({ t: t, z: def.zStart + t * def.length, x: a[0], y: y, yWant: y,
               floor: fy, ceil: cy, r: Math.max(6, def.corridorW * 0.42) });
  }
  // ОГРАНИЧЕНИЕ УКЛОНА в два прохода. Коридор — это траектория полёта, а не
  // слепок пола: над пропастью моста он идёт ПОВЕРХ провала, а не сползает в него
  // (тест ловил «скачок высоты» на всех мостах и обрывах, пока этого не было).
  // Второй проход назад нужен, чтобы спуск начинался заранее, а не обрывом.
  for (let i = 1; i < pts.length; i++) {
    const lim = pts[i - 1].y - MAX_SLOPE * dz;
    if (pts[i].y < lim) pts[i].y = lim;
  }
  for (let i = pts.length - 2; i >= 0; i--) {
    const lim = pts[i + 1].y - MAX_SLOPE * dz;
    if (pts[i].y < lim) pts[i].y = lim;
  }
  // после сглаживания могли упереться в потолок — опускаем, если есть куда
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (isFinite(p.ceil) && p.y > p.ceil - CONFIG.ship.ceilClear)
      p.y = Math.max(p.floor + CONFIG.ship.floorClear, p.ceil - CONFIG.ship.ceilClear);
  }
  return pts;
}

// расстояние от точки до солида (минус радиус) — для валидации и коллизии
function solidDist(p, s) {
  if (s.k === 'cap') {
    const abx = s.b[0] - s.a[0], aby = s.b[1] - s.a[1], abz = s.b[2] - s.a[2];
    const apx = p[0] - s.a[0], apy = p[1] - s.a[1], apz = p[2] - s.a[2];
    const ab2 = abx * abx + aby * aby + abz * abz;
    let t = ab2 > 1e-6 ? (apx * abx + apy * aby + apz * abz) / ab2 : 0;
    t = clamp01(t);
    return Math.hypot(p[0] - (s.a[0] + abx * t), p[1] - (s.a[1] + aby * t),
                      p[2] - (s.a[2] + abz * t)) - s.r;
  }
  // тор: расстояние до окружности радиуса R в плоскости, повёрнутой на yaw
  const cy = Math.cos(s.yaw), sy = Math.sin(s.yaw);
  const dx = p[0] - s.c[0], dy = p[1] - s.c[1], dz = p[2] - s.c[2];
  const lx = dx * cy - dz * sy, lz = dx * sy + dz * cy;   // в локальные оси тора
  const q = Math.hypot(Math.hypot(lx, dy) - s.R, lz);
  return q - s.rt;
}

// ============================================================================
// ВАЛИДАЦИЯ (ТЗ §30). Не пройдёт — вызывающий берёт другой seed или fallback.
// ============================================================================
function validate(def, F, corridor) {
  const bad = [];
  const R = CONFIG.ship.radius;
  for (let i = 0; i < corridor.length; i++) {
    const c = corridor[i];
    const t = c.t;
    // 1) пол ниже трассы с запасом
    const fy = F.floor(c.x, t);
    if (c.y - fy < CONFIG.ship.floorClear - 1) bad.push('пол близко на t=' + t.toFixed(2));
    // 2) потолок выше трассы с запасом
    const cy = F.ceil(c.x, t);
    if (isFinite(cy) && cy - c.y < CONFIG.ship.ceilClear - 1) bad.push('потолок близко на t=' + t.toFixed(2));
    // 3) высота в пределах хода корабля
    if (c.y < CONFIG.ship.yMin || c.y > CONFIG.ship.yMax) bad.push('вне диапазона высот на t=' + t.toFixed(2));
    // 4) солиды не лезут в коридор
    for (let s = 0; s < F.solids.length; s++) {
      const d = solidDist([c.x, c.y, c.z], F.solids[s]);
      if (d < R + 1.5) bad.push('солид ' + F.solids[s].kind + ' в коридоре на t=' + t.toFixed(2));
    }
    // 5) §30 нет скачка высоты между соседними точками коридора
    if (i > 0) {
      const dy = Math.abs(c.y - corridor[i - 1].y);
      const dz = Math.abs(c.z - corridor[i - 1].z);
      if (dy / Math.max(1, dz) > 0.85) bad.push('скачок высоты на t=' + t.toFixed(2));
    }
  }
  return { ok: bad.length === 0, reasons: bad };
}

// ============================================================================
// СЭМПЛИНГ ТОЧЕК. Один слитый буфер на чанк (ТЗ §10): позиции + цвета + размеры
// + маска фичи. Роли различаются атрибутом, а не отдельным объектом — именно это
// снимает draw calls (было 51 при трёх формах).
// ============================================================================
function generateChunk(def, opts) {
  const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const lod = (opts && opts.lod) || 0;
  const D = CONFIG.density;
  const stepMul = D.lodStep[Math.min(3, lod)];
  const edgeK = D.lodEdges[Math.min(3, lod)];

  def.axis = def.axis || axisFor(def);
  const F = chunkField(def);
  const corridor = buildCorridor(def, F);
  const val = validate(def, F, corridor);

  const L = def.length, HW = CONFIG.world.halfWidth;
  const pos = [], col = [], siz = [], msk = [];
  const tint = (opts && opts.tint) || [0.62, 0.93, 0.98];

  // ── КЭШ КРУПНОЙ ФОРМЫ ПОЛА ──────────────────────────────────────────────
  // floorBase() внутри зовёт fbm/ridged — это десятки noise() на вызов. В лоб на
  // каждую точку выходило 5 вызовов (сама точка + 4 для нормали), то есть больше
  // 300 тысяч на чанк и 130–180 мс. Считаем базу на редкой решётке (шаг 2.4) и
  // интерполируем; мелкая фактура micro добавляется поверх, на каждую точку —
  // поэтому шершавость не смазывается. Нормали берём тоже из кэша: по §8 мелкий
  // шум и не должен участвовать в форме.
  const CS = 2.4;                                    // шаг кэша
  const cx0 = Math.min(def.center(0)[0], def.center(0.5)[0], def.center(1)[0]) - HW - CS * 2;
  const cx1 = Math.max(def.center(0)[0], def.center(0.5)[0], def.center(1)[0]) + HW + CS * 2;
  const CW = Math.ceil((cx1 - cx0) / CS) + 2, CH = Math.ceil(L / CS) + 3;
  const cache = new Float32Array(CW * CH);
  for (let r = 0; r < CH; r++) {
    const t = clamp01((r * CS) / L);
    for (let c2 = 0; c2 < CW; c2++) cache[r * CW + c2] = F.floorBase(cx0 + c2 * CS, t);
  }
  const baseAt = (x, zLoc) => {                      // билинейно из кэша
    const fx = clamp((x - cx0) / CS, 0, CW - 2), fz = clamp(zLoc / CS, 0, CH - 2);
    const ix = fx | 0, iz = fz | 0, ux = fx - ix, uz = fz - iz;
    const i0 = iz * CW + ix, i1 = i0 + CW;
    return cache[i0] * (1 - ux) * (1 - uz) + cache[i0 + 1] * ux * (1 - uz)
         + cache[i1] * (1 - ux) * uz + cache[i1 + 1] * ux * uz;
  };

  // ── ОТСЕЧЕНИЕ НЕВИДИМОГО ────────────────────────────────────────────────
  // «Глаз» — там, где будет камера: над коридором и чуть позади. Летим на −z,
  // поэтому камера всегда со стороны БОЛЬШЕГО z относительно точки.
  const CU = CONFIG.cull;
  const eyeYAt = zLoc => {                                  // высота глаза над трассой
    const t = clamp01(zLoc / L);
    const i = Math.min(corridor.length - 1, Math.round(t * (corridor.length - 1)));
    return corridor[i].y + CU.eyeUp;
  };
  // 1) ЗАДНИЙ СКАТ. Нормаль поля высот ∝ (−dh/dx, 1, −dh/dz). Вектор на глаз
  //    смотрит в +z. Если скалярное произведение отрицательное, поверхность
  //    отвёрнута от камеры — этот склон не виден НИКОГДА, и именно его вырезание
  //    даёт слоистые силуэты гребней, как на референсе.
  // 2) ГОРИЗОНТ. Шагаем от точки к глазу и смотрим, не поднимается ли рельеф выше
  //    луча зрения. Поднимается — точка в «тени» ближнего гребня, её не видно.
  function visible(px, py, pzLoc, hx, hz) {
    if (!CU.enabled) return true;
    const eyeY = eyeYAt(pzLoc);
    const vz = CU.eyeBack, vy = eyeY - py;                   // вектор точка → глаз
    const nDotV = (-hz / (2 * CS)) * vz + vy;                // N·V без члена по x (глаз над осью)
    if (nDotV < CU.backface * Math.hypot(vy, vz)) return false;
    if (!CU.horizon) return true;
    // луч до глаза: если рельеф на пути выше луча — закрыт
    for (let s = 1; s <= CU.steps; s++) {
      const k = s / CU.steps;
      const sz = pzLoc + vz * k;
      if (sz > L) break;
      const rayY = py + vy * k;
      if (baseAt(px, sz) > rayY + 1.2) return false;
    }
    return true;
  }

  // ── пол и стены ─────────────────────────────────────────────────────────
  // Идём по z равномерно, а по x — ПЕРЕМЕННЫМ шагом: густо у маршрута, редко на
  // периферии (§12). Это ключ к «детально, но точек мало».
  const ST = CONFIG.stripes;
  let culled = 0;
  const stepZ = D.base * stepMul * 1.15;
  for (let z = 0; z < L; z += stepZ) {
    const t = z / L;
    const zw = def.zStart + z;
    const a = def.axis(t);
    let x = a[0] - HW;
    while (x < a[0] + HW) {
      const dx = Math.abs(x - a[0]);
      // шаг по x растёт от центра к краю
      const far = smoothstep(D.nearBand, D.farBand, dx);
      const stepX = D.base * stepMul * lerp(1, D.farMul, far);
      // ПЯТНИСТАЯ ПЛОТНОСТЬ (не монотонный радиальный спад): низкочастотный шум
      // модулирует вероятность сохранить кандидата — где-то заметно гуще, где-то
      // почти пусто. Проверяем ДО jitter/baseAt — так пропуск ничего не считает.
      const clumpN = fbm(x * D.clumpFreq, zw * D.clumpFreq, 2, 0.55);
      const keep = D.clumpMin + (1 - D.clumpMin) * clumpN;
      if (hash(x * 3.1 + 5, zw * 3.1 + 5) > keep) { x += stepX; continue; }
      const jx = x + (hash(x, zw) - 0.5) * stepX;
      const jz = zw + (hash(zw, x) - 0.5) * stepZ;
      const zLoc = clamp(jz - def.zStart, 0, L);
      const y = baseAt(jx, zLoc) + F.micro(jx, jz);
      // нормаль по конечным разностям кэша (дёшево, форму передаёт точно)
      const e = CS;
      const hx = baseAt(jx + e, zLoc) - baseAt(jx - e, zLoc);
      const hz = baseAt(jx, clamp(zLoc + e, 0, L)) - baseAt(jx, clamp(zLoc - e, 0, L));
      const slope = Math.hypot(hx, hz) / (2 * e) * 2.2;   // ×2.2 — приведение к прежней шкале
      if (!visible(jx, y, zLoc, hx, hz)) { culled++; x += stepX; continue; }
      // прореживание крутых граней: сетка по (x,z) на стене, повёрнутой к камере,
      // даёт много точек на единицу ПЛОЩАДИ ЭКРАНА — вместе с аддитивным блендингом
      // это и была «сплошная белая стена». До 45% точек очень крутых граней снимаем.
      if (slope > 1.8 && hash(jx * 9, jz * 3) < Math.min(0.45, (slope - 1.8) * 0.22)) { x += stepX; continue; }
      pushPoint(pos, col, siz, msk, jx, y, jz, slope, hx, hz, dx, far, tint, lod, edgeK, false);
      // ВЕРТИКАЛЬНЫЕ СТЕКАНИЯ: на крутой грани сетка по (x,z) вырождается — между
      // соседними столбцами зияет вертикальная дыра. Доливаем точки ВНИЗ по стене,
      // это и читается как «текущие» обрывы на референсе.
      if (slope > ST.slope && lod < 3 && hash(jx * 13, jz * 7) < ST.prob) {
        const drop = Math.min(ST.maxLen, slope * 6);
        const n = Math.min(ST.maxN, Math.floor(drop / (ST.step * stepMul)));
        for (let k = 1; k < n; k++) {
          const py = y - k * ST.step * stepMul;
          const sx = jx + (hash(k, jx) - 0.5) * ST.jitter;
          const sz2 = jz + (hash(jx, k) - 0.5) * ST.jitter;
          pushPoint(pos, col, siz, msk, sx, py, sz2, slope * 0.8, hx, hz, dx, far, tint, lod, edgeK * 0.5, false);
        }
      }
      x += stepX;
    }
  }
  // ── потолок (только там, где он есть) ───────────────────────────────────
  const cStep = stepZ * D.ceilMul;
  for (let z = 0; z < L; z += cStep) {
    const t = z / L, zw = def.zStart + z, a = def.axis(t);
    let x = a[0] - HW * 0.6;
    while (x < a[0] + HW * 0.6) {
      const dx = Math.abs(x - a[0]);
      const far = smoothstep(D.nearBand, D.farBand, dx);
      const stepX = D.base * stepMul * D.ceilMul * lerp(1, D.farMul, far);
      const cy = F.ceil(x, t);
      if (isFinite(cy)) {
        const jx = x + (hash(x, zw + 7) - 0.5) * stepX;
        const jz = zw + (hash(zw + 7, x) - 0.5) * cStep;
        const jt = clamp01((jz - def.zStart) / L);
        const cy2 = F.ceil(jx, jt);
        if (isFinite(cy2)) {
          const e = 0.9;
          const c1 = F.ceil(jx + e, jt), c2 = F.ceil(jx - e, jt);
          const slope = (isFinite(c1) && isFinite(c2)) ? Math.abs(c1 - c2) / (2 * e) : 3;
          // потолок виден только изнутри полости: если ниже него нет пола-пола на
          // расстоянии полёта, точка снаружи и не нужна
          pushPoint(pos, col, siz, msk, jx, cy2, jz, slope, 0, 0, dx, far, tint, lod, edgeK, true);
        }
      }
      x += stepX;
    }
  }
  // ── КОНТУРНЫЕ ЛИНИИ: силуэты, гребни, кромки, горизонтали террас ─────────
  // Главный приём референса: форму рисуют квази-непрерывные ЦЕПОЧКИ ярких точек,
  // а заливка тёмная и редкая. Четыре правила (пороги подобраны симуляцией:
  // ~5 непрерывных линий силуэта + 2-3 линии кромок на чанк):
  //   1) СИЛУЭТ: луч зрения скользит по поверхности (nDotV чуть выше порога
  //      отсечения) — это последняя видимая полоса ската перед тем, как он
  //      уходит за гребень. Ровно эти линии светятся на референсе.
  //   2) ГРЕБЕНЬ: локальный максимум поперёк трассы с превосходством prom.
  //   3) КРОМКА: выпуклый перегиб (d²h/dx² < −curv) на крутом склоне — верх
  //      стены/террасы; от кромок вниз прерывистые струи.
  //   4) ГОРИЗОНТАЛИ: пересечения уровней band на крутых гранях — слоистость.
  // Всё по кэшу крупной формы (baseAt), скользящее окно из трёх строк — дёшево.
  const RG = CONFIG.ridge;
  if (RG.enabled) {
    let added = 0;
    // на дальних LOD контур НЕ выключаем, только разрежаем: дальний план на
    // референсе — это в первую очередь силуэтные линии, заливка там и так гаснет
    const zStepR = RG.step * (lod >= 3 ? 2.6 : lod === 2 ? 1.8 : 1);
    const pushContour = (x, y, z, k) => {
      const vb = 0.86 + 0.14 * hash(x * 7, z * 7);
      const g = (RG.brBase + RG.brVar * k) * vb;
      col.push(g + (tint[0] - g) * 0.18, g + (tint[1] - g) * 0.18, g + (tint[2] - g) * 0.18);
      pos.push(x, y, z);
      siz.push(RG.size * (0.85 + 0.3 * hash(z * 3, x * 3)));
      msk.push(CONFIG.layer.EDGE);
      added++;
    };
    const nCells = Math.ceil((HW * 2) / CS) - 1;
    const rowAt = (z) => {
      const a2 = def.axis(clamp01(z / L));
      const out = new Float32Array(nCells);
      for (let c2 = 0; c2 < nCells; c2++) out[c2] = baseAt(a2[0] - HW + CS * (c2 + 0.5), clamp(z, 0, L));
      return out;
    };
    for (let z = CS * 2; z < L - CS * 2 && added < RG.budget; z += zStepR) {
      // строки считаем заново на каждом шаге: шаг цепочки (1.1) не совпадает с шагом
      // кэша (2.4), скользящее окно тут дало бы сдвинутые производные по z
      const rowP = rowAt(z - CS), row0 = rowAt(z), rowN = rowAt(z + CS);
      const t = z / L;
      const a = def.axis(t);
      const eyeY = eyeYAt(z);
      const zw2 = def.zStart + z;
      for (let c2 = 3; c2 < nCells - 3; c2++) {
        const h = row0[c2];
        const x = a[0] - HW + CS * (c2 + 0.5);
        const sL = (h - row0[c2 - 1]) / CS, sR = (row0[c2 + 1] - h) / CS;
        const d2 = (row0[c2 - 1] - 2 * h + row0[c2 + 1]) / CS;
        const hz2 = rowN[c2] - rowP[c2];
        const vy = eyeY - h, vz = CU.eyeBack;
        const nv = ((-hz2 / (2 * CS)) * vz + vy) / Math.hypot(vy, vz);
        let k = -1;
        // 1) силуэтная полоса: скользящий луч на заметном рельефе (не на плоском дне)
        if (nv > CU.backface && nv < CU.backface + RG.silBand
            && Math.max(Math.abs(sL), Math.abs(sR), Math.abs(hz2 / (2 * CS))) > 0.55) k = 0.9;
        // 2) гребень с превосходством
        else if (h > row0[c2 - 1] && h >= row0[c2 + 1]
                 && (h - Math.min(row0[c2 - 3], row0[c2 + 3])) > RG.prom) k = clamp01((h - Math.min(row0[c2 - 3], row0[c2 + 3])) / 16);
        // 3) выпуклая кромка на крутом склоне
        else if (d2 < -RG.curv && Math.max(Math.abs(sL), Math.abs(sR)) > 1.1) k = 0.7;
        if (k >= 0) {
          const y = h + F.micro(x, zw2);
          if (visible(x, y, z, 0, hz2)) {
            pushContour(x + (hash(x, z) - 0.5) * RG.jitter, y,
                        zw2 + (hash(z, x) - 0.5) * RG.jitter, k);
            // струя вниз от кромки/силуэта — прерывисто, как стекания на референсе
            if (k >= 0.7 && lod < 2 && Math.abs(sR) > 1.2 && hash(x * 17, z * 5) < RG.streamProb) {
              const n = Math.min(RG.streamN, Math.floor(Math.min(CONFIG.stripes.maxLen, Math.abs(sR) * 8) / CONFIG.stripes.step));
              for (let q = 1; q < n && added < RG.budget; q++)
                pushContour(x + (hash(q, x) - 0.5) * 0.7, y - q * CONFIG.stripes.step,
                            zw2 + (hash(x, q) - 0.5) * 0.7, 0.5 * (1 - q / n));
            }
          }
        }
        // 4) горизонтали террас: слоистость крутых стен из переднего плана референса
        if (lod < 3 && Math.abs(sR) > 1.2) {
          const y2 = h + F.micro(x, zw2);
          const bd = y2 - Math.round(y2 / RG.band) * RG.band;
          if (Math.abs(bd) < RG.bandEps && visible(x, y2, z, 0, hz2))
            pushContour(x + (hash(x, z + 9) - 0.5) * 0.6, y2 - bd,
                        zw2 + (hash(z + 9, x) - 0.5) * 0.6, 0.35);
        }
      }
    }
  }
  // ── солиды: точки по поверхности капсул и торов ──────────────────────────
  for (let i = 0; i < F.solids.length; i++) sampleSolid(F.solids[i], pos, col, siz, msk, tint, stepMul);

  const t1 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  return {
    def: def, field: F, corridor: corridor, valid: val,
    positions: new Float32Array(pos),
    colors: new Float32Array(col),
    sizes: new Float32Array(siz),
    featureMask: new Uint8Array(msk),
    colliders: F.solids,
    index: buildPointIndex(pos, def),
    stats: { points: pos.length / 3, ms: t1 - t0, lod: lod, drawCalls: 1, culled: culled }
  };
}

// ── ПРОСТРАНСТВЕННЫЙ ИНДЕКС ТОЧЕК ──────────────────────────────────────────
// Игре нужно каждый кадр перекрашивать точки рядом с кораблём (диск под днищем,
// алая подсветка по курсу, сверхзвуковая волна). Раньше это делалось индексацией
// РЕГУЛЯРНОЙ сетки — но §12 требует неравномерную плотность, и регулярной сетки
// больше нет. Поэтому раскладываем индексы точек по ячейкам один раз при генерации:
// поиск в окрестности становится обходом нескольких ячеек вместо перебора 70 тысяч.
// Плоские типизированные массивы, без Map и без объекта на точку (ТЗ §10).
function buildPointIndex(pos, def) {
  const CELL = 6;
  const n = pos.length / 3;
  if (!n) return null;
  let minX = Infinity, maxX = -Infinity;
  for (let i = 0; i < n; i++) { const x = pos[i * 3]; if (x < minX) minX = x; if (x > maxX) maxX = x; }
  const cols = Math.max(1, Math.ceil((maxX - minX) / CELL) + 1);
  const rows = Math.max(1, Math.ceil(def.length / CELL) + 2);
  const cnt = new Uint32Array(cols * rows + 1);
  const cellOf = i => {
    const cx = clamp(Math.floor((pos[i * 3] - minX) / CELL), 0, cols - 1);
    const cz = clamp(Math.floor((pos[i * 3 + 2] - def.zStart) / CELL), 0, rows - 1);
    return cz * cols + cx;
  };
  for (let i = 0; i < n; i++) cnt[cellOf(i) + 1]++;
  for (let c = 0; c < cols * rows; c++) cnt[c + 1] += cnt[c];   // префиксные суммы
  const items = new Uint32Array(n);
  const fill = cnt.slice(0, cols * rows);
  for (let i = 0; i < n; i++) { const c = cellOf(i); items[fill[c]++] = i; }
  return { cell: CELL, minX: minX, z0: def.zStart, cols: cols, rows: rows, start: cnt, items: items };
}
// Обход точек в ПРЯМОУГОЛЬНИКЕ. Нужен отдельно от квадратного запроса: подсветка по
// курсу смотрит узкую длинную полосу (±8 по x, 12..95 вперёд). Через квадратный запрос
// радиусом 58 это было 400 ячеек вместо 42 — индекс терял смысл и кадр вырастал до 26 мс.
// step позволяет брать ячейки через одну: для искристого фронта волны точность не нужна.
function forPointsInBox(idx, x0, x1, z0, z1, cb, step) {
  if (!idx) return;
  const st = step || 1;
  const c0 = clamp(Math.floor((x0 - idx.minX) / idx.cell), 0, idx.cols - 1);
  const c1 = clamp(Math.floor((x1 - idx.minX) / idx.cell), 0, idx.cols - 1);
  const r0 = clamp(Math.floor((z0 - idx.z0) / idx.cell), 0, idx.rows - 1);
  const r1 = clamp(Math.floor((z1 - idx.z0) / idx.cell), 0, idx.rows - 1);
  for (let rr = r0; rr <= r1; rr += st) for (let cc = c0; cc <= c1; cc += st) {
    const c = rr * idx.cols + cc;
    for (let k = idx.start[c]; k < idx.start[c + 1]; k++) cb(idx.items[k]);
  }
}
// обход точек в квадрате вокруг (x,z): cb(i) на каждый индекс
function forPointsNear(idx, x, z, r, cb, step) {
  if (!idx) return;
  const st = step || 1;
  const c0 = clamp(Math.floor((x - r - idx.minX) / idx.cell), 0, idx.cols - 1);
  const c1 = clamp(Math.floor((x + r - idx.minX) / idx.cell), 0, idx.cols - 1);
  const r0 = clamp(Math.floor((z - r - idx.z0) / idx.cell), 0, idx.rows - 1);
  const r1 = clamp(Math.floor((z + r - idx.z0) / idx.cell), 0, idx.rows - 1);
  for (let rr = r0; rr <= r1; rr += st) for (let cc = c0; cc <= c1; cc += st) {
    const c = rr * idx.cols + cc;
    for (let k = idx.start[c]; k < idx.start[c + 1]; k++) cb(idx.items[k]);
  }
}

// одна точка поверхности: цвет/размер/роль по правилам §11 и §15
function pushPoint(pos, col, siz, msk, x, y, z, slope, hx, hz, dx, far, tint, lod, edgeK, isCeil) {
  const LK = CONFIG.look;
  // РАЗМЕР/ЯРКОСТЬ НЕПРЕРЫВНО ПО ГРАДИЕНТУ (edgeT), а не бинарным порогом: старый
  // код либо давал «поверхность», либо разом прыгал в «кромка» — на глаз при таком
  // разбросе (1.4×/1.6×) две группы сливались в одну и рельеф не читался. Теперь
  // кромка гребня плавно НАБИРАЕТ размер и яркость по мере роста уклона, а плоские
  // места остаются мелкими и тусклыми — именно контраст «кромка/заливка» рисует
  // форму, а не абсолютное число точек.
  const edgeT = clamp01((slope - LK.edgeLo) / Math.max(0.01, LK.edgeHi - LK.edgeLo));
  let role = CONFIG.layer.SURFACE;
  if (edgeT > 0.02) role = (hash(x, z) > 1 - edgeK) ? CONFIG.layer.EDGE : CONFIG.layer.SILHOUETTE;
  const sparkle = (role === CONFIG.layer.SURFACE && hash(x * 3, z * 3) > 0.985);
  if (sparkle) role = CONFIG.layer.SILHOUETTE;
  const accentSz = role === CONFIG.layer.EDGE ? LK.sizeEdge : LK.sizeSilh;
  const accentBr = role === CONFIG.layer.EDGE ? LK.brEdge : LK.brSilh;
  // АКЦЕНТ — РЕДКИЙ, А НЕ СПЛОШНОЙ ПО ГРАНИ. Когда буст шёл непрерывно по уклону,
  // ВСЯ крутая стена получала максимальные размер и яркость и в кадре превращалась
  // в сплошной белый сугроб (аддитивный блендинг складывает). На референсе грань
  // тёмная и редкая, светятся только КРОМКИ (их рисует контурный проход) и редкие
  // искры на самой грани — поэтому полный буст оставляем ~18% точек грани,
  // остальным лишь четверть.
  const gate = hash(x * 5, z * 13) < 0.18 ? 1 : 0.25;
  const accentT = sparkle ? 1 : edgeT * gate;
  const sz = lerp(LK.sizeSurface, accentSz, accentT);
  const br = lerp(LK.brSurface, accentBr, accentT);
  // свет по нормали склона — то, что превращает облако в форму
  const nx = -hx, ny = 1.8, nz = -hz;
  const nl = Math.hypot(nx, ny, nz) || 1;
  const lit = clamp01((nx * -0.45 + ny * 0.82 + nz * -0.36) / nl);
  let g = br * (CONFIG.look.litFloor + (1 - CONFIG.look.litFloor) * Math.pow(lit, CONFIG.look.litPow));
  // ЗАТЕНЕНИЕ ГРАНИ: чем круче стена, тем темнее её заливка — стена читается тёмной
  // массой с яркой кромкой сверху (как на референсе), а не светящейся простынёй
  g *= lerp(1, LK.faceShade, clamp01(slope / 2.5));
  if (isCeil) g *= 0.66;                       // потолок в тени — читается как свод
  g *= lerp(1.12, 0.6, far);                   // §12/§15 периферия тусклее
  const vb = 0.84 + 0.16 * hash(x * 7, z * 7);
  const w = LK.tintRoute * (1 - far * 0.6);
  col.push((g + (tint[0] - g) * w) * vb, (g + (tint[1] - g) * w) * vb, (g + (tint[2] - g) * w) * vb);
  pos.push(x, y, z);
  siz.push(sz * lerp(1.05, 0.72, far));
  msk.push(role);
}

// точки по поверхности солида: плотность по площади, чтобы тонкая балка не
// оказалась прозрачной, а толстая колонна — не съела бюджет
function sampleSolid(s, pos, col, siz, msk, tint, stepMul) {
  const LK = CONFIG.look;
  const WS = CONFIG.warp.solid;
  // Деформация оболочки: без неё тор арки и капсула колонны читаются как идеальные
  // примитивы (ровно то, на что была жалоба). Смещение берётся из того же шума,
  // поэтому форма гнётся связно, а не рассыпается в кашу.
  const put = (x0, y0, z0, up) => {
    const dx = (fbm(x0 * 0.05, z0 * 0.05, 2, 0.5) - 0.5) * 2 * WS;
    const dy = (fbm(y0 * 0.05 + 19, z0 * 0.05 + 7, 2, 0.5) - 0.5) * 2 * WS * 0.7;
    const dz = (fbm(x0 * 0.05 + 41, y0 * 0.05 + 3, 2, 0.5) - 0.5) * 2 * WS;
    const x = x0 + dx, y = y0 + dy, z = z0 + dz;
    const g = LK.brSolid * (0.42 + 0.58 * clamp01(up));
    const vb = 0.84 + 0.16 * hash(x * 5, z * 5);
    col.push((g + (tint[0] - g) * 0.24) * vb, (g + (tint[1] - g) * 0.24) * vb, (g + (tint[2] - g) * 0.24) * vb);
    pos.push(x, y, z);
    siz.push(LK.sizeSolid);
    msk.push(CONFIG.layer.SOLID);
  };
  if (s.k === 'cap') {
    const len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1], s.b[2] - s.a[2]);
    const N = Math.max(60, Math.round(len * s.r * 9 / stepMul));
    const dx = (s.b[0] - s.a[0]) / len, dy = (s.b[1] - s.a[1]) / len, dz = (s.b[2] - s.a[2]) / len;
    // два перпендикуляра к оси капсулы
    let ux = 0, uy = 1, uz = 0;
    if (Math.abs(dy) > 0.9) { ux = 1; uy = 0; }
    let t1x = uy * dz - uz * dy, t1y = uz * dx - ux * dz, t1z = ux * dy - uy * dx;
    const t1l = Math.hypot(t1x, t1y, t1z) || 1; t1x /= t1l; t1y /= t1l; t1z /= t1l;
    const t2x = dy * t1z - dz * t1y, t2y = dz * t1x - dx * t1z, t2z = dx * t1y - dy * t1x;
    for (let i = 0; i < N; i++) {
      const u = (i + hash(i, s.r)) / N, ang = hash(i, 13) * 6.2832;
      const rr = s.r * (0.86 + 0.14 * hash(i * 3, 7));
      const ca = Math.cos(ang) * rr, sa = Math.sin(ang) * rr;
      const px = s.a[0] + dx * len * u + t1x * ca + t2x * sa;
      const py = s.a[1] + dy * len * u + t1y * ca + t2y * sa;
      const pz = s.a[2] + dz * len * u + t1z * ca + t2z * sa;
      put(px, py, pz, (t1y * ca + t2y * sa) / s.r * 0.5 + 0.5);
    }
  } else {
    const N = Math.max(500, Math.round(s.R * s.rt * 44 / stepMul));
    const cy = Math.cos(s.yaw), sy = Math.sin(s.yaw);
    for (let i = 0; i < N; i++) {
      const th = hash(i, 3) * 6.2832, ph = hash(3, i) * 6.2832;
      const rr = s.rt * (0.84 + 0.16 * hash(i * 3, 5));
      const lx = (s.R + rr * Math.cos(ph)) * Math.cos(th);
      const ly = (s.R + rr * Math.cos(ph)) * Math.sin(th);
      const lz = rr * Math.sin(ph);
      put(s.c[0] + lx * cy + lz * sy, s.c[1] + ly, s.c[2] - lx * sy + lz * cy,
          Math.sin(th) * 0.5 + 0.5);
    }
  }
}

// ============================================================================
// МЕНЕДЖЕР: план → чанки с LOD по дистанции → окно из behind/ahead (ТЗ §19).
// Пул массивов не нужен: чанк живёт секунды, а генерация уходит в Worker.
// ============================================================================
function makeManager(seed, count) {
  const plan = planLevel(seed, count);
  const route = buildRoute(plan);
  return {
    seed: seed, plan: plan, route: route,
    // какие индексы должны быть живы при позиции игрока z
    window: function (z) {
      let cur = 0;
      for (let i = 0; i < plan.length; i++) if (z >= plan[i].zStart) cur = i;
      const from = Math.max(0, cur - CONFIG.world.behind);
      const to = Math.min(plan.length - 1, cur + CONFIG.world.ahead);
      const out = [];
      for (let i = from; i <= to; i++) {
        // §22 LOD по дистанции: ближний полный, дальние всё реже
        const d = i - cur;
        const lod = d <= 0 ? 0 : d === 1 ? 0 : d === 2 ? 1 : d === 3 ? 2 : 3;
        out.push({ index: i, def: plan[i], lod: lod });
      }
      return out;
    },
    // §30: не прошёл валидацию — перегенерируем с другим seed, иначе fallback
    build: function (i, lod) {
      let def = plan[i];
      for (let attempt = 0; attempt < 4; attempt++) {
        const ch = generateChunk(def, { lod: lod });
        if (ch.valid.ok) return ch;
        def = makeChunkDef({ index: def.index, seed: (def.seed + 7919 * (attempt + 1)) | 0,
          type: def.type, phase: def.phase, progress: def.index / plan.length,
          firstTime: def.firstTime, rng: makeRng(def.seed) });
        def.zStart = plan[i].zStart; def.zEnd = plan[i].zEnd;
        def.length = plan[i].length; def.axis = axisFor(def);
      }
      // fallback: самый безопасный тип той же длины
      const fb = makeChunkDef({ index: plan[i].index, seed: plan[i].seed, type: T.TRANSITION,
        phase: plan[i].phase, progress: 0.1, firstTime: false, rng: makeRng(plan[i].seed) });
      fb.zStart = plan[i].zStart; fb.zEnd = plan[i].zEnd; fb.length = plan[i].length;
      fb.axis = axisFor(fb);
      const ch = generateChunk(fb, { lod: lod });
      ch.fallback = true;
      return ch;
    }
  };
}

// ── ГЛОБАЛЬНАЯ ВЫСОТА ПО МИРОВОМУ z ────────────────────────────────────────
// Игра спрашивает высоту рельефа в произвольной точке: от этого зависят коллизия
// корабля, спавн ядер, камера и «бреющий полёт». Поля живут внутри чанков, поэтому
// нужен переходник: найти чанк по z и спросить его поле. Поля кэшируются — иначе
// на каждый кадр пересоздавался бы chunkField со всеми замыканиями.
function makeHeightProbe(plan) {
  const cache = new Map();
  function fieldFor(i) {
    let f = cache.get(i);
    if (!f) {
      const def = plan[i];
      if (!def.axis) def.axis = axisFor(def);
      f = chunkField(def);
      cache.set(i, f);
      if (cache.size > 12) cache.delete(cache.keys().next().value);
    }
    return f;
  }
  function chunkAt(z) {
    // план отсортирован по z, чанков десятки — линейный поиск дешевле бинарного
    for (let i = 0; i < plan.length; i++) if (z >= plan[i].zStart && z < plan[i].zEnd) return i;
    return z < 0 ? 0 : plan.length - 1;
  }
  return {
    chunkAt: chunkAt,
    fieldFor: fieldFor,
    floor: function (x, z) {
      const i = chunkAt(z), def = plan[i];
      const t = clamp01((z - def.zStart) / def.length);
      return fieldFor(i).floor(x, t);
    },
    ceil: function (x, z) {
      const i = chunkAt(z), def = plan[i];
      const t = clamp01((z - def.zStart) / def.length);
      return fieldFor(i).ceil(x, t);
    },
    // ближайшая точка коридора — по ней ведём камеру и спавним награды
    corridorAt: function (z) {
      const i = chunkAt(z), def = plan[i];
      const t = clamp01((z - def.zStart) / def.length);
      const a = def.axis ? def.axis(t) : axisFor(def)(t);
      const F = fieldFor(i);
      const fy = F.floor(a[0], t), cy = F.ceil(a[0], t);
      let y = fy + CONFIG.ship.floorClear + 4;
      if (isFinite(cy)) y = Math.min(y, cy - CONFIG.ship.ceilClear);
      return { x: a[0], y: clamp(y, CONFIG.ship.yMin + 2, CONFIG.ship.yMax - 2),
               chunk: i, type: def.type, w: def.corridorW };
    }
  };
}

root.PDWorld = {
  CONFIG: CONFIG, TYPES: T,
  buildPointIndex: buildPointIndex, forPointsNear: forPointsNear,
  forPointsInBox: forPointsInBox,
  makeHeightProbe: makeHeightProbe,
  makeRng: makeRng, hash: hash, noise: noise, fbm: fbm, ridged: ridged,
  clamp: clamp, clamp01: clamp01, smoothstep: smoothstep, lerp: lerp,
  planLevel: planLevel, makeChunkDef: makeChunkDef, buildRoute: buildRoute,
  axisFor: axisFor, chunkField: chunkField, buildCorridor: buildCorridor,
  validate: validate, generateChunk: generateChunk, solidDist: solidDist,
  makeManager: makeManager
};

})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this));
