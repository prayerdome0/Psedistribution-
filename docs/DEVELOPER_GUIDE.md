# Developer Guide — Pilot Sales Distribution

This guide is for engineers working **on** the platform (not operators
running it, not admins using the dashboard). It covers the architecture,
the local development workflow, and the conventions you need to follow
when contributing code.

For task-specific guides, see:

- `ADMIN_MANUAL.md` — using the dashboard
- `OPERATOR_RUNBOOK.md` — running the platform in production
- `API.md` — the inventory API reference
- `vendor/pse-inventory-packet/` — the v4.0.0 inventory contract

---

## 1. Architecture in 30 seconds

```
┌────────────────────────────────────────────────────────────────────────┐
│                            BROWSER                                     │
│  HTML / CSS / vanilla JS. Firebase JS SDK from gstatic.                │
│  Reads from inventory API; writes to Firestore for users, cart, RFQ.   │
└────────┬────────────────────────────────────┬──────────────────────────┘
         │                                    │
         │  GET /api/inventory                │  Firebase Auth
         │  GET /api/inventory/{slug}         │  Firestore (cart, RFQ,
         │  POST /api/internal/...            │   users, reviews, etc.)
         │                                    │
         ▼                                    ▼
┌────────────────────────┐         ┌──────────────────────────┐
│   FastAPI inventory    │         │   Firebase (managed)     │
│   service (v4.0.0)     │         │   Auth + Firestore       │
│                        │         │                          │
│  • ETag + cursor       │         │  Security rules: RBAC,   │
│  • Rate limit          │         │  owner-only writes,      │
│  • Last-known-good     │         │  admin-only deletes.     │
│  • Privacy-safe output │         │                          │
└────────┬───────────────┘         └──────────────────────────┘
         │
         │  Reads from
         ▼
┌────────────────────────┐
│   Public snapshot      │
│   /data/current.json   │  Produced by publish_snapshot.py
│   (atomic, immutable   │  with owner-approval binding,
│    on each publish)    │  packet gate, privacy scan.
└────────────────────────┘
```

The vendor packet (`vendor/pse-inventory-packet/`) is the **contract**
for everything inventory-related. The FastAPI service is the
**reference implementation** of that contract. The frontend reads the
API and **never** touches the private inventory master.

---

## 2. Local development

### Prerequisites

- Python 3.11+ (3.13 is the production pin)
- Node 20+ (for `node --check` and Playwright tests)
- `git`, `make`, `curl`
- (Optional) Docker + Docker Compose for the full self-hosted stack

### First-time setup

```bash
git clone https://github.com/prayerdome0/Psedistribution-.git
cd Psedistribution-

# Frontend: nothing to build (static site).
# Serve it with any HTTP server:
python3 -m http.server 8080 &
# → open http://localhost:8080

# Inventory API + site in one process (the way the demo runs):
python3 -m venv .venv
.venv/bin/pip install -r services/pse-inventory/requirements.runtime.lock
.venv/bin/pip install -r services/pse-inventory/requirements.test.lock

# Generate the staging demo snapshot (demo records — not real inventory)
.venv/bin/python services/pse-inventory/fixtures/generate_demo_snapshot.py \
    --operator you --run-id local-1 --release-id local-1

# Serve API + site together on :8080
.venv/bin/python -m uvicorn pse_inventory.preview:app \
    --app-dir services/pse-inventory --host 0.0.0.0 --port 8080
```

Then open:

- <http://localhost:8080/> — homepage
- <http://localhost:8080/products> — catalog
- <http://localhost:8080/product/demo-closeout-beverage-lot> — detail
- <http://localhost:8080/rfq?dealId=PSE-DEMO-0001> — RFQ
- <http://localhost:8080/api/inventory> — raw inventory API

### Optional: run the Firebase emulators

```bash
npx --yes firebase-tools emulators:start \
    --only auth,firestore,storage \
    --project pilot-sales-distribution
```

