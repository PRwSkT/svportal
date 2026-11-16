-- =============================================================================
-- SVPortal Phase 10: Academic Affairs & Measurement Foundation (Dual-Layer Engine)
-- Description: Complete academic schema supporting Pre-K to P.6, 3-Tier Approval,
--              OPEC (สช.) Dual-Layer mapping, and Smart Timetable Constraints.
-- =============================================================================

-- 1. Academic Years Table
CREATE TABLE IF NOT EXISTS public.academic_years (
  year text PRIMARY KEY,                       -- e.g. '2568'
  start_date date,
  end_date date,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Academic Terms Table
CREATE TABLE IF NOT EXISTS public.academic_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year text NOT NULL REFERENCES public.academic_years(year) ON DELETE CASCADE,
  term text NOT NULL,                          -- '1', '2', or 'full_year'
  is_current boolean NOT NULL DEFAULT false,
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_academic_year_term UNIQUE(academic_year, term)
);

-- 3. Academic Courses (รายวิชา / ขอบข่ายการเรียนรู้)
CREATE TABLE IF NOT EXISTS public.academic_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_code text NOT NULL,                   -- e.g. 'ท13101', 'MA13101'
  name_th text NOT NULL,                       -- e.g. 'ภาษาไทย 3', 'คณิตศาสตร์ (MEP)'
  name_en text,
  department text NOT NULL CHECK (department IN ('kindergarten', 'primary')),
  grade_level text NOT NULL,                   -- 'K1','K2','K3','P1','P2','P3','P4','P5','P6'
  subject_group text NOT NULL,                 -- 8 กลุ่มสาระฯ or 'พัฒนาการ 4 ด้าน' or 'กิจกรรมพัฒนาผู้เรียน'
  course_type text NOT NULL DEFAULT 'basic' CHECK (course_type IN ('basic', 'additional', 'activity', 'development')),
  annual_hours integer NOT NULL DEFAULT 40,
  credits numeric(3,1) NOT NULL DEFAULT 1.0,
  academic_year text NOT NULL REFERENCES public.academic_years(year) ON DELETE CASCADE,
  
  -- Dual-Layer Fields for OPEC (สช.)
  is_reported_to_opec boolean NOT NULL DEFAULT true, -- Set false for Mathematics (MEP)
  show_on_parent_report boolean NOT NULL DEFAULT true,
  opec_course_code text,                       -- Code expected by REGIS สช.
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_course_code_year UNIQUE(course_code, academic_year)
);

-- 4. Academic Classes (ห้องเรียน)
CREATE TABLE IF NOT EXISTS public.academic_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,                          -- e.g. 'ป.3/1', 'ป.3/2', 'อ.1/1'
  department text NOT NULL CHECK (department IN ('kindergarten', 'primary')),
  grade_level text NOT NULL,                   -- 'K1','K2','K3','P1','P2','P3','P4','P5','P6'
  academic_year text NOT NULL REFERENCES public.academic_years(year) ON DELETE CASCADE,
  actual_homeroom_teacher_id uuid REFERENCES public.personnel(id) ON DELETE SET NULL,
  assistant_homeroom_teacher_id uuid REFERENCES public.personnel(id) ON DELETE SET NULL,
  
  -- Dual-Layer Fields for OPEC (สช.)
  opec_room_name text NOT NULL DEFAULT 'ป.3',  -- Maps 'ป.3/1' and 'ป.3/2' into 'ป.3' in REGIS
  opec_homeroom_teacher_id uuid REFERENCES public.personnel(id) ON DELETE SET NULL,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_class_name_year UNIQUE(name, academic_year)
);

-- 5. Academic Class Enrollments (การลงทะเบียนนักเรียนในห้อง)
CREATE TABLE IF NOT EXISTS public.academic_class_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.academic_classes(id) ON DELETE CASCADE,
  student_id text NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  roll_number integer,                         -- เลขที่
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'transferred', 'graduated', 'dropped')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_class_student UNIQUE(class_id, student_id),
  CONSTRAINT uq_class_roll_number UNIQUE(class_id, roll_number)
);

