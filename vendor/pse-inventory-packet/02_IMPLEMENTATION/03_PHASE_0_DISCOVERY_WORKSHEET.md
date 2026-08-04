# Phase 0 Discovery Worksheet

Complete this worksheet with direct evidence before implementation.

## Repository and deployment

- Repository URL and commit:
- Default branch:
- Framework and version:
- Package manager and lockfile:
- Build command:
- Test command:
- Current deployment provider/project:
- Staging URL:
- Production URL:
- Current rollback method:
- Last known good deployment ID:
- Backup/export location:

## Current website implementation

- Product storage/model:
- Product list route/component:
- Product detail route/component:
- RFQ persistence and notification path:
- Authentication model:
- Cart/order behavior:
- Server-only runtime boundary:
- Existing cache/revalidation mechanism:
- Existing monitoring/logging:

## SalesMax/PSE inventory source

- Authoritative runtime/database or sheet:
- Source owner:
- Existing connector:
- Current primary key:
- Quantity/on-hand source:
- Reservation/hold source:
- Supplier confirmation method:
- Current source timestamps:
- Credential/identity method:
- Backup/export method:

## Security and access

- Publisher identity:
- Storefront reader identity:
- Secret store:
- Key rotation mechanism:
- Network/CORS restrictions:
- Audit log destination:
- Nonce/replay store:

## Discovery exit evidence

Attach exact commands, screenshots/logs, IDs and readbacks proving:

- [ ] Source and deployment are reproducible.
- [ ] Production backup exists and restores in staging.
- [ ] Rollback succeeds.
- [ ] The true inventory authority is identified.
- [ ] Private/public access separation is feasible.
- [ ] No unresolved Critical discovery blocker remains.
