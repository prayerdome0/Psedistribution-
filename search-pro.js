/* ============================================================================
 * PSE Pro Search — professional search suggestions engine
 * ----------------------------------------------------------------------------
 * A zero-dependency, self-contained upgrade for the header search bar
 * (drops into any page that has #searchBar / #searchInput / #searchResults).
 *
 * What it adds over the old inline search:
 *   • Instant debounced suggestions as you type (no Enter needed)
 *   • Ranked product results — prefix & word matches beat substring matches
 *   • Rich previews: thumbnail, brand, ★ rating, price, stock, ✓ Verified badge
 *   • Category & brand chips that deep-link into the catalog
 *   • Recent searches (localStorage, clearable) + Popular searches (derived)
 *   • Full keyboard navigation: ↑ / ↓ / Enter / Esc (ARIA listbox semantics)
 *   • Search-term highlighting, "See all N results" footer with match count
 *   • Catalog cached in sessionStorage (10 min) so suggestions are instant
 *   • Works even when Firebase is blocked — embedded fallback catalog
 *   • Backwards-compatible window.handleSearch for legacy callers
 *
 * No frameworks, no API keys, no server. (c) PSE Distribution.
 * ==========================================================================*/
(function () {
    'use strict';

    // ─── CONFIG ────────────────────────────────────────────────────────────────
    var CFG = {
        debounceMs: 120,            // input debounce
        maxProducts: 6,             // product rows shown
        maxChips: 12,               // max chips in a chips row
        maxRecent: 6,               // recent searches kept
        catalogCacheKey: 'pse_pro_search_catalog_v1',
        catalogCacheTtlMs: 10 * 60 * 1000, // 10 minutes
        recentKey: 'pse_pro_recent_searches_v1',
        firestoreLimit: 500,
        dbWaitMs: 12000,            // how long to wait for the page's Firestore
        dbPollMs: 250
    };

    // ─── FALLBACK CATALOG (synced with products.html & product-detail.html) ───
    // Used when Firestore is unavailable, blocked, or simply not ready — so the
    // pro search still returns meaningful suggestions on every page.
    var FALLBACK_PRODUCTS = [
        { id: '1', title: 'Premium Wireless Headphones', brand: 'Sony', price: 89.99, old_price: 129.99, image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=200&h=200&q=80', moq: 10, supplier_verified: true, category: 'electronics', rating: 4.8, stock: 150, sku: 'WH-1000XM4', slug: 'premium-wireless-headphones' },
        { id: '2', title: 'Smartphone 5G 128GB', brand: 'Samsung', price: 499.99, old_price: 599.99, image_url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=200&h=200&q=80', moq: 5, supplier_verified: true, category: 'electronics', rating: 4.9, stock: 85, sku: 'S23-128', slug: 'smartphone-5g-128gb' },
        { id: '3', title: 'Organic Cotton T-Shirt', brand: 'Nike', price: 24.99, old_price: 34.99, image_url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=200&h=200&q=80', moq: 20, supplier_verified: false, category: 'fashion', rating: 4.2, stock: 200, sku: 'CT-ORG-01', slug: 'organic-cotton-t-shirt' },
        { id: '4', title: 'Professional Kitchen Knife Set', brand: 'Zwilling', price: 149.99, old_price: 199.99, image_url: 'https://images.unsplash.com/photo-1593618998160-e3408e6769a1?auto=format&fit=crop&w=200&h=200&q=80', moq: 6, supplier_verified: true, category: 'home', rating: 4.7, stock: 45, sku: 'KK-PRO-04', slug: 'professional-kitchen-knife-set' },
        { id: '5', title: 'LED Desk Lamp', brand: 'Philips', price: 39.99, old_price: 59.99, image_url: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=200&h=200&q=80', moq: 15, supplier_verified: true, category: 'home', rating: 4.5, stock: 120, sku: 'LED-DL-05', slug: 'led-desk-lamp' },
        { id: '6', title: 'Fitness Tracker Watch', brand: 'Garmin', price: 129.99, old_price: 169.99, image_url: 'https://images.unsplash.com/photo-1576243345690-4e4b79b63288?auto=format&fit=crop&w=200&h=200&q=80', moq: 10, supplier_verified: true, category: 'sports', rating: 4.6, stock: 60, sku: 'FT-GAR-06', slug: 'fitness-tracker-watch' },
        { id: '7', title: 'Leather Wallet', brand: 'Coach', price: 49.99, old_price: 69.99, image_url: 'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=200&h=200&q=80', moq: 12, supplier_verified: false, category: 'fashion', rating: 4.0, stock: 80, sku: 'LW-COA-07', slug: 'leather-wallet' },
        { id: '8', title: 'Wireless Charging Pad', brand: 'Anker', price: 29.99, old_price: 39.99, image_url: 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?auto=format&fit=crop&w=200&h=200&q=80', moq: 25, supplier_verified: true, category: 'electronics', rating: 4.3, stock: 300, sku: 'WC-ANK-08', slug: 'wireless-charging-pad' }
    ];

    // ─── STATE ────────────────────────────────────────────────────────────────
    var input = null, panel = null, bar = null, btn = null;
    var catalog = null;          // normalized merged catalog
    var catalogPromise = null;   // in-flight / cached load promise
    var dbTimer = null;          // Firestore polling timer
    var debounceTimer = null;
    var activeIndex = -1;        // keyboard cursor over selectable nodes
    var lastQuery = '';          // query currently rendered

    // ─── TINY HELPERS ─────────────────────────────────────────────────────────
    function $(id) { return document.getElementById(id); }
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function num(v) {
        var n = parseFloat(v);
        return isNaN(n) ? 0 : n;
    }
    function money(v) {
        var n = num(v);
        try {
            return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
        } catch (e) { return '$' + n.toFixed(2); }
    }
    function slugify(title) {
        return String(title || 'product').toLowerCase()
            .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 80);
    }
    function normalizeProduct(p) {
        if (!p) return null;
        var title = p.title || p.name || 'Product';
        return {
            id: String(p.id || title || Math.random().toString(36).slice(2)),
            title: String(title),
            brand: String(p.brand || ''),
            price: num(p.price),
            old_price: num(p.old_price),
            image_url: p.image_url || (Array.isArray(p.images) && p.images[0]) || p.image || '',
            slug: p.slug || slugify(title),
            category: String(p.category || 'other'),
            rating: num(p.rating),
            stock: num(p.stock),
            moq: num(p.moq),
            supplier_verified: !!p.supplier_verified,
            sku: p.sku ? String(p.sku) : ''
        };
    }

    // ─── CATALOG LOADING (cache → Firestore → embedded fallback) ──────────────
    function readCache() {
        try {
            var raw = sessionStorage.getItem(CFG.catalogCacheKey);
            if (!raw) return null;
            var cached = JSON.parse(raw);
            if (cached && cached.ts && Date.now() - cached.ts < CFG.catalogCacheTtlMs
                && Array.isArray(cached.items) && cached.items.length) {
                return cached.items.map(normalizeProduct).filter(Boolean);
            }
        } catch (e) { /* storage blocked / corrupt → ignore */ }
        return null;
    }

    function writeCache(items) {
        try {
            sessionStorage.setItem(CFG.catalogCacheKey,
                JSON.stringify({ ts: Date.now(), items: items }));
        } catch (e) { /* non-fatal */ }
    }

    // Wait until the page's inline script exposes window.db (its Firestore).
    // If the Firebase SDK itself never loaded (blocked CDN / ad-blocker), bail
    // out immediately so the embedded fallback catalog kicks in without delay.
    function waitForDb(timeoutMs) {
        return new Promise(function (resolve) {
            if (typeof firebase === 'undefined') return resolve(null);
            if (window.db) return resolve(window.db);
            var waited = 0;
            var t = setInterval(function () {
                waited += CFG.dbPollMs;
                if (window.db) { clearInterval(t); resolve(window.db); }
                else if (waited >= timeoutMs) { clearInterval(t); resolve(null); }
            }, CFG.dbPollMs);
        });
    }

    function loadFromFirestore() {
        return waitForDb(CFG.dbWaitMs).then(function (db) {
            if (!db) {
                // Try a self-owned named app as a second chance (page exposes
                // `firebaseConfig` as a top-level const in its inline script).
                try {
                    if (typeof firebase !== 'undefined' && typeof firebaseConfig !== 'undefined') {
                        var app = firebase.initializeApp(firebaseConfig, 'pse-pro-search');
                        db = firebase.firestore(app);
                    }
                } catch (e) { db = null; }
            }
            if (!db) return null;
            return db.collection('products')
                .where('status', 'in', ['active', 'approved'])
                .limit(CFG.firestoreLimit)
                .get()
                .then(function (snap) {
                    var out = [];
                    snap.forEach(function (doc) { out.push(doc.data()); });
                    return out.length ? out : null;
                });
        });
    }

    function mergeCatalogs(fireProducts, fallback) {
        var seen = {};
        var merged = [];
        fireProducts.forEach(function (p) {
            var n = normalizeProduct(p);
            if (!n) return;
            seen[n.title.toLowerCase()] = true;
            merged.push(n);
        });
        fallback.forEach(function (p) {
            var n = normalizeProduct(p);
            if (!n || seen[n.title.toLowerCase()]) return;
            seen[n.title.toLowerCase()] = true;
            merged.push(n);
        });
        return merged;
    }

    function loadCatalog() {
        if (catalogPromise) return catalogPromise;
        var cached = readCache();
        if (cached) {
            catalog = cached;
            catalogPromise = Promise.resolve(cached);
            return catalogPromise;
        }
        catalogPromise = loadFromFirestore()
            .catch(function () { return null; })
            .then(function (fireProducts) {
                var merged = mergeCatalogs(fireProducts || [], FALLBACK_PRODUCTS);
                catalog = merged;
                writeCache(merged);
                return merged;
            });
        return catalogPromise;
    }

    function getCatalogSync() {
        return catalog || FALLBACK_PRODUCTS.map(normalizeProduct);
    }

    // ─── SEARCH RANKING ───────────────────────────────────────────────────────
    function tokenize(q) {
        return q.toLowerCase().split(/\s+/).filter(Boolean);
    }

    function scoreProduct(p, qLower, tokens) {
        var title = p.title.toLowerCase();
        var brand = p.brand.toLowerCase();
        var cat = p.category.toLowerCase();
        var score = 0;

        if (title === qLower) score += 220;                       // exact title
        else if (title.indexOf(qLower) === 0) score += 130;       // prefix
        else if (title.indexOf(' ' + qLower) !== -1) score += 70; // whole word

        var matchedTokens = 0;
        tokens.forEach(function (t) {
            if (!t) return;
            if (title.indexOf(t) === 0) score += 40;
            else if (title.indexOf(' ' + t) !== -1) score += 28;
            else if (title.indexOf(t) !== -1) { score += 16; matchedTokens++; }
            else if (brand.indexOf(t) !== -1) score += 12;
            else if (cat.indexOf(t) !== -1) score += 10;
        });
        if (tokens.length === 1 && matchedTokens) score += 8;

        if (brand.indexOf(qLower) === 0) score += 32;
        else if (brand.indexOf(qLower) !== -1) score += 14;
        if (cat.indexOf(qLower) === 0) score += 24;
        else if (cat.indexOf(qLower) !== -1) score += 10;

        // slight tie-breaker — only boosts products that already matched
        if (score > 0 && p.supplier_verified) score += 3;
        return score;
    }

    function search(query) {
        var q = (query || '').trim();
        if (!q) return [];
        var qLower = q.toLowerCase();
        var tokens = tokenize(q);
        var scored = [];
        getCatalogSync().forEach(function (p) {
            var s = scoreProduct(p, qLower, tokens);
            if (s > 0) scored.push({ p: p, s: s });
        });
        scored.sort(function (a, b) {
            if (b.s !== a.s) return b.s - a.s;
            if (b.p.rating !== a.p.rating) return b.p.rating - a.p.rating;
            return b.p.stock - a.p.stock;
        });
        return scored.map(function (x) { return x.p; });
    }

    // ─── HIGHLIGHTING ─────────────────────────────────────────────────────────
    function escapeRegExp(s) {
        return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    function highlight(text, query) {
        var safe = esc(text);
        var q = (query || '').trim();
        if (!q) return safe;
        try {
            var re = new RegExp('(' + escapeRegExp(q) + ')', 'ig');
            return safe.replace(re, '<mark>$1</mark>');
        } catch (e) { return safe; }
    }

    // ─── RECENT SEARCHES ──────────────────────────────────────────────────────
    function getRecent() {
        try {
            var raw = localStorage.getItem(CFG.recentKey);
            var arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr.slice(0, CFG.maxRecent) : [];
        } catch (e) { return []; }
    }
    function addRecent(query) {
        var q = (query || '').trim();
        if (!q) return;
        try {
            var arr = getRecent().filter(function (x) {
                return x.toLowerCase() !== q.toLowerCase();
            });
            arr.unshift(q);
            localStorage.setItem(CFG.recentKey, JSON.stringify(arr.slice(0, CFG.maxRecent)));
        } catch (e) { /* non-fatal */ }
    }
    function clearRecent() {
        try { localStorage.removeItem(CFG.recentKey); } catch (e) {}
    }

    // ─── POPULAR SEARCHES (derived from catalog) ─────────────────────────────
    function buildPopular() {
        var cats = {}, brands = {};
        getCatalogSync().forEach(function (p) {
            if (p.category && p.category !== 'other') {
                cats[p.category] = (cats[p.category] || 0) + 1;
            }
            if (p.brand) brands[p.brand] = (brands[p.brand] || 0) + 1;
        });
        var topCats = Object.keys(cats).sort(function (a, b) { return cats[b] - cats[a]; }).slice(0, 3);
        var topBrands = Object.keys(brands).sort(function (a, b) { return brands[b] - brands[a]; }).slice(0, 2);
        var list = topCats.concat(topBrands);
        if (!list.length) list = ['wireless headphones', '5g smartphone', 'led lamp', 'fitness tracker', 'nike'];
        return list.slice(0, CFG.maxChips);
    }

    // ─── RENDERING ────────────────────────────────────────────────────────────
    function sectionLabel(text, extra) {
        return '<div class="pse-suggest__label">' + esc(text) + (extra || '') + '</div>';
    }
    function chipsRow(items, action, dataAttr) {
        return items.map(function (it) {
            return '<button type="button" class="pse-suggest__chip" data-action="' + action +
                '" data-' + dataAttr + '="' + esc(it) + '">' + esc(it) + '</button>';
        }).join('');
    }
    function productItem(p, query) {
        var rating = p.rating > 0
            ? '<span class="pse-suggest__rate" title="Rating">★ ' + p.rating.toFixed(1) + '</span>'
            : '';
        var stock = '';
        if (p.stock > 0) {
            var cls = p.stock <= 20 ? 'pse-suggest__stock--low' : '';
            stock = '<span class="pse-suggest__stock ' + cls + '">' +
                (p.stock <= 20 ? 'Low stock · ' : 'In stock · ') + p.stock + '</span>';
        }
        var badge = p.supplier_verified
            ? '<span class="pse-suggest__badge" title="Verified seller">✓ Verified</span>' : '';
        return '<div class="pse-suggest__item" role="option" data-action="product" data-slug="' + esc(p.slug) + '" data-title="' + esc(p.title) + '">' +
            '<img src="' + esc(p.image_url || '') + '" alt="' + esc(p.title) + '" loading="lazy" onerror="this.style.visibility=\'hidden\'">' +
            '<div class="pse-suggest__info">' +
                '<div class="pse-suggest__title">' + highlight(p.title, query) + '</div>' +
                '<div class="pse-suggest__meta">' +
                    (p.brand ? '<span class="pse-suggest__brand">' + esc(p.brand) + '</span>' : '') +
                    rating +
                    '<span class="pse-suggest__price">' + money(p.price) + '</span>' +
                '</div>' +
                '<div class="pse-suggest__sub">' + stock + '</div>' +
            '</div>' + badge +
        '</div>';
    }

    function renderLoading() {
        panel.innerHTML =
            '<div class="pse-suggest__status"><span class="pse-suggest__spinner"></span> Loading products…</div>';
        panel.classList.add('show');
    }

    function renderEmptyQuery() {
        var recent = getRecent();
        var popular = buildPopular();
        var html = '';

        if (recent.length) {
            html += '<div class="pse-suggest__section">' +
                sectionLabel('Recent searches',
                    '<button type="button" class="pse-suggest__clear" data-action="clear-recent">Clear</button>') +
                '<div class="pse-suggest__chips">' +
                recent.map(function (r) {
                    return '<button type="button" class="pse-suggest__chip pse-suggest__chip--recent" data-action="search" data-query="' + esc(r) + '">🕘 ' + esc(r) + '</button>';
                }).join('') +
                '</div></div>';
        }
        if (popular.length) {
            html += '<div class="pse-suggest__section">' +
                sectionLabel('Popular right now') +
                '<div class="pse-suggest__chips">' +
                popular.map(function (r) {
                    return '<button type="button" class="pse-suggest__chip" data-action="search" data-query="' + esc(r) + '">' + esc(r) + '</button>';
                }).join('') +
                '</div></div>';
        }
        if (!html) {
            html = '<div class="pse-suggest__status">Type at least 2 characters to search products</div>';
        }
        panel.innerHTML = html;
        panel.classList.add('show');
        lastQuery = '';
    }

    function renderResults(query, results) {
        var q = (query || '').trim();
        if (!q) { renderEmptyQuery(); return; }
        lastQuery = q;

        if (!results.length) {
            var popular = buildPopular();
            panel.innerHTML =
                '<div class="pse-suggest__status">No products match “' + esc(q) + '”. Try:</div>' +
                '<div class="pse-suggest__chips pse-suggest__chips--centered">' +
                popular.map(function (r) {
                    return '<button type="button" class="pse-suggest__chip" data-action="search" data-query="' + esc(r) + '">' + esc(r) + '</button>';
                }).join('') +
                '</div>';
            panel.classList.add('show');
            return;
        }

        var shown = results.slice(0, CFG.maxProducts);
        var html = '';

        // Products
        html += '<div class="pse-suggest__section">' +
            sectionLabel('Products') +
            shown.map(function (p) { return productItem(p, q); }).join('') +
            '</div>';

        // Category + brand chips (only when they add value beyond the rows)
        var qLower = q.toLowerCase();
        var cats = {}, brands = {};
        results.forEach(function (p) {
            if (p.category && p.category !== 'other') cats[p.category] = 1;
            if (p.brand) brands[p.brand] = 1;
        });
        var catKeys = Object.keys(cats).filter(function (c) {
            return c.toLowerCase().indexOf(qLower) !== -1 || qLower.indexOf(c.toLowerCase()) !== -1;
        }).slice(0, 3);
        var brandKeys = Object.keys(brands).filter(function (b) {
            return b.toLowerCase().indexOf(qLower) !== -1 || qLower.indexOf(b.toLowerCase()) !== -1;
        }).slice(0, 3);

        if (catKeys.length || brandKeys.length) {
            html += '<div class="pse-suggest__section pse-suggest__section--chips">';
            if (catKeys.length) {
                html += sectionLabel('Categories') +
                    '<div class="pse-suggest__chips">' +
                    catKeys.map(function (c) {
                        return '<button type="button" class="pse-suggest__chip" data-action="category" data-category="' + esc(c) + '">' + esc(c) + '</button>';
                    }).join('') + '</div>';
            }
            if (brandKeys.length) {
                html += sectionLabel('Brands') +
                    '<div class="pse-suggest__chips">' +
                    brandKeys.map(function (b) {
                        return '<button type="button" class="pse-suggest__chip" data-action="search" data-query="' + esc(b) + '">' + esc(b) + '</button>';
                    }).join('') + '</div>';
            }
            html += '</div>';
        }

        // Footer → full results
        html += '<div class="pse-suggest__footer" role="option" data-action="all" data-query="' + esc(q) + '">' +
            'See all <strong>' + results.length + '</strong> result' + (results.length === 1 ? '' : 's') +
            ' for “' + esc(q) + '” <span class="pse-suggest__arrow">→</span></div>';

        panel.innerHTML = html;
        panel.classList.add('show');
    }

    // ─── OPEN / CLOSE / KEYBOARD ──────────────────────────────────────────────
    function open() {
        panel.classList.add('show');
        input.setAttribute('aria-expanded', 'true');
        syncActive();
    }
    function close() {
        panel.classList.remove('show');
        activeIndex = -1;
        if (input) input.setAttribute('aria-expanded', 'false');
    }
    function isOpen() { return panel && panel.classList.contains('show'); }

    function selectables() {
        return Array.prototype.slice.call(panel.querySelectorAll('[data-action]'));
    }
    function syncActive() {
        var items = selectables();
        items.forEach(function (el, i) {
            if (!el.id) el.id = 'pse-opt-' + i;
            if (i === activeIndex) {
                el.classList.add('pse-active');
                el.setAttribute('aria-selected', 'true');
                if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' });
            } else {
                el.classList.remove('pse-active');
                el.setAttribute('aria-selected', 'false');
            }
        });
        if (input) {
            input.setAttribute('aria-activedescendant',
                activeIndex >= 0 && items[activeIndex] ? items[activeIndex].id : '');
        }
    }
    function moveActive(delta) {
        var items = selectables();
        if (!items.length) return;
        if (activeIndex === -1) activeIndex = delta > 0 ? 0 : items.length - 1;
        else activeIndex = (activeIndex + delta + items.length) % items.length;
        syncActive();
    }
    function activateCurrent() {
        var items = selectables();
        if (activeIndex >= 0 && items[activeIndex]) {
            items[activeIndex].click();
            return true;
        }
        return false;
    }

    // ─── NAVIGATION ───────────────────────────────────────────────────────────
    function goSearch(query) {
        addRecent(query);
        window.location.href = '/products?search=' + encodeURIComponent(query);
    }
    function goCategory(cat) {
        window.location.href = '/products?category=' + encodeURIComponent(cat);
    }
    function goProduct(slug) {
        window.location.href = '/product/' + encodeURIComponent(slug);
    }
    function runAction(el) {
        if (!el) return;
        var action = el.getAttribute('data-action');
        if (action === 'product') {
            addRecent(el.getAttribute('data-title') || input.value);
            goProduct(el.getAttribute('data-slug'));
        } else if (action === 'search') {
            goSearch(el.getAttribute('data-query'));
        } else if (action === 'category') {
            goCategory(el.getAttribute('data-category'));
        } else if (action === 'all') {
            goSearch(el.getAttribute('data-query') || input.value);
        } else if (action === 'clear-recent') {
            clearRecent();
            renderEmptyQuery();
            syncActive();
        }
    }

    // ─── EVENT WIRING ─────────────────────────────────────────────────────────
    function onInput() {
        var q = input.value.trim();
        if (debounceTimer) clearTimeout(debounceTimer);

        if (q.length < 2) {
            activeIndex = -1;
            if (q.length === 0) { renderEmptyQuery(); open(); }
            else { close(); }
            return;
        }
        renderLoading();
        open();
        debounceTimer = setTimeout(function () {
            loadCatalog().then(function () {
                if (input.value.trim() !== q) return; // stale keystrokes
                renderResults(q, search(q));
                syncActive();
            });
        }, CFG.debounceMs);
    }

    function onKeydown(e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); open(); moveActive(1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); open(); moveActive(-1); }
        else if (e.key === 'Enter') {
            if (isOpen() && activateCurrent()) { e.preventDefault(); return; }
            var q = input.value.trim();
            if (q) { e.preventDefault(); goSearch(q); }
        }
        else if (e.key === 'Escape') {
            close();
            input.blur();
        }
        else if (e.key === 'Tab' && isOpen()) {
            close();
        }
    }

    function onFocus() {
        var q = input.value.trim();
        if (q.length < 2) { renderEmptyQuery(); open(); }
        else { renderResults(q, search(q)); open(); }
    }

    function onDocClick(e) {
        if (!bar) return;
        if (!bar.contains(e.target) && isOpen()) close();
    }

    function onPanelClick(e) {
        var el = e.target.closest ? e.target.closest('[data-action]') : null;
        if (el) runAction(el);
    }

    // ─── LEGACY COMPAT ────────────────────────────────────────────────────────
    // Old pages used inline onkeyup="handleSearch(event)" / onclick="handleSearch()".
    // We keep a global handler so nothing breaks: Enter (or a bare click) goes
    // straight to the full results page.
    window.handleSearch = function (event) {
        if (event && event.key === 'Enter') {
            var q = (input && input.value || '').trim();
            if (q) { goSearch(q); return; }
        }
        if (!event || !event.key) {
            var q2 = (input && input.value || '').trim();
            if (q2) goSearch(q2);
        }
    };

    // ─── STYLES (self-contained, scoped) ──────────────────────────────────────
    function injectStyles() {
        if ($('pse-pro-search-styles')) return;
        var style = document.createElement('style');
        style.id = 'pse-pro-search-styles';
        style.textContent =
            '#searchResults.pse-suggest-panel { max-height: min(70vh, 480px); overscroll-behavior: contain; }' +
            '#searchResults.pse-suggest-panel::-webkit-scrollbar { width: 6px; }' +
            '#searchResults.pse-suggest-panel::-webkit-scrollbar-thumb { background: rgba(0,0,0,.15); border-radius: 3px; }' +
            '.pse-suggest__section { padding: .4rem 0; border-bottom: 1px solid var(--border, #e8ecef); }' +
            '.pse-suggest__section:last-of-type { border-bottom: 0; }' +
            '.pse-suggest__section--chips .pse-suggest__section { border-bottom: 0; padding: .15rem 0; }' +
            '.pse-suggest__label { display: flex; align-items: center; justify-content: space-between; font-size: .66rem; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #8a97a3; padding: .2rem 1rem .35rem; }' +
            '.pse-suggest__clear { background: none; border: 0; color: var(--primary, #1a7b6b); font-size: .68rem; cursor: pointer; padding: 0; text-transform: none; letter-spacing: 0; font-weight: 600; }' +
            '.pse-suggest__clear:hover { text-decoration: underline; }' +
            '.pse-suggest__item { display: flex; align-items: center; gap: .7rem; padding: .5rem 1rem; cursor: pointer; transition: background .15s ease; }' +
            '.pse-suggest__item:hover, .pse-suggest__item.pse-active { background: rgba(26,123,107,.07); }' +
            '.pse-suggest__item img { width: 44px; height: 44px; min-width: 44px; object-fit: cover; border-radius: 8px; background: #f1f4f6; }' +
            '.pse-suggest__info { flex: 1; min-width: 0; }' +
            '.pse-suggest__title { font-size: .85rem; font-weight: 600; color: var(--text, #1e293b); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }' +
            '.pse-suggest__title mark { background: rgba(26,123,107,.18); color: var(--primary, #1a7b6b); padding: 0 2px; border-radius: 3px; font-weight: 700; }' +
            '.pse-suggest__meta { display: flex; align-items: center; gap: .5rem; margin-top: 2px; font-size: .72rem; color: var(--text-light, #6b7a86); }' +
            '.pse-suggest__brand { color: #8a97a3; }' +
            '.pse-suggest__rate { color: #f59e0b; font-weight: 600; }' +
            '.pse-suggest__price { color: var(--primary, #1a7b6b); font-weight: 700; }' +
            '.pse-suggest__sub { margin-top: 1px; }' +
            '.pse-suggest__stock { font-size: .68rem; color: #16a34a; font-weight: 600; }' +
            '.pse-suggest__stock--low { color: #d97706; }' +
            '.pse-suggest__badge { font-size: .62rem; font-weight: 700; color: #0f766e; background: rgba(20,184,166,.12); border: 1px solid rgba(20,184,166,.35); padding: 2px 7px; border-radius: 20px; white-space: nowrap; }' +
            '.pse-suggest__chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 1rem .45rem; }' +
            '.pse-suggest__chips--centered { justify-content: center; padding-bottom: .8rem; }' +
            '.pse-suggest__chip { font: inherit; font-size: .75rem; font-weight: 600; color: var(--primary, #1a7b6b); background: rgba(26,123,107,.08); border: 1px solid rgba(26,123,107,.25); border-radius: 20px; padding: 4px 12px; cursor: pointer; transition: all .15s ease; }' +
            '.pse-suggest__chip:hover, .pse-suggest__chip.pse-active { background: var(--primary, #1a7b6b); color: #fff; border-color: var(--primary, #1a7b6b); }' +
            '.pse-suggest__chip--recent { color: #475569; background: #f1f5f9; border-color: #e2e8f0; }' +
            '.pse-suggest__footer { text-align: center; padding: .65rem 1rem; font-size: .8rem; color: var(--primary, #1a7b6b); font-weight: 600; cursor: pointer; border-top: 1px solid var(--border, #e8ecef); transition: background .15s ease; }' +
            '.pse-suggest__footer:hover, .pse-suggest__footer.pse-active { background: rgba(26,123,107,.07); }' +
            '.pse-suggest__arrow { display: inline-block; transition: transform .15s ease; }' +
            '.pse-suggest__footer:hover .pse-suggest__arrow { transform: translateX(3px); }' +
            '.pse-suggest__status { padding: 1.1rem 1rem; text-align: center; color: var(--text-light, #6b7a86); font-size: .82rem; }' +
            '.pse-suggest__spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(26,123,107,.2); border-top-color: var(--primary, #1a7b6b); border-radius: 50%; vertical-align: -3px; margin-right: 8px; animation: pse-spin .7s linear infinite; }' +
            '@keyframes pse-spin { to { transform: rotate(360deg); } }' +
            '@media (max-width: 768px) { #searchResults.pse-suggest-panel { max-height: min(72vh, 420px); } .pse-suggest__item { padding: .55rem .9rem; } .pse-suggest__title { font-size: .82rem; } }';
        document.head.appendChild(style);
    }

    // ─── INIT ─────────────────────────────────────────────────────────────────
    var initialized = false;
    function init() {
        if (initialized) return;
        initialized = true;
        input = $('searchInput');
        panel = $('searchResults');
        if (!input || !panel) return; // page has no header search bar

        bar = $('searchBar') || input.parentElement;
        btn = bar.querySelector('button');
        panel.classList.add('pse-suggest-panel');
        input.setAttribute('role', 'combobox');
        input.setAttribute('aria-autocomplete', 'list');
        input.setAttribute('aria-expanded', 'false');
        input.setAttribute('aria-controls', panel.id || 'searchResults');
        panel.setAttribute('role', 'listbox');
        panel.setAttribute('aria-label', 'Product suggestions');
        panel.setAttribute('id', 'searchResults');

        injectStyles();

        input.addEventListener('input', onInput);
        input.addEventListener('focus', onFocus);
        input.addEventListener('keydown', onKeydown);
        if (btn) btn.addEventListener('click', function () {
            var q = input.value.trim();
            if (q) goSearch(q); else input.focus();
        });
        panel.addEventListener('click', onPanelClick);
        document.addEventListener('click', onDocClick);

        // Pre-warm catalog cache (fast on later keystrokes) & re-render if open
        loadCatalog().then(function () {
            if (document.activeElement === input && input.value.trim().length >= 2) {
                renderResults(input.value.trim(), search(input.value.trim()));
                syncActive();
            }
        });

        // If the page's inline script is still initializing Firestore, it may
        // register later — harmless: we re-query lazily on each input.
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Public API
    window.PSE = window.PSE || {};
    window.PSE.search = {
        query: function (q) { return search(q); },
        refresh: function () {
            try { sessionStorage.removeItem(CFG.catalogCacheKey); } catch (e) {}
            catalogPromise = null; catalog = null;
            loadCatalog();
        },
        open: open,
        close: close
    };
})();