-- 6. Academic Gradebooks (สมุด ปพ.5 ดิจิทัล และสายการอนุมัติ 3 ระดับ)
CREATE TABLE IF NOT EXISTS public.academic_gradebooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.academic_classes(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.academic_courses(id) ON DELETE CASCADE,
  actual_teacher_id uuid REFERENCES public.personnel(id) ON DELETE SET NULL,
  opec_teacher_id uuid REFERENCES public.personnel(id) ON DELETE SET NULL,
  term text NOT NULL DEFAULT 'full_year',
  
  formative_weight numeric(5,2) NOT NULL DEFAULT 70.00 CHECK (formative_weight >= 0 AND formative_weight <= 100),
  summative_weight numeric(5,2) NOT NULL DEFAULT 30.00 CHECK (summative_weight >= 0 AND summative_weight <= 100),
  
  -- 3-Tier Approval Workflow
  approval_status text NOT NULL DEFAULT 'DRAFT' 
    CHECK (approval_status IN ('DRAFT', 'SUBMITTED_TO_HEAD', 'APPROVED_BY_HEAD', 'REVISION_REQUESTED', 'OFFICIALLY_LOCKED')),
  submitted_at timestamptz,
  head_approved_at timestamptz,
  head_reviewer_id uuid REFERENCES public.personnel(id) ON DELETE SET NULL,
  head_review_notes text,
  director_approved_at timestamptz,
  director_reviewer_id uuid REFERENCES public.personnel(id) ON DELETE SET NULL,
  director_review_notes text,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_gradebook_class_course_term UNIQUE(class_id, course_id, term)
);

-- 7. Academic Student Grades (คะแนนและผลการเรียนรายบุคคล)
CREATE TABLE IF NOT EXISTS public.academic_student_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gradebook_id uuid NOT NULL REFERENCES public.academic_gradebooks(id) ON DELETE CASCADE,
  student_id text NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  formative_score numeric(5,2) NOT NULL DEFAULT 0.00 CHECK (formative_score >= 0),
  exam_score numeric(5,2) NOT NULL DEFAULT 0.00 CHECK (exam_score >= 0),
  total_score numeric(5,2) NOT NULL DEFAULT 0.00 CHECK (total_score >= 0 AND total_score <= 100),
  final_grade text,                            -- '4', '3.5', '3', '2.5', '2', '1.5', '1', '0', 'ร', 'มส', 'ขส', 'ผ', 'มผ'
  
  attendance_hours numeric(5,1) NOT NULL DEFAULT 0.0,
  total_course_hours numeric(5,1) NOT NULL DEFAULT 40.0,
  attendance_percent numeric(5,2) NOT NULL DEFAULT 100.00,
  
  -- การสอบซ่อมเสริม / แก้เกรด (Remediation)
  is_remedial boolean NOT NULL DEFAULT false,
  remedial_score numeric(5,2),
  remedial_grade text,                         -- ล็อกไม่เกิน 1 สำหรับแก้ 0 และ มส
  remedial_date date,
  remedial_notes text,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_student_gradebook UNIQUE(gradebook_id, student_id)
);

-- 8. Academic Early Years Evaluations (บันทึกพัฒนาการ 4 ด้าน & โภชนาการปฐมวัย)
CREATE TABLE IF NOT EXISTS public.academic_early_years_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.academic_classes(id) ON DELETE CASCADE,
  student_id text NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  term text NOT NULL DEFAULT '1',
  
  -- พัฒนาการ 4 ด้าน (3=ดี, 2=พอใช้, 1=ควรส่งเสริม)
  physical_score integer CHECK (physical_score BETWEEN 1 AND 3),
  emotional_score integer CHECK (emotional_score BETWEEN 1 AND 3),
  social_score integer CHECK (social_score BETWEEN 1 AND 3),
  intellectual_score integer CHECK (intellectual_score BETWEEN 1 AND 3),
  
  -- โภชนาการและการเจริญเติบโต (เทียบเกณฑ์กรมอนามัย)
  weight_kg numeric(5,2),
  height_cm numeric(5,2),
  growth_status text,                          -- 'สมส่วน', 'เริ่มอ้วน', 'ท้วม', 'ผอม', 'ค่อนข้างเตี้ย', 'สูงตามเกณฑ์'
  milk_drinking text,                          -- 'หมดกล่อง', 'ครึ่งกล่อง', 'ไม่ดื่ม'
  nap_habit text,                              -- 'หลับสนิท', 'หลับยาก', 'ไม่นอน'
  hygiene_score integer CHECK (hygiene_score BETWEEN 1 AND 3),
  
  teacher_comment text,                        -- ความเห็นครูประจำชั้น (AI Co-pilot ช่วยเรียบเรียง)
  ai_comment_suggestions jsonb,
  
  approval_status text NOT NULL DEFAULT 'DRAFT' 
    CHECK (approval_status IN ('DRAFT', 'SUBMITTED_TO_HEAD', 'APPROVED_BY_HEAD', 'OFFICIALLY_LOCKED', 'REVISION_REQUESTED')),
    
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_early_years_student_term UNIQUE(class_id, student_id, term)
);

