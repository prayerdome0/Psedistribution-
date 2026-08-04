# PSE Inventory — Backup, Restore and Rollback Evidence

Feed-side recovery is implemented and tested in this repository. Hosting-side
deployment rollback requires owner access to the live project and stays
`PENDING_OWNER_PROVISIONING` (see `phase-0-evidence.md`).

## Snapshot store layout

```text
services/pse-inventory/data/
  current.json          # active validated public snapshot
  history/              # every previously promoted snapshot, immutable
```

## Scripts

| Script | Behavior |
|---|---|
| `scripts/pse-inventory-backup.sh` | Validates `current.json`, refuses an empty/invalid backup, writes a checksummed backup bundle and records the SHA-256. |
| `scripts/pse-inventory-restore.sh` | Restores a named backup bundle, re-validates the snapshot against the packet integrity rules, performs a post-restore readback and appends evidence below. |
| `scripts/pse-inventory-rollback.sh` | Atomically re-promotes a snapshot version from `history/` (never from untrusted input), re-validates, and appends evidence below. |

All three scripts run under `set -euo pipefail`, validate required environment
variables, and fail closed: a malformed or empty candidate can never replace a
valid non-empty snapshot without the packet's dual-control empty authorization.

## Drill log

| Date (UTC) | Operation | Snapshot version | Result | Operator |
|---|---|---|---|---|
| 2026-08-04 18:16 | Initial staging publish (demo dataset via full publisher pipeline) | `sha256:d81cd244e9a8fb2b29a093bd7461cdfc2922245801a111807e767ec52517bec4` | PASS | engineering-session |
| 2026-08-04 18:19 | Backup (`scripts/pse-inventory-backup.sh`), sha256 `ddf01a7b…03bf` | `sha256:d81cd244…7bec4` | PASS | engineering-session |
| 2026-08-04 18:19 | Restore from backup bundle with post-restore readback | `sha256:d81cd244…7bec4` | PASS | engineering-session |
| 2026-08-04 18:19 | Rollback re-promotion from immutable `history/` | `sha256:d81cd244…7bec4` | PASS | engineering-session |

Hosting deployment rollback drill: `PENDING_OWNER_PROVISIONING`.
