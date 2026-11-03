const CACHE_NAME = 'sv-tv-shell-v2';
const SHELL_URLS = [
  '/tv/',
  '/tv/index.html',
  '/tv/style.css',
  '/tv/player.js'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(SHELL_URLS).catch(err => {
        console.warn('[SW] Initial cache populate failed (will cache on fetch):', err);
      });
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Network-First with offline fallback for TV app shell
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Only intercept GET requests
  if (event.request.method !== 'GET') return;

  // Never cache API or media CDN requests (always direct network)
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase.co')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(async () => {
        // When network fails (e.g. net::ERR_NAME_NOT_RESOLVED before floor 2 breaker is on)
        const cached = await caches.match(event.request);
        if (cached) return cached;

        // Fallback for navigation requests
        if (event.request.mode === 'navigate' || url.pathname.startsWith('/tv/')) {
          const fallback = await caches.match('/tv/index.html') || await caches.match('/tv/');
          if (fallback) return fallback;
        }

        return new Response('Offline', { status: 503, statusText: 'Offline' });
      })
  );
});
