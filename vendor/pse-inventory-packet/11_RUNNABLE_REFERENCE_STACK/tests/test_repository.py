from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.snapshot_repository import SnapshotRepository, SnapshotUnavailable
from conftest import make_snapshot


def test_repository_loads_and_returns_valid_snapshot(snapshot_file: Path) -> None:
    repository = SnapshotRepository(snapshot_file=snapshot_file, max_last_good_age_seconds=300)
    snapshot = repository.load()
    assert snapshot["recordCount"] == 1
    assert repository.current()["snapshotVersion"] == snapshot["snapshotVersion"]


def test_invalid_replacement_does_not_destroy_last_known_good(snapshot_file: Path) -> None:
    repository = SnapshotRepository(snapshot_file=snapshot_file, max_last_good_age_seconds=300)
    good = repository.load()
    snapshot_file.write_text('{"broken": true}\n', encoding="utf-8")
    with pytest.raises(SnapshotUnavailable):
        repository.load()
    assert repository.current()["snapshotVersion"] == good["snapshotVersion"]


def test_duplicate_slug_snapshot_is_rejected(tmp_path: Path) -> None:
    snapshot = make_snapshot()
    duplicate = dict(snapshot["items"][0])
    duplicate["dealId"] = "PSE-TEST-0002"
    snapshot["items"].append(duplicate)
    snapshot["recordCount"] = 2
    path = tmp_path / "current.json"
    path.write_text(json.dumps(snapshot), encoding="utf-8")
    repository = SnapshotRepository(snapshot_file=path, max_last_good_age_seconds=300)
    with pytest.raises(SnapshotUnavailable):
        repository.load()
