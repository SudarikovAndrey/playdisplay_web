/* ЗАСТАВКА: книга открывается, когда всё загружено.
 *
 * Зачем вообще. Первый экран книги — это кадр арены в два мегабайта, облако из 27 000
 * точек и шрифты. Без заставки посетитель видит полсекунды пустой чёрный экран, потом
 * рывками приходящие куски. Здесь мы держим слой поверх, пока не пришло главное, и
 * снимаем его одним плавным уходом.
 *
 * Что считается «главным» — ЗАВИСИТ ОТ ДОКУМЕНТА, и это выбор разметки:
 *   • по умолчанию ждём шрифты и картинки ПЕРВЫХ ДВУХ ЭКРАНОВ. Так сделана книга: в ней
 *     двенадцать тяжёлых кадров и два ролика, и полное ожидание держало бы заставку
 *     десятки секунд;
 *   • атрибут data-boot-all на слое заставки означает «ждать ВСЁ»: картинки, отложенные
 *     кадры и первые кадры роликов. Так сделана презентация: её листают на защите, и
 *     догрузка посреди показа выглядит как поломка. Прокрутка на это время заблокирована
 *     (html.booting), поэтому пролистать недогруженное нельзя физически.
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

  var all = boot.hasAttribute('data-boot-all');

  // картинки: либо все, либо только первых двух экранов
  var need = [];
  var imgs = document.querySelectorAll('main img, .hero-visual img, footer img');
  Array.prototype.forEach.call(imgs, function (im) {
    if (all) {
      /* Отложенная загрузка на время заставки снимается: браузер не тронул бы картинку,
         пока она далеко от экрана, и ожидание висело бы до предохранителя. */
      if (im.getAttribute('loading') === 'lazy') im.setAttribute('loading', 'eager');
      need.push(im);
      return;
    }
    var top = im.getBoundingClientRect().top + (window.scrollY || 0);
    if (top < innerHeight * 2) need.push(im);
  });

  /* Кадры, отложенные до нажатия (сборки машины), при полном ожидании грузим сразу:
     иначе первое переключение на защите показало бы пустое место. */
  if (all) {
    Array.prototype.forEach.call(document.querySelectorAll('img[data-src]'), function (im) {
      if (!im.getAttribute('src')) im.setAttribute('src', im.getAttribute('data-src'));
      need.push(im);
    });
  }

  /* Ролики: ждём ПЕРВЫЕ КАДРЫ (loadeddata), а не полную загрузку. Полная — это десятки
     мегабайт и минуты ожидания; первых кадров хватает, чтобы кадр не был пустым, а
     дальше браузер догружает сам. */
  var vids = all ? document.querySelectorAll('video') : [];

  var total = need.length + vids.length + 1;    // +1 — шрифты
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

  Array.prototype.forEach.call(vids, function (v) {
    // preload="metadata" не тянет кадры: для ожидания нужен хотя бы первый кадр
    if (v.getAttribute('preload') !== 'auto') v.setAttribute('preload', 'auto');
    if (v.readyState >= 2) { step(); return; }
    v.addEventListener('loadeddata', step, { once: true });
    v.addEventListener('error', step, { once: true });
  });

  if (!need.length && !vids.length) step();     // считать нечего — открываем по шрифтам
  /* Предохранитель. При полном ожидании он длиннее: там десятки мегабайт, и обрыв на
     восьмой секунде показал бы недогруженную презентацию — то самое, от чего уходим.
     Но он обязателен в любом случае: документ, отправленный партнёру, не должен
     остаться чёрным экраном из-за одного недошедшего файла. */
  setTimeout(open, all ? 30000 : 8000);
})();
