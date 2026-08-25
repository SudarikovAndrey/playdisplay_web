(function () {
  'use strict';

  var layerPoints = document.querySelector('[data-layer-points]');
  if (layerPoints) initLayerPoints(layerPoints);

  var pointSpheres = document.querySelectorAll('[data-point-sphere]');
  if (pointSpheres.length) initPointSpheres(pointSpheres);

  var layerWord = document.querySelector('[data-layer-word]');
  if (layerWord) initLayerWord(layerWord);

  var mindmap = document.querySelector('[data-digital-mindmap]');
  if (mindmap) initDigitalMindmap(mindmap);

  var layerTransition = document.querySelector('[data-layer-transition]');
  if (layerTransition) initLayerTransition(layerTransition);

  function initLayerPoints(host) {
    var fragment = document.createDocumentFragment();
    var colors = ['#6f86ff', '#a8b8ff', '#68bba8', '#d27a66'];
    for (var index = 0; index < 118; index += 1) {
      var angle = index * 2.3999632297;
      var radius = 10 + 39 * Math.sqrt((index + 1) / 118);
      var point = document.createElement('i');
      var x = 50 + Math.cos(angle) * radius;
      var y = 50 + Math.sin(angle) * radius * .78;
      var size = 1.2 + (index % 7) * .42;
      point.style.setProperty('--point-x', x.toFixed(2) + '%');
      point.style.setProperty('--point-y', y.toFixed(2) + '%');
      point.style.setProperty('--point-size', size.toFixed(2) + 'px');
      point.style.setProperty('--point-opacity', (.26 + (index % 9) * .065).toFixed(2));
      point.style.setProperty('--point-color', colors[index % colors.length]);
      point.style.setProperty('--point-dx', ((index % 5) - 2) * 4 + 'px');
      point.style.setProperty('--point-dy', ((index % 7) - 3) * 3 + 'px');
      point.style.setProperty('--point-duration', (2.8 + (index % 8) * .47).toFixed(2) + 's');
      point.style.setProperty('--point-delay', (-index * .07).toFixed(2) + 's');
      fragment.appendChild(point);
    }
    host.appendChild(fragment);
  }

  function initPointSpheres(hosts) {
    var points = [];
    var goldenAngle = Math.PI * (3 - Math.sqrt(5));
    var surfaceCount = 1540;
    var rimCount = 720;

    for (var index = 0; index < surfaceCount; index += 1) {
      var y = 1 - 2 * (index + .5) / surfaceCount;
      var radius = Math.sqrt(Math.max(0, 1 - y * y));
      var angle = index * goldenAngle;
      points.push({ x: Math.cos(angle) * radius, y: y, z: Math.sin(angle) * radius });
    }
    for (var rimIndex = 0; rimIndex < rimCount; rimIndex += 1) {
      var rimAngle = Math.PI * 2 * rimIndex / rimCount;
      var rimRadius = .88 + .1 * (.5 + .5 * Math.sin(rimIndex * 2.17));
      points.push({
        x: Math.cos(rimAngle) * rimRadius,
        y: Math.sin(rimAngle) * rimRadius,
        z: Math.sin(rimIndex * 1.73) * .16
      });
    }

    var hoverCount = 0;
    var spheres = Array.prototype.map.call(hosts, function (host) {
      var canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      host.appendChild(canvas);
      var button = host.closest('button');
      if (button) {
        button.addEventListener('pointerenter', function () { hoverCount += 1; });
        button.addEventListener('pointerleave', function () { hoverCount = Math.max(0, hoverCount - 1); });
      }
      return { host: host, canvas: canvas, context: canvas.getContext('2d') };
    });

    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var lastFrame = 0;
    var rotationY = 0;
    function render(time) {
      if (!reduced && time - lastFrame < 34) {
        window.requestAnimationFrame(render);
        return;
      }
      var elapsed = lastFrame ? Math.min(80, time - lastFrame) : 34;
      lastFrame = time;
      var active = hoverCount > 0;
      rotationY += elapsed * (active ? .00105 : .00019);
      var rotationX = Math.sin(time * .00011) * .16;
      var cosY = Math.cos(rotationY);
      var sinY = Math.sin(rotationY);
      var cosX = Math.cos(rotationX);
      var sinX = Math.sin(rotationX);

      spheres.forEach(function (sphere) {
        var box = sphere.host.getBoundingClientRect();
        if (box.width < 2 || box.height < 2) return;
        var ratio = Math.min(2, window.devicePixelRatio || 1);
        var width = Math.max(1, Math.round(box.width * ratio));
        var height = Math.max(1, Math.round(box.height * ratio));
        if (sphere.canvas.width !== width || sphere.canvas.height !== height) {
          sphere.canvas.width = width;
          sphere.canvas.height = height;
        }
        var context = sphere.context;
        context.clearRect(0, 0, width, height);
        context.fillStyle = active ? 'rgba(226,234,255,.96)' : 'rgba(196,209,245,.72)';
        var centerX = width / 2;
        var centerY = height / 2;
        var radius = Math.min(width, height) * .465;
        var pixel = Math.max(1, ratio);

        points.forEach(function (point) {
          var x = point.x * cosY + point.z * sinY;
          var z = -point.x * sinY + point.z * cosY;
          var y = point.y * cosX - z * sinX;
          var depth = point.y * sinX + z * cosX;
          var edge = Math.min(1, Math.sqrt(x * x + y * y));
          var perspective = 1 + depth * .075;
          context.globalAlpha = Math.min(1, (active ? .38 : .18) + (depth + 1) * (active ? .31 : .23) + edge * .16);
          context.fillRect(
            Math.round(centerX + x * radius * perspective),
            Math.round(centerY + y * radius * perspective),
            pixel,
            pixel
          );
        });
        context.globalAlpha = 1;
      });

      if (!reduced) window.requestAnimationFrame(render);
    }
    window.requestAnimationFrame(render);
  }

  function initLayerWord(host) {
    var words = [
      'объясняет', 'увлекает', 'обучает', 'впечатляет', 'организует',
      'вдохновляет', 'мотивирует', 'соединяет вас с адресатом', 'собирает данные'
    ];
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var index = 0;
    var timer = 0;
    var run = 0;

    function schedule() {
      window.clearTimeout(timer);
      timer = window.setTimeout(nextWord, 3000);
    }

    function replaceWord(next) {
      window.clearTimeout(timer);
      var currentRun = ++run;
      var visible = host.textContent;

      if (reduced) {
        host.textContent = next;
        host.setAttribute('aria-label', next + '. Сменить слово');
        schedule();
        return;
      }

      host.classList.add('is-typing');
      function erase() {
        if (currentRun !== run) return;
        if (visible.length) {
          visible = visible.slice(0, -1);
          host.textContent = visible;
          window.setTimeout(erase, 28);
          return;
        }
        type(0);
      }

      function type(position) {
        if (currentRun !== run) return;
        host.textContent = next.slice(0, position);
        if (position < next.length) {
          window.setTimeout(function () { type(position + 1); }, 52);
          return;
        }
        host.classList.remove('is-typing');
        host.setAttribute('aria-label', next + '. Сменить слово');
        schedule();
      }

      erase();
    }

    function nextWord() {
      index = (index + 1) % words.length;
      replaceWord(words[index]);
    }

    host.addEventListener('click', nextWord);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) window.clearTimeout(timer);
      else schedule();
    });
    schedule();
  }

  function initLayerTransition(sticky) {
    var hero = sticky.closest('.layer-hero');
    var visual = sticky.querySelector('[data-layer-visual]');
    var core = sticky.querySelector('[data-layer-core]');
    var mapRoot = document.querySelector('[data-map-root]');
    var mapSection = document.getElementById('s03');
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var directMapEntry = window.location.hash === '#s03';
    var bypassIntro = Boolean(window.location.hash && window.location.hash !== '#top' && window.location.hash !== '#intro');
    var launched = bypassIntro;
    var transitioning = false;
    var phase = bypassIntro ? 1 : 0;

    function clamp(value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, value)); }
    function smooth(value) { return value * value * (3 - 2 * value); }

    function renderTransition(value) {
      phase = clamp(value, 0, 1);
      var baseCenterX = visual.offsetLeft + visual.offsetWidth / 2;
      var shiftX = (window.innerWidth / 2 - baseCenterX) * phase;
      var shiftY = (window.innerHeight / 2 - visual.offsetTop) * phase;
      var coreWidth = Math.max(1, core.offsetWidth);
      var targetCoreWidth = mapRoot ? mapRoot.offsetWidth : 236;
      var targetScale = clamp(targetCoreWidth / coreWidth, .78, 1.48);
      var visualScale = 1 + (targetScale - 1) * phase;
      var copyOpacity = clamp(1 - phase * 1.04, 0, 1);
      var sceneOpacity = clamp(1 - phase, 0, 1);
      var depthScale = 1 - phase * .72;
      var coreOpacity = 1;
      var backgroundOpacity = 1;
      var applicationOpacity = clamp((phase - .88) / .12, 0, 1);

      sticky.style.setProperty('--hero-shift-x', shiftX.toFixed(2) + 'px');
      sticky.style.setProperty('--hero-shift-y', shiftY.toFixed(2) + 'px');
      sticky.style.setProperty('--hero-visual-scale', visualScale.toFixed(4));
      sticky.style.setProperty('--hero-copy-opacity', copyOpacity.toFixed(3));
      sticky.style.setProperty('--hero-copy-y', (-72 * phase).toFixed(2) + 'px');
      sticky.style.setProperty('--hero-copy-scale', (1 - phase * .1).toFixed(3));
      sticky.style.setProperty('--hero-depth-scale', depthScale.toFixed(3));
      sticky.style.setProperty('--hero-scene-opacity', sceneOpacity.toFixed(3));
      sticky.style.setProperty('--hero-core-opacity', coreOpacity.toFixed(3));
      sticky.style.setProperty('--hero-application-opacity', applicationOpacity.toFixed(3));
      sticky.style.setProperty('--hero-blur', (phase * 6).toFixed(2) + 'px');
      sticky.style.setProperty('--hero-bg-opacity', backgroundOpacity.toFixed(3));
      sticky.style.setProperty('--hero-grid-opacity', backgroundOpacity.toFixed(3));
      hero.classList.toggle('is-transitioned', phase > .82);
    }

    function enterMap() {
      if (launched || transitioning) return;
      launched = true;
      transitioning = true;
      core.setAttribute('aria-busy', 'true');
      var start = performance.now();
      var duration = reduced ? 1 : 1550;

      function frame(now) {
        var progress = clamp((now - start) / duration, 0, 1);
        renderTransition(smooth(progress));
        if (progress < 1) {
          window.requestAnimationFrame(frame);
          return;
        }
        transitioning = false;
        core.removeAttribute('aria-busy');
        document.documentElement.classList.remove('intro-space-locked');
        if (mapSection) {
          var rootScrollBehavior = document.documentElement.style.scrollBehavior;
          var bodyScrollBehavior = document.body.style.scrollBehavior;
          document.documentElement.style.scrollBehavior = 'auto';
          document.body.style.scrollBehavior = 'auto';
          window.scrollTo(0, mapSection.offsetTop);
          hero.classList.add('is-map-active');
          window.requestAnimationFrame(function () {
            document.documentElement.style.scrollBehavior = rootScrollBehavior;
            document.body.style.scrollBehavior = bodyScrollBehavior;
          });
        }
        if (window.history && window.history.replaceState) window.history.replaceState(null, '', '#s03');
        document.dispatchEvent(new CustomEvent('digital-map:entered'));
      }

      window.requestAnimationFrame(frame);
    }

    function resetIntro() {
      if (transitioning) return;
      launched = false;
      hero.classList.remove('is-map-active');
      renderTransition(0);
      document.documentElement.classList.add('intro-space-locked');
    }

    function returnToIntro() {
      if (transitioning) return;
      document.documentElement.classList.remove('intro-space-locked');
      var rootScrollBehavior = document.documentElement.style.scrollBehavior;
      var bodyScrollBehavior = document.body.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = 'auto';
      document.body.style.scrollBehavior = 'auto';
      launched = false;
      hero.classList.remove('is-map-active');
      renderTransition(0);
      window.scrollTo(0, 0);
      if (window.history && window.history.replaceState) window.history.replaceState(null, '', '#top');
      window.requestAnimationFrame(function () {
        document.documentElement.style.scrollBehavior = rootScrollBehavior;
        document.body.style.scrollBehavior = bodyScrollBehavior;
        document.documentElement.classList.add('intro-space-locked');
      });
    }

    function keepIntroStill(event) {
      if (!transitioning && launched) return;
      if (event.target instanceof Element && event.target.closest('.chapter-nav, .project-dialog')) return;
      event.preventDefault();
    }

    function keepIntroKeyboardStill(event) {
      if (!transitioning && launched) return;
      if (event.target.closest('input, textarea, select, button, a')) return;
      if (!['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) return;
      event.preventDefault();
    }

    core.addEventListener('click', enterMap);
    window.addEventListener('wheel', keepIntroStill, { passive: false, capture: true });
    window.addEventListener('touchmove', keepIntroStill, { passive: false, capture: true });
    document.addEventListener('keydown', keepIntroKeyboardStill);
    window.addEventListener('resize', function () { renderTransition(phase); });
    window.addEventListener('hashchange', function () {
      if (window.location.hash === '#top' || window.location.hash === '#intro' || !window.location.hash) resetIntro();
    });
    document.addEventListener('digital-intro:return', returnToIntro);
    var toTopButton = document.getElementById('toTop');
    if (toTopButton) toTopButton.addEventListener('click', returnToIntro);

    if (bypassIntro) {
      renderTransition(1);
      hero.classList.add('is-map-active');
      if (directMapEntry) window.setTimeout(function () { document.dispatchEvent(new CustomEvent('digital-map:entered')); }, 80);
    } else {
      document.documentElement.classList.add('intro-space-locked');
      renderTransition(0);
    }
  }

  function initDigitalMindmap(map) {
    var viewport = map.querySelector('[data-map-viewport]');
    var stage = map.querySelector('[data-map-stage]');
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
    var selectedPoint = null;
    var selectedNode = null;
    var selectedDirection = { x: 1, y: 0 };
    var questionPoint = null;
    var branchPoint = null;
    var benefitPoints = [];
    var componentPoints = [];
    var currentPoints = [];
    var detailedNode = null;
    var detailReturnView = null;
    var detailTypingRun = 0;
    var cameraRun = 0;
    var pointerParallax = { x: 0, y: 0 };
    var spaceReactionTimer = 0;
    var panLimits = null;
    var enforcingPan = false;
    var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var catalog = [
      {
        id: 'product', title: 'Ваш продукт или физический объект', note: 'Упаковка, техника, автомобиль, дом, материал или комплектующая — всё, что человек выбирает, покупает и использует.', image: '../assets/concepts/floating-object/thumb.jpg',
        benefits: [
          ['Ценность без мелкого шрифта', 'Покупатель за минуту понимает, что перед ним, из чего это сделано, чем отличается от аналогов и почему цена имеет смысл.'],
          ['Ответ здесь и сейчас', 'Человек задаёт вопрос голосом или текстом и сразу получает точный ответ — без поисков по форумам и ожидания оператора.'],
          ['Понятно именно ему', 'Новичку цифровой слой объяснит всё по шагам, а опытному пользователю покажет характеристики, совместимость и тонкие настройки.'],
          ['Связь после покупки', 'После оплаты продукт не исчезает: помогает начать, напоминает об уходе и вовремя предлагает полезное продолжение.'],
          ['Живая обратная связь', 'Компания видит реальные вопросы, трудности и сценарии использования — не по догадкам, а по поведению аудитории.']
        ],
        components: [
          ['Открыть за секунду', 'Покупатель наводит камеру телефона на QR-код или касается NFC-метки и сразу попадает в цифровой слой. Ничего устанавливать и вспоминать пароль не нужно.'],
          ['Всё о продукте', 'В одном понятном экране собраны состав, происхождение, характеристики, сертификаты и гарантия. Важное видно сразу, документы тоже рядом — для тех, кто любит проверить.'],
          ['Спросить у AI', 'Человек задаёт вопрос голосом или текстом, а AI-ассистент отвечает по проверенной базе знаний: помогает выбрать, настроить и безопасно пользоваться продуктом.'],
          ['Показать в деле', 'Покупатель одним голосовым вопросом открывает нужный видеофрагмент, 3D-схему или инструкцию в дополненной реальности и сразу видит, что нажать, повернуть или установить.'],
          ['Сервис без поисков', 'Цифровой слой узнаёт модель, показывает подходящие расходники и запчасти, напоминает об обслуживании и ведёт прямо к записи в сервис — без квеста из десяти вкладок.'],
          ['Продолжить отношения', 'После покупки человек получает полезные напоминания, совместимые дополнения и повторный заказ в пару касаний, а бренд понимает, что действительно нужно владельцам.']
        ]
      },
      {
        id: 'event', title: 'Ваше событие и его аудитория', note: 'Выставка, форум, курс, концерт или частное мероприятие — очно, онлайн или в гибридном формате.', image: 'assets/youth.jpg',
        benefits: [
          ['Маршрут по интересам', 'Участник получает личную программу: нужные темы, стенды, людей и активности — вместо попытки успеть вообще везде.'],
          ['Больше участия', 'Гость голосует, играет, выполняет задания и влияет на происходящее. Он уже не зритель с бейджем, а участник события.'],
          ['Доступ из любой точки', 'Тот, кто не приехал, входит в виртуальное пространство, смотрит трансляции, посещает стенды и общается почти как на площадке.'],
          ['Знакомства по делу', 'Сервис понимает интересы участников и помогает встретить нужного эксперта, партнёра или собеседника, пока кофе ещё горячий.'],
          ['Эффект после финала', 'Материалы, контакты и результаты остаются с участником, а организатор продолжает диалог после того, как сцена уже разобрана.']
        ],
        components: [
          ['Войти без очереди', 'Участник открывает ссылку или QR-код из билета, быстро регистрируется и получает личный профиль. Никаких приложений, длинных анкет и очереди у стойки.'],
          ['Моя программа', 'Сервис собирает расписание под интересы человека, показывает карту и вовремя напоминает, куда идти. Пропустить главное становится заметно сложнее.'],
          ['Спросить проводника', 'AI-проводник отвечает голосом или текстом: где нужный зал, что идёт сейчас, с кем стоит познакомиться и как не потратить полчаса на поиски кофе.'],
          ['Быть там онлайн', 'Удалённый участник смотрит трансляции, гуляет по виртуальным стендам, задаёт вопросы спикерам и включается в активности вместе с залом.'],
          ['Играть вместе', 'Опросы, челленджи, командные задания и рейтинги превращают программу в действие, а организатор сразу видит, что действительно зацепило аудиторию.'],
          ['Забрать с собой', 'После события человек сохраняет материалы, контакты и личные результаты, получает следующий шаг и может продолжить общение с участниками и брендами.']
        ]
      },
      {
        id: 'place', title: 'Ваше место и его посетители', note: 'Музей, школа, офис продаж, кампус или торговый центр, где человеку важно сориентироваться и включиться.', image: '../assets/concepts/living-interior/thumb.jpg',
        benefits: [
          ['Не потеряться', 'Посетитель получает понятный маршрут с учётом времени, цели и доступности — без кругов по этажам и вопроса «а где здесь выход?».'],
          ['Увидеть больше', 'Экспонат, аудитория, товар или зона рассказывают свою историю и показывают функции, которые обычно остаются незаметными.'],
          ['Свой сценарий визита', 'Один человек идёт по короткому маршруту, другой погружается глубже, третий приходит с детьми — пространство подстраивается под каждого.'],
          ['Действовать на месте', 'Посетитель может изучить, сравнить, забронировать, купить или записаться прямо в нужной точке, пока интерес не успел остыть.'],
          ['Захотеть вернуться', 'Сервис сохраняет пройденное, предлагает новые маршруты и продолжает знакомство с местом уже после визита.']
        ],
        components: [
          ['Вход в телефоне', 'Посетитель сканирует QR-код, касается NFC-метки или открывает терминал и сразу попадает в цифровую среду места. Устанавливать отдельное приложение не требуется.'],
          ['Умная карта', 'Карта показывает, где находится человек, строит удобный маршрут, учитывает лифты и доступность и предупреждает об изменениях в расписании.'],
          ['Объекты оживают', 'Достаточно навести телефон на объект, чтобы увидеть его историю, устройство, 3D-модель или дополненную реальность с важными деталями прямо поверх реального мира.'],
          ['Личный AI-гид', 'Посетитель задаёт вопросы обычными словами, а AI-гид отвечает на нужном языке и уровне сложности, предлагает следующую точку и не торопит группу.'],
          ['Маршрут с азартом', 'Квесты, загадки и командные задания помогают исследовать пространство внимательнее, а обучение происходит почти незаметно — пока все заняты игрой.'],
          ['Сервисы рядом', 'Билет, запись, бронь, заказ, оплата и обратная связь появляются именно там, где нужны. Посетителю не приходится искать отдельный сайт или стойку.']
        ]
      },
      {
        id: 'person', title: 'Ваш образ: эксперт или публичная персона', note: 'Специалист, врач, художник, политик или мастер, чьи знания, подход и образ важно передать аудитории.', image: '../assets/concepts/art-portrait/thumb.jpg',
        benefits: [
          ['На связи 24/7', 'Человек знакомится с экспертом и получает первые ответы в удобное время, даже если сам эксперт спит, выступает или наконец-то отдыхает.'],
          ['Передаёт свой подход', 'Цифровой слой сохраняет язык, логику и авторский метод эксперта, а не выдаёт безликие ответы из интернета.'],
          ['Понимает запрос заранее', 'До личной встречи сервис выясняет задачу, собирает контекст и помогает человеку сформулировать, что ему действительно нужно.'],
          ['Завоёвывает доверие', 'Аудитория знакомится через полезный диалог, примеры и реальные кейсы — без громких обещаний и обязательного «поверьте на слово».'],
          ['Растёт без выгорания', 'Типовые вопросы, знакомство и первичный разбор берёт на себя цифровой слой, а эксперт подключается там, где его участие действительно ценно.']
        ],
        components: [
          ['Знакомство за минуту', 'Человек быстро понимает, кто перед ним, в чём сильная сторона эксперта, с какими задачами он работает и подходит ли его метод именно сейчас.'],
          ['AI-двойник по делу', 'Ассистент отвечает голосом или текстом на основе реальных материалов и позиции эксперта. Если ответа в базе нет, честно передаёт вопрос человеку, а не фантазирует.'],
          ['Вся экспертиза рядом', 'Статьи, видео, выступления, кейсы и ответы собраны в одну умную медиатеку. Пользователь задаёт вопрос и сразу попадает к нужному фрагменту.'],
          ['Разобрать запрос', 'Короткий диалог помогает уточнить задачу, собрать исходные данные и подготовиться к консультации. Эксперт начинает встречу уже с контекстом, а не с нуля.'],
          ['Учиться с практикой', 'Пользователь получает личный маршрут, задания, проверку понимания и обратную связь. Знания превращаются в действие, а не оседают среди сохранённых видео.'],
          ['Перейти к человеку', 'Когда цифрового общения недостаточно, сервис предлагает подходящий формат: запись, оплату, курс, подписку или вступление в сообщество — без давления и лишних шагов.']
        ]
      },
      {
        id: 'organization', title: 'Ваша организация или бренд', note: 'Компания, учреждение, фонд или сообщество с разными аудиториями, сервисами и точками взаимодействия.', image: '../assets/concepts/control-center/thumb.jpg',
        benefits: [
          ['Один понятный вход', 'Клиент, сотрудник или партнёр начинает с одного адреса и быстро находит нужный продукт, сервис, знание или человека.'],
          ['Каждому своё', 'Одна среда узнаёт роль и интерес пользователя: клиенту показывает решение, кандидату — вакансии, сотруднику — рабочий маршрут.'],
          ['Ценности в действии', 'Бренд не просто рассказывает о себе, а даёт прожить свой подход через полезный сервис, диалог, обучение и конкретные кейсы.'],
          ['Быстрее к решению', 'Человек получает ответ и следующий шаг сразу: выбрать услугу, оставить заявку, записаться, подать документы или начать обучение.'],
          ['Меньше рутины', 'AI берёт типовые консультации на себя, а аналитика показывает реальные запросы аудитории и точки, где люди чаще всего застревают.']
        ],
        components: [
          ['Цифровая приёмная', 'Один web-адрес встречает человека, понимает его цель и ведёт в нужный раздел. Сложная структура организации остаётся внутри, пользователю её изучать не приходится.'],
          ['AI знает компанию', 'Ассистент отвечает по проверенным продуктам, услугам, правилам и документам компании. Ответы обновляются централизованно и звучат по-человечески.'],
          ['Маршрут для каждого', 'Клиент, кандидат, сотрудник и партнёр видят разные сценарии и действия. Система не заваливает всех одной и той же корпоративной энциклопедией.'],
          ['Витрина возможностей', 'Продукты, сервисы, проекты, вакансии и программы представлены через задачи пользователя: человек быстро понимает, что подходит и что делать дальше.'],
          ['Учиться внутри', 'Новичок проходит адаптацию, сотрудник находит инструкцию и тренируется на симуляции, а система проверяет понимание и показывает прогресс.'],
          ['Связать с системами', 'Цифровой слой передаёт обращения в CRM, запускает формы и бизнес-процессы, собирает аналитику и возвращает человеку статус — без разрыва между красивым входом и реальной работой.']
        ]
      },
      {
        id: 'program', title: 'Ваша программа или процесс', note: 'Государственная инициатива, корпоративная программа, рекламная акция или путь к конкретному результату.', image: '../assets/concepts/team-mission/thumb.jpg',
        benefits: [
          ['Без канцелярита', 'Человек понимает условия, возможности и ограничения программы обычным языком — без путешествия по регламенту на сорок семь страниц.'],
          ['Подходит или нет', 'Сервис уточняет ситуацию пользователя и честно показывает, может ли он участвовать, что получит и какие есть альтернативы.'],
          ['Путь по шагам', 'Большой процесс превращается в личный маршрут с понятными этапами, сроками, документами и следующим действием.'],
          ['Дойти до результата', 'Напоминания, поддержка и игровые механики помогают не бросить всё на третьем шаге, когда первый энтузиазм уже закончился.'],
          ['Результат виден', 'Участник видит свой прогресс, а организатор — где люди успешно проходят программу, где застревают и что стоит улучшить.']
        ],
        components: [
          ['Понять ситуацию', 'Короткий разговор или анкета выясняет цель, обстоятельства и ограничения человека. На старте он получает не рекламный текст, а понятный ответ: что здесь может быть полезно.'],
          ['Спросить навигатора', 'AI объясняет правила простыми словами, проверяет условия участия и помогает выбрать подходящий сценарий. Сложные случаи передаёт живому специалисту вместе с контекстом.'],
          ['Получить план', 'Сервис собирает личную дорожную карту: этапы, сроки, документы и следующее действие. Человек всегда понимает, где находится и что делать сейчас.'],
          ['Найти пример', 'Инструкции, видео, шаблоны и истории участников доступны по обычному вопросу. Не нужно угадывать название документа или перебирать десятки разделов.'],
          ['Не бросить', 'Напоминания, короткие задания, прогресс и поддержка возвращают человека в процесс. Игровые механики добавляют энергии, но не превращают серьёзную программу в детский квест.'],
          ['Подать и проверить', 'Участник заполняет заявку, загружает документы, видит статус и получает подсказки об ошибках. Организатор получает чистые данные и понятную аналитику прохождения.']
        ]
      },
      {
        id: 'idea', title: 'Ваша тема: идея, знание или явление', note: 'Технология, история, теория или общественная тема, которую трудно понять через обычное линейное описание.', image: '../assets/concepts/ar-xray/thumb.jpg',
        benefits: [
          ['Сложное становится видимым', 'Причины, связи и скрытые процессы можно увидеть в движении, а не пытаться собрать их в голове из длинного линейного текста.'],
          ['Объяснение по уровню', 'Одну тему цифровой слой объясняет ребёнку, новичку и специалисту по-разному — без упрощения смысла и демонстрации умных слов ради умных слов.'],
          ['Можно исследовать', 'Человек сам выбирает маршрут, задаёт вопросы, раскрывает детали и меняет параметры, превращаясь из читателя в исследователя.'],
          ['Понимание проверяется', 'Тесты, задания и симуляции показывают, что действительно стало понятно и где остался пробел, который стоит разобрать.'],
          ['Появляется своя позиция', 'Факты соединяются с опытом и эмоцией человека, поэтому тема перестаёт быть чужой абстракцией и становится поводом для собственного вывода.']
        ],
        components: [
          ['История вместо лекции', 'Тема раскрывается через сюжет, примеры, видео и последовательные открытия. Человек понимает, зачем смотреть дальше, а не ищет взглядом конец длинного текста.'],
          ['Спросить проще', 'AI принимает вопрос обычными словами, уточняет, что уже известно человеку, и объясняет на подходящем уровне — с примером, аналогией или разбором по шагам.'],
          ['Покрутить модель', 'Интерактивная схема, карта или 3D-модель показывает устройство явления. Пользователь приближает детали, включает слои и видит связи, скрытые в статичной картинке.'],
          ['Провести эксперимент', 'Человек меняет параметры и безопасно смотрит, что произойдёт: с системой, городом, организмом или экономикой. Ошибаться здесь можно — иногда именно так всё и становится понятно.'],
          ['Дойти до источника', 'Любой вывод связан с документом, исследованием или исходными данными. Любопытный пользователь может углубиться, а скептик — проверить, откуда взялось утверждение.'],
          ['Проверить себя', 'Тесты, сценарии и обсуждение помогают применить знание, увидеть пробелы и сформулировать собственный вывод. В конце остаётся не галочка «прочитано», а понятный результат.']
        ]
      }
    ];

    var categoryPositions = [
      { x: 2400, y: 1540 }, { x: 2790, y: 1580 }, { x: 2930, y: 1830 },
      { x: 2720, y: 2040 }, { x: 2320, y: 2060 }, { x: 1930, y: 2000 }, { x: 1880, y: 1630 }
    ];
    var rootPoint = { x: 2400, y: 1800 };
    var baseStage = { width: 5000, height: 3600 };

    function directionFromCenter(point) {
      var dx = point.x - rootPoint.x;
      var dy = point.y - rootPoint.y;
      var length = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      return { x: dx / length, y: dy / length };
    }

    function offsetPoint(origin, direction, forward, side) {
      return {
        x: origin.x + direction.x * forward - direction.y * side,
        y: origin.y + direction.y * forward + direction.x * side
      };
    }

    function fanLayout(origin, direction, count, compact, componentLevel) {
      var perpendicularSpacing = compact ? 100 + Math.abs(direction.y) * 80 : 122 + Math.abs(direction.y) * 178;
      var layerGap = compact ? 108 + Math.abs(direction.x) * 95 : 128 + Math.abs(direction.x) * 172;
      var firstDistance = compact ? (componentLevel ? 245 : 260) : (componentLevel ? 430 : 460);
      var firstSides = [-perpendicularSpacing, 0, perpendicularSpacing];
      var secondSides = count === 5
        ? [-perpendicularSpacing / 2, perpendicularSpacing / 2]
        : [-perpendicularSpacing, 0, perpendicularSpacing];
      var result = firstSides.map(function (side) {
        return offsetPoint(origin, direction, firstDistance, side);
      });
      secondSides.forEach(function (side) {
        result.push(offsetPoint(origin, direction, firstDistance + layerGap, side));
      });
      return result.slice(0, count);
    }

    function setRootPosition(point) {
      rootNode.style.left = point.x + 'px';
      rootNode.style.top = point.y + 'px';
      rootNode.style.setProperty('--x', point.x + 'px');
      rootNode.style.setProperty('--y', point.y + 'px');
    }

    function setLineGeometry(el, from, to) {
      var dx = to.x - from.x;
      var dy = to.y - from.y;
      el.setAttribute('d', 'M ' + from.x + ' ' + from.y + ' C ' +
        (from.x + dx * .34) + ' ' + (from.y + dy * .12) + ', ' +
        (from.x + dx * .72) + ' ' + (from.y + dy * .88) + ', ' +
        to.x + ' ' + to.y);
    }

    function line(from, to, kind, role, index) {
      var el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      el.setAttribute('class', 'map-line map-line--' + kind);
      el._mapFrom = { x: from.x, y: from.y };
      el._mapTo = { x: to.x, y: to.y };
      el._mapMotion = 0;
      if (role) el.setAttribute('data-map-line-role', role);
      linesHost.appendChild(el);
      if (typeof index !== 'number' || reducedMotion) {
        setLineGeometry(el, from, to);
        el._mapCurrentTo = { x: to.x, y: to.y };
        return el;
      }

      setLineGeometry(el, from, from);
      el._mapCurrentTo = { x: from.x, y: from.y };
      var delay = 140 + index * 164;
      var duration = 1640;
      window.setTimeout(function () {
        var motion = ++el._mapMotion;
        var started = performance.now();
        function stretch(now) {
          if (!el.isConnected || motion !== el._mapMotion) return;
          var progress = Math.min(1, (now - started) / duration);
          var eased = 1 - Math.pow(1 - progress, 3);
          var current = {
            x: from.x + (to.x - from.x) * eased,
            y: from.y + (to.y - from.y) * eased
          };
          el._mapCurrentTo = current;
          setLineGeometry(el, from, current);
          if (progress < 1) window.requestAnimationFrame(stretch);
        }
        window.requestAnimationFrame(stretch);
      }, delay);
      return el;
    }

    function retractLine(el) {
      if (!el || !el.isConnected) return;
      var from = el._mapFrom;
      var to = el._mapCurrentTo || el._mapTo;
      if (!from || !to || reducedMotion) {
        el.remove();
        return;
      }
      var motion = ++el._mapMotion;
      var started = performance.now();
      function retract(now) {
        if (!el.isConnected || motion !== el._mapMotion) return;
        var progress = Math.min(1, (now - started) / 1640);
        var eased = 1 - Math.pow(1 - progress, 3);
        var current = {
          x: to.x + (from.x - to.x) * eased,
          y: to.y + (from.y - to.y) * eased
        };
        el._mapCurrentTo = current;
        setLineGeometry(el, from, current);
        if (progress < 1) window.requestAnimationFrame(retract);
        else el.remove();
      }
      window.requestAnimationFrame(retract);
    }

    function createNode(kind, data, point, origin, index, onClick, role) {
      var interactive = onClick || data.expandable;
      var el = document.createElement(interactive ? 'button' : 'div');
      if (interactive) el.type = 'button';
      el.className = 'mind-node mind-node--' + kind;
      el.style.left = point.x + 'px';
      el.style.top = point.y + 'px';
      el.style.setProperty('--from-x', (origin.x - point.x) + 'px');
      el.style.setProperty('--from-y', (origin.y - point.y) + 'px');
      el.style.setProperty('--flight-rotate', ((index % 2 ? 1 : -1) * (1.4 + index * .16)).toFixed(2) + 'deg');
      if (role) el.setAttribute('data-map-role', role);
      if (data.icon) {
        var icon = document.createElement('i');
        icon.className = 'mind-node__icon';
        icon.setAttribute('data-icon', data.icon);
        icon.setAttribute('aria-hidden', 'true');
        el.appendChild(icon);
      }
      var label = document.createElement('span');
      label.textContent = data.label || '';
      var title = document.createElement('strong');
      title.textContent = data.title;
      var note = document.createElement('small');
      note._detailText = data.note || '';
      note.textContent = data.expandable ? '' : note._detailText;
      if (data.label) el.appendChild(label);
      el.appendChild(title);
      if (data.note) el.appendChild(note);
      if (onClick) el.addEventListener('click', onClick);
      if (data.expandable) {
        el.setAttribute('aria-expanded', 'false');
        el.setAttribute('aria-label', data.title + '. Открыть подробное описание');
        el.setAttribute('data-expandable', '');
        var close = document.createElement('span');
        close.className = 'mind-node__close';
        close.setAttribute('aria-hidden', 'true');
        close.textContent = '×';
        el.appendChild(close);
        el.addEventListener('click', function (event) {
          if (event.target.closest('.mind-node__close') && el.classList.contains('is-expanded')) {
            closeNodeDetail(true);
            return;
          }
          openNodeDetail(el, point, data.title);
        });
      }
      nodesHost.appendChild(el);
      window.setTimeout(function () { el.classList.add('is-visible'); }, 140 + index * 164);
      return el;
    }

    function typeNodeDetail(node) {
      var note = node.querySelector('small');
      if (!note) return;
      var detail = note._detailText || '';
      var currentRun = ++detailTypingRun;
      note.textContent = '';

      if (reducedMotion) {
        note.textContent = detail;
        return;
      }

      window.setTimeout(function () {
        if (currentRun !== detailTypingRun || detailedNode !== node) return;
        note.classList.add('is-typing');
        function type(position) {
          if (currentRun !== detailTypingRun || detailedNode !== node) return;
          note.textContent = detail.slice(0, position);
          if (position < detail.length) {
            window.setTimeout(function () { type(position + 1); }, 24);
            return;
          }
          note.classList.remove('is-typing');
        }
        type(0);
      }, 1180);
    }

    function stopNodeDetailTyping(node) {
      var currentRun = ++detailTypingRun;
      var note = node && node.querySelector('small');
      if (!note) return;
      note.classList.remove('is-typing');
      window.setTimeout(function () {
        if (currentRun === detailTypingRun) note.textContent = '';
      }, 620);
    }

    function openNodeDetail(node, point, title) {
      if (detailedNode === node) return;
      if (detailedNode) closeNodeDetail(false);
      detailReturnView = { left: viewport.scrollLeft, top: viewport.scrollTop };
      detailedNode = node;
      reactSpace();
      map.classList.add('has-expanded');
      viewport.classList.add('is-detail-focus');
      node.classList.add('is-expanded');
      node.setAttribute('aria-expanded', 'true');
      node.setAttribute('aria-label', title + '. Закрыть подробное описание');
      live.textContent = 'Открыто подробное описание: ' + title + '.';
      typeNodeDetail(node);
      window.setTimeout(function () { centerOn(point); }, 80);
    }

    function closeNodeDetail(restoreView) {
      if (!detailedNode) return;
      var node = detailedNode;
      reactSpace();
      var title = node.querySelector('strong');
      stopNodeDetailTyping(node);
      node.classList.remove('is-expanded');
      node.setAttribute('aria-expanded', 'false');
      node.setAttribute('aria-label', (title ? title.textContent : 'Пункт') + '. Открыть подробное описание');
      detailedNode = null;
      map.classList.remove('has-expanded');
      viewport.classList.remove('is-detail-focus');
      live.textContent = 'Подробное описание закрыто.';
      if (restoreView && detailReturnView) {
        moveCamera(detailReturnView.left, detailReturnView.top);
      }
      detailReturnView = null;
    }

    function clearDynamic(keepNode) {
      Array.prototype.forEach.call(nodesHost.querySelectorAll('.mind-node:not([data-map-root])'), function (node) {
        if (node === keepNode) return;
        node.classList.remove('is-visible');
        node.classList.add('is-leaving');
        window.setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 1700);
      });
      Array.prototype.forEach.call(linesHost.querySelectorAll('.map-line'), retractLine);
    }

    function removeRole(role) {
      Array.prototype.forEach.call(nodesHost.querySelectorAll('[data-map-role="' + role + '"]'), function (node) {
        node.classList.remove('is-visible');
        node.classList.add('is-leaving');
        window.setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 1700);
      });
      Array.prototype.forEach.call(linesHost.querySelectorAll('[data-map-line-role="' + role + '"]'), function (mapLine) {
        retractLine(mapLine);
      });
    }

    function setStageExtent(points) {
      var maxX = baseStage.width;
      var maxY = baseStage.height;
      points.forEach(function (point) {
        maxX = Math.max(maxX, point.x + 180);
        maxY = Math.max(maxY, point.y + 105);
      });
      stage.style.width = Math.ceil(maxX) + 'px';
      stage.style.height = Math.ceil(maxY) + 'px';
      linesHost.setAttribute('width', Math.ceil(maxX));
      linesHost.setAttribute('height', Math.ceil(maxY));
      linesHost.setAttribute('viewBox', '0 0 ' + Math.ceil(maxX) + ' ' + Math.ceil(maxY));
    }

    function pointBounds(points) {
      return points.reduce(function (bounds, point) {
        bounds.left = Math.min(bounds.left, point.x - 235);
        bounds.right = Math.max(bounds.right, point.x + 235);
        bounds.top = Math.min(bounds.top, point.y - 135);
        bounds.bottom = Math.max(bounds.bottom, point.y + 135);
        return bounds;
      }, { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity });
    }

    function calculatePanLimits(points) {
      var bounds = pointBounds(points);
      var padding = viewport.clientWidth <= 760 ? 42 : 86;
      var contentWidth = bounds.right - bounds.left;
      var contentHeight = bounds.bottom - bounds.top;
      var maximumStageLeft = Math.max(0, stage.offsetWidth - viewport.clientWidth);
      var maximumStageTop = Math.max(0, stage.offsetHeight - viewport.clientHeight);
      var fitsX = contentWidth + padding * 2 <= viewport.clientWidth;
      var fitsY = contentHeight + padding * 2 <= viewport.clientHeight;
      var centeredLeft = (bounds.left + bounds.right - viewport.clientWidth) / 2;
      var centeredTop = (bounds.top + bounds.bottom - viewport.clientHeight) / 2;
      return {
        left: Math.max(0, fitsX ? centeredLeft : bounds.left - padding),
        right: Math.min(maximumStageLeft, fitsX ? centeredLeft : bounds.right + padding - viewport.clientWidth),
        top: Math.max(0, fitsY ? centeredTop : bounds.top - padding),
        bottom: Math.min(maximumStageTop, fitsY ? centeredTop : bounds.bottom + padding - viewport.clientHeight),
        fits: fitsX && fitsY
      };
    }

    function limitPan(left, top) {
      if (!panLimits) return { left: left, top: top };
      return {
        left: Math.max(panLimits.left, Math.min(panLimits.right, left)),
        top: Math.max(panLimits.top, Math.min(panLimits.bottom, top))
      };
    }

    function updatePanState(points) {
      if (!points.length) return;
      panLimits = calculatePanLimits(points);
      viewport.classList.toggle('is-static', panLimits.fits);
      viewport.setAttribute('aria-label', panLimits.fits ? 'Интерактивная карта цифрового слоя' : 'Перемещаемая карта цифрового слоя');
    }

    function arePointsVisible(points) {
      var left = viewport.scrollLeft + 42;
      var right = viewport.scrollLeft + viewport.clientWidth - 42;
      var top = viewport.scrollTop + 72;
      var bottom = viewport.scrollTop + viewport.clientHeight - 72;
      return points.every(function (point) {
        return point.x - 138 >= left && point.x + 138 <= right && point.y - 62 >= top && point.y + 62 <= bottom;
      });
    }

    function focusNewNodes(points, anchor, force) {
      updatePanState(currentPoints);
      var focusPoints = anchor ? points.concat([anchor]) : points.slice();
      if (!force && arePointsVisible(focusPoints)) return;
      var bounds = pointBounds(focusPoints);
      var point = {
        x: (bounds.left + bounds.right) / 2,
        y: (bounds.top + bounds.bottom) / 2 - Math.min(32, viewport.clientHeight * .04)
      };
      centerOn(point);
    }

    function centerOn(point) {
      var left = Math.max(0, Math.min(stage.offsetWidth - viewport.clientWidth, point.x - viewport.clientWidth / 2));
      var top = Math.max(0, Math.min(stage.offsetHeight - viewport.clientHeight, point.y - viewport.clientHeight / 2));
      moveCamera(left, top);
    }

    function updateMapParallax() {
      var centerX = viewport.scrollLeft + viewport.clientWidth / 2;
      var centerY = viewport.scrollTop + viewport.clientHeight / 2;
      var offsetX = (centerX - rootPoint.x) * -.025 + pointerParallax.x;
      var offsetY = (centerY - rootPoint.y) * -.025 + pointerParallax.y;
      viewport.style.setProperty('--map-bg-x', offsetX.toFixed(2) + 'px');
      viewport.style.setProperty('--map-bg-y', offsetY.toFixed(2) + 'px');
      map.style.setProperty('--particle-x', (offsetX * -.42).toFixed(2) + 'px');
      map.style.setProperty('--particle-y', (offsetY * -.42).toFixed(2) + 'px');
    }

    function moveCamera(left, top) {
      var limited = limitPan(left, top);
      var targetLeft = limited.left;
      var targetTop = limited.top;
      var startLeft = viewport.scrollLeft;
      var startTop = viewport.scrollTop;
      var distance = Math.hypot(targetLeft - startLeft, targetTop - startTop);
      var currentRun = ++cameraRun;

      if (reducedMotion || distance < 2) {
        viewport.scrollLeft = targetLeft;
        viewport.scrollTop = targetTop;
        updateMapParallax();
        return;
      }

      var duration = Math.min(2300, 1650 + distance * .22);
      var started = performance.now();
      var direction = targetLeft >= startLeft ? 1 : -1;
      stage.style.transformOrigin = (startLeft + viewport.clientWidth / 2) + 'px ' + (startTop + viewport.clientHeight / 2) + 'px';
      map.classList.add('is-camera-moving');

      function fly(now) {
        if (currentRun !== cameraRun) return;
        var progress = Math.min(1, (now - started) / duration);
        var eased = progress * progress * progress * (progress * (progress * 6 - 15) + 10);
        var breath = Math.sin(progress * Math.PI);
        viewport.scrollLeft = startLeft + (targetLeft - startLeft) * eased;
        viewport.scrollTop = startTop + (targetTop - startTop) * eased;
        stage.style.setProperty('--camera-scale', (1 - breath * .016).toFixed(4));
        stage.style.setProperty('--camera-tilt', (direction * breath * .16).toFixed(3) + 'deg');
        stage.style.setProperty('--camera-saturation', (1 + breath * .13).toFixed(3));
        map.style.setProperty('--particle-reaction', breath.toFixed(3));
        updateMapParallax();
        if (progress < 1) {
          window.requestAnimationFrame(fly);
          return;
        }
        stage.style.setProperty('--camera-scale', '1');
        stage.style.setProperty('--camera-tilt', '0deg');
        stage.style.setProperty('--camera-saturation', '1');
        map.style.setProperty('--particle-reaction', '0');
        map.classList.remove('is-camera-moving');
      }

      window.requestAnimationFrame(fly);
    }

    function stopCameraMotion() {
      cameraRun += 1;
      stage.style.setProperty('--camera-scale', '1');
      stage.style.setProperty('--camera-tilt', '0deg');
      stage.style.setProperty('--camera-saturation', '1');
      map.style.setProperty('--particle-reaction', '0');
      map.classList.remove('is-camera-moving');
    }

    function reactSpace() {
      window.clearTimeout(spaceReactionTimer);
      map.classList.add('is-branching');
      spaceReactionTimer = window.setTimeout(function () { map.classList.remove('is-branching'); }, 1900);
    }

    function updateUi(nextState, pathText, helpText, announcement) {
      state = nextState;
      map.setAttribute('data-map-state', nextState);
      path.textContent = pathText;
      help.textContent = helpText;
      live.textContent = announcement;
      back.hidden = nextState === 'root';
      reset.hidden = nextState === 'root';
    }

    function showRoot() {
      reactSpace();
      closeNodeDetail(false);
      selected = null;
      selectedPoint = null;
      selectedNode = null;
      selectedDirection = { x: 1, y: 0 };
      questionPoint = null;
      branchPoint = null;
      benefitPoints = [];
      componentPoints = [];
      map.classList.remove('is-compact-detail');
      clearDynamic();
      setRootPosition(rootPoint);
      currentPoints = [rootPoint];
      setStageExtent(currentPoints);
      updatePanState(currentPoints);
      updateUi('root', 'Цифровой слой', 'Нажмите на центральный круг, чтобы раскрыть типы цифрового слоя.', 'Карта возвращена в начало.');
      centerOn(rootPoint);
    }

    function showCategories() {
      reactSpace();
      closeNodeDetail(false);
      selected = null;
      selectedPoint = null;
      selectedNode = null;
      selectedDirection = { x: 1, y: 0 };
      questionPoint = null;
      branchPoint = null;
      benefitPoints = [];
      componentPoints = [];
      map.classList.remove('is-compact-detail');
      clearDynamic();
      setRootPosition(rootPoint);
      currentPoints = [rootPoint].concat(categoryPositions);
      setStageExtent(currentPoints);
      catalog.forEach(function (item, index) {
        var point = categoryPositions[index];
        line(rootPoint, point, 'category', 'category', index);
        createNode('category', {
          title: item.title, note: item.note, icon: item.id
        }, point, rootPoint, index, function () { showBenefits(item, point, this); }, 'category');
      });
      updateUi('categories', 'Цифровой слой / Вокруг чего создаётся', 'Выберите объект, чтобы увидеть его ценность и возможный состав.', 'Открыто семь типов объектов цифрового слоя.');
      window.setTimeout(function () { focusNewNodes(categoryPositions, rootPoint, false); }, 240);
    }

    function showBenefits(item, point, node) {
      if ((state === 'benefits' || state === 'components') && node === selectedNode) {
        showCategories();
        return;
      }
      closeNodeDetail(false);
      reactSpace();
      selected = item;
      selectedPoint = point;
      selectedNode = node;
      selectedDirection = directionFromCenter(selectedPoint);
      var compact = viewport.clientWidth <= 760;
      map.classList.toggle('is-compact-detail', compact);
      clearDynamic(selectedNode);
      selectedNode.classList.add('is-selected');
      selectedNode.setAttribute('data-map-role', 'benefit-base');
      line(rootPoint, selectedPoint, 'category', 'benefit-base');

      var questionDistance = compact ? 145 : 230;
      questionPoint = offsetPoint(selectedPoint, selectedDirection, questionDistance, 0);
      benefitPoints = fanLayout(selectedPoint, selectedDirection, item.benefits.length, compact, false);
      var farthestBenefitDistance = compact
        ? 368 + Math.abs(selectedDirection.x) * 95
        : 588 + Math.abs(selectedDirection.x) * 172;
      var branchGap = compact ? 145 + Math.abs(selectedDirection.x) * 75 : 185 + Math.abs(selectedDirection.x) * 95;
      branchPoint = offsetPoint(selectedPoint, selectedDirection, farthestBenefitDistance + branchGap, 0);

      line(selectedPoint, questionPoint, 'benefit', 'benefit-question', 0);
      createNode('question', { title: 'Что даёт?' }, questionPoint, selectedPoint, 0, null, 'benefit-question');

      item.benefits.forEach(function (benefit, index) {
        var benefitPoint = benefitPoints[index];
        line(questionPoint, benefitPoint, 'benefit', 'benefit', index + 1);
        createNode('benefit', {
          title: benefit[0], note: benefit[1], expandable: true
        }, benefitPoint, questionPoint, index + 1, null, 'benefit');
      });

      line(questionPoint, branchPoint, 'component', 'component-branch', 6);
      createNode('branch', {
        title: 'Из чего состоит?', note: 'Раскрыть состав решения'
      }, branchPoint, questionPoint, 6, function () {
        if (state === 'components') hideComponents();
        else showComponents(item);
      }, 'component-branch');

      currentPoints = [rootPoint, selectedPoint, questionPoint].concat(benefitPoints, [branchPoint]);
      setStageExtent(currentPoints);
      updateUi('benefits', 'Цифровой слой / ' + item.title + ' / Что даёт', 'Изучите ценность и нажмите «Из чего состоит», чтобы раскрыть инструменты.', 'Открыта ценность цифрового слоя для категории «' + item.title + '».');
      window.setTimeout(function () { focusNewNodes([questionPoint].concat(benefitPoints, [branchPoint]), selectedPoint, false); }, 240);
    }

    function showComponents(item) {
      if (state === 'components') return;
      closeNodeDetail(false);
      reactSpace();
      componentPoints = fanLayout(branchPoint, selectedDirection, item.components.length, viewport.clientWidth <= 760, true);
      item.components.forEach(function (component, index) {
        var componentPoint = componentPoints[index];
        line(branchPoint, componentPoint, 'component', 'component', index);
        createNode('component', {
          title: component[0], note: component[1], expandable: true
        }, componentPoint, branchPoint, index, null, 'component');
      });
      currentPoints = currentPoints.concat(componentPoints);
      setStageExtent(currentPoints);
      updateUi('components', 'Цифровой слой / ' + item.title + ' / Состав решения', 'Карта раскрыта полностью. Если она шире экрана, её можно двигать.', 'Открыт состав цифрового слоя для категории «' + item.title + '».');
      window.setTimeout(function () { focusNewNodes(componentPoints, branchPoint, false); }, 180);
    }

    function hideComponents() {
      closeNodeDetail(false);
      reactSpace();
      removeRole('component');
      componentPoints = [];
      currentPoints = [rootPoint, selectedPoint, questionPoint].concat(benefitPoints, [branchPoint]);
      setStageExtent(currentPoints);
      updateUi('benefits', 'Цифровой слой / ' + selected.title + ' / Что даёт', 'Изучите ценность и нажмите «Из чего состоит», чтобы раскрыть инструменты.', 'Показан предыдущий уровень карты.');
      window.setTimeout(function () { focusNewNodes([questionPoint].concat(benefitPoints, [branchPoint]), selectedPoint, true); }, 160);
    }

    rootNode.addEventListener('click', function () {
      if (detailedNode) closeNodeDetail(true);
      else if (state === 'root') showCategories();
      else if (state === 'categories') showRoot();
      else showCategories();
    });
    back.addEventListener('click', function () {
      if (detailedNode) closeNodeDetail(true);
      else if (state === 'components' && selected) hideComponents();
      else if (state === 'benefits') showCategories();
      else showRoot();
    });
    reset.addEventListener('click', function () {
      showRoot();
      releaseMapSpace();
      document.dispatchEvent(new CustomEvent('digital-intro:return'));
    });

    function collapsePreviousStep() {
      if (detailedNode) closeNodeDetail(true);
      else if (state === 'components' && selected) hideComponents();
      else if (state === 'benefits') showCategories();
      else if (state === 'categories') showRoot();
    }

    var drag = null;
    var suppressCanvasClick = false;
    viewport.addEventListener('pointerdown', function (event) {
      if (viewport.classList.contains('is-static') || event.target.closest('button, a, input, select, textarea')) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (event.pointerType !== 'mouse') event.preventDefault();
      stopCameraMotion();
      drag = { x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop, moved: false };
      viewport.setPointerCapture(event.pointerId);
    });
    viewport.addEventListener('pointermove', function (event) {
      var box = viewport.getBoundingClientRect();
      pointerParallax.x = ((event.clientX - box.left) / Math.max(1, box.width) - .5) * 14;
      pointerParallax.y = ((event.clientY - box.top) / Math.max(1, box.height) - .5) * 10;
      updateMapParallax();
      if (!drag) return;
      if (Math.abs(event.clientX - drag.x) + Math.abs(event.clientY - drag.y) > 7) drag.moved = true;
      var limited = limitPan(drag.left - (event.clientX - drag.x), drag.top - (event.clientY - drag.y));
      viewport.scrollLeft = limited.left;
      viewport.scrollTop = limited.top;
    });
    viewport.addEventListener('pointerleave', function () {
      pointerParallax = { x: 0, y: 0 };
      updateMapParallax();
    });
    viewport.addEventListener('pointerup', function () {
      if (drag && drag.moved) {
        suppressCanvasClick = true;
        window.setTimeout(function () { suppressCanvasClick = false; }, 0);
      }
      drag = null;
    });
    viewport.addEventListener('pointercancel', function () { drag = null; });
    viewport.addEventListener('click', function (event) {
      if (suppressCanvasClick || event.target.closest('.mind-node')) return;
      collapsePreviousStep();
    });
    viewport.addEventListener('scroll', function () {
      if (!enforcingPan) {
        var limited = limitPan(viewport.scrollLeft, viewport.scrollTop);
        if (Math.abs(limited.left - viewport.scrollLeft) > .5 || Math.abs(limited.top - viewport.scrollTop) > .5) {
          enforcingPan = true;
          viewport.scrollLeft = limited.left;
          viewport.scrollTop = limited.top;
          enforcingPan = false;
        }
      }
      updateMapParallax();
    }, { passive: true });
    viewport.addEventListener('keydown', function (event) {
      if (viewport.classList.contains('is-static')) return;
      var moves = { ArrowLeft: [-90, 0], ArrowRight: [90, 0], ArrowUp: [0, -90], ArrowDown: [0, 90] };
      if (!moves[event.key]) return;
      event.preventDefault();
      moveCamera(viewport.scrollLeft + moves[event.key][0], viewport.scrollTop + moves[event.key][1]);
    });

    var mapSection = map.closest('#s03');
    var mapLocked = false;
    var releaseUntil = 0;
    var lockTicking = false;

    function setMapLocked(locked) {
      mapLocked = locked;
      document.documentElement.classList.toggle('map-space-locked', locked);
    }

    function releaseMapSpace() {
      releaseUntil = Date.now() + 2200;
      setMapLocked(false);
    }

    function evaluateMapLock() {
      lockTicking = false;
      if (!mapSection || mapLocked || Date.now() < releaseUntil) return;
      var box = mapSection.getBoundingClientRect();
      var visible = Math.max(0, Math.min(window.innerHeight, box.bottom) - Math.max(0, box.top));
      var ratio = visible / Math.min(window.innerHeight, box.height);
      if (ratio < .92) return;
      mapSection.scrollIntoView({ block: 'start', behavior: reducedMotion ? 'auto' : 'smooth' });
      setMapLocked(true);
    }

    function requestMapLock() {
      if (lockTicking) return;
      lockTicking = true;
      window.requestAnimationFrame(evaluateMapLock);
    }

    document.addEventListener('digital-map:entered', function () {
      if (!mapSection) return;
      setMapLocked(true);
      window.setTimeout(function () { centerOn(rootPoint); }, 80);
    });

    window.addEventListener('scroll', requestMapLock, { passive: true });
    window.addEventListener('resize', requestMapLock);
    window.addEventListener('wheel', function (event) {
      if (!mapLocked || event.target.closest('.chapter-nav, .project-dialog')) return;
      event.preventDefault();
      if (viewport.classList.contains('is-static')) return;
      stopCameraMotion();
      var horizontalRoom = viewport.scrollWidth - viewport.clientWidth;
      var verticalRoom = viewport.scrollHeight - viewport.clientHeight;
      var horizontalDelta = event.deltaX;
      var verticalDelta = event.deltaY;
      if (Math.abs(horizontalDelta) < Math.abs(verticalDelta) && horizontalRoom > verticalRoom) {
        horizontalDelta += verticalDelta;
        verticalDelta = 0;
      }
      var limited = limitPan(viewport.scrollLeft + horizontalDelta, viewport.scrollTop + verticalDelta);
      viewport.scrollLeft = limited.left;
      viewport.scrollTop = limited.top;
    }, { passive: false, capture: true });

    document.addEventListener('keydown', function (event) {
      if (!mapLocked || event.target.closest('input, textarea, select, button, a')) return;
      var moves = {
        ArrowLeft: [-90, 0], ArrowRight: [90, 0], ArrowUp: [0, -90], ArrowDown: [0, 90],
        PageUp: [0, -260], PageDown: [0, 260], Home: [-320, 0], End: [320, 0], ' ': [0, 220]
      };
      if (!moves[event.key]) return;
      event.preventDefault();
      if (!viewport.classList.contains('is-static')) {
        moveCamera(viewport.scrollLeft + moves[event.key][0], viewport.scrollTop + moves[event.key][1]);
      }
    });

    document.addEventListener('click', function (event) {
      if (!mapLocked) return;
      var link = event.target.closest('a[href^="#"]');
      if (!link || link.getAttribute('href') === '#s03') return;
      releaseMapSpace();
    });
    window.addEventListener('hashchange', function () {
      if (window.location.hash && window.location.hash !== '#s03') releaseMapSpace();
    });

    window.addEventListener('resize', function () { updatePanState(currentPoints); });
    currentPoints = [rootPoint];
    setStageExtent(currentPoints);
    updatePanState(currentPoints);
    window.setTimeout(function () { centerOn(rootPoint); }, 120);
    window.setTimeout(requestMapLock, 180);
  }

  var menuToggle = document.getElementById('siteMenuToggle');
  var siteMenu = document.getElementById('siteMenu');
  var menuScrim = document.getElementById('siteMenuScrim');

  function setMenu(open) {
    if (!menuToggle || !siteMenu) return;
    document.documentElement.classList.toggle('site-menu-open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    if (menuScrim) menuScrim.setAttribute('aria-hidden', String(!open));
    if (open) {
      var firstLink = siteMenu.querySelector('a');
      if (firstLink) window.setTimeout(function () { firstLink.focus(); }, 120);
    }
  }

  if (menuToggle && siteMenu) {
    menuToggle.addEventListener('click', function () {
      setMenu(menuToggle.getAttribute('aria-expanded') !== 'true');
    });
    if (menuScrim) menuScrim.addEventListener('click', function () { setMenu(false); });
    siteMenu.addEventListener('click', function (event) {
      if (event.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') {
        setMenu(false);
        menuToggle.focus();
      }
    });
  }

  var introSection = document.getElementById('intro');
  var introNavLink = siteMenu && siteMenu.querySelector('[data-section="intro"]');
  function updateIntroNavigation() {
    if (!introSection || !introNavLink || !siteMenu) return;
    var box = introSection.getBoundingClientRect();
    var marker = window.innerHeight * .45;
    var transitionEnd = Math.max(1, introSection.offsetHeight - window.innerHeight);
    if (box.top > marker || box.bottom < marker || -box.top >= transitionEnd - 2) return;
    Array.prototype.forEach.call(siteMenu.querySelectorAll('a[data-section]'), function (link) {
      var active = link === introNavLink;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  }
  if (introSection) {
    window.addEventListener('scroll', updateIntroNavigation, { passive: true });
    window.addEventListener('resize', updateIntroNavigation);
    updateIntroNavigation();
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
