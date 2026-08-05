"""Public snapshot repository backed by PostgreSQL.

The API uses this repository in production mode. The storefront database role
can read only ``public_inventory.active_snapshot``; it never receives access to
``private_inventory`` or audit payloads. A validated in-memory last-known-good
snapshot is retained only for the configured maximum age during a transient DB
failure, then requests fail closed.
"""
from __future__ import annotations

import json
import threading
import time
from pathlib import Path
from typing import Any, Callable

from ._packet import load_publisher_module
from .snapshot_repository import SnapshotUnavailable


class PostgresSnapshotRepository:
    def __init__(
        self,
        *,
        connection_factory: Callable[[], Any],
        max_last_good_age_seconds: int,
        packet_root: Path | None = None,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        if max_last_good_age_seconds < 1:
            raise ValueError('max_last_good_age_seconds must be positive')
        self._connection_factory = connection_factory
        self.max_last_good_age_seconds = max_last_good_age_seconds
        self.clock = clock
        self._publisher = load_publisher_module(packet_root)
        self._lock = threading.RLock()
        self._current: dict[str, Any] | None = None
        self._loaded_at: float | None = None
        self._degraded = False
        self._last_error: str | None = None

    @staticmethod
    def _close(connection: Any, cursor: Any) -> None:
        for resource in (cursor, connection):
            close = getattr(resource, 'close', None)
            if callable(close):
                try:
                    close()
                except Exception:
                    pass

    def _validate(self, value: Any) -> dict[str, Any]:
        if isinstance(value, str):
            value = json.loads(value)
        if not isinstance(value, dict):
            raise SnapshotUnavailable('active snapshot must contain an object')
        issues = self._publisher.verify_snapshot_integrity(value)
        if issues:
            raise SnapshotUnavailable('active snapshot failed validation')
        ids = [item.get('dealId') for item in value.get('items', [])]
        slugs = [item.get('slug') for item in value.get('items', [])]
        if len(ids) != len(set(ids)) or len(slugs) != len(set(slugs)):
            raise SnapshotUnavailable('active snapshot contains duplicate public identity')
        return value

    def load(self) -> dict[str, Any]:
        connection = None
        cursor = None
        try:
            connection = self._connection_factory()
            cursor = connection.cursor()
            cursor.execute('SELECT snapshot FROM public_inventory.active_snapshot LIMIT 1')
            row = cursor.fetchone()
            if not row:
                raise SnapshotUnavailable('no active public snapshot')
            candidate = self._validate(row[0])
        except SnapshotUnavailable as exc:
            with self._lock:
                self._degraded = self._current is not None
                self._last_error = type(exc).__name__
            raise
        except Exception as exc:
            with self._lock:
                self._degraded = self._current is not None
                self._last_error = type(exc).__name__
            raise SnapshotUnavailable('public snapshot database is unavailable') from exc
        finally:
            self._close(connection, cursor)

        with self._lock:
            self._current = candidate
            self._loaded_at = self.clock()
            self._degraded = False
            self._last_error = None
            return candidate

    def current(self) -> dict[str, Any]:
        with self._lock:
            if self._current is None:
                return self.load()
            assert self._loaded_at is not None
            if self.clock() - self._loaded_at > self.max_last_good_age_seconds:
                raise SnapshotUnavailable('last-known-good snapshot exceeded maximum fallback age')
            return self._current

    def refresh_or_last_good(self) -> dict[str, Any]:
        try:
            return self.load()
        except SnapshotUnavailable:
            return self.current()

    @property
    def freshness(self) -> str:
        with self._lock:
            if self._current is None:
                return 'stale-blocked'
            return 'degraded' if self._degraded else 'fresh'

    @property
    def last_error(self) -> str | None:
        return self._last_error
