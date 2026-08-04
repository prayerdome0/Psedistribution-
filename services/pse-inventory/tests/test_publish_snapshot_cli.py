"""Production publish CLI: gated promotion, approval binding, fail-closed audit."""
from __future__ import annotations

import copy
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest

SERVICE = Path(__file__).resolve().parents[1]
if str(SERVICE) not in sys.path:
    sys.path.insert(0, str(SERVICE))

import publish_snapshot  # noqa: E402

from pse_inventory.snapshot_builder import compute_record_version  # noqa: E402

# Mirrors conftest.FIXED_NOW so the valid fixture records stay within the
# packet freshness window during these tests.
FIXED_NOW = datetime(2026, 8, 3, 20, 10, 0, tzinfo=timezone.utc)
NOW_ARG = FIXED_NOW.isoformat().replace("+00:00", "Z")


def approvals_for(records: list[dict]) -> list[dict]:
    """Owner approvals bound to each approved record's exact source version."""
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


def write_json(path: Path, payload) -> Path:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def run_cli(tmp_path: Path, records, approvals, *, extra: list[str] | None = None) -> int:
    store = tmp_path / "store"
    args = [
        "--records", str(write_json(tmp_path / "records.json", records)),
        "--approvals", str(write_json(tmp_path / "approvals.json", approvals)),
        "--operator", "test-owner",
        "--run-id", "run-cli-test",
        "--release-id", "release-cli-test",
        "--data-dir", str(store),
        "--now", NOW_ARG,
    ]
    if extra:
        args.extend(extra)
    return publish_snapshot.main(args)


@pytest.fixture
def approved_record(valid_records) -> dict:
    assert len(valid_records) == 1
    return valid_records[0]


def test_publish_cli_promotes_and_archives(tmp_path, valid_records):
    approvals = approvals_for(valid_records)
    assert run_cli(tmp_path, valid_records, approvals) == 0

    store = tmp_path / "store"
    current = json.loads((store / "current.json").read_text(encoding="utf-8"))
    assert current["recordCount"] == 1
    assert current["snapshotVersion"].startswith("sha256:")
    assert current["items"][0]["dealId"] == "PSE-EXAMPLE-001"

    history = list((store / "history").glob("*.json"))
    assert any(current["snapshotVersion"].replace(":", "_") in path.name for path in history)

    reports = list((store / "publish_reports").glob("*.json"))
    assert reports, "every run must leave an audit report"
    report = json.loads(reports[0].read_text(encoding="utf-8"))
    assert report["result"] == "PASS"
    assert report["promoted"] is True
    assert report["operator"] == "test-owner"


def test_publish_cli_identical_content_is_deterministic(tmp_path, valid_records):
    """snapshotVersion is content-addressed: identical published content must
    hash identically regardless of run/release identity."""
    approvals = approvals_for(valid_records)
    assert run_cli(tmp_path, valid_records, approvals) == 0
    first = json.loads((tmp_path / "store" / "current.json").read_text(encoding="utf-8"))
    assert run_cli(tmp_path, valid_records, approvals,
                   extra=["--release-id", "release-cli-test-2"]) == 0
    second = json.loads((tmp_path / "store" / "current.json").read_text(encoding="utf-8"))
    assert second["snapshotVersion"] == first["snapshotVersion"]


def test_publish_cli_changed_content_archives_prior_snapshot(tmp_path, valid_records):
    approvals = approvals_for(valid_records)
    assert run_cli(tmp_path, valid_records, approvals) == 0
    first = json.loads((tmp_path / "store" / "current.json").read_text(encoding="utf-8"))

    # a re-confirmed source version changes the published identity, so the new
    # snapshot supersedes and archives the previous one
    updated = copy.deepcopy(valid_records)
    now_z = FIXED_NOW.isoformat().replace("+00:00", "Z")
    updated[0]["source"]["sourceVersion"] = "sha256:" + "b" * 64
    updated[0]["source"]["lastSourceVerifiedAt"] = now_z
    # re-verification implies a fresh review + owner approval at FIXED_NOW
    updated[0]["audit"]["recordUpdatedAt"] = now_z
    updated[0]["publishApproval"]["approvedAt"] = now_z
    updated[0]["recordVersion"] = compute_record_version(updated[0])
    updated[0]["publishApproval"]["approvalVersion"] = updated[0]["recordVersion"]
    assert run_cli(tmp_path, updated, approvals_for(updated),
                   extra=["--run-id", "run-cli-test-2"]) == 0
    second = json.loads((tmp_path / "store" / "current.json").read_text(encoding="utf-8"))
    assert second["snapshotVersion"] != first["snapshotVersion"]
    assert second["previousSnapshotVersion"] == first["snapshotVersion"]

    archived = tmp_path / "store" / "history" / (first["snapshotVersion"].replace(":", "_") + ".json")
    assert archived.is_file(), "prior snapshot must be archived before promotion"


