# Monitoring and Alerting

| Signal | Warning | Critical | Required response |
|---|---:|---:|---|
| Last successful publish age | >15 min beyond expected cadence | >approved maximum | Investigate publisher; fail closed when policy requires |
| Published record parity | Any mismatch | Any mismatch after retry | Stop release and reconcile versions |
| Stale published records | 1 | >1 or customer impact | Unpublish/reconfirm |
| API 5xx rate | >1% / 5 min | >5% / 5 min | Last-known-good/fail closed and incident |
| API p95 latency | >750 ms | >1500 ms | Inspect cache/upstream |
| Invalid snapshot count | 1 | repeated | Stop publisher and investigate |
| Privacy/schema violation | any | any | Critical incident |
| HMAC signature/replay failure | burst above baseline | suspected attack | Block/investigate/rotate |
| RFQ unknown Deal ID/version | any | repeated | Fix client/server parity |
| Rollback readiness | untested >30 days | rollback fails | Block production release |

Log runId, releaseId, requestId, Deal ID, sourceVersion, snapshotVersion, freshness, result and sanitized error code. Never log secrets, full private records or private proof URLs.
