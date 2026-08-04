# Definition of Done

Production completion requires all of the following:

- Every displayed product maps to one approved canonical Deal ID and unique slug.
- Every approved record has traceable source IDs/hashes, positive ATS, current availability and approved terms.
- Public output contains only the strict public schema; privacy mutation tests pass.
- Feed, API and website record counts, Deal IDs, source version and snapshot version match.
- Sold, withdrawn, stale, malformed and intentionally empty scenarios behave exactly as approved.
- RFQs preserve Deal ID, source/snapshot version and requested quantity.
- Public claims, prices, freight, inspection/return terms and JSON-LD match visible verified data.
- Monitoring and alerts are active.
- The production topology is either one explicitly approved API replica or a multi-replica deployment with the tested PostgreSQL/Valkey adapters; preview containers alone do not satisfy this gate.
- Backup, restore, snapshot rollback and deployment rollback are proven.
- No Critical or Major defect remains.
- Two independent clean end-to-end publish/deploy runs reproduce the accepted state.
- Live production verification evidence is stored and owner/release approval is recorded.
