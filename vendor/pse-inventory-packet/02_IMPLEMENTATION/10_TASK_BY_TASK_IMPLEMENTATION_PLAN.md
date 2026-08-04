# PSE-SalesMax Inventory Production Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy a deterministic, self-hosted inventory publication service that moves owner-approved SalesMax inventory through a private canonical store, buyer-safe public snapshots, a read-only API, and the `pilotsalesdistribution.com` catalog/RFQ experience without exposing private data.

**Architecture:** A standalone FastAPI sidecar under `services/pse-inventory/` owns the public API and controlled publisher. PostgreSQL separates private canonical records, public snapshots, and audit history. Valkey supplies atomic cross-replica nonce and rate-limit state. The website consumes only the public API. Phase 0 must select one explicit website mode: `ADAPT_EXISTING` or `MOUNT_STATIC_REFERENCE`.

**Tech Stack:** Python 3.13, FastAPI 0.128.2, Pydantic 2.13.4, JSON Schema Draft 2020-12, OpenAPI 3.1.0, PostgreSQL 18.4, Valkey 9.1.0, Caddy 2.11.4, Prometheus 3.12.0, Alertmanager 0.32.1, Node.js built-in test runner, Docker Compose.

## Global Constraints

- No OpenAI, hosted LLM, proprietary AI endpoint, or AI decision-maker in the inventory path.
- The packet contracts in `03_CONTRACTS/` are authoritative; production code may not weaken them.
- The browser never receives private-master access, Google credentials, publisher credentials, HMAC secrets, acquisition cost, supplier identity, margin, proof links, or internal notes.
- A record publishes only after exact source-version-bound owner approval and every publish gate passes.
- Public output is created by allowlisting approved fields, never by deleting known-private fields from a private object.
- Sold, withdrawn, expired, stale, malformed, or privacy-unsafe records fail closed.
- The default runnable reference remains one API replica. Multi-replica production requires the adapters and evidence in `11_RUNNABLE_REFERENCE_STACK/SHARED_STATE_AND_CONTROL_PLANE_ADAPTERS.md`.
- Every task follows red-green-refactor: write a failing behavioral test, prove the intended failure, implement the smallest change, run the focused test, then run the relevant suite.
- No production cutover until backup, restore, deployment rollback, snapshot rollback, monitoring, and two clean end-to-end runs are proven.
- Keep the production deployment status `NOT_DEPLOYED` until live acceptance evidence exists.

## Target Repository Layout

The implementation uses these paths so backend delivery is independent of the current website framework:

```text
docs/pse-inventory/
  phase-0-evidence.md
  implementation-map.json
  rollback-evidence.md
  staging-acceptance.json
  production-acceptance.json
services/pse-inventory/
  pyproject.toml
  requirements.runtime.lock
  requirements.test.lock
  pse_inventory/
  contracts/
  migrations/
  tests/
  deploy/
apps/pse-inventory-catalog/
  index.html
  bootstrap.js
  catalog.js
  styles.css
  catalog.test.mjs
```

`implementation-map.json` must select exactly one website mode:

- `ADAPT_EXISTING`: it records the exact existing catalog route, product-detail route, RFQ handler, build command, test command, and deployment project. The adapter must preserve the API interfaces in this plan.
- `MOUNT_STATIC_REFERENCE`: Caddy mounts `apps/pse-inventory-catalog/` at `/products` and the existing site links to that route. This mode is permitted only when owner approval records that replacing the current empty catalog is acceptable.

---

### Task 0: Capture Phase 0 evidence and freeze the implementation map

**Files:**
- Create: `docs/pse-inventory/phase-0-evidence.md`
- Create: `docs/pse-inventory/implementation-map.json`
- Create: `docs/pse-inventory/rollback-evidence.md`
- Create: `scripts/validate-pse-phase0.py`
- Test: `tests/pse_inventory/test_phase0_evidence.py`

**Interfaces:**
- Consumes: website repository, hosting project, authoritative SalesMax runtime/database or controlled source, current deployment ID, backup location.
- Produces: one machine-readable map with `websiteMode`, exact source authority, build/test/deploy commands, route paths, secret store, rollback command, and owner approval identity.

- [ ] **Step 1: Write the failing Phase 0 completeness test**

```python
from pathlib import Path
import json


def test_phase0_map_is_complete_and_selects_one_website_mode() -> None:
    value = json.loads(Path("docs/pse-inventory/implementation-map.json").read_text())
    assert value["websiteMode"] in {"ADAPT_EXISTING", "MOUNT_STATIC_REFERENCE"}
    required = {
        "sourceAuthority", "sourceVersionStrategy", "websiteRepository",
        "websiteCommit", "buildCommand", "testCommand", "deploymentProject",
        "stagingUrl", "productionUrl", "secretStore", "backupArtifact",
        "restoreCommand", "rollbackCommand", "ownerApprover",
    }
    assert required <= set(value)
    assert all(str(value[key]).strip() for key in required)
```

