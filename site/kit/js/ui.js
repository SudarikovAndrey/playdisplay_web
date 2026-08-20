/* ПОВЕДЕНИЕ КНИГИ КАК ПРИЛОЖЕНИЯ: мягкая прокрутка, кнопка «в начало», запрет
 * выделения и перетаскивания.
 *
 * 1. МЯГКАЯ ПРОКРУТКА. Колесо мыши двигает страницу рывками по 100 пикселей — на
 *    книге с крупными кадрами это читается как дёрганье. Здесь колесо не двигает
 *    страницу само, а сдвигает ЦЕЛЬ, к которой позиция подтягивается каждый кадр.
 *    Важные оговорки, из-за которых такие «улучшения» обычно и ломают сайты:
 *      • тачпад и тач-скролл не перехватываем — там инерция уже своя, и вмешательство
 *        делает её двойной. Тачпад отличаем по дробному deltaY и режиму deltaMode 0
 *        с малым шагом;
 *      • Ctrl+колесо — это зум, его не трогаем;
 *      • если человек тянет полосу прокрутки, жмёт пробел или PageDown, цель
 *        подтягивается к настоящему положению, иначе страница «отпружинит» назад;
 *      • при `prefers-reduced-motion` не работаем вовсе.
 *
 * 2. КНОПКА «В НАЧАЛО» появляется после первого экрана и ведёт наверх штатной
 *    плавной прокруткой.
 *
 * 3. ВЫДЕЛЕНИЕ И ПЕРЕТАСКИВАНИЕ. Выделение снято в CSS, а перетаскивание картинок
 *    приходится отменять событием: `-webkit-user-drag` понимают не все браузеры,
 *    а вот `dragstart` есть везде.
 */
