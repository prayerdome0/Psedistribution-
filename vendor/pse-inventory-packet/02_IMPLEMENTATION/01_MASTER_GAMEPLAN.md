# PSE × SalesMax Inventory Wiring Master Gameplan

**Domain:** pilotsalesdistribution.com  
**Operating source:** PSE / SalesMax Wholesale Hub  
**Prepared:** August 3, 2026  
**Status:** MASTERED IMPLEMENTATION PLAN v4.0.0 - production access still required

## 0. Open-source runtime decision

The production inventory path must be deterministic and self-hostable. It has no OpenAI, ChatGPT, proprietary LLM or external AI-service dependency. The preferred greenfield adapter is PostgreSQL + Python/FastAPI + Valkey + Caddy + Prometheus/Alertmanager/Perses. Existing open-source website components may remain after Phase 0 inspection. See `../10_OPEN_SOURCE/01_OPEN_SOURCE_STACK_BLUEPRINT.md`.

OpenAPI in the API-contract filename is a vendor-neutral open standard and is unrelated to OpenAI.

## 1. Executive decision

Use a **controlled publication pipeline**, not a direct website-to-private-sheet connection:

> Private source intake → reconciliation and proof → private canonical master → explicit publish gate → separate public-only feed → server-side inventory API → cached website catalog and RFQ flow.

This architecture protects supplier identity, internal cost, market references, proof files, owner notes and unpublished deals. It also prevents stale email threads or duplicated WhatsApp/Yahoo rows from appearing as live inventory.

### Non-negotiable rule

**The browser and public website must never receive credentials for, or query, the private inventory master.** The website reads only buyer-safe records from a separate public feed or database view.

## 2. Verified current-state audit

| Area | Current evidence | Decision |
|---|---:|---|
| Public products page | 0 products shown | Integration is not live |
| Homepage live product counter | 0 | Replace promotional counters with feed-backed counts |
| Homepage promotional copy | Claims 12,000+ products, 580+ suppliers and 99.7% satisfaction | Remove or substantiate before catalog launch |
| Canonical Wholesale Hub tracker | 2 records / 12,700 units | Good starting control structure, not complete inventory |
| Internal review status | 1 Ready; 1 Needs Review | “Ready” is not yet the same as “Publish Approved” |
| Candidate status workbook | 73 rows | Historical/candidate intake, not current sellable inventory |
| Candidate normalization audit | 33 deterministic normalized-title clusters | 40 rows beyond the first within those clusters; review-only duplicate signal |
| Candidate proof / freshness | 73 of 73 missing proof and live availability timestamp | All must remain blocked from publication |
| Candidate quantity | 15 of 73 rows lack a usable quantity | Required remediation |
| GitHub / runtime access | No connected repository exposed | Code-level wiring cannot be verified or deployed from this session |

### Critical data defects in the current tracker

1. `Last Refresh` is based on `NOW()`, which proves sheet recalculation—not source verification, hub sync, API sync or website release.
2. Dashboard deal counts and totals use unfiltered `COUNTA` / `SUM` formulas, so future Sold, Hold or Archived rows would still be counted.
3. Current master fields include **internal wholesale cost**, supplier, market reference, proof link and internal notes, but no explicit approved public selling price.
4. There is no explicit `Publish Approved`, public slug, public image set, MOQ, price-visibility mode, public freight term, public condition enum or availability-expiration field.
5. Website filters expect category, price, MOQ and rating data that the source does not reliably provide. Do not fabricate missing values.

## 3. Immediate P0 corrections before publishing inventory

### P0-A — Correct public commercial claims

The current site globally advertises free shipping over $250 and broad marketplace guarantees, while at least one current deal states freight is not included and closeout inventory is subject to prior sale. Replace blanket terms with product-level terms:

- `Freight quoted separately unless explicitly included.`
- `Availability subject to prior sale and final confirmation.`
- `Returns / inspection terms shown per offer.`

Hide ratings, verified-seller badges and testimonials unless each has source-backed evidence.

### P0-B — Establish the truth hierarchy

