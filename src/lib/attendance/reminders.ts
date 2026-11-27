import { getAdminClient } from '@/lib/supabase/admin';
import { getBangkokDate } from '@/lib/utils';
import {
  HolidayEventRow,
  expandHolidayDates,
  getBangkokMinutesOfDay,
} from '@/lib/attendance/analytics';
import { broadcastPushNotifications } from '@/lib/notifications/webpush';

export type ReminderSlot =
  | 'check_in_30'
  | 'check_in_10'
  | 'check_out_0'
  | 'check_out_20';

export const REMINDER_SLOTS: ReminderSlot[] = [
  'check_in_30',
  'check_in_10',
  'check_out_0',
  'check_out_20',
];

const TARGET_STAFF_ROLES = [
  'teacher',
  'academic staff',
  'non-academic staff',
  'cashier',
];

interface ReminderTemplate {
  slot: ReminderSlot;
  kind: 'check_in' | 'check_out';
  targetMinuteBkk: number; // minutes since 00:00 BKK
  title: string;
  body: string;
}

const REMINDER_TEMPLATES: Record<ReminderSlot, ReminderTemplate> = {
  check_in_30: {
    slot: 'check_in_30',
    kind: 'check_in',
    targetMinuteBkk: 7 * 60, // 07:00
    title: '⏰ เตือนลงเวลาเข้างาน (เหลือ 30 นาที)',
    body: 'อีก 30 นาทีจะครบกำหนดลงเวลาเข้างาน (07:30 น.) กรุณากดลงเวลาเมื่อถึงโรงเรียนค่ะ',
  },
  check_in_10: {
    slot: 'check_in_10',
    kind: 'check_in',
    targetMinuteBkk: 7 * 60 + 20, // 07:20
    title: '🔔 ใกล้หมดเวลาลงชื่อเข้างาน (เหลือ 10 นาที)',
    body: 'อีก 10 นาทีจะครบกำหนด 07:30 น. ท่านยังไม่ได้ลงเวลาเข้างานวันนี้ กรุณากดลงเวลาทันทีค่ะ',
  },
  check_out_0: {
    slot: 'check_out_0',
    kind: 'check_out',
    targetMinuteBkk: 17 * 60, // 17:00
    title: '🏁 ถึงเวลาเลิกงานแล้ว (17:00 น.)',
    body: 'อย่าลืมกดลงเวลาออกงานก่อนเดินทางกลับบ้านนะคะ',
  },
  check_out_20: {
    slot: 'check_out_20',
    kind: 'check_out',
    targetMinuteBkk: 17 * 60 + 20, // 17:20
    title: '🔔 เตือนซ้ำ: ท่านยังไม่ได้ลงเวลาออกงาน',
    body: 'ขณะนี้เลยเวลาเลิกงาน 17:00 น. แล้ว ท่านยังไม่ได้กดลงเวลาออกงานวันนี้ กรุณากดลงเวลาก่อนออกนอกพื้นที่โรงเรียนค่ะ',
  },
};

export function isValidReminderSlot(value: string | null): value is ReminderSlot {
  return Boolean(value && REMINDER_SLOTS.includes(value as ReminderSlot));
}

/**
 * Resolves the reminder slot based on current Asia/Bangkok time (±8 minutes tolerance).
 */
export function resolveSlotFromBangkokTime(date: Date = new Date()): ReminderSlot | null {
  const mins = getBangkokMinutesOfDay(date.toISOString());
  for (const slot of REMINDER_SLOTS) {
    const target = REMINDER_TEMPLATES[slot].targetMinuteBkk;
    if (Math.abs(mins - target) <= 8) {
      return slot;
    }
  }
  return null;
}

function isBangkokWeekend(isoDate: string): boolean {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const dow = d.getUTCDay();
  return dow === 0 || dow === 6;
}

export interface DispatchRemindersResult {
  success: boolean;
  todayBangkok: string;
  slot: ReminderSlot;
  dryRun: boolean;
  skippedReason?: string;
  targetCount: number;
  alreadyNotifiedSkipped: number;
  sentInApp: number;
  pushResult: { total: number; sent: number; failed: number; expired: number };
}

