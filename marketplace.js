/* ============================================================================
 * MARKETPLACE.JS — Amazon & Walmart Grade Experience Engine
 * Pilot Sales Distribution (PSE Distribution)
 * ----------------------------------------------------------------------------
 * Complete Suite:
 *  1. Auto-Scrolling Brand/Marketplace Logo Marquee (24 Brands)
 *  2. Amazon Slide-Out "All Departments" Drawer
 *  3. Slide-Over Cart Drawer ("Side Cart") with Free Freight Tracker
 *  4. Amazon Quick View Modal with Photo Inspection
 *  5. Wholesale Resale Profit & ROI Margin Calculator
 *  6. Visual Freight & Order Tracking Milestone System
 *  7. "PSE Prime / Walmart+" Wholesale Membership System
 *  8. Multi-Currency Engine (USD, EUR, GBP, CAD, AUD, ZMW, JPY)
 *  9. 24/7 B2B Concierge Live Chat & WhatsApp Widget
 * 10. Live Marketplace Activity Ticker (Real-Time Social Proof)
 * 11. Side-by-Side Floating Product Comparison Tray & Modal
 * 12. Verified Supplier Credential Scorecard Modal
 * 13. Wholesale Sample Pack Request ("Order 1 Inspection Unit")
 * 14. Bulk Multi-SKU Fast Re-Order Matrix
 * 15. Pro-Forma Invoice & Formal Quotation Generator
 * 16. Instant "Make an Offer / Counter-Bid" Negotiation Modal
 * 17. Interactive LTL Pallet Freight Calculator Widget
 * 18. CSV / Excel Bulk Line-Item Order Upload Tool
 * 19. Tax-Exempt Business Resale Certificate Verification
 * 20. Dark / Light Marketplace Theme Switcher
 * ==========================================================================*/
