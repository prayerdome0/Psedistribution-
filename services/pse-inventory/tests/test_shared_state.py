"""Shared-state adapter tests with an in-memory Valkey-compatible fake.

Proves the atomic SET-NX-EX nonce semantics and Lua fixed-window limiter
contract without a live server; the live two-replica gate stays blocked until
staging runs against pinned Valkey images (see SHARED_STATE_AND_CONTROL_PLANE_ADAPTERS.md).
"""
from __future__ import annotations

import hashlib
import threading
from datetime import datetime, timezone

import pytest

from pse_inventory.shared_state import (
    NAMESPACE,
    ReplayDetected,
    SharedStateUnavailable,
    ValkeyNonceStore,
    ValkeyRateLimiter,
)

NOW = datetime(2026, 8, 3, 20, 10, tzinfo=timezone.utc)


class FakeValkey:
    """Minimal thread-safe fake implementing set/eval/exists like a Valkey client."""

    def __init__(self):
        self.kv: dict[str, str] = {}
        self.ttl: dict[str, int] = {}
        self.lock = threading.Lock()
        self.fail_mode: Exception | None = None

    def set(self, name, value, nx=False, ex=None):
        if self.fail_mode:
            raise self.fail_mode
        with self.lock:
            if nx and name in self.kv:
                return None
            self.kv[name] = value
            if ex is not None:
                self.ttl[name] = ex
            return True

    def exists(self, *names):
        if self.fail_mode:
            raise self.fail_mode
        with self.lock:
            return sum(1 for name in names if name in self.kv)

    def eval(self, script, numkeys, *args):
        if self.fail_mode:
            raise self.fail_mode
        key = args[0]
        window = int(args[1])
        with self.lock:
            count = int(self.kv.get(key, "0")) + 1
            self.kv[key] = str(count)
            if count == 1:
                self.ttl[key] = window
            return count


def test_first_consume_wins_and_replay_is_rejected():
    store = ValkeyNonceStore(FakeValkey())
    store.consume("key-a", "nonce-000000000001", NOW)
    with pytest.raises(ReplayDetected):
        store.consume("key-a", "nonce-000000000001", NOW)


def test_two_replicas_accept_exactly_one_concurrent_nonce():
    backend = FakeValkey()
    first = ValkeyNonceStore(backend)
    second = ValkeyNonceStore(backend)
    outcomes: list[object] = []
    barrier = threading.Barrier(2)

    def attempt(store):
        barrier.wait()
        try:
            store.consume("key-a", "nonce-000000000001", NOW)
            outcomes.append(None)
        except ReplayDetected as exc:
            outcomes.append(exc)

    threads = [threading.Thread(target=attempt, args=(first,)), threading.Thread(target=attempt, args=(second,))]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    assert sorted(type(item).__name__ for item in outcomes) == ["NoneType", "ReplayDetected"]


def test_nonce_key_hashes_identity_and_never_logs_raw_values():
    backend = FakeValkey()
    store = ValkeyNonceStore(backend)
    store.consume("key-a", "nonce-000000000001", NOW)
    stored_key = next(iter(backend.kv))
    expected = f"{NAMESPACE}:nonce:" + hashlib.sha256("key-a\x00nonce-000000000001".encode()).hexdigest()
    assert stored_key == expected
    assert "nonce-000000000001" not in stored_key and "key-a" not in stored_key


def test_nonce_ttl_covers_validity_window():
    backend = FakeValkey()
    store = ValkeyNonceStore(backend, ttl_seconds=600)
    store.consume("key-a", "nonce-000000000001", NOW)
    assert next(iter(backend.ttl.values())) >= 600


def test_backend_failure_fails_closed_for_nonce():
    backend = FakeValkey()
    backend.fail_mode = ConnectionError("backend down")
    store = ValkeyNonceStore(backend)
    with pytest.raises(SharedStateUnavailable):
        store.consume("key-a", "nonce-000000000001", NOW)


def test_rate_limiter_enforces_fixed_window():
    limiter = ValkeyRateLimiter(FakeValkey(), limit=3, window_seconds=60)
    assert limiter.allow("client-1", NOW)
    assert limiter.allow("client-1", NOW)
    assert limiter.allow("client-1", NOW)
    assert not limiter.allow("client-1", NOW)
    assert limiter.allow("client-2", NOW), "subjects are isolated"


def test_rate_limiter_window_key_includes_window_number():
    backend = FakeValkey()
    limiter = ValkeyRateLimiter(backend, limit=3, window_seconds=60)
    limiter.allow("client-1", NOW)
    key = next(iter(backend.kv))
    window = int(NOW.timestamp() // 60)
    assert key.endswith(f":{window}")


def test_rate_limiter_expiry_set_on_first_increment_only():
    backend = FakeValkey()
    limiter = ValkeyRateLimiter(backend, limit=5, window_seconds=60)
    for _ in range(4):
        limiter.allow("client-1", NOW)
    key = next(iter(backend.kv))
    assert backend.ttl[key] == 60


def test_backend_failure_fails_closed_for_rate_limit():
    backend = FakeValkey()
    backend.fail_mode = TimeoutError("timeout")
    limiter = ValkeyRateLimiter(backend, limit=3, window_seconds=60)
    with pytest.raises(SharedStateUnavailable):
        limiter.allow("client-1", NOW)


def test_naive_datetime_rejected():
    store = ValkeyNonceStore(FakeValkey())
    with pytest.raises(ValueError):
        store.consume("key-a", "nonce-000000000001", datetime(2026, 8, 3, 20, 10))
