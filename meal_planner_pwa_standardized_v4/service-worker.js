const CACHE_NAME = 'meal-planner-standardized-v13';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/logo-leaf-180.png',
  './icons/logo-leaf-192.png',
  './icons/logo-leaf-512.png',
  './icons/logo-leaf-1024.png'
];

// Install: cache only the app shell.
// Do NOT pre-cache recipes.csv because it changes.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );

  self.skipWaiting();
});

// Activate: remove old caches.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
  );

  self.clients.claim();
});

// Fetch strategy:
// 1. recipes.csv = network-first, so recipe/image changes are picked up
// 2. index.html navigation = network-first
// 3. other app shell files = cache-first
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Always try to get the latest recipes.csv first.
  if (url.pathname.endsWith('/recipes.csv')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(response => {
          const copy = response.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, copy);
          });

          return response;
        })
        .catch(() => caches.match(event.request))
    );

    return;
  }

  // For page navigation, try the network first, then fallback to cached index.html.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put('./index.html', copy);
          });

          return response;
        })
        .catch(() => caches.match('./index.html'))
    );

    return;
  }

  // For static files, use cache first.
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request);
    })
  );
});