"""Website wiring contract: catalog/detail/RFQ consume only the public API and
preserve Deal ID, source/snapshot version and quantity end-to-end."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_node_catalog_tests_pass():
    completed = subprocess.run(
        ["node", "--test", "catalog.test.mjs"],
        cwd=ROOT / "apps" / "pse-inventory-catalog",
        capture_output=True, text=True, check=False,
    )
    assert completed.returncode == 0, completed.stdout + completed.stderr


def test_products_page_reads_public_api_not_private_master():
    html = (ROOT / "products.html").read_text(encoding="utf-8")
    assert "/api/inventory" in html
    assert "fetchInventoryFeed" in html
    # the inventory grid must not query Firestore for products anymore
    load_block = html.split("async function loadProducts()")[1].split("allProducts = products;")[0]
    assert "db.collection('products')" not in load_block


def test_product_detail_page_prefers_public_api():
    html = (ROOT / "product-detail.html").read_text(encoding="utf-8")
    assert "/api/inventory/" in html
    assert "mapInventoryDetail" in html
    assert "rfqOnly" in html, "RFQ/login pricing must never render a fabricated price"


def test_rfq_page_preserves_inventory_identity():
    html = (ROOT / "rfq.html").read_text(encoding="utf-8")
    for field in ("rfqDealId", "rfqSlug", "rfqSourceVersion", "rfqSnapshotVersion"):
        assert field in html
    assert "deal_id: dealId || null" in html
    assert "source_version: sourceVersion || null" in html
    assert "snapshot_version: snapshotVersion || null" in html
    assert "prefillFromInventoryLink" in html


def test_unsupported_claims_removed_from_storefront():
    for page in ("index.html", "products.html"):
        html = (ROOT / page).read_text(encoding="utf-8")
        assert "12,000+ Products" not in html
        assert "580+ Verified Suppliers" not in html
        assert "99.7% Customer Satisfaction" not in html
        assert "Free Shipping on Orders Over $250" not in html


def test_product_level_terms_present_on_catalog():
    html = (ROOT / "products.html").read_text(encoding="utf-8")
    assert "Freight quoted separately unless explicitly included" in html
    assert "Availability subject to prior sale and final confirmation" in html
