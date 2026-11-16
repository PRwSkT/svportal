-- ============================================================================
-- Phase 19: Family Master Schema, RLS Security Overhaul & Bidirectional Pipelines
-- School: โรงเรียนสมคิดวิทยา (Somkidvittaya School)
-- Description:
--   1. Fixes app_users role check constraint & handle_new_user() trigger security
--   2. Adds public_uid & learner_id to public.students (preserving TEXT id PK)
--   3. Creates family schema (guardians, guardian_accounts, guardian_student_links,
--      guardian_invitations, consents, leave_requests, pickup_daily_plans,
--      early_years_dropoff_notes, medication_requests)
--   4. Creates operational pipeline tables in public (student_attendance_logs,
--      early_years_daily_care, student_incidents, academic_assignments,
--      academic_assignment_submissions, parent_teacher_threads,
--      parent_teacher_messages, system_domain_events)
--   5. Migrates existing public.student_parents into family.guardians & links
--   6. Tightens RLS on wallet_accounts, wallet_transactions, fee_items,
--      tuition_payments, and locks down audit_logs
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Fix app_users Role Constraint & Staff Check Helper
-- ----------------------------------------------------------------------------
ALTER TABLE public.app_users
  DROP CONSTRAINT IF EXISTS app_users_role_check;

ALTER TABLE public.app_users
  ADD CONSTRAINT app_users_role_check
  CHECK (role IN (
    'admin',
    'executive',
    'academic staff',
    'teacher',
    'non-academic staff',
    'cashier',
    'nurse',
    'driver',
    'dpo',
    'safeguarding_lead'
  ));

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_users
    WHERE id = auth.uid()
      AND is_active = true
  );
$$;

-- ----------------------------------------------------------------------------
-- 2. Harden handle_new_user() so Parents/External Accounts Never Become Cashier
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_personnel RECORD;
  v_role TEXT := 'non-academic staff';
  v_name TEXT;
BEGIN
  -- Look up in personnel directory by email
  SELECT * INTO v_personnel
  FROM public.personnel
  WHERE LOWER(email) = LOWER(NEW.email)
  LIMIT 1;

  -- Guard: Only create an app_users staff record if found in personnel OR @somkidvittaya.ac.th email
  IF v_personnel.id IS NULL AND COALESCE(LOWER(NEW.email), '') NOT LIKE '%@somkidvittaya.ac.th' THEN
    RETURN NEW;
  END IF;

  IF v_personnel.id IS NOT NULL THEN
    v_name := v_personnel.name_th;
    IF v_personnel.category = 'executive' THEN
      v_role := 'executive';
    ELSIF v_personnel.category = 'teacher' THEN
      v_role := 'teacher';
    ELSIF v_personnel.category = 'staff' THEN
      v_role := 'non-academic staff';
    END IF;
  ELSE
    v_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);
  END IF;

  INSERT INTO public.app_users (id, full_name, role, is_active, personnel_id)
  VALUES (
    NEW.id,
    v_name,
    v_role,
    true,
    v_personnel.id
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    personnel_id = COALESCE(EXCLUDED.personnel_id, public.app_users.personnel_id);

  IF v_personnel.id IS NOT NULL THEN
    UPDATE public.personnel SET user_id = NEW.id WHERE id = v_personnel.id;
  END IF;

  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Add Surrogate UUID (public_uid) & learner_id to public.students
-- ----------------------------------------------------------------------------
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS public_uid UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS learner_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'students_public_uid_key'
  ) THEN
    ALTER TABLE public.students ADD CONSTRAINT students_public_uid_key UNIQUE (public_uid);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_students_public_uid ON public.students(public_uid);
CREATE INDEX IF NOT EXISTS idx_students_learner_id ON public.students(learner_id);

-- ----------------------------------------------------------------------------
-- 4. Create Family Schema & Core Guardian Tables
-- ----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS family;
GRANT USAGE ON SCHEMA family TO authenticated, anon, service_role;

