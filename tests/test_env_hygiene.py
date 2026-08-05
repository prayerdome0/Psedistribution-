"""
test_env_hygiene.py
-------------------
Enforce that no real environment file is ever committed and that the
`.env.example` template does not contain any real-looking secrets.

This is a deliberately strict, narrow test. It does not need to be clever —
it just has to catch the most common mistake: pasting a real key into
`.env.example` or committing a populated `.env` file.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]

# Files that absolutely must not exist in the repo (would leak secrets).
FORBIDDEN_FILES = [
    ".env",
    ".env.local",
    ".env.production",
    ".env.staging",
    ".env.development",
    "google-credentials.json",
    "service-account.json",
]

# Patterns that indicate a real secret was pasted into a template.
SECRET_PATTERNS = [
    (re.compile(r"re_[A-Za-z0-9]{20,}"), "Resend API key"),
    (re.compile(r"sk_(?:live|test)_[A-Za-z0-9]{20,}"), "Stripe secret key"),
    (re.compile(r"pk_(?:live|test)_[A-Za-z0-9]{20,}"), "Stripe public key"),
    (re.compile(r"AIzaSy[A-Za-z0-9_\-]{30,}"), "Firebase API key"),
    (re.compile(r"AKIA[0-9A-Z]{16}"), "AWS access key"),
    (re.compile(r"ghp_[A-Za-z0-9]{30,}"), "GitHub personal access token"),
    (re.compile(r"xox[baprs]-[A-Za-z0-9-]{10,}"), "Slack token"),
    (re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----"), "private key"),
]


@pytest.mark.parametrize("filename", FORBIDDEN_FILES)
def test_no_real_env_file_committed(filename: str) -> None:
    """Fail if a populated env file exists in the repo root."""
    p = REPO_ROOT / filename
    assert not p.exists(), (
        f"Real environment file committed: {filename}. "
        f"Add it to .gitignore and remove from the index."
    )


def test_env_example_exists() -> None:
    p = REPO_ROOT / ".env.example"
    assert p.exists(), "Missing .env.example at the repo root."
    text = p.read_text(encoding="utf-8")
    assert "replace-with" in text, (
        ".env.example exists but contains no `replace-with-` placeholders. "
        "Every secret variable must be a placeholder, not a real value."
    )


def test_env_example_has_no_real_secrets() -> None:
    p = REPO_ROOT / ".env.example"
    text = p.read_text(encoding="utf-8")
    findings: list[str] = []
    for pattern, label in SECRET_PATTERNS:
        for match in pattern.finditer(text):
            findings.append(f"{label}: {match.group(0)[:12]}…")
    assert not findings, "Real-looking secret in .env.example:\n  " + "\n  ".join(findings)


def test_gitignore_excludes_env_files() -> None:
    gi = REPO_ROOT / ".gitignore"
    text = gi.read_text(encoding="utf-8")
    # The gitignore MUST exclude .env / .env.* (with the documented exception for .env.example)
    assert re.search(r"^\.env(\.|\*|$)", text, re.MULTILINE), (
        ".gitignore should exclude .env / .env.* (with !.env.example exception)."
    )
    # .env.example is explicitly allow-listed so the template IS committed.
    assert "!.env.example" in text, ".gitignore should explicitly allow .env.example."


def test_dockerignore_excludes_env_files() -> None:
    di = REPO_ROOT / ".dockerignore"
    text = di.read_text(encoding="utf-8")
    assert re.search(r"^\.env", text, re.MULTILINE), (
        ".dockerignore should exclude .env files so they're never baked into images."
    )
