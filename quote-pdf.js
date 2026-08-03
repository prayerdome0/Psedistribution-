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
        var boxH = 92;

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
        var billTo = [(c.firstName || '') + ' ' + (c.lastName || '')];
        if (c.company) billTo.push(truncate(c.company, 44));
        billTo.push('Email: ' + (c.email || 'N/A'));
        billTo.push('Phone: ' + (c.phone || 'N/A') + (c.vat_id ? '  |  VAT/Tax ID: ' + truncate(c.vat_id, 18) : ''));
        billTo.push(truncate((c.address || '') + ', ' + (c.city || '') + ', ' + (c.state || '') + ' ' + (c.zip || '') + '  ' + (c.country || ''), 52));
        y = drawPartyBoxes(doc, y,
            'ISSUED BY',
            ['Pilot Sales Distribution', 'Verified Wholesale Suppliers Network', 'Email: support@pilotsalesdistribution.com', 'WhatsApp: +1 (909) 938-4682'],
            'BILL TO (COMMERCIAL BUYER)',
            billTo.slice(0, 5));

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

        addVerification(doc, qn);
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

        addVerification(doc, rfqNum);
        drawFooter(doc);
        return doc;
    }

    // ════════════════════════════════════════════
    // SUPPLIER QUOTE PDF (admin's priced response to an RFQ)
    // ════════════════════════════════════════════
    // rfq:   { id, title, quantity, category, purchase_order_number }
    // quote: { quote_ref, unit_price, moq, lead_time_days, valid_days, notes, total, quoted_at }
    // user:  buyer { full_name, email, id }
    function buildSupplierQuotePdf(rfq, quote, user) {
        var doc = newDoc();
        if (!doc || !rfq || !quote) return null;

        var ref = quote.quote_ref || ('SQ-PSE-' + String(rfq.id || 'DRAFT').slice(0, 8).toUpperCase());
        var y = drawTopBand(doc, 'PILOT SALES DISTRIBUTION', 'OFFICIAL SUPPLIER QUOTATION', 'Quote Ref: ', ref, fmtDate(quote.quoted_at));

        // ─── Parties ───
        y = drawPartyBoxes(doc, y,
            'QUOTED BY',
            ['Pilot Sales Distribution', 'Verified Wholesale Suppliers Network', 'Email: support@pilotsalesdistribution.com', 'WhatsApp: +1 (909) 938-4682'],
            'QUOTED FOR (COMMERCIAL BUYER)',
            [(user && user.full_name) || 'B2B Commercial Buyer', 'Email: ' + ((user && user.email) || 'N/A'), 'Buyer ID: ' + truncate((user && user.id) || 'N/A', 30), rfq.purchase_order_number ? 'Corporate PO #: ' + rfq.purchase_order_number : '']);

        // ─── Meta strip ───
        y += 12;
        var validUntil = '';
        try {
            var vd = new Date(quote.quoted_at || Date.now());
            vd.setDate(vd.getDate() + (Number(quote.valid_days) || 14));
            validUntil = fmtDate(vd.toISOString());
        } catch (e) { validUntil = 'N/A'; }
        doc.setFillColor(232, 245, 240);
        doc.roundedRect(MARGIN, y, CONTENT_W, 34, 5, 5, 'F');
        var meta = [
            ['IN RESPONSE TO', 'RFQ-PSE-' + String(rfq.id || '').slice(0, 8).toUpperCase()],
            ['MIN. ORDER QTY', String(quote.moq || 1) + ' units'],
            ['LEAD TIME', (Number(quote.lead_time_days) || 0) + ' days'],
            ['VALID UNTIL', validUntil]
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

        // ─── Pricing table ───
        y += 52;
        doc.setFillColor.apply(doc, NAVY);
        doc.rect(MARGIN, y, CONTENT_W, 20, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text('QUOTED ITEM', MARGIN + 4, y + 13);
        doc.text('QTY', MARGIN + 355, y + 13, { align: 'center' });
        doc.text('UNIT PRICE', MARGIN + 420, y + 13, { align: 'right' });
        doc.text('LINE TOTAL', PAGE_W - MARGIN - 4, y + 13, { align: 'right' });
        doc.setTextColor.apply(doc, DARK_TXT);
        y += 20;

        var qty = Number(rfq.quantity) || 1;
        var unit = Number(quote.unit_price) || 0;
        var lineTitle = doc.splitTextToSize(safe(rfq.title || 'Quoted Item'), 260);
        var rowH = Math.max(20, lineTitle.length * 10 + 10);
        doc.setFillColor.apply(doc, ROW_ALT);
        doc.rect(MARGIN, y, CONTENT_W, rowH, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text(lineTitle, MARGIN + 4, y + 13);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.text(String(qty) + ' units', MARGIN + 355, y + 13, { align: 'center' });
        doc.text(money(unit), MARGIN + 420, y + 13, { align: 'right' });
        doc.setFont('helvetica', 'bold');
        doc.text(money(unit * qty), PAGE_W - MARGIN - 4, y + 13, { align: 'right' });
        y += rowH + 14;

        // ─── Total box ───
        doc.setFillColor.apply(doc, TEAL);
        doc.roundedRect(MARGIN + 280, y, CONTENT_W - 280, 24, 4, 4, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('QUOTED TOTAL', MARGIN + 290, y + 16);
        doc.text(money(unit * qty), PAGE_W - MARGIN - 10, y + 16, { align: 'right' });
        doc.setTextColor.apply(doc, DARK_TXT);
        y += 36;

        // ─── Supplier notes ───
        if (quote.notes) {
            var noteLines = paragraphsToLines(doc, quote.notes, CONTENT_W - 24);
            var noteH = noteLines.length * 10 + 24;
            if (y + noteH > PAGE_H - 150) { doc.addPage(); y = 60; }
            doc.setFillColor.apply(doc, LIGHT);
            doc.setDrawColor(220, 227, 233);
            doc.roundedRect(MARGIN, y, CONTENT_W, noteH, 5, 5, 'FD');
            doc.setTextColor.apply(doc, NAVY);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.text('SUPPLIER TERMS & NOTES', MARGIN + 10, y + 14);
            doc.setTextColor.apply(doc, GRAY_TXT);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.text(noteLines, MARGIN + 10, y + 26);
            y += noteH + 12;
        }

        // ─── How to proceed ───
        if (y + 70 > PAGE_H - 60) { doc.addPage(); y = 60; }
        doc.setFillColor(232, 245, 240);
        doc.setDrawColor.apply(doc, TEAL);
        doc.rect(MARGIN, y, 3, 62, 'F');
        doc.rect(MARGIN, y, CONTENT_W, 62, 'F');
        doc.setTextColor.apply(doc, TEAL_DARK);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('HOW TO PROCEED', MARGIN + 12, y + 15);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.8);
        doc.text('1. Accept this quotation on your RFQ page (or reply on WhatsApp quoting the reference above).', MARGIN + 12, y + 29);
        doc.text('2. A pro-forma invoice is issued with Escrow Trade Assurance payment terms.', MARGIN + 12, y + 41);
        doc.text('3. Funds are held in escrow and released only after inspection & confirmed delivery.', MARGIN + 12, y + 53);
        y += 74;

        doc.setTextColor.apply(doc, MUTED);
        doc.setFontSize(7);
        doc.text('This supplier quotation is firm until the validity date stated above. E&OE. (C) ' + new Date().getFullYear() + ' Pilot Sales Distribution.', MARGIN, y);
        y += 12;

        addVerification(doc, ref);
        drawFooter(doc);
        return doc;
    }

    // ════════════════════════════════════════════
    // DOCUMENT AUTHENTICITY VERIFICATION (QR + link on every PDF)
    // ════════════════════════════════════════════
    // Renders a QR (qrcodejs CDN — optional, synchronous) pointing at
    // /verify?ref=… plus a printed URL, above the footer of page 1 area.
    function addVerification(doc, ref) {
        if (!doc || !ref) return;
        var origin = 'https://pilotsalesdistribution.com';
        try { if (typeof window !== 'undefined' && window.location && window.location.origin) origin = window.location.origin; } catch (e) {}
        var url = origin + '/verify?ref=' + encodeURIComponent(ref);
        var yQr = PAGE_H - 106;
        doc.setTextColor.apply(doc, MUTED);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.8);
        doc.text('VERIFY AUTHENTICITY OF THIS DOCUMENT', MARGIN + 52, yQr + 8);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.text('Scan the code or visit: ' + url, MARGIN + 52, yQr + 18);
        doc.text('Reference: ' + truncate(ref, 40), MARGIN + 52, yQr + 28);
        try {
            if (typeof document !== 'undefined' && window.QRCode) {
                var holder = document.createElement('div');
                holder.style.cssText = 'position:absolute;left:-9999px;top:-9999px;';
                document.body.appendChild(holder);
                new window.QRCode(holder, {
                    text: url, width: 56, height: 56,
                    correctLevel: window.QRCode.CorrectLevel ? window.QRCode.CorrectLevel.M : 1
                });
                var canvas = holder.querySelector('canvas');
                var img = !canvas ? holder.querySelector('img') : null;
                var dataUrl = canvas ? canvas.toDataURL('image/png') : (img && img.src ? img.src : null);
                if (dataUrl) doc.addImage(dataUrl, 'PNG', MARGIN, yQr, 44, 44);
                holder.remove();
            } else {
                // No QR library — draw a simple outlined box placeholder
                doc.setDrawColor.apply(doc, TEAL);
                doc.rect(MARGIN, yQr, 44, 44);
            }
        } catch (e) { /* QR is decorative */ }
        doc.setTextColor.apply(doc, DARK_TXT);
    }

    // ════════════════════════════════════════════
    // BUYER STATEMENT OF ACCOUNT (multi-order ledger PDF)
    // ════════════════════════════════════════════
    // orders: array of order docs { quoteNumber, created_at|date, status, totals.total, items[] }
    function buildStatementPdf(orders, user) {
        var doc = newDoc();
        if (!doc) return null;
        orders = (orders || []).slice().sort(function (a, b) {
            return new Date(b.created_at || b.date || 0) - new Date(a.created_at || a.date || 0);
        });

        var ref = 'STMT-' + Date.now().toString(36).toUpperCase();
        var y = drawTopBand(doc, 'PILOT SALES DISTRIBUTION', 'STATEMENT OF ACCOUNT', 'Statement: ', ref, fmtDate(new Date().toISOString()));

        y = drawPartyBoxes(doc, y,
            'PREPARED BY',
            ['Pilot Sales Distribution', 'B2B Wholesale Marketplace', 'Email: support@pilotsalesdistribution.com', 'WhatsApp: +1 (909) 938-4682'],
            'PREPARED FOR',
            [(user && user.full_name) || 'Commercial Buyer', 'Email: ' + ((user && user.email) || 'N/A'), 'Account ID: ' + truncate((user && user.id) || 'N/A', 30), '']);

        // ─── Meta strip ───
        y += 12;
        var totalCount = orders.length;
        var grandTotal = orders.reduce(function (s, o) { return s + (((o.totals || {}).total) || o.total || 0); }, 0);
        var statuses = {};
        orders.forEach(function (o) { var st = (o.status || 'pending'); statuses[st] = (statuses[st] || 0) + 1; });
        doc.setFillColor(232, 245, 240);
        doc.roundedRect(MARGIN, y, CONTENT_W, 34, 5, 5, 'F');
        var meta = [
            ['QUOTES / ORDERS', String(totalCount)],
            ['COMBINED VALUE', money(grandTotal)],
            ['IN PROGRESS', String((statuses.pending || 0) + (statuses.processing || 0) + (statuses.shipped || 0))],
            ['COMPLETED', String((statuses.delivered || 0) + (statuses.completed || 0))]
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
            doc.text(truncate(m[1], 28), x, y + 26);
        });

        // ─── Ledger table ───
        y += 52;
        var cols = [
            { label: 'DATE', x: MARGIN, w: 78, align: 'left' },
            { label: 'REFERENCE', x: MARGIN + 78, w: 128, align: 'left' },
            { label: 'TYPE', x: MARGIN + 206, w: 52, align: 'left' },
            { label: 'ITEMS', x: MARGIN + 258, w: 44, align: 'center' },
            { label: 'STATUS', x: MARGIN + 302, w: 90, align: 'left' },
            { label: 'TOTAL', x: MARGIN + 392, w: 123, align: 'right' }
        ];

        function drawHeader() {
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

        drawHeader();
        orders.forEach(function (o, i) {
            if (y + 18 > PAGE_H - 140) { doc.addPage(); y = 60; drawHeader(); }
            if (i % 2 === 0) {
                doc.setFillColor.apply(doc, ROW_ALT);
                doc.rect(MARGIN, y, CONTENT_W, 18, 'F');
            }
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            var d = new Date(o.created_at || o.date || Date.now());
            doc.text(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), cols[0].x + 4, y + 13);
            doc.setFont('helvetica', 'bold');
            doc.text(truncate(o.quoteNumber || o.orderNumber || 'N/A', 22), cols[1].x + 4, y + 13);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor.apply(doc, MUTED);
            doc.text('QUOTE', cols[2].x + 4, y + 13);
            doc.setTextColor.apply(doc, DARK_TXT);
            doc.text(String((o.items || []).length || o.items_count || '—'), cols[3].x + cols[3].w / 2, y + 13, { align: 'center' });
            var st = (o.status || 'pending').toUpperCase();
            doc.setTextColor.apply(doc, st === 'DELIVERED' || st === 'COMPLETED' ? TEAL : (st === 'CANCELLED' ? [192, 57, 43] : MUTED));
            doc.text(st, cols[4].x + 4, y + 13);
            doc.setTextColor.apply(doc, DARK_TXT);
            doc.setFont('helvetica', 'bold');
            doc.text(money(((o.totals || {}).total) || o.total || 0), cols[5].x + cols[5].w - 4, y + 13, { align: 'right' });
            doc.setFont('helvetica', 'normal');
            doc.setDrawColor(224, 230, 235);
            doc.line(MARGIN, y + 18, PAGE_W - MARGIN, y + 18);
            y += 18;
        });

        if (!orders.length) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor.apply(doc, MUTED);
            doc.text('No activity on this account yet.', MARGIN + 4, y + 14);
            y += 24;
        }

        // ─── Grand total box ───
        y += 12;
        if (y > PAGE_H - 200) { doc.addPage(); y = 60; }
        doc.setFillColor.apply(doc, TEAL);
        doc.roundedRect(MARGIN + 260, y, CONTENT_W - 260, 24, 4, 4, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('COMBINED VALUE', MARGIN + 270, y + 16);
        doc.text(money(grandTotal), PAGE_W - MARGIN - 10, y + 16, { align: 'right' });
        doc.setTextColor.apply(doc, DARK_TXT);
        y += 40;

        doc.setTextColor.apply(doc, MUTED);
        doc.setFontSize(7);
        doc.text('This statement reflects quotations and orders placed through Pilot Sales Distribution. For dispute or reconciliation,', MARGIN, y);
        doc.text('contact support@pilotsalesdistribution.com quoting the reference numbers above. (C) ' + new Date().getFullYear() + ' Pilot Sales Distribution.', MARGIN, y + 10);

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
        buildSupplierQuotePdf: buildSupplierQuotePdf,
        buildStatementPdf: buildStatementPdf,
        shareViaWhatsApp: shareViaWhatsApp
    };
})();
