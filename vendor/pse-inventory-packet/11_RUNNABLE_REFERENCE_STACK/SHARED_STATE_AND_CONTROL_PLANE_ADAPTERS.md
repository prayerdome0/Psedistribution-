# Shared State and Control-Plane Adapter Contract

**Packet version:** 4.0.0  
**Status:** REQUIRED PRODUCTION GATE — NOT IMPLEMENTED IN THE SINGLE-PROCESS REFERENCE

## Purpose

The runnable API deliberately uses in-process state so its behavior can be inspected and tested without pretending that a distributed production control plane already exists. PostgreSQL and Valkey appear in Compose only behind preview profiles. Enabling those containers does not satisfy this contract.

## Production multi-replica gate

Production multi-replica deployment is blocked until all requirements below are implemented against the actual website repository and SalesMax runtime, then proven in staging with at least two API replicas. The release evidence must record the adapter commit, resolved image digests, test output, load profile, rollback result, and secret-rotation evidence.

## Valkey shared-state adapter

The production adapter must use a maintained open-source Valkey-compatible client and TLS or a private trusted network. It must expose two narrow interfaces:

```python
class NonceStore(Protocol):
    def consume(self, key_id: str, nonce: str, now: datetime) -> None: ...

class RateLimiter(Protocol):
    def allow(self, subject: str, now: datetime) -> bool: ...
```

### Replay protection

- The storage key must be namespaced and hash or safely encode both `key_id` and `nonce`.
- The first consume must execute atomically with Valkey `SET key value NX EX ttl_seconds`.
- A false/empty response from `SET NX EX` means replay and must raise the canonical replay error.
- The TTL must be at least the HMAC nonce validity window and no longer than the approved retention period.
- A Valkey timeout, authentication failure, cluster redirection error, or unavailable backend must **fail closed**: the revalidation request is rejected and no cache or snapshot promotion occurs.

### Distributed rate limiting

- Each fixed-window key must include the normalized client subject and window number.
- Increment and first-use expiry must be atomic, using a reviewed Lua script or transaction equivalent: `INCR` followed by `EXPIRE` only when the new count equals one.
- The adapter must return allowed only when the atomic count is at or below the configured limit.
- A Valkey failure must fail closed for the protected endpoint; it must never silently fall back to an independent per-replica counter in multi-replica mode.
- Key cardinality, memory ceilings, eviction policy, and abuse monitoring must be defined before launch.

### Required Valkey tests

1. Two replica clients consuming the same nonce concurrently yield exactly one success and one replay rejection.
2. Parallel increments across two replica clients enforce one shared limit.
3. TTL is created on the first increment and is not extended by later increments.
4. Backend timeout, bad credentials and disconnect each fail closed.
5. Key rotation accepts active keys, rejects retired keys and preserves replay isolation by key ID.
6. Restart and failover do not permit a previously consumed nonce inside its validity window.

## PostgreSQL control-plane adapter

The production publisher/control-plane adapter must use the schemas and grants in `db/001_inventory_control_plane.sql` and `db/002_role_grants.sql` as a reviewed starting point, not as proof of a completed deployment.

- Private canonical records remain in `private_inventory`; storefront credentials receive no access to that schema.
- Public snapshots and active-pointer promotion remain in `public_inventory`.
- Every publish attempt, decision, source version, output checksum and operator identity is appended to `audit`.
- One database transaction and a scoped advisory lock must protect snapshot staging, validation, active-pointer swap and audit insertion.
- A failed validation or transaction leaves the prior active snapshot unchanged.
- Database roles use least privilege; the storefront may read only the active public snapshot view.
- Backup, point-in-time recovery, restore and rollback must be proven before production.

### Required PostgreSQL tests

1. Storefront role cannot read `private_inventory` or write any inventory table.
2. Publisher role cannot alter role grants or bypass the publish gate.
3. Concurrent publish attempts serialize without a split-brain active pointer.
4. Validation failure rolls back all staged rows and audit state.
5. Restore reproduces the active snapshot checksum and audit chain.
6. Revoking the publisher role immediately blocks writes without affecting storefront reads.

## Promotion evidence

The multi-replica gate passes only when:

- both adapters are wired into the actual runtime rather than merely started as containers;
- all tests above pass against the pinned staging images;
- two clean end-to-end publish runs produce the same accepted public snapshot;
- two API replicas share replay and rate-limit state;
- private-field and stale-data adversarial fixtures remain blocked;
- monitoring and alerts identify backend outage, replay attempts, rate-limit saturation and publish rollback; and
- rollback to the prior application image and prior active snapshot is demonstrated.

Until that evidence exists, the only approved runnable mode is the packet's single-process reference.
