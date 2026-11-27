export type LeaveType =
  | 'sick'
  | 'personal'
  | 'official_duty'
  | 'maternity'
  | 'ordination'
  | 'other';

export type DurationType = 'full_day' | 'half_day_morning' | 'half_day_afternoon';

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type OrgRoleCategory =
  | 'approver'
  | 'executive'
  | 'department_head'
  | 'operations'
  | 'notification';

export interface OrgResponsibilityRole {
  id: string;
  role_key: string;
  title_th: string;
  description_th: string | null;
  category: OrgRoleCategory;
  department_scope: string;
  assigned_user_ids: string[];
  notify_on_submit: boolean;
  notify_on_approve: boolean;
  notify_on_reject: boolean;
  leave_types: string[];
  can_approve: boolean;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface NotifiedRecipientLog {
  role_key: string;
  title_th: string;
  user_id: string;
  full_name: string;
  event: 'submit' | 'approve' | 'reject';
  channel: 'in_app_and_push' | 'in_app';
  sent_at: string;
}

export interface StaffLeaveRequest {
  id: string;
  request_code: string;
  user_id: string;
  personnel_id: string | null;
  applicant_name: string;
  applicant_position: string | null;
  applicant_department: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  duration_type: DurationType;
  working_dates: string[];
  total_days: number;
  reason: string;
  destination: string | null;
  document_ref: string | null;
  contact_phone: string | null;
  substitute_note: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  status: LeaveStatus;
  approver_user_id: string | null;
  approver_name: string | null;
  approved_at: string | null;
  approver_comment: string | null;
  attendance_synced: boolean;
  attendance_synced_dates: string[];
  notified_recipients: NotifiedRecipientLog[];
  created_at: string;
  updated_at: string;
}

export const LEAVE_TYPE_LABELS: Record<
  LeaveType,
  {
    labelTh: string;
    shortTh: string;
    badgeClass: string;
    pillActiveClass: string;
    isOfficialDuty?: boolean;
  }
> = {
  sick: {
    labelTh: 'ลาป่วย',
    shortTh: 'ลาป่วย',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
    pillActiveClass: 'bg-rose-600 text-white border-rose-600 shadow-rose-500/20',
  },
  personal: {
    labelTh: 'ลากิจส่วนตัว',
    shortTh: 'ลากิจ',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
    pillActiveClass: 'bg-amber-600 text-white border-amber-600 shadow-amber-500/20',
  },
  official_duty: {
    labelTh: 'ไปราชการ / อบรมสัมมนา',
    shortTh: 'ไปราชการ',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800',
    pillActiveClass: 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-500/20',
    isOfficialDuty: true,
  },
  maternity: {
    labelTh: 'ลาคลอดบุตร',
    shortTh: 'ลาคลอด',
    badgeClass: 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/50 dark:text-pink-300 dark:border-pink-800',
    pillActiveClass: 'bg-pink-600 text-white border-pink-600 shadow-pink-500/20',
  },
  ordination: {
    labelTh: 'ลาอุปสมบท',
    shortTh: 'ลาอุปสมบท',
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800',
    pillActiveClass: 'bg-orange-600 text-white border-orange-600 shadow-orange-500/20',
  },
  other: {
    labelTh: 'ลาอื่นๆ',
    shortTh: 'อื่นๆ',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    pillActiveClass: 'bg-slate-700 text-white border-slate-700 shadow-slate-500/20',
  },
};

export const DURATION_LABELS: Record<DurationType, string> = {
  full_day: 'เต็มวัน',
  half_day_morning: 'ครึ่งวันเช้า (07:30–12:00)',
  half_day_afternoon: 'ครึ่งวันบ่าย (12:00–17:00)',
};

export const LEAVE_STATUS_LABELS: Record<
  LeaveStatus,
  { labelTh: string; badgeClass: string }
> = {
  pending: {
    labelTh: 'รอ ผ.อ. อนุมัติ',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
  },
  approved: {
    labelTh: 'อนุมัติแล้ว',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
  },
  rejected: {
    labelTh: 'ไม่อนุมัติ',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
  },
  cancelled: {
    labelTh: 'ยกเลิกแล้ว',
    badgeClass: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
  },
};

export const DEPARTMENT_SCOPES = [
  'all',
  'ปฐมวัย',
  'ประถมศึกษา',
  'ศูนย์สองภาษา',
  'สนับสนุน',
  'ผู้บริหาร',
] as const;

export const ORG_CATEGORY_LABELS: Record<OrgRoleCategory, string> = {
  approver: 'ผู้อนุมัติหลัก (ผ.อ.)',
  executive: 'ฝ่ายบริหาร',
  operations: 'ฝ่ายปฏิบัติการ & สนับสนุน',
  department_head: 'หัวหน้าแผนก / ศูนย์',
  notification: 'ผู้รับทราบเพิ่มเติม',
};

export function inferDepartmentFromPosition(
  positionTh?: string | null,
  category?: string | null
): string {
  const pos = (positionTh || '').trim();
  const cat = (category || '').trim().toLowerCase();

  if (pos.includes('ปฐมวัย') || pos.includes('เตรียมอนุบาล')) {
    return 'ปฐมวัย';
  }
  if (pos.includes('ประถม')) {
    return 'ประถมศึกษา';
  }
  if (pos.includes('สองภาษา') || pos.toLowerCase().includes('bilingual')) {
    return 'ศูนย์สองภาษา';
  }
  if (
    pos.includes('ผู้อำนวยการ') ||
    pos.includes('ผู้จัดการ') ||
    pos.includes('ผู้บริหาร') ||
    cat === 'executive'
  ) {
    return 'ผู้บริหาร';
  }
  if (pos.includes('สนับสนุน') || cat === 'staff') {
    return 'สนับสนุน';
  }
  return 'ทั่วไป';
}

function formatISODateUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function enumerateCalendarDatesInRange(startDate: string, endDate: string): string[] {
  if (!startDate || !endDate || endDate < startDate) return [];
  const dates: string[] = [];
  const cursor = new Date(`${startDate.slice(0, 10)}T00:00:00Z`);
  const limit = new Date(`${endDate.slice(0, 10)}T00:00:00Z`);
  let guard = 0;
  while (cursor <= limit && guard < 366) {
    dates.push(formatISODateUTC(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard++;
  }
  return dates;
}

export function computeWorkingDatesInRange(
  startDate: string,
  endDate: string,
  holidayDates: Set<string>
): string[] {
  const allDates = enumerateCalendarDatesInRange(startDate, endDate);
  return allDates.filter((iso) => {
    const d = new Date(`${iso}T00:00:00Z`);
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) return false;
    if (holidayDates.has(iso)) return false;
    return true;
  });
}

export function computeEffectiveLeaveDates(
  startDate: string,
  endDate: string,
  leaveType: LeaveType,
  holidayDates: Set<string>
): string[] {
  const working = computeWorkingDatesInRange(startDate, endDate, holidayDates);
  if (working.length > 0) return working;
  // Weekend / holiday seminar or official duty is permitted on non-working days
  if (leaveType === 'official_duty') {
    return enumerateCalendarDatesInRange(startDate, endDate);
  }
  return [];
}

export function computeLeaveTotalDays(
  effectiveDates: string[],
  durationType: DurationType,
  leaveType: LeaveType,
  startDate: string,
  endDate: string
): number {
  if (effectiveDates.length === 0) return 0;
  if (durationType !== 'full_day' && startDate === endDate) {
    return 0.5;
  }
  if (leaveType === 'official_duty') {
    return effectiveDates.length;
  }
  return effectiveDates.length;
}

export function resolveMatchedOrgRoles(
  roles: OrgResponsibilityRole[],
  params: {
    event: 'submit' | 'approve' | 'reject';
    leaveType: LeaveType;
    applicantDepartment: string;
    applicantUserId: string;
  }
): Array<{ role: OrgResponsibilityRole; recipientUserIds: string[] }> {
  const { event, leaveType, applicantDepartment, applicantUserId } = params;
  const matched: Array<{ role: OrgResponsibilityRole; recipientUserIds: string[] }> = [];

  for (const role of roles) {
    if (!role.is_active) continue;

    if (event === 'submit' && !role.notify_on_submit) continue;
    if (event === 'approve' && !role.notify_on_approve) continue;
    if (event === 'reject' && !role.notify_on_reject) continue;

    if (Array.isArray(role.leave_types) && role.leave_types.length > 0) {
      if (!role.leave_types.includes(leaveType)) continue;
    }

    const scope = (role.department_scope || 'all').trim();
    if (scope !== 'all' && scope !== applicantDepartment) {
      continue;
    }

    const recipients = Array.from(
      new Set(
        (role.assigned_user_ids || []).filter(
          (uid) => uid && uid !== applicantUserId
        )
      )
    );

    if (recipients.length > 0) {
      matched.push({ role, recipientUserIds: recipients });
    }
  }

  return matched;
}

export interface DeduplicatedRecipient {
  userId: string;
  roles: Array<{ roleKey: string; titleTh: string }>;
}

export function deduplicateNotifiedUsers(
  matchedRoles: Array<{ role: OrgResponsibilityRole; recipientUserIds: string[] }>
): DeduplicatedRecipient[] {
  const byUser = new Map<string, Array<{ roleKey: string; titleTh: string }>>();

  for (const item of matchedRoles) {
    for (const userId of item.recipientUserIds) {
      const existing = byUser.get(userId) || [];
      if (!existing.some((r) => r.roleKey === item.role.role_key)) {
        existing.push({
          roleKey: item.role.role_key,
          titleTh: item.role.title_th,
        });
      }
      byUser.set(userId, existing);
    }
  }

  return Array.from(byUser.entries()).map(([userId, roles]) => ({
    userId,
    roles,
  }));
}

export function formatThaiDateShort(isoDate: string): string {
  if (!isoDate) return '-';
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  const thaiMonths = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'มี.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
  ];
  return `${d} ${thaiMonths[m - 1] || ''} ${y + 543}`;
}

export function formatLeaveDateRangeTh(startDate: string, endDate: string): string {
  if (!startDate) return '-';
  if (!endDate || startDate === endDate) {
    return formatThaiDateShort(startDate);
  }
  return `${formatThaiDateShort(startDate)} – ${formatThaiDateShort(endDate)}`;
}
