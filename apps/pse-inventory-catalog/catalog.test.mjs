import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRfqPayload, buildRfqUrl, normalizePublicItem, scanPrivate } from './catalog.js';

test('RFQ preserves inventory identity and requested quantity', () => {
  const payload = buildRfqPayload({
    dealId: 'PSE-TEST-0001', slug: 'test-product', sourceVersion: 'sha256:' + 'a'.repeat(64),
    snapshotVersion: 'sha256:' + 'b'.repeat(64), title: 'Test Product'
  }, 500, 'https://pilotsalesdistribution.com/products/test-product');
  assert.equal(payload.dealId, 'PSE-TEST-0001');
  assert.equal(payload.slug, 'test-product');
  assert.equal(payload.requestedQuantity, 500);
  assert.equal(payload.referringUrl, 'https://pilotsalesdistribution.com/products/test-product');
  assert.match(payload.sourceVersion, /^sha256:/);
  assert.match(payload.snapshotVersion, /^sha256:/);
});

test('RFQ quantity must be a positive integer', () => {
  assert.throws(() => buildRfqPayload({ dealId: 'X' }, 0), RangeError);
  assert.throws(() => buildRfqPayload({ dealId: 'X' }, -3), RangeError);
  assert.throws(() => buildRfqPayload({ dealId: 'X' }, 1.5), RangeError);
});

test('private fields are rejected before rendering', () => {
  assert.throws(() => scanPrivate({ dealId: 'X', supplier: { name: 'leak' } }), /Private field/);
  assert.throws(() => scanPrivate({ nested: { acquisitionCostPerUnit: 1 } }), /Private field/);
  assert.throws(() => normalizePublicItem({ dealId: 'X', internalNotes: 'private' }), /Private field/);
});

test('RFQ URL carries identity parameters', () => {
  const url = buildRfqUrl({
    dealId: 'PSE-TEST-0002', slug: 'demo', sourceVersion: 'sha256:' + 'c'.repeat(64),
    snapshotVersion: 'sha256:' + 'd'.repeat(64), title: 'Demo'
  }, 12, '/rfq');
  assert.match(url, /dealId=PSE-TEST-0002/);
  assert.match(url, /slug=demo/);
  assert.match(url, /sourceVersion=sha256/);
  assert.match(url, /snapshotVersion=sha256/);
  assert.match(url, /quantity=12/);
});
