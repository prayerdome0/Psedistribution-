# Release Notes - v4.0.0

## Release objective

Consolidate prior drafts into one canonical, open-source, implementation-ready packet with a runnable reference stack, reproducible source audit and fail-closed release gauntlet.

## Material upgrades

- Unified packet and contract version at `4.0.0`; OpenAPI syntax remains Specification `3.1.0`.
- Added project-level Apache-2.0 license, notice, security policy, contribution guide and changelog.
- Added deterministic sanitized-source audit reproducing 2 canonical records, 12,700 units, 73 candidate rows, 33 normalized-title clusters, 40 repeated rows beyond the first, 15 rows without usable quantity and 0 publish-approved records.
- Added an executable single-process FastAPI reference API, signed revalidation route, cursor and in-process rate-limit controls, static buyer-safe catalog, PostgreSQL/Valkey preview profiles with a mandatory production-adapter contract, Caddy security policy, Prometheus rules and Alertmanager configuration.
- Corrected the catalog bootstrap so the site works under the packet's own `script-src 'self'` Content Security Policy.
- Added strict release-mastery tests that block stale packet versions, stale visuals, invalid container tags, source-audit drift and broken packet references.
- Added `02_IMPLEMENTATION/10_TASK_BY_TASK_IMPLEMENTATION_PLAN.md`, a 12-task test-first production plan with an explicit website integration decision instead of guessed repository paths.
- Expanded the SPDX SBOM and dependency register to reconcile both exact Python lock files and pinned open-source infrastructure components.
- Added cross-reference linting, cache-file rejection, manifest/checksum verification and deterministic ZIP tooling.
- Added `09_RELEASE/release_v4.py`, which stabilizes evidence, rebuilds metadata, performs two source archive builds, validates two clean rooms, rebuilds twice and emits detached attestation evidence.
- Updated the executive deck to v4.0.0, corrected source-audit counts and current automated-test evidence.

## Truth boundary

This release authorizes engineering handoff after the final gauntlet passes. It does not claim the live website, hosting environment or SalesMax runtime has been changed. Production remains `NOT_DEPLOYED` pending Phase 0 discovery, staging, rollback proof and live acceptance.
