// include.js - Shared Loader

// 1. Initialize Supabase globally
if (typeof supabase !== 'undefined') {
  window.db = supabase.createClient(
    'https://axampuprcnauxbbijmmt.supabase.co', 
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4YW1wdXByY25hdXhiYmlqbW10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NDgyNjUsImV4cCI6MjA5MzMyNDI2NX0.Er1hMQbaXnR4hzHfR2my0SmtwUcUs49HaCVqYwMBHuQ'
  );
}

function loadHTML(id, file) {
  return fetch(file)
    .then(res => res.text())
    .then(data => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = data;
    });
}

document.addEventListener("DOMContentLoaded", () => {
  const isGitHub = window.location.hostname.includes("github.io");
  const siteRoot = isGitHub ? "/warm/" : "/";
  const partialsPath = siteRoot + "partials/";

  Promise.all([
    loadHTML("header", partialsPath + "header.html"),
    loadHTML("footer", partialsPath + "footer.html")
  ]).then(() => {
    const header = document.getElementById("header");
    if (header) {
      fixInjectedPaths(header, siteRoot);
      highlightActivePage(header, isGitHub);
      const headerEl = header.querySelector(".header");
      if (headerEl) headerEl.classList.add("loaded");
    }
    const footer = document.getElementById("footer");
    if (footer) fixInjectedPaths(footer, siteRoot);

    // Trigger Nav Logic after fragments are loaded
    if (typeof window.initWarmRight === "function") {
      window.initWarmRight();
    }
    document.dispatchEvent(new Event("includesLoaded"));
  });
});

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

function highlightActivePage(container, isGitHub) {
  const currentPath = window.location.pathname.toLowerCase();
  const segments = currentPath.split('/').filter(Boolean);
  const currentFolder = isGitHub ? segments[1] : segments[0];

  container.querySelectorAll('a, .mobile-dropdown-button').forEach(el => {
    el.classList.remove('active');
    if (el.tagName === 'A' && el.pathname.toLowerCase() === currentPath && el.getAttribute('href') !== '#') {
      el.classList.add('active');
    }
    if (currentFolder === 'services' || currentFolder === 'support') {
      if (el.dataset.section === currentFolder) el.classList.add('active');
    }
  });
}