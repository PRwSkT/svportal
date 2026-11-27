import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  dispatchAttendanceReminders,
  isValidReminderSlot,
  resolveSlotFromBangkokTime,
} from '@/lib/attendance/reminders';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function handleReminderRequest(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const hasValidCronSecret = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);

    let adminUserId: string | undefined;

    if (!hasValidCronSecret) {
      const auth = await requireAuth('admin', 'admin_attendance');
      if (auth.error || !auth.user) {
        return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: auth.status || 401 });
      }
      adminUserId = auth.user.id;
    }

    const { searchParams } = new URL(request.url);
    const slotParam = searchParams.get('slot');
    const dryRun = searchParams.get('dryRun') === 'true';
    const testSelf = searchParams.get('testSelf') === 'true';

    let slot = isValidReminderSlot(slotParam) ? slotParam : null;
    if (!slot && !slotParam) {
      slot = resolveSlotFromBangkokTime();
    }

    if (!slot) {
      return NextResponse.json({
        success: true,
        skippedReason: 'outside_reminder_window',
        message: 'Current Bangkok time does not match any attendance reminder slot',
      });
    }

    if (testSelf && !adminUserId) {
      return NextResponse.json(
        { error: 'testSelf requires an authenticated admin session' },
        { status: 400 }
      );
    }

    const result = await dispatchAttendanceReminders({
      slot,
      dryRun,
      testUserId: testSelf ? adminUserId : undefined,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Attendance Reminders Cron Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handleReminderRequest(request);
}

export async function POST(request: Request) {
  return handleReminderRequest(request);
}
