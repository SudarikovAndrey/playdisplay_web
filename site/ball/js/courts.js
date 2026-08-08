/* РАЗМЕТКА СПОРТИВНЫХ ПЛОЩАДОК НА ФОНЕ.
 *
 * Текстовые главы книги выглядели пустовато. Теперь под текстом — едва заметная
 * разметка настоящей площадки из точек: вид сверху, как на плане. По мере прокрутки
 * она СКЛАДЫВАЕТСЯ В ПЕРСПЕКТИВУ, будто камера опускается от вида сверху к линии
 * горизонта, у крайней точки сжимается в линию и гаснет. Через главу появляется
 * следующая — снова полностью развёрнутая.
 *
 * Решения, которые здесь существенны.
 *
 * 1. ГДЕ ПОКАЗЫВАТЬ. Разметка достаётся только главам БЕЗ иллюстраций: там, где идут
 *    кадры, фон уже занят, и вторая графика читалась бы как сор. Такие главы находятся
 *    сами (`.chapter` без `figure`), а не перечисляются руками: содержание книги ещё
 *    будет меняться, и список пришлось бы помнить.
 *
 * 2. КООРДИНАТЫ ПЛОЩАДОК — НАСТОЯЩИЕ, в метрах: теннис 23.77×10.97, поле 105×68,
 *    баскетбол 28×15, сквош 9.75×6.4. Рисовать «похоже на глаз» бессмысленно — именно
 *    точные пропорции и делают разметку узнаваемой. Перед выводом каждая площадка
 *    приводится к единичному размеру, поэтому проекция одна для всех.
 *
 * 3. ПЕРСПЕКТИВА СЧИТАЕТСЯ КАМЕРОЙ, а не CSS-трансформацией. Наклон камеры на угол a
 *    над плоскостью даёт для точки (u, v):
 *        d  = H·cos a + v·sin a        (расстояние до картинной плоскости)
 *        sx = u / d,  sy = (v·cos a − H·sin a) / d
 *    При a = 0 это вид сверху (sx = u/H, sy = v/H), при a → 90° дальний край уходит к
 *    горизонту, а линии сходятся — ровно то, что нужно. CSS `perspective` дал бы то же
 *    только для плоского прямоугольника, а у нас точки, и их надо проецировать поштучно.
 *
 * 4. ТОЧКИ РИСУЮТСЯ fillRect с запечённой прозрачностью — по тем же причинам, что и
 *    мяч в ball.js: круги и смена globalAlpha на каждую точку в кадр не укладываются.
 */
