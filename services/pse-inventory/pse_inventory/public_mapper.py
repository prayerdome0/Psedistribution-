"""Allowlist mapping from private canonical records to public fields.

Public output is constructed ONLY from the explicit allowlist in
`contracts/public_private_field_map.csv`. This module never produces a public
object by copying a private object and deleting known-sensitive fields.
"""
from __future__ import annotations

import csv
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

CONTRACTS = Path(__file__).resolve().parents[1] / "contracts"
FIELD_MAP = CONTRACTS / "public_private_field_map.csv"


@lru_cache(maxsize=1)
def load_field_map(path: Path | None = None) -> dict[str, str]:
    """Return {private_path: public_field} for every PUBLISH* row."""
    mapping: dict[str, str] = {}
    target = Path(path) if path else FIELD_MAP
    with target.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            disposition = (row.get("Disposition") or "").strip()
            public_field = (row.get("Public Field") or "").strip()
            private_path = (row.get("Private Path") or "").strip()
            if disposition.startswith("PUBLISH") and public_field and "mapped allowlist" not in public_field:
                mapping[private_path] = public_field
    return mapping


PUBLIC_FIELDS = frozenset(load_field_map().values())


def _resolve(record: Mapping[str, Any], private_path: str) -> Any:
    node: Any = record
    for part in private_path.split("."):
        if part == "*":
            return None
        if not isinstance(node, Mapping) or part not in node:
            return None
        node = node[part]
    return node


def map_public_fields(canonical: Mapping[str, Any]) -> dict[str, Any]:
    """Deterministically project allowlisted canonical paths to public fields."""
    field_map = load_field_map()
    public: dict[str, Any] = {}
    for private_path in sorted(field_map):
        value = _resolve(canonical, private_path)
        if value is None:
            continue
        public[field_map[private_path]] = value
    profile = canonical.get("publicProfile") if isinstance(canonical.get("publicProfile"), Mapping) else {}
    for key, value in profile.items():
        if key in PUBLIC_FIELDS and value is not None:
            public.setdefault(key, value)
    return {key: public[key] for key in sorted(public)}
