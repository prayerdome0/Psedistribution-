#!/usr/bin/env python3
"""Import a source export into PRIVATE canonical drafts and a review queue.

This migration NEVER publishes. Every imported row stays review-gated until:
- proof and live availability are confirmed,
- quantity/case pack/FOB/condition/pricing mode are verified,
- an owner approval exists for the exact post-migration source version.

Mapping follows `vendor/pse-inventory-packet/02_IMPLEMENTATION/
06_CURRENT_SHEET_TO_CANONICAL_MAPPING.csv`; fields without verified values are
recorded as blockers, never inferred.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pse_inventory.authority_export import AuthorityExportError, load_export  # noqa: E402
from pse_inventory.source_adapter import ingest, reconcile_evidence  # noqa: E402
from pse_inventory.source_hash import source_sha256  # noqa: E402

REQUIRED_PRIVATE_ONLY = [
    "reservedUnits", "publishApproved", "sourceRecordIds", "sourceHashes",
    "sourceVersion", "lastAvailabilityConfirmedAt", "availabilityExpiresAt",
    "termsVersion", "slug", "moqUnits", "pricingMode", "currency",
    "freightTerms", "inspectionTerms", "rfqEnabled", "reviewer",
]


def draft_from_row(row: dict, canonical_deal_id: str) -> tuple[dict, list[str]]:
    blockers: list[str] = []
    quantity = row.get("quantity") or row.get("unitsAvailable")
    try:
        on_hand = int(str(quantity).replace(",", "")) if quantity is not None else None
    except (TypeError, ValueError):
        on_hand = None
        blockers.append("missing usable quantity")
    if not row.get("lastAvailabilityConfirmedAt"):
        blockers.append("missing live availability confirmation")
    if not row.get("proofEvidenceIds"):
        blockers.append("missing proof evidence")
    if not row.get("publicPrice") and not row.get("pricingMode"):
        blockers.append("missing pricing mode / approved public price")

    draft = {
        "schemaVersion": "4.0.0",
        "dealId": str(row.get("dealId") or canonical_deal_id),
        "status": "draft",
        "reviewStatus": "needs-review",
        "publishApproved": False,
        "publishBlockers": blockers,
        "source": {
            "sourceRecordIds": [str(row.get("sourceRecordId") or row.get("messageId"))],
            "sourceHashes": [row.get("sourceHash", "")],
            "sourceVersion": source_sha256(row),
            "lastSourceVerifiedAt": row.get("capturedAt"),
            "lastAvailabilityConfirmedAt": row.get("lastAvailabilityConfirmedAt"),
            "availabilityExpiresAt": row.get("availabilityExpiresAt"),
        },
        "inventory": {
            "onHandUnits": on_hand,
            "reservedUnits": None,
            "availableToSell": None,
        },
        "publicProfile": {
            "title": row.get("title") or row.get("productName"),
            "category": row.get("category"),
            "condition": row.get("condition"),
            "fob": row.get("fob"),
        },
        "_import": {"reviewOnly": True, "missingBeforeApproval": REQUIRED_PRIVATE_ONLY},
    }
    return draft, blockers


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, help="local JSON/CSV export or HTTPS authority endpoint")
    parser.add_argument("--authority", required=True, help="authority identifier recorded on every row")
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--format", choices=("json", "csv"), help="format override for the authority export")
    parser.add_argument("--bearer-token-env", default="PSE_AUTHORITY_BEARER_TOKEN",
                        help="server-side environment variable containing an optional HTTPS bearer token")
    args = parser.parse_args(argv)

    try:
        rows = load_export(
            args.source,
            bearer_token=os.environ.get(args.bearer_token_env),
            format_hint=args.format,
        )
    except AuthorityExportError as exc:
        raise SystemExit(f"authority export rejected: {exc}") from exc

    evidence = ingest(rows, authority=args.authority)
    reconciliation = reconcile_evidence(evidence)

    drafts: list[dict] = []
    review_queue: list[dict] = []
    for record, evidence_row in zip(evidence, reconciliation.evidence_rows):
        draft, blockers = draft_from_row(evidence_row.row, str(evidence_row.canonical_deal_id))
        drafts.append(draft)
        if blockers:
            review_queue.append({
                "dealId": draft["dealId"],
                "sourceRecordId": record.source_record_id,
                "blockers": blockers,
            })

    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / "canonical_drafts.json").write_text(
        json.dumps(drafts, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (args.output_dir / "review_queue.json").write_text(
        json.dumps(review_queue, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({
        "imported": len(drafts),
        "canonicalCandidates": len(reconciliation.canonical_candidates),
        "reviewSuggestionClusters": len(reconciliation.review_suggestions),
        "blocked": len(review_queue),
        "published": 0,
        "note": "private-only import; publication requires owner approval per record",
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
