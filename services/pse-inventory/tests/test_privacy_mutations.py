"""Privacy boundary: public output must never carry private fields or values.

Every mutation below must be rejected or stripped; passing one means the
allowlist boundary is broken.
"""
from __future__ import annotations

import copy

import pytest

from conftest import FIXED_NOW, approvals_for
from pse_inventory._packet import load_publisher_module
from pse_inventory.public_mapper import PUBLIC_FIELDS, load_field_map, map_public_fields
from pse_inventory.snapshot_builder import build_snapshot

publisher = load_publisher_module()


def _build(records):
    snapshot, _ = build_snapshot(records, now=FIXED_NOW, run_id="run", release_id="rel",
                                 operator="op", approvals=approvals_for(records))
    return snapshot


def test_supplier_and_cost_never_appear_in_public_output(valid_records, valid_snapshot):
    for item in valid_snapshot["items"]:
        for key in item:
            lowered = key.lower()
            assert "supplier" not in lowered
            assert "cost" not in lowered
            assert "margin" not in lowered
            assert "proof" not in lowered
            assert "owner" not in lowered
            assert "reviewer" not in lowered


def test_injected_private_key_fails_publication_closed(valid_records):
    from pse_inventory.snapshot_builder import PublishBlocked

    record = copy.deepcopy(valid_records[0])
    record["publicProfile"]["supplierName"] = "LEAKED SUPPLIER"
    record["publicProfile"]["acquisitionCost"] = 1.23
    with pytest.raises(PublishBlocked):
        _build([record])


def test_private_value_pattern_in_public_text_is_rejected(valid_records):
    from pse_inventory.snapshot_builder import PublishBlocked

    record = copy.deepcopy(valid_records[0])
    record["publicProfile"]["shortDescription"] = "INTERNAL ONLY SECRET SENTINEL must stay private"
    with pytest.raises(PublishBlocked):
        _build([record])


def test_non_https_image_url_rejected(valid_records):
    from pse_inventory.snapshot_builder import PublishBlocked

    record = copy.deepcopy(valid_records[0])
    record["publicProfile"]["imageUrls"] = ["http://insecure.example.com/img.jpg"]
    with pytest.raises(PublishBlocked):
        _build([record])


def test_field_map_allowlist_is_consistent_with_public_schema():
    import json
    from pathlib import Path

    schema_path = Path(__file__).resolve().parents[1] / "contracts" / "public_inventory_item.schema.json"
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    schema_keys = set(schema["properties"])
    assert PUBLIC_FIELDS <= schema_keys, PUBLIC_FIELDS - schema_keys


def test_map_public_fields_projects_only_allowlisted_paths(valid_records):
    public = map_public_fields(valid_records[0])
    assert public["dealId"] == valid_records[0]["dealId"]
    assert public["sourceVersion"] == valid_records[0]["source"]["sourceVersion"]
    assert "title" in public
    for key in public:
        assert key in PUBLIC_FIELDS


def test_privacy_scan_flags_private_keys():
    findings = publisher.privacy_scan({
        "title": "ok",
        "supplier": {"name": "x"},
        "internalNotes": "private",
        "proofLinks": ["https://private.example.invalid/x"],
    })
    assert any("supplier" in path for path in findings)
    assert any("internalNotes" in path for path in findings)
    assert any("proofLinks" in path for path in findings)
