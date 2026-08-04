import copy
import json
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve()
REF = HERE.parents[1]
ROOT = HERE.parents[2]
sys.path.insert(0, str(REF))

from publisher import PublishError, build_snapshot, compute_record_version  # noqa: E402

EXAMPLE = json.loads((ROOT / '03_CONTRACTS/canonical_inventory_record.example.json').read_text())
NOW = datetime(2026, 8, 3, 20, 5, tzinfo=timezone.utc)
ALLOWED = {'cdn.pilotsalesdistribution.com'}


def approve(record):
    record['recordVersion'] = compute_record_version(record)
    record['publishApproval']['approvalVersion'] = record['recordVersion']
    return record


class V4MasteryTests(unittest.TestCase):
    def record(self):
        return copy.deepcopy(EXAMPLE)

    def publish(self, record):
        return build_snapshot(
            [record], now=NOW, run_id='RUN-V4', release_id='REL-V4', operator='tester',
            allowed_media_hosts=ALLOWED,
        )

    def test_publish_approval_must_match_exact_record_version(self):
        record = self.record()
        record['publicProfile']['title'] = 'Changed after approval'
        record['recordVersion'] = compute_record_version(record)
        with self.assertRaisesRegex(PublishError, 'approvalVersion'):
            self.publish(record)

    def test_computed_record_version_is_stable_and_prefixed(self):
        record = self.record()
        first = compute_record_version(record)
        second = compute_record_version(copy.deepcopy(record))
        self.assertEqual(first, second)
        self.assertRegex(first, r'^sha256:[a-f0-9]{64}$')

    def test_approval_must_not_predate_source_or_record_update(self):
        record = self.record()
        record['publishApproval']['approvedAt'] = '2026-08-03T19:00:00Z'
        approve(record)
        with self.assertRaisesRegex(PublishError, 'approvedAt'):
            self.publish(record)

    def test_over_24_hours_strips_exact_inventory_disclosure(self):
        record = self.record()
        record['source']['lastAvailabilityConfirmedAt'] = (NOW - timedelta(seconds=86401)).isoformat().replace('+00:00', 'Z')
        record['source']['availabilityExpiresAt'] = (NOW + timedelta(days=2)).isoformat().replace('+00:00', 'Z')
        approve(record)
        snapshot, _ = self.publish(record)
        item = snapshot['items'][0]
        self.assertEqual(item['status'], 'confirm-availability')
        self.assertEqual(item['quantityMode'], 'confirm')
        self.assertNotIn('availableToSell', item)
        self.assertNotIn('quantityRange', item)
        self.assertNotIn('casesAvailable', item)
        self.assertNotIn('unitsPerCase', item)

    def test_range_disclosure_never_exposes_exact_ats(self):
        record = self.record()
        record['publicProfile']['quantityMode'] = 'range'
        record['publicProfile']['quantityRange'] = {'minimum': 500, 'maximum': 899}
        approve(record)
        snapshot, _ = self.publish(record)
        item = snapshot['items'][0]
        self.assertEqual(item['quantityMode'], 'range')
        self.assertEqual(item['quantityRange'], {'minimum': 500, 'maximum': 899})
        self.assertNotIn('availableToSell', item)
        self.assertNotIn('casesAvailable', item)

    def test_range_maximum_cannot_exceed_internal_ats(self):
        record = self.record()
        record['publicProfile']['quantityMode'] = 'range'
        record['publicProfile']['quantityRange'] = {'minimum': 500, 'maximum': 901}
        approve(record)
        with self.assertRaisesRegex(PublishError, 'quantityRange'):
            self.publish(record)

    def test_public_pricing_requires_exactly_one_price_field(self):
        record = self.record()
        record['publicProfile']['pricingMode'] = 'public'
        record['publicProfile']['publicUnitPrice'] = 2.50
        record['publicProfile']['publicLotPrice'] = 2250.00
        approve(record)
        with self.assertRaisesRegex(PublishError, 'exactly one'):
            self.publish(record)

    def test_source_version_must_be_sha256_identity(self):
        record = self.record()
        record['source']['sourceVersion'] = 'source-v1'
        approve(record)
        with self.assertRaisesRegex(PublishError, 'sourceVersion'):
            self.publish(record)


if __name__ == '__main__':
    unittest.main(verbosity=2)
