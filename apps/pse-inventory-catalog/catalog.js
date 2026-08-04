/**
 * PSE inventory catalog — buyer-safe rendering and RFQ identity preservation.
 *
 * Consumes ONLY the public API responses (`GET /api/inventory`,
 * `GET /api/inventory/{slug}`). Private fields are rejected client-side as a
 * defense-in-depth mirror of the server allowlist.
 */

const PRIVATE_EXACT = new Set([
  'supplier', 'supplierName', 'supplierSku', 'contactReference',
  'acquisitionCost', 'acquisitionCostPerUnit', 'internalSellFloor',
  'internalSellFloorPerUnit', 'marketReferencePerUnit', 'margin', 'spread',
  'proofLink', 'proofLinks', 'proofEvidenceIds', 'owner', 'reviewer',
  'internalNotes', 'privateCommercial', 'reservedUnits', 'onHandUnits',
  'publishApproved', 'publishApproval', 'publishBlockers',
  'sourceRecordIds', 'sourceHashes', 'apiKey', 'password', 'token', 'credential', 'credentials',
  'bankAccount', 'routingNumber', 'paymentInstructions'
]);
const PRIVATE_FRAGMENTS = ['supplier', 'acquisition', 'internalsell', 'private', 'proof', 'secret', 'password', 'apikey', 'bankaccount', 'routingnumber', 'paymentinstruction', 'reservedunits', 'onhandunits'];

export function scanPrivate(value, path = '$') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanPrivate(entry, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const lowered = key.toLowerCase();
    if (PRIVATE_EXACT.has(key) || PRIVATE_FRAGMENTS.some(fragment => lowered.includes(fragment))) {
      throw new Error(`Private field detected at ${path}.${key}`);
    }
    scanPrivate(child, `${path}.${key}`);
  }
}

export function normalizePublicItem(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) throw new TypeError('Public item must be an object');
  scanPrivate(item);
  if (item.dealId !== undefined && typeof item.dealId !== 'string') throw new TypeError('dealId must be a string');
  return Object.freeze({ ...item });
}

export function formatQuantity(item) {
  if (item.status === 'confirm-availability' || item.quantityMode === 'confirm') return 'Confirm availability';
  if (item.quantityMode === 'range' && item.quantityRange) {
    return `${Number(item.quantityRange.minimum).toLocaleString()}\u2013${Number(item.quantityRange.maximum).toLocaleString()} units`;
  }
  if (Number.isInteger(item.availableToSell)) {
    return `${item.availableToSell.toLocaleString()} units available`;
  }
  return 'Availability not disclosed';
}

/**
 * Build the RFQ submission payload preserving inventory identity exactly:
 * Deal ID, slug, sourceVersion, snapshotVersion, requested quantity and the
 * referring URL. RFQ submission never decrements inventory (Phase 1).
 */
export function buildRfqPayload(item, requestedQuantity, referringUrl) {
  if (!item || typeof item !== 'object') throw new TypeError('item is required');
  const quantity = Number(requestedQuantity);
  if (!Number.isFinite(quantity) || quantity <= 0 || Math.trunc(quantity) !== quantity) {
    throw new RangeError('requestedQuantity must be a positive integer');
  }
  return Object.freeze({
    dealId: item.dealId,
    slug: item.slug || null,
    title: item.title || null,
    sourceVersion: item.sourceVersion || null,
    snapshotVersion: item.snapshotVersion || null,
    requestedQuantity: Math.trunc(quantity),
    referringUrl: referringUrl || null,
  });
}

export function buildRfqUrl(item, quantity, baseUrl = '/rfq') {
  const url = new URL(baseUrl, globalThis.location?.origin || 'https://pilotsalesdistribution.com');
  url.searchParams.set('dealId', item.dealId);
  if (item.slug) url.searchParams.set('slug', item.slug);
  if (item.sourceVersion) url.searchParams.set('sourceVersion', item.sourceVersion);
  if (item.snapshotVersion) url.searchParams.set('snapshotVersion', item.snapshotVersion);
  url.searchParams.set('product', item.title || item.slug || item.dealId);
  if (Number.isFinite(Number(quantity)) && Number(quantity) > 0) url.searchParams.set('quantity', String(Math.trunc(Number(quantity))));
  return url.toString();
}

export function renderInventoryCard(rawItem) {
  const item = normalizePublicItem(rawItem);
  const article = document.createElement('article');
  article.className = 'inventory-card';
  const title = document.createElement('h2');
  title.textContent = item.title || item.dealId;
  const quantity = document.createElement('p');
  quantity.textContent = formatQuantity(item);
  const terms = document.createElement('p');
  terms.textContent = [item.condition, item.fob ? `FOB ${item.fob}` : null, item.freightTerms]
    .filter(Boolean).join(' \u00b7 ');
  const link = document.createElement('a');
  link.href = buildRfqUrl(item, item.moqUnits);
  link.textContent = item.pricingMode === 'rfq' ? 'Request quote' : 'View offer';
  article.append(title, quantity, terms, link);
  return article;
}
