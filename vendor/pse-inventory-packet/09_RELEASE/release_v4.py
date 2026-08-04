#!/usr/bin/env python3
"""Seal, reproduce and clean-room verify the PSE inventory packet v4.0.0.

The script is intentionally standard-library only. It does not deploy or mutate
live systems. It validates the packet, stabilizes release evidence, builds the
same deterministic archive twice, verifies two independent clean extractions,
rebuilds from each extraction and writes a detached attestation.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path
from typing import Any

PACKET_VERSION = "4.0.0"
CONTRACT_VERSION = "4.0.0"
ARCHIVE_BASENAME = "PSE_SalesMax_Inventory_Wiring_MASTERED_OPEN_SOURCE_v4.0.0_2026-08-03.zip"
STAGES = [
    "clean-generated-artifacts",
    "bootstrap-gauntlet",
    "stabilize-release-evidence",
    "generate-manifest-and-checksums",
    "full-gauntlet",
    "two-deterministic-zip-builds",
    "two-clean-room-validations",
    "two-clean-room-rebuilds",
    "detached-attestation",
]


class ReleaseError(RuntimeError):
    pass


def progress(message: str) -> None:
    print(f"[release-v4] {message}", file=sys.stderr, flush=True)


def canonical_json(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def run(command: list[str], *, cwd: Path | None = None, timeout: int = 900) -> subprocess.CompletedProcess[str]:
    env = dict(os.environ)
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    env.setdefault("TERM", "dumb")
    completed = subprocess.run(
        command,
        cwd=cwd,
        capture_output=True,
        text=True,
        check=False,
        timeout=timeout,
        env=env,
    )
    if completed.returncode != 0:
        raise ReleaseError(
            "command failed: " + " ".join(command) + "\n" + completed.stdout[-8000:] + completed.stderr[-8000:]
        )
    return completed


def parse_json_output(completed: subprocess.CompletedProcess[str], *, label: str) -> dict[str, Any]:
    try:
        value = json.loads(completed.stdout)
    except json.JSONDecodeError as exc:
        raise ReleaseError(f"{label} did not return JSON: {exc}\n{completed.stdout[-4000:]}") from exc
    if not isinstance(value, dict) or value.get("result") != "PASS":
        raise ReleaseError(f"{label} did not pass: {json.dumps(value, indent=2, sort_keys=True)}")
    return value


def clean_generated_artifacts(root: Path) -> list[str]:
    removed: list[str] = []
    for directory_name in ("__pycache__", ".pytest_cache"):
        for path in sorted(root.rglob(directory_name), reverse=True):
            if path.is_dir():
                removed.append(path.relative_to(root).as_posix())
                shutil.rmtree(path)
    for pattern in ("*.pyc", ".DS_Store"):
        for path in sorted(root.rglob(pattern)):
            if path.is_file():
                removed.append(path.relative_to(root).as_posix())
                path.unlink()
    return removed


def write_json_atomic(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_bytes(json.dumps(value, indent=2, sort_keys=True).encode("utf-8") + b"\n")
    os.replace(temporary, path)


def run_gauntlet(root: Path, *, bootstrap: bool) -> dict[str, Any]:
    command = [sys.executable, str(root / "07_GAUNTLET/run_super_gauntlet.py")]
    if bootstrap:
        command.append("--bootstrap")
    command.append(str(root))
    return parse_json_output(run(command, cwd=root), label="bootstrap gauntlet" if bootstrap else "full gauntlet")


def generate_metadata(root: Path) -> None:
    run([sys.executable, str(root / "09_RELEASE/generate_release_metadata.py"), str(root)], cwd=root)


def build_zip(root: Path, output: Path) -> None:
    run([sys.executable, str(root / "09_RELEASE/build_deterministic_zip.py"), str(root), str(output)], cwd=root)


def stabilize_release_evidence(root: Path) -> dict[str, Any]:
    result_path = root / "09_RELEASE/02_GAUNTLET_RESULTS.json"
    progress("running bootstrap gauntlet")
    bootstrap = run_gauntlet(root, bootstrap=True)
    write_json_atomic(result_path, bootstrap)
    generate_metadata(root)

    progress("running first full gauntlet")
    first = run_gauntlet(root, bootstrap=False)
    write_json_atomic(result_path, first)
    generate_metadata(root)

    progress("running stabilization full gauntlet")
    second = run_gauntlet(root, bootstrap=False)
    if canonical_json(first) != canonical_json(second):
        raise ReleaseError("release evidence did not stabilize across the two full-gauntlet runs")
    write_json_atomic(result_path, second)
    generate_metadata(root)
    return second


def safe_extract(archive_path: Path, destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    destination_resolved = destination.resolve()
    with zipfile.ZipFile(archive_path) as archive:
        bad = archive.testzip()
        if bad is not None:
            raise ReleaseError(f"archive integrity failure at {bad}")
        for member in archive.infolist():
            target = (destination / member.filename).resolve()
            if destination_resolved not in target.parents and target != destination_resolved:
                raise ReleaseError(f"unsafe archive entry: {member.filename}")
        archive.extractall(destination)


def validate_version(root: Path) -> None:
    version_path = root / "VERSION.txt"
    expected = (
        f"packetVersion={PACKET_VERSION}\n"
        f"contractVersion={CONTRACT_VERSION}\n"
        "releaseProfile=OPEN_SOURCE_SUPER_GAUNTLET\n"
    )
    if not version_path.is_file() or version_path.read_text(encoding="utf-8") != expected:
        raise ReleaseError(f"packet version control is missing or not {PACKET_VERSION}")


def release(packet: Path, output_dir: Path, *, keep_clean_rooms: bool = False) -> dict[str, Any]:
    root = packet.resolve()
    output_dir = output_dir.resolve()
    validate_version(root)
    output_dir.mkdir(parents=True, exist_ok=True)
    progress("cleaning generated artifacts")
    removed = clean_generated_artifacts(root)
    final_result = stabilize_release_evidence(root)
    unexpected = clean_generated_artifacts(root)
    if unexpected:
        raise ReleaseError("gauntlet created forbidden generated artifacts: " + ", ".join(unexpected))

    canonical_archive = output_dir / ARCHIVE_BASENAME
    progress("building two deterministic source archives")
    second_archive = output_dir / (ARCHIVE_BASENAME.removesuffix(".zip") + ".rebuild.zip")
    build_zip(root, canonical_archive)
    build_zip(root, second_archive)
    first_hash = sha256_file(canonical_archive)
    second_hash = sha256_file(second_archive)
    if first_hash != second_hash or canonical_archive.read_bytes() != second_archive.read_bytes():
        raise ReleaseError("two deterministic source archive builds are not byte-identical")
    second_archive.unlink()

    clean_root_obj = tempfile.TemporaryDirectory(prefix="pse-inventory-v4-cleanrooms-", dir=str(output_dir))
    clean_root = Path(clean_root_obj.name)
    clean_results: list[dict[str, Any]] = []
    rebuilt_hashes: list[str] = []
    try:
        for label in ("A", "B"):
            progress(f"validating clean room {label}")
            extracted = clean_root / f"clean-room-{label}"
            safe_extract(canonical_archive, extracted)
            clean_result = run_gauntlet(extracted, bootstrap=False)
            clean_results.append(clean_result)
            rebuilt = output_dir / (ARCHIVE_BASENAME.removesuffix(".zip") + f".clean-{label}.zip")
            build_zip(extracted, rebuilt)
            rebuilt_hash = sha256_file(rebuilt)
            rebuilt_hashes.append(rebuilt_hash)
            if rebuilt_hash != first_hash or rebuilt.read_bytes() != canonical_archive.read_bytes():
                raise ReleaseError(f"clean-room {label} archive rebuild is not byte-identical")
            rebuilt.unlink()

        progress("writing detached attestation and archive checksum")
        attestation = {
            "packetVersion": PACKET_VERSION,
            "contractVersion": CONTRACT_VERSION,
            "releaseProfile": "OPEN_SOURCE_SUPER_GAUNTLET",
            "result": "PASS",
            "productionIntegration": "NOT_DEPLOYED",
            "archive": {
                "fileName": canonical_archive.name,
                "bytes": canonical_archive.stat().st_size,
                "sha256": first_hash,
                "sourceBuildsByteIdentical": True,
                "cleanRoomRebuildsByteIdentical": True,
            },
            "sourceGauntlet": final_result,
            "cleanRooms": [
                {"label": label, "gauntlet": result, "rebuiltArchiveSha256": rebuilt_hash}
                for label, result, rebuilt_hash in zip(("A", "B"), clean_results, rebuilt_hashes, strict=True)
            ],
            "generatedArtifactsRemovedBeforeRelease": removed,
            "verificationDate": "2026-08-03",
        }
        attestation_path = output_dir / "PSE_SalesMax_Inventory_Wiring_MASTERED_OPEN_SOURCE_v4.0.0_CLEAN_ROOM_ATTESTATION.json"
        write_json_atomic(attestation_path, attestation)
        checksum_path = output_dir / (canonical_archive.name + ".sha256")
        checksum_path.write_text(f"{first_hash}  {canonical_archive.name}\n", encoding="utf-8")
        return {
            "result": "PASS",
            "packetVersion": PACKET_VERSION,
            "archive": str(canonical_archive),
            "archiveSha256": first_hash,
            "archiveBytes": canonical_archive.stat().st_size,
            "attestation": str(attestation_path),
            "checksumFile": str(checksum_path),
            "sourceChecks": final_result.get("checks"),
            "cleanRoomChecks": [item.get("checks") for item in clean_results],
            "totalAutomatedTests": final_result.get("evidence", {}).get("totalAutomatedTests"),
            "productionIntegration": "NOT_DEPLOYED",
        }
    finally:
        if keep_clean_rooms:
            clean_root_obj.cleanup = lambda: None  # type: ignore[method-assign]
        else:
            clean_root_obj.cleanup()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plan", action="store_true", help="Print the deterministic release stages without changing files.")
    parser.add_argument("--output-dir", type=Path, help="Directory for the archive and detached evidence.")
    parser.add_argument("--keep-clean-rooms", action="store_true", help="Keep temporary clean-room extractions for inspection.")
    parser.add_argument("packet", nargs="?", type=Path, default=Path(__file__).resolve().parents[1])
    return parser


def main() -> int:
    args = build_parser().parse_args()
    if args.plan:
        print(json.dumps({"packetVersion": PACKET_VERSION, "stages": STAGES}, indent=2))
        return 0
    packet = args.packet.resolve()
    output_dir = args.output_dir.resolve() if args.output_dir else packet.parent
    try:
        result = release(packet, output_dir, keep_clean_rooms=args.keep_clean_rooms)
    except (OSError, ReleaseError, subprocess.SubprocessError, zipfile.BadZipFile) as exc:
        print(json.dumps({"packetVersion": PACKET_VERSION, "result": "FAIL", "error": str(exc)}, indent=2), file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
