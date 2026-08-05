/* ============================================
   ENHANCED MOBILE BOTTOM NAVIGATION
   Professional B2B mobile experience
   ============================================ */

(function() {
    'use strict';

    function createEnhancedMobileNav() {
        if (document.getElementById('enhancedMobileNav')) return;
        if (window.innerWidth > 768) return;

        const nav = document.createElement('nav');
        nav.id = 'enhancedMobileNav';
        nav.style.cssText = `
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: #fff;
            border-top: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-around;
            padding: 8px 4px calc(8px + env(safe-area-inset-bottom));
            z-index: 9999;
            box-shadow: 0 -4px 20px rgba(0,0,0,0.08);
        `;

        nav.innerHTML = `
            <a href="/" style="display:flex;flex-direction:column;align-items:center;font-size:10px;color:#334155;text-decoration:none;gap:2px;">
                <i class="fa-solid fa-home" style="font-size:1.15rem;"></i>
                <span>Home</span>
            </a>
            <a href="/products" style="display:flex;flex-direction:column;align-items:center;font-size:10px;color:#334155;text-decoration:none;gap:2px;">
                <i class="fa-solid fa-boxes-stacked" style="font-size:1.15rem;"></i>
                <span>Products</span>
            </a>
            <a href="/rfq" style="display:flex;flex-direction:column;align-items:center;font-size:10px;color:#0e7c68;text-decoration:none;gap:2px;">
                <i class="fa-regular fa-file-lines" style="font-size:1.15rem;"></i>
                <span>RFQ</span>
            </a>
            <a href="/cart" style="display:flex;flex-direction:column;align-items:center;font-size:10px;color:#334155;text-decoration:none;gap:2px;position:relative;">
                <i class="fa-solid fa-cart-shopping" style="font-size:1.15rem;"></i>
                <span>Cart</span>
                <span class="badge-count cart-count" style="position:absolute;top:-2px;right:-4px;font-size:8px;background:#c0392b;color:#fff;border-radius:50%;width:15px;height:15px;display:flex;align-items:center;justify-content:center;">0</span>
            </a>
            <a href="/account" style="display:flex;flex-direction:column;align-items:center;font-size:10px;color:#334155;text-decoration:none;gap:2px;">
                <i class="fa-regular fa-user" style="font-size:1.15rem;"></i>
                <span>Account</span>
            </a>
        `;

        document.body.appendChild(nav);

        // Update cart count
        setTimeout(() => {
            if (typeof loadCartCount === 'function') loadCartCount();
        }, 500);
    }

    // Initialize
    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('mobileBottomNav')) {
            createEnhancedMobileNav();
        }
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth <= 768 && !document.getElementById('enhancedMobileNav')) {
            createEnhancedMobileNav();
        }
    });
})();