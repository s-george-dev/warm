document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ DOM fully loaded, script running");

  // Run the image check immediately for static content
  updateTileImages();

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
      const h1 = outgoing.querySelector('h1');
      const p = outgoing.querySelector('p');
      if (h1) h1.style.opacity = h1.style.transform = '';
      if (p) p.style.opacity = p.style.transform = '';

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
    OFFICE HOURS IMAGE LOGIC
========================================== */
function updateTileImages() {
    const callTile = document.getElementById('call-to-book');
    if (!callTile) return;

    const img = callTile.querySelector('img');
    if (!img) return;

    const now = new Date();
    const hours = now.getHours();
    
    // Check if between 9am (inclusive) and 6pm (exclusive)
    const isOpen = hours >= 9 && hours < 18;

    if (isOpen) {
        img.src = "assets/images/office-open.jpg";
        console.log("🏪 Office Open: Loading open image.");
    } else {
        img.src = "assets/images/office-closed.jpg";
        console.log("😴 Office Closed: Loading closed image.");
    }
}

/* ==========================================
    MODAL & FORM LOGIC
========================================== */

function closeModal() {
    const callModal = document.getElementById('call-modal');
    const initialActions = document.getElementById('modal-initial-actions');
    const callbackFormContainer = document.getElementById('modal-callback-form');
    const thankYouSection = document.getElementById('modal-thank-you');

    if (callModal) {
        callModal.style.display = 'none';
        document.body.classList.remove('modal-open'); 
        
        if (initialActions) initialActions.style.display = 'block';
        if (callbackFormContainer) callbackFormContainer.style.display = 'none';
        if (thankYouSection) thankYouSection.style.display = 'none';
    }
}

document.addEventListener('click', (e) => {
    const openBtn = e.target.closest('.footer-call-btn, .mobile-call-btn, #call-to-book, .request-callback-tile');

    if (openBtn) {
        const callModal = document.getElementById('call-modal');
        const initialActions = document.getElementById('modal-initial-actions');
        const callbackFormContainer = document.getElementById('modal-callback-form');
        const backBtn = document.getElementById('btn-modal-back');

        if (callModal) {
            callModal.style.display = 'flex';
            document.body.classList.add('modal-open');

            if (openBtn.classList.contains('request-callback-tile')) {
                if (initialActions) initialActions.style.display = 'none';
                if (callbackFormContainer) callbackFormContainer.style.display = 'block';
                if (backBtn) backBtn.innerText = "Close";
            } else {
                if (initialActions) initialActions.style.display = 'block';
                if (callbackFormContainer) callbackFormContainer.style.display = 'none';
                if (backBtn) backBtn.innerText = "Back";
            }
        }
    }

    if (e.target.id === 'btn-request-callback') {
        document.getElementById('modal-initial-actions').style.display = 'none';
        document.getElementById('modal-callback-form').style.display = 'block';
    }

    if (e.target.id === 'btn-modal-back') {
        if (e.target.innerText === "Close") {
            closeModal();
        } else {
            document.getElementById('modal-callback-form').style.display = 'none';
            document.getElementById('modal-initial-actions').style.display = 'block';
        }
    }

    if (e.target.classList.contains('call-modal-close') || 
        e.target.classList.contains('modal-close-trigger') || 
        e.target.id === 'call-modal') {
        closeModal();
    }
});

/**
 * AJAX Form Submission
 */
document.addEventListener("submit", async (event) => {
    if (event.target.id === 'footer-callback-form') {
        event.preventDefault(); 
        const form = event.target;
        const data = new FormData(form);
        const submitBtn = form.querySelector('button[type="submit"]');
        const thankYouSection = document.getElementById('modal-thank-you');
        const formContainer = document.getElementById('modal-callback-form');

        if (submitBtn) {
            submitBtn.innerText = "Sending...";
            submitBtn.disabled = true;
        }

        try {
            const response = await fetch(form.action, {
                method: form.method,
                body: data,
                headers: { 'Accept': 'application/json' }
            });
            
            if (response.ok) {
                formContainer.style.display = 'none';
                thankYouSection.style.display = 'block';
                form.reset();
            } else {
                alert("Oops! There was a problem. Email us: info@warmright.co.uk");
            }
        } catch (error) {
            alert("Connection error. Please check your internet.");
        } finally {
            if (submitBtn) {
                submitBtn.innerText = "Submit Request";
                submitBtn.disabled = false;
            }
        }
    }
});

/* ==========================================
    HEADER LOAD HELPER
========================================== */
function waitForHeaderAndInitNav(retries = 20) {
  const toggle = document.querySelector('.menu-toggle');
  
  // Also check for tile updates when header loads, as partials can re-render
  updateTileImages();

  if (toggle && typeof window.initWarmRight === "function") {
    window.initWarmRight();
  } else if (retries > 0) {
    setTimeout(() => waitForHeaderAndInitNav(retries - 1), 150);
  }
}

waitForHeaderAndInitNav();

