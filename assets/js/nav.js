/**
 * Global Navigation Initializer
 * This is called by include.js after the header is injected.
 */
window.initWarmRight = function() {
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');

    if (menuToggle && navLinks) {
        // Remove existing listener to prevent double-binding
        menuToggle.replaceWith(menuToggle.cloneNode(true));
        const newToggle = document.querySelector('.menu-toggle');

        newToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            newToggle.classList.toggle('open');
            document.body.classList.toggle('nav-open');
        });
        console.log("📂 Navigation initialized");
    }
};

document.addEventListener("DOMContentLoaded", () => {
  // Initial check for office status
  updateOfficeStatus();

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
    if (!track) return;

    const nextBtn = container.querySelector('.carousel-btn.right');
    const prevBtn = container.querySelector('.carousel-btn.left');

    let scrollSpeed = 1.2;
    let isPaused = false;
    let scrollDirection = 1;
    let mobilePauseTimeout;

    function animateScroll() {
      if (!isPaused && track) {
        const maxScroll = track.scrollWidth - track.clientWidth;
        track.scrollLeft += scrollSpeed * scrollDirection;

        if (scrollDirection === 1 && track.scrollLeft >= maxScroll - 2) {
          scrollDirection = -1;
        } else if (scrollDirection === -1 && track.scrollLeft <= 1) {
          scrollDirection = 1;
        }
      }
      requestAnimationFrame(animateScroll);
    }

    container.addEventListener('mouseenter', () => { isPaused = true; });
    container.addEventListener('mouseleave', () => { isPaused = false; });

    track.addEventListener('touchstart', () => {
      isPaused = true;
      clearTimeout(mobilePauseTimeout);
      mobilePauseTimeout = setTimeout(() => { isPaused = false; }, 3000);
    }, { passive: true });

    function scrollByTile(direction = 1) {
      const firstTile = track.querySelector('.info-tile');
      const tileWidth = firstTile ? firstTile.offsetWidth + 20 : 240; 
      track.scrollBy({ left: direction * tileWidth, behavior: 'smooth' });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        scrollByTile(1);
        isPaused = true;
        setTimeout(() => { isPaused = false; }, 1000);
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        scrollByTile(-1);
        isPaused = true;
        setTimeout(() => { isPaused = false; }, 1000);
      });
    }

    requestAnimationFrame(animateScroll);
  });

  /* ================================
      SLIDESHOW ROTATION
  ================================== */
  const slides = document.querySelectorAll('.slide');
  let current = 0;
  if (slides.length > 0) {
    setInterval(() => {
      const outgoing = slides[current];
      outgoing.classList.remove('active');
      current = (current + 1) % slides.length;
      const incoming = slides[current];
      incoming.classList.add('active');
    }, 6000);
  }

  /* ================================
      MAP OVERLAY INTERACTION
  ================================== */
  const mapOverlay = document.getElementById('mapOverlay');
  const mapContainer = mapOverlay?.parentElement;
  let mapResetTimer;

  function activateMap() {
    if (!mapContainer || !mapOverlay) return;
    mapContainer.classList.add('active');
    mapOverlay.classList.add('hidden');
    clearTimeout(mapResetTimer);
    mapResetTimer = setTimeout(() => {
      mapContainer.classList.remove('active');
      mapOverlay.classList.remove('hidden');
    }, 30000);
  }

  if (mapOverlay) {
    mapOverlay.addEventListener('click', activateMap);
  }
});

/* ==========================================
    OFFICE STATUS LOGIC
========================================== */
function isOfficeOpen() {
    const now = new Date();
    const hours = now.getHours();
    return hours >= 9 && hours < 18;
}