- [ ] **Step 2: Run the focused test and prove it fails because the map is absent**

Run: `python -m pytest tests/pse_inventory/test_phase0_evidence.py::test_phase0_map_is_complete_and_selects_one_website_mode -v`

Expected: failure identifying the missing `docs/pse-inventory/implementation-map.json` file.

- [ ] **Step 3: Inspect the real systems and write evidence, not assumptions**

Run and record the exact output of the repository status, clean build, tests, deployment readback, source schema readback, backup creation, staging restore, rollback, and re-promotion commands in `phase-0-evidence.md` and `rollback-evidence.md`. Populate `implementation-map.json` only from those observed values.

- [ ] **Step 4: Add a deterministic Phase 0 validator**

```python
REQUIRED_KEYS = {
    "websiteMode", "sourceAuthority", "sourceVersionStrategy",
    "websiteRepository", "websiteCommit", "buildCommand", "testCommand",
    "deploymentProject", "stagingUrl", "productionUrl", "secretStore",
    "backupArtifact", "restoreCommand", "rollbackCommand", "ownerApprover",
}
```

The validator exits nonzero for missing keys, empty values, an unsupported website mode, an unverified rollback, or a source authority without a stable version strategy.

- [ ] **Step 5: Run the focused test and the validator**

Run: `python -m pytest tests/pse_inventory/test_phase0_evidence.py -v && python scripts/validate-pse-phase0.py`

Expected: all tests pass and the validator prints one JSON object with `result: PASS`.

- [ ] **Step 6: Commit the evidence gate**

```bash
git add docs/pse-inventory scripts/validate-pse-phase0.py tests/pse_inventory/test_phase0_evidence.py
git commit -m "docs: freeze PSE inventory phase-zero evidence"
```

---

### Task 1: Establish the standalone inventory service and contract lock

**Files:**
- Create: `services/pse-inventory/pyproject.toml`
- Create: `services/pse-inventory/requirements.runtime.lock`
- Create: `services/pse-inventory/requirements.test.lock`
- Create: `services/pse-inventory/pse_inventory/__init__.py`
- Create: `services/pse-inventory/contracts/`
- Test: `services/pse-inventory/tests/test_contract_lock.py`

**Interfaces:**
- Consumes: packet `VERSION.txt`, `CONTRACT_VERSION.txt`, `03_CONTRACTS/`, and exact lock files.
- Produces: importable `pse_inventory` package and byte-identical contract copies pinned to version `4.0.0`.

- [ ] **Step 1: Write the failing contract-lock test**

```python
import hashlib
from pathlib import Path


def test_service_contracts_match_packet_contracts_byte_for_byte() -> None:
    packet = Path("vendor/pse-inventory-packet/03_CONTRACTS")
    service = Path("services/pse-inventory/contracts")
    for source in sorted(packet.iterdir()):
        if source.is_file():
            target = service / source.name
            assert target.is_file()
            assert hashlib.sha256(target.read_bytes()).digest() == hashlib.sha256(source.read_bytes()).digest()
```

- [ ] **Step 2: Run the test and prove it fails because the service contract directory is absent**

Run: `python -m pytest services/pse-inventory/tests/test_contract_lock.py -v`

Expected: failure on the first missing contract file.

- [ ] **Step 3: Copy the packet contracts and exact dependency locks**

Copy `03_CONTRACTS/` without modification. Copy the packet runtime and test lock entries. Add package metadata with `requires-python = ">=3.13,<3.14"` and package version `4.0.0`.

- [ ] **Step 4: Add a version assertion to package initialization**

```python
PACKET_VERSION = "4.0.0"
CONTRACT_VERSION = "4.0.0"
```

Expose only those constants from `pse_inventory.__init__`.

- [ ] **Step 5: Run contract tests and schema validation**

Run: `python -m pytest services/pse-inventory/tests/test_contract_lock.py -v && python vendor/pse-inventory-packet/07_GAUNTLET/run_super_gauntlet.py vendor/pse-inventory-packet --bootstrap`

Expected: contract-lock test passes and packet bootstrap remains `PASS`.

- [ ] **Step 6: Commit the service boundary**

```bash
git add services/pse-inventory
git commit -m "build: establish PSE inventory service contract lock"
```

---

### Task 2: Implement PostgreSQL canonical, public snapshot, and audit storage

**Files:**
- Create: `services/pse-inventory/migrations/001_inventory_control_plane.sql`
- Create: `services/pse-inventory/migrations/002_role_grants.sql`
- Create: `services/pse-inventory/pse_inventory/postgres_store.py`
- Test: `services/pse-inventory/tests/test_postgres_store.py`
- Test: `services/pse-inventory/tests/test_postgres_roles.py`

