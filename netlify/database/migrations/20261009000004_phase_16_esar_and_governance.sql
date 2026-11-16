-- Phase 16: Sprint 6 - e-SAR Smart Engine & School Governance Hub
-- Compliant with Private Schools Act B.E. 2550 (Sec. 30, 32) & ONESQA / OPEC Standards

-- 1. Teacher Licenses Registry (คุรุสภา)
CREATE TABLE IF NOT EXISTS public.teacher_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_name TEXT NOT NULL,
  teacher_user_id UUID,
  citizen_id TEXT NOT NULL,
  license_type TEXT NOT NULL DEFAULT 'TEACHER' CHECK (license_type IN ('TEACHER', 'SCHOOL_ADMIN', 'SPECIAL_PERMISSION')),
  license_number TEXT NOT NULL,
  issue_date DATE NOT NULL,
  expire_date DATE NOT NULL,
  cpd_hours INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRING_SOON', 'EXPIRED')),
  ksp_document_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_teacher_license UNIQUE (citizen_id, license_number)
);

CREATE INDEX IF NOT EXISTS idx_teacher_licenses_expire ON public.teacher_licenses(expire_date);
CREATE INDEX IF NOT EXISTS idx_teacher_licenses_status ON public.teacher_licenses(status);

-- 2. School Board Meetings (คณะกรรมการบริหารโรงเรียน ม.30)
CREATE TABLE IF NOT EXISTS public.school_board_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year TEXT NOT NULL DEFAULT '2568',
  meeting_no INTEGER NOT NULL,
  meeting_date DATE NOT NULL,
  title TEXT NOT NULL,
  attendees JSONB DEFAULT '[]'::jsonb,
  agenda TEXT[] DEFAULT '{}',
  resolutions TEXT[] DEFAULT '{}',
  minutes_pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_board_meeting UNIQUE (academic_year, meeting_no)
);

CREATE INDEX IF NOT EXISTS idx_board_meetings_year ON public.school_board_meetings(academic_year);

-- 3. School Annual SAR Records (เล่มประเมินตนเอง e-SAR)
CREATE TABLE IF NOT EXISTS public.school_annual_sar_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year TEXT NOT NULL UNIQUE,
  school_name TEXT NOT NULL DEFAULT 'โรงเรียนสาธิตคริสเตียนวิทยา',
  school_code TEXT NOT NULL DEFAULT '1121100013',
  part1_general_info JSONB NOT NULL DEFAULT '{}'::jsonb,
  part2_standard1_quality JSONB NOT NULL DEFAULT '{}'::jsonb,
  part2_standard2_management JSONB NOT NULL DEFAULT '{}'::jsonb,
  part2_standard3_teaching JSONB NOT NULL DEFAULT '{}'::jsonb,
  part3_future_plan JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'COMPLETED', 'PUBLISHED')),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.teacher_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_board_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_annual_sar_records ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permissive teacher_licenses for authenticated') THEN
    CREATE POLICY "Permissive teacher_licenses for authenticated" ON public.teacher_licenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permissive board_meetings for authenticated') THEN
    CREATE POLICY "Permissive board_meetings for authenticated" ON public.school_board_meetings FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permissive sar_records for authenticated') THEN
    CREATE POLICY "Permissive sar_records for authenticated" ON public.school_annual_sar_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon read teacher_licenses') THEN
    CREATE POLICY "Anon read teacher_licenses" ON public.teacher_licenses FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon read board_meetings') THEN
    CREATE POLICY "Anon read board_meetings" ON public.school_board_meetings FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon read sar_records') THEN
    CREATE POLICY "Anon read sar_records" ON public.school_annual_sar_records FOR SELECT TO anon USING (true);
  END IF;
END $$;
