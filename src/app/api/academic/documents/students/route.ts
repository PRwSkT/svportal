import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth('staff', 'academic_hub');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(req.url);
    const gradeFilter = searchParams.get('grade') || 'all';

    const supabase = getAdminClient();
    let query = supabase
      .from('students')
      .select('id, name, first_name, last_name, gender, grade, classroom, status')
      .in('status', ['กำลังศึกษาอยู่', 'นักเรียนเข้าใหม่', 'นักเรียนเก่าเข้าใหม่'])
      .order('grade', { ascending: true })
      .order('id', { ascending: true });

    if (gradeFilter !== 'all') {
      query = query.ilike('grade', `%${gradeFilter}%`);
    }

    const { data: students, error } = await query;
    if (error) throw error;

    const records = (students || []).map((s, idx) => ({
      sequenceNumber: idx + 1,
      studentId: s.id,
      fullName: s.name || `${s.first_name || ''} ${s.last_name || ''}`.trim(),
      grade: s.grade || '',
      classroom: s.classroom || '',
      gender: s.gender || 'ชาย',
    }));

    return NextResponse.json({ success: true, records });
  } catch (error: any) {
    console.error('Error fetching students for documents:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
