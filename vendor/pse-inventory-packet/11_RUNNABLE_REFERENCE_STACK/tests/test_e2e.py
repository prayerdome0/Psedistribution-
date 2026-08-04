from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import AppSettings, create_app


def test_publisher_to_atomic_snapshot_to_api(tmp_path: Path) -> None:
    packet_root = Path(__file__).resolve().parents[2]
    reference = packet_root / "04_REFERENCE_IMPLEMENTATION"
    output = tmp_path / "current.json"
    report = tmp_path / "report.json"
    command = [
        sys.executable,
        str(reference / "publisher.py"),
        "--input", str(reference / "fixtures/canonical_records.valid.json"),
        "--output", str(output),
        "--report", str(report),
        "--now", "2026-08-03T20:00:00Z",
        "--run-id", "run-e2e",
        "--release-id", "release-e2e",
        "--operator", "test-operator",
        "--allowed-media-host", "cdn.pilotsalesdistribution.com",
    ]
    completed = subprocess.run(command, capture_output=True, text=True, check=False)
    assert completed.returncode == 0, completed.stderr
    published = json.loads(output.read_text())
    assert published["recordCount"] == 1

    settings = AppSettings(
        snapshot_file=output,
        packet_root=packet_root,
        cursor_secret="c" * 32,
        hmac_keys={"test-key": "h" * 32},
        allowed_origins=("https://pilotsalesdistribution.com",),
        max_last_good_age_seconds=300,
        rate_limit_per_minute=100,
    )
    response = TestClient(create_app(settings)).get("/api/inventory")
    assert response.status_code == 200
    assert response.json()["meta"]["totalCount"] == 1
