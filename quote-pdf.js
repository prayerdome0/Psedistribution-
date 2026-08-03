// ============================================
// QUOTE-PDF.JS - Pilot Sales Distribution
// Branded, client-side PDF generation for:
//   • Checkout commercial quotations (WhatsApp delivery)
//   • RFQ procurement documents
//
// Requires jsPDF 2.x UMD (window.jspdf) to be loaded before use:
//   https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js
//
// Public API: window.PSE_QUOTE_PDF
//   • available()
//   • buildQuotePdf(orderData)      -> jsPDF doc | null
//   • buildRfqPdf(rfq, user)        -> jsPDF doc | null
//   • shareViaWhatsApp(doc, filename, message, waNumber)
//        -> Promise<'shared'|'cancelled'|'downloaded'|'unavailable'>
// ============================================
(function () {
    'use strict';

    // ─── BRAND PALETTE (mirrors site CSS variables) ───
    var NAVY = [11, 42, 59];        // --secondary #0b2a3b
    var TEAL = [26, 123, 107];      // --primary    #1a7b6b
    var TEAL_DARK = [15, 79, 67];   // --primary-dark
    var ACCENT = [241, 196, 15];    // --accent     #f1c40f
    var LIGHT = [240, 244, 248];    // --light
    var ROW_ALT = [248, 249, 250];
    var DARK_TXT = [34, 34, 34];
    var GRAY_TXT = [102, 102, 102];
    var MUTED = [106, 136, 154];    // --text-light

    var PAGE_W = 595.28;            // A4 width in pt
    var PAGE_H = 841.89;            // A4 height in pt
    var MARGIN = 40;
    var CONTENT_W = PAGE_W - MARGIN * 2;

    function available() {
        return !!(window.jspdf && window.jspdf.jsPDF);
    }

    function newDoc() {
        if (!available()) return null;
        return new window.jspdf.jsPDF({ unit: 'pt', format: 'a4' });
    }

    // jsPDF's built-in fonts are Latin-1 only — keep generated PDFs clean.
    function safe(s) {
        return String(s == null ? '' : s).replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
    }

    function money(n) {
        n = Number(n) || 0;
        return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function fmtDate(iso) {
        try {
            return new Date(iso || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        } catch (e) { return new Date().toLocaleDateString('en-US'); }
    }

    function truncate(s, max) {
        s = safe(s);
        return s.length > max ? s.substring(0, max - 3) + '...' : s;
    }

    // Word-wrap that preserves explicit line breaks (\n) in user content.
    function paragraphsToLines(doc, text, width) {
        var out = [];
        String(text || '').split(/\r?\n/).forEach(function (para) {
            if (!para.trim()) { out.push(''); return; }
            var lines = doc.splitTextToSize(safe(para), width);
            out = out.concat(lines);
        });
        return out;
    }

    // ─── SHARED LAYOUT PIECES ───
    function drawTopBand(doc, title, badge, refLabel, refValue, dateStr) {
        doc.setFillColor.apply(doc, NAVY);
        doc.rect(0, 0, PAGE_W, 86, 'F');
        doc.setFillColor.apply(doc, TEAL);
        doc.rect(0, 86, PAGE_W, 4, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        doc.text('PILOT SALES DISTRIBUTION', MARGIN, 32);
        doc.setTextColor(180, 208, 224);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text('Global B2B Wholesale Marketplace & Procurement', MARGIN, 47);

        doc.setTextColor.apply(doc, ACCENT);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(badge, PAGE_W - MARGIN, 28, { align: 'right' });
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.text(refLabel + refValue, PAGE_W - MARGIN, 44, { align: 'right' });
        doc.setTextColor(180, 208, 224);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text('Date Issued: ' + dateStr, PAGE_W - MARGIN, 60, { align: 'right' });
        doc.setTextColor.apply(doc, DARK_TXT);
        return 108; // first y position below the band
    }

    function drawPartyBoxes(doc, y, leftTitle, leftLines, rightTitle, rightLines) {
        var boxW = (CONTENT_W - 20) / 2;
        var boxH = 82;

        [[MARGIN, leftTitle, leftLines], [MARGIN + boxW + 20, rightTitle, rightLines]].forEach(function (b) {
            var x = b[0], heading = b[1], lines = b[2];
            doc.setFillColor.apply(doc, LIGHT);
            doc.setDrawColor(220, 227, 233);
            doc.roundedRect(x, y, boxW, boxH, 6, 6, 'FD');
            doc.setTextColor.apply(doc, NAVY);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.text(heading, x + 12, y + 16);
            doc.setTextColor.apply(doc, DARK_TXT);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            var ly = y + 31;
            lines.forEach(function (line, i) {
                if (i === 0) {
                    doc.setFont('helvetica', 'bold');
                    doc.text(truncate(line, 44), x + 12, ly);
                    doc.setFont('helvetica', 'normal');
                } else {
                    doc.setTextColor.apply(doc, GRAY_TXT);
                    doc.text(truncate(line, 52), x + 12, ly);
                    doc.setTextColor.apply(doc, DARK_TXT);
                }
                ly += 12.5;
            });
        });
        return y + boxH;
    }

    function drawFooter(doc) {
        doc.setFillColor.apply(doc, TEAL);
        doc.rect(0, PAGE_H - 34, PAGE_W, 2, 'F');
        doc.setTextColor.apply(doc, GRAY_TXT);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.text('Pilot Sales Distribution  •  support@pilotsalesdistribution.com  •  WhatsApp +1 (909) 938-4682  •  pilotsalesdistribution.com', PAGE_W / 2, PAGE_H - 18, { align: 'center' });
        doc.setTextColor.apply(doc, DARK_TXT);
    }

    // ════════════════════════════════════════════
    // CHECKOUT COMMERCIAL QUOTATION PDF
    // ════════════════════════════════════════════
    // orderData: { quoteNumber, date, items[], customer{}, totals{}, coupon_code, paymentMethod, purchase_order_number, incoterm, notes, status }
    function buildQuotePdf(orderData) {
        var doc = newDoc();
        if (!doc || !orderData) return null;

        var qn = orderData.quoteNumber || ('QTE-' + Date.now());
        var y = drawTopBand(doc, 'PILOT SALES DISTRIBUTION', 'OFFICIAL QUOTATION', 'Quote #: ', qn, fmtDate(orderData.date));

        // ─── Parties ───
        var c = orderData.customer || {};
        y = drawPartyBoxes(doc, y,
            'ISSUED BY',
            ['Pilot Sales Distribution', 'Verified Wholesale Suppliers Network', 'Email: support@pilotsalesdistribution.com', 'WhatsApp: +1 (909) 938-4682'],
            'BILL TO (COMMERCIAL BUYER)',
            [(c.firstName || '') + ' ' + (c.lastName || ''), 'Email: ' + (c.email || 'N/A'), 'Phone: ' + (c.phone || 'N/A'),
                truncate((c.address || '') + ', ' + (c.city || '') + ', ' + (c.state || '') + ' ' + (c.zip || '') + '  ' + (c.country || ''), 52)]);

        // ─── Meta strip ───
        y += 12;
        doc.setFillColor(232, 245, 240);
        doc.roundedRect(MARGIN, y, CONTENT_W, 34, 5, 5, 'F');
        var meta = [
            ['P.O. NUMBER', orderData.purchase_order_number || 'N/A'],
            ['TRADE BASIS', orderData.incoterm || 'DDP (Delivered Duty Paid)'],
            ['PAYMENT', truncate(orderData.paymentMethod || 'Escrow Trade Assurance', 30)],
            ['STATUS', (orderData.status || 'pending').toUpperCase()]
        ];
        var colW = CONTENT_W / 4;
        meta.forEach(function (m, i) {
            var x = MARGIN + i * colW + 10;
            doc.setTextColor.apply(doc, TEAL_DARK);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.5);
            doc.text(m[0], x, y + 13);
            doc.setTextColor.apply(doc, DARK_TXT);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.8);
            doc.text(truncate(m[1], 30), x, y + 26);
        });

        // ─── Items table ───
        y += 52;
        var cols = [
            { label: '#', x: MARGIN, w: 22, align: 'center' },
            { label: 'PRODUCT', x: MARGIN + 22, w: 203, align: 'left' },
            { label: 'BRAND', x: MARGIN + 225, w: 82, align: 'left' },
            { label: 'MOQ', x: MARGIN + 307, w: 38, align: 'center' },
            { label: 'QTY', x: MARGIN + 345, w: 38, align: 'center' },
            { label: 'UNIT PRICE', x: MARGIN + 383, w: 58, align: 'right' },
            { label: 'AMOUNT', x: MARGIN + 441, w: 74, align: 'right' }
        ];

        function drawTableHeader() {
            doc.setFillColor.apply(doc, NAVY);
            doc.rect(MARGIN, y, CONTENT_W, 20, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            cols.forEach(function (col) {
                var tx = col.align === 'right' ? col.x + col.w - 4 : col.align === 'center' ? col.x + col.w / 2 : col.x + 4;
                doc.text(col.label, tx, y + 13, { align: col.align });
            });
            doc.setTextColor.apply(doc, DARK_TXT);
            y += 20;
        }

        drawTableHeader();
        var items = orderData.items || [];
        items.forEach(function (item, i) {
            var titleLines = doc.splitTextToSize(safe(item.title || 'Product'), cols[1].w - 8);
            var rowH = Math.max(18, titleLines.length * 10 + 8);
            if (y + rowH > PAGE_H - 170) {           // keep room for totals + footer
                doc.addPage();
                y = 60;
                drawTableHeader();
            }
            if (i % 2 === 0) {
                doc.setFillColor.apply(doc, ROW_ALT);
                doc.rect(MARGIN, y, CONTENT_W, rowH, 'F');
            }
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor.apply(doc, GRAY_TXT);
            doc.text(String(i + 1), cols[0].x + cols[0].w / 2, y + 13, { align: 'center' });
            doc.setTextColor.apply(doc, DARK_TXT);
            doc.setFont('helvetica', 'bold');
            doc.text(titleLines, cols[1].x + 4, y + 12);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor.apply(doc, MUTED);
            doc.text(truncate(item.brand || 'Pilot Distribution', 16), cols[2].x + 4, y + 12);
            doc.setTextColor.apply(doc, DARK_TXT);
            doc.text(String(item.moq || 1), cols[3].x + cols[3].w / 2, y + 13, { align: 'center' });
            doc.text(String(item.quantity || 1), cols[4].x + cols[4].w / 2, y + 13, { align: 'center' });
            doc.text(money(item.price || 0), cols[5].x + cols[5].w - 4, y + 13, { align: 'right' });
            doc.setFont('helvetica', 'bold');
            doc.text(money((item.price || 0) * (item.quantity || 1)), cols[6].x + cols[6].w - 4, y + 13, { align: 'right' });
            doc.setFont('helvetica', 'normal');
            // row separator
            doc.setDrawColor(224, 230, 235);
            doc.line(MARGIN, y + rowH, PAGE_W - MARGIN, y + rowH);
            y += rowH;
        });

        // ─── Totals block ───
        var t = orderData.totals || {};
        y += 14;
        if (y > PAGE_H - 220) { doc.addPage(); y = 60; }
        var totX = MARGIN + 280;
        var labelX = totX + 10;
        var amtX = PAGE_W - MARGIN - 4;

        function totalRow(label, value, bold, color) {
            doc.setFont('helvetica', bold ? 'bold' : 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor.apply(doc, color || GRAY_TXT);
            doc.text(label, labelX, y);
            doc.setTextColor.apply(doc, color || DARK_TXT);
            doc.text(value, amtX, y, { align: 'right' });
            y += 15;
        }

        totalRow('Subtotal', money(t.subtotal));
        if (t.discount && t.discount > 0) {
            totalRow('Discount' + (orderData.coupon_code ? ' (' + orderData.coupon_code + ')' : ''), '-' + money(t.discount), false, [39, 174, 96]);
        }
        totalRow('Shipping', (t.shipping || 0) === 0 ? 'FREE' : money(t.shipping));
        totalRow('Tax (8%)', money(t.tax));
        y += 2;
        doc.setFillColor.apply(doc, TEAL);
        doc.roundedRect(totX, y, CONTENT_W - 280, 24, 4, 4, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('TOTAL DUE', totX + 10, y + 16);
        doc.text(money(t.total), PAGE_W - MARGIN - 10, y + 16, { align: 'right' });
        doc.setTextColor.apply(doc, DARK_TXT);
        y += 38;

        // ─── Notes ───
        if (orderData.notes) {
            var noteLines = paragraphsToLines(doc, orderData.notes, CONTENT_W - 24);
            var noteH = noteLines.length * 10 + 22;
            if (y + noteH > PAGE_H - 120) { doc.addPage(); y = 60; }
            doc.setFillColor.apply(doc, LIGHT);
            doc.roundedRect(MARGIN, y, CONTENT_W, noteH, 5, 5, 'F');
            doc.setTextColor.apply(doc, NAVY);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.text('BUYER NOTES', MARGIN + 10, y + 14);
            doc.setTextColor.apply(doc, GRAY_TXT);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.text(noteLines, MARGIN + 10, y + 26);
            y += noteH + 12;
        }

        // ─── Next steps / terms ───
        if (y + 96 > PAGE_H - 60) { doc.addPage(); y = 60; }
        doc.setFillColor(232, 245, 240);
        doc.setDrawColor.apply(doc, TEAL);
        doc.rect(MARGIN, y, 3, 88, 'F');
        doc.rect(MARGIN, y, CONTENT_W, 88, 'F');
        doc.setTextColor.apply(doc, TEAL_DARK);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('NEXT STEPS', MARGIN + 12, y + 15);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.8);
        var steps = [
            '1. Our wholesale team reviews your quotation and confirms stock availability & best-tier pricing.',
            '2. A formal pro-forma invoice is issued with Escrow Trade Assurance payment terms.',
            '3. Production & quality inspection milestones are tracked end-to-end until inspection passes.',
            '4. Escrow funds release to the supplier only after you confirm final delivery.'
        ];
        steps.forEach(function (s, i) { doc.text(truncate(s, 96), MARGIN + 12, y + 29 + i * 14); });
        y += 100;

        doc.setTextColor.apply(doc, MUTED);
        doc.setFontSize(7);
        doc.text('This quotation is valid for 14 days from the issue date. Prices are quoted on the trade basis stated above and include PSE Distribution', MARGIN, y);
        doc.text('Trade Assurance buyer protection. E&OE. (C) ' + new Date().getFullYear() + ' Pilot Sales Distribution.', MARGIN, y + 10);

        drawFooter(doc);
        return doc;
    }

    // ════════════════════════════════════════════
    // RFQ PROCUREMENT DOCUMENT PDF
    // ════════════════════════════════════════════
    // rfq: { id, title, description, quantity, budget, category, urgency, notes, purchase_order_number, status, created_at }
    function buildRfqPdf(rfq, user) {
        var doc = newDoc();
        if (!doc || !rfq) return null;

        var rfqNum = 'RFQ-PSE-' + String(rfq.id || 'DRAFT').slice(0, 8).toUpperCase();
        var y = drawTopBand(doc, 'PILOT SALES DISTRIBUTION', 'OFFICIAL REQUEST FOR QUOTATION', 'RFQ #: ', rfqNum, fmtDate(rfq.created_at));

        // ─── Parties ───
        y = drawPartyBoxes(doc, y,
            'ISSUED TO VERIFIED SUPPLIERS',
            ['Pilot Sales Distribution Network', 'Verified Wholesale Manufacturers & Suppliers', 'Email: support@pilotsalesdistribution.com', 'WhatsApp: +1 (909) 938-4682'],
            'ISSUED BY COMMERCIAL BUYER',
            [(user && user.full_name) || 'B2B Commercial Buyer', 'Email: ' + ((user && user.email) || 'N/A'), 'Buyer ID: ' + truncate((user && user.id) || 'N/A', 30), rfq.purchase_order_number ? 'Corporate PO #: ' + rfq.purchase_order_number : '']);

        // ─── Meta strip ───
        y += 12;
        doc.setFillColor(232, 245, 240);
        doc.roundedRect(MARGIN, y, CONTENT_W, 34, 5, 5, 'F');
        var meta = [
            ['CATEGORY', rfq.category || 'N/A'],
            ['URGENCY', (rfq.urgency || 'normal').toUpperCase()],
            ['TARGET QUANTITY', String(rfq.quantity || 0) + ' units'],
            ['STATUS', (rfq.status || 'pending').toUpperCase()]
        ];
        var colW = CONTENT_W / 4;
        meta.forEach(function (m, i) {
            var x = MARGIN + i * colW + 10;
            doc.setTextColor.apply(doc, TEAL_DARK);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.5);
            doc.text(m[0], x, y + 13);
            doc.setTextColor.apply(doc, DARK_TXT);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.8);
            doc.text(truncate(m[1], 30), x, y + 26);
        });

        // ─── Spec table ───
        y += 52;
        doc.setFillColor.apply(doc, NAVY);
        doc.rect(MARGIN, y, CONTENT_W, 20, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text('REQUESTED ITEM / PROJECT TITLE', MARGIN + 4, y + 13);
        doc.text('CATEGORY', MARGIN + 315, y + 13);
        doc.text('QTY', MARGIN + 430, y + 13, { align: 'center' });
        doc.text('TARGET BUDGET', PAGE_W - MARGIN - 4, y + 13, { align: 'right' });
        doc.setTextColor.apply(doc, DARK_TXT);
        y += 20;

        var titleLines = doc.splitTextToSize(safe(rfq.title || 'Untitled RFQ'), 300);
        var rowH = Math.max(20, titleLines.length * 10 + 10);
        doc.setFillColor.apply(doc, ROW_ALT);
        doc.rect(MARGIN, y, CONTENT_W, rowH, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text(titleLines, MARGIN + 4, y + 13);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor.apply(doc, MUTED);
        doc.text(truncate(rfq.category || 'N/A', 14), MARGIN + 315, y + 13);
        doc.setTextColor.apply(doc, DARK_TXT);
        doc.text(String(rfq.quantity || 0) + ' units', MARGIN + 430, y + 13, { align: 'center' });
        doc.text(rfq.budget ? '$' + Number(rfq.budget).toLocaleString('en-US', { minimumFractionDigits: 2 }) : 'Open Quote', PAGE_W - MARGIN - 4, y + 13, { align: 'right' });
        y += rowH + 16;

        // ─── Detailed specifications ───
        var desc = rfq.description || 'No additional details provided.';
        var descLines = paragraphsToLines(doc, desc, CONTENT_W - 24);
        var linesPerBox = Math.floor((PAGE_H - 120 - y - 24) / 10.5);
        var chunk = descLines.splice(0, Math.max(linesPerBox, 4));

        function drawDescBox(lines, continued) {
            var boxH = lines.length * 10.5 + 26;
            doc.setFillColor.apply(doc, LIGHT);
            doc.setDrawColor(220, 227, 233);
            doc.roundedRect(MARGIN, y, CONTENT_W, boxH, 5, 5, 'FD');
            doc.setTextColor.apply(doc, NAVY);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.text(continued ? 'DETAILED PROCUREMENT SPECIFICATIONS (CONTINUED)' : 'DETAILED PROCUREMENT SPECIFICATIONS', MARGIN + 10, y + 14);
            doc.setTextColor.apply(doc, GRAY_TXT);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.text(lines, MARGIN + 10, y + 26);
            y += boxH + 12;
        }

        drawDescBox(chunk, false);
        while (descLines.length) {
            doc.addPage();
            y = 60;
            chunk = descLines.splice(0, 60);
            drawDescBox(chunk, true);
        }

        // ─── Additional notes ───
        if (rfq.notes) {
            var noteLines = paragraphsToLines(doc, rfq.notes, CONTENT_W - 24);
            var noteH = noteLines.length * 10 + 24;
            if (y + noteH > PAGE_H - 100) { doc.addPage(); y = 60; }
            doc.setFillColor.apply(doc, LIGHT);
            doc.roundedRect(MARGIN, y, CONTENT_W, noteH, 5, 5, 'F');
            doc.setTextColor.apply(doc, NAVY);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.text('ADDITIONAL BUYER NOTES', MARGIN + 10, y + 14);
            doc.setTextColor.apply(doc, GRAY_TXT);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.text(noteLines, MARGIN + 10, y + 26);
            y += noteH + 12;
        }

        // ─── Supplier notice ───
        if (y + 46 > PAGE_H - 60) { doc.addPage(); y = 60; }
        doc.setFillColor(232, 245, 240);
        doc.setDrawColor.apply(doc, TEAL);
        doc.rect(MARGIN, y, 3, 42, 'F');
        doc.rect(MARGIN, y, CONTENT_W, 42, 'F');
        doc.setTextColor.apply(doc, TEAL_DARK);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.8);
        doc.text('NOTICE TO RESPONDING SUPPLIERS', MARGIN + 12, y + 14);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.text(truncate('Quoted prices must include estimated lead times, Minimum Order Quantity (MOQ) breakdown, and trade assurance delivery terms.', 100), MARGIN + 12, y + 27);
        doc.text('Sealed bids are protected by 100% escrow buyer protection under PSE Distribution Trade Assurance.', MARGIN + 12, y + 38);

        drawFooter(doc);
        return doc;
    }

    // ════════════════════════════════════════════
    // WHATSAPP DELIVERY
    // WhatsApp cannot receive file attachments through wa.me links (platform
    // limitation). Strategy:
    //   1. Mobile: Web Share API Level 2 — the native sheet attaches the PDF
    //      directly; the buyer picks WhatsApp and the document goes with it.
    //   2. Desktop fallback: the PDF is downloaded automatically and a wa.me
    //      chat opens with a message prompting the buyer to attach the file.
    // ════════════════════════════════════════════
    async function shareViaWhatsApp(doc, filename, message, waNumber) {
        if (!doc) return 'unavailable';
        filename = filename || 'PSE-Quotation.pdf';

        // 1) Try native file sharing (mobile browsers)
        try {
            if (typeof navigator !== 'undefined' && navigator.canShare) {
                var blob = doc.output('blob');
                var file = null;
                try {
                    file = new File([blob], filename, { type: 'application/pdf' });
                } catch (fileErr) { /* very old browsers lack the File constructor */ }
                if (file && navigator.canShare({ files: [file] })) {
                    try {
                        await navigator.share({ files: [file], title: filename.replace(/\.pdf$/i, ''), text: message });
                        return 'shared';
                    } catch (shareErr) {
                        if (shareErr && shareErr.name === 'AbortError') return 'cancelled';
                        // fall through to download + wa.me
                    }
                }
            }
        } catch (e) { /* fall through */ }

        // 2) Desktop / fallback: download PDF, then open the WhatsApp chat
        try { doc.save(filename); } catch (e) {}
        if (waNumber) {
            var digits = String(waNumber).replace(/[^0-9]/g, '');
            try { window.open('https://wa.me/' + digits + '?text=' + encodeURIComponent(message), '_blank'); } catch (e) {}
        }
        return 'downloaded';
    }

    // ─── PUBLIC API ───
    window.PSE_QUOTE_PDF = {
        available: available,
        buildQuotePdf: buildQuotePdf,
        buildRfqPdf: buildRfqPdf,
        shareViaWhatsApp: shareViaWhatsApp
    };
})();
