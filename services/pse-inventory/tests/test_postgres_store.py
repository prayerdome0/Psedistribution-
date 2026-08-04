"""Control-plane store: validation-first staging and transactional promotion.

Uses a recording fake DBAPI connection to prove the transaction flow:
invalid candidates never touch storage; promotion takes the advisory lock,
inserts, swaps the active pointer and audits in one committed transaction;
failures roll back and leave the prior active snapshot unchanged.
"""
from __future__ import annotations

import json

import pytest

from pse_inventory.postgres_store import (
    PostgresSnapshotStore,
    SnapshotValidationError,
    SQL_ACTIVE_VERSION,
    SQL_ADVISORY_LOCK,
)


class FakeCursor:
    def __init__(self, connection):
        self.connection = connection

    def execute(self, sql, params=None):
        self.connection.executed.append((sql, params))
        if self.connection.fail_on and sql.startswith(self.connection.fail_on):
            raise RuntimeError("simulated database failure")
        if sql == SQL_ACTIVE_VERSION:
            self._result = [(self.connection.active_version,)] if self.connection.active_version else []
        else:
            self._result = []
        if sql.startswith("UPDATE public_inventory.snapshots SET active = true"):
            self.connection.pending_active = params[1]
        if sql.startswith("UPDATE public_inventory.snapshots SET active = false"):
            self.connection.pending_active = None

    def fetchone(self):
        return self._result[0] if self._result else None

    def fetchall(self):
        return self._result


class FakeConnection:
    def __init__(self, fail_on=None):
        self.executed: list[tuple[str, tuple | None]] = []
        self.committed = False
        self.rolled_back = False
        self.active_version = None
        self.pending_active = None
        self.fail_on = fail_on

    def cursor(self):
        return FakeCursor(self)

    def commit(self):
        self.active_version = self.pending_active
        self.committed = True

    def rollback(self):
        self.pending_active = self.active_version  # discard uncommitted pointer swap
        self.rolled_back = True


@pytest.fixture
def connection():
    return FakeConnection()


@pytest.fixture
def store(connection):
    return PostgresSnapshotStore(lambda: connection)


def test_invalid_candidate_never_changes_active_snapshot(store, connection, valid_snapshot):
    first = store.promote_snapshot(store.stage_snapshot(valid_snapshot), operator="release-a")
    invalid = dict(valid_snapshot, recordCount=99)
    with pytest.raises(SnapshotValidationError):
        store.stage_snapshot(invalid)
    assert connection.active_version == first.snapshot_version
    assert not connection.rolled_back


def test_staging_validates_before_any_sql(store, connection, valid_snapshot):
    with pytest.raises(SnapshotValidationError):
        store.stage_snapshot(dict(valid_snapshot, snapshotVersion="sha256:" + "0" * 64))
    assert connection.executed == []


def test_promotion_takes_advisory_lock_and_commits_once(store, connection, valid_snapshot):
    staged = store.stage_snapshot(valid_snapshot, run_id="run-1")
    receipt = store.promote_snapshot(staged, operator="release-op")
    assert connection.executed[0][0] == SQL_ADVISORY_LOCK
    assert connection.committed and not connection.rolled_back
    assert receipt.snapshot_version == valid_snapshot["snapshotVersion"]
    assert receipt.record_count == valid_snapshot["recordCount"]
    assert receipt.output_sha256


def test_promotion_failure_rolls_back_and_preserves_active(connection, valid_snapshot):
    connection.fail_on = "INSERT INTO audit.publish_runs"
    store = PostgresSnapshotStore(lambda: connection)
    staged = store.stage_snapshot(valid_snapshot)
    with pytest.raises(RuntimeError):
        store.promote_snapshot(staged, operator="release-op")
    assert connection.rolled_back and not connection.committed
    assert connection.active_version is None


def test_operator_is_required(store, valid_snapshot):
    staged = store.stage_snapshot(valid_snapshot)
    with pytest.raises(ValueError):
        store.promote_snapshot(staged, operator="   ")


def test_second_promotion_records_previous_version(connection, valid_snapshot, valid_records):
    from conftest import FIXED_NOW, approvals_for
    from pse_inventory.snapshot_builder import build_snapshot

    from conftest import clone_approved_record

    store = PostgresSnapshotStore(lambda: connection)
    first_receipt = store.promote_snapshot(store.stage_snapshot(valid_snapshot), operator="op")
    extra = clone_approved_record(valid_records[0], deal_id="PSE-EXAMPLE-002", slug="second-lot",
                                  source_record_id="SRC-EXAMPLE-002", source_hash="c" * 64)
    records = valid_records + [extra]
    next_snapshot, _ = build_snapshot(records, now=FIXED_NOW, run_id="run-2", release_id="rel-2",
                                      operator="op", approvals=approvals_for(records))
    second_receipt = store.promote_snapshot(store.stage_snapshot(next_snapshot), operator="op")
    assert second_receipt.previous_snapshot_version == first_receipt.snapshot_version
