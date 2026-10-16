export type AcademicDepartment = 'kindergarten' | 'primary';

export type GradeLevel = 'K1' | 'K2' | 'K3' | 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6';

export type CourseType = 'basic' | 'additional' | 'activity' | 'development';

export type ApprovalStatus = 
  | 'DRAFT' 
  | 'SUBMITTED_TO_HEAD' 
  | 'APPROVED_BY_HEAD' 
  | 'REVISION_REQUESTED' 
  | 'OFFICIALLY_LOCKED';

export type FinalGradeValue = 
  | '4' | '3.5' | '3' | '2.5' | '2' | '1.5' | '1' | '0' 
  | 'ร' | 'มส' | 'ขส' | 'ผ' | 'มผ';

export type EarlyYearsScore = 1 | 2 | 3;

export interface AcademicYear {
  year: string; // e.g. '2568'
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  created_at: string;
}

export interface AcademicTerm {
  id: string;
  academic_year: string;
  term: string; // '1', '2', 'full_year'
  is_current: boolean;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export interface AcademicCourse {
  id: string;
  course_code: string;
  name_th: string;
  name_en: string | null;
  department: AcademicDepartment;
  grade_level: GradeLevel;
  subject_group: string;
  course_type: CourseType;
  annual_hours: number;
  credits: number;
  academic_year: string;
  
  // Dual-Layer Fields for OPEC (สช.)
  is_reported_to_opec: boolean;
  show_on_parent_report: boolean;
  opec_course_code: string | null;
  
  created_at: string;
  updated_at: string;
}

export interface AcademicClass {
  id: string;
  name: string; // e.g. 'ป.3/1', 'อ.1/1'
  department: AcademicDepartment;
  grade_level: GradeLevel;
  academic_year: string;
  actual_homeroom_teacher_id: string | null;
  assistant_homeroom_teacher_id: string | null;
  
  // Dual-Layer Fields for OPEC (สช.)
  opec_room_name: string; // e.g. 'ป.3'
  opec_homeroom_teacher_id: string | null;
  
  // Joined personnel fields
  actual_homeroom_teacher?: {
    id: string;
    name_th: string;
    position_th: string;
    image_url: string | null;
  } | null;
  
  created_at: string;
  updated_at: string;
}

export interface AcademicClassEnrollment {
  id: string;
  class_id: string;
  student_id: string;
  roll_number: number | null;
  status: 'active' | 'transferred' | 'graduated' | 'dropped';
  created_at: string;
  
  // Joined student
  student?: {
    id: string;
    name: string;
    first_name?: string | null;
    last_name?: string | null;
    gender?: string | null;
    status: string;
  };
}

export interface AcademicGradebook {
  id: string;
  class_id: string;
  course_id: string;
  actual_teacher_id: string | null;
  opec_teacher_id: string | null;
  term: string;
  
  formative_weight: number; // e.g. 70
  summative_weight: number; // e.g. 30
  
  approval_status: ApprovalStatus;
  submitted_at: string | null;
  head_approved_at: string | null;
  head_reviewer_id: string | null;
  head_review_notes: string | null;
  director_approved_at: string | null;
  director_reviewer_id: string | null;
  director_review_notes: string | null;
  
  // Joined relations
  class?: AcademicClass;
  course?: AcademicCourse;
  actual_teacher?: {
    id: string;
    name_th: string;
    email?: string | null;
  };
  
  created_at: string;
  updated_at: string;
}

export interface AcademicStudentGrade {
  id: string;
  gradebook_id: string;
  student_id: string;
  formative_score: number;
  exam_score: number;
  total_score: number;
  final_grade: FinalGradeValue | null;
  
  attendance_hours: number;
  total_course_hours: number;
  attendance_percent: number;
  
  is_remedial: boolean;
  remedial_score: number | null;
  remedial_grade: string | null;
  remedial_date: string | null;
  remedial_notes: string | null;
  
  // Joined student
  student?: {
    id: string;
    name: string;
    first_name?: string | null;
    last_name?: string | null;
  };
  
  created_at: string;
  updated_at: string;
}

export interface AcademicEarlyYearsEvaluation {
  id: string;
  class_id: string;
  student_id: string;
  term: string;
  
  physical_score: EarlyYearsScore | null;
  emotional_score: EarlyYearsScore | null;
  social_score: EarlyYearsScore | null;
  intellectual_score: EarlyYearsScore | null;
  
  weight_kg: number | null;
  height_cm: number | null;
  growth_status: string | null;
  milk_drinking: string | null;
  nap_habit: string | null;
  hygiene_score: EarlyYearsScore | null;
  
