import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { getAdminClient } from '@/lib/supabase/admin';
import { getBangkokDate } from '@/lib/utils';
import {
  AttendanceRecordRow,
  HolidayEventRow,
  computeSchoolAttendanceSummary,
} from '@/lib/attendance/analytics';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const user = await getServerUser();
    const userId = user?.id || (process.env.NODE_ENV === 'development' ? 'dev-user-id' : '');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const todayBangkok = getBangkokDate();
    const { searchParams } = new URL(request.url);
    const requestedMonth = searchParams.get('month') || todayBangkok.slice(0, 7);

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth)) {
      return NextResponse.json({ error: 'Invalid month format (expected YYYY-MM)' }, { status: 400 });
    }

    const [yearStr, monthStr] = requestedMonth.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const monthStart = `${requestedMonth}-01`;
    const monthEnd = `${requestedMonth}-${String(lastDay).padStart(2, '0')}`;

    const supabaseAdmin = getAdminClient();

    const [attRes, holidayRes] = await Promise.all([
      supabaseAdmin
        .from('attendance_records')
        .select('id, user_id, date, check_in_time, check_out_time')
        .gte('date', monthStart)
        .lte('date', monthEnd),
      supabaseAdmin
        .from('calendar_events')
        .select('title_th, start_date, end_date, is_holiday, category')
        .lte('start_date', monthEnd)
        .or(`end_date.gte.${monthStart},end_date.is.null`),
    ]);

    if (attRes.error) {
      throw attRes.error;
    }

    const holidayEvents: HolidayEventRow[] = (holidayRes.data || []).filter(
      (ev: HolidayEventRow) => ev.is_holiday === true || ev.category === 'holiday'
    );

    const summary = computeSchoolAttendanceSummary({
      allMonthRecords: (attRes.data || []) as AttendanceRecordRow[],
      holidayEvents,
      year,
      month,
      todayBangkok,
      currentUserId: userId,
    });

    return NextResponse.json(summary, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (err: any) {
    console.error('Attendance Summary GET Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
