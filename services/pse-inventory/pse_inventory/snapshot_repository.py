"""Validated snapshot repository with fail-closed last-known-good behavior.

A malformed, empty or stale candidate can never replace a validated snapshot:
the repository keeps serving the last-known-good snapshot only while it is
inside the approved maximum age, then fails closed with 503 behavior upstream.
"""
from __future__ import annotations

import json
import threading
import time
from pathlib import Path
from typing import Any, Callable

from ._packet import load_publisher_module


class SnapshotUnavailable(RuntimeError):
    pass


class SnapshotRepository:
    def __init__(
        self,
        *,
        snapshot_file: Path,
        max_last_good_age_seconds: int,
        packet_root: Path | None = None,
        clock: Callable[[], float] = time.monotonic,
    ):
        if max_last_good_age_seconds < 1:
            raise ValueError("max_last_good_age_seconds must be positive")
        self.snapshot_file = Path(snapshot_file)
        self.max_last_good_age_seconds = max_last_good_age_seconds
        self.clock = clock
        self._publisher = load_publisher_module(packet_root)
        self._lock = threading.RLock()
        self._current: dict[str, Any] | None = None
        self._loaded_at: float | None = None
        self._degraded = False
        self._last_error: str | None = None

    def _validate(self, value: Any) -> dict[str, Any]:
        if not isinstance(value, dict):
            raise SnapshotUnavailable("snapshot must contain an object")
        issues = self._publisher.verify_snapshot_integrity(value)
        if issues:
            raise SnapshotUnavailable("snapshot validation failed")
        ids = [item.get("dealId") for item in value.get("items", [])]
        slugs = [item.get("slug") for item in value.get("items", [])]
        if len(ids) != len(set(ids)) or len(slugs) != len(set(slugs)):
            raise SnapshotUnavailable("snapshot contains duplicate public identity")
        return value

    def load(self) -> dict[str, Any]:
        with self._lock:
            try:
                raw = self.snapshot_file.read_text(encoding="utf-8")
                candidate = self._validate(json.loads(raw))
            except (OSError, json.JSONDecodeError, SnapshotUnavailable) as exc:
                self._degraded = self._current is not None
                self._last_error = type(exc).__name__
                raise SnapshotUnavailable("validated snapshot is unavailable") from exc
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
                raise SnapshotUnavailable("last-known-good snapshot exceeded maximum fallback age")
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
                return "stale-blocked"
            return "degraded" if self._degraded else "fresh"

    @property
    def last_error(self) -> str | None:
        return self._last_error
