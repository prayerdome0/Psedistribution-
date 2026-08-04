# Runnable Open-Source Reference Stack

This directory turns the packet contracts into an executable **single-process reference** for the buyer-safe inventory API and static catalog. It is not a claim that the live PSE website, SalesMax runtime, PostgreSQL control plane, or shared Valkey state has already been implemented.

## Release boundary

The default Compose path starts one API process behind Caddy plus Prometheus and Alertmanager. It uses:

- an immutable validated JSON snapshot for storefront reads;
- an in-process fixed-window limiter; and
- an in-process HMAC nonce store.

That configuration is intentionally limited to one API replica. **Production multi-replica deployment is blocked** until the shared-state and control-plane adapters in `SHARED_STATE_AND_CONTROL_PLANE_ADAPTERS.md` are implemented, adversarially tested, and approved. PostgreSQL and Valkey are retained only as explicit preview profiles so the packet cannot imply that unused services are already wired.

## Clean local verification

Create an isolated environment from the packet root, then install the exact production, test and packet-gauntlet locks:

```bash
python -m venv .venv
. .venv/bin/activate
python -m pip install --upgrade pip==25.2
python -m pip install \
  -r 04_REFERENCE_IMPLEMENTATION/requirements.lock \
  -r 11_RUNNABLE_REFERENCE_STACK/requirements.runtime.lock \
  -r 11_RUNNABLE_REFERENCE_STACK/requirements.test.lock
cd 11_RUNNABLE_REFERENCE_STACK
PYTHONPATH=. python -m pytest -q
node --test site/catalog.test.mjs
```

The production container installs only `requirements.runtime.lock`; test-only packages are excluded from the deployed image.

## Reference API run

```bash
export PSE_CURSOR_SECRET="$(python -c 'import secrets; print(secrets.token_urlsafe(48))')"
export PSE_REVALIDATION_KEYS_JSON="{\"local-key\":\"$(python -c 'import secrets; print(secrets.token_urlsafe(48))')\"}"
export PSE_SNAPSHOT_FILE="$PWD/data/current.json"
PYTHONPATH=. python -m uvicorn app.server:app --host 127.0.0.1 --port 8080
```

The public catalog is served separately from `site/`. Never run more than one API replica with the in-memory limiter and nonce store.

## Container reference

Run from `deploy/` after copying `.env.example` to `.env` and replacing every secret:

```bash
docker compose config
docker compose up --build
```

The default command starts only the single-process API path, Caddy, Prometheus and Alertmanager. The following optional profiles are architecture previews, not active production integrations:

```bash
# Schema/control-plane preview only; the API does not connect to this database.
docker compose --profile control-plane-preview up postgres

# Shared-state preview only; the API does not connect to this Valkey service.
docker compose --profile shared-state-preview up valkey
```

Do not start either profile as evidence of completed integration. Pin resolved image digests during Phase 0 before any staging or production promotion.
