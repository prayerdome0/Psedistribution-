"""Public-release and dormant inventory-module boundary checks.

The verified opportunity-display release intentionally replaced the older
live-catalog storefront. The reusable catalog module remains tested, while the
deployed pages must stay request-based and must not imply live inventory.
"""
from __future__ import annotations

import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_dormant_catalog_module_tests_pass() -> None:
    completed = subprocess.run(
        ["node", "--test", "catalog.test.mjs"],
        cwd=ROOT / "apps" / "pse-inventory-catalog",
        capture_output=True,
        text=True,
        check=False,
    )
    assert completed.returncode == 0, completed.stdout + completed.stderr


def test_current_opportunity_page_is_request_based() -> None:
    html = (ROOT / "products.html").read_text(encoding="utf-8")
    assert "PUBLIC CATALOG STATUS" in html
    assert "Request-based" in html
    assert "Local draft only" in html
    assert "/api/inventory" not in html
    assert "fetchInventoryFeed" not in html


def test_protected_product_detail_is_fail_closed() -> None:
    html = (ROOT / "product-detail.html").read_text(encoding="utf-8")
    assert 'content="noindex,nofollow"' in html
    assert "Current deal details are request-based" in html
    assert "/api/inventory/" not in html
    assert "db.collection('products')" not in html


def test_public_discovery_pages_have_no_private_or_static_product_fallbacks() -> None:
    for page in ("index.html", "products.html", "product-detail.html", "search-pro.js"):
        html = (ROOT / page).read_text(encoding="utf-8")
        assert "db.collection('products')" not in html
        assert "PSE_CATALOG_DATA" not in html


def test_rfq_is_a_local_non_inventory_draft() -> None:
    html = (ROOT / "rfq.html").read_text(encoding="utf-8")
    script = (ROOT / "site.js").read_text(encoding="utf-8")
    assert "does not transmit data" in html
    assert "NOT SUBMITTED / NOT AN ORDER" in script
    assert "fetch(" not in script
    assert "XMLHttpRequest" not in script
    assert "rfqDealId" not in html


def test_unsupported_claims_are_absent_from_storefront() -> None:
    unsupported = [
        "12,000+ Products",
        "580+ Verified Suppliers",
        "99.7% Customer Satisfaction",
        "Free Shipping on Orders Over $250",
    ]
    for page in ("index.html", "products.html"):
        html = (ROOT / page).read_text(encoding="utf-8")
        for claim in unsupported:
            assert claim not in html


def test_request_page_states_current_verification_boundary() -> None:
    html = (ROOT / "products.html").read_text(encoding="utf-8")
    assert "request current deals" in html.lower()
    assert "nothing is submitted, ordered, reserved, messaged, or paid" in html.lower()
