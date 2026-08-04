"""LOCAL PREVIEW HARNESS — not a production topology.

Serves the buyer-safe inventory API and the existing static storefront from one
process so the wiring can be inspected end-to-end:

- GET /api/inventory, /api/inventory/{slug}, /internal/*  (the real API)
- /products -> products.html, /product/* -> product-detail.html (site rewrites)
- everything else is served from the repository root

Production keeps the packet's boundary: site on the hosting provider, API as a
separate service behind Caddy with TLS (see deploy/). Preview secrets are
generated per process and logged as preview-only.
"""
from __future__ import annotations

import os
import secrets
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware

from .api import create_app
from .settings import AppSettings

REPO_ROOT = Path(__file__).resolve().parents[3]
SERVICE = Path(__file__).resolve().parents[1]

CLEAN_URL_PAGES = (
    "rfq", "cart", "checkout", "login", "register", "account", "about",
    "contact", "help-center", "track-order", "wishlist", "catalogs",
    "become-seller", "admin-dashboard", "seller-dashboard", "buyer-dashboard",
    "chat", "verify", "privacy", "terms", "supplier-store", "supplier-verification",
    "order-success",
)
REWRITES = (
    ("/product", "/product-detail.html"),
    ("/products", "/products.html"),
) + tuple((f"/{page}", f"/{page}.html") for page in CLEAN_URL_PAGES)


class SiteRewriteMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        path = request.url.path
        if not path.startswith(("/api/", "/internal/")):
            for prefix, target in REWRITES:
                if path == prefix or path.startswith(prefix + "/"):
                    request.scope["path"] = target
                    break
        return await call_next(request)


def build_preview_app() -> FastAPI:
    cursor_secret = os.environ.get("PSE_CURSOR_SECRET") or secrets.token_urlsafe(48)
    hmac_keys_env = os.environ.get("PSE_REVALIDATION_KEYS_JSON")
    if hmac_keys_env:
        import json

        hmac_keys = json.loads(hmac_keys_env)
    else:
        hmac_keys = {"preview-key": secrets.token_urlsafe(48)}
        print("[preview] generated preview-only HMAC key ring (key id: preview-key)")
    settings = AppSettings(
        snapshot_file=Path(os.environ.get("PSE_SNAPSHOT_FILE", str(SERVICE / "data" / "current.json"))),
        packet_root=REPO_ROOT / "vendor" / "pse-inventory-packet",
        cursor_secret=cursor_secret,
        hmac_keys=hmac_keys,
        allowed_origins=("*",),
        max_last_good_age_seconds=int(os.environ.get("PSE_MAX_LAST_GOOD_AGE_SECONDS", "3600")),
        rate_limit_per_minute=int(os.environ.get("PSE_RATE_LIMIT_PER_MINUTE", "600")),
    )
    app = create_app(settings)
    app.add_middleware(SiteRewriteMiddleware)
    app.mount("/", StaticFiles(directory=str(REPO_ROOT), html=True), name="site")
    return app


app = build_preview_app()
