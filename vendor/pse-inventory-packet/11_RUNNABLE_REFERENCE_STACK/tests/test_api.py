from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator, FormatChecker

from app.main import AppSettings, create_app
from conftest import make_item, make_snapshot


def client_for(snapshot_file: Path, packet_root: Path) -> TestClient:
    settings = AppSettings(
        snapshot_file=snapshot_file,
        packet_root=packet_root,
        cursor_secret="c" * 32,
        hmac_keys={"test-key": "h" * 32},
        allowed_origins=("https://pilotsalesdistribution.com",),
        max_last_good_age_seconds=300,
        rate_limit_per_minute=100,
    )
    return TestClient(create_app(settings))


def test_list_endpoint_matches_contract_and_sets_version_headers(snapshot_file: Path) -> None:
    packet_root = Path(__file__).resolve().parents[2]
    client = client_for(snapshot_file, packet_root)
    response = client.get("/api/inventory")
    assert response.status_code == 200
    body = response.json()
    assert body["meta"]["totalCount"] == 1
    assert body["meta"]["pageCount"] == 1
    assert response.headers["x-pse-snapshot-version"] == body["meta"]["snapshotVersion"]
    schema = json.loads((packet_root / "03_CONTRACTS/public_inventory_list_response.schema.json").read_text())
    Draft202012Validator(schema, format_checker=FormatChecker()).validate(body)


def test_etag_returns_304(snapshot_file: Path) -> None:
    packet_root = Path(__file__).resolve().parents[2]
    client = client_for(snapshot_file, packet_root)
    first = client.get("/api/inventory")
    second = client.get("/api/inventory", headers={"If-None-Match": first.headers["etag"]})
    assert second.status_code == 304
    assert second.content == b""


def test_search_filter_and_signed_cursor_are_stable(tmp_path: Path) -> None:
    packet_root = Path(__file__).resolve().parents[2]
    items = [
        make_item(deal_id=f"PSE-TEST-{i:04d}", slug=f"product-{i}", title=f"Product {i}")
        for i in range(1, 5)
    ]
    path = tmp_path / "current.json"
    path.write_text(json.dumps(make_snapshot(items), indent=2), encoding="utf-8")
    client = client_for(path, packet_root)
    first = client.get("/api/inventory", params={"q": "Product", "limit": 2})
    assert first.status_code == 200
    assert [row["slug"] for row in first.json()["data"]] == ["product-1", "product-2"]
    cursor = first.json()["meta"]["nextCursor"]
    second = client.get("/api/inventory", params={"q": "Product", "limit": 2, "cursor": cursor})
    assert [row["slug"] for row in second.json()["data"]] == ["product-3", "product-4"]


def test_tampered_cursor_returns_sanitized_400(snapshot_file: Path) -> None:
    packet_root = Path(__file__).resolve().parents[2]
    client = client_for(snapshot_file, packet_root)
    response = client.get("/api/inventory", params={"cursor": "tampered"})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_CURSOR"
    assert "traceback" not in response.text.lower()


def test_detail_endpoint_never_returns_private_fields(snapshot_file: Path) -> None:
    packet_root = Path(__file__).resolve().parents[2]
    client = client_for(snapshot_file, packet_root)
    response = client.get("/api/inventory/test-product")
    assert response.status_code == 200
    forbidden = {"supplier", "wholesaleCost", "margin", "owner", "proofLink", "notes"}
    assert forbidden.isdisjoint(response.json())


def test_confirm_availability_has_no_exact_quantity(tmp_path: Path) -> None:
    packet_root = Path(__file__).resolve().parents[2]
    item = make_item(status="confirm-availability", quantity_mode="confirm")
    path = tmp_path / "current.json"
    path.write_text(json.dumps(make_snapshot([item]), indent=2), encoding="utf-8")
    client = client_for(path, packet_root)
    body = client.get("/api/inventory/test-product").json()
    assert body["quantityMode"] == "confirm"
    assert "availableToSell" not in body
    assert "quantityRange" not in body


def test_cors_allows_only_configured_origin(snapshot_file: Path) -> None:
    packet_root = Path(__file__).resolve().parents[2]
    client = client_for(snapshot_file, packet_root)
    allowed = client.options(
        "/api/inventory",
        headers={"Origin": "https://pilotsalesdistribution.com", "Access-Control-Request-Method": "GET"},
    )
    assert allowed.headers.get("access-control-allow-origin") == "https://pilotsalesdistribution.com"
    denied = client.options(
        "/api/inventory",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"},
    )
    assert denied.headers.get("access-control-allow-origin") is None
