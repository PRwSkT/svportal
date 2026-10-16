import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth';
import { triggerWebsiteRebuild } from '@/lib/website-sync';
import { 
  sendCalendarNotification, 
  notifyDutyAssigned,
  notifyCalendarDeadline 
} from '@/lib/calendar/notifications';

// GET /api/calendar - Retrieve calendar events with enriched personnel data
export async function GET(req: NextRequest) {
  try {
    const supabase = getAdminClient();
    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month'); // 1-12
    const year = searchParams.get('year');   // e.g. 2026
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const category = searchParams.get('category');
    const isDuty = searchParams.get('is_duty');
    const publishedOnly = searchParams.get('published_only');

    if (publishedOnly !== 'true') {
      const auth = await requireAuth('staff');
      if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    let query = supabase
      .from('calendar_events')
      .select('*')
      .order('start_date', { ascending: true });

    if (startDate && endDate) {
      query = query.lte('start_date', endDate).gte('end_date', startDate);
    } else if (month && year) {
      const m = String(month).padStart(2, '0');
      const startOfMonth = `${year}-${m}-01`;
      // calculate last day of month
      const lastDay = String(new Date(Number(year), Number(month), 0).getDate()).padStart(2, '0');
      const endOfMonth = `${year}-${m}-${lastDay}`;
      query = query.lte('start_date', endOfMonth).gte('end_date', startOfMonth);
    }

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    if (isDuty === 'true') {
      query = query.eq('is_duty', true);
    }

    if (publishedOnly === 'true') {
      query = query.eq('publish_to_web', true);
    }

    const { data: events, error } = await query;
    if (error) throw error;

    // Fetch personnel to enrich assigned_personnel_ids
    const { data: personnelList } = await supabase
      .from('personnel')
      .select('id, name_th, position_th, category, user_id')
      .eq('is_active', true);

    const personnelMap = new Map((personnelList || []).map((p: any) => [
      p.id,
      {
        id: p.id,
        name_th: p.name_th,
        role: p.position_th || p.category || 'บุคลากร',
        user_id: p.user_id
      }
    ]));

    const enrichedEvents = (events || []).map(event => {
      let assigned_personnel: any[] = [];
      if (Array.isArray(event.assigned_personnel_ids)) {
        assigned_personnel = event.assigned_personnel_ids
          .map((id: string) => personnelMap.get(id))
          .filter(Boolean);
      }
      return {
        ...event,
        assigned_personnel
      };
    });

    return NextResponse.json({
      success: true,
      events: enrichedEvents,
      count: enrichedEvents.length
    });
  } catch (error: any) {
    console.error('Error fetching calendar events:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/calendar - Create new operational calendar event
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const supabase = getAdminClient();
    const body = await req.json();

    const {
      title_th,
      title_en,
      start_date,
      end_date,
      is_holiday = false,
      category = 'academic',
      description,
      location,
      target_role = 'all',
      assigned_personnel_ids = [],
      is_duty = false,
      duty_type,
      publish_to_web = true,
      color_code,
      action_url,
      notify_immediately = false
    } = body;

    if (!title_th || !start_date) {
      return NextResponse.json({ error: 'Title and start date are required' }, { status: 400 });
    }

    const finalEndDate = end_date || start_date;

    const newRecord = {
      title_th,
      title_en: title_en || null,
      start_date,
      end_date: finalEndDate,
      is_holiday: Boolean(is_holiday),
      category,
      description: description || null,
      location: location || null,
      target_role: target_role || 'all',
      assigned_personnel_ids: Array.isArray(assigned_personnel_ids) ? assigned_personnel_ids : [],
      is_duty: Boolean(is_duty),
      duty_type: duty_type || null,
      publish_to_web: Boolean(publish_to_web),
      color_code: color_code || null,
      action_url: action_url || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: inserted, error: insErr } = await supabase
      .from('calendar_events')
      .insert(newRecord)
      .select()
      .single();

    if (insErr) throw insErr;

    // 1. Sync to school website if publish_to_web is true
    if (publish_to_web) {
      triggerWebsiteRebuild(`New calendar event: ${title_th}`).catch(e =>
        console.error('Website rebuild trigger error:', e)
      );
    }

    // 2. Immediate Notification dispatch if requested
    if (notify_immediately && inserted) {
      if (is_duty && Array.isArray(assigned_personnel_ids) && assigned_personnel_ids.length > 0) {
        // Fetch teachers to notify
        const { data: teachers } = await supabase
          .from('personnel')
          .select('id, name_th, user_id')
          .in('id', assigned_personnel_ids);

        for (const t of teachers || []) {
          await notifyDutyAssigned({
            teacherUserId: t.user_id,
            teacherName: t.name_th,
            dutyTitle: title_th,
            date: start_date,
            location,
            description
          });
        }
      } else {
        await sendCalendarNotification({
          title: `[ปฏิทินปฏิบัติงานใหม่] ${title_th}`,
          body: `${description || `กิจกรรมกำหนดวันที่ ${start_date}`} ${location ? `ณ ${location}` : ''}`,
          recipientRole: target_role,
          category: category === 'academic' ? 'academic' : 'reminder',
          actionUrl: action_url || `/calendar`,
          metadata: { eventId: inserted.id, event: 'CALENDAR_CREATED' }
        });
      }

      // Mark notification as dispatched
      await supabase
        .from('calendar_events')
        .update({ notification_dispatched_at: new Date().toISOString() })
        .eq('id', inserted.id);
    }

    return NextResponse.json({
      success: true,
      event: inserted,
      message: 'บันทึกกิจกรรมลงปฏิทินปฏิบัติงานเรียบร้อยแล้ว'
    });
  } catch (error: any) {
    console.error('Error creating calendar event:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
