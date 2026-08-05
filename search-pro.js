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
 *   • Buyer-safe public inventory API cached in sessionStorage (10 min)
 *   • Works when Firebase/auth is blocked because product discovery is API-only
 *   • Backwards-compatible window.handleSearch for legacy callers
 *
 * No frameworks or API keys. Product discovery never queries Firestore. (c) PSE Distribution.
 * ==========================================================================*/
(function () {
    'use strict';

    // ─── CONFIG ────────────────────────────────────────────────────────────────
    var CFG = {
        debounceMs: 120,            // input debounce
        maxProducts: 6,             // product rows shown
        maxChips: 12,               // max chips in a chips row
        maxRecent: 6,               // recent searches kept
        catalogCacheKey: 'pse_pro_search_inventory_v2',
        catalogCacheTtlMs: 10 * 60 * 1000, // 10 minutes
        recentKey: 'pse_pro_recent_searches_v1',
        apiLimit: 100,
        apiPages: 10
    };



    // ─── STATE ────────────────────────────────────────────────────────────────
    var input = null, panel = null, bar = null, btn = null;
    var catalog = null;          // normalized merged catalog
    var catalogPromise = null;   // in-flight / cached load promise
    var dbTimer = null;          // retained for backwards-compatible state only
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
        if (v === null || v === undefined || v === '') return 'Quote required';
        var n = num(v);
        try {
            return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
        } catch (e) { return '$' + n.toFixed(2); }
    }
    function slugify(title) {
        return String(title || 'product').toLowerCase()
            .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 80);
    }
    function normalizeProduct(p, meta) {
        if (!p || typeof p !== 'object') return null;
        var title = p.title || 'Product';
        var publicPrice = p.pricingMode === 'public' && p.publicUnitPrice !== undefined
            ? num(p.publicUnitPrice) : null;
        var confirm = p.status === 'confirm-availability' || p.quantityMode === 'confirm';
        var available = Number.isInteger(p.availableToSell) && p.availableToSell > 0;
        return {
            id: String(p.dealId || title),
            dealId: String(p.dealId || ''),
            title: String(title),
            brand: String(p.brand || ''),
            price: publicPrice,
            pricingMode: String(p.pricingMode || 'rfq'),
            image_url: Array.isArray(p.imageUrls) ? (p.imageUrls[0] || '') : '',
            slug: p.slug || slugify(title),
            category: String(p.category || 'other'),
            rating: 0,
            stock: available && !confirm ? num(p.availableToSell) : 0,
            availability: confirm ? 'Confirm availability' : (available ? 'In stock' : 'Unavailable'),
            moq: num(p.moqUnits),
            sourceVersion: p.sourceVersion || (meta && meta.sourceVersion) || '',
            snapshotVersion: p.snapshotVersion || (meta && meta.snapshotVersion) || ''
        };
    }

    // ─── CATALOG LOADING (cache → buyer-safe public API) ─────────────────────
    function readCache() {
        try {
            var raw = sessionStorage.getItem(CFG.catalogCacheKey);
            if (!raw) return null;
            var cached = JSON.parse(raw);
            if (cached && cached.ts && Date.now() - cached.ts < CFG.catalogCacheTtlMs
                && Array.isArray(cached.items)) {
                return cached.items.map(function (item) { return normalizeProduct(item, cached.meta); }).filter(Boolean);
            }
        } catch (e) { /* storage blocked / corrupt → ignore */ }
        return null;
    }

    function writeCache(items, meta) {
        try {
            sessionStorage.setItem(CFG.catalogCacheKey,
                JSON.stringify({ ts: Date.now(), items: items, meta: meta || null }));
        } catch (e) { /* non-fatal */ }
    }

    function loadFromInventoryApi() {
        var items = [];
        var meta = null;
        var cursor = null;
        var page = 0;
        function next() {
            var url = new URL('/api/inventory', window.PSE_INVENTORY_API_ORIGIN || window.location.origin);
            url.searchParams.set('limit', String(CFG.apiLimit));
            if (cursor) url.searchParams.set('cursor', cursor);
            return fetch(url.toString(), { headers: { 'Accept': 'application/json' } })
                .then(function (response) {
                    if (!response.ok) throw new Error('inventory API returned ' + response.status);
                    return response.json();
                })
                .then(function (payload) {
                    if (!payload || !Array.isArray(payload.data) || !payload.meta) {
                        throw new Error('inventory API returned an invalid catalog response');
                    }
                    meta = payload.meta;
                    items = items.concat(payload.data);
                    cursor = payload.meta.nextCursor || null;
                    page += 1;
                    if (cursor && page < CFG.apiPages) return next();
                    return { items: items, meta: meta };
                });
        }
        return next();
    }

    function loadCatalog() {
        if (catalogPromise) return catalogPromise;
        var cached = readCache();
        if (cached) {
            catalog = cached;
            catalogPromise = Promise.resolve(cached);
            return catalogPromise;
        }
        catalogPromise = loadFromInventoryApi().then(function (result) {
            var normalized = result.items.map(function (p) { return normalizeProduct(p, result.meta); }).filter(Boolean);
            catalog = normalized;
            writeCache(normalized, result.meta);
            return normalized;
        }).catch(function (error) {
            console.error('Public inventory search unavailable:', error);
            catalog = [];
            return [];
        });
        return catalogPromise;
    }

    function getCatalogSync() {
        return catalog || [];
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
        if (!list.length) return [];
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
        var stock = '<span class="pse-suggest__stock">' + esc(p.availability || 'Availability subject to confirmation') + '</span>';
        var badge = '';
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
            panel.innerHTML = popular.length
                ? '<div class="pse-suggest__status">No products match “' + esc(q) + '”. Try:</div>' +
                  '<div class="pse-suggest__chips pse-suggest__chips--centered">' +
                  popular.map(function (r) {
                      return '<button type="button" class="pse-suggest__chip" data-action="search" data-query="' + esc(r) + '">' + esc(r) + '</button>';
                  }).join('') +
                  '</div>'
                : '<div class="pse-suggest__status">No products match “' + esc(q) + '”.</div>';
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
            '.pse-suggest__clear { background: none; border: 0; color: var(--primary, #0e7c68); font-size: .68rem; cursor: pointer; padding: 0; text-transform: none; letter-spacing: 0; font-weight: 600; }' +
            '.pse-suggest__clear:hover { text-decoration: underline; }' +
            '.pse-suggest__item { display: flex; align-items: center; gap: .7rem; padding: .5rem 1rem; cursor: pointer; transition: background .15s ease; }' +
            '.pse-suggest__item:hover, .pse-suggest__item.pse-active { background: rgba(26,123,107,.07); }' +
            '.pse-suggest__item img { width: 44px; height: 44px; min-width: 44px; object-fit: cover; border-radius: 8px; background: #f1f4f6; }' +
            '.pse-suggest__info { flex: 1; min-width: 0; }' +
            '.pse-suggest__title { font-size: .85rem; font-weight: 600; color: var(--text, #0b2138); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }' +
            '.pse-suggest__title mark { background: rgba(26,123,107,.18); color: var(--primary, #0e7c68); padding: 0 2px; border-radius: 3px; font-weight: 700; }' +
            '.pse-suggest__meta { display: flex; align-items: center; gap: .5rem; margin-top: 2px; font-size: .72rem; color: var(--text-light, #6b7a86); }' +
            '.pse-suggest__brand { color: #8a97a3; }' +
            '.pse-suggest__rate { color: #f59e0b; font-weight: 600; }' +
            '.pse-suggest__price { color: var(--primary, #0e7c68); font-weight: 700; }' +
            '.pse-suggest__sub { margin-top: 1px; }' +
            '.pse-suggest__stock { font-size: .68rem; color: #16a34a; font-weight: 600; }' +
            '.pse-suggest__stock--low { color: #d97706; }' +
            '.pse-suggest__badge { font-size: .62rem; font-weight: 700; color: #0f766e; background: rgba(20,184,166,.12); border: 1px solid rgba(20,184,166,.35); padding: 2px 7px; border-radius: 20px; white-space: nowrap; }' +
            '.pse-suggest__chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 1rem .45rem; }' +
            '.pse-suggest__chips--centered { justify-content: center; padding-bottom: .8rem; }' +
            '.pse-suggest__chip { font: inherit; font-size: .75rem; font-weight: 600; color: var(--primary, #0e7c68); background: rgba(26,123,107,.08); border: 1px solid rgba(26,123,107,.25); border-radius: 20px; padding: 4px 12px; cursor: pointer; transition: all .15s ease; }' +
            '.pse-suggest__chip:hover, .pse-suggest__chip.pse-active { background: var(--primary, #0e7c68); color: #fff; border-color: var(--primary, #0e7c68); }' +
            '.pse-suggest__chip--recent { color: #475569; background: #f1f5f9; border-color: #e2e8f0; }' +
            '.pse-suggest__footer { text-align: center; padding: .65rem 1rem; font-size: .8rem; color: var(--primary, #0e7c68); font-weight: 600; cursor: pointer; border-top: 1px solid var(--border, #e8ecef); transition: background .15s ease; }' +
            '.pse-suggest__footer:hover, .pse-suggest__footer.pse-active { background: rgba(26,123,107,.07); }' +
            '.pse-suggest__arrow { display: inline-block; transition: transform .15s ease; }' +
            '.pse-suggest__footer:hover .pse-suggest__arrow { transform: translateX(3px); }' +
            '.pse-suggest__status { padding: 1.1rem 1rem; text-align: center; color: var(--text-light, #6b7a86); font-size: .82rem; }' +
            '.pse-suggest__spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(26,123,107,.2); border-top-color: var(--primary, #0e7c68); border-radius: 50%; vertical-align: -3px; margin-right: 8px; animation: pse-spin .7s linear infinite; }' +
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

        // Firebase/auth availability does not affect public product discovery;
        // the catalog above is sourced exclusively from the inventory API.
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
