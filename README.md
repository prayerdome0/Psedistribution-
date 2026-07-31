# Pilot Sales Distribution (PSE Distribution)

Premium B2B wholesale marketplace — static frontend deployed on Vercel with Firebase Auth + Firestore.

## Stack

- **Frontend:** HTML, CSS, vanilla JavaScript
- **Auth / DB:** Firebase Authentication + Cloud Firestore
- **Hosting:** Vercel (`vercel.json` clean URLs + security headers)
- **Email:** Resend API via `email.js` + HTML templates in `Email Template/`

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

- Featured products, category browsing, live search
- Guest cart (localStorage) that merges on login
- Wishlist, RFQ, order tracking, WhatsApp quote checkout
- Seller / buyer / admin dashboards
- PWA manifest + favicons
- SEO: `robots.txt`, `sitemap.xml`, Open Graph tags

## Configuration

Firebase config is embedded in each page (project `pilot-sales-distribution`).  
Email sending uses Resend — set a valid key in `email.js` for production.

## Project structure

```
├── index.html              # Home
├── products.html           # Catalog
├── product-detail.html     # PDP
├── cart.html / checkout.html / order-success.html
├── login.html / register.html / account.html
├── admin-dashboard.html / seller-dashboard.html / buyer-dashboard.html
├── style.css               # Shared stylesheet (v7)
├── email.js                # Resend email helpers
├── Email Template/         # Transactional HTML emails
├── manifest.json           # PWA
├── sitemap.xml / robots.txt
└── vercel.json             # Routes & headers
```

## License

Proprietary — Pilot Sales Distribution. All rights reserved.
