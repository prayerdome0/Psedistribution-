"""Transactional inventory control-plane store (PostgreSQL).

Uses the schemas and grants in `migrations/001_inventory_control_plane.sql`
and `migrations/002_role_grants.sql`. One transaction plus a scoped advisory
lock protects staging validation, snapshot insertion, active-pointer swap and
audit insertion; a failed validation or transaction leaves the prior active
snapshot unchanged.

The connection is dependency-injected (DBAPI-shaped) so unit tests can verify
the transaction flow without a live database; integration tests run against a
real pinned PostgreSQL when `PSE_TEST_DATABASE_URL` is provided.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable

from ._packet import load_publisher_module
from .snapshot_builder import verify_snapshot_integrity

ADVISORY_LOCK_KEY = 73019_4000  # stable, namespaced lock for publish promotion

_publisher = load_publisher_module()

SQL_ADVISORY_LOCK = "SELECT pg_advisory_xact_lock(%s)"
SQL_INSERT_SNAPSHOT = (
    "INSERT INTO public_inventory.snapshots "
    "(snapshot_version, source_version, generated_at, record_count, snapshot, active, activated_at) "
    "VALUES (%s, %s, %s, %s, %s, false, NULL) "
    "ON CONFLICT (snapshot_version) DO NOTHING"
)
SQL_DEACTIVATE_ACTIVE = "UPDATE public_inventory.snapshots SET active = false WHERE active"
SQL_ACTIVATE_SNAPSHOT = (
    "UPDATE public_inventory.snapshots SET active = true, activated_at = %s WHERE snapshot_version = %s"
)
SQL_ACTIVE_VERSION = "SELECT snapshot_version FROM public_inventory.snapshots WHERE active"
SQL_LOAD_SNAPSHOT = "SELECT snapshot FROM public_inventory.snapshots WHERE snapshot_version = %s"
SQL_ACTIVE_SNAPSHOT = "SELECT snapshot FROM public_inventory.active_snapshot LIMIT 1"
SQL_INSERT_RUN = (
    "INSERT INTO audit.publish_runs (run_id, release_id, operator_id, source_version, snapshot_version, result, input_count, published_count, report, completed_at) "
    "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
)
SQL_INSERT_EVENT = (
    "INSERT INTO audit.change_events (run_id, actor_id, event_type, deal_id, old_version, new_version, detail) "
    "VALUES (%s, %s, %s, NULL, %s, %s, %s)"
)


class SnapshotValidationError(RuntimeError):
    pass


@dataclass(frozen=True)
class StagedSnapshot:
    run_id: str
    snapshot_version: str
    source_version: str
    record_count: int
    output_sha256: str
    snapshot: dict[str, Any]


@dataclass(frozen=True)
class PublishReceipt:
    run_id: str
    snapshot_version: str
    previous_snapshot_version: str | None
    record_count: int
    output_sha256: str


def snapshot_sha256(snapshot: dict[str, Any]) -> str:
    encoded = json.dumps(snapshot, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


class PostgresSnapshotStore:
    def __init__(self, connection_factory: Callable[[], Any]):
        self._connection_factory = connection_factory

    def stage_snapshot(self, snapshot: dict[str, Any], *, run_id: str = "staged") -> StagedSnapshot:
        """Validate a candidate fully before it may ever touch the store."""
        if not isinstance(snapshot, dict):
            raise SnapshotValidationError("snapshot must be an object")
        issues = verify_snapshot_integrity(snapshot)
        if issues:
            raise SnapshotValidationError("candidate snapshot failed validation: " + "; ".join(sorted(issues)))
        return StagedSnapshot(
            run_id=run_id,
            snapshot_version=snapshot["snapshotVersion"],
            source_version=snapshot["sourceVersion"],
            record_count=snapshot["recordCount"],
            output_sha256=snapshot_sha256(snapshot),
            snapshot=snapshot,
        )

    def promote_snapshot(self, staged: StagedSnapshot, *, operator: str, release_id: str = "release") -> PublishReceipt:
        if not operator or not str(operator).strip():
            raise ValueError("operator is required")
        issues = verify_snapshot_integrity(staged.snapshot)
        if issues:
            raise SnapshotValidationError("staged snapshot failed re-validation: " + "; ".join(sorted(issues)))
        connection = self._connection_factory()
        cursor = connection.cursor()
        try:
            cursor.execute(SQL_ADVISORY_LOCK, (ADVISORY_LOCK_KEY,))
            cursor.execute(SQL_ACTIVE_VERSION)
            row = cursor.fetchone()
            previous_version = row[0] if row else None
            cursor.execute(
                SQL_INSERT_SNAPSHOT,
                (
                    staged.snapshot_version,
                    staged.source_version,
                    staged.snapshot["generatedAt"],
                    staged.record_count,
                    json.dumps(staged.snapshot, ensure_ascii=False, sort_keys=True),
                ),
            )
            cursor.execute(SQL_DEACTIVATE_ACTIVE)
            now_iso = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
            cursor.execute(SQL_ACTIVATE_SNAPSHOT, (now_iso, staged.snapshot_version))
            cursor.execute(
                SQL_INSERT_RUN,
                (
                    staged.run_id, release_id, operator, staged.source_version,
                    staged.snapshot_version, "passed", staged.record_count, staged.record_count,
                    json.dumps({"outputSha256": staged.output_sha256}, sort_keys=True), now_iso,
                ),
            )
            cursor.execute(
                SQL_INSERT_EVENT,
                (staged.run_id, operator, "snapshot-promoted", previous_version, staged.snapshot_version,
                 json.dumps({"recordCount": staged.record_count}, sort_keys=True)),
            )
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        return PublishReceipt(
            run_id=staged.run_id,
            snapshot_version=staged.snapshot_version,
            previous_snapshot_version=previous_version,
            record_count=staged.record_count,
            output_sha256=staged.output_sha256,
        )

    def active_snapshot(self) -> dict[str, Any]:
        connection = self._connection_factory()
        cursor = connection.cursor()
        cursor.execute(SQL_ACTIVE_SNAPSHOT)
        row = cursor.fetchone()
        if row is None:
            raise SnapshotValidationError("no active snapshot")
        snapshot = row[0] if isinstance(row[0], dict) else json.loads(row[0])
        issues = verify_snapshot_integrity(snapshot)
        if issues:
            raise SnapshotValidationError("active snapshot failed validation")
        return snapshot
