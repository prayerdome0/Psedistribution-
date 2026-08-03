# Pilot Sales Distribution (PSE Distribution)

Premium B2B wholesale marketplace — static frontend deployed on Vercel with Firebase Auth + Firestore.

## Stack

- **Frontend:** HTML, CSS, vanilla JavaScript
- **Auth / DB:** Firebase Authentication + Cloud Firestore
- **Hosting:** Vercel (`vercel.json` clean URLs + security headers)
- **Email:** Resend API via `email.js` + HTML templates in `Email Template/` (auto-falls back to free keyless FormSubmit → mailto)
- **AI Assistant + Live Support:** `ai-assistant.js` — 100% client-side rule/knowledge-base engine, **no API key, no cost**
- **Notifications:** `notifications.js` — in-app notification center + browser notifications, no server required

## Local development

Serve the repo root with any static server (Firebase and clean URLs need a host that respects `vercel.json` rewrites, or open `.html` files directly):

```bash
npx serve .
# or
python3 -m http.server 3000
```

Key routes (clean URLs on Vercel):

| Path | File |
|------|------|
| `/home` | `index.html` |
| `/products` | `products.html` |
| `/product/:slug` | `product-detail.html` |
| `/cart` · `/checkout` | cart / checkout |
| `/login` · `/register` · `/account` | auth & profile |
| `/admin-dashboard` · `/seller-dashboard` · `/buyer-dashboard` | role dashboards |
| `/rfq` · `/wishlist` · `/chat` · `/track-order` | marketplace tools |
| `/supplier-verification` | supplier trust page |
| `/order-success` | post-checkout confirmation |

## Features

- Landing image carousel — full-width promo images that auto-scroll horizontally (arrows, dots, swipe, pause-on-hover); no text banner
- Featured products, category browsing
- **💰 B2B Marketplace Monetization Suite (High-Revenue Unit Economics)** — comprehensive monetization system built into the marketplace:
  - **👑 Tiered VIP Supplier Memberships:** Sellers select between *Basic ($0/mo, 10% commission)*, *Gold ($299/mo, 5% commission, Gold badge, priority ranking)*, or *Platinum Enterprise ($799/mo, 0% commission, Platinum badge, top placement)* when onboarding (`become-seller.html`) or upgrading inside the seller dashboard (`seller-dashboard.html`). Admin dashboard displays tier status and commission tier for every seller.
  - **🚀 Sponsored Products (Retail Media Ads):** Sellers can sponsor any active listing right from their dashboard (`seller-dashboard.html`) for 7, 30, or 90 days ($49 / $149 / $399). Promoted items receive an automatic ranking boost (`+20` relevance score) to #1 in Pro Search and Category grids (`products.html`, `index.html`) with a highlighted **"🚀 SPONSORED"** badge.
  - **📄 Formal B2B Commercial Quotations & Invoices (PDF Generator):** Commercial buyers can instantly download printable, publication-quality **Official Commercial Invoices (PDF)** on order checkout confirmation (`order-success.html`, `buyer-dashboard.html`) and **Official RFQ Procurement Documents (PDF)** for any submitted Request for Quote (`rfq.html`, `buyer-dashboard.html`), including itemized bulk pricing, MOQ breakdowns, and Escrow Trade Assurance terms.
  - **💬 Quotation → WhatsApp as a Real PDF:** Checkout's **"Send Quote PDF via WhatsApp"** (`checkout.html`) and the **"Send via WhatsApp (PDF)"** button on every RFQ (`rfq.html`) generate a real, branded, itemized quotation/procurement PDF on-device with **jsPDF** (`quote-pdf.js` shared engine). On mobile the native share sheet lets the buyer attach the PDF straight into a WhatsApp chat (Web Share API Level 2); on desktop the PDF auto-downloads and the WhatsApp chat opens with a prefilled message prompting attachment. Falls back to a formatted text message if the PDF engine is unavailable — zero server cost.
  - **🎟️ Promo Code on Registration:** New accounts can enter an optional **promo/referral code** at signup (`register.html`, email + Google paths). Codes are validated live against the same admin-managed Firestore `coupons` collection used at checkout (`PSE_PREMIUM.lookupCoupon` in `premium.js`), stored on the user profile, and **auto-applied to the buyer's first order** at checkout — then cleared after redemption so it never double-applies.
