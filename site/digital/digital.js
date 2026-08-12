(function () {
  'use strict';

  var explorer = document.querySelector('[data-layer-explorer]');
  if (explorer) {
    var nodes = Array.prototype.slice.call(explorer.querySelectorAll('[data-capability]'));
    var panels = Array.prototype.slice.call(explorer.querySelectorAll('[data-panel]'));

    function activateCapability(id, focusPanel) {
      nodes.forEach(function (node) {
        var active = node.getAttribute('data-capability') === id;
        node.classList.toggle('is-active', active);
        node.setAttribute('aria-expanded', active ? 'true' : 'false');
      });
      panels.forEach(function (panel) {
        var active = panel.getAttribute('data-panel') === id;
        panel.hidden = !active;
        panel.classList.toggle('is-active', active);
        if (active && focusPanel) panel.setAttribute('tabindex', '-1');
      });
    }

    nodes.forEach(function (node, index) {
      node.addEventListener('click', function () {
        activateCapability(node.getAttribute('data-capability'), false);
      });
      node.addEventListener('keydown', function (event) {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowDown' && event.key !== 'ArrowLeft' && event.key !== 'ArrowUp') return;
        event.preventDefault();
        var direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
        var next = nodes[(index + direction + nodes.length) % nodes.length];
        next.focus();
        activateCapability(next.getAttribute('data-capability'), false);
      });
    });
  }

  var dialog = document.getElementById('projectDialog');
  var form = document.getElementById('digitalLeadForm');
  var status = document.getElementById('digitalLeadStatus');
  var success = document.getElementById('digitalLeadSuccess');
  var openers = document.querySelectorAll('[data-open-brief]');
  var closers = document.querySelectorAll('[data-close-brief]');

  function openBrief() {
    if (!dialog) return;
    status.textContent = '';
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    document.documentElement.classList.add('brief-open');
  }

  function closeBrief() {
    if (!dialog) return;
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
    document.documentElement.classList.remove('brief-open');
  }

  openers.forEach(function (button) { button.addEventListener('click', openBrief); });
  closers.forEach(function (button) { button.addEventListener('click', closeBrief); });
  if (dialog) {
    dialog.addEventListener('click', function (event) { if (event.target === dialog) closeBrief(); });
    dialog.addEventListener('close', function () { document.documentElement.classList.remove('brief-open'); });
  }

  if (form) {
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (!form.reportValidity()) return;

      var data = new FormData(form);
      var payload = {
        action: 'lead',
        name: data.get('name'),
        company: data.get('company'),
        contact: data.get('contact'),
        project_type: data.get('project_type'),
        components: data.getAll('components'),
        task: data.get('task'),
        timeline: data.get('timeline'),
        budget: data.get('budget'),
        website: data.get('website'),
        agree: data.get('agree') === '1'
      };

      form.classList.add('is-sending');
      status.textContent = 'Отправляем…';
      try {
        var response = await fetch('../api/ai.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        var raw = await response.text();
        var result;
        try { result = JSON.parse(raw); } catch (_) { result = null; }
        if (!response.ok || !result || !result.ok) throw new Error(result && result.error ? result.error : 'Сервис отправки сейчас недоступен');
        if (result.mail_live === false) {
          status.textContent = 'Локальное превью: форма работает, отправка включится на playdisplay.com.';
          return;
        }
        form.hidden = true;
        document.querySelector('.project-dialog__intro').hidden = true;
        success.hidden = false;
      } catch (error) {
        status.textContent = error && error.message ? error.message : 'Не удалось отправить. Попробуйте ещё раз.';
      } finally {
        form.classList.remove('is-sending');
      }
    });
  }
})();
