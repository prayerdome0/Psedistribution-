"""Last-known-good behavior: transient failures degrade; age fails closed."""
from __future__ import annotations

import json
import time

from conftest import FIXED_NOW, approvals_for, promote_snapshot_to_file

from pse_inventory.snapshot_builder import build_snapshot


def test_malformed_snapshot_serves_last_known_good(client, settings, valid_snapshot):
    healthy = client.get("/api/inventory")
    assert healthy.status_code == 200
    settings.snapshot_file.write_text("{ this is not json", encoding="utf-8")
    degraded = client.get("/api/inventory")
    assert degraded.status_code == 200
    assert degraded.json()["meta"]["snapshotVersion"] == valid_snapshot["snapshotVersion"]
    assert degraded.json()["meta"]["freshness"] == "degraded"


def test_empty_overwrite_attempt_never_replaces_valid_snapshot(client, settings, valid_records):
    unauthorized_empty, _ = None, None
    import pytest

    from pse_inventory.snapshot_builder import PublishBlocked

    stripped = [dict(record, publishApproved=False) for record in valid_records]
    with pytest.raises(PublishBlocked):
        build_snapshot(stripped, now=FIXED_NOW, run_id="run-x", release_id="release-x",
                       operator="test-operator", approvals=[])
    healthy = client.get("/api/inventory")
    assert healthy.status_code == 200
    assert healthy.json()["meta"]["totalCount"] >= 1


def test_last_known_good_expires_fail_closed(settings, snapshot_file, valid_records):
    from dataclasses import replace

    from fastapi.testclient import TestClient

    from pse_inventory.api import create_app

    app = create_app(replace(settings, max_last_good_age_seconds=1))
    with TestClient(app) as test_client:
        assert test_client.get("/api/inventory").status_code == 200
        snapshot_file.write_text("{ broken", encoding="utf-8")
        time.sleep(1.2)
        blocked = test_client.get("/api/inventory")
        assert blocked.status_code == 503
        assert blocked.json()["error"]["code"] == "INVENTORY_UNAVAILABLE"


def test_missing_snapshot_file_fails_closed(tmp_path, settings):
    from dataclasses import replace

    from fastapi.testclient import TestClient

    from pse_inventory.api import create_app

    missing = tmp_path / "absent.json"
    app = create_app(replace(settings, snapshot_file=missing))
    with TestClient(app) as test_client:
        response = test_client.get("/api/inventory")
        assert response.status_code == 503


def test_recovery_after_transient_failure(client, settings, valid_records):
    broken = client.get("/api/inventory")
    assert broken.status_code == 200
    settings.snapshot_file.write_text("[]", encoding="utf-8")
    assert client.get("/api/inventory").json()["meta"]["freshness"] == "degraded"
    snapshot, _ = build_snapshot(valid_records, now=FIXED_NOW, run_id="run-r", release_id="release-r",
                                 operator="test-operator", approvals=approvals_for(valid_records))
    promote_snapshot_to_file(snapshot, settings.snapshot_file)
    recovered = client.get("/api/inventory")
    assert recovered.status_code == 200
    assert recovered.json()["meta"]["freshness"] == "fresh"
    assert recovered.json()["meta"]["snapshotVersion"] == snapshot["snapshotVersion"]
