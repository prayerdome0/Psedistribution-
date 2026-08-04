# Backup and Restore Runbook

## Back up before every material release

- Private canonical export/database backup and schema version.
- Current public snapshot and prior two accepted snapshots.
- Publisher/API/site configuration with secrets referenced, not exported in plaintext.
- Current production deployment ID and build artifact.
- Publish/release logs and manifest hashes.

## Restore test

1. Restore private backup into isolated staging.
2. Validate canonical schema and record count.
3. Restore selected public snapshot; validate schema and hash.
4. Point staging API/site to restored snapshot.
5. Verify Deal IDs, versions, RFQ and no private fields.
6. Record duration, commands, IDs and result.

Backups are not accepted until restore succeeds. Protect and retain them according to the data-retention policy.
