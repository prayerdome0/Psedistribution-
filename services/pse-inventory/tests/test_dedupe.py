"""Reconciliation: identity hierarchy, evidence preservation, review-only fuzzy."""
from __future__ import annotations

from pse_inventory.dedupe import normalize_title, reconcile


def source_row(**overrides):
    row = {
        "messageId": "m0",
        "title": "Example Lot",
        "quantity": 100,
    }
    aliases = {"message_id": "messageId", "thread_id": "threadId", "deal_id": "dealId"}
    for key, value in overrides.items():
        row[aliases.get(key, key)] = value
    return row


def test_reply_thread_rows_link_to_one_deal_without_deleting_evidence() -> None:
    rows = [source_row(message_id="m1", thread_id="t1"), source_row(message_id="m2", thread_id="t1")]
    result = reconcile(rows)
    assert len(result.canonical_candidates) == 1
    assert {row.message_id for row in result.evidence_rows} == {"m1", "m2"}
    assert result.evidence_rows[0].canonical_deal_id == result.evidence_rows[1].canonical_deal_id


def test_exact_deal_id_wins_over_everything() -> None:
    rows = [
        source_row(message_id="m1", dealId="PSE-TEST-0001", thread_id="t1"),
        source_row(message_id="m2", dealId="PSE-TEST-0001", thread_id="t9"),
        source_row(message_id="m3", dealId="PSE-TEST-0002"),
    ]
    result = reconcile(rows)
    assert len(result.canonical_candidates) == 2
    by_message = {row.message_id: row.canonical_deal_id for row in result.evidence_rows}
    assert by_message["m1"] == by_message["m2"]
    assert by_message["m3"] != by_message["m1"]


def test_upc_brand_model_links_rows() -> None:
    rows = [
        source_row(message_id="m1", upc="036000291452", brand="Acme", model="X1"),
        source_row(message_id="m2", upc="036000291452", brand="acme", model="x1"),
    ]
    result = reconcile(rows)
    assert len(result.canonical_candidates) == 1


def test_supplier_sku_quantity_fob_links_rows() -> None:
    rows = [
        source_row(message_id="m1", supplierSku="SUP-1", quantity=500, fob="Los Angeles"),
        source_row(message_id="m2", supplierSku="SUP-1", quantity=500, fob="los angeles"),
    ]
    result = reconcile(rows)
    assert len(result.canonical_candidates) == 1


def test_source_hash_links_rows() -> None:
    rows = [
        source_row(message_id="m1", sourceHash="ab" * 32),
        source_row(message_id="m2", sourceHash="ab" * 32),
    ]
    result = reconcile(rows)
    assert len(result.canonical_candidates) == 1


def test_fuzzy_title_similarity_never_merges_automatically() -> None:
    rows = [
        source_row(message_id="m1", title="Cheerios 20oz Case", upc="0000000000017", brand="A"),
        source_row(message_id="m2", title="cheerios  20oz case!", quantity=777, supplierSku="Z-9", fob="Dallas"),
    ]
    result = reconcile(rows)
    assert len(result.canonical_candidates) == 2, "fuzzy title match must not auto-merge"
    suggestions = [s for s in result.review_suggestions if s["type"] == "normalized-title-cluster"]
    assert suggestions and suggestions[0]["action"].startswith("review-only")


def test_every_source_row_is_preserved() -> None:
    rows = [source_row(message_id=f"m{i}") for i in range(7)]
    result = reconcile(rows)
    assert len(result.evidence_rows) == 7


def test_normalize_title_is_deterministic() -> None:
    assert normalize_title("  Cheerios  20oz — CASE! ") == normalize_title("cheerios 20oz case")
