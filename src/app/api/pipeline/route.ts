import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { getAuthenticatedGuardianId } from '@/lib/parents/session';
import { getAdminClient } from '@/lib/supabase/admin';
import {
  fetchRealPipelineState,
  dbRecordAttendance,
  dbSubmitLeaveRequest,
  dbReviewLeaveRequest,
  dbUpdatePickupDailyPlan,
  dbSubmitDropoffNote,
  dbAcknowledgeDropoffNote,
  dbSaveDailyCare,
  dbSubmitMedication,
  dbAdministerMedication,
  dbToggleConsent,
  dbSendMessage,
  dbTopupWallet,
  dbSaveDailyLimit,
  dbAcknowledgeMessage,
  dbAcknowledgeIncident,
  dbSignFree15Y,
  dbPayFeeInvoice,
  dbUpdateGuardianPerms,
  dbCreateGuardianInvite,
  dbUpsertAssignment,
  dbVerifyPickupTotp,
} from '@/lib/pipeline/pipeline-server';
import { resetPipelineState } from '@/lib/pipeline/bidirectional-store';

/**
 * Verifies that a guardian has an active link to the specified student.
 */
async function verifyGuardianStudentLink(guardianId: string, studentId: string): Promise<boolean> {
  if (!guardianId || !studentId) return false;
  const supabase = getAdminClient();
  const { data: link, error } = await supabase
    .schema('family')
    .from('guardian_student_links')
    .select('id')
    .eq('guardian_id', guardianId)
    .eq('student_id', studentId)
    .maybeSingle();

  if (error || !link) {
    return false;
  }
  return true;
}

