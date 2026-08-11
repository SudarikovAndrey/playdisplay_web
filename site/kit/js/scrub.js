/* КРУТИЛКА КАДРОВ РОЛИКА.
 *
 * Взято с лендинга playdisplay.com (функция armScrub в index.html) без изменения логики:
 * там она вылизана на живых людях, и все ловушки уже отражены в комментариях ниже.
 * Отличие одно: модуль самостоятельный и ищет крутилки по всему документу, а не внутри
 * вьюера кейса.
 *
 * Коротко о главном, чтобы не переоткрывать:
 *   • ролик загружается ЦЕЛИКОМ через fetch + Blob. Перемотка по HTTP Range работает
 *     не на каждом сервере, и на локальном просмотре бегунок ехал, а картинка стояла;
 *   • одновременно держится ОДИН запрос перемотки, следующий копится: пока идёт seek,
 *     новые запросы в части браузеров теряются;
 *   • постер снимается на первом событии seeked — иначе он закрывает ролик, который
 *     ни разу не играл, и кажется, что крутилка не работает;
 *   • ход ручки короче плашки на её ширину и два отступа (INSET), иначе она упирается
 *     в кант и выглядит зажатой;
 *   • стартуем не с нулевого кадра (P0): на нём сцена пуста и непонятно, что смотреть.
 *
 * Подключение: <script defer src="kit/js/scrub.js"></script> — модуль сам находит
 * .v-scrub на странице. Для отложенной инициализации есть window.kitArmScrub(root).
 */
