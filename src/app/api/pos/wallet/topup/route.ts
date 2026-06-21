import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const { studentId, amount, topupMethod } = body;

    const supabase = await createClient();
    
    // Call the RPC function
    const { data, error } = await supabase.rpc('process_wallet_topup', {
      p_student_id: studentId,
      p_amount: amount,
      p_method: topupMethod
    });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