export async function dispatchAttendanceReminders(params: {
  slot: ReminderSlot;
  dryRun?: boolean;
  testUserId?: string;
}): Promise<DispatchRemindersResult> {
  const { slot, dryRun = false, testUserId } = params;
  const template = REMINDER_TEMPLATES[slot];
  const todayBangkok = getBangkokDate();
  const reminderKey = `${todayBangkok}:${slot}`;
  const admin = getAdminClient();

  if (!testUserId) {
    if (isBangkokWeekend(todayBangkok)) {
      return {
        success: true,
        todayBangkok,
        slot,
        dryRun,
        skippedReason: 'weekend',
        targetCount: 0,
        alreadyNotifiedSkipped: 0,
        sentInApp: 0,
        pushResult: { total: 0, sent: 0, failed: 0, expired: 0 },
      };
    }

    const { data: holidayRows } = await admin
      .from('calendar_events')
      .select('title_th, start_date, end_date, is_holiday, category')
      .lte('start_date', todayBangkok)
      .or(`end_date.gte.${todayBangkok},end_date.is.null`);

    const holidayEvents = ((holidayRows || []) as HolidayEventRow[]).filter(
      (ev) => ev.is_holiday === true || ev.category === 'holiday'
    );
    const holidaySet = expandHolidayDates(holidayEvents, todayBangkok, todayBangkok);
    if (holidaySet.has(todayBangkok)) {
      return {
        success: true,
        todayBangkok,
        slot,
        dryRun,
        skippedReason: 'school_holiday',
        targetCount: 0,
        alreadyNotifiedSkipped: 0,
        sentInApp: 0,
        pushResult: { total: 0, sent: 0, failed: 0, expired: 0 },
      };
    }
  }

  let candidateUserIds: string[] = [];

  if (testUserId) {
    candidateUserIds = [testUserId];
  } else {
    const [usersRes, todayAttRes] = await Promise.all([
      admin
        .from('app_users')
        .select('id, role, is_active')
        .eq('is_active', true)
        .in('role', TARGET_STAFF_ROLES),
      admin
        .from('attendance_records')
        .select('user_id, check_in_time, check_out_time')
        .eq('date', todayBangkok),
    ]);

    if (usersRes.error) throw usersRes.error;
    if (todayAttRes.error) throw todayAttRes.error;

    const attByUser = new Map<
      string,
      { check_in_time: string | null; check_out_time: string | null }
    >();
    for (const row of todayAttRes.data || []) {
      attByUser.set(row.user_id, {
        check_in_time: row.check_in_time,
        check_out_time: row.check_out_time,
      });
    }

    for (const u of usersRes.data || []) {
      const rec = attByUser.get(u.id);
      if (template.kind === 'check_in') {
        // Send only if user has NO record today (neither checked in nor marked on leave)
        if (!rec) {
          candidateUserIds.push(u.id);
        }
      } else {
        // Send only if user checked in today and has NOT checked out yet
        if (rec && rec.check_in_time && !rec.check_out_time) {
          candidateUserIds.push(u.id);
        }
      }
    }
  }

  if (candidateUserIds.length === 0) {
    return {
      success: true,
      todayBangkok,
      slot,
      dryRun,
      targetCount: 0,
      alreadyNotifiedSkipped: 0,
      sentInApp: 0,
      pushResult: { total: 0, sent: 0, failed: 0, expired: 0 },
    };
  }

  // Idempotency check (skip users already notified for this slot today, unless testUserId is used)
  let alreadyNotifiedIds = new Set<string>();
  if (!testUserId) {
    const { data: existingNotifs } = await admin
      .from('app_notifications')
      .select('recipient_user_id')
      .eq('category', 'reminder')
      .eq('metadata->>reminder_key', reminderKey)
      .in('recipient_user_id', candidateUserIds);

    alreadyNotifiedIds = new Set(
      (existingNotifs || [])
        .map((n: any) => n.recipient_user_id)
        .filter((id: unknown): id is string => typeof id === 'string')
    );
  }

  const finalTargetIds = candidateUserIds.filter((id) => !alreadyNotifiedIds.has(id));
  const alreadyNotifiedSkipped = candidateUserIds.length - finalTargetIds.length;

  if (finalTargetIds.length === 0) {
    return {
      success: true,
      todayBangkok,
      slot,
      dryRun,
      targetCount: 0,
      alreadyNotifiedSkipped,
      sentInApp: 0,
      pushResult: { total: 0, sent: 0, failed: 0, expired: 0 },
    };
  }

  const { data: subsData, error: subsErr } = await admin
    .from('user_push_subscriptions')
    .select('endpoint, p256dh, auth, user_id')
    .in('user_id', finalTargetIds);

  if (subsErr) throw subsErr;
  const subscriptions = subsData || [];

  if (dryRun) {
    return {
      success: true,
      todayBangkok,
      slot,
      dryRun: true,
      targetCount: finalTargetIds.length,
      alreadyNotifiedSkipped,
      sentInApp: 0,
      pushResult: { total: subscriptions.length, sent: 0, failed: 0, expired: 0 },
    };
  }

  const inAppRows = finalTargetIds.map((uid) => ({
    recipient_user_id: uid,
    recipient_role: null,
    title: template.title,
    body: template.body,
    category: 'reminder',
    action_url: '/attendance',
    sent_by: testUserId ? 'attendance_reminder_test' : 'attendance_reminder_cron',
    metadata: {
      reminder_key: testUserId ? `${reminderKey}:test:${Date.now()}` : reminderKey,
      slot,
      date: todayBangkok,
    },
  }));

  const { error: insertErr } = await admin.from('app_notifications').insert(inAppRows);
  if (insertErr) throw insertErr;

  const pushResult =
    subscriptions.length > 0
      ? await broadcastPushNotifications(subscriptions, {
          title: template.title,
          body: template.body,
          url: '/attendance',
          tag: `attendance-${todayBangkok}-${slot}`,
          data: { slot, date: todayBangkok },
        })
      : { total: 0, sent: 0, failed: 0, expired: 0 };

  return {
    success: true,
    todayBangkok,
    slot,
    dryRun: false,
    targetCount: finalTargetIds.length,
    alreadyNotifiedSkipped,
    sentInApp: inAppRows.length,
    pushResult,
  };
}
