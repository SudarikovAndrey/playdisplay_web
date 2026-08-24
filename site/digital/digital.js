(function () {
  'use strict';

  var mindmap = document.querySelector('[data-digital-mindmap]');
  if (mindmap) initDigitalMindmap(mindmap);

  function initDigitalMindmap(map) {
    var viewport = map.querySelector('[data-map-viewport]');
    var nodesHost = map.querySelector('[data-map-nodes]');
    var linesHost = map.querySelector('[data-map-lines]');
    var rootNode = map.querySelector('[data-map-root]');
    var path = map.querySelector('[data-map-path]');
    var help = map.querySelector('[data-map-help]');
    var live = map.querySelector('[data-map-live]');
    var back = map.querySelector('[data-map-back]');
    var reset = map.querySelector('[data-map-reset]');
    var state = 'root';
    var selected = null;
    var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var catalog = [
      {
        id: 'product', title: 'Продукт или объект', note: 'От хлеба и кроссовок до автомобиля и дома', image: '../assets/concepts/floating-object/thumb.jpg',
        benefits: [
          ['Раскрывает ценность', 'Объясняет состав, происхождение, свойства и устройство продукта.'],
          ['Отвечает на вопросы', 'Помогает выбрать, использовать, установить или обслуживать продукт.'],
          ['Персонализирует опыт', 'Адаптирует инструкции и рекомендации под конкретного владельца.'],
          ['Продолжает отношения', 'Возвращает человека к сервису, повторной покупке и дополнительным решениям.'],
          ['Даёт обратную связь', 'Собирает вопросы, сценарии использования и данные о потребностях аудитории.']
        ],
        components: [
          ['Точка входа', 'QR-код, NFC или ссылка на упаковке и самом объекте.'],
          ['Цифровой паспорт', 'Описание, происхождение, характеристики, документы и гарантия.'],
          ['AI-консультант', 'Ответы по проверенной базе знаний продукта.'],
          ['Инструкции и модели', 'Видео, 3D, AR, схемы, подбор и расчёты.'],
          ['Сервисный маршрут', 'Запчасти, обслуживание, поддержка и запись.'],
          ['Лояльность и продажи', 'Повторный заказ, дополнения, рекомендации и аналитика.']
        ]
      },
      {
        id: 'event', title: 'Событие', note: 'Выставка, форум, курс, концерт или свадьба', image: 'assets/youth.jpg',
        benefits: [
          ['Готовит участника', 'Знакомит с темой, программой и возможностями до начала события.'],
          ['Строит личный маршрут', 'Выбирает релевантные темы, людей, стенды и активности.'],
          ['Вовлекает в моменте', 'Подключает к играм, заданиям, голосованиям и совместным действиям.'],
          ['Расширяет аудиторию', 'Даёт удалённому участнику собственный виртуальный опыт.'],
          ['Продлевает эффект', 'Сохраняет материалы, контакты, результаты и продолжает общение после события.']
        ],
        components: [
          ['Вход и регистрация', 'Ссылка, QR-код, билет или приглашение.'],
          ['Личная программа', 'Расписание, карта, рекомендации и уведомления.'],
          ['AI-проводник', 'Навигация по содержанию, людям и возможностям события.'],
          ['Виртуальное участие', 'Трансляции, цифровое пространство и удалённые активности.'],
          ['Интерактив', 'Игры, опросы, челленджи, задания и групповые механики.'],
          ['Продолжение', 'Материалы, нетворкинг, обратная связь и следующий шаг.']
        ]
      },
      {
        id: 'place', title: 'Место', note: 'Музей, школа, офис продаж или торговый центр', image: '../assets/concepts/living-interior/thumb.jpg',
        benefits: [
          ['Помогает ориентироваться', 'Показывает пространство, маршруты, сервисы и точки интереса.'],
          ['Раскрывает объекты', 'Даёт каждому месту и предмету собственную историю и функцию.'],
          ['Персонализирует визит', 'Собирает маршрут под время, интересы и задачи человека.'],
          ['Добавляет действие', 'Позволяет исследовать, учиться, выбирать, бронировать и покупать.'],
          ['Возвращает человека', 'Сохраняет опыт, предлагает новые маршруты и формирует лояльность.']
        ],
        components: [
          ['Точки входа', 'QR-коды, NFC, экраны и терминалы внутри пространства.'],
          ['Карта и навигация', 'Маршруты, расписание, доступность и поиск объектов.'],
          ['Цифровые объекты', 'Карточки, 3D-модели, AR и вложенные уровни информации.'],
          ['AI-гид', 'Ответы, рекомендации и персональная экскурсия.'],
          ['Игровой маршрут', 'Квесты, задания, обучение и групповые активности.'],
          ['Сервисы места', 'Билеты, запись, бронирование, покупки и обратная связь.']
        ]
      },
      {
        id: 'person', title: 'Персона', note: 'Эксперт, врач, художник, политик или мастер', image: '../assets/concepts/art-portrait/thumb.jpg',
        benefits: [
          ['Масштабирует присутствие', 'Человек может знакомить и консультировать аудиторию круглосуточно.'],
          ['Передаёт экспертизу', 'Сохраняет знания, подход, язык и авторскую позицию.'],
          ['Понимает запрос', 'Выявляет задачу человека до личной встречи со специалистом.'],
          ['Формирует доверие', 'Создаёт последовательное знакомство через диалог и полезный опыт.'],
          ['Развивает аудиторию', 'Ведёт к консультации, продукту, обучению или сообществу.']
        ],
        components: [
          ['Цифровое представление', 'История, позиция, компетенции и формат знакомства.'],
          ['AI-ассистент персоны', 'Диалог на основе знаний, опыта и авторского подхода.'],
          ['Медиатека', 'Статьи, видео, выступления, кейсы и ответы.'],
          ['Диагностика запроса', 'Вопросы, первичная консультация и подбор маршрута.'],
          ['Обучение и практика', 'Курсы, задания, тесты, разборы и рекомендации.'],
          ['Контакт и монетизация', 'Запись, оплата, продукты, подписка и сообщество.']
        ]
      },
      {
        id: 'organization', title: 'Организация или бренд', note: 'Компания, учреждение, фонд или сообщество', image: '../assets/concepts/control-center/thumb.jpg',
        benefits: [
          ['Создаёт единый вход', 'Объединяет продукты, сервисы, знания и возможности организации.'],
          ['Говорит с разными людьми', 'Адаптирует содержание под клиента, сотрудника, партнёра или кандидата.'],
          ['Передаёт ценности', 'Показывает культуру, экспертизу и позицию через конкретный опыт.'],
          ['Ведёт к нужному действию', 'Направляет человека к услуге, продукту, вакансии или программе.'],
          ['Повышает эффективность', 'Автоматизирует консультации и собирает данные о запросах аудитории.']
        ],
        components: [
          ['Цифровой хаб', 'Единая среда организации с понятными точками входа.'],
          ['AI-консультант', 'Ответы по продуктам, услугам, правилам и знаниям компании.'],
          ['Маршруты аудиторий', 'Отдельные сценарии для клиентов, сотрудников и партнёров.'],
          ['Каталог возможностей', 'Продукты, сервисы, проекты, вакансии и программы.'],
          ['Знания и обучение', 'Кейсы, инструкции, академия и внутренняя база знаний.'],
          ['Интеграции и аналитика', 'CRM, формы, обращения, сегментация и отчётность.']
        ]
      },
      {
        id: 'program', title: 'Программа или процесс', note: 'Государственная инициатива, акция или развитие', image: '../assets/concepts/team-mission/thumb.jpg',
        benefits: [
          ['Объясняет условия', 'Переводит сложную программу на понятный язык и показывает возможности.'],
          ['Определяет потребность', 'Понимает ситуацию человека и проверяет, что ему подходит.'],
          ['Ведёт по шагам', 'Формирует персональный маршрут от входа до результата.'],
          ['Поддерживает мотивацию', 'Напоминает, вовлекает и помогает завершить процесс.'],
          ['Показывает результат', 'Собирает прогресс, обратную связь и данные об эффективности программы.']
        ],
        components: [
          ['Знакомство и анкета', 'Первичная диагностика ситуации, цели и доступных возможностей.'],
          ['AI-навигатор', 'Ответы по правилам и подбор релевантного сценария.'],
          ['Личная дорожная карта', 'Этапы, сроки, документы и следующие действия.'],
          ['Библиотека знаний', 'Инструкции, примеры, видео и ответы на вопросы.'],
          ['Задания и мотивация', 'Челленджи, напоминания, баллы и контроль прогресса.'],
          ['Заявки и аналитика', 'Подача документов, кабинет участника и отчётность.']
        ]
      },
      {
        id: 'idea', title: 'Идея, знание или явление', note: 'Технология, история, теория или общественная тема', image: '../assets/concepts/ar-xray/thumb.jpg',
        benefits: [
          ['Делает абстрактное наглядным', 'Показывает связи, причины, устройство и скрытые процессы.'],
          ['Настраивает сложность', 'Объясняет одну тему по-разному новичку и специалисту.'],
          ['Даёт исследовать', 'Позволяет задавать вопросы, менять параметры и находить свой маршрут.'],
          ['Проверяет понимание', 'Превращает знакомство с темой в обучение и практику.'],
          ['Создаёт личное отношение', 'Соединяет факты с эмоцией, опытом и собственной позицией человека.']
        ],
        components: [
          ['Визуальная история', 'Понятная драматургия, примеры, видео и последовательное раскрытие.'],
          ['AI-объяснение', 'Диалог и ответы на уровне подготовки конкретного человека.'],
          ['Интерактивные модели', 'Схемы, карты, 3D и вложенные уровни информации.'],
          ['Симуляции', 'Эксперименты и сценарии «что будет, если».'],
          ['Библиотека', 'Источники, документы, исследования и связанные материалы.'],
          ['Проверка и обсуждение', 'Тесты, задания, дискуссия и личный итог.']
        ]
      }
    ];

    var categoryPositions = [
      { x: 900, y: 150 }, { x: 1310, y: 270 }, { x: 1430, y: 600 },
      { x: 1230, y: 910 }, { x: 820, y: 970 }, { x: 420, y: 830 }, { x: 370, y: 350 }
    ];
    var benefitY = [180, 370, 560, 750, 940];
    var componentY = [100, 285, 470, 650, 835, 1020];
    var detailRoot = { x: 150, y: 560 };
    var categoryFocus = { x: 430, y: 560 };
    var branchFocus = { x: 1180, y: 560 };

    function setRootPosition(point) {
      rootNode.style.left = point.x + 'px';
      rootNode.style.top = point.y + 'px';
      rootNode.style.setProperty('--x', point.x + 'px');
      rootNode.style.setProperty('--y', point.y + 'px');
    }

    function line(from, to, kind, role) {
      var el = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      el.setAttribute('x1', from.x);
      el.setAttribute('y1', from.y);
      el.setAttribute('x2', to.x);
      el.setAttribute('y2', to.y);
      el.setAttribute('class', 'map-line map-line--' + kind);
      if (role) el.setAttribute('data-map-line-role', role);
      linesHost.appendChild(el);
    }

    function createNode(kind, data, point, origin, index, onClick, role) {
      var el = document.createElement(onClick ? 'button' : 'div');
      if (onClick) el.type = 'button';
      el.className = 'mind-node mind-node--' + kind;
      el.style.left = point.x + 'px';
      el.style.top = point.y + 'px';
      el.style.setProperty('--from-x', (origin.x - point.x) + 'px');
      el.style.setProperty('--from-y', (origin.y - point.y) + 'px');
      if (role) el.setAttribute('data-map-role', role);
      if (data.image) {
        var img = document.createElement('img');
        img.src = data.image;
        img.alt = '';
        el.appendChild(img);
      }
      var label = document.createElement('span');
      label.textContent = data.label || '';
      var title = document.createElement('strong');
      title.textContent = data.title;
      var note = document.createElement('small');
      note.textContent = data.note || '';
      el.appendChild(label);
      el.appendChild(title);
      if (data.note) el.appendChild(note);
      if (onClick) el.addEventListener('click', onClick);
      nodesHost.appendChild(el);
      window.setTimeout(function () { el.classList.add('is-visible'); }, 35 + index * 55);
      return el;
    }

    function clearDynamic() {
      Array.prototype.forEach.call(nodesHost.querySelectorAll('.mind-node:not([data-map-root])'), function (node) {
        node.classList.remove('is-visible');
        node.classList.add('is-leaving');
        window.setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 280);
      });
      linesHost.innerHTML = '';
    }

    function centerOn(point) {
      var left = Math.max(0, point.x - viewport.clientWidth / 2);
      var top = Math.max(0, point.y - viewport.clientHeight / 2);
      viewport.scrollTo({ left: left, top: top, behavior: reducedMotion ? 'auto' : 'smooth' });
    }

    function updateUi(nextState, pathText, helpText, announcement) {
      state = nextState;
      path.textContent = pathText;
      help.textContent = helpText;
      live.textContent = announcement;
      back.hidden = nextState === 'root';
      reset.hidden = nextState === 'root';
    }

    function showRoot() {
      selected = null;
      clearDynamic();
      setRootPosition({ x: 900, y: 560 });
      updateUi('root', 'Цифровой слой', 'Нажмите на центральный круг. Карту можно двигать мышью или пальцем.', 'Карта возвращена в начало.');
      centerOn({ x: 900, y: 560 });
    }

    function showCategories() {
      clearDynamic();
      setRootPosition({ x: 900, y: 560 });
      catalog.forEach(function (item, index) {
        var point = categoryPositions[index];
        line({ x: 900, y: 560 }, point, 'category', 'category');
        createNode('category', {
          label: 'Объект ' + String(index + 1).padStart(2, '0'), title: item.title, note: item.note, image: item.image
        }, point, { x: 900, y: 560 }, index, function () { showBenefits(item); }, 'category');
      });
      updateUi('categories', 'Цифровой слой / Вокруг чего создаётся', 'Выберите объект, чтобы увидеть его ценность и возможный состав.', 'Открыто семь типов объектов цифрового слоя.');
      centerOn({ x: 900, y: 560 });
    }

    function showBenefits(item) {
      selected = item;
      clearDynamic();
      setRootPosition(detailRoot);
      line(detailRoot, categoryFocus, 'category', 'benefit-base');
      createNode('category', {
        label: 'Выбранный объект', title: item.title, note: item.note, image: item.image
      }, categoryFocus, { x: 900, y: 560 }, 0, null, 'benefit-base');

      item.benefits.forEach(function (benefit, index) {
        var point = { x: 820, y: benefitY[index] };
        line(categoryFocus, point, 'benefit', 'benefit');
        createNode('benefit', {
          label: 'Что даёт / ' + String(index + 1).padStart(2, '0'), title: benefit[0], note: benefit[1]
        }, point, categoryFocus, index + 1, null, 'benefit');
      });

      line(categoryFocus, branchFocus, 'component', 'component-branch');
      createNode('branch', {
        label: 'Следующий уровень', title: 'Из чего состоит', note: 'Раскрыть состав решения'
      }, branchFocus, categoryFocus, 6, function () { showComponents(item); }, 'component-branch');

      updateUi('benefits', 'Цифровой слой / ' + item.title + ' / Что даёт', 'Изучите ценность и нажмите «Из чего состоит», чтобы раскрыть инструменты.', 'Открыта ценность цифрового слоя для категории «' + item.title + '».');
      centerOn({ x: 760, y: 560 });
    }

    function showComponents(item) {
      if (state === 'components') return;
      item.components.forEach(function (component, index) {
        var point = { x: 1540, y: componentY[index] };
        line(branchFocus, point, 'component', 'component');
        createNode('component', {
          label: 'Состав / ' + String(index + 1).padStart(2, '0'), title: component[0], note: component[1]
        }, point, branchFocus, index, null, 'component');
      });
      updateUi('components', 'Цифровой слой / ' + item.title + ' / Состав решения', 'Карта раскрыта полностью. Перемещайтесь по полю или вернитесь на уровень назад.', 'Открыт состав цифрового слоя для категории «' + item.title + '».');
      centerOn({ x: 1390, y: 560 });
    }

    rootNode.addEventListener('click', function () {
      if (state === 'root' || state === 'categories') showCategories();
      else showCategories();
    });
    back.addEventListener('click', function () {
      if (state === 'components' && selected) showBenefits(selected);
      else if (state === 'benefits') showCategories();
      else showRoot();
    });
    reset.addEventListener('click', showRoot);

    var drag = null;
    viewport.addEventListener('pointerdown', function (event) {
      if (event.pointerType !== 'mouse' || event.button !== 0 || event.target.closest('button, a, input, select, textarea')) return;
      drag = { x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
      viewport.setPointerCapture(event.pointerId);
    });
    viewport.addEventListener('pointermove', function (event) {
      if (!drag) return;
      viewport.scrollLeft = drag.left - (event.clientX - drag.x);
      viewport.scrollTop = drag.top - (event.clientY - drag.y);
    });
    viewport.addEventListener('pointerup', function () { drag = null; });
    viewport.addEventListener('pointercancel', function () { drag = null; });
    viewport.addEventListener('keydown', function (event) {
      var moves = { ArrowLeft: [-90, 0], ArrowRight: [90, 0], ArrowUp: [0, -90], ArrowDown: [0, 90] };
      if (!moves[event.key]) return;
      event.preventDefault();
      viewport.scrollBy({ left: moves[event.key][0], top: moves[event.key][1], behavior: reducedMotion ? 'auto' : 'smooth' });
    });

    window.setTimeout(function () { centerOn({ x: 900, y: 560 }); }, 120);
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
