-- ============================================================================
-- Somkidvittaya School (SVPortal-Post) Master Schema Missing Tables & Sync
-- Migration: 20261114000001_master_schema_missing_tables_and_sync.sql
-- Description:
--   1. Idempotently creates 11 missing tables queried across src/
--      - public.attendance_records
--      - public.kpi_cycles, kpi_templates, kpi_evaluations, kpi_evaluator_reviews
--      - public.signage_devices, signage_groups, signage_media, signage_campaigns,
--        signage_campaign_media, signage_settings
--      - public.room_configs, room_bookings
--      - public.academic_assignments, academic_assignment_submissions
--   2. Updates wallet_transactions_channel_check to allow 'counter','svportal','system','cash','qr','transfer'
--   3. Adds bidirectional synchronization trigger on student_parents -> family.guardians & links
--   4. Purges seeded backdoor user ('admin@svportal.com') and invalid 27-THB flat subsidy memory row
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Attendance Records Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  check_in_time TIMESTAMPTZ,
  check_in_lat NUMERIC,
  check_in_lng NUMERIC,
  check_out_time TIMESTAMPTZ,
  check_out_lat NUMERIC,
  check_out_lng NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT attendance_records_user_date_key UNIQUE (user_id, date)
);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own attendance" ON public.attendance_records;
CREATE POLICY "Users can view own attendance"
  ON public.attendance_records FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all attendance" ON public.attendance_records;
CREATE POLICY "Admins can view all attendance"
  ON public.attendance_records FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.app_users WHERE id = auth.uid() AND role IN ('admin', 'executive'))
  );

