import { renderInventoryCard } from './catalog.js';

const status = document.querySelector('#status');
const target = document.querySelector('#inventory');

try {
  const response = await fetch('/api/inventory?limit=100', {
    headers: {'Accept': 'application/json'},
  });
  if (!response.ok) throw new Error('inventory request failed');
  const payload = await response.json();
  target.replaceChildren(...payload.data.map(renderInventoryCard));
  status.textContent = `${payload.meta.totalCount} published offer${payload.meta.totalCount === 1 ? '' : 's'} · snapshot ${payload.meta.snapshotVersion.slice(0, 20)}…`;
} catch {
  status.textContent = 'Verified inventory is temporarily unavailable. Please use the general RFQ form.';
}
