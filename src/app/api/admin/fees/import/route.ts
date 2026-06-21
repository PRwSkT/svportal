import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { rows } = await request.json();
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
    }

    const supabase = await createClient();

    // Fetch existing pairs for the students in this chunk to skip duplicates
    const studentIds = [...new Set(rows.map(r => r.student_id))];
    const { data: existing, error: fetchErr } = await supabase
      .from('fee_items')
      .select('student_id, fee_type_id')
      .in('student_id', studentIds);

    if (fetchErr) throw fetchErr;

    const existingSet = new Set(existing?.map((e: any) => `${e.student_id}_${e.fee_type_id}`));

    const toInsert = rows
      .filter(r => !existingSet.has(`${r.student_id}_${r.fee_type_id}`))
      .map(({ student_id, fee_type_id, amount }) => ({ student_id, fee_type_id, amount }));

    if (toInsert.length > 0) {
      const { error: insertErr } = await supabase.from('fee_items').insert(toInsert);
      if (insertErr) throw insertErr;
    }

    return NextResponse.json({
      inserted: toInsert.length,
      skipped: rows.length - toInsert.length
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
