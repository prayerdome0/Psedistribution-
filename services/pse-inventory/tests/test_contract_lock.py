"""Contract lock: service contracts must match the vendored packet byte-for-byte."""
from __future__ import annotations

import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def test_service_contracts_match_packet_contracts_byte_for_byte() -> None:
    packet = ROOT / "vendor" / "pse-inventory-packet" / "03_CONTRACTS"
    service = ROOT / "services" / "pse-inventory" / "contracts"
    assert packet.is_dir(), "vendored packet contracts are missing"
    assert service.is_dir(), "service contract directory is missing"
    sources = sorted(path for path in packet.iterdir() if path.is_file())
    assert sources, "packet contract directory is empty"
    for source in sources:
        target = service / source.name
        assert target.is_file(), f"missing service contract copy: {source.name}"
        assert hashlib.sha256(target.read_bytes()).digest() == hashlib.sha256(source.read_bytes()).digest(), (
            f"service contract drifted from packet contract: {source.name}"
        )


def test_packet_version_files_match_service_constants() -> None:
    from pse_inventory import CONTRACT_VERSION, PACKET_VERSION

    packet_root = ROOT / "vendor" / "pse-inventory-packet"
    version_text = (packet_root / "VERSION.txt").read_text(encoding="utf-8")
    versions = dict(line.split("=", 1) for line in version_text.splitlines() if "=" in line)
    assert versions.get("packetVersion", version_text.strip()) == PACKET_VERSION
    assert (packet_root / "CONTRACT_VERSION.txt").read_text(encoding="utf-8").strip() == CONTRACT_VERSION