export async function GET(request: NextRequest) {
  try {
    const staffUser = await getServerUser();
    const isStaff = Boolean(staffUser);
    const guardianId = !isStaff ? getAuthenticatedGuardianId(request) : null;

    if (!isStaff && !guardianId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('student_id');

    // If a guardian is requesting a specific student, ensure it belongs to them
    if (!isStaff && guardianId && studentId) {
      const isLinked = await verifyGuardianStudentLink(guardianId, studentId);
      if (!isLinked) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: You do not have permission for this student' },
          { status: 403 }
        );
      }
    }

    // Fetch real scoped live state directly from Supabase
    const state = await fetchRealPipelineState(
      studentId || undefined,
      guardianId || undefined,
      isStaff
    );

    if (studentId) {
      return NextResponse.json({
        success: true,
        child: state.children.find((c) => c.id === studentId) || null,
        attendance: state.attendance_logs.filter((a) => a.student_id === studentId),
        leave_requests: state.leave_requests.filter((l) => l.student_id === studentId),
        pickup_plan: state.pickup_plans.find((p) => p.student_id === studentId) || null,
        early_years_care: state.early_years_care.find((c) => c.student_id === studentId) || null,
        dropoff_notes: state.dropoff_notes.filter((d) => d.student_id === studentId),
        medication_requests: state.medication_requests.filter((m) => m.student_id === studentId),
        incidents: state.incidents.filter((i) => i.student_id === studentId),
        assignments: state.assignments.filter((a) => a.student_id === studentId),
        consents: state.consents.filter((c) => c.student_id === studentId),
        links: state.links.filter((l) => l.student_id === studentId),
        invitations: state.invitations.filter((inv) => inv.student_id === studentId),
      });
    }

    return NextResponse.json({
      success: true,
      state,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load pipeline state';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const staffUser = await getServerUser();
    const isStaff = Boolean(staffUser);
    const guardianId = !isStaff ? getAuthenticatedGuardianId(request) : null;

    if (!isStaff && !guardianId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, payload } = body || {};

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'Missing pipeline action' },
        { status: 400 }
      );
    }

    // Role-based action access check
    const STAFF_ONLY_ACTIONS = new Set([
      'RECORD_ATTENDANCE',
      'REVIEW_LEAVE',
      'ACK_DROPOFF_NOTE',
      'ACKNOWLEDGE_DROPOFF_NOTE',
      'SAVE_DAILY_CARE',
      'ADMINISTER_MEDICATION',
      'UPDATE_GUARDIAN_PERMS',
      'CREATE_INVITE_CODE',
      'UPSERT_ASSIGNMENT',
      'VERIFY_PICKUP_TOTP',
      'RESET_PIPELINE',
    ]);

    if (!isStaff && STAFF_ONLY_ACTIONS.has(action)) {
      return NextResponse.json(
        { success: false, error: `Forbidden: Action ${action} requires staff authorization` },
        { status: 403 }
      );
    }

    // For guardian actions, verify student ownership if student_id is provided
    if (!isStaff && guardianId && payload?.student_id) {
      const isLinked = await verifyGuardianStudentLink(guardianId, payload.student_id);
      if (!isLinked) {
        return NextResponse.json(
          { success: false, error: `Forbidden: Guardian not linked to student ${payload.student_id}` },
          { status: 403 }
        );
      }
    }

    switch (action) {
      case 'RECORD_ATTENDANCE': {
        const result = await dbRecordAttendance(payload);
        return NextResponse.json({ success: true, data: result });
      }

      case 'SUBMIT_LEAVE': {
        const result = await dbSubmitLeaveRequest(payload);
        return NextResponse.json({ success: true, data: result });
      }

      case 'REVIEW_LEAVE': {
        const result = await dbReviewLeaveRequest({
          ...payload,
          reviewed_by: payload.reviewed_by || staffUser?.user_metadata?.full_name || staffUser?.email || 'ครูประจำชั้น',
        });
        return NextResponse.json({ success: true, data: result });
      }

      case 'UPDATE_PICKUP_PLAN': {
        const result = await dbUpdatePickupDailyPlan(payload);
        return NextResponse.json({ success: true, data: result });
      }

      case 'VERIFY_PICKUP_TOTP': {
        const result = await dbVerifyPickupTotp(
          payload.student_id,
          payload.code,
          staffUser?.user_metadata?.full_name || staffUser?.email || 'เจ้าหน้าที่จุดรับ-ส่ง'
        );
        return NextResponse.json({ success: true, data: result });
      }

      case 'SUBMIT_DROPOFF_NOTE': {
        const result = await dbSubmitDropoffNote(payload);
        return NextResponse.json({ success: true, data: result });
      }

      case 'ACK_DROPOFF_NOTE':
      case 'ACKNOWLEDGE_DROPOFF_NOTE': {
        const result = await dbAcknowledgeDropoffNote(
          payload.note_id || payload.id,
          payload.teacher_name || staffUser?.user_metadata?.full_name || 'ครูประจำชั้น'
        );
        return NextResponse.json({ success: true, data: result });
      }

      case 'SAVE_DAILY_CARE': {
        const result = await dbSaveDailyCare(payload);
        return NextResponse.json({ success: true, data: result });
      }

      case 'SUBMIT_MEDICATION': {
        const result = await dbSubmitMedication(payload);
        return NextResponse.json({ success: true, data: result });
      }

      case 'ADMINISTER_MEDICATION': {
        const result = await dbAdministerMedication({
          ...payload,
          nurse_name: payload.nurse_name || staffUser?.user_metadata?.full_name || 'พยาบาลวิชาชีพ',
        });
        return NextResponse.json({ success: true, data: result });
      }

      case 'ACK_INCIDENT': {
        const result = await dbAcknowledgeIncident(
          payload.incident_id,
          payload.guardian_name || 'ผู้ปกครอง'
        );
        return NextResponse.json({ success: true, data: result });
      }

      case 'SIGN_FREE15Y': {
        const result = await dbSignFree15Y(
          payload.subsidy_id,
          payload.guardian_name || 'ผู้ปกครอง',
          payload.signature_data,
          payload.student_id
        );
        return NextResponse.json({ success: true, data: result });
      }

      case 'TOPUP_WALLET': {
        const result = await dbTopupWallet(payload.student_id, Number(payload.amount));
        return NextResponse.json({ success: true, data: result });
      }

      case 'SAVE_DAILY_LIMIT': {
        const result = await dbSaveDailyLimit(payload.student_id, Number(payload.daily_limit));
        return NextResponse.json({ success: true, data: result });
      }

      case 'PAY_INVOICE': {
        const result = await dbPayFeeInvoice(
          payload.invoice_id,
          payload.student_id,
          payload.amount ? Number(payload.amount) : undefined,
          payload.payment_method
        );
        return NextResponse.json({ success: true, data: result });
      }

      case 'SEND_MESSAGE': {
        const result = await dbSendMessage(payload);
        return NextResponse.json({ success: true, data: result });
      }

      case 'ACK_MESSAGE': {
        const result = await dbAcknowledgeMessage(payload.message_id);
        return NextResponse.json({ success: true, data: result });
      }

      case 'TOGGLE_CONSENT': {
        const result = await dbToggleConsent(
          payload.student_id,
          payload.purpose_code,
          Boolean(payload.is_granted)
        );
        return NextResponse.json({ success: true, data: result });
      }

      case 'UPDATE_GUARDIAN_PERMS': {
        const result = await dbUpdateGuardianPerms(
          payload.link_id,
          payload.patch,
          staffUser?.user_metadata?.full_name || staffUser?.email || 'ฝ่ายทะเบียน'
        );
        return NextResponse.json({ success: true, data: result });
      }

      case 'CREATE_INVITE_CODE': {
        const result = await dbCreateGuardianInvite({
          ...payload,
          created_by: staffUser?.id,
        });
        return NextResponse.json({ success: true, data: result });
      }

      case 'UPSERT_ASSIGNMENT': {
        const result = await dbUpsertAssignment({
          ...payload,
          assigned_by: payload.assigned_by || staffUser?.user_metadata?.full_name || 'ครูผู้สอน',
        });
        return NextResponse.json({ success: true, data: result });
      }

      case 'RESET_PIPELINE': {
        return NextResponse.json({ success: true, state: resetPipelineState() });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unsupported pipeline action: ${action}` },
          { status: 400 }
        );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Pipeline mutation failed';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
