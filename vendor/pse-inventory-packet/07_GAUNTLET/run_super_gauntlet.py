#!/usr/bin/env python3
"""Fail-closed, self-contained release gauntlet for the open-source packet.

The runner validates packet completeness, cross-file contract consistency,
open-source/no-proprietary-AI policy, reference behavior, adversarial tests,
editable-slide/PDF parity, manifests and checksums. It deliberately does not
claim or test live production deployment.
"""
from __future__ import annotations

import argparse
import ast
import csv
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from importlib.metadata import PackageNotFoundError, version as installed_version
from pathlib import Path
from typing import Any, Iterable
from xml.etree import ElementTree as ET

import yaml
from jsonschema import Draft202012Validator, FormatChecker
from PIL import Image, ImageChops, ImageStat
from referencing import Registry, Resource

PACKET_VERSION = "4.0.0"
CONTRACT_VERSION = "4.0.0"
EXPECTED_LEGACY_TESTS = 103
EXPECTED_RUNTIME_TESTS = 32
EXPECTED_NODE_TESTS = 3
EXPECTED_TOTAL_TESTS = 138
EXPECTED_SLIDES = 22
TEXT_EXTENSIONS = {".md", ".txt", ".csv", ".json", ".yaml", ".yml", ".template", ".py", ".sh"}
MANIFEST_EXCLUSIONS = {"09_RELEASE/PACKAGE_MANIFEST.csv", "09_RELEASE/SHA256SUMS.txt"}
PLACEHOLDER_ALLOWED = {
    "02_IMPLEMENTATION/03_PHASE_0_DISCOVERY_WORKSHEET.md",
    "05_INTEGRATION/07_ENVIRONMENT_VARIABLES.template",
    "06_OPERATIONS/07_RELEASE_EVIDENCE_TEMPLATE.md",
    "10_OPEN_SOURCE/05_COMPONENT_PINNING_REGISTER.template.csv",
    "07_GAUNTLET/run_super_gauntlet.py",
    "07_GAUNTLET/GAUNTLET_MATRIX.csv",
}
DOCUMENTED_PROPRIETARY_MENTION_ALLOWED = {
    "00_START_HERE.md",
    "01_EXECUTIVE/06_OPEN_SOURCE_DECISION.md",
    "02_IMPLEMENTATION/01_MASTER_GAMEPLAN.md",
    "02_IMPLEMENTATION/02_ENGINEERING_HANDOFF_PROMPT.txt",
    "02_IMPLEMENTATION/08_ASSUMPTIONS_DECISIONS_BLOCKERS.csv",
    "02_IMPLEMENTATION/09_DEFINITION_OF_DONE.md",
    "04_REFERENCE_IMPLEMENTATION/tests/test_open_source_policy.py",
    "05_INTEGRATION/00_NO_PROPRIETARY_AI_AND_OPEN_SOURCE_POLICY.md",
    "05_INTEGRATION/01_OPENAPI_STANDARD_CLARIFICATION.md",
    "07_GAUNTLET/GAUNTLET_MATRIX.csv",
    "07_GAUNTLET/run_super_gauntlet.py",
    "08_SOURCE_EVIDENCE/03_RESEARCH_SOURCES.md",
    "09_RELEASE/01_RELEASE_NOTES.md",
    "10_OPEN_SOURCE/01_OPEN_SOURCE_STACK_BLUEPRINT.md",
    "10_OPEN_SOURCE/04_LICENSE_AND_SUPPLY_CHAIN_POLICY.md",
    "10_OPEN_SOURCE/06_OPEN_SOURCE_ADOPTION_DECISION.md",
}
SECRET_PATTERNS = {
    "private-key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "google-api-key": re.compile(r"AIza[0-9A-Za-z_-]{30,}"),
    "github-token": re.compile(r"gh[pousr]_[0-9A-Za-z]{30,}"),
    "aws-access-key": re.compile(r"AKIA[0-9A-Z]{16}"),
    "generic-bearer-token": re.compile(r"Bearer\s+[A-Za-z0-9._~+/=-]{24,}"),
}
PROPRIETARY_AI_RUNTIME_PATTERNS = {
    "openai-key": re.compile(r"OPENAI_API_KEY"),
    "openai-endpoint": re.compile(r"api\.openai\.com", re.I),
    "openai-sdk": re.compile(r"(?:^|\s)(?:from|import)\s+openai(?:\s|$)", re.I | re.M),
    "anthropic-key": re.compile(r"ANTHROPIC_API_KEY"),
    "anthropic-endpoint": re.compile(r"api\.anthropic\.com", re.I),
    "google-genai-key": re.compile(r"GOOGLE_API_KEY|GEMINI_API_KEY"),
    "hosted-model-endpoint": re.compile(r"(?:api\.together\.xyz|api\.groq\.com|api\.mistral\.ai)", re.I),
}
NETWORK_IMPORTS = {"requests", "httpx", "socket", "aiohttp", "subprocess"}
REQUIRED_OPEN_SOURCE_TOOLS = ("libreoffice", "pdfinfo", "pdffonts", "pdftoppm", "pdftotext")
TRACE_ENABLED = os.environ.get("PSE_GAUNTLET_TRACE") == "1"
TARGET_REPO_PLAN = "02_IMPLEMENTATION/10_TASK_BY_TASK_IMPLEMENTATION_PLAN.md"
TARGET_REPO_PREFIXES = ("apps/", "docs/", "scripts/", "services/", "tests/", "vendor/")


def trace(message: str) -> None:
    if TRACE_ENABLED:
        print(f"[gauntlet-v4] {message}", file=sys.stderr, flush=True)


class Audit:
    def __init__(self) -> None:
        self.checks = 0
        self.failures: list[str] = []
        self.evidence: dict[str, Any] = {}

    def check(self, condition: bool, message: str) -> None:
        self.checks += 1
        if not condition:
            self.failures.append(message)


def run(command: list[str], cwd: Path | None = None, timeout: int = 180) -> subprocess.CompletedProcess[str]:
    env = dict(os.environ)
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    env.setdefault("TERM", "dumb")
    return subprocess.run(command, cwd=cwd, capture_output=True, text=True, check=False, env=env, timeout=timeout)


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def parse_version_file(path: Path) -> dict[str, str]:
    result: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            raise ValueError(f"invalid version line: {line}")
        key, value = line.split("=", 1)
        result[key.strip()] = value.strip()
    return result


