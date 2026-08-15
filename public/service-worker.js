// ============================================
// Service Worker — SV Pickup App
// ============================================

const CACHE_NAME = 'sv-pickup-v6';

const STATIC_ASSETS = [
  './',
  './index.html',
  './register.html',
  './dashboard.html',
  './shared.js',
  './logo.png',
  './logo2.png',
  './icon-192.png',
  './icon-512.png',
  './sukhumvit.ttf',
  './manifest.json'
];

const CDN_RESOURCES = [
  'https://cdn.jsdelivr.net/npm/bulma@0.9.4/css/bulma.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700&display=swap'
];

// ── Install: Pre-cache static assets ──
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      console.log('[SW] Pre-caching static assets');
      return cache.addAll(STATIC_ASSETS.concat(CDN_RESOURCES));
    }).then(function() {
      // Activate immediately without waiting for existing clients to close
      return self.skipWaiting();
    })
  );
});

// ── Activate: Clean up old caches ──
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function(name) {
            return name !== CACHE_NAME;
          })
          .map(function(name) {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(function() {
      // Take control of all open clients immediately
      return self.clients.claim();
    })
  );
});

// ── Fetch: Strategy-based routing ──
self.addEventListener('fetch', function(event) {
  const requestUrl = event.request.url;

  // ─── BYPASS NEXT.JS INTERNAL ROUTES ───
  // ป้องกันไม่ให้ Service Worker ไปขัดจังหวะการทำงานของ Next.js (App Router, API, RSC)
  if (requestUrl.includes('/_next/') || requestUrl.includes('/api/') || requestUrl.includes('.rsc')) {
    return; // ให้เบราว์เซอร์ทำงานตามปกติ
  }

  // ─── API calls: Network-first with cache fallback ───
  if (requestUrl.includes('script.google.com') || requestUrl.includes('action=')) {
    event.respondWith(
      fetch(event.request)
        .then(function(networkResponse) {
          // ✅ Fix C5: Cache Storage รองรับเฉพาะ GET request เท่านั้น ป้องกัน TypeError กรณี POST
          if (networkResponse && networkResponse.ok && event.request.method === 'GET') {
            var responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(function() {
          // Network failed — try cache
          return caches.match(event.request).then(function(cachedResponse) {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Return a fallback JSON error if nothing cached
            return new Response(
              JSON.stringify({ error: true, message: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบอินเทอร์เน็ต' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
    return;
  }

  // ─── External CDN resources: Stale-while-revalidate ───
  if (
    requestUrl.includes('cdn.jsdelivr.net') ||
    requestUrl.includes('cdnjs.cloudflare.com') ||
    requestUrl.includes('fonts.googleapis.com') ||
    requestUrl.includes('fonts.gstatic.com')
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(function(cache) {
        return cache.match(event.request).then(function(cachedResponse) {
          var fetchPromise = fetch(event.request).then(function(networkResponse) {
            if (networkResponse && networkResponse.ok) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(function() {
            // Network failed; cachedResponse will be used if available
            return cachedResponse;
          });

          // Return cached response immediately, update in background
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // ─── Static assets: Cache-first with network fallback ───
  event.respondWith(
    caches.match(event.request).then(function(cachedResponse) {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then(function(networkResponse) {
        // Cache new resources for future use
        if (networkResponse && networkResponse.ok) {
          var responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(function() {
        // If both cache and network fail, return a basic offline page for navigation requests
        if (event.request.mode === 'navigate') {
          return new Response(
            '<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ออฟไลน์</title>' +
            '<style>body{font-family:"Kanit",sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#e6e6d7;color:#173d66;text-align:center;}' +
            '.offline{padding:2rem;}.offline h1{font-size:1.5rem;margin-bottom:1rem;}.offline p{font-size:1rem;opacity:0.8;}</style></head>' +
            '<body><div class="offline"><h1>📡 ไม่มีการเชื่อมต่ออินเทอร์เน็ต</h1><p>กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่อีกครั้ง</p></div></body></html>',
            { status: 503, headers: { 'Content-Type': 'text/html; charset=UTF-8' } }
          );
        }
      });
    })
  );
});
