/* ==========================================
   NAV.JS - DYNAMIC HOURS & UI ENGINE
   ========================================== */

window.getOpeningStatus = async function() {
  const database = window.db; 
  if (!database) return { isOpen: false, reason: "Offline", nextOpen: null };

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const currentTime = now.getHours().toString().padStart(2, '0') + ":" + 
                      now.getMinutes().toString().padStart(2, '0') + ":" + 
                      now.getSeconds().toString().padStart(2, '0');

  async function checkDate(dateObj) {
    const dStr = dateObj.toISOString().split('T')[0];
    const dIdx = dateObj.getDay();
    try {
      const { data: override } = await database.from('special_dates').select('*').eq('date', dStr).maybeSingle();
      if (override) return { ...override, date: new Date(dateObj) };
      const { data: routine } = await database.from('business_hours').select('*').eq('day_index', dIdx).maybeSingle();
      if (routine) return { ...routine, date: new Date(dateObj), reason: "Standard" };
    } catch (e) { return null; }
    return null;
  }

  const today = await checkDate(now);
  if (today && !today.is_closed) {
    if (currentTime >= today.open_time && currentTime < today.close_time) {
      return { isOpen: true, reason: today.reason };
    }
    if (currentTime < today.open_time) {
      return { isOpen: false, reason: today.reason, nextOpen: today };
    }
  }

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

window.initWarmRight = async function() {
  const status = await window.getOpeningStatus();

  function formatNextOpen(nextOpen) {
    if (!nextOpen) return "for general enquiries";
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    const isToday = now.toDateString() === nextOpen.date.toDateString();
    const timeStr = nextOpen.open_time.substring(0, 5);
    
    const getOrdinal = (d) => {
        if (d > 3 && d < 21) return 'th';
        switch (d % 10) {
            case 1:  return "st";
            case 2:  return "nd";
            case 3:  return "rd";
            default: return "th";
        }
    };
    const dayNum = nextOpen.date.getDate();
    const suffix = getOrdinal(dayNum);

    if (isToday) {
        const [h, m] = nextOpen.open_time.split(':');
        const openDate = new Date(now);
        openDate.setHours(h, m, 0);
        const diff = (openDate - now) / 1000 / 60;
        // Refined for better sentence flow: "at 08:00 (Opening Soon!)"
        if (diff > 0 && diff <= 30) return timeStr + " (Opening Soon!)";
        return "today at " + timeStr;
    }
    return `${days[nextOpen.date.getDay()]} ${dayNum}${suffix} ${months[nextOpen.date.getMonth()]} at ${timeStr}`;
  }

  const nextOpenStr = formatNextOpen(status.nextOpen);
  const phoneNum = "0800 756 6748";

  const callModal = document.getElementById("call-modal");
  const modalForm = document.getElementById("modal-callback-form");
  const modalInitial = document.getElementById("modal-initial-actions");
  const modalThankYou = document.getElementById("modal-thank-you");
  const btnBack = document.getElementById("btn-modal-back");

  function openModal(directForm = false) {
    if (!callModal) return;
    callModal.style.display = "flex";
    document.body.classList.add('modal-open');

    // SURGICAL TEXT UPDATE
    if (!status.isOpen && modalInitial) {
        const modalP = modalInitial.querySelector('.modal-left-text');
        const formIntro = modalForm?.querySelector('p');
        
        // Phrasing optimized for both "Soon" and future dates
        const reopenMsg = `we re-open, which is <b>${nextOpenStr}</b>`;

        if (modalP) {
            modalP.innerHTML = `You can still get in touch below, or call us when ${reopenMsg}`;
        }
        if (formIntro) {
            formIntro.innerHTML = `Please provide your details below. Since our office is currently closed, an engineer will be in touch as soon as ${reopenMsg}.`;
        }
    }

    if (directForm) {
      if (modalInitial) modalInitial.style.display = "none";
      if (modalForm) modalForm.style.display = "block";
      if (btnBack) btnBack.style.display = "none";
    } else {
      if (modalInitial) modalInitial.style.display = "block";
      if (modalForm) modalForm.style.display = "none";
      if (btnBack) btnBack.style.display = "block";
    }
    if (modalThankYou) modalThankYou.style.display = "none";
  }

  const btnRequestInside = document.getElementById("btn-request-callback");
  if (btnRequestInside) {
    btnRequestInside.onclick = (e) => {
      e.preventDefault();
      openModal(true);
    };
  }

  function closeModal() {
    if (callModal) {
      callModal.style.display = "none";
      document.body.classList.remove('modal-open');
    }
  }

  document.querySelectorAll('#call-to-book, .footer-call-btn, .mobile-call-btn, .request-callback-tile, .callback-direct').forEach(el => {
    el.addEventListener('click', (e) => {
      if (el.classList.contains('callback-direct') || el.classList.contains('request-callback-tile')) {
        e.preventDefault();
        openModal(true);
      } 
      else if (!status.isOpen) {
        e.preventDefault();
        openModal(false);
      }
    });
  });

  document.addEventListener('click', (e) => {
    if (e.target.id === "call-modal" || 
        e.target.classList.contains('call-modal-close') || 
        e.target.classList.contains('modal-close-trigger') ||
        e.target.closest('.call-modal-close')) {
      closeModal();
    }
  });

  /* --- TILE DYNAMICS --- */
  const callTile = document.getElementById("call-to-book");
  const callTileText = document.getElementById("call-to-book-text");
  const img = callTile?.querySelector('img');

  if (callTile && callTileText) {
    // PRESERVED YOUR WORKING LAYOUT STYLES
    callTile.classList.add("info-tile", "card"); 
    callTile.style.width = "100%";
    callTile.style.display = "flex";
    callTile.style.flexDirection = "column";

    let loopIndex = 0;

    setInterval(() => {
      callTileText.classList.add("fading"); 
      
      setTimeout(() => {
        if (status.isOpen) {
          const openState = loopIndex % 2;
          callTileText.innerHTML = openState === 0
            ? `<span style="color: #22c55e; font-weight: bold;">Office Open</span><br><b>${phoneNum}</b>`
            : `Press here to call us directly<br><b>${phoneNum}</b>`;
          callTile.classList.add("call-open"); 
          callTile.classList.remove("call-closed");
        } else {
          const closedState = loopIndex % 3;
          if (closedState === 0) {
              callTileText.innerHTML = `<span style="color: #ef4444; font-weight: bold;">Office Currently Closed</span><br>for general enquiries`;
          } else if (closedState === 1) {
              callTileText.innerHTML = `<span style="color: #ef4444; font-weight: bold;">Emergency assistance 24/7</span><br><b>${phoneNum}</b>`;
          } else {
              callTileText.innerHTML = `Next open:<br><b>${nextOpenStr}</b>`;
          }
          callTile.classList.add("call-closed");
          callTile.classList.remove("call-open");
        }
        
        callTileText.classList.remove("fading");
        loopIndex++;
      }, 600);
    }, 3500);

    if (status.isOpen) callTile.setAttribute("href", "tel:08007566748"); 
    else callTile.setAttribute("href", "javascript:void(0)");
  }

  if (img) {
    img.src = status.isOpen 
      ? "../assets/images/office-open.jpg" 
      : "../assets/images/office-closed.jpg";
  }


// --- NEW HIGHLIGHT LOGIC IN NAV.JS ---
function applyHighlights() {
    const currentPath = window.location.pathname.toLowerCase();
    const segments = currentPath.split('/').filter(Boolean);
    
    // Check if we are on GitHub or local (GitHub usually has the repo name as segment[0])
    const isGitHub = window.location.hostname.includes("github.io");
    const currentFolder = isGitHub ? segments[1] : segments[0];

    document.querySelectorAll('#header a, .mobile-dropdown-button').forEach(el => {
        el.classList.remove('active');

        // 1. Highlight the specific page link
        if (el.tagName === 'A' && el.pathname.toLowerCase() === currentPath && el.getAttribute('href') !== '#') {
            el.classList.add('active');
        }

        // 2. Highlight the Parent Folder (Services/Support)
        // This relies on your HTML having data-section="services" or "support"
        if (currentFolder === 'services' || currentFolder === 'support') {
            if (el.dataset.section === currentFolder) {
                el.classList.add('active');
            }
        }
    });
}

// Trigger it immediately when initWarmRight runs
applyHighlights();








  // Hamburger / Nav logic unchanged
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
      if (wrapper) { wrapper.classList.remove('spin'); void wrapper.offsetWidth; wrapper.classList.add('spin'); }
    };
  }
  document.querySelectorAll('.mobile-dropdown-button').forEach(btn => {
  btn.onclick = () => {
    const menu = btn.nextElementSibling;
    const isAlreadyOpen = menu.classList.contains('open');

    // 1. Close ALL other mobile menus first
    document.querySelectorAll('.mobile-dropdown-menu').forEach(m => {
      m.classList.remove('open');
    });

    // 2. Only open this one if it wasn't already open 
    // (This allows the user to click to close it as well)
    if (!isAlreadyOpen && menu && menu.classList.contains('mobile-dropdown-menu')) {
      menu.classList.add('open');
    }
  };
});

  const callbackForm = document.getElementById("footer-callback-form");
  if (callbackForm) {
    callbackForm.onsubmit = async (e) => {
      e.preventDefault();
      try {
        await fetch(callbackForm.action, { method: "POST", body: new FormData(callbackForm), headers: { "Accept": "application/json" } });
        if (modalForm) modalForm.style.display = "none";
        if (modalThankYou) modalThankYou.style.display = "block";
      } catch (err) { alert("Technical problem. Please call us directly."); }
    };
  }
};

document.addEventListener("includesLoaded", () => {
  const checkDb = setInterval(() => {
    if (window.db) { window.initWarmRight(); clearInterval(checkDb); }
  }, 50);
});