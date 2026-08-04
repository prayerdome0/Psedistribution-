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
                background: var(--light, #f0f4f8);
                border: 1px solid var(--border, #e9edf2);
                cursor: pointer;
                transition: 0.3s ease;
                color: var(--secondary, #0b2a3b);
                font-size: 1.1rem;
                flex-shrink: 0;
                margin-left: auto;
                padding: 0;
                line-height: 1;
                z-index: 1001;
            }
            .mobile-hamburger:hover { background: var(--primary-light, #e8f5f0); color: var(--primary, #1a7b6b); border-color: var(--primary, #1a7b6b); }
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
                background: var(--secondary, #0b2a3b);
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
                border-bottom: 1px solid #1a4055;
                margin-bottom: 0.8rem;
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
            }
            .pse-mobile-menu .menu-head strong { font-size: 0.95rem; font-weight: 700; color: #ffffff; display: flex; align-items: center; }
            .pse-mobile-menu .menu-head strong i { color: var(--accent, #f1c40f); margin-right: 0.4rem; }
            .pse-mobile-menu .menu-head .menu-sub { font-size: 0.65rem; opacity: 0.7; margin-top: 0.1rem; font-weight: 400; }
            .pse-mobile-menu .menu-close {
                background: none;
                border: none;
                color: #b4d0e0;
                font-size: 1.2rem;
                cursor: pointer;
                padding: 0.2rem;
                transition: 0.3s ease;
                line-height: 1;
            }
            .pse-mobile-menu .menu-close:hover { color: #ffffff; }

            .pse-mobile-menu .menu-section {
                color: #6a889a;
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
                color: #b4d0e0;
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
            .pse-mobile-menu .nav-item .badge.gold { background: #f39c12; }
            .pse-mobile-menu .nav-item .badge.green { background: var(--primary, #1a7b6b); }
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
            <a class="nav-item" href="/"><i class="fa-solid fa-home"></i> Home</a>
            <div class="menu-section">Browse</div>
            <a class="nav-item active" data-view="all" href="/products"><i class="fa-solid fa-grid-2"></i> All Products</a>
            <a class="nav-item" data-view="available" href="/products"><i class="fa-solid fa-circle-check"></i> In Stock</a>
            <a class="nav-item" data-view="rfq" href="/rfq"><i class="fa-regular fa-file-lines"></i> RFQ Deals</a>
            <a class="nav-item" href="/products"><i class="fa-solid fa-box"></i> All</a>
            <a class="nav-item" href="/catalogs"><i class="fa-solid fa-file-pdf"></i> Catalogs</a>
            <a class="nav-item" href="/rfq"><i class="fa-regular fa-file-lines"></i> RFQ</a>
            <a class="nav-item" href="/contact"><i class="fa-solid fa-envelope"></i> Contact</a>
            <a class="nav-item" href="/inventory-upload"><i class="fa-solid fa-cloud-upload"></i> Upload Inventory <span class="badge gold">NEW</span></a>
            <div class="menu-section">Shopping</div>
            <a class="nav-item" href="/cart"><i class="fa-solid fa-cart-shopping"></i> Cart</a>
            <a class="nav-item" href="/wishlist"><i class="fa-regular fa-heart"></i> Wishlist</a>
            <a class="nav-item" href="/track-order"><i class="fa-solid fa-truck"></i> Track Order</a>
            <div class="menu-section">Account</div>
            <a class="nav-item" href="${accountLink.href}"><i class="${accountLink.icon}"></i> ${accountLink.label}</a>
            <a class="nav-item" href="/seller-dashboard"><i class="fa-solid fa-store"></i> Seller Dashboard</a>
            <a class="nav-item" href="/become-seller"><i class="fa-solid fa-handshake"></i> Become a Seller</a>
            <div class="menu-section">Support</div>
            <a class="nav-item" href="/about"><i class="fa-solid fa-circle-info"></i> About</a>
            <a class="nav-item" href="/help-center"><i class="fa-regular fa-circle-question"></i> Help Center</a>
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
