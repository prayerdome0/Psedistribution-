# Migration and Cutover Plan

## Migration principles

- Preserve every source row and source hash.
- Create one immutable canonical Deal ID per offer.
- Never infer missing proof, quantity, case pack, UPC, freshness, public price, terms or images.
- Treat the current 73-row status workbook as candidate evidence only.
- Require a separate owner publication decision after reconciliation.

## Cutover sequence

1. Freeze uncontrolled writes and export the private source.
2. Record source hashes, row counts and current identifiers.
3. Migrate into staging canonical storage using the mapping file.
4. Reconcile duplicates and blockers; keep unresolved records unpublished.
5. Run private-schema and ATS validation.
6. Owner approves the exact launch set and terms version.
7. Run publisher in dry-run; review sanitized report and diff.
8. Generate the staged public snapshot and validate it independently.
9. Point staging API/storefront to staged snapshot; run full acceptance.
10. Preserve current production deployment and current public snapshot.
11. Promote public snapshot atomically, then deploy website/API changes.
12. Revalidate cache using signed server-to-server request.
13. Verify source/feed/API/site counts, Deal IDs, timestamps, claims and RFQ.
14. Monitor the stabilization window.
15. Roll back on any Critical issue, privacy finding, parity mismatch or stale-state failure.

## Abort criteria

Abort before promotion when any record lacks approval or freshness, any private field is present, duplicate identity remains, the candidate snapshot is unexpectedly empty, staging parity fails, rollback is unproven, or monitoring is not operational.
