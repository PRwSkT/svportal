import { getAdminClient } from '@/lib/supabase/admin';
import { broadcastPushNotifications } from '@/lib/notifications/webpush';
import { isSystemAdmin } from '@/lib/constants/auth';
import { expandHolidayDates } from '@/lib/attendance/analytics';
import {
  computeEffectiveLeaveDates,
  computeWorkingDatesInRange,
  deduplicateNotifiedUsers,
  formatLeaveDateRangeTh,
  LEAVE_TYPE_LABELS,
  OrgResponsibilityRole,
  resolveMatchedOrgRoles,
  StaffLeaveRequest,
  NotifiedRecipientLog,
} from './helpers';

export * from './helpers';

export interface LeavePermissions {
  canViewDashboard: boolean;
  canApprove: boolean;
  canManageOrg: boolean;
  assignedRoleTitles: string[];
}

export async function getAllOrgRoles(): Promise<OrgResponsibilityRole[]> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('org_responsibility_roles')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[LeaveWorkflow] Failed to load org_responsibility_roles:', error.message);
    return [];
  }
  return (data || []) as OrgResponsibilityRole[];
}

/**
 * STRICT DIRECTOR-ONLY APPROVAL CHECK:
 * Only users explicitly listed in an active `org_responsibility_roles` row with `can_approve = true`
 * (seeded as `director_approver`: ผ.อ. นาย ณัฐวัฒน์ สงเคราะห์ธรรม) may approve or reject requests.
 */
export async function isDirectorApprover(userId: string): Promise<boolean> {
  if (!userId) return false;
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('org_responsibility_roles')
    .select('assigned_user_ids')
    .eq('can_approve', true)
    .eq('is_active', true);

  if (error || !data) return false;
  return data.some((row) =>
    Array.isArray(row.assigned_user_ids) && row.assigned_user_ids.includes(userId)
  );
}

export async function canAccessLeaveDashboard(
  userId: string,
  role?: string | null,
  assignedFeatures?: string[] | null,
  email?: string | null
): Promise<LeavePermissions> {
  const roles = await getAllOrgRoles();
  const activeRolesForUser = roles.filter(
    (r) =>
      r.is_active &&
      Array.isArray(r.assigned_user_ids) &&
      r.assigned_user_ids.includes(userId)
  );

  const canApprove = activeRolesForUser.some((r) => r.can_approve === true);
  const isAdmin = role === 'admin' || isSystemAdmin(email);
  const canManageOrg = isAdmin || canApprove;
  const hasFeature =
    Array.isArray(assignedFeatures) &&
    (assignedFeatures.includes('admin_leave') || assignedFeatures.includes('admin_attendance'));

  const canViewDashboard =
    canApprove ||
    canManageOrg ||
    role === 'executive' ||
    hasFeature ||
    activeRolesForUser.length > 0;

  return {
    canViewDashboard,
    canApprove,
    canManageOrg,
    assignedRoleTitles: activeRolesForUser.map((r) => r.title_th),
  };
}

export async function getHolidayDatesBetween(
  startDate: string,
  endDate: string
): Promise<Set<string>> {
  const admin = getAdminClient();
  const { data: events, error } = await admin
    .from('calendar_events')
    .select('start_date, end_date, is_holiday, category, title_th')
    .eq('is_holiday', true)
    .lte('start_date', endDate)
    .or(`end_date.gte.${startDate},end_date.is.null`);

  if (error || !events) return new Set<string>();
  return expandHolidayDates(events, startDate, endDate);
}

export async function generateRequestCode(): Promise<string> {
  const admin = getAdminClient();
  const now = new Date();
  const bkk = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
  }).format(now);
  const ym = bkk.replace('-', '');
  const prefix = `LV-${ym}-`;

  const { data } = await admin
    .from('staff_leave_requests')
    .select('request_code')
    .like('request_code', `${prefix}%`)
    .order('request_code', { ascending: false })
    .limit(1);

  let nextSeq = 1;
  if (data && data.length > 0 && data[0].request_code) {
    const suffix = data[0].request_code.slice(prefix.length);
    const parsed = parseInt(suffix, 10);
    if (Number.isFinite(parsed) && parsed >= 1) {
      nextSeq = parsed + 1;
    }
  }
  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

