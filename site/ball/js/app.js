(() => {
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches || window.matchMedia('(any-pointer: fine)').matches;
  const targets = [...document.querySelectorAll('.reveal, .chapter-copy > *, .diagram, .art-frame')];

  root.classList.add('js');

  if (!reduced && finePointer) {
    root.classList.add('cursor-light');

    const point = { x: innerWidth * .5, y: innerHeight * .5 };
    const light = { ...point };
    const core = { ...point };
    const copyItems = [...document.querySelectorAll('.chapter-copy h2, .chapter-copy .pull')];
    const imageItems = [...document.querySelectorAll('.art-surface--image img')];
    const attractionTargets = [...document.querySelectorAll('[data-brand-logo], [data-particle-attract], .chapter-copy h2, .art-title')];
    const particleField = document.getElementById('brandParticles');
    const particles = [];
    let animationFrame = 0;
    let lastParticleBurst = 0;

    copyItems.forEach((item, index) => {
      item.classList.add('parallax-copy');
      item.dataset.depth = String(.5 + (index % 3) * .22);
    });

    if (particleField) {
      for (let index = 0; index < 58; index += 1) {
        const particle = document.createElement('i');
        particle.className = 'brand-particle';
        particle.style.width = `${2 + Math.random() * 3}px`;
        particle.style.height = particle.style.width;
        particleField.append(particle);
        particles.push(particle);
      }
    }

    const burstIntoCursor = () => {
      const now = performance.now();
      if (!particles.length || now - lastParticleBurst < 340) return;

      const activeTarget = attractionTargets.find((target) => {
        const box = target.getBoundingClientRect();
        const closestX = Math.max(box.left, Math.min(point.x, box.right));
        const closestY = Math.max(box.top, Math.min(point.y, box.bottom));
        return Math.hypot(point.x - closestX, point.y - closestY) < Math.min(220, Math.max(120, box.height * .7));
      });
      if (!activeTarget) return;

      lastParticleBurst = now;
      const box = activeTarget.getBoundingClientRect();
      particles.forEach((particle, index) => {
        const angle = (Math.PI * 2 * index) / particles.length + Math.random() * .38;
        const radius = 14 + Math.random() * Math.min(240, Math.max(box.width, box.height) * .42);
        const startX = box.left + box.width * (.06 + Math.random() * .88) + Math.cos(angle) * radius;
        const startY = box.top + box.height * (.14 + Math.random() * .72) + Math.sin(angle) * radius;
        particle.classList.remove('is-flying');
        particle.style.transitionDuration = '0ms';
        particle.style.transform = `translate3d(${startX}px, ${startY}px, 0) scale(.75)`;
        requestAnimationFrame(() => {
          particle.style.transitionDuration = `${500 + Math.random() * 280}ms`;
          particle.classList.add('is-flying');
          particle.style.transform = `translate3d(${point.x}px, ${point.y}px, 0) scale(.15)`;
        });
      });
    };

    const tick = () => {
      core.x += (point.x - core.x) * .34;
      core.y += (point.y - core.y) * .34;
      light.x += (point.x - light.x) * .085;
      light.y += (point.y - light.y) * .085;
      root.style.setProperty('--core-x', `${core.x}px`);
      root.style.setProperty('--core-y', `${core.y}px`);
      root.style.setProperty('--light-x', `${light.x}px`);
      root.style.setProperty('--light-y', `${light.y}px`);
      animationFrame = requestAnimationFrame(tick);
    };

    const move = (event) => {
      point.x = event.clientX;
      point.y = event.clientY;
      root.classList.add('cursor-ready');
      const relativeX = (point.x / innerWidth - .5) * 2;
      const relativeY = (point.y / innerHeight - .5) * 2;
      copyItems.forEach((item) => {
        const depth = Number(item.dataset.depth || 1);
        item.style.setProperty('--parallax-x', `${(relativeX * depth * 9).toFixed(2)}px`);
        item.style.setProperty('--parallax-y', `${(relativeY * depth * 7).toFixed(2)}px`);
      });
      imageItems.forEach((image) => {
        image.style.setProperty('--image-x', `${(relativeX * 8).toFixed(2)}px`);
        image.style.setProperty('--image-y', `${(relativeY * 6).toFixed(2)}px`);
      });
      root.style.setProperty('--hero-overline-x', `${(relativeX * -12).toFixed(2)}px`);
      root.style.setProperty('--hero-overline-y', `${(relativeY * -6).toFixed(2)}px`);
      root.style.setProperty('--hero-title-x', `${(relativeX * 15).toFixed(2)}px`);
      root.style.setProperty('--hero-title-y', `${(relativeY * 9).toFixed(2)}px`);
      root.style.setProperty('--hero-statement-x', `${(relativeX * -19).toFixed(2)}px`);
      root.style.setProperty('--hero-statement-y', `${(relativeY * 12).toFixed(2)}px`);
      root.style.setProperty('--ball-x', `${(relativeX * 10).toFixed(2)}deg`);
      root.style.setProperty('--ball-y', `${(relativeY * -8).toFixed(2)}deg`);
      burstIntoCursor();
    };

    addEventListener('pointermove', move, { passive: true });
    animationFrame = requestAnimationFrame(tick);
    addEventListener('beforeunload', () => cancelAnimationFrame(animationFrame), { once: true });
  }

  if (reduced || !('IntersectionObserver' in window)) {
    targets.forEach((target) => target.classList.add('is-visible'));
  } else {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: .06, rootMargin: '0px 0px -7% 0px' });
    targets.forEach((target) => observer.observe(target));
  }

  const audio = document.getElementById('ambientAudio');
  const toggle = document.getElementById('soundToggle');
  if (!audio || !toggle) return;

  audio.volume = .26;
  let soundRequested = true;
  let pausedByVisibility = false;
  const setSoundState = (playing) => {
    toggle.classList.toggle('is-playing', playing);
    toggle.setAttribute('aria-pressed', String(playing));
    toggle.setAttribute('aria-label', playing ? 'Выключить звук' : 'Включить звук');
    toggle.querySelector('span').textContent = playing ? 'Звук / вкл' : 'Звук / выкл';
  };
  const startSound = async ({ restart = false } = {}) => {
    if (document.hidden || !soundRequested) return;
    if (restart) audio.currentTime = 0;
    try {
      await audio.play();
      setSoundState(true);
    } catch (_) {
      setSoundState(false);
    }
  };

  setSoundState(true);
  startSound();
  const beginAudio = () => startSound();
  addEventListener('pointerdown', beginAudio, { once: true, passive: true });
  addEventListener('keydown', beginAudio, { once: true });
  toggle.addEventListener('click', async () => {
    if (audio.paused) {
      soundRequested = true;
      await startSound({ restart: true });
    } else {
      soundRequested = false;
      audio.pause();
      setSoundState(false);
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pausedByVisibility = !audio.paused;
      if (pausedByVisibility) audio.pause();
      return;
    }
    if (soundRequested && pausedByVisibility) {
      pausedByVisibility = false;
      startSound();
    }
  });
  audio.addEventListener('play', () => setSoundState(true));
  audio.addEventListener('pause', () => setSoundState(false));
})();