- **🌐 Enterprise B2B Wholesale Pack (Procurement & Trade Assurance Innovations)**:
  - **📊 Dynamic Volume Tier Pricing & Evaluation Samples:** Product detail pages (`product-detail.html`) feature interactive bulk wholesale pricing tables (*Standard MOQ -> Bulk 7% Off -> Wholesale 15% Off -> Enterprise 25% Off*) that automatically highlight the active tier row and update unit pricing in real time as quantities change. A **"🧪 Order 1 Sample"** button allows commercial buyers to order a single evaluation sample at retail rate without MOQ restrictions.
  - **🛡️ 5-Step Escrow Trade Assurance Tracker:** Order tracking (`track-order.html`) displays a visual 5-step escrow milestone progress timeline (*🔒 Step 1: Escrow Secured → 🏭 Step 2: In Production → 📋 Step 3: Inspected & Passed → 🚢 Step 4: In Transit / Shipped → ✅ Step 5: Escrow Released*).
  - **🔄 One-Click Quick Reorder:** Repeat B2B buyers can click **"🔄 Quick Reorder"** on past purchases inside the buyer dashboard (`buyer-dashboard.html`) to instantly merge all items into their active cart and navigate to checkout.
  - **🌍 Global Incoterms Trade Basis Selector:** Buyers select international procurement trade terms (**EXW** - Ex Works, **FOB** - Free on Board, or **DDP** - Delivered Duty Paid) on checkout (`checkout.html`) and product detail pages (`product-detail.html`), which carry over directly onto the official Commercial Invoices.
  - **🏅 Supplier Trust KYC & Factory Certifications:** Supplier verification page (`supplier-verification.html`) showcases verified supplier badges (*✓ ISO 9001 Certified, ✓ Verified Manufacturer, ✓ On-Site Factory Inspected, ✓ 100% Escrow Assurance*).
- **⚡ Ultimate B2B Wholesale Platform Upgrades (Supplier Scale & Trade Execution)**:
  - **📥 Bulk CSV Catalog Import, Export & Template:** Sellers and admins can download a formatted CSV product template (`pse_wholesale_products_template.csv`), bulk-import hundreds of wholesale listings at once via an interactive CSV uploader modal in `seller-dashboard.html` and `admin-dashboard.html`, and export their live catalog to CSV anytime.
  - **💬 Interactive RFQ Quote Bidding & Order Conversion Engine:** Suppliers can browse active buyer RFQs in their dashboard (`seller-dashboard.html`) and submit formal quote bids (*Unit Price, Est. Lead Time, MOQ Offered, Terms*). Buyers can compare received supplier bids inside their dashboard (`buyer-dashboard.html`) and click **"✅ Accept Quote & Convert to Order"** to instantly generate a pre-filled checkout order at the agreed negotiated rate.
  - **🏪 Dedicated Branded Supplier Storefronts (`supplier-store.html`):** Verified suppliers get dedicated company storefront pages (`/supplier-store.html?id=<sellerId>`) displaying their company banner, logo, Gold/Platinum VIP badges, Trust KYC certifications, WhatsApp/Email contact buttons, and their full filterable product catalog.
- **🌍 Global Enterprise & Financial Suite (Cross-Border Procurement & Trade Credit)**:
  - **💱 Global Currency Switcher (`window.PSE_CURRENCY`):** Header currency selector (`USD $ | EUR € | GBP £ | CAD $`) converts wholesale unit prices, volume tier brackets, and cart subtotals in real time using accurate exchange rates while maintaining USD as the underlying settlement currency.
  - **💳 Corporate Net-30 Trade Credit Application & Checkout:** B2B commercial buyers can request corporate credit limits ($5,000–$50,000) inside their account settings (`account.html`). Approved buyers can select **"Net-30 Commercial Invoice (Pay in 30 Days)"** at checkout (`checkout.html`), managed directly by admins in `admin-dashboard.html`.
  - **🚢 Bulk Shipping Freight Estimator & Lead Time Calculator:** Product detail pages (`product-detail.html`) feature an interactive freight calculator estimating unit shipping rates and lead times across destinations (*North America, Europe, Asia, Africa, Middle East, Latin America*) and shipping modes (*Ocean Container / LCL, Standard Air Cargo, Express Air Freight*).
  - **⚖️ Side-by-Side B2B Product Specs & MOQ Comparison Matrix:** Commercial buyers can select up to 4 competing products on `products.html` and compare their *Wholesale Price, Volume Tier Brackets, MOQ, Available Stock, Lead Time, Supplier VIP Tier, Incoterms Basis, and KYC Certifications* side-by-side in a responsive comparison matrix.
