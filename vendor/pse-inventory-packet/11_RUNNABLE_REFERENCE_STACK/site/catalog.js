const PRIVATE_EXACT = new Set([
  'supplier', 'supplierName', 'acquisitionCost', 'acquisitionCostPerUnit',
  'internalSellFloor', 'internalSellFloorPerUnit', 'margin', 'spread',
  'proofLink', 'proofLinks', 'owner', 'reviewer', 'notes', 'privateCommercial',
  'reservedUnits', 'onHandUnits', 'apiKey', 'password', 'bankAccount'
]);
const PRIVATE_FRAGMENTS = ['supplier', 'acquisition', 'internal', 'margin', 'proof', 'secret', 'password', 'bank'];

function scanPrivate(value, path = '$') {
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
  if (item.quantityMode === 'confirm') return 'Confirm availability';
  if (item.quantityMode === 'range' && item.quantityRange) {
    return `${Number(item.quantityRange.minimum).toLocaleString()}–${Number(item.quantityRange.maximum).toLocaleString()} units`;
  }
  if (item.quantityMode === 'exact' && Number.isInteger(item.availableToSell)) {
    return `${item.availableToSell.toLocaleString()} units available`;
  }
  return 'Availability not disclosed';
}

export function buildRfqUrl(item, quantity, baseUrl = '/rfq') {
  const url = new URL(baseUrl, globalThis.location?.origin || 'https://pilotsalesdistribution.com');
  url.searchParams.set('dealId', item.dealId);
  url.searchParams.set('sourceVersion', item.sourceVersion);
  url.searchParams.set('product', item.title || item.slug || item.dealId);
  if (Number.isFinite(Number(quantity)) && Number(quantity) > 0) url.searchParams.set('quantity', String(Math.trunc(Number(quantity))));
  if (item.slug) url.searchParams.set('slug', item.slug);
  return url.toString();
}

export function renderInventoryCard(rawItem) {
  const item = normalizePublicItem(rawItem);
  const article = document.createElement('article');
  article.className = 'inventory-card';
  const title = document.createElement('h2');
  title.textContent = item.title;
  const quantity = document.createElement('p');
  quantity.textContent = formatQuantity(item);
  const terms = document.createElement('p');
  terms.textContent = `${item.condition} · FOB ${item.fob} · ${item.freightTerms}`;
  const link = document.createElement('a');
  link.href = buildRfqUrl(item, item.moqUnits);
  link.textContent = 'Request quote';
  article.append(title, quantity, terms, link);
  return article;
}
