// Service Worker Cache Invalidation & Direct Passthrough
self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => caches.delete(key))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Always fetch fresh from network
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
