# Deterministic Reference Implementation v4.0.0

This portable Python reference demonstrates the required publication behavior. It is not a claim that the production site has been modified.

## Components

- `publisher.py` - private-schema validation, publication gate, allowlist mapping, privacy scan, freshness state, deterministic snapshot and dual-control empty override.
- `atomic_store.py` - validated atomic promotion, history preservation and rollback.
- `revalidation.py` - HMAC-SHA256 signing, exact-body hash verification, timestamp window and nonce replay protection.
- `tests/` - contract, publisher, recovery, signature, mutation and adversarial tests.

## Run

```bash
./run_tests.sh
```
