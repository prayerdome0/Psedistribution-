"""Signed revalidation route: HMAC, replay, body binding and version checks."""
from __future__ import annotations

import json
import secrets
from datetime import datetime, timezone

from conftest import HMAC_KEYS
from pse_inventory._packet import load_revalidation_module

revalidation = load_revalidation_module()


def _signed_request(client, snapshot, *, body: bytes | None = None, key_id="test-key",
                    now: datetime | None = None, nonce: str | None = None):
    payload = body if body is not None else json.dumps({
        "runId": "run-test",
        "releaseId": "release-test",
        "sourceVersion": snapshot["sourceVersion"],
        "snapshotVersion": snapshot["snapshotVersion"],
        "publishedAt": snapshot["generatedAt"],
    }).encode("utf-8")
    headers = revalidation.sign_request(
        secret=HMAC_KEYS[key_id].encode("utf-8"),
        key_id=key_id,
        timestamp=now or datetime.now(timezone.utc),
        nonce=nonce or secrets.token_urlsafe(24),
        body=payload,
    )
    return client.post("/api/internal/inventory/revalidate", content=payload, headers=headers)


def test_valid_signed_revalidation_accepted(client, valid_snapshot):
    response = _signed_request(client, valid_snapshot)
    assert response.status_code == 202
    assert response.json()["snapshotVersion"] == valid_snapshot["snapshotVersion"]


def test_replayed_nonce_rejected(client, valid_snapshot):
    nonce = secrets.token_urlsafe(24)
    assert _signed_request(client, valid_snapshot, nonce=nonce).status_code == 202
    replay = _signed_request(client, valid_snapshot, nonce=nonce)
    assert replay.status_code == 409
    assert replay.json()["error"]["code"] == "NONCE_REPLAY"


def test_bad_signature_rejected(client, valid_snapshot):
    response = _signed_request(client, valid_snapshot)
    assert response.status_code == 202
    payload = json.dumps({
        "runId": "run-test", "releaseId": "release-test",
        "sourceVersion": valid_snapshot["sourceVersion"],
        "snapshotVersion": valid_snapshot["snapshotVersion"],
        "publishedAt": valid_snapshot["generatedAt"],
    }).encode()
    headers = revalidation.sign_request(
        secret=HMAC_KEYS["test-key"].encode(), key_id="test-key",
        timestamp=datetime.now(timezone.utc), nonce=secrets.token_urlsafe(24), body=payload,
    )
    tampered = bytearray(payload)
    tampered[0] = tampered[0] ^ 1
    response = client.post("/api/internal/inventory/revalidate", content=bytes(tampered), headers=headers)
    assert response.status_code == 401


def test_unknown_key_rejected(client, valid_snapshot):
    payload = json.dumps({
        "runId": "run-test", "releaseId": "release-test",
        "sourceVersion": valid_snapshot["sourceVersion"],
        "snapshotVersion": valid_snapshot["snapshotVersion"],
        "publishedAt": valid_snapshot["generatedAt"],
    }).encode()
    headers = revalidation.sign_request(
        secret=b"an-unregistered-secret-key-32-bytes-long", key_id="ghost-key",
        timestamp=datetime.now(timezone.utc), nonce=secrets.token_urlsafe(24), body=payload,
    )
    response = client.post("/api/internal/inventory/revalidate", content=payload, headers=headers)
    assert response.status_code == 401


def test_stale_timestamp_rejected(client, valid_snapshot):
    from datetime import timedelta

    old = datetime.now(timezone.utc) - timedelta(hours=2)
    response = _signed_request(client, valid_snapshot, now=old)
    assert response.status_code == 401


def test_snapshot_version_mismatch_rejected(client, valid_snapshot):
    payload = json.dumps({
        "runId": "run-test", "releaseId": "release-test",
        "sourceVersion": valid_snapshot["sourceVersion"],
        "snapshotVersion": "sha256:" + "f" * 64,
        "publishedAt": valid_snapshot["generatedAt"],
    }).encode()
    headers = revalidation.sign_request(
        secret=HMAC_KEYS["test-key"].encode(), key_id="test-key",
        timestamp=datetime.now(timezone.utc), nonce=secrets.token_urlsafe(24), body=payload,
    )
    response = client.post("/api/internal/inventory/revalidate", content=payload, headers=headers)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "SNAPSHOT_MISMATCH"


def test_invalid_body_shape_rejected(client, valid_snapshot):
    response = _signed_request(client, valid_snapshot, body=b'{"unexpected": true}')
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_BODY"
