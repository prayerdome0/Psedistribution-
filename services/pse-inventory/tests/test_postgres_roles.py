"""Role isolation: static audit of migration grants + optional live DB check.

The live checks run only when PSE_TEST_DATABASE_URL is provided (staging with
the pinned PostgreSQL image); they are skipped in environments without a
database, matching the packet's rule that container presence is not evidence.
"""
from __future__ import annotations

import os
import re
from pathlib import Path

import pytest

MIGRATIONS = Path(__file__).resolve().parents[1] / "migrations"


def _sql(name: str) -> str:
    return (MIGRATIONS / name).read_text(encoding="utf-8")


def test_storefront_role_receives_select_only_on_active_view():
    grants = _sql("002_role_grants.sql")
    assert "REVOKE ALL ON SCHEMA private_inventory FROM pse_storefront" in grants
    assert "REVOKE ALL ON SCHEMA audit FROM pse_storefront" in grants
    storefront_grants = re.findall(r"GRANT\s+([A-Z, ]+)\s+ON\s+(?:SCHEMA\s+)?([\w.]+)\s+TO\s+pse_storefront", grants)
    for privileges, target in storefront_grants:
        assert "INSERT" not in privileges or target == "public_inventory.rfq_requests"
        assert "UPDATE" not in privileges and "DELETE" not in privileges
    assert "GRANT SELECT ON public_inventory.active_snapshot TO pse_storefront" in grants


def test_private_schema_is_closed_to_public():
    grants = _sql("002_role_grants.sql")
    assert "REVOKE ALL ON SCHEMA private_inventory FROM PUBLIC" in grants
    assert "REVOKE ALL ON SCHEMA audit FROM PUBLIC" in grants


def test_snapshot_tables_enforce_identity_and_count_consistency():
    schema = _sql("001_inventory_control_plane.sql")
    assert "snapshot->>'snapshotVersion' = snapshot_version" in schema
    assert "(snapshot->>'recordCount')::integer = record_count" in schema
    assert "public_inventory_one_active_snapshot" in schema


def test_canonical_deals_bind_record_identity():
    schema = _sql("001_inventory_control_plane.sql")
    assert "canonical_record->>'dealId' = deal_id" in schema
    assert "canonical_record->>'recordVersion' = record_version" in schema


@pytest.mark.skipif(not os.environ.get("PSE_TEST_DATABASE_URL"), reason="requires live staging PostgreSQL")
def test_storefront_cannot_read_private_inventory_live():  # pragma: no cover
    import psycopg  # type: ignore

    url = os.environ["PSE_TEST_DATABASE_URL"].replace("postgres://", "postgresql://", 1)
    storefront_url = url.replace("pse_admin", "pse_storefront_login")
    with psycopg.connect(storefront_url) as connection:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            connection.cursor().execute("SELECT * FROM private_inventory.canonical_deals LIMIT 1")
