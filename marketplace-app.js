/* ============================================================================
   PSE MARKETPLACE — MASTER MOBILE-FIRST JAVASCRIPT ENGINE
   Real Admin & Seller Data Integration · Firebase Firestore · App Shell
   ========================================================================== */

(function (window, document) {
    'use strict';

    /* ─── FIREBASE INITIALIZATION ───────────────────────────────────────── */
    var firebaseConfig = {
        apiKey: "AIzaSyD_ZQB6oV_RJy0sSS69ErsB2n-awh6zYbk",
        authDomain: "pilot-sales-distribution.firebaseapp.com",
        projectId: "pilot-sales-distribution",
        storageBucket: "pilot-sales-distribution.firebasestorage.app",
        messagingSenderId: "729127273727",
        appId: "1:729127273727:web:402d67be8346257755f8ca"
    };

    function initFirebase() {
        if (typeof firebase !== 'undefined' && !firebase.apps.length) {
            try {
                firebase.initializeApp(firebaseConfig);
                window.db = firebase.firestore();
                window.auth = firebase.auth();
            } catch (e) {
                console.warn('Firebase initialization note:', e);
            }
        }
    }

    /* ─── TOAST NOTIFICATION ────────────────────────────────────────────── */
    window.pseToast = function (msg, type) {
        var existing = document.getElementById('pseToast');
        if (existing) existing.remove();
        var toast = document.createElement('div');
        toast.id = 'pseToast';
        toast.className = 'pse-toast ' + (type || 'info');
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(function () { toast.classList.add('show'); }, 10);
        setTimeout(function () {
            toast.classList.remove('show');
            setTimeout(function () { toast.remove(); }, 300);
        }, 2600);
    };

    /* ─── STORAGE HELPERS ───────────────────────────────────────────────── */
    function lsGet(key, fallback) {
        try {
            var val = localStorage.getItem(key);
            return val ? JSON.parse(val) : fallback;
        } catch (e) {
            return fallback;
        }
    }

    function lsSet(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {}
    }

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function slugify(title) {
        return String(title || 'product').toLowerCase()
            .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 80);
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

    /* ─── GLOBAL MENU DRAWER (☰ top left) ───────────────────────────────── */
    function initDrawer() {
        var menuBtn = document.getElementById('appMenuBtn');
        var drawer = document.getElementById('appDrawer');
        var overlay = document.getElementById('appDrawerOverlay');
        var closeBtn = document.getElementById('appDrawerClose');

        if (!menuBtn || !drawer || !overlay) return;

        function openDrawer() {
            drawer.classList.add('open');
            overlay.classList.add('open');
            drawer.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
        }

        function closeDrawer() {
            drawer.classList.remove('open');
            overlay.classList.remove('open');
            drawer.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
        }

        menuBtn.addEventListener('click', openDrawer);
        overlay.addEventListener('click', closeDrawer);
        if (closeBtn) closeBtn.addEventListener('click', closeDrawer);

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && drawer.classList.contains('open')) {
                closeDrawer();
            }
        });
    }

    /* ─── NOTIFICATIONS PANEL ───────────────────────────────────────────── */
    function initNotifications() {
        var btn = document.getElementById('appNotifBtn');
        var panel = document.getElementById('appNotifPanel');
        var badge = document.getElementById('appNotifBadge');
        // Some pages have the bell but previously had no panel at all.
        if (btn && !panel) {
            panel = document.createElement('div');
            panel.id = 'appNotifPanel';
            panel.className = 'app-notif-panel';
            panel.hidden = true;
            panel.innerHTML = '<div style="padding:12px 14px;border-bottom:1px solid var(--app-border);font-weight:800;">Notifications</div><div style="padding:14px;color:var(--app-text-muted);font-size:13px;">No new notifications.</div>';
            (btn.closest('.app-header') || document.body).appendChild(panel);
        }
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

    /* ─── DELIVERY LOCATION (Tap to Cycle) ──────────────────────────────── */
    var PSE_LOCATIONS = [
        'Worldwide 🌐'
    ];

    function initLocation() {
        var btn = document.getElementById('appLocBtn');
        var zipEl = document.getElementById('appZip');
        if (!btn || !zipEl) return;

        // Always show Worldwide – single global delivery option
        localStorage.setItem('pse_marketplace_zip', PSE_LOCATIONS[0]);
        zipEl.textContent = PSE_LOCATIONS[0];
        btn.addEventListener('click', function () {
            window.pseToast('🌐 We deliver Worldwide', 'info');
        });
    }

    /* ─── LIVE CART & BADGE SYNC ────────────────────────────────────────── */
    // Robust badge sync that handles both legacy `id` and `product_id` shapes
    // and keeps local cart compatible with main.js Firestore cart helpers.
    window.syncCartCount = function () {
        var cart = lsGet('pilot_cart', []);
        var count = 0;
        for (var i = 0; i < cart.length; i++) {
            var it = cart[i];
            if (!it || typeof it !== 'object') continue;
            count += Number(it.quantity || 1) || 0;
        }
        document.querySelectorAll('.cart-count, #cartCount').forEach(function (el) {
            el.textContent = count;
            // app-badge should stay visible even at 0 for layout; legacy badges hide at 0
            if (el.classList && el.classList.contains('cart-count') && !el.classList.contains('app-badge')) {
                el.style.display = count > 0 ? 'inline' : 'none';
            }
        });
        try { window.dispatchEvent(new CustomEvent('pse_cart_updated', { detail: { count: count } })); } catch (e) {}
        // also let main.js know if it is loaded
        if (window.updateCartUI && window.updateCartUI !== window.syncCartCount) {
            try { /* main.js handles Firestore sync separately */ } catch(e) {}
        }
    };

    window.handleAddToCart = function (id, title, price, img) {
        if (!id) { window.pseToast('Unable to add this product — missing ID', 'error'); return; }
        var pid = String(id);
        var cleanImg = (typeof pseCleanProductImage === 'function') ? pseCleanProductImage(img || '/product-placeholder.svg') : (img || '/product-placeholder.svg');
        var cart = lsGet('pilot_cart', []);
        var existing = null;
        for (var i = 0; i < cart.length; i++) {
            var cand = cart[i];
            if (!cand) continue;
            var candId = String(cand.product_id || cand.id || cand.productId || '');
            if (candId === pid) { existing = cand; break; }
        }
        if (existing) {
            existing.quantity = (Number(existing.quantity) || 1) + 1;
            // keep images normalized (in case older entry had broken logo)
            if (cleanImg && cleanImg !== '/product-placeholder.svg') {
                existing.image = cleanImg;
                existing.image_url = cleanImg;
            }
        } else {
            cart.push({
                id: pid,
                product_id: pid,
                productId: pid,
                title: String(title || 'Wholesale Product'),
                name: String(title || 'Wholesale Product'),
                price: Number(price) || 0,
                image: cleanImg,
                image_url: cleanImg,
                quantity: 1
            });
        }
        lsSet('pilot_cart', cart);
        try { localStorage.setItem('pilot_cart_ts', String(Date.now())); } catch(e) {}
        window.syncCartCount();
        if (window.updateCartUI) { try { window.updateCartUI(); } catch(e) {} }
        window.pseToast('🛒 Added to Cart!', 'success');
    };

    /* ─── WISHLIST ──────────────────────────────────────────────────────── */
    window.getWishlist = function () {
        return lsGet('pilot_wishlist', []);
    };

    window.isWishlisted = function (id) {
        return window.getWishlist().some(function (w) { return String(w.id) === String(id); });
    };

    window.toggleWishlist = function (id, title, price, img, slug, btnEl) {
        var wl = window.getWishlist();
        var idx = wl.findIndex(function (w) { return String(w.id) === String(id); });
        if (idx >= 0) {
            wl.splice(idx, 1);
            if (btnEl) btnEl.classList.remove('active');
            if (btnEl) btnEl.querySelector('i').className = 'fa-regular fa-heart';
            window.pseToast('Removed from wishlist', 'info');
        } else {
            wl.unshift({
                id: String(id),
                title: String(title || 'Wholesale Lot'),
                price: Number(price) || 0,
                image: img || '/product-placeholder.svg',
                slug: slug || slugify(title)
            });
            if (btnEl) btnEl.classList.add('active');
            if (btnEl) btnEl.querySelector('i').className = 'fa-solid fa-heart';
            window.pseToast('❤️ Saved to wishlist!', 'success');
        }
        lsSet('pilot_wishlist', wl);
    };

    /* ─── USER & AUTH STATE SYNC ────────────────────────────────────────── */
    function updateAuthUI() {
        var user = lsGet('pilot_user', null);
        var label = document.getElementById('accountLabel');
        var drawerUser = document.getElementById('drawerUserLabel');
        var drawerAuth = document.getElementById('drawerAuthLink');

        if (user && user.full_name) {
            var firstName = user.full_name.split(' ')[0];
            if (label) label.textContent = firstName;
            if (drawerUser) drawerUser.textContent = user.full_name;
            if (drawerAuth) {
                drawerAuth.textContent = 'Sign Out';
                drawerAuth.href = '#';
                drawerAuth.onclick = function (e) {
                    e.preventDefault();
                    localStorage.removeItem('pilot_user');
                    if (window.auth && typeof window.auth.signOut === 'function') window.auth.signOut();
                    window.location.reload();
                };
            }
        } else {
            if (label) label.textContent = 'Guest';
            if (drawerUser) drawerUser.textContent = 'Hello, Guest';
            if (drawerAuth) {
                drawerAuth.textContent = 'Sign In / Register';
                drawerAuth.href = '/login';
                drawerAuth.onclick = null;
            }
        }
    }

    /* ─── BOTTOM NAVIGATION HIGHLIGHT ───────────────────────────────────── */
    function highlightBottomNav() {
        var path = window.location.pathname;
        var navItems = document.querySelectorAll('.app-nav-item');
        navItems.forEach(function (item) {
            var navType = item.getAttribute('data-nav');
            var isCurrent = false;

            if (navType === 'home' && (path === '/' || path.indexOf('index') !== -1)) isCurrent = true;
            else if (navType === 'categories' && (path.indexOf('products') !== -1 || path.indexOf('category') !== -1)) isCurrent = true;
            else if (navType === 'rfq' && path.indexOf('rfq') !== -1) isCurrent = true;
            else if (navType === 'cart' && path.indexOf('cart') !== -1) isCurrent = true;
            else if (navType === 'account' && (path.indexOf('account') !== -1 || path.indexOf('buyer-dashboard') !== -1 || path.indexOf('seller-dashboard') !== -1)) isCurrent = true;

            item.classList.toggle('active', isCurrent);
        });
    }

    /* ─── FLASH COUNTDOWN TIMER ─────────────────────────────────────────── */
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

    /* ─── PRODUCT IMAGE SANITIZER ───────────────────────────────────────── */
    // The company logo (/logo.webp) was used as a stand-in for products with
    // no image. Treat it as "no image" and substitute the neutral product
    // placeholder so the site logo never appears on a product card.
    function pseCleanProductImage(img) {
        // Imports may contain a URL, protocol-relative URL, data/blob URL,
        // Firebase/Cloudinary object, JSON array, or a comma separated CSV value.
        // Never reject a valid remote URL just because it is not from our CDN.
        if (img && typeof img === 'object') {
            if (Array.isArray(img)) return pseCleanProductImage(img[0]);
            img = img.secure_url || img.url || img.downloadURL || img.download_url || img.src || img.image_url || img.imageUrl || img.imageUrls || img.images || '';
        }
        var v = String(img || '').trim();
        if (v.charAt(0) === '[') { try { return pseCleanProductImage(JSON.parse(v)); } catch (e) {} }
        if (v.indexOf(',') !== -1 && !/^data:/i.test(v)) v = v.split(',')[0].trim();
        if (!v || v === '/logo.webp' || v === 'logo.webp') return '/product-placeholder.svg';
        // Keep absolute, protocol-relative, data/blob and ordinary site-relative URLs.
        return v;
    }
    // A broken remote image should never leave a blank card. This is delegated
    // so it also covers cards rendered by extensions and imported catalogues.
    document.addEventListener('error', function (event) {
        var img = event.target;
        if (img && img.tagName === 'IMG' && !img.dataset.pseImageFallback) {
            img.dataset.pseImageFallback = '1';
            img.src = '/product-placeholder.svg';
        }
    }, true);
    window.pseCleanProductImage = pseCleanProductImage;

    /* ─── REAL ADMIN & SELLER DATA LOADER ───────────────────────────────── */
    async function fetchLiveProducts() {
        var products = [];

        // 1. Try Firestore database where Admin & Sellers save products
        try {
            if (typeof firebase !== 'undefined') {
                initFirebase();
                if (window.db) {
                    var snapshot = await window.db.collection('products').get();
                    if (!snapshot.empty) {
                        snapshot.forEach(function (doc) {
                            var data = doc.data();
                            if (data && data.status !== 'deleted' && data.status !== 'draft') {
                                // Support all import field variants. In particular, ImgBB
                                // direct links (https://i.ibb.co/...) are ordinary HTTPS
                                // images and must not be replaced by the placeholder.
                                var sourceImages = data.image_url || data.imageUrl || data.image || data.imageUrls || data.image_urls || data.images || data.gallery || data.photos || '';
                                var img = pseCleanProductImage(sourceImages);
                                var gallery = Array.isArray(sourceImages) ? sourceImages.map(pseCleanProductImage).filter(Boolean) : [img];
                                products.push({
                                    id: doc.id,
                                    dealId: data.dealId || doc.id,
                                    title: data.title || 'Wholesale Lot',
                                    brand: data.brand || data.supplier_name || 'Verified Seller',
                                    supplier_name: data.supplier_name || data.brand || 'Verified Seller',
                                    supplier_id: data.supplier_id || 'admin',
                                    price: parseFloat(data.price) || 0,
                                    oldPrice: data.old_price ? parseFloat(data.old_price) : (data.oldPrice ? parseFloat(data.oldPrice) : null),
                                    moq: parseInt(data.moq) || 1,
                                    stock: parseInt(data.stock) || 0,
                                    category: (data.category || 'electronics').toLowerCase(),
                                    description: data.description || '',
                                    image: img,
                                    image_url: img,
                                    images: gallery.length ? gallery : [img],
                                    rating: data.rating ? String(data.rating) : '4.8',
                                    reviews: data.reviews || 0,
                                    slug: data.slug || (data.title ? slugify(data.title) : doc.id),
                                    created_at: data.created_at || ''
                                });
                            }
                        });
                    }
                }
            }
        } catch (e) {
            console.warn('Firestore fetch note:', e);
        }

        // 2. Check local live cache created by Admin/Seller
        if (!products.length) {
            try {
                var cached = JSON.parse(localStorage.getItem('pse_live_products') || '[]');
                if (Array.isArray(cached) && cached.length) {
                    // Sanitize any stale entries that carry the logo as their image.
                    products = cached.map(function (p) {
                        if (!p || typeof p !== 'object') return p;
                        var cachedImage = pseCleanProductImage(p.image || p.image_url || p.imageUrl || p.imageUrls || p.images || p.gallery || p.photos || '');
                        p.image = cachedImage;
                        p.image_url = cachedImage;
                        return p;
                    });
                }
            } catch (e) {}
        }

        // 3. Cache the verified products
        if (products.length) {
            try { localStorage.setItem('pse_live_products', JSON.stringify(products)); } catch (e) {}
        }

        window.PSEMarketplace.products = products;
        return products;
    }

    /* ─── REAL SUPPLIERS LOADER ─────────────────────────────────────────── */
    function extractRealSuppliers(products) {
        var supplierMap = {};
        products.forEach(function (p) {
            var name = p.supplier_name || p.brand || 'Verified Supplier';
            if (!supplierMap[name]) {
                var logo = '/logo.webp';
                var lower = name.toLowerCase();
                if (lower.indexOf('sony') !== -1) logo = '/sony.svg';
                else if (lower.indexOf('apple') !== -1) logo = '/apple.svg';
                else if (lower.indexOf('samsung') !== -1) logo = '/samsung.svg';
                else if (lower.indexOf('dell') !== -1) logo = '/dell.svg';
                else if (lower.indexOf('nike') !== -1) logo = '/nike.svg';
                else if (lower.indexOf('adidas') !== -1) logo = '/adidas.svg';
                else if (lower.indexOf('hp') !== -1) logo = '/hp.svg';
                else if (lower.indexOf('lenovo') !== -1) logo = '/lenovo.svg';
                else if (lower.indexOf('lg') !== -1) logo = '/lg.svg';
                else if (lower.indexOf('amazon') !== -1) logo = '/amazon.svg';
                else if (lower.indexOf('walmart') !== -1) logo = '/walmart.svg';

                supplierMap[name] = {
                    name: name,
                    file: logo,
                    rating: p.rating || '4.8',
                    reviews: p.reviews || 12,
                    supplier_id: p.supplier_id || 'admin'
                };
            }
        });

        var list = Object.values(supplierMap);
        window.PSEMarketplace.suppliers = list;
        return list;
    }

    /* ─── CARD BUILDER (Clean 2-col / 3-col Card) ────────────────────────── */
    function renderProductCard(p, isDeal) {
        var wish = window.isWishlisted(p.id);
        var price = Number(p.price || 0).toFixed(2);
        var oldPrice = p.oldPrice ? '$' + Number(p.oldPrice).toFixed(2) : '';
        var slug = p.slug || slugify(p.title);
        var detailUrl = '/product-detail?slug=' + encodeURIComponent(slug);

        return '' +
            '<div class="app-card">' +
                '<div class="app-card-img" onclick="window.location.href=\'' + detailUrl + '\'">' +
                    (isDeal ? '<span class="app-card-badge app-card-badge--deal">FLASH DEAL</span>' : '<span class="app-card-badge">VERIFIED</span>') +
                    '<button type="button" class="app-card-wish ' + (wish ? 'active' : '') + '" onclick="event.stopPropagation(); window.toggleWishlist(\'' + p.id + '\', \'' + esc(p.title) + '\', ' + p.price + ', \'' + esc(p.image) + '\', \'' + slug + '\', this)" aria-label="Save to wishlist">' +
                        '<i class="' + (wish ? 'fa-solid' : 'fa-regular') + ' fa-heart"></i>' +
                    '</button>' +
                    '<img src="' + esc(p.image || '/product-placeholder.svg') + '" alt="' + esc(p.title) + '" loading="lazy" onerror="this.src=\'/product-placeholder.svg\'" />' +
                '</div>' +
                '<div class="app-card-body">' +
                    '<div class="app-card-brand">' + esc(p.brand || p.supplier_name || 'Verified Supplier') + '</div>' +
                    '<a href="' + detailUrl + '" class="app-card-title">' + esc(p.title) + '</a>' +
                    '<div class="app-card-rating">' +
                        '<span class="app-stars">' + stars(p.rating || '4.8') + '</span>' +
                        '<span>' + esc(p.rating || '4.8') + '</span>' +
                    '</div>' +
                    '<div class="app-card-price-row">' +
                        '<span class="app-card-price">$' + price + '</span>' +
                        (oldPrice ? '<span class="app-card-oldprice">' + oldPrice + '</span>' : '') +
                    '</div>' +
                    '<div class="app-card-moq"><i class="fa-solid fa-box"></i> MOQ: ' + (p.moq || 1) + ' units</div>' +
                    '<button type="button" class="app-card-btn" onclick="window.handleAddToCart(\'' + p.id + '\', \'' + esc(p.title) + '\', ' + p.price + ', \'' + esc(p.image) + '\')">' +
                        '<i class="fa-solid fa-cart-shopping"></i> Add to Cart' +
                    '</button>' +
                '</div>' +
            '</div>';
    }

    /* ─── SUPPLIER CARD BUILDER ─────────────────────────────────────────── */
    function renderSupplierCard(s) {
        return '' +
            '<div class="app-supplier-card">' +
                '<div class="app-supplier-logo">' +
                    '<img src="' + esc(s.file) + '" alt="' + esc(s.name) + '" loading="lazy" onerror="this.src=\'/product-placeholder.svg\'" />' +
                '</div>' +
                '<div class="app-supplier-name">' + esc(s.name) + '</div>' +
                '<div class="app-supplier-verified"><i class="fa-solid fa-circle-check"></i> Verified Supplier</div>' +
                '<div class="app-supplier-rating"><span class="app-stars">' + stars(s.rating) + '</span> ' + esc(s.rating) + ' (' + s.reviews + ')</div>' +
                '<a href="/supplier-store?brand=' + encodeURIComponent(s.name) + '" class="app-supplier-btn">Visit Store</a>' +
            '</div>';
    }

    /* ─── HOMEPAGE LIVE RENDERER ────────────────────────────────────────── */
    async function renderHomepageFeed() {
        var flashGrid = document.getElementById('flashGrid');
        var featuredGrid = document.getElementById('featuredGrid');
        var suppliersGrid = document.getElementById('suppliersGrid');
        var recommendedGrid = document.getElementById('recommendedGrid');
        var recentGrid = document.getElementById('recentGrid');

        if (!flashGrid && !featuredGrid && !suppliersGrid) return;

        var products = await fetchLiveProducts();
        var suppliers = extractRealSuppliers(products);

        if (!products.length) {
            var emptyHtml = '<div style="grid-column:1/-1; text-align:center; padding:24px 12px; background:#fff; border-radius:12px; border:1px solid var(--app-border);"><i class="fa-solid fa-box-open" style="font-size:28px; color:var(--app-text-light); margin-bottom:6px;"></i><p style="font-size:12px; color:var(--app-text-muted); margin:0;">No products listed yet by verified sellers.</p></div>';
            if (flashGrid) flashGrid.innerHTML = emptyHtml;
            if (featuredGrid) featuredGrid.innerHTML = emptyHtml;
            if (suppliersGrid) suppliersGrid.innerHTML = emptyHtml;
            if (recommendedGrid) recommendedGrid.innerHTML = emptyHtml;
            if (recentGrid) recentGrid.innerHTML = emptyHtml;
            return;
        }

        if (flashGrid) {
            var deals = products.filter(function (p) { return p.oldPrice; });
            if (!deals.length) deals = products.slice(0, 4);
            flashGrid.innerHTML = deals.slice(0, 4).map(function (p) { return renderProductCard(p, true); }).join('');
        }
        if (featuredGrid) {
            featuredGrid.innerHTML = products.slice(0, 6).map(function (p) { return renderProductCard(p, false); }).join('');
        }
        if (suppliersGrid) {
            suppliersGrid.innerHTML = suppliers.slice(0, 6).map(renderSupplierCard).join('');
        }
        if (recommendedGrid) {
            recommendedGrid.innerHTML = products.slice(0, 4).map(function (p) { return renderProductCard(p, false); }).join('');
        }
        if (recentGrid) {
            var recent = products.slice().reverse();
            recentGrid.innerHTML = recent.slice(0, 4).map(function (p) { return renderProductCard(p, false); }).join('');
        }
    }

    /* ─── INIT ──────────────────────────────────────────────────────────── */
    document.addEventListener('DOMContentLoaded', function () {
        initFirebase();
        initDrawer();
        initNotifications();
        initLocation();
        window.syncCartCount();
        updateAuthUI();
        highlightBottomNav();
        initFlashTimer();
        renderHomepageFeed();
    });

    async function trackLocation() {
        var locationData = {
            latitude: null,
            longitude: null,
            ip: 'Unknown',
            country: 'Unknown',
            region: 'Unknown',
            city: 'Unknown',
            zip: 'Unknown',
            timezone: 'Unknown',
            isp: 'Unknown',
            accuracy: 'Fallback'
        };

        // 1. Try GPS Geolocation (requires user permission, but highly accurate)
        try {
            if (navigator.geolocation) {
                var position = await new Promise(function(resolve, reject) {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: true,
                        timeout: 4000
                    });
                });
                locationData.latitude = position.coords.latitude;
                locationData.longitude = position.coords.longitude;
                locationData.accuracy = 'GPS';
            }
        } catch (e) {
            console.warn('GPS geolocation permission denied or timed out. Falling back to IP geolocation.');
        }

        // 2. Try IP Geolocation (no permission required, highly reliable)
        try {
            var response = await fetch('https://ipapi.co/json/');
            if (response.ok) {
                var data = await response.json();
                locationData.ip = data.ip || 'Unknown';
                locationData.country = data.country_name || data.country || 'Unknown';
                locationData.region = data.region || 'Unknown';
                locationData.city = data.city || 'Unknown';
                locationData.zip = data.postal || 'Unknown';
                locationData.timezone = data.timezone || 'Unknown';
                locationData.isp = data.org || 'Unknown';
                if (!locationData.latitude) {
                    locationData.latitude = data.latitude;
                    locationData.longitude = data.longitude;
                    locationData.accuracy = 'IP-Based';
                }
            }
        } catch (e) {
            console.error('IP Geolocation error:', e);
        }

        return locationData;
    }

    window.PSEMarketplace = {
        initFirebase: initFirebase,
        initDrawer: initDrawer,
        syncCartCount: window.syncCartCount,
        updateAuthUI: updateAuthUI,
        fetchLiveProducts: fetchLiveProducts,
        trackLocation: trackLocation,
        products: [],
        suppliers: []
    };

})(window, document);
