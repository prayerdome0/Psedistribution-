from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[1]


def test_database_migration_separates_private_public_and_audit_schemas() -> None:
    sql = (ROOT / "db/001_inventory_control_plane.sql").read_text(encoding="utf-8").lower()
    for schema in ("private_inventory", "public_inventory", "audit"):
        assert f"create schema if not exists {schema}" in sql
    assert "create table if not exists private_inventory.canonical_deals" in sql
    assert "create table if not exists public_inventory.snapshots" in sql
    assert "create table if not exists audit.publish_runs" in sql
    assert "unique" in sql and "active" in sql


def test_role_grants_never_allow_storefront_to_read_private_schema() -> None:
    sql = (ROOT / "db/002_role_grants.sql").read_text(encoding="utf-8").lower()
    assert "revoke all on schema private_inventory from pse_storefront" in sql
    assert "grant select on public_inventory.active_snapshot to pse_storefront" in sql
    assert "grant usage on schema public_inventory to pse_storefront" in sql


def test_compose_is_honest_single_process_reference_with_preview_state_profiles() -> None:
    compose_path = ROOT / "deploy/compose.yaml"
    compose = yaml.safe_load(compose_path.read_text(encoding="utf-8"))
    services = compose["services"]
    assert compose["name"] == "pse-inventory-single-process-reference"
    assert {"api", "postgres", "valkey", "caddy", "prometheus", "alertmanager"} <= set(services)
    assert services["postgres"]["profiles"] == ["control-plane-preview"]
    assert services["valkey"]["profiles"] == ["shared-state-preview"]
    assert "depends_on" not in services["api"]
    assert "PSE_VALKEY_URL" not in services["api"].get("environment", {})
    default_services = {name for name, service in services.items() if not service.get("profiles")}
    assert default_services == {"api", "caddy", "prometheus", "alertmanager"}

    text = compose_path.read_text(encoding="utf-8").lower()
    assert "openai" not in text
    assert "anthropic" not in text
    assert "11434" not in text
    assert "postgres:18.4" in text
    assert "valkey/valkey:9.1.0" in text

    readme = (ROOT / "README.md").read_text(encoding="utf-8").lower()
    contract = (ROOT / "SHARED_STATE_AND_CONTROL_PLANE_ADAPTERS.md").read_text(encoding="utf-8").lower()
    assert "single-process reference" in readme
    assert "production multi-replica deployment is blocked" in readme
    for required in ("set nx ex", "incr", "expire", "postgresql", "valkey", "fail closed"):
        assert required in contract


def test_caddy_sets_security_headers_and_proxies_only_expected_routes() -> None:
    text = (ROOT / "deploy/Caddyfile").read_text(encoding="utf-8")
    for header in ("Content-Security-Policy", "Strict-Transport-Security", "X-Content-Type-Options", "Referrer-Policy"):
        assert header in text
    assert "handle /api/*" in text
    assert "reverse_proxy api:8080" in text


def test_catalog_bootstrap_obeys_script_src_self_csp() -> None:
    index = (ROOT / "site/index.html").read_text(encoding="utf-8")
    caddy = (ROOT / "deploy/Caddyfile").read_text(encoding="utf-8")
    assert "script-src 'self'" in caddy
    assert '<script type="module" src="./bootstrap.js"></script>' in index
    assert '<script type="module">' not in index
    bootstrap = ROOT / "site/bootstrap.js"
    assert bootstrap.is_file()
    assert "fetch('/api/inventory?limit=100'" in bootstrap.read_text(encoding="utf-8")


def test_runtime_dependencies_are_exactly_pinned() -> None:
    lines = [line.strip() for line in (ROOT / "requirements.runtime.lock").read_text(encoding="utf-8").splitlines() if line.strip() and not line.startswith("#")]
    assert lines
    assert all("==" in line for line in lines)
    assert any(line.startswith("fastapi==") for line in lines)
    assert any(line.startswith("prometheus-client==") for line in lines)
