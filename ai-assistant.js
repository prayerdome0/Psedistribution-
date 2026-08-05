// ============================================
// AI-ASSISTANT.JS - Pilot Sales Distribution
// PSE Assistant: AI chatbot + Live Support.
// Client-side engine — runs entirely in the browser.
// ============================================
(function () {
    'use strict';

    var W = window;
    var LAUNCHER_BADGE_KEY = 'pse_assistant_badge_v1';
    var CHAT_HISTORY_KEY = 'pse_ai_chat_v1';

    // ────────────────────────────────────────────
    // KNOWLEDGE BASE (intents)
    // ────────────────────────────────────────────
    var KB = [
        {
            id: 'greeting',
            keywords: ['hi', 'hello', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening', 'howdy', 'yo'],
            reply: function () {
                var u = getCurrentUser();
                var name = u && u.full_name ? ' ' + u.full_name.split(' ')[0] : '';
                return 'Hello' + name + '! 👋 I\'m the PSE Assistant — I can help you find products, check prices, MOQs, shipping, orders and more. What can I do for you?';
            },
            quick: ['Find products', 'Shipping time', 'Track my order', 'Talk to a human']
        },
        {
            id: 'how_are_you',
            keywords: ['how are you', 'how do you do', 'what\'s up', 'whats up'],
            reply: 'I\'m great, thanks for asking! 😊 How can I help you shop today?'
        },
        {
            id: 'products_browse',
            keywords: ['products', 'catalog', 'browse', 'shop', 'items', 'list', 'what do you sell', 'categories', 'find products'],
            reply: function () {
                return 'We\'re a B2B wholesale marketplace with verified wholesale products across Electronics, Fashion, Home, Sports, Beauty and Automotive. 🛒 Browse the full catalog here: <a href="/products" class="pse-link">View all products</a> — or ask me for something specific (e.g. "show me headphones").';
            },
            quick: ['Electronics', 'Fashion', 'Home & Living']
        },
        {
            id: 'category',
            keywords: ['electronics', 'fashion', 'home', 'sports', 'beauty', 'automotive', 'clothing', 'shoes', 'furniture', 'appliances'],
            reply: function (q) {
                var map = [
                    { k: ['electronics', 'phone', 'headphone', 'laptop', 'charger', 'gadget'], c: 'electronics', label: 'Electronics' },
                    { k: ['fashion', 'clothing', 'shirt', 'tshirt', 't-shirt', 'shoe', 'wallet', 'apparel', 'dress'], c: 'fashion', label: 'Fashion' },
                    { k: ['home', 'furniture', 'kitchen', 'lamp', 'decor'], c: 'home', label: 'Home & Living' },
                    { k: ['sports', 'fitness', 'gym', 'watch', 'outdoor'], c: 'sports', label: 'Sports & Outdoors' },
                    { k: ['beauty', 'cosmetic', 'skincare', 'makeup'], c: 'beauty', label: 'Beauty' },
                    { k: ['automotive', 'car', 'auto', 'vehicle'], c: 'automotive', label: 'Automotive' }
                ];
                var hit = null;
                map.forEach(function (m) { m.k.forEach(function (kw) { if (!hit && q.indexOf(kw) > -1) hit = m; }); });
                hit = hit || map[0];
                return 'Great choice! Here are our ' + hit.label + ' products: <a href="/products?category=' + hit.c + '" class="pse-link">Browse ' + hit.label + '</a>. You can also search for a specific product by name.';
            },
            quick: ['Show me electronics', 'Show me fashion']
        },
        {
            id: 'product_search',
            keywords: ['search', 'find', 'looking for', 'do you have', 'buy', 'product', 'catalog', 'item', 'inventory', 'stock', 'carry', 'sell', 'deal', 'order'],
            reply: function (q) {
                var found = findProduct(q);
                if (found) {
                    return 'I found it! 🎯 <strong>' + esc(found.title) + '</strong> by ' + esc(found.brand || 'Pilot Distribution') +
                        ' — <strong>$' + Number(found.price || 0).toFixed(2) + '</strong>' +
                        (found.moq ? ' (MOQ: ' + found.moq + ')' : '') +
                        (found.rating ? ' ⭐ ' + found.rating : '') +
                        '.<br><a href="/product/' + slugify(found.title) + '" class="pse-link">View product details</a> · ' +
                        '<a href="/product/' + slugify(found.title) + '" class="pse-link">Add to cart</a>';
                }
                return 'We carry thousands of verified wholesale products. Try <a href="/products?search=' + encodeURIComponent(q.replace(/^(show|find|get|me|the|a|an|for|looking|buy|do you have)\s+/gi, '').trim()) + '" class="pse-link">searching the catalog</a> for "' + esc(q) + '" or submit an <a href="/rfq" class="pse-link">RFQ</a> for custom bulk orders.';
            }
        },
        {
            id: 'price',
            keywords: ['price', 'cost', 'how much', 'pricing', 'cheap', 'discount', 'deal', 'offer', 'wholesale price', 'save'],
            reply: function () {
                var cp = getCurrentProduct();
                if (cp) {
                    return 'The current product <strong>' + esc(cp.title) + '</strong> is priced at <strong>$' + Number(cp.price || 0).toFixed(2) + '</strong>' + (cp.old_price ? ' (was $' + Number(cp.old_price).toFixed(2) + ')' : '') + '. Prices drop further with bulk quantities — request a quote on the product page or via <a href="/rfq" class="pse-link">RFQ</a>.';
                }
                return 'Our wholesale prices are up to 40% below retail. 💰 For exact pricing, open any product page, or send us an <a href="/rfq" class="pse-link">RFQ</a> and suppliers will quote you within 24–48h.';
            },
            quick: ['Get a quote', 'Request RFQ']
        },
        {
            id: 'moq',
            keywords: ['moq', 'minimum order', 'minimum quantity', 'bulk', 'quantity', 'wholesale quantity'],
            reply: function () {
                return 'Most suppliers on PSE Distribution set a Minimum Order Quantity (MOQ) — typically 5–25 units per product, shown on each product page. 📦 If you need a custom quantity, submit an <a href="/rfq" class="pse-link">RFQ</a> and suppliers will match your volume.';
            },
            quick: ['Request a quote']
        },
        {
            id: 'shipping',
            keywords: ['shipping', 'delivery', 'deliver', 'how long', 'arrive', 'ship', 'freight', 'courier', 'tracking number', 'dispatch'],
            reply: function () {
                return '🚚 We offer worldwide shipping: standard delivery is 3–5 business days, and orders over $250 ship <strong>free</strong>. Express options are available at checkout. You can track your order anytime at <a href="/track-order" class="pse-link">Track Order</a>.';
            },
            quick: ['Track my order', 'Free shipping?']
        },
        {
            id: 'free_shipping',
            keywords: ['free shipping', 'shipping cost', 'shipping fee', 'shipping price'],
            reply: 'Good news — orders over <strong>$250 ship free</strong>! 🎉 Orders below that add a flat $15 shipping fee at checkout. Want to check your cart? <a href="/cart" class="pse-link">View cart</a>'
        },
        {
            id: 'returns',
            keywords: ['return', 'return policy', 'refund', 'replacement', 'money back', 'exchange', 'damaged', 'defective'],
            reply: 'We stand behind every order: 🔄 <strong>30-day returns</strong> on most items, easy replacements for damaged/defective products, and our support team resolves issues within 24h. See our <a href="/terms" class="pse-link">Terms</a> or message us in the Live Support tab. — and I\'ll log your issue right away.'
        },
        {
            id: 'payment',
            keywords: ['pay', 'payment', 'paypal', 'card', 'visa', 'mastercard', 'credit card', 'invoice', 'bank transfer', 'how do i pay'],
            reply: 'We accept 💳 Visa, Mastercard, PayPal, and bank transfer for wholesale invoices. All payments are processed securely at checkout, and B2B customers can request payment terms via <a href="/rfq" class="pse-link">RFQ</a>.'
        },
        {
            id: 'order',
            keywords: ['order', 'track', 'status', 'where is my order', 'my package', 'delivered'],
            reply: function () {
                return 'To track your order, open the <a href="/track-order" class="pse-link">Track Order</a> page and enter your order number. 📦 You also get email updates at every step — confirmation, shipped, and delivered. If you need help, I can connect you with live support.';
            },
            quick: ['Track my order']
        },
        {
            id: 'rfq',
            keywords: ['rfq', 'quote', 'request for quote', 'quotation', 'custom order', 'price quote'],
            reply: 'Need a custom wholesale quote? 📋 Submit an RFQ and verified suppliers will respond within 24–48 hours with pricing for your quantity. <a href="/rfq" class="pse-link">Start your RFQ now</a> — it takes under 2 minutes!',
            quick: ['Start RFQ']
        },
        {
            id: 'become_seller',
            keywords: ['sell', 'seller', 'vendor', 'supplier', 'become a seller', 'list products', 'wholesale supplier'],
            reply: 'We\'d love to have you on board! 🏪 Create your seller account at <a href="/become-seller" class="pse-link">Become a Seller</a>, complete <a href="/supplier-verification" class="pse-link">Supplier Verification</a>, and start listing products in minutes. verified suppliers already sell with us!',
            quick: ['Become a seller']
        },
        {
            id: 'account',
            keywords: ['login', 'log in', 'register', 'sign up', 'signup', 'account', 'sign in', 'create account', 'forgot password'],
            reply: function () {
                var u = getCurrentUser();
                if (u) return 'You\'re logged in as <strong>' + esc(u.email || '') + '</strong> (' + esc(u.role || 'buyer') + '). You can manage everything from your <a href="/account" class="pse-link">Account dashboard</a>.';
                return 'You can <a href="/login" class="pse-link">Log in</a> or <a href="/register" class="pse-link">Create a free account</a> in under a minute — it unlocks cart sync, wishlist, RFQs and order tracking. 🔐';
            },
            quick: ['Create account', 'Log in']
        },
        {
            id: 'cart',
            keywords: ['cart', 'checkout', 'buy', 'purchase', 'add to cart', 'basket'],
            reply: function () {
                var count = cartCount();
                return count > 0
                    ? 'You have <strong>' + count + ' item' + (count > 1 ? 's' : '') + '</strong> in your cart. 🛒 Ready to checkout? <a href="/cart" class="pse-link">View cart</a> · <a href="/checkout" class="pse-link">Checkout now</a>'
                    : 'Your cart is empty. Browse the <a href="/products" class="pse-link">catalog</a> or tell me what you\'re looking for and I\'ll point you to it! 🛍️';
            },
            quick: ['View cart', 'Browse products']
        },
        {
            id: 'wishlist',
            keywords: ['wishlist', 'favorite', 'favourite', 'save for later', 'heart'],
            reply: 'Your wishlist is at <a href="/wishlist" class="pse-link">Wishlist</a> — tap the ❤️ on any product to save it. We\'ll notify you when prices drop!'
        },
        {
            id: 'contact_support',
            keywords: ['human', 'agent', 'support', 'contact', 'representative', 'talk to someone', 'real person', 'live chat', 'customer service', 'help me with my order'],
            reply: function () {
                openLiveSupport();
                return 'I\'ve switched you to <strong>Live Support</strong>! 💬 Our team replies within 24 hours (usually much faster). You can also reach us on <a href="https://wa.me/19099384682" target="_blank" class="pse-link">WhatsApp</a> or email <a href="mailto:support@pilotsalesdistribution.com" class="pse-link">support@pilotsalesdistribution.com</a>.';
            }
        },
        {
            id: 'about',
            keywords: ['about', 'company', 'who are you', 'what is pse', 'pilot sales', 'about the company', 'trust', 'legit', 'verified'],
            reply: 'Pilot Sales Distribution (PSE) is a premium B2B wholesale marketplace connecting verified suppliers with buyers worldwide. 🌍 verified suppliers, growing catalog, high satisfaction. Learn more at <a href="/about" class="pse-link">About us</a>.'
        },
        {
            id: 'help',
            keywords: ['help', 'what can you do', 'what do you know', 'what do you do', 'how do i', 'guide', 'tutorial', 'assist'],
            reply: 'Here\'s what I can help with: 🧭<br>• Find products & check prices<br>• MOQ, shipping & returns info<br>• Track orders & payment questions<br>• RFQs, selling on PSE, account help<br>Just ask in plain words — or pick a quick question below!'
        },
        {
            id: 'thanks',
            keywords: ['thank', 'thanks', 'thx', 'appreciate', 'great', 'awesome', 'cool'],
            reply: 'You\'re very welcome! 😊 Happy shopping at PSE Distribution. If you need anything else, I\'m always here — or hit <strong>Live Support</strong> to talk to a human.'
        },
        {
            id: 'bye',
            keywords: ['bye', 'goodbye', 'see you', 'good night', 'farewell', 'cya'],
            reply: 'Goodbye! 👋 We\'ll be right here whenever you need us. Have a great day!'
        },
        {
            id: 'hours',
            keywords: ['hours', 'open', '24/7', 'business hours', 'when are you available'],
            reply: 'Our AI assistant is available 24/7 🤖, and the live support team typically replies within 24 hours. For urgent help, WhatsApp us at <a href="https://wa.me/19099384682" target="_blank" class="pse-link">+1 (909) 938-4682</a>.'
        },
        {
            id: 'track_help',
            keywords: ['where', 'package', 'parcel', 'shipment', 'shipped', 'dispatched'],
            reply: 'You can check any shipment at <a href="/track-order" class="pse-link">Track Order</a> with your order number (you\'ll also get email + on-site updates). If your tracking shows no movement for 3+ days, tell Live Support and we\'ll investigate. 📦'
        }
    ];



    // ────────────────────────────────────────────
    // UTILITIES
    // ────────────────────────────────────────────
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function slugify(title) {
        return String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 80);
    }
    function getCurrentUser() {
        try { return JSON.parse(localStorage.getItem('pilot_user') || 'null'); } catch (e) { return null; }
    }
    function cartCount() {
        try {
            var cart = JSON.parse(localStorage.getItem('pilot_cart') || '[]');
            return cart.reduce(function (s, i) { return s + (i.quantity || 1); }, 0);
        } catch (e) { return 0; }
    }
    function getCurrentProduct() {
        // Product detail pages expose currentProduct globally
        if (W.currentProduct && typeof W.currentProduct === 'object') return W.currentProduct;
        return null;
    }
    function findProduct(q) {
        var ql = String(q || '').toLowerCase();
        if (W.PSE && W.PSE.search && typeof W.PSE.search.query === 'function') {
            var results = W.PSE.search.query(ql);
            if (results && results.length > 0) {
                return results[0];
            }
        }
        return null;
    }

    // ────────────────────────────────────────────
    // RESPONSE ENGINE (rule-based "AI")
    // ────────────────────────────────────────────
    function getAnswer(query) {
        var q = ' ' + String(query || '').toLowerCase().replace(/[^a-z0-9\s$]/g, ' ') + ' ';
        var scores = [];
        KB.forEach(function (intent) {
            var score = 0;
            var longest = 0;
            var phraseHit = false;
            intent.keywords.forEach(function (kw) {
                if (kw.indexOf(' ') > -1 && q.indexOf(' ' + kw + ' ') > -1) {
                    score += 6; longest = Math.max(longest, kw.length); phraseHit = true;
                } else if (q.indexOf(' ' + kw + ' ') > -1) {
                    score += kw.length > 5 ? 3 : 2; longest = Math.max(longest, kw.length);
                } else if (kw.indexOf(' ') === -1 && q.indexOf(' ' + kw + 's ') > -1) {
                    // plural form (lamps → lamp)
                    score += kw.length > 5 ? 3 : 2; longest = Math.max(longest, kw.length);
                } else if (q.indexOf(kw) > -1) {
                    score += 1; longest = Math.max(longest, kw.length);
                }
            });
            if (score > 0) scores.push({ intent: intent, score: score, longest: longest, phraseHit: phraseHit });
        });
        // Most matches first; exact multi-word phrases get a big bonus already;
        // ties resolved by the most specific (longest) keyword
        scores.sort(function (a, b) {
            return b.score - a.score || (b.phraseHit - a.phraseHit) || b.longest - a.longest;
        });
        if (scores.length && scores[0].score >= 2) {
            var intent = scores[0].intent;
            var reply = typeof intent.reply === 'function' ? intent.reply(q) : intent.reply;
            return { text: reply, quick: intent.quick || [] };
        }
        // default fallback
        return {
            text: 'Hmm, I\'m not 100% sure about that one yet. 🤔 I\'m best with product searches, pricing, MOQs, shipping, orders, RFQs and account help. Try one of these, or <a href="javascript:void(0)" onclick="window.openLiveSupport&&window.openLiveSupport()" class="pse-link">talk to a human</a>:',
            quick: ['Browse products', 'Shipping info', 'Track my order', 'Become a seller']
        };
    }

    // ────────────────────────────────────────────
    // WIDGET UI
    // ────────────────────────────────────────────
    var state = { open: false, tab: 'ai' };

    function injectStyles() {
        if (document.getElementById('pse-assistant-styles')) return;
        var style = document.createElement('style');
        style.id = 'pse-assistant-styles';
        style.textContent = `
            .pse-launcher {
                position: fixed; right: 22px; bottom: 24px; z-index: 2147483000;
                display: flex; align-items: center; gap: 10px; cursor: pointer;
                background: linear-gradient(135deg, #0e7c68, #0a5a4a); color: #fff;
                border: none; border-radius: 50px; padding: 14px 22px;
                font-family: 'Inter','Segoe UI',system-ui,sans-serif; font-size: 0.95rem; font-weight: 700;
                box-shadow: 0 12px 35px rgba(15,79,67,.45); transition: transform .25s ease, box-shadow .25s ease;
            }
            .pse-launcher:hover { transform: translateY(-3px) scale(1.03); box-shadow: 0 18px 45px rgba(15,79,67,.55); }
            .pse-launcher .pse-launcher-ico {
                width: 34px; height: 34px; border-radius: 50%; background: rgba(255,255,255,.18);
                display: flex; align-items: center; justify-content: center; font-size: 1.1rem;
                animation: psePulse 2.2s infinite;
            }
            @keyframes psePulse { 0%,100% { box-shadow: 0 0 0 0 rgba(255,255,255,.35);} 50% { box-shadow: 0 0 0 9px rgba(255,255,255,0);} }
            .pse-launcher-badge {
                position: absolute; top: -6px; right: -4px; background: #e74c3c; color: #fff;
                font-size: 0.65rem; font-weight: 700; min-width: 20px; height: 20px; border-radius: 50%;
                display: none; align-items: center; justify-content: center; padding: 0 5px;
                border: 2px solid #fff;
            }
            .pse-panel {
                position: fixed; right: 22px; bottom: 90px; z-index: 2147483000;
                width: 380px; max-width: calc(100vw - 28px); height: min(600px, calc(100vh - 130px));
                background: #fff; border-radius: 20px; box-shadow: 0 25px 70px rgba(11,42,59,.28);
                border: 1px solid #e9edf2; display: none; flex-direction: column; overflow: hidden;
                font-family: 'Inter','Segoe UI',system-ui,sans-serif;
            }
            .pse-panel.open { display: flex; animation: pseIn .28s ease; }
            @keyframes pseIn { from { opacity: 0; transform: translateY(16px) scale(.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
            .pse-panel-head {
                background: linear-gradient(135deg, #0b2138, #16334f); color: #fff; padding: 0.9rem 1rem;
                display: flex; align-items: center; gap: 0.7rem;
            }
            .pse-panel-head .pse-avatar {
                width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #0e7c68, #0e7c68);
                display: flex; align-items: center; justify-content: center; font-size: 1.15rem; flex-shrink: 0;
            }
            .pse-panel-head .pse-head-txt { flex: 1; min-width: 0; }
            .pse-panel-head .pse-head-txt strong { font-size: 0.95rem; display: block; }
            .pse-panel-head .pse-head-txt span { font-size: 0.7rem; color: #9fd8c4; }
            .pse-panel-head .pse-head-close {
                background: rgba(255,255,255,.12); border: none; color: #fff; width: 30px; height: 30px;
                border-radius: 50%; cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; justify-content: center;
            }
            .pse-panel-head .pse-head-close:hover { background: rgba(255,255,255,.25); }
            .pse-tabs { display: flex; background: #f5f8fa; border-bottom: 1px solid #e9edf2; }
            .pse-tab {
                flex: 1; text-align: center; padding: 0.65rem 0; font-size: 0.8rem; font-weight: 700; cursor: pointer;
                color: #698093; border-bottom: 3px solid transparent; transition: all .25s; background: none; border-top: none; border-left: none; border-right: none;
            }
            .pse-tab.active { color: #0e7c68; border-bottom-color: #0e7c68; background: #fff; }
            .pse-tab i { margin-right: 4px; }
            .pse-ai-body { display: flex; flex-direction: column; flex: 1; min-height: 0; }
            .pse-chat {
                flex: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 0.6rem;
                background: #f8fbfd;
            }
            .pse-msg { max-width: 85%; padding: 0.6rem 0.85rem; border-radius: 16px; font-size: 0.83rem; line-height: 1.55; word-wrap: break-word; }
            .pse-msg.bot { align-self: flex-start; background: #fff; border: 1px solid #e9edf2; border-bottom-left-radius: 5px; color: #123; }
            .pse-msg.user { align-self: flex-end; background: linear-gradient(135deg, #0e7c68, #0e7c68); color: #fff; border-bottom-right-radius: 5px; }
            .pse-msg .pse-link { color: #0e7c68; font-weight: 600; text-decoration: underline; }
            .pse-msg.user .pse-link { color: #d5f5ec; }
            .pse-typing { display: none; align-self: flex-start; background: #fff; border: 1px solid #e9edf2; border-radius: 16px; padding: 0.7rem 1rem; }
            .pse-typing span { width: 7px; height: 7px; background: #0e7c68; border-radius: 50%; display: inline-block; margin: 0 2px; animation: pseTyping 1.2s infinite; }
            .pse-typing span:nth-child(2) { animation-delay: .2s; }
            .pse-typing span:nth-child(3) { animation-delay: .4s; }
            @keyframes pseTyping { 0%,60%,100% { transform: translateY(0); opacity:.4;} 30% { transform: translateY(-5px); opacity:1;} }
            .pse-quick { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 1rem 0.4rem; background: #f8fbfd; }
            .pse-chip {
                background: #f0f8f5; color: #0e7c68; border: 1px solid #cfe9e0; border-radius: 30px;
                padding: 0.35rem 0.8rem; font-size: 0.72rem; font-weight: 600; cursor: pointer; transition: all .2s;
                font-family: inherit;
            }
            .pse-chip:hover { background: #0e7c68; color: #fff; }
            .pse-input-row { display: flex; gap: 8px; padding: 0.7rem 1rem 1rem; background: #f8fbfd; border-top: 1px solid #e9edf2; }
            .pse-input-row input {
                flex: 1; border: 2px solid #e9edf2; border-radius: 40px; padding: 0.6rem 1rem; font-size: 0.85rem;
                outline: none; font-family: inherit; transition: border-color .25s;
            }
            .pse-input-row input:focus { border-color: #0e7c68; }
            .pse-send-btn {
                background: linear-gradient(135deg, #0e7c68, #0a5a4a); color: #fff; border: none; width: 44px; height: 44px;
                border-radius: 50%; cursor: pointer; font-size: 1rem; display: flex; align-items: center; justify-content: center;
                transition: transform .2s; flex-shrink: 0;
            }
            .pse-send-btn:hover { transform: scale(1.08); }
            .pse-support-body { display: none; flex-direction: column; flex: 1; min-height: 0; overflow-y: auto; padding: 1.2rem; gap: 0.8rem; background: #f8fbfd; }
            .pse-support-body.active { display: flex; }
            .pse-support-body .pse-support-intro { font-size: 0.85rem; color: #33475b; line-height: 1.6; }
            .pse-support-body label { font-size: 0.75rem; font-weight: 700; color: #0b2138; }
            .pse-support-body input, .pse-support-body textarea {
                width: 100%; border: 2px solid #e9edf2; border-radius: 12px; padding: 0.65rem 0.9rem;
                font-size: 0.85rem; font-family: inherit; outline: none; box-sizing: border-box; transition: border-color .25s;
            }
            .pse-support-body input:focus, .pse-support-body textarea:focus { border-color: #0e7c68; }
            .pse-support-body textarea { min-height: 90px; resize: vertical; }
            .pse-support-btn {
                background: linear-gradient(135deg, #0e7c68, #0a5a4a); color: #fff; border: none; border-radius: 40px;
                padding: 0.75rem 1.2rem; font-size: 0.85rem; font-weight: 700; cursor: pointer; font-family: inherit;
                transition: transform .2s, box-shadow .2s;
            }
            .pse-support-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 22px rgba(15,79,67,.35); }
            .pse-support-btn:disabled { opacity: .6; cursor: not-allowed; transform: none; box-shadow: none; }
            .pse-wa-btn {
                background: #25D366; color: #fff; text-align: center; text-decoration: none; border-radius: 40px;
                padding: 0.75rem 1.2rem; font-size: 0.85rem; font-weight: 700; display: block; transition: transform .2s;
            }
            .pse-wa-btn:hover { transform: translateY(-2px); }
            .pse-support-note { font-size: 0.7rem; color: #698093; text-align: center; }
            .pse-support-success { display: none; text-align: center; padding: 1.4rem 1rem; background: #f0f8f5; border: 1px solid #cfe9e0; border-radius: 14px; }
            .pse-support-success.show { display: block; }
            .pse-support-success i { font-size: 2.2rem; color: #0e7c68; }
            .pse-support-success h4 { margin: 0.5rem 0 0.3rem; color: #0b2138; }
            .pse-support-success p { font-size: 0.8rem; color: #33475b; margin: 0; }
            @media (max-width: 480px) {
                .pse-launcher { padding: 12px 16px; font-size: 0.85rem; }
                .pse-launcher .pse-launcher-label { display: none; }
                .pse-panel { right: 10px; bottom: 84px; height: calc(100vh - 120px); }
            }
        `;
        document.head.appendChild(style);
    }

    function buildWidget() {
        if (document.getElementById('pse-assistant-root')) return;
        injectStyles();

        var launcher = document.createElement('button');
        launcher.className = 'pse-launcher';
        launcher.id = 'pse-assistant-launcher';
        launcher.setAttribute('aria-label', 'Open PSE Assistant');
        launcher.innerHTML = '<span class="pse-launcher-ico"><i class="fa-solid fa-robot"></i></span><span class="pse-launcher-label">PSE Assistant</span><span class="pse-launcher-badge" id="pse-launcher-badge">0</span>';

        var panel = document.createElement('div');
        panel.className = 'pse-panel';
        panel.id = 'pse-assistant-panel';
        panel.innerHTML = `
            <div class="pse-panel-head">
                <div class="pse-avatar"><i class="fa-solid fa-robot"></i></div>
                <div class="pse-head-txt">
                    <strong>PSE Assistant</strong>
                    <span><i class="fa-solid fa-circle" style="color:#2ecc71;font-size:0.5rem;"></i> Online · AI runs free in your browser</span>
                </div>
                <button class="pse-head-close" id="pse-assistant-close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="pse-tabs">
                <button class="pse-tab active" data-tab="ai"><i class="fa-solid fa-robot"></i> AI Assistant</button>
                <button class="pse-tab" data-tab="support"><i class="fa-solid fa-headset"></i> Live Support</button>
            </div>
            <div class="pse-ai-body" id="pse-ai-body">
                <div class="pse-chat" id="pse-chat"></div>
                <div class="pse-typing" id="pse-typing"><span></span><span></span><span></span></div>
                <div class="pse-quick" id="pse-quick"></div>
                <div class="pse-input-row">
                    <input type="text" id="pse-input" placeholder="Ask me anything…" autocomplete="off" />
                    <button class="pse-send-btn" id="pse-send" aria-label="Send"><i class="fa-solid fa-paper-plane"></i></button>
                </div>
            </div>
            <div class="pse-support-body" id="pse-support-body">
                <div class="pse-support-intro">
                    💬 <strong>Our team replies within 24 hours</strong> (usually much faster). Leave a message and we'll get back to you by email — or chat instantly on WhatsApp.
                </div>
                <div class="pse-support-success" id="pse-support-success">
                    <i class="fa-regular fa-circle-check"></i>
                    <h4>Message sent! 🤖 Auto-reply on its way</h4>
                    <p>An instant confirmation has been emailed to you, and our support team will reply within 24 hours.</p>
                </div>
                <div id="pse-support-form">
                    <label for="pse-s-name">Your name</label>
                    <input type="text" id="pse-s-name" placeholder="John Smith" />
                    <label for="pse-s-email" style="margin-top:0.7rem;">Email</label>
                    <input type="email" id="pse-s-email" placeholder="you@company.com" />
                    <label for="pse-s-msg" style="margin-top:0.7rem;">Message</label>
                    <textarea id="pse-s-msg" placeholder="How can we help?"></textarea>
                    <button class="pse-support-btn" id="pse-support-send" style="margin-top:0.9rem;"><i class="fa-regular fa-paper-plane"></i> Send to support</button>
                    <div style="display:flex;align-items:center;gap:0.6rem;margin:0.7rem 0;">
                        <span style="flex:1;height:1px;background:#e9edf2;"></span>
                        <span style="font-size:0.7rem;color:#698093;">or</span>
                        <span style="flex:1;height:1px;background:#e9edf2;"></span>
                    </div>
                    <a class="pse-wa-btn" href="https://wa.me/19099384682" target="_blank"><i class="fa-brands fa-whatsapp"></i> Chat on WhatsApp</a>
                    <p class="pse-support-note">Email us anytime at <a href="mailto:support@pilotsalesdistribution.com" style="color:#0e7c68;">support@pilotsalesdistribution.com</a></p>
                </div>
            </div>
        `;

        var root = document.createElement('div');
        root.id = 'pse-assistant-root';
        root.appendChild(launcher);
        root.appendChild(panel);
        document.body.appendChild(root);

        return { launcher: launcher, panel: panel };
    }

    // ────────────────────────────────────────────
    // CHAT LOGIC
    // ────────────────────────────────────────────
    var chatEl, typingEl, quickEl, inputEl;
    var firstOpen = true;

    function chatHistory() {
        try { return JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY) || '[]'); } catch (e) { return []; }
    }
    function saveChat(messages) {
        try { localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages.slice(-30))); } catch (e) {}
    }

    function addMsg(text, who) {
        var div = document.createElement('div');
        div.className = 'pse-msg ' + who;
        div.innerHTML = text;
        chatEl.appendChild(div);
        chatEl.scrollTop = chatEl.scrollHeight;
        return div;
    }

    function showTyping(on) { typingEl.style.display = on ? 'block' : 'none'; if (on) chatEl.scrollTop = chatEl.scrollHeight; }

    function setQuick(chips) {
        quickEl.innerHTML = '';
        (chips || []).slice(0, 4).forEach(function (c) {
            var b = document.createElement('button');
            b.className = 'pse-chip';
            b.textContent = c;
            b.addEventListener('click', function () { sendUserText(c); });
            quickEl.appendChild(b);
        });
    }

    function botReply(text, quick) {
        showTyping(true);
        setTimeout(function () {
            showTyping(false);
            addMsg(text, 'bot');
            setQuick(quick || []);
            var history = chatHistory();
            history.push({ who: 'bot', text: text });
            saveChat(history);
        }, 550 + Math.random() * 550);
    }

    function sendUserText(raw) {
        var text = String(raw || '').trim();
        if (!text) return;
        addMsg(esc(text), 'user');
        setQuick([]);
        inputEl.value = '';
        var history = chatHistory();
        history.push({ who: 'user', text: text });
        saveChat(history);

        var answer = getAnswer(text);
        botReply(answer.text, answer.quick);
    }

    function openPanel(tab) {
        state.open = true;
        panelEl.classList.add('open');
        if (tab) switchTab(tab);
        clearBadge();
        if (firstOpen) {
            firstOpen = false;
            setTimeout(function () {
                var greeting = getAnswer('hi');
                addMsg(greeting.text, 'bot');
                setQuick(greeting.quick || []);
                var history = chatHistory();
                history.push({ who: 'bot', text: greeting.text });
                saveChat(history);
            }, 400);
        }
    }
    function closePanel() { state.open = false; panelEl.classList.remove('open'); }

    function switchTab(tab) {
        state.tab = tab;
        document.querySelectorAll('.pse-tab').forEach(function (t) {
            t.classList.toggle('active', t.dataset.tab === tab);
        });
        document.getElementById('pse-ai-body').style.display = tab === 'ai' ? 'flex' : 'none';
        var sb = document.getElementById('pse-support-body');
        sb.classList.toggle('active', tab === 'support');
    }

    // ─── LIVE SUPPORT SUBMIT ───
    async function submitSupport() {
        var name = document.getElementById('pse-s-name').value.trim();
        var email = document.getElementById('pse-s-email').value.trim();
        var msg = document.getElementById('pse-s-msg').value.trim();

        if (!name || !email || !msg) {
            if (W.showToast) W.showToast('Please fill in your name, email and message', 'error');
            return;
        }
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
            if (W.showToast) W.showToast('Please enter a valid email address', 'error');
            return;
        }

        var btn = document.getElementById('pse-support-send');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending…';

        var payload = {
            name: name, email: email, message: msg,
            user_id: (getCurrentUser() || {}).id || 'guest',
            source: 'live-support-widget',
            status: 'unread',
            auto_replied: true, // instant auto confirmation is emailed below (and shown to admin)
            auto_reply_text: 'Thanks for contacting Pilot Sales Distribution. We received your message and reply within 24 hours.',
            created_at: new Date().toISOString()
        };

        // 1) local queue (always works)
        try {
            var queue = JSON.parse(localStorage.getItem('pilot_support_queue') || '[]');
            queue.push(payload);
            localStorage.setItem('pilot_support_queue', JSON.stringify(queue));
        } catch (e) {}

        // 2) Firestore (if available)
        var fsSaved = false;
        try {
            var dbRef = W.db;
            if (!dbRef && W.firebase && typeof W.firebase.firestore === 'function' && W.firebase.apps && W.firebase.apps.length) {
                dbRef = W.firebase.firestore();
            }
            if (dbRef && typeof dbRef.collection === 'function') {
                await dbRef.collection('support_messages').add(payload);
                // also mirror into the admin inbox ('messages' collection used by admin-dashboard)
                try {
                    await dbRef.collection('messages').add({
                        firstName: name,
                        lastName: '',
                        email: email,
                        phone: '',
                        subject: 'Live Support: ' + name,
                        message: msg,
                        userId: (getCurrentUser() || {}).id || 'guest',
                        userEmail: email,
                        status: 'unread',
                        source: 'live-support-widget',
                        auto_replied: true,
                        created_at: new Date().toISOString()
                    });
                } catch (e2) { console.warn('Admin inbox mirror skipped:', e2); }
                fsSaved = true;
            }
        } catch (e) { console.warn('Support message Firestore save skipped:', e); }

        // 3) Email via shared email system (Resend → FormSubmit → mailto)
        //    sendSupportMessage notifies the support team AND sends the
        //    automatic first reply (contact-auto-reply) to the customer,
        //    so live support is always auto-replied before a human answers.
        var emailSent = false;
        try {
            if (typeof W.sendSupportMessage === 'function') {
                var res = await W.sendSupportMessage({ name: name, email: email, subject: 'Live Support: ' + name, message: msg });
                emailSent = !!(res && res.success);
            } else if (typeof W.sendContactMessage === 'function') {
                var res2 = await W.sendContactMessage({ name: name, email: email, subject: 'Live Support: ' + name, message: msg });
                emailSent = !!(res2 && res2.success);
            }
        } catch (e) { console.warn('Support email skipped:', e); }

        // 4) Notification
        try {
            if (typeof W.pushNotification === 'function') {
                W.pushNotification('Support message sent 💬', emailSent
                    ? 'We emailed you a confirmation — our team will reply within 24h.'
                    : 'Our team will reply to ' + email + ' within 24h.', { icon: 'fa-headset', url: '/contact', tag: 'support' });
            }
        } catch (e) {}

        btn.disabled = false;
        btn.innerHTML = '<i class="fa-regular fa-paper-plane"></i> Send to support';
        document.getElementById('pse-support-form').style.display = 'none';
        document.getElementById('pse-support-success').classList.add('show');
        if (W.showToast) W.showToast('✅ Message sent! We\'ll reply within 24 hours.', 'success');
    }

    // ─── BADGE ───
    function setBadge(n) {
        try { localStorage.setItem(LAUNCHER_BADGE_KEY, String(n)); } catch (e) {}
        var el = document.getElementById('pse-launcher-badge');
        if (el) { el.textContent = n; el.style.display = n > 0 ? 'flex' : 'none'; }
    }
    function clearBadge() { setBadge(0); }
    function loadBadge() {
        try { setBadge(parseInt(localStorage.getItem(LAUNCHER_BADGE_KEY) || '0', 10) || 0); } catch (e) {}
    }

    // ────────────────────────────────────────────
    // INIT
    // ────────────────────────────────────────────
    var panelEl;
    function init() {
        var ui = buildWidget();
        if (!ui) return;
        panelEl = ui.panel;

        chatEl = document.getElementById('pse-chat');
        typingEl = document.getElementById('pse-typing');
        quickEl = document.getElementById('pse-quick');
        inputEl = document.getElementById('pse-input');

        ui.launcher.addEventListener('click', function () { state.open ? closePanel() : openPanel('ai'); });
        document.getElementById('pse-assistant-close').addEventListener('click', closePanel);
        document.getElementById('pse-send').addEventListener('click', function () { sendUserText(inputEl.value); });
        inputEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') sendUserText(inputEl.value); });
        document.querySelectorAll('.pse-tab').forEach(function (t) {
            t.addEventListener('click', function () { switchTab(t.dataset.tab); });
        });
        document.getElementById('pse-support-send').addEventListener('click', submitSupport);

        // prefill support form
        try {
            var u = getCurrentUser();
            if (u) {
                if (u.full_name) document.getElementById('pse-s-name').value = u.full_name;
                if (u.email) document.getElementById('pse-s-email').value = u.email;
            }
        } catch (e) {}

        loadBadge();
    }

    // ─── PUBLIC API ───
    function openLiveSupport() {
        openPanel('support');
    }
    W.openLiveSupport = openLiveSupport;
    W.__pseAssistant = {
        open: function (tab) { openPanel(tab || 'ai'); },
        close: closePanel,
        send: sendUserText,
        setBadge: setBadge,
        clearBadge: clearBadge,
        openLiveSupport: openLiveSupport,
        getAnswer: getAnswer
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    console.log('✅ ai-assistant.js loaded — AI assistant & live support');
})();
