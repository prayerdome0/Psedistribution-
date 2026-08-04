"""Phase 0 evidence gate: the implementation map must exist, be complete, and
select exactly one website mode. Fails closed when evidence is absent."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_phase0_map_is_complete_and_selects_one_website_mode() -> None:
    value = json.loads((ROOT / "docs/pse-inventory/implementation-map.json").read_text(encoding="utf-8"))
    assert value["websiteMode"] in {"ADAPT_EXISTING", "MOUNT_STATIC_REFERENCE"}
    required = {
        "sourceAuthority", "sourceVersionStrategy", "websiteRepository",
        "websiteCommit", "buildCommand", "testCommand", "deploymentProject",
        "stagingUrl", "productionUrl", "secretStore", "backupArtifact",
        "restoreCommand", "rollbackCommand", "ownerApprover",
    }
    assert required <= set(value)
    assert all(str(value[key]).strip() for key in required)


def test_phase0_map_records_adapt_existing_routes() -> None:
    value = json.loads((ROOT / "docs/pse-inventory/implementation-map.json").read_text(encoding="utf-8"))
    if value["websiteMode"] == "ADAPT_EXISTING":
        for key in ("catalogRoute", "productDetailRoute", "rfqRoute", "inventoryApiBase"):
            assert str(value.get(key, "")).strip(), f"ADAPT_EXISTING requires {key}"


def test_production_status_is_evidence_bound() -> None:
    value = json.loads((ROOT / "docs/pse-inventory/implementation-map.json").read_text(encoding="utf-8"))
    assert value.get("productionStatus") in {"NOT_DEPLOYED", "VERIFIED_DEPLOYED"}
    assert value.get("productionStatus") == "NOT_DEPLOYED", (
        "production cannot be claimed complete until live acceptance evidence exists"
    )


def test_phase0_validator_passes() -> None:
    completed = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "validate-pse-phase0.py")],
        capture_output=True, text=True, check=False,
    )
    assert completed.returncode == 0, completed.stdout + completed.stderr
    assert json.loads(completed.stdout)["result"] == "PASS"