- **🚀 Procurement Negotiation Loop, Referral Growth & Security Pack**:
  - **💵 Supplier Quote Response Loop (closes the RFQ cycle):** In the admin dashboard RFQs tab, admins respond to any RFQ with a formal priced quote (*unit price, MOQ, lead time, validity window, terms*) via the **Send Supplier Quote** modal with a live total estimator. The buyer instantly sees a highlighted **"SUPPLIER QUOTE RECEIVED"** card on `rfq.html` with per-unit pricing, extended total, MOQ, lead time & validity date — and can **Download the branded Supplier Quote PDF** (jsPDF via the shared `quote-pdf.js` engine) or **Accept Quote** in one click. Status flows *pending → reviewing → quoted → accepted* across both dashboards; admins can re-quote or download the same PDF for records/WhatsApp forwarding.
  - **🎁 Referral Invite Links & One-Tap WhatsApp Sharing:** The Rewards section in `account.html` now exposes a copyable invite link (`/register?ref=CODE`) plus one-tap WhatsApp sharing. Registration (`register.html`) auto-captures `?ref=` (shows an invitation banner; awards loyalty points to **both** sides via `PSE_PREMIUM.maybeApplyReferral`, one-time guarded) and `?promo=` (prefills & live-validates the promo-code field). Email/password sign-ups now trigger Firebase verification emails automatically.
  - **📲 Admin → Buyer WhatsApp Order Updates:** Every order card in the admin dashboard has a green **Notify** button that opens WhatsApp to the buyer's phone with a professional status-aware update message (received / processing / shipped / delivered) including quote #, order total, and the tracking link.
  - **🔐 Firestore Security Rules (`firestore.rules` + `firebase.json`):** Production-ready role-based rules for all 25 collections (guest / buyer / seller / admin) — orders & RFQs are owner-or-admin readable, fulfillment status moves are admin-only, RFQ quote acceptance is restricted to the owning buyer. Deploy with `firebase deploy --only firestore:rules`. Documented ⚠️ cross-user counter writes (referral bonuses, coupon usage) are flagged for Cloud Functions at scale.
  - **📎 Corporate Purchase Order (PO) Reference Tracking:** Commercial buyers can attach their official corporate PO number (e.g. from SAP / Oracle / NetSuite ERP) during checkout and RFQ submission (`checkout.html`, `rfq.html`), which carries over directly onto Official Commercial Invoices (`order-success.html`, `buyer-dashboard.html`).
