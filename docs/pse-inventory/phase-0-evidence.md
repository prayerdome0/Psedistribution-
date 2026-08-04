# PSE Inventory Wiring — Phase 0 Discovery Evidence

**Captured:** 2026-08-04 (UTC) · Session branch: `arena/019fcdd2-psedistribution`
**Packet:** `PSE_SalesMax_Inventory_Wiring_MASTERED_OPEN_SOURCE_v4.0.0_2026-08-03.zip` vendored byte-exact at `vendor/pse-inventory-packet/`.

This worksheet records only what was directly observed in this repository and
verification environment. Items that require owner/hosting/SalesMax access are
marked `PENDING_OWNER_PROVISIONING` — they are NOT fabricated.

## Repository and deployment

- **Repository URL and commit:** `https://github.com/prayerdome0/Psedistribution-` @ `9437022e0bc580f55c4432bc54cf06370869e102` (verified via `git log -1`).
- **Default branch:** `main` (working branch for this implementation: `arena/019fcdd2-psedistribution`).
- **Framework and version:** Static HTML/CSS/JS storefront; Firebase JS SDK loaded from CDN (gstatic) inside each page; no Node build, no framework. Observed: `products.html` reads `db.collection('products')` client-side (~line 888); `product-detail.html` reads `db.collection('products')` (~line 1165).
- **Package manager and lockfile:** None for the website. This service adds `.venv/` + `services/pse-inventory/requirements.*.lock`.
- **Build command:** None (static site). Recorded as `none` in the implementation map.
- **Test command:** `.venv/bin/python -m pytest -q && node --test apps/pse-inventory-catalog/catalog.test.mjs`.
- **Current deployment provider/project:** Repository ships BOTH `firebase.json` (Hosting `public: "."`) and `vercel.json` (cleanUrls + rewrites for /products, /product/:path*, /rfq, etc.). The live project ID/account is not exposed inside the repository. `PENDING_OWNER_PROVISIONING`.
- **Staging URL:** `PENDING_OWNER_PROVISIONING`.
- **Production URL:** `https://pilotsalesdistribution.com` (referenced throughout repo copy, sitemap, RFQ links).
- **Current rollback method:** Hosting-provider instant rollback (Vercel restore / Firebase release history) plus snapshot rollback via `scripts/pse-inventory-rollback.sh` for the inventory feed. Hosting-side rollback must be evidenced by the owner; feed-side rollback is implemented and tested in this repo.
- **Last known good deployment ID:** `PENDING_OWNER_PROVISIONING`.
- **Backup/export location:** `services/pse-inventory/data/` (current snapshot + `history/`) produced by `scripts/pse-inventory-backup.sh`.

## Current website implementation

- **Product storage/model:** Firestore collection `products`, queried **from the browser** — violates the packet's non-negotiable boundary for any private data; acceptable only for a buyer-safe public collection. Rewired in this change to the public inventory API.
- **Product list route/component:** `/products` → `products.html` (grid `#productGrid`, `loadProducts()`).
- **Product detail route/component:** `/product/{slug}` → `product-detail.html` (`loadProductDetail()`, `loadProductBySlug()`).
- **RFQ persistence and notification path:** `rfq.html` form `#rfqForm`; submission handler stores to Firestore/email per existing code. Identity fields (dealId, sourceVersion, snapshotVersion, slug, quantity) added by this change.
- **Authentication model:** Firebase Auth (CDN) used by account/seller/admin pages; not required for RFQ.
- **Cart/order behavior:** Firestore `cart` collection; checkout pages exist. Per packet decision D-002, Phase 1 is RFQ-first: no inventory decrement or checkout commitment from public inventory items.
- **Server-only runtime boundary:** None exists on static hosting; therefore the buyer-safe boundary is enforced by a separate server-side inventory API that publishes only allowlisted fields. The browser calls only `GET /api/inventory*`.
- **Existing cache/revalidation mechanism:** None; added by this change (ETag, Cache-Control, signed revalidation route).
- **Existing monitoring/logging:** None observed. Prometheus/Alertmanager assets added under `services/pse-inventory/deploy/`.

## SalesMax/PSE inventory source

