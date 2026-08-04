# Google Sheets Connector Specification

Use this adapter only if Phase 0 confirms Sheets remains part of the approved source path.

## Identity

- Publisher identity: read private master, write separate public feed, append publish log.
- Storefront identity: read separate public feed only.
- Prefer workload/managed identity; avoid user-managed service-account keys.

## Reads and writes

- Read bounded ranges with one `values.get` or `values.batchGet`, not one call per item.
- Keep payloads bounded; the current Google recommendation is approximately 2 MB maximum for performance.
- Use truncated exponential backoff for 429/time-based failures.
- Treat updates as atomic and write to staging before promotion.
- Never use spreadsheet recalculation time as source verification.

## Required readback

After publish, read back record count, Deal IDs, sourceVersion and snapshotVersion. Compare with the candidate snapshot before cache revalidation.

## Failure behavior

Do not overwrite last-known-good on malformed, unexpectedly empty, partial or stale output. Log sanitized failure evidence and alert the operator.
