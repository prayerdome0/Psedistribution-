"""Bounded SalesMax/Sheets authority export loader.

The source system remains outside the web process. A controlled publisher or
migration job may read a JSON/CSV export from a local file or an HTTPS endpoint
(such as a reviewed Sheets export URL), then pass the exact rows to the
provenance/reconciliation pipeline. The loader never publishes and never
silently fills timestamps or business fields.
"""
from __future__ import annotations

import csv
import io
import json
import time
from pathlib import Path
from typing import Any, Mapping
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

MAX_EXPORT_BYTES = 2 * 1024 * 1024
DEFAULT_TIMEOUT_SECONDS = 15
DEFAULT_RETRIES = 3


class AuthorityExportError(ValueError):
    pass


def _as_rows(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, list) and all(isinstance(row, Mapping) for row in value):
        return [dict(row) for row in value]
    if isinstance(value, dict):
        for key in ("items", "data", "records", "rows"):
            candidate = value.get(key)
            if isinstance(candidate, list) and all(isinstance(row, Mapping) for row in candidate):
                return [dict(row) for row in candidate]
        values = value.get("values")
        if isinstance(values, list) and values and all(isinstance(row, list) for row in values):
            headers = [str(header).strip() for header in values[0]]
            if not headers or any(not header for header in headers) or len(set(headers)) != len(headers):
                raise AuthorityExportError("sheet export headers must be non-empty and unique")
            return [dict(zip(headers, row)) for row in values[1:]]
    raise AuthorityExportError("authority export must contain an array of row objects or sheet values")


def parse_export(body: bytes, *, format_hint: str | None = None) -> list[dict[str, Any]]:
    if not isinstance(body, bytes) or len(body) > MAX_EXPORT_BYTES:
        raise AuthorityExportError("authority export exceeds the 2 MiB safety limit")
    hint = (format_hint or "").lower().lstrip(".")
    text = body.decode("utf-8-sig")
    if hint == "csv" or (hint not in {"json", "csv"} and not text.lstrip().startswith(("[", "{"))):
        reader = csv.DictReader(io.StringIO(text))
        if not reader.fieldnames:
            raise AuthorityExportError("CSV export has no header row")
        rows = [dict(row) for row in reader]
    else:
        try:
            rows = _as_rows(json.loads(text))
        except json.JSONDecodeError as exc:
            raise AuthorityExportError("authority export is not valid JSON") from exc
    if not rows:
        raise AuthorityExportError("authority export is unexpectedly empty")
    return rows


def _read_url(url: str, *, bearer_token: str | None, timeout: int, retries: int) -> bytes:
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.netloc:
        raise AuthorityExportError("remote authority exports must use HTTPS")
    headers = {"Accept": "application/json, text/csv", "User-Agent": "pse-inventory-authority-loader/4.0"}
    if bearer_token:
        headers["Authorization"] = "Bearer " + bearer_token
    request = Request(url, headers=headers, method="GET")
    for attempt in range(max(1, retries)):
        try:
            with urlopen(request, timeout=timeout) as response:
                body = response.read(MAX_EXPORT_BYTES + 1)
                if len(body) > MAX_EXPORT_BYTES:
                    raise AuthorityExportError("authority export exceeds the 2 MiB safety limit")
                return body
        except HTTPError as exc:
            retryable = exc.code == 429 or 500 <= exc.code <= 599
            if not retryable or attempt + 1 >= retries:
                raise AuthorityExportError(f"authority export request failed with HTTP {exc.code}") from exc
            retry_after = exc.headers.get("Retry-After", "")
            try:
                delay = min(float(retry_after), 8.0)
            except (TypeError, ValueError):
                delay = min(2 ** attempt, 8)
            time.sleep(max(0.0, delay))
        except (URLError, TimeoutError, OSError) as exc:
            if attempt + 1 >= retries:
                raise AuthorityExportError("authority export request failed") from exc
            time.sleep(min(2 ** attempt, 8))
    raise AuthorityExportError("authority export request failed")


def load_export(
    source: str | Path,
    *,
    bearer_token: str | None = None,
    timeout: int = DEFAULT_TIMEOUT_SECONDS,
    retries: int = DEFAULT_RETRIES,
    format_hint: str | None = None,
) -> list[dict[str, Any]]:
    value = str(source)
    parsed = urlparse(value)
    if parsed.scheme:
        if parsed.scheme != "https":
            raise AuthorityExportError("authority export URLs must use HTTPS")
        body = _read_url(value, bearer_token=bearer_token, timeout=timeout, retries=retries)
        hint = format_hint or Path(parsed.path).suffix
    else:
        path = Path(value)
        try:
            body = path.read_bytes()
        except OSError as exc:
            raise AuthorityExportError(f"authority export cannot be read: {path}") from exc
        if len(body) > MAX_EXPORT_BYTES:
            raise AuthorityExportError("authority export exceeds the 2 MiB safety limit")
        hint = format_hint or path.suffix
    return parse_export(body, format_hint=hint)