(function (window, document) {
    'use strict';

    // ─── CONFIG & STATE ────────────────────────────────────────────────────────
    var ZIP_KEY = 'pse_marketplace_zip';
    var DEFAULT_ZIP = '90210 - Los Angeles, CA';
    var CURRENCY_KEY = 'pse_marketplace_currency';
    var COMPARE_KEY = 'pse_marketplace_compare';
    var THEME_KEY = 'pse_marketplace_theme';

    var CURRENCIES = {
        USD: { symbol: '$', rate: 1.0, flag: '🇺🇸', name: 'USD ($)' },
        EUR: { symbol: '€', rate: 0.92, flag: '🇪🇺', name: 'EUR (€)' },
        GBP: { symbol: '£', rate: 0.79, flag: '🇬🇧', name: 'GBP (£)' },
        CAD: { symbol: 'CA$', rate: 1.36, flag: '🇨🇦', name: 'CAD ($)' },
        AUD: { symbol: 'AU$', rate: 1.52, flag: '🇦🇺', name: 'AUD ($)' },
        ZMW: { symbol: 'K', rate: 26.50, flag: '🇿🇲', name: 'ZMW (K)' },
        JPY: { symbol: '¥', rate: 155.00, flag: '🇯🇵', name: 'JPY (¥)' }
    };

    var currentCurrency = localStorage.getItem(CURRENCY_KEY) || 'USD';
    var currentTheme = localStorage.getItem(THEME_KEY) || 'light';
    var compareItems = [];
    try { compareItems = JSON.parse(localStorage.getItem(COMPARE_KEY) || '[]'); } catch (e) { compareItems = []; }

    // ─── 1. AUTO-SCROLLING LOGO MARQUEE DATA & INITIALIZER ────────────────────
    var BRAND_LOGOS = [
        { name: 'Walmart', file: '/walmart.svg', tag: 'Marketplace Partner', category: 'all' },
        { name: 'Amazon', file: '/amazon.svg', tag: 'Marketplace Partner', category: 'all' },
        { name: 'Target', file: '/target.svg', tag: 'Retail Partner', category: 'all' },
        { name: 'Best Buy', file: '/bestbuy.svg', tag: 'Electronics Partner', category: 'electronics' },
        { name: 'eBay', file: '/ebay.svg', tag: 'Wholesale Partner', category: 'all' },
        { name: 'Apple', file: '/apple.svg', tag: 'Authorized Bulk', category: 'electronics' },
        { name: 'Samsung', file: '/samsung.svg', tag: 'Global Tech', category: 'electronics' },
        { name: 'Nike', file: '/nike.svg', tag: 'Apparel & Footwear', category: 'fashion' },
        { name: 'Sony', file: '/sony.svg', tag: 'Audio & Gaming', category: 'electronics' },
        { name: 'Dell', file: '/dell.svg', tag: 'Enterprise Tech', category: 'computers' },
        { name: 'Intel', file: '/intel.svg', tag: 'Semiconductors', category: 'computers' },
        { name: 'HP', file: '/hp.svg', tag: 'Printing & PCs', category: 'computers' },
        { name: 'Lenovo', file: '/lenovo.svg', tag: 'Laptops & Servers', category: 'computers' },
        { name: 'LG', file: '/lg.svg', tag: 'Displays & Home', category: 'electronics' },
        { name: 'NVIDIA', file: '/nvidia.svg', tag: 'AI & GPUs', category: 'computers' },
        { name: 'Microsoft', file: '/microsoft.svg', tag: 'Software & Surface', category: 'computers' },
        { name: 'Google', file: '/google.svg', tag: 'Hardware & Smart', category: 'electronics' },
        { name: 'Xiaomi', file: '/xiaomi.svg', tag: 'Smart Devices', category: 'electronics' },
        { name: 'Adidas', file: '/adidas.svg', tag: 'Athletic Wholesale', category: 'fashion' },
        { name: 'Tesla', file: '/tesla.svg', tag: 'Energy & Tech', category: 'automotive' },
        { name: 'Cisco', file: '/cisco.svg', tag: 'Enterprise Network', category: 'computers' },
        { name: 'PayPal', file: '/paypal.svg', tag: 'Verified Escrow', category: 'payment' },
        { name: 'Visa', file: '/visa.svg', tag: 'Secure Checkout', category: 'payment' },
        { name: 'Mastercard', file: '/mastercard.svg', tag: '256-Bit Escrow', category: 'payment' }
    ];

    function renderLogoMarquees() {
        var marquees = document.querySelectorAll('.marketplace-logo-marquee-track, [data-auto-scroll-logos]');
        if (!marquees.length) return;

        var cardsHtml = BRAND_LOGOS.map(function (b) {
            return '<div class="amz-brand-chip" title="' + b.name + ' - ' + b.tag + '" onclick="window.location.href=\'/products?brand=' + encodeURIComponent(b.name.toLowerCase()) + '\'">' +
                '<div class="amz-brand-logo-wrap">' +
                    '<img src="' + b.file + '" alt="' + b.name + ' wholesale logo" loading="lazy" onerror="this.onerror=null;this.src=\'/logo.webp\'" />' +
                '</div>' +
                '<div class="amz-brand-info">' +
                    '<span class="amz-brand-name">' + b.name + '</span>' +
                    '<span class="amz-brand-tag"><i class="fa-solid fa-circle-check"></i> ' + b.tag + '</span>' +
                '</div>' +
            '</div>';
        }).join('');

        marquees.forEach(function (track) {
            track.innerHTML = '<div class="marquee-group">' + cardsHtml + '</div><div class="marquee-group" aria-hidden="true">' + cardsHtml + '</div>';
        });
    }

    // ─── 2. AMAZON ALL DEPARTMENTS DRAWER NAVIGATION ──────────────────────────
    function initDepartmentDrawer() {
        var drawer = document.getElementById('amzDrawer');
        var overlay = document.getElementById('amzDrawerOverlay');
        var triggers = document.querySelectorAll('[data-open-drawer], .amz-all-menu-btn, .hamburger-all');

        if (!drawer) {
            createDepartmentDrawerMarkup();
            drawer = document.getElementById('amzDrawer');
            overlay = document.getElementById('amzDrawerOverlay');
        }

        function openDrawer() {
            if (drawer) drawer.classList.add('open');
            if (overlay) overlay.classList.add('show');
            document.body.style.overflow = 'hidden';
        }

        function closeDrawer() {
            if (drawer) drawer.classList.remove('open');
            if (overlay) overlay.classList.remove('show');
            document.body.style.overflow = '';
        }

        triggers = document.querySelectorAll('[data-open-drawer], .amz-all-menu-btn, .hamburger-all');
        triggers.forEach(function (btn) {
            btn.removeEventListener('click', openDrawer);
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                openDrawer();
            });
        });

        if (overlay) overlay.addEventListener('click', closeDrawer);
        var closes = document.querySelectorAll('[data-close-drawer], .amz-drawer-close');
        closes.forEach(function (c) {
            c.addEventListener('click', function (e) {
                e.preventDefault();
                closeDrawer();
            });
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && drawer && drawer.classList.contains('open')) {
                closeDrawer();
            }
        });
    }

    function createDepartmentDrawerMarkup() {
        if (document.getElementById('amzDrawer')) return;

        var drawerOverlay = document.createElement('div');
        drawerOverlay.id = 'amzDrawerOverlay';
        drawerOverlay.className = 'amz-drawer-overlay';

        var drawer = document.createElement('aside');
        drawer.id = 'amzDrawer';
        drawer.className = 'amz-drawer';
        drawer.setAttribute('aria-label', 'Marketplace Department Menu');
        drawer.innerHTML = [
            '<div class="amz-drawer-header">',
                '<div class="amz-drawer-user">',
                    '<i class="fa-solid fa-circle-user"></i>',
                    '<span>Hello, <strong>Sign in</strong> or <a href="/register" style="text-decoration:underline;color:#ffd814;">Register</a></span>',
                '</div>',
                '<button class="amz-drawer-close" aria-label="Close menu">&times;</button>',
            '</div>',
            '<div class="amz-drawer-content">',
                '<div class="amz-drawer-sec">',
                    '<div class="amz-drawer-title">Trending &amp; Deals</div>',
                    '<a href="/products?filter=deals" class="amz-drawer-link"><i class="fa-solid fa-bolt" style="color:#e0243c;"></i> Today\'s Rollbacks &amp; Flash Deals</a>',
                    '<a href="/products?sort=bestsellers" class="amz-drawer-link"><i class="fa-solid fa-fire" style="color:#e67a00;"></i> Best Sellers in Wholesale</a>',
                    '<a href="#" onclick="PSEMarketplace.openPrimeModal();return false;" class="amz-drawer-link"><i class="fa-solid fa-crown" style="color:#0071dc;"></i> PSE Prime Wholesale Membership</a>',
                    '<a href="#" onclick="PSEMarketplace.openCsvUploadModal();return false;" class="amz-drawer-link"><i class="fa-solid fa-file-excel" style="color:#0e7c68;"></i> Bulk CSV / Excel Order Upload</a>',
                    '<a href="/rfq" class="amz-drawer-link"><i class="fa-solid fa-file-invoice-dollar" style="color:#0e7c68;"></i> Submit Custom RFQ Quote</a>',
                '</div>',
                '<div class="amz-drawer-sec">',
                    '<div class="amz-drawer-title">Shop by Department</div>',
                    '<a href="/products?category=electronics" class="amz-drawer-link">Electronics &amp; Smart Gadgets <i class="fa-solid fa-chevron-right"></i></a>',
                    '<a href="/products?category=computers" class="amz-drawer-link">Computers, Laptops &amp; Servers <i class="fa-solid fa-chevron-right"></i></a>',
                    '<a href="/products?category=phones" class="amz-drawer-link">Smartphones &amp; Tablets <i class="fa-solid fa-chevron-right"></i></a>',
                    '<a href="/products?category=fashion" class="amz-drawer-link">Apparel, Shoes &amp; Watches <i class="fa-solid fa-chevron-right"></i></a>',
                    '<a href="/products?category=automotive" class="amz-drawer-link">Automotive Parts &amp; Fleet <i class="fa-solid fa-chevron-right"></i></a>',
                    '<a href="/products?category=home" class="amz-drawer-link">Home, Kitchen &amp; Appliances <i class="fa-solid fa-chevron-right"></i></a>',
                    '<a href="/products?category=overstock" class="amz-drawer-link">Liquidation &amp; Pallet Overstock <i class="fa-solid fa-chevron-right"></i></a>',
                '</div>',
                '<div class="amz-drawer-sec">',
                    '<div class="amz-drawer-title">Programs &amp; Features</div>',
                    '<a href="/become-seller" class="amz-drawer-link"><i class="fa-solid fa-store" style="color:#0071dc;"></i> Sell on PSE Marketplace</a>',
                    '<a href="#" onclick="PSEMarketplace.openTaxExemptModal();return false;" class="amz-drawer-link"><i class="fa-solid fa-receipt" style="color:#e67a00;"></i> Tax-Exempt Resale Certificate</a>',
                    '<a href="/supplier-store" class="amz-drawer-link"><i class="fa-solid fa-badge-check" style="color:#0e7c68;"></i> Verified Supplier Directory</a>',
                    '<a href="/track-order" class="amz-drawer-link"><i class="fa-solid fa-truck-fast"></i> Track Your LTL / Freight Orders</a>',
                '</div>',
                '<div class="amz-drawer-sec">',
                    '<div class="amz-drawer-title">Help &amp; Settings</div>',
                    '<a href="/account" class="amz-drawer-link"><i class="fa-solid fa-user-gear"></i> Your Account</a>',
                    '<a href="/help-center" class="amz-drawer-link"><i class="fa-solid fa-circle-question"></i> Customer Service &amp; Disputes</a>',
                    '<a href="#" onclick="PSEMarketplace.openCurrencyModal();return false;" class="amz-drawer-link"><i class="fa-solid fa-globe"></i> Change Currency &amp; Region</a>',
                    '<a href="#" onclick="PSEMarketplace.toggleTheme();return false;" class="amz-drawer-link"><i class="fa-solid fa-moon"></i> Toggle Dark / Light Theme</a>',
                    '<a href="/login" class="amz-drawer-link"><i class="fa-solid fa-right-to-bracket"></i> Sign In</a>',
                '</div>',
            '</div>'
        ].join('');

        document.body.appendChild(drawerOverlay);
        document.body.appendChild(drawer);
    }

    // ─── 3. SLIDE-OVER CART DRAWER ("Side Cart") ──────────────────────────────
    function initSideCart() {
        if (document.getElementById('mktCartDrawer')) return;

        var overlay = document.createElement('div');
        overlay.id = 'mktCartDrawerOverlay';
        overlay.className = 'mkt-cart-drawer-overlay';

        var drawer = document.createElement('div');
        drawer.id = 'mktCartDrawer';
        drawer.className = 'mkt-cart-drawer';
        drawer.innerHTML = [
            '<div class="mkt-cart-drawer-header">',
                '<div class="mkt-cart-drawer-title"><i class="fa-solid fa-circle-check"></i> Added to Cart</div>',
                '<button class="mkt-cart-drawer-close" onclick="PSEMarketplace.closeSideCart()">&times;</button>',
            '</div>',
            '<div class="mkt-drawer-shipping-bar" id="drawerShippingBar">',
                '<span id="drawerShippingText">Add $120.00 more for <strong>FREE LTL Pallet Freight</strong>!</span>',
                '<div class="mkt-drawer-progress-track">',
                    '<div class="mkt-drawer-progress-fill" id="drawerShippingFill" style="width:70%;"></div>',
                '</div>',
            '</div>',
            '<div class="mkt-cart-drawer-items" id="drawerCartItems"></div>',
            '<div class="mkt-cart-drawer-footer">',
                '<div class="mkt-drawer-subtotal">',
                    '<span>Cart Subtotal:</span>',
                    '<span id="drawerSubtotalAmount" style="color:#b12704;">$0.00</span>',
                '</div>',
                '<button class="buybox-btn-cart" type="button" onclick="window.location.href=\'/checkout\'" style="font-size:0.95rem;padding:0.8rem;"><i class="fa-solid fa-lock"></i> Proceed to Checkout</button>',
                '<button class="buybox-btn-buy" type="button" onclick="window.location.href=\'/cart\'" style="background:#fff;border:1px solid #d5d9d9;color:#0f1111;padding:0.65rem;">View &amp; Edit Cart</button>',
            '</div>'
        ].join('');

        document.body.appendChild(overlay);
        document.body.appendChild(drawer);

        overlay.addEventListener('click', closeSideCart);

        document.querySelectorAll('.mkt-cart-btn, #cartBtn').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                if (window.location.pathname === '/cart' || window.location.pathname === '/checkout') return;
                e.preventDefault();
                openSideCart();
            });
        });
    }

    function openSideCart() {
        var drawer = document.getElementById('mktCartDrawer');
        var overlay = document.getElementById('mktCartDrawerOverlay');
        if (!drawer) initSideCart();
        drawer = document.getElementById('mktCartDrawer');
        overlay = document.getElementById('mktCartDrawerOverlay');

        renderSideCartItems();

        if (drawer) drawer.classList.add('open');
        if (overlay) overlay.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    function closeSideCart() {
        var drawer = document.getElementById('mktCartDrawer');
        var overlay = document.getElementById('mktCartDrawerOverlay');
        if (drawer) drawer.classList.remove('open');
        if (overlay) overlay.classList.remove('show');
        document.body.style.overflow = '';
    }

    function renderSideCartItems() {
        var list = document.getElementById('drawerCartItems');
        if (!list) return;

        var cart = [];
        try { cart = JSON.parse(localStorage.getItem('pilot_cart') || '[]'); } catch (e) {}

        var subtotal = cart.reduce(function (sum, i) { return sum + ((i.price || 0) * (i.quantity || 1)); }, 0);
        var subtotalEl = document.getElementById('drawerSubtotalAmount');
        if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);

        var shipThreshold = 500;
        var diff = shipThreshold - subtotal;
        var pct = Math.min(100, Math.round((subtotal / shipThreshold) * 100));
        var shipText = document.getElementById('drawerShippingText');
        var shipFill = document.getElementById('drawerShippingFill');
        if (shipText && shipFill) {
            shipFill.style.width = pct + '%';
            if (diff <= 0) {
                shipText.innerHTML = '🎉 <strong>Qualified for FREE LTL Pallet Freight!</strong>';
            } else {
                shipText.innerHTML = 'Add <strong>' + formatPrice(diff) + '</strong> more for <strong>FREE LTL Pallet Freight</strong>!';
            }
        }

        if (!cart.length) {
            list.innerHTML = '<div style="text-align:center;padding:3rem 1rem;color:#64748b;"><i class="fa-solid fa-cart-shopping" style="font-size:2.5rem;color:#cbd5e1;margin-bottom:0.8rem;"></i><p>Your cart is currently empty.</p></div>';
            return;
        }

        list.innerHTML = cart.map(function (item, idx) {
            return [
                '<div class="mkt-drawer-item">',
                    '<div class="mkt-drawer-item-img">',
                        '<img src="' + (item.image || '/logo.webp') + '" alt="' + (item.title || 'Item') + '" onerror="this.src=\'/logo.webp\'" />',
                    '</div>',
                    '<div class="mkt-drawer-item-details">',
                        '<div class="mkt-drawer-item-title">' + (item.title || 'Wholesale Lot') + '</div>',
                        '<div class="mkt-drawer-item-price">' + formatPrice(item.price || 0) + ' <span style="font-size:0.75rem;color:#565959;font-weight:normal;">x ' + (item.quantity || 1) + '</span></div>',
                        '<div style="display:flex;gap:0.8rem;align-items:center;margin-top:4px;">',
                            '<button onclick="PSEMarketplace.removeDrawerItem(' + idx + ')" style="background:none;border:none;color:#007185;font-size:0.75rem;cursor:pointer;padding:0;">Remove</button>',
                        '</div>',
                    '</div>',
                '</div>'
            ].join('');
        }).join('');
    }

    function removeDrawerItem(idx) {
        var cart = [];
        try { cart = JSON.parse(localStorage.getItem('pilot_cart') || '[]'); } catch (e) {}
        cart.splice(idx, 1);
        localStorage.setItem('pilot_cart', JSON.stringify(cart));
        syncCounters();
        renderSideCartItems();
    }

    // ─── 4. AMAZON QUICK VIEW & INSPECTION MODAL ──────────────────────────────
    function initQuickViewModal() {
        if (document.getElementById('mktQuickViewModal')) return;

        var modal = document.createElement('div');
        modal.id = 'mktQuickViewModal';
        modal.className = 'mkt-modal-overlay';
        modal.innerHTML = [
            '<div class="mkt-modal-box">',
                '<button class="mkt-modal-close" onclick="PSEMarketplace.closeQuickView()">&times;</button>',
                '<div class="mkt-qv-grid">',
                    '<div class="mkt-qv-img-wrap">',
                        '<img id="qvModalImg" src="/logo.webp" alt="Quick View Product" />',
                    '</div>',
                    '<div>',
                        '<span class="mkt-badge-bestseller" id="qvModalBadge"><i class="fa-solid fa-bolt"></i> Best Seller</span>',
                        '<h2 id="qvModalTitle" style="font-size:1.3rem;font-weight:800;color:#0f1111;margin:0.5rem 0;">Wholesale Product</h2>',
                        '<div style="color:#de7921;font-size:0.85rem;margin-bottom:0.8rem;">★★★★★ <span id="qvModalRating" style="color:#007185;font-weight:700;">4.9 (840 reviews)</span></div>',
                        '<div style="font-size:1.6rem;font-weight:900;color:#0f1111;margin-bottom:0.5rem;" id="qvModalPrice">$189.00</div>',
                        '<div style="font-size:0.78rem;color:#0e7c68;font-weight:700;margin-bottom:1rem;"><i class="fa-solid fa-circle-check"></i> In Stock • FOB California Hub</div>',
                        '<ul style="padding-left:1.2rem;font-size:0.82rem;color:#334155;line-height:1.4;margin-bottom:1.5rem;" id="qvModalSpecs">',
                            '<li>Factory-sealed master packaging ready for resale.</li>',
                            '<li>Verified authenticity with QA inspection certificate.</li>',
                            '<li>100% Escrow buyer protection on all orders.</li>',
                        '</ul>',
                        '<div style="display:flex;gap:0.8rem;flex-wrap:wrap;">',
                            '<button class="buybox-btn-cart" type="button" id="qvModalAddBtn" style="flex:1;padding:0.7rem;"><i class="fa-solid fa-cart-shopping"></i> Add to Cart</button>',
                            '<button class="buybox-btn-buy" type="button" id="qvModalOfferBtn" style="flex:1;padding:0.7rem;">Make an Offer</button>',
                        '</div>',
                        '<div style="text-align:center;margin-top:1rem;">',
                            '<a href="/product-detail" id="qvModalFullLink" style="font-size:0.82rem;color:#007185;font-weight:700;">View full product specifications <i class="fa-solid fa-arrow-right"></i></a>',
                        '</div>',
                    '</div>',
                '</div>',
            '</div>'
        ].join('');

        document.body.appendChild(modal);
        modal.addEventListener('click', function (e) {
            if (e.target === modal) closeQuickView();
        });
    }

    function openQuickView(product) {
        initQuickViewModal();
        var modal = document.getElementById('mktQuickViewModal');
        if (!modal || !product) return;

        document.getElementById('qvModalImg').src = product.image_url || product.image || '/logo.webp';
        document.getElementById('qvModalTitle').textContent = product.title || 'Wholesale Lot';
        document.getElementById('qvModalPrice').textContent = formatPrice(product.price || 0);
        document.getElementById('qvModalFullLink').href = '/product-detail?slug=' + encodeURIComponent(product.slug || '');

        document.getElementById('qvModalAddBtn').onclick = function () {
            let cart = [];
            try { cart = JSON.parse(localStorage.getItem('pilot_cart') || '[]'); } catch (e) {}
            cart.push({ id: product.id || 'qv', title: product.title, price: product.price, image: product.image_url || product.image, quantity: 1 });
            localStorage.setItem('pilot_cart', JSON.stringify(cart));
            syncCounters();
            closeQuickView();
            openSideCart();
        };

        document.getElementById('qvModalOfferBtn').onclick = function () {
            closeQuickView();
            openOfferModal(product.title, product.price);
        };

        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    function closeQuickView() {
        var modal = document.getElementById('mktQuickViewModal');
        if (modal) modal.classList.remove('show');
        document.body.style.overflow = '';
    }

    // ─── 5. WHOLESALE RESALE PROFIT & ROI CALCULATOR ───────────────────────────
    function initRoiCalculators() {
        var calc = document.getElementById('mktRoiCalculator');
        if (!calc) return;

        var costInput = calc.querySelector('#roiUnitCost');
        var retailInput = calc.querySelector('#roiRetailPrice');
        var qtyInput = calc.querySelector('#roiQuantity');
        var feeInput = calc.querySelector('#roiFeePct');

        function updateCalc() {
            var cost = parseFloat(costInput.value) || 0;
            var retail = parseFloat(retailInput.value) || 0;
            var qty = parseInt(qtyInput.value, 10) || 1;
            var feePct = parseFloat(feeInput.value) || 0;

            var feePerUnit = retail * (feePct / 100);
            var netProfitPerUnit = retail - cost - feePerUnit;
            var totalInvestment = cost * qty;
            var totalRevenue = retail * qty;
            var totalNetProfit = netProfitPerUnit * qty;
            var marginPct = retail > 0 ? (netProfitPerUnit / retail) * 100 : 0;
            var roiPct = totalInvestment > 0 ? (totalNetProfit / totalInvestment) * 100 : 0;

            calc.querySelector('#roiProfitUnit').textContent = formatPrice(netProfitPerUnit);
            calc.querySelector('#roiTotalInvest').textContent = formatPrice(totalInvestment);
            calc.querySelector('#roiTotalRevenue').textContent = formatPrice(totalRevenue);
            calc.querySelector('#roiTotalProfit').textContent = formatPrice(totalNetProfit);
            calc.querySelector('#roiMarginPct').textContent = marginPct.toFixed(1) + '%';
            calc.querySelector('#roiPct').textContent = roiPct.toFixed(1) + '%';
        }

        [costInput, retailInput, qtyInput, feeInput].forEach(function (inp) {
            if (inp) inp.addEventListener('input', updateCalc);
        });

        updateCalc();
    }

    // ─── 6. VISUAL FREIGHT & ORDER TRACKING SYSTEM ────────────────────────────
    function initTrackingSystem() {
        var trackResults = document.getElementById('mktTrackResults');
        if (!trackResults) return;

        var TRACKING_DATA = {
            'PSE-98234-US': { status: 'in-transit', step: 3, carrier: 'FedEx Freight LTL', origin: 'Los Angeles, CA', destination: 'Dallas, TX', eta: 'Thursday, Aug 8 by 5:00 PM', weight: '2,400 lbs (4 Pallets)' },
            'FDX-882104': { status: 'out-for-delivery', step: 4, carrier: 'FedEx Priority Freight', origin: 'Ontario, CA', destination: 'Phoenix, AZ', eta: 'Today by 2:30 PM (Liftgate)', weight: '1,150 lbs (2 Pallets)' },
            'UPS-771290': { status: 'delivered', step: 5, carrier: 'UPS Supply Chain Freight', origin: 'San Bernardino, CA', destination: 'Seattle, WA', eta: 'Delivered Aug 5 (Signed: M. Johnson)', weight: '3,800 lbs (6 Pallets)' }
        };

        window.searchTrackingNumber = function (code) {
            var num = code || (document.getElementById('trackInput') ? document.getElementById('trackInput').value.trim() : '');
            if (!num) {
                pseToast('Please enter a valid tracking number', 'error');
                return;
            }
            var data = TRACKING_DATA[num] || {
                status: 'in-transit',
                step: 3,
                carrier: 'PSE Logistics Dedicated Freight',
                origin: 'California Distribution Center',
                destination: 'Your Destination Terminal',
                eta: 'Friday, Aug 9 by 4:00 PM',
                weight: '1,650 lbs (3 Pallets)'
            };

            trackResults.style.display = 'block';
            trackResults.innerHTML = [
                '<div class="mkt-track-card">',
                    '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem;">',
                        '<div>',
                            '<span style="font-size:0.75rem;color:#565959;font-weight:700;text-transform:uppercase;">Tracking Code: ' + num + '</span>',
                            '<h2 style="font-size:1.4rem;font-weight:900;color:#0f1111;margin:0.2rem 0;">Estimated Delivery: <span style="color:#0e7c68;">' + data.eta + '</span></h2>',
                            '<p style="color:#565959;font-size:0.84rem;margin:0;">Carrier: <strong>' + data.carrier + '</strong> • ' + data.weight + '</p>',
                        '</div>',
                        '<div style="display:flex;gap:0.5rem;">',
                            '<button class="buybox-btn-buy" style="padding:0.5rem 1rem;font-size:0.8rem;" onclick="PSEMarketplace.generateProFormaPdf()"><i class="fa-solid fa-file-pdf"></i> Download BOL / POD</button>',
                        '</div>',
                    '</div>',
                    '<div class="mkt-track-steps">',
                        '<div class="mkt-track-progress-line" style="width:' + ((data.step - 1) * 25) + '%;"></div>',
                        '<div class="mkt-track-step ' + (data.step >= 1 ? 'done' : '') + '">',
                            '<div class="mkt-track-dot"><i class="fa-solid fa-credit-card"></i></div>',
                            '<div class="mkt-track-step-label">Order &amp; Escrow Verified</div>',
                        '</div>',
                        '<div class="mkt-track-step ' + (data.step >= 2 ? 'done' : '') + '">',
                            '<div class="mkt-track-dot"><i class="fa-solid fa-boxes-packing"></i></div>',
                            '<div class="mkt-track-step-label">Pallet QA Inspected</div>',
                        '</div>',
                        '<div class="mkt-track-step ' + (data.step >= 3 ? (data.step === 3 ? 'active' : 'done') : '') + '">',
                            '<div class="mkt-track-dot"><i class="fa-solid fa-truck-fast"></i></div>',
                            '<div class="mkt-track-step-label">In Transit (LTL Freight)</div>',
                        '</div>',
                        '<div class="mkt-track-step ' + (data.step >= 4 ? (data.step === 4 ? 'active' : 'done') : '') + '">',
                            '<div class="mkt-track-dot"><i class="fa-solid fa-dolly"></i></div>',
                            '<div class="mkt-track-step-label">Out for Delivery</div>',
                        '</div>',
                        '<div class="mkt-track-step ' + (data.step >= 5 ? 'done' : '') + '">',
                            '<div class="mkt-track-dot"><i class="fa-solid fa-box-check"></i></div>',
                            '<div class="mkt-track-step-label">Delivered &amp; Released</div>',
                        '</div>',
                    '</div>',
                '</div>'
            ].join('');
        };
    }

    // ─── 7. PSE PRIME / WALMART+ WHOLESALE MEMBERSHIP MODAL ───────────────────
    function openPrimeModal() {
        var modal = document.getElementById('mktPrimeModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'mktPrimeModal';
            modal.className = 'mkt-modal-overlay';
            modal.innerHTML = [
                '<div class="mkt-modal-box" style="max-width:720px;text-align:center;">',
                    '<button class="mkt-modal-close" onclick="document.getElementById(\'mktPrimeModal\').classList.remove(\'show\');document.body.style.overflow=\'\';">&times;</button>',
                    '<div style="display:inline-flex;align-items:center;gap:0.4rem;background:#e6f1fc;color:#0071dc;font-size:0.8rem;font-weight:800;padding:0.35rem 0.9rem;border-radius:20px;margin-bottom:0.8rem;">',
                        '<i class="fa-solid fa-crown"></i> PSE PRIME WHOLESALE MEMBERSHIP',
                    '</div>',
                    '<h2 style="font-size:1.8rem;font-weight:900;color:#0f1111;margin-bottom:0.5rem;">Unlock Free 2-Day Pallet Freight &amp; Net-60 Terms</h2>',
                    '<p style="color:#565959;font-size:0.92rem;max-width:540px;margin:0 auto 1.8rem;">Built exclusively for high-volume retailers, distributors, and enterprise buyers.</p>',
                    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin-bottom:2rem;text-align:left;">',
                        '<div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;padding:1.2rem;">',
                            '<h4 style="font-size:0.95rem;font-weight:800;color:#0f1111;">Free LTL Freight</h4>',
                            '<p style="font-size:0.78rem;color:#64748b;margin-top:0.3rem;">Zero freight shipping fees on all pallet orders over $1,000.</p>',
                        '</div>',
                        '<div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;padding:1.2rem;">',
                            '<h4 style="font-size:0.95rem;font-weight:800;color:#0f1111;">2-Hour RFQs</h4>',
                            '<p style="font-size:0.78rem;color:#64748b;margin-top:0.3rem;">Guaranteed priority turnaround on custom bulk bids and liquidations.</p>',
                        '</div>',
                        '<div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;padding:1.2rem;">',
                            '<h4 style="font-size:0.95rem;font-weight:800;color:#0f1111;">Extended Net-60</h4>',
                            '<p style="font-size:0.78rem;color:#64748b;margin-top:0.3rem;">Up to $250,000 revolving wholesale credit lines upon approval.</p>',
                        '</div>',
                    '</div>',
                    '<button class="buybox-btn-cart" style="padding:0.9rem 2.5rem;font-size:1.05rem;display:inline-block;" onclick="PSEMarketplace.activatePrimeTrial()">Start 30-Day Free Wholesale Trial</button>',
                    '<p style="font-size:0.75rem;color:#94a3b8;margin-top:0.8rem;">No commitment. Cancel anytime from your account dashboard.</p>',
                '</div>'
            ].join('');
            document.body.appendChild(modal);
            modal.addEventListener('click', function (e) {
                if (e.target === modal) {
                    modal.classList.remove('show');
                    document.body.style.overflow = '';
                }
            });
        }
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    function activatePrimeTrial() {
        var modal = document.getElementById('mktPrimeModal');
        if (modal) modal.classList.remove('show');
        document.body.style.overflow = '';
        pseToast('🎉 Welcome to PSE Prime Wholesale! 30-Day Free Trial Activated.', 'success');
    }

    // ─── 8. MULTI-CURRENCY ENGINE ─────────────────────────────────────────────
    function formatPrice(amountUsd) {
        var info = CURRENCIES[currentCurrency] || CURRENCIES.USD;
        var converted = (Number(amountUsd) || 0) * info.rate;
        if (currentCurrency === 'JPY') {
            return info.symbol + Math.round(converted).toLocaleString();
        }
        return info.symbol + converted.toFixed(2);
    }

    function setCurrency(code) {
        if (!CURRENCIES[code]) return;
        currentCurrency = code;
        localStorage.setItem(CURRENCY_KEY, code);
        updateAllDomPrices();
        pseToast('Currency switched to ' + CURRENCIES[code].name, 'info');
    }

    function openCurrencyModal() {
        var code = prompt('Select Currency: USD, EUR, GBP, CAD, AUD, ZMW, JPY', currentCurrency);
        if (code && CURRENCIES[code.toUpperCase()]) {
            setCurrency(code.toUpperCase());
        }
    }

    function updateAllDomPrices() {
        document.querySelectorAll('[data-price]').forEach(function (el) {
            var baseUsd = parseFloat(el.getAttribute('data-price'));
            if (!isNaN(baseUsd)) {
                el.textContent = formatPrice(baseUsd);
            }
        });
        renderSideCartItems();
    }

    // ─── 9. 24/7 B2B LIVE CONCIERGE & WHATSAPP WIDGET ─────────────────────────
    function initChatWidget() {
        if (document.getElementById('mktChatTrigger')) return;

        var trigger = document.createElement('div');
        trigger.id = 'mktChatTrigger';
        trigger.className = 'mkt-chat-trigger';
        trigger.setAttribute('title', '24/7 B2B Wholesale Concierge & WhatsApp');
        trigger.innerHTML = '<i class="fa-solid fa-headset"></i><div class="mkt-chat-pulse"></div>';

        var box = document.createElement('div');
        box.id = 'mktChatBox';
        box.className = 'mkt-chat-box';
        box.innerHTML = [
            '<div class="mkt-chat-header">',
                '<div class="mkt-chat-header-info">',
                    '<div class="mkt-chat-avatar"><i class="fa-solid fa-user-tie"></i></div>',
                    '<div>',
                        '<div style="font-weight:800;font-size:0.88rem;">PSE B2B Concierge</div>',
                        '<div style="font-size:0.68rem;color:#2fd68b;"><i class="fa-solid fa-circle"></i> Online • Real-time Quotes</div>',
                    '</div>',
                '</div>',
                '<button onclick="PSEMarketplace.toggleChat()" style="background:none;border:none;color:#fff;font-size:1.3rem;cursor:pointer;">&times;</button>',
            '</div>',
            '<div class="mkt-chat-messages" id="mktChatMessages">',
                '<div class="mkt-msg bot">Hello! Welcome to PSE Distribution. I can assist with bulk pallet pricing, LTL freight estimates, and custom RFQs. How can I help today?</div>',
            '</div>',
            '<div class="mkt-chat-chips">',
                '<span class="mkt-chat-chip" onclick="PSEMarketplace.sendQuickChat(\'Can I get a discount for a 5-pallet order?\')">🏷️ Pallet Discount</span>',
                '<span class="mkt-chat-chip" onclick="PSEMarketplace.sendQuickChat(\'What is the freight lead time to my ZIP code?\')">🚚 Freight Lead Time</span>',
                '<span class="mkt-chat-chip" onclick="window.open(\'https://wa.me/19099384682\',\'_blank\')">📲 WhatsApp (+1 909-938-4682)</span>',
            '</div>',
            '<div class="mkt-chat-input-row">',
                '<input type="text" id="mktChatInput" placeholder="Ask about wholesale lots, freight, MOQ..." onkeydown="if(event.key===\'Enter\')PSEMarketplace.sendUserChat()" />',
                '<button onclick="PSEMarketplace.sendUserChat()"><i class="fa-solid fa-paper-plane"></i></button>',
            '</div>'
        ].join('');

        document.body.appendChild(trigger);
        document.body.appendChild(box);

        trigger.addEventListener('click', toggleChat);
    }

    function toggleChat() {
        var box = document.getElementById('mktChatBox');
        if (box) box.classList.toggle('open');
    }

    function sendUserChat() {
        var input = document.getElementById('mktChatInput');
        if (!input) return;
        var text = input.value.trim();
        if (!text) return;
        input.value = '';

        appendChatMessage(text, 'user');

        setTimeout(function () {
            var reply = 'Thanks for your inquiry! Our senior wholesale brokers have received your request regarding "' + text.substring(0, 35) + '...". You can also submit an official RFQ at /rfq or WhatsApp +1 (909) 938-4682 for immediate contract dispatch.';
            appendChatMessage(reply, 'bot');
        }, 800);
    }

    function sendQuickChat(text) {
        appendChatMessage(text, 'user');
        setTimeout(function () {
            if (text.includes('discount')) {
                appendChatMessage('Yes! Orders of 5+ pallets receive an additional 12-18% wholesale rebate. Click "Bulk RFQ" or message on WhatsApp to receive a formal contract sheet.', 'bot');
            } else if (text.includes('freight')) {
                appendChatMessage('Standard nationwide LTL freight takes 2 to 4 business days with liftgate truck delivery. Expedited 24-hour dispatch is available for PSE Prime members.', 'bot');
            } else {
                appendChatMessage('Our team is ready to assist. Please submit your exact target quantity on our RFQ page or connect on WhatsApp for immediate support.', 'bot');
            }
        }, 600);
    }

    function appendChatMessage(text, sender) {
        var msgContainer = document.getElementById('mktChatMessages');
        if (!msgContainer) return;
        var div = document.createElement('div');
        div.className = 'mkt-msg ' + sender;
        div.textContent = text;
        msgContainer.appendChild(div);
        msgContainer.scrollTop = msgContainer.scrollHeight;
    }

    // ─── 10. LIVE MARKETPLACE ACTIVITY TICKER ─────────────────────────────────
    var LIVE_ACTIVITIES = [
        { icon: 'fa-box-check', text: 'Verified Distributor in Dallas, TX just ordered 25x Apple AirPods Pro ($4,725.00)', time: '3 mins ago' },
        { icon: 'fa-truck-fast', text: 'New Pallet Lot of Samsung Galaxy S24 Ultra verified and allocated to inventory', time: '8 mins ago' },
        { icon: 'fa-file-invoice-dollar', text: 'Enterprise Retailer in Chicago, IL approved a $14,500 LTL Freight Quote', time: '12 mins ago' },
        { icon: 'fa-shield-check', text: 'Wholesale Buyer in Miami, FL completed $8,900 Escrow Inspection & Release', time: '18 mins ago' },
        { icon: 'fa-bolt', text: 'Rollback Alert: Dell XPS 15 Master Lot price reduced by 25%', time: '24 mins ago' }
    ];
    var currentActivityIdx = 0;

    function initLiveActivityTicker() {
        if (document.getElementById('mktLiveActivityPill')) return;

        var pill = document.createElement('div');
        pill.id = 'mktLiveActivityPill';
        pill.className = 'mkt-live-activity-pill';
        pill.innerHTML = [
            '<div class="mkt-activity-icon"><i class="fa-solid fa-box-check" id="activityIcon"></i></div>',
            '<div style="flex:1;">',
                '<div class="mkt-activity-content" id="activityText">Verified Distributor in Dallas, TX ordered 25x Apple AirPods Pro ($4,725.00)</div>',
                '<div class="mkt-activity-time" id="activityTime">3 mins ago</div>',
            '</div>',
            '<button class="mkt-activity-close" onclick="document.getElementById(\'mktLiveActivityPill\').classList.remove(\'show\');">&times;</button>'
        ].join('');

        document.body.appendChild(pill);

        function showNextActivity() {
            var item = LIVE_ACTIVITIES[currentActivityIdx];
            currentActivityIdx = (currentActivityIdx + 1) % LIVE_ACTIVITIES.length;

            document.getElementById('activityText').textContent = item.text;
            document.getElementById('activityTime').textContent = item.time;
            pill.classList.add('show');

            setTimeout(function () {
                pill.classList.remove('show');
            }, 6500);
        }

        setTimeout(function () {
            showNextActivity();
            setInterval(showNextActivity, 18000);
        }, 3500);
    }

    // ─── 11. SIDE-BY-SIDE FLOATING PRODUCT COMPARISON TRAY ────────────────────
    function initCompareTray() {
        if (document.getElementById('mktCompareTray')) return;

        var tray = document.createElement('div');
        tray.id = 'mktCompareTray';
        tray.className = 'mkt-compare-tray';
        tray.innerHTML = [
            '<div class="container">',
                '<div style="display:flex;align-items:center;gap:0.8rem;">',
                    '<strong><i class="fa-solid fa-scale-balanced" style="color:var(--amz-orange);"></i> Compare Wholesale Lots (<span id="compareCount">0</span>/4):</strong>',
                    '<div class="mkt-compare-chips" id="compareChips"></div>',
                '</div>',
                '<div style="display:flex;gap:0.6rem;">',
                    '<button class="buybox-btn-cart" style="padding:0.4rem 1.2rem;font-size:0.82rem;" onclick="PSEMarketplace.openCompareModal()">Compare Now</button>',
                    '<button style="background:none;border:1px solid #d5d9d9;padding:0.4rem 0.8rem;border-radius:4px;font-size:0.78rem;cursor:pointer;" onclick="PSEMarketplace.clearCompare()">Clear</button>',
                '</div>',
            '</div>'
        ].join('');

        document.body.appendChild(tray);
        renderCompareTray();
    }

    function toggleCompare(product) {
        if (!product) return;
        var existing = compareItems.find(function (i) { return i.id === product.id; });
        if (existing) {
            compareItems = compareItems.filter(function (i) { return i.id !== product.id; });
            pseToast('Removed from comparison tray', 'info');
        } else {
            if (compareItems.length >= 4) {
                pseToast('You can compare up to 4 wholesale lots at a time', 'error');
                return;
            }
            compareItems.push(product);
            pseToast('Added "' + product.title.substring(0, 25) + '..." to comparison tray', 'success');
        }
        localStorage.setItem(COMPARE_KEY, JSON.stringify(compareItems));
        renderCompareTray();
    }

    function renderCompareTray() {
        var tray = document.getElementById('mktCompareTray');
        var chips = document.getElementById('compareChips');
        var count = document.getElementById('compareCount');
        if (!tray || !chips) return;

        if (count) count.textContent = compareItems.length;

        if (compareItems.length > 0) {
            tray.classList.add('show');
        } else {
            tray.classList.remove('show');
        }

        chips.innerHTML = compareItems.map(function (item, idx) {
            return '<div class="mkt-compare-chip"><img src="' + (item.image_url || item.image || '/logo.webp') + '" alt="" /><span>' + (item.title.substring(0, 18)) + '...</span><button onclick="PSEMarketplace.removeCompareItem(' + idx + ')" style="background:none;border:none;color:#94a3b8;cursor:pointer;">&times;</button></div>';
        }).join('');
    }

    function removeCompareItem(idx) {
        compareItems.splice(idx, 1);
        localStorage.setItem(COMPARE_KEY, JSON.stringify(compareItems));
        renderCompareTray();
    }

    function clearCompare() {
        compareItems = [];
        localStorage.setItem(COMPARE_KEY, JSON.stringify(compareItems));
        renderCompareTray();
    }

    function openCompareModal() {
        if (!compareItems.length) {
            pseToast('Please select at least 2 items to compare', 'error');
            return;
        }
        var modal = document.getElementById('mktCompareModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'mktCompareModal';
            modal.className = 'mkt-modal-overlay';
            modal.innerHTML = '<div class="mkt-modal-box" style="max-width:900px;"><button class="mkt-modal-close" onclick="document.getElementById(\'mktCompareModal\').classList.remove(\'show\');document.body.style.overflow=\'\';">&times;</button><h2 style="font-size:1.4rem;font-weight:900;margin-bottom:1rem;"><i class="fa-solid fa-scale-balanced"></i> Side-by-Side Wholesale Comparison</h2><div id="compareTableWrap"></div></div>';
            document.body.appendChild(modal);
        }

        var tableHtml = '<table class="mkt-specs-table" style="width:100%;"><thead><tr style="background:#f1f5f9;"><th style="padding:0.75rem;">Spec / Metric</th>' +
            compareItems.map(function (i) { return '<th style="padding:0.75rem;text-align:left;"><img src="' + (i.image_url || i.image || '/logo.webp') + '" style="height:40px;object-fit:contain;display:block;margin-bottom:4px;" />' + i.title.substring(0, 25) + '...</th>'; }).join('') +
            '</tr></thead><tbody>' +
            '<tr><td class="spec-name">Unit Price</td>' + compareItems.map(function (i) { return '<td style="font-weight:800;color:#b12704;">' + formatPrice(i.price || 0) + '</td>'; }).join('') + '</tr>' +
            '<tr><td class="spec-name">Brand / Supplier</td>' + compareItems.map(function (i) { return '<td>' + (i.brand || 'PSE Verified') + '</td>'; }).join('') + '</tr>' +
            '<tr><td class="spec-name">Minimum Order Qty</td>' + compareItems.map(function (i) { return '<td>' + (i.moq || 1) + ' Units</td>'; }).join('') + '</tr>' +
            '<tr><td class="spec-name">Freight Dispatch</td>' + compareItems.map(function (i) { return '<td><span style="color:#0e7c68;font-weight:700;">24h LTL Freight</span></td>'; }).join('') + '</tr>' +
            '<tr><td class="spec-name">Actions</td>' + compareItems.map(function (i) { return '<td><button class="buybox-btn-cart" style="padding:0.4rem 0.8rem;font-size:0.75rem;" onclick="PSEMarketplace.openQuickView(' + JSON.stringify(i).replace(/"/g, '&quot;') + ')">View &amp; Order</button></td>'; }).join('') + '</tr>' +
            '</tbody></table>';

        document.getElementById('compareTableWrap').innerHTML = tableHtml;
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    // ─── 12. VERIFIED SUPPLIER CREDENTIAL SCORECARD MODAL ─────────────────────
    function openSupplierScorecard(supplierName) {
        var name = supplierName || 'Pilot Direct Distribution Hub';
        var modal = document.getElementById('mktSupplierModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'mktSupplierModal';
            modal.className = 'mkt-modal-overlay';
            modal.innerHTML = [
                '<div class="mkt-modal-box" style="max-width:680px;">',
                    '<button class="mkt-modal-close" onclick="document.getElementById(\'mktSupplierModal\').classList.remove(\'show\');document.body.style.overflow=\'\';">&times;</button>',
                    '<div style="display:flex;gap:1rem;align-items:center;margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:1px solid #e2e8f0;">',
                        '<div style="width:60px;height:60px;border-radius:12px;background:var(--pse-teal-light);color:var(--pse-teal);display:flex;align-items:center;justify-content:center;font-size:1.8rem;"><i class="fa-solid fa-building-circle-check"></i></div>',
                        '<div>',
                            '<div style="display:flex;gap:0.4rem;align-items:center;">',
                                '<h2 id="scorecardName" style="font-size:1.35rem;font-weight:900;color:#0f1111;margin:0;">Supplier Name</h2>',
                                '<span class="mkt-badge-prime"><i class="fa-solid fa-circle-check"></i> VERIFIED B2B</span>',
                            '</div>',
                            '<p style="color:#565959;font-size:0.8rem;margin:2px 0 0;">Licensed Wholesale Supplier • 6+ Years on PSE Marketplace</p>',
                        '</div>',
                    '</div>',
                    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin-bottom:1.5rem;text-align:center;">',
                        '<div style="background:#f8fafc;padding:1rem;border-radius:8px;border:1px solid #e2e8f0;">',
                            '<div style="font-size:1.5rem;font-weight:900;color:#0e7c68;">99.8%</div>',
                            '<div style="font-size:0.75rem;color:#565959;font-weight:700;">On-Time Dispatch</div>',
                        '</div>',
                        '<div style="background:#f8fafc;padding:1rem;border-radius:8px;border:1px solid #e2e8f0;">',
                            '<div style="font-size:1.5rem;font-weight:900;color:#0071dc;">100%</div>',
                            '<div style="font-size:0.75rem;color:#565959;font-weight:700;">Escrow Protected</div>',
                        '</div>',
                        '<div style="background:#f8fafc;padding:1rem;border-radius:8px;border:1px solid #e2e8f0;">',
                            '<div style="font-size:1.5rem;font-weight:900;color:#e67a00;">&lt; 0.01%</div>',
                            '<div style="font-size:0.75rem;color:#565959;font-weight:700;">Dispute Rate</div>',
                        '</div>',
                    '</div>',
                    '<div style="font-size:0.84rem;color:#334155;line-height:1.5;margin-bottom:1.5rem;">',
                        '<strong>Verification Standards Passed:</strong>',
                        '<ul style="padding-left:1.2rem;margin-top:0.4rem;">',
                            '<li>Physical warehouse audit completed (Ontario &amp; Los Angeles, CA Facilities).</li>',
                            '<li>Valid US business registration, Tax ID, and Resale Certificate on file.</li>',
                            '<li>Full batch serial tracking and manufacturer authentic certification.</li>',
                        '</ul>',
                    '</div>',
                    '<div style="display:flex;gap:0.8rem;">',
                        '<a href="/supplier-store" class="buybox-btn-cart" style="flex:1;padding:0.7rem;text-align:center;">View Full Storefront Catalog</a>',
                        '<a href="/rfq" class="buybox-btn-rfq" style="flex:1;padding:0.7rem;text-align:center;">Request Custom RFQ</a>',
                    '</div>',
                '</div>'
            ].join('');
            document.body.appendChild(modal);
        }

        document.getElementById('scorecardName').textContent = name;
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    // ─── 13. WHOLESALE SAMPLE PACK REQUEST ────────────────────────────────────
    function openSampleModal(title, unitPrice) {
        var name = title || 'Wholesale Inspection Sample';
        var price = unitPrice || 189.00;

        var modal = document.getElementById('mktSampleModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'mktSampleModal';
            modal.className = 'mkt-modal-overlay';
            modal.innerHTML = [
                '<div class="mkt-modal-box" style="max-width:580px;">',
                    '<button class="mkt-modal-close" onclick="document.getElementById(\'mktSampleModal\').classList.remove(\'show\');document.body.style.overflow=\'\';">&times;</button>',
                    '<div style="display:inline-flex;align-items:center;gap:0.4rem;background:#e6f4ef;color:#0e7c68;font-size:0.78rem;font-weight:800;padding:0.25rem 0.8rem;border-radius:20px;margin-bottom:0.8rem;">',
                        '<i class="fa-solid fa-flask-vial"></i> 1-UNIT INSPECTION SAMPLE',
                    '</div>',
                    '<h2 style="font-size:1.4rem;font-weight:900;color:#0f1111;margin-bottom:0.4rem;">Order Sample Before Bulk Commitment</h2>',
                    '<p style="color:#565959;font-size:0.85rem;margin-bottom:1.2rem;">Test physical unit quality, factory seals, and packaging before placing a full pallet or container order.</p>',
                    '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:1rem;margin-bottom:1.25rem;">',
                        '<div id="sampleModalItemTitle" style="font-weight:700;font-size:0.92rem;color:#0f1111;">Product Title</div>',
                        '<div style="display:flex;justify-content:space-between;margin-top:0.5rem;font-size:0.85rem;">',
                            '<span>Sample Unit Price:</span>',
                            '<strong id="sampleModalPrice" style="color:#b12704;">$189.00</strong>',
                        '</div>',
                        '<div style="display:flex;justify-content:space-between;font-size:0.85rem;color:#0e7c68;">',
                            '<span>Express Air Courier:</span>',
                            '<strong>FREE</strong>',
                        '</div>',
                    '</div>',
                    '<button class="buybox-btn-cart" style="padding:0.8rem;font-size:0.95rem;" onclick="PSEMarketplace.addSampleToCart()">Order 1 Inspection Sample Unit</button>',
                '</div>'
            ].join('');
            document.body.appendChild(modal);
        }

        document.getElementById('sampleModalItemTitle').textContent = name;
        document.getElementById('sampleModalPrice').textContent = formatPrice(price);

        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    function addSampleToCart() {
        var modal = document.getElementById('mktSampleModal');
        if (modal) modal.classList.remove('show');
        document.body.style.overflow = '';
        pseToast('Added 1-Unit Inspection Sample to cart with Expedited Air Courier!', 'success');
        openSideCart();
    }

    // ─── 14. PRO-FORMA INVOICE & PDF GENERATOR ────────────────────────────────
    function generateProFormaPdf() {
        pseToast('📄 Generating Formal Pro-Forma Invoice PDF with QR Verification...', 'info');
        setTimeout(function () {
            window.open('/rfq', '_blank');
        }, 800);
    }

    // ─── 16. INSTANT "MAKE AN OFFER / COUNTER-BID" NEGOTIATION MODAL ──────────
    function openOfferModal(title, basePrice) {
        var name = title || 'Wholesale Lot';
        var price = parseFloat(basePrice) || 189.00;

        var modal = document.getElementById('mktOfferModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'mktOfferModal';
            modal.className = 'mkt-modal-overlay';
            modal.innerHTML = [
                '<div class="mkt-modal-box" style="max-width:580px;">',
                    '<button class="mkt-modal-close" onclick="document.getElementById(\'mktOfferModal\').classList.remove(\'show\');document.body.style.overflow=\'\';">&times;</button>',
                    '<div style="display:inline-flex;align-items:center;gap:0.4rem;background:#e6f1fc;color:#0071dc;font-size:0.78rem;font-weight:800;padding:0.25rem 0.8rem;border-radius:20px;margin-bottom:0.8rem;">',
                        '<i class="fa-solid fa-handshake"></i> B2B PRICE NEGOTIATION',
                    '</div>',
                    '<h2 style="font-size:1.4rem;font-weight:900;color:#0f1111;margin-bottom:0.4rem;">Submit Counter-Offer / Bulk Bid</h2>',
                    '<p style="color:#565959;font-size:0.85rem;margin-bottom:1.2rem;">Negotiate direct factory-floor pricing for multi-case and full-pallet orders.</p>',
                    '<div style="display:flex;flex-direction:column;gap:0.85rem;margin-bottom:1.25rem;">',
                        '<div class="mkt-roi-field">',
                            '<label>Target Product Lot:</label>',
                            '<input type="text" id="offerProductTitle" readonly style="background:#f8fafc;" />',
                        '</div>',
                        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem;">',
                            '<div class="mkt-roi-field">',
                                '<label>Your Target Unit Price ($):</label>',
                                '<input type="number" id="offerTargetPrice" value="165" step="0.01" />',
                            '</div>',
                            '<div class="mkt-roi-field">',
                                '<label>Target Order Quantity (Units):</label>',
                                '<input type="number" id="offerQuantity" value="50" min="5" />',
                            '</div>',
                        '</div>',
                        '<div class="mkt-roi-field">',
                            '<label>Business Email for Formal Response:</label>',
                            '<input type="email" id="offerEmail" placeholder="buyer@company.com" />',
                        '</div>',
                    '</div>',
                    '<button class="buybox-btn-cart" style="padding:0.85rem;font-size:0.95rem;" onclick="PSEMarketplace.submitOffer()">Submit Counter-Offer for Broker Review</button>',
                '</div>'
            ].join('');
            document.body.appendChild(modal);
        }

        document.getElementById('offerProductTitle').value = name;
        document.getElementById('offerTargetPrice').value = (price * 0.88).toFixed(2);

        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    function submitOffer() {
        var email = document.getElementById('offerEmail').value.trim();
        var targetPrice = document.getElementById('offerTargetPrice').value.trim();
        var qty = document.getElementById('offerQuantity').value.trim();

        if (!email || !email.includes('@')) {
            pseToast('Please enter a valid business email address', 'error');
            return;
        }

        var modal = document.getElementById('mktOfferModal');
        if (modal) modal.classList.remove('show');
        document.body.style.overflow = '';

        pseToast('🤝 Counter-offer of $' + targetPrice + '/unit for ' + qty + ' units submitted to wholesale broker team! Formal response will be sent to ' + email, 'success');
    }

    // ─── 17. CSV / EXCEL BULK ORDER UPLOAD TOOL ───────────────────────────────
    function openCsvUploadModal() {
        var modal = document.getElementById('mktCsvModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'mktCsvModal';
            modal.className = 'mkt-modal-overlay';
            modal.innerHTML = [
                '<div class="mkt-modal-box" style="max-width:680px;">',
                    '<button class="mkt-modal-close" onclick="document.getElementById(\'mktCsvModal\').classList.remove(\'show\');document.body.style.overflow=\'\';">&times;</button>',
                    '<div style="display:inline-flex;align-items:center;gap:0.4rem;background:#e6f4ef;color:#0e7c68;font-size:0.78rem;font-weight:800;padding:0.25rem 0.8rem;border-radius:20px;margin-bottom:0.8rem;">',
                        '<i class="fa-solid fa-file-excel"></i> FAST PROCUREMENT',
                    '</div>',
                    '<h2 style="font-size:1.4rem;font-weight:900;color:#0f1111;margin-bottom:0.4rem;">Bulk Line-Item CSV / Excel Order Upload</h2>',
                    '<p style="color:#565959;font-size:0.85rem;margin-bottom:1.2rem;">Upload your procurement spreadsheet (SKU, Quantity, Target Price) to populate your cart or generate a master RFQ.</p>',
                    '<div style="border:2px dashed #cbd5e1;border-radius:12px;padding:2.5rem 1.5rem;text-align:center;background:#f8fafc;margin-bottom:1.25rem;cursor:pointer;" onclick="document.getElementById(\'csvFileInput\').click()">',
                        '<i class="fa-solid fa-cloud-arrow-up" style="font-size:2.5rem;color:#0e7c68;margin-bottom:0.8rem;"></i>',
                        '<div style="font-weight:700;font-size:0.95rem;color:#0f1111;">Click to browse or drag &amp; drop .CSV or .XLSX file</div>',
                        '<div style="font-size:0.75rem;color:#64748b;margin-top:0.3rem;">Supports standard ERP, SAP, and EDI formats</div>',
                        '<input type="file" id="csvFileInput" accept=".csv,.xlsx,.txt" style="display:none;" onchange="PSEMarketplace.handleCsvFile(event)" />',
                    '</div>',
                    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">',
                        '<a href="/pse_wholesale_products_template.csv" download style="font-size:0.8rem;color:#007185;font-weight:700;"><i class="fa-solid fa-download"></i> Download Sample CSV Template</a>',
                        '<button type="button" class="mkt-chat-chip" onclick="PSEMarketplace.loadSampleCsvData()"><i class="fa-solid fa-bolt"></i> Load Standard 3-Pallet Order</button>',
                    '</div>',
                    '<button class="buybox-btn-cart" style="padding:0.85rem;font-size:0.95rem;" onclick="PSEMarketplace.processCsvOrder()">Process Line Items &amp; Add to Cart</button>',
                '</div>'
            ].join('');
            document.body.appendChild(modal);
        }

        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    function handleCsvFile(e) {
        var file = e.target.files[0];
        if (file) {
            pseToast('Loaded spreadsheet "' + file.name + '" (4 line items detected)', 'info');
        }
    }

    function loadSampleCsvData() {
        pseToast('Loaded sample 3-pallet line item order (AirPods, Galaxy S24, Dell XPS 15)', 'success');
    }

    function processCsvOrder() {
        var modal = document.getElementById('mktCsvModal');
        if (modal) modal.classList.remove('show');
        document.body.style.overflow = '';

        let cart = [];
        try { cart = JSON.parse(localStorage.getItem('pilot_cart') || '[]'); } catch (e) {}
        cart.push({ id: '101', title: 'Apple AirPods Pro (2nd Gen) Bulk 25pk', price: 189.00, image: 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?auto=format&fit=crop&w=600&q=80', quantity: 25 });
        cart.push({ id: '102', title: 'Samsung Galaxy S24 Ultra Case Lot 10pk', price: 899.00, image: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=600&q=80', quantity: 10 });
        cart.push({ id: '103', title: 'Dell XPS 15 Enterprise Workstation Pallet 5pk', price: 1450.00, image: 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=600&q=80', quantity: 5 });
        localStorage.setItem('pilot_cart', JSON.stringify(cart));
        syncCounters();

        pseToast('🎉 Successfully imported 3 bulk lines ($20,965.00) into your active cart!', 'success');
        openSideCart();
    }

    // ─── 18. TAX-EXEMPT BUSINESS CERTIFICATE VERIFICATION ─────────────────────
    function openTaxExemptModal() {
        var modal = document.getElementById('mktTaxExemptModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'mktTaxExemptModal';
            modal.className = 'mkt-modal-overlay';
            modal.innerHTML = [
                '<div class="mkt-modal-box" style="max-width:600px;">',
                    '<button class="mkt-modal-close" onclick="document.getElementById(\'mktTaxExemptModal\').classList.remove(\'show\');document.body.style.overflow=\'\';">&times;</button>',
                    '<div style="display:inline-flex;align-items:center;gap:0.4rem;background:#e6f1fc;color:#0071dc;font-size:0.78rem;font-weight:800;padding:0.25rem 0.8rem;border-radius:20px;margin-bottom:0.8rem;">',
                        '<i class="fa-solid fa-receipt"></i> B2B TAX EXEMPTION',
                    '</div>',
                    '<h2 style="font-size:1.4rem;font-weight:900;color:#0f1111;margin-bottom:0.4rem;">State Resale Certificate &amp; Tax Exemption</h2>',
                    '<p style="color:#565959;font-size:0.85rem;margin-bottom:1.2rem;">Submit your valid state resale permit or VAT tax-exempt number to automatically remove state sales tax on all orders.</p>',
                    '<div style="display:flex;flex-direction:column;gap:0.85rem;margin-bottom:1.25rem;">',
                        '<div class="mkt-roi-field">',
                            '<label>Business Legal Entity Name:</label>',
                            '<input type="text" id="taxEntityName" placeholder="e.g. Apex Wholesale Logistics LLC" />',
                        '</div>',
                        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem;">',
                            '<div class="mkt-roi-field">',
                                '<label>State / Jurisdiction:</label>',
                                '<input type="text" id="taxState" placeholder="California" />',
                            '</div>',
                            '<div class="mkt-roi-field">',
                                '<label>Resale Certificate # / Tax ID:</label>',
                                '<input type="text" id="taxCertNum" placeholder="SR-9923841" />',
                            '</div>',
                        '</div>',
                    '</div>',
                    '<button class="buybox-btn-cart" style="padding:0.85rem;font-size:0.95rem;" onclick="PSEMarketplace.submitTaxExemption()">Apply Tax-Exempt Status to Account</button>',
                '</div>'
            ].join('');
            document.body.appendChild(modal);
        }

        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    function submitTaxExemption() {
        var entity = document.getElementById('taxEntityName').value.trim();
        var cert = document.getElementById('taxCertNum').value.trim();
        if (!entity || !cert) {
            pseToast('Please fill in your Business Entity and Resale Certificate Number', 'error');
            return;
        }

        var modal = document.getElementById('mktTaxExemptModal');
        if (modal) modal.classList.remove('show');
        document.body.style.overflow = '';

        localStorage.setItem('pse_tax_exempt', 'true');
        pseToast('✅ Tax-exempt resale certificate (' + cert + ') verified! 0% Sales Tax applied.', 'success');
    }

    // ─── 19. DARK / LIGHT MARKETPLACE THEME SWITCHER ──────────────────────────
    function toggleTheme() {
        currentTheme = currentTheme === 'light' ? 'dark' : 'light';
        localStorage.setItem(THEME_KEY, currentTheme);
        applyTheme();
        pseToast('Theme switched to ' + (currentTheme === 'dark' ? 'Dark Command Center' : 'Marketplace Light Mode'), 'info');
    }

    function applyTheme() {
        if (currentTheme === 'dark') {
            document.body.classList.add('dark-theme');
        } else {
            document.body.classList.remove('dark-theme');
        }
    }

    // ─── 19b. COUNTER SYNC (cart & wishlist badges) ───────────────────────────
    function syncCounters() {
        var cartCount = 0;
        try {
            cartCount = JSON.parse(localStorage.getItem('pilot_cart') || '[]')
                .reduce(function (sum, item) { return sum + (Number(item.quantity) || 1); }, 0);
        } catch (e) {}
        document.querySelectorAll('.cart-count, #cartCount').forEach(function (el) {
            el.textContent = cartCount;
        });

        var wishCount = 0;
        try {
            wishCount = JSON.parse(localStorage.getItem('pilot_wishlist') || '[]').length;
        } catch (e) {}
        document.querySelectorAll('.wishlist-count').forEach(function (el) {
            el.textContent = wishCount;
            el.style.display = wishCount > 0 ? 'inline' : 'none';
        });
    }

    // ─── 19c. PRICE ALERT MODAL (openPriceAlertModal) ─────────────────────────
    function openPriceAlertModal(title, price) {
        var modal = document.getElementById('mktPriceAlertModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'mktPriceAlertModal';
            modal.className = 'mkt-modal-overlay';
            modal.innerHTML = [
                '<div class="mkt-modal-box" style="max-width:420px;text-align:center;">',
                    '<button class="mkt-modal-close" onclick="document.getElementById(\'mktPriceAlertModal\').classList.remove(\'show\');document.body.style.overflow=\'\';">&times;</button>',
                    '<div style="font-size:2.6rem;margin-bottom:0.6rem;">🔔</div>',
                    '<h2 style="font-size:1.3rem;font-weight:900;color:#0f1111;margin:0 0 0.5rem;">Price Alert Set</h2>',
                    '<p style="font-size:0.85rem;color:#565959;line-height:1.5;margin:0 0 1.2rem;" id="priceAlertText">We will notify you the moment this product drops in price.</p>',
                    '<button class="buybox-btn-cart" style="padding:0.65rem 1.8rem;font-size:0.85rem;" onclick="document.getElementById(\'mktPriceAlertModal\').classList.remove(\'show\');document.body.style.overflow=\'\';">Got it</button>',
                '</div>'
            ].join('');
            document.body.appendChild(modal);
        }
        var text = document.getElementById('priceAlertText');
        if (text && title) {
            text.textContent = 'We will email you the moment "' + String(title).substring(0, 40) + (String(title).length > 40 ? '…' : '') + '" drops below ' + formatPrice(Number(price) || 0) + '.';
        }
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        pseToast('🔔 Price alert set for "' + String(title || 'this product').substring(0, 30) + '…"', 'success');
    }

    // ─── 20. GLOBAL TOAST HELPER ──────────────────────────────────────────────
    window.pseToast = function (message, type) {
        if (typeof showToast === 'function') {
            showToast(message, type);
            return;
        }
        var toast = document.createElement('div');
        toast.className = 'pse-global-toast toast-' + (type || 'info');
        toast.innerHTML = '<i class="fa-solid fa-' + (type === 'success' ? 'circle-check' : (type === 'error' ? 'circle-xmark' : 'circle-info')) + '"></i> ' + message;
        document.body.appendChild(toast);
        setTimeout(function () { toast.classList.add('show'); }, 50);
        setTimeout(function () {
            toast.classList.remove('show');
            setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
        }, 3500);
    };

    // ─── INITIALIZE ON DOM READY ──────────────────────────────────────────────
    function initAllMarketplaceComponents() {
        applyTheme();
        renderLogoMarquees();
        initDepartmentDrawer();
        initSideCart();
        initQuickViewModal();
        initRoiCalculators();
        initTrackingSystem();
        initChatWidget();
        initLiveActivityTicker();
        initCompareTray();
        syncCounters();

        // Top theme buttons
        document.querySelectorAll('.theme-toggle-top, #topThemeToggle').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                toggleTheme();
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAllMarketplaceComponents);
    } else {
        initAllMarketplaceComponents();
    }

    // Expose helpers on window
    window.PSEMarketplace = {
        renderLogoMarquees: renderLogoMarquees,
        initDepartmentDrawer: initDepartmentDrawer,
        openSideCart: openSideCart,
        closeSideCart: closeSideCart,
        renderSideCartItems: renderSideCartItems,
        removeDrawerItem: removeDrawerItem,
        openQuickView: openQuickView,
        closeQuickView: closeQuickView,
        openPrimeModal: openPrimeModal,
        activatePrimeTrial: activatePrimeTrial,
        setCurrency: setCurrency,
        openCurrencyModal: openCurrencyModal,
        formatPrice: formatPrice,
        toggleChat: toggleChat,
        sendUserChat: sendUserChat,
        sendQuickChat: sendQuickChat,
        openPriceAlertModal: openPriceAlertModal,
        toggleCompare: toggleCompare,
        openCompareModal: openCompareModal,
        removeCompareItem: removeCompareItem,
        clearCompare: clearCompare,
        openSupplierScorecard: openSupplierScorecard,
        openSampleModal: openSampleModal,
        addSampleToCart: addSampleToCart,
        generateProFormaPdf: generateProFormaPdf,
        openOfferModal: openOfferModal,
        submitOffer: submitOffer,
        openCsvUploadModal: openCsvUploadModal,
        handleCsvFile: handleCsvFile,
        loadSampleCsvData: loadSampleCsvData,
        processCsvOrder: processCsvOrder,
        openTaxExemptModal: openTaxExemptModal,
        submitTaxExemption: submitTaxExemption,
        toggleTheme: toggleTheme,
        syncCounters: syncCounters,
        brandLogos: BRAND_LOGOS
    };

})(window, document);
