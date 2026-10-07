'use client';

/**
 * Client-side helper for PWA Web Push Notifications in SV-Portal
 */

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Register Service Worker for PWA
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    return registration;
  } catch (error) {
    console.error('[PWA] Service Worker registration failed:', error);
    return null;
  }
}

/**
 * Request notification permission and subscribe device to Web Push
 */
export async function subscribeToPushNotifications(options?: {
  deviceName?: string;
  userRole?: string;
}): Promise<{ success: boolean; error?: string; permission?: NotificationPermission }> {
  if (typeof window === 'undefined') {
    return { success: false, error: 'Window undefined' };
  }

  if (!('Notification' in window)) {
    return { success: false, error: 'อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับระบบแจ้งเตือน Web Push' };
  }

  if (!('serviceWorker' in navigator)) {
    return { success: false, error: 'เบราว์เซอร์ไม่รองรับ Service Worker' };
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    return { success: false, error: 'ระบบยังไม่ได้กำหนด VAPID Public Key บนเซิร์ฟเวอร์' };
  }

  try {
    // 1. Request user permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, permission, error: 'ผู้ใช้ยังไม่อนุญาตการแจ้งเตือน' };
    }

    // 2. Ensure service worker is ready
    let reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      reg = await registerServiceWorker() || undefined;
    }
    if (!reg) {
      return { success: false, error: 'ไม่สามารถเปิดใช้งาน Service Worker ได้' };
    }

    // 3. Subscribe to push manager
    const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey as any,
    });

    // 4. Send subscription to SV-Portal backend
    const res = await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        deviceName: options?.deviceName || navigator.userAgent.slice(0, 50),
        userRole: options?.userRole || 'staff',
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { success: false, error: errData.error || `HTTP ${res.status}` };
    }

    return { success: true, permission: 'granted' };
  } catch (err: any) {
    console.error('[WebPush] Subscription error:', err);
    return { success: false, error: err?.message || 'การสมัครรับการแจ้งเตือนล้มเหลว' };
  }
}

/**
 * Check if the current device already has active push subscription
 */
export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return null;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}