- **Authoritative runtime/database or sheet:** NOT connected in this session (packet blocker B-002 OPEN). Until inspected, the Private Canonical Master is the controlled operational authority per the packet Source of Truth policy.
- **Source owner:** Caden / owner delegate.
- **Existing connector:** None in repository (no Sheets connector code committed).
- **Current primary key:** `dealId` (immutable), per canonical schema v4.0.0.
- **Quantity/on-hand source:** `inventory.onHandUnits` on canonical records; ATS = onHand − reserved.
- **Reservation/hold source:** `inventory.reservedUnits`; Phase 1 holds are manual/controlled.
- **Supplier confirmation method:** Evidence-based (proofEvidenceIds); no automated confirmation.
- **Current source timestamps:** `lastSourceVerifiedAt`, `lastAvailabilityConfirmedAt`, `availabilityExpiresAt` required per record; `NOW()`-style recalculation time is never accepted as verification.
- **Credential/identity method:** `PENDING_OWNER_PROVISIONING`; publisher and storefront identities must be separate.
- **Backup/export method:** Canonical JSON export + snapshot history (see backupArtifact).

## Security and access

- **Publisher identity:** operator string recorded in publish reports; machine identity `PENDING_OWNER_PROVISIONING`.
- **Storefront reader identity:** public API only (read-only, allowlisted output); no private credentials exist in this repository or in any client bundle.
- **Secret store:** `PENDING_OWNER_PROVISIONING` (server-side). HMAC key ring is read from `PSE_REVALIDATION_KEYS_JSON` at process start; the service exits fail-closed when absent.
- **Key rotation mechanism:** current + previous key IDs supported per `05_INTEGRATION/05_HMAC_REVALIDATION_SPEC.md`.
- **Network/CORS restrictions:** API CORS allowlist defaults to `https://pilotsalesdistribution.com`; preview origin added only by the local preview harness.
- **Audit log destination:** publish reports + structured logs; centralized sink `PENDING_OWNER_PROVISIONING`.
- **Nonce/replay store:** in-process nonce store for the single-replica reference; Valkey adapter implemented in `pse_inventory/shared_state.py` and required before any multi-replica production deployment.

## Observed defects requiring correction (packet P0 items)

Evidence captured by direct grep on 2026-08-04:

1. `index.html` lines 598–607, 813–818, 1637 and `products.html` lines 543–546 advertise "580+ Verified Suppliers", "12,000+ Products", "99.7% Customer Satisfaction" and "Free Shipping on Orders Over $250" with no source-backed evidence. → Replaced/removed by this change (claims cleanup).
2. `products.html` meta description claims "12,000+ wholesale products". → Corrected.
3. Products grid renders 0 items (empty Firestore collection). → Rewired to the public inventory API.

## Verification environment limitations (honest gaps)

- Python in this sandbox is 3.11.2; the packet's production pin is 3.13. Service code is written to run on both; production deployment must use the pinned 3.13 image and locks.
- Docker/PostgreSQL/Valkey/libreoffice/poppler are unavailable in this sandbox. PostgreSQL store and shared-state adapters are implemented with injectable clients and integration tests skip unless `PSE_TEST_DATABASE_URL` / `PSE_TEST_VALKEY_URL` are provided; the packet gauntlet's visual-PDF gate cannot run here (environmental, recorded as such).
- Packet gauntlet bootstrap run in this environment: 258 checks, all 103 legacy + node tests pass; sole failures are the missing visual tooling listed above and the packet's own declared `productionBlocker`.

## Discovery exit evidence status

- [x] Source and deployment are reproducible (static repo; deterministic publisher; snapshot store).
- [x] Feed-side backup exists and restore/rollback scripts are implemented and tested; hosting-side restore PENDING_OWNER_PROVISIONING.
- [x] Snapshot rollback succeeds (tested); hosting deployment rollback PENDING_OWNER_PROVISIONING.
- [x] The true inventory authority is identified as the Private Canonical Master until SalesMax runtime inspection (B-002).
- [x] Private/public access separation is feasible and implemented (allowlist publisher + separate public snapshot + read-only API).
- [ ] No unresolved Critical discovery blocker remains — B-001/B-002 (hosting + SalesMax runtime access) stay OPEN and block production cutover, not implementation.

**Production status remains `NOT_DEPLOYED`** per the packet truth boundary.
