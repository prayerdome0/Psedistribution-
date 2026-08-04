# Deployment Readiness Checklist v4.0.0

Mark every item with an evidence link or log reference. A checked box without evidence does not satisfy the gate.

## Packet preflight

- [ ] Run `python 07_GAUNTLET/run_super_gauntlet.py .` from the packet root with zero failures.
- [ ] Run `cd 09_RELEASE && sha256sum -c SHA256SUMS.txt` and retain the output.
- [ ] Review `09_RELEASE/02_GAUNTLET_RESULTS.json` and `09_RELEASE/03_RELEASE_DECISION.md`; confirm production remains NOT DEPLOYED.

**Exit gate:** packet contracts, references, fixtures, and integrity checks pass.

## Phase 0 - Access, discovery, backup, and rollback

- [ ] Website repository or deployment project identified.
- [ ] Current branch, commit, framework, runtime, package manager, and build command recorded.
- [ ] Hosting provider, production project, staging project, DNS, CDN, and cache layers recorded.
- [ ] Existing product catalog, RFQ persistence, authentication, cart, and checkout behavior inspected.
- [ ] SalesMax Hub repository/runtime/database and existing Google Sheets connector inspected.
- [ ] Current production configuration exported or documented.
- [ ] Current production backup created and independently readable.
- [ ] Rollback method documented and tested in staging.
- [ ] Secrets inventory completed without copying secret values into this packet.
- [ ] Phase 0 evidence reviewed by the engineering owner.

**Exit gate:** authoritative source, deployment path, backup, and rollback are reproducible.

## Phase 1 - Canonical inventory truth

- [ ] Candidate rows linked to stable source IDs and hashes.
- [ ] Reply-thread and duplicate rows linked to one canonical Deal ID.
- [ ] UPC/GTIN, quantity, cases, case pack, condition, FOB, and proof reconciled where applicable.
- [ ] Live availability timestamp captured from an approved source.
- [ ] Available To Sell calculation implemented and tested.
- [ ] Public price or RFQ pricing mode approved.
- [ ] MOQ, currency, freight, inspection/return terms, title, category, condition, and at least one approved HTTPS image are approved.
- [ ] Review Queue contains no blocking issue for intended launch records.
- [ ] `Publish Approved` is a separate explicit owner-controlled field.

**Exit gate:** every intended launch item is one complete canonical record with no blocker.

## Phase 2 - Publisher and separate public feed

- [ ] Separate public spreadsheet, table, or database view created.
- [ ] Publisher identity can read private master and write public feed only as required.
- [ ] Storefront identity can read public feed only.
- [ ] Private-to-public field allowlist implemented from `03_CONTRACTS/public_private_field_map.csv`.
- [ ] JSON Schema validation is mandatory before publication.
- [ ] Publication fails closed on any invalid record.
- [ ] Empty/malformed snapshot overwrite is blocked.
- [ ] Snapshot source version, generated time, record count, and hashes recorded.
- [ ] Atomic staging-then-swap or equivalent transaction implemented.
- [ ] Prior public snapshot preserved and restorable.
- [ ] Sync/Publish Log records operator, run ID, source version, changes, counts, and result.
- [ ] Two clean local/staging publishes produce identical accepted output.

**Exit gate:** privacy scan passes and public snapshot is reproducible and reversible.

## Phase 3 - API, cache, and monitoring

- [ ] `GET /api/inventory` implemented.
- [ ] `GET /api/inventory/{slug}` implemented.
- [ ] Signed internal revalidation endpoint implemented and browser-inaccessible.
- [ ] Revalidation validates timestamp, nonce, HMAC-SHA256 signature, clock skew, and nonce replay protection.
- [ ] API responses validate against `03_CONTRACTS/public_inventory_item.schema.json`.
- [ ] All positive fixtures pass and every negative fixture in `04_REFERENCE_IMPLEMENTATION/fixtures/` and `11_RUNNABLE_REFERENCE_STACK/tests/` fails for the intended reason.
- [ ] Pagination and bounded query parameters implemented.
- [ ] Rate limits, timeouts, request-size limits, and safe error responses implemented.
- [ ] ETag/cache headers and source-version metadata implemented.
- [ ] Last-known-good snapshot behavior implemented.
- [ ] Maximum stale age and fail-closed behavior implemented.
- [ ] Monitoring covers API errors, latency, feed age, stale records, privacy violations, and parity.
- [ ] The deployment is explicitly one API replica, or the PostgreSQL and Valkey adapters in `../11_RUNNABLE_REFERENCE_STACK/SHARED_STATE_AND_CONTROL_PLANE_ADAPTERS.md` are implemented.
- [ ] A multi-replica deployment proves one shared nonce-replay decision and one shared rate-limit decision across at least two API replicas.
- [ ] Shared-state timeout, authentication failure and outage fail closed and trigger alerts.
- [ ] PostgreSQL role isolation, transactional publish, restore and rollback tests pass before the control-plane profile is promoted.
- [ ] Preview-profile containers are not counted as completed integration.

**Exit gate:** good, malformed, stale, empty, outage, and privacy-leak fixtures pass.

## Phase 4 - Website catalog and RFQ

- [ ] Products grid reads the server API, not the private master.
- [ ] Stable product URLs use the public slug and Deal ID.
- [ ] Product pages show accurate units, MOQ, condition, FOB, freight, freshness, and terms.
- [ ] RFQ prefill includes Deal ID, source version, product title, URL, and desired quantity.
- [ ] RFQ does not decrement inventory during Phase 1.
- [ ] Category, MOQ, price, and availability filters use real data only.
- [ ] Rating and verified-seller filters are hidden until real evidence exists.
- [ ] Unsupported promotional counters and blanket commercial promises are removed or substantiated.
- [ ] Product/Offer JSON-LD matches visible price and availability.
- [ ] Mobile, keyboard, contrast, and screen-reader QA completed.

**Exit gate:** public feed, API, and website display the same approved records and version.

## Phase 5 - Staging, production, stabilization, and handoff

- [ ] Full acceptance matrix executed in staging.
- [ ] Privacy/schema scan passes.
- [ ] Sold, withdrawn, reserved, stale, and reconfirmed lifecycle tests pass.
- [ ] Cache revalidation and outage behavior pass.
- [ ] Production deployment completed through the documented path.
- [ ] Live product pages, RFQ, counters, metadata, and API verified.
- [ ] Production feed/API/site parity verified.
- [ ] Rollback executed and verified, then accepted version restored.
- [ ] Two clean end-to-end publication runs reproduce the accepted state.
- [ ] Release evidence packet completed and approved.
- [ ] Monitoring and ownership handoff completed.

**Final release gate:** 0 Critical defects, 0 Major defects, rollback proven, two clean runs passed, and live production verified.
