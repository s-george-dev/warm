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


//adjusts for file path
document.addEventListener("DOMContentLoaded", () => {
  const isGitHub = window.location.hostname.includes("github.io");
  const repoName = "warm"; 
  
  // Sets root to /warm/ for GitHub, or / for everything else
  const siteRoot = isGitHub ? `/${repoName}/` : "/";
  const partialsPath = siteRoot + "partials/";

  // Load Header
  loadHTML("header", partialsPath + "header.html").then(() => {
    const container = document.getElementById("header");
    if (container) {
      fixInjectedPaths(container, siteRoot);
      const headerEl = container.querySelector(".header");
      if (headerEl) headerEl.classList.add("loaded");
    }
  });

  // Load Footer
  loadHTML("footer", partialsPath + "footer.html").then(() => {
    const container = document.getElementById("footer");
    if (container) fixInjectedPaths(container, siteRoot);
  });
});

function fixInjectedPaths(container, root) {
  container.querySelectorAll('a, img').forEach(el => {
    const attr = el.tagName === 'A' ? 'href' : 'src';
    let val = el.getAttribute(attr);
    
    if (val && !val.startsWith('http') && !val.startsWith('tel:') && !val.startsWith('mailto:') && !val.startsWith('#')) {
      // Strips any existing / or ../ or ./ so the path is clean
      const cleanVal = val.replace(/^(\.\.\/|\.\/|\/)+/, '');
      el.setAttribute(attr, root + cleanVal);
    }
  });
}