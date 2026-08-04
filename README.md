# Pilot Sales Distribution (PSE Distribution)

Premium B2B wholesale marketplace — static frontend deployed on Vercel with Firebase Auth + Firestore, wired to a controlled inventory publication service.

## Stack

- **Frontend:** HTML, CSS, vanilla JavaScript
- **Inventory API:** `services/pse-inventory/` — deterministic, self-hostable FastAPI service implementing packet contract **v4.0.0** (vendored at `vendor/pse-inventory-packet/`)
- **Auth / DB:** Firebase Authentication + Cloud Firestore
- **Hosting:** Vercel (`vercel.json` clean URLs + security headers)
- **Email:** Resend API via `email.js` + HTML templates in `Email Template/` (auto-falls back to free keyless FormSubmit → mailto)
- **AI Assistant + Live Support:** `ai-assistant.js` — 100% client-side rule/knowledge-base engine, **no API key, no cost**
- **Notifications:** `notifications.js` — in-app notification center + browser notifications, no server required

## Inventory wiring (SalesMax → website)

The catalog, product detail and RFQ pages read **only** from the buyer-safe
public inventory API (`GET /api/inventory`, `GET /api/inventory/{slug}`). The
browser never touches the private inventory master. Pipeline:

```text
Source intake → evidence quarantine + reconciliation
  → private canonical records → owner approval + publish gate
  → deterministic allowlist publisher → separate public snapshot
  → read-only FastAPI (ETag, cursor, rate limit, last-known-good)
  → storefront catalog / detail / RFQ (Deal ID + source version preserved)
```

Key paths:

| Path | Purpose |
|------|---------|
| `vendor/pse-inventory-packet/` | Vendored v4.0.0 blueprint (contracts, reference impl, gauntlet) |
| `services/pse-inventory/` | Production service (API, publisher, store, deploy assets, tests) |
| `services/pse-inventory/data/current.json` | Active validated public snapshot |
| `apps/pse-inventory-catalog/` | Static reference catalog + RFQ payload tests |
| `docs/pse-inventory/` | Phase-0 evidence, implementation map, acceptance evidence |
| `scripts/pse-inventory-{backup,restore,rollback}.sh` | Feed recovery automation |

### Run the local preview (API + storefront in one process)

```bash
python3 -m venv .venv
./.venv/bin/python -m pip install -r services/pse-inventory/requirements.runtime.lock -r services/pse-inventory/requirements.test.lock
# generate the staging demo snapshot (demo records — NOT real SalesMax inventory)
./.venv/bin/python services/pse-inventory/fixtures/generate_demo_snapshot.py \
    --operator you --run-id local-1 --release-id local-1
# serve API + site together on :8080
./.venv/bin/python -m uvicorn pse_inventory.preview:app --app-dir services/pse-inventory --host 0.0.0.0 --port 8080
```

Then open `/products`, `/product/demo-closeout-beverage-lot`, and
`/rfq?dealId=PSE-DEMO-0001`.

### Publish live inventory (production path)

Live inventory is never uploaded directly: it flows through the same gated
pipeline the demo uses — review-only import, owner approval bound to the exact
source version, packet publish gate, privacy scan, atomic promotion.

```bash
# 1. Import the authority export into PRIVATE review-only drafts (publishes nothing)
./.venv/bin/python services/pse-inventory/migrations/100_import_verified_inventory.py \
    --source live-export.json --authority <authority-id> \
    --output-dir services/pse-inventory/data/import-$(date -u +%Y%m%d)

# 2. Review canonical_drafts.json + review_queue.json: clear every blocker
#    (availability confirmation, proof evidence, quantity, pricing mode) and
#    record an owner approval per record bound to its exact source.sourceVersion.

# 3. Publish the approved canonical records through the production CLI
./.venv/bin/python services/pse-inventory/publish_snapshot.py \
    --records approved-canonical-records.json \
    --approvals owner-approvals.json \
    --operator "<owner or documented delegate>" \
    --run-id <run-id> --release-id <release-id>
```

The publish CLI fails the whole run closed on any approval mismatch, gate
failure, or integrity problem, writes an audit report to
`data/publish_reports/` on every run, supports `--dry-run`, and atomically
promotes to `data/current.json` (prior snapshot archived to `data/history/`).
See `services/pse-inventory/contracts/canonical_inventory_record.example.json`
for the record shape and `services/pse-inventory/deploy/.env.example` for the
deployment environment template (placeholders only; real secrets live in the
secret store).