export async function dispatchLeaveNotifications(params: {
  request: StaffLeaveRequest;
  event: 'submit' | 'approve' | 'reject';
  roles?: OrgResponsibilityRole[];
  notifyApplicant?: boolean;
  approverComment?: string | null;
}): Promise<NotifiedRecipientLog[]> {
  const { request, event, notifyApplicant = false, approverComment } = params;
  const admin = getAdminClient();
  const roles = params.roles || (await getAllOrgRoles());
  const nowIso = new Date().toISOString();
  const leaveLabel = LEAVE_TYPE_LABELS[request.leave_type]?.labelTh || request.leave_type;
  const dateRangeTh = formatLeaveDateRangeTh(request.start_date, request.end_date);
  const logs: NotifiedRecipientLog[] = [];

  // Load user names + push subscriptions in parallel
  const matched = resolveMatchedOrgRoles(roles, {
    event,
    leaveType: request.leave_type,
    applicantDepartment: request.applicant_department,
    applicantUserId: request.user_id,
  });

  const deduplicatedOrgUsers = deduplicateNotifiedUsers(matched);
  const targetUserIds = new Set<string>(deduplicatedOrgUsers.map((u) => u.userId));
  if (notifyApplicant) targetUserIds.add(request.user_id);

  if (targetUserIds.size === 0) return logs;

  const userIdsArray = Array.from(targetUserIds);
  const [{ data: appUsers }, { data: subscriptions }] = await Promise.all([
    admin.from('app_users').select('id, full_name').in('id', userIdsArray),
    admin.from('user_push_subscriptions').select('*').in('user_id', userIdsArray),
  ]);

  const nameMap = new Map<string, string>();
  for (const u of appUsers || []) {
    nameMap.set(u.id, u.full_name);
  }

  const subsByUser = new Map<string, Array<{ endpoint: string; p256dh: string; auth: string }>>();
  for (const s of subscriptions || []) {
    if (!s.user_id) continue;
    const list = subsByUser.get(s.user_id) || [];
    list.push({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth });
    subsByUser.set(s.user_id, list);
  }

  const sendToUser = async (opts: {
    userId: string;
    title: string;
    body: string;
    actionUrl: string;
    category: string;
    roleKey: string;
    titleTh: string;
  }) => {
    const { error: notifErr } = await admin.from('app_notifications').insert({
      recipient_user_id: opts.userId,
      recipient_role: null,
      title: opts.title,
      body: opts.body,
      category: opts.category,
      action_url: opts.actionUrl,
      sent_by: 'sv_leave_system',
      is_read: false,
      metadata: {
        leaveRequestId: request.id,
        requestCode: request.request_code,
        event,
        roleKey: opts.roleKey,
      },
    });

    if (notifErr) {
      console.error('[LeaveNotification] app_notifications insert failed:', notifErr.message);
    }

    const userSubs = subsByUser.get(opts.userId) || [];
    let pushSent = false;
    if (userSubs.length > 0) {
      try {
        const pushRes = await broadcastPushNotifications(userSubs, {
          title: opts.title,
          body: opts.body,
          url: opts.actionUrl,
          tag: `svportal-leave-${request.id}-${event}`,
          data: {
            leaveRequestId: request.id,
            requestCode: request.request_code,
            event,
          },
        });
        pushSent = pushRes.sent > 0;
      } catch (pushErr: any) {
        console.error('[LeaveNotification] push broadcast failed:', pushErr?.message);
      }
    }

    logs.push({
      role_key: opts.roleKey,
      title_th: opts.titleTh,
      user_id: opts.userId,
      full_name: nameMap.get(opts.userId) || 'ผู้รับผิดชอบตามโครงสร้าง',
      event,
      channel: pushSent ? 'in_app_and_push' : 'in_app',
      sent_at: nowIso,
    });
  };

  // 1. Notify Applicant on Decision
  if (notifyApplicant && (event === 'approve' || event === 'reject')) {
    const isApproved = event === 'approve';
    const title = isApproved
      ? `[อนุมัติแล้ว] คำขอ${leaveLabel} (${request.request_code})`
      : `[ไม่อนุมัติ] คำขอ${leaveLabel} (${request.request_code})`;
    const commentText = approverComment ? ` | ความเห็น ผ.อ.: "${approverComment}"` : '';
    const body = isApproved
      ? `ผู้อำนวยการอนุมัติ${leaveLabel} วันที่ ${dateRangeTh} (${request.total_days} วัน) แล้ว และแจ้งเตือนฝ่ายที่เกี่ยวข้องเรียบร้อย`
      : `ผู้อำนวยการไม่อนุมัติคำขอ${leaveLabel} วันที่ ${dateRangeTh}${commentText}`;

    await sendToUser({
      userId: request.user_id,
      title,
      body,
      actionUrl: '/leave',
      category: isApproved ? 'hr_leave' : 'urgent',
      roleKey: 'applicant',
      titleTh: 'ผู้ยื่นคำขอ',
    });
  }

  // 2. Notify Matched Org Structure Roles
  for (const recipient of deduplicatedOrgUsers) {
    const roleLabels = recipient.roles.map((r) => r.titleTh).join(', ');
    const primaryRoleKey = recipient.roles.map((r) => r.roleKey).join(',');

    let title = '';
    let body = '';

    if (event === 'submit') {
      title = `[รอ ผ.อ. อนุมัติ] ${request.applicant_name} ขอ${leaveLabel}`;
      body = `${request.applicant_name} (${request.applicant_position || request.applicant_department}) ยื่น${leaveLabel} วันที่ ${dateRangeTh} (${request.total_days} วัน) เหตุผล: ${request.reason}`;
    } else if (event === 'approve') {
      const extraParts: string[] = [];
      if (request.destination) extraParts.push(`สถานที่: ${request.destination}`);
      if (request.document_ref) extraParts.push(`เลขที่หนังสือ: ${request.document_ref}`);
      if (request.substitute_note) extraParts.push(`ฝากงาน/สอนแทน: ${request.substitute_note}`);
      const extraText = extraParts.length > 0 ? ` | ${extraParts.join(' | ')}` : '';

      title = `[ผ.อ. อนุมัติแล้ว - แจ้ง ${roleLabels}] ${request.applicant_name} (${leaveLabel})`;
      body = `${request.applicant_name} (${request.applicant_department}) ได้รับอนุมัติ${leaveLabel} วันที่ ${dateRangeTh} (${request.total_days} วัน)${extraText}`;
    } else {
      title = `[แจ้งเพื่อทราบ: ไม่อนุมัติ] ${request.applicant_name} (${leaveLabel})`;
      body = `คำขอ${leaveLabel}ของ ${request.applicant_name} วันที่ ${dateRangeTh} ไม่ได้รับอนุมัติ${approverComment ? ` (${approverComment})` : ''}`;
    }

    await sendToUser({
      userId: recipient.userId,
      title,
      body,
      actionUrl: `/admin/leave?request=${request.id}`,
      category: event === 'submit' ? 'urgent' : 'hr_leave',
      roleKey: primaryRoleKey,
      titleTh: roleLabels,
    });
  }

  return logs;
}

