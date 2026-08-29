/* ЧАТ-ТЕЛЕФОН: диалог с продуктом проигрывается вживую.
 *
 * Зачем скрипт, а не готовая картинка переписки: статичный скриншот чата читается как
 * «у них есть макет», живой диалог — как «у них есть продукт». Реплики лежат В РАЗМЕТКЕ
 * (скрытый список .chat-phone__script), а не в скрипте: текст диалога — содержание
 * страницы, и править его должен тот, кто правит текст, не заглядывая в js.
 *
 * Как устроено воспроизведение:
 *   • реплика гостя появляется после короткой паузы; перед репликой ассистента сначала
 *     показываются «печатающие» точки — тем и отличается живой собеседник от слайдшоу;
 *   • пауза после реплики пропорциональна её длине: длинный ответ читают дольше;
 *   • лента прижата к низу и обрезается экраном телефона, поэтому новое сообщение
 *     не двигает раскладку страницы ни на пиксель;
 *   • дочитанный диалог замирает, потом лента гаснет и начинается заново.
 */
(function () {
  'use strict';

  var REDUCED = window.matchMedia &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function init(phone) {
    var feed = phone.querySelector('[data-chat-feed]');
    var src = phone.querySelectorAll('.chat-phone__script li');
    if (!feed || !src.length) return;

    var script = [];
    for (var i = 0; i < src.length; i++) {
      script.push({
        from: src[i].getAttribute('data-from') === 'user' ? 'user' : 'ai',
        html: src[i].innerHTML,
        text: src[i].textContent,
        len: src[i].textContent.length
      });
    }
    /* data-chat-stream: ответы ассистента ПЕЧАТАЮТСЯ посимвольно, как в живом
       приложении. Реплики гостя приходят целиком – человек не печатает у нас
       на глазах, а «отправляет» готовое сообщение. */
    var stream = phone.hasAttribute('data-chat-stream');

    function bubble(msg, still) {
      var p = document.createElement('p');
      p.className = 'chat-msg chat-msg--' + msg.from + (still ? ' chat-msg--still' : '');
      p.innerHTML = msg.html;
      return p;
    }

    /* Без анимаций (просьба системы) и без наблюдателя видимости (старый браузер)
       диалог показывается готовым: последние реплики, сколько влезает в экран.
       Лента обрезает лишнее сверху сама. */
    if (REDUCED || !('IntersectionObserver' in window)) {
      for (var k = 0; k < script.length; k++) feed.appendChild(bubble(script[k], true));
      return;
    }

    var step = 0;            // номер следующей реплики
    var timer = 0;           // активный таймер
    var pending = null;      // отложенный шаг на время паузы
    var typing = null;       // пузырь «печатает»
    var visible = false;

    /* Один планировщик на все шаги: пауза (ушли со слайда, свернули вкладку)
       снимает таймер и запоминает шаг, возврат — ставит его заново. Без этого
       диалог дочитывался в фоне и человек заставал последний кадр. */
    function schedule(fn, ms) {
      pending = fn;
      timer = window.setTimeout(function () {
        // Пауза могла случиться между тиками: шаг не выбрасываем, а оставляем
        // в pending — иначе resume() не нашёл бы, что продолжать, и диалог замирал.
        if (!visible || document.hidden) return;
        pending = null;
        fn();
      }, ms);
    }
    function pause() { window.clearTimeout(timer); }
    function resume() {
      if (pending) schedule(pending, 500);
      else if (!feed.querySelector('.chat-msg')) schedule(next, 700);
    }

    /* Старые пузыри снимаем из DOM: лента и так обрезает их экраном, но за десять
       кругов диалога их накопились бы сотни. Чип «QR отсканирован» не трогаем. */
    function prune() {
      var msgs = feed.querySelectorAll('.chat-msg');
      for (var d = 0; d + 7 < msgs.length; d++) feed.removeChild(msgs[d]);
    }

    function next() {
      if (step >= script.length) {          // дочитали: пауза и заново
        schedule(restart, 4600);
        return;
      }
      var msg = script[step];
      if (msg.from === 'ai') {
        typing = document.createElement('p');
        typing.className = 'chat-msg chat-msg--ai chat-typing';
        typing.innerHTML = '<i></i><i></i><i></i>';
        feed.appendChild(typing);
        schedule(function () {
          feed.removeChild(typing); typing = null;
          if (stream) {
            /* Печать идёт через ТОТ ЖЕ планировщик schedule, что и остальные шаги:
               пауза (ушли со слайда, свернули вкладку) останавливает и её. Свой
               setInterval продолжал бы печатать в фоне и ломал бы возобновление. */
            var el = bubble(msg); el.textContent = '';
            el.className += ' chat-msg--live';
            feed.appendChild(el);
            prune();
            var shown = 0;
            (function typeStep() {
              shown += 2;
              el.textContent = msg.text.slice(0, shown);
              if (shown < msg.text.length) { schedule(typeStep, 26); return; }
              el.innerHTML = msg.html;           // вернуть неразрывные пробелы
              el.className = el.className.replace(' chat-msg--live', '');
              step++;
              schedule(next, Math.min(500 + msg.len * 12, 1800));
            })();
          } else {
            feed.appendChild(bubble(msg));
            prune();
            step++;
            schedule(next, Math.min(700 + msg.len * 22, 2600));
          }
        }, Math.min(650 + msg.len * 9, 1700));
      } else {
        feed.appendChild(bubble(msg));
        prune();
        step++;
        schedule(next, Math.min(600 + msg.len * 16, 1800));
      }
    }

    function restart() {
      var msgs = feed.querySelectorAll('.chat-msg');
      for (var d = 0; d < msgs.length; d++) feed.removeChild(msgs[d]);
      step = 0;
      schedule(next, 900);
    }

    var io = new IntersectionObserver(function (entries) {
      var on = entries[0].isIntersecting;
      if (on === visible) return;
      visible = on;
      if (visible && !document.hidden) resume(); else pause();
    }, { threshold: 0.25 });
    io.observe(phone);

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) pause();
      else if (visible) resume();
    });
  }

  /* Проход открыт наружу: каталог кита вставляет демонстрации ПОСЛЕ загрузки скрипта,
     и один проход при старте их не увидит (та же история, что у kitLists).
     Повторный вызов безопасен: начатые телефоны помечены и пропускаются. */
  function scan(root) {
    var phones = (root || document).querySelectorAll('[data-chat-phone]');
    for (var i = 0; i < phones.length; i++) {
      if (phones[i].getAttribute('data-chat-live')) continue;
      phones[i].setAttribute('data-chat-live', '1');
      init(phones[i]);
    }
  }
  window.kitChatPhone = scan;
  scan(document);
})();
