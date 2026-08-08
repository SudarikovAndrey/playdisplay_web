(() => {
  const links = [...document.querySelectorAll('.chapter-nav a')];
  const sections = [...document.querySelectorAll('.chapter, .final-credits')];
  if (!links.length || !sections.length) return;

  const setActive = (id) => {
    links.forEach((link) => {
      const active = link.dataset.section === id;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  };

  let ticking = false;
  const updateActive = () => {
    const marker = window.innerHeight * .45;
    const visible = sections.filter((section) => {
      const box = section.getBoundingClientRect();
      return box.top <= marker && box.bottom >= marker;
    });
    const current = visible[visible.length - 1] || sections.reduce((closest, section) => {
      const distance = Math.abs(section.getBoundingClientRect().top - marker);
      const closestDistance = Math.abs(closest.getBoundingClientRect().top - marker);
      return distance < closestDistance ? section : closest;
    }, sections[0]);

    setActive(current.id);
    links.find((link) => link.dataset.section === current.id)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    ticking = false;
  };

  const requestUpdate = () => {
    if (ticking) return;
    requestAnimationFrame(updateActive);
    ticking = true;
  };

  addEventListener('scroll', requestUpdate, { passive: true });
  addEventListener('resize', requestUpdate);
  updateActive();
})();
