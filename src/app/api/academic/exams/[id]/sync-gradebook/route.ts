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

    // Fetch target gradebook with course definition (weights and hours)
    const { data: targetGb, error: gbErr } = await supabase
      .from('academic_gradebooks')
      .select('*, course:academic_courses(*)')
      .eq('id', gradebookId)
      .single();

    if (gbErr || !targetGb) {
      return NextResponse.json({ success: false, error: 'Target gradebook not found' }, { status: 404 });
    }

    if (targetGb.approval_status === 'APPROVED_BY_HEAD' || targetGb.approval_status === 'OFFICIALLY_LOCKED') {
      return NextResponse.json({
        success: false,
        error: 'ไม่สามารถซิงค์คะแนนได้ เนื่องจากเล่ม ปพ.5 นี้ได้รับการอนุมัติหรือล็อกผลการเรียนอย่างเป็นทางการแล้ว'
      }, { status: 400 });
    }

    // Dynamic weights and annual hours
    const courseHours = Number(targetGb.course?.annual_hours || 40);
    const formativeMax = Number(targetGb.formative_weight ?? (targetGb.course?.course_type === 'activity' ? 80 : 70));
    const examMax = Number(targetGb.summative_weight ?? (100 - formativeMax));
    const examMaxScore = Number(exam.max_score) || 20;
    const examType = String(exam.exam_type || 'final').toLowerCase();
    const midtermTargetWeight = Number(body.target_weight) || Math.min(20, Math.round(formativeMax * 0.3));

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

      const rawScore = Number(sub.total_score);
      let newFormativeScore = Number(existing.formative_score) || 0;
      let newExamScore = Number(existing.exam_score) || 0;

      if (examType === 'final') {
        // Proportional scale to course's summative exam max weight (e.g. 30 pts)
        const scaled = (rawScore / examMaxScore) * examMax;
        newExamScore = Math.min(examMax, Math.max(0, Math.round(scaled * 10) / 10));
      } else if (examType === 'midterm') {
        // Proportional scale to midterm portion of formative weight (e.g. 20 pts)
        const scaled = (rawScore / examMaxScore) * midtermTargetWeight;
        const clampedMidterm = Math.min(midtermTargetWeight, Math.max(0, Math.round(scaled * 10) / 10));
        // If mode is add, add to existing non-exam formative points; else set/update
        if (body.mode === 'add') {
          newFormativeScore = Math.min(formativeMax, Math.round((newFormativeScore + clampedMidterm) * 10) / 10);
        } else {
          newFormativeScore = Math.min(formativeMax, clampedMidterm);
        }
      } else {
        // Quiz / Unit test (e.g. 10 pts)
        const quizTarget = Number(body.target_weight) || 10;
        const scaled = (rawScore / examMaxScore) * quizTarget;
        const clampedQuiz = Math.min(quizTarget, Math.max(0, Math.round(scaled * 10) / 10));
        newFormativeScore = Math.min(formativeMax, Math.round((newFormativeScore + clampedQuiz) * 10) / 10);
      }

      const isAbsent = Boolean(sub.total_score === null || existing.is_absent || existing.final_grade === 'ขส');
      const isIncomplete = Boolean(existing.is_incomplete || existing.final_grade === 'ร');
      const isNoExam = Boolean(existing.final_grade === 'มส');

      const attendedHours = Number(existing.attendance_hours ?? courseHours);
      const totalCourseHours = Number(existing.total_course_hours ?? courseHours);

      const calc = evaluateStudentCourseResult({
        formativeScore: newFormativeScore,
        examScore: newExamScore,
        attendedHours,
        totalCourseHours,
        isAbsentFromExam: isAbsent,
        isIncompleteWork: isIncomplete,
        isRemedial: existing.is_remedial || false,
        remedialScore: existing.remedial_score
      });

      const calculatedGrade = isNoExam ? 'มส' : calc.finalGrade;

      await supabase
        .from('academic_student_grades')
        .update({
          formative_score: newFormativeScore,
          exam_score: newExamScore,
          total_score: calc.totalScore,
          final_grade: calculatedGrade,
          attendance_hours: attendedHours,
          total_course_hours: totalCourseHours,
          attendance_percent: calc.attendancePercent,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);

      syncedCount++;
    }

    const typeLabelTh = examType === 'final'
      ? `สอบปลายภาค (สัดส่วน ${examMax} คะแนน)`
      : examType === 'midterm'
      ? `สอบกลางภาค (สัดส่วน ${midtermTargetWeight} คะแนน)`
      : `แบบทดสอบ (${examType})`;

    return NextResponse.json({
      success: true,
      synced_count: syncedCount,
      target_weight: examType === 'final' ? examMax : midtermTargetWeight,
      message: `ซิงค์และคำนวณสัดส่วนคะแนน${typeLabelTh} เข้าเล่ม ปพ.5 เรียบร้อยแล้ว ${syncedCount} คน พร้อมตัดเกรดอัตโนมัติ`
    });
  } catch (error: any) {
    console.error('Error syncing exam scores to gradebook:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