(function () {
  function arm(root){
    (root || document).querySelectorAll('.v-scrub').forEach(function(box){
      var v = box.querySelector('video'), bar = box.querySelector('.sc-bar');
      var knob = box.querySelector('.sc-knob');
      if (!v || !bar || !knob) return;
      // Ручка ходит ВНУТРИ плашки с отступом: путь короче плашки на свою ширину и на два
      // отступа, иначе на краях она упирается в кант и выглядит зажатой.
      var vert = box.classList.contains('vy');       // рельс вертикальный: ход сверху вниз
      var INSET = matchMedia('(max-width: 700px)').matches ? 5 : 6;   // столько же в CSS
      function span(){
        return Math.max(1, (vert ? bar.clientHeight - knob.offsetHeight
                                 : bar.clientWidth - knob.offsetWidth) - INSET * 2);
      }
      function pFromPt(e){
        var r = bar.getBoundingClientRect();
        return vert ? (e.clientY - r.top - INSET - knob.offsetHeight / 2) / span()
                    : (e.clientX - r.left - INSET - knob.offsetWidth / 2) / span();
      }
      var P0 = 0.18;            // не с нуля: на нулевом кадре сцена пуста и непонятно, что смотреть
      var p = P0, raf = null, drag = 0, sx = 0, sp = 0, pend = -1;
      // Перемотку нельзя дёргать каждый кадр: пока идёт предыдущий seek, новый запрос
      // в части браузеров просто теряется — ручка едет, а картинка стоит. Поэтому
      // держим ОДИН запрос в полёте, следующий копим и отдаём по событию seeked.
      function seek(t){
        if (v.seeking) { pend = t; return; }
        pend = -1;
        try { v.currentTime = t; } catch (e) {}
      }
      v.addEventListener('seeked', function(){
        // Постер снимаем сразу, как появился настоящий кадр. Это и была причина, по которой
        // «бегунок едет, а картинка стоит»: пока видео ни разу не играло, браузер держит
        // постер поверх кадра, и перемотка под ним не видна вовсе.
        if (v.hasAttribute('poster')) v.removeAttribute('poster');
        if (pend >= 0) { var t = pend; pend = -1; if (Math.abs(v.currentTime - t) > 0.02) seek(t); }
      });
      function draw(){
        raf = null;
        knob.style[vert ? 'top' : 'left'] = (INSET + p * span()) + 'px';
        var d = v.duration;
        if (!d || d !== d || v.readyState < 1) return;   // метаданных ещё нет — вернёмся по событию
        var t = p * d;
        if (t > d - 0.04) t = d - 0.04;
        if (t < 0) t = 0;
        if (Math.abs(v.currentTime - t) > 0.02) seek(t);
      }
      function set(np){ p = np < 0 ? 0 : (np > 1 ? 1 : np); if (!raf) raf = requestAnimationFrame(draw); }
      ['loadedmetadata', 'loadeddata', 'canplay'].forEach(function(ev){
        v.addEventListener(ev, function(){ set(p); });   // как только данные пришли — встаём на своё место
      });
      // ПОЧЕМУ РОЛИК ГРУЗИТСЯ ЦЕЛИКОМ В ПАМЯТЬ. Крутилку не смотрят, а листают, а перемотка
      // тега <video> опирается на частичные запросы (HTTP Range). Стоит серверу, прокси или
      // кэшу их не поддержать — ручка едет, а кадр стоит; именно так эти ползунки «переставали
      // работать» несколько раз. Одна загрузка файла в Blob снимает вопрос совсем: дальше
      // видео живёт в памяти, перемотка мгновенная и от сервера уже не зависит.
      // Клипы для этого специально короткие (10-13 МБ) и грузятся, только когда до них дошли.
      var loading = false, loaded = false;
      function ensure(){
        if (loading || loaded) return;
        loading = true;
        box.classList.add('loading');
        var url = v.getAttribute('src');
        fetch(url).then(function(r){ if (!r.ok) throw 0; return r.blob(); })
          .then(function(b){
            loaded = true; box.classList.remove('loading');
            v.src = URL.createObjectURL(b);
            v.load();
            set(p);
            // короткий пуск-стоп: браузер декодирует настоящий кадр (постер уходит)
            // и держит декодер тёплым — первая перемотка после этого мгновенная
            var pr = v.play();
            if (pr && pr.then) pr.then(function(){ v.pause(); set(p); }).catch(function(){ set(p); });
          })
          .catch(function(){
            // сеть не дала файл целиком — работаем как обычное видео, с перемоткой по Range
            loading = false; box.classList.remove('loading');
            if (v.dataset.pl) { v.preload = v.dataset.pl; v.removeAttribute('data-pl'); }
            try { v.load(); } catch (e) {}
          });
      }
      box._warm = ensure;        // вызывается, когда блок доскроллили (см. armFlow)
      set(P0);   // ручку ставим на место сразу: это только вёрстка, без загрузки
      box.addEventListener('pointerdown', function(e){
        box.classList.add('touched'); box.classList.add('dragging');
        // взяли саму ручку — тянем её от текущего места; ткнули в плашку — ручка
        // прыгает под палец; взяли кадр — тащим как плёнку, жест относительный
        var onKnob = !!(e.target.closest && e.target.closest('.sc-knob'));
        var onBar = !onKnob && !!(e.target.closest && e.target.closest('.sc-bar'));
        // у вертикального рельса кадр пальцем не тянем: этот жест — прокрутка страницы,
        // и отбирать её у человека нельзя. Мышью тянуть кадр по-прежнему можно
        if (vert && !onKnob && !onBar && e.pointerType === 'touch') { drag = 0; return; }
        drag = onKnob ? 3 : (onBar ? 2 : 1);
        ensure();   // взялись раньше, чем блок прогрелся — грузим здесь же
        sx = vert ? e.clientY : e.clientX; sp = p;
        try { box.setPointerCapture(e.pointerId); } catch (err) {}
        if (onBar) set(pFromPt(e));
        e.preventDefault();
      });
      box.addEventListener('pointermove', function(e){
        if (!drag) return;
        var d = (vert ? e.clientY : e.clientX) - sx;
        if (drag === 2) set(pFromPt(e));                     // палец ведёт ручку по плашке
        else if (drag === 3) set(sp + d / span());            // ручка идёт ровно за пальцем
        else set(sp + d / ((vert ? box.clientHeight : box.clientWidth) || 1)); // кадр как плёнка
        e.preventDefault();
      });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function(t){
        box.addEventListener(t, function(){ drag = 0; box.classList.remove('dragging'); });
      });
    });
  }
  arm(document);
  window.kitArmScrub = arm;      // для блоков, которые появляются позже (вьюеры, табы)
})();
