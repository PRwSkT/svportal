import { createClient } from '@/lib/supabase/client';
import { 
  AcademicClass, 
  AcademicCourse, 
  AcademicGradebook, 
  AcademicStudentGrade, 
  AcademicEarlyYearsEvaluation,
  ApprovalStatus 
} from '@/types/academic';
import { evaluateStudentCourseResult } from './calculation';

// -----------------------------------------------------------------------------
// Classes & Courses
// -----------------------------------------------------------------------------

export async function getAcademicClasses(year?: string, department?: string): Promise<AcademicClass[]> {
  const supabase = createClient();
  let query = supabase
    .from('academic_classes')
    .select(`
      *,
      actual_homeroom_teacher:personnel!academic_classes_actual_homeroom_teacher_id_fkey(id, name_th, position_th, image_url),
      assistant_homeroom_teacher:personnel!academic_classes_assistant_homeroom_teacher_id_fkey(id, name_th, position_th, image_url),
      opec_homeroom_teacher:personnel!academic_classes_opec_homeroom_teacher_id_fkey(id, name_th, position_th)
    `)
    .order('name', { ascending: true });

  if (year) query = query.eq('academic_year', year);
  if (department) query = query.eq('department', department);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as AcademicClass[];
}

export async function getAcademicCourses(year?: string, department?: string): Promise<AcademicCourse[]> {
  const supabase = createClient();
  let query = supabase
    .from('academic_courses')
    .select('*')
    .order('course_code', { ascending: true });

  if (year) query = query.eq('academic_year', year);
  if (department) query = query.eq('department', department);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as AcademicCourse[];
}

export async function createAcademicClass(classData: Partial<AcademicClass>): Promise<AcademicClass> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('academic_classes')
    .insert([classData])
    .select()
    .single();

  if (error) throw error;
  return data as AcademicClass;
}

export async function createAcademicCourse(courseData: Partial<AcademicCourse>): Promise<AcademicCourse> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('academic_courses')
    .insert([courseData])
    .select()
    .single();

  if (error) throw error;
  return data as AcademicCourse;
}

// -----------------------------------------------------------------------------
// Gradebooks & Grades
// -----------------------------------------------------------------------------

export async function getGradebooks(params?: {
  classId?: string;
  teacherId?: string;
  department?: string;
  status?: string;
}): Promise<AcademicGradebook[]> {
  const supabase = createClient();
  let query = supabase
    .from('academic_gradebooks')
    .select(`
      *,
      class:academic_classes(*),
      course:academic_courses(*),
      actual_teacher:personnel!academic_gradebooks_actual_teacher_id_fkey(id, name_th, email, position_th),
      opec_teacher:personnel!academic_gradebooks_opec_teacher_id_fkey(id, name_th, position_th)
    `)
    .order('created_at', { ascending: false });

  if (params?.classId) query = query.eq('class_id', params.classId);
  if (params?.teacherId) query = query.eq('actual_teacher_id', params.teacherId);
  if (params?.status) query = query.eq('approval_status', params.status);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as AcademicGradebook[];
}

export async function getGradebookWithGrades(gradebookId: string): Promise<{
  gradebook: AcademicGradebook;
  grades: AcademicStudentGrade[];
}> {
  const supabase = createClient();
  
  // 1. Fetch gradebook metadata
  const { data: gradebook, error: gbError } = await supabase
    .from('academic_gradebooks')
    .select(`
      *,
      class:academic_classes(*),
      course:academic_courses(*),
      actual_teacher:personnel!academic_gradebooks_actual_teacher_id_fkey(id, name_th, email)
    `)
    .eq('id', gradebookId)
    .single();

  if (gbError) throw gbError;

  // 2. Fetch existing student grades or initialize from class enrollment
  const { data: existingGrades, error: gError } = await supabase
    .from('academic_student_grades')
    .select(`
      *,
      student:students(id, name, first_name, last_name, status)
    `)
    .eq('gradebook_id', gradebookId)
    .order('student_id', { ascending: true });

  if (gError) throw gError;

  return {
    gradebook: gradebook as AcademicGradebook,
    grades: (existingGrades || []) as AcademicStudentGrade[]
  };
}

/**
 * Auto-save student grades in bulk with instant calculation
 */
export async function saveBatchStudentGrades(
  gradebookId: string,
  gradeRecords: Array<{
    student_id: string;
    formative_score: number;
    exam_score: number;
    attended_hours?: number;
    total_course_hours?: number;
    is_absent?: boolean;
    is_incomplete?: boolean;
    is_remedial?: boolean;
    remedial_score?: number | null;
  }>
): Promise<{ success: boolean; updatedCount: number }> {
  const supabase = createClient();

  const updates = gradeRecords.map(r => {
    const result = evaluateStudentCourseResult({
      formativeScore: Number(r.formative_score) || 0,
      examScore: Number(r.exam_score) || 0,
      attendedHours: Number(r.attended_hours) || 40,
      totalCourseHours: Number(r.total_course_hours) || 40,
      isAbsentFromExam: r.is_absent,
      isIncompleteWork: r.is_incomplete,
      isRemedial: r.is_remedial,
      remedialScore: r.remedial_score
    });

    return {
      gradebook_id: gradebookId,
      student_id: r.student_id,
      formative_score: Number(r.formative_score) || 0,
      exam_score: Number(r.exam_score) || 0,
      total_score: result.totalScore,
      final_grade: result.finalGrade,
      attendance_hours: Number(r.attended_hours) || 40,
      total_course_hours: Number(r.total_course_hours) || 40,
      attendance_percent: result.attendancePercent,
      is_remedial: r.is_remedial || false,
      remedial_score: r.remedial_score || null,
      remedial_grade: r.is_remedial ? result.finalGrade : null,
      updated_at: new Date().toISOString()
    };
  });

  const { error } = await supabase
    .from('academic_student_grades')
    .upsert(updates, { onConflict: 'gradebook_id, student_id' });

  if (error) throw error;
  return { success: true, updatedCount: updates.length };
}

