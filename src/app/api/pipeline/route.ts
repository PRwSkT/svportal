import { NextRequest, NextResponse } from 'next/server';
import {
  acknowledgeEarlyYearsDropoffNote,
  acknowledgeStudentIncident,
  createGuardianInviteCode,
  createOrUpdateAssignment,
  getPipelineState,
  payFeeInvoiceFromParent,
  recordMedicationAdministered,
  recordStudentAttendance,
  resetPipelineState,
  reviewLeaveRequest,
  saveEarlyYearsDailyCare,
  sendParentTeacherMessage,
  signFree15YSubsidyReceipt,
  submitEarlyYearsDropoffNote,
  submitLeaveRequest,
  submitMedicationRequest,
  toggleStudentConsent,
  topupChildWalletFromParent,
  updateGuardianLinkPermissions,
  updatePickupDailyPlan,
  verifyPickupTotp,
} from '@/lib/pipeline/bidirectional-store';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('student_id');
    const state = getPipelineState();

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
    const body = await request.json();
    const { action, payload } = body || {};

    switch (action) {
      case 'SUBMIT_LEAVE':
        return NextResponse.json({ success: true, data: submitLeaveRequest(payload) });
      case 'REVIEW_LEAVE':
        return NextResponse.json({ success: true, data: reviewLeaveRequest(payload) });
      case 'UPDATE_PICKUP_PLAN':
        return NextResponse.json({ success: true, data: updatePickupDailyPlan(payload) });
      case 'VERIFY_PICKUP_TOTP':
        return NextResponse.json({
          success: true,
          data: verifyPickupTotp(payload.student_id, payload.code),
        });
      case 'SUBMIT_DROPOFF_NOTE':
        return NextResponse.json({ success: true, data: submitEarlyYearsDropoffNote(payload) });
      case 'ACK_DROPOFF_NOTE':
        return NextResponse.json({
          success: true,
          data: acknowledgeEarlyYearsDropoffNote(payload.note_id, payload.teacher_name),
        });
      case 'SAVE_DAILY_CARE':
        return NextResponse.json({ success: true, data: saveEarlyYearsDailyCare(payload) });
      case 'SUBMIT_MEDICATION':
        return NextResponse.json({ success: true, data: submitMedicationRequest(payload) });
      case 'ADMINISTER_MEDICATION':
        return NextResponse.json({ success: true, data: recordMedicationAdministered(payload) });
      case 'ACK_INCIDENT':
        return NextResponse.json({
          success: true,
          data: acknowledgeStudentIncident(payload.incident_id),
        });
      case 'SIGN_FREE15Y':
        return NextResponse.json({
          success: true,
          data: signFree15YSubsidyReceipt(payload.subsidy_id),
        });
      case 'TOPUP_WALLET':
        return NextResponse.json({
          success: true,
          data: topupChildWalletFromParent(payload.student_id, Number(payload.amount)),
        });
      case 'PAY_INVOICE':
        return NextResponse.json({
          success: true,
          data: payFeeInvoiceFromParent(payload.invoice_id),
        });
      case 'SEND_MESSAGE':
        return NextResponse.json({ success: true, data: sendParentTeacherMessage(payload) });
      case 'TOGGLE_CONSENT':
        return NextResponse.json({
          success: true,
          data: toggleStudentConsent(
            payload.student_id,
            payload.purpose_code,
            Boolean(payload.is_granted)
          ),
        });
      case 'UPDATE_GUARDIAN_PERMS':
        return NextResponse.json({
          success: true,
          data: updateGuardianLinkPermissions(payload.link_id, payload.patch, payload.staff_name),
        });
      case 'CREATE_INVITE_CODE':
        return NextResponse.json({ success: true, data: createGuardianInviteCode(payload) });
      case 'RECORD_ATTENDANCE':
        return NextResponse.json({ success: true, data: recordStudentAttendance(payload) });
      case 'UPSERT_ASSIGNMENT':
        return NextResponse.json({ success: true, data: createOrUpdateAssignment(payload) });
      case 'RESET_PIPELINE':
        return NextResponse.json({ success: true, state: resetPipelineState() });
      default:
        return NextResponse.json(
          { success: false, error: `Unsupported pipeline action: ${action}` },
          { status: 400 }
        );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Pipeline mutation failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