This gives you a local auth + Firestore + storage stack with no
external dependencies. The storefront will pick it up automatically
once you switch the Firebase config in `main.js` to point at the
emulators (or use `firebase.json` + `firebase use --emulator`).

### Optional: full self-hosted stack with Docker Compose

```bash
cp .env.example .env          # then fill in all the placeholders
docker compose up -d
docker compose ps             # all services should be healthy
```

This is the most representative dev environment. See
`docker-compose.yml` for what gets started (storefront + inventory +
postgres + valkey + firebase emulators).

---

## 3. Code conventions

### JavaScript (frontend)

- **No build step.** All JS is plain ES2019+, served as-is. No
  bundler, no TypeScript, no framework. This is a deliberate choice
  to keep the surface area for bugs (and the deploy complexity) small.
- **No global state** beyond `window.PSE_CONFIG` and the explicit
  exports in `main.js`. Each page's inline script is a small,
  focused module.
- **XSS-safe by construction.** Never `innerHTML` an unescaped string.
  Use the `esc()` helper (already in `main.js` and `recently-viewed.js`)
  or build DOM nodes with `document.createElement`.
- **No `eval`, no `new Function`.** CSP forbids both (`script-src
  'self' 'unsafe-inline' https://www.gstatic.com ...`).
- **Accessibility first.** Every interactive element has a label
  (visible or `aria-label`). Every form input has a `<label>`.
  Focus rings are visible. The reduced-motion media query is
  respected.

### Python (inventory service)

- **Type hints everywhere.** The codebase is 100% typed and `mypy
  --strict` clean.
- **Dataclasses for config**, never dicts.
- **Fail-closed.** Every public endpoint validates its inputs and
  refuses to act on malformed data. The API server crashes on start
  if its required secrets are missing rather than running in a
  half-configured state.
- **No side effects in module top-level.** All setup happens in
  `create_app(settings)` or in explicit `main()` functions. This is
  what makes the FastAPI app safe to import for the OpenAPI export
  script (`scripts/export-openapi.py`).

### HTML / CSS

- **Semantic HTML5.** `<main>`, `<nav>`, `<article>`, `<aside>`,
  `<header>`, `<footer>`. Headings in order (no skipping levels).
- **BEM-ish class names.** `.card`, `.card__title`, `.card--featured`.
  No utility-class soup.
- **Dark mode via `html.dark-mode`.** Every color in CSS uses a
  custom property from `:root` so the dark theme is a single class
  swap away.
- **Responsive first.** Mobile (320px) → tablet (768px) → desktop
  (1280px). Test with the Chrome dev-tools device toolbar.

---

## 4. Where to put new code

