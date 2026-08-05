"""Source intake: provenance requirements and stable hashing."""
from __future__ import annotations

import pytest

from pse_inventory.source_adapter import IntakeError, ingest
from pse_inventory.source_hash import source_sha256


def row(**overrides):
    base = {
        "sourceRecordId": "SRC-1",
        "capturedAt": "2026-08-03T12:00:00Z",
        "title": "Example",
    }
    base.update(overrides)
    return base


def test_source_sha256_is_deterministic():
    value = {"b": 2, "a": 1}
    assert source_sha256(value) == source_sha256({"a": 1, "b": 2})
    assert source_sha256(value).startswith("sha256:")


def test_ingest_rejects_missing_source_identifier():
    with pytest.raises(IntakeError, match="source identifier"):
        ingest([{"capturedAt": "2026-08-03T12:00:00Z"}], authority="test-authority")


def test_ingest_rejects_missing_captured_timestamp():
    with pytest.raises(IntakeError, match="captured timestamp"):
        ingest([{"sourceRecordId": "SRC-1"}], authority="test-authority")


def test_ingest_rejects_missing_authority():
    with pytest.raises(IntakeError, match="authority"):
        ingest([row()], authority="  ")


def test_ingest_preserves_rows_and_hashes():
    evidence = ingest([row(sourceRecordId="SRC-1"), row(sourceRecordId="SRC-2")], authority="auth")
    assert [record.source_record_id for record in evidence] == ["SRC-1", "SRC-2"]
    assert all(record.source_hash.startswith("sha256:") for record in evidence)
    assert evidence[0].authority == "auth"


def test_ingest_preserves_byte_identical_source_rows():
    evidence = ingest([row(), row()], authority="auth")
    assert len(evidence) == 2
    assert evidence[0].source_hash == evidence[1].source_hash


def test_mismatched_row_authority_rejected():
    with pytest.raises(IntakeError, match="authority"):
        ingest([row(authority="other-authority")], authority="auth")
