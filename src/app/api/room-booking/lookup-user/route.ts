import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    const type = (searchParams.get('type') || 'ALL').toUpperCase();

    if (!q || q.length < 2) {
      return NextResponse.json({ success: true, results: [] });
    }

    const supabase = getAdminClient();
    const results: Array<{
      type: 'TEACHER' | 'STUDENT';
      id: string;
      code: string;
      name: string;
      role_label: string;
    }> = [];

    if (type === 'ALL' || type === 'TEACHER') {
      const { data: teachers } = await supabase
        .from('personnel')
        .select('id, name_th, position_th, email')
        .eq('is_active', true)
        .or(`name_th.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(8);

      for (const t of teachers || []) {
        results.push({
          type: 'TEACHER',
          id: t.id,
          code: t.email || t.id,
          name: t.name_th,
          role_label: t.position_th || 'ครู / บุคลากร',
        });
      }
    }

    if (type === 'ALL' || type === 'STUDENT') {
      const { data: students } = await supabase
        .from('students')
        .select('id, student_id, name, prefix, first_name, last_name, nickname, grade, classroom')
        .or(`student_id.ilike.%${q}%,name.ilike.%${q}%,first_name.ilike.%${q}%,nickname.ilike.%${q}%`)
        .limit(10);

      for (const s of students || []) {
        const fullName =
          s.name ||
          `${s.prefix || ''}${s.first_name || ''} ${s.last_name || ''}`.trim();
        results.push({
          type: 'STUDENT',
          id: s.id,
          code: s.student_id || s.id,
          name: fullName,
          role_label: `นักเรียนชั้น ${s.grade || ''}${s.classroom ? '/' + s.classroom : ''} (${s.student_id || '-'})`.trim(),
        });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Lookup failed', results: [] },
      { status: 500 }
    );
  }
}
