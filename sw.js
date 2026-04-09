// Cache key is stamped automatically by the pre-commit hook on every deploy.
// Changing this string is what triggers browsers to install the updated worker.
const CACHE = 'balloon-archer-20260409155143';

// Static assets that are safe to cache long-term
const STATIC = [
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png',
];

// Allow the page to trigger skipWaiting (replaces the "waiting" SW immediately)
self.addEventListener('message', e => {
    if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// ── Install: cache static assets, activate immediately ──────
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE)
            .then(c => c.addAll(STATIC.map(u => new Request(u, { cache: 'reload' }))))
            .then(() => self.skipWaiting())
    );
});

// ── Activate: bin every old cache, claim open tabs ──────────
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => k !== CACHE).map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

// ── Fetch ────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);
    const isHTML = url.pathname === '/'
                || url.pathname.endsWith('/')
                || url.pathname.endsWith('.html');

    if (isHTML) {
        // Network-first for HTML so the app is always up-to-date when online.
        // Falls back to the last cached copy when offline.
        e.respondWith(
            fetch(e.request, { cache: 'no-store' })
                .then(res => {
                    const copy = res.clone();
                    caches.open(CACHE).then(c => c.put(e.request, copy));
                    return res;
                })
                .catch(() => caches.match(e.request))
        );
    } else {
        // Cache-first for everything else (icons, manifest …)
        e.respondWith(
            caches.match(e.request).then(cached => {
                if (cached) return cached;
                return fetch(e.request).then(res => {
                    const copy = res.clone();
                    caches.open(CACHE).then(c => c.put(e.request, copy));
                    return res;
                });
            })
        );
    }
});
