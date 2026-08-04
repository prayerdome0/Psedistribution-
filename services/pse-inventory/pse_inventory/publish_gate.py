"""Publication gate evaluation, fully delegated to the packet publisher.

A record crosses the publication boundary only when the packet gate passes:
Available status, Ready review, explicit approval, positive ATS, valid
freshness, complete public terms, approved HTTPS media, valid pricing mode and
no blocking review/compliance issue. This wrapper never reinterprets or weakens
those rules; it only makes them callable as a per-record check.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Mapping

from . import snapshot_builder
from ._packet import load_publisher_module

_publisher = load_publisher_module()
PublishBlocked = _publisher.PublishError


def evaluate_gate(record: Mapping[str, Any], *, now: datetime) -> list[str]:
    """Return the list of blocking issues for one record (empty = gate passes).

    Records that are not publish-approved are reported as 'not-approved'
    rather than evaluated, mirroring the publisher's ignore semantics.
    """
    if not record.get("publishApproved"):
        return ["record is not publish-approved"]
    try:
        snapshot_builder.build_snapshot(
            [record],
            now=now,
            run_id="gate-check",
            release_id="gate-check",
            operator="gate-check",
            approvals=[
                {
                    "dealId": record.get("dealId"),
                    "approvedSourceVersion": (record.get("source") or {}).get("sourceVersion") or record.get("sourceVersion"),
                    "approvedRecordVersion": _publisher.compute_record_version(dict(record)),
                    "approverId": "gate-check",
                    "approvedAt": record.get("publishApproval", {}).get("approvedAt"),
                }
            ],
        )
    except PublishBlocked as exc:
        report = exc.report or {}
        issues: list[str] = []
        for rejected in report.get("rejected", []):
            issues.extend(rejected.get("issues", []))
        issues.extend(report.get("errors", []))
        if not issues:
            issues.append(str(exc))
        return issues
    return []


def assert_gate_passes(record: Mapping[str, Any], *, now: datetime) -> None:
    issues = evaluate_gate(record, now=now)
    if issues:
        raise PublishBlocked(f"publication blocked for {record.get('dealId', 'UNKNOWN')}: {issues[0]}")
