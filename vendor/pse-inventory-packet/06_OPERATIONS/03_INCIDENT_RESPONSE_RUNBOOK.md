# Incident Response Runbook

## Severity

- **Critical:** private data/credential exposure, unauthorized publication, wrong customer commitment, active exploit. Immediately disable inventory endpoint/publication, preserve evidence and rotate affected credentials.
- **Major:** stale/incorrect inventory, feed/API/site parity failure, repeated malformed snapshots, rollback unavailable. Stop publication and serve last-known-good or fail closed.
- **Minor:** isolated copy/layout/metadata issue without commercial or privacy impact. Correct through controlled release.

## First 15-minute actions

1. Identify incident commander and record start time/request IDs/release IDs.
2. Stop the affected publisher or route; do not destroy logs.
3. If privacy/security is possible, revoke/rotate credentials and restrict access.
4. Preserve current and previous snapshots, hashes, deployment IDs and logs.
5. Choose last-known-good or fail-closed behavior according to freshness.
6. Notify owner, engineering/release and affected operations roles.

## Scenario playbooks

### Private field in public API
Disable endpoint/cache, restore known-good snapshot, rotate credentials if exposed, identify mapper/schema bypass, run full mutation suite, redeploy only after evidence review.

### Stale or sold inventory visible
Unpublish affected Deal ID, invalidate cache, confirm source/hold state, review freshness event path and notify sales handling active RFQs.

### Empty or malformed snapshot promoted
Restore prior snapshot, investigate validation/promotion boundary, prove empty-overwrite protection before resuming.

### Revalidation replay/signature failures
Block source, inspect nonce store/key ID/clock, rotate if compromise suspected, do not widen time skew as a shortcut.

## Closure

Root cause, customer/business impact, timeline, evidence, corrections, regression tests, credential actions and owner approval must be recorded.
