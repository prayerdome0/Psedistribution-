# Changelog

## 4.0.0 - 2026-08-03

### Added

- Runnable open-source FastAPI reference stack with signed cursor pagination,
  rate limiting, ETag support, HMAC revalidation, last-known-good behavior,
  Prometheus metrics, Caddy configuration, PostgreSQL control-plane schema, and
  a static buyer-safe catalog reference.
- Machine-readable packet and contract version controls.
- Apache-2.0 project governance files and security/contribution procedures.
- Reproducible sanitized source-evidence audit with 73 candidate rows, 33
  normalized title clusters, 40 duplicate rows beyond the first, 15 rows
  without a usable quantity, 2 canonical records, and 12,700 represented units.
- Cross-reference linter and release-level regression tests.
- Verified reference container tags for PostgreSQL 18.4, Valkey 9.1.0, Caddy
  2.11.4, Prometheus 3.12.0, and Alertmanager 0.32.1.

### Changed

- Promoted all packet and contract behavior metadata to version 4.0.0 while
  retaining OpenAPI Specification 3.1.0 as the API-description syntax version.
- Corrected the candidate normalization audit from an earlier approximate 34
  clusters / 39 repeated rows to a reproducible 33 clusters / 40 repeated rows.
- Consolidated release evidence across publisher, runtime, and browser-module
  test suites.
- Updated the executive PDF and editable PowerPoint to the v4 evidence set.

### Security

- Preserved fail-closed publication, exact approval-version binding, strict
  public allowlisting, replay-protected HMAC revalidation, sanitized errors,
  private-network database/cache isolation, and last-known-good protection.
