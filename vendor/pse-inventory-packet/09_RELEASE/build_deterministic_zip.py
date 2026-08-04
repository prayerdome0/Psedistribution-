#!/usr/bin/env python3
"""Build a byte-reproducible ZIP from the final packet directory."""
from __future__ import annotations

import argparse
import zipfile
from pathlib import Path

FIXED_TIME = (2026, 8, 3, 12, 0, 0)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("packet", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    root = args.packet.resolve()
    files = sorted(
        path for path in root.rglob("*")
        if path.is_file()
        and "__pycache__" not in path.parts
        and ".pytest_cache" not in path.parts
        and not path.name.endswith(".pyc")
        and path.name != ".DS_Store"
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(args.output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in files:
            rel = path.relative_to(root).as_posix()
            info = zipfile.ZipInfo(rel, FIXED_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = (0o755 if path.suffix in {".py", ".sh"} else 0o644) << 16
            info.create_system = 3
            archive.writestr(info, path.read_bytes())
    with zipfile.ZipFile(args.output) as archive:
        bad = archive.testzip()
        if bad is not None:
            raise RuntimeError(f"ZIP integrity failure at {bad}")
    print(args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
