# Packet Contents Index - v4.0.0

## Start here

- `00_START_HERE.md` - release boundary, architecture decision and execution order.
- `01_EXECUTIVE/01_EXECUTIVE_VISUAL_BRIEF.pdf` - 22-page visual brief.
- `01_EXECUTIVE/02_EXECUTIVE_VISUAL_BRIEF_EDITABLE.pptx` - editable source deck.

## Engineering and contracts

- `02_IMPLEMENTATION/` - master gameplan, handoff, discovery worksheet, work breakdown, full task-by-task test-first plan, migration, mapping, RACI, assumptions and definition of done.
- `03_CONTRACTS/` - canonical/private schema, public item/snapshot/list schemas, public and internal OpenAPI contracts, examples, field map, denylist, dedupe, freshness, media and publish-gate rules.
- `04_REFERENCE_IMPLEMENTATION/` - deterministic publisher, atomic store, canonical HMAC revalidation, fixtures and the legacy behavioral/adversarial suite.
- `11_RUNNABLE_REFERENCE_STACK/` - executable single-process FastAPI API, static catalog, PostgreSQL schema, Caddy/Prometheus/Alertmanager default deployment, PostgreSQL/Valkey preview profiles, distributed-state adapter contract and runtime tests.
- `05_INTEGRATION/` - source-of-truth, open-source policy, API/cache, website/RFQ, HMAC, SEO and environment contracts.

## Operations, evidence and release control

- `06_OPERATIONS/` - deployment, rollback, incident, monitoring, backup/restore, access, threat, security and privacy controls.
- `07_GAUNTLET/` - packet and production gates, cross-reference linter, clean-room runbook and executable release runner.
- `08_SOURCE_EVIDENCE/` - public-site audit, deterministic inventory-source audit, sanitized audit extracts, research sources and provenance.
- `09_RELEASE/` - release notes, result, decision, contents index, manifest, SHA-256 list, deterministic ZIP tooling and the full clean-room release orchestrator.
- `10_OPEN_SOURCE/` - stack blueprint, dependency/license register, SPDX SBOM, verified-version record, supply-chain policy and adoption decision.

## Verification commands

```bash
python 07_GAUNTLET/run_super_gauntlet.py . --bootstrap
python 09_RELEASE/release_v4.py --output-dir .. .
sha256sum -c ../PSE_SalesMax_Inventory_Wiring_MASTERED_OPEN_SOURCE_v4.0.0_2026-08-03.zip.sha256
```
