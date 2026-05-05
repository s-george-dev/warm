/**
 * Global Navigation Initializer
 */
window.initWarmRight = function() {
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');

    if (menuToggle && navLinks) {
        menuToggle.replaceWith(menuToggle.cloneNode(true));
        const newToggle = document.querySelector('.menu-toggle');

        newToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            newToggle.classList.toggle('open');
            document.body.classList.toggle('nav-open');
        });
    }
};

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

  window.addEventListener('scroll', () => {
    if (window.scrollY > 100) backToTop.classList.add('show');
    else backToTop.classList.remove('show');
  });

  backToTop.addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
});

/* ==========================================
    OFFICE HOURS IMAGE LOGIC
========================================== */
function updateTileImages() {
    const callTile = document.getElementById('call-to-book');
    if (!callTile) return;
    const img = callTile.querySelector('img');
    const hours = new Date().getHours();
    const isOpen = hours >= 9 && hours < 18;
    if (img) img.src = isOpen ? "assets/images/office-open.jpg" : "assets/images/office-closed.jpg";
}

/* ==========================================
    UNIFIED TESTIMONIAL EXPANSION
========================================== */
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

// Lightbox and Float Button logic...
(function() {
    let bookBtn = document.querySelector('.book-us-btn');
    if (!bookBtn) {
        bookBtn = document.createElement('a');
        bookBtn.href = "book-a-visit.html";
        bookBtn.className = "book-us-btn";
        bookBtn.textContent = "Book Us";
        document.body.appendChild(bookBtn);
    }

    function adjustBookButton() {
        const isAtBottom = (window.scrollY + window.innerHeight) >= (document.documentElement.scrollHeight - 10);
        if (window.innerWidth <= 768 && isAtBottom) {
            bookBtn.style.left = '50%';
            bookBtn.style.transform = 'translateX(-50%)';
            bookBtn.style.bottom = '55%';
            bookBtn.style.width = '75%';
            bookBtn.innerText = 'Click to book today';
        } else {
            bookBtn.style.left = '';
            bookBtn.style.transform = '';
            bookBtn.style.bottom = '25px';
            bookBtn.style.width = 'auto';
            bookBtn.innerText = 'Book Us';
        }
    }
    window.addEventListener('scroll', adjustBookButton);
    adjustBookButton();
})();