-- 9. Academic Teacher Competencies (คุณสมบัติและเพดานชั่วโมงสอนของครู)
CREATE TABLE IF NOT EXISTS public.academic_teacher_competencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
  eligible_subject_groups text[] NOT NULL DEFAULT '{}',
  eligible_grade_levels text[] NOT NULL DEFAULT '{}',
  target_weekly_hours integer NOT NULL DEFAULT 18,
  max_weekly_hours integer NOT NULL DEFAULT 22,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_teacher_competency UNIQUE(teacher_id)
);

-- 10. Academic Timetables (ตารางสอน - ป้องกันชั่วโมงชนด้วย Database Constraints)
CREATE TABLE IF NOT EXISTS public.academic_timetables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year text NOT NULL REFERENCES public.academic_years(year) ON DELETE CASCADE,
  term text NOT NULL DEFAULT '1',
  class_id uuid NOT NULL REFERENCES public.academic_classes(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.academic_courses(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 1 AND 5), -- 1=Mon, 5=Fri
  period_number integer NOT NULL CHECK (period_number BETWEEN 1 AND 8),
  room_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- กฎเหล็ก: ห้ามห้องเรียนเดียวกันมี 2 วิชาหรือ 2 ครูในคาบเดียวกัน
  CONSTRAINT uq_timetable_class_slot UNIQUE(academic_year, term, class_id, day_of_week, period_number),
  -- กฎเหล็ก: ห้ามครูคนเดียวกันสอน 2 ห้องในคาบเดียวกัน
  CONSTRAINT uq_timetable_teacher_slot UNIQUE(academic_year, term, teacher_id, day_of_week, period_number)
);

