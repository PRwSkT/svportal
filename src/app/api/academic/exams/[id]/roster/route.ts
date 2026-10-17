import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('staff', 'academic_hub');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id: examId } = await params;
    const { searchParams } = new URL(req.url);
    const requestedClassId = searchParams.get('class_id');
    const requestedGrade = searchParams.get('grade');

    const supabase = getAdminClient();

    // 1. Get exam details
    const { data: exam, error: examError } = await supabase
      .from('academic_exams')
      .select(`
        id,
        title,
        course_id,
        course:academic_courses(id, course_code, name_th, grade_level),
        gradebook:academic_gradebooks(
          id,
          class_id,
          class:academic_classes(id, name, grade_level)
        )
      `)
      .eq('id', examId)
      .single();

    if (examError || !exam) {
      return NextResponse.json({ success: false, error: 'Exam not found' }, { status: 404 });
    }

    // 2. Fetch all academic classes for dropdown selector
    const { data: allClasses } = await supabase
      .from('academic_classes')
      .select('id, name, grade_level, academic_year')
      .order('name', { ascending: true });

    // Determine target class or grade based on explicit user selection first
    let targetClassId: string | null = null;
    let targetGrade: string | null = null;

    if (requestedClassId) {
      targetClassId = requestedClassId;
      const found = allClasses?.find(c => c.id === requestedClassId);
      if (found) targetGrade = found.name;
    } else if (requestedGrade) {
      targetGrade = requestedGrade;
      const found = allClasses?.find(c => c.name === requestedGrade);
      if (found) targetClassId = found.id;
    } else {
      targetClassId = (exam.gradebook as any)?.class_id || null;
      if (targetClassId && allClasses) {
        const found = allClasses.find(c => c.id === targetClassId);
        if (found) targetGrade = found.name;
      }
    }

    if (!targetGrade) {
      const gradeLevelMap: Record<string, string> = {
        K1: 'อ.1', K2: 'อ.2', K3: 'อ.3',
        P1: 'ป.1', P2: 'ป.2', P3: 'ป.3',
        P4: 'ป.4', P5: 'ป.5', P6: 'ป.6'
      };
      const examGradeLevel = (exam.course as any)?.grade_level || '';
      targetGrade = gradeLevelMap[examGradeLevel] || 'ป.3/1';
    }

    // 3. Fetch students
    let students: any[] = [];

    // Try class enrollments first if classId is known
    if (targetClassId) {
      const { data: enrollments } = await supabase
        .from('academic_class_enrollments')
        .select(`
          roll_number,
          student:students(id, name, grade, citizen_id, classroom, student_id)
        `)
        .eq('class_id', targetClassId)
        .order('roll_number', { ascending: true });

      if (enrollments && enrollments.length > 0) {
        students = enrollments
          .filter(e => e.student)
          .map(e => {
            const s = e.student as any;
            return {
              id: s.id,
              name: s.name,
              grade: s.grade || targetGrade,
              roll_number: e.roll_number,
              citizen_id: s.citizen_id,
              student_id: s.student_id || s.id
            };
          });
      }
    }

    // If no enrollments, query students table directly by grade
    if (students.length === 0 && targetGrade) {
      // Clean grade search: if targetGrade is 'ป.3' match 'ป.3%', if 'ป.3/1' match exact or pattern
      const searchPattern = targetGrade.includes('/') ? targetGrade : `${targetGrade}%`;
      const { data: directStudents } = await supabase
        .from('students')
        .select('id, name, grade, citizen_id, classroom, student_id')
        .ilike('grade', searchPattern)
        .in('status', ['กำลังศึกษาอยู่', 'นักเรียนเข้าใหม่'])
        .order('id', { ascending: true });

      if (directStudents && directStudents.length > 0) {
        students = directStudents.map((s, idx) => ({
          id: s.id,
          name: s.name,
          grade: s.grade,
          roll_number: idx + 1,
          citizen_id: s.citizen_id,
          student_id: s.student_id || s.id
        }));
      }
    }

    return NextResponse.json({
      success: true,
      exam_id: exam.id,
      exam_title: exam.title,
      current_class_id: targetClassId,
      current_grade: targetGrade,
      classes: allClasses || [],
      students
    });
  } catch (error: any) {
    console.error('Error fetching exam roster:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
