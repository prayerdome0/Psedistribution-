#!/usr/bin/env bash
# Restore a named backup bundle into the active snapshot with post-restore readback.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${PSE_DATA_DIR:-$ROOT/services/pse-inventory/data}"
PYTHON="${PSE_PYTHON:-python3}"
CURRENT="$DATA_DIR/current.json"
SOURCE_FILE="${1:-}"

if [[ -z "$SOURCE_FILE" || ! -f "$SOURCE_FILE" ]]; then
  echo "usage: $0 <backup-file.json>" >&2
  exit 1
fi

PYTHONPATH="$ROOT/vendor/pse-inventory-packet/04_REFERENCE_IMPLEMENTATION" "$PYTHON" - "$SOURCE_FILE" "$CURRENT" <<'PY'
import json, os, sys, tempfile
import publisher

candidate = json.loads(open(sys.argv[1], encoding="utf-8").read())
issues = publisher.verify_snapshot_integrity(candidate)
if issues:
    print("ERROR: restore candidate failed validation: " + "; ".join(issues), file=sys.stderr)
    raise SystemExit(1)

current_path = sys.argv[2]
if os.path.exists(current_path):
    try:
        prior = json.loads(open(current_path, encoding="utf-8").read())
        if not publisher.verify_snapshot_integrity(prior):
            history = os.path.join(os.path.dirname(current_path), "history")
            os.makedirs(history, exist_ok=True)
            name = prior["snapshotVersion"].replace(":", "_") + ".json"
            target = os.path.join(history, name)
            if not os.path.exists(target):
                with open(target, "w", encoding="utf-8") as handle:
                    json.dump(prior, handle, ensure_ascii=False, sort_keys=True, indent=2)
                    handle.write("\n")
    except (json.JSONDecodeError, KeyError):
        pass  # never let a corrupt current block a validated restore

payload = json.dumps(candidate, ensure_ascii=False, sort_keys=True, indent=2) + "\n"
directory = os.path.dirname(current_path) or "."
fd, tmp = tempfile.mkstemp(dir=directory, suffix=".tmp")
with os.fdopen(fd, "w", encoding="utf-8") as handle:
    handle.write(payload)
os.replace(tmp, current_path)

readback = json.loads(open(current_path, encoding="utf-8").read())
if readback.get("snapshotVersion") != candidate.get("snapshotVersion"):
    print("ERROR: post-restore readback mismatch", file=sys.stderr)
    raise SystemExit(1)
print(f"restored snapshotVersion={candidate['snapshotVersion']} recordCount={candidate['recordCount']}")
PY

echo "{\"operation\":\"restore\",\"source\":\"$SOURCE_FILE\",\"timestamp\":\"$(date -u +%Y%m%dT%H%M%SZ)\"}"
