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
  const repoName = "warm"; 
  
  // Detect if we are on GitHub or a custom domain/localhost
  const siteRoot = isGitHub ? `/${repoName}/` : "/";
  const partialsPath = siteRoot + "partials/";

  // 1. Load Header
  loadHTML("header", partialsPath + "header.html").then(() => {
    const container = document.getElementById("header");
    if (container) {
      fixInjectedPaths(container, siteRoot);
      const headerEl = container.querySelector(".header");
      if (headerEl) headerEl.classList.add("loaded");
    }
  });

  // 2. Load Footer
  loadHTML("footer", partialsPath + "footer.html").then(() => {
    const container = document.getElementById("footer");
    if (container) fixInjectedPaths(container, siteRoot);
  });
});

// This function fixes links and images in your header/footer automatically
function fixInjectedPaths(container, root) {
  container.querySelectorAll('a, img').forEach(el => {
    const attr = el.tagName === 'A' ? 'href' : 'src';
    const val = el.getAttribute(attr);
    
    // If it's a local path, prepend the site root (e.g., /warm/)
    if (val && !val.startsWith('http') && !val.startsWith('tel:') && !val.startsWith('mailto:')) {
      const cleanVal = val.startsWith('/') ? val.substring(1) : val;
      el.setAttribute(attr, root + cleanVal);
    }
  });
}