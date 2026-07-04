/* ============================================================
   PLAYDISPLAY — интерактив и эффекты
   ============================================================ */

document.body.classList.remove('no-js');
gsap.registerPlugin(ScrollTrigger);

const isTouch = matchMedia('(hover: none)').matches;
const isMobile = () => innerWidth <= 960;

/* ---------- 1. Прелоадер ---------- */
(function preloader() {
  const el = document.querySelector('.preloader');
  const count = el.querySelector('.pl-count');
  const bar = el.querySelector('.pl-bar i');
  let p = 0;

  const tick = () => {
    p = Math.min(100, p + Math.random() * 16 + 4);
    count.textContent = Math.floor(p).toString().padStart(3, '0') + ' %';
    bar.style.width = p + '%';
    if (p < 100) setTimeout(tick, 90 + Math.random() * 120);
    else finish();
  };

  const finish = () => {
    gsap.timeline()
      .to(el.children, { y: -30, opacity: 0, stagger: .08, duration: .4, ease: 'power2.in' })
      .to(el, { yPercent: -100, duration: .7, ease: 'power4.inOut' }, '-=.1')
      .set(el, { display: 'none' })
      .add(heroIntro, '-=.5');
  };

  setTimeout(tick, 300);
})();

/* ---------- 2. Появление hero ---------- */
function heroIntro() {
  const tl = gsap.timeline()
    .from('.hero-tag', { x: -40, opacity: 0, duration: .6, ease: 'power3.out' });

  if (document.body.classList.contains('led-on')) {
    tl.add(() => ledHero.ignite(), '-=.2'); // LED-стена зажигается волной
  } else {
    tl.from('.hero h1 .line > span', {
      yPercent: 110, duration: .9, stagger: .12, ease: 'power4.out'
    }, '-=.3');
  }

  tl.from('.hero-sub, .hero-cta', {
      y: 30, opacity: 0, stagger: .15, duration: .7, ease: 'power3.out'
    }, '-=.3')
    .from('.hero-meta', { opacity: 0, duration: .8 }, '-=.3');

  document.querySelectorAll('[data-scramble]').forEach((el, i) => {
    setTimeout(() => scramble(el), 600 + i * 200);
  });
}

/* ---------- 3. Эффект расшифровки текста ---------- */
function scramble(el, text) {
  const chars = '!<>-_\\/[]{}—=+*^?#01';
  const original = text || el.dataset.scramble || el.textContent;
  // токен отменяет предыдущий незавершённый scramble на этом же элементе
  const token = (el._scrToken = (el._scrToken || 0) + 1);
  let frame = 0;
  const total = original.length * 3;

  const update = () => {
    if (el._scrToken !== token) return; // запущен новый — выходим
    let out = '';
    for (let i = 0; i < original.length; i++) {
      if (i < frame / 3) out += original[i];
      else out += chars[Math.floor(Math.random() * chars.length)];
    }
    el.textContent = out;
    if (frame++ < total) requestAnimationFrame(update);
    else el.textContent = original;
  };
  update();
}

/* ---------- 4. Кастомный курсор ---------- */
(function cursor() {
  if (isTouch) return;
  const dot = document.querySelector('.cursor-dot');
  const ring = document.querySelector('.cursor-ring');
  let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;

  addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });

  (function loop() {
    rx += (mx - rx) * .16;
    ry += (my - ry) * .16;
    dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%,-50%)`;
    ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%,-50%)`;
    requestAnimationFrame(loop);
  })();

  document.querySelectorAll('a, button, .hashtags span').forEach(el => {
    el.addEventListener('mouseenter', () => ring.classList.add('is-hover'));
    el.addEventListener('mouseleave', () => ring.classList.remove('is-hover'));
  });
  document.querySelectorAll('.t-card').forEach(el => {
    el.addEventListener('mouseenter', () => ring.classList.add('is-view'));
    el.addEventListener('mouseleave', () => ring.classList.remove('is-view'));
  });
})();

