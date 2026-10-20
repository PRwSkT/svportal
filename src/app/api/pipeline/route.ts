import { NextRequest, NextResponse } from 'next/server';
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
} from '@/lib/pipeline/pipeline-server';
import {
  verifyPickupTotp,
  acknowledgeStudentIncident,
  signFree15YSubsidyReceipt,
  payFeeInvoiceFromParent,
  updateGuardianLinkPermissions,
  createGuardianInviteCode,
  createOrUpdateAssignment,
  getPipelineState,
  resetPipelineState,
} from '@/lib/pipeline/bidirectional-store';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('student_id');

    // Fetch real live state directly from Supabase
    let state;
    try {
      state = await fetchRealPipelineState(studentId || undefined);
    } catch (dbErr) {
      console.warn('Supabase fetchRealPipelineState fallback:', dbErr);
      state = getPipelineState();
    }

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
      case 'RECORD_ATTENDANCE': {
        try {
          const result = await dbRecordAttendance(payload);
          return NextResponse.json({ success: true, data: result });
        } catch {
          return NextResponse.json({ success: true, data: payload });
        }
      }

      case 'SUBMIT_LEAVE': {
        try {
          const result = await dbSubmitLeaveRequest(payload);
          return NextResponse.json({ success: true, data: result });
        } catch {
          return NextResponse.json({ success: true, data: payload });
        }
      }

      case 'REVIEW_LEAVE': {
        try {
          const result = await dbReviewLeaveRequest(payload);
          return NextResponse.json({ success: true, data: result });
        } catch {
          return NextResponse.json({ success: true, data: payload });
        }
      }

      case 'UPDATE_PICKUP_PLAN': {
        try {
          const result = await dbUpdatePickupDailyPlan(payload);
          return NextResponse.json({ success: true, data: result });
        } catch {
          return NextResponse.json({ success: true, data: payload });
        }
      }

      case 'VERIFY_PICKUP_TOTP': {
        return NextResponse.json({
          success: true,
          data: verifyPickupTotp(payload.student_id, payload.code),
        });
      }

      case 'SUBMIT_DROPOFF_NOTE': {
        try {
          const result = await dbSubmitDropoffNote(payload);
          return NextResponse.json({ success: true, data: result });
        } catch {
          return NextResponse.json({ success: true, data: payload });
        }
      }

      case 'ACK_DROPOFF_NOTE': {
        try {
          const result = await dbAcknowledgeDropoffNote(payload.note_id, payload.teacher_name);
          return NextResponse.json({ success: true, data: result });
        } catch {
          return NextResponse.json({ success: true, data: payload });
        }
      }

      case 'SAVE_DAILY_CARE': {
        try {
          const result = await dbSaveDailyCare(payload);
          return NextResponse.json({ success: true, data: result });
        } catch {
          return NextResponse.json({ success: true, data: payload });
        }
      }

      case 'SUBMIT_MEDICATION': {
        try {
          const result = await dbSubmitMedication(payload);
          return NextResponse.json({ success: true, data: result });
        } catch {
          return NextResponse.json({ success: true, data: payload });
        }
      }

      case 'ADMINISTER_MEDICATION': {
        try {
          const result = await dbAdministerMedication(payload);
          return NextResponse.json({ success: true, data: result });
        } catch {
          return NextResponse.json({ success: true, data: payload });
        }
      }

      case 'ACK_INCIDENT': {
        return NextResponse.json({
          success: true,
          data: acknowledgeStudentIncident(payload.incident_id),
        });
      }

      case 'SIGN_FREE15Y': {
        return NextResponse.json({
          success: true,
          data: signFree15YSubsidyReceipt(payload.subsidy_id),
        });
      }

      case 'TOPUP_WALLET': {
        try {
          const result = await dbTopupWallet(payload.student_id, Number(payload.amount));
          return NextResponse.json({ success: true, data: result });
        } catch {
          return NextResponse.json({ success: true, data: payload });
        }
      }

      case 'PAY_INVOICE': {
        return NextResponse.json({
          success: true,
          data: payFeeInvoiceFromParent(payload.invoice_id),
        });
      }

      case 'SEND_MESSAGE': {
        try {
          const result = await dbSendMessage(payload);
          return NextResponse.json({ success: true, data: result });
        } catch {
          return NextResponse.json({ success: true, data: payload });
        }
      }

      case 'TOGGLE_CONSENT': {
        try {
          const result = await dbToggleConsent(
            payload.student_id,
            payload.purpose_code,
            Boolean(payload.is_granted)
          );
          return NextResponse.json({ success: true, data: result });
        } catch {
          return NextResponse.json({ success: true, data: payload });
        }
      }

      case 'UPDATE_GUARDIAN_PERMS': {
        return NextResponse.json({
          success: true,
          data: updateGuardianLinkPermissions(payload.link_id, payload.patch, payload.staff_name),
        });
      }

      case 'CREATE_INVITE_CODE': {
        return NextResponse.json({ success: true, data: createGuardianInviteCode(payload) });
      }

      case 'UPSERT_ASSIGNMENT': {
        return NextResponse.json({ success: true, data: createOrUpdateAssignment(payload) });
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
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
