export const LATE_CUTOFF_TIME = '07:30';
export const EARLY_LEAVE_TIME = '17:00';
export const MIN_CHECKOUT_ELAPSED_MINUTES = 15;

export const ATTENDANCE_SCORE_PENALTIES = {
  absent: 5,
  late: 3,
  earlyLeave: 3,
  missingCheckout: 1,
  leave: 0,
} as const;

export type PerformanceTierKey =
  | 'excellent'
  | 'good'
  | 'average'
  | 'below_average'
  | 'needs_improvement';

export interface AttendanceRecordRow {
  id?: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  check_in_time: string | null;
  check_out_time: string | null;
}

export interface HolidayEventRow {
  title_th?: string | null;
  start_date: string;
  end_date?: string | null;
  is_holiday?: boolean | null;
  category?: string | null;
}

export type DailyLogStatus =
  | 'on_time'
  | 'late'
  | 'early_leave'
  | 'missing_checkout'
  | 'leave'
  | 'absent';

export interface DailyAttendanceLogItem {
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  isLate: boolean;
  isEarlyLeave: boolean;
  isMissingCheckout: boolean;
  isLeave: boolean;
  isAbsent: boolean;
  statuses: DailyLogStatus[];
}

export interface UserMonthlyStats {
  presentDays: number;
  onTimeCount: number;
  lateCount: number;
  absentCount: number;
  leaveCount: number;
  missingCheckoutCount: number;
  earlyLeaveCount: number;
  avgCheckInMinutes: number | null;
  avgCheckInTime: string | null;
  score: number;
  dailyLogs: DailyAttendanceLogItem[];
}

export interface ZScoreClassification {
  tier: PerformanceTierKey;
  labelTh: string;
  descriptionTh: string;
  badgeTone: 'emerald' | 'blue' | 'slate' | 'amber' | 'rose';
}

export interface SchoolAttendanceSummaryResponse {
  month: string; // YYYY-MM
  todayBangkok: string;
  elapsedWorkingDays: number;
  pastWorkingDays: number;
  personal: UserMonthlyStats;
  benchmark: {
    cohortSize: number;
    insufficientData: boolean;
    schoolMean: number;
    schoolSd: number;
    zScore: number;
    percentile: number;
    schoolAvgCheckInMinutes: number | null;
    schoolAvgCheckInTime: string | null;
    schoolCheckInSdMinutes: number | null;
    classification: ZScoreClassification;
  };
  cutoffs: {
    lateCutoffTime: string;
    earlyLeaveTime: string;
    penalties: typeof ATTENDANCE_SCORE_PENALTIES;
  };
}

function parseHHMMToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

const LATE_CUTOFF_MINUTES = parseHHMMToMinutes(LATE_CUTOFF_TIME);
const EARLY_LEAVE_MINUTES = parseHHMMToMinutes(EARLY_LEAVE_TIME);

/**
 * Returns minutes since 00:00 in Asia/Bangkok (UTC+7) for an ISO timestamp.
 */
export function getBangkokMinutesOfDay(isoTimestamp: string): number {
  const dateObj = new Date(isoTimestamp);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(dateObj);

  const rawHour = Number(parts.find((p) => p.type === 'hour')?.value || 0);
  const hour = rawHour === 24 ? 0 : rawHour;
  const minute = Number(parts.find((p) => p.type === 'minute')?.value || 0);
  return hour * 60 + minute;
}

/**
 * Returns true if check-in is strictly after LATE_CUTOFF_TIME (07:31+ BKK).
 */
export function isLateCheckIn(checkInIso: string | null): boolean {
  if (!checkInIso) return false;
  return getBangkokMinutesOfDay(checkInIso) > LATE_CUTOFF_MINUTES;
}

/**
 * Returns true if check-out is strictly before EARLY_LEAVE_TIME (< 17:00 BKK).
 */
export function isEarlyCheckOut(checkOutIso: string | null): boolean {
  if (!checkOutIso) return false;
  return getBangkokMinutesOfDay(checkOutIso) < EARLY_LEAVE_MINUTES;
}