/* ---------- 5. LED-стена в hero: заголовок из светящихся пикселей ---------- */
const ledHero = (function () {
  const canvas = document.getElementById('particles');
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  const hero = canvas.parentElement;
  const h1 = hero.querySelector('h1');
  const mouse = { x: -9999, y: -9999 };
  let dots = [], W = 0, H = 0, R = 3;
  const state = { ignition: isTouch ? 1 : 0 };

  // цвета строк: белый / светло-зелёный / кислотный
  const LINE_COLORS = [[242, 255, 245], [157, 255, 184], [62, 224, 110]];

  function build() {
    W = canvas.width = hero.offsetWidth;
    H = canvas.height = hero.offsetHeight;
    const GAP = Math.max(7, Math.round(W / 150));
    R = GAP * 0.34;

    // рисуем текст h1 в offscreen-канвас и сэмплируем в LED-точки
    const heroRect = hero.getBoundingClientRect();
    const spans = h1.querySelectorAll('.line > span');
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const octx = off.getContext('2d', { willReadFrequently: true });
    const meta = [];

    spans.forEach((sp, i) => {
      const r = sp.getBoundingClientRect();
      const fs = r.height * 0.82;
      octx.font = `800 ${fs}px Unbounded, sans-serif`;
      octx.textBaseline = 'middle';
      octx.fillStyle = '#fff';
      octx.fillText(sp.textContent, r.left - heroRect.left, r.top - heroRect.top + r.height / 2);
      meta.push({
        top: r.top - heroRect.top,
        bottom: r.bottom - heroRect.top,
        color: LINE_COLORS[i] || LINE_COLORS[2]
      });
    });

    const data = octx.getImageData(0, 0, W, H).data;
    dots = [];
    for (let gy = GAP / 2; gy < H; gy += GAP) {
      for (let gx = GAP / 2; gx < W; gx += GAP) {
        const a = data[(Math.floor(gy) * W + Math.floor(gx)) * 4 + 3];
        if (a > 100) {
          const m = meta.find(m => gy >= m.top && gy <= m.bottom) || meta[meta.length - 1];
          dots.push({ x: gx, y: gy, c: m.color, text: true, b: 0, fl: 1 + Math.random() * 3 });
        } else if (Math.random() < 0.05) {
          // редкие фоновые пиксели — LED-стена дышит
          dots.push({ x: gx, y: gy, c: [62, 224, 110], text: false, b: 0, fl: 1 + Math.random() * 3 });
        }
      }
    }
  }

  hero.addEventListener('mousemove', e => {
    const b = canvas.getBoundingClientRect();
    mouse.x = e.clientX - b.left;
    mouse.y = e.clientY - b.top;
  });
  hero.addEventListener('mouseleave', () => { mouse.x = -9999; mouse.y = -9999; });

  let visible = true;
  new IntersectionObserver(e => { visible = e[0].isIntersecting; }).observe(hero);

  let t = 0;
  (function draw() {
    requestAnimationFrame(draw);
    if (!visible || !dots.length) return;
    t += 0.05;
    ctx.clearRect(0, 0, W, H);
    const igniteX = state.ignition * W * 1.3;

    for (const d of dots) {
      let target = d.text ? 0.9 : 0.13;
      target *= 0.82 + 0.18 * Math.sin(t * d.fl + d.x); // мерцание диодов
      if (d.x > igniteX) target = 0;                     // волна включения

      const dx = d.x - mouse.x, dy = d.y - mouse.y;
      const dist2 = dx * dx + dy * dy;
      const boost = dist2 < 26000 ? 1 - Math.sqrt(dist2) / 161 : 0;

      d.b += (Math.min(1.3, target + boost * (d.text ? 0.5 : 0.85)) - d.b) * 0.14;
      if (d.b < 0.02) continue;

      ctx.beginPath();
      ctx.arc(d.x, d.y, R * (d.text ? 1 : 0.62) * (1 + boost * 0.5), 0, 6.284);
      ctx.fillStyle = `rgba(${d.c[0]},${d.c[1]},${d.c[2]},${d.b})`;
      ctx.fill();
    }
  })();

  addEventListener('resize', () => document.fonts.ready.then(build));
  document.fonts.ready.then(build);

  return {
    ignite: () => gsap.to(state, { ignition: 1, duration: 1.8, ease: 'power2.inOut' })
  };
})();
if (ledHero && !isTouch) document.body.classList.add('led-on');

/* ---------- 6. Шапка: скрытие и фон ---------- */
(function header() {
  const h = document.querySelector('.site-header');
  let last = 0;
  addEventListener('scroll', () => {
    const y = scrollY;
    h.classList.toggle('scrolled', y > 60);
    h.classList.toggle('hidden', y > last && y > 300);
    last = y;
  }, { passive: true });
})();

/* ---------- 7. Мобильное меню ---------- */
(function menu() {
  const burger = document.querySelector('.burger');
  const menu = document.querySelector('.mobile-menu');
  burger.addEventListener('click', () => {
    burger.classList.toggle('open');
    menu.classList.toggle('open');
  });
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    burger.classList.remove('open');
    menu.classList.remove('open');
  }));
})();

