# Open-Source Adoption Decision

## Selected approach

Adopt an open-source, self-hostable inventory publication layer and keep AI out of the production decision path.

## Why this approach

- Removes dependency on a proprietary AI vendor for a workflow that is better served by deterministic validation.
- Creates auditable source code, contracts, tests, data models and rollback paths.
- Reduces vendor lock-in while preserving the ability to keep the current website framework when it passes Phase 0.
- Makes privacy, freshness and commercial controls measurable rather than prompt-dependent.

## What does not change

The core business rule remains: only owner-approved, currently verified, buyer-safe inventory may cross from the private canonical system to the public catalog.
