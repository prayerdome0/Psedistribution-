"""Runnable, open-source FastAPI reference for PSE public inventory v4.0.0."""
from __future__ import annotations

import hashlib
import json
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping

from fastapi import FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest

from .cursor import CursorError, CursorSigner
from .rate_limit import FixedWindowRateLimiter
from .runtime_core import load_revalidation_module
from .snapshot_repository import SnapshotRepository, SnapshotUnavailable

CONTRACT_VERSION = "4.0.0"
REQUESTS = Counter("pse_inventory_http_requests_total", "Inventory API requests", ["path", "status"])
LATENCY = Histogram("pse_inventory_http_request_seconds", "Inventory API request latency", ["path"])
SNAPSHOT_RECORDS = Gauge("pse_inventory_snapshot_records", "Records in current validated public snapshot")
REVALIDATIONS = Counter("pse_inventory_revalidations_total", "Signed revalidation attempts", ["result"])


@dataclass(frozen=True)
class AppSettings:
    snapshot_file: Path
    packet_root: Path
    cursor_secret: str
    hmac_keys: Mapping[str, str]
    allowed_origins: tuple[str, ...]
    max_last_good_age_seconds: int = 300
    rate_limit_per_minute: int = 120

    def __post_init__(self) -> None:
        if len(self.cursor_secret.encode("utf-8")) < 32:
            raise ValueError("cursor_secret must be at least 32 bytes")
        if not self.hmac_keys or any(len(value.encode("utf-8")) < 16 for value in self.hmac_keys.values()):
            raise ValueError("each HMAC key must be at least 16 bytes")


def _canonical(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def _etag(value: Any) -> str:
    return '"sha256:' + hashlib.sha256(_canonical(value)).hexdigest() + '"'


def _fingerprint(*, q: str | None, category: str | None, status: str | None, limit: int) -> str:
    return hashlib.sha256(_canonical({"q": q or "", "category": category or "", "status": status or "", "limit": limit})).hexdigest()


def _error(request: Request, status_code: int, code: str, message: str, *, headers: dict[str, str] | None = None) -> JSONResponse:
    request_id = getattr(request.state, "request_id", "unknown-request")
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message}, "requestId": request_id},
        headers=headers,
    )


def _now(app: FastAPI) -> datetime:
    value = app.state.clock()
    if not isinstance(value, datetime) or value.tzinfo is None:
        raise RuntimeError("application clock must return a timezone-aware datetime")
    return value.astimezone(timezone.utc)


