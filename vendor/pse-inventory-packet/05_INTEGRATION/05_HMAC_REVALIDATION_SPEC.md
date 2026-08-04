# HMAC Revalidation Specification

## Required headers

- `X-PSE-Key-Id`
- `X-PSE-Timestamp` - RFC 3339 UTC
- `X-PSE-Nonce` - cryptographically random, at least 128 bits represented by 16+ characters
- `X-PSE-Content-SHA256` - lowercase hex SHA-256 of exact raw request bytes
- `X-PSE-Signature` - lowercase hex HMAC-SHA256

## Canonical bytes

```text
pse-inventory-revalidate-v1\n
<key-id>\n
<timestamp>\n
<nonce>\n
<content-sha256>\n
<exact raw request body bytes>
```

The reference implementation constructs the same sequence without the blank display lines. Do not parse and reserialize JSON before verification.

## Verification order

1. Require all headers and known key ID.
2. Reject newline/header injection and invalid nonce length.
3. Reject timestamps outside +/-300 seconds.
4. Hash exact raw body and compare in constant time.
5. Reconstruct canonical bytes and compare signature in constant time.
6. Atomically consume `(keyId, nonce)` in a shared store with at least 10-minute TTL.
7. Validate sourceVersion/snapshotVersion against the active promoted snapshot.
8. Revalidate only approved cache tags/routes.

## Rotation

Allow current and previous key IDs during a short documented overlap. Stop signing with the old key first, verify traffic has migrated, then remove the old verification secret. Never place either secret in the browser or packet.
