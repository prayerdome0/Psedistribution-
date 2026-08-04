import copy
import csv
import json
import unittest
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource

ROOT = Path(__file__).resolve().parents[2]
C = ROOT / '03_CONTRACTS'


class ContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.public = json.loads((C / 'public_inventory_item.schema.json').read_text())
        cls.private = json.loads((C / 'canonical_inventory_record.schema.json').read_text())
        cls.snapshot = json.loads((C / 'public_inventory_snapshot.schema.json').read_text())
        cls.public_example = json.loads((C / 'public_inventory_item.example.json').read_text())
        cls.private_example = json.loads((C / 'canonical_inventory_record.example.json').read_text())
        cls.snapshot_example = json.loads((C / 'public_inventory_snapshot.example.json').read_text())
        cls.openapi = yaml.safe_load((C / 'public_inventory_api.openapi.yaml').read_text())
        cls.validator = Draft202012Validator(cls.public, format_checker=FormatChecker())

    def test_all_schemas_are_valid_draft_2020_12(self):
        for schema in (self.public, self.private, self.snapshot):
            Draft202012Validator.check_schema(schema)

    def test_examples_validate(self):
        checker = FormatChecker()
        Draft202012Validator(self.public, format_checker=checker).validate(self.public_example)
        Draft202012Validator(self.private, format_checker=checker).validate(self.private_example)
        registry = Registry().with_resource(self.public['$id'], Resource.from_contents(self.public))
        Draft202012Validator(self.snapshot, registry=registry, format_checker=checker).validate(self.snapshot_example)

    def test_versions_are_consistent(self):
        self.assertEqual(self.public['properties']['schemaVersion']['const'], '4.0.0')
        self.assertEqual(self.private['properties']['schemaVersion']['const'], '4.0.0')
        self.assertEqual(self.snapshot['properties']['schemaVersion']['const'], '4.0.0')
        self.assertEqual(self.openapi['info']['version'], '4.0.0')

    def test_public_required_fields_match_phase_one_gate(self):
        expected = {
            'schemaVersion','dealId','sourceVersion','termsVersion','slug','title','shortDescription',
            'category','status','quantityMode','moqUnits','pricingMode','currency','condition',
            'fob','freightTerms','inspectionTerms','returnTerms','imageUrls','rfqEnabled',
            'lastSourceVerifiedAt','lastAvailabilityConfirmedAt','availabilityExpiresAt','publishedAt'
        }
        self.assertEqual(set(self.public['required']), expected)

    def test_public_contract_excludes_login_mode(self):
        self.assertEqual(set(self.public['properties']['pricingMode']['enum']), {'public','rfq'})

    def test_public_mode_requires_positive_price(self):
        bad = copy.deepcopy(self.public_example)
        bad['pricingMode'] = 'public'
        self.assertTrue(list(self.validator.iter_errors(bad)))
        good = copy.deepcopy(bad)
        good['publicUnitPrice'] = 2.5
        self.assertFalse(list(self.validator.iter_errors(good)))

    def test_rfq_mode_prohibits_all_public_prices(self):
        for key in ('publicUnitPrice','publicCasePrice','publicLotPrice'):
            bad = copy.deepcopy(self.public_example)
            bad[key] = 2.5
            self.assertTrue(list(self.validator.iter_errors(bad)), key)

    def test_https_is_required_for_images_and_spec_sheet(self):
        for value in ('http://example.com/a.jpg','ftp://example.com/a.jpg','javascript:alert(1)','//example.com/a.jpg'):
            bad = copy.deepcopy(self.public_example)
            bad['imageUrls'] = [value]
            self.assertTrue(list(self.validator.iter_errors(bad)), value)
        bad = copy.deepcopy(self.public_example)
        bad['specSheetUrl'] = 'http://example.com/spec.pdf'
        self.assertTrue(list(self.validator.iter_errors(bad)))

    def test_phase_one_rfq_enabled_is_constant_true(self):
        bad = copy.deepcopy(self.public_example)
        bad['rfqEnabled'] = False
        self.assertTrue(list(self.validator.iter_errors(bad)))

    def test_confirm_availability_forces_rfq_mode(self):
        bad = copy.deepcopy(self.public_example)
        bad['status'] = 'confirm-availability'
        bad['pricingMode'] = 'public'
        bad['publicUnitPrice'] = 2.5
        self.assertTrue(list(self.validator.iter_errors(bad)))

    def test_public_additional_properties_are_rejected(self):
        for key in ('supplierName','acquisitionCostPerUnit','internalNotes','reservedUnits','owner'):
            bad = copy.deepcopy(self.public_example)
            bad[key] = 'SECRET'
            self.assertTrue(list(self.validator.iter_errors(bad)), key)

    def test_public_text_rejects_markup_and_control_characters(self):
        for value in ('<script>alert(1)</script>','Product\x00Name','<b>Product</b>'):
            bad = copy.deepcopy(self.public_example)
            bad['title'] = value
            self.assertTrue(list(self.validator.iter_errors(bad)), repr(value))

    def test_snapshot_schema_references_packaged_item_schema(self):
        self.assertEqual(self.snapshot['properties']['items']['items']['$ref'], './public_inventory_item.schema.json')

    def test_openapi_external_references_resolve(self):
        refs = []
        def walk(value):
            if isinstance(value, dict):
                for k, v in value.items():
                    if k == '$ref' and isinstance(v, str) and not v.startswith('#'):
                        refs.append(v)
                    else:
                        walk(v)
            elif isinstance(value, list):
                for item in value:
                    walk(item)
        walk(self.openapi)
        self.assertTrue(refs)
        for ref in refs:
            self.assertTrue((C / ref.split('#', 1)[0]).is_file(), ref)

    def test_openapi_contains_only_intended_endpoints(self):
        self.assertEqual(set(self.openapi['paths']), {'/inventory','/inventory/{slug}','/internal/inventory/revalidate'})

    def test_openapi_revalidation_requires_replay_protection_headers(self):
        op = self.openapi['paths']['/internal/inventory/revalidate']['post']
        headers = {p['name'] for p in op['parameters'] if p['in'] == 'header'}
        self.assertEqual(headers, {'X-PSE-Key-Id','X-PSE-Timestamp','X-PSE-Nonce','X-PSE-Content-SHA256','X-PSE-Signature'})
        self.assertIn('409', op['responses'])

    def test_openapi_list_and_detail_expose_snapshot_version_headers(self):
        for path in ('/inventory','/inventory/{slug}'):
            headers = self.openapi['paths'][path]['get']['responses']['200']['headers']
            self.assertIn('X-PSE-Snapshot-Version', headers)
            self.assertIn('ETag', headers)

    def test_field_map_blocks_private_layers(self):
        with (C / 'public_private_field_map.csv').open(newline='', encoding='utf-8') as f:
            rows = list(csv.DictReader(f))
        blocked = {r['Private Path'] for r in rows if r['Disposition'] == 'BLOCK'}
        self.assertTrue({'supplier.*','privateCommercial.*','inventory.reservedUnits','inventory.onHandUnits'} <= blocked)

    def test_denylist_contains_high_risk_keys(self):
        deny = json.loads((C / 'privacy_field_denylist.json').read_text())
        exact = set(deny['prohibitedExactKeys'])
        self.assertTrue({'supplierName','acquisitionCostPerUnit','proofLinks','password','apiKey','bankAccount'} <= exact)

    def test_gate_rules_define_custom_operator_semantics(self):
        gate = json.loads((C / 'publish_gate_rules.json').read_text())
        used = {r['operator'] for r in gate['rules']}
        defined = set(gate['operatorSemantics'])
        self.assertFalse(used - defined)
        self.assertGreaterEqual(len(gate['rules']), 20)

    def test_openapi_revalidation_requires_key_id(self):
        api = self.openapi
        params = api['paths']['/internal/inventory/revalidate']['post']['parameters']
        names = {param.get('name') for param in params}
        self.assertIn('X-PSE-Key-Id', names)

    def test_revalidation_has_one_canonical_implementation(self):
        ref = ROOT / '04_REFERENCE_IMPLEMENTATION'
        self.assertTrue((ref / 'revalidation.py').is_file())
        self.assertFalse((ref / 'hmac_revalidation.py').exists())


if __name__ == '__main__':
    unittest.main(verbosity=2)
