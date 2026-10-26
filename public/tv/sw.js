// Android TV Signage Offline Cache Service Worker
const CACHE_NAME = 'sv-signage-v12';
const STATIC_ASSETS = [
  '/tv/',
  '/tv/index.html',
  '/tv/style.css',
  '/tv/player.js',
  '/tv/assets/images/logo.svg',
  '/tv/assets/images/emblem-white.png',
  '/tv/assets/images/emblem-navy.png',
  '/tv/assets/images/logo.png',
  '/tv/assets/images/logo-white.png',
  '/tv/assets/fonts/SukhumvitSet-Text.ttf',
  '/tv/assets/fonts/SukhumvitSet-SemiBold.ttf'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Network-first for scripts, styles, HTML and API requests to ensure real-time updates & audio fixes
  if (url.pathname.startsWith('/api/') || url.pathname.endsWith('.js') || url.pathname.endsWith('.html') || url.pathname.endsWith('.css')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const resClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for heavy static media and font assets
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const resClone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
        return response;
      });
    })
  );
});
