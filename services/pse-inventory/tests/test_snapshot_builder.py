"""Deterministic snapshot construction, hashing and the empty-override control."""
from __future__ import annotations

import copy
import json
from datetime import datetime, timezone

import pytest

from conftest import FIXED_NOW, FIXTURE_EMPTY_AUTH, approvals_for
from pse_inventory.snapshot_builder import PublishBlocked, build_snapshot, verify_snapshot_integrity


def test_fixed_input_produces_byte_identical_output(valid_records):
    first, _ = build_snapshot(valid_records, now=FIXED_NOW, run_id="run", release_id="rel",
                              operator="op", approvals=approvals_for(valid_records))
    second, _ = build_snapshot(copy.deepcopy(valid_records), now=FIXED_NOW, run_id="run", release_id="rel",
                               operator="op", approvals=approvals_for(valid_records))
    assert json.dumps(first, sort_keys=True).encode() == json.dumps(second, sort_keys=True).encode()
    assert first["snapshotVersion"] == second["snapshotVersion"]


def test_snapshot_integrity_rejects_tampered_item(valid_records):
    snapshot, _ = build_snapshot(valid_records, now=FIXED_NOW, run_id="run", release_id="rel",
                                 operator="op", approvals=approvals_for(valid_records))
    tampered = copy.deepcopy(snapshot)
    tampered["items"][0]["title"] = "Tampered title"
    assert verify_snapshot_integrity(tampered), "tampered snapshot must fail integrity"


def test_empty_snapshot_requires_dual_control_authorization(valid_records):
    stripped = [dict(record, publishApproved=False) for record in valid_records]
    with pytest.raises(PublishBlocked, match="empty snapshot blocked"):
        build_snapshot(stripped, now=FIXED_NOW, run_id="run", release_id="rel", operator="op", approvals=[])


def test_empty_snapshot_passes_only_with_valid_authorization(valid_records):
    stripped = [dict(record, publishApproved=False) for record in valid_records]
    authorization = json.loads(FIXTURE_EMPTY_AUTH.read_text(encoding="utf-8"))
    fresh_auth = copy.deepcopy(authorization)
    now = datetime(2026, 8, 3, 20, 10, tzinfo=timezone.utc)
    for approver in fresh_auth["approvers"]:
        approver["approvedAt"] = "2026-08-03T19:00:00Z"
    snapshot, report = build_snapshot(stripped, now=now, run_id="run", release_id="rel", operator="op",
                                      approvals=[], empty_authorization=fresh_auth)
    assert snapshot["recordCount"] == 0
    assert snapshot["emptyOverrideAuthorizationId"] == fresh_auth["authorizationId"]
    assert report["result"] == "PASS"


def test_snapshot_carries_version_chain(valid_records, valid_snapshot):
    assert valid_snapshot["schemaVersion"] == "4.0.0"
    assert valid_snapshot["snapshotVersion"].startswith("sha256:")
    assert valid_snapshot["sourceVersion"].startswith("sha256:")
    assert valid_snapshot["recordCount"] == len(valid_snapshot["items"])
    assert verify_snapshot_integrity(valid_snapshot) == []