def create_app(settings: AppSettings) -> FastAPI:
    app = FastAPI(title="PSE Public Inventory API", version=CONTRACT_VERSION, docs_url=None, redoc_url=None, openapi_url=None)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.allowed_origins),
        allow_methods=["GET", "OPTIONS"],
        allow_headers=["If-None-Match", "Content-Type"],
        expose_headers=["ETag", "X-PSE-Snapshot-Version", "X-Request-Id", "Cache-Control"],
    )
    repository = SnapshotRepository(
        snapshot_file=settings.snapshot_file,
        packet_root=settings.packet_root,
        max_last_good_age_seconds=settings.max_last_good_age_seconds,
    )
    signer = CursorSigner(secret=settings.cursor_secret.encode("utf-8"))
    limiter = FixedWindowRateLimiter(limit=settings.rate_limit_per_minute, window_seconds=60)
    revalidation = load_revalidation_module(settings.packet_root)
    nonce_store = revalidation.NonceStore()
    app.state.settings = settings
    app.state.repository = repository
    app.state.cursor_signer = signer
    app.state.rate_limiter = limiter
    app.state.revalidation = revalidation
    app.state.nonce_store = nonce_store
    app.state.clock = lambda: datetime.now(timezone.utc)

    @app.middleware("http")
    async def request_controls(request: Request, call_next):
        request.state.request_id = request.headers.get("X-Request-Id") or uuid.uuid4().hex
        started = time.perf_counter()
        public_path = request.url.path.startswith("/api/inventory")
        if public_path and request.method != "OPTIONS":
            client = request.client.host if request.client else "unknown"
            if not limiter.allow(client):
                response = _error(request, 429, "RATE_LIMITED", "Request limit exceeded.", headers={"Retry-After": "60"})
                response.headers["X-Request-Id"] = request.state.request_id
                REQUESTS.labels(request.url.path, "429").inc()
                return response
        try:
            response = await call_next(request)
        except Exception:
            response = _error(request, 500, "INTERNAL_ERROR", "The request could not be completed.")
        response.headers["X-Request-Id"] = request.state.request_id
        REQUESTS.labels(request.url.path, str(response.status_code)).inc()
        LATENCY.labels(request.url.path).observe(time.perf_counter() - started)
        return response

    def current_snapshot() -> dict[str, Any]:
        snapshot = repository.refresh_or_last_good()
        SNAPSHOT_RECORDS.set(snapshot["recordCount"])
        return snapshot

    def snapshot_headers(snapshot: dict[str, Any], representation: Any) -> dict[str, str]:
        return {
            "ETag": _etag(representation),
            "X-PSE-Snapshot-Version": snapshot["snapshotVersion"],
            "Cache-Control": "public, max-age=60, stale-if-error=240",
        }

    @app.get("/api/inventory")
    async def list_inventory(
        request: Request,
        q: str | None = Query(default=None, min_length=1, max_length=100),
        category: str | None = Query(default=None, max_length=80),
        status: str | None = Query(default=None, pattern="^(available|limited|confirm-availability)$"),
        limit: int = Query(default=24, ge=1, le=100),
        cursor: str | None = Query(default=None, min_length=1, max_length=2048),
    ):
        try:
            snapshot = current_snapshot()
        except SnapshotUnavailable:
            return _error(request, 503, "INVENTORY_UNAVAILABLE", "Inventory is temporarily unavailable.")
        fingerprint = _fingerprint(q=q, category=category, status=status, limit=limit)
        offset = 0
        if cursor:
            try:
                offset = signer.decode(cursor, snapshot_version=snapshot["snapshotVersion"], query_fingerprint=fingerprint).offset
            except CursorError:
                return _error(request, 400, "INVALID_CURSOR", "The pagination cursor is invalid.")
        rows = list(snapshot["items"])
        if q:
            needle = q.casefold()
            rows = [row for row in rows if needle in " ".join(str(row.get(key, "")) for key in ("title", "shortDescription", "brand", "dealId")).casefold()]
        if category:
            rows = [row for row in rows if row.get("category") == category]
        if status:
            rows = [row for row in rows if row.get("status") == status]
        rows.sort(key=lambda row: (row["dealId"], row["slug"]))
        total = len(rows)
        page = rows[offset: offset + limit]
        next_offset = offset + len(page)
        next_cursor = None
        if next_offset < total:
            next_cursor = signer.encode(offset=next_offset, snapshot_version=snapshot["snapshotVersion"], query_fingerprint=fingerprint)
        body = {
            "data": page,
            "meta": {
                "totalCount": total,
                "pageCount": len(page),
                "generatedAt": snapshot["generatedAt"],
                "snapshotVersion": snapshot["snapshotVersion"],
                "sourceVersion": snapshot["sourceVersion"],
                "freshness": repository.freshness,
                "nextCursor": next_cursor,
            },
        }
        headers = snapshot_headers(snapshot, body)
        if request.headers.get("If-None-Match") == headers["ETag"]:
            return Response(status_code=304, headers=headers)
        return JSONResponse(content=body, headers=headers)

    @app.get("/api/inventory/{slug}")
    async def inventory_detail(request: Request, slug: str):
        try:
            snapshot = current_snapshot()
        except SnapshotUnavailable:
            return _error(request, 503, "INVENTORY_UNAVAILABLE", "Inventory is temporarily unavailable.")
        item = next((row for row in snapshot["items"] if row.get("slug") == slug), None)
        if item is None:
            return _error(request, 404, "ITEM_NOT_FOUND", "The inventory item is not published.")
        headers = snapshot_headers(snapshot, item)
        if request.headers.get("If-None-Match") == headers["ETag"]:
            return Response(status_code=304, headers=headers)
        return JSONResponse(content=item, headers=headers)

    @app.post("/api/internal/inventory/revalidate")
    async def revalidate_inventory(request: Request):
        body = await request.body()
        signed_headers = {
            name: request.headers.get(name, "")
            for name in ("X-PSE-Key-Id", "X-PSE-Timestamp", "X-PSE-Nonce", "X-PSE-Content-SHA256", "X-PSE-Signature")
        }
        try:
            revalidation.verify_request(
                secrets={key: value.encode("utf-8") for key, value in settings.hmac_keys.items()},
                headers=signed_headers,
                body=body,
                now=_now(app),
                nonce_store=nonce_store,
            )
        except revalidation.RevalidationError as exc:
            message = str(exc).lower()
            if "replay" in message:
                REVALIDATIONS.labels("replay").inc()
                return _error(request, 409, "NONCE_REPLAY", "The signed request nonce has already been used.")
            REVALIDATIONS.labels("rejected").inc()
            return _error(request, 401, "INVALID_SIGNATURE", "The signed request could not be verified.")
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            REVALIDATIONS.labels("invalid_body").inc()
            return _error(request, 400, "INVALID_BODY", "The request body is invalid.")
        if not isinstance(payload, dict) or set(payload) != {"runId", "releaseId", "sourceVersion", "snapshotVersion", "publishedAt"}:
            REVALIDATIONS.labels("invalid_body").inc()
            return _error(request, 400, "INVALID_BODY", "The request body is invalid.")
        try:
            snapshot = repository.load()
        except SnapshotUnavailable:
            REVALIDATIONS.labels("unavailable").inc()
            return _error(request, 503, "INVENTORY_UNAVAILABLE", "The candidate snapshot could not be activated.")
        if payload["snapshotVersion"] != snapshot["snapshotVersion"] or payload["sourceVersion"] != snapshot["sourceVersion"]:
            REVALIDATIONS.labels("mismatch").inc()
            return _error(request, 409, "SNAPSHOT_MISMATCH", "The request does not match the validated snapshot.")
        REVALIDATIONS.labels("accepted").inc()
        return JSONResponse(status_code=202, content={"status": "accepted", "snapshotVersion": snapshot["snapshotVersion"]})

    @app.get("/internal/healthz")
    async def healthz():
        return {"status": "ok", "contractVersion": CONTRACT_VERSION, "timestamp": _now(app).isoformat().replace("+00:00", "Z"), "snapshotVersion": None}

    @app.get("/internal/readyz")
    async def readyz():
        try:
            snapshot = repository.current()
        except SnapshotUnavailable:
            return JSONResponse(status_code=503, content={"status": "unavailable", "contractVersion": CONTRACT_VERSION, "timestamp": _now(app).isoformat().replace("+00:00", "Z"), "snapshotVersion": None, "detail": "validated snapshot unavailable"})
        return {"status": "degraded" if repository.freshness == "degraded" else "ok", "contractVersion": CONTRACT_VERSION, "timestamp": _now(app).isoformat().replace("+00:00", "Z"), "snapshotVersion": snapshot["snapshotVersion"]}

    @app.get("/internal/metrics")
    async def metrics():
        return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

    return app
