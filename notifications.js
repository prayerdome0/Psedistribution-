// ============================================
// NOTIFICATIONS.JS - Pilot Sales Distribution
// In-app notification center + browser notifications + Firestore sync + Sound alerts
// ============================================
(function () {
    'use strict';

    var STORE_KEY = 'pse_notifications_v1';
    var SEEN_KEY  = 'pse_notif_seen_v1';
    var MAX_STORED = 50;

    // ─── Sound notification (short ding) ───
    var NOTIF_SOUND = null;
    function initSound() {
        try {
            // Create a tiny silent AudioContext then synthesize a pleasant ding
            var ctx = new (window.AudioContext || window.webkitAudioContext)();
            NOTIF_SOUND = {
                play: function () {
                    try {
                        if (ctx.state === 'suspended') ctx.resume();
                        var now = ctx.currentTime;
                        // Two-tone ding: gentle E5 → C6
                        [659.25, 1046.5].forEach(function (freq, i) {
                            var osc = ctx.createOscillator();
                            var gain = ctx.createGain();
                            osc.type = 'sine';
                            osc.frequency.setValueAtTime(freq, now + i * 0.08);
                            gain.gain.setValueAtTime(0.18, now + i * 0.08);
                            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.25);
                            osc.connect(gain);
                            gain.connect(ctx.destination);
                            osc.start(now + i * 0.08);
                            osc.stop(now + i * 0.08 + 0.3);
                        });
                    } catch (e) { /* sound blocked by browser policy */ }
                }
            };
        } catch (e) { NOTIF_SOUND = null; }
    }
    // Try to init sound on first user interaction
    function attachSoundInit() {
        var events = ['click', 'touchstart', 'keydown'];
        function handler() {
            initSound();
            events.forEach(function (ev) { document.removeEventListener(ev, handler); });
        }
        events.forEach(function (ev) { document.addEventListener(ev, handler, { once: true }); });
    }

    // ─── HELPERS ───
    function lsGet(key, fallback) {
        try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; } catch (e) { return fallback; }
    }
    function lsSet(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
    }
    function uid() {
        return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    // ─── STORE ───
    function loadAll() { return lsGet(STORE_KEY, []); }
    function saveAll(list) {
        lsSet(STORE_KEY, list.slice(0, MAX_STORED));
        updateBadge();
        renderPanel();
    }
    function getUnread() { return loadAll().filter(function (n) { return !n.read; }); }

    // ─── PUSH A NOTIFICATION ───
    function push(title, message, opts) {
        opts = opts || {};
        var notif = {
            id: opts.id || uid(),
            title: title || 'PSE Distribution',
            message: message || '',
            url: opts.url || null,
            icon: opts.icon || 'fa-bell',
            tag: opts.tag || 'general',
            time: opts.time || Date.now(),
            read: false,
            system: !!opts.system
        };
        var list = loadAll();
        // de-dupe identical messages within 5s
        for (var i = 0; i < list.length; i++) {
            if (list[i].title === notif.title && list[i].message === notif.message && (Date.now() - list[i].time) < 5000) {
                return list[i];
            }
        }
        list.unshift(notif);
        saveAll(list);

        // ─── Play sound ───
        if (NOTIF_SOUND && typeof NOTIF_SOUND.play === 'function') {
            try { NOTIF_SOUND.play(); } catch (e) {}
        }

        // ─── Browser system notification ───
        if (opts.system !== false && typeof window.Notification !== 'undefined') {
            try {
                if (window.Notification.permission === 'granted') {
                    var n = new window.Notification(title || 'PSE Distribution', {
                        body: message || '',
                        icon: opts.iconUrl || '/logo.jpg',
                        tag: notif.tag,
                        silent: true  // we already played our own sound
                    });
                    if (opts.url && n.addEventListener) {
                        n.addEventListener('click', function () { window.focus(); window.location.href = opts.url; });
                    }
                    if (n.close) setTimeout(function () { n.close(); }, 8000);
                } else if (window.Notification.permission === 'default') {
                    window.__psePendingSystem = notif;
                }
            } catch (e) { /* silent */ }
        }
        return notif;
    }

    function markAllRead() {
        var list = loadAll();
        list.forEach(function (n) { n.read = true; });
        saveAll(list);
    }
    function markRead(id) {
        var list = loadAll();
        var n = list.find(function (x) { return x.id === id; });
        if (n) { n.read = true; saveAll(list); }
    }
    function clearAll() {
        saveAll([]);
    }

    // ─── BADGE ───
    function updateBadge() {
        var count = getUnread().length;
        document.querySelectorAll('.pse-notif-badge').forEach(function (el) {
            el.textContent = count > 99 ? '99+' : count;
            el.style.display = count > 0 ? 'flex' : 'none';
        });
        if (typeof window.__pseNotifCount === 'function') window.__pseNotifCount(count);
    }

    // ─── BROWSER NOTIFICATION PERMISSION ───
    function requestPermission() {
        if (typeof window.Notification === 'undefined') return;
        if (window.Notification.permission !== 'default') return;
        try {
            window.Notification.requestPermission().then(function (perm) {
                if (perm === 'granted' && window.__psePendingSystem) {
                    var p = window.__psePendingSystem;
                    window.__psePendingSystem = null;
                    push(p.title, p.message, { url: p.url, iconUrl: '/logo.jpg', tag: p.tag });
                }
            }).catch(function () {});
        } catch (e) {
            try { window.Notification.requestPermission(function () {}); } catch (e2) {}
        }
    }

    // ═══════════ FIRESTORE SYNC (matches admin notification system) ═══════════
    // Listens for new unread messages, orders, RFQs from Firestore and pushes
    // local notifications — just like the admin dashboard real-time listeners.
    var _firestoreSyncActive = false;
    function startFirestoreSync() {
        if (_firestoreSyncActive) return;
        _firestoreSyncActive = true;
        var db = null;
        function getDb() {
            if (db) return db;
            if (window.db && typeof window.db.collection === 'function') { db = window.db; return db; }
            if (window.firebase && window.firebase.firestore && typeof window.firebase.firestore === 'function') {
                db = window.firebase.firestore();
                return db;
            }
            return null;
        }
        var tries = 0;
        function connect() {
            var d = getDb();
            if (!d) {
                if (tries++ < 30) setTimeout(connect, 800);
                return;
            }
            try {
                // Listen for new messages (same as admin's real-time listener)
                d.collection('messages').where('status', '==', 'unread')
                    .onSnapshot(function (snap) {
                        snap.docChanges().forEach(function (change) {
                            if (change.type === 'added') {
                                var data = change.doc.data();
                                var name = data.firstName || data.lastName
                                    ? ((data.firstName || '') + ' ' + (data.lastName || '')).trim()
                                    : 'Customer';
                                push('📩 New Message', name + ' — ' + (data.subject || 'General inquiry'), {
                                    icon: 'fa-envelope', tag: 'message', url: '/admin-dashboard', system: true
                                });
                            }
                        });
                    }, function () { /* permission error — ignore silently */ });

                // Listen for new orders
                d.collection('orders').where('status', '==', 'pending')
                    .onSnapshot(function (snap) {
                        snap.docChanges().forEach(function (change) {
                            if (change.type === 'added') {
                                var data = change.doc.data();
                                var cust = data.customer || {};
                                var amt = data.totals ? data.totals.total : (data.total || 0);
                                push('📦 New Order', (cust.firstName || 'Guest') + ' placed an order — $' + Number(amt).toFixed(2), {
                                    icon: 'fa-receipt', tag: 'order', url: '/admin-dashboard', system: true
                                });
                            }
                        });
                    }, function () {});

                // Listen for new RFQs
                d.collection('rfqs').where('status', '==', 'pending')
                    .onSnapshot(function (snap) {
                        snap.docChanges().forEach(function (change) {
                            if (change.type === 'added') {
                                var data = change.doc.data();
                                push('📋 New RFQ', (data.title || 'Untitled') + ' — ' + (data.user_email || 'guest'), {
                                    icon: 'fa-file-lines', tag: 'rfq', url: '/admin-dashboard', system: true
                                });
                            }
                        });
                    }, function () {});
            } catch (e) { /* Firestore sync not available */ }
        }
        connect();
    }

    // ═══════════ INJECT BELL + PANEL ═══════════
    function injectUI() {
        if (document.getElementById('pse-notif-root')) return;

        var style = document.createElement('style');
        style.id = 'pse-notif-styles';
        style.textContent = '\
            .pse-notif-wrap{position:relative;display:inline-flex;}\
            .pse-notif-bell{position:relative;display:flex;flex-direction:column;align-items:center;font-size:0.6rem;color:inherit;cursor:pointer;padding:0.2rem 0.3rem;text-decoration:none;transition:color .3s ease,transform .3s ease;}\
            .pse-notif-bell i{font-size:1.3rem;margin-bottom:2px;transition:transform .3s ease;}\
            .pse-notif-bell:hover{color:var(--primary, #1a7b6b);transform:translateY(-2px);}\
            .pse-notif-bell:hover i{transform:scale(1.15);}\
            .pse-notif-bell.has-new i{animation:pseBellRing .5s ease;}\
            @keyframes pseBellRing{0%,100%{transform:rotate(0);}20%{transform:rotate(12deg);}40%{transform:rotate(-10deg);}60%{transform:rotate(6deg);}80%{transform:rotate(-4deg);}}\
            .pse-notif-badge{position:absolute;top:-6px;right:-6px;background:#c0392b;color:#fff;font-size:0.55rem;font-weight:700;border-radius:50%;padding:0.1rem 0.45rem;min-width:18px;height:18px;display:none;align-items:center;justify-content:center;animation:pseBadgePop .3s ease;}\
            @keyframes pseBadgePop{0%{transform:scale(0);}70%{transform:scale(1.3);}100%{transform:scale(1);}}\
            .pse-notif-panel{position:absolute;top:calc(100% + 12px);right:0;width:360px;max-width:90vw;background:#fff;border-radius:16px;box-shadow:0 20px 60px rgba(11,42,59,.18);border:1px solid #e9edf2;z-index:99999;overflow:hidden;display:none;font-family:\'Inter\',\'Segoe UI\',system-ui,sans-serif;}\
            .pse-notif-panel.open{display:block;animation:psePanelIn .25s cubic-bezier(0.22,1,0.36,1);}\
            @keyframes psePanelIn{from{opacity:0;transform:translateY(-12px) scale(0.97);}to{opacity:1;transform:translateY(0) scale(1);}}\
            .pse-notif-head{display:flex;align-items:center;justify-content:space-between;padding:0.9rem 1rem;background:linear-gradient(135deg,#0b2a3b,#1a4b5e);color:#fff;}\
            .pse-notif-head strong{font-size:0.95rem;}\
            .pse-notif-head .pse-notif-actions{display:flex;gap:0.4rem;}\
            .pse-notif-head button{background:rgba(255,255,255,.12);color:#fff;border:none;border-radius:30px;font-size:0.7rem;padding:0.3rem 0.7rem;cursor:pointer;transition:background .3s;}\
            .pse-notif-head button:hover{background:rgba(255,255,255,.25);}\
            .pse-notif-list{max-height:400px;overflow-y:auto;}\
            .pse-notif-empty{padding:2.5rem 1rem;text-align:center;color:#6a889a;font-size:0.85rem;}\
            .pse-notif-item{display:flex;gap:0.7rem;padding:0.8rem 1rem;border-bottom:1px solid #f0f4f8;cursor:pointer;transition:background .2s,transform .2s;text-align:left;width:100%;border-left:3px solid transparent;animation:pseNotifItemIn .4s ease both;}\
            @keyframes pseNotifItemIn{from{opacity:0;transform:translateX(-8px);}to{opacity:1;transform:translateX(0);}}\
            .pse-notif-item:hover{background:#f7fafc;transform:translateX(2px);}\
            .pse-notif-item.unread{background:#eef7f3;border-left-color:#1a7b6b;}\
            .pse-notif-item .pse-notif-ico{width:36px;height:36px;border-radius:50%;background:#e8f5f0;color:#1a7b6b;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:0.9rem;}\
            .pse-notif-item .pse-notif-body{flex:1;min-width:0;}\
            .pse-notif-item .pse-notif-title{font-size:0.83rem;font-weight:700;color:#0b2a3b;}\
            .pse-notif-item .pse-notif-msg{font-size:0.78rem;color:#6a889a;margin-top:2px;line-height:1.45;}\
            .pse-notif-item .pse-notif-time{font-size:0.68rem;color:#9fb3c2;margin-top:4px;}\
            .pse-notif-floating{position:fixed;right:22px;bottom:96px;z-index:2147483001;}\
        ';
        document.head.appendChild(style);

        var root = document.createElement('div');
        root.id = 'pse-notif-root';
        root.className = 'pse-notif-wrap';

        var bell = document.createElement('a');
        bell.href = 'javascript:void(0)';
        bell.className = 'pse-notif-bell';
        bell.id = 'pse-notif-bell';
        bell.setAttribute('aria-label', 'Notifications');
        bell.innerHTML = '<i class="fa-regular fa-bell"></i><span class="pse-notif-badge pse-notif-badge--bell"></span>';
        bell.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            togglePanel();
            requestPermission();
        });

        var panel = document.createElement('div');
        panel.className = 'pse-notif-panel';
        panel.id = 'pse-notif-panel';
        panel.innerHTML = '\
            <div class="pse-notif-head">\
                <strong><i class="fa-regular fa-bell"></i> Notifications</strong>\
                <div class="pse-notif-actions">\
                    <button type="button" data-action="read">Mark all read</button>\
                    <button type="button" data-action="clear">Clear all</button>\
                </div>\
            </div>\
            <div class="pse-notif-list" id="pse-notif-list"></div>\
        ';
        panel.addEventListener('click', function (e) {
            e.stopPropagation();
            var actionBtn = e.target.closest('[data-action]');
            if (actionBtn) {
                if (actionBtn.dataset.action === 'read') { markAllRead(); renderPanel(); }
                if (actionBtn.dataset.action === 'clear') { clearAll(); renderPanel(); }
                return;
            }
            var item = e.target.closest('.pse-notif-item');
            if (item) {
                markRead(item.dataset.id);
                renderPanel();
                if (item.dataset.url) window.location.href = item.dataset.url;
            }
        });

        root.appendChild(bell);
        root.appendChild(panel);

        // Insert into .header-actions if it exists, otherwise floating
        var host = document.querySelector('.header-actions');
        if (host) {
            root.style.display = 'inline-flex';
            host.appendChild(root);
            root.classList.add('pse-notif-in-header');
        } else {
            root.classList.add('pse-notif-floating');
            document.body.appendChild(root);
        }

        document.addEventListener('click', function (e) {
            if (!root.contains(e.target)) closePanel();
        });

        function togglePanel() {
            panel.classList.toggle('open');
            if (panel.classList.contains('open')) { renderPanel(); }
        }
        window.__pseToggleNotifPanel = togglePanel;
    }

    function renderPanel() {
        var listEl = document.getElementById('pse-notif-list');
        if (!listEl) return;
        var list = loadAll();
        if (!list.length) {
            listEl.innerHTML = '<div class="pse-notif-empty"><i class="fa-regular fa-bell-slash" style="font-size:2rem;color:#c9d8e2;"></i><p style="margin-top:0.6rem;">You\'re all caught up! 🎉</p><p style="font-size:0.75rem;color:#bcc8d2;">New messages, orders &amp; RFQs appear here</p></div>';
            return;
        }
        listEl.innerHTML = list.map(function (n, idx) {
            var t = n.time ? new Date(n.time) : null;
            var timeStr = t ? t.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
            return '<div class="pse-notif-item' + (n.read ? '' : ' unread') + '" data-id="' + n.id + '" data-url="' + (n.url || '') + '" style="animation-delay:' + (idx * 0.03) + 's">\
                <div class="pse-notif-ico"><i class="fa-solid ' + (n.icon || 'fa-bell') + '"></i></div>\
                <div class="pse-notif-body">\
                    <div class="pse-notif-title">' + esc(n.title) + '</div>\
                    ' + (n.message ? '<div class="pse-notif-msg">' + esc(n.message) + '</div>' : '') + '\
                    ' + (timeStr ? '<div class="pse-notif-time">' + timeStr + '</div>' : '') + '\
                </div></div>';
        }).join('');
    }
    function esc(s) {
        return String(s || '').replace(/[&<>\"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function closePanel() {
        var p = document.getElementById('pse-notif-panel');
        if (p) p.classList.remove('open');
    }

    // ─── WRAP showToast SO TOASTS BECOME NOTIFICATIONS ───
    function wrapToast() {
        var orig = window.showToast;
        if (typeof orig !== 'function') return false;
        window.showToast = function (message, type) {
            var res = orig.apply(this, arguments);
            try {
                if (message && typeof message === 'string' && message.length > 3) {
                    var icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info' };
                    var titles = { success: 'Success ✅', error: 'Error ❌', info: 'Notice ℹ️' };
                    push(titles[type] || 'Notice', message, { icon: icons[type] || 'fa-bell', tag: 'toast', system: false });
                }
            } catch (e) {}
            return res;
        };
        return true;
    }

    // ─── CROSS-TAB SYNC ───
    window.addEventListener('storage', function (e) {
        if (e.key === STORE_KEY && e.newValue) {
            updateBadge();
            renderPanel();
        }
        // Support replies pushed from another tab
        if (e.key === 'pse_support_reply') {
            try {
                var reply = JSON.parse(e.newValue);
                if (reply && reply.message) {
                    push(reply.title || 'Live support', reply.message, {
                        url: reply.url || '/chat', icon: 'fa-headset', tag: 'support', system: true
                    });
                }
            } catch (err) {}
        }
    });

    // ─── INIT ───
    function init() {
        injectUI();
        renderPanel();
        updateBadge();
        wrapToast();
        attachSoundInit();
        // Attempt Firestore sync after a short delay (wait for db)
        setTimeout(startFirestoreSync, 2000);
        // seed welcome notification once per session
        if (!lsGet(SEEN_KEY, false)) {
            lsSet(SEEN_KEY, true);
            push('Welcome to PSE Distribution 👋', 'Real-time alerts for messages, orders &amp; RFQs — just like the admin panel.', {
                icon: 'fa-robot', url: null, tag: 'welcome', system: false
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ─── PUBLIC API ───
    window.pushNotification = push;
    window.markNotificationsRead = markAllRead;
    window.PSENotifications = {
        push: push, markAllRead: markAllRead, clearAll: clearAll, getUnread: getUnread,
        requestPermission: requestPermission, startFirestoreSync: startFirestoreSync
    };
    console.log('✅ notifications.js loaded (Firestore sync + sound alerts + admin parity)');
})();
