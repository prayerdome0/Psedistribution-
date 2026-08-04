from __future__ import annotations

import pytest

from app.cursor import CursorError, CursorSigner


def test_cursor_round_trip_is_query_and_snapshot_bound() -> None:
    signer = CursorSigner(secret=b"x" * 32)
    token = signer.encode(offset=24, snapshot_version="sha256:" + "a" * 64, query_fingerprint="q1")
    decoded = signer.decode(token, snapshot_version="sha256:" + "a" * 64, query_fingerprint="q1")
    assert decoded.offset == 24


def test_cursor_tampering_is_rejected() -> None:
    signer = CursorSigner(secret=b"x" * 32)
    token = signer.encode(offset=24, snapshot_version="sha256:" + "a" * 64, query_fingerprint="q1")
    tampered = token[:-1] + ("A" if token[-1] != "A" else "B")
    with pytest.raises(CursorError):
        signer.decode(tampered, snapshot_version="sha256:" + "a" * 64, query_fingerprint="q1")


def test_cursor_cannot_be_reused_for_different_filter() -> None:
    signer = CursorSigner(secret=b"x" * 32)
    token = signer.encode(offset=24, snapshot_version="sha256:" + "a" * 64, query_fingerprint="q1")
    with pytest.raises(CursorError):
        signer.decode(token, snapshot_version="sha256:" + "a" * 64, query_fingerprint="q2")
