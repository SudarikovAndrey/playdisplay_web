/* СБОРКА ЖИВОГО КАТАЛОГА.
 *
 * Каталог собирается из двух источников, и это главное решение:
 *   • ПРОЗА (название, зачем, опции, подводные камни) берётся из blocks.json;
 *   • РАЗМЕТКА берётся из самой демонстрации — скрипт печатает innerHTML того узла,
 *     который вы видите рядом.
 * Поэтому показанный код не может разойтись с показанным видом, а описание блока
 * правится в одном месте. Всё, что нужно сделать, добавив блок: положить демо в
 * <template id="kbDemos"> с атрибутом data-block="id" и дописать запись в blocks.json.
 *
 * Заодно каталог сам себя проверяет: считает, для каких блоков описи нет демонстрации,
 * и для каких демонстраций нет записи в описи. Строка состояния наверху показывает
 * это честно — расхождение видно сразу, а не через месяц.
 */
(function () {
  var groupsHost = document.getElementById('kbGroups');
  var navHost = document.getElementById('kbNav');
  var statusEl = document.getElementById('kbStatus');
  var demos = document.getElementById('kbDemos');
  if (!groupsHost || !demos) return;

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Разметка из демо: снимаем общий отступ, иначе в блоке кода видна лестница пробелов
  function tidy(html) {
    var lines = html.replace(/\t/g, '  ').split('\n');
    while (lines.length && !lines[0].trim()) lines.shift();
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    var pad = 1e9;
    lines.forEach(function (l) {
      if (!l.trim()) return;
      pad = Math.min(pad, l.length - l.replace(/^ +/, '').length);
    });
    return lines.map(function (l) { return l.slice(pad); }).join('\n');
  }

  function list(title, items, cls) {
    if (!items || !items.length) return '';
    return '<div class="' + (cls || '') + '"><h4>' + title + '</h4><ul class="' + (cls || '') + '">' +
      items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul></div>';
  }

  fetch('blocks.json', { cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (doc) {
      document.getElementById('kbAbout').textContent = doc.about;
      document.getElementById('kbHow').innerHTML =
        doc.howToUse.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');

      var byId = {};
      Array.prototype.forEach.call(demos.content.querySelectorAll('[data-block]'), function (d) {
        byId[d.getAttribute('data-block')] = d;
      });

      var groups = {}, order = [];
      doc.blocks.forEach(function (bl) {
        // группа берётся из порядка описи: блоки идут смысловыми пачками
        var g = bl.group || guessGroup(bl.id);
        if (!groups[g]) { groups[g] = []; order.push(g); }
        groups[g].push(bl);
      });

      var navHtml = '', bodyHtml = '', missingDemo = [];
      order.forEach(function (g) {
        var title = (doc.groups && doc.groups[g]) || g;
        navHtml += '<a href="#g-' + g + '"><span>' + (order.indexOf(g) + 1) +
                   '</span><small>' + esc(title) + '</small></a>';
        bodyHtml += '<section class="kb-group" id="g-' + g + '"><h2>' + esc(title) + '</h2>';
        groups[g].forEach(function (bl) {
          var demo = byId[bl.id];
          if (!demo) missingDemo.push(bl.id);
          var liveNote = demo && demo.getAttribute('data-live');
          var inner = demo && demo.innerHTML.trim() ? tidy(demo.innerHTML) : '';
          bodyHtml +=
            '<article class="kb-card" id="b-' + bl.id + '">' +
              '<header class="kb-card__head"><span class="kb-id">' + bl.id + '</span>' +
              '<h3>' + esc(bl.title) + '</h3><p class="kb-what">' + esc(bl.what) + '</p></header>' +
              (inner ? '<div class="kb-stage" data-stage="' + bl.id + '">' + inner + '</div>' : '') +
              (liveNote ? '<p class="kb-note">' + esc(liveNote) + '</p>' : '') +
              '<details class="kb-code"><summary>Разметка</summary><pre>' +
                esc(inner || bl.markup) + '</pre></details>' +
              '<div class="kb-meta">' +
                '<div class="kb-files"><h4>Файлы</h4><code>' +
                  (bl.css.map(function (f) { return 'css/' + f; })
                    .concat(bl.js.map(function (f) { return 'js/' + f; })).join('  ·  ') || '—') +
                '</code></div>' +
                list('Опции', bl.options) +
                list('Подводные камни', bl.traps, 'kb-traps') +
              '</div>' +
            '</article>';
        });
        bodyHtml += '</section>';
      });

      navHost.innerHTML = navHtml + '<p class="nav-legal">Конструктор · опись ' + doc.version + '</p>';
      groupsHost.innerHTML = bodyHtml;

      var extra = Object.keys(byId).filter(function (id) {
        return !doc.blocks.some(function (b) { return b.id === id; });
      });
      statusEl.textContent = 'блоков в описи: ' + doc.blocks.length +
        ' · показано живьём: ' + (doc.blocks.length - missingDemo.length) +
        (missingDemo.length ? ' · без демо: ' + missingDemo.join(', ') : '') +
        (extra.length ? ' · демо без записи в описи: ' + extra.join(', ') : '');

      /* Карточки появились ПОСЛЕ того, как модули отработали свой единственный проход
         (опись читается запросом, это всегда позже). Поэтому просим их разобрать новое.
         Ровно та же нужда возникает на настоящих страницах, где разделы дорисовываются
         позже, — поэтому у модулей и появился открытый наружу вызов. */
      if (window.kitReveal) window.kitReveal(document);
      if (window.kitLists) window.kitLists(document);
      if (window.kitHotspots) window.kitHotspots(document);
      if (window.kitArmScrub) window.kitArmScrub(document);
      dispatchEvent(new Event('resize'));
    })
    .catch(function (e) {
      statusEl.textContent = 'не удалось прочитать blocks.json — откройте каталог через сервер (python3 serve.py), а не файлом с диска';
      console.error(e);
    });

  function guessGroup(id) {
    if (/^(boot|masthead|side-nav|progress|to-top|smooth-scroll|app-lock|sound)$/.test(id)) return 'frame';
    if (/^cursor/.test(id)) return 'cursor';
    if (/^(hero|xray|flygl)/.test(id)) return 'hero';
    if (/^(chapter|opening|clean-list|pull|courts)/.test(id)) return 'text';
    if (/^(art|hotspots|scrub)/.test(id)) return 'media';
    return 'charts';
  }
})();
