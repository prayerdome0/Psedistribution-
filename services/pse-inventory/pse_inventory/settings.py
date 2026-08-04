"""Service settings; secrets are supplied by the deployment secret store only."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Mapping

from ._packet import DEFAULT_PACKET_ROOT


@dataclass(frozen=True)
class AppSettings:
    snapshot_file: Path
    packet_root: Path
    cursor_secret: str
    hmac_keys: Mapping[str, str]
    allowed_origins: tuple[str, ...] = ("https://pilotsalesdistribution.com",)
    max_last_good_age_seconds: int = 300
    rate_limit_per_minute: int = 120

    def __post_init__(self) -> None:
        if len(self.cursor_secret.encode("utf-8")) < 32:
            raise ValueError("cursor_secret must be at least 32 bytes")
        if not self.hmac_keys or any(len(value.encode("utf-8")) < 16 for value in self.hmac_keys.values()):
            raise ValueError("each HMAC key must be at least 16 bytes")


def default_packet_root() -> Path:
    return DEFAULT_PACKET_ROOT
