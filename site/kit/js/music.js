/* ФОНОВАЯ МУЗЫКА С ЯВНЫМ ВЫКЛЮЧАТЕЛЕМ.
 *
 * Зачем: компред показывают с ноутбука, и музыка задаёт настроение мира игры. Но звук —
 * единственное на странице, что человек НЕ ждёт: он может смотреть презентацию в открытом
 * офисе, на созвоне, ночью. Поэтому здесь два жёстких правила.
 *
 *  • ПО УМОЛЧАНИЮ ВЫКЛЮЧЕНО. Не «попробуем запустить, а браузер решит»: даже там, где
 *    автозапуск разрешён (после первого щелчка по странице), музыка не включается сама.
 *    Включает только человек.
 *
 *  • СОСТОЯНИЕ ВИДНО ИЗДАЛЕКА. Пока играет, кнопка залита тёплым и в ней прыгает
 *    эквалайзер: понятно, что звук идёт отсюда, и понятно, куда нажать, чтобы выключить.
 *    Тихая иконка в углу не годится — человек ищет, откуда звук, и закрывает вкладку.
 *
 * Что ещё проверено:
 *  • ГРОМКОСТЬ ВВОДИТСЯ ПЛАВНО. Резкий старт на полной громкости пугает, особенно в
 *    наушниках; так же плавно уходит при выключении, и только потом ставим на паузу.
 *  • preload="none" в разметке обязателен: три с лишним мегабайта не должны грузиться у
 *    того, кто музыку не включал. Файл начинает качаться в момент первого нажатия.
 *  • В скрытой вкладке останавливаем и возвращаем, только если человек не выключил сам:
 *    иначе музыка оживает после переключения вкладок, хотя её выключили.
 *  • Выбор человека помним в пределах вкладки (sessionStorage): при переходе по разделам
 *    страница не перезагружается, но перезагрузку руками мы уважаем — новый визит опять
 *    начинается в тишине.
 */
(function () {
  'use strict';

  function setup(audio, btn) {
    var FULL = Number(btn.getAttribute('data-volume')) || 0.3;
    var FADE = 420;                 // мс на ввод и вывод громкости
    var wanted = false;             // чего хочет человек, а не что делает браузер
    var pausedByTab = false;
    var fade = null;

    function paint() {
      btn.classList.toggle('is-on', wanted && !audio.paused);
      btn.setAttribute('aria-pressed', String(wanted));
      btn.setAttribute('aria-label', wanted ? 'Выключить музыку' : 'Включить музыку');
      var label = btn.querySelector('[data-music-label]');
      if (label) label.textContent = wanted ? 'Музыка · вкл' : 'Музыка';
    }

    /* Плавность делаем сами: у <audio> нет перехода по громкости */
    function ramp(to, done) {
      clearInterval(fade);
      var from = audio.volume, t0 = Date.now();
      fade = setInterval(function () {
        var k = Math.min(1, (Date.now() - t0) / FADE);
        audio.volume = from + (to - from) * k;
        if (k === 1) { clearInterval(fade); if (done) done(); }
      }, 30);
    }

    function on() {
      wanted = true;
      try { sessionStorage.setItem('pdMusic', '1'); } catch (e) {}
      audio.volume = 0;
      var p = audio.play();
      if (p && p.catch) {
        p.then(function () { ramp(FULL); paint(); })
         .catch(function () { wanted = false; paint(); });   // браузер отказал — не врём кнопкой
      } else {
        ramp(FULL); paint();
      }
      paint();
    }

    function off(remember) {
      wanted = false;
      if (remember !== false) { try { sessionStorage.setItem('pdMusic', '0'); } catch (e) {} }
      ramp(0, function () { audio.pause(); paint(); });
      paint();
    }

    btn.addEventListener('click', function () { wanted ? off() : on(); });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        pausedByTab = wanted && !audio.paused;
        if (pausedByTab) { audio.pause(); }
        return;
      }
      if (wanted && pausedByTab) { pausedByTab = false; on(); }
    });

    audio.addEventListener('pause', paint);
    audio.addEventListener('play', paint);

    /* Возврат к разделу в пределах той же вкладки: если музыку включали, продолжаем.
       Щелчок по кнопке в прошлый раз и есть то самое действие человека, которого требует
       браузер для автозапуска, но в НОВОЙ загрузке страницы оно уже не считается —
       поэтому просто ждём первого касания документа. */
    var remembered = false;
    try { remembered = sessionStorage.getItem('pdMusic') === '1'; } catch (e) {}
    if (remembered) {
      var once = function () {
        removeEventListener('pointerdown', once);
        removeEventListener('keydown', once);
        on();
      };
      addEventListener('pointerdown', once, { passive: true });
      addEventListener('keydown', once);
    }

    paint();
  }

  function init(scope) {
    var list = (scope || document).querySelectorAll('[data-music]');
    for (var i = 0; i < list.length; i++) {
      var btn = list[i];
      var audio = document.getElementById(btn.getAttribute('data-music'));
      if (audio) setup(audio, btn);
    }
  }

  window.kitMusic = init;
  if (document.readyState !== 'loading') init(document);
  else addEventListener('DOMContentLoaded', function () { init(document); });
})();
