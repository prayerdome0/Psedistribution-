"""Contract tests for the intentionally narrow Pilot Sales public release."""
from __future__ import annotations

import json
import re
import subprocess
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlparse

import pytest

REPO = Path(__file__).resolve().parents[1]
DOMAIN = "https://pilotsalesdistribution.com"

PUBLIC_PAGES = [
    "index.html",
    "products.html",
    "rfq.html",
    "about.html",
    "contact.html",
    "privacy.html",
    "terms.html",
]
INDEXABLE_PAGES = [page for page in PUBLIC_PAGES if page != "rfq.html"]
PROTECTED_PLACEHOLDER_PAGES = [
    "account.html",
    "admin-dashboard.html",
    "cart.html",
    "checkout-success.html",
    "checkout.html",
    "login.html",
    "order-success.html",
    "product-detail.html",
    "register.html",
    "returns.html",
    "seller-dashboard.html",
    "supplier-pending.html",
    "track-order.html",
    "wishlist.html",
]
EXPECTED_RELEASE_FILES = {
    *PUBLIC_PAGES,
    *PROTECTED_PLACEHOLDER_PAGES,
    "assets/hero-inspection-poster.jpg",
    "assets/hero-inspection-web.mp4",
    "favicon.ico",
    "logo.jpg",
    "robots.txt",
    "site.css",
    "site.js",
    "sitemap.xml",
}


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.has_main = False
        self.has_h1 = False
        self.has_viewport = False
        self.lang: str | None = None
        self.charset: str | None = None
        self.links: list[str] = []
        self.assets: list[str] = []
        self.images: list[tuple[str, str | None]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "html":
            self.lang = values.get("lang")
        elif tag == "meta":
            self.charset = values.get("charset") or self.charset
            self.has_viewport |= values.get("name") == "viewport"
        elif tag == "main":
            self.has_main = True
        elif tag == "h1":
            self.has_h1 = True
        elif tag == "a" and values.get("href"):
            self.links.append(values["href"])
        elif tag in {"script", "link", "source", "video", "img"}:
            target = values.get("src") or values.get("href") or values.get("poster")
            if target:
                self.assets.append(target)
            if tag == "img":
                self.images.append((values.get("src", ""), values.get("alt")))


def page_text(page: str) -> str:
    return (REPO / page).read_text(encoding="utf-8", errors="strict")


def head_text(page: str) -> str:
    text = page_text(page)
    match = re.search(r"<head>(.*?)</head>", text, re.I | re.S)
    assert match, f"{page} must have a head element"
    return match.group(1)


def canonical_for(page: str) -> str:
    return f"{DOMAIN}/" if page == "index.html" else f"{DOMAIN}/{page}"


@pytest.mark.parametrize("page", PUBLIC_PAGES)
def test_public_page_has_document_basics(page: str) -> None:
    text = page_text(page)
    parser = PageParser()
    parser.feed(text)
    assert text.lstrip().lower().startswith("<!doctype html>")
    assert parser.charset and parser.has_viewport and parser.lang == "en"
    assert parser.has_main and parser.has_h1
    for src, alt in parser.images:
        assert alt is not None, f"{page}: img {src!r} is missing alt"


@pytest.mark.parametrize("page", PUBLIC_PAGES)
def test_public_page_metadata_contract(page: str) -> None:
    head = head_text(page)
    title = re.findall(r"<title>(.*?)</title>", head, re.I | re.S)
    assert len(title) == 1 and 1 <= len(title[0].strip()) <= 70
    description = re.search(r'<meta\s+name="description"\s+content="([^"]+)"', head, re.I)
    assert description and 50 <= len(description.group(1)) <= 200
    canonical = canonical_for(page)
    assert f'<link rel="canonical" href="{canonical}">' in head
    for property_name in ["og:title", "og:description", "og:url", "og:image"]:
        assert re.search(
            rf'<meta\s+property="{re.escape(property_name)}"\s+content="[^"]+"', head, re.I
        ), f"{page} is missing {property_name}"
    assert f'<meta property="og:url" content="{canonical}">' in head
    for twitter_name in ["twitter:card", "twitter:title", "twitter:description", "twitter:image"]:
        assert re.search(
            rf'<meta\s+name="{re.escape(twitter_name)}"\s+content="[^"]+"', head, re.I
        ), f"{page} is missing {twitter_name}"


def test_homepage_has_organization_and_website_jsonld() -> None:
    text = page_text("index.html")
    assert re.search(r'"@type"\s*:\s*"Organization"', text)
    assert re.search(r'"@type"\s*:\s*"WebSite"', text)


@pytest.mark.parametrize("page", PUBLIC_PAGES)
def test_jsonld_blocks_are_valid_json(page: str) -> None:
    blocks = re.findall(
        r'<script\s+type="application/ld\+json">(.*?)</script>',
        page_text(page),
        re.I | re.S,
    )
    assert blocks, f"{page} must contain JSON-LD"
    for block in blocks:
        parsed = json.loads(block)
        assert parsed.get("@context") == "https://schema.org"


@pytest.mark.parametrize("page", [p for p in PUBLIC_PAGES if p != "index.html"])
def test_non_home_pages_have_breadcrumb_jsonld(page: str) -> None:
    assert re.search(r'"@type"\s*:\s*"BreadcrumbList"', page_text(page))


def test_rfq_is_noindex_while_indexable_pages_are_indexable() -> None:
    assert re.search(r'<meta\s+name="robots"\s+content="[^"]*noindex', head_text("rfq.html"), re.I)
    for page in INDEXABLE_PAGES:
        match = re.search(r'<meta\s+name="robots"\s+content="([^"]+)"', head_text(page), re.I)
        if match:
            assert "noindex" not in match.group(1).lower(), f"{page} must remain indexable"


@pytest.mark.parametrize("page", PROTECTED_PLACEHOLDER_PAGES)
def test_protected_placeholder_is_fail_closed(page: str) -> None:
    text = page_text(page)
    assert re.search(r'<meta\s+name="robots"\s+content="[^"]*noindex', text, re.I)
    assert "<form" not in text.lower(), f"{page} must not imply a working public account flow"
    assert not re.search(r'type\s*=\s*["\'](?:email|password|submit)["\']', text, re.I)


def test_release_manifest_is_exact_and_source_backed() -> None:
    manifest = json.loads((REPO / "public-release.json").read_text())
    assert manifest == sorted(EXPECTED_RELEASE_FILES)
    for relative in manifest:
        path = REPO / relative
        assert path.is_file(), f"release input is missing or not a file: {relative}"
        assert path.resolve().is_relative_to(REPO.resolve())


def test_public_builder_emits_only_the_manifest(tmp_path: Path) -> None:
    output = tmp_path / "public-output"
    subprocess.run(
        ["node", "scripts/build-public-site.mjs", str(output)],
        cwd=REPO,
        check=True,
        text=True,
        capture_output=True,
    )
    emitted = {
        str(path.relative_to(output))
        for path in output.rglob("*")
        if path.is_file()
    }
    assert emitted == EXPECTED_RELEASE_FILES
    forbidden = {
        "buyer-dashboard.html",
        "firebase.json",
        "firestore.rules",
        "docker-compose.yml",
        "pytest.ini",
        "sw.js",
        "manifest.json",
    }
    assert emitted.isdisjoint(forbidden)
    assert not any(path.suffix.lower() in {".zip", ".csv", ".md"} for path in output.rglob("*"))


def test_public_documents_have_no_broken_local_references() -> None:
    for page in PUBLIC_PAGES:
        parser = PageParser()
        parser.feed(page_text(page))
        for raw_target in parser.links + parser.assets:
            parsed = urlparse(raw_target)
            if parsed.scheme or parsed.netloc or raw_target.startswith(("#", "mailto:", "tel:")):
                continue
            target = unquote(parsed.path)
            if not target:
                continue
            relative = "index.html" if target == "/" else target.lstrip("/")
            assert relative in EXPECTED_RELEASE_FILES, f"{page} references undeployed file {relative}"


def test_vercel_serves_clean_build_with_security_headers() -> None:
    config = json.loads((REPO / "vercel.json").read_text())
    assert config.get("buildCommand") == "node scripts/build-public-site.mjs"
    assert config.get("outputDirectory") == ".vercel-public"
    headers = {
        header["key"]: header["value"]
        for rule in config.get("headers", [])
        for header in rule.get("headers", [])
    }
    for required in [
        "Content-Security-Policy",
        "X-Content-Type-Options",
        "X-Frame-Options",
        "Referrer-Policy",
        "Permissions-Policy",
    ]:
        assert required in headers
    assert "frame-ancestors 'none'" in headers["Content-Security-Policy"]
    assert headers["X-Frame-Options"] == "DENY"


def test_robots_and_sitemap_match_the_indexable_contract() -> None:
    robots = (REPO / "robots.txt").read_text()
    for route in ["/admin-dashboard.html", "/seller-dashboard.html", "/account.html", "/api/"]:
        assert f"Disallow: {route}" in robots
    root = ET.parse(REPO / "sitemap.xml").getroot()
    urls = {node.text for node in root.iter() if node.tag.endswith("}loc") or node.tag == "loc"}
    assert urls == {canonical_for(page) for page in INDEXABLE_PAGES}
    assert canonical_for("rfq.html") not in urls
