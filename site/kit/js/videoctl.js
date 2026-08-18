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

    /* ЗАПУСК ДЕРЖИТ АТРИБУТ autoplay, А НЕ ЭТОТ СКРИПТ — так сделано на главной сайта,
       и это единственный надёжный способ. Пока пуск висел на наблюдателе видимости, ролик
       на защите так и не пошёл: браузер вправе отказать в программном play(), и тогда
       кадр остаётся с постером, а причины не видно. Атрибут же браузер исполняет сам,
       как только пришло достаточно данных.
       Наблюдатель оставлен для ОБРАТНОГО: он ставит на паузу ушедший из кадра ролик,
       чтобы декодер не грелся на других слайдах, и возвращает игру пришедшему.
       Порог низкий (0.05) и следим за САМИМ РОЛИКОМ, а не за кадром — так же, как у
       видео концепций на главной: при высоком пороге пуск запаздывал на полкадра. */
    var vio = null;
    if ('IntersectionObserver' in window) {
      vio = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          try {
            if (e.isIntersecting) {
              if (!pausedByHand) { var p = video.play(); if (p && p.catch) p.catch(paint); }
            } else if (!video.paused) {
              video.pause();
            }
          } catch (err) { /* браузер отказал — кнопка остаётся в положении «пуск» */ }
        });
      }, { threshold: [0, 0.05, 0.5] });
      vio.observe(video);
    }

    /* ЗАПАСНОЙ ПУСК ПО ПЕРВОМУ КАСАНИЮ СТРАНИЦЫ. Некоторые браузеры отказывают в
       автозапуске даже приглушённому ролику — настройка сайта, экономия батареи, режим
       чтения. Тогда первое же действие человека на странице считается разрешением, и
       ролик, который должен идти, запускается. Слушатель одноразовый и на всё окно:
       ждать касания именно по ролику нельзя, до него ещё нужно доскроллить. */
    if (video.paused && !pausedByHand) {
      var kick = function () {
        if (!pausedByHand && video.paused) {
          var r = video.getBoundingClientRect();
          if (r.bottom > 0 && r.top < innerHeight) {
            var q = video.play();
            if (q && q.catch) q.catch(function () {});
          }
        }
      };
      addEventListener('pointerdown', kick, { once: true, passive: true });
      addEventListener('keydown', kick, { once: true });
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
