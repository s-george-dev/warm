/* ================================
    PARTIAL LOADER
   ================================ */
function loadHTML(id, file) {
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
    PATH REPAIR
   ================================ */
function fixInjectedPaths(container, root) {
  container.querySelectorAll('a, img, link').forEach(el => {
    let attr = el.tagName === 'A' ? 'href' : (el.tagName === 'LINK' ? 'href' : 'src');
    let val = el.getAttribute(attr);
    
    if (val && !val.startsWith('http') && !val.startsWith('tel:') && !val.startsWith('mailto:') && !val.startsWith('#') && !val.startsWith('data:')) {
      const cleanVal = val.replace(/^(\.\.\/|\.\/|\/)+/, '');
      el.setAttribute(attr, root + cleanVal);
    }
  });
}

/* ================================
    ACTIVE NAV HIGHLIGHTER
   ================================ */
function highlightActivePage(container, isGitHub) {
  const currentPath = window.location.pathname.toLowerCase();
  const navLinks = container.querySelectorAll('a');

  navLinks.forEach(link => link.classList.remove('active'));

  const segments = currentPath.split('/').filter(Boolean);
  const currentFolder = isGitHub ? segments[1] : segments[0];

  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;

    const linkPath = link.pathname ? link.pathname.toLowerCase() : '';

    // Exact page match
    if (currentPath === linkPath || currentPath.endsWith(href.toLowerCase())) {
      link.classList.add('active');
    }

    // Parent folder highlight (Services / Support)
    if ((currentFolder === 'services' || currentFolder === 'support') && 
        link.textContent.toLowerCase().trim().includes(currentFolder)) {
      link.classList.add('active');
    }
  });
}