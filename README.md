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
- Featured products, category browsing, live search
- Email/password + Google sign-up and login (no SMS/phone verification)
- Guest cart (localStorage) that merges on login
- Wishlist, RFQ, order tracking, WhatsApp quote checkout
- Seller / buyer / admin dashboards
- PWA manifest + favicons
- SEO: `robots.txt`, `sitemap.xml`, Open Graph tags
- **🤖 AI Assistant** — floating chat widget on every page; answers product/price/MOQ/shipping/order/RFQ questions, recommends products, escalates to live support. Runs entirely in the browser (no API key, no cost)
- **💬 Live Support** — widget tab that saves messages to Firestore (`support_messages` + admin `messages` inbox), emails the support team, and offers WhatsApp escalation
- **🔔 Notifications** — header bell with unread badge + panel, browser notifications (opt-in), cross-tab sync, and automatic notification on cart/RFQ/order/support events
- **📧 Email upgrades** — missing `contact` / `contact-auto-reply` templates added; sending chain is now Resend → **FormSubmit (free, no API key)** → mailto fallback

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
├── ai-assistant.js         # AI assistant + live support widget (no API key)
├── notifications.js        # Notification center (bell, badge, browser notifs)
├── email.js                # Email helpers (Resend → FormSubmit → mailto)
├── Email Template/         # Transactional HTML emails
├── manifest.json           # PWA
├── sitemap.xml / robots.txt
└── vercel.json             # Routes & headers
```

## License

Proprietary — Pilot Sales Distribution. All rights reserved.