  teacher_comment: string | null;
  ai_comment_suggestions: string[] | null;
  
  approval_status: ApprovalStatus;
  
  // Joined student
  student?: {
    id: string;
    name: string;
  };
  
  created_at: string;
  updated_at: string;
}

export interface TeacherCompetency {
  id: string;
  teacher_id: string;
  eligible_subject_groups: string[];
  eligible_grade_levels: string[];
  target_weekly_hours: number;
  max_weekly_hours: number;
  unavailable_slots?: string[];
  is_active: boolean;
  created_at: string;
}

export interface TimetableSlot {
  id: string;
  academic_year: string;
  term: string;
  class_id: string;
  course_id: string;
  teacher_id: string;
  day_of_week: number; // 1-5
  period_number: number; // 1-8
  room_name: string | null;
  created_at: string;
}

export interface TimetableScheduleSlot {
  key: string;
  type: 'assembly' | 'period' | 'break' | 'dismissal';
  periodNumber?: number;
  label: string;
  sublabel: string;
  startTime: string;
  endTime: string;
  timeRange: string;
  durationMinutes: number;
  icon?: string;
  breakType?: 'morning_snack' | 'lunch' | 'nap';
}

export interface TeacherSubstitution {
  id: string;
  date: string;
  period_number: number;
  class_id: string;
  course_id: string;
  original_teacher_id: string;
  substitute_teacher_id: string;
  reason: string | null;
  status: 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  assigned_by: string;
  matching_criteria: string | null;
  worksheet_info: string | null;
  created_at: string;
}

export type ExamType = 'midterm' | 'final' | 'quiz' | 'unit_test';
export type ChoiceOption = 'A' | 'B' | 'C' | 'D';

export interface AcademicExam {
  id: string;
  title: string;
  course_id: string;
  gradebook_id: string | null;
  academic_year: string;
  term: string;
  exam_type: ExamType;
  total_questions: number;
  max_score: number;
  duration_minutes: number;
  instructions: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;

  // Joined relations
  course?: AcademicCourse;
  gradebook?: AcademicGradebook;
  creator?: {
    id: string;
    name_th: string;
  };
  questions?: AcademicExamQuestion[];
  sets?: AcademicExamSet[];
  submissions_count?: number;
}

export interface AcademicExamQuestion {
  id: string;
  exam_id: string;
  question_number: number;
  question_text: string;
  question_image_url: string | null;
  choice_a: string;
  choice_b: string;
  choice_c: string;
  choice_d: string;
  correct_choice: ChoiceOption;
  indicator_code: string | null; // e.g. ค 1.1 ป.3/1
  points: number;
  pin_choice_position: boolean; // if true, choice e.g. ถูกทุกข้อ cannot be shuffled
  pinned_choice_index: string | null;
  created_at: string;
}

export interface ExamQuestionOrderMapping {
  original_question_number: number;
  new_question_number: number;
  choice_map: Record<ChoiceOption, ChoiceOption>; // e.g. { A: 'C', B: 'A', C: 'D', D: 'B' }
}

export interface AcademicExamSet {
  id: string;
  exam_id: string;
  set_name: 'A' | 'B' | 'C' | 'D';
  question_order_mapping: ExamQuestionOrderMapping[];
  answer_key: Record<string, ChoiceOption>; // e.g. { "1": "C", "2": "A", ... }
  created_at: string;
}

export interface AcademicExamSubmission {
  id: string;
  exam_id: string;
  student_id: string;
  set_name: string;
  student_answers: Record<string, ChoiceOption>; // { "1": "A", "2": "B", ... }
  raw_score: number;
  total_score: number;
  status: 'GRADED' | 'FLAGGED_AMBIGUOUS' | 'MANUAL_OVERRIDE';
  is_damaged_or_spill: boolean;
  manual_override: boolean;
  override_reason: string | null;
  scanned_image_url: string | null;
  scanned_at: string;
  created_at: string;
  updated_at: string;

  // Joined relations
  student?: {
    id: string;
    name: string;
    first_name?: string | null;
    last_name?: string | null;
    citizen_id?: string | null;
  };
}

export interface OMRQuestionScanResult {
  questionNumber: number;
  selectedChoice: ChoiceOption | null;
  confidence: number;
  densities: Record<ChoiceOption, number>;
  isAmbiguous: boolean; // ghost mark / multiple marks
}

export interface OMRSheetScanResult {
  examId: string;
  studentId: string;
  setName: string;
  answers: Record<string, ChoiceOption>;
  flaggedAmbiguousQuestions: number[];
  isDamagedOrSpill: boolean;
  rawScore: number;
  totalScore: number;
}

