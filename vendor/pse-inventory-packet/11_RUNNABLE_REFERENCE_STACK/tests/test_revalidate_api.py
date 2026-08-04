from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import AppSettings, create_app
from app.runtime_core import load_revalidation_module


def test_signed_revalidation_accepts_exact_body_and_rejects_replay(snapshot_file: Path) -> None:
    packet_root = Path(__file__).resolve().parents[2]
    settings = AppSettings(
        snapshot_file=snapshot_file,
        packet_root=packet_root,
        cursor_secret="c" * 32,
        hmac_keys={"test-key": "h" * 32},
        allowed_origins=("https://pilotsalesdistribution.com",),
        max_last_good_age_seconds=300,
        rate_limit_per_minute=100,
    )
    client = TestClient(create_app(settings))
    snapshot = json.loads(snapshot_file.read_text())
    body = json.dumps({
        "runId": "run-test",
        "releaseId": "release-test",
        "sourceVersion": snapshot["sourceVersion"],
        "snapshotVersion": snapshot["snapshotVersion"],
        "publishedAt": snapshot["generatedAt"],
    }, separators=(",", ":")).encode()
    module = load_revalidation_module(packet_root)
    headers = module.sign_request(
        key_id="test-key",
        secret=b"h" * 32,
        body=body,
        timestamp=datetime(2026, 8, 3, 20, 0, tzinfo=timezone.utc),
        nonce="nonce-1234567890abcdef",
    )
    with client:
        app = client.app
        app.state.clock = lambda: datetime(2026, 8, 3, 20, 0, tzinfo=timezone.utc)
        first = client.post("/api/internal/inventory/revalidate", content=body, headers=headers)
        assert first.status_code == 202
        second = client.post("/api/internal/inventory/revalidate", content=body, headers=headers)
        assert second.status_code == 409
        assert second.json()["error"]["code"] == "NONCE_REPLAY"
