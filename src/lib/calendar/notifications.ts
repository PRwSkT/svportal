import { getAdminClient } from '@/lib/supabase/admin';
import { broadcastPushNotifications } from '@/lib/notifications/webpush';
import { CalendarEvent } from '@/types';

export interface CalendarNotificationOptions {
  title: string;
  body: string;
  recipientUserId?: string | null;
  recipientRole?: string;
  category?: 'academic' | 'urgent' | 'reminder';
  actionUrl?: string;
  metadata?: Record<string, any>;
  sendPush?: boolean;
}

/**
 * Universal Calendar Notification Dispatcher
 */
export async function sendCalendarNotification(opts: CalendarNotificationOptions): Promise<boolean> {
  try {
    const admin = getAdminClient();
    const {
      title,
      body,
      recipientUserId = null,
      recipientRole = 'all',
      category = 'reminder',
      actionUrl = '/calendar',
      metadata = {},
      sendPush = true
    } = opts;

    // 1. Insert In-App Notification
    const { error: inAppErr } = await admin
      .from('app_notifications')
      .insert({
        title,
        body,
        recipient_user_id: recipientUserId,
        recipient_role: recipientRole,
        category,
        action_url: actionUrl,
        sent_by: 'nongfah_ai',
        is_read: false,
        metadata
      });

    if (inAppErr) {
      console.error('[Calendar Notification] In-app insert failed:', inAppErr.message);
    }

    // 2. Dispatch Web Push if requested
    if (sendPush) {
      let query = admin.from('user_push_subscriptions').select('*');

      if (recipientUserId) {
        query = query.eq('user_id', recipientUserId);
      } else if (recipientRole && recipientRole !== 'all') {
        query = query.or(`user_role.eq.${recipientRole},user_role.eq.all,user_role.eq.admin`);
      }

      const { data: subscriptions, error: subErr } = await query;

      if (!subErr && subscriptions && subscriptions.length > 0) {
        await broadcastPushNotifications(subscriptions, {
          title,
          body,
          url: actionUrl,
          tag: `svportal-calendar-${Date.now()}`,
          data: { category, ...metadata }
        });
      }
    }

    return true;
  } catch (error: any) {
    console.error('[Calendar Notification] Error sending notification:', error.message);
    return false;
  }
}

/**
 * Notify teacher when assigned a duty
 */
export async function notifyDutyAssigned(params: {
  teacherUserId?: string | null;
  teacherName: string;
  dutyTitle: string;
  date: string;
  location?: string | null;
  description?: string | null;
}) {
  const { teacherUserId, teacherName, dutyTitle, date, location, description } = params;
  return sendCalendarNotification({
    title: `[แจ้งมอบหมายเวรปฏิบัติหน้าที่] (${date})`,
    body: `เรียนคุณครู${teacherName} ท่านได้รับมอบหมายปฏิบัติหน้าที่: ${dutyTitle} ${location ? `ณ ${location}` : ''} ${description ? `(${description})` : ''}`,
    recipientUserId: teacherUserId,
    recipientRole: 'teacher',
    category: 'reminder',
    actionUrl: `/calendar`,
    metadata: { dutyTitle, date, event: 'DUTY_ASSIGNED' }
  });
}

/**
 * Notify upcoming deadline (e.g. ปพ.5, KPI, Exam)
 */
export async function notifyCalendarDeadline(params: {
  title: string;
  targetRole: string;
  endDate: string;
  description?: string | null;
  actionUrl?: string;
}) {
  const { title, targetRole, endDate, description, actionUrl } = params;
  return sendCalendarNotification({
    title: `[แจ้งเตือนกำหนดการสำคัญ] ${title}`,
    body: `ขอแจ้งเตือนกำหนดการสิ้นสุดในวันที่ ${endDate} ${description ? `รายละเอียด: ${description}` : ''} กรุณาดำเนินการให้เรียบร้อยค่ะ`,
    recipientRole: targetRole,
    category: 'urgent',
    actionUrl: actionUrl || '/calendar',
    metadata: { title, endDate, event: 'CALENDAR_DEADLINE' }
  });
}

/**
 * Scan and dispatch reminders for today & upcoming 1-2 days calendar events
 */
export async function scanAndDispatchUpcomingCalendarAlerts(): Promise<{
  dispatchedCount: number;
  events: Array<{ id: string; title: string; target: string }>;
}> {
  try {
    const admin = getAdminClient();
    const today = new Date().toISOString().split('T')[0];
    
    // Calculate 2 days ahead
    const twoDaysLater = new Date();
    twoDaysLater.setDate(twoDaysLater.getDate() + 2);
    const futureDate = twoDaysLater.toISOString().split('T')[0];

    // Fetch upcoming events that have not been dispatched yet
    const { data: upcomingEvents, error } = await admin
      .from('calendar_events')
      .select('*')
      .gte('start_date', today)
      .lte('start_date', futureDate)
      .is('notification_dispatched_at', null);

    if (error || !upcomingEvents || upcomingEvents.length === 0) {
      return { dispatchedCount: 0, events: [] };
    }

    const dispatched: Array<{ id: string; title: string; target: string }> = [];

    // Fetch all personnel to map user IDs
    const { data: personnelList } = await admin
      .from('personnel')
      .select('id, name_th, user_id');

    const personnelMap = new Map((personnelList || []).map(p => [p.id, p]));

    for (const event of upcomingEvents) {
      const isToday = event.start_date === today;
      const daysText = isToday ? 'วันนี้' : `วันที่ ${event.start_date}`;

      // If duty: alert assigned personnel
      if (event.is_duty && Array.isArray(event.assigned_personnel_ids) && event.assigned_personnel_ids.length > 0) {
        for (const pId of event.assigned_personnel_ids) {
          const person = personnelMap.get(pId);
          if (person) {
            await sendCalendarNotification({
              title: `[แจ้งเตือนเวรปฏิบัติหน้าที่] (${daysText})`,
              body: `คุณครู${person.name_th} มีเวรปฏิบัติหน้าที่: ${event.title_th} ${event.location ? `ณ ${event.location}` : ''} ${event.description ? `(${event.description})` : ''}`,
              recipientUserId: person.user_id,
              recipientRole: 'teacher',
              category: 'urgent',
              actionUrl: `/calendar`,
              metadata: { eventId: event.id, type: 'duty_reminder' }
            });
          }
        }
      } else {
        // General or Academic event
        const role = event.target_role || 'all';
        await sendCalendarNotification({
          title: `[ปฏิทินปฏิบัติงาน] ${event.title_th} (${daysText})`,
          body: `${event.description ? `${event.description} ` : ''}${event.location ? `สถานที่: ${event.location}` : ''}`,
          recipientRole: role,
          category: event.category === 'academic' ? 'academic' : 'reminder',
          actionUrl: event.action_url || `/calendar`,
          metadata: { eventId: event.id, type: 'calendar_reminder' }
        });
      }

      // Mark event as dispatched
      await admin
        .from('calendar_events')
        .update({ notification_dispatched_at: new Date().toISOString() })
        .eq('id', event.id);

      dispatched.push({
        id: event.id,
        title: event.title_th,
        target: event.is_duty ? 'ครูผู้ปฏิบัติหน้าที่' : event.target_role || 'all'
      });
    }

    return {
      dispatchedCount: dispatched.length,
      events: dispatched
    };
  } catch (err: any) {
    console.error('[Calendar Scanner] Error scanning upcoming events:', err);
    return { dispatchedCount: 0, events: [] };
  }
}
