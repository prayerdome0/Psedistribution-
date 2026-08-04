#!/usr/bin/env python3
"""Atomic snapshot storage and rollback reference for PSE inventory v4.0."""
from __future__ import annotations

import json
import os
import re
import shutil
import tempfile
from pathlib import Path
from typing import Any

from publisher import canonical_json, verify_snapshot_integrity

VERSION_RE = re.compile(r"^sha256:[a-f0-9]{64}$")


class StoreError(RuntimeError):
    pass


def _write_atomic(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=path.parent)
    temp = Path(temp_name)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp, path)
        try:
            dir_fd = os.open(path.parent, os.O_RDONLY)
            try:
                os.fsync(dir_fd)
            finally:
                os.close(dir_fd)
        except OSError:
            pass
    finally:
        if temp.exists():
            temp.unlink()


def _snapshot_bytes(snapshot: dict[str, Any]) -> bytes:
    return json.dumps(snapshot, ensure_ascii=False, sort_keys=True, indent=2).encode("utf-8") + b"\n"


def validate_snapshot(snapshot: dict[str, Any]) -> None:
    issues = verify_snapshot_integrity(snapshot)
    if issues:
        raise StoreError("invalid snapshot: " + "; ".join(issues))


def load_snapshot(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise StoreError("snapshot file must contain an object")
    validate_snapshot(value)
    return value


def promote_snapshot(store_dir: Path, snapshot: dict[str, Any]) -> Path:
    store_dir = store_dir.resolve()
    current = store_dir / "current.json"
    history = store_dir / "history"
    history.mkdir(parents=True, exist_ok=True)
    validate_snapshot(snapshot)
    version = snapshot["snapshotVersion"]
    if not VERSION_RE.fullmatch(version):
        raise StoreError("invalid snapshotVersion")
    if current.exists():
        prior = load_snapshot(current)
        prior_path = history / (prior["snapshotVersion"].replace(":", "_") + ".json")
        if not prior_path.exists():
            _write_atomic(prior_path, _snapshot_bytes(prior))
    candidate_history = history / (version.replace(":", "_") + ".json")
    if not candidate_history.exists():
        _write_atomic(candidate_history, _snapshot_bytes(snapshot))
    _write_atomic(current, _snapshot_bytes(snapshot))
    return current


def rollback_snapshot(store_dir: Path, snapshot_version: str) -> Path:
    if not VERSION_RE.fullmatch(snapshot_version):
        raise StoreError("invalid rollback snapshotVersion")
    source = store_dir.resolve() / "history" / (snapshot_version.replace(":", "_") + ".json")
    if not source.is_file():
        raise StoreError("requested rollback snapshot does not exist")
    snapshot = load_snapshot(source)
    return promote_snapshot(store_dir, snapshot)
