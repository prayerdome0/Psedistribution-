"""Owner-bound publish gate: approvals must authorize the exact source version."""
from __future__ import annotations

import copy

import pytest

from conftest import FIXED_NOW, approvals_for
from pse_inventory.publish_gate import evaluate_gate
from pse_inventory.snapshot_builder import PublishBlocked, build_snapshot


def test_publish_rejects_approval_for_prior_source_version(valid_records):
    record = valid_records[0]
    approval = approvals_for(valid_records)[0]
    record["sourceVersion"] = "sha256:" + "b" * 64
    approval["approvedSourceVersion"] = "sha256:" + "a" * 64
    with pytest.raises(PublishBlocked, match="source version"):
        build_snapshot([record], approvals=[approval], now=FIXED_NOW,
                       run_id="run", release_id="release", operator="op")


def test_publish_rejects_missing_approval(valid_records):
    with pytest.raises(PublishBlocked, match="no owner approval"):
        build_snapshot(valid_records, approvals=[], now=FIXED_NOW,
                       run_id="run", release_id="release", operator="op")


def test_publish_rejects_stale_record_version(valid_records):
    approval = approvals_for(valid_records)[0]
    approval["approvedRecordVersion"] = "sha256:" + "c" * 64
    with pytest.raises(PublishBlocked, match="record version"):
        build_snapshot(valid_records, approvals=[approval], now=FIXED_NOW,
                       run_id="run", release_id="release", operator="op")


def test_gate_passes_for_valid_fixture(valid_records):
    assert evaluate_gate(valid_records[0], now=FIXED_NOW) == []


def test_gate_blocks_unapproved_record(valid_records):
    record = copy.deepcopy(valid_records[0])
    record["publishApproved"] = False
    assert evaluate_gate(record, now=FIXED_NOW) == ["record is not publish-approved"]


def test_gate_blocks_stale_availability(valid_records):
    from datetime import datetime, timedelta, timezone

    record = copy.deepcopy(valid_records[0])
    stale_now = FIXED_NOW + timedelta(days=4)
    issues = evaluate_gate(record, now=stale_now)
    assert issues, "records beyond the unpublish window must be blocked"


def test_duplicate_deal_ids_fail_the_whole_run(valid_records):
    duplicated = valid_records + [copy.deepcopy(valid_records[0])]
    with pytest.raises(PublishBlocked, match="duplicate dealId"):
        build_snapshot(duplicated, approvals=approvals_for(duplicated), now=FIXED_NOW,
                       run_id="run", release_id="release", operator="op")
