"""Environment-driven production ASGI entrypoint.

The production process is intentionally fail-closed. It requires PostgreSQL
for the active public snapshot and Valkey for shared replay/rate-limit state;
local preview uses ``pse_inventory.preview`` instead.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

from .api import create_app
from .settings import AppSettings


def _required(name: str) -> str:
    value = os.environ.get(name)
    if not value or value.startswith('replace-with-'):
        raise RuntimeError(f'required production environment variable is missing: {name}')
    return value


def _json_keys(value: str) -> dict[str, str]:
    try:
        keys = json.loads(value)
    except json.JSONDecodeError as exc:
        raise RuntimeError('PSE_REVALIDATION_KEYS_JSON must be valid JSON') from exc
    if not isinstance(keys, dict) or not keys or not all(isinstance(k, str) and isinstance(v, str) for k, v in keys.items()):
        raise RuntimeError('PSE_REVALIDATION_KEYS_JSON must be a non-empty object of key ID to secret')
    return keys


packet_root = Path(
    os.environ.get(
        'PSE_PACKET_ROOT',
        str(Path(__file__).resolve().parents[3] / 'vendor' / 'pse-inventory-packet'),
    )
).resolve()
settings = AppSettings(
    snapshot_file=Path(os.environ.get('PSE_SNAPSHOT_FILE', '/data/current.json')),
    packet_root=packet_root,
    hmac_keys=_json_keys(_required('PSE_REVALIDATION_KEYS_JSON')),
    cursor_secret=_required('PSE_CURSOR_SECRET'),
    allowed_origins=tuple(
        origin.strip()
        for origin in os.environ.get('PSE_ALLOWED_ORIGINS', 'https://pilotsalesdistribution.com').split(',')
        if origin.strip()
    ),
    max_last_good_age_seconds=int(os.environ.get('PSE_MAX_LAST_GOOD_AGE_SECONDS', '300')),
    rate_limit_per_minute=int(os.environ.get('PSE_RATE_LIMIT_PER_MINUTE', '120')),
    runtime_mode='production',
    database_url=_required('PSE_DATABASE_URL'),
    valkey_url=_required('PSE_VALKEY_URL'),
)
app = create_app(settings)
