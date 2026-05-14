// assets/js/admin-include.js
window.loadAdminHeader = async function(session) {
    const container = document.getElementById('admin-header-container');
    if (!container) return;

    try {
        const response = await fetch('../partials/admin-header.html');
        const html = await response.text();
        container.innerHTML = html;

        // 1. SET PAGE TITLE
        const titleEl = document.getElementById('nav-page-title');
        if (titleEl) titleEl.textContent = window.adminPageTitle || "Admin";

        // 2. SET USER DATA
        if (session && session.user) {
            const meta = session.user.user_metadata;
            const nameEl = document.getElementById('nav-display-name');
            const imgEl = document.getElementById('nav-avatar-img');
            
            if (nameEl) nameEl.textContent = meta.display_name || "Admin";
            if (imgEl) imgEl.src = meta.avatar_url || "../assets/images/avatar-default.avif";
        }

        // 3. DROPDOWN TOGGLE
        const trigger = document.getElementById('nav-drop-trigger');
        const menu = document.getElementById('nav-drop-menu');
        if (trigger && menu) {
            trigger.onclick = (e) => {
                e.stopPropagation();
                menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
            };
            document.addEventListener('click', () => menu.style.display = 'none');
        }

        // 4. LOGOUT BUTTON
        const logoutBtn = document.getElementById('nav-logout-btn');
        if (logoutBtn) {
            logoutBtn.onclick = async () => {
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