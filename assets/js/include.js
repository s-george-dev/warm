function loadHTML(id, file) {
  const isLocal = window.location.protocol === "file:";
  if (isLocal) {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", file, true);
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && (xhr.status === 200 || xhr.status === 0)) {
          const el = document.getElementById(id);
          if (el) el.innerHTML = xhr.responseText;
          resolve();
        }
      };
      xhr.send();
    });
  } else {
    return fetch(file)
      .then(res => res.text())
      .then(data => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = data;
      });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const isGitHub = window.location.hostname.includes("github.io");
  const siteRoot = isGitHub ? "/warm/" : "/";
  const partialsPath = siteRoot + "partials/";

  Promise.all([
    loadHTML("header", partialsPath + "header.html"),
    loadHTML("footer", partialsPath + "footer.html")
  ]).then(() => {
    const headerContainer = document.getElementById("header");
    if (headerContainer) {
      fixInjectedPaths(headerContainer, siteRoot);
      highlightActivePage(headerContainer, isGitHub);
      
      const headerEl = headerContainer.querySelector(".header");
      if (headerEl) headerEl.classList.add("loaded");
    }

    const footerContainer = document.getElementById("footer");
    if (footerContainer) fixInjectedPaths(footerContainer, siteRoot);

    // Force initWarmRight after everything is loaded
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
  
  // 1. Identify the current folder (services or support)
  const segments = currentPath.split('/').filter(Boolean);
  const currentFolder = isGitHub ? segments[1] : segments[0];

  container.querySelectorAll('a, .mobile-dropdown-button').forEach(el => {
    el.classList.remove('active');
    
    // Highlight specific links
    if (el.tagName === 'A') {
      const linkPath = el.pathname.toLowerCase();
      if (currentPath === linkPath && el.getAttribute('href') !== '#') {
        el.classList.add('active');
      }
    }

    // Parent Section Highlighting (Folder match)
    if (currentFolder === 'services' || currentFolder === 'support') {
     if (el.dataset.section === currentFolder) {
    el.classList.add('active');
}

    }
  });
}
document.dispatchEvent(new Event("includesLoaded"));
