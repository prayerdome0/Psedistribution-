"""Deterministic source evidence hashing and provenance validation."""
from __future__ import annotations

import hashlib
import json
from typing import Mapping


class ProvenanceError(ValueError):
    pass


def source_sha256(record: Mapping[str, object]) -> str:
    encoded = json.dumps(record, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
    return "sha256:" + hashlib.sha256(encoded).hexdigest()


def require_provenance(row: Mapping[str, object], *, authority: str) -> None:
    """Reject intake rows without traceable provenance.

    Every source row must carry a source identifier, a captured timestamp and
    the authority it was read from; nothing may be inferred later.
    """
    if not authority or not str(authority).strip():
        raise ProvenanceError("authority is required")
    source_id = row.get("sourceRecordId") or row.get("messageId") or row.get("dealId")
    if not source_id or not str(source_id).strip():
        raise ProvenanceError("source identifier is required")
    captured = row.get("capturedAt") or row.get("captured_at")
    if not captured or not str(captured).strip():
        raise ProvenanceError("captured timestamp is required")
    row_authority = row.get("authority")
    if row_authority is not None and str(row_authority) != str(authority):
        raise ProvenanceError("row authority does not match the intake authority")
