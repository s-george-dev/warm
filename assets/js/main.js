document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ DOM fully loaded, script running");



  /* ================================
     REVEAL ANIMATIONS
  ================================== */
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.card').forEach((c, i) => {
    c.style.transitionDelay = `${i * 100}ms`;
    observer.observe(c);
  });

  /* ================================
     BACK TO TOP BUTTON
  ================================== */
  let backToTop = document.querySelector('.back-to-top');
  if (!backToTop) {
    backToTop = document.createElement('a');
    backToTop.href = "#";
    backToTop.className = "back-to-top";
    backToTop.textContent = "↑";
    document.body.appendChild(backToTop);
  }

  window.addEventListener('scroll', () => {
    if (window.scrollY > 100) {
      backToTop.classList.add('show');
    } else {
      backToTop.classList.remove('show');
    }
  });

  backToTop.addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ================================
     CAROUSEL AUTO-SCROLL
  ================================== */
  document.querySelectorAll('.carousel-container').forEach(container => {
    const track = container.querySelector('.carousel-track');
    const tiles = Array.from(track.querySelectorAll('.info-tile'));
    const prevBtn = container.querySelector('.carousel-btn.left');
    const nextBtn = container.querySelector('.carousel-btn.right');

    let scrollSpeed = 0.5;
    let isPaused = false;
    let isUserScrolling = false;
    let lastScrollLeft = 0;
    let scrollTimeout;
    let scrollDirection = 1;

    function animateScroll() {
      if (!isPaused && !isUserScrolling && track) {
        track.scrollLeft += scrollSpeed * scrollDirection;

        if (track.scrollLeft >= track.scrollWidth - track.clientWidth - 1) {
          scrollDirection = -1;
        } else if (track.scrollLeft <= 0) {
          scrollDirection = 1;
        }
      }

      requestAnimationFrame(animateScroll);
    }

    if (track) {
      track.addEventListener('scroll', () => {
        if (Math.abs(track.scrollLeft - lastScrollLeft) > 1) {
          isUserScrolling = true;
          clearTimeout(scrollTimeout);
          scrollTimeout = setTimeout(() => {
            isUserScrolling = false;
          }, 1000);
        }
        lastScrollLeft = track.scrollLeft;
      });

      track.addEventListener('touchstart', () => { isPaused = true; });
      track.addEventListener('touchend', () => { isPaused = false; });
    }

    container.addEventListener('mouseenter', () => { isPaused = true; });
    container.addEventListener('mouseleave', () => { isPaused = false; });

    function scrollByTile(direction = 1) {
      const tileWidth = tiles[0]?.offsetWidth + 20 || 300;
      track.scrollBy({ left: direction * tileWidth, behavior: 'smooth' });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        scrollByTile(1);
        isPaused = true;
        setTimeout(() => { isPaused = false; }, 1500);
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        scrollByTile(-1);
        isPaused = true;
        setTimeout(() => { isPaused = false; }, 1500);
      });
    }

    requestAnimationFrame(animateScroll);
  });

 

  /* ================================
     SLIDESHOW ROTATION
  ================================== */
  const slides = document.querySelectorAll('.slide');
  let current = 0;

  setInterval(() => {
    const outgoing = slides[current];
    outgoing.classList.remove('active');

    const h1 = outgoing.querySelector('h1');
    const p = outgoing.querySelector('p');
    if (h1) h1.style.opacity = h1.style.transform = '';
    if (p) p.style.opacity = p.style.transform = '';

    current = (current + 1) % slides.length;
    const incoming = slides[current];
    incoming.classList.add('active');
  }, 6000);

  /* ================================
     MAP OVERLAY INTERACTION
  ================================== */
  const mapOverlay = document.getElementById('mapOverlay');
  const mapContainer = mapOverlay?.parentElement;
  let mapResetTimer;

  function activateMap() {
    mapContainer.classList.add('active');
    mapOverlay.classList.add('hidden');
    resetMapTimer();
  }

  function resetMapTimer() {
    clearTimeout(mapResetTimer);
    mapResetTimer = setTimeout(() => {
      mapContainer.classList.remove('active');
      mapOverlay.classList.remove('hidden');
    }, 30000);
  }

  if (mapOverlay && mapContainer) {
    mapOverlay.addEventListener('click', activateMap);
  }
});

function waitForHeaderAndInitNav(retries = 20) {
  const toggle = document.querySelector('.menu-toggle');
  if (toggle && typeof window.initWarmRight === "function") {
    window.initWarmRight();
    console.log("✅ initWarmRight triggered after header load");
  } else if (retries > 0) {
    setTimeout(() => waitForHeaderAndInitNav(retries - 1), 150);
  } else {
    console.warn("⚠️ menu-toggle not found — nav init skipped");
  }
}

waitForHeaderAndInitNav();