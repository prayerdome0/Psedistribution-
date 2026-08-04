import copy
import json
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker

HERE = Path(__file__).resolve()
REF = HERE.parents[1]
ROOT = HERE.parents[2]
sys.path.insert(0, str(REF))

from publisher import PublishError, build_snapshot  # noqa: E402

CONTRACTS = ROOT / '03_CONTRACTS'
PUBLIC_SCHEMA = json.loads((CONTRACTS / 'public_inventory_item.schema.json').read_text())
PUBLIC_EXAMPLE = json.loads((CONTRACTS / 'public_inventory_item.example.json').read_text())
PRIVATE_EXAMPLE = json.loads((CONTRACTS / 'canonical_inventory_record.example.json').read_text())
VALIDATOR = Draft202012Validator(PUBLIC_SCHEMA, format_checker=FormatChecker())
NOW = datetime(2026, 8, 3, 20, 5, tzinfo=timezone.utc)


class HardeningRegressionTests(unittest.TestCase):
    def public(self):
        return copy.deepcopy(PUBLIC_EXAMPLE)

    def private(self):
        return copy.deepcopy(PRIVATE_EXAMPLE)

    def schema_errors(self, value):
        return list(VALIDATOR.iter_errors(value))

    def test_public_schema_rejects_non_https_image_urls(self):
        item = self.public()
        item['imageUrls'] = ['http://images.example.com/item.jpg']
        self.assertTrue(self.schema_errors(item))

    def test_public_schema_rejects_non_https_spec_sheet_url(self):
        item = self.public()
        item['specSheetUrl'] = 'file:///etc/passwd'
        self.assertTrue(self.schema_errors(item))

    def test_rfq_mode_rejects_public_prices(self):
        item = self.public()
        item['pricingMode'] = 'rfq'
        item['publicUnitPrice'] = 1.25
        self.assertTrue(self.schema_errors(item))

    def test_login_mode_rejects_public_prices(self):
        item = self.public()
        item['pricingMode'] = 'login'
        item['publicCasePrice'] = 12.50
        self.assertTrue(self.schema_errors(item))

    def test_case_price_requires_case_metadata(self):
        item = self.public()
        item['pricingMode'] = 'public'
        item['publicUnitPrice'] = None
        item['publicCasePrice'] = 12.50
        item['publicLotPrice'] = None
        item.pop('casesAvailable', None)
        item.pop('unitsPerCase', None)
        self.assertTrue(self.schema_errors(item))

    def test_phase1_publisher_requires_rfq_enabled_for_every_item(self):
        record = self.private()
        record['publicProfile']['rfqEnabled'] = False
        with self.assertRaisesRegex(PublishError, 'rfqEnabled'):
            build_snapshot([record], now=NOW, run_id='RUN-H1', release_id='REL-H1', operator='tester')

    def test_moq_cannot_exceed_available_to_sell(self):
        record = self.private()
        record['publicProfile']['moqUnits'] = 901
        with self.assertRaisesRegex(PublishError, 'moqUnits'):
            build_snapshot([record], now=NOW, run_id='RUN-H2', release_id='REL-H2', operator='tester')

    def test_duplicate_slugs_block_entire_run(self):
        first = self.private()
        second = self.private()
        second['dealId'] = 'PSE-EXAMPLE-002'
        second['source']['sourceRecordIds'] = ['SOURCE-EXAMPLE-002']
        second['source']['sourceHashes'] = ['1' * 64]
        with self.assertRaisesRegex(PublishError, 'duplicate slug'):
            build_snapshot([first, second], now=NOW, run_id='RUN-H3', release_id='REL-H3', operator='tester')

    def test_duplicate_source_hashes_block_entire_run(self):
        first = self.private()
        second = self.private()
        second['dealId'] = 'PSE-EXAMPLE-002'
        second['publicProfile']['slug'] = 'example-product-lot-two'
        second['source']['sourceRecordIds'] = ['SOURCE-EXAMPLE-002']
        with self.assertRaisesRegex(PublishError, 'duplicate source hash'):
            build_snapshot([first, second], now=NOW, run_id='RUN-H4', release_id='REL-H4', operator='tester')


if __name__ == '__main__':
    unittest.main(verbosity=2)
