import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const supabase = getAdminClient();
    const { data: row } = await supabase
      .from('signage_settings')
      .select('value')
      .eq('key', 'ticker_text')
      .maybeSingle();

    const value = row?.value || 'ยินดีต้อนรับสู่โรงเรียนสมคิดวิทยา (Somkidvittaya School) • ระบบสื่อประชาสัมพันธ์ภายในองค์กร SV Portal Signage Suite • ติดต่อสอบถามแผนกธุรการ';
    return NextResponse.json({ success: true, data: { ticker_text: value } });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { ticker_text } = body;
    if (typeof ticker_text !== 'string') {
      return NextResponse.json({ success: false, error: 'Ticker text is required' }, { status: 400 });
    }

    const supabase = getAdminClient();
    const { error } = await supabase
      .from('signage_settings')
      .upsert({
        key: 'ticker_text',
        value: ticker_text.trim(),
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;
    return NextResponse.json({ success: true, message: 'Ticker text updated', data: { ticker_text } });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
