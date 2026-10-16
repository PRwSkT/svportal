import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth('staff', 'academic_hub');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabase = getAdminClient();
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get('class_id');
    const status = searchParams.get('status');
    const teacherId = searchParams.get('teacher_id');

    const academicYear = searchParams.get('academic_year') || searchParams.get('year');
    const term = searchParams.get('term');

    let query = supabase
      .from('academic_gradebooks')
      .select(`
        *,
        class:academic_classes!academic_gradebooks_class_id_fkey(*),
        course:academic_courses!academic_gradebooks_course_id_fkey(*),
        actual_teacher:personnel!academic_gradebooks_actual_teacher_id_fkey(id, name_th, email, position_th),
        opec_teacher:personnel!academic_gradebooks_opec_teacher_id_fkey(id, name_th, position_th)
      `)
      .order('created_at', { ascending: false });

    if (classId) query = query.eq('class_id', classId);
    if (status) query = query.eq('approval_status', status);
    if (teacherId) query = query.eq('actual_teacher_id', teacherId);
    if (term && term !== 'full_year') query = query.or(`term.eq.${term},term.eq.full_year`);

    const { data: gradebooks, error } = await query;
    if (error) throw error;

    let filtered = gradebooks || [];
    if (academicYear) {
      filtered = filtered.filter((g: any) => g.class?.academic_year === academicYear);
    }

    return NextResponse.json({ success: true, gradebooks: filtered });
  } catch (error: any) {
    console.error('Error fetching gradebooks:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth('teacher', 'academic_hub');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabase = getAdminClient();
    const body = await req.json();

    const { class_id, course_id, actual_teacher_id, opec_teacher_id, term = 'full_year' } = body;
    if (!class_id || !course_id) {
      return NextResponse.json({ error: 'Missing class_id or course_id' }, { status: 400 });
    }

    // 1. Create or fetch Gradebook
    const { data: gradebook, error: gbErr } = await supabase
      .from('academic_gradebooks')
      .upsert({
        class_id,
        course_id,
        actual_teacher_id: actual_teacher_id || null,
        opec_teacher_id: opec_teacher_id || null,
        term
      }, { onConflict: 'class_id, course_id, term' })
      .select(`
        *,
        class:academic_classes(*),
        course:academic_courses(*)
      `)
      .single();

    if (gbErr) throw gbErr;

    // 2. Fetch enrolled students in this class
    const { data: enrollments, error: enrErr } = await supabase
      .from('academic_class_enrollments')
      .select('student_id, roll_number')
      .eq('class_id', class_id)
      .or('status.eq.active,status.in.("กำลังศึกษาอยู่","นักเรียนเข้าใหม่","นักเรียนเก่าเข้าใหม่"),status.is.null');

    if (enrErr) throw enrErr;

    // 3. Initialize empty student grade rows if not already existing
    if (enrollments && enrollments.length > 0) {
      const studentGrades = enrollments.map(enr => ({
        gradebook_id: gradebook.id,
        student_id: enr.student_id,
        formative_score: 0,
        exam_score: 0,
        total_score: 0,
        final_grade: '0',
        attendance_hours: 40,
        total_course_hours: 40,
        attendance_percent: 100
      }));

      await supabase
        .from('academic_student_grades')
        .upsert(studentGrades, { onConflict: 'gradebook_id, student_id', ignoreDuplicates: true });
    }

    return NextResponse.json({ success: true, gradebook });
  } catch (error: any) {
    console.error('Error creating gradebook:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
