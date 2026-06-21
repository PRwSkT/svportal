import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Student, FeeItem } from '@/types';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    
    if (!q) {
      return NextResponse.json({ error: 'Require q parameter' }, { status: 400 });
    }

    const supabase = await createClient();
    
    const { data: students, error: studentError } = await supabase
      .from('students')
      .select('*')
      .or(`id.eq.${q},name.ilike.%${q}%`)
      .limit(10);

    if (studentError) throw studentError;
    if (!students || students.length === 0) return NextResponse.json([]);

    const studentIds = students.map((s: Student) => s.id);
    const { data: feeItems, error: feeError } = await supabase
      .from('fee_items')
      .select(`*, fee_type:fee_types(*)`)
      .in('student_id', studentIds)
      .eq('status', 'unpaid');

    if (feeError) throw feeError;

    const results = students.map((student: Student) => ({
      ...student,
      unpaid_fees: feeItems ? feeItems.filter((f: any) => f.student_id === student.id) as FeeItem[] : []
    }));

    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
