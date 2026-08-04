"""Public API behavior: contract responses, ETag/304, cursor binding, privacy."""
from __future__ import annotations

import copy

from conftest import promote_snapshot_to_file


def test_list_returns_contract_meta_and_items(client, valid_snapshot):
    response = client.get("/api/inventory?limit=10")
    assert response.status_code == 200
    body = response.json()
    assert body["meta"]["totalCount"] == valid_snapshot["recordCount"]
    assert body["meta"]["snapshotVersion"] == valid_snapshot["snapshotVersion"]
    assert body["meta"]["sourceVersion"] == valid_snapshot["sourceVersion"]
    assert body["meta"]["freshness"] == "fresh"
    assert body["data"][0]["dealId"] == valid_snapshot["items"][0]["dealId"]


def test_list_response_never_contains_private_fields(client):
    response = client.get("/api/inventory?limit=100")
    raw = response.text.lower()
    for banned in ("supplier", "acquisitioncost", "sellfloor", "prooflink", "internalnotes", "owner", "reviewer"):
        assert banned not in raw, f"private field leaked: {banned}"


def test_etag_and_conditional_request(client):
    first = client.get("/api/inventory")
    etag = first.headers["ETag"]
    assert etag.startswith('"sha256:')
    second = client.get("/api/inventory", headers={"If-None-Match": etag})
    assert second.status_code == 304
    assert second.headers["ETag"] == etag


def test_detail_unpublished_slug_returns_404(client):
    response = client.get("/api/inventory/never-published-slug")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "ITEM_NOT_FOUND"


def test_detail_returns_public_item(client, valid_snapshot):
    slug = valid_snapshot["items"][0]["slug"]
    response = client.get(f"/api/inventory/{slug}")
    assert response.status_code == 200
    item = response.json()
    assert item["slug"] == slug
    assert "X-PSE-Snapshot-Version" in response.headers


def test_cursor_is_bound_to_snapshot_and_query(client, settings, valid_records):
    from conftest import FIXED_NOW, approvals_for, clone_approved_record

    from pse_inventory.snapshot_builder import build_snapshot

    first = client.get("/api/inventory?category=other&limit=1")
    assert first.status_code == 200
    cursor = first.json()["meta"]["nextCursor"]

    extra = clone_approved_record(valid_records[0], deal_id="PSE-EXAMPLE-002", slug="second-lot",
                                  source_record_id="SRC-EXAMPLE-002", source_hash="b" * 64)
    records = valid_records + [extra]
    next_snapshot, _ = build_snapshot(records, now=FIXED_NOW, run_id="run-b", release_id="release-b",
                                      operator="test-operator", approvals=approvals_for(records))
    promote_snapshot_to_file(next_snapshot, settings.snapshot_file)

    assert client.get(f"/api/inventory?category=other&limit=1&cursor={cursor}").status_code == 400


def test_invalid_cursor_rejected(client):
    response = client.get("/api/inventory?cursor=garbage")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_CURSOR"


def test_query_filter_matches_title(client):
    response = client.get("/api/inventory?q=Example")
    assert response.status_code == 200
    assert response.json()["meta"]["totalCount"] >= 1
    empty = client.get("/api/inventory?q=zzzz-no-match")
    assert empty.json()["meta"]["totalCount"] == 0


def test_rate_limit_enforced(settings, snapshot_file):
    from fastapi.testclient import TestClient

    from dataclasses import replace

    from pse_inventory.api import create_app

    tight = replace(settings, rate_limit_per_minute=2)
    app = create_app(tight)
    with TestClient(app) as test_client:
        assert test_client.get("/api/inventory").status_code == 200
        assert test_client.get("/api/inventory").status_code == 200
        blocked = test_client.get("/api/inventory")
        assert blocked.status_code == 429
        assert blocked.json()["error"]["code"] == "RATE_LIMITED"


def test_parameter_bounds(client):
    assert client.get("/api/inventory?limit=0").status_code == 422
    assert client.get("/api/inventory?limit=101").status_code == 422
    assert client.get("/api/inventory?status=bogus").status_code == 422
