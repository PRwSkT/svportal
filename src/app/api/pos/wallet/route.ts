import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(request.url);
    const student_id = searchParams.get('student_id');
    const card_uid = searchParams.get('card_uid');

    if (!student_id && !card_uid) {
      return NextResponse.json({ error: 'Require student_id or card_uid' }, { status: 400 });
    }

    const supabase = await createClient();
    
    let wallet: any = null;
    
    if (student_id) {
      const { data, error } = await supabase
        .from('wallet_accounts')
        .select('*')
        .eq('student_id', student_id)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      wallet = data;
    } else if (card_uid) {
      const { data, error } = await supabase
        .from('wallet_accounts')
        .select('*')
        .eq('card_uid', card_uid.toUpperCase().trim())
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      wallet = data;
    }

    if (!wallet) return NextResponse.json({ error: 'WALLET_NOT_FOUND' }, { status: 404 });

    // Get today spend
    const today = new Date().toISOString().split('T')[0];
    const { data: spendData } = await supabase
      .from('daily_spend_tracking')
      .select('total_spent')
      .eq('student_id', wallet.student_id)
      .eq('spend_date', today)
      .single();
      
    const today_spend = spendData?.total_spent || 0;

    // Get student name
    const { data: studentData } = await supabase
      .from('students')
      .select('name')
      .eq('id', wallet.student_id)
      .single();

    return NextResponse.json({
      wallet,
      today_spend,
      student_name: studentData?.name || 'ไม่พบชื่อ'
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