**Interfaces:**
- Consumes: `CanonicalInventoryRecord`, complete validated public snapshot, operator ID, source version, run ID.
- Produces: `stage_snapshot(snapshot) -> StagedSnapshot`, `promote_snapshot(staged, operator) -> PublishReceipt`, `active_snapshot() -> dict`.

- [ ] **Step 1: Write the failing transaction rollback test**

```python
def test_invalid_candidate_never_changes_active_snapshot(store, valid_snapshot, invalid_snapshot) -> None:
    first = store.promote_snapshot(store.stage_snapshot(valid_snapshot), operator="release-a")
    with pytest.raises(SnapshotValidationError):
        store.stage_snapshot(invalid_snapshot)
    assert store.active_snapshot()["snapshotVersion"] == first.snapshot_version
```

- [ ] **Step 2: Run focused storage tests and prove the missing adapter failure**

Run: `python -m pytest services/pse-inventory/tests/test_postgres_store.py::test_invalid_candidate_never_changes_active_snapshot -v`

Expected: import failure for `pse_inventory.postgres_store`.

- [ ] **Step 3: Apply the packet SQL and implement the narrow store interface**

```python
@dataclass(frozen=True)
class PublishReceipt:
    run_id: str
    snapshot_version: str
    previous_snapshot_version: str | None
    record_count: int
    output_sha256: str
```

Use one transaction and a scoped PostgreSQL advisory lock for staging validation, snapshot insertion, active-pointer swap, and audit insertion.

- [ ] **Step 4: Enforce role isolation**

The storefront role receives `SELECT` only on the active public snapshot view. Tests must prove it cannot read `private_inventory`, write `public_inventory`, alter roles, or read audit payloads that contain private metadata.

- [ ] **Step 5: Run storage, concurrency, and role tests**

Run: `python -m pytest services/pse-inventory/tests/test_postgres_store.py services/pse-inventory/tests/test_postgres_roles.py -v`

Expected: invalid candidates roll back, concurrent publishes serialize, and storefront privilege escalation attempts fail.

- [ ] **Step 6: Commit the control-plane store**

```bash
git add services/pse-inventory/migrations services/pse-inventory/pse_inventory/postgres_store.py services/pse-inventory/tests/test_postgres_*.py
git commit -m "feat: add transactional inventory control-plane store"
```

---

### Task 3: Implement deterministic source intake, evidence linkage, and deduplication

**Files:**
- Create: `services/pse-inventory/pse_inventory/source_adapter.py`
- Create: `services/pse-inventory/pse_inventory/dedupe.py`
- Create: `services/pse-inventory/pse_inventory/source_hash.py`
- Test: `services/pse-inventory/tests/test_source_adapter.py`
- Test: `services/pse-inventory/tests/test_dedupe.py`

**Interfaces:**
- Consumes: exact source records from the authority selected in `implementation-map.json`.
- Produces: `RawEvidenceRecord`, stable source hash, candidate canonical Deal ID, review decision; never silently merges on fuzzy title alone.

- [ ] **Step 1: Write the failing duplicate-thread preservation test**

```python
def test_reply_thread_rows_link_to_one_deal_without_deleting_evidence() -> None:
    rows = [source_row(message_id="m1", thread_id="t1"), source_row(message_id="m2", thread_id="t1")]
    result = reconcile(rows)
    assert len(result.canonical_candidates) == 1
    assert {row.message_id for row in result.evidence_rows} == {"m1", "m2"}
    assert result.evidence_rows[0].canonical_deal_id == result.evidence_rows[1].canonical_deal_id
```

- [ ] **Step 2: Run the focused test and confirm reconciliation is absent**

Run: `python -m pytest services/pse-inventory/tests/test_dedupe.py::test_reply_thread_rows_link_to_one_deal_without_deleting_evidence -v`

Expected: import or function-not-defined failure.

- [ ] **Step 3: Implement the ordered identity hierarchy**

Use Deal ID, source thread/message ID, UPC plus brand/model, supplier SKU plus quantity/FOB, and exact source hash in that order. Fuzzy normalized-title similarity emits a review suggestion only.

- [ ] **Step 4: Compute source versions from canonical bytes**

```python
def source_sha256(record: Mapping[str, object]) -> str:
    encoded = json.dumps(record, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
    return "sha256:" + hashlib.sha256(encoded).hexdigest()
```

Reject records missing provenance, source identifier, captured timestamp, or authority identifier.

- [ ] **Step 5: Run source, dedupe, and sanitized-baseline regression tests**

Run: `python -m pytest services/pse-inventory/tests/test_source_adapter.py services/pse-inventory/tests/test_dedupe.py -v && python vendor/pse-inventory-packet/08_SOURCE_EVIDENCE/audit_sanitized_sources.py vendor/pse-inventory-packet`

Expected: all tests pass and the dated source baseline remains exactly 73 candidate rows, 33 normalized clusters, and 40 rows beyond the first cluster row.

