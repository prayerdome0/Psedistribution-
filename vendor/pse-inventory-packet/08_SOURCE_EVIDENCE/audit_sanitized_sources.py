#!/usr/bin/env python3
"""Reproduce the dated inventory-readiness counts from sanitized evidence."""
from __future__ import annotations

import argparse
import csv
import json
import re
from collections import Counter
from pathlib import Path


def normalize_title(value: str) -> str:
    text = re.sub(r"\s+", " ", value.strip().casefold())
    while True:
        updated = re.sub(r"^(?:re|fwd|fw|automatic reply)\s*:\s*", "", text, flags=re.I)
        if updated == text:
            break
        text = updated
    text = re.sub(r"\bwe got your message\b.*$", "", text, flags=re.I).strip()
    return re.sub(r"\s+", " ", text)


def usable_quantity(value: str | None) -> bool:
    if not value or value.strip().upper() == "NEEDS CADEN REVIEW":
        return False
    return bool(re.search(r"\d", value))


def audit(root: Path) -> dict[str, int]:
    source = root / "08_SOURCE_EVIDENCE"
    with (source / "05_SANITIZED_CANDIDATE_AUDIT_ROWS.csv").open(encoding="utf-8", newline="") as handle:
        candidates = list(csv.DictReader(handle))
    with (source / "06_SANITIZED_CANONICAL_AUDIT_ROWS.csv").open(encoding="utf-8", newline="") as handle:
        canonical = list(csv.DictReader(handle))

    clusters = Counter(normalize_title(row["Buyer-Safe Product"]) for row in candidates)
    candidate_gated = sum(
        row["Proof Status"] == "PROOF_MISSING"
        and row["Availability Status"] == "LIVE_AVAILABILITY_TIMESTAMP_NEEDED"
        and row["Outreach Readiness"] == "NEEDS CADEN REVIEW"
        for row in candidates
    )
    return {
        "candidateRows": len(candidates),
        "canonicalRecords": len(canonical),
        "canonicalUnits": sum(int(float(row["Units Available"])) for row in canonical if row["Units Available"]),
        "duplicateRowsBeyondFirst": sum(count - 1 for count in clusters.values()),
        "largestNormalizedCluster": max(clusters.values(), default=0),
        "missingUsableQuantity": sum(not usable_quantity(row["Quantity"]) for row in candidates),
        "normalizedTitleClusters": len(clusters),
        "publishApprovedRecords": 0,
        "readyRecords": sum(row["Review Status"] == "Ready" for row in canonical),
        "reviewGatedCandidateRows": candidate_gated,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("packet", nargs="?", type=Path, default=Path("."))
    args = parser.parse_args()
    result = audit(args.packet.resolve())
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
