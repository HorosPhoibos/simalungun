// Service worker: lets the installed app open offline.
// - Page (navigation): network first, cached copy when offline.
// - Hashed build assets, data/*.json, icons: cache first (they only change by file name or rebuild).
// Bump CACHE when the data files change so old copies are dropped.
const CACHE = 'pustaha-v1';
const PRECACHE = ['./', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => {}) // e.g. behind the password page before login
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Only successful same-origin JSON/JS/CSS/image responses are cached, never the login page.
function cacheable(response) {
  if (!response || !response.ok || response.type !== 'basic') return false;
  const type = response.headers.get('content-type') || '';
  return !type.includes('text/html');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the app shell only when it is the app (status 200), not the login page (401).
          if (response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put('./', copy));
          }
          return response;
        })
        .catch(() => caches.match('./'))
    );
    return;
  }

  const path = new URL(request.url).pathname;
  if (/\/(assets|data|icons)\//.test(path) || path.endsWith('.webmanifest')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (cacheable(response) && !path.endsWith('.pdf')) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
  }
});