- [ ] **Step 6: Commit deterministic intake**

```bash
git add services/pse-inventory/pse_inventory/source_adapter.py services/pse-inventory/pse_inventory/dedupe.py services/pse-inventory/pse_inventory/source_hash.py services/pse-inventory/tests/test_source_adapter.py services/pse-inventory/tests/test_dedupe.py
git commit -m "feat: add evidence-preserving inventory reconciliation"
```

---

### Task 4: Implement the owner-bound publish gate and atomic snapshot builder

**Files:**
- Create: `services/pse-inventory/pse_inventory/publish_gate.py`
- Create: `services/pse-inventory/pse_inventory/public_mapper.py`
- Create: `services/pse-inventory/pse_inventory/snapshot_builder.py`
- Test: `services/pse-inventory/tests/test_publish_gate.py`
- Test: `services/pse-inventory/tests/test_snapshot_builder.py`
- Test: `services/pse-inventory/tests/test_privacy_mutations.py`

**Interfaces:**
- Consumes: canonical records, exact approved source version, owner approval, freshness clock.
- Produces: complete deterministic public snapshot or one fail-closed rejection report; never partial publication after a record error.

- [ ] **Step 1: Write the failing source-version approval test**

```python
def test_publish_rejects_approval_for_prior_source_version(record, approval) -> None:
    record["sourceVersion"] = "sha256:" + "b" * 64
    approval["approvedSourceVersion"] = "sha256:" + "a" * 64
    with pytest.raises(PublishBlocked, match="source version"):
        build_snapshot([record], approvals=[approval], now=FIXED_NOW)
```

- [ ] **Step 2: Run the focused test and prove the gate is missing**

Run: `python -m pytest services/pse-inventory/tests/test_publish_gate.py::test_publish_rejects_approval_for_prior_source_version -v`

Expected: missing implementation failure.

- [ ] **Step 3: Port the packet gate rules without weakening them**

Require Available status, Ready review, explicit owner approval, exact approved source version, positive ATS, valid freshness, complete public terms, approved primary media, valid pricing/RFQ mode, and no blocking review or compliance issue.

- [ ] **Step 4: Implement strict allowlist mapping and deterministic snapshot hashing**

```python
PUBLIC_FIELDS = frozenset(load_field_map("public_private_field_map.csv"))
public = {key: canonical[key] for key in sorted(PUBLIC_FIELDS) if key in canonical}
```

Validate each mapped item and the final snapshot against the packet schemas before writing any staged output.

- [ ] **Step 5: Run publish, privacy, empty-overwrite, and repeatability tests**

Run: `python -m pytest services/pse-inventory/tests/test_publish_gate.py services/pse-inventory/tests/test_snapshot_builder.py services/pse-inventory/tests/test_privacy_mutations.py -v`

Expected: private-field mutations are rejected, an accidental empty result cannot replace a valid snapshot, and fixed input produces byte-identical output.

- [ ] **Step 6: Commit the deterministic publisher**

```bash
git add services/pse-inventory/pse_inventory/publish_gate.py services/pse-inventory/pse_inventory/public_mapper.py services/pse-inventory/pse_inventory/snapshot_builder.py services/pse-inventory/tests/test_publish_gate.py services/pse-inventory/tests/test_snapshot_builder.py services/pse-inventory/tests/test_privacy_mutations.py
git commit -m "feat: enforce owner-bound public inventory publication"
```

---

### Task 5: Implement atomic Valkey replay and distributed rate-limit state

**Files:**
- Create: `services/pse-inventory/pse_inventory/shared_state.py`
- Modify: `services/pse-inventory/requirements.runtime.lock`
- Test: `services/pse-inventory/tests/test_valkey_nonce_store.py`
- Test: `services/pse-inventory/tests/test_valkey_rate_limiter.py`
- Test: `services/pse-inventory/tests/test_valkey_outage.py`

**Interfaces:**
- Consumes: Valkey URL, namespace, nonce TTL, fixed-window limit, normalized subject.
- Produces: `ValkeyNonceStore.consume(key_id, nonce, now)` and `ValkeyRateLimiter.allow(subject, now)` matching `SHARED_STATE_AND_CONTROL_PLANE_ADAPTERS.md`.

- [ ] **Step 1: Write the failing two-replica nonce race test**

```python
def test_two_clients_accept_exactly_one_concurrent_nonce(valkey_url) -> None:
    first = ValkeyNonceStore.from_url(valkey_url)
    second = ValkeyNonceStore.from_url(valkey_url)
    outcomes = run_concurrently(
        lambda: first.consume("key-a", "nonce-000000000001", FIXED_NOW),
        lambda: second.consume("key-a", "nonce-000000000001", FIXED_NOW),
    )
    assert sorted(type(item).__name__ for item in outcomes) == ["NoneType", "ReplayDetected"]
```