CREATE TABLE IF NOT EXISTS family.guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  citizen_id TEXT UNIQUE,
  prefix TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  email TEXT,
  line_user_id TEXT,
  occupation TEXT,
  annual_income NUMERIC(12, 2),
  photo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure any legacy unique constraint on line_user_id is dropped
ALTER TABLE family.guardians DROP CONSTRAINT IF EXISTS guardians_line_user_id_key;
DROP INDEX IF EXISTS family.guardians_line_user_id_key;

CREATE INDEX IF NOT EXISTS idx_family_guardians_phone ON family.guardians(phone_number);
CREATE INDEX IF NOT EXISTS idx_family_guardians_email ON family.guardians(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_family_guardians_line ON family.guardians(line_user_id);

CREATE TABLE IF NOT EXISTS family.guardian_accounts (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  guardian_id UUID NOT NULL UNIQUE REFERENCES family.guardians(id) ON DELETE CASCADE,
  preferred_lang TEXT NOT NULL DEFAULT 'th' CHECK (preferred_lang IN ('th', 'en', 'zh', 'my')),
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS family.guardian_student_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id UUID NOT NULL REFERENCES family.guardians(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL CHECK (relationship IN ('บิดา', 'มารดา', 'ปู่/ย่า/ตา/ยาย', 'ลุง/ป้า/น้า/อา', 'ผู้ปกครองตามกฎหมาย', 'ผู้รับมอบอำนาจรับ-ส่ง')),
  role_type TEXT NOT NULL DEFAULT 'PRIMARY' CHECK (role_type IN ('PRIMARY', 'SECONDARY', 'FINANCE_ONLY', 'PICKUP_ONLY', 'EMERGENCY_ONLY')),

  -- 10 Granular Permission Flags
  is_legal_guardian BOOLEAN NOT NULL DEFAULT true,
  can_view_daily BOOLEAN NOT NULL DEFAULT true,
  can_view_academic BOOLEAN NOT NULL DEFAULT true,
  can_view_health BOOLEAN NOT NULL DEFAULT true,
  can_view_finance BOOLEAN NOT NULL DEFAULT true,
  can_pay BOOLEAN NOT NULL DEFAULT true,
  can_message_teacher BOOLEAN NOT NULL DEFAULT true,
  can_pickup BOOLEAN NOT NULL DEFAULT true,
  can_manage_pickup BOOLEAN NOT NULL DEFAULT false,
  can_give_consent BOOLEAN NOT NULL DEFAULT true,
  receives_emergency_alert BOOLEAN NOT NULL DEFAULT true,

  -- Safeguarding & Court Custody Restriction
  has_legal_restriction BOOLEAN NOT NULL DEFAULT false,
  restriction_note TEXT,

  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (guardian_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_guardian_links_student ON family.guardian_student_links(student_id);
CREATE INDEX IF NOT EXISTS idx_guardian_links_guardian ON family.guardian_student_links(guardian_id);

CREATE TABLE IF NOT EXISTS family.guardian_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id UUID NOT NULL REFERENCES family.guardians(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS family.consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  guardian_id UUID REFERENCES family.guardians(id) ON DELETE SET NULL,
  purpose_code TEXT NOT NULL CHECK (purpose_code IN (
    'PHOTO_INTERNAL',
    'PHOTO_PUBLIC_PR',
    'FIELD_TRIP',
    'FIRST_AID',
    'AI_TRANSLATE',
    'DATA_PROCESSING'
  )),
  policy_version TEXT NOT NULL DEFAULT 'v1.0-2569',
  is_granted BOOLEAN NOT NULL DEFAULT true,
  ip_address TEXT,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  UNIQUE (student_id, purpose_code)
);

-- ----------------------------------------------------------------------------
-- 5. Helper Function: family.has_guardian_perm(p_student_id, p_perm)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION family.has_guardian_perm(
  p_student_id TEXT,
  p_perm TEXT DEFAULT 'any'
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = family, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM family.guardian_accounts ga
    JOIN family.guardian_student_links gsl ON gsl.guardian_id = ga.guardian_id
    WHERE ga.user_id = auth.uid()
      AND gsl.student_id = p_student_id
      AND gsl.has_legal_restriction = false
      AND (gsl.valid_until IS NULL OR gsl.valid_until > now())
      AND (
        p_perm = 'any'
        OR (p_perm = 'daily' AND gsl.can_view_daily)
        OR (p_perm = 'academic' AND gsl.can_view_academic)
        OR (p_perm = 'health' AND gsl.can_view_health)
        OR (p_perm = 'finance' AND gsl.can_view_finance)
        OR (p_perm = 'pay' AND gsl.can_pay)
        OR (p_perm = 'message' AND gsl.can_message_teacher)
        OR (p_perm = 'pickup' AND gsl.can_pickup)
        OR (p_perm = 'manage_pickup' AND gsl.can_manage_pickup)
        OR (p_perm = 'consent' AND gsl.can_give_consent)
      )
  );
$$;

-- ----------------------------------------------------------------------------
-- 6. Migrate Existing public.student_parents into family.guardians & Links
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  v_guardian_id UUID;
  v_rel TEXT;
  v_clean_cid TEXT;
BEGIN
  FOR r IN
    SELECT *
    FROM public.student_parents
    WHERE COALESCE(TRIM(first_name), '') <> ''
  LOOP
    v_guardian_id := NULL;
    v_clean_cid := NULLIF(REGEXP_REPLACE(TRIM(COALESCE(r.citizen_id, '')), '[^0-9]', '', 'g'), '');

    -- 1. Match by citizen_id if present and valid (>= 10 digits)
    IF v_clean_cid IS NOT NULL AND LENGTH(v_clean_cid) >= 10 THEN
      SELECT id INTO v_guardian_id
      FROM family.guardians
      WHERE citizen_id = v_clean_cid
      LIMIT 1;
    END IF;

    -- 2. Match by phone_number + first_name if not found
    IF v_guardian_id IS NULL AND r.phone_number IS NOT NULL AND TRIM(r.phone_number) <> '' THEN
      SELECT id INTO v_guardian_id
      FROM family.guardians
      WHERE phone_number = TRIM(r.phone_number)
        AND first_name = TRIM(r.first_name)
      LIMIT 1;
    END IF;

    -- 3. Match by first_name + last_name if not found
    IF v_guardian_id IS NULL AND TRIM(r.first_name) <> '' AND TRIM(COALESCE(r.last_name, '')) <> '' AND TRIM(r.last_name) <> '-' THEN
      SELECT id INTO v_guardian_id
      FROM family.guardians
      WHERE first_name = TRIM(r.first_name)
        AND last_name = TRIM(r.last_name)
      LIMIT 1;
    END IF;

    -- 4. If still not found, insert new guardian record
    IF v_guardian_id IS NULL THEN
      IF v_clean_cid IS NOT NULL AND LENGTH(v_clean_cid) >= 10 THEN
        INSERT INTO family.guardians (
          citizen_id,
          prefix,
          first_name,
          last_name,
          phone_number,
          occupation,
          line_user_id
        ) VALUES (
          v_clean_cid,
          r.prefix,
          COALESCE(NULLIF(TRIM(r.first_name), ''), 'ผู้ปกครอง'),
          COALESCE(NULLIF(TRIM(r.last_name), ''), '-'),
          COALESCE(NULLIF(TRIM(r.phone_number), ''), '000-000-0000'),
          r.occupation,
          NULLIF(TRIM(r.line_id), '')
        )
        ON CONFLICT (citizen_id) DO UPDATE
          SET updated_at = now()
        RETURNING id INTO v_guardian_id;
      ELSE
        INSERT INTO family.guardians (
          citizen_id,
          prefix,
          first_name,
          last_name,
          phone_number,
          occupation,
          line_user_id
        ) VALUES (
          NULL,
          r.prefix,
          COALESCE(NULLIF(TRIM(r.first_name), ''), 'ผู้ปกครอง'),
          COALESCE(NULLIF(TRIM(r.last_name), ''), '-'),
          COALESCE(NULLIF(TRIM(r.phone_number), ''), '000-000-0000'),
          r.occupation,
          NULLIF(TRIM(r.line_id), '')
        )
        RETURNING id INTO v_guardian_id;
      END IF;
    END IF;

    v_rel := CASE
      WHEN r.relationship IN ('บิดา', 'มารดา') THEN r.relationship
      ELSE 'ผู้ปกครองตามกฎหมาย'
    END;

    IF v_guardian_id IS NOT NULL THEN
      INSERT INTO family.guardian_student_links (
        guardian_id,
        student_id,
        relationship,
        role_type,
        can_manage_pickup
      ) VALUES (
        v_guardian_id,
        r.student_id,
        v_rel,
        'PRIMARY',
        true
      )
      ON CONFLICT (guardian_id, student_id) DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 7. Operational Pipeline Tables (Attendance, Leave, Pickup, Early Years,
--    Health, Homework, Messaging, Domain Events)
-- ----------------------------------------------------------------------------

-- 7.1 Attendance Logs
CREATE TABLE IF NOT EXISTS public.student_attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Bangkok')::date),
  period TEXT NOT NULL DEFAULT 'MORNING_HOMEROOM',
  status TEXT NOT NULL DEFAULT 'PRESENT' CHECK (status IN (
    'PRESENT',
    'LATE',
    'ABSENT',
    'SICK_LEAVE',
    'PERSONAL_LEAVE',
    'EARLY_PICKUP'
  )),
  check_in_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'TEACHER_APP' CHECK (source IN (
    'NFC_GATE',
    'TEACHER_APP',
    'VAN_SYNC',
    'DISMISSAL_KIOSK'
  )),
  recorded_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, attendance_date, period)
);

CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON public.student_attendance_logs(student_id, attendance_date DESC);

-- 7.2 Student Leave Requests (Parent -> Teacher/Attendance)
CREATE TABLE IF NOT EXISTS family.student_leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  guardian_id UUID REFERENCES family.guardians(id) ON DELETE SET NULL,
  guardian_name TEXT NOT NULL,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('SICK_LEAVE', 'PERSONAL_LEAVE', 'EARLY_PICKUP')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  attachment_url TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_student ON family.student_leave_requests(student_id, start_date DESC);

-- 7.3 Daily Pickup & Dismissal Plans (Parent <-> Gate Kiosk / Van)
CREATE TABLE IF NOT EXISTS family.pickup_daily_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  plan_date DATE NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Bangkok')::date),
  transport_mode TEXT NOT NULL DEFAULT 'PARENT_PICKUP' CHECK (transport_mode IN (
    'SCHOOL_VAN',
    'PARENT_PICKUP',
    'AFTER_SCHOOL',
    'WALK_HOME'
  )),
  collector_name TEXT NOT NULL,
  collector_relationship TEXT NOT NULL,
  collector_phone TEXT,
  collector_photo_url TEXT,
  temp_otp_code TEXT,
  arrival_status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (arrival_status IN (
    'SCHEDULED',
    'ARRIVING_SOON',
    'ARRIVED_AT_GATE',
    'RELEASED'
  )),
  arrived_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  released_by_staff TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, plan_date)
);

