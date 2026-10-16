import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth';
import { compileEsarData } from '@/lib/governance/esar-aggregator';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const academicYear = searchParams.get('academicYear') || '2568';

    const supabase = getAdminClient();

    // 1. Fetch live students
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, student_id, name, gender, grade, classroom, status')
      .in('status', ['กำลังศึกษาอยู่', 'นักเรียนเข้าใหม่', 'นักเรียนเก่าเข้าใหม่']);

    if (studentsError) {
      return NextResponse.json({ error: studentsError.message }, { status: 500 });
    }

    // 2. Fetch teacher licenses
    const { data: teachers } = await supabase
      .from('teacher_licenses')
      .select('*');

    // 3. Fetch board meetings
    const { data: boardMeetings } = await supabase
      .from('school_board_meetings')
      .select('*')
      .eq('academic_year', academicYear);

    // 4. Compile e-SAR Document
    const esarDoc = compileEsarData({
      academicYear,
      students: students || [],
      teachers: teachers || [],
      boardMeetingsCount: boardMeetings?.length || 4
    });

    return NextResponse.json({
      success: true,
      report: esarDoc
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
