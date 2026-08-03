// ============================================
// NEWSLETTER.JS - Pilot Sales Distribution
// Real newsletter subscriptions:
//  • Saves every subscriber to Firestore `subscribers`
//  • De-duplicates by email (no double entries)
//  • Sends a subscription-confirmation email
//  • Notifies the admin inbox so subscribers are shown to admin
// Exposes: window.pseSubscribe(email, name, source)
//          window.pseNewsletterSubmit(form, source)
//          window.pseWireNewsletterForm(form, source)
// ============================================
(function () {
    'use strict';

    var COLLECTION = 'subscribers';

    function getDb() {
        try {
            if (window.db && typeof window.db.collection === 'function') return window.db;
            if (window.firebase && typeof window.firebase.firestore === 'function' && firebase.apps && firebase.apps.length) {
                return firebase.firestore();
            }
        } catch (e) {}
        return null;
    }

    function toast(msg, type) {
        if (typeof window.showToast === 'function') { window.showToast(msg, type); return; }
        try {
            var t = document.createElement('div');
            t.textContent = msg;
            t.style.cssText = 'position:fixed;bottom:1.2rem;left:50%;transform:translateX(-50%);background:' +
                (type === 'error' ? '#c0392b' : '#0b2a3b') + ';color:#fff;padding:0.7rem 1.2rem;border-radius:50px;' +
                'font-size:0.85rem;z-index:99999;box-shadow:0 8px 24px rgba(0,0,0,0.25);font-family:Inter,Segoe UI,sans-serif;';
            document.body.appendChild(t);
            setTimeout(function () { t.remove(); }, 3500);
        } catch (e) {}
    }

    /**
     * Subscribe an email address.
     * @returns {Promise<{success:boolean, existing:boolean}>}
     */
    async function subscribe(email, name, source) {
        email = (email || '').trim().toLowerCase();
        name = (name || '').trim();
        source = (source || 'website').trim();

        if (!email) {
            toast('Please enter your email address', 'error');
            return { success: false, existing: false };
        }
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
            toast('Please enter a valid email address', 'error');
            return { success: false, existing: false };
        }

        // Rate limit: one subscribe attempt per 30 seconds per browser (anti-spam)
        try {
            var lastSub = parseInt(localStorage.getItem('pse_last_subscribe') || '0', 10);
            if (Date.now() - lastSub < 30000) {
                toast('Please wait a few seconds before subscribing again', 'error');
                return { success: false, existing: false };
            }
            localStorage.setItem('pse_last_subscribe', String(Date.now()));
        } catch (e) {}

        var existed = false;

        // 1) Firestore: dedupe + save (every subscriber is stored so admin sees it)
        try {
            var db = getDb();
            if (db) {
                var dup = await db.collection(COLLECTION).where('email', '==', email).limit(1).get();
                existed = !dup.empty;
                if (!existed) {
                    await db.collection(COLLECTION).add({
                        email: email,
                        name: name,
                        source: source,
                        status: 'active',
                        created_at: new Date().toISOString()
                    });
                }
            }
        } catch (e) {
            console.warn('Newsletter Firestore save skipped:', e);
        }

        // 2) Local memory (works offline too)
        try {
            var offline = JSON.parse(localStorage.getItem('pse_subscribers') || '[]');
            if (offline.indexOf(email) === -1) {
                offline.push(email);
                localStorage.setItem('pse_subscribers', JSON.stringify(offline));
            }
        } catch (e) {}

        // 3) Confirmation email to the subscriber (only for NEW subscriptions)
        if (!existed && typeof window.sendNotificationEmail === 'function') {
            try {
                await window.sendNotificationEmail(
                    email,
                    name || 'there',
                    '🎉 You are on the list!',
                    'Welcome to the <strong>Pilot Sales Distribution</strong> newsletter! You will be the first to hear about new verified suppliers, wholesale deals, festival offers and seasonal sales. 🛍️',
                    'Start Shopping',
                    'https://pilotsalesdistribution.com/products'
                );
            } catch (e) {
                console.warn('Subscription confirmation email skipped:', e);
            }
        }

        // 4) Mirror into the admin inbox so the team is instantly aware
        if (!existed) {
            try {
                var db2 = getDb();
                if (db2) {
                    await db2.collection('messages').add({
                        firstName: name || 'Newsletter',
                        lastName: 'Subscriber',
                        email: email,
                        phone: '',
                        subject: '📬 New Newsletter Subscription',
                        message: email + ' just subscribed to the newsletter via ' + source + '.',
                        status: 'unread',
                        source: 'newsletter',
                        created_at: new Date().toISOString()
                    });
                }
            } catch (e) { /* non-blocking */ }
        }

        // 5) In-app notification
        try {
            if (typeof window.pushNotification === 'function') {
                window.pushNotification(
                    existed ? 'Already subscribed 👍' : 'Newsletter subscribed 🎉',
                    existed ? email + ' is already on our mailing list.' : 'Welcome aboard! A confirmation is on its way to ' + email + '.',
                    { icon: 'fa-envelope', tag: 'newsletter' }
                );
            }
        } catch (e) {}

        toast(existed ? '👍 You are already subscribed!' : '✅ Subscribed! Check your inbox.', existed ? 'info' : 'success');
        return { success: true, existing: existed };
    }

    /**
     * Submit handler for a newsletter <form>. Replaces the form with a
     * confirmation after a successful subscribe.
     */
    window.pseNewsletterSubmit = function (formEl, source) {
        if (!formEl) return;
        var emailInput = formEl.querySelector('input[type="email"], input[name="email"], input[placeholder*="mail" i]');
        var nameInput = formEl.querySelector('input[name="name"]');
        var btn = formEl.querySelector('button[type="submit"], button');
        var originalBtn = btn ? btn.innerHTML : '';
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; }

        return subscribe(emailInput ? emailInput.value : '', nameInput ? nameInput.value : '', source || 'footer')
            .then(function (res) {
                if (res && res.success) {
                    formEl.innerHTML = '<p style="color:#fff;font-weight:600;">✅ ' +
                        (res.existing ? 'You are already subscribed!' : 'Subscribed! Check your inbox.') + '</p>';
                } else if (btn) {
                    btn.disabled = false; btn.innerHTML = originalBtn;
                }
            })
            .catch(function () {
                if (btn) { btn.disabled = false; btn.innerHTML = originalBtn; }
            });
    };

    /** Attach newsletter behaviour to a form element (no inline handler needed). */
    window.pseWireNewsletterForm = function (formEl, source) {
        if (!formEl) return;
        formEl.addEventListener('submit', function (ev) {
            ev.preventDefault();
            window.pseNewsletterSubmit(formEl, source);
        });
    };

    window.pseSubscribe = subscribe;
    console.log('📨 Newsletter system ready (pseSubscribe)');
})();
