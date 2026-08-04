"""Valkey nonce adapter: atomic first-consume wins; replay and outage fail closed.

Uses an in-memory fake implementing the Valkey command surface; the two-client
race mirrors the packet's required two-replica test.
"""
from __future__ import annotations

import threading
from datetime import datetime, timezone

import pytest

from pse_inventory.shared_state import ReplayDetected, SharedStateUnavailable, ValkeyNonceStore

NOW = datetime(2026, 8, 3, 20, 10, tzinfo=timezone.utc)


class FakeValkey:
    def __init__(self):
        self.data: dict[str, str] = {}
        self.lock = threading.Lock()
        self.fail = False

    def set(self, name, value, *, nx=False, ex=None):
        if self.fail:
            raise ConnectionError("backend down")
        with self.lock:
            if nx and name in self.data:
                return None
            self.data[name] = value
            return True

    def exists(self, *names):
        if self.fail:
            raise ConnectionError("backend down")
        with self.lock:
            return sum(1 for name in names if name in self.data)

    def eval(self, script, numkeys, *args):  # pragma: no cover - limiter only
        raise NotImplementedError


def test_first_consume_wins_and_second_is_replay():
    backend = FakeValkey()
    store = ValkeyNonceStore(backend)
    store.consume("key-a", "nonce-000000000001", NOW)
    with pytest.raises(ReplayDetected):
        store.consume("key-a", "nonce-000000000001", NOW)


def test_two_clients_accept_exactly_one_concurrent_nonce():
    backend = FakeValkey()
    first = ValkeyNonceStore(backend)
    second = ValkeyNonceStore(backend)
    outcomes: list = []

    def attempt(store):
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


def test_nonce_is_isolated_per_key_id():
    backend = FakeValkey()
    store = ValkeyNonceStore(backend)
    store.consume("key-a", "nonce-000000000001", NOW)
    store.consume("key-b", "nonce-000000000001", NOW)  # same nonce, different key: allowed


def test_backend_failure_fails_closed():
    backend = FakeValkey()
    store = ValkeyNonceStore(backend)
    backend.fail = True
    with pytest.raises(SharedStateUnavailable):
        store.consume("key-a", "nonce-000000000001", NOW)
    with pytest.raises(SharedStateUnavailable):
        store.contains("key-a", "nonce-000000000001", NOW)


def test_ttl_must_cover_validity_window():
    with pytest.raises(ValueError):
        ValkeyNonceStore(FakeValkey(), ttl_seconds=60)


def test_naive_datetime_rejected():
    store = ValkeyNonceStore(FakeValkey())
    with pytest.raises(ValueError):
        store.consume("key-a", "nonce-000000000001", datetime(2026, 8, 3, 20, 10))
