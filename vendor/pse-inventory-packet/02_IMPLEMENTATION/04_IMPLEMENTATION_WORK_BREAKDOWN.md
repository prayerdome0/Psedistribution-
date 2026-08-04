# Implementation Work Breakdown

| ID | Workstream | Deliverable | Mandatory verification | Dependency |
|---|---|---|---|---|
| W0-01 | Discovery | Repository/framework/deployment evidence | Build and test commands run from clean checkout | None |
| W0-02 | Discovery | SalesMax source authority evidence | Readback of schema, records, timestamps and access | W0-01 |
| W0-03 | Recovery | Production backup and staging restore | Restore completes and is usable | W0-01 |
| W0-04 | Recovery | Deployment rollback proof | Prior deployment restored and re-promoted | W0-03 |
| W1-01 | Data | Canonical storage implementation | Canonical schema fixtures pass | W0-02 |
| W1-02 | Data | Current-sheet migration mapping | Every source column mapped or explicitly blocked | W1-01 |
| W1-03 | Data | Deduplication/source linkage | Duplicate threads link to one Deal ID without deleting history | W1-02 |
| W1-04 | Data | ATS and reservation model | ATS equals on-hand minus reserved in every tested case | W1-01 |
| W1-05 | Data | Freshness confirmation workflow | 24h/72h boundaries pass | W1-01 |
| W2-01 | Publisher | Explicit publication gate | Every gate failure blocks the entire run | W1-01 |
| W2-02 | Publisher | Allowlist mapper | Private-field mutation suite rejects all leaks | W2-01 |
| W2-03 | Publisher | Snapshot hashing/versioning | Fixed input produces identical snapshot hash | W2-02 |
| W2-04 | Publisher | Atomic stage/promote | Invalid/empty candidate cannot replace valid snapshot | W2-03 |
| W2-05 | Publisher | Publish log/diff | Source/output hashes and changed Deal IDs recorded | W2-04 |
| W3-01 | API | Inventory list endpoint | Contract, pagination, filtering and 304 tests pass | W2-04 |
| W3-02 | API | Inventory detail endpoint | Unpublished slug returns 404; ETag parity passes | W3-01 |
| W3-03 | API | Last-known-good cache | Transient/stale/fail-closed cases pass | W3-01 |
| W3-04 | API | Rate/size/time limits | 400/429/503 error contracts pass | W3-01 |
| W3-05 | Security | HMAC revalidation | Signature, content hash, skew, key ID and replay tests pass | W3-03 |
| W3-06 | Distributed state | Valkey nonce and rate-limit adapter | Two replicas share atomic replay/rate state; backend failure fails closed | W3-05 |
| W3-07 | Control plane | PostgreSQL publisher/audit adapter | Role isolation, transaction rollback, advisory locking and restore tests pass | W2-05 |
| W4-01 | Website | Catalog and product pages | Feed/API/site parity and mobile/accessibility checks pass | W3-02 |
| W4-02 | Website | Real filters only | Every visible filter maps to populated verified fields | W4-01 |
| W4-03 | Website | RFQ prefill | Deal ID, source version and quantity survive submission | W4-01 |
| W4-04 | Website | Claims cleanup | Promotional metrics/terms are source-backed or removed | W4-01 |
| W4-05 | Website | Product structured data | JSON-LD matches visible content | W4-01 |
| W5-01 | Operations | Monitoring/alerts | Synthetic stale, parity and API faults trigger expected alerts | W3-03 |
| W5-02 | Operations | Incident response | Tabletop stale/leak/rollback scenarios completed | W5-01 |
| W5-03 | Operations | Backup/restore | Snapshot and configuration restore pass | W2-04 |
| W6-01 | Release | Staging acceptance | All runnable production tests pass | W4-05 |
| W6-02 | Release | Production cutover | Controlled publish, deploy and live parity pass | W6-01 |
| W6-03 | Release | Rollback rehearsal | Snapshot and deployment rollback pass | W6-02 |
| W6-04 | Release | Clean repeatability | Two clean end-to-end runs reproduce accepted state | W6-03 |
