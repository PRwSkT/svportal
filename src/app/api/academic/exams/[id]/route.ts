import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { generateExamSets } from '@/lib/academic/exam-engine';
import { requireAuth } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('staff', 'academic_hub');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await params;
    const supabase = getAdminClient();

    // 1. Fetch exam
    const { data: exam, error: examError } = await supabase
      .from('academic_exams')
      .select(`
        *,
        course:academic_courses(id, course_code, name_th, grade_level, department),
        gradebook:academic_gradebooks(
          id, 
          class_id,
          class:academic_classes(id, name, grade_level)
        )
      `)
      .eq('id', id)
      .single();

    if (examError || !exam) {
      return NextResponse.json({ success: false, error: 'Exam not found' }, { status: 404 });
    }

    // 2. Fetch questions
    const { data: questions, error: qError } = await supabase
      .from('academic_exam_questions')
      .select('*')
      .eq('exam_id', id)
      .order('question_number', { ascending: true });

    if (qError) throw qError;

    // 3. Fetch sets
    const { data: sets, error: setError } = await supabase
      .from('academic_exam_sets')
      .select('*')
      .eq('exam_id', id)
      .order('set_name', { ascending: true });

    if (setError) throw setError;

    // 4. Fetch submissions with student info
    const { data: submissions, error: subError } = await supabase
      .from('academic_exam_submissions')
      .select(`
        *,
        student:students(id, name, citizen_id)
      `)
      .eq('exam_id', id)
      .order('created_at', { ascending: false });

    if (subError) throw subError;

    // 5. Fetch enrolled students for this exam (by class or grade level)
    let enrolledStudents: any[] = [];
    if (exam.gradebook?.class_id) {
      const { data: enrollments } = await supabase
        .from('academic_class_enrollments')
        .select(`
          student_id,
          roll_number,
          student:students(id, name, grade, citizen_id)
        `)
        .eq('class_id', exam.gradebook.class_id)
        .order('roll_number', { ascending: true });

      if (enrollments && enrollments.length > 0) {
        enrolledStudents = enrollments.map(e => ({
          id: e.student_id,
          name: (e.student as any)?.name || 'นักเรียน',
          grade: (e.student as any)?.grade || '',
          citizen_id: (e.student as any)?.citizen_id || '',
          roll_number: e.roll_number
        }));
      }
    }

    if (enrolledStudents.length === 0) {
      const gradeLevelMap: Record<string, string> = {
        K1: 'อ.1', K2: 'อ.2', K3: 'อ.3',
        P1: 'ป.1', P2: 'ป.2', P3: 'ป.3',
        P4: 'ป.4', P5: 'ป.5', P6: 'ป.6'
      };
      const prefix = gradeLevelMap[exam.course?.grade_level || ''] || 'ป.3';
      const { data: fallbackStudents } = await supabase
        .from('students')
        .select('id, name, grade, citizen_id')
        .ilike('grade', `${prefix}%`)
        .in('status', ['กำลังศึกษาอยู่', 'นักเรียนเข้าใหม่'])
        .order('name', { ascending: true })
        .limit(50);

      if (fallbackStudents) {
        enrolledStudents = fallbackStudents.map((s, idx) => ({
          id: s.id,
          name: s.name,
          grade: s.grade,
          citizen_id: s.citizen_id,
          roll_number: idx + 1
        }));
      }
    }

    return NextResponse.json({
      success: true,
      exam,
      questions: questions || [],
      sets: sets || [],
      submissions: submissions || [],
      enrolled_students: enrolledStudents
    });
  } catch (error: any) {
    console.error('Error fetching exam details:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('teacher', 'academic_hub');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await params;
    const supabase = getAdminClient();
    const body = await req.json();

    const {
      title,
      instructions,
      duration_minutes,
      max_score,
      questions,
      gradebook_id
    } = body;

    // Update main exam record
    const updateData: any = { updated_at: new Date().toISOString() };
    if (title !== undefined) updateData.title = title;
    if (instructions !== undefined) updateData.instructions = instructions;
    if (duration_minutes !== undefined) updateData.duration_minutes = duration_minutes;
    if (max_score !== undefined) updateData.max_score = max_score;
    if (gradebook_id !== undefined) updateData.gradebook_id = gradebook_id;

    if (questions && Array.isArray(questions)) {
      updateData.total_questions = questions.length;
    }

    const { data: updatedExam, error: examError } = await supabase
      .from('academic_exams')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (examError) throw examError;

    // If questions were provided, replace and regenerate sets
    if (questions && Array.isArray(questions)) {
      // Delete old questions
      await supabase.from('academic_exam_questions').delete().eq('exam_id', id);

      const qRows = questions.map((q: any, idx: number) => ({
        exam_id: id,
        question_number: q.question_number || (idx + 1),
        question_text: q.question_text || `ข้อที่ ${idx + 1}`,
        question_image_url: q.question_image_url || null,
        choice_a: q.choice_a || 'ตัวเลือก ก',
        choice_b: q.choice_b || 'ตัวเลือก ข',
        choice_c: q.choice_c || 'ตัวเลือก ค',
        choice_d: q.choice_d || 'ตัวเลือก ง',
        correct_choice: q.correct_choice || 'A',
        indicator_code: q.indicator_code || null,
        points: q.points ?? 1.0,
        pin_choice_position: q.pin_choice_position ?? false,
        pinned_choice_index: q.pinned_choice_index || (q.pin_choice_position ? 'D' : null)
      }));

      const { data: qData, error: qError } = await supabase
        .from('academic_exam_questions')
        .insert(qRows)
        .select();

      if (qError) throw qError;

      // Regenerate sets
      await supabase.from('academic_exam_sets').delete().eq('exam_id', id);

      const sets = generateExamSets(qData || [], {
        setNames: ['A', 'B', 'C'],
        shuffleQuestions: true,
        shuffleChoices: true
      });

      const setRows = sets.map(s => ({
        exam_id: id,
        set_name: s.set_name,
        question_order_mapping: s.question_order_mapping,
        answer_key: s.answer_key
      }));

      await supabase.from('academic_exam_sets').insert(setRows);
    }

    return NextResponse.json({ success: true, exam: updatedExam });
  } catch (error: any) {
    console.error('Error updating exam:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('teacher', 'academic_hub');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await params;
    const supabase = getAdminClient();

    const { error } = await supabase
      .from('academic_exams')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Exam deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting exam:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
