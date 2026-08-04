from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import pytest


def canonical_json(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def make_item(*, deal_id: str = "PSE-TEST-0001", slug: str = "test-product", title: str = "Test Product", status: str = "available", quantity_mode: str = "exact") -> dict[str, Any]:
    now = datetime(2026, 8, 3, 20, 0, tzinfo=timezone.utc)
    item: dict[str, Any] = {
        "schemaVersion": "4.0.0",
        "dealId": deal_id,
        "sourceVersion": "sha256:" + "1" * 64,
        "termsVersion": "terms-v1",
        "slug": slug,
        "title": title,
        "shortDescription": "Factory-sealed buyer-safe test inventory.",
        "category": "other",
        "status": status,
        "quantityMode": quantity_mode,
        "moqUnits": 10,
        "pricingMode": "rfq",
        "currency": "USD",
        "condition": "new",
        "fob": "Los Angeles, CA",
        "freightTerms": "quote-required",
        "inspectionTerms": "Inspection available before pickup by appointment.",
        "returnTerms": "Final sale after inspection unless otherwise agreed in writing.",
        "imageUrls": ["https://images.pilotsalesdistribution.com/test-product.jpg"],
        "rfqEnabled": True,
        "lastSourceVerifiedAt": now.isoformat().replace("+00:00", "Z"),
        "lastAvailabilityConfirmedAt": now.isoformat().replace("+00:00", "Z"),
        "availabilityExpiresAt": (now + timedelta(hours=24)).isoformat().replace("+00:00", "Z"),
        "publishedAt": now.isoformat().replace("+00:00", "Z"),
    }
    if quantity_mode == "exact":
        item["availableToSell"] = 100
    elif quantity_mode == "range":
        item["quantityRange"] = {"minimum": 100, "maximum": 249}
    return item


def make_snapshot(items: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    items = items or [make_item()]
    payload = {
        "schemaVersion": "4.0.0",
        "publisherVersion": "4.0.0",
        "sourceVersion": "sha256:" + "2" * 64,
        "recordCount": len(items),
        "items": items,
    }
    version = "sha256:" + hashlib.sha256(canonical_json(payload)).hexdigest()
    return {
        "schemaVersion": "4.0.0",
        "publisherVersion": "4.0.0",
        "snapshotVersion": version,
        "sourceVersion": payload["sourceVersion"],
        "runId": "run-test",
        "releaseId": "release-test",
        "generatedAt": "2026-08-03T20:00:00Z",
        "previousSnapshotVersion": None,
        "recordCount": len(items),
        "items": items,
    }


@pytest.fixture
def snapshot_file(tmp_path: Path) -> Path:
    path = tmp_path / "current.json"
    path.write_text(json.dumps(make_snapshot(), indent=2) + "\n", encoding="utf-8")
    return path
