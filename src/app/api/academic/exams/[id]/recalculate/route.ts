import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { recalculateAllSubmissions } from '@/lib/academic/exam-engine';
import { requireAuth } from '@/lib/auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('teacher', 'academic_hub');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await params;
    const supabase = getAdminClient();
    const body = await req.json().catch(() => ({}));

    // Optional updated answer key override provided in body
    const { updated_sets } = body;

    // 1. Fetch exam
    const { data: exam, error: examError } = await supabase
      .from('academic_exams')
      .select('*')
      .eq('id', id)
      .single();

    if (examError || !exam) {
      return NextResponse.json({ success: false, error: 'Exam not found' }, { status: 404 });
    }

    // 2. Fetch or update sets
    let sets: any[] = [];
    if (updated_sets && Array.isArray(updated_sets)) {
      for (const s of updated_sets) {
        await supabase
          .from('academic_exam_sets')
          .update({ answer_key: s.answer_key })
          .eq('exam_id', id)
          .eq('set_name', s.set_name);
      }
    }

    const { data: currentSets, error: setError } = await supabase
      .from('academic_exam_sets')
      .select('*')
      .eq('exam_id', id);

    if (setError) throw setError;
    sets = currentSets || [];

    // 3. Fetch all submissions
    const { data: submissions, error: subError } = await supabase
      .from('academic_exam_submissions')
      .select('id, student_id, set_name, student_answers')
      .eq('exam_id', id);

    if (subError) throw subError;

    if (!submissions || submissions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No submissions to recalculate',
        recalculated_count: 0
      });
    }

    // Fetch questions to maintain correct points weights
    const { data: questions } = await supabase
      .from('academic_exam_questions')
      .select('question_number, points')
      .eq('exam_id', id);

    // 4. Run instant 1-second recalculation
    const startTime = Date.now();
    const recalculated = recalculateAllSubmissions(
      submissions,
      sets,
      Number(exam.max_score),
      questions || []
    );

    // Batch update submissions
    for (const r of recalculated) {
      await supabase
        .from('academic_exam_submissions')
        .update({
          raw_score: r.raw_score,
          total_score: r.total_score,
          updated_at: new Date().toISOString()
        })
        .eq('id', r.id);
    }
    const elapsedMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      recalculated_count: recalculated.length,
      elapsed_ms: elapsedMs,
      message: `คำนวณคะแนนใหม่สำเร็จทั้งสายชั้น ${recalculated.length} คน ใน ${elapsedMs} ms โดยไม่ต้องสแกนกระดาษซ้ำ`
    });
  } catch (error: any) {
    console.error('Error recalculating exam scores:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