function updateOfficeStatus() {
    const callTile = document.getElementById('call-to-book') || document.getElementById('call-us-tile');
    if (!callTile) return;

    const img = callTile.querySelector('img');
    const title = document.getElementById('call-to-book-title') || callTile.querySelector('h3');
    const text = document.getElementById('call-to-book-text') || callTile.querySelector('p');
    const open = isOfficeOpen();

    if (open) {
        if (img) img.src = "assets/images/office-open.jpg";
        if (title) title.innerHTML = "📞 Call Us Now";
        if (text) text.innerHTML = "Our team is available until 6pm today.<br><b>0800 756 6748</b>";
    } else {
        if (img) img.src = "assets/images/office-closed.jpg";
        if (title) title.innerHTML = "🌙 Office Closed";
        if (text) text.innerHTML = "Our office is currently closed.<br><b>Click here to request a callback.</b>";
    }
}

/* ==========================================
    MODAL & FORM LOGIC
========================================== */
function closeModal() {
    const callModal = document.getElementById('call-modal');
    if (callModal) {
        callModal.style.display = 'none';
        document.body.classList.remove('modal-open');
        document.getElementById('modal-initial-actions').style.display = 'block';
        document.getElementById('modal-callback-form').style.display = 'none';
        document.getElementById('modal-thank-you').style.display = 'none';
    }
}

document.addEventListener('click', (e) => {
    const openBtn = e.target.closest('.footer-call-btn, .mobile-call-btn, #call-to-book, #call-us-tile, .request-callback-tile');
    if (openBtn) {
        const isOpen = isOfficeOpen();
        if (isOpen && (openBtn.id === 'call-to-book' || openBtn.id === 'call-us-tile')) return; 
        if (!isOpen && (openBtn.id === 'call-to-book' || openBtn.id === 'call-us-tile')) e.preventDefault();

        const callModal = document.getElementById('call-modal');
        if (callModal) {
            callModal.style.display = 'flex';
            document.body.classList.add('modal-open');
            if (openBtn.classList.contains('request-callback-tile')) {
                document.getElementById('modal-initial-actions').style.display = 'none';
                document.getElementById('modal-callback-form').style.display = 'block';
                document.getElementById('btn-modal-back').innerText = "Close";
            } else {
                document.getElementById('modal-initial-actions').style.display = 'block';
                document.getElementById('modal-callback-form').style.display = 'none';
                document.getElementById('btn-modal-back').innerText = "Back";
            }
        }
    }
    if (e.target.id === 'btn-request-callback') {
        document.getElementById('modal-initial-actions').style.display = 'none';
        document.getElementById('modal-callback-form').style.display = 'block';
    }
    if (e.target.id === 'btn-modal-back') {
        if (e.target.innerText === "Close") closeModal();
        else {
            document.getElementById('modal-callback-form').style.display = 'none';
            document.getElementById('modal-initial-actions').style.display = 'block';
        }
    }
    if (e.target.classList.contains('call-modal-close') || e.target.id === 'call-modal') closeModal();
});

document.addEventListener("submit", async (event) => {
    if (event.target.id === 'footer-callback-form') {
        event.preventDefault(); 
        const form = event.target;
        const data = new FormData(form);
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.innerText = "Sending...";
        submitBtn.disabled = true;

        try {
            const response = await fetch(form.action, {
                method: form.method,
                body: data,
                headers: { 'Accept': 'application/json' }
            });
            if (response.ok) {
                document.getElementById('modal-callback-form').style.display = 'none';
                document.getElementById('modal-thank-you').style.display = 'block';
                form.reset();
            } else alert("Oops! Problem submitting form.");
        } catch (error) { alert("Connection error."); }
        finally {
            submitBtn.innerText = "Submit Request";
            submitBtn.disabled = false;
        }
    }
});

// Polling fallback
function waitForHeaderAndInitNav(retries = 20) {
  const toggle = document.querySelector('.menu-toggle');
  updateOfficeStatus();
  if (toggle && typeof window.initWarmRight === "function") window.initWarmRight();
  else if (retries > 0) setTimeout(() => waitForHeaderAndInitNav(retries - 1), 150);
}
waitForHeaderAndInitNav();