// MLB Bullpen Health Tracker — Service Worker
const CACHE_NAME = 'ubt-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/ubt-intro.gif',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()) // Don't block install if caching fails
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) return;

  // Skip all Next.js internal requests (HMR, static chunks, etc.)
  if (url.pathname.startsWith('/_next/')) return;

  // Skip API routes — always fetch fresh
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        // Only cache successful responses
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return res;
      })
      .catch(() =>
        // Try cache fallback; if nothing found return a proper offline response
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          return new Response('Offline — content not cached', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          });
        })
      )
  );
});