export function formatMinutesToHHMM(minutes: number | null): string | null {
  if (minutes === null || !Number.isFinite(minutes)) return null;
  const rounded = Math.round(minutes);
  const hh = Math.floor(rounded / 60) % 24;
  const mm = rounded % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function formatISODateUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function expandHolidayDates(
  events: HolidayEventRow[],
  monthStart: string,
  monthEnd: string
): Set<string> {
  const holidayDates = new Set<string>();
  for (const ev of events) {
    if (!ev.start_date) continue;
    const startStr = ev.start_date.slice(0, 10);
    const endStr = (ev.end_date || ev.start_date).slice(0, 10);
    const clampedStart = startStr < monthStart ? monthStart : startStr;
    const clampedEnd = endStr > monthEnd ? monthEnd : endStr;
    if (clampedStart > clampedEnd) continue;

    const cursor = new Date(`${clampedStart}T00:00:00Z`);
    const limit = new Date(`${clampedEnd}T00:00:00Z`);
    while (cursor <= limit) {
      holidayDates.add(formatISODateUTC(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  return holidayDates;
}

export function getMonthWorkingDates(
  year: number,
  month: number,
  todayBangkok: string,
  holidayDates: Set<string>
): {
  elapsedWorkingDates: string[];
  pastWorkingDates: string[];
  monthStart: string;
  monthEnd: string;
} {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthStr = String(month).padStart(2, '0');
  const monthStart = `${year}-${monthStr}-01`;
  const monthEnd = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

  const elapsedWorkingDates: string[] = [];
  const pastWorkingDates: string[] = [];

  for (let day = 1; day <= lastDay; day++) {
    const d = new Date(Date.UTC(year, month - 1, day));
    const dow = d.getUTCDay(); // 0 = Sun, 6 = Sat
    if (dow === 0 || dow === 6) continue;

    const iso = `${year}-${monthStr}-${String(day).padStart(2, '0')}`;
    if (holidayDates.has(iso)) continue;

    if (iso <= todayBangkok) {
      elapsedWorkingDates.push(iso);
    }
    if (iso < todayBangkok) {
      pastWorkingDates.push(iso);
    }
  }

  return { elapsedWorkingDates, pastWorkingDates, monthStart, monthEnd };
}

export function computeUserMonthlyStats(
  userRecords: AttendanceRecordRow[],
  pastWorkingDates: string[],
  elapsedWorkingDates: string[],
  todayBangkok: string
): UserMonthlyStats {
  const byDate = new Map<string, AttendanceRecordRow>();
  for (const rec of userRecords) {
    byDate.set(rec.date.slice(0, 10), rec);
  }

  let presentDays = 0;
  let onTimeCount = 0;
  let lateCount = 0;
  let leaveCount = 0;
  let missingCheckoutCount = 0;
  let earlyLeaveCount = 0;
  const checkInMinutesList: number[] = [];
  const dailyLogs: DailyAttendanceLogItem[] = [];

  const allRelevantDates = new Set<string>(pastWorkingDates);
  for (const d of elapsedWorkingDates) {
    if (byDate.has(d)) allRelevantDates.add(d);
  }
  for (const d of byDate.keys()) {
    allRelevantDates.add(d);
  }

  const sortedDates = Array.from(allRelevantDates).sort((a, b) => b.localeCompare(a));

  for (const dateStr of sortedDates) {
    const rec = byDate.get(dateStr);
    if (!rec) {
      if (pastWorkingDates.includes(dateStr)) {
        dailyLogs.push({
          date: dateStr,
          checkInTime: null,
          checkOutTime: null,
          isLate: false,
          isEarlyLeave: false,
          isMissingCheckout: false,
          isLeave: false,
          isAbsent: true,
          statuses: ['absent'],
        });
      }
      continue;
    }

    const hasIn = Boolean(rec.check_in_time);
    const hasOut = Boolean(rec.check_out_time);
    const isLeave = !hasIn && !hasOut;

    if (isLeave) {
      leaveCount += 1;
      dailyLogs.push({
        date: dateStr,
        checkInTime: null,
        checkOutTime: null,
        isLate: false,
        isEarlyLeave: false,
        isMissingCheckout: false,
        isLeave: true,
        isAbsent: false,
        statuses: ['leave'],
      });
      continue;
    }

    presentDays += 1;

    const late = isLateCheckIn(rec.check_in_time);
    const earlyLeave = isEarlyCheckOut(rec.check_out_time);
    const missingCheckout = dateStr < todayBangkok && hasIn && !hasOut;

    if (hasIn && rec.check_in_time) {
      checkInMinutesList.push(getBangkokMinutesOfDay(rec.check_in_time));
      if (late) lateCount += 1;
      else onTimeCount += 1;
    }
    if (earlyLeave) earlyLeaveCount += 1;
    if (missingCheckout) missingCheckoutCount += 1;

    const statuses: DailyLogStatus[] = [];
    if (hasIn) statuses.push(late ? 'late' : 'on_time');
    if (earlyLeave) statuses.push('early_leave');
    if (missingCheckout) statuses.push('missing_checkout');

    dailyLogs.push({
      date: dateStr,
      checkInTime: rec.check_in_time,
      checkOutTime: rec.check_out_time,
      isLate: late,
      isEarlyLeave: earlyLeave,
      isMissingCheckout: missingCheckout,
      isLeave: false,
      isAbsent: false,
      statuses,
    });
  }

  let absentCount = 0;
  for (const d of pastWorkingDates) {
    if (!byDate.has(d)) absentCount += 1;
  }

  const avgCheckInMinutes =
    checkInMinutesList.length > 0
      ? Number(
          (
            checkInMinutesList.reduce((sum, v) => sum + v, 0) /
            checkInMinutesList.length
          ).toFixed(1)
        )
      : null;

  const deduction =
    absentCount * ATTENDANCE_SCORE_PENALTIES.absent +
    lateCount * ATTENDANCE_SCORE_PENALTIES.late +
    earlyLeaveCount * ATTENDANCE_SCORE_PENALTIES.earlyLeave +
    missingCheckoutCount * ATTENDANCE_SCORE_PENALTIES.missingCheckout +
    leaveCount * ATTENDANCE_SCORE_PENALTIES.leave;

  const score = Math.max(0, Math.min(100, 100 - deduction));

  return {
    presentDays,
    onTimeCount,
    lateCount,
    absentCount,
    leaveCount,
    missingCheckoutCount,
    earlyLeaveCount,
    avgCheckInMinutes,
    avgCheckInTime: formatMinutesToHHMM(avgCheckInMinutes),
    score,
    dailyLogs,
  };
}

export function classifyZScore(zScore: number): ZScoreClassification {
  if (zScore >= 1.0) {
    return {
      tier: 'excellent',
      labelTh: 'ดีเยี่ยม',
      descriptionTh: 'ความสม่ำเสมอในการเข้างานสูงกว่าค่าเฉลี่ยโรงเรียนมาก (≥ +1.0 S.D.)',
      badgeTone: 'emerald',
    };
  }
  if (zScore >= 0.5) {
    return {
      tier: 'good',
      labelTh: 'ดีมาก',
      descriptionTh: 'ผลการเข้างานสูงกว่าค่าเฉลี่ยของโรงเรียน (+0.5 ถึง +1.0 S.D.)',
      badgeTone: 'blue',
    };
  }
  if (zScore >= -0.5) {
    return {
      tier: 'average',
      labelTh: 'มาตรฐาน',
      descriptionTh: 'ผลการเข้างานอยู่ในระดับค่าเฉลี่ยของโรงเรียน (-0.5 ถึง +0.5 S.D.)',
      badgeTone: 'slate',
    };
  }
  if (zScore >= -1.0) {
    return {
      tier: 'below_average',
      labelTh: 'ควรเพิ่มความสม่ำเสมอ',
      descriptionTh: 'ผลการเข้างานต่ำกว่าค่าเฉลี่ยโรงเรียนเล็กน้อย (-1.0 ถึง -0.5 S.D.)',
      badgeTone: 'amber',
    };
  }
  return {
    tier: 'needs_improvement',
    labelTh: 'ต้องปรับปรุง',
    descriptionTh: 'ผลการเข้างานต่ำกว่าเกณฑ์เฉลี่ยโรงเรียนค่อนข้างมาก (< -1.0 S.D.)',
    badgeTone: 'rose',
  };
}

export function computeSchoolAttendanceSummary(params: {
  allMonthRecords: AttendanceRecordRow[];
  holidayEvents: HolidayEventRow[];
  year: number;
  month: number;
  todayBangkok: string;
  currentUserId: string;
}): SchoolAttendanceSummaryResponse {
  const { allMonthRecords, holidayEvents, year, month, todayBangkok, currentUserId } = params;
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthStart = `${monthStr}-01`;
  const monthEnd = `${monthStr}-${String(lastDay).padStart(2, '0')}`;

  const holidayDates = expandHolidayDates(holidayEvents, monthStart, monthEnd);
  const { elapsedWorkingDates, pastWorkingDates } = getMonthWorkingDates(
    year,
    month,
    todayBangkok,
    holidayDates
  );

  const recordsByUser = new Map<string, AttendanceRecordRow[]>();
  for (const rec of allMonthRecords) {
    const list = recordsByUser.get(rec.user_id) || [];
    list.push(rec);
    recordsByUser.set(rec.user_id, list);
  }

  const personal = computeUserMonthlyStats(
    recordsByUser.get(currentUserId) || [],
    pastWorkingDates,
    elapsedWorkingDates,
    todayBangkok
  );

  const cohortScores: number[] = [];
  const cohortCheckInAvgs: number[] = [];

  for (const [, userRecs] of recordsByUser.entries()) {
    if (userRecs.length === 0) continue;
    const stats = computeUserMonthlyStats(
      userRecs,
      pastWorkingDates,
      elapsedWorkingDates,
      todayBangkok
    );
    cohortScores.push(stats.score);
    if (stats.avgCheckInMinutes !== null) {
      cohortCheckInAvgs.push(stats.avgCheckInMinutes);
    }
  }

  const cohortSize = cohortScores.length;
  const insufficientData = cohortSize < 3;

  const schoolMean =
    cohortSize > 0
      ? Number((cohortScores.reduce((a, b) => a + b, 0) / cohortSize).toFixed(2))
      : 100;

  const variance =
    cohortSize > 0
      ? cohortScores.reduce((acc, s) => acc + Math.pow(s - schoolMean, 2), 0) / cohortSize
      : 0;
  const schoolSd = Number(Math.sqrt(variance).toFixed(2));

  const zScore =
    !insufficientData && schoolSd > 0
      ? Number(((personal.score - schoolMean) / schoolSd).toFixed(2))
      : 0;

  const belowOrEqualCount = cohortScores.filter((s) => s <= personal.score).length;
  const percentile =
    cohortSize > 0 ? Math.round((belowOrEqualCount / cohortSize) * 100) : 100;

  const schoolAvgCheckInMinutes =
    cohortCheckInAvgs.length > 0
      ? Number(
          (
            cohortCheckInAvgs.reduce((a, b) => a + b, 0) / cohortCheckInAvgs.length
          ).toFixed(1)
        )
      : null;

  const checkInVariance =
    schoolAvgCheckInMinutes !== null && cohortCheckInAvgs.length > 0
      ? cohortCheckInAvgs.reduce(
          (acc, m) => acc + Math.pow(m - schoolAvgCheckInMinutes, 2),
          0
        ) / cohortCheckInAvgs.length
      : null;

  const schoolCheckInSdMinutes =
    checkInVariance !== null ? Number(Math.sqrt(checkInVariance).toFixed(1)) : null;

  return {
    month: monthStr,
    todayBangkok,
    elapsedWorkingDays: elapsedWorkingDates.length,
    pastWorkingDays: pastWorkingDates.length,
    personal,
    benchmark: {
      cohortSize,
      insufficientData,
      schoolMean,
      schoolSd,
      zScore,
      percentile,
      schoolAvgCheckInMinutes,
      schoolAvgCheckInTime: formatMinutesToHHMM(schoolAvgCheckInMinutes),
      schoolCheckInSdMinutes,
      classification: classifyZScore(zScore),
    },
    cutoffs: {
      lateCutoffTime: LATE_CUTOFF_TIME,
      earlyLeaveTime: EARLY_LEAVE_TIME,
      penalties: ATTENDANCE_SCORE_PENALTIES,
    },
  };
}
