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
- **🔎 Pro Search suggestions** — the header search bar on every page is a professional suggestion engine: instant debounced results as you type (no Enter needed), ranked by prefix/word/substring relevance, rich product previews (thumbnail, brand, ★ rating, price, stock, ✓ Verified badge), category & brand chips, recent searches (clearable) and popular searches, full keyboard navigation (↑/↓/Enter/Esc, ARIA listbox), match highlighting, and a "See all N results" footer. Catalog is cached for 10 minutes (sessionStorage), loaded once from Firestore, and works offline via an embedded fallback catalog. Powered by the shared `search-pro.js` — no API keys, no server
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
- `product-detail.html` parses `?slug=`, `?id=`, `/product/<slug>` and `/product-detail/<slug>` (URL-decoded, trailing-slash tolerant), has a fallback catalog synced with the store catalog (all 8 products), redirects unknown products to `/products` with a message, and still renders from local data if the Firebase CDN can't load
- Missing `main.js` (referenced by `chat.html`) recreated — no more broken-script 404

## Configuration

Firebase config is embedded in each page (project `pilot-sales-distribution`).  
Email sending uses Resend — set a valid key in `email.js` for production; otherwise the free keyless FormSubmit transport handles it.

## Project structure

```
├── index.html              # Home
├── products.html           # Catalog
├── product-detail.html     # PDP
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

## License

Proprietary — Pilot Sales Distribution. All rights reserved.