/* ==========================================
    UNIFIED TESTIMONIAL EXPANSION
========================================== */
function initTestimonials() {
    const cards = document.querySelectorAll('.review-card');
    
    cards.forEach(card => {
        const body = card.querySelector('.review-body');
        const btn = card.querySelector('.read-more-btn');
        const contentWrapper = card.querySelector('.review-content');

        if (!body || !btn) return;

        // 1. Determine if the text actually needs a "Read More" button
        // We use a temporary limit (e.g., 75px / ~3 lines)
        const isLongText = body.scrollHeight > 80; 

        if (!isLongText) {
            btn.style.display = 'none';
            contentWrapper.style.maxHeight = 'none';
        }

        // 2. Click Event for the button
        btn.addEventListener('click', () => {
            const isExpanded = card.classList.toggle('expanded');
            btn.innerText = isExpanded ? "Show less" : "Read more";
            
            // If we just collapsed it, scroll the card back into view if it's off-screen
            if (!isExpanded) {
                card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    });
}

// Run on load
document.addEventListener("DOMContentLoaded", initTestimonials);

/* ==========================================
    GALLERY / LIGHTBOX LOGIC WITH NAVIGATION
========================================== */
let currentGalleryImages = [];
let currentImageIndex = 0;

function updateLightbox() {
    const lightboxImg = document.getElementById('lightbox-img');
    const counter = document.getElementById('lightbox-counter');
    
    if (lightboxImg && currentGalleryImages[currentImageIndex]) {
        lightboxImg.src = currentGalleryImages[currentImageIndex];
        if (counter) {
            counter.innerText = `${currentImageIndex + 1} / ${currentGalleryImages.length}`;
        }
    }
}

document.addEventListener('click', (e) => {
    const photoItem = e.target.closest('.photo-item');
    const lightbox = document.getElementById('review-lightbox');

    // 1. OPEN LIGHTBOX
    if (photoItem) {
        const card = photoItem.closest('.review-card');
        const allImgsInCard = card.querySelectorAll('.photo-item img');
        
        // Populate gallery array
        currentGalleryImages = Array.from(allImgsInCard).map(img => img.src);
        
        // Find the index of the image we actually clicked
        const clickedImgSrc = photoItem.querySelector('img').src;
        currentImageIndex = currentGalleryImages.indexOf(clickedImgSrc);

        if (lightbox) {
            // Toggle class if only one image exists (hides arrows)
            lightbox.classList.toggle('single-image', currentGalleryImages.length <= 1);
            lightbox.style.display = 'flex';
            document.body.classList.add('modal-open');
            updateLightbox();
        }
    }

    // 2. NAVIGATION
    if (e.target.id === 'lightbox-next') {
        currentImageIndex = (currentImageIndex + 1) % currentGalleryImages.length;
        updateLightbox();
    }

    if (e.target.id === 'lightbox-prev') {
        currentImageIndex = (currentImageIndex - 1 + currentGalleryImages.length) % currentGalleryImages.length;
        updateLightbox();
    }

    // 3. CLOSE
    if (e.target.classList.contains('lightbox-close') || e.target.id === 'review-lightbox') {
        if (lightbox) {
            lightbox.style.display = 'none';
            document.body.classList.remove('modal-open');
        }
    }
});

// KEYBOARD NAVIGATION
document.addEventListener('keydown', (e) => {
    const lightbox = document.getElementById('review-lightbox');
    if (!lightbox || lightbox.style.display !== 'flex') return;

    if (e.key === 'ArrowRight') document.getElementById('lightbox-next').click();
    if (e.key === 'ArrowLeft') document.getElementById('lightbox-prev').click();
    if (e.key === 'Escape') document.querySelector('.lightbox-close').click();
});

//WEBCHAT



var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
(function(){
var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
s1.async=true;
s1.src='https://embed.tawk.to/69f934a90df4551c33ab02d4/1jnqnbe12';
s1.charset='UTF-8';
s1.setAttribute('crossorigin','*');
s0.parentNode.insertBefore(s1,s0);
})();


/* ==========================================
    BOOK US BUTTON (Responsive Float Injection)
   ========================================== */
(function() {
    // 1. Check for button existence, then create and inject
    let bookBtn = document.querySelector('.book-us-btn');
    if (!bookBtn) {
        bookBtn = document.createElement('a');
        bookBtn.href = "book-a-visit.html";
        bookBtn.className = "book-us-btn";
        bookBtn.textContent = "Book Us";
        document.body.appendChild(bookBtn);
    }

    // 2. Responsive adjustment logic
    function adjustBookButton() {
        const isMobile = window.innerWidth <= 768;
        const scrollY = window.scrollY;
        const windowHeight = window.innerHeight;
        const docHeight = document.documentElement.scrollHeight;
        
        // Detection for bottom of the page (within 10px)
        const isAtBottom = (scrollY + windowHeight) >= (docHeight - 10);
        const navIsOpen = document.body.classList.contains('nav-open');

        // Logic for the mobile "Footer-Center" state
        const shouldFloatCenter = isMobile && isAtBottom && !navIsOpen;

        if (shouldFloatCenter) {
            bookBtn.style.left = '50%';
            bookBtn.style.right = 'auto';
            bookBtn.style.transform = 'translateX(-50%)';
            bookBtn.style.bottom = '55%';
            bookBtn.style.fontSize = '1.3rem';
            bookBtn.style.padding = '16px 24px';
            bookBtn.style.opacity = '1';
            bookBtn.style.pointerEvents = 'auto';
            bookBtn.innerText = 'Click to book today';
            bookBtn.style.width = '75%';
        } else {
            // Restore standard floating corner state
            bookBtn.style.left = '';
            bookBtn.style.right = '25px';
            bookBtn.style.transform = '';
            bookBtn.style.bottom = '25px';
            bookBtn.style.fontSize = '';
            bookBtn.style.padding = '';
            bookBtn.style.opacity = '1';
            bookBtn.style.pointerEvents = 'auto';
            bookBtn.innerText = 'Book Us';
            bookBtn.style.width = 'auto';
        }
    }

    // 3. Listeners for scroll and window resizing
    window.addEventListener('scroll', adjustBookButton);
    window.addEventListener('resize', adjustBookButton);
    
    // Initial call to set state on load
    adjustBookButton();
})();