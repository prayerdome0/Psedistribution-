// ============================================
// SW.JS - Pilot Sales Distribution
// Progressive Web App service worker:
//   • Network-first for HTML pages (always fresh catalog)
//   • Cache-first for static assets (CSS/JS/images/fonts)
//   • Offline fallback shell
// Bump CACHE_VERSION on deploys to invalidate old caches.
// ============================================
const CACHE_VERSION = 'pse-v2';
const STATIC_CACHE = CACHE_VERSION + '-static';
const PAGE_CACHE = CACHE_VERSION + '-pages';

const PRECACHE = [
    '/index.html',
    '/style.css',
    '/main.js',
    '/logo.webp',
    '/offline.html',
    '/manifest.json',
    '/favicon.ico'
];

const STATIC_EXT = /\.(css|js|png|jpe?g|webp|gif|svg|ico|woff2?|ttf|csv)(\?.*)?$/i;

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => cache.addAll(PRECACHE))
            .catch(() => {})
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k))
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // Never cache Firebase/Google APIs or non-GET requests
    if (/googleapis\.com|gstatic\.com|firestore|firebase/.test(url.hostname)) return;
    if (url.origin !== self.location.origin) return;

    // HTML pages/navigation: network-first, fall back to cache when offline
    if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
        event.respondWith(
            fetch(req)
                .then((res) => {
                    if (res && res.ok) {
                        const clone = res.clone();
                        caches.open(PAGE_CACHE).then((cache) => cache.put(req, clone));
                    }
                    return res;
                })
                .catch(() =>
                    caches.match(req).then((cached) => cached || caches.match('/offline.html'))
                )
        );
        return;
    }

    // Static assets: cache-first with background fill
    if (STATIC_EXT.test(url.pathname)) {
        event.respondWith(
            caches.match(req).then((cached) => {
                const network = fetch(req)
                    .then((res) => {
                        if (res && res.ok) {
                            const clone = res.clone();
                            caches.open(STATIC_CACHE).then((cache) => cache.put(req, clone));
                        }
                        return res;
                    })
                    .catch(() => cached);
                return cached || network;
            })
        );
    }
});
