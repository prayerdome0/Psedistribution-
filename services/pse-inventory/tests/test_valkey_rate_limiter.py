"""Valkey fixed-window limiter: atomic shared count, TTL on first use only."""
from __future__ import annotations

import threading
from datetime import datetime, timedelta, timezone

import pytest

from pse_inventory.shared_state import SharedStateUnavailable, ValkeyRateLimiter

NOW = datetime(2026, 8, 3, 20, 10, tzinfo=timezone.utc)

LUA_EXPECTED = """
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count
"""


class FakeValkey:
    def __init__(self):
        self.counters: dict[str, int] = {}
        self.expires: dict[str, int] = {}
        self.lock = threading.Lock()
        self.fail = False
        self.eval_calls: list[str] = []

    def eval(self, script, numkeys, *args):
        if self.fail:
            raise ConnectionError("backend down")
        self.eval_calls.append(script.strip())
        key, window_seconds = args[0], int(args[1])
        assert numkeys == 1
        with self.lock:
            count = self.counters.get(key, 0) + 1
            self.counters[key] = count
            if count == 1:
                assert key not in self.expires, "EXPIRE must only be set on first increment"
                self.expires[key] = window_seconds
            return count

    def set(self, *args, **kwargs):  # pragma: no cover - nonce only
        raise NotImplementedError

    def exists(self, *names):  # pragma: no cover - nonce only
        raise NotImplementedError


def test_two_replicas_share_one_limit():
    backend = FakeValkey()
    first = ValkeyRateLimiter(backend, limit=3)
    second = ValkeyRateLimiter(backend, limit=3)
    assert first.allow("client-a", NOW)
    assert second.allow("client-a", NOW)
    assert first.allow("client-a", NOW)
    assert not second.allow("client-a", NOW)
    assert not first.allow("client-a", NOW)


def test_parallel_increments_enforce_single_shared_limit():
    backend = FakeValkey()
    limiter = ValkeyRateLimiter(backend, limit=5)
    results: list[bool] = []
    lock = threading.Lock()

    def hit():
        allowed = limiter.allow("client-b", NOW)
        with lock:
            results.append(allowed)

    threads = [threading.Thread(target=hit) for _ in range(12)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    assert sum(results) == 5


def test_new_window_resets_counter():
    backend = FakeValkey()
    limiter = ValkeyRateLimiter(backend, limit=1, window_seconds=60)
    assert limiter.allow("client-c", NOW)
    assert not limiter.allow("client-c", NOW)
    assert limiter.allow("client-c", NOW + timedelta(seconds=61))


def test_ttl_is_not_extended_by_later_increments():
    backend = FakeValkey()
    limiter = ValkeyRateLimiter(backend, limit=10, window_seconds=60)
    for _ in range(4):
        limiter.allow("client-d", NOW)
    key = next(iter(backend.expires))
    assert backend.expires[key] == 60
    assert len(backend.expires) == 1


def test_reviewed_lua_script_is_used():
    backend = FakeValkey()
    limiter = ValkeyRateLimiter(backend, limit=2)
    limiter.allow("client-e", NOW)
    assert backend.eval_calls[0].strip() == LUA_EXPECTED.strip()


def test_backend_failure_fails_closed():
    backend = FakeValkey()
    limiter = ValkeyRateLimiter(backend, limit=2)
    backend.fail = True
    with pytest.raises(SharedStateUnavailable):
        limiter.allow("client-f", NOW)