CREATE INDEX IF NOT EXISTS idx_pickup_plans_date ON family.pickup_daily_plans(plan_date, arrival_status);

-- 7.4 Early Years Daily Care (Teacher -> Parent)
CREATE TABLE IF NOT EXISTS public.early_years_daily_care (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id TEXT NOT NULL,
  care_date DATE NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Bangkok')::date),
  morning_mood TEXT NOT NULL DEFAULT 'CHEERFUL' CHECK (morning_mood IN (
    'CHEERFUL',
    'CALM',
    'TIRED',
    'CLINGY',
    'UNWELL'
  )),
  breakfast_status TEXT NOT NULL DEFAULT 'ALL' CHECK (breakfast_status IN ('ALL', 'HALF', 'LITTLE', 'NONE')),
  lunch_status TEXT NOT NULL DEFAULT 'ALL' CHECK (lunch_status IN ('ALL', 'HALF', 'LITTLE', 'NONE')),
  milk_morning TEXT NOT NULL DEFAULT 'ALL' CHECK (milk_morning IN ('ALL', 'HALF', 'NONE')),
  milk_afternoon TEXT NOT NULL DEFAULT 'ALL' CHECK (milk_afternoon IN ('ALL', 'HALF', 'NONE')),
  nap_start TIME DEFAULT '12:30',
  nap_end TIME DEFAULT '14:15',
  nap_quality TEXT NOT NULL DEFAULT 'SOUND' CHECK (nap_quality IN ('SOUND', 'RESTLESS', 'NO_NAP')),
  toilet_count INTEGER NOT NULL DEFAULT 2,
  diaper_count INTEGER NOT NULL DEFAULT 0,
  toilet_note TEXT,
  temperature_c NUMERIC(4, 1) DEFAULT 36.6,
  learning_activity TEXT,
  home_suggestion TEXT,
  teacher_note TEXT,
  photo_urls TEXT[] DEFAULT '{}',
  is_published BOOLEAN NOT NULL DEFAULT true,
  published_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, care_date)
);