def test_publish_cli_dry_run_promotes_nothing(tmp_path, valid_records):
    approvals = approvals_for(valid_records)
    assert run_cli(tmp_path, valid_records, approvals, extra=["--dry-run"]) == 0
    assert not (tmp_path / "store" / "current.json").exists()
    assert not (tmp_path / "store" / "history").exists()


def test_publish_cli_blocks_without_approvals(tmp_path, valid_records):
    assert run_cli(tmp_path, valid_records, []) == 2
    assert not (tmp_path / "store" / "current.json").exists()


def test_publish_cli_blocks_on_source_version_mismatch(tmp_path, valid_records):
    approvals = approvals_for(valid_records)
    approvals[0]["approvedSourceVersion"] = "sha256:" + "0" * 64
    assert run_cli(tmp_path, valid_records, approvals) == 2
    assert not (tmp_path / "store" / "current.json").exists()

    reports = list((tmp_path / "store" / "publish_reports").glob("*.json"))
    assert reports, "blocked runs must still leave an audit report"
    report = json.loads(reports[0].read_text(encoding="utf-8"))
    assert report["result"] == "FAIL"
    assert report["promoted"] is False


def test_publish_cli_blocks_gate_failure_with_diagnostics(tmp_path, approved_record):
    tampered = copy.deepcopy(approved_record)
    # zero available-to-sell must fail the packet publish gate; the approval
    # stays source-version bound (record version intentionally omitted) so the
    # failure is exercised by the gate, not the approval check
    tampered["inventory"]["reservedUnits"] = tampered["inventory"]["onHandUnits"]
    tampered["inventory"]["availableToSell"] = 0
    approvals = [{
        "dealId": tampered["dealId"],
        "approvedSourceVersion": tampered["source"]["sourceVersion"],
        "approverId": "test-owner",
        "approvedAt": tampered["publishApproval"]["approvedAt"],
    }]
    assert run_cli(tmp_path, [tampered], approvals) == 2

    report = json.loads(next((tmp_path / "store" / "publish_reports").glob("*.json")).read_text(encoding="utf-8"))
    diagnostics = report.get("gateDiagnostics", [])
    assert diagnostics and diagnostics[0]["dealId"] == "PSE-EXAMPLE-001"
    assert diagnostics[0]["issues"], "gate diagnostics must explain the block"


def test_publish_cli_empty_result_requires_dual_control(tmp_path, approved_record):
    unapproved = copy.deepcopy(approved_record)
    unapproved["publishApproved"] = False
    assert run_cli(tmp_path, [unapproved], []) == 2
    assert not (tmp_path / "store" / "current.json").exists()


def test_publish_cli_reports_ignored_records(tmp_path, valid_records, capsys):
    extra = copy.deepcopy(valid_records[0])
    extra["publishApproved"] = False
    extra["dealId"] = "PSE-EXAMPLE-UNAPPROVED"
    approvals = approvals_for(valid_records)
    assert run_cli(tmp_path, valid_records + [extra], approvals) == 0
    output = capsys.readouterr().out
    assert "PSE-EXAMPLE-UNAPPROVED" in output
    report = json.loads(next((tmp_path / "store" / "publish_reports").glob("*.json")).read_text(encoding="utf-8"))
    assert report["ignoredDealIds"] == ["PSE-EXAMPLE-UNAPPROVED"]
    assert report["approvedCount"] == 1


def test_publish_cli_rejects_bad_input(tmp_path, valid_records, capsys):
    approvals = approvals_for(valid_records)
    store = tmp_path / "store"
    base = [
        "--operator", "test-owner", "--run-id", "r", "--release-id", "r",
        "--data-dir", str(store), "--now", NOW_ARG,
    ]
    # records file missing
    assert publish_snapshot.main([*base, "--records", str(tmp_path / "missing.json"),
                                  "--approvals", str(write_json(tmp_path / "a.json", approvals))]) == 1
    # records file is not an array
    assert publish_snapshot.main([*base, "--records", str(write_json(tmp_path / "r.json", {"x": 1})),
                                  "--approvals", str(write_json(tmp_path / "a.json", approvals))]) == 1
    # unusable --now
    assert publish_snapshot.main([*base, "--records", str(write_json(tmp_path / "r.json", valid_records)),
                                  "--approvals", str(write_json(tmp_path / "a.json", approvals)),
                                  "--now", "not-a-timestamp"]) == 1
    errors = capsys.readouterr().err
    assert errors.count("ERROR") == 3
    assert not store.exists()


def test_publish_cli_script_runs_standalone():
    completed = subprocess.run(
        [sys.executable, str(SERVICE / "publish_snapshot.py"), "--help"],
        capture_output=True, text=True, check=False,
    )
    assert completed.returncode == 0
    assert "--records" in completed.stdout
    assert "--approvals" in completed.stdout
