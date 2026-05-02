window.initWarmRight = function() {

  /* ================================
     NAVIGATION (Hamburger + Mobile)
  ================================== */
  const menuToggle = document.querySelector('.menu-toggle');
  const mobileNav  = document.querySelector('.mobile-nav');
  const desktopNav = document.querySelector('.nav');
  const overlay    = document.querySelector('.nav-overlay');
  const wrapper    = document.querySelector('.hamburger-wrapper');

  // Toggle mobile nav
  if (menuToggle && mobileNav) {
    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = mobileNav.classList.toggle('open');
      menuToggle.classList.toggle('open', isOpen);
      document.body.classList.toggle('nav-open', isOpen);
      if (overlay) overlay.classList.toggle('open', isOpen);
      mobileNav.style.transform = '';
      if (desktopNav) desktopNav.style.display = isOpen ? 'none' : '';

      // 🧠 Re-evaluate Book Us button position after nav toggle
      if (typeof adjustBookButton === 'function') {
        adjustBookButton();
      }

      // 🌀 Spin animation on hamburger wrapper
      if (wrapper) {
        wrapper.classList.remove('spin');
        void wrapper.offsetWidth;
        wrapper.classList.add('spin');
        wrapper.addEventListener('animationend', () => {
          wrapper.classList.remove('spin');
        }, { once: true });
      }
    });

    // Close nav if clicking outside
    document.addEventListener('click', (evt) => {
      if (mobileNav.classList.contains('open') &&
          !mobileNav.contains(evt.target) &&
          !menuToggle.contains(evt.target)) {
        closeNav();
      }
    });

    if (overlay) overlay.addEventListener('click', closeNav);
  }

  // Swipe-to-close on mobile
  let startX = 0, currentX = 0, isSwiping = false;
  if (mobileNav) {
    mobileNav.addEventListener('touchstart', (e) => {
      if (!mobileNav.classList.contains('open')) return;
      startX = e.touches[0].clientX;
      isSwiping = true;
    });

    mobileNav.addEventListener('touchmove', (e) => {
      if (!isSwiping) return;
      currentX = e.touches[0].clientX;
      const deltaX = currentX - startX;
      if (deltaX > 0) {
        mobileNav.style.transform = `translateX(${deltaX}px)`;
      }
    });

    mobileNav.addEventListener('touchend', () => {
      if (!isSwiping) return;
      isSwiping = false;
      const deltaX = currentX - startX;
      if (deltaX > 80) {
        closeNav();
      } else {
        mobileNav.style.transform = '';
      }
    });

    // Dropdown toggles
    mobileNav.querySelectorAll('.mobile-dropdown-button').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.nextElementSibling;
        if (!target) return;
        mobileNav.querySelectorAll('.mobile-dropdown-menu').forEach(m => {
          if (m !== target) m.classList.remove('open');
        });
        target.classList.toggle('open');
      });
    });
  }

  function closeNav() {
    mobileNav.classList.remove('open');
    menuToggle.classList.remove('open');
    document.body.classList.remove('nav-open');
    if (overlay) overlay.classList.remove('open');
    if (desktopNav) desktopNav.style.display = '';
    mobileNav.style.transform = '';

    // 🧠 Re-evaluate Book Us button position after nav closes
    if (typeof adjustBookButton === 'function') {
      adjustBookButton();
    }
  }

  /* ================================
     BUSINESS HOURS CONFIG
  ================================== */
  const businessHours = { start: 8, end: 18 }; // 8am–6pm

  function isWithinBusinessHours() {
    const now = new Date();
    const hour = now.getHours();
    return hour >= businessHours.start && hour < businessHours.end;
  }

  /* ================================
     CALL-TO-BOOK TILE (Contact Page)
  ================================== */
  const callTile      = document.getElementById("call-to-book");
  const callTileTitle = document.getElementById("call-to-book-title");
  const callTileText  = document.getElementById("call-to-book-text");

  const defaultTitle = callTileTitle?.textContent.trim();
  const defaultText  = callTileText?.textContent.trim();

  function swapTileText(title, text, classToAdd, classToRemove) {
    if (
      callTileTitle.textContent.trim() === title &&
      callTileText.textContent.trim() === text
    ) return;

    callTile.classList.add("fading");
    setTimeout(() => {
      callTileTitle.textContent = title;
      callTileText.textContent  = text;
      if (classToAdd) callTile.classList.add(classToAdd);
      if (classToRemove) callTile.classList.remove(classToRemove);
      callTile.classList.remove("fading");
    }, 600);
  }

  if (callTile && callTileTitle && callTileText) {
    if (isWithinBusinessHours()) {
      let showingAlt = false;
      setInterval(() => {
        if (showingAlt) {
          swapTileText(defaultTitle, defaultText, null, "call-open");
        } else {
          swapTileText("We’re Open Now!", "Call us today — we’re ready to help", "call-open", null);
        }
        showingAlt = !showingAlt;
      }, 3000);

      callTile.setAttribute("href", "tel:08007566748");
    } else {
      let showingClosed = false;
      setInterval(() => {
        if (showingClosed) {
          swapTileText(defaultTitle, defaultText, null, "call-closed");
        } else {
          swapTileText("Office Closed", "Our office is currently closed for general enquiries", "call-closed", null);
        }
        showingClosed = !showingClosed;
      }, 3000);

      callTile.removeAttribute("href");
      callTile.addEventListener("click", (e) => {
        e.preventDefault();
        if (callModal) callModal.style.display = "flex";
      });
    }
  }

  /* ================================
     MOBILE NAV CALL BUTTON
  ================================== */
  document.querySelectorAll('.mobile-call-btn').forEach(btn => {
    if (isWithinBusinessHours()) {
      btn.setAttribute('href', 'tel:08007566748');
    } else {
      btn.removeAttribute('href');
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (callModal) callModal.style.display = 'flex';
      });
    }
  });

  /* ================================
     FOOTER CALL BUTTON (Global)
  ================================== */
  document.querySelectorAll('.footer-call-btn').forEach(btn => {
    if (isWithinBusinessHours()) {
      btn.setAttribute('href', 'tel:08007566748');
    } else {
      btn.removeAttribute('href');
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (callModal) callModal.style.display = "flex";
      });
    }
  });

 /* ================================
    MODAL HANDLERS
================================== */
const callModal      = document.getElementById("call-modal");
const modalClose     = document.getElementById("modal-close");
const modalCallback   = document.getElementById("modal-callback");

