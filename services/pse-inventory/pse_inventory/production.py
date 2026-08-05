"""Production dependency wiring.

Imports for PostgreSQL and Valkey stay inside this module so local unit tests
can continue to use the deterministic single-process fixtures without starting
external services. Production mode is fail-closed when either dependency or
connection setting is missing.
"""
from __future__ import annotations

from typing import Any

from .postgres_repository import PostgresSnapshotRepository
from .shared_state import ValkeyNonceStore, ValkeyRateLimiter


def build_production_repository(settings: Any) -> PostgresSnapshotRepository:
    if not settings.database_url:
        raise RuntimeError('PSE_DATABASE_URL is required in production mode')
    try:
        import psycopg  # type: ignore
    except ImportError as exc:  # pragma: no cover - deployment dependency
        raise RuntimeError('psycopg is required in production mode') from exc

    def connect():
        return psycopg.connect(settings.database_url, connect_timeout=3)

    return PostgresSnapshotRepository(
        connection_factory=connect,
        max_last_good_age_seconds=settings.max_last_good_age_seconds,
        packet_root=settings.packet_root,
    )


def build_production_shared_state(settings: Any) -> tuple[Any, Any]:
    if not settings.valkey_url:
        raise RuntimeError('PSE_VALKEY_URL is required in production mode')
    nonce_store = ValkeyNonceStore.from_url(settings.valkey_url)
    limiter = ValkeyRateLimiter.from_url(
        settings.valkey_url,
        limit=settings.rate_limit_per_minute,
        window_seconds=60,
    )
    return nonce_store, limiter
