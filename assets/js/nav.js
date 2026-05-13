/* ==========================================
   NAV.JS - DYNAMIC HOURS & UI ENGINE
   ========================================== */

/**
 * 1. HIERARCHY OF TRUTH: BUSINESS HOURS LOGIC
 * Checks Special Overrides first, then falling back to Standard Routine.
 * Now includes a look-ahead scan for the "Next Open" time.
 */
window.getOpeningStatus = async function() {
  const database = window.db; 
  if (!database) return { isOpen: false, reason: "Offline", nextOpen: null };

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  // Robust 24h time string (HH:mm:ss) for precise comparison
  const currentTime = now.getHours().toString().padStart(2, '0') + ":" + 
                      now.getMinutes().toString().padStart(2, '0') + ":" + 
                      now.getSeconds().toString().padStart(2, '0');

  async function checkDate(dateObj) {
    const dStr = dateObj.toISOString().split('T')[0];
    const dIdx = dateObj.getDay();
    try {
      // 1. Check Special Dates (Overrides/Holidays)
      // Use .maybeSingle() to avoid 406 errors if no record exists
      const { data: override } = await database.from('special_dates').select('*').eq('date', dStr).maybeSingle();
      if (override) return { ...override, date: new Date(dateObj) };
      
      // 2. Check Standard Weekly Routine
      const { data: routine } = await database.from('business_hours').select('*').eq('day_index', dIdx).maybeSingle();
      if (routine) return { ...routine, date: new Date(dateObj), reason: "Standard" };
    } catch (e) { return null; }
    return null;
  }

  // Check today's status
  const today = await checkDate(now);
  if (today && !today.is_closed) {
    if (currentTime >= today.open_time && currentTime < today.close_time) {
      return { isOpen: true, reason: today.reason };
    }
    // If it's earlier than opening time today
    if (currentTime < today.open_time) {
      return { isOpen: false, reason: today.reason, nextOpen: today };
    }
  }

  // Scanning: Office is closed. Find the next opening within the next 7 days.
  for (let i = 1; i <= 7; i++) {
    const nextDate = new Date(now);
    nextDate.setDate(now.getDate() + i);
    const nextInfo = await checkDate(nextDate);
    if (nextInfo && !nextInfo.is_closed) {
      return { isOpen: false, reason: "Closed", nextOpen: nextInfo };
    }
  }
  return { isOpen: false, reason: "Closed", nextOpen: null };
};

/**
 * 2. UI INITIALIZATION
 * Handles Hamburger, Modal Routing, and Tile updates.
 */
