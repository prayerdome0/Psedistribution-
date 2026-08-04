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

from publisher import PublishError, build_snapshot, compute_record_version, privacy_scan, sha256_prefixed, validate_gtin, verify_snapshot_integrity  # noqa: E402

C = ROOT / '03_CONTRACTS'
EXAMPLE = json.loads((C / 'canonical_inventory_record.example.json').read_text())
NOW = datetime(2026, 8, 3, 20, 5, tzinfo=timezone.utc)
ALLOWED = {'cdn.pilotsalesdistribution.com'}


class PublisherTests(unittest.TestCase):
    def record(self):
        return copy.deepcopy(EXAMPLE)

    def publish(self, records=None, **kwargs):
        return build_snapshot(records or [self.record()], now=NOW, run_id='RUN-1', release_id='REL-1', operator='tester', allowed_media_hosts=ALLOWED, **kwargs)

    def reapprove(self, record):
        approval = record.get('publishApproval')
        if isinstance(approval, dict):
            timestamps = [
                record['source']['lastSourceVerifiedAt'],
                record['source']['lastAvailabilityConfirmedAt'],
                record['audit']['recordUpdatedAt'],
            ]
            approval['approvedAt'] = max(timestamps)
            record['recordVersion'] = compute_record_version(record)
            approval['approvalVersion'] = record['recordVersion']
        return record

    def test_valid_approved_record_publishes(self):
        snapshot, report = self.publish()
        self.assertEqual(snapshot['recordCount'], 1)
        self.assertEqual(report['result'], 'PASS')
        self.assertEqual(snapshot['items'][0]['dealId'], 'PSE-EXAMPLE-001')
        self.assertFalse(verify_snapshot_integrity(snapshot))

    def test_private_keys_and_sensitive_values_never_publish(self):
        snapshot, _ = self.publish()
        text = json.dumps(snapshot['items'][0]).lower()
        for token in ('private supplier','secret sentinel','acquisitioncost','internalsellfloor','prooflinks','reservedunits','onhandunits','owner','reviewer'):
            self.assertNotIn(token, text)
        self.assertFalse(privacy_scan(snapshot['items'][0]))

    def test_available_to_sell_equation_is_enforced(self):
        record = self.record(); record['inventory']['availableToSell'] = 899
        with self.assertRaisesRegex(PublishError, 'availableToSell'):
            self.publish([record])

    def test_reserved_units_cannot_exceed_on_hand(self):
        record = self.record(); record['inventory']['reservedUnits'] = 1001; record['inventory']['availableToSell'] = -1
        with self.assertRaisesRegex(PublishError, 'reservedUnits|availableToSell'):
            self.publish([record])

    def test_moq_units_cannot_exceed_ats(self):
        record = self.record(); record['publicProfile']['moqUnits'] = 901
        with self.assertRaisesRegex(PublishError, 'moqUnits'):
            self.publish([record])

    def test_moq_cases_requires_cases_available(self):
        record = self.record(); record['inventory']['casesAvailable'] = None
        with self.assertRaisesRegex(PublishError, 'moqCases'):
            self.publish([record])

    def test_moq_cases_cannot_exceed_cases_available(self):
        record = self.record(); record['publicProfile']['moqCases'] = 76
        with self.assertRaisesRegex(PublishError, 'moqCases'):
            self.publish([record])

    def test_case_math_cannot_exceed_on_hand(self):
        record = self.record(); record['inventory']['casesAvailable'] = 100; record['inventory']['unitsPerCase'] = 12
        with self.assertRaisesRegex(PublishError, 'casesAvailable'):
            self.publish([record])

    def test_duplicate_deal_ids_block_entire_run(self):
        with self.assertRaisesRegex(PublishError, 'duplicate dealId'):
            self.publish([self.record(), self.record()])

    def test_duplicate_slugs_block_entire_run(self):
        a = self.record(); b = self.record(); b['dealId'] = 'PSE-EXAMPLE-002'
        with self.assertRaisesRegex(PublishError, 'duplicate slug'):
            self.publish([a, b])

    def test_nonapproved_records_are_ignored(self):
        approved = self.record(); ignored = self.record(); ignored['dealId'] = 'PSE-EXAMPLE-002'; ignored['publishApproved'] = False; ignored['publishApproval'] = None
        snapshot, report = self.publish([approved, ignored])
        self.assertEqual(snapshot['recordCount'], 1)
        self.assertEqual(report['ignoredCount'], 1)

    def test_one_bad_approved_record_blocks_all(self):
        good = self.record(); bad = self.record(); bad['dealId'] = 'PSE-EXAMPLE-002'; bad['publicProfile']['slug'] = 'second-example'; bad['inventory']['availableToSell'] = 899
        with self.assertRaises(PublishError):
            self.publish([good, bad])

    def test_24_hour_boundary_is_fresh(self):
        record = self.record(); record['source']['lastAvailabilityConfirmedAt'] = (NOW - timedelta(seconds=86400)).isoformat().replace('+00:00','Z')
        record['source']['availabilityExpiresAt'] = (NOW + timedelta(days=2)).isoformat().replace('+00:00','Z')
        snapshot, _ = self.publish([self.reapprove(record)])
        self.assertEqual(snapshot['items'][0]['status'], 'available')

    def test_over_24_hours_forces_confirm_and_rfq(self):
        record = self.record(); record['publicProfile']['pricingMode'] = 'public'; record['publicProfile']['publicUnitPrice'] = 2.5
        record['source']['lastAvailabilityConfirmedAt'] = (NOW - timedelta(seconds=86401)).isoformat().replace('+00:00','Z')
        record['source']['availabilityExpiresAt'] = (NOW + timedelta(days=2)).isoformat().replace('+00:00','Z')
        snapshot, _ = self.publish([self.reapprove(record)])
        item = snapshot['items'][0]
        self.assertEqual(item['status'], 'confirm-availability')
        self.assertEqual(item['pricingMode'], 'rfq')
        self.assertNotIn('publicUnitPrice', item)

    def test_over_72_hours_blocks(self):
        record = self.record(); record['source']['lastAvailabilityConfirmedAt'] = (NOW - timedelta(seconds=259201)).isoformat().replace('+00:00','Z')
        with self.assertRaisesRegex(PublishError, '72-hour'):
            self.publish([record])

    def test_expired_availability_blocks(self):
        record = self.record(); record['source']['availabilityExpiresAt'] = (NOW - timedelta(seconds=1)).isoformat().replace('+00:00','Z')
        with self.assertRaisesRegex(PublishError, 'availabilityExpiresAt'):
            self.publish([record])

    def test_future_confirmation_beyond_skew_blocks(self):
        record = self.record(); record['source']['lastAvailabilityConfirmedAt'] = (NOW + timedelta(seconds=301)).isoformat().replace('+00:00','Z')
        record['source']['availabilityExpiresAt'] = (NOW + timedelta(days=2)).isoformat().replace('+00:00','Z')
        with self.assertRaisesRegex(PublishError, 'future'):
            self.publish([record])

    def test_markup_and_sensitive_internal_wording_block(self):
        for value in ('<script>alert(1)</script>','INTERNAL ONLY wholesale deal'):
            record = self.record(); record['publicProfile']['title'] = value
            with self.assertRaisesRegex(PublishError, 'markup|sensitive'):
                self.publish([record])

    def test_gtin_validation(self):
        self.assertTrue(validate_gtin('036000291452'))
        self.assertFalse(validate_gtin('036000291453'))
        record = self.record(); record['publicProfile']['upc'] = '036000291453'
        with self.assertRaisesRegex(PublishError, 'GTIN'):
            self.publish([record])

    def test_rfq_mode_cannot_carry_price(self):
        record = self.record(); record['publicProfile']['publicUnitPrice'] = 2.5
        with self.assertRaisesRegex(PublishError, 'RFQ mode|pricing'):
            self.publish([record])

    def test_public_mode_requires_price(self):
        record = self.record(); record['publicProfile']['pricingMode'] = 'public'
        with self.assertRaisesRegex(PublishError, 'public mode|public schema'):
            self.publish([record])

    def test_http_media_and_unapproved_media_host_block(self):
        record = self.record(); record['publicProfile']['imageUrls'] = ['http://cdn.pilotsalesdistribution.com/a.jpg']
        with self.assertRaisesRegex(PublishError, 'HTTPS'):
            self.publish([record])
        record = self.record(); record['publicProfile']['imageUrls'] = ['https://evil.example/a.jpg']
        with self.assertRaisesRegex(PublishError, 'approved HTTPS'):
            self.publish([record])

    def test_input_order_is_deterministic(self):
        a = self.record(); b = self.record(); b['dealId'] = 'PSE-EXAMPLE-002'; b['publicProfile']['slug'] = 'second-example'; b['source']['sourceVersion'] = sha256_prefixed(['source-v2'])
        b['source']['sourceRecordIds'] = ['SRC-EXAMPLE-002']
        b['source']['sourceHashes'] = ['1' * 64]
        b['source']['proofEvidenceIds'] = ['EVID-EXAMPLE-002']
        self.reapprove(b)
        one, _ = self.publish([a,b]); two, _ = self.publish([b,a])
        self.assertEqual(one, two)

    def test_fixed_inputs_produce_identical_hashes(self):
        a, _ = self.publish(); b, _ = self.publish()
        self.assertEqual(a['snapshotVersion'], b['snapshotVersion'])
        self.assertEqual(a, b)

    def test_empty_snapshot_requires_structured_dual_control(self):
        record = self.record(); record['publishApproved'] = False; record['publishApproval'] = None
        with self.assertRaisesRegex(PublishError, 'dual-control'):
            self.publish([record])

    def test_empty_snapshot_accepts_two_distinct_current_approvers(self):
        record = self.record(); record['publishApproved'] = False; record['publishApproval'] = None
        auth = {
            'authorizationId':'AUTH-1','reason':'Intentional catalog maintenance window approved by two owners.',
            'approvers':[{'id':'a','approvedAt':'2026-08-03T19:50:00Z'},{'id':'b','approvedAt':'2026-08-03T19:52:00Z'}]
        }
        snapshot, report = self.publish([record], empty_authorization=auth)
        self.assertEqual(snapshot['recordCount'], 0)
        self.assertEqual(snapshot['emptyOverrideAuthorizationId'], 'AUTH-1')
        self.assertEqual(report['emptyOverrideAuthorizationId'], 'AUTH-1')

    def test_empty_authorization_rejects_same_approver_twice(self):
        record = self.record(); record['publishApproved'] = False; record['publishApproval'] = None
        auth = {'authorizationId':'AUTH-1','reason':'Intentional catalog maintenance window approved by owners.','approvers':[{'id':'a','approvedAt':'2026-08-03T19:50:00Z'},{'id':'A','approvedAt':'2026-08-03T19:52:00Z'}]}
        with self.assertRaisesRegex(PublishError, 'dual-control'):
            self.publish([record], empty_authorization=auth)

    def test_previous_snapshot_version_is_preserved(self):
        prior, _ = self.publish()
        next_snapshot, _ = self.publish(previous_snapshot=prior)
        self.assertEqual(next_snapshot['previousSnapshotVersion'], prior['snapshotVersion'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
