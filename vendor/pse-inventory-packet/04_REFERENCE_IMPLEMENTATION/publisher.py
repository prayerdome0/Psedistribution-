#!/usr/bin/env python3
"""Portable fail-closed reference publisher for PSE/SalesMax inventory v4.0.

This is a reference implementation and test harness, not a claim that the live
website or SalesMax runtime has been modified. Public records are constructed
from an allowlist rather than created by deleting private fields.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urlparse

from jsonschema import Draft202012Validator, FormatChecker

SCHEMA_VERSION = "4.0.0"
PUBLISHER_VERSION = "4.0.0"
FRESH_SECONDS = 86_400
UNPUBLISH_SECONDS = 259_200
FUTURE_CLOCK_SKEW_SECONDS = 300
EMPTY_APPROVAL_MAX_AGE_SECONDS = 86_400
PRICE_KEYS = ("publicUnitPrice", "publicCasePrice", "publicLotPrice")
TEXT_KEYS = ("title", "shortDescription", "brand", "fob", "inspectionTerms", "returnTerms")

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
CONTRACTS = ROOT / "03_CONTRACTS"


def _load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


PUBLIC_SCHEMA = _load_json(CONTRACTS / "public_inventory_item.schema.json")
PRIVATE_SCHEMA = _load_json(CONTRACTS / "canonical_inventory_record.schema.json")
SNAPSHOT_SCHEMA = _load_json(CONTRACTS / "public_inventory_snapshot.schema.json")
DENYLIST = _load_json(CONTRACTS / "privacy_field_denylist.json")
PUBLIC_KEYS = frozenset(PUBLIC_SCHEMA["properties"].keys())
FORMAT_CHECKER = FormatChecker()
PUBLIC_VALIDATOR = Draft202012Validator(PUBLIC_SCHEMA, format_checker=FORMAT_CHECKER)
PRIVATE_VALIDATOR = Draft202012Validator(PRIVATE_SCHEMA, format_checker=FORMAT_CHECKER)
RUNTIME_SNAPSHOT_SCHEMA = copy.deepcopy(SNAPSHOT_SCHEMA)
RUNTIME_SNAPSHOT_SCHEMA["properties"]["items"]["items"] = PUBLIC_SCHEMA
SNAPSHOT_VALIDATOR = Draft202012Validator(RUNTIME_SNAPSHOT_SCHEMA, format_checker=FORMAT_CHECKER)
SNAPSHOT_META_SCHEMA = copy.deepcopy(SNAPSHOT_SCHEMA)
SNAPSHOT_META_SCHEMA["properties"]["items"] = {"type": "array", "items": {"type": "object"}}
SNAPSHOT_META_VALIDATOR = Draft202012Validator(SNAPSHOT_META_SCHEMA, format_checker=FORMAT_CHECKER)
PROHIBITED_VALUE_RE = [re.compile(p) for p in DENYLIST["prohibitedValuePatterns"]]


class PublishError(RuntimeError):
    """Fail-closed publication error with a sanitized report."""

    def __init__(self, message: str, report: dict[str, Any] | None = None):
        super().__init__(message)
        self.report = report or {"result": "FAIL", "errors": [message]}


def parse_datetime(value: str) -> datetime:
    if not isinstance(value, str):
        raise ValueError("datetime must be a string")
    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        raise ValueError("datetime must include a timezone")
    return parsed.astimezone(timezone.utc)


def iso_z(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def canonical_json(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sha256_prefixed(value: Any) -> str:
    return "sha256:" + hashlib.sha256(canonical_json(value)).hexdigest()


def _record_version_payload(record: dict[str, Any]) -> dict[str, Any]:
    """Return the exact publish-relevant private state an approval authorizes.

    Approval metadata and private commercial terms are excluded to avoid circular
    hashes and to keep price-floor/supplier edits from needlessly invalidating a
    public approval. Every field that can change public truth, eligibility, or
    quantity is included.
    """
    audit = record.get("audit") if isinstance(record.get("audit"), dict) else {}
    return {
        "schemaVersion": record.get("schemaVersion"),
        "dealId": record.get("dealId"),
        "canonicalProductId": record.get("canonicalProductId"),
        "status": record.get("status"),
        "reviewStatus": record.get("reviewStatus"),
        "publishApproved": record.get("publishApproved"),
        "publishBlockers": record.get("publishBlockers"),
        "source": record.get("source"),
        "inventory": record.get("inventory"),
        "publicProfile": record.get("publicProfile"),
        "recordUpdatedAt": audit.get("recordUpdatedAt"),
    }


def compute_record_version(record: dict[str, Any]) -> str:
    """Compute the immutable approval identity for one canonical record."""
    return sha256_prefixed(_record_version_payload(record))


def _jsonschema_messages(validator: Draft202012Validator, value: Any) -> list[str]:
    """Return deterministic, value-sanitized schema errors.

    Raw jsonschema messages can echo an entire invalid object, which is unsafe for
    private inventory records and noisy for operator reports. This formatter
    exposes the path and failed rule without echoing field values.
    """
    errors = sorted(validator.iter_errors(value), key=lambda e: tuple(str(p) for p in e.absolute_path))
    messages: list[str] = []
    for error in errors:
        path = ".".join(str(p) for p in error.absolute_path) or "$"
        rule = error.validator
        if rule == "required":
            detail = error.message
        elif rule == "additionalProperties":
            detail = error.message
        elif rule == "pattern":
            detail = "does not match required pattern"
        elif rule == "format":
            detail = f"invalid {error.validator_value} format"
        elif rule in {"anyOf", "oneOf", "allOf", "not"}:
            detail = "failed conditional validation"
        elif rule == "enum":
            detail = "value is not in the allowed set"
        elif rule == "const":
            detail = "value does not equal the required constant"
        elif rule == "type":
            detail = f"invalid type; expected {error.validator_value}"
        elif rule in {"minimum", "exclusiveMinimum", "maximum", "exclusiveMaximum", "minLength", "maxLength", "minItems", "maxItems"}:
            detail = f"failed {rule} constraint"
        else:
            detail = f"validation failed ({rule})"
        messages.append(f"{path}: {detail}")
    return messages


def _walk_items(value: Any, path: str = "$") -> Iterable[tuple[str, str, Any]]:
    if isinstance(value, dict):
        for key, child in value.items():
            child_path = f"{path}.{key}"
            yield child_path, str(key), child
            yield from _walk_items(child, child_path)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from _walk_items(child, f"{path}[{index}]")


def privacy_scan(public_record: dict[str, Any]) -> list[str]:
    exact = {k.lower() for k in DENYLIST["prohibitedExactKeys"]}
    fragments = [f.lower() for f in DENYLIST["prohibitedKeyFragments"]]
    findings: list[str] = []
    for path, key, value in _walk_items(public_record):
        lowered = key.lower()
        if lowered in exact or any(fragment in lowered for fragment in fragments):
            findings.append(path)
        if isinstance(value, str) and any(pattern.search(value) for pattern in PROHIBITED_VALUE_RE):
            findings.append(path + "(sensitive-value-pattern)")
    return sorted(set(findings))


def validate_gtin(value: str) -> bool:
    if not isinstance(value, str) or len(value) not in {8, 12, 13, 14} or not value.isdigit():
        return False
    digits = [int(d) for d in value]
    body, check = digits[:-1], digits[-1]
    total = 0
    for index, digit in enumerate(reversed(body), start=1):
        total += digit * (3 if index % 2 == 1 else 1)
    return ((10 - total % 10) % 10) == check


def _safe_text(value: Any) -> bool:
    if not isinstance(value, str):
        return True
    if "<" in value or ">" in value:
        return False
    return not any(ord(ch) < 32 and ch not in "\t\n\r" for ch in value)


def _is_https_url(value: Any, allowed_hosts: set[str] | None = None) -> bool:
    if not isinstance(value, str):
        return False
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.password:
        return False
    if allowed_hosts is not None and parsed.hostname not in allowed_hosts:
        return False
    return True


def _validate_empty_authorization(value: Any, now: datetime) -> tuple[bool, str | None]:
    if not isinstance(value, dict):
        return False, None
    required = {"authorizationId", "reason", "approvers"}
    if set(value) != required:
        return False, None
    if not isinstance(value["authorizationId"], str) or not value["authorizationId"].strip():
        return False, None
    if not isinstance(value["reason"], str) or len(value["reason"].strip()) < 10:
        return False, None
    approvers = value["approvers"]
    if not isinstance(approvers, list) or len(approvers) < 2:
        return False, None
    ids: set[str] = set()
    for approver in approvers:
        if not isinstance(approver, dict) or set(approver) != {"id", "approvedAt"}:
            return False, None
        if not isinstance(approver["id"], str) or not approver["id"].strip():
            return False, None
        try:
            approved_at = parse_datetime(approver["approvedAt"])
        except (TypeError, ValueError):
            return False, None
        age = (now - approved_at).total_seconds()
        if age < -FUTURE_CLOCK_SKEW_SECONDS or age > EMPTY_APPROVAL_MAX_AGE_SECONDS:
            return False, None
        ids.add(approver["id"].strip().lower())
    if len(ids) < 2:
        return False, None
    return True, value["authorizationId"]


def _validate_private(record: dict[str, Any], now: datetime, allowed_media_hosts: set[str] | None) -> list[str]:
    issues: list[str] = []
    inventory = record.get("inventory", {})
    profile = record.get("publicProfile", {})
    source = record.get("source", {})
    audit = record.get("audit", {})

    on_hand = inventory.get("onHandUnits")
    reserved = inventory.get("reservedUnits")
    ats = inventory.get("availableToSell")
    if all(isinstance(v, int) for v in (on_hand, reserved, ats)):
        expected = on_hand - reserved
        if ats != expected:
            issues.append(f"inventory.availableToSell: expected onHandUnits - reservedUnits = {expected}, got {ats}")
        if reserved > on_hand:
            issues.append("inventory.reservedUnits: cannot exceed onHandUnits")

    moq_units = profile.get("moqUnits")
    if isinstance(moq_units, int) and isinstance(ats, int) and moq_units > ats:
        issues.append("publicProfile.moqUnits: cannot exceed inventory.availableToSell")
    moq_cases = profile.get("moqCases")
    cases = inventory.get("casesAvailable")
    if isinstance(moq_cases, int):
        if not isinstance(cases, int):
            issues.append("publicProfile.moqCases: requires inventory.casesAvailable")
        elif moq_cases > cases:
            issues.append("publicProfile.moqCases: cannot exceed inventory.casesAvailable")
    units_per_case = inventory.get("unitsPerCase")
    if all(isinstance(v, int) for v in (cases, units_per_case, on_hand)) and cases * units_per_case > on_hand:
        issues.append("inventory.casesAvailable: casesAvailable * unitsPerCase cannot exceed onHandUnits")

    quantity_mode = profile.get("quantityMode")
    quantity_range = profile.get("quantityRange")
    if quantity_mode == "range":
        if not isinstance(quantity_range, dict):
            issues.append("publicProfile.quantityRange: range mode requires minimum and maximum")
        else:
            minimum = quantity_range.get("minimum")
            maximum = quantity_range.get("maximum")
            if not all(isinstance(v, int) for v in (minimum, maximum)):
                issues.append("publicProfile.quantityRange: minimum and maximum must be integers")
            else:
                if minimum > maximum:
                    issues.append("publicProfile.quantityRange: minimum cannot exceed maximum")
                if isinstance(ats, int) and maximum > ats:
                    issues.append("publicProfile.quantityRange: maximum cannot exceed inventory.availableToSell")
                if isinstance(moq_units, int) and maximum < moq_units:
                    issues.append("publicProfile.quantityRange: maximum cannot be below publicProfile.moqUnits")
    elif quantity_mode == "exact" and quantity_range is not None:
        issues.append("publicProfile.quantityRange: exact mode cannot carry a quantity range")
    elif quantity_mode == "confirm":
        if quantity_range is not None:
            issues.append("publicProfile.quantityRange: confirm mode cannot carry a quantity range")
        if profile.get("pricingMode") != "rfq":
            issues.append("publicProfile.quantityMode: confirm mode requires RFQ pricing")

    for key in TEXT_KEYS:
        if key in profile and not _safe_text(profile[key]):
            issues.append(f"publicProfile.{key}: markup/control characters are prohibited")
        if isinstance(profile.get(key), str) and any(pattern.search(profile[key]) for pattern in PROHIBITED_VALUE_RE):
            issues.append(f"publicProfile.{key}: sensitive internal wording is prohibited")

    upc = profile.get("upc")
    if upc is not None and not validate_gtin(upc):
        issues.append("publicProfile.upc: GTIN check digit is invalid")

    for url in profile.get("imageUrls", []) if isinstance(profile.get("imageUrls"), list) else []:
        if not _is_https_url(url, allowed_media_hosts):
            issues.append("publicProfile.imageUrls: every image must use approved HTTPS media hosting")
    if profile.get("specSheetUrl") is not None and not _is_https_url(profile.get("specSheetUrl"), allowed_media_hosts):
        issues.append("publicProfile.specSheetUrl: must use approved HTTPS media hosting")

    mode = profile.get("pricingMode")
    present_prices = [key for key in PRICE_KEYS if key in profile]
    if mode == "rfq" and present_prices:
        issues.append("publicProfile.pricingMode: RFQ mode cannot carry public pricing fields")
    if mode == "public" and len(present_prices) != 1:
        issues.append("publicProfile.pricingMode: public mode requires exactly one positive public price")

    verified_at = confirmed_at = expires_at = updated_at = None
    try:
        verified_at = parse_datetime(source.get("lastSourceVerifiedAt"))
        confirmed_at = parse_datetime(source.get("lastAvailabilityConfirmedAt"))
        expires_at = parse_datetime(source.get("availabilityExpiresAt"))
        updated_at = parse_datetime(audit.get("recordUpdatedAt"))
        for label, timestamp in (("lastSourceVerifiedAt", verified_at), ("lastAvailabilityConfirmedAt", confirmed_at), ("recordUpdatedAt", updated_at)):
            if (timestamp - now).total_seconds() > FUTURE_CLOCK_SKEW_SECONDS:
                issues.append(f"freshness: {label} is too far in the future")
        age_seconds = (now - confirmed_at).total_seconds()
        if age_seconds > UNPUBLISH_SECONDS:
            issues.append("freshness: availability confirmation is older than the 72-hour publication window")
        if expires_at <= now:
            issues.append("freshness: availabilityExpiresAt is not after publication time")
        if expires_at <= confirmed_at:
            issues.append("freshness: availabilityExpiresAt must be after lastAvailabilityConfirmedAt")
    except (TypeError, ValueError) as exc:
        issues.append(f"freshness: invalid timestamp ({exc})")

    issues.extend(_jsonschema_messages(PRIVATE_VALIDATOR, record))

    # Approval/version checks are deliberately last so operators first receive
    # the underlying data defect that also invalidated the approval.
    expected_record_version = compute_record_version(record)
    if record.get("recordVersion") != expected_record_version:
        issues.append("recordVersion: does not match the current publish-relevant record content")
    if record.get("publishApproved") is True:
        approval = record.get("publishApproval")
        if not isinstance(approval, dict):
            issues.append("publishApproval: approved records require approval metadata")
        else:
            if approval.get("approvalVersion") != record.get("recordVersion"):
                issues.append("publishApproval.approvalVersion: must equal the exact current recordVersion")
            try:
                approved_at = parse_datetime(approval.get("approvedAt"))
                if (approved_at - now).total_seconds() > FUTURE_CLOCK_SKEW_SECONDS:
                    issues.append("publishApproval.approvedAt: is too far in the future")
                comparison = [timestamp for timestamp in (verified_at, confirmed_at, updated_at) if timestamp is not None]
                if comparison and approved_at < max(comparison):
                    issues.append("publishApproval.approvedAt: must be at or after source verification, availability confirmation, and record update")
            except (TypeError, ValueError):
                issues.append("publishApproval.approvedAt: invalid date-time")
    return issues

def _gate_and_map(record: dict[str, Any], now: datetime, allowed_media_hosts: set[str] | None) -> tuple[dict[str, Any] | None, list[str]]:
    if not record.get("publishApproved", False):
        return None, []
    issues = _validate_private(record, now, allowed_media_hosts)
    if record.get("status") not in {"available", "limited"}:
        issues.append("status: private status is not publishable")
    if record.get("reviewStatus") != "ready":
        issues.append("reviewStatus: must equal ready")
    if record.get("publishBlockers"):
        issues.append("publishBlockers: must be empty")

    source = record.get("source", {})
    inventory = record.get("inventory", {})
    profile = record.get("publicProfile", {})
    ats = inventory.get("availableToSell")
    if not isinstance(ats, int) or ats < 1:
        issues.append("inventory.availableToSell: must be a positive integer")

    try:
        verified_at = parse_datetime(source.get("lastSourceVerifiedAt"))
        confirmed_at = parse_datetime(source.get("lastAvailabilityConfirmedAt"))
        expires_at = parse_datetime(source.get("availabilityExpiresAt"))
        age_seconds = (now - confirmed_at).total_seconds()
    except (TypeError, ValueError):
        verified_at = confirmed_at = expires_at = now
        age_seconds = UNPUBLISH_SECONDS + 1

    requested_quantity_mode = profile.get("quantityMode")
    forced_confirm = age_seconds > FRESH_SECONDS or requested_quantity_mode == "confirm"
    public_status = "confirm-availability" if forced_confirm else (
        "limited" if record.get("status") == "limited" else "available"
    )
    public_quantity_mode = "confirm" if forced_confirm else requested_quantity_mode

    public = {key: value for key, value in profile.items() if key in PUBLIC_KEYS}
    public["quantityMode"] = public_quantity_mode
    if forced_confirm:
        public["pricingMode"] = "rfq"
        for key in PRICE_KEYS + ("availableToSell", "quantityRange", "casesAvailable", "unitsPerCase", "moqCases"):
            public.pop(key, None)
    elif public_quantity_mode == "exact":
        public["availableToSell"] = ats
        public.pop("quantityRange", None)
        if inventory.get("casesAvailable") is not None:
            public["casesAvailable"] = inventory.get("casesAvailable")
        if inventory.get("unitsPerCase") is not None:
            public["unitsPerCase"] = inventory.get("unitsPerCase")
    elif public_quantity_mode == "range":
        public.pop("availableToSell", None)
        public.pop("casesAvailable", None)
        public.pop("unitsPerCase", None)
        public.pop("moqCases", None)

    public.update({
        "schemaVersion": SCHEMA_VERSION,
        "dealId": str(record.get("dealId", "UNKNOWN")),
        "sourceVersion": source.get("sourceVersion"),
        "status": public_status,
        "lastSourceVerifiedAt": iso_z(verified_at),
        "lastAvailabilityConfirmedAt": iso_z(confirmed_at),
        "availabilityExpiresAt": iso_z(expires_at),
        "publishedAt": iso_z(now),
    })
    public = {key: value for key, value in public.items() if key in PUBLIC_KEYS and value is not None}

    public_errors = _jsonschema_messages(PUBLIC_VALIDATOR, public)
    if public_errors:
        issues.extend(f"public schema: {message}" for message in public_errors)
    leaks = privacy_scan(public)
    if leaks:
        issues.append("privacy boundary: prohibited field/value path(s): " + ", ".join(leaks))
    return public, issues

def _snapshot_hash_payload(snapshot: dict[str, Any]) -> dict[str, Any]:
    return {
        "schemaVersion": snapshot["schemaVersion"],
        "publisherVersion": snapshot["publisherVersion"],
        "sourceVersion": snapshot["sourceVersion"],
        "recordCount": snapshot["recordCount"],
        "items": snapshot["items"],
    }


def verify_snapshot_integrity(snapshot: dict[str, Any], *, full_schema: bool = True) -> list[str]:
    validator = SNAPSHOT_VALIDATOR if full_schema else SNAPSHOT_META_VALIDATOR
    issues = _jsonschema_messages(validator, snapshot)
    if snapshot.get("recordCount") != len(snapshot.get("items", [])):
        issues.append("recordCount does not equal len(items)")
    ids = [item.get("dealId") for item in snapshot.get("items", [])]
    slugs = [item.get("slug") for item in snapshot.get("items", [])]
    if any(count > 1 for count in Counter(ids).values()):
        issues.append("snapshot contains duplicate dealId")
    if any(count > 1 for count in Counter(slugs).values()):
        issues.append("snapshot contains duplicate slug")
    hash_keys = {"schemaVersion", "publisherVersion", "sourceVersion", "recordCount", "items"}
    if hash_keys.issubset(snapshot):
        expected = sha256_prefixed(_snapshot_hash_payload(snapshot))
        if snapshot.get("snapshotVersion") != expected:
            issues.append("snapshotVersion does not match canonical snapshot content")
    else:
        issues.append("snapshot is missing fields required for integrity hashing")
    return issues


def build_snapshot(
    records: list[dict[str, Any]], *, now: datetime, run_id: str, release_id: str,
    operator: str, previous_snapshot: dict[str, Any] | None = None,
    empty_authorization: dict[str, Any] | None = None,
    allowed_media_hosts: set[str] | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    if now.tzinfo is None:
        raise ValueError("now must be timezone-aware")
    now = now.astimezone(timezone.utc)
    if not run_id or not release_id or not operator:
        raise ValueError("run_id, release_id and operator are required")

    ids = [str(record.get("dealId", "")) for record in records]
    duplicate_ids = sorted(key for key, count in Counter(ids).items() if key and count > 1)
    if duplicate_ids:
        message = "duplicate dealId: " + ", ".join(duplicate_ids)
        raise PublishError(message, {"schemaVersion":SCHEMA_VERSION,"runId":run_id,"releaseId":release_id,"operator":operator,"result":"FAIL","errors":[message]})

    approved_slugs = [str(record.get("publicProfile", {}).get("slug", "")) for record in records if record.get("publishApproved")]
    duplicate_slugs = sorted(key for key, count in Counter(approved_slugs).items() if key and count > 1)
    if duplicate_slugs:
        message = "duplicate slug: " + ", ".join(duplicate_slugs)
        raise PublishError(message, {"schemaVersion":SCHEMA_VERSION,"runId":run_id,"releaseId":release_id,"operator":operator,"result":"FAIL","errors":[message]})

    approved_records = [record for record in records if record.get("publishApproved")]
    approved_source_ids = [
        str(source_id)
        for record in approved_records
        for source_id in record.get("source", {}).get("sourceRecordIds", [])
    ]
    duplicate_source_ids = sorted(key for key, count in Counter(approved_source_ids).items() if key and count > 1)
    if duplicate_source_ids:
        message = "duplicate source record id: " + ", ".join(duplicate_source_ids)
        raise PublishError(message, {"schemaVersion":SCHEMA_VERSION,"runId":run_id,"releaseId":release_id,"operator":operator,"result":"FAIL","errors":[message]})

    approved_source_hashes = [
        str(source_hash)
        for record in approved_records
        for source_hash in record.get("source", {}).get("sourceHashes", [])
    ]
    duplicate_source_hashes = sorted(key for key, count in Counter(approved_source_hashes).items() if key and count > 1)
    if duplicate_source_hashes:
        message = "duplicate source hash: " + ", ".join(duplicate_source_hashes)
        raise PublishError(message, {"schemaVersion":SCHEMA_VERSION,"runId":run_id,"releaseId":release_id,"operator":operator,"result":"FAIL","errors":[message]})

    published: list[dict[str, Any]] = []
    rejected: list[dict[str, Any]] = []
    ignored = 0
    for record in records:
        public, issues = _gate_and_map(record, now, allowed_media_hosts)
        if public is None:
            ignored += 1
            continue
        if issues:
            rejected.append({"dealId":record.get("dealId","UNKNOWN"),"issues":issues})
        else:
            published.append(public)
    if rejected:
        first = rejected[0]
        message = f"publication blocked for {first['dealId']}: {first['issues'][0]}"
        raise PublishError(message, {
            "schemaVersion":SCHEMA_VERSION,"runId":run_id,"releaseId":release_id,"operator":operator,
            "result":"FAIL","inputCount":len(records),"ignoredCount":ignored,"rejected":rejected,
        })

    published.sort(key=lambda item: (item["dealId"], item["slug"]))
    empty_auth_id: str | None = None
    if not published:
        valid_empty, empty_auth_id = _validate_empty_authorization(empty_authorization, now)
        if not valid_empty:
            message = "empty snapshot blocked; structured dual-control authorization is required"
            raise PublishError(message, {"schemaVersion":SCHEMA_VERSION,"runId":run_id,"releaseId":release_id,"operator":operator,"result":"FAIL","errors":[message]})

    source_identity = [f"{item['dealId']}|{item['sourceVersion']}" for item in published]
    combined_source_version = sha256_prefixed(source_identity)
    previous_version = previous_snapshot.get("snapshotVersion") if isinstance(previous_snapshot, dict) else None
    snapshot: dict[str, Any] = {
        "schemaVersion":SCHEMA_VERSION,
        "publisherVersion":PUBLISHER_VERSION,
        "snapshotVersion":"sha256:" + "0" * 64,
        "sourceVersion":combined_source_version,
        "runId":run_id,
        "releaseId":release_id,
        "generatedAt":iso_z(now),
        "previousSnapshotVersion":previous_version,
        "recordCount":len(published),
        "items":published,
    }
    if empty_auth_id:
        snapshot["emptyOverrideAuthorizationId"] = empty_auth_id
    snapshot["snapshotVersion"] = sha256_prefixed(_snapshot_hash_payload(snapshot))
    integrity_issues = verify_snapshot_integrity(snapshot, full_schema=False)
    if integrity_issues:
        raise PublishError("candidate snapshot failed integrity validation", {"result":"FAIL","errors":integrity_issues})

    report = {
        "schemaVersion":SCHEMA_VERSION,"runId":run_id,"releaseId":release_id,"operator":operator,
        "generatedAt":iso_z(now),"result":"PASS","inputCount":len(records),
        "approvedCount":len(records)-ignored,"ignoredCount":ignored,"publishedCount":len(published),
        "sourceVersion":combined_source_version,"snapshotVersion":snapshot["snapshotVersion"],
        "previousSnapshotVersion":previous_version,"emptyOverrideAuthorizationId":empty_auth_id,
    }
    return snapshot, report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build a validated PSE public inventory snapshot from canonical private records.")
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument("--previous", type=Path)
    parser.add_argument("--empty-authorization", type=Path)
    parser.add_argument("--allowed-media-host", action="append", default=[])
    parser.add_argument("--now")
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--release-id", required=True)
    parser.add_argument("--operator", required=True)
    args = parser.parse_args(argv)

    records = _load_json(args.input)
    if not isinstance(records, list):
        raise SystemExit("--input must contain a JSON array")
    previous = _load_json(args.previous) if args.previous else None
    empty_auth = _load_json(args.empty_authorization) if args.empty_authorization else None
    now = parse_datetime(args.now) if args.now else datetime.now(timezone.utc)
    allowed_hosts = set(args.allowed_media_host) if args.allowed_media_host else None
    try:
        snapshot, report = build_snapshot(
            records, now=now, run_id=args.run_id, release_id=args.release_id,
            operator=args.operator, previous_snapshot=previous,
            empty_authorization=empty_auth, allowed_media_hosts=allowed_hosts,
        )
    except PublishError as exc:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(exc.report, indent=2) + "\n", encoding="utf-8")
        print(str(exc), file=sys.stderr)
        return 2
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    args.report.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