| You want to add… | Put it in… |
|---|---|
| A new page | A new `*.html` at the repo root + a rewrite in `vercel.json` + an entry in `sitemap.xml` |
| A new global JS helper | `main.js` (it auto-runs and exposes globals) |
| A page-specific JS module | A new `*.js` at the repo root, included after `main.js` |
| A new inventory API endpoint | `services/pse-inventory/pse_inventory/api.py` + update `vendor/pse-inventory-packet/03_CONTRACTS/` |
| A new Firestore collection | Update `firestore.rules` (deny-by-default) + add an index in `firestore.indexes.json` |
| A new env var | `.env.example` (template only) + `tests/test_env_hygiene.py` (it'll catch you) |
| A new email template | `Email Template/<name>.html` + register in `email.js` |

---

## 5. Testing

The repo has three test surfaces:

### 5.1 Python (pytest)

```bash
.venv/bin/python -m pytest -o addopts='' \
    services/pse-inventory/tests \
    tests/pse_inventory \
    tests/test_env_hygiene.py
```

136 tests cover the inventory pipeline end-to-end:
- contract lock (the packet never changes shape)
- snapshot publish + rollback
- last-known-good serving
- HMAC revalidation
- Postgres role separation
- deployment security (cap_drop, read_only, no-new-privileges)

### 5.2 Node (built-in test runner)

```bash
node --test apps/pse-inventory-catalog/catalog.test.mjs
```

4 tests verify the catalog fixtures and the RFQ payload contract.

### 5.3 HTML / JS lint (CI)

The CI workflow runs `node --check` on every `*.js` and a
well-formedness check on every `*.html`. No setup needed — it's part
of `.github/workflows/ci.yml`.

### 5.4 End-to-end (Playwright) — to be added

The static site is a strong candidate for Playwright smoke tests
(load each page, assert a key element is visible, screenshot for
visual regression). Skeleton to be added in
`tests/e2e/`. If you add it, please keep it under 60s total.

---

## 6. Database schema

The Firestore schema is documented by example in `firestore.rules`.
The Postgres schema (for the inventory service) lives in
`services/pse-inventory/migrations/`. The full ERD is in
`docs/api/erd.png` (generated from migrations by
`scripts/erd-from-migrations.py`).

For the **frontend collections** the rough shape is:

| Collection | Key fields | Owner |
|---|---|---|
| `users` | `email`, `role` (buyer/seller/admin), `status`, `created_at` | user (self) / admin |
| `products` | `sku`, `title`, `category`, `price`, `stock`, `status` | seller (own) / admin |
| `cart` | `user_id`, `product_id`, `quantity` | user (own) |
| `wishlist` | `user_id`, `product_id` | user (own) |
| `orders` | `user_id`, `items[]`, `total`, `status`, `created_at` | user (own read) / admin (write) |
| `rfqs` | `user_id`, `items[]`, `status`, `created_at` | user (own) / admin |
| `reviews` | `product_id`, `user_id`, `rating`, `comment` | user (own) / admin |
| `chats` | `participants[]`, `messages[]` | participants (own) |
| `error_log` | `type`, `message`, `created_at` | anyone (write) / admin (read) |
| `coupons` | `code`, `value`, `expires_at` | admin |
| `promo_banners` | `image`, `link`, `active` | admin |
| `flash_sales` | `product_ids[]`, `discount`, `ends_at` | admin |
| `config` | `key`, `value` | admin (public read) |

**Never** read from another user's collection. The rules enforce this,
but defensively your code should also not assume it can.

---

## 7. Security

The full security model is in `firestore.rules` and `vendor/pse-inventory-packet/SECURITY.md`. Highlights:

- **No client-side trust.** Every Firestore write is validated by the
  rules. The client can send anything, but the rules will deny it.
- **No secrets in the repo.** `.env.example` is a template; the test
  `tests/test_env_hygiene.py` enforces that no real values ever land
  there.
- **CSP locked down.** The Content-Security-Policy in
  `vercel.json` and `deploy/nginx.conf` only allows scripts from
  `'self'`, the Firebase CDN, and Font Awesome. No third-party
  trackers, no analytics scripts you don't control.
- **Privacy-safe inventory output.** The inventory API strips every
  private field before serialising. The `privacy_violations_total`
  Prometheus counter increments on any attempt to publish a private
  field.

When in doubt, **defence in depth**: assume every layer above is
compromised, and add a check at the layer below.

---

## 8. Release process

1. **Open a PR** with the change. CI runs:
   - frontend lint
   - inventory tests
   - env hygiene
   - security scan
2. **Get a review** from at least one other engineer.
3. **Merge to main.** Vercel auto-deploys the storefront.
4. **For inventory changes**, tag `vX.Y.Z` to trigger the
   `Deploy` workflow. The image is built, pushed to GHCR, and the
   rolling deploy script on the production host pulls it.
5. **Watch for 30 min** after each release. The Grafana dashboard
   "PSE — Deploys" highlights the last 30 minutes; check for a
   regression in error rate or latency.

---

## 9. Getting help

- **Slack:** `#pse-eng` (operator + engineers)
- **GitHub issues:** bug reports and feature requests
- **Vendor packet:** `vendor/pse-inventory-packet/00_START_HERE.md`
  for the inventory contract, packet version, and changelog
- **On-call rotation:** see `OPERATOR_RUNBOOK.md`