-- 7.5 Early Years Morning Drop-off Notes (Parent -> Teacher)
CREATE TABLE IF NOT EXISTS family.early_years_dropoff_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  note_date DATE NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Bangkok')::date),
  guardian_name TEXT NOT NULL,
  sleep_hours NUMERIC(3, 1) DEFAULT 9.5,
  ate_breakfast BOOLEAN NOT NULL DEFAULT true,
  morning_mood TEXT NOT NULL DEFAULT 'สดใส อารมณ์ดี',
  medication_today BOOLEAN NOT NULL DEFAULT false,
  pickup_person_today TEXT,
  special_note TEXT,
  acknowledged_by_teacher TEXT,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, note_date)
);

-- 7.6 Medication Administration Requests (Parent <-> Nurse/Teacher)
CREATE TABLE IF NOT EXISTS family.medication_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  guardian_name TEXT NOT NULL,
  medication_name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  schedule_times TEXT[] NOT NULL DEFAULT '{"12:00"}',
  meal_timing TEXT NOT NULL DEFAULT 'AFTER_MEAL' CHECK (meal_timing IN (
    'BEFORE_MEAL',
    'AFTER_MEAL',
    'WITH_MEAL',
    'AS_NEEDED'
  )),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  signature_data_url TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN (
    'ACTIVE',
    'ADMINISTERED_TODAY',
    'COMPLETED',
    'CANCELLED'
  )),
  last_administered_at TIMESTAMPTZ,
  last_administered_by TEXT,
  nurse_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7.7 Student Accident / Incident Reports (Staff -> Parent Ack)
