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
  gsap.timeline()
    .from('.hero-tag', { x: -40, opacity: 0, duration: .6, ease: 'power3.out' })
    .from('.hero h1 .line > span', {
      yPercent: 110, duration: .9, stagger: .12, ease: 'power4.out'
    }, '-=.3')
    .from('.hero-sub, .hero-cta', {
      y: 30, opacity: 0, stagger: .15, duration: .7, ease: 'power3.out'
    }, '-=.5')
    .from('.hero-meta', { opacity: 0, duration: .8 }, '-=.3');

  document.querySelectorAll('[data-scramble]').forEach((el, i) => {
    setTimeout(() => scramble(el), 600 + i * 200);
  });
}

/* ---------- 3. Эффект расшифровки текста ---------- */
function scramble(el) {
  const chars = '!<>-_\\/[]{}—=+*^?#01';
  const original = el.dataset.scramble || el.textContent;
  let frame = 0;
  const total = original.length * 3;

  const update = () => {
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

/* ---------- 5. Частицы в hero ---------- */
(function particles() {
  const canvas = document.getElementById('particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, pts = [];
  const mouse = { x: -9999, y: -9999 };
  const N = isTouch ? 45 : 90;

  const resize = () => {
    W = canvas.width = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  };
  resize();
  addEventListener('resize', resize);

  for (let i = 0; i < N; i++) {
    pts.push({
      x: Math.random() * innerWidth,
      y: Math.random() * innerHeight,
      vx: (Math.random() - .5) * .4,
      vy: (Math.random() - .5) * .4,
      r: Math.random() * 1.6 + .6
    });
  }

  canvas.parentElement.addEventListener('mousemove', e => {
    const b = canvas.getBoundingClientRect();
    mouse.x = e.clientX - b.left;
    mouse.y = e.clientY - b.top;
  });
  canvas.parentElement.addEventListener('mouseleave', () => {
    mouse.x = -9999; mouse.y = -9999;
  });

  (function draw() {
    ctx.clearRect(0, 0, W, H);

    for (const p of pts) {
      const dx = p.x - mouse.x, dy = p.y - mouse.y;
      const d = Math.hypot(dx, dy);
      if (d < 140 && d > 0) {
        p.vx += (dx / d) * .25;
        p.vy += (dy / d) * .25;
      }
      p.vx *= .96; p.vy *= .96;
      p.vx += (Math.random() - .5) * .02;
      p.vy += (Math.random() - .5) * .02;
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(62, 224, 110, .7)';
      ctx.fill();
    }

    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i], b = pts[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 130) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(62, 224, 110, ${.14 * (1 - d / 130)})`;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  })();
})();

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
  const EXIT = 220;            // вылет за последнюю
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

  let lastIdx = -1;

  (function frame() {
    const camZ = progress * DEPTH;

    // лёгкий параллакс всей сцены за мышью
    smx += (mx - smx) * .06;
    smy += (my - smy) * .06;
    world.style.transform = `rotateY(${smx * 7}deg) rotateX(${-smy * 5}deg)`;

    // сетка пола/потолка "едет" под камерой
    grids.forEach(g => { g.style.backgroundPosition = `0px ${camZ}px, 0px ${camZ}px`; });

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
      if (hudTitle) {
        hudTitle.textContent = cards[idx].dataset.title;
        scramble(hudTitle);
      }
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
  const layers = [
    { el: document.querySelector('.hero-tag'), d: 14 },
    { el: document.querySelector('.hero h1'), d: 30 },
    { el: document.querySelector('.hero-sub'), d: 20 },
    { el: document.querySelector('.hero-cta'), d: 12 }
  ].filter(l => l.el);
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
