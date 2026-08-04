import copy
import json
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve(); REF = HERE.parents[1]; ROOT = HERE.parents[2]
sys.path.insert(0, str(REF))
from atomic_store import StoreError, load_snapshot, promote_snapshot, rollback_snapshot  # noqa: E402
from publisher import build_snapshot, compute_record_version, sha256_prefixed  # noqa: E402

EXAMPLE = json.loads((ROOT / '03_CONTRACTS/canonical_inventory_record.example.json').read_text())
NOW = datetime(2026,8,3,20,5,tzinfo=timezone.utc)


class AtomicStoreTests(unittest.TestCase):
    def snapshot(self, suffix='1'):
        record = copy.deepcopy(EXAMPLE)
        if suffix != '1':
            record['dealId'] = f'PSE-EXAMPLE-00{suffix}'
            record['publicProfile']['slug'] = f'example-product-{suffix}'
            record['source']['sourceVersion'] = sha256_prefixed([f'source-v{suffix}'])
            record['recordVersion'] = compute_record_version(record)
            record['publishApproval']['approvalVersion'] = record['recordVersion']
        return build_snapshot([record], now=NOW, run_id=f'RUN-{suffix}', release_id='REL', operator='tester')[0]

    def test_promote_creates_current_and_history(self):
        with tempfile.TemporaryDirectory() as td:
            store = Path(td)
            first = self.snapshot('1'); promote_snapshot(store, first)
            self.assertEqual(load_snapshot(store/'current.json'), first)
            second = self.snapshot('2'); promote_snapshot(store, second)
            self.assertEqual(load_snapshot(store/'current.json'), second)
            history = store/'history'/(first['snapshotVersion'].replace(':','_')+'.json')
            self.assertTrue(history.is_file())

    def test_invalid_snapshot_never_replaces_current(self):
        with tempfile.TemporaryDirectory() as td:
            store = Path(td); good = self.snapshot('1'); promote_snapshot(store, good)
            bad = copy.deepcopy(good); bad['recordCount'] = 999
            with self.assertRaises(StoreError):
                promote_snapshot(store, bad)
            self.assertEqual(load_snapshot(store/'current.json'), good)

    def test_rollback_restores_selected_version(self):
        with tempfile.TemporaryDirectory() as td:
            store = Path(td); first = self.snapshot('1'); second = self.snapshot('2')
            promote_snapshot(store, first); promote_snapshot(store, second)
            rollback_snapshot(store, first['snapshotVersion'])
            self.assertEqual(load_snapshot(store/'current.json')['snapshotVersion'], first['snapshotVersion'])

    def test_path_traversal_rollback_version_is_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            with self.assertRaises(StoreError):
                rollback_snapshot(Path(td), '../../etc/passwd')

    def test_tampered_history_snapshot_cannot_rollback(self):
        with tempfile.TemporaryDirectory() as td:
            store = Path(td); first = self.snapshot('1'); second = self.snapshot('2')
            promote_snapshot(store, first); promote_snapshot(store, second)
            history = store/'history'/(first['snapshotVersion'].replace(':','_')+'.json')
            data = json.loads(history.read_text()); data['items'][0]['title'] = 'Tampered'; history.write_text(json.dumps(data))
            with self.assertRaises(StoreError):
                rollback_snapshot(store, first['snapshotVersion'])
            self.assertEqual(load_snapshot(store/'current.json')['snapshotVersion'], second['snapshotVersion'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
