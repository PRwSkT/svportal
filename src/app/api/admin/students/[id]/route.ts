import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const auth = await requireAuth();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    // Await params if it's a promise (Next.js 15+)
    let id: string;
    if (context.params instanceof Promise) {
      const resolved = await context.params;
      id = resolved.id;
    } else {
      id = (context.params as { id: string }).id;
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('students')
      .select('*, student_addresses(*), student_parents(*)')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Error' }, { status: 500 });
  }
}
