/*
 * Buyer-safe PSE inventory client.
 *
 * Public pages use this module for the inventory catalog, detail pages and
 * RFQ links. It intentionally has no Firebase/Firestore dependency: the only
 * product source exposed to a browser is the validated public API.
 */
(function (window) {
    'use strict';

    const PRIVATE_KEYS = new Set([
        'supplier', 'supplierName', 'supplierId', 'acquisitionCost',
        'acquisitionCostPerUnit', 'sellFloor', 'margin', 'spread', 'owner',
        'reviewer', 'internalNotes', 'privateNotes', 'proofLinks',
        'proofEvidenceIds', 'privateCommercial', 'sourceRecordIds',
        'sourceHashes', 'marketReference', 'marketSource', 'bankInformation',
        'credentials', 'paymentInstructions'
    ]);

    function apiOrigin() {
        const configured = String(window.PSE_INVENTORY_API_ORIGIN || '').trim();
        if (!configured) return window.location.origin;
        try {
            const parsed = new URL(configured, window.location.origin);
            if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
                throw new Error('inventory API origin must use HTTPS');
            }
            return parsed.origin;
        } catch (error) {
            console.error('Invalid PSE_INVENTORY_API_ORIGIN; using same-origin API', error);
            return window.location.origin;
        }
    }

    function endpoint(path, params) {
        const url = new URL(path, apiOrigin());
        Object.entries(params || {}).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
        });
        return url;
    }

    function scanPublicItem(item) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            throw new TypeError('inventory item must be an object');
        }
        function visit(value, path) {
            if (!value || typeof value !== 'object') return;
            for (const key of Object.keys(value)) {
                if (PRIVATE_KEYS.has(key) || /private|internal|acquisition|sell.?floor|supplier|proof|credential|bank/i.test(key)) {
                    throw new Error('public inventory item contains a prohibited field: ' + path + key);
                }
                visit(value[key], path + key + '.');
            }
        }
        visit(item, '');
        return item;
    }

    // ImgBB serves images from i.ibb.co. Keep that direct HTTPS URL intact;
    // unlike an ibb.co or imgbb.com share page it can be used in an <img> tag.
    // This also makes imports tolerant of one URL, a JSON array, or media
    // objects returned by common upload integrations.
    function imageUrls(value) {
        const urls = [];
        const seen = new Set();
        function add(candidate) {
            if (!candidate) return;
            if (Array.isArray(candidate)) { candidate.forEach(add); return; }
            if (typeof candidate === 'object') {
                add(candidate.secure_url || candidate.url || candidate.downloadURL || candidate.download_url || candidate.src || candidate.image_url || candidate.imageUrl);
                return;
            }
            let url = String(candidate).trim();
            if (url.startsWith('[')) {
                try { add(JSON.parse(url)); return; } catch (error) { /* use the original value */ }
            }
            if (url.includes(',') && !/^data:/i.test(url)) url = url.split(',')[0].trim();
            if (!url || seen.has(url)) return;
            seen.add(url);
            urls.push(url);
        }
        add(value);
        return urls;
    }

    function mapItem(item, meta) {
        scanPublicItem(item);
        const images = imageUrls(item.imageUrls || item.image_urls || item.images || item.image_url || item.imageUrl);
        const isPublicPrice = item.pricingMode === 'public'
            && Number.isFinite(Number(item.publicUnitPrice));
        const available = Number.isInteger(item.availableToSell) && item.availableToSell > 0;
        const confirm = item.status === 'confirm-availability' || item.quantityMode === 'confirm';
        return {
            id: String(item.dealId || ''),
            dealId: String(item.dealId || ''),
            slug: item.slug || '',
            title: item.title || 'Product',
            shortDescription: item.shortDescription || '',
            brand: item.brand || '',
            category: item.category || 'other',
            condition: item.condition || '',
            moq: Number(item.moqUnits || 0),
            stock: available && !confirm ? Number(item.availableToSell) : 0,
            availableToSell: Number(item.availableToSell || 0),
            availability: confirm ? 'confirm' : (available ? 'in-stock' : 'unavailable'),
            pricingMode: item.pricingMode || 'rfq',
            price: isPublicPrice ? Number(item.publicUnitPrice) : null,
            image_url: images[0] || '',
            imageUrls: images,
            fob: item.fob || '',
            freightTerms: item.freightTerms || 'Freight quoted separately unless explicitly included.',
            inspectionTerms: item.inspectionTerms || '',
            returnTerms: item.returnTerms || '',
            lastAvailabilityConfirmedAt: item.lastAvailabilityConfirmedAt || '',
            availabilityExpiresAt: item.availabilityExpiresAt || '',
            sourceVersion: item.sourceVersion || (meta && meta.sourceVersion) || '',
            snapshotVersion: item.snapshotVersion || (meta && meta.snapshotVersion) || '',
            rfqEnabled: item.rfqEnabled !== false,
            seo: item.seo || null
        };
    }

    async function fetchJson(path, params, options) {
        const response = await fetch(endpoint(path, params), Object.assign({
            headers: { Accept: 'application/json' }
        }, options || {}));
        if (!response.ok) throw new Error('inventory API request failed: ' + response.status);
        return response.json();
    }

    async function list(options) {
        const opts = options || {};
        const items = [];
        let cursor = null;
        let meta = null;
        const maxPages = Math.min(Math.max(Number(opts.maxPages || 10), 1), 20);
        for (let page = 0; page < maxPages; page += 1) {
            const payload = await fetchJson('/api/inventory', {
                q: opts.q,
                category: opts.category,
                status: opts.status,
                limit: Math.min(Math.max(Number(opts.limit || 100), 1), 100),
                cursor
            }, opts.fetchOptions);
            if (!payload || !Array.isArray(payload.data) || !payload.meta) {
                throw new Error('inventory API returned an invalid list response');
            }
            meta = payload.meta;
            items.push(...payload.data.map(item => mapItem(item, meta)));
            cursor = payload.meta.nextCursor || null;
            if (!cursor) break;
        }
        return { items, meta };
    }

    async function get(slug) {
        if (!slug || typeof slug !== 'string') throw new TypeError('inventory slug is required');
        const item = await fetchJson('/api/inventory/' + encodeURIComponent(slug));
        return mapItem(item, null);
    }

    async function findByDealId(dealId) {
        if (!dealId) return null;
        const result = await list({ q: dealId, limit: 100, maxPages: 1 });
        return result.items.find(item => item.dealId === dealId) || null;
    }

    function buildRfqUrl(item, quantity) {
        const url = new URL('/rfq', window.location.origin);
        if (item && item.dealId) url.searchParams.set('dealId', item.dealId);
        if (item && item.slug) url.searchParams.set('slug', item.slug);
        if (item && item.title) url.searchParams.set('product', item.title);
        if (item && item.sourceVersion) url.searchParams.set('sourceVersion', item.sourceVersion);
        if (item && item.snapshotVersion) url.searchParams.set('snapshotVersion', item.snapshotVersion);
        const requested = Number(quantity || (item && item.moq));
        if (Number.isInteger(requested) && requested > 0) url.searchParams.set('quantity', String(requested));
        return url.pathname + url.search;
    }

    window.PSEInventory = Object.freeze({
        apiOrigin,
        buildRfqUrl,
        findByDealId,
        get,
        list,
        mapItem,
        scanPublicItem
    });
}(window));
