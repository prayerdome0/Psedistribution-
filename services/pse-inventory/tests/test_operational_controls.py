"""Operational controls: required alert coverage and recovery tooling checks."""
from __future__ import annotations

import os
from pathlib import Path

import yaml

SERVICE = Path(__file__).resolve().parents[1]
ROOT = SERVICE.parents[1]


def _alert_rules() -> dict:
    return yaml.safe_load((SERVICE / "deploy" / "prometheus" / "alert_rules.yml").read_text(encoding="utf-8"))


def test_required_alerts_are_defined() -> None:
    rules = _alert_rules()
    names = {rule["alert"] for group in rules["groups"] for rule in group["rules"] if "alert" in rule}
    assert {
        "PSEInventoryApiUnavailable", "PSEInventorySnapshotStale",
        "PSEInventoryParityMismatch", "PSEInventoryPrivacyViolation",
        "PSEInventoryReplaySpike", "PSEInventorySharedStateUnavailable",
        "PSEInventoryPublishRollback",
    } <= names


def test_recovery_scripts_exist_and_are_strict():
    scripts = ROOT / "scripts"
    for name in ("pse-inventory-backup.sh", "pse-inventory-restore.sh", "pse-inventory-rollback.sh"):
        path = scripts / name
        assert path.is_file(), f"missing recovery script {name}"
        text = path.read_text(encoding="utf-8")
        assert "set -euo pipefail" in text, f"{name} must run under strict shell mode"
        assert os.access(path, os.X_OK), f"{name} must be executable"
    backup = (scripts / "pse-inventory-backup.sh").read_text(encoding="utf-8")
    assert "refusing to back up an empty snapshot" in backup
    restore = (scripts / "pse-inventory-restore.sh").read_text(encoding="utf-8")
    assert "verify_snapshot_integrity" in restore and "post-restore readback mismatch" in restore


def test_prometheus_rules_are_wired():
    config = yaml.safe_load((SERVICE / "deploy" / "prometheus" / "prometheus.yml").read_text(encoding="utf-8"))
    assert "/etc/prometheus/alert_rules.yml" in config["rule_files"]
    assert any("pse-inventory" in job.get("job_name", "") for job in config["scrape_configs"])


def test_migration_sql_declares_role_separation():
    grants = (SERVICE / "migrations" / "002_role_grants.sql").read_text(encoding="utf-8")
    assert "pse_storefront" in grants
    assert "pse_publisher" in grants
    assert "REVOKE ALL ON SCHEMA private_inventory FROM pse_storefront" in grants
