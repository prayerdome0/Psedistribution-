# PSE x SalesMax Inventory Wiring - Mastered Open-Source Super Gauntlet v4.0.0

**Prepared:** August 3, 2026  
**Packet profile:** `OPEN_SOURCE_SUPER_GAUNTLET`  
**Packet contract version:** `4.0.0`  
**Engineering handoff:** release-gated by `07_GAUNTLET/run_super_gauntlet.py`  
**Production website integration:** `NOT_DEPLOYED`

The packet is a complete, self-hostable engineering specification and executable reference implementation. It is not evidence that the live website or SalesMax runtime has already been modified. Production remains blocked until the actual repository, hosting environment, authoritative SalesMax data source, backup, rollback, staging and live acceptance evidence are inspected.

## Open-source decision

No hosted or proprietary AI service is required in the inventory path. Inventory reconciliation rules, publication approval, privacy filtering, freshness, API delivery, caching, monitoring and rollback are deterministic. Optional local AI may provide human-reviewed suggestions only and cannot set quantity, price, availability, approval, compliance, hold, publication or deployment state.

`OpenAPI` is the vendor-neutral API-description standard used by the contract files. It is unrelated to OpenAI. See `05_INTEGRATION/01_OPENAPI_STANDARD_CLARIFICATION.md`.

## Mission

Wire `pilotsalesdistribution.com` to current SalesMax/PSE inventory through a controlled publication system that is accurate, buyer-safe, reversible, observable, self-hostable and difficult to misuse.

## Canonical architecture

```text
Source intake / authoritative SalesMax runtime
  -> evidence quarantine and deterministic reconciliation
  -> PostgreSQL private canonical inventory
  -> explicit approval and deterministic publisher
  -> separate PostgreSQL public snapshot/schema
  -> FastAPI read-only API
  -> Valkey cache and replay state
  -> Caddy TLS/reverse proxy
  -> pilotsalesdistribution.com catalog and RFQ
  -> Prometheus + Alertmanager observability
```

Existing components may remain when Phase 0 proves they are secure, open-source, maintainable and compatible with the contracts. Google Sheets may be used for controlled migration or reviewed intake; it is not the required steady-state public serving layer.

## Runnable-reference boundary

`11_RUNNABLE_REFERENCE_STACK/` is deliberately a **single-process reference**. Its default Compose path does not wire PostgreSQL or Valkey into the API. Those services are preview profiles only. Multi-replica production remains blocked until `11_RUNNABLE_REFERENCE_STACK/SHARED_STATE_AND_CONTROL_PLANE_ADAPTERS.md` is implemented in the actual runtime and passes cross-replica replay, rate-limit, transactional publish, restore and rollback gates. Starting a preview container is not integration evidence.

## Non-negotiable boundary

The browser never reads the private master and never receives its credentials. Public output is built from an explicit allowlist; it is never produced by copying a private object and deleting known-sensitive fields.

## Verified dated source baseline

The reproducible sanitized-source audit in `08_SOURCE_EVIDENCE/` records:

- 2 canonical tracker records representing 12,700 units;
- 1 internally Ready and 1 Needs Review;
- 0 explicitly publish-approved records;
- 73 candidate rows, all review/proof/current-availability gated;
- 33 deterministic normalized-title clusters;
- 40 rows beyond the first row in their normalized-title cluster;
- 15 candidate rows without a usable quantity.

These are August 3, 2026 audit facts, not a claim that any item remains available now. Live reconfirmation and owner approval are mandatory before publication.

## Use this release in order

1. Open `01_EXECUTIVE/01_EXECUTIVE_VISUAL_BRIEF.pdf`.
2. Read `02_IMPLEMENTATION/01_MASTER_GAMEPLAN.md`.
3. Review `10_OPEN_SOURCE/01_OPEN_SOURCE_STACK_BLUEPRINT.md`, `10_OPEN_SOURCE/02_DEPENDENCY_LICENSE_REGISTER.csv` and `10_OPEN_SOURCE/03_SBOM.spdx.json`.
4. Complete `02_IMPLEMENTATION/03_PHASE_0_DISCOVERY_WORKSHEET.md` before changing production.
5. Implement against `03_CONTRACTS/`, the workstream index in `02_IMPLEMENTATION/04_IMPLEMENTATION_WORK_BREAKDOWN.md`, and the test-first execution plan in `02_IMPLEMENTATION/10_TASK_BY_TASK_IMPLEMENTATION_PLAN.md`.
6. Use `04_REFERENCE_IMPLEMENTATION/` and `11_RUNNABLE_REFERENCE_STACK/` as tested behavior and deployment references, not as proof of live deployment.
7. Follow `05_INTEGRATION/` and `06_OPERATIONS/` for migration, security, monitoring, backup and rollback.
8. Run `python 07_GAUNTLET/run_super_gauntlet.py . --bootstrap` while editing.
9. Run `python 09_RELEASE/release_v4.py --output-dir .. .` to stabilize evidence, regenerate the manifest, run the full gauntlet, build two deterministic archives, validate two clean extractions, rebuild twice and write the detached attestation.
10. Verify both `09_RELEASE/SHA256SUMS.txt` and the detached archive `.sha256` file before transfer.

## Truth boundary

Packet verification and production verification are separate. Production cannot be called complete until the live repository, host, authoritative SalesMax runtime, deployed API, storefront, RFQ, monitoring, backup, restore and rollback are inspected and pass the acceptance gates.
