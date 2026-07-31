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
})();
