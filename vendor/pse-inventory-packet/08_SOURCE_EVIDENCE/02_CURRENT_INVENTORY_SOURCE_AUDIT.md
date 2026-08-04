# Current Inventory Source Audit - August 3, 2026

This is a dated control snapshot. It does not prove that any item remains available after August 3, 2026. Every intended public record requires current source confirmation and version-bound owner approval.

## PSE Wholesale Hub Live Deal Tracker

- Spreadsheet ID: `1k8XsWyYs9_1Lyk15FbUsfpJfvdtGx3_baYQub-K-wOc`.
- Tabs inspected: Dashboard, Master Items, Review Queue, Raw Intake, Sync Log and Settings.
- Canonical records: 2.
- Units represented: 12,700.
- Review state: 1 Ready and 1 Needs Review.
- Explicit publish-approved records: 0 because the inspected schema has no separate version-bound Publish Approved field.
- Both canonical records showed Pending Hub Sync in the inspected source snapshot.
- `Last Refresh` is based on spreadsheet recalculation and is not an authoritative source-verification, Hub-sync, API-sync or website-release timestamp.
- Dashboard counts and totals are not lifecycle-filtered production controls.

## PSE Caden Share Deal Intake + Outreach Status

- Spreadsheet ID: `1fb4HkG7DTPDgy1SG4K0MM-qAZXQktgdomAhB_hU1Vyo`.
- Candidate rows: 73.
- Review/proof/current-availability gated rows: 73.
- Candidate rows without a usable quantity: 15.
- Deterministic normalized-title clusters: 33.
- Rows beyond the first row in their normalized-title cluster: 40.
- Largest normalized-title cluster: 35 rows.

Title normalization is a triage signal only. It case-folds, collapses whitespace, repeatedly removes common reply/forward prefixes and removes the trailing `We Got Your Message` auto-response phrase. It does not authorize automatic record merging. Stable source IDs, thread IDs, UPC/model, supplier SKU and source hashes outrank fuzzy title similarity.

## Reproducibility

Run:

```bash
python 08_SOURCE_EVIDENCE/audit_sanitized_sources.py .
```

The script reads only the buyer-safe audit extracts:

- `08_SOURCE_EVIDENCE/05_SANITIZED_CANDIDATE_AUDIT_ROWS.csv`
- `08_SOURCE_EVIDENCE/06_SANITIZED_CANONICAL_AUDIT_ROWS.csv`

Expected output is locked in `08_SOURCE_EVIDENCE/07_SOURCE_AUDIT_BASELINE.json` and checked by the release gauntlet.
