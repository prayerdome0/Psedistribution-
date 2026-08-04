from __future__ import annotations

from app.rate_limit import FixedWindowRateLimiter


def test_rate_limiter_blocks_after_configured_limit() -> None:
    limiter = FixedWindowRateLimiter(limit=2, window_seconds=60, clock=lambda: 1000.0)
    assert limiter.allow("buyer") is True
    assert limiter.allow("buyer") is True
    assert limiter.allow("buyer") is False


def test_rate_limiter_resets_after_window() -> None:
    now = [1000.0]
    limiter = FixedWindowRateLimiter(limit=1, window_seconds=60, clock=lambda: now[0])
    assert limiter.allow("buyer") is True
    assert limiter.allow("buyer") is False
    now[0] = 1061.0
    assert limiter.allow("buyer") is True
