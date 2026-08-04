"""Small deterministic fixed-window limiter for the runnable reference API."""
from __future__ import annotations

import threading
import time
from collections.abc import Callable


class FixedWindowRateLimiter:
    def __init__(self, *, limit: int, window_seconds: int, clock: Callable[[], float] = time.time):
        if limit < 1 or window_seconds < 1:
            raise ValueError("limit and window_seconds must be positive")
        self.limit = limit
        self.window_seconds = window_seconds
        self.clock = clock
        self._lock = threading.Lock()
        self._buckets: dict[str, tuple[int, int]] = {}

    def allow(self, key: str) -> bool:
        now = self.clock()
        window = int(now // self.window_seconds)
        with self._lock:
            prior_window, count = self._buckets.get(key, (window, 0))
            if prior_window != window:
                count = 0
                prior_window = window
            if count >= self.limit:
                self._buckets[key] = (prior_window, count)
                return False
            self._buckets[key] = (prior_window, count + 1)
            return True
