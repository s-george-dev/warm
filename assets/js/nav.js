window.initWarmRight = function() {

  /* ================================
     NAVIGATION (Hamburger + Mobile)
  ================================== */
  const menuToggle = document.querySelector('.menu-toggle');
  const mobileNav  = document.querySelector('.mobile-nav');
  const desktopNav = document.querySelector('.nav');
  const overlay    = document.querySelector('.nav-overlay');
  const wrapper    = document.querySelector('.hamburger-wrapper');

  function closeNav() {
    if (!mobileNav || !menuToggle) return;
    mobileNav.classList.remove('open');
    menuToggle.classList.remove('open');
    document.body.classList.remove('nav-open');
    overlay?.classList.remove('open');
    if (desktopNav) desktopNav.style.display = '';
    mobileNav.style.transform = '';

    if (typeof adjustBookButton === 'function') {
      adjustBookButton();
    }
  }

  if (menuToggle && mobileNav) {
    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = mobileNav.classList.toggle('open');
      menuToggle.classList.toggle('open', isOpen);
      document.body.classList.toggle('nav-open', isOpen);
      overlay?.classList.toggle('open', isOpen);
      if (desktopNav) desktopNav.style.display = isOpen ? 'none' : '';
      mobileNav.style.transform = '';

      if (wrapper) {
        wrapper.classList.remove('spin');
        void wrapper.offsetWidth;
        wrapper.classList.add('spin');
        wrapper.addEventListener('animationend', () => {
          wrapper.classList.remove('spin');
        }, { once: true });
      }

      if (typeof adjustBookButton === 'function') {
        adjustBookButton();
      }
    });

    document.addEventListener('click', (evt) => {
      if (mobileNav.classList.contains('open') &&
          !mobileNav.contains(evt.target) &&
          !menuToggle.contains(evt.target)) {
        closeNav();
      }
    });

    overlay?.addEventListener('click', closeNav);
  }

  /* ================================
     SWIPE-TO-CLOSE (Mobile)
  ================================== */
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

  /* ================================
     BUSINESS HOURS CONFIG
  ================================== */
  const businessHours = { start: 8, end: 18 };

  function isWithinBusinessHours() {
    const now = new Date();
    const hour = now.getHours();
    return hour >= businessHours.start && hour < businessHours.end;
  }

  /* ================================
     MODAL ELEMENTS (DECLARED ONCE)
  ================================== */
  const callModal            = document.getElementById("call-modal");
  const modalCloseX          = document.getElementById("call-modal-close");
  const modalRequestCallback = document.getElementById("btn-request-callback");
  const modalBack            = document.getElementById("btn-modal-back");
  const callbackTile         = document.getElementById("callback-toggle");
  const callbackForm         = document.getElementById("footer-callback-form");

  const modalInitial   = document.getElementById("modal-initial-actions");
  const modalForm      = document.getElementById("modal-callback-form");
  const modalThankYou  = document.getElementById("modal-thank-you");

  function showClosedScreen() {
    if (modalInitial)  modalInitial.style.display = "block";
    if (modalForm)     modalForm.style.display = "none";
    if (modalThankYou) modalThankYou.style.display = "none";
  }

  function showFormOnly() {
    if (modalInitial)  modalInitial.style.display = "none";
    if (modalForm)     modalForm.style.display = "block";
    if (modalThankYou) modalThankYou.style.display = "none";
  }

  function showThankYou() {
    if (modalInitial)  modalInitial.style.display = "none";
    if (modalForm)     modalForm.style.display = "none";
    if (modalThankYou) modalThankYou.style.display = "block";
  }

  /* ================================
     CALLBACK-DIRECT CLASS SUPPORT
  ================================== */
  document.querySelectorAll(".callback-direct").forEach(el => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      if (!callModal) return;

      callModal.style.display = "flex";
      showFormOnly();
    });
  });

  /* ================================
     CALL-TO-BOOK TILE
  ================================== */
  const callTile      = document.getElementById("call-to-book");
  const callTileTitle = document.getElementById("call-to-book-title");
  const callTileText  = document.getElementById("call-to-book-text");

  const defaultTitle = callTileTitle?.textContent.trim();
  const defaultText  = callTileText?.textContent.trim();

  function swapTileText(title, text, classToAdd, classToRemove) {
    if (!callTile || !callTileTitle || !callTileText) return;

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
        if (callModal) {
          callModal.style.display = "flex";
          showClosedScreen();
        }
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
        if (callModal) {
          callModal.style.display = 'flex';
          showClosedScreen();
        }
      });
    }
  });

  /* ================================
     FOOTER CALL BUTTON
  ================================== */
  document.querySelectorAll('.footer-call-btn').forEach(btn => {
    if (isWithinBusinessHours()) {
      btn.setAttribute('href', 'tel:08007566748');
    } else {
      btn.removeAttribute('href');
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (callModal) {
          callModal.style.display = "flex";
          showClosedScreen();
        }
      });
    }
  });

  /* ================================
     MODAL HANDLERS
  ================================== */

  // Request a Callback tile
  if (callbackTile) {
    callbackTile.addEventListener("click", (e) => {
      e.preventDefault();
      if (!callModal) return;
      callModal.style.display = "flex";
      showFormOnly();
    });
  }

  // X button
  if (modalCloseX) {
    modalCloseX.addEventListener("click", () => {
      if (callModal) callModal.style.display = "none";
    });
  }

  // Grey Close buttons
  document.querySelectorAll(".modal-close-trigger").forEach(btn => {
    btn.addEventListener("click", () => {
      if (callModal) callModal.style.display = "none";
    });
  });

  // Request Callback button inside closed screen
  if (modalRequestCallback) {
    modalRequestCallback.addEventListener("click", () => {
      showFormOnly();
    });
  }

  // Back button on form → close modal
  if (modalBack) {
    modalBack.addEventListener("click", () => {
      if (callModal) callModal.style.display = "none";
    });
  }

  // AJAX form submission
  if (callbackForm) {
    callbackForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const formData = new FormData(callbackForm);

      try {
        await fetch(callbackForm.action, {
          method: "POST",
          body: formData,
          headers: { "Accept": "application/json" }
        });
      } catch (err) {
        console.error("Callback form submission failed", err);
      }

      showThankYou();
    });
  }

}; // end initWarmRight


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

if (window.initWarmRight) {
    window.initWarmRight();
}
