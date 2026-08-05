// ============================================
// MAIN.JS - Pilot Sales Distribution
// Shared core: Firebase init, toast, auth UI,
// cart/wishlist counters, slug helpers.
// Every helper is guarded so pages that define
// their own version simply override this one.
// ============================================
(function () {
    'use strict';

    var CONFIG = {
        apiKey: "AIzaSyD_ZQB6oV_RJy0sSS69ErsB2n-awh6zYbk",
        authDomain: "pilot-sales-distribution.firebaseapp.com",
        projectId: "pilot-sales-distribution",
        storageBucket: "pilot-sales-distribution.firebasestorage.app",
        messagingSenderId: "729127273727",
        appId: "1:729127273727:web:402d67be8346257755f8ca"
    };

    var providedInitFirebase = false;

    // ─── FIREBASE INIT (only used if the page doesn't define its own) ───
    function initFirebase() {
        if (typeof firebase === 'undefined') {
            setTimeout(initFirebase, 400);
            return;
        }
        try {
            if (!firebase.apps || !firebase.apps.length) {
                firebase.initializeApp(CONFIG);
                console.log('✅ Firebase initialized (main.js)');
            }
            if (typeof firebase.firestore === 'function') {
                window.db = firebase.firestore();
            }
            if (typeof firebase.auth === 'function') {
                window.auth = firebase.auth();
            }
            if (window.auth && typeof window.auth.onAuthStateChanged === 'function') {
                window.auth.onAuthStateChanged(function (user) {
                    if (user) {
                        var stored = getUser();
                        if (!stored && window.db) {
                            window.db.collection('users').doc(user.uid).get().then(function (doc) {
                                if (doc.exists) {
                                    var data = doc.data();
                                    saveUser({
                                        id: user.uid,
                                        email: user.email,
                                        full_name: data.full_name || user.displayName || '',
                                        role: data.role || 'buyer'
                                    });
                                }
                            }).catch(function () {});
                        }
                    } else {
                        try { localStorage.removeItem('pilot_user'); } catch (e) {}
                    }
                    updateAuthUI();
                });
            }
        } catch (err) {
            console.error('Firebase init error (main.js):', err);
        }
    }

    // ─── USER HELPERS ───
    function getUser() {
        try {
            var user = localStorage.getItem('pilot_user');
            return user ? JSON.parse(user) : null;
        } catch (e) { return null; }
    }

    function saveUser(user) {
        try { localStorage.setItem('pilot_user', JSON.stringify(user)); } catch (e) {}
    }

    // ─── TOAST ───
    function showToast(message, type) {
        var toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            toast.className = 'toast';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.className = 'toast ' + (type || 'info') + ' show';
        clearTimeout(toast._timeout);
        toast._timeout = setTimeout(function () {
            toast.classList.remove('show');
        }, 4000);
    }

    // ─── AUTH UI ───
    function updateAuthUI() {
        var user = getUser();
        var login = document.getElementById('loginLink');
        var register = document.getElementById('registerLink');
        var account = document.getElementById('accountLabel');
        if (user) {
            if (login) login.style.display = 'none';
            if (register) register.style.display = 'none';
            if (account) account.textContent = user.full_name || 'Account';
        } else {
            if (login) login.style.display = 'inline';
            if (register) register.style.display = 'inline';
            if (account) account.textContent = 'Account';
        }
    }

    // ─── PRODUCT IMAGE NORMALIZATION ───
    // Product records have been imported from several sources.  Those sources
    // do not all use the same image field (and some store a Cloudinary result
    // object instead of a string), so keep image selection in one place.
    function productImage(product, fallback) {
        fallback = fallback || '/logo.jpg';
        var seen = [];
        function find(value) {
            if (!value || seen.indexOf(value) !== -1) return '';
            if (typeof value === 'string') {
                var url = value.trim();
                // A comma-separated value is not a valid image URL. Use its
                // first entry, which is how older CSV imports were saved.
                if (url.indexOf(',') !== -1 && !/^data:/i.test(url)) url = url.split(',')[0].trim();
                return url;
            }
            if (Array.isArray(value)) {
                for (var i = 0; i < value.length; i++) {
                    var result = find(value[i]);
                    if (result) return result;
                }
                return '';
            }
            if (typeof value === 'object') {
                seen.push(value);
                var keys = ['secure_url', 'url', 'downloadURL', 'download_url', 'src', 'image_url', 'imageUrl'];
                for (var j = 0; j < keys.length; j++) {
                    var nested = find(value[keys[j]]);
                    if (nested) return nested;
                }
            }
            return '';
        }
        product = product || {};
        return find(product.image_url) || find(product.imageUrl) || find(product.image) ||
            find(product.images) || find(product.image_urls) || find(product.gallery) ||
            find(product.photos) || fallback;
    }

    // A safe, reusable fallback for images rendered after page load.
    function useImageFallback(img, fallback) {
        if (!img || img.dataset.imageFallbackApplied) return;
        img.dataset.imageFallbackApplied = 'true';
        img.src = fallback || '/logo.jpg';
    }

    window.getProductImage = productImage;
    window.useImageFallback = useImageFallback;

    // ─── CART COUNT ───
    function loadCartCount() {
        var user = getUser();
        var applyCount = function (count) {
            document.querySelectorAll('.cart-count').forEach(function (el) {
                el.textContent = count;
                el.style.display = count > 0 ? 'inline' : 'none';
            });
        };
        if (!user) {
            try {
                var cart = JSON.parse(localStorage.getItem('pilot_cart') || '[]');
                applyCount(cart.reduce(function (sum, item) { return sum + (item.quantity || 1); }, 0));
            } catch (e) { applyCount(0); }
            return;
        }
        if (!window.db) return;
        window.db.collection('cart').where('user_id', '==', user.id).get()
            .then(function (snap) {
                var count = 0;
                snap.forEach(function (doc) { count += (doc.data().quantity || 1); });
                applyCount(count);
            })
            .catch(function () { applyCount(0); });
    }

    // ─── WISHLIST COUNT ───
    function loadWishlistCount() {
        var user = getUser();
        var applyCount = function (count) {
            document.querySelectorAll('.wishlist-count').forEach(function (el) {
                el.textContent = count;
                el.style.display = count > 0 ? 'inline' : 'none';
            });
        };
        if (!user) {
            try {
                var wl = JSON.parse(localStorage.getItem('pilot_wishlist') || '[]');
                applyCount(wl.length);
            } catch (e) { applyCount(0); }
            return;
        }
        if (!window.db) return;
        window.db.collection('wishlist').where('user_id', '==', user.id).get()
            .then(function (snap) { applyCount(snap.size); })
            .catch(function () { applyCount(0); });
    }

    // ─── SLUG ───
    function generateSlug(title) {
        if (!title) return '';
        return String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 80);
    }

    // ─── EXPIRE / GUARDED EXPORTS ───
    function expose(name, fn) {
        if (typeof window[name] === 'undefined') {
            window[name] = fn;
            if (name === 'initFirebase') providedInitFirebase = true;
        }
    }

    expose('showToast', showToast);
    expose('getCurrentUser', getUser);
    expose('updateAuthUI', updateAuthUI);
    expose('loadCartCount', loadCartCount);
    expose('loadWishlistCount', loadWishlistCount);
    expose('generateSlug', generateSlug);
    expose('initFirebase', initFirebase);
    window.saveUser = saveUser;
    window.__PSE_MAIN_LOADED__ = true;

    // ─── GLOBAL CURRENCY CONVERTER ENGINE ───
    var CURRENCY_RATES = {
        USD: { rate: 1.0, symbol: '$', code: 'USD' },
        EUR: { rate: 0.92, symbol: '€', code: 'EUR' },
        GBP: { rate: 0.79, symbol: '£', code: 'GBP' },
        CAD: { rate: 1.36, symbol: 'CA$', code: 'CAD' },
        ZMW: { rate: 26.5, symbol: 'K', code: 'ZMW' }
    };

    function getCurrency() {
        try {
            return localStorage.getItem('pse_currency') || 'USD';
        } catch (e) { return 'USD'; }
    }

    function setCurrency(code) {
        if (!CURRENCY_RATES[code]) code = 'USD';
        try {
            localStorage.setItem('pse_currency', code);
        } catch (e) {}
        window.dispatchEvent(new CustomEvent('pse_currency_change', { detail: code }));
    }

    function formatCurrency(usdAmount) {
        var c = getCurrency();
        var rateObj = CURRENCY_RATES[c] || CURRENCY_RATES.USD;
        var num = parseFloat(usdAmount) || 0;
        var converted = num * rateObj.rate;
        return rateObj.symbol + converted.toFixed(2);
    }

    window.PSE_CURRENCY = {
        get: getCurrency,
        set: setCurrency,
        format: formatCurrency,
        rates: CURRENCY_RATES
    };

    document.addEventListener('DOMContentLoaded', function () {
        var topBarLinks = document.querySelector('.top-bar .top-links') || document.querySelector('.top-bar .container');
        if (topBarLinks && !document.getElementById('pseGlobalCurrencySelector')) {
            var curr = getCurrency();
            var select = document.createElement('select');
            select.id = 'pseGlobalCurrencySelector';
            select.style.cssText = 'background:rgba(255,255,255,0.14);color:#fff;border:1px solid rgba(255,255,255,0.3);border-radius:20px;padding:3px 10px;font-size:0.75rem;font-weight:700;cursor:pointer;outline:none;margin-left:8px;';
            select.innerHTML = '<option value="USD" style="color:#222;">USD $</option>' +
                               '<option value="EUR" style="color:#222;">EUR €</option>' +
                               '<option value="GBP" style="color:#222;">GBP £</option>' +
                               '<option value="CAD" style="color:#222;">CAD $</option>';
            select.value = curr;
            select.addEventListener('change', function (e) {
                setCurrency(e.target.value);
            });
            topBarLinks.appendChild(select);
        }
    });

    // ─── AUTO-INIT (only when the page relies on main.js, e.g. chat.html) ───
    // Ensures firebase/db/auth exist for pages that don't call their own init.
    // Pages with their own initFirebase override window.initFirebase and handle
    // everything themselves; we only attach a state listener that keeps the
    // localStorage user cache fresh (used by chat + widgets).
    document.addEventListener('DOMContentLoaded', function () {
        if (!providedInitFirebase) return;
        if (typeof firebase === 'undefined') { setTimeout(initFirebase, 400); return; }
        try {
            if (!firebase.apps || !firebase.apps.length) {
                firebase.initializeApp(CONFIG);
                console.log('✅ Firebase initialized (main.js auto-init)');
            }
            if (typeof firebase.firestore === 'function') window.db = window.db || firebase.firestore();
            if (typeof firebase.auth === 'function') window.auth = window.auth || firebase.auth();
            if (window.auth && typeof window.auth.onAuthStateChanged === 'function') {
                window.auth.onAuthStateChanged(function (user) {
                    if (!user) { try { localStorage.removeItem('pilot_user'); } catch (e) {} }
                    updateAuthUI();
                });
            }
        } catch (err) {
            console.error('Firebase auto-init error (main.js):', err);
        }
    });

    console.log('✅ main.js loaded (shared core utilities)');

    // ════════════════════════════════════════════
    // GLOBAL ENGAGEMENT & RELIABILITY LAYER
    // (auto-injected on every page that loads main.js)
    // ════════════════════════════════════════════

    // ─── 1. PWA SERVICE WORKER ───
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
        window.addEventListener('load', function () {
            navigator.serviceWorker.register('/sw.js').catch(function () { /* optional */ });
        });
    }

    // ─── 1b. KEYBOARD SHORTCUT: "/" focuses the header search ───
    document.addEventListener('keydown', function (e) {
        if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
        const search = document.getElementById('searchInput') || document.querySelector('.search-bar input[type="text"], input[name="search"], input[placeholder*="Search"]');
        if (search) {
            e.preventDefault();
            search.focus();
        }
    });

    // ─── 2. CLIENT ERROR MONITORING → Firestore error_log ───
    // Throttled (max 3/session, deduped per message) so a broken page can't
    // spam the log, and flushed lazily once window.db becomes available.
    var _errQueue = [], _errSeen = {}, _errFlushed = 0;
    function pseLogError(kind, message, source, line) {
        try {
            if (_errFlushed >= 3) return;
            var key = String(message || '').slice(0, 120);
            if (!key || _errSeen[key]) return;
            _errSeen[key] = true;
            _errQueue.push({ kind: kind, message: key, source: String(source || '').slice(0, 200), line: line || 0, page: location.pathname, ts: new Date().toISOString() });
            _errFlushErrors(0);
        } catch (e) {}
    }
    function _errFlushErrors(tries) {
        if (!_errQueue.length) return;
        if (!(window.db && typeof window.db.collection === 'function')) {
            if ((tries || 0) < 10) setTimeout(function () { _errFlushErrors((tries || 0) + 1); }, 1500);
            return;
        }
        while (_errQueue.length && _errFlushed < 3) {
            var entry = _errQueue.shift();
            _errFlushed++;
            try { window.db.collection('error_log').add(Object.assign({ ua: (navigator.userAgent || '').slice(0, 150) }, entry)).catch(function () {}); } catch (e) {}
        }
    }
    window.addEventListener('error', function (ev) { pseLogError('error', ev.message, ev.filename, ev.lineno); });
    window.addEventListener('unhandledrejection', function (ev) { pseLogError('unhandledrejection', (ev.reason && (ev.reason.message || ev.reason)) || 'unknown', '', 0); });

    // ─── 3. FLOATING WHATSAPP BUTTON ───
    var PSE_WA_NUMBER = '19099384682';
    function pseWaMessage() {
        var path = location.pathname || '';
        if (path.indexOf('product-detail') !== -1 || path.indexOf('/product') !== -1) {
            var title = (document.getElementById('productTitle') || {}).textContent || document.title;
            return 'Hi Pilot Sales Distribution! I have a question about: ' + title.trim();
        }
        if (path.indexOf('rfq') !== -1) return 'Hi! I need help submitting a Request for Quotation (RFQ).';
        if (path.indexOf('cart') !== -1 || path.indexOf('checkout') !== -1) return 'Hi! I need help completing my wholesale order.';
        if (path.indexOf('track') !== -1) return 'Hi! I need help tracking my order.';
        return 'Hi Pilot Sales Distribution! I have a question about wholesale ordering.';
    }
    function pseInjectWhatsAppFloat() {
        if (document.getElementById('pseWaFloat')) return;
        if (/admin-dashboard|seller-dashboard|login|register/.test(location.pathname)) return; // keep ops/auth pages clean
        var a = document.createElement('a');
        a.id = 'pseWaFloat';
        a.href = 'https://wa.me/' + PSE_WA_NUMBER + '?text=' + encodeURIComponent(pseWaMessage());
        a.target = '_blank';
        a.rel = 'noopener';
        a.setAttribute('aria-label', 'Chat on WhatsApp');
        a.innerHTML = '<svg viewBox="0 0 32 32" width="28" height="28" fill="#fff"><path d="M16 3C9.4 3 4 8.4 4 15c0 2.6.8 5 2.3 7L4 29l7.2-2.3c1.9 1 4 .6 4.8.6 6.6 0 12-5.4 12-12S22.6 3 16 3zm0 21.8c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3.3 1.1 1.1-3.2-.2-.3C7.7 19.9 7 17.5 7 15 7 10 11 6 16 6s9 4 9 9-4 9.8-9 9.8zm5-7.3c-.3-.1-1.6-.8-1.9-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.2-1.2-.4-2.2-1.4-.8-.7-1.4-1.6-1.5-1.9-.2-.3 0-.4.1-.6.1-.1.3-.3.4-.4.1-.1.2-.3.3-.4.1-.2.1-.3 0-.5-.1-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.6-.7 1.9-1.3.2-.7.2-1.2.2-1.3-.1-.2-.3-.2-.6-.4z"/></svg>';
        a.style.cssText = 'position:fixed;right:18px;bottom:88px;width:54px;height:54px;border-radius:50%;background:#25D366;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px rgba(37,211,102,.45);z-index:9990;transition:transform .2s ease,box-shadow .2s ease;';
        a.addEventListener('mouseenter', function () { a.style.transform = 'scale(1.08)'; });
        a.addEventListener('mouseleave', function () { a.style.transform = 'scale(1)'; });
        var tip = document.createElement('span');
        tip.textContent = 'Chat with us';
        tip.style.cssText = 'position:absolute;right:60px;background:#0b2138;color:#fff;font:600 11px Inter,sans-serif;padding:5px 10px;border-radius:20px;white-space:nowrap;opacity:0;transition:opacity .2s;pointer-events:none;';
        a.appendChild(tip);
        a.addEventListener('mouseenter', function () { tip.style.opacity = '1'; });
        a.addEventListener('mouseleave', function () { tip.style.opacity = '0'; });
        document.body.appendChild(a);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pseInjectWhatsAppFloat);
    else pseInjectWhatsAppFloat();

    // ─── 4. COOKIE CONSENT ───
    function pseCookieConsent() {
        try { if (localStorage.getItem('pse_cookie_consent')) return; } catch (e) { return; }
        var bar = document.createElement('div');
        bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;background:#0b2138;color:#d4e2ed;padding:0.7rem 1rem;display:flex;align-items:center;justify-content:center;gap:0.8rem;flex-wrap:wrap;z-index:9995;font:400 12.5px Inter,sans-serif;box-shadow:0 -4px 20px rgba(0,0,0,.25);';
        bar.innerHTML = '<span>🍪 We use cookies to keep you signed in, save your cart and improve your shopping experience.</span>' +
            '<a href="/privacy" style="color:#e0a62e;font-weight:600;">Privacy Policy</a>' +
            '<button id="pseCookieOk" style="background:#0e7c68;color:#fff;border:none;padding:0.45rem 1.3rem;border-radius:30px;font-weight:700;cursor:pointer;font-size:12.5px;">Accept</button>' +
            '<button id="pseCookieNo" style="background:transparent;color:#a9c3d6;border:1px solid #4a6b80;padding:0.45rem 1rem;border-radius:30px;cursor:pointer;font-size:12.5px;">Decline</button>';
        document.body.appendChild(bar);
        function done(v) { try { localStorage.setItem('pse_cookie_consent', v); } catch (e) {} bar.remove(); }
        bar.querySelector('#pseCookieOk').addEventListener('click', function () { done('accepted'); });
        bar.querySelector('#pseCookieNo').addEventListener('click', function () { done('declined'); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pseCookieConsent);
    else pseCookieConsent();
})();
