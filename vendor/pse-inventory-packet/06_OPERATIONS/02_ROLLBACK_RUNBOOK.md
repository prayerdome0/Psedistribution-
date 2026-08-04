# Rollback Runbook

## Purpose

Restore the last verified public inventory snapshot and/or prior website deployment without exposing private data or losing evidence.

## Preconditions

- Current release ID, deployment ID, public snapshot version, source version, and hashes are recorded.
- Prior verified deployment and public snapshot are preserved.
- Operator has the approved production role.
- Incident and rollback run IDs are assigned.

## Trigger conditions

Initiate rollback for any Critical defect, private-data exposure, incorrect price or availability, widespread API failure, malformed/empty snapshot promotion, parity failure, broken RFQ identity, or failed post-deploy smoke test.

## Inventory snapshot rollback

1. Freeze new publication runs.
2. Record current feed/API/site counts, sourceVersion, ETag, and snapshot hash.
3. Mark the faulty snapshot `REJECTED` and preserve it for evidence.
4. Restore the immediately prior verified public snapshot through the approved atomic swap mechanism.
5. Call the signed internal revalidation endpoint.
6. Verify list/detail API response, sourceVersion, ETag, counts, and freshness.
7. Verify representative product pages and RFQ prefill.
8. Confirm no prohibited field is present.
9. Record restored snapshot hash and verification evidence.

## Website deployment rollback

1. Freeze further production deployments.
2. Record current deployment ID, commit, build, environment, and observed defect.
3. Roll back using the hosting provider's approved deployment rollback or the documented prior build.
4. Confirm server secrets and runtime configuration remain correct.
5. Run production smoke tests for homepage, products, product detail, RFQ, inventory API, and revalidation controls.
6. Confirm feed/API/site parity and privacy boundary.
7. Record the restored deployment ID and live verification evidence.

## Post-rollback actions

- Open a defect with severity, root-cause owner, and affected release.
- Preserve logs, screenshots, API responses, hashes, and commands.
- Do not republish or redeploy until the defect is fixed and the failed acceptance tests pass.
- Run two clean end-to-end verification cycles before re-promotion.
- Obtain engineering-owner approval before closing the incident.
