import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth';
import { 
  sendCalendarNotification, 
  notifyDutyAssigned,
  scanAndDispatchUpcomingCalendarAlerts 
} from '@/lib/calendar/notifications';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const supabase = getAdminClient();
    const body = await req.json();
    const { action, eventId } = body;

    // Action 1: Proactive automated scan
    if (action === 'scan_reminders') {
      const summary = await scanAndDispatchUpcomingCalendarAlerts();
      return NextResponse.json({
        success: true,
        message: `สแกนกำหนดการสำเร็จ ส่งแจ้งเตือนอัตโนมัติแล้ว ${summary.dispatchedCount} รายการ`,
        summary
      });
    }

    // Action 2: Instant Manual Notification for an Event
    if (action === 'instant_notify' && eventId) {
      const { data: event, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (error || !event) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      }

      let notifiedCount = 0;

      if (event.is_duty && Array.isArray(event.assigned_personnel_ids) && event.assigned_personnel_ids.length > 0) {
        const { data: teachers } = await supabase
          .from('personnel')
          .select('id, name_th, user_id')
          .in('id', event.assigned_personnel_ids);

        for (const t of teachers || []) {
          await notifyDutyAssigned({
            teacherUserId: t.user_id,
            teacherName: t.name_th,
            dutyTitle: event.title_th,
            date: event.start_date,
            location: event.location,
            description: event.description
          });
          notifiedCount++;
        }
      } else {
        await sendCalendarNotification({
          title: `[แจ้งเตือนปฏิทินปฏิบัติงาน] ${event.title_th}`,
          body: `กำหนดการวันที่ ${event.start_date} ${event.location ? `ณ ${event.location}` : ''} ${event.description ? `รายละเอียด: ${event.description}` : ''}`,
          recipientRole: event.target_role || 'all',
          category: event.category === 'academic' ? 'academic' : 'reminder',
          actionUrl: event.action_url || `/calendar`,
          metadata: { eventId: event.id, event: 'MANUAL_DISPATCH' }
        });
        notifiedCount = 1;
      }

      // Update dispatched timestamp
      await supabase
        .from('calendar_events')
        .update({ notification_dispatched_at: new Date().toISOString() })
        .eq('id', event.id);

      return NextResponse.json({
        success: true,
        message: `จัดส่งข้อความแจ้งเตือนและ Web Push เรียบร้อยแล้ว (${notifiedCount} รายการ)`
      });
    }

    return NextResponse.json({ error: 'Invalid action or missing eventId' }, { status: 400 });
  } catch (error: any) {
    console.error('Error dispatching calendar notification:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
