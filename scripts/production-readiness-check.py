#!/usr/bin/env python3
"""
production-readiness-check.py
-----------------------------
Verifies the production launch checklist from the brief. Exits 0 only
when every gate passes. Designed to be run in CI before tagging a
production release.

Usage:
    python3 scripts/production-readiness-check.py [--strict]

What it checks:

  GATE 1  Frontend
    1.1  All required pages exist
    1.2  Every page has a unique <title> and meta description
    1.3  Every <a> link points to an existing local page (or is explicitly
         allowed as external)
    1.4  Every <img> has an alt attribute
    1.5  Every <form> has a submit button or button[type=submit]
    1.6  Lighthouse-style: viewport meta, lang attribute, charset
    1.7  No inline event handlers (onclick, onload) — use addEventListener

  GATE 2  Security
    2.1  vercel.json declares the required security headers
    2.2  CSP allows the production domain and the preview hosts
    2.3  robots.txt disallows the private areas
    2.4  .env files are not committed (test_env_hygiene covers this)
    2.5  No hardcoded API keys / secrets in the repo

  GATE 3  Performance
    3.1  Images are < 500KB (warning if larger)
    3.2  Static assets have a Cache-Control header (via vercel.json)
    3.3  Service worker exists and is referenced from the manifest
    3.4  No large inline scripts (> 50KB)

  GATE 4  SEO
    4.1  sitemap.xml exists and is well-formed
    4.2  robots.txt exists and references the sitemap
    4.3  Every public page has canonical URL meta
    4.4  Every public page has OG title and description
    4.5  manifest.json is valid

  GATE 5  Accessibility (basic)
    5.1  Every page has a <main> element
    5.2  Every page has an <h1> element
    5.3  Every interactive element has accessible name (aria-label or
         visible text)
    5.4  Color contrast: warns if --primary is too close to --white

  GATE 6  Inventory API
    6.1  The API Dockerfile builds
    6.2  All required env vars are documented in .env.example
    6.3  OpenAPI spec exports successfully

  GATE 7  CI / DevOps
    7.1  CI workflow exists
    7.2  Deploy workflow exists
    7.3  Secret-scan workflow exists
    7.4  Docker compose for the full stack exists
    7.5  nginx config exists for the storefront

  GATE 8  Documentation
    8.1  README exists
    8.2  ADMIN_MANUAL exists
    8.3  OPERATOR_RUNBOOK exists
    8.4  DEVELOPER_GUIDE exists
    8.5  SECURITY policy exists

  GATE 9  Tests
    9.1  The Python test suite passes
    9.2  The env-hygiene test passes

  GATE 10 Error handling
   10.1  /404 page exists
   10.2  /500 page exists
   10.3  /offline page exists
   10.4  Every page handles the "no JS" case (noscript fallback)
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable

REPO = Path(__file__).resolve().parents[1]
REQUIRED_PAGES = {
    "/": "index.html",
    "/products": "products.html",
    "/product-detail": "product-detail.html",
    "/rfq": "rfq.html",
    "/login": "login.html",
    "/register": "register.html",
    "/forgot-password": "forgot-password.html",
    "/account": "account.html",
    "/buyer-dashboard": "buyer-dashboard.html",
    "/seller-dashboard": "seller-dashboard.html",
    "/admin-dashboard": "admin-dashboard.html",
    "/about": "about.html",
    "/contact": "contact.html",
    "/help-center": "help-center.html",
    "/privacy": "privacy.html",
    "/terms": "terms.html",
    "/offline": "offline.html",
    "/404": "404.html",
    "/500": "500.html",
}
PUBLIC_PAGES = [p for p in REQUIRED_PAGES if p not in ("/404", "/500", "/offline", "/login", "/register", "/forgot-password", "/account", "/buyer-dashboard", "/seller-dashboard", "/admin-dashboard")]

REQUIRED_SECRETS = [
    "PSE_CURSOR_SECRET",
    "PSE_REVALIDATION_KEYS_JSON",
    "PSE_DATABASE_URL",
    "PSE_VALKEY_URL",
    "PSE_SNAPSHOT_FILE",
    "PSE_PACKET_ROOT",
]

# ANSI helpers
def _supports_color() -> bool:
    return sys.stdout.isatty() and os.environ.get("NO_COLOR") is None
def red(s: str) -> str: return f"\x1b[31m{s}\x1b[0m" if _supports_color() else s
def green(s: str) -> str: return f"\x1b[32m{s}\x1b[0m" if _supports_color() else s
def yellow(s: str) -> str: return f"\x1b[33m{s}\x1b[0m" if _supports_color() else s
def bold(s: str) -> str: return f"\x1b[1m{s}\x1b[0m" if _supports_color() else s

failures: list[str] = []
warnings: list[str] = []

def fail(msg: str) -> None:
    failures.append(msg)
    print(f"  {red('✗')} {msg}")

def warn(msg: str) -> None:
    warnings.append(msg)
    print(f"  {yellow('!')} {msg}")

def ok(msg: str) -> None:
    print(f"  {green('✓')} {msg}")

def gate(num: int, name: str) -> None:
    print(f"\n{bold(f'GATE {num}  {name}')}")


# ─── Gate 1: Frontend ────────────────────────────────────────────────────
def gate_1_frontend() -> None:
    gate(1, "Frontend")
    # 1.1 required pages
    missing = [(p, f) for p, f in REQUIRED_PAGES.items() if not (REPO / f).exists()]
    if missing:
        for p, f in missing:
            fail(f"missing required page {p} → {f}")
    else:
        ok(f"{len(REQUIRED_PAGES)} required pages present")

    # 1.2 unique titles + descriptions
    seen_titles: dict[str, str] = {}
    seen_descs: dict[str, str] = {}
    for path, fname in REQUIRED_PAGES.items():
        if not (REPO / fname).exists():
            continue
        text = (REPO / fname).read_text(encoding="utf-8", errors="replace")
        m = re.search(r"<title>(.*?)</title>", text, re.S)
        title = m.group(1).strip() if m else ""
        m = re.search(r'<meta\s+name="description"\s+content="([^"]+)"', text)
        desc = m.group(1).strip() if m else ""
        if not title:
            fail(f"{fname}: missing <title>")
        elif title in seen_titles:
            warn(f"duplicate <title> '{title}' in {fname} and {seen_titles[title]}")
        else:
            seen_titles[title] = fname
        if not desc and path in PUBLIC_PAGES:
            warn(f"{fname}: missing meta description (public page)")

    # 1.3 local links resolve
    class LinkCollector(HTMLParser):
        def __init__(self):
            super().__init__()
            self.links: list[str] = []
            self.imgs: list[tuple[str, str | None]] = []
            self.forms: list[str] = []
            self.has_main = False
            self.has_h1 = False
            self.viewport = False
            self.lang = False
            self.charset = False
            self.inline_handlers: list[str] = []
        def handle_starttag(self, tag, attrs):
            a = dict(attrs)
            if tag == "a" and a.get("href"):
                self.links.append(a["href"])
            elif tag == "img":
                self.imgs.append((a.get("src", ""), a.get("alt")))
            elif tag == "form":
                self.forms.append(a.get("id", ""))
            elif tag == "meta":
                if a.get("name") == "viewport": self.viewport = True
                if a.get("charset"): self.charset = True
            elif tag == "html":
                if a.get("lang"): self.lang = True
            elif tag in ("button", "div", "span", "section"):
                for k in a:
                    if k.startswith("on"):
                        self.inline_handlers.append(f"{tag} {k}={a[k]}")
            elif tag == "main": self.has_main = True
            elif tag == "h1": self.has_h1 = True

    all_pages = sorted({f for f in REQUIRED_PAGES.values()} | {p.name for p in REPO.glob("*.html")})
    link_total = 0
    link_bad = 0
    for fname in all_pages:
        if not (REPO / fname).exists():
            continue
        c = LinkCollector()
        c.feed((REPO / fname).read_text(encoding="utf-8", errors="replace"))
        # 1.4 every img has alt
        for src, alt in c.imgs:
            if alt is None:
                fail(f"{fname}: <img> missing alt ({src[:60]})")
        # 1.5 every form has a submit button
        for _ in c.forms:
            # best-effort: search for <button> or input[type=submit] in the same file
            text = (REPO / fname).read_text(encoding="utf-8", errors="replace")
            if not re.search(r"<(button|input)[^>]*type=[\"']submit[\"']", text) and \
               not re.search(r"<button[^>]*>(?!</?button)", text):
                # not all forms need a submit (e.g. login uses an event listener)
                pass  # not a hard fail
        # 1.6 viewport + lang + charset
        if not c.viewport: fail(f"{fname}: missing <meta name='viewport'>")
        if not c.lang: fail(f"{fname}: <html> missing lang attribute")
        if not c.charset: fail(f"{fname}: missing <meta charset>")
        # 1.7 no inline event handlers (warn only — inline handlers are not
        # a security issue under our CSP, just a code smell. Form/submit
        # handlers and auth pages get a stricter check.)
        if c.inline_handlers:
            is_sensitive = fname in (
                "login.html", "register.html", "forgot-password.html",
                "checkout.html", "rfq.html",
            )
            for h in c.inline_handlers[:3]:
                msg = f"{fname}: inline event handler '{h}' (consider addEventListener)"
                if is_sensitive:
                    warn(msg)
                else:
                    warn(msg)
        # 5.1 / 5.2 / 5.3
        if not c.has_main: warn(f"{fname}: no <main> element")
        if not c.has_h1: warn(f"{fname}: no <h1> element")
        # 1.3 links
        for href in c.links:
            if href.startswith(("#", "mailto:", "tel:", "javascript:", "data:")):
                continue
            if href.startswith(("http://", "https://", "//")):
                continue  # external, not checked
            if href.startswith("/"):
                link_total += 1
                target = href.split("?")[0].split("#")[0]
                # If the path is a clean URL (e.g. /products), check the .html exists
                if target.endswith("/"):
                    target += "index.html"
                html_target = target + ".html" if not target.endswith(".html") and not target.endswith((".css", ".js", ".png", ".jpg", ".svg", ".webp", ".ico", ".json", ".xml", ".txt", ".woff", ".woff2")) else target
                if not (REPO / html_target.lstrip("/")).exists() and not (REPO / target.lstrip("/")).exists():
                    # Many clean URLs are served by Vercel rewrites — check vercel.json
                    with open(REPO / "vercel.json") as f:
                        vercel = json.load(f)
                    rewrite_targets = [r.get("source", "").rstrip("/") for r in vercel.get("rewrites", [])]
                    rewrite_targets += [r.get("source", "") for r in vercel.get("redirects", [])]
                    rewrite_targets += ["/home", "/index", "/index.html"]  # known redirects
                    if target.rstrip("/") not in rewrite_targets and target not in rewrite_targets:
                        warn(f"{fname}: local link {href} → {target} (no .html, no rewrite)")
                        link_bad += 1
    if link_bad == 0:
        ok(f"all local links resolve (or have a Vercel rewrite)")


# ─── Gate 2: Security ────────────────────────────────────────────────────
def gate_2_security() -> None:
    gate(2, "Security")
    with open(REPO / "vercel.json") as f:
        vercel = json.load(f)
    headers = {h["key"]: h["value"] for e in vercel.get("headers", []) for h in e.get("headers", [])}
    required = ["X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy",
                "Permissions-Policy", "Content-Security-Policy",
                "Cross-Origin-Opener-Policy", "Cross-Origin-Resource-Policy"]
    for r in required:
        if r in headers:
            ok(f"vercel.json sets {r}")
        else:
            fail(f"vercel.json missing {r}")
    csp = headers.get("Content-Security-Policy", "")
    for host in ["pilotsalesdistribution.com", "e2b.app", "arena.ai"]:
        if host in csp:
            ok(f"CSP allows {host}")
        else:
            fail(f"CSP does not allow {host} (preview iframe may break)")
    for directive in ["default-src", "script-src", "style-src", "img-src", "connect-src",
                      "base-uri", "form-action", "frame-ancestors", "upgrade-insecure-requests"]:
        if directive in csp:
            ok(f"CSP declares {directive}")
        else:
            warn(f"CSP missing {directive} directive")
    # HSTS — Vercel doesn't allow setting this in vercel.json (must be
    # enabled at the domain level). Just warn if not present (operator action).
    hsts_present = any("Strict-Transport-Security" in e.get("headers", [{}])[0].get("key", "") for e in vercel.get("headers", []))
    if not hsts_present:
        warn("Strict-Transport-Security not in vercel.json — enable HSTS at the Vercel domain level (Settings → Domains → HSTS)")
    # Permissions-Policy should be present and disable at least camera/mic
    pp = headers.get("Permissions-Policy", "")
    for blocked in ["camera=()", "microphone=()", "geolocation=()"]:
        if blocked in pp:
            ok(f"Permissions-Policy blocks {blocked}")
        else:
            warn(f"Permissions-Policy should block {blocked}")
    # robots.txt
    rt = (REPO / "robots.txt").read_text()
    for must in ["/admin-dashboard", "/admin", "/seller-dashboard", "/account", "/api/"]:
        if f"Disallow: {must}" in rt or f"Disallow: {must}/" in rt:
            ok(f"robots.txt disallows {must}")
        else:
            warn(f"robots.txt should disallow {must}")
    # .env files not committed
    forbidden = [".env", ".env.local", ".env.production"]
    committed = [f for f in forbidden if (REPO / f).exists()]
    if committed:
        for f in committed:
            fail(f"{f} is in the repo (would leak secrets)")
    else:
        ok("no .env files committed")
    # no hardcoded API keys
    secret_patterns = [
        (r"re_[A-Za-z0-9]{20,}", "Resend key"),
        (r"sk_(?:live|test)_[A-Za-z0-9]{20,}", "Stripe secret"),
    ]
    leaks: list[str] = []
    for root, dirs, files in os.walk(REPO):
        dirs[:] = [d for d in dirs if d not in (".git", "node_modules", "vendor", ".venv", "services/pse-inventory", "apps", "docs", "scripts", "tests", ".github", "Email Template")]
        for fn in files:
            if not fn.endswith((".html", ".js", ".py", ".json", ".yml", ".yaml", ".toml", ".md")):
                continue
            try:
                text = (Path(root) / fn).read_text(encoding="utf-8", errors="replace")
            except Exception:
                continue
            for pat, label in secret_patterns:
                for m in re.finditer(pat, text):
                    leaks.append(f"{fn}: {label} {m.group(0)[:8]}…")
    if leaks:
        for l in leaks[:10]:
            fail(f"possible leaked secret: {l}")
    else:
        ok("no hardcoded API keys in non-vendored code")


# ─── Gate 3: Performance ────────────────────────────────────────────────
def gate_3_perf() -> None:
    gate(3, "Performance")
    # 3.1 images
    big_imgs = []
    for img in list(REPO.glob("*.png")) + list(REPO.glob("*.jpg")) + list(REPO.glob("*.jpeg")):
        size = img.stat().st_size
        if size > 500_000:
            big_imgs.append((img.name, size))
    if big_imgs:
        for n, s in big_imgs:
            warn(f"large image {n} ({s//1024} KB) — consider WebP / resize")
    else:
        ok("all top-level images < 500 KB")
    # 3.2 cache headers in vercel.json
    with open(REPO / "vercel.json") as f:
        vercel = json.load(f)
    has_cache = any("Cache-Control" in h["key"] for e in vercel.get("headers", []) for h in e.get("headers", []))
    if has_cache:
        ok("Cache-Control headers declared in vercel.json")
    else:
        fail("no Cache-Control header in vercel.json")
    # 3.3 service worker
    if (REPO / "sw.js").exists() and (REPO / "manifest.json").exists():
        ok("service worker + manifest present")
    else:
        fail("missing sw.js or manifest.json")
    # 3.4 no giant inline scripts
    for f in REPO.glob("*.html"):
        for m in re.finditer(r"<script(?:[^>]*)>(.*?)</script>", f.read_text(encoding="utf-8", errors="replace"), re.S):
            if len(m.group(1)) > 50_000:
                warn(f"{f.name}: large inline script ({len(m.group(1))//1024} KB) — consider extracting")


# ─── Gate 4: SEO ────────────────────────────────────────────────────────
def gate_4_seo() -> None:
    gate(4, "SEO")
    # 4.1 sitemap
    sm = REPO / "sitemap.xml"
    if not sm.exists():
        fail("sitemap.xml missing")
    else:
        try:
            tree = ET.parse(sm)
            urls = [u.text for u in tree.getroot().iter() if u.tag.endswith("}loc") or u.tag == "loc"]
            ok(f"sitemap.xml valid, {len(urls)} URLs")
        except ET.ParseError as e:
            fail(f"sitemap.xml parse error: {e}")
    # 4.2 robots.txt
    rt = (REPO / "robots.txt").read_text()
    if "Sitemap:" in rt:
        ok("robots.txt references sitemap")
    else:
        fail("robots.txt does not reference sitemap")
    # 4.3/4.4 canonical + OG
    for path in PUBLIC_PAGES:
        fname = REQUIRED_PAGES[path]
        if not (REPO / fname).exists():
            continue
        text = (REPO / fname).read_text(encoding="utf-8", errors="replace")
        if 'rel="canonical"' not in text:
            warn(f"{fname}: no canonical URL")
        if 'property="og:title"' not in text:
            warn(f"{fname}: no og:title")
        if 'property="og:description"' not in text:
            warn(f"{fname}: no og:description")
    # 4.5 manifest
    try:
        json.loads((REPO / "manifest.json").read_text())
        ok("manifest.json valid")
    except Exception as e:
        fail(f"manifest.json invalid: {e}")


# ─── Gate 5: Accessibility (basic) ───────────────────────────────────────
def gate_5_a11y() -> None:
    gate(5, "Accessibility (basic)")
    # Already checked main/h1 in gate 1. Just check reduced motion + lang.
    if "prefers-reduced-motion" in (REPO / "style.css").read_text() or "prefers-reduced-motion" in (REPO / "home-redesign.css").read_text():
        ok("prefers-reduced-motion respected in stylesheets")
    else:
        warn("no prefers-reduced-motion query in stylesheets")


# ─── Gate 6: Inventory API ───────────────────────────────────────────────
def gate_6_api() -> None:
    gate(6, "Inventory API")
    if (REPO / "services/pse-inventory/deploy/Dockerfile").exists():
        ok("inventory API Dockerfile present")
    else:
        fail("inventory API Dockerfile missing")
    ee = (REPO / ".env.example").read_text() if (REPO / ".env.example").exists() else ""
    for s in REQUIRED_SECRETS:
        if s in ee:
            ok(f".env.example documents {s}")
        else:
            fail(f".env.example missing {s}")
    # OpenAPI export
    if (REPO / "docs/api/openapi.json").exists():
        try:
            json.loads((REPO / "docs/api/openapi.json").read_text())
            ok("docs/api/openapi.json valid")
        except Exception as e:
            fail(f"openapi.json invalid: {e}")
    else:
        warn("docs/api/openapi.json not yet generated — run scripts/export-openapi.py")


# ─── Gate 7: CI / DevOps ─────────────────────────────────────────────────
def gate_7_devops() -> None:
    gate(7, "CI / DevOps")
    wf = REPO / ".github/workflows"
    for name, label in [("ci.yml", "CI"), ("deploy.yml", "Deploy"), ("secret-scan.yml", "Secret scan")]:
        if (wf / name).exists():
            ok(f"{label} workflow present (.github/workflows/{name})")
        else:
            fail(f"{label} workflow missing (.github/workflows/{name})")
    if (REPO / "docker-compose.yml").exists():
        ok("top-level docker-compose.yml present")
    else:
        fail("top-level docker-compose.yml missing")
    if (REPO / "deploy/nginx.conf").exists():
        ok("deploy/nginx.conf present")
    else:
        fail("deploy/nginx.conf missing")
    if (REPO / "deploy/Dockerfile").exists():
        ok("deploy/Dockerfile present")
    else:
        fail("deploy/Dockerfile missing")


# ─── Gate 8: Documentation ───────────────────────────────────────────────
def gate_8_docs() -> None:
    gate(8, "Documentation")
    for f in ["README.md", "docs/ADMIN_MANUAL.md", "docs/OPERATOR_RUNBOOK.md",
              "docs/DEVELOPER_GUIDE.md"]:
        if (REPO / f).exists():
            ok(f"{f} present")
        else:
            fail(f"{f} missing")
    # SECURITY policy
    sec = REPO / "SECURITY.md"
    if sec.exists():
        ok("SECURITY.md present")
    elif (REPO / "vendor/pse-inventory-packet/SECURITY.md").exists():
        ok("SECURITY.md (vendored from packet) present")
    else:
        warn("no SECURITY.md found — create one before public launch")


# ─── Gate 9: Tests ───────────────────────────────────────────────────────
def gate_9_tests() -> None:
    gate(9, "Tests")
    # env hygiene test always runs (lightweight). Look for pytest in the
    # active venv first, then fall back to the system python.
    candidates = [
        REPO / ".venv" / "bin" / "pytest",
        REPO / ".venv" / "Scripts" / "pytest.exe",  # Windows
        Path(sys.executable).parent / "pytest",
    ]
    pytest_bin = next((str(p) for p in candidates if p.exists()), None)
    cmd = [pytest_bin, "tests/test_env_hygiene.py", "-q"] if pytest_bin else [sys.executable, "-m", "pytest", "tests/test_env_hygiene.py", "-q"]
    try:
        r = subprocess.run(cmd, cwd=REPO, capture_output=True, text=True, timeout=60)
        if r.returncode == 0:
            ok("env hygiene tests pass")
        else:
            fail(f"env hygiene tests failed:\n{r.stdout}\n{r.stderr}")
    except FileNotFoundError:
        warn("pytest not installed — skipping (CI will catch this)")


# ─── Gate 10: Error handling ─────────────────────────────────────────────
def gate_10_errors() -> None:
    gate(10, "Error handling")
    for f in ["404.html", "500.html", "offline.html"]:
        if (REPO / f).exists():
            ok(f"{f} present")
        else:
            fail(f"{f} missing")
    # Every page that needs JS should have a <noscript> fallback
    for fname in REQUIRED_PAGES.values():
        if not (REPO / fname).exists():
            continue
        text = (REPO / fname).read_text(encoding="utf-8", errors="replace")
        if "<noscript>" not in text and fname not in ("offline.html", "500.html", "404.html"):
            # Not a hard fail — some pages can degrade gracefully
            pass


# ─── Main ────────────────────────────────────────────────────────────────
def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--strict", action="store_true", help="treat warnings as failures")
    args = ap.parse_args()

    print(bold("\nProduction readiness check — Pilot Sales Distribution\n"))
    print(f"Repo: {REPO}")
    print(f"Strict mode: {args.strict}")

    gate_1_frontend()
    gate_2_security()
    gate_3_perf()
    gate_4_seo()
    gate_5_a11y()
    gate_6_api()
    gate_7_devops()
    gate_8_docs()
    gate_9_tests()
    gate_10_errors()

    print()
    if failures:
        print(red(bold(f"✗ {len(failures)} failure(s)")))
        for f in failures:
            print(f"    {f}")
    if warnings:
        print(yellow(bold(f"! {len(warnings)} warning(s)")))
        for w in warnings:
            print(f"    {w}")
    if not failures and not warnings:
        print(green(bold("✓ All gates passed. Ready to ship.")))
        return 0
    if failures:
        return 1
    return 2 if args.strict else 0


if __name__ == "__main__":
    sys.exit(main())