-- 11. Academic Substitutions (การจัดสอนแทนอัจฉริยะเมื่อครูลา)
CREATE TABLE IF NOT EXISTS public.academic_substitutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  period_number integer NOT NULL,
  class_id uuid NOT NULL REFERENCES public.academic_classes(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.academic_courses(id) ON DELETE CASCADE,
  original_teacher_id uuid NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
  substitute_teacher_id uuid NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
  reason text,
  status text NOT NULL DEFAULT 'PROPOSED' CHECK (status IN ('PROPOSED', 'APPROVED', 'REJECTED', 'COMPLETED')),
  assigned_by text NOT NULL DEFAULT 'nongfah_ai',
  matching_criteria text,
  worksheet_info text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Indexes for High Performance Queries
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_courses_year_dept ON public.academic_courses(academic_year, department, grade_level);
CREATE INDEX IF NOT EXISTS idx_classes_year_dept ON public.academic_classes(academic_year, department, grade_level);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON public.academic_class_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_gradebooks_class_course ON public.academic_gradebooks(class_id, course_id);
CREATE INDEX IF NOT EXISTS idx_student_grades_gradebook ON public.academic_student_grades(gradebook_id);
CREATE INDEX IF NOT EXISTS idx_early_years_class_term ON public.academic_early_years_evaluations(class_id, term);
CREATE INDEX IF NOT EXISTS idx_timetables_teacher_slot ON public.academic_timetables(academic_year, term, teacher_id, day_of_week);

-- -----------------------------------------------------------------------------
-- Row Level Security (RLS) Setup
-- -----------------------------------------------------------------------------
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_gradebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_student_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_early_years_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_teacher_competencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_timetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_substitutions ENABLE ROW LEVEL SECURITY;

-- Helper policy: Admin, Executive and Academic Staff have full access
CREATE POLICY "Full access for admin, executive, academic staff"
  ON public.academic_years FOR ALL TO authenticated
  USING (public.get_user_role() IN ('admin', 'executive', 'academic staff'));

CREATE POLICY "Allow authenticated read on academic_years"
  ON public.academic_years FOR SELECT TO authenticated USING (true);

CREATE POLICY "Full access for admin, executive, academic staff on terms"
  ON public.academic_terms FOR ALL TO authenticated
  USING (public.get_user_role() IN ('admin', 'executive', 'academic staff'));

CREATE POLICY "Allow authenticated read on terms"
  ON public.academic_terms FOR SELECT TO authenticated USING (true);

CREATE POLICY "Full access for admin, executive, academic staff on courses"
  ON public.academic_courses FOR ALL TO authenticated
  USING (public.get_user_role() IN ('admin', 'executive', 'academic staff'));

CREATE POLICY "Allow authenticated read on courses"
  ON public.academic_courses FOR SELECT TO authenticated USING (true);

CREATE POLICY "Full access on classes for admin, executive, academic staff"
  ON public.academic_classes FOR ALL TO authenticated
  USING (public.get_user_role() IN ('admin', 'executive', 'academic staff'));

CREATE POLICY "Allow authenticated read on classes"
  ON public.academic_classes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Full access on enrollments for admin, executive, academic staff"
  ON public.academic_class_enrollments FOR ALL TO authenticated
  USING (public.get_user_role() IN ('admin', 'executive', 'academic staff'));

CREATE POLICY "Allow authenticated read on enrollments"
  ON public.academic_class_enrollments FOR SELECT TO authenticated USING (true);

-- Gradebooks & Student Grades Policies
CREATE POLICY "Full access on gradebooks for admin, executive, academic staff"
  ON public.academic_gradebooks FOR ALL TO authenticated
  USING (public.get_user_role() IN ('admin', 'executive', 'academic staff'));

CREATE POLICY "Teachers can view assigned gradebooks"
  ON public.academic_gradebooks FOR SELECT TO authenticated
  USING (
    actual_teacher_id = (SELECT personnel_id FROM public.app_users WHERE id = auth.uid())
    OR public.get_user_role() IN ('admin', 'executive', 'academic staff')
  );

CREATE POLICY "Teachers can update assigned gradebooks if DRAFT"
  ON public.academic_gradebooks FOR UPDATE TO authenticated
  USING (
    actual_teacher_id = (SELECT personnel_id FROM public.app_users WHERE id = auth.uid())
    AND approval_status IN ('DRAFT', 'REVISION_REQUESTED')
  );

CREATE POLICY "Full access on student grades for admin, executive, academic staff"
  ON public.academic_student_grades FOR ALL TO authenticated
  USING (public.get_user_role() IN ('admin', 'executive', 'academic staff'));

CREATE POLICY "Teachers can view and update grades for their gradebooks"
  ON public.academic_student_grades FOR ALL TO authenticated
  USING (
    gradebook_id IN (
      SELECT id FROM public.academic_gradebooks 
      WHERE actual_teacher_id = (SELECT personnel_id FROM public.app_users WHERE id = auth.uid())
    )
    OR public.get_user_role() IN ('admin', 'executive', 'academic staff')
  );

-- Early Years Evaluations Policies
CREATE POLICY "Full access on early years for admin, executive, academic staff"
  ON public.academic_early_years_evaluations FOR ALL TO authenticated
  USING (public.get_user_role() IN ('admin', 'executive', 'academic staff'));

CREATE POLICY "Homeroom teachers can view and edit early years"
  ON public.academic_early_years_evaluations FOR ALL TO authenticated
  USING (
    class_id IN (
      SELECT id FROM public.academic_classes 
      WHERE actual_homeroom_teacher_id = (SELECT personnel_id FROM public.app_users WHERE id = auth.uid())
    )
    OR public.get_user_role() IN ('admin', 'executive', 'academic staff')
  );

-- Timetable & Substitution Policies
CREATE POLICY "Full access on timetables for admin, executive, academic staff"
  ON public.academic_timetables FOR ALL TO authenticated
  USING (public.get_user_role() IN ('admin', 'executive', 'academic staff'));

CREATE POLICY "Allow authenticated read on timetables"
  ON public.academic_timetables FOR SELECT TO authenticated USING (true);

CREATE POLICY "Full access on competencies"
  ON public.academic_teacher_competencies FOR ALL TO authenticated
  USING (public.get_user_role() IN ('admin', 'executive', 'academic staff'));

CREATE POLICY "Teachers can view own competency"
  ON public.academic_teacher_competencies FOR SELECT TO authenticated
  USING (teacher_id = (SELECT personnel_id FROM public.app_users WHERE id = auth.uid()));

CREATE POLICY "Full access on substitutions"
  ON public.academic_substitutions FOR ALL TO authenticated
  USING (public.get_user_role() IN ('admin', 'executive', 'academic staff'));

CREATE POLICY "Teachers can view their own substitutions"
  ON public.academic_substitutions FOR SELECT TO authenticated
  USING (
    original_teacher_id = (SELECT personnel_id FROM public.app_users WHERE id = auth.uid())
    OR substitute_teacher_id = (SELECT personnel_id FROM public.app_users WHERE id = auth.uid())
  );
