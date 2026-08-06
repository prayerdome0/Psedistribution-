/* ==========================================================================
   PSE Recently Viewed Products — tracks and displays recently viewed items
   Fixed: XSS-safe escaping, logo.webp fallback, robust IDs
   ========================================================================== */
(function () {
    'use strict';

    const STORAGE_KEY = 'pse_recently_viewed';
    const MAX_RECENT = 8;

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function getRecentlyViewed() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) { return []; }
    }

    function addRecentlyViewed(product) {
        if (!product || !product.id) return;

        let recent = getRecentlyViewed();
        recent = recent.filter(p => p.id !== product.id);
        recent.unshift({
            id: String(product.id),
            title: String(product.title || 'Product'),
            price: parseFloat(product.price) || 0,
            image_url: String(product.image_url || product.image || '/product-placeholder.svg'),
            slug: String(product.slug || product.id),
            brand: String(product.brand || 'Pilot Distribution')
        });
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
                        <div class="product-image" onclick="window.location.href='/product/${esc(p.slug || p.id)}'">
                            <img src="${esc(p.image_url || '/product-placeholder.svg')}" alt="${esc(p.title)}" loading="lazy" onerror="this.onerror=null;this.src='/product-placeholder.svg'">
                        </div>
                        <div class="product-title">${esc(p.title)}</div>
                        <div class="product-brand">${esc(p.brand)}</div>
                        <div class="product-price">$${(parseFloat(p.price) || 0).toFixed(2)}</div>
                        <div class="product-actions">
                            <button class="btn-add" onclick="addToCartFromRecent('${esc(p.id)}')">
                                <i class="fa-solid fa-cart-plus"></i> Add
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    window.addToCartFromRecent = function (productId) {
        if (typeof window.addToCart === 'function') {
            window.addToCart(productId);
        } else {
            const recent = getRecentlyViewed();
            const prod = recent.find(p => p.id === productId);
            if (prod) {
                try {
                    const cart = JSON.parse(localStorage.getItem('pilot_cart') || '[]');
                    const existing = cart.findIndex(i => i.product_id === productId);
                    if (existing > -1) {
                        cart[existing].quantity = (cart[existing].quantity || 1) + 1;
                    } else {
                        cart.push({ ...prod, product_id: productId, quantity: 1 });
                    }
                    localStorage.setItem('pilot_cart', JSON.stringify(cart));
                    if (window.showToast) window.showToast('✅ Added to cart!', 'success');
                    if (window.loadCartCount) window.loadCartCount();
                } catch(e){}
            }
        }
    };

    window.PSE = window.PSE || {};
    window.PSE.recentlyViewed = {
        add: addRecentlyViewed,
        render: renderRecentlyViewed,
        get: getRecentlyViewed,
        clear: () => { try{ localStorage.removeItem(STORAGE_KEY);}catch(e){} }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => renderRecentlyViewed(), 1200);
        });
    } else {
        setTimeout(() => renderRecentlyViewed(), 1200);
    }
})();