/**
 * Syncs approved full-day leave dates into public.attendance_records with NULL punches
 * (recognised as วันลา / ราชการ in analytics & admin attendance) without overwriting real punches.
 */
export async function syncApprovedLeaveToAttendance(
  request: StaffLeaveRequest
): Promise<{ syncedDates: string[]; skippedDates: string[] }> {
  if (request.duration_type !== 'full_day') {
    return { syncedDates: [], skippedDates: [] };
  }

  const holidayDates = await getHolidayDatesBetween(request.start_date, request.end_date);
  const workingDates = computeWorkingDatesInRange(
    request.start_date,
    request.end_date,
    holidayDates
  );

  // Use effective dates if it's an official duty on working dates; never pollute weekend dates in attendance_records
  const targetDates =
    workingDates.length > 0
      ? workingDates
      : computeEffectiveLeaveDates(
          request.start_date,
          request.end_date,
          request.leave_type,
          holidayDates
        ).filter((iso) => {
          const dow = new Date(`${iso}T00:00:00Z`).getUTCDay();
          return dow !== 0 && dow !== 6 && !holidayDates.has(iso);
        });

  if (targetDates.length === 0) {
    return { syncedDates: [], skippedDates: [] };
  }

  const admin = getAdminClient();
  const { data: existingRows } = await admin
    .from('attendance_records')
    .select('id, date, check_in_time, check_out_time')
    .eq('user_id', request.user_id)
    .in('date', targetDates);

  const existingByDate = new Map<string, { id: string; check_in_time: string | null; check_out_time: string | null }>();
  for (const row of existingRows || []) {
    existingByDate.set(row.date.slice(0, 10), row);
  }

  const syncedDates: string[] = [];
  const skippedDates: string[] = [];
  const toInsert: Array<{
    user_id: string;
    date: string;
    check_in_time: null;
    check_out_time: null;
  }> = [];

  for (const date of targetDates) {
    const existing = existingByDate.get(date);
    if (existing) {
      if (!existing.check_in_time && !existing.check_out_time) {
        // Already marked as leave row
        syncedDates.push(date);
      } else {
        // Do not overwrite an actual check-in/check-out punch
        skippedDates.push(date);
      }
    } else {
      toInsert.push({
        user_id: request.user_id,
        date,
        check_in_time: null,
        check_out_time: null,
      });
      syncedDates.push(date);
    }
  }

  if (toInsert.length > 0) {
    const { error } = await admin.from('attendance_records').insert(toInsert);
    if (error) {
      console.error('[LeaveSync] Failed to insert attendance leave rows:', error.message);
      return { syncedDates: [], skippedDates: targetDates };
    }
  }

  return { syncedDates, skippedDates };
}