- **🔎 Pro Search suggestions** — the header search bar on every page is a professional suggestion engine: instant debounced results as you type (no Enter needed), ranked by prefix/word/substring relevance, rich product previews (thumbnail, brand, ★ rating, price, stock, ✓ Verified badge), category & brand chips, recent searches (clearable) and popular searches, full keyboard navigation (↑/↓/Enter/Esc, ARIA listbox), match highlighting, and a "See all N results" footer. Catalog is cached for 10 minutes (sessionStorage), loaded once from Firestore — 100% real products only, no fake or sample demo catalogs. Powered by the shared `search-pro.js` — no API keys, no server
- **💎 Premium Suite (100% admin-managed)** — a full marketing, loyalty & accountability layer powered by the shared `premium.js` engine, all controlled from the admin dashboard:
  - **🎟️ Coupons & Promo Codes** — admins create percent- or fixed-amount discount codes with minimum spend, usage caps and expiry dates (admin **Coupons** tab). Buyers redeem them live at `checkout.html`; the discount flows into the order totals and is recorded on the saved order.
  - **📣 Site-wide Promo Banners** — admins publish a scheduled announcement bar (message, emoji, link, custom colors, start/end window) that renders at the very top of **every** customer-facing page via `premium.js` (admin **Promo Banners** tab). Auto-hidden on the admin dashboard.
  - **⚡ Flash Sales** — admins schedule site-wide percentage-off sales with a live/off status and time window (admin **Flash Sales** tab).
  - **🏆 Loyalty Points + Tiered VIP Program** — members earn points on every order (configurable points-per-$ × their tier multiplier). Four tiers — *Bronze → Silver → Gold → Platinum* — with escalating earn multipliers. Members see their points, tier, progress to the next tier and a referral code in a new **Rewards & Wallet** tab on `account.html`.
  - **💰 Store-Credit Wallet + Referrals** — admins credit/debit member wallets (refunds, bonuses); members share a referral code that awards points to both referrer and invitee (admin **Loyalty & Wallet** tab).
  - **🛡️ Admin Audit Log** — every premium action (coupon/banner/flash create·toggle·delete, settings save, wallet adjust, coupon redemption, admin login) is recorded with actor, action, detail and timestamp in the admin **Audit Log** tab for full accountability.
  - **⭐ Robust admin-role detection** — the account page now detects the admin role from the live Firestore doc *and* the cached session, so admins instantly see an **👑 Administrator** crown and the **Admin Dashboard** shortcut with no flash of missing controls.
