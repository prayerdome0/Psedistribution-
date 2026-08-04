#!/usr/bin/env bash
# Atomically re-promote a snapshot version from the immutable history directory.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${PSE_DATA_DIR:-$ROOT/services/pse-inventory/data}"
VERSION="${1:-}"

if [[ -z "$VERSION" ]]; then
  echo "usage: $0 <snapshotVersion>" >&2
  echo "available history:" >&2
  ls "$DATA_DIR/history" 2>/dev/null >&2 || true
  exit 1
fi

case "$VERSION" in
  sha256:*) ;;
  *) echo "ERROR: snapshotVersion must be sha256-prefixed" >&2; exit 1 ;;
esac

HISTORY_FILE="$DATA_DIR/history/${VERSION/:/_}.json"
if [[ ! -f "$HISTORY_FILE" ]]; then
  echo "ERROR: requested rollback snapshot does not exist: $HISTORY_FILE" >&2
  exit 1
fi

"$(dirname "${BASH_SOURCE[0]}")/pse-inventory-restore.sh" "$HISTORY_FILE"
echo "{\"operation\":\"rollback\",\"snapshotVersion\":\"$VERSION\",\"timestamp\":\"$(date -u +%Y%m%dT%H%M%SZ)\"}"
