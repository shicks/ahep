let interacted = false;
for (const event of ['mousemove', 'touchstart']) {
  document.body.addEventListener(event, () => {
    interacted = true;
  });
}


// Handle scroll by adding/removing relevant classes to the body element.
let lastTop = 0;
document.addEventListener('scroll', () => {
  const top = window.scrollY;
  document.body.classList.toggle('scrolled', top > 0);
  if (top > lastTop) {
    document.body.classList.add('scrolled-down');
  } else if (top < lastTop) {
    document.body.classList.remove('scrolled-down');
  }
  lastTop = top;
});


// Set up the carousel
(() => {
  const carousel = document.querySelector('a.carousel');
  const leftButton = document.querySelector('section.carousel .left');
  const rightButton = document.querySelector('section.carousel .right');
  // Double the children
  carousel.innerHTML += carousel.innerHTML;
  // Listen for a handful of events
  let pending = false;
  let remainingScroll = 0;
  let skipEvent = false;
  let lastScroll = carousel.scrollLeft;
  let carouselScrolled = false;
  function animate() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      if (remainingScroll != 0) {
        const delta = Math.round(remainingScroll / 6) || remainingScroll;
        remainingScroll -= delta;
        scroll(delta);
        animate();
        return;
      }
      if (!carouselScrolled) {
        scroll(1);
        animate();
        return;
      }
    });
  }
  function scroll(dx) {
    let save = skipEvent;
    skipEvent = true;
    try {
      carousel.scrollLeft += dx;
      if (dx >= 0 && carousel.scrollLeft > carousel.scrollWidth * 0.75) {
        carousel.scrollLeft -= carousel.scrollWidth / 2;
      }
      if (dx <= 0 && carousel.scrollLeft < carousel.scrollWidth / 4) {
        carousel.scrollLeft += carousel.scrollWidth / 2;
      }
    } finally {
      skipEvent = save;
      lastScroll = carousel.scrollLeft;
    }
  }
  carousel.addEventListener('scroll', (e) => {
    if (lastScroll === carousel.scrollLeft) return;
    if (skipEvent) return;
    if (interacted) {
      carouselScrolled = true;
    }
    scroll(0);
  });
  leftButton.addEventListener('click', () => {
    carouselScrolled = true;
    remainingScroll -= carousel.offsetWidth / 2;
    animate();
  });
  rightButton.addEventListener('click', () => {
    carouselScrolled = true;
    remainingScroll += carousel.offsetWidth / 2;
    animate();
  });
  animate();
})();
