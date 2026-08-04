// ============================================
// ADMIN-EXTENSIONS.JS - Pilot Sales Distribution
// Extra admin-console modules (loaded by admin-dashboard.html):
//   📬 Subscribers   — see & manage newsletter subscribers
//   🎧 Live Support  — every live-support ticket, auto-reply status, resolve/reply
//   ✉️ Email Center  — compose & send email campaigns to any audience
//   ⭐ Real Reviews  — moderate every review written by customers
//   🛡️ Trust & Safety — scam reports + seller verification queue
//   🗓️ Festival Calendar — holidays, branded card generator, auto emails
// Also exposes: window.AdminExt.onTabShow(tab)
// ============================================
(function () {
    'use strict';

    var EMAIL_CAP = 150;

    // ─── SHARED HELPERS ───
    function getDb() {
        if (window.db && typeof window.db.collection === 'function') return window.db;
        return null;
    }
    function toast(msg, type) {
        if (typeof window.showToast === 'function') window.showToast(msg, type || 'info');
        else alert(msg);
    }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function fmtDate(s) {
        if (!s) return '—';
        var d = new Date(s);
        return isNaN(d) ? '—' : d.toLocaleString();
    }
    function el(id) { return document.getElementById(id); }

    // Ensure Firestore is ready (admin page initializes it; extensions may load first)
    function ready(fn, tries) {
        tries = tries || 0;
        if (getDb()) return fn();
        if (tries > 40) return console.warn('AdminExt: Firestore unavailable');
        setTimeout(function () { ready(fn, tries + 1); }, 400);
    }

    // ════════════════════════════════════════════
    // 1. SUBSCRIBERS
    // ════════════════════════════════════════════
    var cachedSubscribers = [];

    async function loadSubscribers() {
        var tbody = el('subscriberTableBody');
        if (!tbody) return;
        try {
            var db = getDb();
            var snap = await db.collection('subscribers').get();
            cachedSubscribers = [];
            snap.forEach(function (doc) { cachedSubscribers.push(Object.assign({ id: doc.id }, doc.data())); });
            cachedSubscribers.sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); });

            if (el('subscriberBadge')) el('subscriberBadge').textContent = cachedSubscribers.length;
            if (el('subscriberCount')) el('subscriberCount').textContent = cachedSubscribers.length + ' subscribers';
            if (el('statSubscribers')) el('statSubscribers').textContent = cachedSubscribers.length;

            if (cachedSubscribers.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><i class="fa-regular fa-envelope-open"></i><p>No subscribers yet — share your newsletter!</p></div></td></tr>';
                return;
            }
            tbody.innerHTML = cachedSubscribers.map(function (s) {
                return '<tr>' +
                    '<td><strong>' + esc(s.email) + '</strong></td>' +
                    '<td>' + esc(s.name || '—') + '</td>' +
                    '<td><span class="status-badge">' + esc(s.source || 'website') + '</span></td>' +
                    '<td><span class="status-badge ' + (s.status === 'active' ? 'active' : 'suspended') + '">' + esc(s.status || 'active') + '</span></td>' +
                    '<td>' + fmtDate(s.created_at) + '</td>' +
                    '<td>' +
                        '<button class="btn-action reply" title="Email this subscriber" onclick="AdminExt.emailOne(\'' + esc(s.email).replace(/'/g, "\\'") + '\')"><i class="fa-regular fa-paper-plane"></i></button>' +
                        '<button class="btn-action delete" title="Remove" onclick="AdminExt.deleteSubscriber(\'' + s.id + '\')"><i class="fa-regular fa-trash-can"></i></button>' +
                    '</td>' +
                '</tr>';
            }).join('');
        } catch (e) {
            console.error('loadSubscribers error:', e);
            tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><i class="fa-solid fa-circle-exclamation" style="color:#c0392b;"></i><p>Error loading subscribers</p></div></td></tr>';
        }
    }

    async function deleteSubscriber(id) {
        if (!confirm('Remove this subscriber?')) return;
        try {
            await getDb().collection('subscribers').doc(id).delete();
            toast('Subscriber removed', 'info');
            loadSubscribers();
        } catch (e) { toast('Failed to remove subscriber', 'error'); }
    }

    function exportSubscribersCsv() {
        if (!cachedSubscribers.length) { toast('No subscribers to export', 'error'); return; }
        var rows = [['Email', 'Name', 'Source', 'Status', 'Subscribed At']];
        cachedSubscribers.forEach(function (s) {
            rows.push([s.email || '', s.name || '', s.source || '', s.status || 'active', s.created_at || '']);
        });
        var csv = rows.map(function (r) {
            return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(',');
        }).join('\n');
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'pse-subscribers-' + new Date().toISOString().slice(0, 10) + '.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast('✅ Subscriber list exported', 'success');
    }

    // ════════════════════════════════════════════
    // 2. LIVE SUPPORT TICKETS
    // ════════════════════════════════════════════
    var cachedTickets = [];

    async function loadSupport() {
        var container = el('supportList');
        if (!container) return;
        try {
            var db = getDb();
            var snap = await db.collection('support_messages').get();
            cachedTickets = [];
            snap.forEach(function (doc) { cachedTickets.push(Object.assign({ id: doc.id }, doc.data())); });
            cachedTickets.sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); });

            var open = cachedTickets.filter(function (t) { return t.status !== 'resolved'; });
            if (el('supportBadge')) el('supportBadge').textContent = open.length;
            if (el('supportCount')) el('supportCount').textContent = open.length + ' open of ' + cachedTickets.length;

            if (cachedTickets.length === 0) {
                container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-headset"></i><p>No live-support tickets yet</p></div>';
                return;
            }
            container.innerHTML = cachedTickets.map(function (t) {
                var resolved = t.status === 'resolved';
                return '<div class="message-preview" style="border-left:3px solid ' + (resolved ? 'var(--border)' : '#e67e22') + ';">' +
                    '<div class="msg-header">' +
                        '<span class="sender">🎧 ' + esc(t.name || 'Customer') + '</span>' +
                        '<span class="date">' + fmtDate(t.created_at) + '</span>' +
                    '</div>' +
                    '<div class="msg-body">' +
                        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;">' +
                            '<strong>' + esc(t.email || '') + '</strong>' +
                            '<span>' +
                                (t.auto_replied
                                    ? '<span class="status-badge active" title="An automatic confirmation was emailed to the customer instantly">🤖 Auto-replied</span> '
                                    : '<span class="status-badge pending">No auto-reply</span> ') +
                                '<span class="status-badge ' + (resolved ? 'read' : 'unread') + '">' + (resolved ? 'Resolved' : 'Open') + '</span>' +
                            '</span>' +
                        '</div>' +
                        '<div class="msg-preview-text">' + esc(t.message || '') + '</div>' +
                    '</div>' +
                    '<div style="display:flex;gap:0.3rem;margin-top:0.5rem;flex-wrap:wrap;">' +
                        '<button class="btn-action reply" onclick="AdminExt.replyToSupport(\'' + t.id + '\')"><i class="fa-solid fa-reply"></i> Reply</button>' +
                        (resolved
                            ? '<button class="btn-action view" onclick="AdminExt.reopenSupport(\'' + t.id + '\')"><i class="fa-regular fa-folder-open"></i> Re-open</button>'
                            : '<button class="btn-action approve" onclick="AdminExt.resolveSupport(\'' + t.id + '\')"><i class="fa-regular fa-circle-check"></i> Resolve</button>') +
                        '<button class="btn-action delete" onclick="AdminExt.deleteSupport(\'' + t.id + '\')"><i class="fa-regular fa-trash-can"></i></button>' +
                    '</div>' +
                '</div>';
            }).join('');
        } catch (e) {
            console.error('loadSupport error:', e);
            container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-circle-exclamation" style="color:#c0392b;"></i><p>Error loading tickets</p></div>';
        }
    }

    function replyToSupport(ticketId) {
        var t = cachedTickets.find(function (x) { return x.id === ticketId; });
        if (!t) return;
        showTabSafe('emailcenter');
        setTimeout(function () {
            if (el('emailAudience')) { el('emailAudience').value = 'single'; onAudienceChange(); }
            if (el('emailTo')) el('emailTo').value = t.email || '';
            if (el('emailToName')) el('emailToName').value = t.name || '';
            if (el('emailSubject')) el('emailSubject').value = 'Re: Your support request — Pilot Sales Distribution';
            if (el('emailMessage')) {
                el('emailMessage').value = 'Hi ' + (t.name || 'there') + ',\n\nThanks for reaching out to our support team.\n\n\n\n---\nYour message was:\n' + (t.message || '');
            }
            toast('✉️ Reply drafted in Email Center — review and hit Send', 'info');
        }, 150);
    }

    async function setTicketStatus(ticketId, status) {
        try {
            await getDb().collection('support_messages').doc(ticketId).update({
                status: status, updated_at: new Date().toISOString()
            });
            loadSupport();
        } catch (e) { toast('Failed', 'error'); }
    }
    async function deleteSupport(ticketId) {
        if (!confirm('Delete this ticket?')) return;
        try {
            await getDb().collection('support_messages').doc(ticketId).delete();
            toast('Ticket deleted', 'info');
            loadSupport();
        } catch (e) { toast('Failed', 'error'); }
    }

    // ════════════════════════════════════════════
    // 3. EMAIL CENTER
    // ════════════════════════════════════════════
    function onAudienceChange() {
        var aud = el('emailAudience') ? el('emailAudience').value : 'single';
        var wrap = el('emailToWrap');
        if (wrap) wrap.style.display = aud === 'single' ? 'block' : 'none';
        var hint = el('emailAudienceHint');
        if (hint) {
            var map = {
                single: 'The email goes only to the address you enter above.',
                subscribers: 'Sent to every newsletter subscriber.',
                buyers: 'Sent to all registered buyers.',
                sellers: 'Sent to all registered sellers.',
                everyone: 'Sent to subscribers AND registered users (de-duplicated).'
            };
            hint.textContent = map[aud] || '';
        }
    }
    function emailOne(addr) {
        showTabSafe('emailcenter');
        setTimeout(function () {
            if (el('emailAudience')) { el('emailAudience').value = 'single'; onAudienceChange(); }
            if (el('emailTo')) el('emailTo').value = addr;
        }, 150);
    }

    async function collectAudience() {
        var db = getDb();
        var aud = el('emailAudience') ? el('emailAudience').value : 'single';
        var seen = {}, out = [];
        function add(email, name) {
            email = (email || '').trim().toLowerCase();
            if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || seen[email]) return;
            seen[email] = true;
            out.push({ email: email, name: name || 'there' });
        }
        if (aud === 'single') {
            add(el('emailTo').value, el('emailToName').value);
        } else {
            if (aud === 'subscribers' || aud === 'everyone') {
                try {
                    var subs = await db.collection('subscribers').get();
                    subs.forEach(function (doc) {
                        var d = doc.data();
                        if (d.status !== 'unsubscribed') add(d.email, d.name);
                    });
                } catch (e) {}
            }
            if (aud !== 'subscribers') {
                try {
                    var users = await db.collection('users').get();
                    users.forEach(function (doc) {
                        var d = doc.data();
                        if (d.status === 'suspended') return;
                        if (aud === 'everyone' || (aud === 'sellers' && d.role === 'seller') || (aud === 'buyers' && d.role !== 'seller')) {
                            add(d.email, d.full_name || d.company);
                        }
                    });
                } catch (e) {}
            }
        }
        return out.slice(0, EMAIL_CAP);
    }

    async function sendEmailCenter() {
        var subject = (el('emailSubject').value || '').trim();
        var message = (el('emailMessage').value || '').trim();
        var cta = (el('emailCta').value || '').trim();
        var btnUrl = (el('emailBtnUrl').value || '').trim();
        if (!subject || !message) { toast('Subject and message are required', 'error'); return; }

        var msgHtml = esc(message).replace(/\n/g, '<br>');
        var btn = el('emailSendBtn');
        var progress = el('emailSendProgress');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending…';
        if (progress) progress.textContent = 'Collecting recipients…';

        try {
            var recipients = await collectAudience();
            if (!recipients.length) { toast('No recipients found for this audience', 'error'); }
            var sent = 0, failed = 0;
            var db = getDb();
            for (var i = 0; i < recipients.length; i++) {
                var r = recipients[i];
                if (progress) progress.textContent = 'Sending ' + (i + 1) + ' / ' + recipients.length + ' — ' + r.email;
                var ok = false;
                try {
                    var res = await window.sendAdminEmail(r.email, r.name, subject, msgHtml, cta, btnUrl);
                    ok = !!(res && res.success);
                } catch (e) { ok = false; }
                if (ok) sent++; else failed++;
                try {
                    if (db) {
                        await db.collection('email_log').add({
                            to: r.email, name: r.name, subject: subject,
                            type: 'admin-campaign', status: ok ? 'sent' : 'failed',
                            created_at: new Date().toISOString()
                        });
                    }
                } catch (e) {}
            }
            if (recipients.length) toast('📧 Campaign complete: ' + sent + ' sent, ' + failed + ' failed', sent ? 'success' : 'error');
        } catch (e) {
            console.error(e);
            toast('Campaign failed', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-regular fa-paper-plane"></i> Send Campaign';
            if (progress) progress.textContent = '';
            loadEmailLog();
        }
    }

    async function loadEmailLog() {
        var tbody = el('emailLogBody');
        if (!tbody) return;
        try {
            var snap = await getDb().collection('email_log').get();
            var logs = [];
            snap.forEach(function (doc) { logs.push(Object.assign({ id: doc.id }, doc.data())); });
            logs.sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); });
            if (el('emailLogCount')) el('emailLogCount').textContent = logs.length + ' emails logged';
            if (logs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><i class="fa-solid fa-inbox"></i><p>No emails sent yet</p></div></td></tr>';
                return;
            }
            tbody.innerHTML = logs.slice(0, 50).map(function (l) {
                return '<tr>' +
                    '<td><strong>' + esc(l.to) + '</strong></td>' +
                    '<td>' + esc(l.subject || '—') + '</td>' +
                    '<td><span class="status-badge">' + esc(l.type || 'manual') + '</span></td>' +
                    '<td><span class="status-badge ' + (l.status === 'sent' ? 'active' : 'suspended') + '">' + esc(l.status || 'sent') + '</span></td>' +
                    '<td>' + fmtDate(l.created_at) + '</td>' +
                '</tr>';
            }).join('');
        } catch (e) {
            tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><i class="fa-solid fa-circle-exclamation" style="color:#c0392b;"></i><p>Error loading log</p></div></td></tr>';
        }
    }

    // ════════════════════════════════════════════
    // 4. REAL CUSTOMER REVIEWS (moderation)
    // ════════════════════════════════════════════
    async function loadReviewsAdmin() {
        var tbody = el('reviewsTableBody');
        if (!tbody) return;
        try {
            var db = getDb();
            var snap = await db.collection('reviews').get();
            var reviews = [];
            snap.forEach(function (doc) { reviews.push(Object.assign({ id: doc.id }, doc.data())); });
            reviews.sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); });

            if (el('reviewBadge')) el('reviewBadge').textContent = reviews.length;
            if (el('reviewCount')) el('reviewCount').textContent = reviews.length + ' reviews';

            if (reviews.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><i class="fa-regular fa-star"></i><p>No customer-written reviews yet</p></div></td></tr>';
                return;
            }
            tbody.innerHTML = reviews.map(function (r) {
                var stars = '★'.repeat(r.rating || 5) + '☆'.repeat(5 - (r.rating || 5));
                return '<tr>' +
                    '<td><span style="color:#f1c40f;">' + stars + '</span><br><strong>' + (r.rating || 5) + '/5</strong></td>' +
                    '<td style="max-width:280px;">' + esc(r.text || '') + '</td>' +
                    '<td>' + esc(r.user_name || 'Buyer') + '</td>' +
                    '<td><span class="status-badge">' + esc(r.product_title || r.product_id || '—') + '</span></td>' +
                    '<td>' + fmtDate(r.created_at) + '</td>' +
                    '<td><button class="btn-action delete" title="Delete review" onclick="AdminExt.deleteReview(\'' + r.id + '\')"><i class="fa-regular fa-trash-can"></i></button></td>' +
                '</tr>';
            }).join('');
        } catch (e) {
            console.error('loadReviewsAdmin error:', e);
            tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><i class="fa-solid fa-circle-exclamation" style="color:#c0392b;"></i><p>Error loading reviews</p></div></td></tr>';
        }
    }
    async function deleteReview(id) {
        if (!confirm('Delete this customer review? This cannot be undone.')) return;
        try {
            await getDb().collection('reviews').doc(id).delete();
            toast('Review deleted', 'info');
            loadReviewsAdmin();
        } catch (e) { toast('Failed', 'error'); }
    }

    // ════════════════════════════════════════════
    // 5. TRUST & SAFETY (scam reports + verification)
    // ════════════════════════════════════════════
    async function loadReports() {
        var container = el('reportList');
        if (!container) return;
        try {
            var snap = await getDb().collection('reports').get();
            var reports = [];
            snap.forEach(function (doc) { reports.push(Object.assign({ id: doc.id }, doc.data())); });
            reports.sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); });

            var open = reports.filter(function (r) { return r.status !== 'resolved'; });
            if (el('reportBadge')) el('reportBadge').textContent = open.length;
            if (el('reportCount')) el('reportCount').textContent = open.length + ' open reports';
            if (el('statReports')) el('statReports').textContent = open.length;

            if (reports.length === 0) {
                container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-shield-halved"></i><p>No scam reports — marketplace is healthy 🎉</p></div>';
                return;
            }
            container.innerHTML = reports.map(function (r) {
                var resolved = r.status === 'resolved';
                return '<div class="message-preview" style="border-left:3px solid ' + (resolved ? 'var(--border)' : '#c0392b') + ';">' +
                    '<div class="msg-header">' +
                        '<span class="sender">🚩 ' + esc(r.reason || 'Report') + '</span>' +
                        '<span class="date">' + fmtDate(r.created_at) + '</span>' +
                    '</div>' +
                    '<div class="msg-body">' +
                        '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:0.3rem;">' +
                            '<strong>' + esc(r.product_title || 'Product') + '</strong>' +
                            '<span class="status-badge ' + (resolved ? 'read' : 'suspended') + '">' + (resolved ? 'Resolved' : 'Open') + '</span>' +
                        '</div>' +
                        '<div class="msg-preview-text">Seller: ' + esc(r.seller_name || r.seller_id || 'N/A') + '</div>' +
                        '<div class="msg-preview-text">' + esc(r.details || '') + '</div>' +
                        '<div class="msg-preview-text" style="font-size:0.7rem;">Reporter: ' + esc(r.reporter_email || 'anonymous') + '</div>' +
                    '</div>' +
                    '<div style="display:flex;gap:0.3rem;margin-top:0.5rem;flex-wrap:wrap;">' +
                        (!resolved ? '<button class="btn-action approve" onclick="AdminExt.resolveReport(\'' + r.id + '\')"><i class="fa-regular fa-circle-check"></i> Resolve</button>' : '') +
                        (r.seller_id ? '<button class="btn-action ban" onclick="AdminExt.suspendSeller(\'' + r.seller_id + '\')"><i class="fa-solid fa-ban"></i> Suspend Seller</button>' : '') +
                        '<button class="btn-action delete" onclick="AdminExt.deleteReport(\'' + r.id + '\')"><i class="fa-regular fa-trash-can"></i></button>' +
                    '</div>' +
                '</div>';
            }).join('');
        } catch (e) {
            console.error('loadReports error:', e);
            container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-circle-exclamation" style="color:#c0392b;"></i><p>Error loading reports</p></div>';
        }
    }
    async function resolveReport(id) {
        try {
            await getDb().collection('reports').doc(id).update({ status: 'resolved', resolved_at: new Date().toISOString() });
            toast('Report resolved', 'success');
            loadReports();
        } catch (e) { toast('Failed', 'error'); }
    }
    async function deleteReport(id) {
        if (!confirm('Delete this report?')) return;
        try {
            await getDb().collection('reports').doc(id).delete();
            toast('Report deleted', 'info');
            loadReports();
        } catch (e) { toast('Failed', 'error'); }
    }
    async function suspendSeller(sellerId) {
        if (!confirm('Suspend this seller account?')) return;
        try {
            await getDb().collection('users').doc(sellerId).update({ status: 'suspended', updated_at: new Date().toISOString() });
            toast('Seller suspended', 'info');
        } catch (e) { toast('Failed', 'error'); }
    }

    // ─── SELLER VERIFICATION (used by Sellers tab) ───
    async function verifySeller(sellerId) {
        try {
            var db = getDb();
            await db.collection('users').doc(sellerId).update({
                verified: true, status: 'approved',
                verified_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
            // Mark all their products as supplier_verified so badges appear
            try {
                var prods = await db.collection('products').where('supplier_id', '==', sellerId).get();
                var batch = [];
                prods.forEach(function (doc) {
                    batch.push(doc.ref.update({ supplier_verified: true }));
                });
                await Promise.all(batch);
            } catch (e) {}
            // Congratulation email
            try {
                var udoc = await db.collection('users').doc(sellerId).get();
                if (udoc.exists && udoc.data().email && typeof window.sendAdminEmail === 'function') {
                    window.sendAdminEmail(
                        udoc.data().email,
                        udoc.data().full_name || udoc.data().company || 'Seller',
                        '🏅 You are now a Verified Seller on Pilot Sales Distribution',
                        'Congratulations! Your seller account has been <strong>verified</strong> by our Trust &amp; Safety team.<br><br>The blue <strong>✓ Verified</strong> badge now appears on your profile and all your products, helping buyers trust you more and buy with confidence.',
                        'Open Seller Dashboard', 'https://pilotsalesdistribution.com/seller-dashboard'
                    ).catch(function () {});
                }
            } catch (e) {}
            toast('🏅 Seller verified — badge applied to their products', 'success');
            if (typeof window.loadSellers === 'function') window.loadSellers();
        } catch (e) { toast('Verification failed', 'error'); }
    }
    async function unverifySeller(sellerId) {
        if (!confirm('Remove the verified badge from this seller?')) return;
        try {
            var db = getDb();
            await db.collection('users').doc(sellerId).update({
                verified: false, updated_at: new Date().toISOString()
            });
            try {
                var prods = await db.collection('products').where('supplier_id', '==', sellerId).get();
                var batch = [];
                prods.forEach(function (doc) {
                    batch.push(doc.ref.update({ supplier_verified: false }));
                });
                await Promise.all(batch);
            } catch (e) {}
            toast('Verified badge removed', 'info');
            if (typeof window.loadSellers === 'function') window.loadSellers();
        } catch (e) { toast('Failed', 'error'); }
    }

    // ─── CUSTOMER MANAGEMENT EXTRAS ───
    async function deleteUser(userId) {
        if (!confirm('Delete this user record from Firestore? (Their login credentials in Firebase Auth are not removed.)')) return;
        try {
            await getDb().collection('users').doc(userId).delete();
            toast('User record deleted', 'info');
            if (typeof window.loadCustomers === 'function') window.loadCustomers();
        } catch (e) { toast('Failed', 'error'); }
    }
    async function setUserRole(userId, role) {
        try {
            await getDb().collection('users').doc(userId).update({ role: role, updated_at: new Date().toISOString() });
            toast('Role updated to ' + role, 'success');
            if (typeof window.loadCustomers === 'function') window.loadCustomers();
        } catch (e) { toast('Failed', 'error'); }
    }

    // ════════════════════════════════════════════
    // 6. FESTIVAL CALENDAR
    // ════════════════════════════════════════════
    function showTabSafe(tab) {
        if (typeof window.showTab === 'function') window.showTab(tab);
    }

    function renderUpcoming() {
        var box = el('holidayUpcomingList');
        if (!box || !window.PseHolidays) return;
        var list = window.PseHolidays.upcoming(4);
        if (!list.length) { box.innerHTML = '<p style="color:var(--text-light);font-size:0.85rem;">No upcoming festivals.</p>'; return; }
        box.innerHTML = list.map(function (h) {
            var days = Math.max(0, Math.ceil((h.date - new Date()) / 86400000));
            return '<div style="display:flex;align-items:center;gap:0.7rem;padding:0.55rem 0.7rem;background:' +
                'linear-gradient(90deg,' + h.colors[0] + '14,' + h.colors[1] + '14);border:1px solid var(--border);border-radius:10px;margin-bottom:0.45rem;">' +
                '<span style="font-size:1.6rem;">' + h.emoji + '</span>' +
                '<div style="flex:1;min-width:0;">' +
                    '<strong style="font-size:0.85rem;color:var(--secondary);display:block;">' + esc(h.name) + (h.approx ? ' <span title="Exact date may vary">~</span>' : '') + '</strong>' +
                    '<span style="font-size:0.72rem;color:var(--text-light);">' + h.dateStr + '</span>' +
                '</div>' +
                '<span style="background:var(--primary);color:#fff;border-radius:20px;padding:0.15rem 0.6rem;font-size:0.7rem;font-weight:700;white-space:nowrap;">' +
                    (days === 0 ? 'TODAY 🎉' : days + 'd left') + '</span>' +
            '</div>';
        }).join('');
    }

    function renderCalendar() {
        var box = el('holidayCalendarList');
        if (!box || !window.PseHolidays) return;
        var year = new Date().getFullYear();
        var list = window.PseHolidays.all(year);
        var today = new Date(); today.setHours(0, 0, 0, 0);

        var months = {};
        list.forEach(function (h) {
            var m = h.date.toLocaleDateString(undefined, { month: 'long' });
            (months[m] = months[m] || []).push(h);
        });

        box.innerHTML = Object.keys(months).map(function (m) {
            return '<h4 style="font-size:0.85rem;color:var(--secondary);margin:0.9rem 0 0.4rem;border-bottom:1px solid var(--border);padding-bottom:0.25rem;"><i class="fa-regular fa-calendar"></i> ' + m + ' ' + year + '</h4>' +
                months[m].map(function (h) {
                    var isToday = h.date.getTime() === today.getTime();
                    var past = h.date < today;
                    return '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.5rem 0.7rem;border-radius:8px;margin-bottom:0.3rem;' +
                        (isToday ? 'background:linear-gradient(90deg,' + h.colors[0] + ',' + h.colors[1] + ');color:#fff;' : 'background:#fff;border:1px solid var(--border);' + (past ? 'opacity:0.55;' : '')) + '">' +
                        '<span style="font-size:1.25rem;">' + h.emoji + '</span>' +
                        '<div style="flex:1;min-width:0;">' +
                            '<strong style="font-size:0.8rem;display:block;">' + esc(h.name) + (h.approx ? ' <span title="Approximate date">~</span>' : '') + (h.custom ? ' <span style="font-size:0.6rem;background:#8e44ad;color:#fff;border-radius:8px;padding:0 0.4rem;">CUSTOM</span>' : '') + '</strong>' +
                            '<span style="font-size:0.68rem;' + (isToday ? 'opacity:0.85;' : 'color:var(--text-light);') + '">' + h.dateStr + '</span>' +
                        '</div>' +
                        '<div style="display:flex;gap:0.25rem;flex-wrap:wrap;">' +
                            '<button class="btn-action view" title="Preview branded festival card" onclick="AdminExt.previewHoliday(\'' + h.key + '\')"><i class="fa-regular fa-image"></i></button>' +
                            '<button class="btn-action reply" title="Send festival emails now" onclick="AdminExt.sendHolidayNow(\'' + h.key + '\')"><i class="fa-regular fa-paper-plane"></i></button>' +
                            (h.custom ? '<button class="btn-action delete" title="Delete" onclick="AdminExt.deleteHoliday(\'' + h.key + '\')"><i class="fa-regular fa-trash-can"></i></button>' : '') +
                        '</div>' +
                    '</div>';
                }).join('');
        }).join('');
    }

    async function refreshHolidayUI() {
        renderUpcoming();
        renderCalendar();
        // Auto-email toggle state
        try {
            if (window.PseHolidays && el('holidayAutoToggle')) {
                var cfg = await window.PseHolidays.getConfig();
                el('holidayAutoToggle').checked = cfg.auto_email !== false;
            }
        } catch (e) {}
    }

    async function addHolidayFromForm() {
        var name = el('hName').value.trim();
        var emoji = el('hEmoji').value.trim() || '🎉';
        var month = el('hMonth').value, day = el('hDay').value;
        var message = el('hMessage').value.trim();
        var cta = el('hCta').value.trim();
        if (!name || !month || !day) { toast('Name, month and day are required', 'error'); return; }
        try {
            await window.PseHolidays.addCustomHoliday({ name: name, emoji: emoji, month: month, day: day, message: message, cta: cta });
            el('hName').value = ''; el('hEmoji').value = ''; el('hDay').value = ''; el('hMessage').value = ''; el('hCta').value = '';
            toast('🎉 Festival added to the calendar', 'success');
            refreshHolidayUI();
        } catch (e) { toast('Failed to add festival: ' + e.message, 'error'); }
    }

    async function previewHoliday(key) {
        var year = new Date().getFullYear();
        var h = window.PseHolidays.all(year).find(function (x) { return x.key === key; })
             || window.PseHolidays.all(year + 1).find(function (x) { return x.key === key; });
        if (!h) return;
        var modal = el('holidayPreviewModal');
        modal.classList.add('show');
        var img = el('holidayPreviewImg');
        img.src = '';
        el('holidayPreviewTitle').textContent = h.emoji + ' ' + h.name;
        img.alt = 'Generating…';
        var card = await window.PseHolidays.generateCard(h);
        img.src = card.dataUrl;
        img.dataset.dataUrl = card.dataUrl;
        el('holidayPreviewDownload').dataset.key = key;
        el('holidayPreviewSend').dataset.key = key;
    }
    function closeHolidayPreview() { el('holidayPreviewModal').classList.remove('show'); }
    function downloadHolidayCard(btn) {
        var img = el('holidayPreviewImg');
        if (!img || !img.dataset.dataUrl) return;
        var a = document.createElement('a');
        a.href = img.dataset.dataUrl;
        a.download = 'pse-festival-card-' + (btn.dataset.key || 'card') + '.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast('⬇️ Festival image downloaded', 'success');
    }
    async function sendHolidayNow(key) {
        var year = new Date().getFullYear();
        var h = window.PseHolidays.all(year).find(function (x) { return x.key === key; })
             || window.PseHolidays.all(year + 1).find(function (x) { return x.key === key; });
        if (!h) return;
        if (!confirm('Send ' + h.emoji + ' ' + h.name + ' greeting emails to all subscribers & users now?')) return;
        toast('📧 Sending festival emails… this can take a minute', 'info');
        var res = await window.PseHolidays.sendFestivalEmails(h, { auto: false });
        toast('🎉 ' + h.name + ': ' + res.sent + ' sent, ' + res.failed + ' failed (of ' + res.attempted + ')', res.sent ? 'success' : 'error');
        loadEmailLog();
    }
    async function toggleHolidayAuto(checkbox) {
        var on = !!checkbox.checked;
        await window.PseHolidays.setConfig({ auto_email: on, updated_at: new Date().toISOString() });
        toast(on ? '✅ Festival auto-emails ON' : '⏸️ Festival auto-emails OFF', on ? 'success' : 'info');
    }
    async function deleteHoliday(customKey) {
        if (!confirm('Delete this custom festival?')) return;
        try {
            await window.PseHolidays.deleteCustomHoliday(customKey);
            toast('Festival deleted', 'info');
            refreshHolidayUI();
        } catch (e) { toast('Failed', 'error'); }
    }

    // ════════════════════════════════════════════
    // TAB DISPATCH + INIT
    // ════════════════════════════════════════════
    function onTabShow(tab) {
        if (tab === 'subscribers') loadSubscribers();
        if (tab === 'support') loadSupport();
        if (tab === 'emailcenter') { loadEmailLog(); onAudienceChange(); }
        if (tab === 'reviews') loadReviewsAdmin();
        if (tab === 'trust') loadReports();
        if (tab === 'holidays') refreshHolidayUI();
    }

    function init() {
        // live refresh badges so the admin sees new subscribers/tickets/reports
        loadSubscribers();
        loadSupport();
        loadReports();
        loadReviewsAdmin();
        // greet with today's festival info (if any)
        if (window.PseHolidays) {
            window.PseHolidays.loadCustom().then(function () {
                var today = window.PseHolidays.todayHoliday();
                if (today) toast('🎉 Today is ' + today.name + ' — festival emails handle automatically!', 'success');
            });
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { ready(init); });
    else ready(init);

    // ─── PUBLIC NAMESPACE ───
    window.AdminExt = {
        onTabShow: onTabShow,
        // subscribers
        loadSubscribers: loadSubscribers,
        deleteSubscriber: deleteSubscriber,
        exportSubscribersCsv: exportSubscribersCsv,
        emailOne: emailOne,
        // support
        loadSupport: loadSupport,
        replyToSupport: replyToSupport,
        resolveSupport: function (id) { setTicketStatus(id, 'resolved'); },
        reopenSupport: function (id) { setTicketStatus(id, 'unread'); },
        deleteSupport: deleteSupport,
        // email center
        onAudienceChange: onAudienceChange,
        sendEmailCenter: sendEmailCenter,
        loadEmailLog: loadEmailLog,
        // reviews
        loadReviewsAdmin: loadReviewsAdmin,
        deleteReview: deleteReview,
        // trust & safety
        loadReports: loadReports,
        resolveReport: resolveReport,
        deleteReport: deleteReport,
        suspendSeller: suspendSeller,
        verifySeller: verifySeller,
        unverifySeller: unverifySeller,
        deleteUser: deleteUser,
        setUserRole: setUserRole,
        // holidays
        refreshHolidayUI: refreshHolidayUI,
        addHolidayFromForm: addHolidayFromForm,
        previewHoliday: previewHoliday,
        closeHolidayPreview: closeHolidayPreview,
        downloadHolidayCard: downloadHolidayCard,
        sendHolidayNow: sendHolidayNow,
        toggleHolidayAuto: toggleHolidayAuto,
        deleteHoliday: deleteHoliday
    };
    console.log('🧩 Admin extensions ready (subscribers, support, email center, reviews, trust, holidays)');
})();
