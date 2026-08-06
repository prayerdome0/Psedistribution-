/* ============================================================================
   PSE MARKETPLACE — MOBILE APP HOMEPAGE ENGINE
   Hero slider · flash countdown · product grids (featured/latest/recommended)
   · top suppliers · wishlist · notifications · category sheet · recently viewed
   ========================================================================== */
(function (window, document) {
    'use strict';

    var FEED_CACHE_KEY = 'pse_app_feed_v1';
    var FEED_CACHE_TTL = 5 * 60 * 1000;

    /* ─── FALLBACK CATALOG (used when the inventory API is unreachable) ──── */
    var FALLBACK_PRODUCTS = [
        { id: 'fb-1',  title: 'Sony WH-1000XM5 Wireless Noise-Cancelling Headphones', brand: 'Sony',      category: 'electronics', price: 249.99, oldPrice: 399.99, image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80', rating: '4.9', reviews: 1284, moq: 5 },
        { id: 'fb-2',  title: 'iPhone 15 Pro Max 256GB — Factory Sealed (Case of 10)', brand: 'Apple',     category: 'phones',     price: 1099.00, oldPrice: 1299.00, image_url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=600&q=80', rating: '4.8', reviews: 2310, moq: 10 },
        { id: 'fb-3',  title: 'MacBook Pro 14" M3 512GB — Sealed Wholesale Lot',        brand: 'Apple',     category: 'computers',  price: 1399.00, oldPrice: 1799.00, image_url: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80', rating: '4.9', reviews: 864, moq: 5 },
        { id: 'fb-4',  title: 'Nike Air Force 1 \'07 — Bulk Case (12 Pairs)',            brand: 'Nike',      category: 'fashion',    price: 79.99,  oldPrice: 115.00,  image_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80', rating: '4.7', reviews: 1752, moq: 12 },
        { id: 'fb-5',  title: 'Samsung 55" 4K QLED TV — Pallet of 6',                  brand: 'Samsung',   category: 'electronics', price: 549.00, oldPrice: 899.00, image_url: 'https://images.unsplash.com/photo-1461151304267-38535e780c79?auto=format&fit=crop&w=600&q=80', rating: '4.8', reviews: 640, moq: 6 },
        { id: 'fb-6',  title: 'Dell XPS 15 9530 Core i9 — Refurb Elite (Lot of 5)',    brand: 'Dell',      category: 'computers',  price: 999.00, oldPrice: 1450.00, image_url: 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=600&q=80', rating: '4.6', reviews: 421, moq: 5 },
        { id: 'fb-7',  title: 'Casio G-Shock GA-2100 — Wholesale Display Case (20)',   brand: 'Casio',     category: 'fashion',    price: 59.99,  oldPrice: 99.00,  image_url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80', rating: '4.7', reviews: 968, moq: 20 },
        { id: 'fb-8',  title: 'Bosch 18V Power Tool Kit — Contractor Pallet',         brand: 'Bosch',     category: 'home',       price: 189.00, oldPrice: 320.00,  image_url: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=600&q=80', rating: '4.8', reviews: 512, moq: 4 },
        { id: 'fb-9',  title: 'Bose QuietComfort Ultra Earbuds — Case of 10',         brand: 'Bose',      category: 'electronics', price: 199.00, oldPrice: 299.00, image_url: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=600&q=80', rating: '4.7', reviews: 388, moq: 10 },
        { id: 'fb-10', title: 'Adidas Ultraboost Light — Mixed Size Bulk Lot (30)',   brand: 'Adidas',    category: 'fashion',    price: 69.99,  oldPrice: 140.00,  image_url: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=600&q=80', rating: '4.6', reviews: 1105, moq: 30 },
        { id: 'fb-11', title: 'HP LaserJet Pro M479fdw — Sealed (Lot of 4)',          brand: 'HP',        category: 'computers',  price: 429.00, oldPrice: 599.00, image_url: 'https://images.unsplash.com/photo-1587831990711-23ca6441447b?auto=format&fit=crop&w=600&q=80', rating: '4.7', reviews: 296, moq: 4 },
        { id: 'fb-12', title: 'Oculus Quest 3 128GB — Wholesale Bundle (Case of 6)',  brand: 'Meta',      category: 'electronics', price: 389.00, oldPrice: 499.00, image_url: 'https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?auto=format&fit=crop&w=600&q=80', rating: '4.8', reviews: 730, moq: 6 },
        { id: 'fb-13', title: 'Apple Watch Series 9 GPS 45mm — Case of 8',            brand: 'Apple',     category: 'electronics', price: 329.00, oldPrice: 429.00, image_url: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=600&q=80', rating: '4.8', reviews: 1490, moq: 8 },
        { id: 'fb-14', title: 'KitchenAid Stand Mixer 5Qt — Wholesale Pallet (12)',   brand: 'KitchenAid', category: 'home',     price: 249.00, oldPrice: 379.00, image_url: 'https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?auto=format&fit=crop&w=600&q=80', rating: '4.7', reviews: 583, moq: 12 },
        { id: 'fb-15', title: 'Samsung Galaxy S24 Ultra 512GB — Factory Sealed (10)', brand: 'Samsung',   category: 'phones',     price: 999.00, oldPrice: 1319.00, image_url: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=600&q=80', rating: '4.8', reviews: 1122, moq: 10 },
        { id: 'fb-16', title: 'LG 27" 4K UHD Monitor — Enterprise Lot (8)',           brand: 'LG',        category: 'computers',  price: 289.00, oldPrice: 399.00, image_url: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=600&q=80', rating: '4.6', reviews: 344, moq: 8 }
    ];

    /* ─── TOP SUPPLIERS ─────────────────────────────────────────────────── */
    var SUPPLIERS = [
        { name: 'Amazon',            file: '/amazon.svg',    rating: '4.8', reviews: 1240, tier: 'Marketplace Partner' },
        { name: 'Walmart',           file: '/walmart.svg',   rating: '4.7', reviews: 986,  tier: 'Retail Partner' },
        { name: 'Apple',             file: '/apple.svg',     rating: '4.9', reviews: 2310, tier: 'Authorized Bulk' },
        { name: 'Samsung',           file: '/samsung.svg',   rating: '4.8', reviews: 1875, tier: 'Global Tech' },
        { name: 'Sony',              file: '/sony.svg',      rating: '4.8', reviews: 1102, tier: 'Audio & Gaming' },
        { name: 'Nike',              file: '/nike.svg',      rating: '4.7', reviews: 1644, tier: 'Apparel & Footwear' },
        { name: 'Dell',              file: '/dell.svg',      rating: '4.7', reviews: 873,  tier: 'Enterprise Tech' },
        { name: 'HP',                file: '/hp.svg',        rating: '4.6', reviews: 742,  tier: 'Printing & PCs' },
        { name: 'Lenovo',            file: '/lenovo.svg',    rating: '4.7', reviews: 905,  tier: 'Laptops & Servers' },
        { name: 'Adidas',            file: '/adidas.svg',    rating: '4.6', reviews: 688,  tier: 'Athletic Wholesale' },
        { name: 'Google',            file: '/google.svg',    rating: '4.8', reviews: 519,  tier: 'Hardware & Smart' },
        { name: 'LG',                file: '/lg.svg',        rating: '4.6', reviews: 434,  tier: 'Displays & Home' }
    ];

    /* ─── HELPERS ───────────────────────────────────────────────────────── */
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function money(n) {
        var v = Number(n);
        if (!isFinite(v)) v = 0;
        return v.toFixed(2);
    }

    function slugify(title) {
        return String(title || 'product').toLowerCase()
            .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 80);
    }

    function lsGet(key, fallback) {
        try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; } catch (e) { return fallback; }
    }

    function lsSet(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
    }

    function productUrl(p) {
        return '/product-detail?slug=' + encodeURIComponent(p.slug || slugify(p.title));
    }

    function stars(rating) {
        var r = Math.max(0, Math.min(5, Number(rating) || 0));
        var full = Math.round(r);
        var out = '';
        for (var i = 0; i < 5; i++) {
            out += i < full ? '<i class="fa-solid fa-star"></i>' : '<i class="fa-regular fa-star"></i>';
        }
        return out;
    }

    /* ─── WISHLIST ──────────────────────────────────────────────────────── */
    function getWishlist() {
        return lsGet('pilot_wishlist', []);
    }

    window.toggleWishlist = function (id, title, price, img, slug, btnEl) {
        var wl = getWishlist();
        var idx = wl.findIndex(function (w) { return String(w.id) === String(id); });
        if (idx >= 0) {
            wl.splice(idx, 1);
            if (btnEl) btnEl.classList.remove('active');
            if (btnEl) btnEl.querySelector('i').className = 'fa-regular fa-heart';
            if (window.pseToast) window.pseToast('Removed from wishlist', 'info');
        } else {
            wl.unshift({ id: String(id), title: String(title || 'Product'), price: Number(price) || 0, image: img || '/logo.webp', slug: slug || slugify(title), brand: 'PSE Marketplace' });
            if (btnEl) btnEl.classList.add('active');
            if (btnEl) btnEl.querySelector('i').className = 'fa-solid fa-heart';
            if (window.pseToast) window.pseToast('❤️ Saved to your wishlist', 'success');
        }
        lsSet('pilot_wishlist', wl);
        if (window.PSEMarketplace && typeof window.PSEMarketplace.syncCounters === 'function') {
            window.PSEMarketplace.syncCounters();
        }
    };

    function isWishlisted(id) {
        return getWishlist().some(function (w) { return String(w.id) === String(id); });
    }

    /* ─── CART ──────────────────────────────────────────────────────────── */
    window.handleAddToCart = function (id, title, price, img) {
        var cart = lsGet('pilot_cart', []);
        var existing = cart.find(function (item) { return String(item.id) === String(id); });
        if (existing) {
            existing.quantity = (existing.quantity || 1) + 1;
        } else {
            cart.push({ id: String(id), title: String(title || 'Product'), price: Number(price) || 0, image: img || '/logo.webp', quantity: 1 });
        }
        lsSet('pilot_cart', cart);
        if (typeof window.loadCartCount === 'function') window.loadCartCount();
        if (window.PSEMarketplace && typeof window.PSEMarketplace.openSideCart === 'function') {
            window.PSEMarketplace.openSideCart();
        }
        if (window.pseToast) window.pseToast('🛒 Added to cart — ' + String(title).substring(0, 28) + '…', 'success');
    };

    window.appBuyNow = function (id, title, price, img) {
        window.handleAddToCart(id, title, price, img);
        setTimeout(function () {
            window.location.href = '/cart';
        }, 650);
    };

    /* ─── FEED (inventory API → normalized products) ────────────────────── */
    function normalize(item) {
        var isPublicPrice = item.pricingMode === 'public' && isFinite(Number(item.publicUnitPrice));
        var availability = item.status === 'confirm-availability' || item.quantityMode === 'confirm'
            ? 'confirm'
            : (Number.isInteger(item.availableToSell) && item.availableToSell > 0 ? 'in-stock' : 'unavailable');
        return {
            id: item.dealId,
            dealId: item.dealId,
            slug: item.slug || slugify(item.title || 'product'),
            title: item.title || 'Product',
            brand: item.brand || 'PSE Marketplace',
            moq: item.moqUnits || 0,
            category: item.category || 'electronics',
            condition: item.condition || 'Brand New',
            price: isPublicPrice ? Number(item.publicUnitPrice) : 49.99,
            oldPrice: null,
            image_url: (item.imageUrls && item.imageUrls[0]) || '/logo.webp',
            availability: availability,
            rating: (4.5 + Math.random() * 0.4).toFixed(1),
            reviews: Math.floor(120 + Math.random() * 850)
        };
    }

    function fetchFeed() {
        // cached?
        try {
            var cached = JSON.parse(sessionStorage.getItem(FEED_CACHE_KEY) || 'null');
            if (cached && cached.ts && Date.now() - cached.ts < FEED_CACHE_TTL && Array.isArray(cached.items)) {
                return Promise.resolve(cached.items);
            }
        } catch (e) {}

        var origin = (window.PSEInventory && typeof window.PSEInventory.apiOrigin === 'function')
            ? window.PSEInventory.apiOrigin()
            : window.location.origin;

        var url = new URL('/api/inventory', origin);
        url.searchParams.set('limit', '60');

        return fetch(url.toString(), { headers: { 'Accept': 'application/json' } })
            .then(function (res) {
                if (!res.ok) throw new Error('feed unavailable');
                return res.json();
            })
            .then(function (payload) {
                var items = (payload && payload.data) || [];
                var products = items.map(normalize).filter(Boolean);
                try {
                    sessionStorage.setItem(FEED_CACHE_KEY, JSON.stringify({ ts: Date.now(), items: products }));
                } catch (e) {}
                return products;
            })
            .catch(function () { return []; });
    }

    /* ─── CARD TEMPLATES ────────────────────────────────────────────────── */
    function discountOf(p, fallbackIdx) {
        if (p.oldPrice && Number(p.oldPrice) > Number(p.price)) {
            return Math.round((1 - Number(p.price) / Number(p.oldPrice)) * 100);
        }
        var d = [15, 20, 25, 30, 35, 40, 45, 50][fallbackIdx % 8];
        p.oldPrice = (Number(p.price) / (1 - d / 100)).toFixed(2);
        return d;
    }

    function wishBtn(p, size) {
        var active = isWishlisted(p.id);
        return '<button type="button" class="app-wish-btn' + (active ? ' active' : '') + '" aria-label="Toggle wishlist" ' +
            'onclick="event.stopPropagation();toggleWishlist(\'' + esc(p.id) + '\',\'' + esc(p.title).replace(/'/g, "\\'") + '\',' + Number(p.price) + ',\'' + esc(p.image_url) + '\',\'' + esc(p.slug) + '\',this)">' +
            '<i class="' + (active ? 'fa-solid' : 'fa-regular') + ' fa-heart"></i></button>';
    }

    function compareBtn(p) {
        return '<button type="button" class="app-cmp-btn" title="Add to comparison" aria-label="Compare product" ' +
            'onclick="event.stopPropagation();window.PSEMarketplace && PSEMarketplace.toggleCompare({id:\'' + esc(p.id) + '\',title:\'' + esc(p.title).replace(/'/g, "\\'") + '\',price:' + Number(p.price) + ',image_url:\'' + esc(p.image_url) + '\',slug:\'' + esc(p.slug) + '\'})">' +
            '<i class="fa-solid fa-scale-balanced"></i></button>';
    }

    function gridCard(p, idx, showDiscount) {
        var disc = showDiscount ? discountOf(p, idx) : null;
        return '' +
            '<div class="app-card" onclick="window.location.href=\'' + productUrl(p) + '\'">' +
                '<div class="app-card-img">' +
                    '<img src="' + esc(p.image_url) + '" alt="' + esc(p.title) + '" loading="lazy" onerror="this.onerror=null;this.src=\'/logo.webp\'" />' +
                    wishBtn(p) + compareBtn(p) +
                    (disc ? '<span class="app-discount">-' + disc + '%</span>' : '') +
                '</div>' +
                '<div class="app-card-brand">' + esc(p.brand || 'PSE Marketplace') + ' <i class="fa-solid fa-circle-check" title="Verified product"></i></div>' +
                '<h3 class="app-card-title">' + esc(p.title) + '</h3>' +
                '<div class="app-card-rating"><span class="app-stars">' + stars(p.rating) + '</span><span class="app-rating-num">' + esc(p.rating) + '</span> (' + (p.reviews || 0).toLocaleString() + ')</div>' +
                '<div class="app-card-price">' +
                    '<span class="app-price"><small>$</small>' + money(p.price).split('.')[0] + '.<small>' + money(p.price).split('.')[1] + '</small></span>' +
                    (p.oldPrice ? '<span class="app-old-price">$' + money(p.oldPrice) + '</span>' : '') +
                '</div>' +
                '<button type="button" class="app-card-cta" onclick="event.stopPropagation();handleAddToCart(\'' + esc(p.id) + '\',\'' + esc(p.title).replace(/'/g, "\\'") + '\',' + Number(p.price) + ',\'' + esc(p.image_url) + '\')">' +
                    '<i class="fa-solid fa-cart-shopping"></i> Add to Cart' +
                '</button>' +
            '</div>';
    }

    function hCard(p, idx, opts) {
        opts = opts || {};
        var disc = opts.discount ? discountOf(p, idx) : null;
        var cta = opts.buyNow
            ? '<button type="button" class="app-card-cta app-card-cta--buy" onclick="event.stopPropagation();appBuyNow(\'' + esc(p.id) + '\',\'' + esc(p.title).replace(/'/g, "\\'") + '\',' + Number(p.price) + ',\'' + esc(p.image_url) + '\')"><i class="fa-solid fa-bolt"></i> Buy Now</button>'
            : '<button type="button" class="app-card-cta" onclick="event.stopPropagation();handleAddToCart(\'' + esc(p.id) + '\',\'' + esc(p.title).replace(/'/g, "\\'") + '\',' + Number(p.price) + ',\'' + esc(p.image_url) + '\')"><i class="fa-solid fa-cart-shopping"></i> Add</button>';
        return '' +
            '<div class="app-hcard" onclick="window.location.href=\'' + productUrl(p) + '\'">' +
                '<div class="app-card-img">' +
                    '<img src="' + esc(p.image_url) + '" alt="' + esc(p.title) + '" loading="lazy" onerror="this.onerror=null;this.src=\'/logo.webp\'" />' +
                    wishBtn(p) + compareBtn(p) +
                    (disc ? '<span class="app-discount">-' + disc + '%</span>' : '') +
                '</div>' +
                '<div class="app-card-brand">' + esc(p.brand || 'PSE Marketplace') + ' <i class="fa-solid fa-circle-check"></i></div>' +
                '<h3 class="app-card-title">' + esc(p.title) + '</h3>' +
                '<div class="app-card-rating"><span class="app-stars">' + stars(p.rating) + '</span><span class="app-rating-num">' + esc(p.rating) + '</span> (' + (p.reviews || 0).toLocaleString() + ')</div>' +
                '<div class="app-card-price">' +
                    '<span class="app-price"><small>$</small>' + money(p.price).split('.')[0] + '.<small>' + money(p.price).split('.')[1] + '</small></span>' +
                    (p.oldPrice ? '<span class="app-old-price">$' + money(p.oldPrice) + '</span>' : '') +
                '</div>' +
                cta +
            '</div>';
    }

    /* ─── RENDERERS ─────────────────────────────────────────────────────── */
    function renderInto(id, html) {
        var el = document.getElementById(id);
        if (el) el.innerHTML = html;
    }

    function renderProducts(products) {
        if (!products || !products.length) products = FALLBACK_PRODUCTS.slice();
        if (!products.length) return;

        var flash = products.slice(0, 8);
        var featured = products.slice(8, 14);
        if (featured.length < 4) featured = products.slice(0, 6);
        var latest = products.slice(14, 26);
        if (latest.length < 4) latest = products.slice(0, 6);
        var recommended = products.slice(0, 10).slice().reverse();
        if (recommended.length < 4) recommended = products.slice(0, 6);

        renderInto('flashRow', flash.map(function (p, i) { return hCard(p, i, { discount: true, buyNow: true }); }).join(''));
        renderInto('featuredGrid', featured.map(function (p, i) { return gridCard(p, i, true); }).join(''));
        renderInto('latestGrid', latest.map(function (p, i) { return gridCard(p, i, false); }).join(''));
        renderInto('recommendedRow', recommended.map(function (p, i) { return hCard(p, i, {}); }).join(''));
    }

    function renderSuppliers() {
        renderInto('suppliersRow', SUPPLIERS.map(function (s) {
            return '' +
                '<div class="app-supplier">' +
                    '<div class="app-supplier-logo"><img src="' + esc(s.file) + '" alt="' + esc(s.name) + ' logo" loading="lazy" onerror="this.onerror=null;this.src=\'/logo.webp\'" /></div>' +
                    '<div class="app-supplier-name">' + esc(s.name) + '</div>' +
                    '<span class="app-supplier-verified"><i class="fa-solid fa-circle-check"></i> Verified</span>' +
                    '<div class="app-supplier-rating"><span class="app-stars">' + stars(s.rating) + '</span> ' + esc(s.rating) + ' · ' + s.reviews.toLocaleString() + ' reviews</div>' +
                    '<a class="app-supplier-btn" href="/supplier-store?brand=' + encodeURIComponent(s.name) + '" style="display:flex;align-items:center;justify-content:center;text-decoration:none;">Visit Store</a>' +
                '</div>';
        }).join(''));
    }

    function renderRecentlyViewed() {
        var section = document.getElementById('recentlyViewedSection');
        if (!section) return;
        var recent = lsGet('pse_recently_viewed', []);
        if (!recent.length) { section.hidden = true; return; }
        section.hidden = false;
        renderInto('recentlyViewedRow', recent.slice(0, 8).map(function (p, i) {
            var norm = {
                id: p.id, title: p.title, brand: p.brand || 'PSE Marketplace',
                price: Number(p.price) || 0, image_url: p.image_url || p.image || '/logo.webp',
                slug: p.slug || slugify(p.title), rating: '4.7', reviews: 0
            };
            return hCard(norm, i, {});
        }).join(''));
    }

    /* ─── FLASH COUNTDOWN (ends at midnight, restarts daily) ────────────── */
    function initFlashTimer() {
        var el = document.getElementById('appTimer');
        if (!el) return;
        function tick() {
            var now = new Date();
            var end = new Date(now);
            end.setHours(24, 0, 0, 0);
            var diff = Math.max(0, end.getTime() - now.getTime());
            var h = Math.floor(diff / 3600000);
            var m = Math.floor((diff % 3600000) / 60000);
            var s = Math.floor((diff % 60000) / 1000);
            function pad(n) { return n < 10 ? '0' + n : '' + n; }
            el.textContent = pad(h) + ':' + pad(m) + ':' + pad(s);
        }
        tick();
        setInterval(tick, 1000);
    }

    /* ─── HERO SLIDER ───────────────────────────────────────────────────── */
    function initHero() {
        var slides = document.querySelectorAll('.app-hero-slide');
        var dots = document.querySelectorAll('.app-hero-dots button');
        if (!slides.length) return;
        var idx = 0;
        var timer = null;

        function show(i) {
            idx = (i + slides.length) % slides.length;
            slides.forEach(function (s, n) { s.classList.toggle('active', n === idx); });
            dots.forEach(function (d, n) { d.classList.toggle('active', n === idx); });
        }

        function next() { show(idx + 1); }

        function start() {
            stop();
            timer = setInterval(next, 5500);
        }
        function stop() { if (timer) clearInterval(timer); }

        dots.forEach(function (d, n) {
            d.addEventListener('click', function () { show(n); start(); });
        });

        var hero = document.getElementById('appHero');
        if (hero) {
            hero.addEventListener('touchstart', stop, { passive: true });
            hero.addEventListener('touchend', function () { setTimeout(start, 4000); }, { passive: true });
        }
        start();
    }

    /* ─── NOTIFICATIONS PANEL (static markup in index.html) ────────────── */
    function initNotifications() {
        var btn = document.getElementById('appNotifBtn');
        var panel = document.getElementById('appNotifPanel');
        var badge = document.getElementById('appNotifBadge');
        if (!btn || !panel) return;

        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            panel.hidden = !panel.hidden;
            if (!panel.hidden && badge) badge.style.display = 'none';
        });
        document.addEventListener('click', function (e) {
            if (!panel.hidden && !panel.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
                panel.hidden = true;
            }
        });
    }

    /* ─── CATEGORY BOTTOM SHEET ─────────────────────────────────────────── */
    var SHEET_CATEGORIES = [
        { name: 'Electronics',    icon: 'fa-tv',                    cat: 'electronics' },
        { name: 'Smartphones',    icon: 'fa-mobile-screen-button',  cat: 'phones' },
        { name: 'Computers',      icon: 'fa-laptop',                cat: 'computers' },
        { name: 'Fashion',        icon: 'fa-shirt',                 cat: 'fashion' },
        { name: 'Automotive',     icon: 'fa-car',                   cat: 'automotive' },
        { name: 'Home & Tools',   icon: 'fa-couch',                 cat: 'home' },
        { name: 'Sports',         icon: 'fa-baseball-bat-ball',     cat: 'sports' },
        { name: 'Liquidation',    icon: 'fa-boxes-packing',         cat: 'overstock' },
        { name: 'Today\'s Deals', icon: 'fa-bolt',                  cat: 'deals' },
        { name: 'Best Sellers',   icon: 'fa-fire',                  cat: 'bestsellers' },
        { name: 'Gaming',         icon: 'fa-gamepad',               cat: 'gaming' },
        { name: 'All Products',   icon: 'fa-border-all',            cat: 'all' }
    ];

    function buildSheet() {
        if (document.getElementById('appCatSheet')) return;
        var grid = SHEET_CATEGORIES.map(function (c) {
            var href = c.cat === 'all' ? '/products' : (c.cat === 'deals' ? '/products?filter=deals' : (c.cat === 'bestsellers' ? '/products?sort=bestsellers' : '/products?category=' + c.cat));
            return '<a class="app-sheet-cat" href="' + href + '">' +
                '<div class="app-cat-icon"><i class="fa-solid ' + c.icon + '"></i></div>' +
                '<span>' + esc(c.name) + '</span>' +
            '</a>';
        }).join('');

        var overlay = document.createElement('div');
        overlay.className = 'app-sheet-overlay';
        overlay.id = 'appSheetOverlay';
        overlay.style.display = 'none';
        overlay.addEventListener('click', closeAppCategories);

        var sheet = document.createElement('div');
        sheet.className = 'app-sheet';
        sheet.id = 'appCatSheet';
        sheet.setAttribute('role', 'dialog');
        sheet.setAttribute('aria-label', 'Browse categories');
        sheet.innerHTML =
            '<div class="app-sheet-grip"></div>' +
            '<div class="app-sheet-head"><h3>Browse Categories</h3>' +
            '<button type="button" class="app-sheet-close" onclick="closeAppCategories()" aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div>' +
            '<div class="app-sheet-grid">' + grid + '</div>' +
            '<a class="app-sheet-sell" href="/become-seller">' +
                '<div><strong>Start Selling on PSE</strong><br /><span>Reach 15,000+ verified wholesale buyers</span></div>' +
                '<i class="fa-solid fa-arrow-right"></i>' +
            '</a>';

        document.body.appendChild(overlay);
        document.body.appendChild(sheet);
    }

    window.openAppCategories = function () {
        buildSheet();
        var sheet = document.getElementById('appCatSheet');
        var overlay = document.getElementById('appSheetOverlay');
        if (!sheet) return;
        sheet.classList.add('open');
        overlay.style.display = 'block';
        document.body.style.overflow = 'hidden';
    };

    window.closeAppCategories = function () {
        var sheet = document.getElementById('appCatSheet');
        var overlay = document.getElementById('appSheetOverlay');
        if (sheet) sheet.classList.remove('open');
        if (overlay) overlay.style.display = 'none';
        document.body.style.overflow = '';
    };

    /* ─── BOTTOM NAV ────────────────────────────────────────────────────── */
    function initBottomNav() {
        document.querySelectorAll('.app-nav-item').forEach(function (item) {
            item.addEventListener('click', function () {
                var isSheet = item.getAttribute('data-nav') === 'categories';
                if (!isSheet) {
                    document.querySelectorAll('.app-nav-item').forEach(function (n) { n.classList.remove('active'); });
                    item.classList.add('active');
                }
            });
        });
    }

    /* ─── INIT ──────────────────────────────────────────────────────────── */
    function init() {
        renderSuppliers();
        renderRecentlyViewed();
        initFlashTimer();
        initHero();
        initNotifications();
        initBottomNav();
        fetchFeed().then(function (feed) {
            renderProducts(feed && feed.length ? feed : FALLBACK_PRODUCTS.slice());
        });
    }

    window.PSEMarketplaceApp = {
        init: init,
        renderProducts: renderProducts,
        renderRecentlyViewed: renderRecentlyViewed,
        refreshFeed: function () {
            try { sessionStorage.removeItem(FEED_CACHE_KEY); } catch (e) {}
            fetchFeed().then(function (feed) {
                renderProducts(feed && feed.length ? feed : FALLBACK_PRODUCTS.slice());
            });
        }
    };

})(window, document);
