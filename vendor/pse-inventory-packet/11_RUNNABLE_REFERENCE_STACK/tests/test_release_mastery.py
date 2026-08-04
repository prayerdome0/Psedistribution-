from __future__ import annotations

import importlib.util
import json
import re
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

import yaml

PACKET = Path(__file__).resolve().parents[2]


def _pptx_text(path: Path) -> str:
    chunks: list[str] = []
    with zipfile.ZipFile(path) as archive:
        for name in sorted(n for n in archive.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", n)):
            xml = archive.read(name).decode("utf-8", errors="replace")
            chunks.extend(re.findall(r"<a:t>(.*?)</a:t>", xml, flags=re.S))
    return "\n".join(chunks)


def test_v4_release_metadata_and_gauntlet_are_consistent() -> None:
    version = (PACKET / "VERSION.txt").read_text(encoding="utf-8")
    assert version == (
        "packetVersion=4.0.0\n"
        "contractVersion=4.0.0\n"
        "releaseProfile=OPEN_SOURCE_SUPER_GAUNTLET\n"
    )
    gauntlet = (PACKET / "07_GAUNTLET/run_super_gauntlet.py").read_text(encoding="utf-8")
    assert 'PACKET_VERSION = "4.0.0"' in gauntlet
    assert 'CONTRACT_VERSION = "4.0.0"' in gauntlet
    assert "EXPECTED_LEGACY_TESTS = 103" in gauntlet
    assert "EXPECTED_RUNTIME_TESTS = 32" in gauntlet
    assert "EXPECTED_NODE_TESTS = 3" in gauntlet
    assert "EXPECTED_TOTAL_TESTS = 138" in gauntlet

    release = PACKET / "09_RELEASE/release_v4.py"
    completed = subprocess.run(
        [sys.executable, str(release), "--plan", str(PACKET)],
        capture_output=True,
        text=True,
        check=False,
    )
    assert completed.returncode == 0, completed.stdout + completed.stderr
    plan = json.loads(completed.stdout)
    assert plan["packetVersion"] == "4.0.0"
    assert plan["stages"] == [
        "clean-generated-artifacts",
        "bootstrap-gauntlet",
        "stabilize-release-evidence",
        "generate-manifest-and-checksums",
        "full-gauntlet",
        "two-deterministic-zip-builds",
        "two-clean-room-validations",
        "two-clean-room-rebuilds",
        "detached-attestation",
    ]

    implementation_plan = PACKET / "02_IMPLEMENTATION/10_TASK_BY_TASK_IMPLEMENTATION_PLAN.md"
    plan_text = implementation_plan.read_text(encoding="utf-8")
    assert ("T" + "BD") not in plan_text and ("T" + "ODO") not in plan_text and "implement later" not in plan_text.lower()
    assert "ADAPT_EXISTING" in plan_text and "MOUNT_STATIC_REFERENCE" in plan_text
    assert "SHARED_STATE_AND_CONTROL_PLANE_ADAPTERS.md" in plan_text
    for number in range(12):
        assert f"### Task {number}:" in plan_text
    assert plan_text.count("- [ ] **Step") >= 60

    spec = importlib.util.spec_from_file_location("pse_release_v4_test", release)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    calls: list[bool] = []
    module.run_gauntlet = lambda root, bootstrap: calls.append(bootstrap) or {"result": "PASS", "checks": 1}
    module.write_json_atomic = lambda path, value: path.write_text(json.dumps(value), encoding="utf-8")
    module.generate_metadata = lambda root: None
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        (root / "09_RELEASE").mkdir()
        assert module.stabilize_release_evidence(root)["result"] == "PASS"
    assert calls == [True, False, False]


def test_all_packet_contract_metadata_uses_v4() -> None:
    for name in (
        "dedupe_rules.json",
        "freshness_policy.json",
        "media_host_policy.json",
        "privacy_field_denylist.json",
        "publish_gate_rules.json",
    ):
        value = json.loads((PACKET / "03_CONTRACTS" / name).read_text(encoding="utf-8"))
        assert value["version"] == "4.0.0", name

    for name in ("public_inventory_api.openapi.yaml", "internal_operations_api.openapi.yaml"):
        value = yaml.safe_load((PACKET / "03_CONTRACTS" / name).read_text(encoding="utf-8"))
        assert value["openapi"] == "3.1.0", name
        assert value["info"]["version"] == "4.0.0", name


def test_reference_compose_uses_verified_stable_tags_and_truthful_profiles() -> None:
    path = PACKET / "11_RUNNABLE_REFERENCE_STACK/deploy/compose.yaml"
    compose_text = path.read_text(encoding="utf-8")
    compose = yaml.safe_load(compose_text)
    assert compose["name"] == "pse-inventory-single-process-reference"
    assert compose["services"]["postgres"]["profiles"] == ["control-plane-preview"]
    assert compose["services"]["valkey"]["profiles"] == ["shared-state-preview"]
    assert "postgres:18.4-alpine" in compose_text
    assert "valkey/valkey:9.1.0-alpine" in compose_text
    assert "caddy:2.11.4-alpine" in compose_text
    assert "prom/prometheus:v3.12.0" in compose_text
    assert "prom/alertmanager:v0.32.1" in compose_text
    assert ":latest" not in compose_text
    contract = (PACKET / "11_RUNNABLE_REFERENCE_STACK/SHARED_STATE_AND_CONTROL_PLANE_ADAPTERS.md").read_text(encoding="utf-8")
    assert "Production multi-replica gate" in contract
    assert "SET NX EX" in contract


def test_source_audit_is_reproducible_from_sanitized_evidence() -> None:
    completed = subprocess.run(
        [sys.executable, str(PACKET / "08_SOURCE_EVIDENCE/audit_sanitized_sources.py"), str(PACKET)],
        capture_output=True,
        text=True,
        check=False,
    )
    assert completed.returncode == 0, completed.stdout + completed.stderr
    result = json.loads(completed.stdout)
    assert result == {
        "candidateRows": 73,
        "canonicalRecords": 2,
        "canonicalUnits": 12700,
        "duplicateRowsBeyondFirst": 40,
        "largestNormalizedCluster": 35,
        "missingUsableQuantity": 15,
        "normalizedTitleClusters": 33,
        "publishApprovedRecords": 0,
        "readyRecords": 1,
        "reviewGatedCandidateRows": 73,
    }


def test_visual_brief_uses_v4_and_current_test_evidence() -> None:
    pptx = PACKET / "01_EXECUTIVE/02_EXECUTIVE_VISUAL_BRIEF_EDITABLE.pptx"
    text = _pptx_text(pptx)
    assert "v3.2" not in text
    assert "OPEN-SOURCE MASTERED GAUNTLET v4.0" in text
    assert "138" in text
    assert "Automated tests across three suites" in text
    assert "33" in text
    assert "40" in text

    completed = subprocess.run(
        ["pdftotext", str(PACKET / "01_EXECUTIVE/01_EXECUTIVE_VISUAL_BRIEF.pdf"), "-"],
        capture_output=True,
        text=True,
        check=False,
    )
    assert completed.returncode == 0, completed.stderr
    assert "v3.2" not in completed.stdout
    assert "v4.0" in completed.stdout
    assert "138" in completed.stdout