1. **Verified SalesMax Hub database**, once runtime-inspected and proven.
2. Until then, the **Private Canonical Master** sheet.
3. Separate **Public Inventory Feed** generated only by the publisher.
4. Website/API cache and last-known-good snapshot.
5. Candidate status workbook remains an intake lead source only.

### P0-C — Separate public and private data

Do not create only a “Public” tab in the private workbook as the security boundary. Create a separate spreadsheet or database view containing public fields only. Google Sheets authorization applies to the spreadsheet file, not one tab.

## 4. Target architecture

See `../01_EXECUTIVE/03_ARCHITECTURE_DIAGRAM.png`.

### Private plane

- SalesMax Hub, supplier confirmations, emails, PDFs, images, warehouse records and user-initiated WhatsApp exports enter **Raw Intake**.
- Every intake row receives a source record ID and source hash.
- Reconciliation normalizes product identity, links reply-thread rows, deduplicates, verifies quantity and case pack, validates UPC, captures live availability and proof, and maps public terms.
- The **Private Canonical Master** stores one active record per stable Deal ID.

### Publication boundary

A record crosses the boundary only when all conditions pass:

```text
Status = Available
AND Review Status = Ready
AND Publish Approved = TRUE
AND Available To Sell > 0
AND live availability is within freshness policy
AND public title, category, condition, MOQ, FOB and freight terms are complete
AND pricing mode is valid (public price, login price, or RFQ)
AND approved public image(s) exist
AND no blocking review issue is open
```

### Public plane

- Controlled publisher emits a **separate public-only feed**.
- Storefront reader receives read-only access to that feed only.
- Server-side API validates output against `../03_CONTRACTS/public_inventory_item.schema.json`.
- Website fetches the API with cache, ETag and last-known-good fallback.
- RFQs include the stable `dealId` and current `sourceVersion`.

## 5. Recommended identity and access design

Use two separate machine identities or equivalent roles:

| Role | Access | Where used |
|---|---|---|
| Inventory Publisher | Read private master; write public feed; append publish log | Controlled admin job only |
| Storefront Reader | Read public feed only | Website server runtime |

Prefer workload identity / attached service identity where the host supports it. Avoid long-lived service-account keys. If a key is unavoidable, store it only in encrypted server secrets, rotate it, restrict it to one purpose, and never expose it to client JavaScript.

## 6. Canonical data model changes

Add the following fields to the private canonical record or mapped database model:

### Control and identity

- `Deal ID` — immutable primary key
- `Canonical Product ID`
- `Source Record ID`
- `Source Hash`
- `Source Version`
- `Record Updated At`
- `Last Source Verified At`
- `Last Availability Confirmed At`
- `Availability Expires At`
- `Last Published At`
- `Last API Sync At`
- `Last Site Revalidated At`

### Inventory and commercial state

- `Status`: Draft / Available / Limited / Hold / Reserved / Sold / Archived
- `Units On Hand`
- `Reserved Units`
- `Available To Sell` = On Hand − Reserved
- `Cases Available`
- `Units Per Case`
- `MOQ Units`
- `MOQ Cases`
- `Public Pricing Mode`: Public / Login / RFQ
- `Approved Public Unit Price`
- `Approved Public Case Price`
- `Approved Public Lot Price`
- `Public Currency`
- `Freight Terms`

### Publication control

- `Review Status`
- `Publish Approved`
- `Publish Blocker`
- `Public Slug`
- `Public Title`
- `Public Description`
- `Public Category`
- `Public Condition`
- `Approved Public Image URLs`
- `Public Spec Sheet URL`
- `RFQ Enabled`

### Never place in the public feed

Supplier name, source identity, acquisition cost, private sell floor, margin/spread, market-source notes, proof links, owner, internal notes, payment instructions, bank information, credentials or private files.

## 7. Deduplication and reconciliation rules

The 73-row candidate workbook contains apparent reply-thread duplication. Use a deterministic hierarchy:

1. Exact stable Deal ID match.
2. Source message/thread ID match.
3. UPC / GTIN plus brand and model.
4. Supplier SKU plus quantity and FOB.
5. Source hash match.
6. Fuzzy title matching is a review suggestion only—never an automatic merge by itself.

