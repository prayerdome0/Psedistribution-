#!/usr/bin/env python3
"""Fail when packet-local document references point to missing files."""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from urllib.parse import unquote

TEXT_SUFFIXES = {".md", ".txt"}
ROOT_PREFIX = re.compile(r"^(?:0[0-9]_|1[01]_|VERSION\.txt|CONTRACT_VERSION\.txt|LICENSE$|NOTICE$|SECURITY\.md$|CONTRIBUTING\.md$|CHANGELOG\.md$)")
TARGET_REPO_PLAN = "02_IMPLEMENTATION/10_TASK_BY_TASK_IMPLEMENTATION_PLAN.md"
TARGET_REPO_PREFIXES = ("apps/", "docs/", "scripts/", "services/", "tests/", "vendor/")


def tokens(text: str) -> list[str]:
    found: list[str] = []
    for match in re.finditer(r"\[[^\]]*\]\(([^)]+)\)", text):
        found.append(match.group(1).strip().split("#", 1)[0])
    for match in re.finditer(r"`((?:\.\.?/)?(?:[A-Za-z0-9_.-]+/)+[A-Za-z0-9_.-]+)`", text):
        found.append(match.group(1))
    return found


def lint(root: Path) -> list[str]:
    failures: list[str] = []
    root = root.resolve()
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        rel = path.relative_to(root).as_posix()
        text = path.read_text(encoding="utf-8", errors="replace")
        for raw in tokens(text):
            token = unquote(raw).strip()
            if not token or re.match(r"^(?:https?://|mailto:|#)", token):
                continue
            normalized = token.lstrip("./")
            if rel == TARGET_REPO_PLAN and normalized.startswith(TARGET_REPO_PREFIXES):
                # These are deliberate paths in the future target repository, not packet-local references.
                continue
            candidate = (root / normalized) if ROOT_PREFIX.match(normalized) else (path.parent / token)
            candidate = candidate.resolve()
            try:
                candidate.relative_to(root)
            except ValueError:
                continue
            if not candidate.exists():
                failures.append(f"{rel} -> {token}")
    return sorted(set(failures))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("packet", nargs="?", type=Path, default=Path("."))
    args = parser.parse_args()
    failures = lint(args.packet)
    print(json.dumps({"failures": failures, "result": "PASS" if not failures else "FAIL"}, indent=2, sort_keys=True))
    return 0 if not failures else 1


if __name__ == "__main__":
    raise SystemExit(main())
