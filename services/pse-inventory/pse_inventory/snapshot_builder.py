"""Owner-bound deterministic snapshot construction.

Wraps the vendored packet publisher (the authoritative tested behavior) and
adds the source-version-bound owner approval requirement: a record may publish
only when an explicit approval authorizes the exact current source version and
record version. Any mismatch fails the whole run closed.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Mapping, Sequence

from ._packet import load_publisher_module

_publisher = load_publisher_module()

PublishBlocked = _publisher.PublishError


def _record_source_version(record: Mapping[str, Any]) -> str | None:
    if isinstance(record.get("sourceVersion"), str):
        return record["sourceVersion"]
    source = record.get("source")
    if isinstance(source, Mapping) and isinstance(source.get("sourceVersion"), str):
        return source["sourceVersion"]
    return None


def verify_approvals(
    records: Sequence[Mapping[str, Any]],
    approvals: Sequence[Mapping[str, Any]] | None,
) -> None:
    """Fail closed unless every publish-approved record carries a matching approval."""
    approval_by_deal: dict[str, Mapping[str, Any]] = {}
    for approval in approvals or []:
        deal_id = approval.get("dealId")
        if isinstance(deal_id, str) and deal_id:
            approval_by_deal[deal_id] = approval
    for record in records:
        if not record.get("publishApproved"):
            continue
        deal_id = str(record.get("dealId", ""))
        approval = approval_by_deal.get(deal_id)
        if approval is None:
            raise PublishBlocked(f"publication blocked for {deal_id or 'UNKNOWN'}: no owner approval for this deal")
        current_source_version = _record_source_version(record)
        approved_source_version = approval.get("approvedSourceVersion")
        if not current_source_version or approved_source_version != current_source_version:
            raise PublishBlocked(
                f"publication blocked for {deal_id or 'UNKNOWN'}: approval source version does not match current source version"
            )
        approved_record_version = approval.get("approvedRecordVersion")
        if approved_record_version is not None:
            expected = _publisher.compute_record_version(dict(record))
            if approved_record_version != expected:
                raise PublishBlocked(
                    f"publication blocked for {deal_id or 'UNKNOWN'}: approval record version does not match current record version"
                )


def build_snapshot(
    records: Sequence[Mapping[str, Any]],
    *,
    now: datetime,
    run_id: str,
    release_id: str,
    operator: str,
    approvals: Sequence[Mapping[str, Any]] | None = None,
    previous_snapshot: dict[str, Any] | None = None,
    empty_authorization: dict[str, Any] | None = None,
    allowed_media_hosts: set[str] | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    if now.tzinfo is None:
        raise ValueError("now must be timezone-aware")
    now = now.astimezone(timezone.utc)
    verify_approvals(records, approvals)
    snapshot, report = _publisher.build_snapshot(
        [dict(record) for record in records],
        now=now,
        run_id=run_id,
        release_id=release_id,
        operator=operator,
        previous_snapshot=previous_snapshot,
        empty_authorization=empty_authorization,
        allowed_media_hosts=allowed_media_hosts,
    )
    report["approvalCheck"] = "PASS"
    return snapshot, report


def verify_snapshot_integrity(snapshot: dict[str, Any], *, full_schema: bool = True) -> list[str]:
    return _publisher.verify_snapshot_integrity(snapshot, full_schema=full_schema)


def compute_record_version(record: Mapping[str, Any]) -> str:
    return _publisher.compute_record_version(dict(record))


def iso_now() -> datetime:
    return datetime.now(timezone.utc)
