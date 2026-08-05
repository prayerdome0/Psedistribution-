/* ==========================================================================
   PSE Dark Mode Toggle — respects system preference + manual toggle
   Fixed: uses CSS variables only, no destructive inline overrides.
   ========================================================================== */
(function () {
    'use strict';

    const STORAGE_KEY = 'pse_dark_mode';

    function getPreferredTheme() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved === 'dark' || saved === 'light') return saved;
        } catch (e) {}
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function applyTheme(theme) {
        const root = document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark-mode');
            root.setAttribute('data-theme', 'dark');
        } else {
            root.classList.remove('dark-mode');
            root.setAttribute('data-theme', 'light');
        }
    }

    function injectDarkStyles() {
        if (document.getElementById('pse-dark-mode-styles')) return;
        const style = document.createElement('style');
        style.id = 'pse-dark-mode-styles';
        style.textContent = `
            html.dark-mode {
                color-scheme: dark;
            }
            html.dark-mode body {
                background: #0f172a !important;
                color: #e2e8f0 !important;
            }
            html.dark-mode .header {
                background: #0f172a !important;
                border-color: #1e293b !important;
            }
            html.dark-mode .footer {
                background: #020617 !important;
            }
            html.dark-mode .product-card,
            html.dark-mode .filters-sidebar,
            html.dark-mode .search-bar {
                background: #1e293b !important;
                border-color: #334155 !important;
            }
            html.dark-mode .top-bar {
                background: #020617 !important;
                border-color: #1e293b !important;
            }
        `;
        document.head.appendChild(style);
    }

    function createToggle() {
        if (document.getElementById('darkModeToggle')) return;
        if (/admin-dashboard|seller-dashboard|buyer-dashboard/.test(location.pathname)) return;

        const toggle = document.createElement('button');
        toggle.id = 'darkModeToggle';
        toggle.className = 'dark-mode-toggle';
        toggle.innerHTML = `<i class="fa-solid fa-moon"></i>`;
        toggle.title = 'Toggle dark mode (Ctrl+Shift+D)';
        toggle.setAttribute('aria-label', 'Toggle dark mode');
        toggle.style.cssText = `
            position: fixed; bottom: 90px; right: 20px; z-index: 9999;
            width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--border, #e9edf2);
            background: var(--white, #fff); color: var(--secondary, #0b2138); font-size: 1.1rem;
            cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.12);
            display: flex; align-items: center; justify-content: center;
            transition: all 0.2s ease;
        `;
        toggle.addEventListener('mouseenter', () => { toggle.style.transform = 'scale(1.05)'; });
        toggle.addEventListener('mouseleave', () => { toggle.style.transform = 'scale(1)'; });

        toggle.onclick = () => {
            const isDark = document.documentElement.classList.contains('dark-mode');
            const newTheme = isDark ? 'light' : 'dark';
            try { localStorage.setItem(STORAGE_KEY, newTheme); } catch (e) {}
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
        injectDarkStyles();
        const theme = getPreferredTheme();
        applyTheme(theme);

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', createToggle);
        } else {
            createToggle();
        }

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
