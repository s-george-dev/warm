console.log("MAIN JS VERSION", 3);

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
      SCROLL ANIMATIONS
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
	const mobileToggle = document.querySelector('.menu-toggle');
  if (mobileToggle) {
    
    if (document.body.scrollTop > 60) {
      mobileToggle.classList.add('scrolled');
    } else {
      mobileToggle.classList.remove('scrolled');
    }
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
       CAROUSEL AUTO-SCROLL - FIXED
  ================================== */
  document.querySelectorAll('.carousel-container').forEach(container => {
    const track = container.querySelector('.carousel-track');
    if (!track) return;

    const tiles = Array.from(track.querySelectorAll('.info-tile'));
    const prevBtn = container.querySelector('.carousel-btn.left');
    const nextBtn = container.querySelector('.carousel-btn.right');

    let scrollSpeed = 0.6;
    let isPaused = false;
    let isUserScrolling = false;
    let lastScrollLeft = 0;
    let scrollTimeout;
    let scrollDirection = 1;

    function animateScroll() {
      if (isPaused || isUserScrolling || !track) {
        requestAnimationFrame(animateScroll);
        return;
      }

      track.scrollLeft += scrollSpeed * scrollDirection;

      const maxScroll = track.scrollWidth - track.clientWidth;

      if (scrollDirection === 1 && track.scrollLeft >= maxScroll - 5) {
        scrollDirection = -1;
        track.scrollLeft = maxScroll;
      } else if (scrollDirection === -1 && track.scrollLeft <= 5) {
        scrollDirection = 1;
        track.scrollLeft = 0;
      }

      requestAnimationFrame(animateScroll);
    }

    // User interaction handling
    if (track) {
      track.addEventListener('scroll', () => {
        if (Math.abs(track.scrollLeft - lastScrollLeft) > 2) {
          isUserScrolling = true;
          clearTimeout(scrollTimeout);
          scrollTimeout = setTimeout(() => { isUserScrolling = false; }, 1500);
        }
        lastScrollLeft = track.scrollLeft;
      });

      // Hover + Touch pause
      container.addEventListener('mouseenter', () => isPaused = true);
      container.addEventListener('mouseleave', () => isPaused = false);

      track.addEventListener('touchstart', () => isPaused = true);
      track.addEventListener('touchend', () => isPaused = false);
    }

    // Buttons
    function scrollByTile(dir = 1) {
      const tileWidth = tiles[0]?.offsetWidth + 24 || 280;
      track.scrollBy({ left: dir * tileWidth, behavior: 'smooth' });
    }

    if (nextBtn) nextBtn.addEventListener('click', () => { scrollByTile(1); isPaused=true; setTimeout(()=>isPaused=false,1400); });
    if (prevBtn) prevBtn.addEventListener('click', () => { scrollByTile(-1); isPaused=true; setTimeout(()=>isPaused=false,1400); });

    // Start animation
    requestAnimationFrame(animateScroll);
  });

}); // end DOMContentLoaded

/* ================================
    SUPPORT FUNCTIONS
================================== */
async function updateTileImages() {
  const callTile = document.getElementById('call-to-book');
  if (!callTile) return;
  const img = callTile.querySelector('img');

  // 1. Fetch the real status from our new logic
  // (Assuming getOpeningStatus() is available in your global scope or helper file)
  const status = await getOpeningStatus(); 

  // 2. Update the image based on the DB, not a hardcoded number
  if (img) {
    img.src = status.isOpen 
      ? "assets/images/office-open.jpg" 
      : "assets/images/office-closed.jpg";
  }
  
  // 3. Bonus: Update the tile's visual state or link while we're here
  if (!status.isOpen) {
    callTile.classList.add('is-closed');
  } else {
    callTile.classList.remove('is-closed');
  }
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

// Ensure map works even if loaded late
function initMapOverlay() {
  const mapOverlay = document.getElementById('mapOverlay');
  if (mapOverlay) {
    mapOverlay.addEventListener('click', function activateMap() {
      const container = this.parentElement;
      if (container) {
        container.classList.add('active');
        this.classList.add('hidden');
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", initMapOverlay);
document.addEventListener("includesLoaded", initMapOverlay);