#!/usr/bin/env python3
"""Deterministic Phase 0 completeness validator for the PSE inventory wiring.

Exits nonzero when the implementation map is missing keys, holds empty values,
selects an unsupported website mode, or lacks a stable source version strategy.
Prints exactly one JSON object with `result: PASS|FAIL`.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAP_PATH = ROOT / "docs" / "pse-inventory" / "implementation-map.json"

REQUIRED_KEYS = {
    "websiteMode", "sourceAuthority", "sourceVersionStrategy",
    "websiteRepository", "websiteCommit", "buildCommand", "testCommand",
    "deploymentProject", "stagingUrl", "productionUrl", "secretStore",
    "backupArtifact", "restoreCommand", "rollbackCommand", "ownerApprover",
}
WEBSITE_MODES = {"ADAPT_EXISTING", "MOUNT_STATIC_REFERENCE"}


def validate() -> dict:
    errors: list[str] = []
    value: dict = {}
    if not MAP_PATH.is_file():
        errors.append(f"missing implementation map: {MAP_PATH}")
    else:
        try:
            value = json.loads(MAP_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            errors.append(f"implementation map is not valid JSON: {exc}")
    if isinstance(value, dict) and not errors:
        missing = sorted(REQUIRED_KEYS - set(value))
        if missing:
            errors.append("missing keys: " + ", ".join(missing))
        empty = sorted(key for key in REQUIRED_KEYS & set(value) if not str(value[key]).strip())
        if empty:
            errors.append("empty values: " + ", ".join(empty))
        mode = value.get("websiteMode")
        if mode not in WEBSITE_MODES:
            errors.append(f"unsupported websiteMode: {mode!r}")
        strategy = str(value.get("sourceVersionStrategy", ""))
        if "sha256" not in strategy.lower():
            errors.append("sourceVersionStrategy must describe a stable sha256-based versioning scheme")
        if str(value.get("productionStatus", "NOT_DEPLOYED")) not in {"NOT_DEPLOYED", "VERIFIED_DEPLOYED"}:
            errors.append("productionStatus must be NOT_DEPLOYED or VERIFIED_DEPLOYED")
    return {"result": "FAIL" if errors else "PASS", "errors": errors, "map": str(MAP_PATH)}


def main() -> int:
    outcome = validate()
    print(json.dumps(outcome, indent=2))
    return 0 if outcome["result"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
