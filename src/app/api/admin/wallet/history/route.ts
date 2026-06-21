import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(request.url);
    const student_id = searchParams.get('student_id');
    const limit = parseInt(searchParams.get('limit') || '30', 10);

    if (!student_id) {
      return NextResponse.json({ error: 'student_id is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('student_id', student_id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error('DB_ERROR');
    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