-- ----------------------------------------------------------------------------
-- 2. KPI Evaluation Suite Tables
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kpi_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  semester TEXT NOT NULL,
  quarter TEXT CHECK (quarter IN ('Q1', 'Q2', 'Q3', 'Q4')),
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kpi_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  target_role TEXT NOT NULL DEFAULT 'all' CHECK (target_role IN ('teacher', 'staff', 'executive', 'all')),
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kpi_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES public.kpi_cycles(id) ON DELETE CASCADE,
  personnel_id TEXT NOT NULL,
  template_id UUID REFERENCES public.kpi_templates(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending_self' CHECK (status IN ('pending_self', 'self_submitted', 'completed')),
  self_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  self_notes JSONB NOT NULL DEFAULT '{}'::jsonb,
  self_overall_comment TEXT,
  self_total_score NUMERIC(5, 2),
  self_submitted_at TIMESTAMPTZ,
  assigned_evaluator_id TEXT,
  assigned_evaluator_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  supervisor_id TEXT,
  supervisor_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  supervisor_feedback JSONB NOT NULL DEFAULT '{}'::jsonb,
  supervisor_overall_comment TEXT,
  supervisor_strengths TEXT,
  supervisor_improvements TEXT,
  supervisor_total_score NUMERIC(5, 2),
  supervisor_submitted_at TIMESTAMPTZ,
  final_score NUMERIC(5, 2),
  final_grade TEXT CHECK (final_grade IN ('A', 'B+', 'B', 'C', 'D')),
  email_notified_at TIMESTAMPTZ,
  email_notified_status TEXT NOT NULL DEFAULT 'pending' CHECK (email_notified_status IN ('pending', 'sent', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT kpi_evaluations_cycle_personnel_key UNIQUE (cycle_id, personnel_id)
);

CREATE TABLE IF NOT EXISTS public.kpi_evaluator_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES public.kpi_evaluations(id) ON DELETE CASCADE,
  evaluator_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  feedback JSONB NOT NULL DEFAULT '{}'::jsonb,
  overall_comment TEXT,
  strengths TEXT,
  improvements TEXT,
  total_score NUMERIC(5, 2),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT kpi_evaluator_reviews_eval_evaluator_key UNIQUE (evaluation_id, evaluator_id)
);

ALTER TABLE public.kpi_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_evaluator_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read kpi_cycles" ON public.kpi_cycles;
CREATE POLICY "Staff read kpi_cycles" ON public.kpi_cycles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Staff read kpi_templates" ON public.kpi_templates;
CREATE POLICY "Staff read kpi_templates" ON public.kpi_templates FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Staff read kpi_evaluations" ON public.kpi_evaluations;
CREATE POLICY "Staff read kpi_evaluations" ON public.kpi_evaluations FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Staff read kpi_evaluator_reviews" ON public.kpi_evaluator_reviews;
CREATE POLICY "Staff read kpi_evaluator_reviews" ON public.kpi_evaluator_reviews FOR SELECT TO authenticated USING (true);

-- ----------------------------------------------------------------------------
-- 3. Digital Signage Suite Tables
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.signage_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.signage_devices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  group_id TEXT REFERENCES public.signage_groups(id) ON DELETE SET NULL,
  orientation TEXT NOT NULL DEFAULT 'PORTRAIT_90',
  is_muted INTEGER NOT NULL DEFAULT 0,
  volume INTEGER NOT NULL DEFAULT 20,
  status TEXT NOT NULL DEFAULT 'ONLINE',
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.signage_media (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'image',
  file_path TEXT,
  file_url TEXT NOT NULL,
  checksum_sha256 TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 10,
  file_size BIGINT,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.signage_campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT 'ALL' CHECK (target_type IN ('ALL', 'GROUP', 'SPECIFIC')),
  target_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.signage_campaign_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL REFERENCES public.signage_campaigns(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL REFERENCES public.signage_media(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT signage_campaign_media_unique UNIQUE (campaign_id, media_id)
);

CREATE TABLE IF NOT EXISTS public.signage_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.signage_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signage_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signage_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signage_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signage_campaign_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signage_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read signage_groups" ON public.signage_groups;
CREATE POLICY "Public read signage_groups" ON public.signage_groups FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read signage_devices" ON public.signage_devices;
CREATE POLICY "Public read signage_devices" ON public.signage_devices FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read signage_media" ON public.signage_media;
CREATE POLICY "Public read signage_media" ON public.signage_media FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read signage_campaigns" ON public.signage_campaigns;
CREATE POLICY "Public read signage_campaigns" ON public.signage_campaigns FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read signage_campaign_media" ON public.signage_campaign_media;
CREATE POLICY "Public read signage_campaign_media" ON public.signage_campaign_media FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read signage_settings" ON public.signage_settings;
CREATE POLICY "Public read signage_settings" ON public.signage_settings FOR SELECT USING (true);

-- ----------------------------------------------------------------------------
-- 4. Relational Room Booking & Config Tables
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.room_configs (
  room_code TEXT PRIMARY KEY,
  room_name TEXT NOT NULL,
  room_number TEXT,
  building TEXT,
  capacity INTEGER DEFAULT 30,
  logo_url TEXT,
  logo_style TEXT DEFAULT 'rounded',
  open_time TEXT DEFAULT '07:30',
  close_time TEXT DEFAULT '17:00',
  active_days JSONB DEFAULT '[1, 2, 3, 4, 5]'::jsonb,
  checkin_grace_minutes INTEGER DEFAULT 15,
  subtitle TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.room_bookings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  room_code TEXT NOT NULL REFERENCES public.room_configs(room_code) ON UPDATE CASCADE ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  title TEXT NOT NULL,
  booker_type TEXT NOT NULL CHECK (booker_type IN ('TEACHER', 'STUDENT')),
  booker_id TEXT NOT NULL,
  booker_name TEXT NOT NULL,
  booker_role_label TEXT,
  participants_count INTEGER DEFAULT 1,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'BOOKED' CHECK (status IN ('BOOKED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED')),
  checked_in_at TIMESTAMPTZ,
  checked_in_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default LLC room if not present
INSERT INTO public.room_configs (
  room_code, room_name, room_number, building, capacity, logo_url, logo_style, open_time, close_time, active_days, checkin_grace_minutes, subtitle, is_active
) VALUES (
  'LLC',
  'ห้อง LLC',
  'LLC-101',
  'ศูนย์การเรียนรู้ภาษา (Language Learning Center)',
  30,
  '/tv/assets/images/emblem-navy.png',
  'rounded',
  '07:30',
  '17:00',
  '[1, 2, 3, 4, 5]'::jsonb,
  15,
  'กรุณาจองล่วงหน้าในระบบ SV Portal และสแกน QR Code หน้าห้องเพื่อยืนยันเข้าใช้งาน',
  true
) ON CONFLICT (room_code) DO NOTHING;

ALTER TABLE public.room_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read room_configs" ON public.room_configs;
CREATE POLICY "Public read room_configs" ON public.room_configs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read room_bookings" ON public.room_bookings;
CREATE POLICY "Public read room_bookings" ON public.room_bookings FOR SELECT USING (true);

-- ----------------------------------------------------------------------------
-- 5. Relational Academic Assignments & Submissions
-- ----------------------------------------------------------------------------
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
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('SUBMITTED', 'PENDING', 'LATE', 'NEEDS_REVISION')),
  score NUMERIC(5, 2),
  teacher_feedback TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT academic_assignment_submissions_unique UNIQUE (assignment_id, student_id)
);

ALTER TABLE public.academic_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_assignment_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read academic_assignments" ON public.academic_assignments;
CREATE POLICY "Public read academic_assignments" ON public.academic_assignments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read academic_assignment_submissions" ON public.academic_assignment_submissions;
CREATE POLICY "Public read academic_assignment_submissions" ON public.academic_assignment_submissions FOR SELECT USING (true);

-- ----------------------------------------------------------------------------
-- 6. Safely Update wallet_transactions channel check constraint
-- ----------------------------------------------------------------------------
ALTER TABLE public.wallet_transactions
  DROP CONSTRAINT IF EXISTS wallet_transactions_channel_check;

ALTER TABLE public.wallet_transactions
  ADD CONSTRAINT wallet_transactions_channel_check
  CHECK (channel IN ('counter', 'svportal', 'system', 'cash', 'qr', 'transfer'));

-- ----------------------------------------------------------------------------
-- 7. Bidirectional Sync Trigger: public.student_parents -> family.guardians & links
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_sync_student_parents_to_family()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, family
AS $$
DECLARE
  v_guardian_id UUID;
  v_rel TEXT;
  v_clean_cid TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_clean_cid := NULLIF(REGEXP_REPLACE(TRIM(COALESCE(OLD.citizen_id, '')), '[^0-9]', '', 'g'), '');
    IF v_clean_cid IS NOT NULL AND LENGTH(v_clean_cid) >= 10 THEN
      SELECT id INTO v_guardian_id FROM family.guardians WHERE citizen_id = v_clean_cid LIMIT 1;
    END IF;
    IF v_guardian_id IS NULL AND OLD.phone_number IS NOT NULL AND TRIM(OLD.phone_number) <> '' THEN
      SELECT id INTO v_guardian_id FROM family.guardians WHERE phone_number = TRIM(OLD.phone_number) AND first_name = TRIM(OLD.first_name) LIMIT 1;
    END IF;
    IF v_guardian_id IS NOT NULL AND OLD.student_id IS NOT NULL THEN
      DELETE FROM family.guardian_student_links WHERE guardian_id = v_guardian_id AND student_id = OLD.student_id;
    END IF;
    RETURN OLD;
  END IF;

  -- TG_OP is INSERT or UPDATE
  IF COALESCE(TRIM(NEW.first_name), '') = '' THEN
    RETURN NEW;
  END IF;

  v_guardian_id := NULL;
  v_clean_cid := NULLIF(REGEXP_REPLACE(TRIM(COALESCE(NEW.citizen_id, '')), '[^0-9]', '', 'g'), '');

  -- 1. Match by citizen_id if valid
  IF v_clean_cid IS NOT NULL AND LENGTH(v_clean_cid) >= 10 THEN
    SELECT id INTO v_guardian_id FROM family.guardians WHERE citizen_id = v_clean_cid LIMIT 1;
  END IF;

  -- 2. Match by phone_number + first_name
  IF v_guardian_id IS NULL AND NEW.phone_number IS NOT NULL AND TRIM(NEW.phone_number) <> '' THEN
    SELECT id INTO v_guardian_id FROM family.guardians WHERE phone_number = TRIM(NEW.phone_number) AND first_name = TRIM(NEW.first_name) LIMIT 1;
  END IF;

  -- 3. Match by first_name + last_name
  IF v_guardian_id IS NULL AND TRIM(NEW.first_name) <> '' AND TRIM(COALESCE(NEW.last_name, '')) <> '' AND TRIM(NEW.last_name) <> '-' THEN
    SELECT id INTO v_guardian_id FROM family.guardians WHERE first_name = TRIM(NEW.first_name) AND last_name = TRIM(NEW.last_name) LIMIT 1;
  END IF;

  -- 4. Upsert guardian record
  IF v_guardian_id IS NULL THEN
    IF v_clean_cid IS NOT NULL AND LENGTH(v_clean_cid) >= 10 THEN
      INSERT INTO family.guardians (
        citizen_id, prefix, first_name, last_name, phone_number, occupation, line_user_id
      ) VALUES (
        v_clean_cid,
        NEW.prefix,
        COALESCE(NULLIF(TRIM(NEW.first_name), ''), 'ผู้ปกครอง'),
        COALESCE(NULLIF(TRIM(NEW.last_name), ''), '-'),
        COALESCE(NULLIF(TRIM(NEW.phone_number), ''), '000-000-0000'),
        NEW.occupation,
        NULLIF(TRIM(NEW.line_id), '')
      )
      ON CONFLICT (citizen_id) DO UPDATE
        SET prefix = EXCLUDED.prefix,
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            phone_number = EXCLUDED.phone_number,
            occupation = EXCLUDED.occupation,
            line_user_id = COALESCE(EXCLUDED.line_user_id, family.guardians.line_user_id),
            updated_at = now()
      RETURNING id INTO v_guardian_id;
    ELSE
      INSERT INTO family.guardians (
        citizen_id, prefix, first_name, last_name, phone_number, occupation, line_user_id
      ) VALUES (
        NULL,
        NEW.prefix,
        COALESCE(NULLIF(TRIM(NEW.first_name), ''), 'ผู้ปกครอง'),
        COALESCE(NULLIF(TRIM(NEW.last_name), ''), '-'),
        COALESCE(NULLIF(TRIM(NEW.phone_number), ''), '000-000-0000'),
        NEW.occupation,
        NULLIF(TRIM(NEW.line_id), '')
      )
      RETURNING id INTO v_guardian_id;
    END IF;
  ELSE
    UPDATE family.guardians
    SET prefix = COALESCE(NEW.prefix, prefix),
        first_name = COALESCE(NULLIF(TRIM(NEW.first_name), ''), first_name),
        last_name = CASE WHEN TRIM(COALESCE(NEW.last_name, '')) NOT IN ('', '-') THEN TRIM(NEW.last_name) ELSE last_name END,
        phone_number = COALESCE(NULLIF(TRIM(NEW.phone_number), ''), phone_number),
        citizen_id = COALESCE(v_clean_cid, citizen_id),
        occupation = COALESCE(NEW.occupation, occupation),
        line_user_id = COALESCE(NULLIF(TRIM(NEW.line_id), ''), line_user_id),
        updated_at = now()
    WHERE id = v_guardian_id;
  END IF;

  v_rel := CASE
    WHEN NEW.relationship IN ('บิดา', 'มารดา') THEN NEW.relationship
    ELSE 'ผู้ปกครองตามกฎหมาย'
  END;

  IF v_guardian_id IS NOT NULL AND NEW.student_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.students WHERE id = NEW.student_id) THEN
    INSERT INTO family.guardian_student_links (
      guardian_id, student_id, relationship, role_type, can_manage_pickup
    ) VALUES (
      v_guardian_id, NEW.student_id, v_rel, 'PRIMARY', true
    )
    ON CONFLICT (guardian_id, student_id) DO UPDATE
      SET relationship = EXCLUDED.relationship,
          updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_student_parents_to_family ON public.student_parents;
CREATE TRIGGER trg_sync_student_parents_to_family
  AFTER INSERT OR UPDATE OR DELETE ON public.student_parents
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_student_parents_to_family();

-- One-time idempotent backfill touch for existing student_parents rows
UPDATE public.student_parents
SET updated_at = COALESCE(updated_at, now())
WHERE first_name IS NOT NULL AND TRIM(first_name) <> '';

-- ----------------------------------------------------------------------------
-- 8. Cleanups & Backdoor Removal
-- ----------------------------------------------------------------------------
-- Remove seed backdoor admin account if present
DELETE FROM public.app_users WHERE id IN (SELECT id FROM auth.users WHERE email = 'admin@svportal.com');
DELETE FROM auth.users WHERE email = 'admin@svportal.com';

-- Remove false flat 27-THB lunch subsidy rule from AI collective memory
DELETE FROM public.nongfah_collective_memory
WHERE content ILIKE '%27 บาท%' OR topic ILIKE '%27 บาท%' OR content ILIKE '%27 THB%' OR topic ILIKE '%27 THB%';
