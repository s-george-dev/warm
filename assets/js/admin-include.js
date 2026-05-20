// assets/js/admin-include.js

window.loadAdminHeader = async function(session) {
    const container = document.getElementById('admin-header-container');
    if (!container) return;

    try {
        // 1. Calculate the absolute site root path dynamically for GitHub Pages compatibility
        const isGitHub = window.location.hostname.includes("github.io");
        const siteRoot = isGitHub ? "/warm/" : "/";
        const partialsPath = siteRoot + "partials/";

        // Fetch using the absolute root path to avoid relative directory errors
        const response = await fetch(partialsPath + 'admin-header.html');
        const html = await response.text();
        container.innerHTML = html;

        // 2. Scan and repair all links/images inside the layout fragment to work on GitHub Pages
        fixAdminInjectedPaths(container, siteRoot);

        // 3. SET PAGE TITLE
        const titleEl = document.getElementById('nav-page-title');
        if (titleEl) titleEl.textContent = window.adminPageTitle || "Admin";

        // 4. SET USER DATA & AVATAR
        if (session && session.user) {
            const meta = session.user.user_metadata;
            const nameEl = document.getElementById('nav-display-name');
            const imgEl = document.getElementById('nav-avatar-img');
            
            if (nameEl) nameEl.textContent = meta.display_name || "Admin";
            
            if (imgEl) {
                // Ensure the avatar path honors the GitHub Pages siteRoot directory subfolder
                let avatarUrl = meta.avatar_url || "assets/images/avatar-default.avif";
                if (!avatarUrl.startsWith('http')) {
                    const cleanAvatar = avatarUrl.replace(/^(\.\.\/|\.\/|\/)+/, '');
                    imgEl.src = siteRoot + cleanAvatar;
                } else {
                    imgEl.src = avatarUrl;
                }
            }
        }

        // 5. DROPDOWN TOGGLE
        const trigger = document.getElementById('nav-drop-trigger');
        const menu = document.getElementById('nav-drop-menu');
        if (trigger && menu) {
            trigger.onclick = (e) => {
                e.stopPropagation();
                menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
            };
            document.addEventListener('click', () => menu.style.display = 'none');
        }

        // 6. LOGOUT BUTTON
        const logoutBtn = document.getElementById('nav-logout-btn');
        if (logoutBtn) {
            logoutBtn.onclick = async () => {
                if (typeof window.isAppOnline !== 'undefined' && !window.isAppOnline) {
                    alert("⚠️ You cannot log out while in Offline Mode. Please reconnect to the internet first.");
                    return;
                }

                if (window.db) {
                    await window.db.auth.signOut();
                    window.location.href = 'login.html';
                }
            };
        }
    } catch (err) {
        console.error("Critical Nav Error:", err);
    }
};

// --- Load Admin Footer ---
window.loadAdminFooter = async function() {
    const container = document.getElementById('admin-footer-container');
    if (!container) return; 

    try {
        const isGitHub = window.location.hostname.includes("github.io");
        const siteRoot = isGitHub ? "/warm/" : "/";
        const partialsPath = siteRoot + "partials/";

        const response = await fetch(partialsPath + 'admin-footer.html');
        const html = await response.text();
        container.innerHTML = html;

        // Scan and repair footer links/images
        fixAdminInjectedPaths(container, siteRoot);
    } catch (err) {
        console.error("Critical Footer Error:", err);
    }
};

// --- PATH CONVERTER UTILITY ---
// Strips relative markers and forces structural absolute directory maps
function fixAdminInjectedPaths(container, root) {
    container.querySelectorAll('a, img').forEach(el => {
        const attr = el.tagName === 'A' ? 'href' : 'src';
        let val = el.getAttribute(attr);
        if (val && !val.startsWith('http') && !val.startsWith('tel:') && !val.startsWith('mailto:') && !val.startsWith('#')) {
            const cleanVal = val.replace(/^(\.\.\/|\.\/|\/)+/, '');
            el.setAttribute(attr, root + cleanVal);
        }
    });
}


// Function to protect pages based on role
window.requireRole = async function(allowedRoles) {
    // 1. Get the current session
   const { data: { session } } = await window.db.auth.getSession();
    
    // 2. If they aren't logged in at all, kick them to login
    if (!session) {
        window.location.replace('/admin/login.html');
        return;
    }

    try {
        // 3. Decode the JWT token (the VIP badge) to read the custom stamp
        // (This safely splits the token and reads the JSON data inside)
        const payload = JSON.parse(atob(session.access_token.split('.')[1]));
        const userRole = payload.user_role || 'none'; 

        // 4. Check if their role is in the allowed list
        if (!allowedRoles.includes(userRole)) {
            console.warn(`Access denied. User role '${userRole}' not in allowed list:`, allowedRoles);
            
            // Optional: Show an alert
            alert("You do not have permission to view this page.");
            
            // Redirect them back to the Hub/Dashboard
            window.location.replace('/admin/admin-landed.html'); 
        }
    } catch (e) {
        console.error("Error reading token:", e);
        window.location.replace('/admin/login.html');
    }
};