const STATIC_CACHE = 'shorturl-static-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.add('/')).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // API requests go to another origin and must always use the network.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/')));
    return;
  }

  if (!url.pathname.startsWith('/_next/') && !url.pathname.startsWith('/logo-') && url.pathname !== '/manifest.json') return;

  event.respondWith(
    caches.match(request).then((cached) => cached ?? fetch(request).then((response) => {
      if (response.ok) void caches.open(STATIC_CACHE).then((cache) => cache.put(request, response.clone()));
      return response;
    })),
  );
});