- [ ] **Step 2: Run the focused test against an ephemeral pinned Valkey instance**

Run: `docker run --rm -d --name pse-valkey-test -p 6389:6379 valkey/valkey:9.1.0-alpine && python -m pytest services/pse-inventory/tests/test_valkey_nonce_store.py::test_two_clients_accept_exactly_one_concurrent_nonce -v`

Expected: missing adapter failure; always remove the container with `docker rm -f pse-valkey-test` after the run.

- [ ] **Step 3: Implement nonce consumption with one atomic command**

Use `SET key value NX EX ttl_seconds`. Treat a false response as replay. Hash the key ID and nonce before embedding them in the storage key. Do not log the raw nonce or secret.

- [ ] **Step 4: Implement the atomic fixed-window limiter**

Use a reviewed Lua script that performs `INCR`, sets `EXPIRE` only when count equals one, and returns the count. Reject when count exceeds the configured limit. A backend error returns a typed unavailable result that protected routes map to fail-closed `503`.

- [ ] **Step 5: Run concurrency, TTL, rotation, outage, and restart tests**

Run: `python -m pytest services/pse-inventory/tests/test_valkey_nonce_store.py services/pse-inventory/tests/test_valkey_rate_limiter.py services/pse-inventory/tests/test_valkey_outage.py -v`

Expected: one shared decision across replicas, no TTL extension, outage failure is closed, and restart/failover does not reopen a consumed nonce inside its validity window.

- [ ] **Step 6: Commit shared distributed state**

```bash
git add services/pse-inventory/pse_inventory/shared_state.py services/pse-inventory/requirements.runtime.lock services/pse-inventory/tests/test_valkey_*.py
git commit -m "feat: add atomic shared replay and rate-limit state"
```

---

### Task 6: Wire the production API, cache, cursor, and signed revalidation route

**Files:**
- Create: `services/pse-inventory/pse_inventory/settings.py`
- Create: `services/pse-inventory/pse_inventory/api.py`
- Create: `services/pse-inventory/pse_inventory/cursor.py`
- Create: `services/pse-inventory/pse_inventory/revalidation.py`
- Test: `services/pse-inventory/tests/test_public_api.py`
- Test: `services/pse-inventory/tests/test_revalidation_api.py`
- Test: `services/pse-inventory/tests/test_last_known_good.py`

**Interfaces:**
- Consumes: active validated snapshot, Valkey adapters, HMAC key ring, cursor key, allowed origins, maximum last-good age.
- Produces: `GET /api/inventory`, `GET /api/inventory/{slug}`, `POST /api/internal/inventory/revalidate`, health and metrics endpoints.

- [ ] **Step 1: Write the failing ETag and cursor-binding test**

```python
def test_cursor_is_bound_to_snapshot_and_query(client, active_snapshot) -> None:
    first = client.get("/api/inventory?category=other&limit=1")
    cursor = first.json()["meta"]["nextCursor"]
    assert client.get(f"/api/inventory?category=other&limit=1&cursor={cursor}").status_code == 200
    promote_different_snapshot()
    assert client.get(f"/api/inventory?category=other&limit=1&cursor={cursor}").status_code == 400
```

- [ ] **Step 2: Run the focused API test and confirm the route is absent**

Run: `python -m pytest services/pse-inventory/tests/test_public_api.py::test_cursor_is_bound_to_snapshot_and_query -v`

Expected: missing application or route failure.

- [ ] **Step 3: Implement exact public OpenAPI behavior**

Use the packet's error codes, parameter bounds, response schemas, ETag behavior, snapshot/source headers, pagination cursor signature, and 304 semantics. Do not expose framework docs or internal stack traces in production.

- [ ] **Step 4: Wire signed revalidation through shared nonce state**

Verify key ID, timestamp, allowed skew, exact body hash, HMAC-SHA256 signature, nonce replay, body size, and route rate limit before refreshing cache. On any validation or shared-state error, preserve the current snapshot.

- [ ] **Step 5: Run API, HMAC, malformed-feed, stale, and last-known-good tests**

Run: `python -m pytest services/pse-inventory/tests/test_public_api.py services/pse-inventory/tests/test_revalidation_api.py services/pse-inventory/tests/test_last_known_good.py -v`

Expected: good requests pass; invalid cursor, bad signature, replay, malformed snapshot, excessive age, and unavailable shared state follow the approved fail-closed contracts.

- [ ] **Step 6: Commit the production API**

```bash
git add services/pse-inventory/pse_inventory/settings.py services/pse-inventory/pse_inventory/api.py services/pse-inventory/pse_inventory/cursor.py services/pse-inventory/pse_inventory/revalidation.py services/pse-inventory/tests/test_public_api.py services/pse-inventory/tests/test_revalidation_api.py services/pse-inventory/tests/test_last_known_good.py
git commit -m "feat: expose buyer-safe inventory API"
```

