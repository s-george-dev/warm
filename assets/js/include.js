/* ================================
    PARTIAL LOADER (Fetch/XHR)
   ================================ */
function loadHTML(id, file) {
  const isLocal = window.location.protocol === "file:";

  if (isLocal) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", file, true);
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          if (xhr.status === 200 || xhr.status === 0) {
            const el = document.getElementById(id);
            if (el) el.innerHTML = xhr.responseText;
            resolve();
          } else {
            console.error(`Failed to load local file ${file}: ${xhr.status}`);
            reject(`Failed to load ${file}`);
          }
        }
      };
      xhr.send();
    });
  } else {
    return fetch(file)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load ${file}`);
        return res.text();
      })
      .then(data => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = data;
      })
      .catch(err => console.error(err));
  }
}

/* ================================
    MAIN INITIALIZATION
   ================================ */
document.addEventListener("DOMContentLoaded", () => {
  const isGitHub = window.location.hostname.includes("github.io");
  const repoName = "warm"; 
  
  const siteRoot = isGitHub ? `/${repoName}/` : "/";
  const partialsPath = siteRoot + "partials/";

  loadHTML("header", partialsPath + "header.html").then(() => {
    const container = document.getElementById("header");
    if (container) {
      fixInjectedPaths(container, siteRoot);
      highlightActivePage(container, isGitHub);
      
      const headerEl = container.querySelector(".header");
      if (headerEl) headerEl.classList.add("loaded");
    }
  });

  loadHTML("footer", partialsPath + "footer.html").then(() => {
    const container = document.getElementById("footer");
    if (container) fixInjectedPaths(container, siteRoot);
  });
});

/* ================================
    PATH REPAIR LOGIC
   ================================ */
function fixInjectedPaths(container, root) {
  container.querySelectorAll('a, img').forEach(el => {
    const attr = el.tagName === 'A' ? 'href' : 'src';
    let val = el.getAttribute(attr);
    
    if (val && !val.startsWith('http') && !val.startsWith('tel:') && !val.startsWith('mailto:') && !val.startsWith('#')) {
      const cleanVal = val.replace(/^(\.\.\/|\.\/|\/)+/, '');
      el.setAttribute(attr, root + cleanVal);
    }
  });
}

/* ================================
    ACTIVE PAGE HIGHLIGHTER
   ================================ */
function highlightActivePage(container, isGitHub) {
  const currentPath = window.location.pathname.toLowerCase();
  const navLinks = container.querySelectorAll('a');

  // 1. Clear all active classes
  navLinks.forEach(link => link.classList.remove('active'));

  // 2. Identify actual folder (Category)
  const segments = currentPath.split('/').filter(Boolean);
  
  /**
   * If GitHub: /warm/services/repairs.html -> segments are ["warm", "services", "repairs.html"]
   * Folder is index 1.
   * If Localhost: /services/repairs.html -> segments are ["services", "repairs.html"]
   * Folder is index 0.
   */
  const currentFolder = isGitHub ? segments[1] : segments[0];

  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;

    const linkPath = link.pathname.toLowerCase();
    const linkText = link.textContent.toLowerCase().trim();

    // --- A. CHILD MATCH (The specific page) ---
    if (currentPath === linkPath && !href.startsWith('#')) {
      link.classList.add('active');
    }

    // --- B. PARENT MATCH (Services or Support) ---
    // Look for links that match the current folder name but ARE NOT in the dropdown menu
    if (currentFolder === 'services' || currentFolder === 'support') {
      const isTopLevelTrigger = linkText.includes(currentFolder) && !link.closest('.dropdown-menu');
      
      if (isTopLevelTrigger) {
        link.classList.add('active');
      }
    }
  });
}