(function () {
  var root = document.documentElement;
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- 3. монолитность ----------
  document.addEventListener('dragstart', function (e) {
    if (e.target && e.target.tagName === 'IMG') e.preventDefault();
  });

  /* ---------- Полноэкранные кадры: точный вылет из колонки ----------
   * Кадры «на всю ширину» живут внутри текстовой колонки и выходят из неё отрицательным
   * отступом. В CSS этот отступ считается от ширины страницы — и верно это только пока
   * колонка стоит по центру. У «feature»-глав она отжата к правому краю, и ролик арены
   * уезжал в сторону на пол-колонки. Здесь отступ берётся по НАСТОЯЩЕМУ положению
   * родителя: сколько до левого края области содержания, столько и отыгрываем.
   */
  function bleed() {
    var navW = parseFloat(getComputedStyle(root).getPropertyValue('--nav-width')) || 0;
    var w = innerWidth - navW;
    var list = document.querySelectorAll('.art-frame--fullscreen');
    Array.prototype.forEach.call(list, function (el) {
      el.style.width = '';                       // сначала снимаем прошлую правку,
      el.style.marginLeft = '';                  // иначе меряем уже сдвинутое
      var pl = el.parentElement.getBoundingClientRect().left;
      el.style.width = w + 'px';
      el.style.marginLeft = (navW - pl) + 'px';
      el.style.marginRight = '0px';
    });
  }
  bleed();
  addEventListener('resize', bleed, { passive: true });
  addEventListener('load', bleed);               // после подгрузки шрифтов колонка сдвигается

  /* ---------- Движущиеся иллюстрации ----------
   * Ролики без звука играют только пока в кадре: книга длинная, и десяток видео,
   * крутящихся за экраном, съедает батарею впустую. Ставим на паузу за кадром. */
  /* Захват геймплея в рамке телефона — сюда же: он висит на первом экране, и когда
     презентацию пролистали дальше, крутить его незачем. Обратный ход тоже полезен —
     вернувшись на первый экран, ролик запускается сам, даже если браузер поставил его
     на паузу, пока вкладка была в фоне. */
  var motion = document.querySelectorAll('.art-surface--video video, .phone-film video');
  if (motion.length && window.IntersectionObserver) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        else v.pause();
      });
    }, { rootMargin: '15% 0px' });
    Array.prototype.forEach.call(motion, function (v) { io.observe(v); });
  }

  /* ---------- 1.5. полный экран ----------
     Компред показывают с ноутбука на переговорах: панель браузера и вкладки съедают
     верх слайда и выдают, что это «страница», а не презентация. Кнопка переводит
     документ в полноэкранный режим и обратно.
     Состояние читаем из события fullscreenchange, а не из своей переменной: выйти
     можно клавишей Esc мимо нашей кнопки, и подпись разошлась бы с реальностью. */
  var full = document.getElementById('toFull');
  if (full && document.documentElement.requestFullscreen) {
    full.addEventListener('click', function () {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(function () {});
    });
    document.addEventListener('fullscreenchange', function () {
      var on = !!document.fullscreenElement;
      full.classList.toggle('is-on', on);
      var label = full.querySelector('span');
      if (label) label.textContent = on ? 'Свернуть' : 'Во весь экран';
      full.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  } else if (full) {
    full.hidden = true;                      // браузер без полноэкранного режима: кнопки нет
  }

  // ---------- 2. кнопка «в начало» ----------
  var top = document.getElementById('toTop');
  if (top) {
    top.addEventListener('click', function () {
      /* В РЕЖИМЕ СЛАЙДОВ прыгаем мгновенно. Плавная прокрутка к нулю там борется с
         прилипанием: браузер по дороге цепляется за ближайшую точку привязки и
         возвращает страницу на середину – кнопка «в начало» не доводила до первого
         экрана. Мгновенный переход прилипание не запускает. */
      if (reduced || document.documentElement.classList.contains('deck')) {
        scrollTo({ top: 0, behavior: 'instant' });
        return;
      }
      go(0);                                   // своей же плавной прокруткой, см. ниже
    });
    var lastShown = false;
    addEventListener('scroll', function () {
      var show = scrollY > innerHeight * 0.9;
      if (show !== lastShown) { lastShown = show; top.classList.toggle('is-on', show); }
    }, { passive: true });
  }

  /* ---------- 1. мягкая прокрутка ----------
   * ВАЖНАЯ ЛОВУШКА: у страницы задан `scroll-behavior: smooth`, и из-за него КАЖДЫЙ
   * программный scrollTo() браузер сам превращает в плавную прокрутку. Кадровый лерп
   * на этом ломался: каждый кадр начиналась новая анимация, гасила предыдущую, и за
   * 700 мс страница проезжала 17 пикселей вместо трёхсот. Поэтому внутри цикла
   * прокрутка ТОЛЬКО мгновенная (`behavior: 'instant'`), а плавность даём мы сами.
   * CSS-плавность при этом остаётся для перехода по разделам меню — там она уместна.
   */
  var target = scrollY, running = false, hijack = false, steps = 0, mine = -1;

  function maxScroll() {
    return Math.max(0, document.documentElement.scrollHeight - innerHeight);
  }

  function stop() { running = false; hijack = false; mine = -1; }

  function frame() {
    var d = target - scrollY;
    // Три страховки, и каждая появилась не зря: без них цикл однажды не закончился и
    // ДЕРЖАЛ страницу — ни программная прокрутка, ни переход по разделу не срабатывали,
    // потому что каждый кадр позиция возвращалась на место.
    if (Math.abs(d) < 0.6 || ++steps > 120) {     // дошли, либо пора отпустить
      scrollTo({ top: target, behavior: 'instant' });
      stop();
      return;
    }
    if (mine >= 0 && Math.abs(scrollY - mine) > 4) { stop(); return; }  // страницу двигает кто-то ещё
    var y = scrollY + d * 0.14;                   // ≈ треть секунды на докрутку
    mine = y;
    scrollTo({ top: y, behavior: 'instant' });
    requestAnimationFrame(frame);
  }

  function go(y) {
    target = Math.max(0, Math.min(maxScroll(), y));
    hijack = true; steps = 0; mine = -1;
    if (!running) { running = true; requestAnimationFrame(frame); }
  }

  /* В РЕЖИМЕ СЛАЙДОВ (html.deck) свой лерп не нужен и вреден: прокруткой там управляет
     прилипание браузера (scroll-snap), а перехват колеса не давал ему сработать — экран
     останавливался между слайдами. Одно правило вместо двух конкурирующих механизмов. */
  if (reduced || document.documentElement.classList.contains('deck')) return;

  addEventListener('wheel', function (e) {
    if (e.ctrlKey || e.metaKey) return;                     // зум
    var d = e.deltaY;
    // Перехватываем ТОЛЬКО щелчок колеса мыши: у него шаг от сорока пикселей и больше.
    // Всё мелкое — тачпад, инерция, синтетические события — пропускаем к браузеру.
    // Прежнее условие отсеивало лишь дробные значения, и поток мелких целочисленных
    // событий бесконечно подталкивал цель: страница ползла и не отпускала управление.
    if (!d || (e.deltaMode === 0 && Math.abs(d) < 40)) return;
    e.preventDefault();
    go((hijack ? target : scrollY) + d * 1.15);
  }, { passive: false });

  // любая другая прокрутка (полоса, клавиатура, привязка к разделу) — цель за ней
  addEventListener('scroll', function () {
    if (!hijack) target = scrollY;
  }, { passive: true });
  addEventListener('keydown', function () { hijack = false; }, { passive: true });
})();