---

### Task 7: Implement catalog, detail, and RFQ identity preservation

**Files:**
- Create or adapt: `apps/pse-inventory-catalog/index.html`
- Create or adapt: `apps/pse-inventory-catalog/bootstrap.js`
- Create or adapt: `apps/pse-inventory-catalog/catalog.js`
- Create or adapt: `apps/pse-inventory-catalog/styles.css`
- Test: `apps/pse-inventory-catalog/catalog.test.mjs`
- Test: `tests/pse_inventory/test_rfq_identity.py`

**Interfaces:**
- Consumes: only `GET /api/inventory` and `GET /api/inventory/{slug}` public responses.
- Produces: buyer-safe catalog cards, detail route, and RFQ submission containing Deal ID, snapshot/source version, slug, requested quantity, and originating URL.

- [ ] **Step 1: Write the failing RFQ identity test**

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRfqPayload } from './catalog.js';

test('RFQ preserves inventory identity and requested quantity', () => {
  const payload = buildRfqPayload({
    dealId: 'PSE-TEST-0001', slug: 'test-product', sourceVersion: 'sha256:' + 'a'.repeat(64),
    snapshotVersion: 'sha256:' + 'b'.repeat(64), title: 'Test Product'
  }, 500, 'https://pilotsalesdistribution.com/products/test-product');
  assert.equal(payload.dealId, 'PSE-TEST-0001');
  assert.equal(payload.requestedQuantity, 500);
  assert.match(payload.snapshotVersion, /^sha256:/);
});
```

- [ ] **Step 2: Run the Node test and prove the payload builder is absent**

Run: `node --test apps/pse-inventory-catalog/catalog.test.mjs`

Expected: missing export or module failure.

- [ ] **Step 3: Execute the selected website mode**

For `ADAPT_EXISTING`, edit only the exact route/component/handler paths recorded in `implementation-map.json`. For `MOUNT_STATIC_REFERENCE`, copy the packet static catalog and configure Caddy to mount it at `/products`. Both modes must call the same public API and produce the same RFQ payload.

- [ ] **Step 4: Remove unsupported UI claims and filters**

Render category, MOQ, condition, availability, FOB, freight, freshness, and public price/RFQ only when present in the public schema. Hide ratings, testimonials, verified-seller claims, blanket free-shipping claims, and checkout until source-backed systems exist.

- [ ] **Step 5: Run browser-module, RFQ, accessibility, and parity tests**

Run: `node --test apps/pse-inventory-catalog/catalog.test.mjs && python -m pytest tests/pse_inventory/test_rfq_identity.py -v`

Then run the repository's recorded website test/build commands from `implementation-map.json`. Expected: catalog renders only public fields; RFQ preserves identity; feed/API/site Deal IDs and versions match.

- [ ] **Step 6: Commit the buyer experience**

```bash
git add apps/pse-inventory-catalog tests/pse_inventory/test_rfq_identity.py
git commit -m "feat: wire public inventory catalog and RFQ identity"
```

---

### Task 8: Add hardened deployment, identity separation, and supply-chain controls

**Files:**
- Create: `services/pse-inventory/deploy/Dockerfile`
- Create: `services/pse-inventory/deploy/compose.yaml`
- Create: `services/pse-inventory/deploy/Caddyfile`
- Create: `services/pse-inventory/deploy/.env.example`
- Create: `services/pse-inventory/deploy/image-digests.lock`
- Test: `services/pse-inventory/tests/test_deployment_security.py`

**Interfaces:**
- Consumes: service image, public-reader identity, publisher identity, HMAC keys, cursor key, PostgreSQL and Valkey credentials.
- Produces: read-only least-privilege containers, private network boundaries, TLS proxy, exact image digests, and no browser-visible secrets.

- [ ] **Step 1: Write the failing container-hardening test**

```python
def test_api_container_is_read_only_non_root_and_drops_capabilities(compose) -> None:
    api = compose["services"]["api"]
    assert api["read_only"] is True
    assert api["cap_drop"] == ["ALL"]
    assert "no-new-privileges:true" in api["security_opt"]
    assert api["user"] != "0"
    assert "ports" not in api