CREATE TABLE IF NOT EXISTS public.student_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  incident_date DATE NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Bangkok')::date),
  incident_time TIME NOT NULL DEFAULT '10:30',
  location TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'LOW' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  description TEXT NOT NULL,
  first_aid_given TEXT NOT NULL,
  hospital_referred BOOLEAN NOT NULL DEFAULT false,
  reported_by TEXT NOT NULL,
  parent_acknowledged BOOLEAN NOT NULL DEFAULT false,
  parent_acknowledged_at TIMESTAMPTZ,
  acknowledged_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7.8 Academic Assignments & Submissions (Teacher -> Parent/Student)
CREATE TABLE IF NOT EXISTS public.academic_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id TEXT NOT NULL,
  grade_level TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  title_th TEXT NOT NULL,
  title_en TEXT,
  description TEXT,
  due_date DATE NOT NULL,
  max_score NUMERIC(5, 2) DEFAULT 10,
  assigned_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.academic_assignment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.academic_assignments(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN (
    'SUBMITTED',
    'PENDING',
    'LATE',
    'NEEDS_REVISION'
  )),
  score NUMERIC(5, 2),
  teacher_feedback TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, student_id)
);

-- 7.9 Parent-Teacher Bidirectional Threads & Messages
CREATE TABLE IF NOT EXISTS public.parent_teacher_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  grade_level TEXT NOT NULL,
  guardian_name TEXT NOT NULL,
  teacher_name TEXT NOT NULL,
  channel_type TEXT NOT NULL DEFAULT 'HOMEROOM' CHECK (channel_type IN (
    'HOMEROOM',
    'ADMIN_OFFICE',
    'INFIRMARY',
    'FINANCE'
  )),
  last_message_text TEXT,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unread_staff_count INTEGER NOT NULL DEFAULT 0,
  unread_parent_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.parent_teacher_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.parent_teacher_threads(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('STAFF', 'PARENT', 'SYSTEM')),
  sender_name TEXT NOT NULL,
  body_th TEXT NOT NULL,
  body_en TEXT,
  require_acknowledgement BOOLEAN NOT NULL DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7.10 System Domain Events Bus
