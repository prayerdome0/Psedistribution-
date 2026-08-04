import copy
import hashlib
import json
import random
import sys
import time
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve(); REF = HERE.parents[1]; ROOT = HERE.parents[2]
sys.path.insert(0, str(REF))
from publisher import PublishError, build_snapshot, compute_record_version, sha256_prefixed  # noqa: E402

EXAMPLE = json.loads((ROOT / '03_CONTRACTS/canonical_inventory_record.example.json').read_text())
DENY = json.loads((ROOT / '03_CONTRACTS/privacy_field_denylist.json').read_text())
NOW = datetime(2026,8,3,20,5,tzinfo=timezone.utc)


class AdversarialTests(unittest.TestCase):
    def publish(self, records):
        return build_snapshot(records, now=NOW, run_id='ADV', release_id='REL', operator='tester')

    def reapprove(self, record):
        approval = record.get('publishApproval')
        if isinstance(approval, dict):
            approval['approvedAt'] = max(record['source']['lastSourceVerifiedAt'], record['source']['lastAvailabilityConfirmedAt'], record['audit']['recordUpdatedAt'])
            record['recordVersion'] = compute_record_version(record)
            approval['approvalVersion'] = record['recordVersion']
        return record

    def test_removing_any_required_private_field_blocks_approved_record(self):
        required_paths = [
            ('schemaVersion',),('dealId',),('status',),('reviewStatus',),('publishApproval',),('publishBlockers',),
            ('source','sourceRecordIds'),('source','sourceHashes'),('source','sourceVersion'),('source','lastSourceVerifiedAt'),
            ('source','lastAvailabilityConfirmedAt'),('source','availabilityExpiresAt'),('source','proofEvidenceIds'),
            ('inventory','onHandUnits'),('inventory','reservedUnits'),('inventory','availableToSell'),
            ('publicProfile','termsVersion'),('publicProfile','slug'),('publicProfile','title'),('publicProfile','shortDescription'),
            ('publicProfile','category'),('publicProfile','condition'),('publicProfile','moqUnits'),('publicProfile','pricingMode'),
            ('publicProfile','currency'),('publicProfile','fob'),('publicProfile','freightTerms'),('publicProfile','inspectionTerms'),
            ('publicProfile','returnTerms'),('publicProfile','imageUrls'),('publicProfile','rfqEnabled'),
            ('audit','owner'),('audit','reviewer'),('audit','recordUpdatedAt'),
        ]
        for path in required_paths:
            record = copy.deepcopy(EXAMPLE); target = record
            for key in path[:-1]: target = target[key]
            target.pop(path[-1])
            with self.subTest(path='.'.join(path)):
                with self.assertRaises(PublishError): self.publish([record])

    def test_every_prohibited_key_is_rejected_if_injected_into_public_profile(self):
        for key in DENY['prohibitedExactKeys']:
            record = copy.deepcopy(EXAMPLE); record['publicProfile'][key] = 'SECRET'
            with self.subTest(key=key):
                with self.assertRaises(PublishError): self.publish([record])

    def test_url_scheme_mutations_fail_closed(self):
        schemes = ['http','ftp','file','data','javascript','gopher','smb']
        for scheme in schemes:
            record = copy.deepcopy(EXAMPLE); record['publicProfile']['imageUrls'] = [f'{scheme}://example.com/a.jpg']
            with self.subTest(scheme=scheme):
                with self.assertRaises(PublishError): self.publish([record])

    def test_freshness_boundary_mutations(self):
        cases = [
            (-301, True),(-300, False),(0, False),(86400, False),(86401, False),(259200, False),(259201, True)
        ]
        for age, should_fail in cases:
            record = copy.deepcopy(EXAMPLE)
            if age < 0:
                confirmed = NOW + timedelta(seconds=-age)
            else:
                confirmed = NOW - timedelta(seconds=age)
            record['source']['lastAvailabilityConfirmedAt'] = confirmed.isoformat().replace('+00:00','Z')
            record['source']['availabilityExpiresAt'] = (max(NOW, confirmed) + timedelta(days=4)).isoformat().replace('+00:00','Z')
            with self.subTest(age=age):
                if should_fail:
                    with self.assertRaises(PublishError): self.publish([record])
                else:
                    self.publish([self.reapprove(record)])

    def test_250_deterministic_single_invariant_mutations_never_sneak_through(self):
        rng = random.Random(310)
        mutators = [
            lambda r: r['inventory'].__setitem__('availableToSell', r['inventory']['availableToSell'] + rng.randint(1,100)),
            lambda r: r['publicProfile'].__setitem__('moqUnits', r['inventory']['availableToSell'] + rng.randint(1,100)),
            lambda r: r['publicProfile'].__setitem__('title', '<b>bad</b>'),
            lambda r: r['publicProfile'].__setitem__('upc', '036000291453'),
            lambda r: r['publicProfile'].__setitem__('imageUrls', ['http://example.com/a.jpg']),
            lambda r: r['source'].__setitem__('proofEvidenceIds', []),
            lambda r: r.__setitem__('reviewStatus', 'blocked'),
            lambda r: r['publicProfile'].__setitem__('publicUnitPrice', 1.0),
        ]
        accepted = 0
        for _ in range(250):
            record = copy.deepcopy(EXAMPLE); rng.choice(mutators)(record)
            try: self.publish([record]); accepted += 1
            except PublishError: pass
        self.assertEqual(accepted, 0)

    def test_5000_record_snapshot_build_is_linear_enough(self):
        records = []
        for i in range(5000):
            r = copy.deepcopy(EXAMPLE)
            r['dealId'] = f'PSE-PERF-{i:06d}'
            r['publicProfile']['slug'] = f'performance-item-{i:06d}'
            r['source']['sourceVersion'] = sha256_prefixed([f'source-{i:06d}'])
            r['source']['sourceRecordIds'] = [f'SRC-PERF-{i:06d}']
            r['source']['sourceHashes'] = [hashlib.sha256(f'source-{i:06d}'.encode()).hexdigest()]
            r['source']['proofEvidenceIds'] = [f'EVID-PERF-{i:06d}']
            records.append(self.reapprove(r))
        start = time.perf_counter(); snapshot, _ = self.publish(records); elapsed = time.perf_counter() - start
        self.assertEqual(snapshot['recordCount'], 5000)
        self.assertLess(elapsed, 15.0)


if __name__ == '__main__':
    unittest.main(verbosity=2)