window.initWarmRight = async function() {
  const status = await window.getOpeningStatus();

  // Helper: Formatting the "Next Open" text with "Opening Soon" logic
  function formatNextOpen(nextOpen) {
    if (!nextOpen) return "for general enquiries";
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    const isToday = now.toDateString() === nextOpen.date.toDateString();
    const timeStr = nextOpen.open_time.substring(0, 5);

    if (isToday) {
      const [h, m] = nextOpen.open_time.split(':');
      const openDate = new Date(now);
      openDate.setHours(h, m, 0);
      const diff = (openDate - now) / 1000 / 60;
      // Opening Soon: Triggered if within 30 minutes of opening
      if (diff > 0 && diff <= 30) return "SOON! Opening at " + timeStr;
      return "today at " + timeStr;
    }
    return `${days[nextOpen.date.getDay()]} ${nextOpen.date.getDate()} ${months[nextOpen.date.getMonth()]} at ${timeStr}`;
  }

 // --- UPDATED MODAL CONTROLS (Bugs 2 & 3) ---
const callModal = document.getElementById("call-modal");
const modalForm = document.getElementById("modal-callback-form");
const modalInitial = document.getElementById("modal-initial-actions");
const modalThankYou = document.getElementById("modal-thank-you");
const btnBack = document.getElementById("btn-modal-back"); // Ensure this ID matches your 'Back' button

function openModal(directForm = false) {
  if (!callModal) return;
  callModal.style.display = "flex";
  document.body.classList.add('modal-open');

  if (directForm) {
    // BUG 3: Skip the choice screen AND hide the back button
    if (modalInitial) modalInitial.style.display = "none";
    if (modalForm) modalForm.style.display = "block";
    if (btnBack) btnBack.style.display = "none"; // Hides it when opening form directly
  } else {
    // Standard flow (Selection screen first)
    if (modalInitial) modalInitial.style.display = "block";
    if (modalForm) modalForm.style.display = "none";
    if (btnBack) btnBack.style.display = "block"; // Show it so they can go back from the form
  }
  if (modalThankYou) modalThankYou.style.display = "none";
}

// BUG 2: Fix for the "Request a Callback" button INSIDE the modal popup
const btnRequestInside = document.getElementById("btn-request-callback");
if (btnRequestInside) {
  btnRequestInside.onclick = (e) => {
    e.preventDefault();
    openModal(true); // Switches the view from 'Office Closed' to the 'Form'
  };
}

  function closeModal() {
    if (callModal) {
      callModal.style.display = "none";
      document.body.classList.remove('modal-open');
    }
  }

  // ATTACH BUTTON LISTENERS
  document.querySelectorAll('#call-to-book, .footer-call-btn, .mobile-call-btn, .request-callback-tile, .callback-direct').forEach(el => {
    el.addEventListener('click', (e) => {
      // Issue 3: If callback button, bypass choice screen and open form directly
      if (el.classList.contains('callback-direct') || el.classList.contains('request-callback-tile')) {
        e.preventDefault();
        openModal(true);
      } 
      // If office is closed, intercept general call buttons to show modal
      else if (!status.isOpen) {
        e.preventDefault();
        openModal(false);
      }
    });
  });

  // CLOSE MODAL LOGIC (Fixes Issue 2)
  document.addEventListener('click', (e) => {
    if (e.target.id === "call-modal" || 
        e.target.classList.contains('call-modal-close') || 
        e.target.classList.contains('modal-close-trigger') ||
        e.target.closest('.call-modal-close')) {
      closeModal();
    }
  });

  // --- HAMBURGER MENU (Issue 2 Fix) ---
  const menuToggle = document.querySelector('.menu-toggle');
  const mobileNav  = document.querySelector('.mobile-nav');
  const overlay    = document.querySelector('.nav-overlay');
  const wrapper    = document.querySelector('.hamburger-wrapper');

  if (menuToggle && mobileNav) {
    menuToggle.onclick = (e) => {
      e.stopPropagation();
      const isOpen = mobileNav.classList.toggle('open');
      menuToggle.classList.toggle('open', isOpen);
      document.body.classList.toggle('nav-open', isOpen);
      if (overlay) overlay.classList.toggle('open', isOpen);

      // Trigger the spin animation
      if (wrapper) {
        wrapper.classList.remove('spin');
        void wrapper.offsetWidth;
        wrapper.classList.add('spin');
      }
    };
  }

  // --- MOBILE DROPDOWNS ---
  document.querySelectorAll('.mobile-dropdown-button').forEach(btn => {
    btn.onclick = () => {
      const menu = btn.nextElementSibling;
      if (menu && menu.classList.contains('mobile-dropdown-menu')) {
        menu.classList.toggle('open');
      }
    };
  });

 // --- TILE DYNAMICS & WIDTH FIX (BUG 1) ---
const callTile = document.getElementById("call-to-book");
const callTileTitle = document.getElementById("call-to-book-title");
const callTileText = document.getElementById("call-to-book-text");
const img = callTile?.querySelector('img');

if (callTile && callTileTitle && callTileText) {
  // 1. LOCK THE WIDTH & BASE CLASSES
  // We use classList.add so we DON'T overwrite other animation classes
  callTile.classList.add("info-tile", "card"); 
  
  // Force the card to fill the grid cell regardless of the image size
  callTile.style.width = "100%";
  callTile.style.display = "flex";
  callTile.style.flexDirection = "column";
 

  const defaultTitle = callTileTitle.textContent.trim();
  let showingAlt = false;
  const nextOpenStr = formatNextOpen(status.nextOpen);
  const closedTitle = (status.reason && status.reason !== "Standard") ? status.reason : "Office Closed";

  setInterval(() => {
    callTile.classList.add("fading"); //
    
    setTimeout(() => {
      // Re-enforce base width and classes inside the loop
      callTile.classList.add("info-tile", "card");
      callTile.style.width = "100%";

      if (status.isOpen) {
        callTileTitle.textContent = showingAlt ? defaultTitle : "We’re Open Now!";
        callTileText.textContent = showingAlt ? "Call us today" : "We’re ready to help";
        callTile.classList.add("call-open"); 
        callTile.classList.remove("call-closed");
      } else {
        callTileTitle.textContent = showingAlt ? defaultTitle : closedTitle;
        callTileText.textContent = showingAlt ? "Office currently closed" : "Next open " + nextOpenStr;
        callTile.classList.add("call-closed");
        callTile.classList.remove("call-open");
      }
      
      callTile.classList.remove("fading");
      showingAlt = !showingAlt;
    }, 600);
  }, 3500);

  if (status.isOpen) callTile.setAttribute("href", "tel:08007566748"); else callTile.setAttribute("href", "javascript:void(0)");
}

  // Sync image paths using requested ../assets/ format
  if (img) {
    const isGitHub = window.location.hostname.includes("github.io");
    const assetPath = isGitHub ? "../assets/" : "assets/";
    img.src = status.isOpen ? assetPath + "images/office-open.jpg" : assetPath + "images/office-closed.jpg";
  }

  // --- FORMSPREE REDIRECT TO THANK YOU ---
  const callbackForm = document.getElementById("footer-callback-form");
  if (callbackForm) {
    callbackForm.onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(callbackForm);
      try {
        await fetch(callbackForm.action, {
          method: "POST",
          body: formData,
          headers: { "Accept": "application/json" }
        });
        // Transition to Thank You state
        if (modalForm) modalForm.style.display = "none";
        if (modalThankYou) modalThankYou.style.display = "block";
      } catch (err) {
        alert("We are sorry. There seems to be a technical problem. Please call us directly.");
      }
    };
  }
};

// Start logic only after fragments (header/footer) are loaded via include.js
document.addEventListener("includesLoaded", () => {
  const checkDb = setInterval(() => {
    if (window.db) {
      window.initWarmRight();
      clearInterval(checkDb);
    }
  }, 50);
});