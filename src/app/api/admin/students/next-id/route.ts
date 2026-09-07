import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'normal'; // 'normal' or 'e'

    const supabase = await createClient();

    const { data: nextId, error } = await supabase.rpc('get_next_student_id', {
      p_type: type === 'e' ? 'e' : 'normal',
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ nextId });
  } catch (error: any) {
    console.error('Next ID API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
