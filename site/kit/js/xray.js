/* РЕНТГЕН КУПОЛА на первом кадре арены.
 *
 * Под курсором проявляется круг диаметром 200 точек, и в нём видна сетка несущей
 * конструкции купола — тот же кадр, но с прорисованными связями. Вне верхней части
 * кадра не проявляется ничего.
 *
 * Три решения, которые тут неочевидны.
 *
 * 1. Слой рентгена — картинка В ПОЛНЫЙ РАЗМЕР базовой, хотя содержимое занимает только
 *    верхние 609 пикселей из 1024. Причина в кадрировании: базовая картинка выведена
 *    через object-fit: cover, то есть масштабируется и обрезается по месту, и при разных
 *    пропорциях окна её верхняя грань уезжает за кадр. Наложить сверху обрезок и «состыковать
 *    по верхней грани» средствами CSS нельзя — грани в кадре может не быть вовсе. А вот
 *    слой того же размера с тем же cover совпадает с базой пиксель в пиксель при любом
 *    окне. Низ слоя сведён в прозрачность, поэтому «где рентген кончается» не читается
 *    ровной горизонтальной границей, и ниже проявлять просто нечего.
 *
 * 2. Пятно — маска радиальным градиентом, а не clip-path: у clip-path край всегда резкий,
 *    а нужно плавное растворение. Центр маски двигается через CSS-переменные: браузер
 *    пересобирает только маску одного слоя, разметку это не трогает.
 *
 * 3. Координаты считаются от рамки картинки, а не от окна, и обновляются в кадре
 *    (requestAnimationFrame): pointermove приходит чаще, чем экран успевает
 *    перерисоваться, и без склейки на каждый кадр приходилось бы по несколько
 *    пересчётов маски впустую.
 */
(function () {
  var fig = document.querySelector('.hero-visual');
  if (!fig) return;
  var layer = fig.querySelector('.xray-layer');
  if (!layer) return;

  // на тач-устройствах курсора нет — проявлять нечем
  if (window.matchMedia && !matchMedia('(pointer: fine)').matches) {
    layer.remove();
    return;
  }

  var px = 0, py = 0, want = false, shown = false, queued = false;

  function apply() {
    queued = false;
    fig.style.setProperty('--xr-x', px.toFixed(1) + 'px');
    fig.style.setProperty('--xr-y', py.toFixed(1) + 'px');
    if (want !== shown) {
      shown = want;
      fig.classList.toggle('is-xray', shown);
    }
  }

  addEventListener('pointermove', function (e) {
    var b = fig.getBoundingClientRect();
    want = e.clientX >= b.left && e.clientX <= b.right &&
           e.clientY >= b.top && e.clientY <= b.bottom;
    if (want) { px = e.clientX - b.left; py = e.clientY - b.top; }
    if (!queued) { queued = true; requestAnimationFrame(apply); }
  }, { passive: true });

  // уехали колесом — пятно должно погаснуть, даже если мышь не двигалась
  addEventListener('scroll', function () {
    if (!shown) return;
    var b = fig.getBoundingClientRect();
    if (py + b.top < b.top || py + b.top > b.bottom) {
      want = false;
      if (!queued) { queued = true; requestAnimationFrame(apply); }
    }
  }, { passive: true });
})();
