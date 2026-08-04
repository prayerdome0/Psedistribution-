#!/usr/bin/env python3
"""Generate the STAGING DEMO public snapshot through the real publication path.

This exercises the exact production pipeline — packet publisher gate, allowlist
mapping, privacy scan, deterministic hashing, atomic promotion — against two
clearly-labeled demo records. These records are DEMO DATA: they are not
SalesMax inventory, they carry no real availability, and they must never be
used as production approval evidence.

Usage:
    python services/pse-inventory/fixtures/generate_demo_snapshot.py \
        --operator engineering-session --run-id demo-run-1 --release-id demo-release-1
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

SERVICE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE))

from pse_inventory._packet import load_atomic_store_module  # noqa: E402
from pse_inventory.snapshot_builder import build_snapshot, compute_record_version  # noqa: E402
from pse_inventory.source_hash import source_sha256  # noqa: E402

DATA_DIR = SERVICE / "data"


def demo_records(now: datetime) -> list[dict]:
    confirmed = now - timedelta(hours=1)
    expires = now + timedelta(hours=72)
    approved_at = now - timedelta(minutes=30)
    verified = now - timedelta(hours=2)

    def record(*, deal_id, product_id, slug, title, description, category, condition,
               pricing_mode, unit_price, on_hand, reserved, cases, units_per_case,
               moq_units, moq_cases, fob, freight_terms, upc=None) -> dict:
        source_payload = {
            "authority": "STAGING_DEMO",
            "sourceRecordId": f"SRC-{deal_id}",
            "capturedAt": verified.isoformat(timespec="seconds").replace("+00:00", "Z"),
            "note": "Demo intake row — not SalesMax data.",
        }
        profile = {
            "termsVersion": "demo-terms-v1",
            "slug": slug,
            "title": title,
            "shortDescription": description,
            "brand": "Demo Brand",
            "category": category,
            "quantityMode": "exact",
            "moqUnits": moq_units,
            "moqCases": moq_cases,
            "pricingMode": pricing_mode,
            "currency": "USD",
            "condition": condition,
            "fob": fob,
            "freightTerms": freight_terms,
            "inspectionTerms": "Inspection before release is available by appointment.",
            "returnTerms": "Final sale unless otherwise stated in the executed invoice.",
            "imageUrls": ["https://pilotsalesdistribution.com/logo.webp"],
            "rfqEnabled": True,
            "seo": {
                "metaTitle": f"{title} - Wholesale",
                "metaDescription": description[:150],
            },
        }
        if pricing_mode == "public":
            profile["publicUnitPrice"] = unit_price
        base = {
            "schemaVersion": "4.0.0",
            "dealId": deal_id,
            "canonicalProductId": product_id,
            "status": "available",
            "reviewStatus": "ready",
            "publishApproved": True,
            "publishApproval": {"approvedBy": "demo-operator", "approvedAt": approved_at.isoformat(timespec="seconds").replace("+00:00", "Z"), "approvalVersion": "placeholder"},
            "publishBlockers": [],
            "source": {
                "sourceRecordIds": [f"SRC-{deal_id}"],
                "sourceHashes": [source_sha256(source_payload)[7:]],
                "sourceVersion": source_sha256(source_payload),
                "lastSourceVerifiedAt": verified.isoformat(timespec="seconds").replace("+00:00", "Z"),
                "lastAvailabilityConfirmedAt": confirmed.isoformat(timespec="seconds").replace("+00:00", "Z"),
                "availabilityExpiresAt": expires.isoformat(timespec="seconds").replace("+00:00", "Z"),
                "proofEvidenceIds": [f"EVID-{deal_id}"],
            },
            "inventory": {
                "onHandUnits": on_hand,
                "reservedUnits": reserved,
                "availableToSell": on_hand - reserved,
                "casesAvailable": cases,
                "unitsPerCase": units_per_case,
            },
            "supplier": {
                "name": "PRIVATE DEMO SUPPLIER - MUST NOT PUBLISH",
                "supplierSku": f"SUP-{deal_id}",
                "contactReference": "PRIVATE DEMO CONTACT - MUST NOT PUBLISH",
            },
            "privateCommercial": {
                "acquisitionCostPerUnit": 0.5,
                "internalSellFloorPerUnit": 0.9,
                "marketReferencePerUnit": 2.0,
                "internalNotes": "DEMO INTERNAL ONLY - MUST NOT PUBLISH",
                "proofLinks": ["https://private.example.invalid/demo/proof"],
            },
            "publicProfile": profile,
            "audit": {
                "owner": "demo-operator",
                "reviewer": "demo-reviewer",
                "recordUpdatedAt": approved_at.isoformat(timespec="seconds").replace("+00:00", "Z"),
                "lastPublishedAt": None,
                "lastApiSyncAt": None,
                "lastSiteRevalidatedAt": None,
            },
        }
        if upc:
            profile["upc"] = upc
        base["recordVersion"] = compute_record_version(base)
        base["publishApproval"]["approvalVersion"] = base["recordVersion"]
        return base

    return [
        record(
            deal_id="PSE-DEMO-0001",
            product_id="PRODUCT-DEMO-0001",
            slug="demo-closeout-beverage-lot",
            title="DEMO — Closeout Beverage Lot (Case-Good)",
            description="Staging demo lot used to verify the inventory wiring. Offered by quote; availability subject to final confirmation.",
            category="grocery",
            condition="closeout",
            pricing_mode="rfq",
            unit_price=None,
            on_hand=1200,
            reserved=120,
            cases=90,
            units_per_case=12,
            moq_units=12,
            moq_cases=1,
            fob="Los Angeles, CA",
            freight_terms="freight-extra",
            upc="036000291452",
        ),
        record(
            deal_id="PSE-DEMO-0002",
            product_id="PRODUCT-DEMO-0002",
            slug="demo-overstock-electronics-lot",
            title="DEMO — Overstock Electronics Accessories Lot",
            description="Staging demo lot with public unit pricing, used to verify price-mode rendering. Freight quoted separately.",
            category="electronics",
            condition="overstock",
            pricing_mode="public",
            unit_price=4.75,
            on_hand=800,
            reserved=160,
            cases=16,
            units_per_case=40,
            moq_units=40,
            moq_cases=1,
            fob="Dallas, TX",
            freight_terms="freight-extra",
        ),
    ]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--operator", required=True)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--release-id", required=True)
    parser.add_argument("--now", help="RFC3339 timestamp override (testing only)")
    args = parser.parse_args(argv)

    if args.now:
        normalized = args.now[:-1] + "+00:00" if args.now.endswith("Z") else args.now
        now = datetime.fromisoformat(normalized).astimezone(timezone.utc)
    else:
        now = datetime.now(timezone.utc)

    records = demo_records(now)
    approvals = [
        {
            "dealId": record["dealId"],
            "approvedSourceVersion": record["source"]["sourceVersion"],
            "approvedRecordVersion": record["recordVersion"],
            "approverId": record["publishApproval"]["approvedBy"],
            "approvedAt": record["publishApproval"]["approvedAt"],
        }
        for record in records
    ]
    previous = None
    current_file = DATA_DIR / "current.json"
    if current_file.is_file():
        try:
            previous = json.loads(current_file.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            previous = None

    snapshot, report = build_snapshot(
        records, now=now, run_id=args.run_id, release_id=args.release_id,
        operator=args.operator, approvals=approvals, previous_snapshot=previous,
        allowed_media_hosts={"pilotsalesdistribution.com", "www.pilotsalesdistribution.com", "cdn.pilotsalesdistribution.com"},
    )

    atomic_store = load_atomic_store_module()
    atomic_store.promote_snapshot(DATA_DIR, snapshot)
    print(json.dumps(report, indent=2, ensure_ascii=False))
    print(f"promoted snapshotVersion={snapshot['snapshotVersion']} to {current_file}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
