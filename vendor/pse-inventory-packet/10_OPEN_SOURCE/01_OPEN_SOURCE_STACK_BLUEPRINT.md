# Open-Source Stack Blueprint

## Executive decision

Use a small, self-hostable, deterministic stack. **No LLM is required** and no proprietary AI service belongs in the critical path.

## Recommended minimal runtime

| Layer | Preferred open-source component | License posture | Role |
|---|---|---|---|
| Canonical database | PostgreSQL | PostgreSQL License, OSI-approved | Private canonical inventory, approvals, holds, source evidence, audit history |
| Publisher/API | Python + FastAPI + Pydantic | PSF / MIT | Deterministic gate, allowlist mapping, list/detail API, signed revalidation |
| Cache | Valkey | BSD | Last-known-good snapshot, ETag support, nonce/replay state, short-lived caching |
| TLS / reverse proxy | Caddy | Apache-2.0 | HTTPS, reverse proxy, security headers, request limits |
| Metrics | Prometheus | Apache-2.0 | API, publisher, freshness, parity and job metrics |
| Alerting | Alertmanager | Apache-2.0 | Notification routing, grouping and silencing |
| Dashboards | Perses | Apache-2.0 | Open dashboard and visualization layer for Prometheus |
| Admin identity, if needed | Keycloak | Apache-2.0 | Human admin authentication, roles and audit boundaries |
| API description | OpenAPI Specification | Apache-2.0 | Vendor-neutral machine-readable contract; not an AI service |

## Deployment principle

Preserve the existing website framework if Phase 0 proves it is secure, open-source, supportable and able to make server-only API calls. Otherwise, use a self-hosted open-source frontend or server-rendered adapter. Do not force a rewrite merely to change brands or hosting.

## Steady-state data path

1. Import source evidence into quarantine.
2. Reconcile one canonical Deal ID.
3. Store canonical private state in PostgreSQL.
4. Execute deterministic publication rules.
5. Commit a complete public snapshot in a separate PostgreSQL schema/database.
6. Revalidate the read-only FastAPI service.
7. Cache only validated public output in Valkey.
8. Serve through Caddy to the website.
9. Monitor with Prometheus, Alertmanager and Perses.

## Sheets transition

Google Sheets may remain a reviewed intake/export interface during migration. It must not be the only production authority, browser data source, secret store, or public/private security boundary. The open-source target eliminates a required Google Sheets runtime dependency.

## Version and supply-chain rules

- Pin every deployed component to an exact version and immutable image digest after Phase 0.
- Preserve source, license, checksum, SBOM and upgrade/rollback evidence.
- Reject `latest` tags in production.
- Run vulnerability and license scans before promotion.
- Use an OSI-approved license allowlist; require explicit owner/legal review for strong copyleft or exceptional terms.

## Optional local AI

None is needed. A future local model may assist with non-authoritative text classification only after a separate security and license review. It never controls quantities, prices, availability, approvals, holds, publication or deployment.
