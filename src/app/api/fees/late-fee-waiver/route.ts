import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  submitLateFeeWaiverRequest,
  reviewLateFeeWaiverRequest,
  listLateFeeWaiverRequests,
} from '@/lib/finance/installment-and-latefee-engine';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth('staff');
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get('status');
    const validStatus = statusParam === 'PENDING' || statusParam === 'APPROVED' || statusParam === 'REJECTED'
      ? statusParam
      : undefined;

    const waivers = await listLateFeeWaiverRequests(validStatus);
    return NextResponse.json({ success: true, count: waivers.length, waivers });
  } catch (err: any) {
    console.error('GET /api/fees/late-fee-waiver error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth('staff');
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json();
    const action = body.action || 'submit';

    // 1. Submit waiver request (Cashier / Teacher / Staff)
    if (action === 'submit') {
      const { scheduleId, reason, waiveFull, requestedAmount } = body;
      if (!scheduleId || !reason) {
        return NextResponse.json({ error: 'กรุณาระบุ scheduleId และเหตุผลการขอยกเว้นค่าปรับ' }, { status: 400 });
      }

      const requesterId = auth.user?.id;
      if (!requesterId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const requesterName = auth.user?.user_metadata?.full_name || auth.appUser?.full_name || 'เจ้าหน้าที่การเงิน';

      const request = await submitLateFeeWaiverRequest({
        scheduleId,
        reason,
        waiveFull: Boolean(waiveFull),
        requestedAmount: requestedAmount ? Number(requestedAmount) : undefined,
        requestedBy: requesterId,
        requestedByName: requesterName,
      });

      return NextResponse.json({
        success: true,
        request,
        message: 'ส่งคำขอยกเว้นค่าปรับเรียบร้อยแล้ว อยู่ในคิวรอการพิจารณาอนุมัติ (Maker-Checker)',
      });
    }

    // 2. Review waiver request (Finance Head / Admin / Executive only)
    if (action === 'review') {
      const isReviewerAuthorized = auth.role === 'admin' || auth.role === 'executive';
      if (!isReviewerAuthorized) {
        return NextResponse.json({ error: 'เฉพาะผู้อำนวยการ/หัวหน้าการเงิน/ผู้ดูแลระบบเท่านั้นที่มีสิทธิ์อนุมัติการยกเว้นค่าปรับ' }, { status: 403 });
      }

      const { requestId, decision, approvedAmount, note } = body;
      if (!requestId || !['APPROVED', 'REJECTED'].includes(decision)) {
        return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง (requestId, decision: APPROVED|REJECTED)' }, { status: 400 });
      }

      const reviewerId = auth.user?.id;
      if (!reviewerId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const reviewerName = auth.user?.user_metadata?.full_name || auth.appUser?.full_name || 'ผู้อนุมัติการเงิน';

      const result = await reviewLateFeeWaiverRequest({
        requestId,
        decision: decision as 'APPROVED' | 'REJECTED',
        reviewerId,
        reviewerName,
        approvedAmount: approvedAmount ? Number(approvedAmount) : undefined,
        note: note || null,
      });

      return NextResponse.json({
        success: true,
        result,
        message: decision === 'APPROVED'
          ? `อนุมัติยกเว้นค่าปรับสำเร็จ ออกใบลดหนี้เลขที่ ${result.credit_note_number} เรียบร้อยแล้ว`
          : 'บันทึกการไม่อนุมัติคำขอยกเว้นค่าปรับเรียบร้อยแล้ว',
      });
    }

    return NextResponse.json({ error: `ไม่รองรับ action: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error('POST /api/fees/late-fee-waiver error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
