import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { generateExamSets } from '@/lib/academic/exam-engine';
import { requireAuth } from '@/lib/auth';
import { DEFAULT_ACADEMIC_YEAR, DEFAULT_TERM } from '@/lib/constants/school';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth('staff', 'academic_hub');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabase = getAdminClient();
    const { searchParams } = new URL(req.url);
    const academicYear = searchParams.get('academic_year') || DEFAULT_ACADEMIC_YEAR;
    const term = searchParams.get('term');
    const courseId = searchParams.get('course_id');

    let query = supabase
      .from('academic_exams')
      .select(`
        *,
        course:academic_courses(id, course_code, name_th, grade_level, department),
        gradebook:academic_gradebooks(id, class:academic_classes(name)),
        sets:academic_exam_sets(id, set_name, answer_key)
      `)
      .eq('academic_year', academicYear)
      .order('created_at', { ascending: false });

    if (term) query = query.eq('term', term);
    if (courseId) query = query.eq('course_id', courseId);

    const { data: exams, error } = await query;
    if (error) throw error;

    // Get submission counts for each exam
    const examIds = (exams || []).map(e => e.id);
    let countsMap: Record<string, number> = {};
    if (examIds.length > 0) {
      const { data: subs } = await supabase
        .from('academic_exam_submissions')
        .select('exam_id')
        .in('exam_id', examIds);

      subs?.forEach((s: any) => {
        countsMap[s.exam_id] = (countsMap[s.exam_id] || 0) + 1;
      });
    }

    const enriched = (exams || []).map(e => ({
      ...e,
      submissions_count: countsMap[e.id] || 0
    }));

    return NextResponse.json({ success: true, exams: enriched });
  } catch (error: any) {
    console.error('Error fetching exams:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth('teacher', 'academic_hub');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabase = getAdminClient();
    const body = await req.json();

    const {
      title,
      course_id,
      gradebook_id,
      academic_year = DEFAULT_ACADEMIC_YEAR,
      term = DEFAULT_TERM,
      exam_type = 'midterm',
      total_questions = 20,
      max_score = 20,
      duration_minutes = 60,
      instructions,
      created_by,
      questions = []
    } = body;

    if (!title || !course_id) {
      return NextResponse.json({ success: false, error: 'Title and Course are required' }, { status: 400 });
    }

    // 1. Insert Exam record
    const { data: exam, error: examError } = await supabase
      .from('academic_exams')
      .insert({
        title,
        course_id,
        gradebook_id: gradebook_id || null,
        academic_year,
        term,
        exam_type,
        total_questions: questions.length || total_questions,
        max_score,
        duration_minutes,
        instructions,
        created_by: created_by || null
      })
      .select()
      .single();

    if (examError) throw examError;

    // 2. Insert Questions if provided
    let insertedQuestions: any[] = [];
    if (questions.length > 0) {
      const qRows = questions.map((q: any, idx: number) => ({
        exam_id: exam.id,
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
      insertedQuestions = qData || [];

      // 3. Auto-generate Sets A, B, C with Choice Pinning protection
      const sets = generateExamSets(insertedQuestions, {
        setNames: ['A', 'B', 'C'],
        shuffleQuestions: true,
        shuffleChoices: true
      });

      const setRows = sets.map(s => ({
        exam_id: exam.id,
        set_name: s.set_name,
        question_order_mapping: s.question_order_mapping,
        answer_key: s.answer_key
      }));

      const { error: setError } = await supabase
        .from('academic_exam_sets')
        .insert(setRows);

      if (setError) throw setError;
    }

    return NextResponse.json({
      success: true,
      exam,
      questions_count: insertedQuestions.length
    });
  } catch (error: any) {
    console.error('Error creating exam:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
