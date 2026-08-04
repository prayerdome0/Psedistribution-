"""Environment-driven ASGI entrypoint; exits fail-closed when secrets are absent.

Required environment (never committed, never exposed to client JavaScript):
- PSE_SNAPSHOT_FILE           path to the validated public snapshot
- PSE_CURSOR_SECRET           >=32 bytes
- PSE_REVALIDATION_KEYS_JSON  JSON object of key ID -> secret (>=16 bytes each)
"""
from __future__ import annotations

import json
import os
from pathlib import Path

from .api import create_app
from .settings import AppSettings


def _required(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"required environment variable is missing: {name}")
    return value


packet_root = Path(os.environ.get("PSE_PACKET_ROOT", Path(__file__).resolve().parents[3] / "vendor" / "pse-inventory-packet")).resolve()
keys = json.loads(_required("PSE_REVALIDATION_KEYS_JSON"))
if not isinstance(keys, dict) or not all(isinstance(k, str) and isinstance(v, str) for k, v in keys.items()):
    raise RuntimeError("PSE_REVALIDATION_KEYS_JSON must be a JSON object of key ID to secret")
settings = AppSettings(
    snapshot_file=Path(os.environ.get("PSE_SNAPSHOT_FILE", str(Path(__file__).resolve().parents[2] / "data" / "current.json"))),
    packet_root=packet_root,
    cursor_secret=_required("PSE_CURSOR_SECRET"),
    hmac_keys=keys,
    allowed_origins=tuple(filter(None, os.environ.get("PSE_ALLOWED_ORIGINS", "https://pilotsalesdistribution.com").split(","))),
    max_last_good_age_seconds=int(os.environ.get("PSE_MAX_LAST_GOOD_AGE_SECONDS", "300")),
    rate_limit_per_minute=int(os.environ.get("PSE_RATE_LIMIT_PER_MINUTE", "120")),
)
app = create_app(settings)