```

- [ ] **Step 2: Run the focused deployment test and prove the production compose is absent**

Run: `python -m pytest services/pse-inventory/tests/test_deployment_security.py::test_api_container_is_read_only_non_root_and_drops_capabilities -v`

Expected: missing compose or security field failure.

- [ ] **Step 3: Build hardened images and networks**

Use a non-root user, read-only root filesystem, explicit writable volumes, dropped capabilities, no privileged mode, private database/cache network, Caddy-only public ports, health checks, bounded resources, and exact tags plus resolved digests.

- [ ] **Step 4: Separate identities and secrets**

The publisher may read private canonical state and write public snapshots/audit logs. The storefront reader may read only the active public snapshot. Store secrets in the Phase 0 secret store; never commit real values or expose them to client JavaScript.

- [ ] **Step 5: Run deployment, secret, license, SBOM, and image scans**

Run: `python -m pytest services/pse-inventory/tests/test_deployment_security.py -v`, the repository secret scanner, the approved image vulnerability scanner, and SBOM/license reconciliation. Record exact commands and results in `docs/pse-inventory/staging-acceptance.json`.

- [ ] **Step 6: Commit hardened deployment controls**

```bash
git add services/pse-inventory/deploy services/pse-inventory/tests/test_deployment_security.py docs/pse-inventory/staging-acceptance.json
git commit -m "security: harden PSE inventory deployment boundary"
```

---

### Task 9: Add observability, incident response, backup, restore, and rollback automation

**Files:**
- Create: `services/pse-inventory/deploy/prometheus/prometheus.yml`
- Create: `services/pse-inventory/deploy/prometheus/alert_rules.yml`
- Create: `services/pse-inventory/deploy/alertmanager/alertmanager.yml`
- Create: `scripts/pse-inventory-backup.sh`
- Create: `scripts/pse-inventory-restore.sh`
- Create: `scripts/pse-inventory-rollback.sh`
- Test: `services/pse-inventory/tests/test_operational_controls.py`

**Interfaces:**
- Consumes: API metrics, publish audit data, database backup target, active snapshot pointer, deployment provider CLI.
- Produces: alerts for stale inventory, API failure, parity drift, privacy violation, replay spike, rate saturation, shared-state failure, publish rollback, and restore/rollback evidence.

- [ ] **Step 1: Write the failing alert-coverage test**

```python
def test_required_alerts_are_defined(alert_rules) -> None:
    names = {rule["alert"] for group in alert_rules["groups"] for rule in group["rules"] if "alert" in rule}
    assert {
        "PSEInventoryApiUnavailable", "PSEInventorySnapshotStale",
        "PSEInventoryParityMismatch", "PSEInventoryPrivacyViolation",
        "PSEInventoryReplaySpike", "PSEInventorySharedStateUnavailable",
        "PSEInventoryPublishRollback",
    } <= names
```

- [ ] **Step 2: Run the focused test and prove the alert set is incomplete**

Run: `python -m pytest services/pse-inventory/tests/test_operational_controls.py::test_required_alerts_are_defined -v`

Expected: missing alert-rules failure.

- [ ] **Step 3: Implement metrics and alert routing**

Expose request count/latency, current snapshot records/age/version, publish result, rollback count, replay rejection, rate-limit rejection, shared-state health, source/API/site parity, and privacy scan result. Route Critical alerts to the approved on-call channel.

- [ ] **Step 4: Implement deterministic backup, restore, and rollback scripts**

Each script uses strict shell mode, validates required environment variables, records checksums, refuses an empty backup, performs a post-restore readback, and writes evidence to `docs/pse-inventory/rollback-evidence.md`.

- [ ] **Step 5: Run synthetic alert, backup, restore, and rollback drills**

Run: `python -m pytest services/pse-inventory/tests/test_operational_controls.py -v`, then trigger each required alert in staging, restore a backup into an empty staging database, roll back the active snapshot, roll back the deployment image, and re-promote the accepted version.

- [ ] **Step 6: Commit operational recovery**

```bash
git add services/pse-inventory/deploy/prometheus services/pse-inventory/deploy/alertmanager scripts/pse-inventory-*.sh services/pse-inventory/tests/test_operational_controls.py docs/pse-inventory/rollback-evidence.md
git commit -m "ops: add inventory monitoring and recovery automation"
```

---

### Task 10: Migrate verified inventory and pass staging acceptance

**Files:**
- Create: `services/pse-inventory/migrations/100_import_verified_inventory.py`
- Create: `docs/pse-inventory/staging-acceptance.json`
- Create: `tests/pse_inventory/test_staging_acceptance.py`

**Interfaces:**
- Consumes: current authoritative source export, approved source mapping, owner decisions, product media, public terms.
- Produces: private canonical records, review queue entries, zero unauthorized public records, then an owner-approved staging snapshot.

- [ ] **Step 1: Write the failing staging truth-boundary test**

```python
def test_unapproved_source_rows_never_appear_in_staging_public_snapshot(staging_client, source_export) -> None:
    source_ids = {row["sourceRecordId"] for row in source_export if not row.get("publishApproved")}
    public = staging_client.get("/api/inventory?limit=100").json()["data"]
    assert source_ids.isdisjoint({item.get("sourceRecordId") for item in public})
