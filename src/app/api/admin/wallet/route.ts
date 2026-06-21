import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabase = await createClient();

    const { data: wallets, error: walletErr } = await supabase
      .from('wallet_accounts')
      .select('*')
      .order('student_id', { ascending: true });

    if (walletErr) throw new Error('DB_ERROR');

    const studentIds = (wallets || []).map((w: any) => w.student_id);
    const { data: students } = await supabase
      .from('students')
      .select('id, name, grade')
      .in('id', studentIds);

    const studentMap = new Map<string, any>((students || []).map((s: any) => [s.id, s]));

    const result = (wallets || []).map((w: any) => ({
      ...w,
      student_name: studentMap.get(w.student_id)?.name,
      student_grade: studentMap.get(w.student_id)?.grade,
    }));

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const { action, student_id, card_uid, daily_limit } = body;
    const supabase = await createClient();

    if (action === 'link_card') {
      const normalizedUID = card_uid.toUpperCase().trim();
      const { error } = await supabase
        .from('wallet_accounts')
        .update({ card_uid: normalizedUID, updated_at: new Date().toISOString() })
        .eq('student_id', student_id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    } 
    else if (action === 'update_limit') {
      const { error } = await supabase
        .from('wallet_accounts')
        .update({ daily_limit, updated_at: new Date().toISOString() })
        .eq('student_id', student_id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const { student_id, amount, note } = body;
    const supabase = await createClient();

    if (amount > 0) {
      const payload = {
        student_id,
        amount,
        channel: 'system',
        cashier_note: `[Adjustment] ${note}`,
        svportal_ref: null,
      };
      const { data, error } = await supabase.rpc('topup_wallet', { payload });
      if (error) throw error;
      return NextResponse.json(data);
    } else {
      const absAmount = Math.abs(amount);
      const payload = {
        student_id,
        amount: absAmount,
        reference_id: `adj-${Date.now()}`,
      };
      const { data, error } = await supabase.rpc('deduct_wallet_balance', { payload });
      if (error) throw error;
      return NextResponse.json(data);
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
