import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const { studentId, feeItemIds, paymentMethod, totalAmount, academicYear } = body;

    const payload = {
      student_id: studentId,
      fee_item_ids: feeItemIds,
      payment_method: paymentMethod,
      total_amount: totalAmount,
      academic_year: academicYear
    };

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('process_tuition_payment', { payload });
    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
