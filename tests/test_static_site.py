"""
test_static_site.py
-------------------
Lightweight structural tests for the static HTML storefront. These do
not require a browser — they parse the HTML and assert the invariants
the rest of the site depends on.

Add new tests here when you add a new page or a new public-facing
behaviour that has to keep working.
"""
from __future__ import annotations

import json
import re
from html.parser import HTMLParser
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[1]

PUBLIC_PAGES = [
    "index.html", "products.html", "product-detail.html", "rfq.html",
    "about.html", "contact.html", "help-center.html",
    "privacy.html", "terms.html",
]
ALL_PAGES = [
    "index.html", "products.html", "product-detail.html", "rfq.html",
    "login.html", "register.html", "forgot-password.html",
    "account.html", "buyer-dashboard.html", "seller-dashboard.html",
    "admin-dashboard.html", "about.html", "contact.html", "help-center.html",
    "privacy.html", "terms.html", "track-order.html", "cart.html",
    "checkout.html", "wishlist.html", "order-success.html", "chat.html",
    "offline.html", "404.html", "500.html",
]


class _Counter(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.has_main = False
        self.has_h1 = False
        self.has_form = False
        self.has_viewport = False
        self.lang: str | None = None
        self.charset: str | None = None
        self.inline_event_handlers: list[str] = []
        self.links: list[str] = []
        self.imgs: list[tuple[str, str | None]] = []
        # Form / auth-sensitive markers
        self.has_password_input = False
        self.has_email_input = False
        self.has_submit = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        a = dict(attrs)
        if tag == "html":
            self.lang = a.get("lang")
        elif tag == "meta":
            if a.get("name") == "viewport":
                self.has_viewport = True
            if a.get("charset"):
                self.charset = a.get("charset")
        elif tag == "main":
            self.has_main = True
        elif tag == "h1":
            self.has_h1 = True
        elif tag == "form":
            self.has_form = True
        elif tag == "a" and a.get("href"):
            self.links.append(a["href"])
        elif tag == "img":
            self.imgs.append((a.get("src", ""), a.get("alt")))
        elif tag == "input":
            t = (a.get("type") or "").lower()
            if t == "password":
                self.has_password_input = True
            elif t == "email":
                self.has_email_input = True
            elif t == "submit":
                self.has_submit = True
        elif tag == "button":
            if (a.get("type") or "").lower() == "submit":
                self.has_submit = True
        # inline event handlers on interactive elements only
        if tag in ("button", "a", "div", "span", "section", "form"):
            for k in a:
                if k.startswith("on"):
                    self.inline_event_handlers.append(f"{tag}[{k}]")


@pytest.mark.parametrize("fname", ALL_PAGES)
def test_page_exists(fname: str) -> None:
    assert (REPO / fname).exists(), f"required page {fname} is missing"


@pytest.mark.parametrize("fname", ALL_PAGES)
def test_page_has_doctype(fname: str) -> None:
    text = (REPO / fname).read_text(encoding="utf-8", errors="replace").lstrip().lower()
    assert text.startswith("<!doctype html>"), f"{fname} must start with <!DOCTYPE html>"


@pytest.mark.parametrize("fname", ALL_PAGES)
def test_page_has_charset(fname: str) -> None:
    c = _Counter()
    c.feed((REPO / fname).read_text(encoding="utf-8", errors="replace"))
    assert c.charset, f"{fname} must declare <meta charset>"


@pytest.mark.parametrize("fname", ALL_PAGES)
def test_page_has_viewport(fname: str) -> None:
    c = _Counter()
    c.feed((REPO / fname).read_text(encoding="utf-8", errors="replace"))
    assert c.has_viewport, f"{fname} must declare <meta name='viewport'>"


@pytest.mark.parametrize("fname", ALL_PAGES)
def test_page_has_lang(fname: str) -> None:
    c = _Counter()
    c.feed((REPO / fname).read_text(encoding="utf-8", errors="replace"))
    assert c.lang, f"{fname} must declare lang on <html>"
    assert c.lang.startswith("en"), f"{fname} should have lang='en' (got {c.lang!r})"


@pytest.mark.parametrize("fname", ALL_PAGES)
def test_page_has_unique_title(fname: str) -> None:
    text = (REPO / fname).read_text(encoding="utf-8", errors="replace")
    # Only count <title> tags that are direct children of <head>. Other
    # <title> tags may appear inside <svg> or inside JS template literals
    # and should be ignored.
    head_end = text.lower().find("</head>")
    assert head_end != -1, f"{fname} has no </head>"
    head = text[:head_end]
    matches = re.findall(r"<title>(.*?)</title>", head, re.S)
    assert matches, f"{fname} must have a <title> in <head>"
    assert len(matches) == 1, f"{fname} must have exactly one <title> in <head> (found {len(matches)})"
    title = matches[0].strip()
    assert title, f"{fname}: <title> is empty"
    assert len(title) <= 70, f"{fname}: <title> is {len(title)} chars (>70 hurts SEO)"


@pytest.mark.parametrize("fname", PUBLIC_PAGES)
def test_public_page_has_meta_description(fname: str) -> None:
    text = (REPO / fname).read_text(encoding="utf-8", errors="replace")
    m = re.search(r'<meta\s+name="description"\s+content="([^"]+)"', text)
    assert m, f"{fname} must have a meta description"
    desc = m.group(1)
    assert 50 <= len(desc) <= 200, f"{fname}: description is {len(desc)} chars (target 50-200)"


@pytest.mark.parametrize("fname", PUBLIC_PAGES)
def test_public_page_has_canonical(fname: str) -> None:
    text = (REPO / fname).read_text(encoding="utf-8", errors="replace")
    assert 'rel="canonical"' in text, f"{fname} must declare a canonical URL"


@pytest.mark.parametrize("fname", PUBLIC_PAGES)
def test_public_page_has_og_title_and_description(fname: str) -> None:
    text = (REPO / fname).read_text(encoding="utf-8", errors="replace")
    assert 'property="og:title"' in text, f"{fname} must declare og:title"
    assert 'property="og:description"' in text, f"{fname} must declare og:description"
    assert 'property="og:url"' in text, f"{fname} must declare og:url"
    assert 'property="og:image"' in text, f"{fname} must declare og:image"


@pytest.mark.parametrize("fname", PUBLIC_PAGES)
def test_public_page_has_breadcrumb_jsonld(fname: str) -> None:
    text = (REPO / fname).read_text(encoding="utf-8", errors="replace")
    assert '"@type":"BreadcrumbList"' in text or '"@type": "BreadcrumbList"' in text, (
        f"{fname} should have a BreadcrumbList JSON-LD block"
    )


def test_index_has_organization_jsonld() -> None:
    text = (REPO / "index.html").read_text(encoding="utf-8", errors="replace")
    assert '"@type":"Organization"' in text, "index.html must have Organization JSON-LD"
    assert '"@type":"WebSite"' in text, "index.html must have WebSite JSON-LD"


# ─── Auth page-specific checks ──────────────────────────────────────
AUTH_PAGES = ["login.html", "register.html", "forgot-password.html"]


@pytest.mark.parametrize("fname", AUTH_PAGES)
def test_auth_page_has_email_and_password(fname: str) -> None:
    c = _Counter()
    c.feed((REPO / fname).read_text(encoding="utf-8", errors="replace"))
    if fname == "forgot-password.html":
        assert c.has_email_input, f"{fname} must have an email input"
    else:
        assert c.has_email_input, f"{fname} must have an email input"
        assert c.has_password_input, f"{fname} must have a password input"
    assert c.has_submit, f"{fname} must have a submit button"


@pytest.mark.parametrize("fname", AUTH_PAGES)
def test_auth_page_has_noindex(fname: str) -> None:
    text = (REPO / fname).read_text(encoding="utf-8", errors="replace")
    # auth pages must not be indexed
    m = re.search(r'<meta\s+name="robots"\s+content="([^"]+)"', text)
    assert m, f"{fname} must have a robots meta"
    assert "noindex" in m.group(1).lower(), f"{fname} robots must be noindex (got {m.group(1)!r})"


# ─── Image alt text ──────────────────────────────────────────────────
@pytest.mark.parametrize("fname", ALL_PAGES)
def test_page_images_have_alt(fname: str) -> None:
    c = _Counter()
    c.feed((REPO / fname).read_text(encoding="utf-8", errors="replace"))
    for src, alt in c.imgs:
        # An empty alt="" is OK for purely decorative images (e.g. a 1x1
        # spacer), but the attribute MUST be present.
        assert alt is not None, f"{fname}: <img> missing alt (src={src[:60]})"


# ─── vercel.json sanity ──────────────────────────────────────────────
def test_vercel_json_required_headers() -> None:
    with open(REPO / "vercel.json") as f:
        data = json.load(f)
    headers = {h["key"]: h["value"] for e in data.get("headers", []) for h in e.get("headers", [])}
    for required in ["X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy",
                     "Content-Security-Policy", "Permissions-Policy"]:
        assert required in headers, f"vercel.json missing required header {required}"
    csp = headers.get("Content-Security-Policy", "")
    assert "default-src" in csp, "CSP must include default-src"
    assert "frame-ancestors" in csp, "CSP must include frame-ancestors"


def test_vercel_json_rewrites_for_required_pages() -> None:
    with open(REPO / "vercel.json") as f:
        data = json.load(f)
    rewrite_sources = {r.get("source", "").rstrip("/") for r in data.get("rewrites", [])}
    # /404 and /offline are served automatically by Vercel/Firebase from the
    # static /404.html and /offline.html files; no rewrite needed.
    for required in ["/products", "/rfq", "/login", "/register", "/forgot-password",
                     "/admin-dashboard", "/buyer-dashboard", "/500", "/offline"]:
        assert required in rewrite_sources, f"vercel.json missing rewrite for {required}"


# ─── robots.txt / sitemap coherence ─────────────────────────────────
def test_robots_txt_disallows_admin() -> None:
    text = (REPO / "robots.txt").read_text()
    for must in ["/admin-dashboard", "/seller-dashboard", "/account", "/api/"]:
        assert must in text, f"robots.txt must disallow {must}"


def test_sitemap_xml_well_formed() -> None:
    import xml.etree.ElementTree as ET
    tree = ET.parse(REPO / "sitemap.xml")
    root = tree.getroot()
    urls = [u.text for u in root.iter() if u.tag.endswith("}loc") or u.tag == "loc"]
    assert len(urls) >= 5, f"sitemap.xml only has {len(urls)} URLs (expected at least 5)"


# ─── Service worker + manifest ─────────────────────────────────────
def test_sw_caches_offline_page() -> None:
    text = (REPO / "sw.js").read_text()
    assert "/offline.html" in text, "sw.js must precache the offline page"


def test_manifest_references_sw_scope() -> None:
    data = json.loads((REPO / "manifest.json").read_text())
    assert data.get("start_url"), "manifest.json must have a start_url"
    assert data.get("name"), "manifest.json must have a name"
    assert any(icon.get("sizes") == "192x192" for icon in data.get("icons", [])), (
        "manifest.json must declare a 192x192 icon for PWA install"
    )
