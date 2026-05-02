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
  
  // This logic handles whether you are on a root page or in a subfolder
  const depth = window.location.pathname.split("/").filter(Boolean).length;
  
  // If on GitHub, use the repo name for an absolute path
  // Otherwise, use relative pathing based on folder depth
  const basePath = isGitHub
    ? `/${repoName}/partials/`
    : (depth > 1 ? "../partials/" : "partials/");

  // Load header
  loadHTML("header", basePath + "header.html").then(() => {
    const headerEl = document.querySelector("#header .header");
    if (headerEl) {
      headerEl.classList.add("loaded");
    }
  });

  // Load footer
  loadHTML("footer", basePath + "footer.html");
});