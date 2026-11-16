import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { getAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedGuardianId } from '@/lib/parents/session';

export async function GET(request: NextRequest) {
  try {
    const user = await getServerUser();
    const guardianId = !user ? getAuthenticatedGuardianId(request) : null;

    if (!user && !guardianId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');

    const admin = getAdminClient();

    let query = admin
      .from('app_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (user) {
      const { data: appUser } = await admin
        .from('app_users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      const userRole = appUser?.role || 'staff';
      const roleConditions = [`recipient_role.eq.all`, `recipient_role.eq.${userRole}`];
      if (userRole === 'admin' || userRole === 'executive') {
        roleConditions.push(
          'recipient_role.eq.academic staff',
          'recipient_role.eq.executive',
          'recipient_role.eq.teacher',
          'recipient_role.eq.teachers'
        );
      } else if (userRole === 'teacher') {
        roleConditions.push('recipient_role.eq.teachers');
      }

      query = query.or(`recipient_user_id.eq.${user.id},${roleConditions.join(',')}`);
    } else if (guardianId) {
      query = query.or(`recipient_user_id.eq.${guardianId},recipient_role.eq.parent,recipient_role.eq.all`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const unreadCount = (data || []).filter((n) => !n.is_read).length;

    return NextResponse.json({
      success: true,
      unreadCount,
      notifications: data || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getServerUser();
    const guardianId = !user ? getAuthenticatedGuardianId(request) : null;

    if (!user && !guardianId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { notificationId, markAll } = body;

    const admin = getAdminClient();
    const currentUserId = user ? user.id : guardianId!;

    let userRole = 'parent';
    const roleConditions = [`recipient_role.eq.all`];

    if (user) {
      const { data: appUser } = await admin
        .from('app_users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      userRole = appUser?.role || 'staff';
      roleConditions.push(`recipient_role.eq.${userRole}`);
      if (userRole === 'admin' || userRole === 'executive') {
        roleConditions.push(
          'recipient_role.eq.academic staff',
          'recipient_role.eq.executive',
          'recipient_role.eq.teacher',
          'recipient_role.eq.teachers'
        );
      } else if (userRole === 'teacher') {
        roleConditions.push('recipient_role.eq.teachers');
      }
    } else {
      roleConditions.push('recipient_role.eq.parent');
    }

    if (markAll) {
      await admin
        .from('app_notifications')
        .update({ is_read: true })
        .or(`recipient_user_id.eq.${currentUserId},${roleConditions.join(',')}`);

      return NextResponse.json({ success: true, markedAll: true });
    }

    if (notificationId) {
      // Validate ownership: only mark notification as read if it belongs to this user/role
      let updateQuery = admin
        .from('app_notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (userRole !== 'admin') {
        updateQuery = updateQuery.or(`recipient_user_id.eq.${currentUserId},${roleConditions.join(',')}`);
      }

      const { data: updated, error } = await updateQuery.select('id');
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!updated || updated.length === 0) {
        return NextResponse.json({ error: 'Notification not found or access denied' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Missing notificationId or markAll' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