(function () {
  var host = document.querySelector('main');
  if (!host) return;

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- геометрия площадок (метры, центр в нуле) ----------
  function seg(x1, y1, x2, y2) { return [[x1, y1], [x2, y2]]; }
  function rect(w, h, cy) {
    cy = cy || 0;
    var a = w / 2, b = h / 2;
    return [[-a, cy - b], [a, cy - b], [a, cy + b], [-a, cy + b], [-a, cy - b]];
  }
  function circle(r, cy, from, to) {
    cy = cy || 0; from = from == null ? 0 : from; to = to == null ? Math.PI * 2 : to;
    var pts = [], N = 64;
    for (var i = 0; i <= N; i++) {
      var t = from + (to - from) * i / N;
      pts.push([Math.cos(t) * r, cy + Math.sin(t) * r]);
    }
    return pts;
  }

  var COURTS = {
    football: function () {                        // 105 × 68
      var L = [];
      L.push(rect(68, 105));
      L.push(seg(-34, 0, 34, 0));
      L.push(circle(9.15));
      L.push([[0 - 0.2, 0], [0 + 0.2, 0]]);
      [-1, 1].forEach(function (s) {
        L.push(rect(40.32, 16.5, s * (52.5 - 8.25)));
        L.push(rect(18.32, 5.5, s * (52.5 - 2.75)));
        L.push(circle(9.15, s * (52.5 - 11), s > 0 ? Math.PI * 1.08 : Math.PI * 0.08,
                                             s > 0 ? Math.PI * 1.92 : Math.PI * 0.92));
      });
      return L;
    },
    tennis: function () {                          // 23.77 × 10.97
      var L = [];
      L.push(rect(10.97, 23.77));
      L.push(seg(-4.115, -11.885, -4.115, 11.885));
      L.push(seg(4.115, -11.885, 4.115, 11.885));
      L.push(seg(-4.115, -6.4, 4.115, -6.4));
      L.push(seg(-4.115, 6.4, 4.115, 6.4));
      L.push(seg(0, -6.4, 0, 6.4));
      L.push(seg(-5.485, 0, 5.485, 0));            // сетка
      return L;
    },
    basketball: function () {                      // 28 × 15
      var L = [];
      L.push(rect(15, 28));
      L.push(seg(-7.5, 0, 7.5, 0));
      L.push(circle(1.8));
      [-1, 1].forEach(function (s) {
        L.push(rect(4.9, 5.8, s * (14 - 2.9)));    // трапеция-ключ
        L.push(circle(1.8, s * (14 - 5.8)));
        // трёхочковая: прямые вдоль боковых плюс дуга
        L.push(seg(-6.6, s * 14, -6.6, s * (14 - 2.99)));
        L.push(seg(6.6, s * 14, 6.6, s * (14 - 2.99)));
        L.push(circle(6.75, s * (14 - 1.575),
          s > 0 ? Math.PI * 1.04 : Math.PI * 0.04, s > 0 ? Math.PI * 1.96 : Math.PI * 0.96));
      });
      return L;
    },
    squash: function () {                          // 9.75 × 6.4
      var L = [];
      L.push(rect(6.4, 9.75));
      L.push(seg(-3.2, 0.565, 3.2, 0.565));        // короткая линия
      L.push(seg(0, 0.565, 0, 4.875));             // половина корта
      L.push(rect(1.6, 1.6, 1.365));               // подающие боксы
      L.push([[-3.2, 0.565], [-1.6, 0.565], [-1.6, 2.165], [-3.2, 2.165]]);
      L.push([[3.2, 0.565], [1.6, 0.565], [1.6, 2.165], [3.2, 2.165]]);
      return L;
    },
    green: function () {                           // линии высот грина
      var L = [], i, k;
      // четыре замкнутых контура: не круги, а слегка смятые кольца — так рисуют горизонтали
      for (k = 0; k < 4; k++) {
        var r0 = 4 + k * 3.2, pts = [];
        for (i = 0; i <= 72; i++) {
          var t = i / 72 * Math.PI * 2;
          var r = r0 * (1 + 0.13 * Math.sin(3 * t + k * 0.7) + 0.07 * Math.sin(5 * t - k));
          pts.push([Math.cos(t) * r, Math.sin(t) * r * 0.78]);
        }
        L.push(pts);
      }
      L.push(circle(0.54, 0));                     // лунка
      L.push(seg(0, 0.54, 0, 7.6));                // линия ската
      return L;
    }
  };

  // ---------- главы без иллюстраций получают площадку ----------
  var ORDER = ['football', 'tennis', 'basketball', 'squash', 'green'];
  var slots = [];
  var chapters = document.querySelectorAll('.chapter');
  var k = 0;
  Array.prototype.forEach.call(chapters, function (ch) {
    if (ch.querySelector('figure')) return;        // там, где кадры, фон занят
    slots.push({ el: ch, court: build(COURTS[ORDER[k % ORDER.length]]()) });
    k++;
  });
  if (!slots.length) return;

  // ---------- полилинии в точки ----------
  function build(lines) {
    var maxAbs = 0, i, j, p;
    for (i = 0; i < lines.length; i++)
      for (j = 0; j < lines[i].length; j++) {
        p = lines[i][j];
        maxAbs = Math.max(maxAbs, Math.abs(p[0]), Math.abs(p[1]));
      }
    var step = 2 / 210;                            // шаг в единичных координатах
    var out = [];
    for (i = 0; i < lines.length; i++) {
      var L = lines[i];
      for (j = 0; j < L.length - 1; j++) {
        var ax = L[j][0] / maxAbs, ay = L[j][1] / maxAbs;
        var bx = L[j + 1][0] / maxAbs, by = L[j + 1][1] / maxAbs;
        var len = Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay));
        var n = Math.max(1, Math.round(len / step));
        for (var s = 0; s < n; s++) {
          var t = s / n;
          out.push(ax + (bx - ax) * t, ay + (by - ay) * t);
        }
      }
    }
    return new Float32Array(out);
  }

  // ---------- слой ----------
  var cv = document.createElement('canvas');
  cv.className = 'courts-layer';
  cv.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(cv, document.body.firstChild);
  var ctx = cv.getContext('2d');
  var W = 0, H = 0, DPR = 1;

  function fit() {
    DPR = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  fit();
  addEventListener('resize', fit, { passive: true });

  var CAM = 1.15;                                  // высота камеры в единицах площадки
  var TILT = 1.3;                                  // до какого угла складываем (рад)
  var ALPHA = 6;                                   // ступеней прозрачности
  var TONE = [];
  // яркость подобрана по снимку экрана: на 0.035…0.175 разметка пропадала совсем,
  // здесь она читается как след на полу и всё ещё не мешает тексту
  for (var a = 0; a < ALPHA; a++) TONE.push('rgba(202,218,248,' + (0.05 + a * 0.036).toFixed(3) + ')');

  function draw() {
    ctx.clearRect(0, 0, W, H);
    if (reduce) return;

    var vh = H, i, live = null, p = 0;
    for (i = 0; i < slots.length; i++) {
      var b = slots[i].el.getBoundingClientRect();
      // разметка живёт, пока глава проходит экран: от подхода снизу до ухода вверх
      var start = vh * 0.85, end = -b.height * 0.75;
      if (b.top < start && b.top > end) {
        live = slots[i];
        p = (start - b.top) / (start - end);
        break;
      }
    }
    if (!live) return;

    // проявление и уход: по краям пути гасим, чтобы не возникало из ничего
    var fade = Math.min(1, p / 0.1) * Math.min(1, (1 - p) / 0.14);
    if (fade <= 0.01) return;

    /* НАПРАВЛЕНИЕ СВОРАЧИВАНИЯ. Одного наклона камеры мало: при наклоне ближний край
     * площадки расходится вниз и в стороны, и это читается как РАСКРЫТИЕ, хотя дальний
     * край в это время уходит к горизонту. Поэтому вместе с наклоном камера ещё и
     * поднимается (CAM), а масштаб падает (F): к концу пути площадка целиком сжимается
     * в линию у горизонта и гаснет — как и задумано.
     */
    var ang = p * TILT;
    var ca = Math.cos(ang), sa = Math.sin(ang);
    var cam = CAM * (1 + 1.05 * p);
    var F = Math.min(W, H) * 0.46 * (1 - 0.42 * p);
    var cx = W * 0.5 + (p - 0.5) * W * 0.06;       // лёгкий сдвиг — тот самый параллакс
    var cy = H * (0.52 - 0.1 * p);                 // горизонт поднимается вместе с камерой
    var P = live.court;

    for (i = 0; i < P.length; i += 2) {
      var u = P[i], v = P[i + 1];
      var d = cam * ca + v * sa;
      if (d < 0.06) continue;                      // за камерой
      var sx = cx + (u / d) * F;
      var sy = cy + ((v * ca - cam * sa) / d) * F;
      if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) continue;
      // дальние точки тусклее: так плоскость читается как уходящая в глубину
      var q = fade * Math.min(1, 0.45 + 0.55 / d);
      var lev = (q * ALPHA) | 0; if (lev > ALPHA - 1) lev = ALPHA - 1;
      if (lev < 0) continue;
      ctx.fillStyle = TONE[lev];
      ctx.fillRect(sx, sy, 1.35, 1.35);
    }
  }

  var pending = false;
  function ask() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; draw(); });
  }
  addEventListener('scroll', ask, { passive: true });
  addEventListener('resize', ask, { passive: true });
  draw();
})();
