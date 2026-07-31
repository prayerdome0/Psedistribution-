// ============================================
// HOLIDAY-ENGINE.JS - Pilot Sales Distribution
// Festival / holiday calendar + celebration automation:
//  • Built-in calendar of holidays & sale events (fixed + movable feasts)
//  • Custom holidays stored in Firestore `holidays` (added by admin)
//  • Auto-generates branded festival greeting images on a canvas
//    (festival image + company name — no design tool needed)
//  • Auto-sends festival greeting emails to subscribers & users
//    (claimed once per festival per year via Firestore `festival_runs`
//     so the campaign fires exactly once, from whichever visitor is
//     first online — client-side build, no cron / server required)
// Exposes: window.PseHolidays
// ============================================
(function () {
    'use strict';

    var BRAND = 'Pilot Sales Distribution';
    var TAGLINE = 'Premium B2B Wholesale Marketplace';
    var SITE_URL = 'https://pilotsalesdistribution.com';
    var EMAIL_CAP = 150; // max recipients per browser-triggered send (safety)

    // ────────────────────────────────────────────
    // DATE HELPERS (movable feasts)
    // ────────────────────────────────────────────
    function easterDate(year) {
        // Anonymous Gregorian algorithm
        var a = year % 19, b = Math.floor(year / 100), c = year % 100;
        var d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
        var g = Math.floor((b - f + 1) / 3);
        var h = (19 * a + b - d - g + 15) % 30;
        var i = Math.floor(c / 4), k = c % 4;
        var l = (32 + 2 * e + 2 * i - h - k) % 7;
        var m = Math.floor((a + 11 * h + 22 * l) / 451);
        var month = Math.floor((h + l - 7 * m + 114) / 31);      // 3=Mar, 4=Apr
        var day = ((h + l - 7 * m + 114) % 31) + 1;
        return new Date(year, month - 1, day);
    }
    function nthWeekdayOfMonth(year, month, weekday, n) {
        var d = new Date(year, month, 1);
        var offset = (weekday - d.getDay() + 7) % 7;
        return new Date(year, month, 1 + offset + (n - 1) * 7);
    }
    function addDays(date, n) {
        var d = new Date(date.getTime());
        d.setDate(d.getDate() + n);
        return d;
    }

    // ────────────────────────────────────────────
    // BUILT-IN CALENDAR
    // key, name, emoji, colors [from,to], accent, message, cta,
    // resolveDate(year) -> Date ; approx = dates vary each year (admin can edit)
    // ────────────────────────────────────────────
    function fixed(month, day) { return function (y) { return new Date(y, month - 1, day); }; }

    var DEFAULT_HOLIDAYS = [
        { key: 'new-year', name: "New Year's Day", emoji: '🎆', colors: ['#0b2a3b', '#1a7b6b'], accent: '#f1c40f',
          resolveDate: fixed(1, 1),
          message: 'Happy New Year! Kick off the year with unbeatable wholesale prices, new verified suppliers and fresh catalog picks.', cta: 'Shop New Year Deals' },
        { key: 'valentines', name: "Valentine's Day", emoji: '❤️', colors: ['#8e0e2c', '#e0457b'], accent: '#ffd6e0',
          resolveDate: fixed(2, 14),
          message: 'Celebrate love with special offers for your business — gifts, fashion and beauty at wholesale prices.', cta: 'Shop Gifts' },
        { key: 'womens-day', name: "International Women's Day", emoji: '🌸', colors: ['#5b2c6f', '#a569bd'], accent: '#f5e6ff',
          resolveDate: fixed(3, 8),
          message: 'Celebrating women in business everywhere. Enjoy special offers across the marketplace all week.', cta: 'Explore Offers' },
        { key: 'eid', name: 'Eid al-Fitr', emoji: '🌙', colors: ['#0e4d38', '#1a7b6b'], accent: '#f1c40f', approx: true,
          resolveDate: fixed(3, 20),
          message: 'Eid Mubarak from our family to yours! Celebrate with festive deals across every category.', cta: 'Shop Eid Deals' },
        { key: 'st-patricks', name: "St. Patrick's Day", emoji: '☘️', colors: ['#145a32', '#27ae60'], accent: '#f7dc6f',
          resolveDate: fixed(3, 17),
          message: 'Feeling lucky? Grab shamrock-hot wholesale deals before the pot of gold runs out.', cta: 'Get Lucky Deals' },
        { key: 'easter', name: 'Easter Sunday', emoji: '🐣', colors: ['#6c3483', '#c39bd3'], accent: '#fdf2e9',
          resolveDate: function (y) { return easterDate(y); },
          message: 'Happy Easter! Fresh spring collections and egg-citing wholesale prices are here.', cta: 'Shop Spring' },
        { key: 'earth-day', name: 'Earth Day', emoji: '🌍', colors: ['#1b4f72', '#52be80'], accent: '#d5f5e3',
          resolveDate: fixed(4, 22),
          message: 'Shop sustainable: eco-friendly and organic suppliers are featured all week for Earth Day.', cta: 'Shop Eco' },
        { key: 'mothers-day', name: "Mother's Day", emoji: '💐', colors: ['#922b21', '#ec7063'], accent: '#fbeee6',
          resolveDate: function (y) { return nthWeekdayOfMonth(y, 4, 0, 2); },
          message: 'For every amazing mum — gift-ready wholesale picks in beauty, fashion and home.', cta: 'Shop Gifts for Mum' },
        { key: 'fathers-day', name: "Father's Day", emoji: '👔', colors: ['#1a5276', '#5499c7'], accent: '#eaf2f8',
          resolveDate: function (y) { return nthWeekdayOfMonth(y, 5, 0, 3); },
          message: "Celebrate dad with wholesale deals on tools, tech and fashion he'll actually use.", cta: 'Shop Gifts for Dad' },
        { key: 'independence-day', name: 'Independence Day', emoji: '🇺🇸', colors: ['#1b2631', '#c0392b'], accent: '#5dade2',
          resolveDate: fixed(7, 4),
          message: 'Star-spangled savings! Celebrate the 4th of July with fireworks-level wholesale prices.', cta: 'Shop July 4th' },
        { key: 'summer-sale', name: 'Summer Wholesale Fest', emoji: '☀️', colors: ['#9a7d0a', '#f39c12'], accent: '#fff9c4',
          resolveDate: fixed(7, 15),
          message: 'Our mid-summer wholesale festival is ON — extra discounts on bulk orders all week.', cta: 'Shop Summer Fest' },
        { key: 'labour-day', name: 'Labour Day', emoji: '⚒️', colors: ['#283747', '#808b96'], accent: '#f8c471',
          resolveDate: function (y) { return nthWeekdayOfMonth(y, 8, 1, 1); },
          message: 'Hard work deserves great prices. Labour Day deals across tools, office and industrial.', cta: 'Shop Labour Day' },
        { key: 'halloween', name: 'Halloween', emoji: '🎃', colors: ['#1c0e2e', '#e67e22'], accent: '#f5b041',
          resolveDate: fixed(10, 31),
          message: 'Spooktacular deals that are scary good — costumes, décor and party supplies at wholesale prices.', cta: 'Shop Halloween' },
        { key: 'diwali', name: 'Diwali — Festival of Lights', emoji: '🪔', colors: ['#4a235a', '#f39c12'], accent: '#fdedec', approx: true,
          resolveDate: fixed(11, 8),
          message: 'Happy Diwali! May your life be filled with light — and your store with great festive deals.', cta: 'Shop Diwali Deals' },
        { key: 'thanksgiving', name: 'Thanksgiving', emoji: '🦃', colors: ['#6e2c00', '#ca6f1e'], accent: '#fdebd0',
          resolveDate: function (y) { return nthWeekdayOfMonth(y, 10, 4, 4); },
          message: 'We are thankful for you, our customers. Enjoy warm Thanksgiving savings store-wide.', cta: 'Shop Thanksgiving' },
        { key: 'black-friday', name: 'Black Friday', emoji: '🛍️', colors: ['#000000', '#2c3e50'], accent: '#f1c40f',
          resolveDate: function (y) { return addDays(nthWeekdayOfMonth(y, 10, 4, 4), 1); },
          message: "The year's biggest sale is live! Door-buster wholesale prices for 48 hours only.", cta: 'Shop Black Friday' },
        { key: 'cyber-monday', name: 'Cyber Monday', emoji: '💻', colors: ['#154360', '#2e86c1'], accent: '#abebc6',
          resolveDate: function (y) { return addDays(nthWeekdayOfMonth(y, 10, 4, 4), 4); },
          message: 'Tech deals all day — laptops, phones and electronics at unmissable wholesale prices.', cta: 'Shop Tech Deals' },
        { key: 'christmas', name: 'Christmas Day', emoji: '🎄', colors: ['#0b5345', '#1e8449'], accent: '#f4d03f',
          resolveDate: fixed(12, 25),
          message: 'Merry Christmas! Warm wishes and festive last-minute wholesale deals from our team to yours.', cta: 'Shop Christmas' },
        { key: 'boxing-day', name: 'Boxing Day Clearance', emoji: '🎁', colors: ['#7b241c', '#cd6155'], accent: '#fdfefe',
          resolveDate: fixed(12, 26),
          message: 'Year-end clearance starts now — massive markdowns while stock lasts.', cta: 'Shop Clearance' }
    ];

    // Custom holidays from Firestore (admin-added), cached in memory
    var customHolidays = [];
    var configCache = null;

    function getDb() {
        try {
            if (window.db && typeof window.db.collection === 'function') return window.db;
            if (window.firebase && typeof window.firebase.firestore === 'function' && firebase.apps && firebase.apps.length) {
                return firebase.firestore();
            }
        } catch (e) {}
        return null;
    }

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    // ────────────────────────────────────────────
    // CALENDAR API
    // ────────────────────────────────────────────
    function normalize(h, year) {
        var date = h.resolveDate(year);
        return {
            key: h.key,
            name: h.name,
            emoji: h.emoji || '🎉',
            colors: h.colors || ['#0b2a3b', '#1a7b6b'],
            accent: h.accent || '#f1c40f',
            message: h.message || ('Happy ' + h.name + ' from ' + BRAND + '!'),
            cta: h.cta || 'Shop Now',
            url: h.url || (SITE_URL + '/products'),
            approx: !!h.approx,
            custom: !!h.custom,
            date: date,
            dateStr: date.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' })
        };
    }

    /** All holidays (built-in + custom enabled) for a year, sorted by date. */
    function all(year) {
        year = year || new Date().getFullYear();
        var list = DEFAULT_HOLIDAYS.concat(customHolidays.filter(function (h) { return h.enabled !== false; }));
        return list.map(function (h) { return normalize(h, year); })
                   .sort(function (a, b) { return a.date - b.date; });
    }

    /** Holiday happening today (local time), or null. */
    function todayHoliday() {
        var now = new Date();
        var hit = null;
        all(now.getFullYear()).forEach(function (h) {
            if (h.date.getFullYear() === now.getFullYear() &&
                h.date.getMonth() === now.getMonth() &&
                h.date.getDate() === now.getDate()) hit = h;
        });
        return hit;
    }

    /** Next `limit` upcoming holidays (rolls into next year). */
    function upcoming(limit) {
        limit = limit || 5;
        var now = new Date();
        var y = now.getFullYear();
        var list = all(y).concat(all(y + 1));
        return list.filter(function (h) {
            var end = new Date(h.date.getTime());
            end.setHours(23, 59, 59, 999);
            return end >= now;
        }).sort(function (a, b) { return a.date - b.date; }).slice(0, limit);
    }

    /** Load custom holidays added by admin (Firestore `holidays`). */
    async function loadCustom() {
        try {
            var db = getDb();
            if (!db) return;
            var snap = await db.collection('holidays').get();
            customHolidays = [];
            snap.forEach(function (doc) {
                var d = doc.data();
                var month = parseInt(d.month, 10), day = parseInt(d.day, 10);
                if (!d.name || !month || !day) return;
                customHolidays.push({
                    key: 'custom-' + doc.id,
                    name: d.name,
                    emoji: d.emoji || '🎉',
                    colors: d.colors || ['#0b2a3b', '#1a7b6b'],
                    accent: d.accent || '#f1c40f',
                    message: d.message || '',
                    cta: d.cta || 'Shop Now',
                    url: d.url || '',
                    approx: true,
                    custom: true,
                    enabled: d.enabled !== false,
                    resolveDate: (function (mm, dd) { return function (y) { return new Date(y, mm - 1, dd); }; })(month, day)
                });
            });
        } catch (e) { console.warn('Custom holidays load skipped:', e); }
    }

    // ────────────────────────────────────────────
    // BRANDED FESTIVAL IMAGE GENERATOR (canvas)
    // Auto-generates a festival greeting image with the
    // company name — used in popups, emails & downloads.
    // ────────────────────────────────────────────
    function pseudoRandom(seed) {
        var x = 0;
        for (var i = 0; i < seed.length; i++) x = (x * 31 + seed.charCodeAt(i)) >>> 0;
        return function () {
            x = (x * 1103515245 + 12345) >>> 0;
            return (x % 100000) / 100000;
        };
    }

    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    function wrapText(ctx, text, maxWidth) {
        var words = String(text).split(/\s+/), lines = [], line = '';
        words.forEach(function (w) {
            var test = line ? line + ' ' + w : w;
            if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
            else line = test;
        });
        if (line) lines.push(line);
        return lines;
    }

    /**
     * Generate a branded festival card image.
     * @param holiday normalized holiday object
     * @param opts {width, height}
     * @returns {Promise<{dataUrl:string, canvas:HTMLCanvasElement}>}
     */
    function generateCard(holiday, opts) {
        opts = opts || {};
        var W = opts.width || 1200, H = opts.height || 630;
        var canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        var ctx = canvas.getContext('2d');
        var c1 = holiday.colors[0], c2 = holiday.colors[1], accent = holiday.accent;
        var rnd = pseudoRandom(holiday.key + holiday.name);

        // Background gradient
        var grad = ctx.createLinearGradient(0, 0, W, H);
        grad.addColorStop(0, c1);
        grad.addColorStop(1, c2);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // Soft light circles
        for (var i = 0; i < 14; i++) {
            ctx.beginPath();
            ctx.arc(rnd() * W, rnd() * H, 30 + rnd() * 120, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,' + (0.03 + rnd() * 0.06).toFixed(3) + ')';
            ctx.fill();
        }

        // Confetti
        var confColors = [accent, '#ffffff', '#ffd166', '#ef476f', '#06d6a0'];
        for (var j = 0; j < 90; j++) {
            ctx.save();
            ctx.translate(rnd() * W, rnd() * H);
            ctx.rotate(rnd() * Math.PI);
            ctx.fillStyle = confColors[Math.floor(rnd() * confColors.length)];
            ctx.globalAlpha = 0.35 + rnd() * 0.45;
            if (rnd() > 0.5) ctx.fillRect(-4, -2, 8 + rnd() * 6, 4 + rnd() * 3);
            else { ctx.beginPath(); ctx.arc(0, 0, 2.5 + rnd() * 3, 0, Math.PI * 2); ctx.fill(); }
            ctx.restore();
        }
        ctx.globalAlpha = 1;

        // Side frame
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 3;
        roundRect(ctx, 26, 26, W - 52, H - 52, 22);
        ctx.stroke();

        var emojiFont = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
        var uiFont = 'Inter,"Segoe UI",Arial,sans-serif';

        // Emoji decorations
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '64px ' + emojiFont;
        [[110, 90], [W - 110, 90], [110, H - 90], [W - 110, H - 90]].forEach(function (p) {
            ctx.fillText(holiday.emoji, p[0], p[1]);
        });

        // Main emoji
        ctx.font = '120px ' + emojiFont;
        ctx.fillText(holiday.emoji, W / 2, 135);

        // Holiday name
        ctx.fillStyle = '#ffffff';
        ctx.font = '800 58px ' + uiFont;
        var nameLines = wrapText(ctx, holiday.name, W - 200);
        nameLines.slice(0, 2).forEach(function (ln, idx) {
            ctx.fillText(ln, W / 2, 245 + idx * 62);
        });

        // Message
        ctx.font = '400 27px ' + uiFont;
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        var msgLines = wrapText(ctx, holiday.message || ('Warm wishes from ' + BRAND + '!'), W - 260);
        var msgStartY = 255 + nameLines.slice(0, 2).length * 62;
        msgLines.slice(0, 3).forEach(function (ln, idx) {
            ctx.fillText(ln, W / 2, msgStartY + idx * 36);
        });

        // Brand ribbon — the auto-generated company name
        var ribbonH = 74, ribbonY = H - 52 - ribbonH;
        ctx.fillStyle = 'rgba(0,0,0,0.34)';
        roundRect(ctx, 60, ribbonY, W - 120, ribbonH, 14);
        ctx.fill();
        ctx.fillStyle = accent;
        ctx.font = '800 33px ' + uiFont;
        ctx.fillText(BRAND, W / 2, ribbonY + 27);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = '400 21px ' + uiFont;
        ctx.fillText(TAGLINE + '  •  ' + SITE_URL.replace('https://', ''), W / 2, ribbonY + 55);

        var dataUrl = canvas.toDataURL('image/png');
        return Promise.resolve({ dataUrl: dataUrl, canvas: canvas });
    }

    // ────────────────────────────────────────────
    // CONFIG (auto email on/off) — Firestore config/holidays
    // ────────────────────────────────────────────
    async function getConfig() {
        if (configCache) return configCache;
        configCache = { auto_email: true };
        try {
            var db = getDb();
            if (!db) return configCache;
            var doc = await db.collection('config').doc('holidays').get();
            if (doc.exists) configCache = Object.assign(configCache, doc.data());
        } catch (e) {}
        return configCache;
    }
    async function setConfig(cfg) {
        configCache = Object.assign({ auto_email: true }, cfg);
        try {
            var db = getDb();
            if (db) await db.collection('config').doc('holidays').set(configCache, { merge: true });
        } catch (e) { console.warn('Holiday config save skipped:', e); }
        return configCache;
    }

    // ────────────────────────────────────────────
    // RECIPIENTS
    // ────────────────────────────────────────────
    async function collectRecipients(cap) {
        cap = cap || EMAIL_CAP;
        var db = getDb();
        var seen = {}, out = [];
        function add(email, name, kind) {
            email = (email || '').trim().toLowerCase();
            if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || seen[email]) return;
            seen[email] = true;
            out.push({ email: email, name: name || 'there', kind: kind });
        }
        if (db) {
            try {
                var subs = await db.collection('subscribers').get();
                subs.forEach(function (doc) {
                    var d = doc.data();
                    if (d.status !== 'unsubscribed') add(d.email, d.name, 'subscriber');
                });
            } catch (e) {}
            try {
                var users = await db.collection('users').get();
                users.forEach(function (doc) {
                    var d = doc.data();
                    if (d.status !== 'suspended') add(d.email, d.full_name || d.company, 'user');
                });
            } catch (e) {}
        }
        return out.slice(0, cap);
    }

    // ────────────────────────────────────────────
    // SENDING — festival greeting emails
    // ────────────────────────────────────────────
    async function sendFestivalEmails(holiday, opts) {
        opts = opts || {};
        var result = { attempted: 0, sent: 0, failed: 0, holiday: holiday.key };
        if (typeof window.sendFestivalGreeting !== 'function') {
            console.warn('sendFestivalGreeting unavailable (email.js not loaded/festival template missing)');
            return result;
        }
        var card = { dataUrl: '' };
        try { card = await generateCard(holiday); } catch (e) {}

        var recipients = await collectRecipients(opts.cap);
        result.attempted = recipients.length;
        var db = getDb();
        for (var i = 0; i < recipients.length; i++) {
            var r = recipients[i];
            try {
                var res = await window.sendFestivalGreeting(r.email, r.name, holiday, card.dataUrl);
                if (res && res.success) result.sent++; else result.failed++;
            } catch (e) { result.failed++; }
            try {
                if (db) {
                    await db.collection('email_log').add({
                        to: r.email,
                        name: r.name,
                        recipient_kind: r.kind,
                        subject: holiday.emoji + ' ' + holiday.name + ' — Greetings from ' + BRAND,
                        type: 'festival',
                        holiday_key: holiday.key,
                        auto: !!opts.auto,
                        status: result.failed && !(result.sent) ? 'failed' : 'sent',
                        created_at: new Date().toISOString()
                    });
                }
            } catch (e) {}
        }
        return result;
    }

    /**
     * Auto-send check — safe to call on every page load.
     * Fires at most once per festival per year across ALL visitors
     * (claim stored in Firestore `festival_runs`).
     */
    async function autoSendCheck() {
        try {
            if (typeof window.sendFestivalGreeting !== 'function') return;
            var today = todayHoliday();
            if (!today) return;
            var year = new Date().getFullYear();
            var runId = today.key + '_' + year;
            var lsKey = 'pse_festival_' + runId;
            if (localStorage.getItem(lsKey)) return;

            var cfg = await getConfig();
            if (cfg && cfg.auto_email === false) { try { localStorage.setItem(lsKey, 'off'); } catch (e) {} return; }

            var db = getDb();
            if (!db) return;
            var ref = db.collection('festival_runs').doc(runId);
            var doc = await ref.get().catch(function () { return null; });
            if (doc && doc.exists) { try { localStorage.setItem(lsKey, 'done'); } catch (e) {} return; }

            await ref.set({ holiday: today.key, year: year, started_at: new Date().toISOString(), auto: true });
            try { localStorage.setItem(lsKey, 'done'); } catch (e) {}
            console.log('🎉 Festival auto-send triggered:', today.name);
            var res = await sendFestivalEmails(today, { auto: true });
            await ref.update({
                attempted: res.attempted, sent: res.sent, failed: res.failed,
                finished_at: new Date().toISOString()
            }).catch(function () {});
            console.log('🎉 Festival emails done:', res);
        } catch (e) { console.warn('Festival auto-send skipped:', e); }
    }

    // ────────────────────────────────────────────
    // ADMIN — custom holiday CRUD
    // ────────────────────────────────────────────
    async function addCustomHoliday(data) {
        var db = getDb();
        if (!db) throw new Error('Database unavailable');
        var record = {
            name: (data.name || '').trim(),
            month: parseInt(data.month, 10),
            day: parseInt(data.day, 10),
            emoji: (data.emoji || '🎉').trim(),
            message: (data.message || '').trim() || ('Happy ' + (data.name || 'Festival') + ' from ' + BRAND + '!'),
            cta: (data.cta || 'Shop Now').trim(),
            url: (data.url || (SITE_URL + '/products')).trim(),
            colors: data.colors || ['#0b2a3b', '#1a7b6b'],
            accent: data.accent || '#f1c40f',
            enabled: data.enabled !== false,
            created_at: new Date().toISOString()
        };
        if (!record.name || !record.month || !record.day || record.month < 1 || record.month > 12 || record.day < 1 || record.day > 31) {
            throw new Error('Invalid holiday data');
        }
        var ref = await db.collection('holidays').add(record);
        await loadCustom();
        return ref.id;
    }

    async function deleteCustomHoliday(customKey) {
        var db = getDb();
        if (!db) throw new Error('Database unavailable');
        var id = String(customKey).replace(/^custom-/, '');
        await db.collection('holidays').doc(id).delete();
        await loadCustom();
    }

    async function listCustomRaw() {
        var db = getDb();
        if (!db) return [];
        try {
            var snap = await db.collection('holidays').get();
            var out = [];
            snap.forEach(function (doc) { out.push(Object.assign({ id: doc.id }, doc.data())); });
            return out;
        } catch (e) { return []; }
    }

    // ────────────────────────────────────────────
    // BOOT — load custom holidays + auto-send on any page
    // ────────────────────────────────────────────
    function boot() {
        loadCustom().then(function () {
            setTimeout(autoSendCheck, 4000);
        });
        setTimeout(function () {
            // second attempt in case email.js loaded late
            if (typeof window.sendFestivalGreeting === 'function') autoSendCheck();
        }, 12000);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();

    // ────────────────────────────────────────────
    // PUBLIC API
    // ────────────────────────────────────────────
    window.PseHolidays = {
        BRAND: BRAND,
        all: all,
        todayHoliday: todayHoliday,
        upcoming: upcoming,
        loadCustom: loadCustom,
        generateCard: generateCard,
        sendFestivalEmails: sendFestivalEmails,
        autoSendCheck: autoSendCheck,
        getConfig: getConfig,
        setConfig: setConfig,
        addCustomHoliday: addCustomHoliday,
        deleteCustomHoliday: deleteCustomHoliday,
        listCustomRaw: listCustomRaw,
        esc: esc
    };
    console.log('🗓️ Holiday engine ready —', DEFAULT_HOLIDAYS.length, 'built-in festivals loaded');
})();
