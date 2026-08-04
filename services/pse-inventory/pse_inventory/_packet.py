"""Load the vendored packet's canonical reference modules without copying logic.

The packet is the authoritative tested behavior for publication, integrity
verification and HMAC revalidation. The service delegates to it so production
code cannot weaken the contracts.
"""
from __future__ import annotations

import importlib.util
import os
import sys
from pathlib import Path
from types import ModuleType

# Never contaminate the vendored packet with bytecode caches: the packet must
# stay byte-clean for its own package-QA gauntlet.
os.environ.setdefault("PYTHONDONTWRITEBYTECODE", "1")
sys.dont_write_bytecode = True

REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_PACKET_ROOT = REPO_ROOT / "vendor" / "pse-inventory-packet"


class PacketLoadError(RuntimeError):
    pass


_MODULE_CACHE: dict[str, ModuleType] = {}


def _load(path: Path, module_name: str) -> ModuleType:
    """Load once and cache: all service modules must share one module object so
    exception classes and validators are identical everywhere."""
    if module_name in _MODULE_CACHE:
        return _MODULE_CACHE[module_name]
    if not path.is_file():
        raise PacketLoadError(f"required packet reference module is missing: {path}")
    spec = importlib.util.spec_from_file_location(module_name, path)
    if spec is None or spec.loader is None:
        raise PacketLoadError(f"cannot load packet reference module: {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    _MODULE_CACHE[module_name] = module
    return module


def packet_root() -> Path:
    return DEFAULT_PACKET_ROOT


def load_publisher_module(root: Path | None = None) -> ModuleType:
    base = root or DEFAULT_PACKET_ROOT
    return _load(base / "04_REFERENCE_IMPLEMENTATION" / "publisher.py", "pse_packet_publisher")


def load_revalidation_module(root: Path | None = None) -> ModuleType:
    base = root or DEFAULT_PACKET_ROOT
    return _load(base / "04_REFERENCE_IMPLEMENTATION" / "revalidation.py", "pse_packet_revalidation")


def load_atomic_store_module(root: Path | None = None) -> ModuleType:
    base = root or DEFAULT_PACKET_ROOT
    publisher = load_publisher_module(root)
    # atomic_store.py imports `publisher` as a top-level module; bind the cached
    # singleton so the reference module resolves without sys.path tricks.
    if sys.modules.get("publisher") is not publisher:
        sys.modules["publisher"] = publisher
    return _load(base / "04_REFERENCE_IMPLEMENTATION" / "atomic_store.py", "pse_packet_atomic_store")
