import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { scoreExamAnswers } from '@/lib/academic/exam-engine';
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

    const { data: submissions, error } = await supabase
      .from('academic_exam_submissions')
      .select(`
        *,
        student:students(id, name, citizen_id)
      `)
      .eq('exam_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, submissions: submissions || [] });
  } catch (error: any) {
    console.error('Error fetching submissions:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(
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
      student_id,
      set_name = 'A',
      student_answers = {},
      is_damaged_or_spill = false,
      manual_override = false,
      override_reason = null,
      scanned_image_url = null,
      status = 'GRADED'
    } = body;

    if (!student_id) {
      return NextResponse.json({ success: false, error: 'Student ID is required' }, { status: 400 });
    }

    // 1. Fetch Exam and Set answer key
    const { data: exam, error: examError } = await supabase
      .from('academic_exams')
      .select('*')
      .eq('id', id)
      .single();

    if (examError || !exam) {
      return NextResponse.json({ success: false, error: 'Exam not found' }, { status: 404 });
    }

    const { data: setRecord, error: setError } = await supabase
      .from('academic_exam_sets')
      .select('answer_key, question_order_mapping')
      .eq('exam_id', id)
      .eq('set_name', set_name)
      .single();

    const answerKey = setRecord?.answer_key || {};

    // Fetch questions to calculate points mapping per set
    const { data: questions } = await supabase
      .from('academic_exam_questions')
      .select('question_number, points')
      .eq('exam_id', id);

    const { buildSetPointsMap } = await import('@/lib/academic/exam-engine');
    const pointsMap = questions && questions.length > 0
      ? buildSetPointsMap(setRecord, questions)
      : undefined;

    // 2. Score the answers
    const scoreResult = scoreExamAnswers(
      student_answers,
      answerKey,
      pointsMap,
      Number(exam.max_score)
    );

    // 3. Upsert submission (one submission per student per exam)
    const submissionData = {
      exam_id: id,
      student_id,
      set_name,
      student_answers,
      raw_score: scoreResult.rawScore,
      total_score: scoreResult.totalScore,
      status: status || 'GRADED',
      is_damaged_or_spill: Boolean(is_damaged_or_spill),
      manual_override: Boolean(manual_override),
      override_reason: override_reason || (is_damaged_or_spill ? 'น้ำหกใส่ / กระดาษฉีกขาด (ครูบันทึกแทน)' : null),
      scanned_image_url,
      scanned_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: submission, error: subError } = await supabase
      .from('academic_exam_submissions')
      .upsert(submissionData, { onConflict: 'exam_id,student_id' })
      .select(`
        *,
        student:students(id, name)
      `)
      .single();

    if (subError) throw subError;

    return NextResponse.json({
      success: true,
      submission,
      scoreResult
    });
  } catch (error: any) {
    console.error('Error submitting exam answers:', error);
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
    const { searchParams } = new URL(req.url);
    const submissionId = searchParams.get('submission_id');
    const studentId = searchParams.get('student_id');

    const supabase = getAdminClient();

    let query = supabase
      .from('academic_exam_submissions')
      .delete()
      .eq('exam_id', id);

    if (submissionId) {
      query = query.eq('id', submissionId);
    } else if (studentId) {
      query = query.eq('student_id', studentId);
    } else {
      return NextResponse.json({ success: false, error: 'กรุณาระบุ submission_id หรือ student_id' }, { status: 400 });
    }

    const { error } = await query;
    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'ลบผลการสอบเรียบร้อยแล้ว'
    });
  } catch (error: any) {
    console.error('Error deleting submission:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
