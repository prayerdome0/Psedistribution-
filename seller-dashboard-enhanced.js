/* ============================================
   SELLER DASHBOARD ENHANCEMENTS
   Premium seller experience connected to admin
   ============================================ */

(function() {
    'use strict';

    function enhanceSellerDashboard() {
        // Add premium badges and quick stats if on seller dashboard
        if (!location.pathname.includes('seller-dashboard')) return;

        const header = document.querySelector('.seller-header, .page-header');
        if (header && !document.getElementById('sellerPremiumBadge')) {
            const badge = document.createElement('div');
            badge.id = 'sellerPremiumBadge';
            badge.style.cssText = 'display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,#e0a62e,#c8901f);color:#0b2138;padding:4px 14px;border-radius:30px;font-size:0.75rem;font-weight:700;margin-left:12px;';
            badge.innerHTML = `<i class="fa-solid fa-crown"></i> Premium Seller`;
            header.appendChild(badge);
        }
    }

    document.addEventListener('DOMContentLoaded', enhanceSellerDashboard);
})();