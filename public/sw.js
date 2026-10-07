// ============================================
// Service Worker — SV-Portal PWA & Web Push
// Somkidvittaya School
// ============================================

const CACHE_NAME = 'svportal-pwa-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ── Web Push Event: Display Push Notification ──
self.addEventListener('push', (event) => {
  let data = {
    title: 'โรงเรียนสมคิดวิทยา (SV Portal)',
    body: 'มีการแจ้งเตือนใหม่จากระบบ',
    icon: '/images/nongfah/nongfah-avatar.png',
    badge: '/logo2.png',
    data: { url: '/home' },
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/images/nongfah/nongfah-avatar.png',
    badge: data.badge || '/logo2.png',
    tag: data.tag || 'svportal-notification',
    data: data.data || { url: '/home' },
    renotify: true,
    vibrate: [100, 50, 100],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ── Notification Click: Focus existing window or open target URL ──
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/home';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, navigate and focus it
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
