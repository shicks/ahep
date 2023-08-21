// Keep track of any human interaction, to disambiguate from automatic
// scroll events on document load.
let interacted = false;
for (const event of ['mousemove', 'touchstart']) {
  document.body.addEventListener(event, () => {
    interacted = true;
  });
}


// Handle the hamburger menu
document.querySelector('.hamburger')?.addEventListener('click', () => {
  console.log(`hamburger`);
  document.body.classList.toggle('hamburger-expanded');
});


// Handle scroll by adding/removing relevant classes to the body element.
(() => {
  let lastTop = 0;
  let upPixels = 0;
  document.addEventListener('scroll', () => {
    const top = window.scrollY;
    document.body.classList.toggle('scrolled', top > 0);
    if (top > lastTop) {
      upPixels = 0;
      document.body.classList.add('scrolled-down');
    } else if (top < lastTop) {
      upPixels += lastTop - top;
      // the closer we are to the top, the less scroll we need
      // to bring the header back...
      if (upPixels > Math.min(160, top >> 2)) {
        document.body.classList.remove('scrolled-down');
      }
    }
    lastTop = top;
  });
})();


// Set up the carousel
(() => {
  const carousel = document.querySelector('a.carousel');
  if (!carousel) return;
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
      if (dx >= 0 && carousel.scrollLeft > carousel.scrollWidth * 0.6) {
        carousel.scrollLeft -= carousel.scrollWidth / 2;
      }
      if (dx <= 0 && carousel.scrollLeft < carousel.scrollWidth * 0.1) {
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


// Blur squares
(() => {
  for (const img of document.querySelectorAll('.blur-cover img')) {
    const back = document.createElement('img');
    back.classList.add('blur');
    back.src = img.src;
    img.parentElement.insertBefore(back, img);
    const link = img.closest('a.module');
    link.href =
        img.src.replace(/\/covers\//, '/modules/').replace(/\.jpg/, '.pdf');
    link.target = '_blank';
  }
})();


// FAQ collapsing
(() => {
  for (const q of document.querySelectorAll('.faq > h2')) {
    const s = document.createElement('span');
    s.classList.add('material-symbols-outlined');
    q.insertBefore(s, q.firstChild);
    q.addEventListener('click', () => q.classList.toggle('expanded'));
  }
})();
