#!/usr/bin/env python3
"""
fix-structured-data.py
----------------------
Adds JSON-LD structured data to the homepage (Organization + WebSite +
SearchAction) and a structured data template to the product-detail page
(Schema.org Product). Idempotent.

Usage:
    python3 scripts/fix-structured-data.py
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SITE = "https://pilotsalesdistribution.com"
MARKER = "<!-- SEO:STRUCTURED-DATA -->"


def organization_ld() -> str:
    return json.dumps({
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "Pilot Sales Distribution",
        "url": SITE,
        "logo": f"{SITE}/logo.webp",
        "description": "Verified B2B wholesale marketplace. Real-time inventory, freight quoted per product, RFQ-first purchasing.",
        "sameAs": [
            "https://wa.me/19099384682",
        ],
        "contactPoint": [{
            "@type": "ContactPoint",
            "telephone": "+1-909-938-4682",
            "contactType": "sales",
            "availableLanguage": ["English"],
            "areaServed": "Worldwide",
        }],
    }, separators=(",", ":"))


def website_ld() -> str:
    return json.dumps({
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "Pilot Sales Distribution",
        "url": SITE,
        "potentialAction": {
            "@type": "SearchAction",
            "target": {
                "@type": "EntryPoint",
                "urlTemplate": f"{SITE}/products?search={{search_term_string}}",
            },
            "query-input": "required name=search_term_string",
        },
    }, separators=(",", ":"))


def breadcrumb_ld(items: list[tuple[str, str]]) -> str:
    return json.dumps({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": name, "item": f"{SITE}{url}"}
            for i, (name, url) in enumerate(items)
        ],
    }, separators=(",", ":"))


def product_ld() -> str:
    # Placeholder values; the page's JS will overwrite the
    # price/availability/name/description/sku with real data.
    return json.dumps({
        "@context": "https://schema.org",
        "@type": "Product",
        "name": "__PRODUCT_NAME__",
        "description": "__PRODUCT_DESCRIPTION__",
        "image": "__PRODUCT_IMAGE__",
        "sku": "__PRODUCT_SKU__",
        "brand": {"@type": "Brand", "name": "__PRODUCT_BRAND__"},
        "offers": {
            "@type": "Offer",
            "url": "__PRODUCT_URL__",
            "priceCurrency": "USD",
            "price": "__PRODUCT_PRICE__",
            "availability": "https://schema.org/InStock",
            "itemCondition": "https://schema.org/NewCondition",
            "seller": {"@type": "Organization", "name": "Pilot Sales Distribution"},
        },
    }, separators=(",", ":"))


def insert_block(fname: str, block_id: str, json_str: str) -> bool:
    f = REPO / fname
    if not f.exists():
        print(f"  skip {fname}")
        return False
    text = f.read_text(encoding="utf-8", errors="replace")
    block = f"""{MARKER}{block_id}
<script type="application/ld+json">
{json_str}
</script>
"""
    if f"{MARKER}{block_id}" in text:
        # Replace existing
        text = re.sub(
            re.escape(MARKER) + re.escape(block_id) + r".*?</script>\s*",
            block,
            text, count=1, flags=re.S
        )
    else:
        # Insert just before </head>
        text = text.replace("</head>", block + "\n</head>", 1)
    f.write_text(text, encoding="utf-8")
    return True


def main() -> int:
    n = 0
    n += insert_block("index.html", "organization", organization_ld())
    n += insert_block("index.html", "website", website_ld())
    n += insert_block("index.html", "breadcrumb-home", breadcrumb_ld([("Home", "/")]))
    n += insert_block("products.html", "breadcrumb-products", breadcrumb_ld([("Home", "/"), ("Products", "/products")]))
    n += insert_block("product-detail.html", "breadcrumb-product", breadcrumb_ld([("Home", "/"), ("Products", "/products"), ("Product", "/product-detail")]))
    # product-detail.html already injects a dynamic Product JSON-LD from
    # the real product data via JavaScript; no need to add a static template.
    n += insert_block("about.html", "breadcrumb-about", breadcrumb_ld([("Home", "/"), ("About", "/about")]))
    n += insert_block("contact.html", "breadcrumb-contact", breadcrumb_ld([("Home", "/"), ("Contact", "/contact")]))
    n += insert_block("rfq.html", "breadcrumb-rfq", breadcrumb_ld([("Home", "/"), ("Request Quote", "/rfq")]))
    print(f"\nUpdated {n} structured-data blocks.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
