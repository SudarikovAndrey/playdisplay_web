/* ИСКРЫ В ВОЗДУХЕ — живой фон презентации.
 *
 * Зачем: тёмные слайды с текстом читаются как документ. Медленно всплывающие искры,
 * как над костром, добавляют экрану воздуха и движения, ничего не сообщая — и потому
 * не спорят с содержанием. Включается одним атрибутом `data-embers` у <body>.
 *
 * Что здесь важно и проверено:
 *
 *  • СЛОЙ ВСТАВЛЯЕТСЯ ПЕРВЫМ РЕБЁНКОМ <body>, а не последним. У слайдов
 *    `position: relative` без z-index: среди позиционированных элементов с одинаковым
 *    порядком выигрывает тот, кто НИЖЕ в разметке. Приписанный в конец слой оказался бы
 *    поверх текста, и искры пролетали бы по буквам. Первым — и они остаются позади
 *    содержания, но выше фона страницы (фон живёт на самом <body> и рисуется под всеми
 *    его детьми).
 *
 *  • ИСКРА РИСУЕТСЯ ГОТОВЫМ СПРАЙТОМ, а не радиальным градиентом на каждый кадр:
 *    градиент — самая дорогая операция канваса, и пятьдесят градиентов в кадре видно
 *    на слабом ноутбуке. Спрайт печём один раз в маленький канвас и растягиваем.
 *    Тот же приём, что у мяча в книге: печём заранее, в кадре только рисуем.
 *
 *  • ЯРКОСТЬ КОПИТСЯ СЛОЖЕНИЕМ (`lighter`). Искра — свет, а не наклейка: на пересечении
 *    двух искр должно становиться светлее. С обычным наложением они выглядят точками
 *    из краски.
 *
 *  • ЧИСЛО ИСКР СЧИТАЕТСЯ ОТ ПЛОЩАДИ ОКНА. Постоянное число на телефоне превращается
 *    в метель, а на большом экране теряется совсем.
 *
 *  • Не идёт при `prefers-reduced-motion` и в скрытой вкладке: браузер иначе продолжает
 *    считать кадры того, чего никто не видит.
 */
(function () {
  'use strict';

  function start(body) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var cv = document.createElement('canvas');
    cv.className = 'embers';
    cv.setAttribute('aria-hidden', 'true');
    body.insertBefore(cv, body.firstChild);
    var ctx = cv.getContext('2d');
    if (!ctx) return;

    /* ── СПРАЙТ ИСКРЫ ──────────────────────────────────────────────────── */
    var SPR = 32;
    var spr = document.createElement('canvas');
    spr.width = spr.height = SPR;
    var sc = spr.getContext('2d');
    var g = sc.createRadialGradient(SPR / 2, SPR / 2, 0, SPR / 2, SPR / 2, SPR / 2);
    /* Тёплый центр и рыжий ореол: у остывающей искры середина светлее краёв, а не
       наоборот. Ровный оранжевый кружок читается как маркер интерфейса. */
    g.addColorStop(0, 'rgba(255,246,224,1)');
    g.addColorStop(0.28, 'rgba(255,198,120,.72)');
    g.addColorStop(0.62, 'rgba(226,124,44,.22)');
    g.addColorStop(1, 'rgba(226,124,44,0)');
    sc.fillStyle = g;
    sc.fillRect(0, 0, SPR, SPR);

    /* ── ЧАСТИЦЫ ───────────────────────────────────────────────────────── */
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = 0, H = 0, count = 0;
    var p = [];

    function resize() {
      W = innerWidth; H = innerHeight;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      /* Одна искра примерно на 26 000 точек площади: на 1440×900 это 50, на телефоне 14 */
      count = Math.max(10, Math.min(64, Math.round((W * H) / 26000)));
      while (p.length < count) p.push(spawn(true));
      if (p.length > count) p.length = count;
    }

    function spawn(anywhere) {
      var r = 1.1 + Math.random() * 2.4;         // радиус в точках экрана
      return {
        x: Math.random() * W,
        /* При первом заполнении искры раскиданы по всей высоте, дальше рождаются снизу:
           иначе на старте экран пуст, и первые полминуты искр нет вовсе. */
        y: anywhere ? Math.random() * H : H + 20 + Math.random() * 60,
        r: r,
        /* СКОРОСТЬ СЧИТАЕТСЯ ОТ РАЗМЕРА: крупная искра ближе к зрителю и идёт быстрее.
           При независимой случайной скорости мелкие обгоняют крупных, и глубина
           рассыпается — рой читается как плоская сетка точек. */
        vy: 0.10 + r * 0.14,
        /* Своя фаза и частота качания — иначе весь рой качается синхронно, и видно,
           что это одна формула, а не воздух. */
        ph: Math.random() * Math.PI * 2,
        fr: 0.006 + Math.random() * 0.012,
        amp: 0.18 + Math.random() * 0.55,
        max: 0.20 + Math.random() * 0.34         // потолок яркости: искры не должны спорить с текстом
      };
    }

    /* ── КАДР ──────────────────────────────────────────────────────────── */
    var raf = null;

    function frame() {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < p.length; i++) {
        var s = p[i];
        s.ph += s.fr;
        s.x += Math.sin(s.ph) * s.amp;
        s.y -= s.vy;
        if (s.y < -30) { p[i] = spawn(false); continue; }
        /* ЯРКОСТЬ СЧИТАЕТСЯ ОТ ПРОЙДЕННОГО ПУТИ, А НЕ ОТ ВОЗРАСТА ИСКРЫ. С возрастом
           получалось так: все искры гасли, не поднявшись выше середины, и верхняя половина
           экрана оставалась пустой — рой лежал полосой у нижней кромки. По пути искра
           разгорается у земли и тает к верху, а в покое рой распределён по всей высоте. */
        var t = 1 - s.y / (H + 60);
        var a = t < 0.10 ? t / 0.10 : (t > 0.62 ? Math.max(0, 1 - (t - 0.62) / 0.38) : 1);
        var d = s.r * 7;                          // спрайт заметно больше ядра: он и есть ореол
        ctx.globalAlpha = Math.max(0, a) * s.max;
        ctx.drawImage(spr, s.x - d / 2, s.y - d / 2, d, d);
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    }

    function run() { if (!raf) raf = requestAnimationFrame(frame); }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

    resize();
    addEventListener('resize', resize);
    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : run(); });
    run();
  }

  function init() {
    var body = document.body;
    if (body && body.hasAttribute('data-embers') && !body.querySelector('canvas.embers')) start(body);
  }

  window.kitEmbers = init;
  if (document.readyState !== 'loading') init();
  else addEventListener('DOMContentLoaded', init);
})();
