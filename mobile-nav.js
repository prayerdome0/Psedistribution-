/* ==========================================================================
   PSE Mobile Navigation — Hamburger + Bottom Tab Bar
   ========================================================================== */
(function () {
    'use strict';

    function createMobileNav() {
        // Hamburger menu (top right)
        const header = document.querySelector('.header .container');
        if (header && !document.getElementById('mobileHamburger')) {
            const hamburger = document.createElement('button');
            hamburger.id = 'mobileHamburger';
            hamburger.className = 'mobile-hamburger';
            hamburger.innerHTML = `<i class="fa-solid fa-bars"></i>`;
            hamburger.style.cssText = 'display:none;background:none;border:none;font-size:1.5rem;color:#1a3a2a;cursor:pointer;margin-left:auto;';

            hamburger.onclick = () => {
                const nav = document.querySelector('.nav-categories');
                if (nav) {
                    nav.style.display = nav.style.display === 'block' ? 'none' : 'block';
                    nav.style.position = 'absolute';
                    nav.style.top = '100%';
                    nav.style.left = '0';
                    nav.style.right = '0';
                    nav.style.background = '#fff';
                    nav.style.boxShadow = '0 10px 30px rgba(0,0,0,0.1)';
                    nav.style.zIndex = '999';
                }
            };

            header.appendChild(hamburger);

            // Show only on mobile
            const media = window.matchMedia('(max-width: 768px)');
            function toggleHamburger(e) {
                hamburger.style.display = e.matches ? 'block' : 'none';
            }
            media.addEventListener('change', toggleHamburger);
            toggleHamburger(media);
        }

        // Bottom navigation bar (mobile only)
        if (!document.getElementById('mobileBottomNav') && window.innerWidth <= 768) {
            const bottomNav = document.createElement('nav');
            bottomNav.id = 'mobileBottomNav';
            bottomNav.style.cssText = `
                position: fixed; bottom: 0; left: 0; right: 0; background: #fff;
                border-top: 1px solid #e2e8ef; display: flex; justify-content: space-around;
                padding: 8px 0; z-index: 9999; box-shadow: 0 -4px 15px rgba(0,0,0,0.08);
            `;

            const user = window.getCurrentUser ? window.getCurrentUser() : null;
            const links = [
                { href: '/', icon: 'fa-home', label: 'Home' },
                { href: '/products', icon: 'fa-box', label: 'Products' },
                { href: '/cart', icon: 'fa-cart-shopping', label: 'Cart', badge: '.cart-count' },
                { href: '/account', icon: 'fa-user', label: user ? 'Account' : 'Login' },
                { href: '/become-seller', icon: 'fa-store', label: 'Sell' }
            ];

            bottomNav.innerHTML = links.map(link => `
                <a href="${link.href}" style="display:flex;flex-direction:column;align-items:center;text-decoration:none;color:#1a3a2a;font-size:0.7rem;gap:2px;">
                    <i class="fa-solid ${link.icon}" style="font-size:1.25rem;"></i>
                    <span>${link.label}</span>
                    ${link.badge ? `<span class="badge-count" style="position:absolute;top:-2px;right:-6px;background:#c0392b;color:#fff;font-size:0.55rem;padding:1px 5px;border-radius:50%;">${document.querySelector(link.badge)?.textContent || ''}</span>` : ''}
                </a>
            `).join('');

            document.body.appendChild(bottomNav);
            document.body.style.paddingBottom = '70px';
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createMobileNav);
    } else {
        createMobileNav();
    }

    window.PSE = window.PSE || {};
    window.PSE.mobileNav = { init: createMobileNav };
})();