def collect_refs(value: Any) -> Iterable[str]:
    if isinstance(value, dict):
        for key, child in value.items():
            if key == "$ref" and isinstance(child, str):
                yield child
            else:
                yield from collect_refs(child)
    elif isinstance(value, list):
        for child in value:
            yield from collect_refs(child)


def markdown_local_links(text: str) -> list[str]:
    links: list[str] = []
    for match in re.finditer(r"\[[^\]]*\]\(([^)]+)\)", text):
        target = match.group(1).strip().split("#", 1)[0]
        if target and not re.match(r"^(?:https?://|mailto:|#)", target):
            links.append(target)
    for match in re.finditer(
        r"`((?:\.\./|\./)?(?:[A-Za-z0-9_.-]+/)+[A-Za-z0-9_.-]+\.(?:md|txt|csv|json|ya?ml|template|py|sh|png|pptx|pdf))`",
        text,
    ):
        links.append(match.group(1))
    return links


def expected_manifest_paths(root: Path) -> set[str]:
    return {
        path.relative_to(root).as_posix()
        for path in root.rglob("*")
        if path.is_file()
        and path.relative_to(root).as_posix() not in MANIFEST_EXCLUSIONS
        and "__pycache__" not in path.parts
        and ".pytest_cache" not in path.parts
        and not path.name.endswith(".pyc")
        and path.name != ".DS_Store"
    }


def count_unittest_successes(output: str) -> int:
    return len(re.findall(r"^test_[^\n]+\.\.\. ok$", output, flags=re.MULTILINE))


def count_pytest_successes(output: str) -> int:
    matches = re.findall(r"(?:^|\s)(\d+) passed(?:,|\s|$)", output)
    return int(matches[-1]) if matches else 0


def count_node_successes(output: str) -> int:
    matches = re.findall(r"^# pass (\d+)\s*$", output, flags=re.MULTILINE)
    return int(matches[-1]) if matches else 0


def load_pinned_requirements(path: Path, audit: Audit) -> dict[str, str]:
    pairs: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        audit.check(bool(re.fullmatch(r"[A-Za-z0-9_.-]+==[A-Za-z0-9_.+-]+", line)), f"dependency is not exactly pinned: {path.name}:{line}")
        if "==" in line:
            name, value = line.split("==", 1)
            pairs[name] = value
    return pairs


def validate_python_sources(root: Path, audit: Audit) -> None:
    syntax_errors: list[str] = []
    dangerous_imports: list[str] = []
    ref = root / "04_REFERENCE_IMPLEMENTATION"
    for path in sorted(ref.rglob("*.py")):
        if "__pycache__" in path.parts:
            continue
        rel = path.relative_to(root).as_posix()
        source = path.read_text(encoding="utf-8")
        try:
            tree = ast.parse(source, filename=rel)
            compile(tree, rel, "exec")
        except SyntaxError as exc:
            syntax_errors.append(f"{rel}:{exc.lineno}:{exc.msg}")
            continue
        if path.name in {"publisher.py", "atomic_store.py", "revalidation.py"}:
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        if alias.name.split(".", 1)[0] in NETWORK_IMPORTS:
                            dangerous_imports.append(f"{rel}:{alias.name}")
                elif isinstance(node, ast.ImportFrom) and node.module:
                    if node.module.split(".", 1)[0] in NETWORK_IMPORTS:
                        dangerous_imports.append(f"{rel}:{node.module}")
    audit.check(not syntax_errors, "Python syntax errors: " + ", ".join(syntax_errors[:20]))
    audit.check(not dangerous_imports, "authoritative modules perform network/process I/O: " + ", ".join(dangerous_imports[:20]))


