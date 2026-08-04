import json
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve(); REF = HERE.parents[1]
sys.path.insert(0, str(REF))
from revalidation import NonceStore, RevalidationError, sign_request, verify_request  # noqa: E402

NOW = datetime(2026,8,3,20,5,tzinfo=timezone.utc)
SECRET = b'super-secret-reference-key'
BODY = json.dumps({'runId':'RUN-1','releaseId':'REL-1'}, separators=(',',':')).encode()
KEY_ID = 'primary-2026-08'


class RevalidationTests(unittest.TestCase):
    def headers(self, timestamp=NOW, nonce='nonce-1234567890abcdef', body=BODY, key_id=KEY_ID, secret=SECRET):
        return sign_request(secret=secret, key_id=key_id, timestamp=timestamp, nonce=nonce, body=body)

    def verify(self, headers, body=BODY, *, secrets=None, store=None):
        return verify_request(
            secrets=secrets or {KEY_ID: SECRET}, headers=headers, body=body,
            now=NOW, nonce_store=store or NonceStore(),
        )

    def test_valid_request_passes(self):
        result = self.verify(self.headers())
        self.assertEqual(result['keyId'], KEY_ID)

    def test_body_tamper_is_rejected(self):
        with self.assertRaisesRegex(RevalidationError, 'content hash'):
            self.verify(self.headers(), BODY+b'x')

    def test_signature_tamper_is_rejected(self):
        headers = self.headers(); headers['X-PSE-Signature'] = '0'*64
        with self.assertRaisesRegex(RevalidationError, 'signature'):
            self.verify(headers)

    def test_wrong_secret_is_rejected(self):
        with self.assertRaisesRegex(RevalidationError, 'signature'):
            self.verify(self.headers(), secrets={KEY_ID: b'wrong-wrong-wrong-wrong'})

    def test_old_and_future_timestamps_are_rejected(self):
        for ts in (NOW-timedelta(seconds=301), NOW+timedelta(seconds=301)):
            with self.assertRaisesRegex(RevalidationError, 'timestamp'):
                self.verify(self.headers(timestamp=ts))

    def test_nonce_replay_is_rejected(self):
        store = NonceStore(); headers = self.headers()
        self.verify(headers, store=store)
        with self.assertRaisesRegex(RevalidationError, 'replay'):
            self.verify(headers, store=store)

    def test_missing_header_is_rejected_without_detail_leak(self):
        headers = self.headers(); del headers['X-PSE-Nonce']
        with self.assertRaisesRegex(RevalidationError, 'required signed'):
            self.verify(headers)

    def test_short_nonce_is_rejected(self):
        with self.assertRaises((ValueError, RevalidationError)):
            self.headers(nonce='short')


if __name__ == '__main__':
    unittest.main(verbosity=2)