CREATE TABLE IF NOT EXISTS public.system_domain_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  student_id TEXT REFERENCES public.students(id) ON DELETE CASCADE,
  severity TEXT NOT NULL DEFAULT 'NORMAL' CHECK (severity IN ('CRITICAL', 'HIGH', 'NORMAL', 'DIGEST')),
  title_th TEXT NOT NULL,
  title_en TEXT,
  body_th TEXT NOT NULL,
  body_en TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 8. Tighten Financial & Audit RLS Policies (Zero Open Financial Tables)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "wallet_accounts_read_authenticated" ON public.wallet_accounts;
CREATE POLICY "wallet_accounts_staff_or_guardian_read"
  ON public.wallet_accounts FOR SELECT TO authenticated
  USING (public.is_staff() OR family.has_guardian_perm(student_id, 'daily'));

DROP POLICY IF EXISTS "wallet_transactions_read_authenticated" ON public.wallet_transactions;
CREATE POLICY "wallet_transactions_staff_or_guardian_read"
  ON public.wallet_transactions FOR SELECT TO authenticated
  USING (public.is_staff() OR family.has_guardian_perm(student_id, 'daily'));

DROP POLICY IF EXISTS "fee_items_read_authenticated" ON public.fee_items;
CREATE POLICY "fee_items_staff_or_guardian_read"
  ON public.fee_items FOR SELECT TO authenticated
  USING (public.is_staff() OR family.has_guardian_perm(student_id, 'finance'));

DROP POLICY IF EXISTS "tuition_payments_read_authenticated" ON public.tuition_payments;
CREATE POLICY "tuition_payments_staff_or_guardian_read"
  ON public.tuition_payments FOR SELECT TO authenticated
  USING (public.is_staff() OR family.has_guardian_perm(student_id, 'finance'));

-- Allow parents with 'any' permission to read their linked child in public.students
DROP POLICY IF EXISTS "Guardians can read linked students" ON public.students;
CREATE POLICY "Guardians can read linked students"
  ON public.students FOR SELECT TO authenticated
  USING (public.is_staff() OR family.has_guardian_perm(id, 'any'));

-- Enforce Immutable Audit Logs
REVOKE UPDATE, DELETE ON public.audit_logs FROM authenticated, anon;

-- ----------------------------------------------------------------------------
-- 9. Enable RLS & Configure Policies on All New Family & Pipeline Tables
-- ----------------------------------------------------------------------------
ALTER TABLE family.guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE family.guardian_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE family.guardian_student_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE family.guardian_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE family.consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE family.student_leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE family.pickup_daily_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.early_years_daily_care ENABLE ROW LEVEL SECURITY;
ALTER TABLE family.early_years_dropoff_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE family.medication_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_teacher_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_teacher_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_domain_events ENABLE ROW LEVEL SECURITY;

