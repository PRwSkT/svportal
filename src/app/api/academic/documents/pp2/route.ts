import { NextRequest, NextResponse } from 'next/server';
import { getPP2DataByStudentId } from '@/lib/academic/pp2-engine';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth('staff', 'academic_hub');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(req.url);
    let studentId = searchParams.get('student_id');

    const supabase = getAdminClient();

    if (!studentId) {
      const { data: defaultStudent } = await supabase
        .from('students')
        .select('id')
        .or('grade.ilike.%ป.6%')
        .order('id', { ascending: true })
        .limit(1)
        .single();

      studentId = defaultStudent?.id || '10073';
    }

    const finalStudentId = String(studentId || '10073');
    const data = await getPP2DataByStudentId(finalStudentId, supabase);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error fetching PP2 data:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
