/* ==========================================================================
   PSE Dark Mode Toggle — respects system preference + manual toggle
   ========================================================================== */
(function () {
    'use strict';

    const STORAGE_KEY = 'pse_dark_mode';

    function getPreferredTheme() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === 'dark') return 'dark';
        if (saved === 'light') return 'light';
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function applyTheme(theme) {
        const root = document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark-mode');
            root.style.setProperty('--primary', '#0f766e');
            root.style.setProperty('--primary-dark', '#134e4b');
            root.style.setProperty('--secondary', '#0f172a');
            root.style.setProperty('--light', '#1e293b');
            root.style.setProperty('--white', '#1e293b');
            root.style.setProperty('--text', '#e2e8f0');
            root.style.setProperty('--text-light', '#94a3b8');
            root.style.setProperty('--border', '#334155');
        } else {
            root.classList.remove('dark-mode');
            // Reset to original light variables
            root.style.removeProperty('--primary');
            root.style.removeProperty('--primary-dark');
            root.style.removeProperty('--secondary');
            root.style.removeProperty('--light');
            root.style.removeProperty('--white');
            root.style.removeProperty('--text');
            root.style.removeProperty('--text-light');
            root.style.removeProperty('--border');
        }
    }

    function createToggle() {
        // Only create once
        if (document.getElementById('darkModeToggle')) return;

        const toggle = document.createElement('button');
        toggle.id = 'darkModeToggle';
        toggle.className = 'dark-mode-toggle';
        toggle.innerHTML = `<i class="fa-solid fa-moon"></i>`;
        toggle.title = 'Toggle dark mode';
        toggle.style.cssText = `
            position: fixed; bottom: 90px; right: 20px; z-index: 99999;
            width: 44px; height: 44px; border-radius: 50%; border: none;
            background: #1a7b6b; color: #fff; font-size: 1.1rem;
            cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            display: flex; align-items: center; justify-content: center;
        `;

        toggle.onclick = () => {
            const isDark = document.documentElement.classList.contains('dark-mode');
            const newTheme = isDark ? 'light' : 'dark';
            localStorage.setItem(STORAGE_KEY, newTheme);
            applyTheme(newTheme);
            toggle.innerHTML = newTheme === 'dark' 
                ? `<i class="fa-solid fa-sun"></i>` 
                : `<i class="fa-solid fa-moon"></i>`;
        };

        document.body.appendChild(toggle);

        // Keyboard shortcut: Ctrl/Cmd + Shift + D
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
                e.preventDefault();
                toggle.click();
            }
        });
    }

    function initDarkMode() {
        const theme = getPreferredTheme();
        applyTheme(theme);

        // Create toggle button
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', createToggle);
        } else {
            createToggle();
        }

        // Update toggle icon on load
        setTimeout(() => {
            const toggle = document.getElementById('darkModeToggle');
            if (toggle) {
                toggle.innerHTML = theme === 'dark' 
                    ? `<i class="fa-solid fa-sun"></i>` 
                    : `<i class="fa-solid fa-moon"></i>`;
            }
        }, 300);
    }

    window.PSE = window.PSE || {};
    window.PSE.darkMode = { init: initDarkMode, apply: applyTheme };

    initDarkMode();
})();