Create `canonical_deal_id` for rows that are evidence or replies for the same offer. Preserve every source row in Raw Intake; do not delete history.

## 8. Freshness policy

Recommended launch defaults:

| Age since live availability confirmation | Public behavior |
|---|---|
| 0–24 hours | Available / Limited according to ATS |
| 24–72 hours | `Confirm availability`; RFQ only; no instant commitment |
| Over 72 hours | Automatically unpublish until reconfirmed |
| Sold / supplier withdrawn | Immediate unpublish and cache revalidation |

Fast-moving deals may use a stricter threshold. The expiration time must be stored per record rather than inferred from a dashboard clock.

## 9. API design

### Public endpoints

- `GET /api/inventory`
- `GET /api/inventory/{slug}`

### Internal endpoint

- `POST /api/internal/inventory/revalidate` — signed and rate-limited; never public or browser-callable.

### Required response metadata

- record count
- generated timestamp
- source version
- freshness state
- next cursor
- ETag

Use one bounded `values.get` or `values.batchGet` request for the public feed, not one request per item. Cache the validated JSON snapshot and use exponential backoff for quota responses.

## 10. Website implementation

### Catalog and detail pages

- Populate the existing product grid from `/api/inventory`.
- Generate stable product URLs from `slug`, never array position.
- Populate category, search and MOQ filters only from real fields.
- Hide the rating filter until a real review system exists.
- Render `Request Quote` for `pricingMode = rfq`.
- Do not enable cart checkout until inventory holds and order commitment are implemented.
- Display `Last verified` and `FOB` on every item.
- Display freight and return/inspection terms per item.

### RFQ integration

Product-level RFQ links prefill:

- Deal ID
- product title
- desired quantity
- current source version
- URL / slug

The submitted RFQ must not decrement inventory in Phase 1. A salesperson confirms availability and creates a controlled hold.

### Homepage metrics

Replace hard-coded promotional numbers with:

- `Published deals`
- `Units currently available`
- `Categories represented`
- `Last inventory verification`

Only display supplier or satisfaction metrics when separately verified.

### SEO

Generate Product / Offer JSON-LD from the same validated public record. Use accurate price and availability only. RFQ-only products should not invent a price.

## 11. Sync design

### Phase 1 publication path

1. Worker updates Raw Intake and Review Queue.
2. Manager reconciles one canonical Deal ID.
3. Owner sets public terms and `Publish Approved`.
4. Publisher validates every record and creates a complete new public snapshot.
5. If any record fails schema or privacy checks, fail the entire publish—do not partially leak.
6. Publisher writes the public feed atomically or through a staging-then-swap pattern.
7. Append Sync / Publish Log with source and output hashes.
8. Send signed revalidation request to the website.
9. Website fetches, validates, caches and reports parity.

### Phase 2 after SalesMax Hub runtime inspection

Promote a verified SalesMax Hub database to the canonical source. Keep the private sheet as an operational review surface or controlled export, not a competing source of truth.

## 12. Caching and outage behavior

- Default server cache: 1–5 minutes for catalog list; product detail may share the same versioned snapshot.
- On controlled publish: invalidate the inventory cache immediately.
- On transient Sheets/feed failure: serve the last-known-good snapshot only while it remains inside the approved maximum age.
- After maximum age: fail closed—show inventory temporarily unavailable and preserve the general RFQ form.
- Never replace a valid snapshot with an empty or malformed feed.

If the current site is Next.js, use server-only data access plus tag-based revalidation. If it is another stack, implement the equivalent server cache and signed invalidation route.

## 13. Security controls

- No private sheet ID or credential in client-side bundles.
- Narrowest possible read scope and separate service identity.
- Public API returns an allowlisted schema with `additionalProperties: false`.
- Input length limits, pagination, rate limits and timeouts.
- CORS restricted to expected origins where applicable.
- Signed internal revalidation requests with replay protection.
- Sanitize and validate all feed values as untrusted input.
- Approved image-host allowlist; block arbitrary server-side URL fetches.
- Production error responses contain no stack trace, sheet ID or credential information.
- Maintain an inventory of active API versions and disable obsolete/debug endpoints.

