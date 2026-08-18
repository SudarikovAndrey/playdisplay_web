/* УПРАВЛЕНИЕ РОЛИКОМ В КАДРЕ: пуск-пауза и перемотка.
 *
 * Зачем своё, а не штатный controls: браузерная панель занимает всю ширину кадра, светит
 * серым и ломает вид презентации. Здесь два элемента – круглая кнопка и тонкая полоса, –
 * оформленные как стрелки галереи.
 *
 * Что важно и проверено:
 *
 *  • РОЛИК ИГРАЕТ ТОЛЬКО В ВИДИМОМ КАДРЕ. Галерея держит все кадры в разметке; без этого
 *    в фоне крутились бы все ролики сразу, грея процессор и сажая ноутбук на показе.
 *    Наблюдатель ставит на паузу ушедший кадр и возвращает игру пришедшему – но ТОЛЬКО
 *    если человек не остановил ролик сам: своё решение важнее автоматики.
 *
 *  • ПЕРЕМОТКА СЧИТАЕТСЯ ОТ ШИРИНЫ ПОЛОСЫ, а не от ширины ролика: полоса короче кадра.
 *    Тянется указателем с захватом, поэтому палец и мышь не теряются за краем полосы.
 *
 *  • Полоса – <input type="range">: он сам даёт клавиатуру, шаги стрелками и роль
 *    ползунка для скринридера. Своя разметка из <div> всё это пришлось бы изобретать.
 */
(function () {
  'use strict';

  function fmt(t) {
    if (!isFinite(t)) return '0:00';
    var m = Math.floor(t / 60), s = Math.floor(t % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function setup(box) {
    var video = box.querySelector('video');
    var play = box.querySelector('[data-vctl-play]');
    var bar = box.querySelector('[data-vctl-bar]');
    var time = box.querySelector('[data-vctl-time]');
    if (!video || !play) return;

    var pausedByHand = false;

    function paint() {
      var on = !video.paused && !video.ended;
      play.setAttribute('aria-pressed', on ? 'true' : 'false');
      play.setAttribute('aria-label', on ? 'Пауза' : 'Пуск');
      box.classList.toggle('is-playing', on);
    }

    play.addEventListener('click', function () {
      if (video.paused) { pausedByHand = false; video.play(); }
      else { pausedByHand = true; video.pause(); }
      paint();
    });

    video.addEventListener('play', paint);
    video.addEventListener('pause', paint);

    if (bar) {
      var dragging = false;
      video.addEventListener('timeupdate', function () {
        if (dragging || !video.duration) return;
        bar.value = String((video.currentTime / video.duration) * 1000);
        if (time) time.textContent = fmt(video.currentTime) + ' / ' + fmt(video.duration);
      });
      video.addEventListener('loadedmetadata', function () {
        if (time) time.textContent = fmt(0) + ' / ' + fmt(video.duration);
      });
      var seek = function () {
        if (!video.duration) return;
        video.currentTime = (Number(bar.value) / 1000) * video.duration;
        if (time) time.textContent = fmt(video.currentTime) + ' / ' + fmt(video.duration);
      };
      bar.addEventListener('input', function () { dragging = true; seek(); });
      bar.addEventListener('change', function () { dragging = false; seek(); });
      bar.addEventListener('pointerup', function () { dragging = false; });
    }

    /* ПУСК ПРИ ПОЯВЛЕНИИ КАДРА. Наблюдаем САМ КАДР, а не панель управления: панель
       маленькая и живёт в углу, её доля видимости ничего не говорит о том, дошёл ли
       человек до этого кадра.
       Порог невысокий (0.35): у галереи кадры сменяются прокруткой ленты, и на середине
       хода видны сразу два — ждать полной видимости значит запускать с опозданием. */
    var frame = box.closest('.gallery__item, .slide, figure') || box;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        var vis = es[0].isIntersecting && es[0].intersectionRatio > 0.35;
        if (vis) {
          if (pausedByHand) return;
          var p = video.play();
          /* Отказ не глотаем: браузер может запретить автопуск, и тогда кнопка обязана
             остаться в положении «пуск», а не врать, что ролик идёт. */
          if (p && p.catch) p.catch(paint);
        } else if (!video.paused) {
          video.pause();
        }
      }, { threshold: [0, 0.35, 0.7, 1] }).observe(frame);
    }

    paint();
  }

  function init(scope) {
    var list = (scope || document).querySelectorAll('[data-vctl]');
    for (var i = 0; i < list.length; i++) setup(list[i]);
  }

  window.kitVideoCtl = init;
  if (document.readyState !== 'loading') init(document);
  else addEventListener('DOMContentLoaded', function () { init(document); });
})();
