"""Atomic shared replay and rate-limit state adapters (Valkey-compatible).

Contract: `vendor/pse-inventory-packet/11_RUNNABLE_REFERENCE_STACK/
SHARED_STATE_AND_CONTROL_PLANE_ADAPTERS.md`.

The adapters accept an injected client so they can be verified with a fake in
this environment and wired to a pinned Valkey 9.x server in staging. Every
backend failure fails CLOSED: a revalidation request is rejected and no cache
or snapshot promotion occurs; the protected endpoint returns 503.

Multi-replica production remains blocked until these adapters pass the full
staging gate with two API replicas. The single-process reference uses the
in-process nonce store and limiter instead.
"""
from __future__ import annotations

import hashlib

from datetime import datetime, timezone
from typing import Any, Protocol

NONCE_TTL_SECONDS = 600
NAMESPACE = "pse-inventory:v4"

RATE_LIMIT_LUA = """
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count
"""


class SharedStateUnavailable(RuntimeError):
    """Fail-closed signal: backend error; reject the protected request."""


class ReplayDetected(ValueError):
    """The (key_id, nonce) pair was already consumed within its TTL."""


class ValkeyLike(Protocol):
    """Minimal duck-typed Valkey/Redis-compatible client surface used here."""

    def set(self, name: str, value: str, *, nx: bool = ..., ex: int | None = ...) -> Any: ...
    def eval(self, script: str, numkeys: int, *args: Any) -> Any: ...
    def exists(self, *names: str) -> int: ...


def _nonce_key(key_id: str, nonce: str) -> str:
    digest = hashlib.sha256(f"{key_id}\x00{nonce}".encode("utf-8")).hexdigest()
    return f"{NAMESPACE}:nonce:{digest}"


def _rate_key(namespace: str, subject: str, window: int) -> str:
    digest = hashlib.sha256(subject.encode("utf-8")).hexdigest()
    return f"{namespace}:rate:{digest}:{window}"


def _require_aware(now: datetime) -> datetime:
    if now.tzinfo is None:
        raise ValueError("now must be timezone-aware")
    return now.astimezone(timezone.utc)


class ValkeyNonceStore:
    """Atomic replay protection: `SET key value NX EX ttl` — first consume wins."""

    def __init__(self, client: Any, *, ttl_seconds: int = NONCE_TTL_SECONDS, namespace: str = NAMESPACE):
        if ttl_seconds < 600:
            raise ValueError("nonce TTL must cover at least the 600s validity window")
        self._client = client
        self._ttl_seconds = ttl_seconds
        self._namespace = namespace

    @classmethod
    def from_url(cls, url: str, *, ttl_seconds: int = NONCE_TTL_SECONDS) -> "ValkeyNonceStore":
        try:
            import valkey  # type: ignore
        except ImportError as exc:  # pragma: no cover - environment dependent
            raise SharedStateUnavailable("valkey client library is not installed") from exc
        return cls(valkey.Valkey.from_url(url, socket_timeout=2.0), ttl_seconds=ttl_seconds)

    def contains(self, key_id: str, nonce: str, now: datetime) -> bool:
        _require_aware(now)
        try:
            return bool(self._client.exists(_nonce_key(key_id, nonce)))
        except Exception as exc:
            raise SharedStateUnavailable("nonce store backend is unavailable") from exc

    def consume(self, key_id: str, nonce: str, now: datetime) -> None:
        _require_aware(now)
        key = _nonce_key(key_id, nonce)
        try:
            acquired = self._client.set(key, "1", nx=True, ex=self._ttl_seconds)
        except Exception as exc:
            raise SharedStateUnavailable("nonce store backend is unavailable") from exc
        if not acquired:
            raise ReplayDetected("nonce replay detected")


class ValkeyRateLimiter:
    """Atomic fixed-window limiter: INCR + first-use EXPIRE via reviewed Lua."""

    def __init__(self, client: Any, *, limit: int, window_seconds: int = 60, namespace: str = NAMESPACE):
        if limit < 1 or window_seconds < 1:
            raise ValueError("limit and window_seconds must be positive")
        self._client = client
        self.limit = limit
        self.window_seconds = window_seconds
        self._namespace = namespace

    @classmethod
    def from_url(cls, url: str, *, limit: int, window_seconds: int = 60) -> "ValkeyRateLimiter":
        try:
            import valkey  # type: ignore
        except ImportError as exc:  # pragma: no cover - environment dependent
            raise SharedStateUnavailable("valkey client library is not installed") from exc
        return cls(valkey.Valkey.from_url(url, socket_timeout=2.0), limit=limit, window_seconds=window_seconds)

    def allow(self, subject: str, now: datetime) -> bool:
        moment = _require_aware(now)
        window = int(moment.timestamp() // self.window_seconds)
        key = _rate_key(self._namespace, subject, window)
        try:
            count = int(self._client.eval(RATE_LIMIT_LUA, 1, key, self.window_seconds))
        except Exception as exc:
            raise SharedStateUnavailable("rate-limit backend is unavailable") from exc
        return count <= self.limit
