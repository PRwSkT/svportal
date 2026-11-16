import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getAuthenticatedGuardianId } from '@/lib/parents/session';
import {
  getStudentInstallments,
  listInstallmentPlans,
  createInstallmentAgreement,
  reviewInstallmentAgreement,
  payInstallmentTranche,
  getFinanceOverview,
  listPendingAgreements,
  guardianCanViewFinance,
  getLateFeePolicy,
  upsertLateFeePolicy,
  upsertInstallmentPlan,
  PaymentMethod,
} from '@/lib/finance/installment-and-latefee-engine';
import {
  formatPromptPayPayload,
  generatePromptPayQrDataUrl,
  buildTuitionQrRefs,
} from '@/lib/finance/emvco-promptpay';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'student';
    const studentId = searchParams.get('student_id');
    const academicYear = searchParams.get('academic_year') || '2569';

    // 1. Check staff authentication first
    const staffAuth = await requireAuth();
    const isStaff = !staffAuth.error && Boolean(staffAuth.user);

    // 2. If not staff, check signed parent session
    const guardianId = !isStaff ? getAuthenticatedGuardianId(req) : null;

    if (!isStaff && !guardianId) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนดำเนินการ' }, { status: 401 });
    }

    // Handlers
    if (action === 'plans') {
      const plans = await listInstallmentPlans(academicYear);
      const policy = await getLateFeePolicy(academicYear);
      return NextResponse.json({ success: true, plans, policy });
    }

    if (action === 'overview') {
      if (!isStaff) {
        return NextResponse.json({ error: 'เฉพาะบุคลากรการเงิน/ผู้บริหารเท่านั้น' }, { status: 403 });
      }
      const overview = await getFinanceOverview();
      return NextResponse.json({ success: true, overview });
    }

    if (action === 'pending_agreements') {
      if (!isStaff) {
        return NextResponse.json({ error: 'เฉพาะบุคลากรการเงิน/ผู้บริหารเท่านั้น' }, { status: 403 });
      }
      const pending = await listPendingAgreements();
      return NextResponse.json({ success: true, pending });
    }

    // Default: query installment agreements & tranches for student
    if (!studentId) {
      return NextResponse.json({ error: 'กรุณาระบุ student_id' }, { status: 400 });
    }

    // If parent caller, verify permission for this specific student
    if (guardianId && !isStaff) {
      const canAccess = await guardianCanViewFinance(guardianId, studentId);
      if (!canAccess) {
        return NextResponse.json({ error: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลการเงินของนักเรียนคนนี้' }, { status: 403 });
      }
    }

    const agreements = await getStudentInstallments(studentId);
    return NextResponse.json({ success: true, student_id: studentId, agreements });
  } catch (err: any) {
    console.error('GET /api/fees/installments error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action || 'create_agreement';

    const staffAuth = await requireAuth();
    const isStaff = !staffAuth.error && Boolean(staffAuth.user);
    const guardianId = !isStaff ? getAuthenticatedGuardianId(req) : null;

    if (!isStaff && !guardianId) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' }, { status: 401 });
    }

    // 1. Create Installment Agreement
    if (action === 'create_agreement') {
      const {
        studentId,
        academicYear = '2569',
        term = 1,
        numInstallments,
        feeItemIds,
        planId,
        depositPct,
        dueDay,
        signedByName,
      } = body;

      if (!studentId || !numInstallments || !feeItemIds?.length) {
        return NextResponse.json({ error: 'ข้อมูลไม่ครบถ้วน (studentId, numInstallments, feeItemIds)' }, { status: 400 });
      }

      if (guardianId && !isStaff) {
        const canAccess = await guardianCanViewFinance(guardianId, studentId);
        if (!canAccess) {
          return NextResponse.json({ error: 'ไม่มีสิทธิ์ทำรายการผ่อนชำระให้นักเรียนคนนี้' }, { status: 403 });
        }
      }

      const autoApprove = isStaff; // Staff/cashier creates active plan; parent requires approval
      const agreement = await createInstallmentAgreement({
        studentId,
        guardianId: guardianId || body.guardianId || null,
        academicYear: String(academicYear),
        term: Number(term) as 1 | 2,
        numInstallments: Number(numInstallments),
        feeItemIds,
        planId: planId || null,
        depositPct: Number(depositPct) || 0,
        dueDay: dueDay ? Number(dueDay) : undefined,
        signedByName: signedByName || (isStaff ? staffAuth.user?.user_metadata?.full_name : 'ผู้ปกครอง'),
        createdBy: isStaff ? staffAuth.user?.id : guardianId,
        autoApprove,
      });

      return NextResponse.json({
        success: true,
        agreement,
        message: autoApprove
          ? 'สร้างแผนผ่อนชำระและเปิดใช้งานสำเร็จเรียบร้อยแล้ว'
          : 'ส่งคำขอผ่อนชำระเรียบร้อยแล้ว อยู่ระหว่างเจ้าหน้าที่การเงินตรวจสอบอนุมัติ',
      });
    }

    // 2. Pay Tranche
    if (action === 'pay_tranche') {
      const { scheduleId, paymentMethod = 'cash', cashierNote, idempotencyKey } = body;

      if (!scheduleId) {
        return NextResponse.json({ error: 'กรุณาระบุ scheduleId' }, { status: 400 });
      }

      const method = paymentMethod as PaymentMethod;
      if (!['cash', 'qr', 'transfer'].includes(method)) {
        return NextResponse.json({ error: 'วิธีชำระเงินไม่ถูกต้อง' }, { status: 400 });
      }

      // Parents can only self-settle via QR or Transfer
      if (guardianId && !isStaff && method === 'cash') {
        return NextResponse.json({ error: 'การชำระด้วยเงินสดต้องติดต่อเคาน์เตอร์การเงินโรงเรียน' }, { status: 400 });
      }

      const cashierId = isStaff ? staffAuth.user?.id || null : null;
      const result = await payInstallmentTranche({
        scheduleId,
        paymentMethod: method,
        cashierId,
        cashierNote: cashierNote || (guardianId ? 'ชำระผ่าน Parents Portal (PromptPay)' : 'รับชำระเคาน์เตอร์ POS'),
        idempotencyKey: idempotencyKey || null,
      });

      return NextResponse.json({
        success: true,
        result,
        message: 'บันทึกการชำระเงินงวดผ่อนเรียบร้อยแล้ว พร้อมออกใบเสร็จแยกเล่มตามระเบียบ สช.',
      });
    }

    // 3. Review Agreement (Staff Only)
    if (action === 'review_agreement') {
      if (!isStaff) {
        return NextResponse.json({ error: 'เฉพาะเจ้าหน้าที่การเงินเท่านั้น' }, { status: 403 });
      }

      const { agreementId, decision } = body;
      if (!agreementId || !['APPROVE', 'REJECT'].includes(decision)) {
        return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง (agreementId, decision: APPROVE|REJECT)' }, { status: 400 });
      }

      const updated = await reviewInstallmentAgreement(
        agreementId,
        decision as 'APPROVE' | 'REJECT',
        staffAuth.user?.id || null
      );

      return NextResponse.json({
        success: true,
        agreement: updated,
        message: decision === 'APPROVE' ? 'อนุมัติแผนผ่อนชำระเรียบร้อยแล้ว' : 'ปฏิเสธแผนผ่อนชำระเรียบร้อยแล้ว',
      });
    }

    // 4. Generate Thai QR PromptPay for a Tranche (EMVCo Tag 30 Bill Payment)
    if (action === 'generate_qr') {
      const { studentId, invoiceNo, amount, trancheNo } = body;
      if (!studentId || !amount) {
        return NextResponse.json({ error: 'กรุณาระบุ studentId และ amount' }, { status: 400 });
      }

      const billerTaxId = process.env.NEXT_PUBLIC_SCHOOL_TAX_ID || '0994000168391';
      const refNo = invoiceNo || `INST-${studentId}-${trancheNo || '1'}`;
      const { ref1, ref2 } = buildTuitionQrRefs(studentId, refNo);

      const payload = formatPromptPayPayload({
        targetId: billerTaxId,
        amount: Number(amount),
        ref1,
        ref2,
        merchantName: 'SOMKIDVITTAYA SCHOOL',
      });

      const qrDataUrl = await generatePromptPayQrDataUrl(payload, 340);

      return NextResponse.json({
        success: true,
        payload,
        qrDataUrl,
        ref1,
        ref2,
        billerTaxId,
        amount: Number(amount),
      });
    }

    // 5. Update Late Fee Policy (Admin / Executive Only)
    if (action === 'update_policy') {
      if (!isStaff || (staffAuth.role !== 'admin' && staffAuth.role !== 'executive')) {
        return NextResponse.json({ error: 'เฉพาะผู้บริหารหรือแอดมินเท่านั้นที่ปรับเปลี่ยนนโยบายค่าปรับได้' }, { status: 403 });
      }

      const policy = await upsertLateFeePolicy(body.policy, staffAuth.user?.id || null);
      return NextResponse.json({ success: true, policy, message: 'บันทึกนโยบายค่าปรับชำระล่าช้าสำเร็จ' });
    }

    // 6. Update or Create Installment Plan (Admin / Executive Only)
    if (action === 'upsert_plan') {
      if (!isStaff || (staffAuth.role !== 'admin' && staffAuth.role !== 'executive')) {
        return NextResponse.json({ error: 'เฉพาะผู้บริหารหรือแอดมินเท่านั้นที่จัดการแผนผ่อนชำระได้' }, { status: 403 });
      }

      const plan = await upsertInstallmentPlan(body.plan);
      return NextResponse.json({ success: true, plan, message: 'บันทึกแผนผ่อนชำระสำเร็จ' });
    }

    return NextResponse.json({ error: `ไม่รองรับ action: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error('POST /api/fees/installments error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
