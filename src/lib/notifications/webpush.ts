import webpush from 'web-push';
import { getAdminClient } from '@/lib/supabase/admin';

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  data?: Record<string, any>;
}

export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface UserPushSubscriptionRecord {
  id: string;
  user_id: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_role?: string;
  user_email?: string;
  device_name?: string;
}

let vapidConfigured = false;

export function configureWebPush(): boolean {
  if (vapidConfigured) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:mail@somkidvittaya.ac.th';

  if (!publicKey || !privateKey) {
    console.warn('[WebPush] VAPID keys not configured in environment variables');
    return false;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
    return true;
  } catch (err: any) {
    console.error('[WebPush] Failed to configure VAPID:', err.message);
    return false;
  }
}

/**
 * Send a web push notification to a specific subscription record.
 * If the subscription is no longer valid (404/410), automatically delete it from database.
 */
export async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushNotificationPayload
): Promise<{ success: boolean; error?: string; expired?: boolean }> {
  if (!configureWebPush()) {
    return { success: false, error: 'WebPush not configured' };
  }

  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };

  const notificationData = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || '/images/nongfah/nongfah-avatar.png',
    badge: payload.badge || '/icons/badge-96.png',
    tag: payload.tag || 'svportal-notification',
    data: {
      url: payload.url || '/home',
      ...payload.data,
    },
  });

  try {
    await webpush.sendNotification(pushSubscription, notificationData);
    return { success: true };
  } catch (err: any) {
    const statusCode = err?.statusCode;
    console.warn(`[WebPush] Push delivery failed (HTTP ${statusCode}):`, err?.message);

    // 404 Not Found or 410 Gone means device unsubscribed or subscription expired
    if (statusCode === 404 || statusCode === 410) {
      try {
        const supabase = getAdminClient();
        await supabase
          .from('user_push_subscriptions')
          .delete()
          .eq('endpoint', subscription.endpoint);
        console.log(`[WebPush] Removed expired subscription endpoint: ${subscription.endpoint.slice(0, 40)}...`);
      } catch (cleanErr: any) {
        console.error('[WebPush] Failed to cleanup expired subscription:', cleanErr?.message);
      }
      return { success: false, error: 'Subscription expired or unregistered', expired: true };
    }

    return { success: false, error: err?.message || 'Push delivery failed' };
  }
}

/**
 * Batch dispatch push notifications to multiple subscriptions
 */
export async function broadcastPushNotifications(
  subscriptions: Array<{ endpoint: string; p256dh: string; auth: string }>,
  payload: PushNotificationPayload
): Promise<{ total: number; sent: number; failed: number; expired: number }> {
  let sent = 0;
  let failed = 0;
  let expired = 0;

  await Promise.all(
    subscriptions.map(async (sub) => {
      const result = await sendPushNotification(sub, payload);
      if (result.success) {
        sent++;
      } else {
        failed++;
        if (result.expired) expired++;
      }
    })
  );

  return { total: subscriptions.length, sent, failed, expired };
}
