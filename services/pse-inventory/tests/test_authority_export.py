"""Authority export loader tests: bounded, provenance-preserving inputs only."""
from __future__ import annotations

import json

import pytest

from pse_inventory.authority_export import AuthorityExportError, load_export, parse_export


def test_json_array_export_is_loaded(tmp_path):
    source = tmp_path / 'salesmax.json'
    source.write_text(json.dumps([{"sourceRecordId": "deal-1", "capturedAt": "2026-08-05T00:00:00Z"}]))
    assert load_export(source)[0]["sourceRecordId"] == "deal-1"


def test_csv_export_is_loaded(tmp_path):
    source = tmp_path / 'salesmax.csv'
    source.write_text('sourceRecordId,capturedAt\ndeal-1,2026-08-05T00:00:00Z\n')
    assert load_export(source)[0]["capturedAt"] == "2026-08-05T00:00:00Z"


def test_sheets_values_shape_is_mapped():
    body = json.dumps({"values": [["sourceRecordId", "capturedAt"], ["deal-1", "2026-08-05T00:00:00Z"]]}).encode()
    assert parse_export(body)[0]["sourceRecordId"] == "deal-1"


def test_empty_and_oversized_exports_fail_closed(tmp_path):
    with pytest.raises(AuthorityExportError):
        parse_export(b'[]', format_hint='json')
    with pytest.raises(AuthorityExportError):
        parse_export(b'x' * (2 * 1024 * 1024 + 1), format_hint='csv')


def test_remote_http_and_ftp_sources_are_rejected():
    with pytest.raises(AuthorityExportError):
        load_export('http://example.test/inventory.json')
    with pytest.raises(AuthorityExportError):
        load_export('ftp://example.test/inventory.json')
