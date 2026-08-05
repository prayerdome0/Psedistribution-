"""Deployment hardening: no committed secrets, non-root image, fail-closed env."""
from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[3]
SERVICE = ROOT / "services" / "pse-inventory"

SECRET_PATTERNS = [
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    re.compile(r"AIza[0-9A-Za-z_-]{30,}"),
    re.compile(r"gh[pousr]_[0-9A-Za-z]{30,}"),
    re.compile(r"AKIA[0-9A-Z]{16}"),
]


def test_no_secrets_in_deploy_assets():
    for path in SERVICE.joinpath("deploy").rglob("*"):
        if path.is_file():
            text = path.read_text(encoding="utf-8", errors="ignore")
            for pattern in SECRET_PATTERNS:
                assert not pattern.search(text), f"secret pattern in {path}"


def test_env_example_contains_placeholders_only():
    text = (SERVICE / "deploy" / ".env.example").read_text(encoding="utf-8")
    assert "replace-with" in text
    for pattern in SECRET_PATTERNS:
        assert not pattern.search(text)


def test_dockerfile_runs_unprivileged_and_pins_base():
    text = (SERVICE / "deploy" / "Dockerfile").read_text(encoding="utf-8")
    assert re.search(r"^FROM python:3\.13\.[0-9]+-slim", text, re.M)
    assert "USER 10001:10001" in text
    assert "requirements.runtime.lock" in text
    assert "requirements.test.lock" not in text, "test-only packages must stay out of the runtime image"


def test_compose_keeps_stateful_services_off_default_profile():
    text = (SERVICE / "deploy" / "compose.yaml").read_text(encoding="utf-8")
    assert 'profiles: ["control-plane-preview"]' in text
    assert 'profiles: ["shared-state-preview"]' in text
    assert 'cap_drop: [ALL]' in text


def test_server_exits_fail_closed_without_secrets():
    env = dict(os.environ)
    env.pop("PSE_REVALIDATION_KEYS_JSON", None)
    env.pop("PSE_CURSOR_SECRET", None)
    env["PYTHONPATH"] = str(SERVICE)
    completed = subprocess.run(
        [sys.executable, "-c", "import pse_inventory.server"],
        capture_output=True, text=True, env=env, cwd=str(ROOT), check=False,
    )
    assert completed.returncode != 0
    assert "PSE_REVALIDATION_KEYS_JSON" in completed.stderr


def test_production_compose_wires_database_and_shared_state():
    path = SERVICE / "deploy" / "compose.production.yaml"
    compose = yaml.safe_load(path.read_text(encoding="utf-8"))
    services = compose["services"]
    api = services["api"]
    environment = api["environment"]
    assert environment["PSE_RUNTIME_MODE"] == "production"
    assert "PSE_DATABASE_URL" in environment
    assert "PSE_VALKEY_URL" in environment
    assert {"postgres", "valkey"} <= set(api["depends_on"])
    assert "ports" not in api
    assert api["read_only"] is True
    assert api["cap_drop"] == ["ALL"]
    assert "./postgres-init:/docker-entrypoint-initdb.d:ro" in services["postgres"]["volumes"]
    assert "../migrations:/migrations:ro" in services["postgres"]["volumes"]
    assert "PSE_STOREFRONT_PASSWORD" in services["postgres"]["environment"]
    assert "PSE_PUBLISHER_PASSWORD" in services["postgres"]["environment"]


def test_caddy_does_not_serve_repository_control_plane_paths():
    text = (SERVICE / "deploy" / "Caddyfile").read_text(encoding="utf-8")
    assert "handle @blocked" in text
    for path in ("/services/*", "/vendor/*", "/.env*", "/firestore.rules"):
        assert path in text
    assert "@apiInternal path /api/internal/*" in text
    assert "handle @apiInternal" in text
