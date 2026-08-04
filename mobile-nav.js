/* ==========================================================================
   PSE Mobile Navigation — Hamburger menu icon (bottom navigation removed)
   ========================================================================== */
(function () {
    'use strict';

    var MENU_STYLE_ID = 'pseMobileNavStyles';

    function injectStyles() {
        if (document.getElementById(MENU_STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = MENU_STYLE_ID;
        style.textContent = `
            .mobile-hamburger {
                display: none;
                background: none;
                border: none;
                font-size: 1.6rem;
                color: #1a3a2a;
                cursor: pointer;
                margin-left: auto;
                padding: 0.3rem 0.5rem;
                border-radius: 10px;
                line-height: 1;
                z-index: 1001;
            }
            .mobile-hamburger:hover { background: #f0f4f8; }
            @media (max-width: 768px) {
                .mobile-hamburger { display: block; }
            }
            .pse-mobile-menu {
                position: fixed;
                top: 0;
                right: 0;
                bottom: 0;
                width: min(320px, 84vw);
                background: #ffffff;
                box-shadow: -12px 0 40px rgba(0,0,0,0.18);
                z-index: 10000;
                transform: translateX(105%);
                transition: transform 0.25s ease;
                overflow-y: auto;
                padding: 1rem 1.1rem 2rem;
            }
            .pse-mobile-menu.open { transform: translateX(0); }
            .pse-mobile-menu .menu-head {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding-bottom: 0.7rem;
                border-bottom: 1px solid #e9edf2;
                margin-bottom: 0.6rem;
            }
            .pse-mobile-menu .menu-head strong { font-size: 1rem; color: #0b2a3b; }
            .pse-mobile-menu .menu-close {
                background: #f0f4f8;
                border: none;
                width: 34px;
                height: 34px;
                border-radius: 50%;
                font-size: 1.1rem;
                color: #0b2a3b;
                cursor: pointer;
            }
            .pse-mobile-menu a {
                display: flex;
                align-items: center;
                gap: 0.7rem;
                padding: 0.65rem 0.6rem;
                border-radius: 10px;
                color: #1a3340;
                font-weight: 600;
                font-size: 0.92rem;
                text-decoration: none;
            }
            .pse-mobile-menu a:hover { background: #e8f5f0; color: #0f4f43; }
            .pse-mobile-menu a i { width: 20px; text-align: center; color: #1a7b6b; }
            .pse-mobile-menu .menu-section {
                margin: 0.7rem 0 0.2rem;
                font-size: 0.65rem;
                letter-spacing: 0.12em;
                text-transform: uppercase;
                color: #6a889a;
                font-weight: 700;
            }
            .pse-mobile-menu .menu-highlight {
                background: #e8f5f0;
                color: #0f4f43;
            }
            .pse-mobile-overlay {
                position: fixed;
                inset: 0;
                background: rgba(11,26,42,0.45);
                z-index: 9999;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.25s ease;
            }
            .pse-mobile-overlay.show { opacity: 1; pointer-events: auto; }
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

        menu.innerHTML = `
            <div class="menu-head">
                <strong><i class="fa-solid fa-bars" style="color:#1a7b6b;margin-right:0.4rem;"></i> Menu</strong>
                <button class="menu-close" aria-label="Close menu">&times;</button>
            </div>
            <a href="/"><i class="fa-solid fa-home"></i> Home</a>
            <a href="/products"><i class="fa-solid fa-box"></i> Products</a>
            <a href="/catalogs"><i class="fa-solid fa-file-pdf"></i> Catalogs</a>
            <a href="/rfq"><i class="fa-regular fa-file-lines"></i> Request Quote</a>
            <a href="/inventory-upload" class="menu-highlight"><i class="fa-solid fa-cloud-upload"></i> Upload Inventory</a>
            <div class="menu-section">Shopping</div>
            <a href="/cart"><i class="fa-solid fa-cart-shopping"></i> Cart</a>
            <a href="/wishlist"><i class="fa-regular fa-heart"></i> Wishlist</a>
            <a href="/track-order"><i class="fa-solid fa-truck"></i> Track Order</a>
            <div class="menu-section">Account</div>
            <a href="${accountLink.href}"><i class="${accountLink.icon}"></i> ${accountLink.label}</a>
            <a href="/seller-dashboard"><i class="fa-solid fa-store"></i> Seller Dashboard</a>
            <a href="/become-seller"><i class="fa-solid fa-handshake"></i> Become a Seller</a>
            <div class="menu-section">Support</div>
            <a href="/about"><i class="fa-solid fa-circle-info"></i> About</a>
            <a href="/contact"><i class="fa-solid fa-envelope"></i> Contact</a>
            <a href="/help-center"><i class="fa-regular fa-circle-question"></i> Help Center</a>
        `;
        return menu;
    }

    function createMobileNav() {
        injectStyles();
        removeBottomNav();

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
        }
        function closeMenu() {
            menu.classList.remove('open');
            overlay.classList.remove('show');
            hamburger.innerHTML = '<i class="fa-solid fa-bars"></i>';
        }

        const hamburger = document.createElement('button');
        hamburger.id = 'mobileHamburger';
        hamburger.className = 'mobile-hamburger';
        hamburger.setAttribute('aria-label', 'Open menu');
        hamburger.innerHTML = '<i class="fa-solid fa-bars"></i>';

        hamburger.addEventListener('click', function (e) {
            e.stopPropagation();
            menu.classList.contains('open') ? closeMenu() : openMenu();
        });
        menu.querySelector('.menu-close').addEventListener('click', closeMenu);
        overlay.addEventListener('click', closeMenu);
        menu.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
        window.addEventListener('resize', function () {
            if (window.innerWidth > 768) closeMenu();
        });

        header.appendChild(hamburger);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createMobileNav);
    } else {
        createMobileNav();
    }

    window.PSE = window.PSE || {};
    window.PSE.mobileNav = { init: createMobileNav };
})();
