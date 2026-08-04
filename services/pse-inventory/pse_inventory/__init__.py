"""PSE/SalesMax inventory publication service (packet contract v4.0.0).

Deterministic, self-hostable, fail-closed. No proprietary AI in the inventory
path; the browser never receives private-master access. Public output is built
from an allowlist, never by deleting known-private fields.
"""
from __future__ import annotations

PACKET_VERSION = "4.0.0"
CONTRACT_VERSION = "4.0.0"

__all__ = ["PACKET_VERSION", "CONTRACT_VERSION"]