After promotion: `scripts/pse-inventory-backup.sh` to take a validated backup,
restart the API so it serves the new snapshot at `/api/inventory`, and use
`scripts/pse-inventory-rollback.sh <snapshotVersion>` if anything looks wrong.

### Run the tests

```bash
./.venv/bin/python -m pytest -q                                  # service + website contract tests
node --test apps/pse-inventory-catalog/catalog.test.mjs           # RFQ identity tests
```

The packet gauntlet must run from a **clean-room extraction** (its runtime test
suite is otherwise affected by this repository's `pytest.ini`):

```bash
rm -rf /tmp/pse-gauntlet && mkdir -p /tmp/pse-gauntlet \
  && unzip -q PSE_SalesMax_Inventory_Wiring_MASTERED_OPEN_SOURCE_v4.0.0_2026-08-03.zip -d /tmp/pse-gauntlet \
  && cd /tmp/pse-gauntlet \
  && PYTHONDONTWRITEBYTECODE=1 /path/to/repo/.venv/bin/python 07_GAUNTLET/run_super_gauntlet.py . --bootstrap
```

> **Production status: `NOT_DEPLOYED`.** Live cutover is blocked until hosting
> access, the authoritative SalesMax runtime, per-record owner approvals, and
> the multi-replica PostgreSQL/Valkey gates are evidenced. See
> `docs/pse-inventory/phase-0-evidence.md` and `staging-acceptance.json`.

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
- **⚙️ Operations, Trust & Growth Automation Pack (2026 mega-upgrade)**:
  - **📄 Document Verification Registry & Public Verify Page (`verify.html`):** every order quote, RFQ, and supplier quote is registered in a public Firestore `verifications` registry. Every generated PDF now carries a **QR code + "Verify Authenticity" block** linking to `/verify?ref=…`, where anyone can confirm a document is genuine (type, status, items, total) — a strong anti-fraud trust signal; status moves in admin/seller flows stay in sync with the registry. Guest buyers can **track orders via email-gated registry lookup** (`track-order.html`) and are invited to convert to a full account from `order-success.html` (`?email=` prefills `register.html`). Guest orders are also written to Firestore (`guest: true`) so admins see every sale.
  - **🧾 Statement of Account (PDF):** buyers download a branded monthly statement listing all of their quotes/orders with statuses and combined value from the buyer dashboard — perfect for finance teams & audits (`quote-pdf.js: buildStatementPdf`).
  - **⚡ Quick Order by SKU (`products.html`):** B2B buyers paste lines like `SKU, qty` / `SKU | qty` / `SKU qty` into a quick-order modal, preview parsed lines with MOQ auto-rounding & not-found flags, then add everything to cart in one click (guest + account carts).
  - **🔔 Stock & Price Watch Alerts (`product-detail.html`):** buyers set "notify me when back in stock" or a target price; when stock returns or the price hits target, the page surfaces the alert inline, toasts, pushes a notification and auto-deactivates it (Firestore `price_alerts`).
  - **🛒 Conversion Nudges (`cart.html`):** a next-tier savings nudge ("add N more to unlock 7% bulk pricing — save $X") under every line item, plus an **abandoned-cart banner** after 24 h idle with Checkout / WhatsApp shortcuts (dismissible).
  - **🏢 B2B Checkout Fields & Address Book (`checkout.html`, `account.html`):** company name + VAT/Tax ID captured at checkout and in account settings, printed on all quotation PDFs; the saved-address book (`addresses` collection) one-click fills the checkout form.
  - **💳 Net-30 Credit Meter (`account.html`):** approved trade-credit buyers see a live usage meter (used vs. approved limit, green/amber/red) computed from open Net-30 orders.
  - **📈 Admin Analytics & Ops (`admin-dashboard.html`):** Chart.js **30-day revenue chart**, **one-click Orders CSV export** (Excel-friendly, BOM + quoting), status changes now **email the buyer automatically** (shipped → shipping-update template; processing / delivered / cancelled → notification template) and sync to the public verification registry; sending a supplier quote registers both quote documents. Sellers get **🔴 low-stock / out-of-stock badges** at MOQ threshold (`seller-dashboard.html`).
  - **🌍 ZMW (Zambian Kwacha, K)** added to the global currency switcher alongside USD / EUR / GBP / CAD.
  - **🖼️ Image optimization:** the 782 KB `logo.jpg` is now a 5 KB `logo.webp` site-wide (plus `caden.webp`, `caden-gibson.webp`); transactional emails keep the JPG asset for email-client compatibility.
  - **📱 PWA Service Worker (`sw.js`):** network-first for HTML, cache-first for static assets — faster repeat visits and a graceful offline shell.
  - **🍪 Cookie consent bar + 💬 floating WhatsApp button** on all customer pages (`main.js`): the button's prefilled message is page-aware (includes the product title on detail pages) and stays hidden on admin / seller / auth pages; consent persists in localStorage.
  - **🚨 Client error monitoring:** uncaught errors & unhandled promise rejections are deduped (max 3 per session) and logged to Firestore `error_log` with page URL + browser for admin triage.
  - **🛡️ Spam protection (`contact.html`, `newsletter.js`):** hidden honeypot field, 3-second time-trap and 60-second per-browser rate limit on the contact form; 30-second rate limit on newsletter signups.
  - **🗂️ Firestore composite indexes (`firestore.indexes.json`):** nine ready-to-deploy indexes for the hottest list queries — deploy with `firebase deploy --only firestore:indexes` alongside the rules.
  - **🔍 Product JSON-LD structured data** injected on product pages (offers / availability / aggregate rating) for richer Google listings.
- **🧭 Self-Service, Discovery & Fulfilment Pack (2026 round 2)**:
  - **🚫 Buyer self-service order cancellation (`buyer-dashboard.html` + rules):** pending orders get a **Cancel** button; Firestore rules let an owner cancel *only* their own *pending* order — diff-locked to `status/cancelled_at` keys (fulfilment moves stay admin-only). The verification registry stays in sync.
  - **⭐ Address book 2.0 (`account.html` · `checkout.html`):** optional labels ("Head Office", "Warehouse B"), **Edit** existing addresses, and a **⭐ Set as default** star — checkout auto-applies your default address and pins it to the top of the saved-address picker.
  - **📊 Buyer spend insights:** the buyer dashboard shows **Total Spent / Orders / Avg. Order / In Progress** stat cards computed live from the orders cache.
  - **🔗 Product share & delivery ETA (`product-detail.html`):** one-tap **WhatsApp / Email / Copy-link** share buttons plus a "Ships within N days · Est. arrival" line computed from the product lead time.
  - **🕘 Recently Viewed rail (`index.html`):** product pages record views (localStorage, max 12); the home page shows a clearable **Recently Viewed** rail so returning buyers pick up where they left off.
  - **⌨️ "/" keyboard shortcut:** pressing `/` anywhere (outside form fields) focuses the header search — marketplace power-user convention.
  - **🗃️ Admin order filters & search:** status chips (*All / Pending / Processing / Shipped / Delivered / Cancelled*) + live search across reference, customer name, email & phone with "N of M orders" counts.
  - **📦 Warehouse Packing Slip PDF (`quote-pdf.js: buildPackingSlipPdf`):** fulfilment document with **no prices** — ship-to block, order meta strip, pick table with SKU sub-lines + ☐ PICKED / ☐ PACKED checkboxes, buyer notes, Picked/Packed/QC signature strip, and the QR authenticity block. One-click per order (processing/shipped) in the admin dashboard.
  - **🏷️ Admin product command view:** filter chips (*All / Active / Pending / Low Stock / Out of Stock*), **on-hand inventory value** (Σ stock × price) in the header, and low-stock / out-of-stock badges inline in the table.
  - **🏆 Top Buyers by Revenue:** the customers tab surfaces the top 5 spenders (medals, order counts, lifetime spend) computed from the orders cache.
  - **📴 Offline page (`offline.html`):** branded offline shell (retry + WhatsApp lifeline) — service worker v2 precaches it and serves it as the navigation fallback.
  - **🗺️ Sitemap** now includes `/verify`.
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
| `products` · `orders` · `rfqs` · `cart` · `wishlist` | marketplace data (guest orders are stored with `guest: true`) |
| `seller_applications` · `chats` · `addresses` | seller onboarding, buyer↔seller chat threads, saved checkout address book |
| `trade_credit_applications` | corporate Net-30 credit applications |
| `verifications` | public document-authenticity registry (order quotes, RFQs, supplier quotes — powers `/verify` + guest order tracking) |
| `price_alerts` | back-in-stock & target-price watch alerts (one-shot, auto-deactivated on hit) |
| `error_log` | client-side error monitoring (page URL, message, deduped) |
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
