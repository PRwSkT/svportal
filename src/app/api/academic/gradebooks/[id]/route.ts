import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { evaluateStudentCourseResult } from '@/lib/academic/calculation';
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

    // 1. Fetch Gradebook with relations
    const { data: gradebook, error: gbErr } = await supabase
      .from('academic_gradebooks')
      .select(`
        *,
        class:academic_classes!academic_gradebooks_class_id_fkey(*),
        course:academic_courses!academic_gradebooks_course_id_fkey(*),
        actual_teacher:personnel!academic_gradebooks_actual_teacher_id_fkey(id, name_th, email, position_th),
        opec_teacher:personnel!academic_gradebooks_opec_teacher_id_fkey(id, name_th, position_th)
      `)
      .eq('id', id)
      .single();

    if (gbErr) throw gbErr;

    // 2. Fetch Grades joined with Student Records and roll number from enrollments
    const { data: grades, error: gErr } = await supabase
      .from('academic_student_grades')
      .select(`
        *,
        student:students(id, name, first_name, last_name, status, citizen_id)
      `)
      .eq('gradebook_id', id);

    if (gErr) throw gErr;

    // Fetch roll numbers
    const { data: enrollments } = await supabase
      .from('academic_class_enrollments')
      .select('student_id, roll_number')
      .eq('class_id', gradebook.class_id);

    const rollMap = new Map((enrollments || []).map(e => [e.student_id, e.roll_number]));

    const sortedGrades = (grades || []).map(g => ({
      ...g,
      roll_number: rollMap.get(g.student_id) || 0
    })).sort((a, b) => (a.roll_number || 0) - (b.roll_number || 0) || a.student_id.localeCompare(b.student_id));

    return NextResponse.json({
      gradebook,
      grades: sortedGrades
    });
  } catch (error: any) {
    console.error('Error fetching gradebook detail:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// Auto-save & Batch Update Scores
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('teacher', 'academic_hub');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await params;
    const supabase = getAdminClient();

    // Verify gradebook is not locked
    const { data: gb } = await supabase.from('academic_gradebooks').select('approval_status').eq('id', id).single();
    if (gb && (gb.approval_status === 'APPROVED_BY_HEAD' || gb.approval_status === 'OFFICIALLY_LOCKED')) {
      return NextResponse.json({ error: 'ไม่สามารถแก้ไขคะแนนได้เนื่องจากเล่ม ปพ.5 ได้รับการอนุมัติหรือล็อกอย่างเป็นทางการแล้ว' }, { status: 403 });
    }

    const body = await req.json();
    const { records } = body; // Array of student grade records

    if (!Array.isArray(records)) {
      return NextResponse.json({ error: 'Expected records array' }, { status: 400 });
    }

    const updates = records.map((r: any) => {
      const formative = Number(r.formative_score) || 0;
      const exam = Number(r.exam_score) || 0;
      const attended = Number(r.attendance_hours ?? 40);
      const totalHours = Number(r.total_course_hours ?? 40);

      const isAbsent = Boolean(r.is_absent || r.final_grade === 'ขส');
      const isIncomplete = Boolean(r.is_incomplete || r.final_grade === 'ร');
      const isNoExam = Boolean(r.final_grade === 'มส');

      const result = evaluateStudentCourseResult({
        formativeScore: formative,
        examScore: exam,
        attendedHours: attended,
        totalCourseHours: totalHours,
        isAbsentFromExam: isAbsent,
        isIncompleteWork: isIncomplete,
        isRemedial: r.is_remedial || false,
        remedialScore: r.remedial_score ? Number(r.remedial_score) : null
      });

      const calculatedFinalGrade = isNoExam ? 'มส' : result.finalGrade;

      return {
        gradebook_id: id,
        student_id: r.student_id,
        formative_score: formative,
        exam_score: exam,
        total_score: result.totalScore,
        final_grade: calculatedFinalGrade,
        attendance_hours: attended,
        total_course_hours: totalHours,
        attendance_percent: result.attendancePercent,
        is_remedial: r.is_remedial || false,
        remedial_score: r.remedial_score ? Number(r.remedial_score) : null,
        remedial_grade: r.is_remedial ? result.finalGrade : null,
        updated_at: new Date().toISOString()
      };
    });

    const { error: upsertErr } = await supabase
      .from('academic_student_grades')
      .upsert(updates, { onConflict: 'gradebook_id, student_id' });

    if (upsertErr) throw upsertErr;

    return NextResponse.json({
      success: true,
      updatedCount: updates.length
    });
  } catch (error: any) {
    console.error('Error saving student grades:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// Workflow Actions: Preflight, Submit, Head Review, Director Review
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
    const { action, notes, reviewer_id } = body;

      // 1. Fetch current gradebook and grades with relations
      const { data: gradebook, error: gbErr } = await supabase
        .from('academic_gradebooks')
        .select(`
          *,
          class:academic_classes(name),
          course:academic_courses(name_th),
          actual_teacher:personnel!academic_gradebooks_actual_teacher_id_fkey(name_th, user_id)
        `)
        .eq('id', id)
        .single();

      if (gbErr) throw gbErr;

      const { data: grades } = await supabase
        .from('academic_student_grades')
        .select('*, student:students(name)')
        .eq('gradebook_id', id);

      const studentList = grades || [];

      // Pre-flight Audit Logic
      const errors: string[] = [];
      const warnings: string[] = [];
      let gradedCount = 0;
      let failingCount = 0;
      let msCount = 0;
      let totalScoreSum = 0;

      if (studentList.length === 0) {
        errors.push('ไม่มีรายชื่อนักเรียนในเล่ม ปพ.5 นี้');
      }

      for (const g of studentList) {
        if (g.total_score === null || g.total_score === undefined) {
          errors.push(`นักเรียนรหัส ${g.student_id} (${g.student?.name || ''}) ยังไม่ได้บันทึกคะแนน`);
        } else {
          gradedCount++;
          totalScoreSum += g.total_score;
        }
        if (g.final_grade === '0') failingCount++;
        if (g.final_grade === 'มส') msCount++;
        if (g.attendance_percent < 80 && g.final_grade !== 'มส') {
          errors.push(`นักเรียนรหัส ${g.student_id} เวลาเรียนไม่ถึง 80% (${g.attendance_percent}%) แต่ยังไม่ได้ปรับสถานะเป็น มส`);
        }
      }

      const avgScore = gradedCount > 0 ? Math.round((totalScoreSum / gradedCount) * 10) / 10 : 0;

      if (failingCount > studentList.length * 0.4 && studentList.length > 5) {
        warnings.push(`มีนักเรียนได้เกรด 0 สูงถึง ${failingCount} คน (${Math.round((failingCount / studentList.length) * 100)}%) เกินเกณฑ์ปกติ`);
      }

      // Action: Pre-flight Audit only
      if (action === 'preflight') {
        return NextResponse.json({
          isValid: errors.length === 0,
          errors,
          warnings,
          stats: {
            totalStudents: studentList.length,
            gradedCount,
            failingCount,
            msCount,
            averageScore: avgScore
          }
        });
      }

      // Import notification helpers
      const {
        notifyGradebookSubmitted,
        notifyGradebookApprovedByHead,
        notifyGradebookRevisionRequested,
        notifyGradebookOfficiallyLocked
      } = await import('@/lib/academic/notifications');

      const courseName = gradebook.course?.name_th || 'วิชา';
      const className = gradebook.class?.name || 'ห้องเรียน';
      const teacherName = gradebook.actual_teacher?.name_th || 'ครูผู้สอน';
      const teacherUserId = gradebook.actual_teacher?.user_id;

      // Action: Submit for Review
      if (action === 'submit') {
        if (errors.length > 0) {
          return NextResponse.json({
            success: false,
            error: `ไม่สามารถส่งตรวจทานได้เนื่องจากพบข้อผิดพลาด: ${errors.join(', ')}`,
            errors
          }, { status: 400 });
        }

        const { error: subErr } = await supabase
          .from('academic_gradebooks')
          .update({
            approval_status: 'SUBMITTED_TO_HEAD',
            submitted_at: new Date().toISOString()
          })
          .eq('id', id);

        if (subErr) throw subErr;

        // Dispatch notification to Department Heads
        notifyGradebookSubmitted({
          gradebookId: id,
          courseName,
          className,
          teacherName
        }).catch(e => console.error('Notification error:', e));

        return NextResponse.json({ success: true, message: 'ส่งผลการเรียนให้หัวหน้าแผนกตรวจทานเรียบร้อยแล้ว' });
      }

      // Action: Head Approval / Rejection
      if (action === 'approve_head') {
        const { error } = await supabase
          .from('academic_gradebooks')
          .update({
            approval_status: 'APPROVED_BY_HEAD',
            head_reviewer_id: reviewer_id || null,
            head_approved_at: new Date().toISOString(),
            head_review_notes: notes || 'อนุมัติการตรวจทานชั้นต้น'
          })
          .eq('id', id);

        if (error) throw error;

        // Notify Director
        notifyGradebookApprovedByHead({
          gradebookId: id,
          courseName,
          className,
          headName: 'หัวหน้าแผนกวิชาการ'
        }).catch(e => console.error('Notification error:', e));

        return NextResponse.json({ success: true, message: 'หัวหน้าแผนกอนุมัติเรียบร้อย และส่งต่อไปยังผู้อำนวยการแล้ว' });
      }

      if (action === 'reject_head') {
        const { error } = await supabase
          .from('academic_gradebooks')
          .update({
            approval_status: 'REVISION_REQUESTED',
            head_reviewer_id: reviewer_id || null,
            head_review_notes: notes || 'ส่งกลับเพื่อแก้ไข'
          })
          .eq('id', id);

        if (error) throw error;

        // Notify Teacher with feedback
        notifyGradebookRevisionRequested({
          gradebookId: id,
          teacherUserId,
          courseName,
          className,
          reviewerRoleName: 'หัวหน้าแผนกวิชาการ',
          notes: notes || 'กรุณาตรวจสอบและปรับปรุงคะแนนตามข้อเสนอแนะ'
        }).catch(e => console.error('Notification error:', e));

        return NextResponse.json({ success: true, message: 'ส่งผลการเรียนกลับไปให้ครูผู้สอนแก้ไขแล้ว' });
      }

      // Action: Director Approval / Rejection
      if (action === 'approve_director') {
        const { error } = await supabase
          .from('academic_gradebooks')
          .update({
            approval_status: 'OFFICIALLY_LOCKED',
            director_reviewer_id: reviewer_id || null,
            director_approved_at: new Date().toISOString(),
            director_review_notes: notes || 'อนุมัติขั้นสุดท้ายและล็อกผลการเรียน'
          })
          .eq('id', id);

        if (error) throw error;

        // Notify Teacher of Final Lock
        notifyGradebookOfficiallyLocked({
          gradebookId: id,
          teacherUserId,
          courseName,
          className
        }).catch(e => console.error('Notification error:', e));

        return NextResponse.json({ success: true, message: 'ผู้อำนวยการอนุมัติขั้นสุดท้ายเรียบร้อยแล้ว ผลการเรียนถูกล็อกถาวร' });
      }

      if (action === 'reject_director') {
        const { error } = await supabase
          .from('academic_gradebooks')
          .update({
            approval_status: 'REVISION_REQUESTED',
            director_reviewer_id: reviewer_id || null,
            director_review_notes: notes || 'ผู้อำนวยการส่งกลับเพื่อแก้ไข'
          })
          .eq('id', id);

        if (error) throw error;

        // Notify Teacher
        notifyGradebookRevisionRequested({
          gradebookId: id,
          teacherUserId,
          courseName,
          className,
          reviewerRoleName: 'ผู้อำนวยการ',
          notes: notes || 'กรุณาตรวจสอบและแก้ไขข้อมูลก่อนส่งอนุมัติอีกครั้ง'
        }).catch(e => console.error('Notification error:', e));

        return NextResponse.json({ success: true, message: 'ผู้อำนวยการส่งกลับเพื่อแก้ไข' });
      }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error processing gradebook action:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
