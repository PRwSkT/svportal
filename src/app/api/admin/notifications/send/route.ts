import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getAdminClient } from '@/lib/supabase/admin';
import { broadcastPushNotifications, sendPushNotification } from '@/lib/notifications/webpush';

export async function POST(request: Request) {
  try {
    const auth = await requireAuth('admin');
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const payload = await request.json();
    const {
      title,
      body,
      category = 'general',
      targetRole = 'all',
      recipientUserId,
      actionUrl = '/home',
      sendPush = true,
      sendInApp = true,
      sentBy = 'nongfah_ai',
    } = payload;

    if (!title || !body) {
      return NextResponse.json({ error: 'Title and body are required' }, { status: 400 });
    }

    const admin = getAdminClient();

    // 1. Create in-app notification record
    let inAppRecord = null;
    if (sendInApp) {
      const { data, error: inAppErr } = await admin
        .from('app_notifications')
        .insert({
          title,
          body,
          category,
          recipient_role: targetRole,
          recipient_user_id: recipientUserId || null,
          action_url: actionUrl,
          sent_by: sentBy,
          is_read: false,
        })
        .select()
        .single();

      if (inAppErr) {
        console.error('[Notification Send] Failed to insert in-app record:', inAppErr);
      } else {
        inAppRecord = data;
      }
    }

    // 2. Deliver Web Push Notification to registered devices
    let pushSummary = { total: 0, sent: 0, failed: 0, expired: 0 };
    if (sendPush) {
      let query = admin.from('user_push_subscriptions').select('*');

      if (recipientUserId) {
        query = query.eq('user_id', recipientUserId);
      } else if (targetRole !== 'all') {
        query = query.or(`user_role.eq.${targetRole},user_role.eq.all`);
      }

      const { data: subscriptions, error: subErr } = await query;

      if (!subErr && subscriptions && subscriptions.length > 0) {
        pushSummary = await broadcastPushNotifications(
          subscriptions,
          {
            title,
            body,
            url: actionUrl,
            tag: `svportal-${category}-${Date.now()}`,
          }
        );
      }
    }

    return NextResponse.json({
      success: true,
      inAppRecord,
      pushResults: pushSummary,
    });
  } catch (err: any) {
    console.error('[Notification Send] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
