import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { generateZeroCollisionTimetable, detectCollisions } from '@/lib/academic/timetable-engine';
import { requireAuth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth('teacher', 'admin_academic');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabase = getAdminClient();
    const body = await req.json().catch(() => ({}));
    const { 
      academic_year = '2568', 
      term = '1',
      clear_existing = true
    } = body;

    // 1. Fetch classes
    const { data: classes, error: classError } = await supabase
      .from('academic_classes')
      .select('id, name, grade_level')
      .eq('academic_year', academic_year);

    if (classError) throw classError;

    // 2. Fetch courses
    const { data: courses, error: courseError } = await supabase
      .from('academic_courses')
      .select('id, name_th, subject_group, grade_level, annual_hours')
      .eq('academic_year', academic_year);

    if (courseError) throw courseError;

    // 3. Fetch teachers (personnel)
    const { data: teachers, error: teacherError } = await supabase
      .from('personnel')
      .select('id, name_th')
      .eq('is_active', true);

    if (teacherError) throw teacherError;

    // 4. Fetch teacher competencies
    const { data: competencies, error: compError } = await supabase
      .from('academic_teacher_competencies')
      .select('*')
      .eq('is_active', true);

    if (compError) throw compError;

    // 5. Solve timetable using Constraint Satisfaction Solver
    const solution = generateZeroCollisionTimetable({
      academicYear: academic_year,
      term,
      classes: (classes || []) as any[],
      courses: (courses || []) as any[],
      teachers: (teachers || []) as any[],
      competencies: (competencies || []) as any[]
    });

    const collisions = detectCollisions(solution.slots);
    if (collisions.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'พบชั่วโมงชนในการประมวลผล กรุณาตรวจสอบคุณสมบัติครู',
        collisions
      }, { status: 400 });
    }

    // 6. Save solution to database
    if (clear_existing) {
      await supabase
        .from('academic_timetables')
        .delete()
        .eq('academic_year', academic_year)
        .eq('term', term);
    }

    if (solution.slots.length > 0) {
      const rowsToInsert = solution.slots.map(s => ({
        academic_year: s.academic_year,
        term: s.term,
        class_id: s.class_id,
        course_id: s.course_id,
        teacher_id: s.teacher_id,
        day_of_week: s.day_of_week,
        period_number: s.period_number,
        room_name: s.room_name
      }));

      const { error: insertError } = await supabase
        .from('academic_timetables')
        .insert(rowsToInsert);

      if (insertError) throw insertError;
    }

    return NextResponse.json({
      success: true,
      total_slots_generated: solution.slots.length,
      unassigned_count: solution.unassignedCourses.length,
      unassigned_courses: solution.unassignedCourses,
      message: `น้องฟ้า AI ร่างตารางสอนสำเร็จ ${solution.slots.length} คาบ โดยไม่มีชั่วโมงชน 100%`
    });
  } catch (error: any) {
    console.error('Error generating timetable:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
