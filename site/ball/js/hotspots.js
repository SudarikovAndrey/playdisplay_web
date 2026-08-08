/* ПОДСКАЗКИ НА КАДРАХ.
 *
 * На иллюстрациях есть точки интереса: браслеты посетителей, мяч в водном поло, шар и
 * купол на первом кадре. У каждой — точка и круглая область чуть больше самого предмета;
 * при наведении выходит подсказка.
 *
 * Главное, из-за чего это не сделать чистым CSS: КАДРЫ ВЫВЕДЕНЫ ЧЕРЕЗ object-fit: cover.
 * Картинка масштабируется под рамку и обрезается по месту, поэтому проценты от РАМКИ не
 * совпадают с процентами от самой картинки: при других пропорциях окна метка уезжает с
 * предмета. Координаты в разметке заданы в процентах от исходной картинки, а здесь
 * пересчитываются через ту же геометрию, что применяет браузер:
 *      scale = max(рамка/картинка по ширине, по высоте)
 *      сдвиг = (рамка − картинка × scale) / 2      (object-position 50% 50%)
 * Пересчёт повторяется на resize и после загрузки картинки — до неё natural-размеры
 * ещё не известны.
 *
 * Метка — <button>, а не <div>: так подсказка открывается и с клавиатуры, и по касанию
 * на телефоне, где наведения нет вовсе.
 */
(function () {
  var hosts = document.querySelectorAll('[data-spots]');
  if (!hosts.length) return;

  var all = [];

  Array.prototype.forEach.call(hosts, function (media) {
    var spots;
    try { spots = JSON.parse(media.getAttribute('data-spots')); }
    catch (e) { return; }
    if (!spots || !spots.length) return;

    var box = media.parentElement;
    box.classList.add('has-spots');

    var layer = document.createElement('div');
    layer.className = 'spot-layer';

    var items = spots.map(function (s) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'spot';
      b.setAttribute('aria-label', s.t);
      var dot = document.createElement('i');
      var tip = document.createElement('span');
      tip.className = 'spot-tip';
      tip.textContent = s.t;
      b.appendChild(dot);
      b.appendChild(tip);
      // на телефоне подсказка держится по касанию, на компьютере — по наведению
      b.addEventListener('click', function (e) {
        e.preventDefault();
        var was = b.classList.contains('is-on');
        Array.prototype.forEach.call(layer.children, function (c) { c.classList.remove('is-on'); });
        if (!was) b.classList.add('is-on');
      });
      layer.appendChild(b);
      return { el: b, s: s };
    });

    box.appendChild(layer);
    all.push({ media: media, items: items });
  });

  function place() {
    all.forEach(function (g) {
      var m = g.media;
      var natW = m.naturalWidth || m.videoWidth || 0;
      var natH = m.naturalHeight || m.videoHeight || 0;
      if (!natW || !natH) return;
      var w = m.clientWidth, h = m.clientHeight;
      if (!w || !h) return;
      var scale = Math.max(w / natW, h / natH);      // ровно то, что делает object-fit: cover
      var dw = natW * scale, dh = natH * scale;
      var ox = (w - dw) / 2, oy = (h - dh) / 2;
      g.items.forEach(function (it) {
        var d = 2 * (it.s.r / 100) * dw;             // радиус задан в процентах ШИРИНЫ картинки
        it.el.style.width = d.toFixed(1) + 'px';
        it.el.style.height = d.toFixed(1) + 'px';
        it.el.style.left = (ox + (it.s.x / 100) * dw).toFixed(1) + 'px';
        it.el.style.top = (oy + (it.s.y / 100) * dh).toFixed(1) + 'px';
      });
    });
  }

  place();
  addEventListener('resize', place, { passive: true });
  addEventListener('load', place);
  Array.prototype.forEach.call(hosts, function (m) {
    if (m.tagName === 'IMG' && !m.complete) m.addEventListener('load', place, { once: true });
    if (m.tagName === 'VIDEO') m.addEventListener('loadedmetadata', place, { once: true });
  });
})();
