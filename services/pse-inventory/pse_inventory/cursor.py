"""Opaque HMAC-signed pagination cursors bound to query and snapshot."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
from dataclasses import dataclass


class CursorError(ValueError):
    pass


@dataclass(frozen=True)
class CursorPayload:
    offset: int


class CursorSigner:
    def __init__(self, *, secret: bytes):
        if not isinstance(secret, bytes) or len(secret) < 32:
            raise ValueError("cursor secret must be at least 32 bytes")
        self._secret = secret

    @staticmethod
    def _b64encode(value: bytes) -> str:
        return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")

    @staticmethod
    def _b64decode(value: str) -> bytes:
        if not isinstance(value, str) or len(value) > 2048:
            raise CursorError("cursor is invalid")
        try:
            return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
        except Exception as exc:
            raise CursorError("cursor is invalid") from exc

    def encode(self, *, offset: int, snapshot_version: str, query_fingerprint: str) -> str:
        if not isinstance(offset, int) or offset < 0:
            raise ValueError("offset must be a non-negative integer")
        payload = json.dumps(
            {"o": offset, "s": snapshot_version, "q": query_fingerprint, "v": 1},
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
        encoded = self._b64encode(payload)
        signature = hmac.new(self._secret, encoded.encode("ascii"), hashlib.sha256).hexdigest()
        return f"{encoded}.{signature}"

    def decode(self, token: str, *, snapshot_version: str, query_fingerprint: str) -> CursorPayload:
        try:
            encoded, supplied = token.split(".", 1)
        except (AttributeError, ValueError) as exc:
            raise CursorError("cursor is invalid") from exc
        expected = hmac.new(self._secret, encoded.encode("ascii"), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, supplied):
            raise CursorError("cursor signature is invalid")
        try:
            payload = json.loads(self._b64decode(encoded))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise CursorError("cursor payload is invalid") from exc
        if not isinstance(payload, dict) or set(payload) != {"o", "q", "s", "v"}:
            raise CursorError("cursor payload is invalid")
        if payload.get("v") != 1 or payload.get("s") != snapshot_version or payload.get("q") != query_fingerprint:
            raise CursorError("cursor does not match the current query or snapshot")
        offset = payload.get("o")
        if not isinstance(offset, int) or offset < 0:
            raise CursorError("cursor offset is invalid")
        return CursorPayload(offset=offset)
