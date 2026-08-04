import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRfqUrl, formatQuantity, normalizePublicItem } from './catalog.js';

test('RFQ URL preserves canonical identity and source version', () => {
  const item = { dealId: 'PSE-TEST-0001', slug: 'test-product', title: 'Test Product', sourceVersion: 'sha256:' + '1'.repeat(64) };
  const url = new URL(buildRfqUrl(item, 500, 'https://pilotsalesdistribution.com/rfq'));
  assert.equal(url.searchParams.get('dealId'), item.dealId);
  assert.equal(url.searchParams.get('sourceVersion'), item.sourceVersion);
  assert.equal(url.searchParams.get('quantity'), '500');
});

test('confirm mode never formats an exact quantity', () => {
  assert.equal(formatQuantity({ quantityMode: 'confirm' }), 'Confirm availability');
});

test('normalizer rejects private fields instead of silently deleting them', () => {
  assert.throws(() => normalizePublicItem({ dealId: 'PSE-TEST-0001', supplier: 'Private Supplier' }), /private field/i);
});