## 14. Delivery phases and release gates

### Phase 0 — Access and stack discovery

**Actions**
- Mount or connect the pilotsalesdistribution.com repository.
- Identify hosting, framework, current product model, auth, cart/RFQ persistence and deployment path.
- Inspect the real SalesMax Hub runtime, database and existing Google Sheets connector.
- Back up current production state and record deployment rollback.

**Exit gate**
- Repository, production deployment and hub source are identified and reproducible.

### Phase 1 — Inventory truth cleanup

**Actions**
- Normalize the 73 candidate rows into canonical candidates.
- Clear duplicates and link source evidence.
- Confirm current availability, quantity, case pack, FOB, condition and proof.
- Resolve the Cheerios blockers and refresh market references only for internal decision support.
- Add all missing publication-control fields.

**Exit gate**
- Every intended launch item is one canonical record with no blocking review issue.

### Phase 2 — Public feed and publisher

**Actions**
- Create a separate public feed.
- Implement allowlisted field mapping and schema validation.
- Add privacy scan and atomic snapshot versioning.
- Add publish log, diff and rollback.

**Exit gate**
- Public feed contains no prohibited field and reproduces exactly on two clean runs.

### Phase 3 — Read-only inventory API

**Actions**
- Add list/detail endpoints, validation, pagination, cache, ETag, freshness and last-known-good behavior.
- Add signed revalidation route and monitoring.

**Exit gate**
- API tests pass against good, malformed, stale, empty and secret-leak fixtures.

### Phase 4 — Website catalog and RFQ wiring

**Actions**
- Replace empty catalog with API records.
- Wire product detail, filters, search and RFQ prefill.
- Replace unsupported counters and conflicting global terms.
- Add Product JSON-LD and accessibility/mobile QA.

**Exit gate**
- Website count, product records and source version match the public feed exactly.

### Phase 5 — Release and stabilization

**Actions**
- Deploy to staging, run end-to-end tests, then controlled production promotion.
- Verify live pages, cache invalidation, source parity, privacy boundary and rollback.
- Complete two clean publish-and-deploy cycles.

**Exit gate**
- No Critical or Major defects; rollback has been proven; evidence is stored.

## 15. Acceptance test matrix

| ID | Test | Pass condition |
|---|---|---|
| AT-01 | Count parity | Feed, API and website published counts match |
| AT-02 | Privacy schema | No supplier, acquisition cost, margin, proof or internal note reaches API |
| AT-03 | Publish gate | A missing approval, freshness, quantity or public term blocks publication |
| AT-04 | Duplicate source rows | One canonical Deal ID is published once |
| AT-05 | Sold / withdrawn | Item disappears after controlled publish and cache invalidation |
| AT-06 | Stale inventory | 24–72h becomes confirm-only; >72h is unpublished |
| AT-07 | Malformed feed | Invalid snapshot is rejected; last-known-good remains active |
| AT-08 | Empty feed | Empty accidental output cannot overwrite a non-empty valid snapshot without explicit override |
| AT-09 | Cache | Signed revalidation updates catalog without exposing admin endpoint |
| AT-10 | RFQ | Deal ID and source version are preserved through submission |
| AT-11 | SEO | JSON-LD price and availability match visible page data |
| AT-12 | Claims | Homepage counters and commercial terms are source-backed |
| AT-13 | Security | Secrets absent from bundles/logs; API rate and size limits enforced |
| AT-14 | Rollback | Previous public snapshot and prior deployment restore successfully |
| AT-15 | Repeatability | Two clean end-to-end runs produce the same accepted state |

## 16. Operating dashboard KPIs

- Canonical active deals
- Publish-approved deals
- Published deals
- Public-feed/API/site parity
- Records missing proof
- Records missing current availability
- Stale published records
- Duplicate source rows awaiting linkage
- API success rate and latency
- Last successful publish, API sync and website revalidation
- RFQs by Deal ID
- Holds, reserved units and available-to-sell variance