/* ---------- 8. Проекты: полёт сквозь 3D-туннель ---------- */
(function tunnel() {
  const sec = document.querySelector('.projects-sec');
  const stage = document.querySelector('.tunnel-stage');
  if (!stage) return;

  if (isMobile()) { sec.classList.add('flat'); return; }

  const world = stage.querySelector('.tunnel-world');
  const cards = gsap.utils.toArray('.t-card');
  const grids = stage.querySelectorAll('.t-grid');
  const hudIdx = stage.querySelector('.hud-idx');
  const hudTitle = stage.querySelector('.hud-title');
  const bar = stage.querySelector('.projects-progress i');

  const N = cards.length;
  const SP = 560;              // расстояние между проектами по глубине
  const LEAD = 750;            // разгон до первой карточки
  const EXIT = 40;             // финал: последняя карточка остаётся в кадре
  const DEPTH = LEAD + (N - 1) * SP + EXIT;

  // раскладка: карточки чередуются слева / справа / по центру
  const X = [-24, 24, 0, -26, 26];
  const Y = [-6, 8, -12, 10, 2];
  const layout = cards.map((c, i) => ({
    el: c,
    x: X[i % X.length],
    y: Y[i % Y.length],
    z: -(LEAD + i * SP),
    tilt: X[i % X.length] === 0 ? 0 : (X[i % X.length] < 0 ? 10 : -10)
  }));
  // финальная карточка — по центру, чистый финал полёта
  const last = layout[N - 1];
  last.x = 0; last.y = 0; last.tilt = 0;

  let progress = 0, mx = 0, my = 0, smx = 0, smy = 0;

  ScrollTrigger.create({
    trigger: stage,
    start: 'top top',
    end: '+=' + N * 650,
    pin: true,
    scrub: 1,
    onUpdate: s => {
      progress = s.progress;
      if (bar) bar.style.width = (s.progress * 100) + '%';
    }
  });

  stage.addEventListener('mousemove', e => {
    const r = stage.getBoundingClientRect();
    mx = (e.clientX - r.left) / r.width - .5;
    my = (e.clientY - r.top) / r.height - .5;
  });
  stage.addEventListener('mouseleave', () => { mx = 0; my = 0; });

  let lastIdx = -1, lastCam = -1;

  (function frame() {
    const camZ = progress * DEPTH;

    // ничего не изменилось — пропускаем кадр (экономим CPU)
    if (Math.abs(camZ - lastCam) < .05 &&
        Math.abs(mx - smx) < .002 && Math.abs(my - smy) < .002) {
      requestAnimationFrame(frame);
      return;
    }
    lastCam = camZ;

    // лёгкий параллакс всей сцены за мышью
    smx += (mx - smx) * .06;
    smy += (my - smy) * .06;
    world.style.transform = `rotateY(${smx * 7}deg) rotateX(${-smy * 5}deg)`;

    // сетка пола/потолка "едет" под камерой (transform — без перерисовки)
    const gShift = camZ % 140;
    grids[0].style.transform = `translate(-50%,-50%) rotateX(90deg) translateZ(-46svh) translateY(${gShift}px)`;
    grids[1].style.transform = `translate(-50%,-50%) rotateX(90deg) translateZ(46svh) translateY(${gShift}px)`;

    for (const c of layout) {
      const rel = c.z + camZ;
      const fadeIn = gsap.utils.clamp(0, 1, (rel + 3800) / 900);
      const fadeOut = rel < 40 ? 1 : gsap.utils.clamp(0, 1, 1 - (rel - 40) / 240);
      const o = fadeIn * fadeOut;
      c.el.style.opacity = o;
      c.el.style.pointerEvents = (o > .5 && rel > -2200) ? 'auto' : 'none';
      c.el.style.transform =
        `translate(-50%,-50%) translate3d(${c.x}vw, ${c.y}svh, ${rel}px) rotateY(${c.tilt}deg)`;
    }

    // HUD: ближайший проект
    const idx = gsap.utils.clamp(0, N - 1, Math.round((camZ - LEAD) / SP));
    if (idx !== lastIdx) {
      lastIdx = idx;
      if (hudIdx) hudIdx.textContent = String(idx + 1).padStart(2, '0') + ' / ' + N;
      if (hudTitle) scramble(hudTitle, cards[idx].dataset.title);
    }

    requestAnimationFrame(frame);
  })();
})();

