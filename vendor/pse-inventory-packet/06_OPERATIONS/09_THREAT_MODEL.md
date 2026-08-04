# Threat Model

| Threat | Example | Control | Verification |
|---|---|---|---|
| Private-data disclosure | Supplier/cost/proof reaches API | Separate feed, allowlist mapper, strict schema, mutation scan | Privacy mutations and live API scan |
| Stale inventory | Old confirmation still shows Available | Stored confirmation/expiry, 24h/72h policy, monitoring | Boundary tests and time simulation |
| Duplicate publication | Reply threads become separate products | Stable Deal ID, source IDs/hashes, unique slug | Duplicate tests and reconciliation review |
| Cache poisoning/invalid snapshot | Empty/malformed output replaces valid feed | Validate before promotion, hash, atomic swap, last-known-good | Empty/malformed/rollback tests |
| Replay/forged revalidation | Captured request re-used | HMAC exact-body, key ID, timestamp, nonce store | HMAC unit and replay tests |
| Credential leakage | Sheet key in browser/repo | Managed identity, secret manager, secret scan | Bundle/repo/log scan |
| SSRF/unsafe assets | file/javascript/internal URL | HTTPS schema, approved host allowlist, no arbitrary server fetch | URL mutation and host tests |
| XSS/content injection | Product text inserted as HTML | Context escaping/text APIs, CSP, no unsafe HTML | Frontend security tests |
| Unauthorized release | Worker publishes without owner | Explicit Publish Approved, roles, change log | Approval negative tests |
| Race/hold mismatch | Quantity changes during buyer commitment | RFQ-first, controlled holds, ATS transaction | Concurrency/hold tests before checkout |
| Observability leakage | Logs contain private record/secret | Structured sanitized logging | Log scan |
| Rollback failure | Bad deploy cannot restore | Snapshot/deployment backups and rehearsed runbook | Scheduled restore/rollback proof |
