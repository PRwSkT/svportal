import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { getAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  try {
    const user = await getServerUser();

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');

    const admin = getAdminClient();

    let query = admin
      .from('app_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (user) {
      // Find role of user
      const { data: appUser } = await admin
        .from('app_users')
        .select('role')
        .eq('id', user.id)
        .single();

      const userRole = appUser?.role || 'staff';

      const roleConditions = [`recipient_role.eq.all`, `recipient_role.eq.${userRole}`];
      if (userRole === 'admin') {
        roleConditions.push('recipient_role.eq.academic staff', 'recipient_role.eq.executive', 'recipient_role.eq.teacher', 'recipient_role.eq.teachers');
      } else if (userRole === 'teacher') {
        roleConditions.push('recipient_role.eq.teachers');
      }

      query = query.or(`recipient_user_id.eq.${user.id},${roleConditions.join(',')}`);
    } else {
      query = query.eq('recipient_role', 'all');
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const unreadCount = (data || []).filter(n => !n.is_read).length;

    return NextResponse.json({
      success: true,
      unreadCount,
      notifications: data || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getServerUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { notificationId, markAll } = body;

    const admin = getAdminClient();

    if (markAll) {
      const { data: appUser } = await admin
        .from('app_users')
        .select('role')
        .eq('id', user.id)
        .single();

      const userRole = appUser?.role || 'staff';
      const roleConditions = [`recipient_role.eq.all`, `recipient_role.eq.${userRole}`];
      if (userRole === 'admin') {
        roleConditions.push('recipient_role.eq.academic staff', 'recipient_role.eq.executive', 'recipient_role.eq.teacher', 'recipient_role.eq.teachers');
      } else if (userRole === 'teacher') {
        roleConditions.push('recipient_role.eq.teachers');
      }

      await admin
        .from('app_notifications')
        .update({ is_read: true })
        .or(`recipient_user_id.eq.${user.id},${roleConditions.join(',')}`);

      return NextResponse.json({ success: true, markedAll: true });
    }

    if (notificationId) {
      await admin
        .from('app_notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Missing notificationId or markAll' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
