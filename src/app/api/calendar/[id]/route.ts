import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth';
import { triggerWebsiteRebuild } from '@/lib/website-sync';
import { sendCalendarNotification } from '@/lib/calendar/notifications';

// PUT /api/calendar/[id] - Update calendar event
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { id } = await params;
    const supabase = getAdminClient();
    const body = await req.json();

    const {
      title_th,
      title_en,
      start_date,
      end_date,
      is_holiday,
      category,
      description,
      location,
      target_role,
      assigned_personnel_ids,
      is_duty,
      duty_type,
      publish_to_web,
      color_code,
      action_url,
      notify_update = false
    } = body;

    const updatePayload: any = {
      updated_at: new Date().toISOString()
    };

    if (title_th !== undefined) updatePayload.title_th = title_th;
    if (title_en !== undefined) updatePayload.title_en = title_en;
    if (start_date !== undefined) updatePayload.start_date = start_date;
    if (end_date !== undefined) updatePayload.end_date = end_date || start_date;
    if (is_holiday !== undefined) updatePayload.is_holiday = Boolean(is_holiday);
    if (category !== undefined) updatePayload.category = category;
    if (description !== undefined) updatePayload.description = description;
    if (location !== undefined) updatePayload.location = location;
    if (target_role !== undefined) updatePayload.target_role = target_role;
    if (assigned_personnel_ids !== undefined) updatePayload.assigned_personnel_ids = assigned_personnel_ids;
    if (is_duty !== undefined) updatePayload.is_duty = Boolean(is_duty);
    if (duty_type !== undefined) updatePayload.duty_type = duty_type;
    if (publish_to_web !== undefined) updatePayload.publish_to_web = Boolean(publish_to_web);
    if (color_code !== undefined) updatePayload.color_code = color_code;
    if (action_url !== undefined) updatePayload.action_url = action_url;

    const { data: updated, error: updErr } = await supabase
      .from('calendar_events')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (updErr) throw updErr;

    // Trigger website rebuild if publish_to_web is true
    if (updated.publish_to_web) {
      triggerWebsiteRebuild(`Updated calendar event: ${updated.title_th}`).catch(e =>
        console.error('Website rebuild trigger error:', e)
      );
    }

    if (notify_update && updated) {
      await sendCalendarNotification({
        title: `[อัปเดตกำหนดการ] ${updated.title_th}`,
        body: `มีการแก้ไขข้อมูลกำหนดการในปฏิทินปฏิบัติงาน: ${updated.description || ''} ${updated.location ? `ณ ${updated.location}` : ''}`,
        recipientRole: updated.target_role || 'all',
        category: 'reminder',
        actionUrl: updated.action_url || `/calendar`,
        metadata: { eventId: updated.id, event: 'CALENDAR_UPDATED' }
      });
    }

    return NextResponse.json({
      success: true,
      event: updated,
      message: 'อัปเดตกิจกรรมเรียบร้อยแล้ว'
    });
  } catch (error: any) {
    console.error('Error updating calendar event:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/calendar/[id] - Delete calendar event
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { id } = await params;
    const supabase = getAdminClient();

    // Check if was published before deleting to trigger rebuild
    const { data: existing } = await supabase
      .from('calendar_events')
      .select('title_th, publish_to_web')
      .eq('id', id)
      .single();

    const { error: delErr } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', id);

    if (delErr) throw delErr;

    if (existing?.publish_to_web) {
      triggerWebsiteRebuild(`Deleted calendar event: ${existing.title_th}`).catch(e =>
        console.error('Website rebuild trigger error:', e)
      );
    }

    return NextResponse.json({
      success: true,
      message: 'ลบกิจกรรมออกจากปฏิทินเรียบร้อยแล้ว'
    });
  } catch (error: any) {
    console.error('Error deleting calendar event:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
