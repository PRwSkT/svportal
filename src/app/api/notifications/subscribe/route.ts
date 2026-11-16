import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { getAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedGuardianId } from '@/lib/parents/session';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subscription, deviceName } = body;

    if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return NextResponse.json({ error: 'Invalid subscription object' }, { status: 400 });
    }

    const user = await getServerUser();
    const guardianId = !user ? getAuthenticatedGuardianId(request) : null;

    if (!user && !guardianId) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required to subscribe to notifications' }, { status: 401 });
    }

    const admin = getAdminClient();
    let serverUserId: string | null = null;
    let serverEmail: string | null = null;
    let serverUserRole = 'staff';

    if (user) {
      serverUserId = user.id;
      serverEmail = user.email || null;
      const { data: appUser } = await admin
        .from('app_users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      serverUserRole = appUser?.role || 'staff';
    } else if (guardianId) {
      serverUserId = guardianId;
      serverUserRole = 'parent';
    }

    const payload = {
      user_id: serverUserId,
      user_email: serverEmail,
      user_role: serverUserRole,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      device_name: deviceName || 'Web Device',
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await admin
      .from('user_push_subscriptions')
      .upsert(payload, { onConflict: 'endpoint' })
      .select()
      .single();

    if (error) {
      console.error('[Notifications] Save subscription error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('[Notifications] Subscribe error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');

    if (!endpoint) {
      return NextResponse.json({ error: 'Missing endpoint query parameter' }, { status: 400 });
    }

    const user = await getServerUser();
    const guardianId = !user ? getAuthenticatedGuardianId(request) : null;

    if (!user && !guardianId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUserId = user ? user.id : guardianId;
    const admin = getAdminClient();

    // Verify ownership: only delete subscription belonging to the authenticated user/guardian
    let delQuery = admin
      .from('user_push_subscriptions')
      .delete()
      .eq('endpoint', endpoint);

    if (currentUserId) {
      delQuery = delQuery.eq('user_id', currentUserId);
    }

    const { error } = await delQuery;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