/* ---------- 9. Reveal-анимации ---------- */
gsap.utils.toArray('.reveal').forEach(el => {
  gsap.to(el, {
    opacity: 1, y: 0,
    duration: .9,
    ease: 'power3.out',
    scrollTrigger: { trigger: el, start: 'top 86%' }
  });
});

/* ---------- 10. Счётчики ---------- */
gsap.utils.toArray('.stat .value b').forEach(el => {
  const target = +el.dataset.count;
  ScrollTrigger.create({
    trigger: el,
    start: 'top 88%',
    once: true,
    onEnter: () => {
      gsap.fromTo(el, { innerText: 0 }, {
        innerText: target,
        duration: 1.8,
        ease: 'power2.out',
        snap: { innerText: 1 }
      });
    }
  });
});

/* ---------- 11. 3D-наклон карточек услуг ---------- */
if (!isTouch) {
  document.querySelectorAll('.service').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5;
      const y = (e.clientY - r.top) / r.height - .5;
      gsap.to(card, { rotateY: x * 8, rotateX: -y * 8, duration: .4, transformPerspective: 700 });
    });
    card.addEventListener('mouseleave', () => {
      gsap.to(card, { rotateX: 0, rotateY: 0, duration: .6, ease: 'elastic.out(1, .5)' });
    });
  });
}

/* ---------- 12. Магнитные кнопки ---------- */
if (!isTouch) {
  document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('mousemove', e => {
      const r = btn.getBoundingClientRect();
      gsap.to(btn, {
        x: (e.clientX - r.left - r.width / 2) * .25,
        y: (e.clientY - r.top - r.height / 2) * .35,
        duration: .3
      });
    });
    btn.addEventListener('mouseleave', () => {
      gsap.to(btn, { x: 0, y: 0, duration: .5, ease: 'elastic.out(1, .4)' });
    });
  });
}

/* ---------- 13. Плавные якоря ---------- */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth' });
  });
});

/* ---------- 13b. Work: фильтр кейсов по задачам ---------- */
(function workFilter() {
  const btns = document.querySelectorAll('.f-btn');
  const cases = document.querySelectorAll('.case');
  if (!btns.length) return;
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const f = btn.dataset.f;
      cases.forEach(c => {
        const show = f === 'all' || c.dataset.cat === f;
        c.classList.toggle('hidden', !show);
        if (show) gsap.fromTo(c, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: .5, ease: 'power2.out' });
      });
      ScrollTrigger.refresh(); // высота сетки изменилась — пересчёт пина туннеля
    });
  });
})();

/* ---------- 14. Форма ---------- */
const form = document.querySelector('.contact-form');
if (form) {
  form.addEventListener('submit', e => {
    e.preventDefault();
    const btn = form.querySelector('.btn');
    btn.textContent = '> отправлено_';
    setTimeout(() => {
      alert('Спасибо! Форма пока не подключена к серверу — напишите нам: info@playdisplay.com');
      btn.textContent = '> отправить запрос';
    }, 400);
  });
}

/* ---------- 15. Объёмный параллакс в hero ---------- */
if (!isTouch) {
  const hero = document.querySelector('.hero');
  const ledOn = document.body.classList.contains('led-on');
  const layers = [
    { el: document.querySelector('.hero-tag'), d: 14 },
    ledOn ? null : { el: document.querySelector('.hero h1'), d: 30 },
    { el: document.querySelector('.hero-sub'), d: 20 },
    { el: document.querySelector('.hero-cta'), d: 12 }
  ].filter(l => l && l.el);
  let on = false, hx = 0, hy = 0, shx = 0, shy = 0;
  setTimeout(() => on = true, 4200); // ждём окончания интро-анимаций

  hero.addEventListener('mousemove', e => {
    hx = e.clientX / innerWidth - .5;
    hy = e.clientY / innerHeight - .5;
  });
  hero.addEventListener('mouseleave', () => { hx = 0; hy = 0; });

  (function pl() {
    if (on) {
      shx += (hx - shx) * .05;
      shy += (hy - shy) * .05;
      for (const l of layers) {
        l.el.style.transform = `translate3d(${-shx * l.d}px, ${-shy * l.d}px, 0)`;
      }
    }
    requestAnimationFrame(pl);
  })();
}

/* ---------- 16. Заголовки секций: scramble при появлении ---------- */
gsap.utils.toArray('.sec-head h2').forEach(el => {
  ScrollTrigger.create({
    trigger: el,
    start: 'top 85%',
    once: true,
    onEnter: () => scramble(el)
  });
});
