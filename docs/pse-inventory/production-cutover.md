# Production cutover runbook

The repository now contains the production wiring, but a live cutover is an
operational action and must not be represented by fabricated evidence. The
following items must be supplied through the deployment environment or owner
workflow; no secret belongs in Git or browser JavaScript.

## Required non-secret provisioning

- authoritative SalesMax runtime/API/export URL and authority identifier;
- approved staging and production hostnames;
- DNS/TLS ownership for the host running Caddy;
- PostgreSQL and Valkey endpoints (managed services are preferred);
- owner/delegate identity for per-record approvals;
- approved public image hosts and email/revalidation delivery path.

## Secret-store values

Inject these only into the server or publisher job:

- `PSE_DATABASE_URL` — PostgreSQL URL for the `pse_storefront` role;
- `PSE_PUBLISHER_DATABASE_URL` — separate publisher-role URL;
- `PSE_VALKEY_URL` — TLS/private Valkey URL;
- `PSE_CURSOR_SECRET` — at least 32 bytes;
- `PSE_REVALIDATION_KEYS_JSON` — current and previous HMAC key ring;
- `PSE_AUTHORITY_BEARER_TOKEN` — only when the authority export endpoint requires it;
- PostgreSQL bootstrap and Valkey passwords when using the self-hosted Compose stack.

## Sequence

1. Run the packet gauntlet from a clean extraction and the repository test
   command.
2. Run `docker compose -f services/pse-inventory/deploy/compose.production.yaml
   config` with the external secret store injected.
3. Apply `services/pse-inventory/migrations/001_inventory_control_plane.sql`
   and `002_role_grants.sql`; verify the storefront role cannot read
   `private_inventory`.
4. Import the current authority export with
   `migrations/100_import_verified_inventory.py`. The import is review-only and
   publishes nothing.
5. Reconcile proof, quantity, freshness, public terms, media and pricing mode.
   Record one owner approval bound to the exact source and record versions per
   intended deal.
6. Run `publish_snapshot.py --dry-run`, then promote with the publisher
   database-role URL and a unique run/release ID.
7. Start the production Compose stack or deploy equivalent managed services.
   Caddy serves the static site and same-origin `/api/*` proxy; the API uses
   PostgreSQL and Valkey in `production` mode.
8. Sign the exact revalidation body with the current HMAC key, verify health,
   API/site/RFQ parity, freshness, privacy and monitoring.
9. Execute backup, restore, application rollback and snapshot rollback drills.
10. Only after two clean publication runs and live acceptance evidence are
    captured may `productionStatus` change from `NOT_DEPLOYED`.

Until this sequence is completed against the actual SalesMax source and
hosting environment, the repository correctly remains `NOT_DEPLOYED`.