- **🚫 100% Real Only — No Fake or Demo Content** — all sample, demo, placeholder, and fallback products (`FALLBACK_PRODUCTS`), fake statistics (`12,000+`, `580+`, `1,234+`), and demo toast alerts have been completely removed across the catalog, search bar, AI assistant, product detail pages, and home page. The site displays honest, real-time data from Firestore with clean empty states when inventory or statistics are zero.
- Email/password + Google sign-up and login (no SMS/phone verification)
- Guest cart (localStorage) that merges on login
- Wishlist, RFQ, order tracking, WhatsApp quote checkout
- Seller / buyer / admin dashboards
- PWA manifest + favicons
- SEO: `robots.txt`, `sitemap.xml`, Open Graph tags
- **🤖 AI Assistant** — floating chat widget on every page; answers product/price/MOQ/shipping/order/RFQ questions, recommends products, escalates to live support. Runs entirely in the browser (no API key, no cost)
- **💬 Live Support with instant auto-reply** — the first response is always automatic: the customer instantly gets an emailed confirmation (`contact-auto-reply`) the moment they send a message, while the ticket (flagged `auto_replied`) lands in the admin **Live Support** tab where admins resolve it or draft a real reply
- **🔔 Notifications** — header bell with unread badge + panel, browser notifications (opt-in), cross-tab sync, and automatic notification on cart/RFQ/order/support events
- **🎈 Center popup on the home page** — festival-aware welcome popup in the middle of the screen: on holiday days it shows an auto-generated branded greeting image, otherwise a promo; includes quick newsletter sign-up, shown max once per day
- **📨 Real newsletter subscriptions** — the home-page subscribe form (and popup) now store every subscriber in Firestore `subscribers`, de-duplicate by email, send a confirmation email, ping the admin inbox — and the admin **Subscribers** tab lists, emails, deletes and CSV-exports them
- **✉️ Admin Email Center** — compose & send real emails from the dashboard to a single user, all subscribers, buyers, sellers or everyone; message replies in the Messages tab now email the customer too; every send is logged in `email_log` with history view
- **⭐ Real customer reviews only** — product reviews are written by logged-in customers (no samples/placeholders), aggregated into honest ratings (average + count synced back to the product), shown with a "Verified customer" chip, and moderated from the admin **Reviews** tab
- **🏅 Verified sellers & anti-scam Trust system** — admins grant/strip the blue **✓ Verified** badge (applies to all the seller's products); products/cards show verified state, a "✓ Verified sellers only" filter exists on the catalog, and every product page has a **🚩 Report** button feeding the admin **Trust & Safety** tab (resolve reports, suspend scammers)
- **🗓️ Festival Calendar with auto greetings** — 19 built-in holidays & sale events (Easter/Thanksgiving/Black Friday/computed movable feasts) plus admin-added custom festivals; on each festival day, greeting emails with an **auto-generated branded festival image** (canvas, includes the company name) are sent to all subscribers & users exactly once (Firestore `festival_runs` claim); admin can preview/download the generated cards, send campaigns manually, or toggle auto-send
- **📧 Email upgrades** — missing `contact` / `contact-auto-reply` templates added, plus new `festival` and `admin-message` templates; sending chain: Resend → **FormSubmit (free, no API key)** → mailto fallback

## 404-proofing

- All header/footer/nav links are **absolute** (`/products`, `/cart`, …) so they never 404 on deep URLs like `/product/slug`
- `/product/:path*` rewrites in `vercel.json` cover every product URL
- `404.html` now includes a **deep-link rescue**: if it is ever served for a valid clean route (e.g. hosts where the Vercel rewrites are not applied), it instantly forwards `/product/<slug>` → `product-detail.html?slug=…` and other known routes to their pages, instead of stranding visitors
- `product-detail.html` parses `?slug=`, `?id=`, `/product/<slug>` and `/product-detail/<slug>` (URL-decoded, trailing-slash tolerant), redirects unknown products to `/products` with an explanation message, and shows clean empty states when no products match — 100% real products only without fake or demo sample data
- Missing `main.js` (referenced by `chat.html`) recreated — no more broken-script 404

## Configuration

Firebase config is embedded in each page (project `pilot-sales-distribution`).  
Email sending uses Resend — set a valid key in `email.js` for production; otherwise the free keyless FormSubmit transport handles it.

## Project structure

```
├── index.html              # Home
├── products.html           # Catalog
├── product-detail.html     # PDP
├── supplier-store.html     # Branded supplier company storefront
├── cart.html / checkout.html / order-success.html
├── login.html / register.html / account.html
├── admin-dashboard.html / seller-dashboard.html / buyer-dashboard.html
├── style.css               # Shared stylesheet (v7)
├── main.js                 # Shared core (Firebase init, toast, counters) — guarded
├── search-pro.js           # Pro Search suggestions engine (header search on every page)
├── ai-assistant.js         # AI assistant + live support widget (no API key)
├── notifications.js        # Notification center (bell, badge, browser notifs)
├── email.js                # Email helpers (+ festival & admin-message templates)
├── newsletter.js           # Real newsletter subscriptions (Firestore subscribers)
├── holiday-engine.js       # Festival calendar + branded card generator + auto emails
├── admin-extensions.js     # Admin: subscribers, support, email center, reviews, trust, festivals
├── premium.js              # Premium suite engine + admin (coupons, banners, flash sales, loyalty, wallet, audit)
├── Email Template/         # Transactional HTML emails
├── manifest.json           # PWA
├── sitemap.xml / robots.txt
└── vercel.json             # Routes & headers
```

### Firestore collections used

| Collection | Purpose |
|------------|---------|
| `users` | buyers / sellers / admins (incl. `role`, `status`, `verified`) |
| `products` · `orders` · `rfqs` · `cart` · `wishlist` | marketplace data |
| `reviews` | customer-written reviews (no seeds; aggregated into product rating) |
| `messages` · `support_messages` | contact + live support inbox (`auto_replied` flag on tickets) |
| `subscribers` | newsletter subscribers (shown to admin) |
| `reports` | scam / trust reports from product pages |
| `holidays` | admin-added custom festivals |
| `festival_runs` | once-per-year claim that festival emails already went out |
| `email_log` | history of every sent campaign/reply (Email Center) |
| `config/holidays` | festival auto-email toggle |
| `config/premium` | premium suite settings (loyalty/wallet/coupons/banners/flash toggles, earn rate, referral bonuses) |
| `config/loyalty_tiers` | VIP tier ladder (Bronze/Silver/Gold/Platinum thresholds, multipliers, perks) |
| `coupons` | admin-created discount codes (percent/fixed, min spend, usage cap, expiry) |
| `promo_banners` | admin-published site-wide banner bars (scheduled) |
| `flash_sales` | admin-scheduled site-wide % -off sales |
| `point_ledger` | per-user loyalty point & wallet transaction history |
| `referrals` | referral attributions (referrer ↔ invitee + bonuses granted) |
| `audit_log` | every admin/premium action (actor, action, detail, timestamp) |

## License

Proprietary — Pilot Sales Distribution. All rights reserved.
