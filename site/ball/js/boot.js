/* ЗАСТАВКА: книга открывается, когда всё загружено.
 *
 * Зачем вообще. Первый экран книги — это кадр арены в два мегабайта, облако из 27 000
 * точек и шрифты. Без заставки посетитель видит полсекунды пустой чёрный экран, потом
 * рывками приходящие куски. Здесь мы держим слой поверх, пока не пришло главное, и
 * снимаем его одним плавным уходом.
 *
 * Что считается «главным». Ждать `window.load` целиком нельзя: в книге двенадцать
 * тяжёлых кадров и два ролика, и заставка висела бы десятки секунд. Ждём:
 *   • шрифты (document.fonts.ready) — без них текст перескакивает;
 *   • картинки ПЕРВОГО ЭКРАНА, то есть те, что попадают в первые два экрана прокрутки.
 * Остальное догружается уже за открытой книгой.
 *
 * Полоса показывает НАСТОЯЩУЮ долю загруженного, а не бегает туда-сюда: пустая полоса
 * с абстрактной анимацией не даёт понять, ждать ли ещё.
 *
 * Предохранитель на 8 секунд обязателен. Если картинка не пришла (медленная сеть, битый
 * файл, выключенный кэш), книга должна открыться всё равно — иначе документ, отправленный
 * партнёру, окажется просто чёрным экраном.
 */
(function () {
  var boot = document.getElementById('boot');
  if (!boot) return;
  var bar = document.getElementById('bootBar');
  var root = document.documentElement;
  root.classList.add('booting');

  var done = false;
  function open() {
    if (done) return;
    done = true;
    if (bar) bar.style.width = '100%';
    root.classList.remove('booting');
    root.classList.add('booted');
    // слой убираем из дерева после ухода: он перехватывал бы клики, оставшись невидимым
    setTimeout(function () { if (boot.parentNode) boot.parentNode.removeChild(boot); }, 800);
  }

  // картинки первых двух экранов
  var need = [];
  var imgs = document.querySelectorAll('main img, .hero-visual img');
  Array.prototype.forEach.call(imgs, function (im) {
    var top = im.getBoundingClientRect().top + (window.scrollY || 0);
    if (top < innerHeight * 2) need.push(im);
  });

  var total = need.length + 1;                  // +1 — шрифты
  var ready = 0;
  function step() {
    ready++;
    if (bar) bar.style.width = Math.min(100, Math.round(ready / total * 100)) + '%';
    if (ready >= total) open();
  }

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(step, step);
  else step();

  need.forEach(function (im) {
    if (im.complete && im.naturalWidth) { step(); return; }
    im.addEventListener('load', step, { once: true });
    im.addEventListener('error', step, { once: true });
  });

  if (!need.length) step();                     // считать нечего — открываем по шрифтам
  setTimeout(open, 8000);                       // предохранитель
})();
