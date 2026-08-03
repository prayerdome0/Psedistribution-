/* ==========================================================================
   PSE Recently Viewed Products — tracks and displays recently viewed items
   ========================================================================== */
(function () {
    'use strict';

    const STORAGE_KEY = 'pse_recently_viewed';
    const MAX_RECENT = 8;

    function getRecentlyViewed() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) { return []; }
    }

    function addRecentlyViewed(product) {
        if (!product || !product.id) return;

        let recent = getRecentlyViewed();

        // Remove duplicates
        recent = recent.filter(p => p.id !== product.id);

        // Add to front
        recent.unshift({
            id: product.id,
            title: product.title,
            price: product.price,
            image_url: product.image_url,
            slug: product.slug,
            brand: product.brand || 'Pilot Distribution'
        });

        // Limit size
        if (recent.length > MAX_RECENT) recent.length = MAX_RECENT;

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(recent));
        } catch (e) {}
    }

    function renderRecentlyViewed(containerId = 'recentlyViewedSection') {
        const container = document.getElementById(containerId);
        if (!container) return;

        const recent = getRecentlyViewed();
        if (!recent.length) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        container.innerHTML = `
            <div class="section-title" style="margin-top:2.5rem;">
                <h2>Recently <span>Viewed</span></h2>
                <p>Pick up where you left off</p>
            </div>
            <div class="product-grid" style="margin-top:1rem;">
                ${recent.map(p => `
                    <div class="product-card">
                        <div class="product-image" onclick="window.location.href='/product/${p.slug || p.id}'">
                            <img src="${p.image_url || 'logo.jpg'}" alt="${p.title}" loading="lazy">
                        </div>
                        <div class="product-title">${p.title}</div>
                        <div class="product-brand">${p.brand}</div>
                        <div class="product-price">$${(p.price || 0).toFixed(2)}</div>
                        <div class="product-actions">
                            <button class="btn-add" onclick="addToCartFromRecent('${p.id}')">
                                <i class="fa-solid fa-cart-plus"></i> Add
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Helper for recent product add to cart
    window.addToCartFromRecent = function (productId) {
        if (typeof window.addToCart === 'function') {
            window.addToCart(productId);
        } else {
            // Fallback
            const recent = getRecentlyViewed();
            const prod = recent.find(p => p.id === productId);
            if (prod) {
                const cart = JSON.parse(localStorage.getItem('pilot_cart') || '[]');
                const existing = cart.findIndex(i => i.product_id === productId);
                if (existing > -1) {
                    cart[existing].quantity = (cart[existing].quantity || 1) + 1;
                } else {
                    cart.push({ ...prod, product_id: productId, quantity: 1 });
                }
                localStorage.setItem('pilot_cart', JSON.stringify(cart));
                if (window.showToast) window.showToast('✅ Added to cart!', 'success');
            }
        }
    };

    // Expose public API
    window.PSE = window.PSE || {};
    window.PSE.recentlyViewed = {
        add: addRecentlyViewed,
        render: renderRecentlyViewed,
        get: getRecentlyViewed,
        clear: () => localStorage.removeItem(STORAGE_KEY)
    };

    // Auto-render on pages that have the container
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => renderRecentlyViewed(), 1200);
        });
    } else {
        setTimeout(() => renderRecentlyViewed(), 1200);
    }
})();