-- Guardians & Links Policies
DROP POLICY IF EXISTS "Staff or self access guardians" ON family.guardians;
CREATE POLICY "Staff or self access guardians"
  ON family.guardians FOR SELECT TO authenticated
  USING (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM family.guardian_accounts ga
      WHERE ga.guardian_id = family.guardians.id AND ga.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Staff manage guardians" ON family.guardians;
CREATE POLICY "Staff manage guardians"
  ON family.guardians FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Staff or self access guardian_accounts" ON family.guardian_accounts;
CREATE POLICY "Staff or self access guardian_accounts"
  ON family.guardian_accounts FOR SELECT TO authenticated
  USING (public.is_staff() OR user_id = auth.uid());

DROP POLICY IF EXISTS "Staff or self access guardian_student_links" ON family.guardian_student_links;
CREATE POLICY "Staff or self access guardian_student_links"
  ON family.guardian_student_links FOR SELECT TO authenticated
  USING (public.is_staff() OR family.has_guardian_perm(student_id, 'any'));

DROP POLICY IF EXISTS "Staff manage guardian_student_links" ON family.guardian_student_links;
CREATE POLICY "Staff manage guardian_student_links"
  ON family.guardian_student_links FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Staff manage guardian_invitations" ON family.guardian_invitations;
CREATE POLICY "Staff manage guardian_invitations"
  ON family.guardian_invitations FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- Consents Policies
DROP POLICY IF EXISTS "Staff or guardian access consents" ON family.consents;
CREATE POLICY "Staff or guardian access consents"
  ON family.consents FOR ALL TO authenticated
  USING (public.is_staff() OR family.has_guardian_perm(student_id, 'consent'))
  WITH CHECK (public.is_staff() OR family.has_guardian_perm(student_id, 'consent'));

-- Attendance Policies
DROP POLICY IF EXISTS "Staff or guardian read attendance" ON public.student_attendance_logs;
CREATE POLICY "Staff or guardian read attendance"
  ON public.student_attendance_logs FOR SELECT TO authenticated
  USING (public.is_staff() OR family.has_guardian_perm(student_id, 'daily'));

DROP POLICY IF EXISTS "Staff manage attendance" ON public.student_attendance_logs;
CREATE POLICY "Staff manage attendance"
  ON public.student_attendance_logs FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- Leave Requests Policies
DROP POLICY IF EXISTS "Staff or guardian access leave_requests" ON family.student_leave_requests;
CREATE POLICY "Staff or guardian access leave_requests"
  ON family.student_leave_requests FOR ALL TO authenticated
  USING (public.is_staff() OR family.has_guardian_perm(student_id, 'daily'))
  WITH CHECK (public.is_staff() OR family.has_guardian_perm(student_id, 'daily'));

-- Pickup Daily Plans Policies
DROP POLICY IF EXISTS "Staff or guardian access pickup_daily_plans" ON family.pickup_daily_plans;
CREATE POLICY "Staff or guardian access pickup_daily_plans"
  ON family.pickup_daily_plans FOR ALL TO authenticated
  USING (public.is_staff() OR family.has_guardian_perm(student_id, 'pickup'))
  WITH CHECK (public.is_staff() OR family.has_guardian_perm(student_id, 'pickup'));

-- Early Years Daily Care & Drop-off Notes Policies
DROP POLICY IF EXISTS "Staff or guardian read early_years_daily_care" ON public.early_years_daily_care;
CREATE POLICY "Staff or guardian read early_years_daily_care"
  ON public.early_years_daily_care FOR SELECT TO authenticated
  USING (public.is_staff() OR family.has_guardian_perm(student_id, 'daily'));

DROP POLICY IF EXISTS "Staff manage early_years_daily_care" ON public.early_years_daily_care;
CREATE POLICY "Staff manage early_years_daily_care"
  ON public.early_years_daily_care FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Staff or guardian access early_years_dropoff_notes" ON family.early_years_dropoff_notes;
CREATE POLICY "Staff or guardian access early_years_dropoff_notes"
  ON family.early_years_dropoff_notes FOR ALL TO authenticated
  USING (public.is_staff() OR family.has_guardian_perm(student_id, 'daily'))
  WITH CHECK (public.is_staff() OR family.has_guardian_perm(student_id, 'daily'));

-- Medication & Incidents Policies
DROP POLICY IF EXISTS "Staff or guardian access medication_requests" ON family.medication_requests;
CREATE POLICY "Staff or guardian access medication_requests"
  ON family.medication_requests FOR ALL TO authenticated
  USING (public.is_staff() OR family.has_guardian_perm(student_id, 'health'))
  WITH CHECK (public.is_staff() OR family.has_guardian_perm(student_id, 'health'));

DROP POLICY IF EXISTS "Staff or guardian access student_incidents" ON public.student_incidents;
CREATE POLICY "Staff or guardian access student_incidents"
  ON public.student_incidents FOR ALL TO authenticated
  USING (public.is_staff() OR family.has_guardian_perm(student_id, 'health'))
  WITH CHECK (public.is_staff() OR family.has_guardian_perm(student_id, 'health'));

-- Assignments & Submissions Policies
DROP POLICY IF EXISTS "Authenticated read academic_assignments" ON public.academic_assignments;
CREATE POLICY "Authenticated read academic_assignments"
  ON public.academic_assignments FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Staff manage academic_assignments" ON public.academic_assignments;
CREATE POLICY "Staff manage academic_assignments"
  ON public.academic_assignments FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Staff or guardian read assignment_submissions" ON public.academic_assignment_submissions;
CREATE POLICY "Staff or guardian read assignment_submissions"
  ON public.academic_assignment_submissions FOR SELECT TO authenticated
  USING (public.is_staff() OR family.has_guardian_perm(student_id, 'academic'));

DROP POLICY IF EXISTS "Staff manage assignment_submissions" ON public.academic_assignment_submissions;
CREATE POLICY "Staff manage assignment_submissions"
  ON public.academic_assignment_submissions FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- Parent-Teacher Threads & Messages Policies
DROP POLICY IF EXISTS "Staff or guardian access parent_teacher_threads" ON public.parent_teacher_threads;
CREATE POLICY "Staff or guardian access parent_teacher_threads"
  ON public.parent_teacher_threads FOR ALL TO authenticated
  USING (public.is_staff() OR family.has_guardian_perm(student_id, 'message'))
  WITH CHECK (public.is_staff() OR family.has_guardian_perm(student_id, 'message'));

DROP POLICY IF EXISTS "Staff or guardian access parent_teacher_messages" ON public.parent_teacher_messages;
CREATE POLICY "Staff or guardian access parent_teacher_messages"
  ON public.parent_teacher_messages FOR ALL TO authenticated
  USING (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.parent_teacher_threads t
      WHERE t.id = public.parent_teacher_messages.thread_id
        AND family.has_guardian_perm(t.student_id, 'message')
    )
  )
  WITH CHECK (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.parent_teacher_threads t
      WHERE t.id = public.parent_teacher_messages.thread_id
        AND family.has_guardian_perm(t.student_id, 'message')
    )
  );

-- Domain Events Policies
DROP POLICY IF EXISTS "Staff or guardian read system_domain_events" ON public.system_domain_events;
CREATE POLICY "Staff or guardian read system_domain_events"
  ON public.system_domain_events FOR SELECT TO authenticated
  USING (
    public.is_staff()
    OR (student_id IS NOT NULL AND family.has_guardian_perm(student_id, 'any'))
  );

DROP POLICY IF EXISTS "Authenticated insert system_domain_events" ON public.system_domain_events;
CREATE POLICY "Authenticated insert system_domain_events"
  ON public.system_domain_events FOR INSERT TO authenticated
  WITH CHECK (
    public.is_staff()
    OR (student_id IS NOT NULL AND family.has_guardian_perm(student_id, 'any'))
  );
