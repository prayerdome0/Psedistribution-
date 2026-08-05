#!/usr/bin/env bash
set -euo pipefail

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${PSE_PUBLISHER_PASSWORD:?PSE_PUBLISHER_PASSWORD is required}"
: "${PSE_STOREFRONT_PASSWORD:?PSE_STOREFRONT_PASSWORD is required}"

# The schema scripts create NOLOGIN roles and least-privilege grants. This
# bootstrap is the only place where deployment-injected role passwords are
# applied; no password is stored in Git or exposed to the browser.
psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=publisher_password="$PSE_PUBLISHER_PASSWORD" \
  --set=storefront_password="$PSE_STOREFRONT_PASSWORD" <<'SQL'
ALTER ROLE pse_publisher LOGIN PASSWORD :'publisher_password';
ALTER ROLE pse_storefront LOGIN PASSWORD :'storefront_password';
SQL
