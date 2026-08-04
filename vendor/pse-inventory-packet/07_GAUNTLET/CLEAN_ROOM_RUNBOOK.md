# Clean-Room Verification Runbook - v4.0.0

## Preconditions

- Start from the canonical packet directory with the exact lock files installed in an isolated Python environment.
- Record Python, Node.js, LibreOffice and Poppler versions.
- Keep detached attestation evidence outside the packet to avoid a self-referential archive hash.
- Do not count preview PostgreSQL or Valkey containers as completed integration.

## Canonical procedure

Run the standard-library release orchestrator from the packet root:

```bash
python 09_RELEASE/release_v4.py --output-dir .. .
```

The command must complete all of the following without manual substitution:

1. Remove `__pycache__`, `.pytest_cache`, `.pyc` and `.DS_Store` artifacts.
2. Run the bootstrap gauntlet.
3. Stabilize `09_RELEASE/02_GAUNTLET_RESULTS.json`.
4. Regenerate `PACKAGE_MANIFEST.csv` and `SHA256SUMS.txt`.
5. Run the full gauntlet after the release evidence is stable.
6. Build the source archive twice and require byte-for-byte identity.
7. Extract the canonical archive into independent clean rooms A and B.
8. Run the full gauntlet in both clean rooms.
9. Rebuild the archive from A and B and require both rebuilds to be byte-identical to the canonical archive.
10. Write a detached clean-room attestation and archive `.sha256` file beside the ZIP.

## Independent verification

After the orchestrator succeeds:

```bash
sha256sum -c ../PSE_SalesMax_Inventory_Wiring_MASTERED_OPEN_SOURCE_v4.0.0_2026-08-03.zip.sha256
unzip -t ../PSE_SalesMax_Inventory_Wiring_MASTERED_OPEN_SOURCE_v4.0.0_2026-08-03.zip
```

Open the detached attestation and confirm:

- source, clean-room A and clean-room B each report `PASS`;
- all three report the same packet and contract version;
- all three report the expected automated-test total;
- both clean-room rebuild hashes equal the canonical archive hash; and
- `productionIntegration` remains `NOT_DEPLOYED`.

Production clean-room acceptance is separate. It requires the live repository, authoritative SalesMax runtime, staging deployment, backup/restore, rollback, PostgreSQL/Valkey adapter evidence when multi-replica, and live storefront/RFQ verification.