// -----------------------------------------------------------------------------
// 3-Tier Approval Workflow
// -----------------------------------------------------------------------------

/**
 * Pre-flight Audit: ตรวจสอบความผิดพลาดก่อนครูกดส่งตรวจทาน
 */
export async function runPreflightGradebookAudit(gradebookId: string): Promise<{
  isValid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalStudents: number;
    gradedCount: number;
    failingCount: number;
    msCount: number;
    averageScore: number;
  };
}> {
  const { grades } = await getGradebookWithGrades(gradebookId);
  const errors: string[] = [];
  const warnings: string[] = [];

  let sumScore = 0;
  let gradedCount = 0;
  let failingCount = 0;
  let msCount = 0;

  if (grades.length === 0) {
    errors.push('ไม่มีรายชื่อนักเรียนในเล่ม ปพ.5 นี้');
  }

  for (const g of grades) {
    if (g.total_score === null || g.total_score === undefined) {
      errors.push(`นักเรียนรหัส ${g.student_id} (${g.student?.name || ''}) ยังไม่ได้บันทึกคะแนน`);
    } else {
      gradedCount++;
      sumScore += g.total_score;
      if (g.total_score > 100) {
        errors.push(`นักเรียนรหัส ${g.student_id} คะแนนรวมเกิน 100 (${g.total_score})`);
      }
    }

    if (g.final_grade === '0') failingCount++;
    if (g.final_grade === 'มส') msCount++;
    if (g.attendance_percent < 80 && g.final_grade !== 'มส') {
      errors.push(`นักเรียนรหัส ${g.student_id} เวลาเรียนไม่ถึง 80% แต่ยังไม่ได้ปรับสถานะเป็น มส`);
    }
  }

  const avg = gradedCount > 0 ? Math.round((sumScore / gradedCount) * 10) / 10 : 0;

  if (failingCount > grades.length * 0.4 && grades.length > 5) {
    warnings.push(`มีนักเรียนได้เกรด 0 สูงถึง ${failingCount} คน (${Math.round((failingCount / grades.length) * 100)}%) เกินเกณฑ์ปกติ`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    stats: {
      totalStudents: grades.length,
      gradedCount,
      failingCount,
      msCount,
      averageScore: avg
    }
  };
}

export async function submitGradebookForReview(gradebookId: string): Promise<boolean> {
  const audit = await runPreflightGradebookAudit(gradebookId);
  if (!audit.isValid) {
    throw new Error(`ไม่สามารถส่งตรวจทานได้เนื่องจากพบข้อผิดพลาด: ${audit.errors.join(', ')}`);
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('academic_gradebooks')
    .update({
      approval_status: 'SUBMITTED_TO_HEAD',
      submitted_at: new Date().toISOString()
    })
    .eq('id', gradebookId);

  if (error) throw error;
  return true;
}

export async function reviewGradebook(params: {
  gradebookId: string;
  reviewerId: string;
  action: 'approve_head' | 'reject_head' | 'approve_director' | 'reject_director';
  notes?: string;
}): Promise<boolean> {
  const supabase = createClient();
  const { gradebookId, reviewerId, action, notes } = params;

  let updates: Partial<AcademicGradebook> = {
    updated_at: new Date().toISOString()
  };

  if (action === 'approve_head') {
    updates = {
      ...updates,
      approval_status: 'APPROVED_BY_HEAD',
      head_reviewer_id: reviewerId,
      head_approved_at: new Date().toISOString(),
      head_review_notes: notes || null
    };
  } else if (action === 'reject_head') {
    updates = {
      ...updates,
      approval_status: 'REVISION_REQUESTED',
      head_reviewer_id: reviewerId,
      head_review_notes: notes || 'ส่งกลับเพื่อแก้ไขข้อมูล'
    };
  } else if (action === 'approve_director') {
    updates = {
      ...updates,
      approval_status: 'OFFICIALLY_LOCKED',
      director_reviewer_id: reviewerId,
      director_approved_at: new Date().toISOString(),
      director_review_notes: notes || null
    };
  } else if (action === 'reject_director') {
    updates = {
      ...updates,
      approval_status: 'REVISION_REQUESTED',
      director_reviewer_id: reviewerId,
      director_review_notes: notes || 'ผู้อำนวยการส่งกลับเพื่อแก้ไข'
    };
  }

  const { error } = await supabase
    .from('academic_gradebooks')
    .update(updates)
    .eq('id', gradebookId);

  if (error) throw error;
  return true;
}

// -----------------------------------------------------------------------------
// Early Years (Kindergarten)
// -----------------------------------------------------------------------------

export async function getEarlyYearsEvaluations(classId: string, term: string = '1'): Promise<AcademicEarlyYearsEvaluation[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('academic_early_years_evaluations')
    .select(`
      *,
      student:students(id, name, first_name, last_name, status)
    `)
    .eq('class_id', classId)
    .eq('term', term)
    .order('student_id', { ascending: true });

  if (error) throw error;
  return (data || []) as AcademicEarlyYearsEvaluation[];
}

export async function saveEarlyYearsEvaluations(evaluations: Partial<AcademicEarlyYearsEvaluation>[]): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from('academic_early_years_evaluations')
    .upsert(evaluations, { onConflict: 'class_id, student_id, term' });

  if (error) throw error;
  return true;
}
