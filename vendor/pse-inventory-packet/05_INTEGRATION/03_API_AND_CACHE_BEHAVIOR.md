# API and Cache Behavior

- Implement `GET /api/inventory` and `GET /api/inventory/{slug}` exactly against the OpenAPI contract.
- Use ETag derived from snapshotVersion; honor If-None-Match with 304.
- Paginate with opaque signed or server-stored cursors; never expose private offsets/identifiers.
- Validate every loaded snapshot before serving.
- Cache the validated snapshot server-side.
- On a transient source read failure, serve last-known-good only while inside the approved maximum age.
- After maximum age, return sanitized 503 and keep the general RFQ route available.
- Never replace a valid snapshot with invalid or unexpected empty output.
- Emit request ID, sourceVersion, snapshotVersion and freshness state to structured logs.
