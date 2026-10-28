'use strict';
(() => {
  const art = document.querySelector('.directions-art');
  if (!art) return;
  const slides = [...art.querySelectorAll('.direction-glass')];
  const count = art.querySelector('.direction-count');
  const pause = art.querySelector('.direction-pause');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0, timer, flip, finish, busy = false, paused = false, visible = true, hovering = false;
  const stop = () => clearTimeout(timer);
  function schedule() {
    stop();
    const stopped = paused || motion.matches || !visible || document.hidden || hovering || art.contains(document.activeElement);
    art.classList.toggle('directions-paused', stopped);
    pause.textContent = motion.matches ? 'Автосмена выключена' : paused ? 'Продолжить' : 'Пауза';
    pause.disabled = motion.matches;
    pause.setAttribute('aria-pressed', String(paused || motion.matches));
    if (!stopped && !busy) timer = setTimeout(() => show(index + 1), 8000);
  }
  function settle() {
    clearTimeout(flip); clearTimeout(finish);
    slides.forEach((slide, i) => {slide.hidden = i !== index; slide.classList.remove('direction-leave', 'direction-enter');});
    busy = false;
  }
  function show(next) {
    if (busy) return;
    stop();
    const target = (next + slides.length) % slides.length;
    const swap = () => {
      slides[index].hidden = true;
      slides[index].classList.remove('direction-leave');
      index = target;
      slides[index].hidden = false;
      count.textContent = `${index + 1} / ${slides.length}`;
      if (!motion.matches) slides[index].classList.add('direction-enter');
      finish = setTimeout(() => {settle(); schedule();}, motion.matches ? 0 : 400);
    };
    busy = true;
    if (motion.matches) swap();
    else {slides[index].classList.add('direction-leave'); flip = setTimeout(swap, 240);}
  }
  art.querySelector('[data-direction="prev"]').addEventListener('click', () => show(index - 1));
  art.querySelector('[data-direction="next"]').addEventListener('click', () => show(index + 1));
  pause.addEventListener('click', () => {paused = !paused; schedule();});
  art.addEventListener('pointerenter', e => {if(e.pointerType === 'mouse'){hovering = true; schedule();}});
  art.addEventListener('pointerleave', () => {hovering = false; schedule();});
  art.addEventListener('focusin', schedule);
  art.addEventListener('focusout', () => setTimeout(schedule, 0));
  document.addEventListener('visibilitychange', () => {settle(); schedule();});
  motion.addEventListener('change', () => {settle(); schedule();});
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => {visible = entries[0].isIntersecting; schedule();}).observe(art);
  schedule();
})();
