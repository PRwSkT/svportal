import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const auth = await requireAuth('cashier', 'pos_wallet_topup');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const { studentId, amount, topupMethod } = body;

    const supabase = await createClient();
    
    if (!studentId || !amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'ข้อมูลการเติมเงินไม่ถูกต้อง' }, { status: 400 });
    }

    if (amount > 10000) {
      return NextResponse.json({ error: 'ยอดเติมเงินสูงสุดไม่เกิน 10,000 บาท ต่อครั้ง' }, { status: 400 });
    }

    // Call the RPC function
    const { data, error } = await supabase.rpc('topup_wallet', {
      payload: {
        student_id: studentId,
        amount: amount,
        channel: topupMethod || 'counter',
        cashier_note: `Cashier: ${auth.user?.email || auth.user?.id}`,
        svportal_ref: body.idempotencyKey || null
      }
    });

    if (error) throw error;

    const result = data as {
      success: boolean;
      transaction_id: string;
      balance_before: number;
      balance_after: number;
    };

    return NextResponse.json({
      id: result.transaction_id,
      student_id: studentId,
      type: 'topup',
      amount: amount,
      balance_before: result.balance_before,
      balance_after: result.balance_after,
      channel: topupMethod || 'counter',
      created_at: new Date().toISOString()
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'เกิดข้อผิดพลาดในการเติมเงิน' }, { status: 500 });
  }
}