if (modalClose && callModal) {
  modalClose.addEventListener("click", () => {
    callModal.style.display = "none";
  });
}

if (modalCallback) {
  modalCallback.addEventListener("click", () => {
    callModal.style.display = "none";
    const callbackForm = document.getElementById("callback-form");
    if (callbackForm) {
      callbackForm.style.display = "block";
      callbackForm.scrollIntoView({ behavior: "smooth" });
    }
  });
}

}; 


 /* ================================
     BOOK US BUTTON (Responsive Float)
  ================================== */
  let bookBtn = document.querySelector('.book-us-btn');
  if (!bookBtn) {
    bookBtn = document.createElement('a');
    bookBtn.href = "book-a-visit.html";
    bookBtn.className = "book-us-btn";
    bookBtn.textContent = "Book Us";
    document.body.appendChild(bookBtn);
  }

  function adjustBookButton() {
    const isMobile = window.innerWidth <= 768;
    const scrollY = window.scrollY;
    const windowHeight = window.innerHeight;
    const docHeight = document.documentElement.scrollHeight;
    const isAtBottom = scrollY + windowHeight >= docHeight - 10;

    const navIsOpen = document.body.classList.contains('nav-open');
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

  window.addEventListener('scroll', adjustBookButton);
  window.addEventListener('resize', adjustBookButton);
  adjustBookButton();


// end initWarmRight

// Initialise on DOM ready
document.addEventListener("DOMContentLoaded", window.initWarmRight);