## 17. Ownership model

| Responsibility | Recommended owner |
|---|---|
| Source intake and proof | Sales / Receiving |
| Quantity and warehouse confirmation | Warehouse |
| Public price, MOQ and freight terms | Sales leadership |
| Publish approval | Caden / owner delegate |
| Publisher and API | Engineering |
| Website display and RFQ | Engineering / Sales ops |
| Daily freshness exceptions | Sales ops |
| Release evidence and rollback | Engineering owner |

## 18. Exact access required to execute the wiring

1. Repository or deployment project for pilotsalesdistribution.com.
2. Hosting access sufficient to configure server secrets and deploy a staging build.
3. SalesMax Hub repository/runtime or database read access.
4. Permission to create the separate Public Inventory Feed and share it with the designated identities.
5. Approved product images and public sales terms.
6. Confirmation of which inventory rows are truly current as of the launch review.

No production wiring should be called complete until these are inspected and the live deployment passes the acceptance gates.

## 19. Definition of done

The project is complete only when:

- every displayed product maps to one approved canonical Deal ID;
- the public API contains only buyer-safe fields;
- sold, stale or withdrawn inventory is removed predictably;
- site counters and terms are source-backed;
- RFQs preserve product identity and source version;
- feed, API and website counts match;
- security, freshness, failure and rollback tests pass;
- two clean end-to-end publish runs reproduce the accepted result;
- the live production site is verified after deployment.

## 20. Packet execution support

- Run `python 07_GAUNTLET/run_super_gauntlet.py . --bootstrap` during implementation and the full release gauntlet before handoff or after any contract change.
- Use the positive and negative records in `../04_REFERENCE_IMPLEMENTATION/fixtures/` as the first schema regression suite.
- Follow `../04_REFERENCE_IMPLEMENTATION/README.md` for deterministic mapping, validation, atomic promotion, parity checks, and rollback.
- Treat `../03_CONTRACTS/publish_gate_rules.json` as the machine-readable private-record gate and `../03_CONTRACTS/public_inventory_item.schema.json` as the public-output allowlist.
- A record must pass both controls. Passing one does not compensate for failure of the other.

## 21. Research references

- Live PSE homepage and products/RFQ pages, accessed August 3, 2026.
- PSE Wholesale Hub Live Deal Tracker, connected Google Sheet.
- PSE Caden Share — Deal Intake + Outreach Status, connected Google Sheet.
- Google Sheets API: values reads, quotas and authorization scopes.
- Google Cloud IAM: secure service-account practices.
- OWASP API Security Top 10 (2023).
- Google Search Central Product structured data.
- Next.js revalidation documentation, applicable only if the inspected site uses Next.js.


## 22. Super Gauntlet release loop

Every material change repeats the following loop until no Critical or Major packet defect remains:

1. **Retrieve and reconcile:** compare the latest source evidence, contracts, operational rules and public-site state.
2. **Contract audit:** validate schemas, examples, external references, mode-dependent pricing, freshness and field boundaries.
3. **Behavior tests:** run publisher, HMAC, all-or-nothing, deduplication, ATS and lifecycle tests.
4. **Adversarial mutations:** remove required fields, inject private fields, alter URLs, prices, timestamps, identities and hashes, and require every defective case to be rejected.
5. **Security scan:** scan for secrets, credentials, prohibited public properties, unsafe schemes and unsupported production claims.
6. **Operational simulation:** exercise malformed, stale, empty, replayed, duplicate and rollback paths.
7. **Visual QA:** render the editable deck and PDF; inspect all pages and verify page/slide parity, fonts and preflight.
8. **Package QA:** resolve every local reference, verify manifest and SHA-256, remove generated caches, and validate ZIP integrity.
9. **Clean-room repeatability:** copy/extract to a new location and rerun the full suite twice.
10. **Release decision:** publish only the evidence-backed packet status; keep production acceptance BLOCKED until the live system passes.

The authoritative executable is `../07_GAUNTLET/run_super_gauntlet.py`.
