"""Load the packet's canonical reference modules without copying their logic."""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType


class RuntimeLoadError(RuntimeError):
    pass


def _load(path: Path, module_name: str) -> ModuleType:
    if not path.is_file():
        raise RuntimeLoadError(f"required reference module is missing: {path.name}")
    spec = importlib.util.spec_from_file_location(module_name, path)
    if spec is None or spec.loader is None:
        raise RuntimeLoadError(f"cannot load reference module: {path.name}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


def load_publisher_module(packet_root: Path) -> ModuleType:
    return _load(packet_root / "04_REFERENCE_IMPLEMENTATION" / "publisher.py", "pse_packet_publisher")


def load_revalidation_module(packet_root: Path) -> ModuleType:
    return _load(packet_root / "04_REFERENCE_IMPLEMENTATION" / "revalidation.py", "pse_packet_revalidation")
