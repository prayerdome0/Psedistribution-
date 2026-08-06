/* ============================================================================
   PSE MARKETPLACE — REAL AUTHENTICATION ENGINE
   ----------------------------------------------------------------------------
   Replaces the old "fake" localStorage-only login/registration.

   The source of truth for a signed-in user is Firebase Auth + the Firestore
   `users/{uid}` document (which the Firestore security rules enforce). The
   localStorage `pilot_user` entry is now only ever a *cache* derived from a
   real Firebase session — it is never trusted to grant admin access.

   Exposes:
     window.handleLoginSubmit(e)      real sign-in
     window.handleRegisterSubmit(e)   real account creation
     window.logoutUser(e)             real sign-out
     window.getCurrentUser()          cached user (pilot_user)
     window.requireAdmin()            Promise<boolean>  Firestore-backed admin check
     window.isAdmin()                 sync cache check
   ========================================================================== */

(function (window, document) {
    'use strict';

    var CONFIG = {
        apiKey: "AIzaSyD_ZQB6oV_RJy0sSS69ErsB2n-awh6zYbk",
        authDomain: "pilot-sales-distribution.firebaseapp.com",
        projectId: "pilot-sales-distribution",
        storageBucket: "pilot-sales-distribution.firebasestorage.app",
        messagingSenderId: "729127273727",
        appId: "1:729127273727:web:402d67be8346257755f8ca"
    };

    function fb() { return (typeof firebase !== 'undefined') ? firebase : null; }
    function auth() { var f = fb(); return (f && f.auth) ? f.auth() : null; }
    function db() { var f = fb(); return (f && f.firestore) ? f.firestore() : null; }

    // ─── INIT / GUARD ─────────────────────────────────────────────────────
    function ensureFirebase(cb, tries) {
        tries = tries || 0;
        if (fb()) {
            try { if (!fb().apps || !fb().apps.length) fb().initializeApp(CONFIG); } catch (e) {}
            if (cb) cb();
            return;
        }
        if (tries > 30) { console.warn('[PSE auth] Firebase SDK not available'); if (cb) cb(); return; }
        setTimeout(function () { ensureFirebase(cb, tries + 1); }, 200);
    }

    // ─── STORAGE HELPERS ──────────────────────────────────────────────────
    function lsGet(k, f) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : f; } catch (e) { return f; } }
    function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
    function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

    function pseToast(msg, type) {
        try { if (typeof window.pseToast === 'function') { window.pseToast(msg, type); return; } } catch (e) {}
        try { if (typeof window.showToast === 'function') { window.showToast(msg, type); return; } } catch (e) {}
        console.log('[PSE auth]', type || 'info', msg);
    }

    // Cache a real authenticated user into pilot_user and refresh the UI.
    function cacheUser(user) {
        if (user) lsSet('pilot_user', user); else lsDel('pilot_user');
        try { if (window.PSEMarketplace && window.PSEMarketplace.updateAuthUI) window.PSEMarketplace.updateAuthUI(); } catch (e) {}
        try { if (typeof window.updateAuthUI === 'function') window.updateAuthUI(); } catch (e) {}
    }

    // ─── FRIENDLY AUTH ERRORS ─────────────────────────────────────────────
    function friendlyAuthError(err) {
        var code = (err && err.code) || '';
        var map = {
            'auth/email-already-in-use': 'This email is already registered. Try signing in instead.',
            'auth/invalid-email': 'Please enter a valid email address.',
            'auth/user-not-found': 'No account found with that email address.',
            'auth/wrong-password': 'Incorrect password. Please try again.',
            'auth/invalid-credential': 'Incorrect email or password.',
            'auth/user-disabled': 'This account has been disabled. Contact support.',
            'auth/weak-password': 'Password must be at least 6 characters.',
            'auth/operation-not-allowed': 'Email/password sign-in is not enabled on this project.',
            'auth/network-request-failed': 'Network error. Check your connection and try again.',
            'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.'
        };
        if (map[code]) return map[code];
        return (err && err.message) ? err.message : 'Something went wrong. Please try again.';
    }

    function getField(id) {
        var el = document.getElementById(id);
        return el ? String(el.value || '').trim() : '';
    }

    function getSubmitBtn(form) {
        return form ? form.querySelector('button[type="submit"]') : null;
    }

    // The page a signed-in user should be sent to after login/registration.
    // Honours a `?redirect=/path` query param (e.g. checkout forces this),
    // otherwise routes by role: admin → admin-dashboard, seller → seller-dashboard,
    // everyone else → account.
    function postLoginTarget(role) {
        try {
            var params = new URLSearchParams(window.location.search);
            var r = params.get('redirect');
            // Only allow a same-origin path to avoid an open-redirect vector.
            if (r && r.charAt(0) === '/' && r.charAt(1) !== '/' && !/^\/\/|^\/[a-z]+:/.test(r)) {
                return r;
            }
        } catch (e) {}
        if (role === 'admin') return '/admin-dashboard';
        if (role === 'seller') return '/seller-dashboard';
        return '/account';
    }

    // ─── REAL SIGN-IN ─────────────────────────────────────────────────────
    window.handleLoginSubmit = function (e) {
        e.preventDefault();
        var form = e.target;
        var email = getField('loginEmail');
        var password = getField('loginPassword');
        var btn = getSubmitBtn(form);
        var busy = false;

        function setBusy(b) {
            if (b === busy || !btn) return;
            busy = b;
            btn.disabled = b;
            btn.innerHTML = b
                ? '<i class="fa-solid fa-spinner fa-spin"></i> Signing in…'
                : '<i class="fa-solid fa-lock"></i> Sign In';
        }

        if (!email || !password) { pseToast('Please enter your email and password.', 'error'); return; }

        setBusy(true);
        ensureFirebase(function () {
            var a = auth(), d = db();
            if (!a) { setBusy(false); pseToast('Authentication service is unavailable. Please try again.', 'error'); return; }

            a.signInWithEmailAndPassword(email, password).then(function (cred) {
                var u = cred.user;
                // Load role + profile from Firestore (the only trusted source).
                if (d) {
                    return d.collection('users').doc(u.uid).get().then(function (doc) {
                        var data = doc.exists ? doc.data() : {};
                        var user = {
                            id: u.uid,
                            email: u.email || email,
                            full_name: data.full_name || u.displayName || (email.split('@')[0]),
                            role: data.role || 'buyer',
                            status: data.status || 'active'
                        };
                        cacheUser(user);
                        pseToast('Welcome back, ' + (user.full_name || user.email) + '!', 'success');
                        setTimeout(function () {
                            window.location.href = postLoginTarget(user.role);
                        }, 600);
                    });
                }
                var simple = { id: u.uid, email: u.email || email, full_name: u.displayName || (email.split('@')[0]), role: 'buyer', status: 'active' };
                cacheUser(simple);
                pseToast('Welcome back!', 'success');
                setTimeout(function () { window.location.href = postLoginTarget('buyer'); }, 600);
            }).catch(function (err) {
                setBusy(false);
                pseToast(friendlyAuthError(err), 'error');
            });
        });
    };

    // ─── REAL REGISTRATION ────────────────────────────────────────────────
    window.handleRegisterSubmit = function (e) {
        e.preventDefault();
        var form = e.target;
        var name = getField('regName');
        var email = getField('regEmail');
        var password = getField('regPassword');
        var btn = getSubmitBtn(form);
        var busy = false;

        function setBusy(b) {
            if (b === busy || !btn) return;
            busy = b;
            btn.disabled = b;
            btn.innerHTML = b
                ? '<i class="fa-solid fa-spinner fa-spin"></i> Creating account…'
                : '<i class="fa-solid fa-check"></i> Register as Verified Buyer';
        }

        if (!name) { pseToast('Please enter your full name.', 'error'); return; }
        if (!email) { pseToast('Please enter your work email address.', 'error'); return; }
        if (!password) { pseToast('Please choose a password.', 'error'); return; }
        if (password.length < 6) { pseToast('Password must be at least 6 characters.', 'error'); return; }

        setBusy(true);
        ensureFirebase(function () {
            var a = auth(), d = db();
            if (!a) { setBusy(false); pseToast('Registration service is unavailable. Please try again.', 'error'); return; }

            a.createUserWithEmailAndPassword(email, password).then(function (cred) {
                var u = cred.user;
                try { if (u.updateProfile) u.updateProfile({ displayName: name }); } catch (e) {}
                var user = {
                    id: u.uid,
                    email: u.email || email,
                    full_name: name,
                    role: 'buyer',
                    status: 'active',
                    created_at: new Date().toISOString()
                };
                // Create the Firestore profile. Firestore rules only allow the
                // account's own uid to create it and only with role 'buyer'.
                if (d) {
                    return d.collection('users').doc(u.uid).set({
                        full_name: name,
                        email: u.email || email,
                        role: 'buyer',
                        status: 'active',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }).then(function () {
                        cacheUser(user);
                    }).catch(function (fsErr) {
                        console.warn('[PSE auth] Could not write profile:', fsErr);
                        cacheUser(user);
                    });
                }
                cacheUser(user);
            }).then(function () {
                pseToast('Account created successfully!', 'success');
                setTimeout(function () { window.location.href = '/account'; }, 600);
            }).catch(function (err) {
                setBusy(false);
                pseToast(friendlyAuthError(err), 'error');
            });
        });
    };

    // ─── REAL SIGN-OUT ────────────────────────────────────────────────────
    window.logoutUser = function (e) {
        if (e && e.preventDefault) e.preventDefault();
        ensureFirebase(function () {
            var a = auth();
            if (a) { try { a.signOut(); } catch (err) {} }
        });
        cacheUser(null);
        pseToast('Logged out successfully', 'info');
        setTimeout(function () { window.location.href = '/'; }, 400);
    };

    // ─── CURRENT USER (cached from a real session) ───────────────────────
    window.getCurrentUser = function () { return lsGet('pilot_user', null); };

    // ─── SYNC CACHE CHECK (fast, for UI only) ─────────────────────────────
    window.isAdmin = function () {
        var u = window.getCurrentUser();
        return !!(u && u.role === 'admin');
    };

    // ─── FIREBASE-VERIFIED ADMIN CHECK (for protected actions) ────────────
    // Verifies against Firebase Auth currentUser + Firestore users doc, NOT
    // the spoofable localStorage cache. Returns a Promise<boolean>.
    window.requireAdmin = function () {
        return new Promise(function (resolve) {
            ensureFirebase(function () {
                var a = auth(), d = db();
                if (!a) { resolve(false); return; }
                var cu = a.currentUser;
                if (!cu) { cacheUser(null); resolve(false); return; }
                if (!d) { resolve(false); return; }
                d.collection('users').doc(cu.uid).get().then(function (doc) {
                    var data = doc.exists ? doc.data() : {};
                    var role = data.role || 'buyer';
                    cacheUser({
                        id: cu.uid,
                        email: cu.email || '',
                        full_name: data.full_name || cu.displayName || '',
                        role: role,
                        status: data.status || 'active'
                    });
                    resolve(role === 'admin');
                }).catch(function () { resolve(false); });
            });
        });
    };

    // Expose the config for debugging/tooling.
    window.PSE_AUTH = { loaded: true };
    console.log('✅ auth.js loaded (real Firebase authentication)');

    // ─── LOGIN-PAGE URL NOTIFICATIONS ────────────────────────────────────
    // If the page was reached with ?reset=success, tell the user their reset
    // email has been sent. Runs once on load.
    if (window.location.pathname.indexOf('login') !== -1) {
        try {
            var q = new URLSearchParams(window.location.search);
            if (q.get('reset') === 'success') {
                setTimeout(function () {
                    pseToast('Password reset email sent — check your inbox.', 'success');
                }, 500);
            }
        } catch (e) {}
    }
})(window, document);
