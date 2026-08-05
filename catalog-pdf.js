/* ============================================================
   CATALOG-PDF.JS — Pilot Sales Distribution
   Branded, client-side wholesale LINE-SHEET / catalog PDF
   generator. Reuses the brand palette from quote-pdf.js.

   Requires jsPDF 2.x UMD (window.jspdf) loaded before use:
     https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js

   Public API: window.PSE_CATALOG_PDF
     • available()
     • buildCatalogPdf(cfg)        -> Promise<jsPDF doc | null>
     • generateAndSave(cfg)        -> Promise<boolean>
   ============================================================ */
(function () {
  'use strict';

  // ─── BRAND PALETTE (mirrors site CSS variables + quote-pdf.js) ───
  var NAVY = [11, 42, 59];        // --secondary #0b2138
  var TEAL = [26, 123, 107];      // --primary    #0e7c68
  var TEAL_DARK = [15, 79, 67];   // --primary-dark
  var ACCENT = [241, 196, 15];    // --accent     #e0a62e
  var LIGHT = [240, 244, 248];    // --light
  var DARK_TXT = [34, 34, 34];
  var GRAY_TXT = [102, 102, 102];
  var MUTED = [106, 136, 154];    // --text-light

  var PAGE_W = 595.28;            // A4 width (pt)
  var PAGE_H = 841.89;            // A4 height (pt)
  var MARGIN = 40;
  var CONTENT_W = PAGE_W - MARGIN * 2;

  // Grid layout
  var COLS = 2, ROWS = 3;
  var GAP_X = 20, GAP_Y = 24;
  var CARD_W = (CONTENT_W - GAP_X) / COLS;   // ~247.6
  var CARD_H = 282;
  var HEADER_H = 46;
  var FOOTER_H = 30;
  var GRID_TOP = MARGIN + HEADER_H + 12;

  function available() {
    return !!(window.jspdf && window.jspdf.jsPDF);
  }

  function newDoc() {
    if (!available()) return null;
    return new window.jspdf.jsPDF({ unit: 'pt', format: 'a4' });
  }

  // jsPDF core fonts are Latin-1 only — sanitize text.
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

  /* Load a remote image as a CORS-clean data URL so jsPDF can embed it.
     Returns { dataUrl, w, h } or null on failure. */
  function loadImageDataUrl(url) {
    return new Promise(function (resolve) {
      if (!url) return resolve(null);
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        try {
          var w = img.naturalWidth || 600, h = img.naturalHeight || 600;
          var max = 900, scale = Math.min(1, max / Math.max(w, h));
          var c = document.createElement('canvas');
          c.width = Math.round(w * scale);
          c.height = Math.round(h * scale);
          var ctx = c.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(img, 0, 0, c.width, c.height);
          resolve({ dataUrl: c.toDataURL('image/jpeg', 0.72), w: c.width, h: c.height });
        } catch (e) { resolve(null); }
      };
      img.onerror = function () { resolve(null); };
      img.src = url;
    });
  }

  // Draw an image cover-fit inside a box.
  function drawImageCover(doc, img, bx, by, bw, bh) {
    if (!img || !img.dataUrl) {
      doc.setFillColor(232, 237, 242);
      doc.rect(bx, by, bw, bh, 'F');
      return;
    }
    var ir = img.w / img.h, br = bw / bh, dw, dh;
    if (ir > br) { dh = bh; dw = bh * ir; } else { dw = bw; dh = bw / ir; }
    var dx = bx + (bw - dw) / 2, dy = by + (bh - dh) / 2;
    try { doc.addImage(img.dataUrl, 'JPEG', dx, dy, dw, dh); } catch (e) { /* ignore */ }
  }

  function drawCover(doc, cfg) {
    var site = cfg.site, category = cfg.category, cover = cfg.cover;
    doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.rect(0, 0, PAGE_W, PAGE_H, 'F');

    doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.rect(MARGIN, MARGIN + 64, 60, 6, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.text('WHOLESALE LINE SHEET', MARGIN, MARGIN + 40);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(34);
    var title = (category && category.name ? category.name : 'Product') + ' Catalog';
    var lines = doc.splitTextToSize(title, CONTENT_W);
    doc.text(lines, MARGIN, MARGIN + 110);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(13);
    doc.setTextColor(200, 220, 230);
    doc.text(safe(site.name) + ' — ' + safe(site.tagline), MARGIN, MARGIN + 110 + lines.length * 32 + 16);

    doc.setFontSize(11);
    doc.setTextColor(150, 175, 190);
    doc.text('Edition: ' + fmtDate(Date.now()), MARGIN, MARGIN + 110 + lines.length * 32 + 42);

    if (cover) {
      var bx = MARGIN, by = 470, bw = CONTENT_W, bh = 300;
      doc.setFillColor(255, 255, 255);
      doc.rect(bx - 4, by - 4, bw + 8, bh + 8, 'F');
      drawImageCover(doc, cover, bx, by, bw, bh);
      doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]);
      doc.setLineWidth(2);
      doc.rect(bx - 4, by - 4, bw + 8, bh + 8);
    }

    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(safe(site.url), MARGIN, PAGE_H - MARGIN);
  }

  function drawContentHeader(doc, category) {
    doc.setFillColor(TEAL[0], TEAL[1], TEAL[2]);
    doc.rect(0, 0, PAGE_W, HEADER_H, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    var name = category && category.name ? category.name : 'Products';
    doc.text(safe(name) + '  —  Wholesale Line Sheet', MARGIN, HEADER_H / 2 + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(fmtDate(Date.now()), PAGE_W - MARGIN, HEADER_H / 2 + 4, { align: 'right' });
  }

  function drawCard(doc, p, x, y, img) {
    var pad = 12;
    doc.setFillColor(255, 255, 255);
    doc.rect(x, y, CARD_W, CARD_H, 'F');
    doc.setDrawColor(225, 232, 238);
    doc.setLineWidth(1);
    doc.rect(x, y, CARD_W, CARD_H);

    var ix = x + pad, iy = y + pad, iw = CARD_W - pad * 2, ih = 132;
    drawImageCover(doc, img, ix, iy, iw, ih);

    var tx = x + pad, tw = CARD_W - pad * 2, ty = iy + ih + 14;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(DARK_TXT[0], DARK_TXT[1], DARK_TXT[2]);
    var title = doc.splitTextToSize(safe(p.title), tw);
    doc.text(title, tx, ty);
    ty += title.length * 14 + 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(safe(p.brand) + '   •   SKU ' + safe(p.sku), tx, ty);
    ty += 14;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(TEAL[0], TEAL[1], TEAL[2]);
    doc.text(money(p.price), tx, ty);
    if (Number(p.old_price) > Number(p.price)) {
      var pw = doc.getTextWidth(money(p.price));
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.7);
      doc.line(tx, ty - 4, tx + pw, ty - 4);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text(money(p.old_price), tx + pw + 6, ty);
    }
    ty += 18;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(GRAY_TXT[0], GRAY_TXT[1], GRAY_TXT[2]);
    doc.text('MOQ: ' + safe(p.moq) + '   |   Lead: ' + safe(p.lead_time || '—'), tx, ty);
    ty += 13;

    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.setFontSize(8.5);
    var tier = p.supplier_tier ? ('  •  Tier: ' + p.supplier_tier) : '';
    doc.text(safe(p.category).toUpperCase() + tier, tx, ty);
  }

  function drawFooter(doc, site, pageNo) {
    doc.setDrawColor(225, 232, 238);
    doc.setLineWidth(1);
    doc.line(MARGIN, PAGE_H - FOOTER_H + 8, PAGE_W - MARGIN, PAGE_H - FOOTER_H + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(safe(site.name) + '   •   ' + safe(site.url), MARGIN, PAGE_H - FOOTER_H + 20);
    doc.text('Page ' + pageNo, PAGE_W - MARGIN, PAGE_H - FOOTER_H + 20, { align: 'right' });
  }

  function drawBack(doc, cfg) {
    var site = cfg.site;
    doc.addPage();
    doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.rect(0, 0, PAGE_W, PAGE_H, 'F');

    doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.rect(MARGIN, MARGIN + 60, 60, 6, 'F');

    doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('READY TO ORDER?', MARGIN, MARGIN + 40);

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(30);
    var l = doc.splitTextToSize('Place your bulk order today', CONTENT_W);
    doc.text(l, MARGIN, MARGIN + 110);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(13);
    doc.setTextColor(210, 225, 232);
    var yy = MARGIN + 110 + l.length * 34 + 26;

    doc.text('1. Register as a buyer (free):', MARGIN, yy);
    doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(safe(site.registerUrl), MARGIN, yy + 18);
    yy += 46;

    doc.setTextColor(210, 225, 232);
    doc.setFont('helvetica', 'normal');
    doc.text('2. Request a quote / RFQ:', MARGIN, yy);
    doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(safe(site.rfqUrl), MARGIN, yy + 18);
    yy += 46;

    doc.setTextColor(210, 225, 232);
    doc.setFont('helvetica', 'normal');
    doc.text('3. Browse our full catalog:', MARGIN, yy);
    doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(safe(site.url) + '/products', MARGIN, yy + 18);

    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(safe(site.url), MARGIN, PAGE_H - MARGIN);
  }

  /* Build a branded catalog PDF. cfg = { site, category, products, cover } */
  async function buildCatalogPdf(cfg) {
    if (!available()) return null;
    cfg = cfg || {};
    var site = cfg.site || { name: 'Pilot Sales Distribution', url: '' };
    var products = (cfg.products || []).filter(function (p) { return p && p.title; });
    var category = cfg.category || { name: 'Product' };

    var doc = newDoc();

    // Preload all images (cover + products) up front.
    var coverP = cfg.cover ? loadImageDataUrl(cfg.cover) : Promise.resolve(null);
    var imgs = await Promise.all(products.map(function (p) { return loadImageDataUrl(p.image_url); }));
    var cover = await coverP;

    drawCover(doc, { site: site, category: category, cover: cover });

    // Content pages
    if (products.length) {
      doc.addPage();
      drawContentHeader(doc, category);
      var x = MARGIN, y = GRID_TOP, col = 0;
      for (var i = 0; i < products.length; i++) {
        if (y + CARD_H > PAGE_H - FOOTER_H) {
          doc.addPage();
          drawContentHeader(doc, category);
          x = MARGIN; y = GRID_TOP; col = 0;
        }
        drawCard(doc, products[i], x, y, imgs[i]);
        col++;
        if (col === COLS) { col = 0; x = MARGIN; y += CARD_H + GAP_Y; }
        else { x += CARD_W + GAP_X; }
      }
      // Footers on every content page (pages 2..last content page)
      var total = doc.internal.getNumberOfPages();
      for (var p = 2; p <= total; p++) {
        doc.setPage(p);
        drawFooter(doc, site, p - 1);
      }
    }

    drawBack(doc, { site: site });
    return doc;
  }

  function generateAndSave(cfg) {
    return buildCatalogPdf(cfg).then(function (doc) {
      if (!doc) return false;
      var id = (cfg.category && cfg.category.id) || 'catalog';
      var name = id + '-wholesale-line-sheet-' + new Date().getFullYear() + '.pdf';
      doc.save(name);
      return true;
    });
  }

  window.PSE_CATALOG_PDF = {
    available: available,
    buildCatalogPdf: buildCatalogPdf,
    generateAndSave: generateAndSave
  };
})();
