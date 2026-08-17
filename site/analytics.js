/* ===== Аналитика playdisplay: GA4 + Яндекс.Метрика + события воронки =====
   Подключается на всех страницах: <script src="analytics.js" defer>
   (главная и /en/ — напрямую, /work/<slug>/ — из шаблона build_seo.py).

   Почему один файл, а не сниппеты в каждом html: счётчиков два, событий много,
   и править их в трёх шаблонах — это три места, которые надо ПОМНИТЬ. Здесь
   правится одна строка, и деплой развозит её по всем страницам.

   Счётчики считают ТОЛЬКО боевые домены. На превью GitHub Pages, на localhost
   и при открытии с диска статистика не шлётся вовсе — иначе свои же проверки
   выглядели бы в отчётах как посетители. Проверка по хосту, а не по флагу:
   флаг надо не забыть поставить, хост не врёт. */
(function () {
  'use strict';
  if (window.top !== window) return; // hero-scene и прочие iframe не считаем: визит один

  var GA_ID = 'G-8L3XFCPG2V';
  var YM_ID = 111509723;

  /* Do Not Track уважаем, хотя ни GA, ни Метрика сами этого не делают.
     Причина не в законе, а в том, что на site/privacy.html человеку обещано:
     «включите DNT — и счётчиков не будет». Обещание, которое проверяется одним
     переключателем в браузере, должно быть правдой. Проверяем три написания:
     стандартное navigator.doNotTrack, старое window.doNotTrack и вариант IE.
     Значение '1' и 'yes' — это «не следить». */
  var dnt = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack;
  var NOTRACK = (dnt === '1' || dnt === 'yes' || navigator.globalPrivacyControl === true);

  // Выходим ДО всего остального, а не гасим отправку внутри track(): при отказе не
  // должно остаться ни счётчиков, ни слушателей кликов, ни таймеров секций. Заодно
  // на боевом сайте такой посетитель не получит поток console.log вместо тишины.
  // Ничего снаружи на window.gtag и window.ym не опирается — проверено поиском.
  if (NOTRACK) return;

  var LIVE = /(^|\.)playdisplay\.(com|ru)$/.test(location.hostname);

  /* ---- загрузка GA4 (gtag.js) ---- */
  window.dataLayer = window.dataLayer || [];
  function gtag(){ window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;
  if (LIVE) {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    var f = document.getElementsByTagName('script')[0];
    f.parentNode.insertBefore(s, f);
    gtag('js', new Date());
    gtag('config', GA_ID);
  }

  /* ---- загрузка Метрики (tag.js) ----
     Очередь ym() заводим ВСЕГДА: на неё опирается track() ниже, и без неё каждый
     вызов пришлось бы оборачивать проверкой. А сам скрипт качаем ТОЛЬКО на боевом.
     До 15.08.2026 загрузчик стоял снаружи проверки — закрыт был один init. В итоге
     93 КБ tag.js приезжали и на localhost, и на превью GitHub Pages: замерено в
     браузере. Скрипт Метрики ставит свои куки, то есть это была не только лишняя
     загрузка, но и третья сторона там, где её быть не должно. */
  window.ym = window.ym || function () { (window.ym.a = window.ym.a || []).push(arguments); };
  window.ym.l = 1 * new Date();
  if (LIVE) {
    (function (e, t, r) {
      for (var j = 0; j < e.scripts.length; j++) { if (e.scripts[j].src === r) return; }
      var k = e.createElement(t), a = e.getElementsByTagName(t)[0];
      k.async = 1; k.src = r; a.parentNode.insertBefore(k, a);
    })(document, 'script', 'https://mc.yandex.ru/metrika/tag.js');
    window.ym(YM_ID, 'init', {
      ssr: true, clickmap: true, trackLinks: true, accurateTrackBounce: true,
      webvisor: true // вебвизор и карта скроллинга — ради них Метрика и стоит
    });
  }

  /* ---- одно событие в обе системы ----
     Имена совпадают с целями в Метрике (reachGoal) и событиями GA4.
     Вне боевого домена пишем в console, чтобы проверка была видна глазами. */
  function track(name, params) {
    if (!LIVE) { try { console.log('[analytics]', name, params || {}); } catch (e) {} return; }
    try { gtag('event', name, params || {}); } catch (e) {}
    try { window.ym(YM_ID, 'reachGoal', name, params || {}); } catch (e) {}
  }

  /* Та же отправка, открытая наружу. Нужна не для красоты: события воронки лендинга
     этот файл ловит сам, а вот новым страницам (презентации на ките, будущие разделы)
     нужна одна понятная строка `pdGoal('название')` — иначе в каждой странице появится
     свой вызов ym/gtag с номером счётчика, и номер расползётся по коду. */
  window.pdGoal = track;

  /* ---- воронка: клики, ведущие к креативной сессии ----
     Слушаем документ целиком, а не вешаем обработчики на кнопки: панель
     ассистента дорисовывает свои кнопки после загрузки, и точечные обработчики
     до них бы не дожили. */
  document.addEventListener('click', function (ev) {
    var el = ev.target;
    while (el && el !== document.documentElement) {
      if (el.hasAttribute && (el.hasAttribute('data-ai-open') || el.id === 'aiWidget')) {
        track('ai_open', { source: el.id || 'data-ai-open' });
        return;
      }
      if (el.id === 'bookCall') { track('book_click', {}); return; }
      var href = (el.tagName === 'A' && el.getAttribute('href')) || '';
      if (href.indexOf('mailto:') === 0) { track('contact_click', { channel: 'email' }); return; }
      if (href.indexOf('tel:') === 0) { track('contact_click', { channel: 'phone' }); return; }
      if (href.indexOf('t.me/') >= 0) { track('contact_click', { channel: 'telegram' }); return; }
      if (href.indexOf('wa.me/') >= 0 || href.indexOf('whatsapp') >= 0) { track('contact_click', { channel: 'whatsapp' }); return; }
      el = el.parentNode;
    }
  }, true);

  /* ---- воронка: разговор с ассистентом ----
     Клиент ассистента шлёт XHR на api/ai.php с JSON {action: ...}. Мы НЕ трогаем
     его код (чужая территория — см. ПРАВИЛА-РАБОТЫ.md), а подслушиваем транспорт:
     подмена XMLHttpRequest.send видит и действие, и ответ. Сломаться тихо не может:
     всё в try/catch, при любой ошибке запрос уходит как шёл. */
  var openOrig = XMLHttpRequest.prototype.open;
  var sendOrig = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, url) {
    try { this.__pdUrl = String(url || ''); } catch (e) {}
    return openOrig.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (body) {
    try {
      if (this.__pdUrl && this.__pdUrl.indexOf('ai.php') >= 0 && typeof body === 'string') {
        var action = (JSON.parse(body) || {}).action;
        if (action === 'start') track('ai_start', {});
        /* Две конверсии, ведущие в одну точку: бриф от ассистента (send) и форма
           брони креативной сессии (book). Разные пути, одинаковая ценность —
           письмо в студию, — поэтому обе шлют generate_lead и различаются полем
           method. Считать их одним событием нельзя: по разбивке видно, чем люди
           на самом деле пользуются. Форма брони ходит на тот же api/ai.php тем же
           XHR, так что подслушивание работает и для неё без единой правки в её коде. */
        if (action === 'send' || action === 'book') {
          var x = this, method = (action === 'book') ? 'book_form' : 'ai_brief';
          x.addEventListener('load', function () {
            var d = null;
            try { d = JSON.parse(x.responseText); } catch (e) {}
            if (d && d.ok) {
              /* generate_lead — стандартное имя GA4; qualify_lead шлём рядом,
                 потому что ИМЕННО ОНО уже отмечено ключевым событием в ресурсе
                 (новый GA4 не даёт отметить событие ключевым, пока оно ни разу
                 не пришло, — а конверсии должны считаться с первого дня). */
              if (LIVE) try { gtag('event', 'qualify_lead', { method: method }); } catch (e) {}
              track('generate_lead', { method: method });
              track(action === 'book' ? 'book_send' : 'brief_send', {});
            }
          });
        }
      }
    } catch (e) {}
    return sendOrig.apply(this, arguments);
  };

  /* ---- какие кейсы смотрят: SPA-роутинг по хешу GA4 сам не видит ---- */
  window.addEventListener('hashchange', function () {
    var m = location.hash.match(/^#\/work\/([\w-]+)/);
    if (!m) return;
    track('case_view', { slug: m[1] });
    if (LIVE) try { window.ym(YM_ID, 'hit', location.href); } catch (e) {}
  });

  /* ---- сколько времени проводят в каждой секции ----
     IntersectionObserver копит секунды, пока секция занимает половину экрана.
     Отправка — одним махом при уходе со страницы через beacon: события,
     посланные в момент закрытия вкладки обычным путём, теряются. */
  var SECTIONS = ['start', 'approach', 'work', 'concepts', 'atlas', 'idea', 'studio', 'contact'];
  var vis = {}, since = {}, sent = false;
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      var now = Date.now();
      for (var i = 0; i < entries.length; i++) {
        var id = entries[i].target.id;
        if (entries[i].isIntersecting) { since[id] = now; }
        else if (since[id]) { vis[id] = (vis[id] || 0) + (now - since[id]); since[id] = 0; }
      }
    }, { threshold: 0.5 });
    for (var i = 0; i < SECTIONS.length; i++) {
      var sec = document.getElementById(SECTIONS[i]);
      if (sec) io.observe(sec);
    }
  }
  function flushSections() {
    if (sent) return; // pagehide и visibilitychange срабатывают оба — слать надо раз
    var now = Date.now(), id, secs, any = false, params = {};
    for (id in since) if (since[id]) { vis[id] = (vis[id] || 0) + (now - since[id]); since[id] = 0; }
    for (id in vis) {
      secs = Math.round(vis[id] / 1000);
      if (secs < 2) continue; // мимолётный проезд скроллом — не «время в секции»
      any = true; params[id] = secs;
      if (LIVE) try { gtag('event', 'section_time', { section: id, seconds: secs, transport_type: 'beacon' }); } catch (e) {}
    }
    if (any) {
      sent = true;
      if (LIVE) try { window.ym(YM_ID, 'params', { section_time: params }); } catch (e) {}
      else try { console.log('[analytics] section_time', params); } catch (e) {}
    }
  }
  window.addEventListener('pagehide', flushSections);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flushSections();
  });
})();
