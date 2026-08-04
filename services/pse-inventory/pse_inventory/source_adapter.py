"""Source intake adapter: converts raw authority exports into evidence records.

This adapter never decides availability or approval. It preserves every source
row with a stable hash and captured timestamp so reconciliation and owner
review happen on complete evidence.
"""
from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from .dedupe import ReconciliationResult, reconcile
from .source_hash import ProvenanceError, require_provenance, source_sha256


@dataclass(frozen=True)
class RawEvidenceRecord:
    source_record_id: str
    authority: str
    captured_at: str
    source_hash: str
    payload: dict[str, Any]


class IntakeError(ValueError):
    pass


def ingest(rows: Sequence[Mapping[str, Any]], *, authority: str) -> list[RawEvidenceRecord]:
    """Hash and preserve every intake row; reject rows without provenance."""
    if not authority or not str(authority).strip():
        raise IntakeError("authority is required")
    evidence: list[RawEvidenceRecord] = []
    seen_hashes: set[str] = set()
    for row in rows:
        try:
            require_provenance(row, authority=authority)
        except ProvenanceError as exc:
            raise IntakeError(f"intake row rejected: {exc}") from exc
        payload = dict(row)
        digest = source_sha256(payload)
        if digest in seen_hashes:
            continue
        seen_hashes.add(digest)
        evidence.append(RawEvidenceRecord(
            source_record_id=str(row.get("sourceRecordId") or row.get("messageId") or row.get("dealId")),
            authority=authority,
            captured_at=str(row.get("capturedAt") or row.get("captured_at")),
            source_hash=digest,
            payload=payload,
        ))
    return evidence


def reconcile_evidence(evidence: Sequence[RawEvidenceRecord]) -> ReconciliationResult:
    rows = []
    for record in evidence:
        row = dict(record.payload)
        row.setdefault("sourceHash", record.source_hash[7:] if record.source_hash.startswith("sha256:") else record.source_hash)
        rows.append(row)
    return reconcile(rows)
