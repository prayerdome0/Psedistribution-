import unittest
from datetime import datetime, timedelta, timezone

from revalidation import (
    NonceStore,
    RevalidationError,
    canonical_string,
    content_sha256,
    sign_request,
    verify_request,
)

NOW = datetime(2026, 8, 3, 20, 5, tzinfo=timezone.utc)
BODY = b'{"runId":"RUN-1","sourceVersion":"source-v1"}'
SECRET = b'test-secret-do-not-use-in-production'


class RevalidationSignatureTests(unittest.TestCase):
    def headers(self, *, timestamp=NOW, nonce='0123456789abcdef0123456789abcdef', body=BODY, key_id='primary'):
        return sign_request(secret=SECRET, key_id=key_id, timestamp=timestamp, nonce=nonce, body=body)

    def test_content_hash_uses_exact_body_bytes(self):
        self.assertNotEqual(content_sha256(BODY), content_sha256(BODY + b'\n'))

    def test_canonical_string_is_unambiguous(self):
        headers = self.headers()
        value = canonical_string(
            key_id=headers['X-PSE-Key-Id'],
            timestamp=headers['X-PSE-Timestamp'],
            nonce=headers['X-PSE-Nonce'],
            body_hash=headers['X-PSE-Content-SHA256'],
            body=BODY,
        )
        self.assertEqual(value.count(b'\n'), 5)
        self.assertTrue(value.endswith(BODY))

    def test_valid_request_verifies_and_consumes_nonce(self):
        store = NonceStore()
        result = verify_request(
            secrets={'primary': SECRET}, headers=self.headers(), body=BODY,
            now=NOW, nonce_store=store,
        )
        self.assertEqual(result['keyId'], 'primary')
        self.assertTrue(store.contains('primary', '0123456789abcdef0123456789abcdef', NOW))

    def test_replayed_nonce_is_rejected(self):
        store = NonceStore()
        headers = self.headers()
        verify_request(secrets={'primary': SECRET}, headers=headers, body=BODY, now=NOW, nonce_store=store)
        with self.assertRaisesRegex(RevalidationError, 'replay'):
            verify_request(secrets={'primary': SECRET}, headers=headers, body=BODY, now=NOW, nonce_store=store)

    def test_expired_timestamp_is_rejected(self):
        headers = self.headers(timestamp=NOW - timedelta(seconds=301))
        with self.assertRaisesRegex(RevalidationError, 'timestamp'):
            verify_request(secrets={'primary': SECRET}, headers=headers, body=BODY, now=NOW, nonce_store=NonceStore())

    def test_future_timestamp_outside_skew_is_rejected(self):
        headers = self.headers(timestamp=NOW + timedelta(seconds=301))
        with self.assertRaisesRegex(RevalidationError, 'timestamp'):
            verify_request(secrets={'primary': SECRET}, headers=headers, body=BODY, now=NOW, nonce_store=NonceStore())

    def test_body_tampering_is_rejected(self):
        headers = self.headers()
        with self.assertRaisesRegex(RevalidationError, 'content hash'):
            verify_request(secrets={'primary': SECRET}, headers=headers, body=BODY + b' ', now=NOW, nonce_store=NonceStore())

    def test_unknown_key_id_is_rejected(self):
        headers = self.headers(key_id='old')
        with self.assertRaisesRegex(RevalidationError, 'key'):
            verify_request(secrets={'primary': SECRET}, headers=headers, body=BODY, now=NOW, nonce_store=NonceStore())

    def test_signature_tampering_is_rejected(self):
        headers = self.headers()
        headers['X-PSE-Signature'] = '0' * 64
        with self.assertRaisesRegex(RevalidationError, 'signature'):
            verify_request(secrets={'primary': SECRET}, headers=headers, body=BODY, now=NOW, nonce_store=NonceStore())


if __name__ == '__main__':
    unittest.main(verbosity=2)
