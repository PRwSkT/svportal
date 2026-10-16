-- Phase 15: Sprint 5 - Digital Signature 15-Year Free Education (อร.1/1),
-- Child In-Van Safety Alert & Early-Warning School Infirmary Hub

-- 1. 15-Year Free Education Disbursements (แบบ อร.1/1)
CREATE TABLE IF NOT EXISTS public.subsidy_free15y_disbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  academic_year TEXT NOT NULL DEFAULT '2568',
  term TEXT NOT NULL DEFAULT '1',
  disbursement_type TEXT NOT NULL DEFAULT 'ALL',
  uniform_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  stationery_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  books_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  activities_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  recipient_name TEXT NOT NULL,
  recipient_relation TEXT NOT NULL DEFAULT 'บิดา/มารดา',
  recipient_citizen_id TEXT,
  signature_data TEXT NOT NULL,
  disbursed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disbursed_by TEXT,
  form_or1_1_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_student_free15y_term UNIQUE (student_id, academic_year, term, disbursement_type)
);

CREATE INDEX IF NOT EXISTS idx_free15y_student_id ON public.subsidy_free15y_disbursements(student_id);
CREATE INDEX IF NOT EXISTS idx_free15y_year_term ON public.subsidy_free15y_disbursements(academic_year, term);

-- 2. School Van Routes
CREATE TABLE IF NOT EXISTS public.school_van_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_name TEXT NOT NULL,
  license_plate TEXT NOT NULL,
  driver_name TEXT NOT NULL,
  driver_phone TEXT,
  teacher_supervisor_name TEXT,
  max_capacity INTEGER NOT NULL DEFAULT 15,
  student_ids TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. School Van Daily Student Logs
CREATE TABLE IF NOT EXISTS public.school_van_daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.school_van_routes(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  trip_type TEXT NOT NULL CHECK (trip_type IN ('morning', 'evening')),
  student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  boarded_at TIMESTAMPTZ,
  disembarked_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'WAITING' CHECK (status IN ('WAITING', 'BOARDED', 'DISEMBARKED', 'ABSENT')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_van_student_log UNIQUE (route_id, log_date, trip_type, student_id)
);

CREATE INDEX IF NOT EXISTS idx_van_logs_route_date ON public.school_van_daily_logs(route_id, log_date, trip_type);
CREATE INDEX IF NOT EXISTS idx_van_logs_student_id ON public.school_van_daily_logs(student_id);

-- 4. School Infirmary Visits
CREATE TABLE IF NOT EXISTS public.school_infirmary_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  visit_time TIME NOT NULL DEFAULT CURRENT_TIME,
  symptoms TEXT[] DEFAULT '{}',
  temperature_celsius NUMERIC(4, 1),
  treatment_given TEXT,
  medication_given TEXT,
  diagnosed_contagious_disease TEXT NOT NULL DEFAULT 'NONE' CHECK (diagnosed_contagious_disease IN ('NONE', 'HFMD', 'RSV', 'INFLUENZA', 'COVID', 'CHICKENPOX', 'OTHER')),
  rest_in_bed BOOLEAN NOT NULL DEFAULT FALSE,
  time_left TIME,
  nurse_teacher_name TEXT,
  parent_contacted BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_infirmary_student_id ON public.school_infirmary_visits(student_id);
CREATE INDEX IF NOT EXISTS idx_infirmary_visit_date ON public.school_infirmary_visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_infirmary_disease ON public.school_infirmary_visits(diagnosed_contagious_disease);

-- RLS Policies
ALTER TABLE public.subsidy_free15y_disbursements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_van_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_van_daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_infirmary_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permissive free15y for authenticated" ON public.subsidy_free15y_disbursements
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Permissive van_routes for authenticated" ON public.school_van_routes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Permissive van_logs for authenticated" ON public.school_van_daily_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Permissive infirmary for authenticated" ON public.school_infirmary_visits
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Anon read free15y" ON public.subsidy_free15y_disbursements FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read van_routes" ON public.school_van_routes FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read van_logs" ON public.school_van_daily_logs FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read infirmary" ON public.school_infirmary_visits FOR SELECT TO anon USING (true);
