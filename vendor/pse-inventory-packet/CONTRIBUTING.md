# Contributing

This packet is a controlled engineering handoff, not a casual template.

1. Start from a clean copy and record the current packet SHA-256.
2. Open a change record using `06_OPERATIONS/06_CHANGE_CONTROL_LOG_TEMPLATE.csv`.
3. Add a failing test before changing authoritative behavior.
4. Keep private and public data models separate. Never weaken the public
   allowlist or approval gate to make a test pass.
5. Use deterministic open-source components only in the inventory path.
6. Update contracts, examples, documentation, operations controls, SBOM, and
   visuals together when behavior changes.
7. Run the legacy publisher suite, runnable API suite, browser-module tests,
   source-evidence audit, cross-reference linter, and full super gauntlet.
8. Remove caches and generated developer files before release.
9. Build the deterministic ZIP twice and compare hashes.
10. Preserve the production truth boundary: packet verification is not proof of
    live deployment.

A change is not accepted with unresolved Critical or Major defects, broken
references, stale version labels, unverified source counts, or missing rollback
evidence.
