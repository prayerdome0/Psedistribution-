"""Shared fixtures: deterministic canonical records, snapshots and app factory."""
from __future__ import annotations

import copy
import json
from datetime import datetime, timezone
from pathlib import Path

import pytest

from pse_inventory.api import create_app
from pse_inventory.settings import AppSettings
from pse_inventory.snapshot_builder import build_snapshot, compute_record_version

ROOT = Path(__file__).resolve().parents[3]
PACKET = ROOT / "vendor" / "pse-inventory-packet"
FIXTURE_RECORDS = PACKET / "04_REFERENCE_IMPLEMENTATION" / "fixtures" / "canonical_records.valid.json"
FIXTURE_EMPTY_AUTH = PACKET / "04_REFERENCE_IMPLEMENTATION" / "fixtures" / "empty_authorization.valid.json"
FIXED_NOW = datetime(2026, 8, 3, 20, 10, 0, tzinfo=timezone.utc)
CURSOR_SECRET = "unit-test-cursor-secret-with-32+bytes-0123456789"
HMAC_KEYS = {"test-key": "unit-test-hmac-secret-32-bytes-0123456789"}


def load_valid_records() -> list[dict]:
    return json.loads(FIXTURE_RECORDS.read_text(encoding="utf-8"))


def approvals_for(records: list[dict]) -> list[dict]:
    approvals = []
    for record in records:
        if not record.get("publishApproved"):
            continue
        approval = record.get("publishApproval", {})
        approvals.append({
            "dealId": record.get("dealId"),
            "approvedSourceVersion": record.get("source", {}).get("sourceVersion"),
            "approvedRecordVersion": compute_record_version(record),
            "approverId": approval.get("approvedBy", "owner-delegate"),
            "approvedAt": approval.get("approvedAt"),
        })
    return approvals


@pytest.fixture
def valid_records() -> list[dict]:
    return copy.deepcopy(load_valid_records())


@pytest.fixture
def valid_snapshot(valid_records, tmp_path) -> dict:
    snapshot, report = build_snapshot(
        valid_records,
        now=FIXED_NOW,
        run_id="run-test",
        release_id="release-test",
        operator="test-operator",
        approvals=approvals_for(valid_records),
    )
    assert report["result"] == "PASS"
    return snapshot


@pytest.fixture
def snapshot_file(valid_snapshot, tmp_path) -> Path:
    target = tmp_path / "current.json"
    target.write_text(json.dumps(valid_snapshot, ensure_ascii=False, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    return target


@pytest.fixture
def settings(snapshot_file) -> AppSettings:
    return AppSettings(
        snapshot_file=snapshot_file,
        packet_root=PACKET,
        cursor_secret=CURSOR_SECRET,
        hmac_keys=HMAC_KEYS,
        allowed_origins=("https://pilotsalesdistribution.com", "http://testserver"),
        max_last_good_age_seconds=300,
        rate_limit_per_minute=1000,
    )


@pytest.fixture
def client(settings):
    from fastapi.testclient import TestClient

    app = create_app(settings)
    with TestClient(app) as test_client:
        yield test_client


def promote_snapshot_to_file(snapshot: dict, target: Path) -> None:
    target.write_text(json.dumps(snapshot, ensure_ascii=False, sort_keys=True, indent=2) + "\n", encoding="utf-8")


def clone_approved_record(base: dict, *, deal_id: str, slug: str, source_record_id: str, source_hash: str) -> dict:
    """Deep-copy an approved fixture record and rebind every identity-bound field."""
    extra = copy.deepcopy(base)
    extra["dealId"] = deal_id
    extra["publicProfile"]["slug"] = slug
    extra["source"]["sourceRecordIds"] = [source_record_id]
    extra["source"]["sourceHashes"] = [source_hash]
    extra["recordVersion"] = compute_record_version(extra)
    extra["publishApproval"]["approvalVersion"] = extra["recordVersion"]
    return extra
