"""Evidence-preserving reconciliation of duplicate source rows.

Deterministic identity hierarchy (in order of precedence for key generation):
1. exact stable Deal ID
2. source thread/message ID
3. UPC/GTIN plus brand and model
4. supplier SKU plus quantity and FOB
5. exact source hash

Rows sharing any identity key are linked to one canonical candidate. Fuzzy
normalized-title similarity NEVER merges rows automatically; it only emits
review suggestions. Every source row is preserved as evidence.
"""
from __future__ import annotations

import re
import unicodedata
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any

from .source_hash import source_sha256


@dataclass
class EvidenceRow:
    message_id: str
    row: dict[str, Any]
    source_hash: str
    canonical_deal_id: str | None = None


@dataclass
class ReconciliationResult:
    canonical_candidates: list[str] = field(default_factory=list)
    evidence_rows: list[EvidenceRow] = field(default_factory=list)
    review_suggestions: list[dict[str, Any]] = field(default_factory=list)


def normalize_title(title: str) -> str:
    value = unicodedata.normalize("NFKD", title or "")
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()
    return re.sub(r"\s+", " ", value)


def _identity_keys(row: Mapping[str, Any]) -> list[tuple[str, str]]:
    """Identity keys in the mandated precedence order."""
    keys: list[tuple[str, str]] = []
    deal_id = str(row.get("dealId") or "").strip()
    if deal_id:
        keys.append(("deal", deal_id))
    thread_id = str(row.get("threadId") or "").strip()
    if thread_id:
        keys.append(("thread", thread_id))
    upc = str(row.get("upc") or "").strip()
    brand = str(row.get("brand") or "").strip().lower()
    model = str(row.get("model") or "").strip().lower()
    if upc and (brand or model):
        keys.append(("upc", f"{upc}|{brand}|{model}"))
    supplier_sku = str(row.get("supplierSku") or "").strip()
    quantity = str(row.get("quantity") or row.get("unitsAvailable") or "").strip()
    fob = str(row.get("fob") or "").strip().lower()
    if supplier_sku and quantity and fob:
        keys.append(("sku", f"{supplier_sku}|{quantity}|{fob}"))
    source_hash = str(row.get("sourceHash") or "").strip()
    if source_hash:
        keys.append(("hash", source_hash))
    return keys


class _UnionFind:
    def __init__(self) -> None:
        self.parent: dict[str, str] = {}

    def add(self, node: str) -> None:
        if node not in self.parent:
            self.parent[node] = node

    def find(self, node: str) -> str:
        self.add(node)
        while self.parent[node] != node:
            self.parent[node] = self.parent[self.parent[node]]
            node = self.parent[node]
        return node

    def union(self, a: str, b: str) -> str:
        root_a, root_b = self.find(a), self.find(b)
        if root_a != root_b:
            keep, drop = sorted((root_a, root_b))
            self.parent[drop] = keep
        return self.find(a)


def reconcile(rows: Sequence[Mapping[str, Any]]) -> ReconciliationResult:
    result = ReconciliationResult()
    forest = _UnionFind()

    for index, raw in enumerate(rows):
        row = dict(raw)
        message_id = str(row.get("messageId") or row.get("sourceRecordId") or f"row-{index}")
        row_node = f"row:{message_id}"
        forest.add(row_node)
        for identity in _identity_keys(row):
            key_node = f"{identity[0]}:{identity[1]}"
            forest.union(row_node, key_node)
        result.evidence_rows.append(EvidenceRow(
            message_id=message_id,
            row=row,
            source_hash=str(row.get("sourceHash") or source_sha256(row)),
        ))

    for evidence in result.evidence_rows:
        evidence.canonical_deal_id = forest.find(f"row:{evidence.message_id}")

    result.canonical_candidates = sorted({evidence.canonical_deal_id for evidence in result.evidence_rows})

    title_index: dict[str, list[str]] = {}
    for evidence in result.evidence_rows:
        title = normalize_title(str(evidence.row.get("title") or evidence.row.get("productName") or ""))
        if title:
            title_index.setdefault(title, []).append(evidence.message_id)
    for title, members in sorted(title_index.items()):
        if len(members) > 1:
            result.review_suggestions.append({
                "type": "normalized-title-cluster",
                "normalizedTitle": title,
                "messageIds": sorted(members),
                "action": "review-only; never an automatic merge",
            })
    return result
