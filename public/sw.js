// Jinaq service worker — offline shell + safe caching.
// Bump CACHE_NAME when changing caching rules so old caches are dropped.
const CACHE_NAME = 'jinaq-cache-v3';

const APP_SHELL = [
  '/',
  '/login',
  '/register',
  '/dashboard',
  '/manifest.json',
  '/brand/logo-mark.svg',
  '/favicon-32.png',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

const IS_DEV = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

self.addEventListener('install', (event) => {
  if (!IS_DEV) {
    event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(APP_SHELL).catch(() => {})));
  }
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME || IS_DEV).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (IS_DEV || request.method !== 'GET') return;

  const url = new URL(request.url);
  // Only handle our own origin; Firebase and other APIs go straight to the network.
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // Page navigations: network first, cached copy when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match('/dashboard'))),
    );
    return;
  }

  // Build assets have content hashes in their names: safe to serve from cache forever.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, copy));
          }
          return res;
        }),
      ),
    );
    return;
  }

  // Everything else (icons, manifest, fonts…): serve cached copy, refresh in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
