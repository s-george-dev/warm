function loadHTML(id, file) {
  const isLocal = window.location.protocol === "file:";

  if (isLocal) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", file, true);
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          if (xhr.status === 200 || xhr.status === 0) {
            document.getElementById(id).innerHTML = xhr.responseText;
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
        document.getElementById(id).innerHTML = data;
      })
      .catch(err => console.error(err));
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const isGitHub = window.location.hostname.includes("github.io");
  const repoName = "warm"; //
  
  // 1. Determine the root path of the site
  // If on GitHub, root is /warm/. If on custom domain, root is /
  const siteRoot = isGitHub ? `/${repoName}/` : "/";
  const partialsPath = siteRoot + "partials/";

  // 2. Load the Header
  loadHTML("header", partialsPath + "header.html").then(() => {
    const headerContainer = document.getElementById("header");
    if (headerContainer) {
      fixHeaderPaths(headerContainer, siteRoot);
      
      // Keep your existing fade-in logic
      const headerEl = headerContainer.querySelector(".header");
      if (headerEl) headerEl.classList.add("loaded");
    }
  });

  // 3. Load the Footer
  loadHTML("footer", partialsPath + "footer.html").then(() => {
      const footerContainer = document.getElementById("footer");
      if (footerContainer) fixHeaderPaths(footerContainer, siteRoot);
  });
});

/**
 * Automatically fixes links and images inside the injected HTML
 */
function fixHeaderPaths(container, root) {
  // Fix all navigation links
  container.querySelectorAll('a').forEach(link => {
    const href = link.getAttribute('href');
    // Only fix local links (don't touch tel:, mailto:, or external http links)
    if (href && !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
      // Remove any leading slash the link might have to avoid double slashes
      const cleanHref = href.startsWith('/') ? href.substring(1) : href;
      link.setAttribute('href', root + cleanHref);
    }
  });
/*
  // Fix the Logo image
  container.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src');
    if (src && !src.startsWith('http')) {
      const cleanSrc = src.startsWith('/') ? src.substring(1) : src;
      img.setAttribute('src', root + cleanSrc);
    }
  });
  */
}