#!/usr/bin/env python3
"""Replay-resistant HMAC signing and verification for inventory cache revalidation.

This is the single canonical reference implementation in the packet. Production
must use a shared atomic nonce store (for example Valkey) rather than the in-memory
store below, and must keep signing secrets in a real secret manager.
"""
from __future__ import annotations

import hashlib
import hmac
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Mapping

MAX_CLOCK_SKEW_SECONDS = 300
NONCE_TTL_SECONDS = 600
KEY_ID_RE = re.compile(r"^[A-Za-z0-9._-]{1,80}$")
NONCE_RE = re.compile(r"^[A-Za-z0-9._~:-]{16,160}$")
HEX64_RE = re.compile(r"^[a-f0-9]{64}$")
REQUIRED_HEADERS = {
    "X-PSE-Key-Id",
    "X-PSE-Timestamp",
    "X-PSE-Nonce",
    "X-PSE-Content-SHA256",
    "X-PSE-Signature",
}


class RevalidationError(ValueError):
    """Sanitized verification failure suitable for mapping to a generic API error."""


# Backwards-compatible error name for downstream reference users.
VerificationError = RevalidationError


def _iso_z(value: datetime) -> str:
    if value.tzinfo is None:
        raise ValueError("timestamp must be timezone-aware")
    return value.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _parse_timestamp(value: str) -> datetime:
    if not isinstance(value, str):
        raise RevalidationError("timestamp is invalid")
    try:
        parsed = datetime.fromisoformat(value[:-1] + "+00:00" if value.endswith("Z") else value)
    except ValueError as exc:
        raise RevalidationError("timestamp is invalid") from exc
    if parsed.tzinfo is None:
        raise RevalidationError("timestamp must include timezone")
    return parsed.astimezone(timezone.utc)


def content_sha256(body: bytes) -> str:
    if not isinstance(body, bytes):
        raise TypeError("body must be exact raw bytes")
    return hashlib.sha256(body).hexdigest()


def _validate_header_token(value: str, *, name: str, pattern: re.Pattern[str]) -> None:
    if not isinstance(value, str) or not pattern.fullmatch(value):
        raise RevalidationError(f"{name} is invalid")
    if "\r" in value or "\n" in value:
        raise RevalidationError(f"{name} is invalid")


def canonical_string(*, key_id: str, timestamp: str, nonce: str, body_hash: str, body: bytes) -> bytes:
    _validate_header_token(key_id, name="key id", pattern=KEY_ID_RE)
    _validate_header_token(nonce, name="nonce", pattern=NONCE_RE)
    if not isinstance(timestamp, str) or not timestamp or "\r" in timestamp or "\n" in timestamp:
        raise RevalidationError("timestamp is invalid")
    if not isinstance(body_hash, str) or not HEX64_RE.fullmatch(body_hash):
        raise RevalidationError("content hash is invalid")
    if not isinstance(body, bytes):
        raise TypeError("body must be exact raw bytes")
    return b"\n".join(
        [
            b"pse-inventory-revalidate-v1",
            key_id.encode("utf-8"),
            timestamp.encode("ascii"),
            nonce.encode("ascii"),
            body_hash.encode("ascii"),
        ]
    ) + b"\n" + body


def sign_request(
    *,
    secret: bytes,
    key_id: str,
    timestamp: datetime,
    nonce: str,
    body: bytes,
) -> dict[str, str]:
    if not isinstance(secret, bytes) or len(secret) < 16:
        raise ValueError("secret must be at least 16 bytes")
    _validate_header_token(key_id, name="key id", pattern=KEY_ID_RE)
    _validate_header_token(nonce, name="nonce", pattern=NONCE_RE)
    timestamp_text = _iso_z(timestamp)
    digest = content_sha256(body)
    message = canonical_string(
        key_id=key_id,
        timestamp=timestamp_text,
        nonce=nonce,
        body_hash=digest,
        body=body,
    )
    signature = hmac.new(secret, message, hashlib.sha256).hexdigest()
    return {
        "X-PSE-Key-Id": key_id,
        "X-PSE-Timestamp": timestamp_text,
        "X-PSE-Nonce": nonce,
        "X-PSE-Content-SHA256": digest,
        "X-PSE-Signature": signature,
    }


@dataclass
class NonceStore:
    """In-memory reference store; production requires a shared atomic store with TTL."""

    ttl_seconds: int = NONCE_TTL_SECONDS
    _entries: dict[tuple[str, str], datetime] = field(default_factory=dict)

    def _purge(self, now: datetime) -> None:
        now_utc = now.astimezone(timezone.utc)
        expired = [key for key, expires in self._entries.items() if expires <= now_utc]
        for key in expired:
            self._entries.pop(key, None)

    def contains(self, key_id: str, nonce: str, now: datetime) -> bool:
        self._purge(now)
        return (key_id, nonce) in self._entries

    def consume(self, key_id: str, nonce: str, now: datetime) -> None:
        self._purge(now)
        key = (key_id, nonce)
        if key in self._entries:
            raise RevalidationError("nonce replay detected")
        self._entries[key] = now.astimezone(timezone.utc) + timedelta(seconds=self.ttl_seconds)


def verify_request(
    *,
    secrets: Mapping[str, bytes],
    headers: Mapping[str, str],
    body: bytes,
    now: datetime,
    nonce_store: NonceStore,
    max_clock_skew_seconds: int = MAX_CLOCK_SKEW_SECONDS,
) -> dict[str, str]:
    if now.tzinfo is None:
        raise ValueError("now must be timezone-aware")
    if not isinstance(body, bytes):
        raise TypeError("body must be exact raw bytes")
    missing = sorted(REQUIRED_HEADERS - set(headers))
    if missing:
        raise RevalidationError("required signed headers are missing")

    key_id = headers["X-PSE-Key-Id"]
    _validate_header_token(key_id, name="key id", pattern=KEY_ID_RE)
    secret = secrets.get(key_id)
    if secret is None or not isinstance(secret, bytes) or len(secret) < 16:
        raise RevalidationError("unknown signing key")

    nonce = headers["X-PSE-Nonce"]
    _validate_header_token(nonce, name="nonce", pattern=NONCE_RE)

    timestamp_text = headers["X-PSE-Timestamp"]
    timestamp = _parse_timestamp(timestamp_text)
    skew = abs((now.astimezone(timezone.utc) - timestamp).total_seconds())
    if skew > max_clock_skew_seconds:
        raise RevalidationError("timestamp is outside the allowed clock skew")

    supplied_hash = headers["X-PSE-Content-SHA256"]
    if not isinstance(supplied_hash, str) or not HEX64_RE.fullmatch(supplied_hash):
        raise RevalidationError("content hash is invalid")
    expected_hash = content_sha256(body)
    if not hmac.compare_digest(expected_hash, supplied_hash):
        raise RevalidationError("content hash mismatch")

    supplied_signature = headers["X-PSE-Signature"]
    if not isinstance(supplied_signature, str) or not HEX64_RE.fullmatch(supplied_signature):
        raise RevalidationError("signature is invalid")
    message = canonical_string(
        key_id=key_id,
        timestamp=timestamp_text,
        nonce=nonce,
        body_hash=supplied_hash,
        body=body,
    )
    expected_signature = hmac.new(secret, message, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected_signature, supplied_signature):
        raise RevalidationError("signature mismatch")

    nonce_store.consume(key_id, nonce, now)
    return {
        "keyId": key_id,
        "timestamp": _iso_z(timestamp),
        "nonce": nonce,
        "contentSha256": expected_hash,
    }
