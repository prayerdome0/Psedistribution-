# Verified Reference Versions - August 3, 2026

This register separates **officially checked infrastructure releases** from **packet-tested Python pins**. It does not claim every packet-tested Python version is the newest release.

## Officially checked infrastructure release tags

| Component | Reference tag | Primary source | Packet use |
|---|---:|---|---|
| PostgreSQL | 18.4 | https://www.postgresql.org/docs/release/18.4/ | `postgres:18.4-alpine` |
| Valkey | 9.1.0 | https://github.com/valkey-io/valkey/releases/tag/9.1.0 | `valkey/valkey:9.1.0-alpine` |
| Caddy | 2.11.4 | https://github.com/caddyserver/caddy/releases/tag/v2.11.4 | `caddy:2.11.4-alpine` |
| Prometheus | 3.12.0 | https://github.com/prometheus/prometheus/releases/tag/v3.12.0 | `prom/prometheus:v3.12.0` |
| Alertmanager | 0.32.1 | https://github.com/prometheus/alertmanager/releases/tag/v0.32.1 | `prom/alertmanager:v0.32.1` |
| OpenAPI Specification | 3.1.0 | https://spec.openapis.org/oas/v3.1.0.html | Contract syntax |

Image tags are exact but not immutable. Phase 0 must resolve and record content digests before staging or production promotion.

## Packet-tested tooling and libraries

- CPython gauntlet environment: 3.13.5.
- Reference container base tag: 3.13.7-slim-bookworm.
- Node.js test runtime: 22.16.0.
- LibreOffice: 25.2.3.2.
- Poppler utilities: 25.06.0.
- Exact Python packages are listed in:
  - `04_REFERENCE_IMPLEMENTATION/requirements.lock`
  - `11_RUNNABLE_REFERENCE_STACK/requirements.runtime.lock`
  - `11_RUNNABLE_REFERENCE_STACK/requirements.test.lock`

The packet gauntlet reconciles every locked Python package against the SPDX SBOM and the installed verification environment.
