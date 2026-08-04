#!/usr/bin/env python3
"""Publish owner-approved canonical records to the public snapshot.

This is the PRODUCTION publication entry point. It runs the exact gated
pipeline used by the staging demo fixture — owner-approval binding, packet
publish gate, allowlist mapping, privacy scan, deterministic hashing — and
atomically promotes the result to `<data-dir>/current.json`, archiving the
prior snapshot into `<data-dir>/history/`.

Nothing about this tool weakens the gates:
- every publish-approved record must carry an owner approval bound to the
  record's exact `source.sourceVersion` (and record version when provided);
- any approval mismatch, gate failure, or integrity problem fails the WHOLE
  run closed and promotes nothing;
- records that are not publish-approved are ignored (never published) and are
  reported so operators cannot silently lose coverage;
- an empty result is blocked unless a structured dual-control authorization is
  supplied via --empty-authorization.

Every run (pass or fail) writes an audit report into
`<data-dir>/publish_reports/`.

Usage:
    python services/pse-inventory/publish_snapshot.py \
        --records approved-canonical-records.json \
        --approvals owner-approvals.json \
        --operator "caden (owner)" --run-id 2026-08-04-1 --release-id rel-7 \
        [--dry-run] [--allow-media-host cdn.pilotsalesdistribution.com]

Exit codes: 0 = promoted (or clean dry run), 1 = invalid input,
2 = publication blocked (gate/approval/integrity failure), 3 = promotion I/O
failure.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

SERVICE = Path(__file__).resolve().parents[0]
sys.path.insert(0, str(SERVICE))

from pse_inventory import publish_gate  # noqa: E402
from pse_inventory._packet import load_atomic_store_module  # noqa: E402
from pse_inventory.snapshot_builder import PublishBlocked, build_snapshot  # noqa: E402

DEFAULT_MEDIA_HOSTS = {
    "pilotsalesdistribution.com",
    "www.pilotsalesdistribution.com",
    "cdn.pilotsalesdistribution.com",
}

EXIT_OK = 0
EXIT_BAD_INPUT = 1
EXIT_BLOCKED = 2
EXIT_IO = 3


class InputError(RuntimeError):
    """Invalid operator input; the run must stop before any gate executes."""


def parse_timestamp(value: str) -> datetime:
    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise InputError(f"--now is not a valid RFC3339 timestamp: {value}") from exc
    if parsed.tzinfo is None:
        raise InputError(f"timestamp must include a timezone: {value}")
    return parsed.astimezone(timezone.utc)


def read_json_array(path: Path, *, label: str) -> list[dict]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise InputError(f"{label} file not found: {path}")
    except json.JSONDecodeError as exc:
        raise InputError(f"{label} file is not valid JSON: {exc}")
    if not isinstance(payload, list):
        raise InputError(f"{label} file must contain a JSON array")
    for index, item in enumerate(payload):
        if not isinstance(item, dict):
            raise InputError(f"{label} array entry {index} is not an object")
    return payload


def diagnostic_gate_issues(records: list[dict], *, now: datetime) -> list[dict]:
    """Per-record gate diagnostics for publish-approved records only."""
    issues: list[dict] = []
    for record in records:
        if not record.get("publishApproved"):
            continue
        blockers = publish_gate.evaluate_gate(record, now=now)
        if blockers:
            issues.append({"dealId": str(record.get("dealId", "UNKNOWN")), "issues": blockers})
    return issues


def write_report(report_dir: Path, payload: dict) -> Path | None:
    """Best-effort audit trail; a report failure must never mask the outcome."""
    try:
        report_dir.mkdir(parents=True, exist_ok=True)
        stamp = payload.get("generatedAt", datetime.now(timezone.utc).isoformat(timespec="seconds"))
        run_id = str(payload.get("runId", "run")).replace("/", "-")
        target = report_dir / f"{stamp.replace(':', '')}-{run_id}.json"
        target.write_text(json.dumps(payload, indent=2, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")
        return target
    except OSError as exc:
        print(f"WARNING: could not write audit report: {exc}", file=sys.stderr)
        return None


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--records", required=True, type=Path,
                        help="JSON array of canonical records (schema v4.0.0)")
    parser.add_argument("--approvals", type=Path,
                        help="JSON array of owner approvals bound to source versions")
    parser.add_argument("--empty-authorization", type=Path,
                        help="structured dual-control authorization required to publish an empty snapshot")
    parser.add_argument("--operator", required=True, help="identity recorded in the publish report")
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--release-id", required=True)
    parser.add_argument("--data-dir", type=Path, default=SERVICE / "data",
                        help="snapshot store directory (default: services/pse-inventory/data)")
    parser.add_argument("--allow-media-host", action="append", default=[],
                        help="additional approved HTTPS media host (repeatable)")
    parser.add_argument("--dry-run", action="store_true",
                        help="run all gates and print the outcome without promoting anything")
    parser.add_argument("--now", help="RFC3339 timestamp override (testing only)")
    args = parser.parse_args(argv)

    try:
        now = parse_timestamp(args.now) if args.now else datetime.now(timezone.utc)
        records = read_json_array(args.records, label="records")
        approvals = read_json_array(args.approvals, label="approvals") if args.approvals else []
        empty_authorization = None
        if args.empty_authorization:
            try:
                empty_authorization = json.loads(args.empty_authorization.read_text(encoding="utf-8"))
            except FileNotFoundError as exc:
                raise InputError(f"empty-authorization file not found: {exc.filename}")
            except json.JSONDecodeError as exc:
                raise InputError(f"empty-authorization file is not valid JSON: {exc}")
            if not isinstance(empty_authorization, dict):
                raise InputError("empty-authorization file must contain a JSON object")
    except InputError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return EXIT_BAD_INPUT

    data_dir = args.data_dir.resolve()
    report_dir = data_dir / "publish_reports"
    approved_count = sum(1 for record in records if record.get("publishApproved"))
    ignored_ids = [str(record.get("dealId", "UNKNOWN")) for record in records if not record.get("publishApproved")]
    media_hosts = DEFAULT_MEDIA_HOSTS | set(args.allow_media_host)

    base_context = {
        "schemaVersion": "4.0.0",
        "generatedAt": now.isoformat(timespec="seconds"),
        "operator": args.operator,
        "runId": args.run_id,
        "releaseId": args.release_id,
        "inputCount": len(records),
        "approvedCount": approved_count,
        "ignoredDealIds": ignored_ids,
        "approvalCount": len(approvals),
        "dryRun": args.dry_run,
    }

    previous = None
    current_file = data_dir / "current.json"
    if current_file.is_file():
        try:
            previous = json.loads(current_file.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            previous = None  # corrupt current must never block a validated publish

    try:
        snapshot, report = build_snapshot(
            records,
            now=now,
            run_id=args.run_id,
            release_id=args.release_id,
            operator=args.operator,
            approvals=approvals,
            previous_snapshot=previous,
            empty_authorization=empty_authorization,
            allowed_media_hosts=media_hosts,
        )
    except PublishBlocked as exc:
        blocked_report = exc.report or {}
        payload = {**base_context, "result": "FAIL", "blocked": str(exc),
                   "promoted": False, "publisherReport": blocked_report,
                   "gateDiagnostics": diagnostic_gate_issues(records, now=now)}
        report_file = write_report(report_dir, payload)
        print(json.dumps(payload, indent=2, ensure_ascii=False), file=sys.stderr)
        if report_file:
            print(f"audit report: {report_file}", file=sys.stderr)
        print("publication blocked; no snapshot was promoted", file=sys.stderr)
        return EXIT_BLOCKED

    payload = {**base_context, "result": report.get("result", "PASS"),
               "snapshotVersion": snapshot.get("snapshotVersion"),
               "recordCount": snapshot.get("recordCount"),
               "publisherReport": report}

    if args.dry_run:
        payload["promoted"] = False
        write_report(report_dir, payload)
        print(json.dumps(payload, indent=2, ensure_ascii=False))
        print(f"dry run: gate passed, recordCount={snapshot.get('recordCount')}, nothing promoted")
        return EXIT_OK

    try:
        atomic_store = load_atomic_store_module()
        atomic_store.promote_snapshot(data_dir, snapshot)
    except Exception as exc:  # StoreError, OSError, integrity failures
        payload["promoted"] = False
        payload["promotionError"] = str(exc)
        write_report(report_dir, payload)
        print(f"ERROR: snapshot passed the gates but promotion failed: {exc}", file=sys.stderr)
        return EXIT_IO

    payload["promoted"] = True
    report_file = write_report(report_dir, payload)
    print(json.dumps(payload, indent=2, ensure_ascii=False))
    print(f"promoted snapshotVersion={snapshot['snapshotVersion']} recordCount={snapshot.get('recordCount')} -> {current_file}")
    if ignored_ids:
        print(f"note: {len(ignored_ids)} record(s) not publish-approved and were ignored: {', '.join(ignored_ids)}")
    if report_file:
        print(f"audit report: {report_file}")
    return EXIT_OK


if __name__ == "__main__":
    raise SystemExit(main())
