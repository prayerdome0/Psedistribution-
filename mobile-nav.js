/* ==========================================================================
   PSE Mobile Navigation — Hamburger menu icon (bottom navigation removed)
   Styled like the Admin Dashboard menu: dark slide-out panel + overlay.
   ========================================================================== */
(function () {
    'use strict';

    var MENU_STYLE_ID = 'pseMobileNavStyles';

    function injectStyles() {
        if (document.getElementById(MENU_STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = MENU_STYLE_ID;
        style.textContent = `
            /* Hamburger trigger — same look as the admin dashboard menu button */
            .mobile-hamburger {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 36px;
                height: 36px;
                border-radius: 8px;
                background: var(--light, #f5f8fa);
                border: 1px solid var(--border, #e9edf2);
                cursor: pointer;
                transition: 0.3s ease;
                color: var(--secondary, #0b2138);
                font-size: 1.1rem;
                flex-shrink: 0;
                margin-left: auto;
                padding: 0;
                line-height: 1;
                z-index: 1001;
            }
            .mobile-hamburger:hover { background: var(--primary-light, #e6f4ef); color: var(--primary, #0e7c68); border-color: var(--primary, #0e7c68); }
            .header .container .mobile-hamburger { margin-left: 0; }

            /* Overlay — matches admin menu */
            .pse-mobile-overlay {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.3);
                backdrop-filter: blur(2px);
                z-index: 900;
            }
            .pse-mobile-overlay.show { display: block; }

            /* Slide-out panel — matches admin menu */
            .pse-mobile-menu {
                position: fixed;
                top: 0;
                left: -320px;
                width: 290px;
                height: 100%;
                background: var(--secondary, #0b2138);
                z-index: 950;
                overflow-y: auto;
                transition: left 0.3s ease;
                padding: 1rem;
                border-radius: 0;
            }
            .pse-mobile-menu.open { left: 0; box-shadow: 4px 0 30px rgba(0,0,0,0.2); }

            .pse-mobile-menu .menu-head {
                color: #ffffff;
                padding-bottom: 0.8rem;
                border-bottom: 1px solid #16334f;
                margin-bottom: 0.8rem;
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
            }
            .pse-mobile-menu .menu-head strong { font-size: 0.95rem; font-weight: 700; color: #ffffff; display: flex; align-items: center; }
            .pse-mobile-menu .menu-head strong i { color: var(--accent, #e0a62e); margin-right: 0.4rem; }
            .pse-mobile-menu .menu-head .menu-sub { font-size: 0.65rem; opacity: 0.7; margin-top: 0.1rem; font-weight: 400; }
            .pse-mobile-menu .menu-close {
                background: none;
                border: none;
                color: #a9c3d6;
                font-size: 1.2rem;
                cursor: pointer;
                padding: 0.2rem;
                transition: 0.3s ease;
                line-height: 1;
            }
            .pse-mobile-menu .menu-close:hover { color: #ffffff; }

            .pse-mobile-menu .menu-section {
                color: #698093;
                font-size: 0.6rem;
                letter-spacing: 0.12em;
                text-transform: uppercase;
                font-weight: 700;
                margin-top: 0.8rem;
                padding: 0.3rem 0.7rem 0.2rem;
            }

            /* Nav items — same as admin menu */
            .pse-mobile-menu .nav-item {
                display: flex;
                align-items: center;
                gap: 0.6rem;
                padding: 0.55rem 0.7rem;
                border-radius: 6px;
                color: #a9c3d6;
                cursor: pointer;
                transition: 0.3s ease;
                margin-bottom: 0.1rem;
                font-size: 0.78rem;
                border: none;
                background: none;
                width: 100%;
                text-align: left;
                font-family: inherit;
                text-decoration: none;
                box-sizing: border-box;
            }
            .pse-mobile-menu .nav-item:hover { background: rgba(255,255,255,0.05); color: #ffffff; }
            .pse-mobile-menu .nav-item.active { background: rgba(255,255,255,0.1); color: #ffffff; font-weight: 600; }
            .pse-mobile-menu .nav-item i { width: 18px; text-align: center; font-size: 0.9rem; }
            .pse-mobile-menu .nav-item .badge {
                margin-left: auto;
                background: #c0392b;
                color: #ffffff;
                font-size: 0.5rem;
                padding: 0.05rem 0.4rem;
                border-radius: 30px;
                min-width: 18px;
                text-align: center;
                font-weight: 700;
            }
            .pse-mobile-menu .nav-item .badge.gold { background: #e0a62e; }
            .pse-mobile-menu .nav-item .badge.green { background: var(--primary, #0e7c68); }

            /* ─── Mobile bottom navigation bar (Home / Products / Sell / Cart / Account) ─── */
            #mobileBottomNav {
                display: none;
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                background: rgba(255, 255, 255, 0.97);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                border-top: 1px solid var(--border, #e7edf3);
                box-shadow: 0 -6px 24px -12px rgba(11, 33, 56, 0.18);
                z-index: 1100;
                justify-content: space-around;
                align-items: stretch;
                padding: 0.4rem 0.5rem calc(0.4rem + env(safe-area-inset-bottom));
            }
            #mobileBottomNav a {
                position: relative;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 3px;
                font-size: 0.6rem;
                font-weight: 700;
                color: var(--text-light, #698093);
                padding: 0.25rem 0.5rem;
                border-radius: 10px;
                text-decoration: none;
                transition: 0.25s ease;
                min-width: 54px;
            }
            #mobileBottomNav a i { font-size: 1.05rem; color: var(--text-light, #698093); transition: 0.25s ease; }
            #mobileBottomNav a:hover,
            #mobileBottomNav a.active { color: var(--primary, #0e7c68); }
            #mobileBottomNav a:hover i,
            #mobileBottomNav a.active i { color: var(--primary, #0e7c68); }
            /* Sell tab — kept up top with the main items, highlighted as a primary action */
            #mobileBottomNav a.sell-tab {
                background: linear-gradient(135deg, var(--primary, #0e7c68), var(--primary-dark, #0a5a4a));
                color: #ffffff;
            }
            #mobileBottomNav a.sell-tab i { color: #ffd98a; }
            #mobileBottomNav a.sell-tab:hover,
            #mobileBottomNav a.sell-tab.active { color: #ffffff; }
            #mobileBottomNav a.sell-tab:hover i,
            #mobileBottomNav a.sell-tab.active i { color: #ffd98a; }
            /* Cart count badge — always visible so the running total shows */
            #mobileBottomNav .bottom-cart-count {
                position: absolute;
                top: 2px;
                right: 6px;
                background: var(--accent, #e0a62e);
                color: var(--secondary, #0b2138);
                font-size: 0.5rem;
                font-weight: 800;
                border-radius: 50%;
                padding: 0.05rem 0.34rem;
                min-width: 15px;
                text-align: center;
                box-shadow: 0 2px 6px rgba(224, 166, 46, 0.5);
                display: inline-flex !important;
                align-items: center;
                justify-content: center;
                line-height: 1;
            }
            /* Show the bar on small screens only and keep body content clear of it */
            @media (max-width: 768px) {
                #mobileBottomNav { display: flex; }
                body { padding-bottom: 62px; }
            }
            @media (min-width: 769px) {
                #mobileBottomNav { display: none; }
                body { padding-bottom: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    function removeBottomNav() {
        // Bottom navigation was retired — remove any stale instance + padding
        const old = document.getElementById('mobileBottomNav');
        if (old) old.remove();
        if (document.body.style.paddingBottom === '70px') {
            document.body.style.paddingBottom = '';
        }
    }

    function buildMenu(user) {
        const menu = document.createElement('div');
        menu.id = 'pseMobileMenu';
        menu.className = 'pse-mobile-menu';
        menu.setAttribute('aria-label', 'Site menu');

        const accountLink = user
            ? { href: '/account', icon: 'fa-regular fa-user', label: 'My Account' }
            : { href: '/login', icon: 'fa-regular fa-user', label: 'Login / Register' };
        const escapeHtml = function (s) {
            return String(s).replace(/[&<>"']/g, function (c) {
                return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
            });
        };
        const sub = escapeHtml(user ? (user.email || (user.displayName || 'Signed in')) : 'Guest');

        menu.innerHTML = `
            <div class="menu-head">
                <div>
                    <strong><i class="fa-solid fa-bars"></i> Menu</strong>
                    <div class="menu-sub"><i class="fa-regular fa-user" style="margin-right:0.3rem;"></i>${sub}</div>
                </div>
                <button class="menu-close" aria-label="Close menu">&times;</button>
            </div>
            <div class="menu-section">Main menu</div>
            <a class="nav-item" href="/"><i class="fa-solid fa-house"></i> Home</a>
            <a class="nav-item" href="/products"><i class="fa-solid fa-grid-2"></i> Products</a>
            <a class="nav-item" href="/seller-dashboard"><i class="fa-solid fa-store"></i> Sell</a>
            <a class="nav-item" href="/rfq"><i class="fa-regular fa-file-lines"></i> RFQ</a>
            <a class="nav-item" href="${accountLink.href}"><i class="${accountLink.icon}"></i> Account</a>
            <a class="nav-item" href="/about"><i class="fa-solid fa-circle-info"></i> About us</a>
            <div class="menu-section">Shopping</div>
            <a class="nav-item" href="/cart"><i class="fa-solid fa-cart-shopping"></i> Cart</a>
            <a class="nav-item" href="/wishlist"><i class="fa-regular fa-heart"></i> Wishlist</a>
            <a class="nav-item" href="/track-order"><i class="fa-solid fa-truck"></i> Track Order</a>
            <div class="menu-section">Account</div>
            <a class="nav-item" href="/seller-dashboard"><i class="fa-solid fa-store"></i> Seller Dashboard</a>
            <a class="nav-item" href="/become-seller"><i class="fa-solid fa-handshake"></i> Become a Seller</a>
            <div class="menu-section">Support</div>
            <a class="nav-item" href="/help-center"><i class="fa-regular fa-circle-question"></i> Help Center</a>
        `;
        return menu;
    }

    // Build the mobile bottom navigation bar: Home / Products / Sell / Cart / Account.
    // "Sell" sits up top with Home & Products (not buried at the bottom).
    function buildBottomBar() {
        if (document.getElementById('mobileBottomNav')) return;

        const path = window.location.pathname || '/';
        const tabs = [
            { href: '/', icon: 'fa-solid fa-house', label: 'Home', match: /^\/(home)?(\/|$)/ },
            { href: '/products', icon: 'fa-solid fa-box', label: 'Products', match: /^\/products/ },
            { href: '/seller-dashboard', icon: 'fa-solid fa-store', label: 'Sell', sell: true, match: /^\/(seller-dashboard|become-seller)/ },
            { href: '/cart', icon: 'fa-solid fa-cart-shopping', label: 'Cart', cart: true, match: /^\/cart/ },
            { href: '/account', icon: 'fa-regular fa-user', label: 'Account', match: /^\/(account|login|register)/ }
        ];

        const nav = document.createElement('nav');
        nav.id = 'mobileBottomNav';
        nav.setAttribute('aria-label', 'Bottom navigation');

        nav.innerHTML = tabs.map(function (t) {
            const active = t.match && t.match.test(path);
            let cls = active ? 'active' : '';
            if (t.sell) cls += (cls ? ' ' : '') + 'sell-tab';
            let badge = '';
            if (t.cart) badge = '<span class="bottom-cart-count cart-count" aria-label="Cart items">0</span>';
            return '<a href="' + t.href + '" class="' + cls + '"><i class="' + t.icon + '"></i>' + t.label + badge + '</a>';
        }).join('');

        document.body.appendChild(nav);

        // Keep the cart badge in sync once the app loads its cart count
        if (typeof window.loadCartCount === 'function') {
            try { window.loadCartCount(); } catch (e) {}
        }
    }

    function createMobileNav() {
        injectStyles();
        buildBottomBar();

        const header = document.querySelector('.header .container');
        if (!header || document.getElementById('mobileHamburger')) return;

        const user = window.getCurrentUser ? window.getCurrentUser() : null;
        const menu = buildMenu(user);
        document.body.appendChild(menu);

        const overlay = document.createElement('div');
        overlay.className = 'pse-mobile-overlay';
        document.body.appendChild(overlay);

        function openMenu() {
            menu.classList.add('open');
            overlay.classList.add('show');
            hamburger.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            hamburger.setAttribute('aria-expanded', 'true');
            hamburger.setAttribute('aria-label', 'Close menu');
            document.body.style.overflow = 'hidden';
        }
        function closeMenu() {
            menu.classList.remove('open');
            overlay.classList.remove('show');
            hamburger.innerHTML = '<i class="fa-solid fa-bars"></i>';
            hamburger.setAttribute('aria-expanded', 'false');
            hamburger.setAttribute('aria-label', 'Open menu');
            document.body.style.overflow = '';
        }

        const hamburger = document.createElement('button');
        hamburger.id = 'mobileHamburger';
        hamburger.className = 'mobile-hamburger';
        hamburger.setAttribute('aria-label', 'Open menu');
        hamburger.title = 'Menu';
        hamburger.innerHTML = '<i class="fa-solid fa-bars"></i>';

        hamburger.addEventListener('click', function (e) {
            e.stopPropagation();
            menu.classList.contains('open') ? closeMenu() : openMenu();
        });
        menu.querySelector('.menu-close').addEventListener('click', closeMenu);
        overlay.addEventListener('click', closeMenu);
        menu.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));

        // Home-page view tabs (All Products / In Stock / RFQ Deals):
        // use the home page filter when available, otherwise follow the link.
        menu.querySelectorAll('.nav-item[data-view]').forEach(function (item) {
            item.addEventListener('click', function (e) {
                if (typeof window.setProductView === 'function') {
                    e.preventDefault();
                    window.setProductView(item.dataset.view);
                    closeMenu();
                }
            });
        });

        // Place the hamburger right after the logo, like the admin header
        const logo = header.querySelector('.logo');
        if (logo && logo.nextSibling) header.insertBefore(hamburger, logo.nextSibling);
        else header.appendChild(hamburger);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createMobileNav);
    } else {
        createMobileNav();
    }

    window.PSE = window.PSE || {};
    window.PSE.mobileNav = { init: createMobileNav };
})();
