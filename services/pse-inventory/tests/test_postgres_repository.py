"""PostgreSQL public snapshot repository tests without a live database."""
from __future__ import annotations

import json

import pytest

from pse_inventory.postgres_repository import PostgresSnapshotRepository
from pse_inventory.snapshot_repository import SnapshotUnavailable


class Cursor:
    def __init__(self, connection):
        self.connection = connection

    def execute(self, sql):
        self.connection.queries.append(sql)

    def fetchone(self):
        if self.connection.fail:
            raise ConnectionError('database down')
        return (self.connection.snapshot,) if self.connection.snapshot is not None else None


class Connection:
    def __init__(self, snapshot):
        self.snapshot = snapshot
        self.fail = False
        self.queries = []
        self.closed = False

    def cursor(self):
        return Cursor(self)

    def close(self):
        self.closed = True


def test_repository_reads_and_validates_active_snapshot(valid_snapshot):
    connection = Connection(valid_snapshot)
    repo = PostgresSnapshotRepository(
        connection_factory=lambda: connection,
        max_last_good_age_seconds=300,
    )
    assert repo.refresh_or_last_good()["snapshotVersion"] == valid_snapshot["snapshotVersion"]
    assert connection.closed
    assert repo.freshness == "fresh"


def test_repository_serves_recent_last_known_good_on_database_failure(valid_snapshot):
    connection = Connection(valid_snapshot)
    now = [0.0]
    repo = PostgresSnapshotRepository(
        connection_factory=lambda: connection,
        max_last_good_age_seconds=300,
        clock=lambda: now[0],
    )
    repo.load()
    connection.fail = True
    assert repo.refresh_or_last_good()["snapshotVersion"] == valid_snapshot["snapshotVersion"]
    assert repo.freshness == "degraded"
    now[0] = 301.0
    with pytest.raises(SnapshotUnavailable):
        repo.current()


def test_repository_rejects_malformed_database_snapshot():
    connection = Connection({"recordCount": 1})
    repo = PostgresSnapshotRepository(connection_factory=lambda: connection, max_last_good_age_seconds=300)
    with pytest.raises(SnapshotUnavailable):
        repo.load()
