from __future__ import annotations

import subprocess
import sys
from pathlib import Path


PACKET = Path(__file__).resolve().parents[2]


def test_packet_has_open_source_project_governance_files() -> None:
    for name in ("LICENSE", "NOTICE", "SECURITY.md", "CONTRIBUTING.md", "CHANGELOG.md"):
        assert (PACKET / name).is_file(), name
    assert "Apache License" in (PACKET / "LICENSE").read_text(encoding="utf-8")


def test_packet_version_file_is_machine_readable_and_consistent() -> None:
    values = {}
    for line in (PACKET / "VERSION.txt").read_text(encoding="utf-8").splitlines():
        if line.strip():
            key, value = line.split("=", 1)
            values[key] = value
    assert values == {
        "packetVersion": "4.0.0",
        "contractVersion": "4.0.0",
        "releaseProfile": "OPEN_SOURCE_SUPER_GAUNTLET",
    }
    assert (PACKET / "CONTRACT_VERSION.txt").read_text(encoding="utf-8").strip() == "4.0.0"


def test_cross_reference_linter_reports_no_broken_packet_paths() -> None:
    completed = subprocess.run(
        [sys.executable, str(PACKET / "07_GAUNTLET/cross_reference_lint.py"), str(PACKET)],
        capture_output=True,
        text=True,
        check=False,
    )
    assert completed.returncode == 0, completed.stdout + completed.stderr


def test_operator_and_master_documents_use_current_paths_and_version() -> None:
    documents = [
        PACKET / "00_START_HERE.md",
        PACKET / "02_IMPLEMENTATION/01_MASTER_GAMEPLAN.md",
        PACKET / "06_OPERATIONS/01_DEPLOYMENT_READINESS_CHECKLIST.md",
    ]
    text = "\n".join(path.read_text(encoding="utf-8") for path in documents)
    assert "v3.2" not in text
    assert "22_VALIDATE_CONTRACTS.py" not in text
    assert "19_PACKET_QA_REPORT.md" not in text
    assert "12_PUBLIC_PRIVATE_FIELD_MAP.csv" not in text
    assert "04_PUBLIC_INVENTORY_SCHEMA.json" not in text
    assert "21_TEST_FIXTURES/" not in text
