import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { evaluateStudentCourseResult } from '@/lib/academic/calculation';
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

    // Target gradebook_id can be specified or take from exam
    let { target_gradebook_id } = body;

    const { data: exam, error: examError } = await supabase
      .from('academic_exams')
      .select('*')
      .eq('id', id)
      .single();

    if (examError || !exam) {
      return NextResponse.json({ success: false, error: 'Exam not found' }, { status: 404 });
    }

    const gradebookId = target_gradebook_id || exam.gradebook_id;
    if (!gradebookId) {
      return NextResponse.json({
        success: false,
        error: 'กรุณาเลือกเล่ม ปพ.5 (Gradebook) ที่ต้องการซิงค์คะแนน'
      }, { status: 400 });
    }

    // Check target gradebook status (prevent modifying locked gradebooks)
    const { data: targetGb } = await supabase
      .from('academic_gradebooks')
      .select('approval_status')
      .eq('id', gradebookId)
      .single();

    if (targetGb?.approval_status === 'APPROVED_BY_HEAD' || targetGb?.approval_status === 'OFFICIALLY_LOCKED') {
      return NextResponse.json({
        success: false,
        error: 'ไม่สามารถซิงค์คะแนนได้ เนื่องจากเล่ม ปพ.5 นี้ได้รับการอนุมัติหรือล็อกผลการเรียนอย่างเป็นทางการแล้ว'
      }, { status: 400 });
    }

    // 1. Fetch all submissions for this exam
    const { data: submissions, error: subError } = await supabase
      .from('academic_exam_submissions')
      .select('student_id, total_score')
      .eq('exam_id', id);

    if (subError) throw subError;

    if (!submissions || submissions.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'ไม่พบผลการสอบที่ตรวจแล้วสำหรับข้อสอบนี้'
      }, { status: 400 });
    }

    // 2. Fetch existing student grades for the target gradebook
    const { data: currentGrades, error: gradeError } = await supabase
      .from('academic_student_grades')
      .select('*')
      .eq('gradebook_id', gradebookId);

    if (gradeError) throw gradeError;

    const gradeMap = new Map((currentGrades || []).map((g: any) => [g.student_id, g]));
    let syncedCount = 0;

    for (const sub of submissions) {
      const existing = gradeMap.get(sub.student_id);
      if (!existing) continue;

      const formativeScore = Number(existing.formative_score) || 0;
      const newExamScore = Number(sub.total_score);

      const isAbsent = Boolean(sub.total_score === null || existing.is_absent || existing.final_grade === 'ขส');
      const isIncomplete = Boolean(existing.is_incomplete || existing.final_grade === 'ร');
      const isNoExam = Boolean(existing.final_grade === 'มส');

      const calc = evaluateStudentCourseResult({
        formativeScore,
        examScore: newExamScore,
        attendedHours: Number(existing.attendance_hours ?? 40),
        totalCourseHours: Number(existing.total_course_hours ?? 40),
        isAbsentFromExam: isAbsent,
        isIncompleteWork: isIncomplete,
        isRemedial: existing.is_remedial || false,
        remedialScore: existing.remedial_score
      });

      const calculatedGrade = isNoExam ? 'มส' : calc.finalGrade;

      await supabase
        .from('academic_student_grades')
        .update({
          exam_score: newExamScore,
          total_score: calc.totalScore,
          final_grade: calculatedGrade,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);

      syncedCount++;
    }

    return NextResponse.json({
      success: true,
      synced_count: syncedCount,
      message: `ซิงค์คะแนนสอบเข้าเล่ม ปพ.5 เรียบร้อยแล้ว ${syncedCount} คน พร้อมตัดเกรดอัตโนมัติ`
    });
  } catch (error: any) {
    console.error('Error syncing exam scores to gradebook:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