def validate_pptx_bounds(pptx: Path, audit: Audit) -> tuple[int, str]:
    ns = {
        "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
        "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    }
    overflow: list[str] = []
    with zipfile.ZipFile(pptx) as archive:
        bad = archive.testzip()
        audit.check(bad is None, f"PPTX ZIP corruption at {bad}")
        presentation = ET.fromstring(archive.read("ppt/presentation.xml"))
        slide_size = presentation.find("p:sldSz", ns)
        if slide_size is None:
            audit.check(False, "PPTX slide size is missing")
            return 0, ""
        slide_w, slide_h = int(slide_size.attrib["cx"]), int(slide_size.attrib["cy"])
        tolerance = 100_000  # roughly 0.11 inch, allows harmless edge strokes.
        slide_names = sorted(
            (name for name in archive.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", name)),
            key=lambda value: int(re.search(r"(\d+)", value).group(1)),
        )
        all_text_parts: list[str] = []
        for slide_name in slide_names:
            root = ET.fromstring(archive.read(slide_name))
            all_text_parts.extend(node.text or "" for node in root.findall(".//a:t", ns))
            transforms = root.findall(".//a:xfrm", ns) + root.findall(".//p:xfrm", ns)
            for index, transform in enumerate(transforms):
                off = transform.find("a:off", ns)
                ext = transform.find("a:ext", ns)
                if off is None or ext is None:
                    continue
                x, y = int(off.attrib.get("x", "0")), int(off.attrib.get("y", "0"))
                cx, cy = int(ext.attrib.get("cx", "0")), int(ext.attrib.get("cy", "0"))
                if x < -tolerance or y < -tolerance or x + cx > slide_w + tolerance or y + cy > slide_h + tolerance:
                    overflow.append(f"{slide_name}:xfrm{index} ({x},{y},{cx},{cy})")
        audit.check(len(slide_names) == EXPECTED_SLIDES, f"expected {EXPECTED_SLIDES} slides, observed {len(slide_names)}")
        audit.check(not overflow, "PPTX contains out-of-bounds shapes: " + ", ".join(overflow[:20]))
        return len(slide_names), " ".join(all_text_parts)


def pdf_page_count(path: Path, audit: Audit, label: str) -> tuple[int, str]:
    result = run(["pdfinfo", str(path)])
    audit.check(result.returncode == 0, f"pdfinfo failed for {label}: " + result.stderr[-1000:])
    match = re.search(r"^Pages:\s+(\d+)", result.stdout, flags=re.MULTILINE)
    pages = int(match.group(1)) if match else 0
    encrypted = re.search(r"^Encrypted:\s+(\S+)", result.stdout, flags=re.MULTILINE)
    audit.check(bool(encrypted and encrypted.group(1).lower() == "no"), f"{label} PDF is encrypted or status unavailable")
    audit.check("JavaScript:      no" in result.stdout or "JavaScript:" not in result.stdout, f"{label} PDF contains JavaScript")
    return pages, result.stdout


def render_pdf(path: Path, output_prefix: Path, audit: Audit, label: str) -> list[Path]:
    result = run(["pdftoppm", "-png", "-r", "72", str(path), str(output_prefix)], timeout=240)
    audit.check(result.returncode == 0, f"pdftoppm failed for {label}: " + (result.stdout + result.stderr)[-2000:])
    return sorted(output_prefix.parent.glob(output_prefix.name + "-*.png"))


def validate_visuals(root: Path, audit: Audit) -> None:
    for tool in REQUIRED_OPEN_SOURCE_TOOLS:
        audit.check(shutil.which(tool) is not None, f"required open-source visual tool is unavailable: {tool}")
    if any(shutil.which(tool) is None for tool in REQUIRED_OPEN_SOURCE_TOOLS):
        return

    images = [
        "01_EXECUTIVE/03_ARCHITECTURE_DIAGRAM.png",
        "01_EXECUTIVE/04_INVENTORY_READINESS_SNAPSHOT.png",
        "01_EXECUTIVE/07_OPEN_SOURCE_RUNTIME_ARCHITECTURE.png",
    ]
    for rel in images:
        try:
            with Image.open(root / rel) as image:
                image.verify()
            with Image.open(root / rel) as image:
                audit.check(image.width >= 1000 and image.height >= 600, f"image dimensions too small: {rel}")
        except Exception as exc:
            audit.check(False, f"image unreadable: {rel}: {exc}")

    pptx = root / "01_EXECUTIVE/02_EXECUTIVE_VISUAL_BRIEF_EDITABLE.pptx"
    shipped_pdf = root / "01_EXECUTIVE/01_EXECUTIVE_VISUAL_BRIEF.pdf"
    slide_count, pptx_text = validate_pptx_bounds(pptx, audit)
    audit.check("OPEN-SOURCE" in pptx_text.upper(), "visual brief lacks open-source decision")
    audit.check("SUPER GAUNTLET" in pptx_text.upper(), "visual brief lacks super-gauntlet evidence")
    audit.check(str(EXPECTED_TOTAL_TESTS) in pptx_text, f"visual brief does not show current {EXPECTED_TOTAL_TESTS}-test count")

    shipped_pages, shipped_info = pdf_page_count(shipped_pdf, audit, "shipped")
    audit.check(shipped_pages == EXPECTED_SLIDES, f"expected {EXPECTED_SLIDES} shipped PDF pages, observed {shipped_pages}")
    audit.check(shipped_pages == slide_count, "shipped PDF/PPTX page count mismatch")
    audit.check("Tagged:          yes" in shipped_info, "shipped PDF is not tagged")

    fonts = run(["pdffonts", str(shipped_pdf)])
    audit.check(fonts.returncode == 0, "pdffonts failed: " + fonts.stderr[-1000:])
    font_rows = [line for line in fonts.stdout.splitlines()[2:] if line.strip()] if fonts.returncode == 0 else []
    audit.check(bool(font_rows), "PDF contains no discoverable fonts")
    nonembedded: list[str] = []
    for line in font_rows:
        match = re.search(r"\s+(yes|no)\s+(yes|no)\s+(yes|no)\s+\d+\s+\d+\s*$", line)
        if not match or match.group(1) != "yes":
            nonembedded.append(line)
    audit.check(not nonembedded, "PDF has non-embedded fonts: " + " | ".join(nonembedded[:5]))

    text_result = run(["pdftotext", "-layout", str(shipped_pdf), "-"])
    audit.check(text_result.returncode == 0, "pdftotext failed: " + text_result.stderr[-1000:])
    pdf_text = text_result.stdout
    audit.check("Open-Source Visual Packet" in pdf_text, "PDF title text missing")
    audit.check(str(EXPECTED_TOTAL_TESTS) in pdf_text, f"PDF does not show current {EXPECTED_TOTAL_TESTS}-test count")

    with tempfile.TemporaryDirectory(prefix="pse_visual_gauntlet_") as temp_name:
        temp = Path(temp_name)
        outdir = temp / "converted"
        profile = temp / "libreoffice-profile"
        outdir.mkdir()
        profile.mkdir()
        conversion = run(
            [
                "libreoffice",
                f"-env:UserInstallation={profile.as_uri()}",
                "--headless",
                "--convert-to",
                "pdf",
                "--outdir",
                str(outdir),
                str(pptx),
            ],
            timeout=240,
        )
        audit.check(conversion.returncode == 0, "LibreOffice PPTX conversion failed: " + (conversion.stdout + conversion.stderr)[-2000:])
        generated_pdf = outdir / (pptx.stem + ".pdf")
        audit.check(generated_pdf.is_file(), "LibreOffice did not produce the comparison PDF")
        if not generated_pdf.is_file():
            return
        generated_pages, _ = pdf_page_count(generated_pdf, audit, "regenerated")
        audit.check(generated_pages == EXPECTED_SLIDES, f"expected {EXPECTED_SLIDES} regenerated pages, observed {generated_pages}")

        shipped_renders = render_pdf(shipped_pdf, temp / "shipped", audit, "shipped")
        generated_renders = render_pdf(generated_pdf, temp / "generated", audit, "regenerated")
        audit.check(len(shipped_renders) == EXPECTED_SLIDES, f"expected {EXPECTED_SLIDES} shipped raster pages, observed {len(shipped_renders)}")
        audit.check(len(generated_renders) == EXPECTED_SLIDES, f"expected {EXPECTED_SLIDES} regenerated raster pages, observed {len(generated_renders)}")
        max_mean_difference = 0.0
        if len(shipped_renders) == len(generated_renders):
            for left_path, right_path in zip(shipped_renders, generated_renders):
                with Image.open(left_path).convert("RGB") as left, Image.open(right_path).convert("RGB") as right:
                    audit.check(left.size == right.size, f"raster page size mismatch: {left_path.name}")
                    if left.size != right.size:
                        continue
                    difference = ImageChops.difference(left, right)
                    means = ImageStat.Stat(difference).mean
                    page_mean = sum(means) / len(means)
                    max_mean_difference = max(max_mean_difference, page_mean)
            audit.check(max_mean_difference <= 0.75, f"editable PPTX and shipped PDF visual parity exceeded threshold: {max_mean_difference:.4f}")
        audit.evidence["maxMeanPixelDifference"] = round(max_mean_difference, 6)

    audit.evidence["slideCount"] = slide_count
    audit.evidence["pdfPages"] = shipped_pages
    audit.evidence["libreOfficeVersion"] = (run(["libreoffice", "--version"]).stdout or run(["libreoffice", "--version"]).stderr).strip()


def validate_manifest(root: Path, audit: Audit) -> None:
    manifest_path = root / "09_RELEASE/PACKAGE_MANIFEST.csv"
    sums_path = root / "09_RELEASE/SHA256SUMS.txt"
    expected = expected_manifest_paths(root)
    try:
        with manifest_path.open(encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            manifest = list(reader)
            columns = set(reader.fieldnames or [])
    except Exception as exc:
        audit.check(False, f"manifest unreadable: {exc}")
        return
    audit.check({"path", "bytes", "sha256", "category"} <= columns, "manifest columns incomplete")
    names = {row.get("path", "") for row in manifest}
    audit.check(names == expected, f"manifest path mismatch; missing={sorted(expected-names)[:10]} extra={sorted(names-expected)[:10]}")
    audit.check(len(names) == len(manifest), "manifest contains duplicate paths")
    for row in manifest:
        rel = row.get("path", "")
        path = root / rel
        if not path.is_file():
            continue
        audit.check(str(path.stat().st_size) == row.get("bytes"), f"manifest size mismatch: {rel}")
        audit.check(hashlib.sha256(path.read_bytes()).hexdigest() == row.get("sha256"), f"manifest hash mismatch: {rel}")

    sums: dict[str, str] = {}
    try:
        for line in sums_path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            digest, name = line.split("  ", 1)
            sums[name] = digest
    except Exception as exc:
        audit.check(False, f"SHA256SUMS unreadable: {exc}")
        return
    audit.check(set(sums) == expected, "SHA256SUMS path set mismatch")
    for rel, digest in sums.items():
        audit.check(hashlib.sha256((root / rel).read_bytes()).hexdigest() == digest, f"SHA256SUMS mismatch: {rel}")
    audit.evidence["manifestedFiles"] = len(expected)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("packet", nargs="?", type=Path, default=Path("."))
    parser.add_argument("--bootstrap", action="store_true", help="Run every gate except final release metadata, manifest and checksums.")
    args = parser.parse_args()
    root = args.packet.resolve()
    audit = Audit()

    required = [
        "00_START_HERE.md", "VERSION.txt", "CONTRACT_VERSION.txt", "LICENSE", "NOTICE", "SECURITY.md", "CONTRIBUTING.md", "CHANGELOG.md",
        "01_EXECUTIVE/01_EXECUTIVE_VISUAL_BRIEF.pdf", "01_EXECUTIVE/02_EXECUTIVE_VISUAL_BRIEF_EDITABLE.pptx",
        "01_EXECUTIVE/03_ARCHITECTURE_DIAGRAM.png", "01_EXECUTIVE/04_INVENTORY_READINESS_SNAPSHOT.png",
        "01_EXECUTIVE/07_OPEN_SOURCE_RUNTIME_ARCHITECTURE.png",
        "02_IMPLEMENTATION/01_MASTER_GAMEPLAN.md", "02_IMPLEMENTATION/02_ENGINEERING_HANDOFF_PROMPT.txt", "02_IMPLEMENTATION/10_TASK_BY_TASK_IMPLEMENTATION_PLAN.md",
        "02_IMPLEMENTATION/03_PHASE_0_DISCOVERY_WORKSHEET.md", "02_IMPLEMENTATION/04_IMPLEMENTATION_WORK_BREAKDOWN.md",
        "02_IMPLEMENTATION/05_MIGRATION_AND_CUTOVER_PLAN.md", "02_IMPLEMENTATION/09_DEFINITION_OF_DONE.md",
        "03_CONTRACTS/canonical_inventory_record.schema.json", "03_CONTRACTS/public_inventory_item.schema.json",
        "03_CONTRACTS/public_inventory_snapshot.schema.json", "03_CONTRACTS/public_inventory_list_response.schema.json",
        "03_CONTRACTS/public_inventory_api.openapi.yaml", "03_CONTRACTS/internal_operations_api.openapi.yaml",
        "03_CONTRACTS/internal_operations_response.schema.json", "03_CONTRACTS/publish_gate_rules.json",
        "03_CONTRACTS/privacy_field_denylist.json", "03_CONTRACTS/public_private_field_map.csv",
        "04_REFERENCE_IMPLEMENTATION/publisher.py", "04_REFERENCE_IMPLEMENTATION/atomic_store.py",
        "04_REFERENCE_IMPLEMENTATION/revalidation.py", "04_REFERENCE_IMPLEMENTATION/requirements.lock",
        "05_INTEGRATION/00_NO_PROPRIETARY_AI_AND_OPEN_SOURCE_POLICY.md",
        "05_INTEGRATION/01_OPENAPI_STANDARD_CLARIFICATION.md", "05_INTEGRATION/05_HMAC_REVALIDATION_SPEC.md",
        "06_OPERATIONS/01_DEPLOYMENT_READINESS_CHECKLIST.md", "06_OPERATIONS/02_ROLLBACK_RUNBOOK.md",
        "06_OPERATIONS/03_INCIDENT_RESPONSE_RUNBOOK.md", "06_OPERATIONS/04_MONITORING_AND_ALERTING.md",
        "06_OPERATIONS/05_BACKUP_RESTORE_RUNBOOK.md", "06_OPERATIONS/09_THREAT_MODEL.md",
        "06_OPERATIONS/10_SECURITY_CONTROL_MATRIX.csv",
        "07_GAUNTLET/GAUNTLET_MATRIX.csv", "07_GAUNTLET/CLEAN_ROOM_RUNBOOK.md", "07_GAUNTLET/run_super_gauntlet.py",
        "07_GAUNTLET/cross_reference_lint.py",
        "08_SOURCE_EVIDENCE/01_CURRENT_PUBLIC_SITE_AUDIT.md", "08_SOURCE_EVIDENCE/02_CURRENT_INVENTORY_SOURCE_AUDIT.md",
        "08_SOURCE_EVIDENCE/03_RESEARCH_SOURCES.md", "08_SOURCE_EVIDENCE/04_SOURCE_PROVENANCE_REGISTER.csv",
        "08_SOURCE_EVIDENCE/05_SANITIZED_CANDIDATE_AUDIT_ROWS.csv", "08_SOURCE_EVIDENCE/06_SANITIZED_CANONICAL_AUDIT_ROWS.csv",
        "08_SOURCE_EVIDENCE/07_SOURCE_AUDIT_BASELINE.json", "08_SOURCE_EVIDENCE/audit_sanitized_sources.py",
        "09_RELEASE/01_RELEASE_NOTES.md", "09_RELEASE/generate_release_metadata.py", "09_RELEASE/build_deterministic_zip.py", "09_RELEASE/release_v4.py",
        "10_OPEN_SOURCE/01_OPEN_SOURCE_STACK_BLUEPRINT.md", "10_OPEN_SOURCE/02_DEPENDENCY_LICENSE_REGISTER.csv",
        "10_OPEN_SOURCE/03_SBOM.spdx.json", "10_OPEN_SOURCE/04_LICENSE_AND_SUPPLY_CHAIN_POLICY.md",
        "10_OPEN_SOURCE/05_COMPONENT_PINNING_REGISTER.template.csv", "10_OPEN_SOURCE/06_OPEN_SOURCE_ADOPTION_DECISION.md",
        "10_OPEN_SOURCE/07_VERIFIED_REFERENCE_VERSIONS.md",
        "11_RUNNABLE_REFERENCE_STACK/README.md", "11_RUNNABLE_REFERENCE_STACK/SHARED_STATE_AND_CONTROL_PLANE_ADAPTERS.md", "11_RUNNABLE_REFERENCE_STACK/requirements.runtime.lock",
        "11_RUNNABLE_REFERENCE_STACK/requirements.test.lock",
        "11_RUNNABLE_REFERENCE_STACK/app/main.py", "11_RUNNABLE_REFERENCE_STACK/app/server.py",
        "11_RUNNABLE_REFERENCE_STACK/data/current.json", "11_RUNNABLE_REFERENCE_STACK/db/001_inventory_control_plane.sql",
        "11_RUNNABLE_REFERENCE_STACK/db/002_role_grants.sql", "11_RUNNABLE_REFERENCE_STACK/deploy/compose.yaml",
        "11_RUNNABLE_REFERENCE_STACK/deploy/Dockerfile", "11_RUNNABLE_REFERENCE_STACK/deploy/Caddyfile",
        "11_RUNNABLE_REFERENCE_STACK/site/index.html", "11_RUNNABLE_REFERENCE_STACK/site/bootstrap.js",
        "11_RUNNABLE_REFERENCE_STACK/site/catalog.js", "11_RUNNABLE_REFERENCE_STACK/site/catalog.test.mjs",
    ]
    if not args.bootstrap:
        required.extend([
            "09_RELEASE/02_GAUNTLET_RESULTS.json", "09_RELEASE/03_RELEASE_DECISION.md",
            "09_RELEASE/04_PACKET_CONTENTS_INDEX.md", "09_RELEASE/PACKAGE_MANIFEST.csv", "09_RELEASE/SHA256SUMS.txt",
        ])
    for rel in required:
        audit.check((root / rel).is_file(), f"missing required file: {rel}")

    try:
        versions = parse_version_file(root / "VERSION.txt")
    except Exception as exc:
        audit.check(False, f"VERSION.txt invalid: {exc}")
        versions = {}
    audit.check(versions.get("packetVersion") == PACKET_VERSION, "packet version mismatch")
    audit.check(versions.get("contractVersion") == CONTRACT_VERSION, "contract version mismatch")
    audit.check(versions.get("releaseProfile") == "OPEN_SOURCE_SUPER_GAUNTLET", "release profile mismatch")
    contract_file = (root / "CONTRACT_VERSION.txt").read_text(encoding="utf-8").strip() if (root / "CONTRACT_VERSION.txt").is_file() else ""
    audit.check(contract_file == CONTRACT_VERSION, "CONTRACT_VERSION.txt mismatch")

    files = sorted(path for path in root.rglob("*") if path.is_file())
    generated_cache = [
        path.relative_to(root).as_posix()
        for path in files
        if "__pycache__" in path.parts or ".pytest_cache" in path.parts or path.name.endswith(".pyc") or path.name == ".DS_Store"
    ]
    audit.check(not generated_cache, "generated cache or desktop files are present: " + ", ".join(generated_cache[:20]))

    placeholders: list[str] = []
    secrets: list[str] = []
    proprietary_runtime: list[str] = []
    broken_refs: list[str] = []
    for path in files:
        if path.suffix.lower() not in TEXT_EXTENSIONS:
            continue
        rel = path.relative_to(root).as_posix()
        text = path.read_text(encoding="utf-8", errors="replace")
        if rel not in PLACEHOLDER_ALLOWED:
            for marker in ("TODO", "TBD", "FIXME", "LINK PENDING"):
                if re.search(rf"\b{re.escape(marker)}\b", text, flags=re.I):
                    placeholders.append(f"{rel}:{marker}")
        for name, pattern in SECRET_PATTERNS.items():
            if pattern.search(text):
                secrets.append(f"{rel}:{name}")
        if rel not in DOCUMENTED_PROPRIETARY_MENTION_ALLOWED:
            for name, pattern in PROPRIETARY_AI_RUNTIME_PATTERNS.items():
                if pattern.search(text):
                    proprietary_runtime.append(f"{rel}:{name}")
        if path.suffix.lower() in {".md", ".txt"}:
            for token in markdown_local_links(text):
                normalized = token.lstrip("./")
                if rel == TARGET_REPO_PLAN and normalized.startswith(TARGET_REPO_PREFIXES):
                    continue
                if re.match(r"^(?:0[0-9]_|1[01]_|VERSION|CONTRACT_VERSION)", normalized):
                    candidate = (root / normalized).resolve()
                else:
                    candidate = (path.parent / token).resolve()
                try:
                    candidate.relative_to(root)
                except ValueError:
                    continue
                generated = normalized in {"09_RELEASE/02_GAUNTLET_RESULTS.json", "09_RELEASE/03_RELEASE_DECISION.md", "09_RELEASE/04_PACKET_CONTENTS_INDEX.md", "09_RELEASE/PACKAGE_MANIFEST.csv", "09_RELEASE/SHA256SUMS.txt"}
                if not candidate.exists() and not (args.bootstrap and generated):
                    broken_refs.append(f"{rel} -> {token}")
    audit.check(not placeholders, "unresolved placeholders: " + ", ".join(placeholders[:25]))
    audit.check(not secrets, "possible embedded secrets: " + ", ".join(secrets[:25]))
    audit.check(not proprietary_runtime, "proprietary AI runtime reference outside policy docs: " + ", ".join(proprietary_runtime[:25]))
    audit.check(not broken_refs, "broken packet-local references: " + ", ".join(broken_refs[:30]))
    proprietary_skill_root = "/" + "home" + "/" + "oai"
    audit.check(proprietary_skill_root not in (root / "07_GAUNTLET/run_super_gauntlet.py").read_text(encoding="utf-8"), "gauntlet depends on a proprietary product-specific filesystem path")

    trace("text, secret, reference and Python-source scans complete")
    validate_python_sources(root, audit)

    cross_refs = run([sys.executable, str(root / "07_GAUNTLET/cross_reference_lint.py"), str(root)])
    audit.check(cross_refs.returncode == 0, "cross-reference linter failed: " + (cross_refs.stdout + cross_refs.stderr)[-3000:])

    trace("cross-reference lint complete; running source audit")
    source_audit = run([sys.executable, str(root / "08_SOURCE_EVIDENCE/audit_sanitized_sources.py"), str(root)])
    try:
        observed_source_audit = json.loads(source_audit.stdout) if source_audit.returncode == 0 else {}
    except json.JSONDecodeError:
        observed_source_audit = {}
    source_audit_baseline = read_json(root / "08_SOURCE_EVIDENCE/07_SOURCE_AUDIT_BASELINE.json")
    expected_source_audit = source_audit_baseline.get("expected", source_audit_baseline)
    audit.check(source_audit.returncode == 0, "sanitized-source audit failed: " + (source_audit.stdout + source_audit.stderr)[-3000:])
    audit.check(observed_source_audit == expected_source_audit, f"source-audit drift: expected={expected_source_audit} observed={observed_source_audit}")
    audit.evidence["sourceAudit"] = observed_source_audit

    compose_path = root / "11_RUNNABLE_REFERENCE_STACK/deploy/compose.yaml"
    compose_text = compose_path.read_text(encoding="utf-8")
    compose = yaml.safe_load(compose_text)
    for pinned_image in (
        "postgres:18.4-alpine", "valkey/valkey:9.1.0-alpine", "caddy:2.11.4-alpine",
        "prom/prometheus:v3.12.0", "prom/alertmanager:v0.32.1",
    ):
        audit.check(pinned_image in compose_text, f"reference compose file is missing pinned image {pinned_image}")
    audit.check(":latest" not in compose_text, "reference compose file uses a floating latest tag")
    audit.check(compose.get("name") == "pse-inventory-single-process-reference", "compose overstates the runnable reference deployment mode")
    services = compose.get("services", {})
    audit.check(services.get("postgres", {}).get("profiles") == ["control-plane-preview"], "PostgreSQL must be an explicit control-plane preview profile")
    audit.check(services.get("valkey", {}).get("profiles") == ["shared-state-preview"], "Valkey must be an explicit shared-state preview profile")
    default_services = {name for name, service in services.items() if not service.get("profiles")}
    audit.check(default_services == {"api", "caddy", "prometheus", "alertmanager"}, "default compose services do not match the approved single-process reference")
    adapter_contract = (root / "11_RUNNABLE_REFERENCE_STACK/SHARED_STATE_AND_CONTROL_PLANE_ADAPTERS.md").read_text(encoding="utf-8")
    for required in ("Production multi-replica gate", "SET key value NX EX ttl_seconds", "INCR", "EXPIRE", "fail closed"):
        audit.check(required in adapter_contract, f"shared-state/control-plane adapter contract is missing: {required}")
    csp_text = (root / "11_RUNNABLE_REFERENCE_STACK/deploy/Caddyfile").read_text(encoding="utf-8")
    index_text = (root / "11_RUNNABLE_REFERENCE_STACK/site/index.html").read_text(encoding="utf-8")
    audit.check("script-src 'self'" in csp_text, "Caddy CSP does not restrict scripts to self")
    audit.check('<script type="module" src="./bootstrap.js"></script>' in index_text and '<script type="module">' not in index_text, "catalog bootstrap conflicts with script-src self CSP")

    trace("source, compose and CSP checks complete; validating supply chain")
    # Open-source and supply-chain controls.
    register_path = root / "10_OPEN_SOURCE/02_DEPENDENCY_LICENSE_REGISTER.csv"
    try:
        with register_path.open(encoding="utf-8", newline="") as handle:
            register = list(csv.DictReader(handle))
    except Exception as exc:
        register = []
        audit.check(False, f"dependency register unreadable: {exc}")
    audit.check(bool(register), "dependency register is empty")
    audit.check(all(row.get("Open Source") == "YES" for row in register), "dependency register contains a non-open-source component")
    audit.check(all(row.get("License") for row in register), "dependency register contains an unlicensed component")
    components = {row.get("Component") for row in register}
    required_components = {
        "Python", "PostgreSQL", "FastAPI", "Valkey", "Caddy", "Prometheus", "Alertmanager",
        "OpenAPI Specification", "Pillow", "LibreOffice", "Poppler utilities",
    }
    audit.check(required_components <= components, "dependency register is missing required open-source components")

    sbom = read_json(root / "10_OPEN_SOURCE/03_SBOM.spdx.json")
    audit.check(sbom.get("spdxVersion") == "SPDX-2.3", "SBOM is not SPDX 2.3")
    packages = sbom.get("packages", [])
    audit.check(bool(packages), "SBOM contains no packages")
    audit.check(all(pkg.get("licenseDeclared") not in {None, "NOASSERTION"} for pkg in packages), "SBOM has undeclared licenses")
    sbom_versions = {pkg["name"].lower(): pkg.get("versionInfo") for pkg in packages if pkg.get("name")}

    reference_pairs = load_pinned_requirements(root / "04_REFERENCE_IMPLEMENTATION/requirements.lock", audit)
    runtime_pairs = load_pinned_requirements(root / "11_RUNNABLE_REFERENCE_STACK/requirements.runtime.lock", audit)
    test_pairs = load_pinned_requirements(root / "11_RUNNABLE_REFERENCE_STACK/requirements.test.lock", audit)
    all_locked_pairs = dict(reference_pairs)
    all_locked_pairs.update(runtime_pairs)
    all_locked_pairs.update(test_pairs)
    for name, value in all_locked_pairs.items():
        audit.check(sbom_versions.get(name.lower()) == value, f"SBOM/requirements version mismatch for {name}")
        try:
            actual = installed_version(name)
        except PackageNotFoundError:
            actual = "MISSING"
        audit.check(actual == value, f"installed verification dependency mismatch for {name}: expected {value}, observed {actual}")
    audit.evidence["lockedPythonPackages"] = len(all_locked_pairs)

    requirements = (root / "04_REFERENCE_IMPLEMENTATION/requirements.txt").read_text(encoding="utf-8").strip()
    audit.check(requirements == "-r requirements.lock", "requirements.txt must delegate only to requirements.lock")
    policy_text = (root / "05_INTEGRATION/00_NO_PROPRIETARY_AI_AND_OPEN_SOURCE_POLICY.md").read_text(encoding="utf-8").lower()
    blueprint_text = (root / "10_OPEN_SOURCE/01_OPEN_SOURCE_STACK_BLUEPRINT.md").read_text(encoding="utf-8").lower()
    audit.check("no llm is required" in blueprint_text, "open-source blueprint does not explicitly remove LLM dependency")
    audit.check("deterministic" in policy_text, "open-source policy does not require deterministic publication")
    publisher_text = (root / "04_REFERENCE_IMPLEMENTATION/publisher.py").read_text(encoding="utf-8").lower()
    audit.check("openai" not in publisher_text and "ollama" not in publisher_text and "llm" not in publisher_text, "authoritative publisher depends on AI")

    trace("supply-chain checks complete; validating contracts")
    # Contract validation.
    contracts = root / "03_CONTRACTS"
    checker = FormatChecker()
    schemas: dict[str, dict[str, Any]] = {}
    for name in ("canonical_inventory_record.schema.json", "public_inventory_item.schema.json", "public_inventory_snapshot.schema.json"):
        schema = read_json(contracts / name)
        schemas[name] = schema
        try:
            Draft202012Validator.check_schema(schema)
            audit.check(True, "")
        except Exception as exc:
            audit.check(False, f"invalid JSON schema {name}: {exc}")
        audit.check(schema.get("properties", {}).get("schemaVersion", {}).get("const") == CONTRACT_VERSION, f"schema version mismatch: {name}")

    for schema_name, example_name in [
        ("canonical_inventory_record.schema.json", "canonical_inventory_record.example.json"),
        ("public_inventory_item.schema.json", "public_inventory_item.example.json"),
    ]:
        errors = list(Draft202012Validator(schemas[schema_name], format_checker=checker).iter_errors(read_json(contracts / example_name)))
        audit.check(not errors, f"invalid example {example_name}: " + "; ".join(error.message for error in errors[:5]))

    public_schema = schemas["public_inventory_item.schema.json"]
    snapshot_schema = schemas["public_inventory_snapshot.schema.json"]
    registry = Registry().with_resource(public_schema["$id"], Resource.from_contents(public_schema))
    snapshot_errors = list(
        Draft202012Validator(snapshot_schema, registry=registry, format_checker=checker).iter_errors(
            read_json(contracts / "public_inventory_snapshot.example.json")
        )
    )
    audit.check(not snapshot_errors, "invalid public snapshot example: " + "; ".join(error.message for error in snapshot_errors[:5]))

    api_path = contracts / "public_inventory_api.openapi.yaml"
    api = yaml.safe_load(api_path.read_text(encoding="utf-8"))
    audit.check(api.get("openapi") == "3.1.0", "public OpenAPI document must use OAS 3.1.0")
    audit.check(api.get("info", {}).get("version") == CONTRACT_VERSION, "public OpenAPI contract version mismatch")
    expected_endpoints = {"/inventory", "/inventory/{slug}", "/internal/inventory/revalidate"}
    audit.check(set(api.get("paths", {})) == expected_endpoints, "public OpenAPI endpoint set mismatch")
    for ref in collect_refs(api):
        if not ref.startswith("#"):
            audit.check((api_path.parent / ref.split("#", 1)[0]).is_file(), f"broken public OpenAPI reference: {ref}")
    params = api["paths"]["/internal/inventory/revalidate"]["post"]["parameters"]
    headers = {param["name"] for param in params if param.get("in") == "header"}
    expected_headers = {"X-PSE-Key-Id", "X-PSE-Timestamp", "X-PSE-Nonce", "X-PSE-Content-SHA256", "X-PSE-Signature"}
    audit.check(headers == expected_headers, "OpenAPI HMAC header contract mismatch")

    internal_api_path = contracts / "internal_operations_api.openapi.yaml"
    internal_api = yaml.safe_load(internal_api_path.read_text(encoding="utf-8"))
    audit.check(internal_api.get("openapi") == "3.1.0", "internal OpenAPI document must use OAS 3.1.0")
    audit.check(internal_api.get("info", {}).get("version") == CONTRACT_VERSION, "internal OpenAPI contract version mismatch")
    for ref in collect_refs(internal_api):
        if not ref.startswith("#"):
            audit.check((internal_api_path.parent / ref.split("#", 1)[0]).is_file(), f"broken internal OpenAPI reference: {ref}")
    audit.check(not (root / "04_REFERENCE_IMPLEMENTATION/hmac_revalidation.py").exists(), "divergent HMAC implementation remains in packet")

    trace("contract checks complete; running legacy test suite")
    # Full executable reference, runtime, browser, recovery, security and adversarial suites.
    ref = root / "04_REFERENCE_IMPLEMENTATION"
    legacy = run([sys.executable, "-m", "unittest", "discover", "-s", "tests", "-v"], cwd=ref, timeout=240)
    legacy_output = legacy.stdout + legacy.stderr
    audit.check(legacy.returncode == 0, "legacy reference/adversarial tests failed: " + legacy_output[-7000:])
    legacy_count = count_unittest_successes(legacy_output)
    audit.check(legacy_count == EXPECTED_LEGACY_TESTS, f"expected exactly {EXPECTED_LEGACY_TESTS} legacy tests, observed {legacy_count}")
    audit.check("250_deterministic_single_invariant_mutations" in legacy_output, "mutation gauntlet did not execute")
    audit.check("5000_record_snapshot_build" in legacy_output, "5,000-record performance test did not execute")

    trace("legacy test suite complete; running runtime test suite")
    runtime_root = root / "11_RUNNABLE_REFERENCE_STACK"
    runtime = run([sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider"], cwd=runtime_root, timeout=240)
    runtime_output = runtime.stdout + runtime.stderr
    audit.check(runtime.returncode == 0, "runnable stack tests failed: " + runtime_output[-7000:])
    runtime_count = count_pytest_successes(runtime_output)
    audit.check(runtime_count == EXPECTED_RUNTIME_TESTS, f"expected exactly {EXPECTED_RUNTIME_TESTS} runtime tests, observed {runtime_count}")

    trace("runtime test suite complete; running Node catalog suite")
    node = run(["node", "--test", "site/catalog.test.mjs"], cwd=runtime_root, timeout=120)
    node_output = node.stdout + node.stderr
    audit.check(node.returncode == 0, "catalog JavaScript tests failed: " + node_output[-4000:])
    node_count = count_node_successes(node_output)
    audit.check(node_count == EXPECTED_NODE_TESTS, f"expected exactly {EXPECTED_NODE_TESTS} node tests, observed {node_count}")

    total_test_count = legacy_count + runtime_count + node_count
    audit.check(total_test_count == EXPECTED_TOTAL_TESTS, f"expected exactly {EXPECTED_TOTAL_TESTS} total tests, observed {total_test_count}")
    audit.evidence.update({
        "legacyTestCount": legacy_count,
        "runtimeTestCount": runtime_count,
        "nodeTestCount": node_count,
        "totalAutomatedTests": total_test_count,
    })

    trace("automated test suites complete; validating visuals")
    validate_visuals(root, audit)

    trace("visual validation complete; validating gate matrix")
    matrix = list(csv.DictReader((root / "07_GAUNTLET/GAUNTLET_MATRIX.csv").open(encoding="utf-8", newline="")))
    packet_rows = [row for row in matrix if row.get("Scope") == "PACKET"]
    production_rows = [row for row in matrix if row.get("Scope") == "PRODUCTION"]
    audit.check(bool(packet_rows) and all(row.get("Status") == "PASS" for row in packet_rows), "packet gauntlet matrix contains non-PASS packet rows")
    audit.check(bool(production_rows) and all(row.get("Status") == "BLOCKED" for row in production_rows), "production matrix must remain BLOCKED until live evidence exists")
    audit.check(len(packet_rows) >= 52, "gauntlet matrix does not contain all packet gates")
    audit.check(len(production_rows) >= 10, "gauntlet matrix does not contain all production gates")

    if not args.bootstrap:
        trace("packet gates complete; validating stored evidence and manifest")
        stored = read_json(root / "09_RELEASE/02_GAUNTLET_RESULTS.json")
        audit.check(stored.get("result") == "PASS", "stored gauntlet result is not PASS")
        evidence = stored.get("evidence", {})
        audit.check(evidence.get("legacyTestCount") == EXPECTED_LEGACY_TESTS, "stored legacy test count is stale")
        audit.check(evidence.get("runtimeTestCount") == EXPECTED_RUNTIME_TESTS, "stored runtime test count is stale")
        audit.check(evidence.get("nodeTestCount") == EXPECTED_NODE_TESTS, "stored node test count is stale")
        audit.check(evidence.get("totalAutomatedTests") == EXPECTED_TOTAL_TESTS, "stored total test count is stale")
        stored_source_baseline = read_json(root / "08_SOURCE_EVIDENCE/07_SOURCE_AUDIT_BASELINE.json")
        audit.check(evidence.get("sourceAudit") == stored_source_baseline.get("expected", stored_source_baseline), "stored source audit is stale")
        audit.check(stored.get("productionIntegration") == "NOT_DEPLOYED", "stored result misstates production status")
        decision = (root / "09_RELEASE/03_RELEASE_DECISION.md").read_text(encoding="utf-8")
        audit.check("ENGINEERING_HANDOFF_READY" in decision, "release decision does not approve engineering handoff")
        audit.check("PRODUCTION_NOT_DEPLOYED" in decision, "release decision does not preserve production truth boundary")
        validate_manifest(root, audit)

    trace("gauntlet result assembled")
    result = {
        "packetVersion": PACKET_VERSION,
        "contractVersion": CONTRACT_VERSION,
        "releaseProfile": "OPEN_SOURCE_SUPER_GAUNTLET",
        "result": "PASS" if not audit.failures else "FAIL",
        "checks": audit.checks,
        "failures": audit.failures,
        "evidence": audit.evidence,
        "productionIntegration": "NOT_DEPLOYED",
        "productionBlocker": "Website repository/hosting and authoritative SalesMax runtime/database not available in this verification environment.",
    }
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if not audit.failures else 1


if __name__ == "__main__":
    raise SystemExit(main())
