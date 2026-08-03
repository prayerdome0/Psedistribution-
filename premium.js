// ============================================
// PREMIUM.JS - Pilot Sales Distribution
// Admin-managed premium suite:
//   • Coupons & promo codes (checkout redemption)
//   • Site-wide promo banners (scheduled)
//   • Flash sales (global % off)
//   • Loyalty points + tiered VIP program
//   • Store-credit wallet + referrals
//   • Admin audit log
//
// 100% client-side, Firestore-backed, no API keys.
// Public API:  window.PSE_PREMIUM
// Admin API:   window.PremiumAdmin
// ============================================
(function () {
    'use strict';

    var LOG = '[PSE Premium]';

    // ─── DEFAULT SITE-WIDE CONFIG ───
    var DEFAULT_CONFIG = {
        loyalty_enabled: true,
        points_per_dollar: 1,            // earn rate (points per $1 spent)
        signup_bonus_points: 100,         // points granted on first profile save
        referral_bonus_points: 500,       // bonus to the referrer
        referral_invitee_points: 200,     // bonus to the invited buyer
        wallet_enabled: true,
        coupons_enabled: true,
        banners_enabled: true,
        flash_sale_enabled: false,
        updated_at: null
    };

    var DEFAULT_TIERS = [
        { name: 'Bronze',   min_points: 0,    multiplier: 1.0, color: '#cd7f32', perks: 'Standard earn rate • Members-only coupons' },
        { name: 'Silver',   min_points: 1000, multiplier: 1.25, color: '#95a5a6', perks: '1.25× points • Free sample shipping' },
        { name: 'Gold',     min_points: 5000, multiplier: 1.5, color: '#f1c40f', perks: '1.5× points • Priority support • Early flash-sale access' },
        { name: 'Platinum', min_points: 15000, multiplier: 2.0, color: '#9b59b6', perks: '2× points • Dedicated account manager • Concierge RFQ' }
    ];

    var config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    var tiers = JSON.parse(JSON.stringify(DEFAULT_TIERS));
    var configLoaded = false;
    var walletUsers = [];   // cached for wallet-row actions

    // ─── FIREBASE GUARDS ───
    function db() { return (typeof window !== 'undefined' && window.db) ? window.db : null; }
    function ready(fn, tries) {
        tries = tries || 0;
        if (typeof firebase !== 'undefined' && db()) { fn(); return; }
        if (tries > 24) { console.warn(LOG, 'Firebase not available — premium running in degraded mode'); fn(); return; }
        setTimeout(function () { ready(fn, tries + 1); }, 400);
    }

    function toast(msg, type) {
        if (typeof window.showToast === 'function') { try { window.showToast(msg, type); return; } catch (e) {} }
        console.log(LOG, '(' + (type || 'info') + ')', msg);
    }

    function nowISO() { return new Date().toISOString(); }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
        });
    }
    function uid() {
        try { var u = localStorage.getItem('pilot_user'); return u ? JSON.parse(u) : null; } catch (e) { return null; }
    }
    function fmtMoney(n) { return '$' + (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

    function inWindow(start, end) {
        var t = Date.now();
        if (start && new Date(start).getTime() > t) return false;
        if (end && new Date(end).getTime() < t) return false;
        return true;
    }

    // ════════════════════════════════════════════
    // CONFIG + TIERS
    // ════════════════════════════════════════════
    async function loadConfig() {
        var d = db();
        if (!d) return config;
        try {
            var snap = await d.collection('config').doc('premium').get();
            if (snap.exists) {
                config = Object.assign({}, DEFAULT_CONFIG, snap.data() || {});
            }
            var tsnap = await d.collection('config').doc('loyalty_tiers').get();
            if (tsnap.exists && Array.isArray(tsnap.data().tiers) && tsnap.data().tiers.length) {
                tiers = tsnap.data().tiers;
            }
            configLoaded = true;
        } catch (e) {
            console.warn(LOG, 'Config load failed, using defaults', e);
        }
        return config;
    }

    function getConfig() { return config; }
    function getTiers() { return tiers; }

    function computeTier(points) {
        points = Number(points) || 0;
        var current = tiers[0];
        var next = null;
        for (var i = 0; i < tiers.length; i++) {
            if (points >= tiers[i].min_points) current = tiers[i];
        }
        var idx = tiers.indexOf(current);
        if (idx >= 0 && idx < tiers.length - 1) next = tiers[idx + 1];
        return { current: current, next: next, points: points };
    }

    // ════════════════════════════════════════════
    // COUPONS
    // ════════════════════════════════════════════
    async function getCoupons() {
        var d = db(); if (!d) return [];
        try {
            var snap = await d.collection('coupons').orderBy('created_at', 'desc').get();
            var out = [];
            snap.forEach(function (doc) { out.push(Object.assign({ id: doc.id }, doc.data())); });
            return out;
        } catch (e) { console.warn(LOG, 'coupons load failed', e); return []; }
    }

    // Returns { valid, discount, message, coupon }
    async function validateCoupon(code, subtotal) {
        if (!config.coupons_enabled) return { valid: false, discount: 0, message: 'Coupons are currently disabled.', coupon: null };
        code = String(code || '').trim().toUpperCase();
        if (!code) return { valid: false, discount: 0, message: 'Enter a coupon code.', coupon: null };
        subtotal = Number(subtotal) || 0;
        var list = await getCoupons();
        var c = list.find(function (x) { return String(x.code || '').toUpperCase() === code; });
        if (!c) return { valid: false, discount: 0, message: 'Coupon "' + code + '" not found.', coupon: null };
        if (!c.active) return { valid: false, discount: 0, message: 'This coupon is no longer active.', coupon: c };
        if (c.start_at && new Date(c.start_at).getTime() > Date.now()) return { valid: false, discount: 0, message: 'This coupon is not valid yet.', coupon: c };
        if (c.expires_at && new Date(c.expires_at).getTime() < Date.now()) return { valid: false, discount: 0, message: 'This coupon has expired.', coupon: c };
        if (c.max_uses && Number(c.used || 0) >= Number(c.max_uses)) return { valid: false, discount: 0, message: 'This coupon has reached its usage limit.', coupon: c };
        if (c.min_spend && subtotal < Number(c.min_spend)) return { valid: false, discount: 0, message: 'Spend ' + fmtMoney(c.min_spend) + ' or more to use this coupon.', coupon: c };

        var discount = 0;
        if (c.type === 'percent') {
            discount = subtotal * (Number(c.value) || 0) / 100;
        } else {
            discount = Number(c.value) || 0;
        }
        if (discount > subtotal) discount = subtotal;
        return { valid: true, discount: discount, message: 'Coupon applied: ' + (c.type === 'percent' ? c.value + '% off' : fmtMoney(c.value) + ' off'), coupon: c };
    }

    async function redeemCoupon(couponId) {
        var d = db(); if (!d || !couponId) return;
        try { await d.collection('coupons').doc(couponId).set({ used: firebase.firestore.FieldValue.increment(1) }, { merge: true }); } catch (e) {}
    }

    // ════════════════════════════════════════════
    // PROMO BANNERS
    // ════════════════════════════════════════════
    async function getActiveBanners() {
        if (!config.banners_enabled) return [];
        var d = db(); if (!d) return [];
        try {
            var snap = await d.collection('promo_banners').orderBy('created_at', 'desc').get();
            var out = [];
            snap.forEach(function (doc) { out.push(Object.assign({ id: doc.id }, doc.data())); });
            return out.filter(function (b) { return b.active && inWindow(b.start_at, b.end_at); });
        } catch (e) { return []; }
    }

    function renderBanner(banner) {
        if (!banner || document.getElementById('psePromoBanner')) return;
        var el = document.createElement('div');
        el.id = 'psePromoBanner';
        el.style.cssText = 'width:100%;background:' + (banner.bg || '#1565c0') + ';color:' + (banner.color || '#fff') +
            ';text-align:center;font-size:0.82rem;font-weight:600;padding:8px 14px;letter-spacing:.2px;' +
            'position:relative;z-index:1100;font-family:inherit;';
        var html = '<span style="display:inline-flex;align-items:center;gap:6px;">' +
            (banner.emoji ? '<span>' + esc(banner.emoji) + '</span>' : '') +
            '<span>' + esc(banner.text || '') + '</span></span>';
        if (banner.link) html = '<a href="' + esc(banner.link) + '" style="color:inherit;text-decoration:none;">' + html + '</a>';
        html += '<span id="psePromoBannerClose" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);cursor:pointer;opacity:.8;font-weight:700;font-size:1rem;">×</span>';
        el.innerHTML = html;
        document.body.insertBefore(el, document.body.firstChild);
        var close = document.getElementById('psePromoBannerClose');
        if (close) close.onclick = function () { el.style.display = 'none'; };
    }

    async function initBanners() {
        // Don't show customer promo banners inside the admin dashboard.
        if (/admin-dashboard/i.test(location.pathname)) return;
        try {
            var banners = await getActiveBanners();
            if (banners.length) renderBanner(banners[0]);
        } catch (e) { /* silent */ }
    }

    // ════════════════════════════════════════════
    // FLASH SALES
    // ════════════════════════════════════════════
    async function getActiveFlashSale() {
        if (!config.flash_sale_enabled) return null;
        var d = db(); if (!d) return null;
        try {
            var snap = await d.collection('flash_sales').orderBy('created_at', 'desc').get();
            var list = [];
            snap.forEach(function (doc) { list.push(Object.assign({ id: doc.id }, doc.data())); });
            return list.find(function (s) { return s.active && inWindow(s.start_at, s.end_at); }) || null;
        } catch (e) { return null; }
    }

    // ════════════════════════════════════════════
    // LOYALTY + WALLET + REFERRALS (user side)
    // ════════════════════════════════════════════
    async function getUserLoyalty(userId) {
        var d = db(); if (!d || !userId) return null;
        try {
            var snap = await d.collection('users').doc(userId).get();
            if (!snap.exists) return null;
            var data = snap.data();
            return {
                points: Number(data.loyalty_points) || 0,
                wallet: Number(data.wallet_balance) || 0,
                referral_code: data.referral_code || '',
                referred_by: data.referred_by || '',
                tier: computeTier(data.loyalty_points || 0).current
            };
        } catch (e) { return null; }
    }

    function genReferralCode(seed) {
        var s = String(seed || '').replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase() || 'PSE';
        return 'PSE-' + s + Math.random().toString(36).slice(2, 6).toUpperCase();
    }

    async function ensureReferralCode(userId, email) {
        var d = db(); if (!d || !userId) return null;
        try {
            var ref = d.collection('users').doc(userId);
            var snap = await ref.get();
            if (snap.exists && snap.data().referral_code) return snap.data().referral_code;
            var code = genReferralCode(email || userId);
            await ref.set({ referral_code: code, updated_at: nowISO() }, { merge: true });
            return code;
        } catch (e) { return null; }
    }

    // Apply referral on signup/profile-save (guarded, one-time).
    async function maybeApplyReferral(userId, referralInput) {
        if (!referralInput) return;
        var d = db(); if (!d || !userId) return;
        try {
            var me = await d.collection('users').doc(userId).get();
            if (!me.exists) return;
            var my = me.data();
            if (my.referred_by) return; // already attributed
            // Find referrer by code
            var q = await d.collection('users').where('referral_code', '==', referralInput.trim()).limit(1).get();
            if (q.empty) return;
            var refDoc = q.docs[0];
            if (refDoc.id === userId) return; // can't refer self
            var batch = d.batch();
            batch.set(d.collection('users').doc(userId), {
                referred_by: refDoc.id,
                loyalty_points: firebase.firestore.FieldValue.increment(Number(config.referral_invitee_points) || 0),
                updated_at: nowISO()
            }, { merge: true });
            batch.set(refDoc.ref, {
                loyalty_points: firebase.firestore.FieldValue.increment(Number(config.referral_bonus_points) || 0),
                updated_at: nowISO()
            }, { merge: true });
            batch.set(d.collection('referrals'), {
                referrer_id: refDoc.id,
                referred_id: userId,
                bonus_referrer: Number(config.referral_bonus_points) || 0,
                bonus_invitee: Number(config.referral_invitee_points) || 0,
                created_at: nowISO()
            });
            await batch.commit();
        } catch (e) { console.warn(LOG, 'referral apply failed', e); }
    }

    // Award points for an order total (called after a successful order).
    async function awardPointsForOrder(userId, orderTotal) {
        if (!config.loyalty_enabled || !userId) return 0;
        var d = db(); if (!d) return 0;
        try {
            var snap = await d.collection('users').doc(userId).get();
            if (!snap.exists) return 0;
            var pts = Math.floor((Number(orderTotal) || 0) * (Number(config.points_per_dollar) || 0));
            var mult = Number(computeTier(snap.data().loyalty_points || 0).current.multiplier) || 1;
            pts = Math.floor(pts * mult);
            if (pts <= 0) return 0;
            await d.collection('users').doc(userId).set({
                loyalty_points: firebase.firestore.FieldValue.increment(pts),
                updated_at: nowISO()
            }, { merge: true });
            await d.collection('point_ledger').add({
                user_id: userId, delta: pts, reason: 'Order reward', amount: orderTotal, created_at: nowISO()
            });
            return pts;
        } catch (e) { console.warn(LOG, 'award points failed', e); return 0; }
    }

    // ════════════════════════════════════════════
    // AUDIT LOG
    // ════════════════════════════════════════════
    async function logAudit(action, detail) {
        var d = db(); if (!d) return;
        var actor = 'system';
        try { var u = uid(); if (u) actor = u.email || (u.role + ':' + u.id); } catch (e) {}
        try {
            await d.collection('audit_log').add({
                actor: actor, action: action || 'action', detail: detail || '', page: location.pathname,
                created_at: nowISO()
            });
        } catch (e) { /* never let audit break a flow */ }
    }

    // ════════════════════════════════════════════
    // BOOT (every page)
    // ════════════════════════════════════════════
    function boot() {
        ready(function () {
            loadConfig().then(function () {
                initBanners();
                window.dispatchEvent(new CustomEvent('pse_premium_ready', { detail: config }));
            });
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();

    // ════════════════════════════════════════════
    // PUBLIC API
    // ════════════════════════════════════════════
    window.PSE_PREMIUM = {
        loadConfig: loadConfig,
        getConfig: getConfig,
        getTiers: getTiers,
        computeTier: computeTier,
        getCoupons: getCoupons,
        validateCoupon: validateCoupon,
        redeemCoupon: redeemCoupon,
        getActiveBanners: getActiveBanners,
        getActiveFlashSale: getActiveFlashSale,
        getUserLoyalty: getUserLoyalty,
        ensureReferralCode: ensureReferralCode,
        maybeApplyReferral: maybeApplyReferral,
        awardPointsForOrder: awardPointsForOrder,
        logAudit: logAudit,
        fmtMoney: fmtMoney,
        DEFAULT_TIERS: DEFAULT_TIERS,
        DEFAULT_CONFIG: DEFAULT_CONFIG
    };

    // ════════════════════════════════════════════════════════════════
    //  ADMIN MANAGEMENT  (window.PremiumAdmin)
    //  Used by admin-dashboard.html premium tabs.
    // ════════════════════════════════════════════════════════════════
    function el(id) { return document.getElementById(id); }

    async function requireAdmin() {
        var u = uid();
        if (!u || u.role !== 'admin') {
            toast('Admin access required', 'error');
            return false;
        }
        return true;
    }

    // ─── COUPONS ADMIN ───
    async function loadCouponsAdmin() {
        if (!(await requireAdmin())) return;
        var tbody = el('couponTableBody'); if (!tbody) return;
        var list = await getCoupons();
        if (!list.length) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:#888;">No coupons yet. Create your first discount code below. 🎟️</td></tr>';
            return;
        }
        tbody.innerHTML = list.map(function (c) {
            var expired = c.expires_at && new Date(c.expires_at).getTime() < Date.now();
            var status = !c.active ? 'Paused' : expired ? 'Expired' : (c.max_uses && Number(c.used || 0) >= Number(c.max_uses)) ? 'Used up' : 'Active';
            var statusCls = status === 'Active' ? 'active' : 'suspended';
            var valTxt = c.type === 'percent' ? (c.value + '% off') : fmtMoney(c.value);
            var uses = (c.used || 0) + (c.max_uses ? ' / ' + c.max_uses : '');
            return '<tr>' +
                '<td><strong style="font-family:monospace;">' + esc(c.code) + '</strong></td>' +
                '<td>' + esc(valTxt) + '</td>' +
                '<td>' + (c.min_spend ? fmtMoney(c.min_spend) : '—') + '</td>' +
                '<td>' + esc(uses) + '</td>' +
                '<td>' + (c.expires_at ? new Date(c.expires_at).toLocaleDateString() : '—') + '</td>' +
                '<td><span class="status-badge ' + statusCls + '">' + status + '</span></td>' +
                '<td>' +
                    '<button class="btn-action" style="background:#f39c12;color:#fff;" title="Toggle" onclick="PremiumAdmin.toggleCoupon(\'' + c.id + '\',' + (!c.active) + ')"><i class="fa-solid fa-power-off"></i></button> ' +
                    '<button class="btn-action delete" title="Delete" onclick="PremiumAdmin.deleteCoupon(\'' + c.id + '\')"><i class="fa-regular fa-trash-can"></i></button>' +
                '</td>' +
                '</tr>';
        }).join('');
    }

    async function addCouponFromForm() {
        if (!(await requireAdmin())) return;
        var code = (el('cCode').value || '').trim().toUpperCase();
        var type = el('cType').value;
        var value = parseFloat(el('cValue').value);
        var minSpend = parseFloat(el('cMin').value) || 0;
        var maxUses = parseInt(el('cMaxUses').value) || 0;
        var expires = el('cExpires').value;
        if (!code) { toast('Coupon code is required', 'error'); return; }
        if (isNaN(value) || value <= 0) { toast('Enter a valid discount value', 'error'); return; }
        if (type === 'percent' && value > 100) { toast('Percent cannot exceed 100', 'error'); return; }
        try {
            await db().collection('coupons').add({
                code: code, type: type, value: value, min_spend: minSpend, max_uses: maxUses,
                used: 0, expires_at: expires ? new Date(expires).toISOString() : null, start_at: null,
                active: true, created_at: nowISO()
            });
            await logAudit('coupon.create', code + ' (' + (type === 'percent' ? value + '%' : fmtMoney(value)) + ')');
            toast('🎟️ Coupon ' + code + ' created', 'success');
            ['cCode', 'cValue', 'cMin', 'cMaxUses', 'cExpires'].forEach(function (i) { var x = el(i); if (x) x.value = ''; });
            loadCouponsAdmin();
        } catch (e) { toast('Failed: ' + e.message, 'error'); }
    }

    async function toggleCoupon(id, on) {
        if (!(await requireAdmin())) return;
        try { await db().collection('coupons').doc(id).update({ active: !!on, updated_at: nowISO() }); await logAudit('coupon.toggle', id + ' -> ' + (on ? 'active' : 'paused')); loadCouponsAdmin(); } catch (e) { toast('Failed', 'error'); }
    }
    async function deleteCoupon(id) {
        if (!(await requireAdmin())) return;
        if (!confirm('Delete this coupon permanently?')) return;
        try { await db().collection('coupons').doc(id).delete(); await logAudit('coupon.delete', id); loadCouponsAdmin(); toast('Coupon deleted', 'info'); } catch (e) { toast('Failed', 'error'); }
    }

    // ─── PROMO BANNERS ADMIN ───
    async function loadBannersAdmin() {
        if (!(await requireAdmin())) return;
        var box = el('bannerList'); if (!box) return;
        var d = db();
        try {
            var snap = await d.collection('promo_banners').orderBy('created_at', 'desc').get();
            var list = []; snap.forEach(function (doc) { list.push(Object.assign({ id: doc.id }, doc.data())); });
            if (!list.length) { box.innerHTML = '<p style="color:#888;padding:1rem 0;">No promo banners yet.</p>'; return; }
            box.innerHTML = list.map(function (b) {
                return '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.7rem 0.9rem;border:1px solid #e3e8ee;border-radius:8px;margin-bottom:0.5rem;background:' + (b.bg || '#1565c0') + ';color:' + (b.color || '#fff') + ';">' +
                    '<span>' + esc(b.emoji || '') + '</span>' +
                    '<strong style="flex:1;">' + esc(b.text || '') + '</strong>' +
                    '<span style="font-size:0.7rem;opacity:.9;">' + (b.link ? esc(b.link) : 'no link') + '</span>' +
                    '<button class="btn-action" style="background:rgba(255,255,255,.25);color:#fff;" title="Toggle" onclick="PremiumAdmin.toggleBanner(\'' + b.id + '\',' + (!b.active) + ')"><i class="fa-solid fa-power-off"></i></button>' +
                    '<button class="btn-action delete" title="Delete" onclick="PremiumAdmin.deleteBanner(\'' + b.id + '\')"><i class="fa-regular fa-trash-can"></i></button>' +
                    '</div>';
            }).join('');
        } catch (e) { box.innerHTML = '<p style="color:#c0392b;">Failed to load banners</p>'; }
    }
    async function addBannerFromForm() {
        if (!(await requireAdmin())) return;
        var text = (el('bText').value || '').trim();
        var emoji = (el('bEmoji').value || '').trim();
        var link = (el('bLink').value || '').trim();
        var bg = (el('bBg').value || '').trim() || '#1565c0';
        var color = (el('bColor').value || '').trim() || '#ffffff';
        var start = el('bStart').value, end = el('bEnd').value;
        if (!text) { toast('Banner text is required', 'error'); return; }
        try {
            await db().collection('promo_banners').add({
                text: text, emoji: emoji, link: link, bg: bg, color: color,
                start_at: start ? new Date(start).toISOString() : null,
                end_at: end ? new Date(end).toISOString() : null,
                active: true, created_at: nowISO()
            });
            await logAudit('banner.create', text);
            toast('📣 Banner published', 'success');
            ['bText', 'bEmoji', 'bLink', 'bStart', 'bEnd'].forEach(function (i) { var x = el(i); if (x) x.value = ''; });
            loadBannersAdmin();
        } catch (e) { toast('Failed: ' + e.message, 'error'); }
    }
    async function toggleBanner(id, on) {
        if (!(await requireAdmin())) return;
        try { await db().collection('promo_banners').doc(id).update({ active: !!on }); await logAudit('banner.toggle', id); loadBannersAdmin(); } catch (e) { toast('Failed', 'error'); }
    }
    async function deleteBanner(id) {
        if (!(await requireAdmin())) return;
        if (!confirm('Delete this banner?')) return;
        try { await db().collection('promo_banners').doc(id).delete(); await logAudit('banner.delete', id); loadBannersAdmin(); toast('Banner deleted', 'info'); } catch (e) { toast('Failed', 'error'); }
    }

    // ─── FLASH SALES ADMIN ───
    async function loadFlashAdmin() {
        if (!(await requireAdmin())) return;
        var box = el('flashList'); if (!box) return;
        try {
            var snap = await db().collection('flash_sales').orderBy('created_at', 'desc').get();
            var list = []; snap.forEach(function (doc) { list.push(Object.assign({ id: doc.id }, doc.data())); });
            if (!list.length) { box.innerHTML = '<p style="color:#888;padding:1rem 0;">No flash sales yet.</p>'; return; }
            box.innerHTML = list.map(function (s) {
                var live = s.active && inWindow(s.start_at, s.end_at);
                return '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.7rem 0.9rem;border:1px solid #e3e8ee;border-radius:8px;margin-bottom:0.5rem;">' +
                    '<span style="font-size:1.2rem;">⚡</span>' +
                    '<strong style="flex:1;">' + esc(s.name || 'Flash Sale') + ' — ' + esc(s.discount_percent) + '% off</strong>' +
                    '<span style="font-size:0.72rem;color:#666;">' + (s.start_at ? new Date(s.start_at).toLocaleString() : 'now') + ' → ' + (s.end_at ? new Date(s.end_at).toLocaleString() : '∞') + '</span>' +
                    (live ? '<span class="status-badge active">LIVE</span>' : '<span class="status-badge inactive">Off</span>') +
                    '<button class="btn-action" style="background:#f39c12;color:#fff;" title="Toggle" onclick="PremiumAdmin.toggleFlash(\'' + s.id + '\',' + (!s.active) + ')"><i class="fa-solid fa-power-off"></i></button>' +
                    '<button class="btn-action delete" title="Delete" onclick="PremiumAdmin.deleteFlash(\'' + s.id + '\')"><i class="fa-regular fa-trash-can"></i></button>' +
                    '</div>';
            }).join('');
        } catch (e) { box.innerHTML = '<p style="color:#c0392b;">Failed to load</p>'; }
    }
    async function addFlashFromForm() {
        if (!(await requireAdmin())) return;
        var name = (el('fName').value || '').trim() || 'Flash Sale';
        var pct = parseFloat(el('fPct').value);
        var start = el('fStart').value, end = el('fEnd').value;
        if (isNaN(pct) || pct <= 0 || pct > 90) { toast('Enter a discount % between 1 and 90', 'error'); return; }
        try {
            await db().collection('flash_sales').add({
                name: name, discount_percent: pct,
                start_at: start ? new Date(start).toISOString() : null,
                end_at: end ? new Date(end).toISOString() : null,
                active: true, created_at: nowISO()
            });
            await logAudit('flash.create', name + ' ' + pct + '%');
            toast('⚡ Flash sale scheduled', 'success');
            ['fName', 'fPct', 'fStart', 'fEnd'].forEach(function (i) { var x = el(i); if (x) x.value = ''; });
            loadFlashAdmin();
        } catch (e) { toast('Failed: ' + e.message, 'error'); }
    }
    async function toggleFlash(id, on) {
        if (!(await requireAdmin())) return;
        try { await db().collection('flash_sales').doc(id).update({ active: !!on }); await logAudit('flash.toggle', id); loadFlashAdmin(); } catch (e) { toast('Failed', 'error'); }
    }
    async function deleteFlash(id) {
        if (!(await requireAdmin())) return;
        if (!confirm('Delete this flash sale?')) return;
        try { await db().collection('flash_sales').doc(id).delete(); await logAudit('flash.delete', id); loadFlashAdmin(); toast('Deleted', 'info'); } catch (e) { toast('Failed', 'error'); }
    }

    // ─── LOYALTY + WALLET ADMIN ───
    async function loadLoyaltyAdmin() {
        if (!(await requireAdmin())) return;
        await loadConfig();
        // settings form
        var f = el('pmSettingsForm');
        if (f) {
            var set = function (id, val) { var x = el(id); if (x != null) x.value = val; };
            set('pmLoyaltyOn', config.loyalty_enabled ? 'on' : 'off');
            set('pmWalletOn', config.wallet_enabled ? 'on' : 'off');
            set('pmCouponsOn', config.coupons_enabled ? 'on' : 'off');
            set('pmBannersOn', config.banners_enabled ? 'on' : 'off');
            set('pmFlashOn', config.flash_sale_enabled ? 'on' : 'off');
            set('pmPpd', config.points_per_dollar);
            set('pmSignupBonus', config.signup_bonus_points);
            set('pmRefBonus', config.referral_bonus_points);
            set('pmInviteeBonus', config.referral_invitee_points);
        }
        // tiers table
        var tbody = el('tierTableBody');
        if (tbody) {
            tbody.innerHTML = tiers.map(function (t, i) {
                return '<tr>' +
                    '<td><span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:' + esc(t.color) + ';vertical-align:middle;margin-right:6px;"></span><strong>' + esc(t.name) + '</strong></td>' +
                    '<td>' + (t.min_points) + ' pts</td>' +
                    '<td>' + esc(t.multiplier) + '×</td>' +
                    '<td style="color:#555;font-size:0.8rem;">' + esc(t.perks || '') + '</td>' +
                    '</tr>';
            }).join('');
        }
        // wallet holders
        var wbody = el('walletTableBody');
        if (wbody) {
            try {
                var snap = await db().collection('users').get();
                walletUsers = []; snap.forEach(function (doc) { walletUsers.push(Object.assign({ id: doc.id }, doc.data())); });
                var holders = walletUsers.filter(function (u) { return (Number(u.wallet_balance) || 0) !== 0 || (Number(u.loyalty_points) || 0) !== 0; });
                if (!holders.length) {
                    wbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:1.5rem;color:#888;">No wallets with a balance yet.</td></tr>';
                } else {
                    wbody.innerHTML = holders.map(function (u) {
                        var tier = computeTier(u.loyalty_points || 0).current;
                        return '<tr>' +
                            '<td><strong>' + esc(u.full_name || u.email || 'User') + '</strong></td>' +
                            '<td>' + esc(u.email || '') + '</td>' +
                            '<td><span style="color:' + esc(tier.color) + ';font-weight:700;">' + esc(tier.name) + '</span> • ' + (u.loyalty_points || 0) + ' pts</td>' +
                            '<td>' + fmtMoney(u.wallet_balance || 0) + '</td>' +
                            '<td><button class="btn-action reply" title="Adjust wallet" onclick="PremiumAdmin.adjustWallet(\'' + u.id + '\')"><i class="fa-solid fa-wallet"></i> Adjust</button></td>' +
                            '</tr>';
                    }).join('');
                }
            } catch (e) { wbody.innerHTML = '<tr><td colspan="5" style="color:#c0392b;">Error loading wallets</td></tr>'; }
        }
    }

    async function savePmSettings() {
        if (!(await requireAdmin())) return;
        var val = function (id, fallback) { var x = el(id); return x ? x.value : fallback; };
        var boolVal = function (id) { return val(id, 'on') === 'on'; };
        var num = function (id, fb) { var n = parseFloat(val(id, fb)); return isNaN(n) ? fb : n; };
        var next = {
            loyalty_enabled: boolVal('pmLoyaltyOn'),
            wallet_enabled: boolVal('pmWalletOn'),
            coupons_enabled: boolVal('pmCouponsOn'),
            banners_enabled: boolVal('pmBannersOn'),
            flash_sale_enabled: boolVal('pmFlashOn'),
            points_per_dollar: num('pmPpd', 1),
            signup_bonus_points: num('pmSignupBonus', 100),
            referral_bonus_points: num('pmRefBonus', 500),
            referral_invitee_points: num('pmInviteeBonus', 200),
            updated_at: nowISO()
        };
        try {
            await db().collection('config').doc('premium').set(next, { merge: true });
            Object.assign(config, next);
            await logAudit('premium.settings', 'loyalty=' + next.loyalty_enabled + ' ppd=' + next.points_per_dollar);
            toast('✅ Premium settings saved', 'success');
        } catch (e) { toast('Failed: ' + e.message, 'error'); }
    }

    async function resetTiers() {
        if (!(await requireAdmin())) return;
        if (!confirm('Reset loyalty tiers to the recommended defaults?')) return;
        try {
            await db().collection('config').doc('loyalty_tiers').set({ tiers: DEFAULT_TIERS, updated_at: nowISO() });
            tiers = JSON.parse(JSON.stringify(DEFAULT_TIERS));
            await logAudit('loyalty.tiers_reset', 'defaults');
            toast('🏆 Tiers reset to defaults', 'success');
            loadLoyaltyAdmin();
        } catch (e) { toast('Failed', 'error'); }
    }

    async function adjustWallet(userId) {
        if (!(await requireAdmin())) return;
        var u = walletUsers.find(function (x) { return x.id === userId; }) || {};
        var label = u.full_name || u.email || 'this user';
        var amt = prompt('Adjust store-credit wallet for ' + label + '.\nUse a positive amount to credit, or a negative amount to debit (e.g. -25).', '25');
        if (amt === null) return;
        amt = parseFloat(amt);
        if (isNaN(amt) || amt === 0) { toast('Enter a non-zero amount', 'error'); return; }
        try {
            await db().collection('users').doc(userId).set({
                wallet_balance: firebase.firestore.FieldValue.increment(amt),
                updated_at: nowISO()
            }, { merge: true });
            await db().collection('point_ledger').add({ user_id: userId, delta: 0, wallet_delta: amt, reason: 'Admin adjustment', created_at: nowISO() });
            await logAudit('wallet.adjust', label + ' ' + (amt > 0 ? '+' : '') + fmtMoney(amt));
            toast('💰 Wallet ' + (amt > 0 ? 'credited' : 'debited') + ' ' + fmtMoney(Math.abs(amt)), 'success');
            loadLoyaltyAdmin();
        } catch (e) { toast('Failed: ' + e.message, 'error'); }
    }

    // ─── AUDIT LOG ADMIN ───
    async function loadAuditAdmin() {
        if (!(await requireAdmin())) return;
        var tbody = el('auditTableBody'); if (!tbody) return;
        try {
            var snap = await db().collection('audit_log').orderBy('created_at', 'desc').limit(120).get();
            var list = []; snap.forEach(function (doc) { list.push(Object.assign({ id: doc.id }, doc.data())); });
            if (!list.length) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:1.5rem;color:#888;">No admin actions logged yet.</td></tr>'; return; }
            tbody.innerHTML = list.map(function (a) {
                return '<tr>' +
                    '<td style="white-space:nowrap;">' + (a.created_at ? new Date(a.created_at).toLocaleString() : '—') + '</td>' +
                    '<td>' + esc(a.actor || 'system') + '</td>' +
                    '<td><span class="status-badge active">' + esc(a.action || '') + '</span></td>' +
                    '<td style="color:#555;font-size:0.82rem;">' + esc(a.detail || '') + (a.page ? ' <span style="color:#aaa;">(' + esc(a.page) + ')</span>' : '') + '</td>' +
                    '</tr>';
            }).join('');
        } catch (e) { tbody.innerHTML = '<tr><td colspan="4" style="color:#c0392b;">Error loading audit log</td></tr>'; }
    }

    // ─── TAB DISPATCH ───
    function onTabShow(tab) {
        if (tab === 'coupons') loadCouponsAdmin();
        else if (tab === 'banners') loadBannersAdmin();
        else if (tab === 'flash') loadFlashAdmin();
        else if (tab === 'loyalty') loadLoyaltyAdmin();
        else if (tab === 'audit') loadAuditAdmin();
    }

    // Hook into the dashboard showTab (admin-dashboard.html exposes window.showTab)
    function hookShowTab() {
        if (typeof window.showTab === 'function' && !window.showTab.__premiumHooked) {
            var orig = window.showTab;
            window.showTab = function (tab) {
                var r = orig.apply(this, arguments);
                try { onTabShow(tab); } catch (e) {}
                return r;
            };
            window.showTab.__premiumHooked = true;
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hookShowTab);
    else hookShowTab();

    window.PremiumAdmin = {
        onTabShow: onTabShow,
        // coupons
        loadCouponsAdmin: loadCouponsAdmin,
        addCouponFromForm: addCouponFromForm,
        toggleCoupon: toggleCoupon,
        deleteCoupon: deleteCoupon,
        // banners
        loadBannersAdmin: loadBannersAdmin,
        addBannerFromForm: addBannerFromForm,
        toggleBanner: toggleBanner,
        deleteBanner: deleteBanner,
        // flash
        loadFlashAdmin: loadFlashAdmin,
        addFlashFromForm: addFlashFromForm,
        toggleFlash: toggleFlash,
        deleteFlash: deleteFlash,
        // loyalty + wallet
        loadLoyaltyAdmin: loadLoyaltyAdmin,
        savePmSettings: savePmSettings,
        resetTiers: resetTiers,
        adjustWallet: adjustWallet,
        // audit
        loadAuditAdmin: loadAuditAdmin
    };

    console.log(LOG, 'premium suite ready (coupons, banners, flash sales, loyalty, wallet, audit)');
})();
