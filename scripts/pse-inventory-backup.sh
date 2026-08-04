#!/usr/bin/env bash
# Deterministic backup of the active public snapshot. Refuses empty/invalid input.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${PSE_DATA_DIR:-$ROOT/services/pse-inventory/data}"
BACKUP_DIR="${PSE_BACKUP_DIR:-$DATA_DIR/backups}"
PYTHON="${PSE_PYTHON:-python3}"
CURRENT="$DATA_DIR/current.json"

if [[ ! -f "$CURRENT" ]]; then
  echo "ERROR: no active snapshot at $CURRENT" >&2
  exit 1
fi

PYTHONPATH="$ROOT/vendor/pse-inventory-packet/04_REFERENCE_IMPLEMENTATION" "$PYTHON" - "$CURRENT" <<'PY'
import json, sys
import publisher
snapshot = json.loads(open(sys.argv[1], encoding="utf-8").read())
issues = publisher.verify_snapshot_integrity(snapshot)
if issues:
    print("ERROR: active snapshot failed validation: " + "; ".join(issues), file=sys.stderr)
    raise SystemExit(1)
if snapshot.get("recordCount", 0) == 0 and not snapshot.get("emptyOverrideAuthorizationId"):
    print("ERROR: refusing to back up an empty snapshot without dual-control authorization", file=sys.stderr)
    raise SystemExit(1)
PY

mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TARGET="$BACKUP_DIR/backup-$STAMP.json"
cp "$CURRENT" "$TARGET"
CHECKSUM="$(sha256sum "$TARGET" | cut -d' ' -f1)"
echo "{\"operation\":\"backup\",\"file\":\"$TARGET\",\"sha256\":\"$CHECKSUM\",\"timestamp\":\"$STAMP\"}" | tee -a "$BACKUP_DIR/backup.log"
