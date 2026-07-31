// ============================================
// NOTIFICATIONS.JS - Pilot Sales Distribution
// In-app notification center + browser push-style
// notifications. No server, no API key.
// - Adds a bell to the page header (or floating)
// - Unread badge, dropdown panel, mark-as-read
// - localStorage persistence + cross-tab sync
// - Wraps showToast() so every site toast also
//   becomes an in-app notification
// ============================================
(function () {
    'use strict';

    var STORE_KEY = 'pse_notifications_v1';
    var SEEN_KEY = 'pse_notif_seen_v1';
    var MAX_STORED = 40;

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
    }
    function getUnread() { return loadAll().filter(function (n) { return !n.read; }); }

    // ─── PUSH A NOTIFICATION ───
    function push(title, message, opts) {
        opts = opts || {};
        var notif = {
            id: opts.id || uid(),
            title: title || 'Notification',
            message: message || '',
            url: opts.url || null,
            icon: opts.icon || 'fa-bell',
            tag: opts.tag || 'general',
            time: opts.time || Date.now(),
            read: false,
            system: !!opts.system
        };
        var list = loadAll();
        // de-dupe identical messages within 4s
        var last = list[0];
        if (last && last.title === notif.title && last.message === notif.message && (Date.now() - last.time) < 4000) {
            return last;
        }
        list.unshift(notif);
        saveAll(list);

        if (opts.system !== false && typeof window.Notification !== 'undefined') {
            try {
                if (window.Notification.permission === 'granted') {
                    var n = new window.Notification(title || 'PSE Distribution', {
                        body: message || '',
                        icon: opts.iconUrl || '/logo.jpg',
                        tag: notif.tag
                    });
                    if (opts.url && n.addEventListener) {
                        n.addEventListener('click', function () { window.focus(); window.location.href = opts.url; });
                    }
                    if (n.close) setTimeout(function () { n.close(); }, 8000);
                } else if (window.Notification.permission === 'default') {
                    window.__psePendingSystem = notif;
                }
            } catch (e) { /* system notifications unavailable */ }
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

    // ─── INJECT BELL + PANEL ───
    function injectUI() {
        if (document.getElementById('pse-notif-root')) return;

        var style = document.createElement('style');
        style.id = 'pse-notif-styles';
        style.textContent = `
            .pse-notif-wrap { position: relative; display: inline-flex; }
            .pse-notif-bell {
                position: relative; display: flex; flex-direction: column; align-items: center;
                font-size: 0.6rem; color: inherit; cursor: pointer; padding: 0.2rem 0.3rem;
                text-decoration: none; transition: color .3s ease;
            }
            .pse-notif-bell i { font-size: 1.3rem; margin-bottom: 2px; transition: transform .3s ease; }
            .pse-notif-bell:hover { color: var(--primary, #1a7b6b); }
            .pse-notif-bell:hover i { transform: scale(1.1); }
            .pse-notif-badge {
                position: absolute; top: -6px; right: -6px; background: #c0392b; color: #fff;
                font-size: 0.55rem; font-weight: 700; border-radius: 50%; padding: 0.1rem 0.45rem;
                min-width: 18px; height: 18px; display: none; align-items: center; justify-content: center;
                animation: pseBadgePop .3s ease;
            }
            @keyframes pseBadgePop { 0% { transform: scale(0); } 70% { transform: scale(1.3); } 100% { transform: scale(1); } }
            .pse-notif-panel {
                position: absolute; top: calc(100% + 12px); right: 0; width: 340px; max-width: 86vw;
                background: #fff; border-radius: 16px; box-shadow: 0 20px 60px rgba(11,42,59,.18);
                border: 1px solid #e9edf2; z-index: 99999; overflow: hidden; display: none;
                font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
            }
            .pse-notif-panel.open { display: block; animation: psePanelIn .25s ease; }
            @keyframes psePanelIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
            .pse-notif-head {
                display: flex; align-items: center; justify-content: space-between;
                padding: 0.9rem 1rem; background: linear-gradient(135deg, #0b2a3b, #1a4b5e); color: #fff;
            }
            .pse-notif-head strong { font-size: 0.95rem; }
            .pse-notif-head .pse-notif-actions { display: flex; gap: 0.4rem; }
            .pse-notif-head button {
                background: rgba(255,255,255,.12); color: #fff; border: none; border-radius: 30px;
                font-size: 0.7rem; padding: 0.3rem 0.7rem; cursor: pointer; transition: background .3s;
            }
            .pse-notif-head button:hover { background: rgba(255,255,255,.25); }
            .pse-notif-list { max-height: 380px; overflow-y: auto; }
            .pse-notif-empty { padding: 2.5rem 1rem; text-align: center; color: #6a889a; font-size: 0.85rem; }
            .pse-notif-item {
                display: flex; gap: 0.7rem; padding: 0.8rem 1rem; border-bottom: 1px solid #f0f4f8;
                cursor: pointer; transition: background .2s; text-align: left; width: 100%; border-left: 3px solid transparent;
            }
            .pse-notif-item:hover { background: #f7fafc; }
            .pse-notif-item.unread { background: #eef7f3; border-left-color: #1a7b6b; }
            .pse-notif-item .pse-notif-ico {
                width: 34px; height: 34px; border-radius: 50%; background: #e8f5f0; color: #1a7b6b;
                display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 0.9rem;
            }
            .pse-notif-item .pse-notif-body { flex: 1; min-width: 0; }
            .pse-notif-item .pse-notif-title { font-size: 0.83rem; font-weight: 700; color: #0b2a3b; }
            .pse-notif-item .pse-notif-msg { font-size: 0.78rem; color: #6a889a; margin-top: 2px; line-height: 1.45; }
            .pse-notif-item .pse-notif-time { font-size: 0.68rem; color: #9fb3c2; margin-top: 4px; }
            .pse-notif-floating {
                position: fixed; right: 22px; bottom: 96px; z-index: 2147483001;
            }
        `;
        document.head.appendChild(style);

        var root = document.createElement('div');
        root.id = 'pse-notif-root';
        root.className = 'pse-notif-wrap';

        var bell = document.createElement('a');
        bell.href = 'javascript:void(0)';
        bell.className = 'pse-notif-bell';
        bell.id = 'pse-notif-bell';
        bell.setAttribute('aria-label', 'Notifications');
        bell.innerHTML = '<i class="fa-regular fa-bell"></i><span class="pse-notif-badge pse-notif-badge--bell"></span><span style="line-height:1.1;">Alerts</span>';
        bell.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            togglePanel();
            requestPermission();
        });

        var panel = document.createElement('div');
        panel.className = 'pse-notif-panel';
        panel.id = 'pse-notif-panel';
        panel.innerHTML = `
            <div class="pse-notif-head">
                <strong><i class="fa-regular fa-bell"></i> Notifications</strong>
                <div class="pse-notif-actions">
                    <button type="button" data-action="read">Read all</button>
                    <button type="button" data-action="clear">Clear</button>
                </div>
            </div>
            <div class="pse-notif-list" id="pse-notif-list"></div>
        `;
        panel.addEventListener('click', function (e) {
            e.stopPropagation();
            var actionBtn = e.target.closest('[data-action]');
            if (actionBtn) {
                if (actionBtn.dataset.action === 'read') markAllRead();
                if (actionBtn.dataset.action === 'clear') clearAll();
                renderPanel();
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
        // badge count elements inside bell
        document.querySelectorAll('.pse-notif-badge--bell').forEach(function (b) { b.classList.add('pse-notif-badge'); });

        // Insert into .header-actions if it exists, otherwise floating
        var host = document.querySelector('.header-actions');
        if (host) {
            host.appendChild(root);
            root.classList.add('pse-notif-in-header');
        } else {
            root.classList.add('pse-notif-floating');
            document.body.appendChild(root);
        }

        document.addEventListener('click', function (e) {
            if (!root.contains(e.target)) closePanel();
        });

        function togglePanel() { panel.classList.toggle('open'); if (panel.classList.contains('open')) markAllRead(); }
        window.__pseToggleNotifPanel = togglePanel;
    }

    function renderPanel() {
        var listEl = document.getElementById('pse-notif-list');
        if (!listEl) return;
        var list = loadAll();
        if (!list.length) {
            listEl.innerHTML = '<div class="pse-notif-empty"><i class="fa-regular fa-bell-slash" style="font-size:1.8rem;color:#c9d8e2;"></i><p style="margin-top:0.5rem;">You\'re all caught up!</p></div>';
            return;
        }
        listEl.innerHTML = list.map(function (n) {
            var t = n.time ? new Date(n.time) : null;
            var timeStr = t ? t.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
            return '<div class="pse-notif-item' + (n.read ? '' : ' unread') + '" data-id="' + n.id + '" data-url="' + (n.url || '') + '">' +
                '<div class="pse-notif-ico"><i class="fa-solid ' + (n.icon || 'fa-bell') + '"></i></div>' +
                '<div class="pse-notif-body">' +
                '<div class="pse-notif-title">' + esc(n.title) + '</div>' +
                (n.message ? '<div class="pse-notif-msg">' + esc(n.message) + '</div>' : '') +
                (timeStr ? '<div class="pse-notif-time">' + timeStr + '</div>' : '') +
                '</div></div>';
        }).join('');
    }
    function esc(s) {
        return String(s || '').replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
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
                if (message && typeof message === 'string' && message.length > 4) {
                    var icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info' };
                    var titles = { success: 'Success', error: 'Something went wrong', info: 'Notice' };
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
        if (e.key === 'pse_support_reply') {
            try {
                var reply = JSON.parse(e.newValue);
                if (reply && reply.message) {
                    push(reply.title || 'Live support', reply.message, { url: reply.url || '/chat', icon: 'fa-headset', tag: 'support' });
                    var p = document.getElementById('pse-notif-panel');
                    if (p && !p.classList.contains('open') && window.__pseAssistant) {
                        window.__pseAssistant.setBadge(1);
                    }
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
        // seed welcome notification once
        if (!lsGet(SEEN_KEY, false)) {
            lsSet(SEEN_KEY, true);
            push('Welcome to PSE Distribution 👋', 'We added an AI assistant & live support. Tap the chat bubble to try it!', {
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
        push: push, markAllRead: markAllRead, clearAll: clearAll, getUnread: getUnread
    };
    console.log('✅ notifications.js loaded (no API key needed)');
})();
