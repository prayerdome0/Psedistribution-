/* ============================================
   ADMIN INTEGRATION LAYER
   Connects all new features to the admin dashboard
   ============================================ */

(function() {
    'use strict';

    // Expose global function so admin can see live stats
    window.PSE_ADMIN_STATS = {
        getRfqCartCount: () => {
            try {
                const cart = JSON.parse(localStorage.getItem('pse_rfq_cart') || '[]');
                return cart.length;
            } catch(e) { return 0; }
        },
        getRecentlyViewedCount: () => {
            try {
                const views = JSON.parse(localStorage.getItem('pse_recent_views') || '[]');
                return views.length;
            } catch(e) { return 0; }
        }
    };

    // Log feature usage to admin (optional audit)
    function logFeatureUsage(feature) {
        try {
            if (window.db && window.auth && window.auth.currentUser) {
                window.db.collection('feature_usage').add({
                    feature,
                    user: window.auth.currentUser.email,
                    timestamp: new Date().toISOString()
                }).catch(() => {});
            }
        } catch(e) {}
    }

    // Auto-log important features
    document.addEventListener('click', function(e) {
        if (e.target.closest('#rfqCartFab')) logFeatureUsage('rfq_cart_opened');
        if (e.target.closest('.quickview-modal')) logFeatureUsage('quickview_used');
    });

    console.log('%c[PSE] Admin integration layer loaded', 'color:#64748b');
})();