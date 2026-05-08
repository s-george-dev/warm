console.log("MAIN JS VERSION", 1);

document.addEventListener("DOMContentLoaded", () => {

  updateTileImages();
  initTestimonials();

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

  document.body.addEventListener('scroll', () => {
    if (document.body.scrollTop > 400) {
      backToTop.classList.add('show');
    } else {
      backToTop.classList.remove('show');
    }
  });

  backToTop.addEventListener('click', (e) => {
    e.preventDefault();
    document.body.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ================================
      SLIDESHOW ROTATION
  ================================== */
  const slides = document.querySelectorAll('.slide');
  let current = 0;
  if (slides.length > 0) {
    setInterval(() => {
      slides[current].classList.remove('active');
      current = (current + 1) % slides.length;
      slides[current].classList.add('active');
    }, 6000);
  }

  /* ================================
       CAROUSEL AUTO-SCROLL (OLD SMOOTH VERSION)
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

    /* === AUTO SCROLL === */
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

    /* === USER SCROLL PAUSE === */
    track.addEventListener('scroll', () => {
      if (Math.abs(track.scrollLeft - lastScrollLeft) > 1) {
        isUserScrolling = true;
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          isUserScrolling = false;
        }, 3000); // freeze for 3 seconds after user scroll
      }
      lastScrollLeft = track.scrollLeft;
    });

    /* === TOUCH PAUSE === */
    track.addEventListener('touchstart', () => { isPaused = true; });
    track.addEventListener('touchend', () => { isPaused = false; });

    /* === HOVER PAUSE === */
    container.addEventListener('mouseenter', () => { isPaused = true; });
    container.addEventListener('mouseleave', () => { isPaused = false; });

    /* === BUTTONS === */
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

    /* ================================
         DRAG + SWIPE (INSIDE LOOP!)
    ================================== */
    let isDown = false;
    let startX;
    let scrollLeftStart;

    // Desktop drag
    track.addEventListener('mousedown', (e) => {
      isDown = true;
      isPaused = true;
      startX = e.pageX - track.offsetLeft;
      scrollLeftStart = track.scrollLeft;
    });

    track.addEventListener('mouseleave', () => {
      isDown = false;
      isPaused = false;
    });

    track.addEventListener('mouseup', () => {
      isDown = false;
      isPaused = false;
    });

    track.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - track.offsetLeft;
      const walk = (x - startX) * 2.2;
      track.scrollLeft = scrollLeftStart - walk;
    });

    // Mobile swipe
    track.addEventListener('touchstart', (e) => {
      isPaused = true;
      startX = e.touches[0].pageX;
      scrollLeftStart = track.scrollLeft;
    });

    track.addEventListener('touchmove', (e) => {
      const x = e.touches[0].pageX;
      const walk = (x - startX) * 1.8;
      track.scrollLeft = scrollLeftStart - walk;
    });

    track.addEventListener('touchend', () => {
      isPaused = false;
    });

    /* Start auto-scroll */
    requestAnimationFrame(animateScroll);

  }); // end forEach

}); // end DOMContentLoaded


/* ================================
    SUPPORT FUNCTIONS
================================== */

function updateTileImages() {
  const callTile = document.getElementById('call-to-book');
  if (!callTile) return;
  const img = callTile.querySelector('img');
  const hours = new Date().getHours();
  const isOpen = hours >= 7 && hours < 18;
  if (img) img.src = isOpen ? "assets/images/office-open.jpg" : "assets/images/office-closed.jpg";
}

function initTestimonials() {
  const cards = document.querySelectorAll('.review-card');
  cards.forEach(card => {
    const body = card.querySelector('.review-body');
    const btn = card.querySelector('.read-more-btn');
    if (!body || !btn) return;
    if (body.scrollHeight <= 80) btn.style.display = 'none';
    btn.addEventListener('click', () => {
      const isExpanded = card.classList.toggle('expanded');
      btn.innerText = isExpanded ? "Show less" : "Read more";
      if (!isExpanded) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });
}
