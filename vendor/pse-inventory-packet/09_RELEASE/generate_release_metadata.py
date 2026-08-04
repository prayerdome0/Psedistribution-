#!/usr/bin/env python3
"""Generate the packet manifest and SHA-256 list deterministically."""
from __future__ import annotations

import argparse
import csv
import hashlib
from pathlib import Path

EXCLUDED = {
    "09_RELEASE/PACKAGE_MANIFEST.csv",
    "09_RELEASE/SHA256SUMS.txt",
}


def category_for(rel: str) -> str:
    first = rel.split("/", 1)[0]
    return {
        "01_EXECUTIVE": "executive-visual",
        "02_IMPLEMENTATION": "implementation",
        "03_CONTRACTS": "contract",
        "04_REFERENCE_IMPLEMENTATION": "reference-code-test",
        "05_INTEGRATION": "integration",
        "06_OPERATIONS": "operations",
        "07_GAUNTLET": "gauntlet",
        "08_SOURCE_EVIDENCE": "source-evidence",
        "09_RELEASE": "release",
        "10_OPEN_SOURCE": "open-source-supply-chain",
        "11_RUNNABLE_REFERENCE_STACK": "runnable-reference-stack",
    }.get(first, "packet-control")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("packet", nargs="?", type=Path, default=Path("."))
    args = parser.parse_args()
    root = args.packet.resolve()
    files = sorted(
        path for path in root.rglob("*")
        if path.is_file()
        and path.relative_to(root).as_posix() not in EXCLUDED
        and "__pycache__" not in path.parts
        and ".pytest_cache" not in path.parts
        and not path.name.endswith(".pyc")
        and path.name != ".DS_Store"
    )
    release = root / "09_RELEASE"
    release.mkdir(parents=True, exist_ok=True)
    manifest = release / "PACKAGE_MANIFEST.csv"
    sums = release / "SHA256SUMS.txt"
    with manifest.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["path", "bytes", "sha256", "category"])
        writer.writeheader()
        for path in files:
            rel = path.relative_to(root).as_posix()
            writer.writerow({
                "path": rel,
                "bytes": path.stat().st_size,
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                "category": category_for(rel),
            })
    sums.write_text(
        "".join(f"{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.relative_to(root).as_posix()}\n" for path in files),
        encoding="utf-8",
    )
    print(f"manifested {len(files)} files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
