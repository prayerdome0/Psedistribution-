#!/usr/bin/env python3
"""Export the inventory API's OpenAPI schema to docs/api/openapi.json.

The production server (pse_inventory.server:app) intentionally disables the
auto-generated /openapi.json and /docs endpoints (they are world-reachable
in the public deployment and would expose internal paths). This script
loads the app in-process, fetches the schema programmatically, and writes
a checked-in copy to docs/api/openapi.json so it can be hosted in a
private control plane.

Usage:
    ./.venv/bin/python scripts/export-openapi.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "services" / "pse-inventory"))

from pse_inventory.api import CONTRACT_VERSION, create_app  # noqa: E402
from pse_inventory.settings import AppSettings  # noqa: E402


def main() -> int:
    # Use the default settings (no DB / Valkey needed — schema is static).
    settings = AppSettings(
        snapshot_file=Path("/data/current.json"),
        packet_root=REPO_ROOT / "vendor" / "pse-inventory-packet",
        cursor_secret="0" * 32,  # 32-byte placeholder; schema doesn't care
        hmac_keys={"test": "0" * 32},
    )
    app = create_app(settings)
    schema = app.openapi()
    schema["info"]["version"] = CONTRACT_VERSION
    schema["info"]["title"] = "PSE Public Inventory API"
    schema["info"]["description"] = (
        "Buyer-safe public inventory API for Pilot Sales Distribution. "
        "Implements the packet contract v4.0.0. The live deployment disables "
        "the auto-generated /docs and /openapi.json endpoints; this checked-in "
        "copy is generated from the same FastAPI app and is the source of "
        "truth for integration partners."
    )

    out = REPO_ROOT / "docs" / "api" / "openapi.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(schema, indent=2, sort_keys=False) + "\n", encoding="utf-8")
    print(f"wrote {out} ({out.stat().st_size} bytes, contract v{CONTRACT_VERSION})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
