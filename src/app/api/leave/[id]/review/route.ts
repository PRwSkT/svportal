import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { getAdminClient } from '@/lib/supabase/admin';
import {
  dispatchLeaveNotifications,
  isDirectorApprover,
  NotifiedRecipientLog,
  StaffLeaveRequest,
  syncApprovedLeaveToAttendance,
} from '@/lib/leave/workflow';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // STRICT DIRECTOR-ONLY APPROVAL ENFORCEMENT
    const isDirector = await isDirectorApprover(user.id);
    if (!isDirector) {
      return NextResponse.json(
        {
          error:
            'ขออภัย เฉพาะผู้อำนวยการโรงเรียน (ผู้มีสิทธิ์อนุมัติตามโครงสร้าง) เท่านั้นที่สามารถอนุมัติหรือไม่อนุมัติใบลา/ไปราชการได้',
        },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'ไม่พบรหัสคำขอ' }, { status: 400 });
    }

    const body = await req.json();
    const decision = body.decision as 'approved' | 'rejected';
    const comment = body.comment ? String(body.comment).trim() : null;

    if (decision !== 'approved' && decision !== 'rejected') {
      return NextResponse.json(
        { error: 'ผลการพิจารณาต้องเป็น approved หรือ rejected เท่านั้น' },
        { status: 400 }
      );
    }

    const admin = getAdminClient();
    const { data: existing, error: fetchErr } = await admin
      .from('staff_leave_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!existing) {
      return NextResponse.json({ error: 'ไม่พบคำขอลา/ไปราชการ' }, { status: 404 });
    }
    if (existing.status !== 'pending') {
      return NextResponse.json(
        { error: `คำขอนี้ถูกดำเนินการไปแล้ว (สถานะ: ${existing.status})` },
        { status: 400 }
      );
    }

    const { data: approverRow } = await admin
      .from('app_users')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();
    const approverName =
      approverRow?.full_name || user.user_metadata?.full_name || 'ผู้อำนวยการโรงเรียน';
    const nowIso = new Date().toISOString();

    let syncSummary = { syncedDates: [] as string[], skippedDates: [] as string[] };
    if (decision === 'approved') {
      syncSummary = await syncApprovedLeaveToAttendance(existing as StaffLeaveRequest);
    }

    const { data: updatedRow, error: updateErr } = await admin
      .from('staff_leave_requests')
      .update({
        status: decision,
        approver_user_id: user.id,
        approver_name: approverName,
        approved_at: nowIso,
        approver_comment: comment,
        attendance_synced:
          decision === 'approved' && syncSummary.syncedDates.length > 0,
        attendance_synced_dates:
          decision === 'approved' ? syncSummary.syncedDates : [],
        updated_at: nowIso,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr || !updatedRow) {
      throw updateErr || new Error('ไม่สามารถอัปเดตสถานะคำขอได้');
    }

    const eventType = decision === 'approved' ? 'approve' : 'reject';
    const newLogs = await dispatchLeaveNotifications({
      request: updatedRow as StaffLeaveRequest,
      event: eventType,
      notifyApplicant: true,
      approverComment: comment,
    });

    const previousLogs = Array.isArray(existing.notified_recipients)
      ? (existing.notified_recipients as NotifiedRecipientLog[])
      : [];
    const mergedLogs = [...previousLogs, ...newLogs];

    const { data: finalRow } = await admin
      .from('staff_leave_requests')
      .update({
        notified_recipients: mergedLogs,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    return NextResponse.json({
      success: true,
      request: finalRow || updatedRow,
      syncSummary,
      notifiedCount: newLogs.length,
      notifiedRecipients: newLogs,
      message:
        decision === 'approved'
          ? `อนุมัติคำขอเรียบร้อย ซิงค์ตารางเข้างาน ${syncSummary.syncedDates.length} วัน และแจ้งเตือนผู้เกี่ยวข้อง ${newLogs.length} รายการ`
          : `บันทึกผลการไม่อนุมัติเรียบร้อย และแจ้งเตือนผู้ยื่นคำขอแล้ว`,
    });
  } catch (error: any) {
    console.error('POST /api/leave/[id]/review error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'ไม่สามารถดำเนินการพิจารณาคำขอได้' },
      { status: 500 }
    );
  }
}