```

- [ ] **Step 2: Run the focused test before importing source data**

Run: `python -m pytest tests/pse_inventory/test_staging_acceptance.py::test_unapproved_source_rows_never_appear_in_staging_public_snapshot -v`

Expected: staging fixture or migration implementation is absent.

- [ ] **Step 3: Import into private canonical and review states only**

Map every source field using `02_IMPLEMENTATION/06_CURRENT_SHEET_TO_CANONICAL_MAPPING.csv`. Preserve source evidence and hashes. Missing proof, live availability, quantity, condition, FOB, pricing mode, media, compliance, or owner approval remains blocked.

- [ ] **Step 4: Publish only owner-approved staging records**

Require source reconfirmation and owner approval against the exact post-migration source version. The dated packet baseline has zero publish-approved records and must not be treated as current approval.

- [ ] **Step 5: Execute the complete staging matrix**

Run service tests, website tests, packet gauntlet, privacy mutations, freshness boundaries, sold/withdrawn transitions, two-replica replay/rate tests, malformed/empty snapshot recovery, RFQ identity, JSON-LD parity, accessibility, alert drills, backup/restore, and deployment/snapshot rollback. Store every command, status, version, URL, checksum, and approver in `staging-acceptance.json`.

- [ ] **Step 6: Commit staging evidence without production claims**

```bash
git add services/pse-inventory/migrations/100_import_verified_inventory.py tests/pse_inventory/test_staging_acceptance.py docs/pse-inventory/staging-acceptance.json
git commit -m "test: record PSE inventory staging acceptance"
```

---

### Task 11: Perform controlled production cutover, live verification, and repeatability proof

**Files:**
- Create: `docs/pse-inventory/production-acceptance.json`
- Create: `docs/pse-inventory/cutover-log.md`
- Create: `tests/pse_inventory/test_live_acceptance_contract.py`

**Interfaces:**
- Consumes: owner-approved staging release, immutable image digests, database migration, backup, rollback command, approved public snapshot.
- Produces: live deployment evidence, feed/API/site parity, RFQ evidence, rollback proof, and two clean reproducible production publication runs.

- [ ] **Step 1: Write the live acceptance contract before cutover**

```python
def test_live_acceptance_evidence_is_complete() -> None:
    value = json.loads(Path("docs/pse-inventory/production-acceptance.json").read_text())
    assert value["productionStatus"] == "VERIFIED_DEPLOYED"
    assert value["criticalDefects"] == 0
    assert value["majorDefects"] == 0
    assert value["feedApiSiteParity"] is True
    assert value["rollbackProven"] is True
    assert value["cleanPublicationRuns"] == 2
```

- [ ] **Step 2: Run the contract and confirm it fails before production evidence exists**

Run: `python -m pytest tests/pse_inventory/test_live_acceptance_contract.py -v`

Expected: missing or `NOT_DEPLOYED` evidence failure.

- [ ] **Step 3: Execute the approved cutover sequence**

Freeze changes, capture a final backup, verify restore, apply migrations, deploy pinned images, publish the approved snapshot, trigger cache revalidation, verify health, and record each timestamp, deployment ID, snapshot version, source version, and operator in `cutover-log.md`.

- [ ] **Step 4: Verify the live buyer and security paths**

Check every published Deal ID and slug through feed, API, catalog, detail page, RFQ, visible terms, price/RFQ mode, freshness, JSON-LD, mobile, keyboard, and monitoring. Confirm private fields, credentials, internal routes, and source identifiers are absent from browser responses and bundles.

- [ ] **Step 5: Prove rollback and two clean runs**

Roll back the application and active snapshot, verify the prior live state, then restore the accepted release. Perform two clean source-to-public publication runs and require identical accepted snapshot bytes and hashes. Populate `production-acceptance.json` only from captured evidence.

- [ ] **Step 6: Run final acceptance and commit the production evidence**

Run: `python -m pytest tests/pse_inventory/test_live_acceptance_contract.py -v` plus the full repository test/build commands and the packet gauntlet. Expected: zero Critical/Major defects, parity true, rollback proven, and two clean runs. Then commit:

```bash
git add docs/pse-inventory/production-acceptance.json docs/pse-inventory/cutover-log.md tests/pse_inventory/test_live_acceptance_contract.py
git commit -m "release: record verified PSE inventory production cutover"
```

## Plan self-review result

- **Spec coverage:** Tasks cover discovery, source authority, private/public storage, dedupe, ATS/freshness, approval, privacy allowlist, deterministic publication, atomic promotion, shared state, API, website/RFQ, security, monitoring, backup/restore, staging, cutover, rollback, and repeatability.
- **Repository ambiguity:** Resolved by one standalone backend layout and a mandatory two-mode website decision recorded during Phase 0; no existing website path is guessed.
- **Production truth boundary:** Preserved. Tasks 10 and 11 cannot pass from packet evidence alone.
- **Type consistency:** `sourceVersion`, `snapshotVersion`, `dealId`, `slug`, `NonceStore.consume`, `RateLimiter.allow`, `stage_snapshot`, `promote_snapshot`, and `active_snapshot` are used consistently.
