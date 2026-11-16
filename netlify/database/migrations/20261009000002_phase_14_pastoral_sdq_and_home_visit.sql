-- Phase 14: Student Pastoral Care 360° (SDQ 25 Items & Mobile Home Visit)
-- Compliant with Department of Mental Health (กรมสุขภาพจิต) & MOE Pastoral Standards

-- 1. Student SDQ Evaluations Table
CREATE TABLE IF NOT EXISTS public.student_sdq_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  evaluator_type TEXT NOT NULL CHECK (evaluator_type IN ('teacher', 'parent', 'student')),
  evaluator_name TEXT,
  evaluator_id TEXT,
  academic_year TEXT NOT NULL DEFAULT '2568',
  term TEXT NOT NULL DEFAULT '1',
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  emotional_score INTEGER NOT NULL DEFAULT 0,
  conduct_score INTEGER NOT NULL DEFAULT 0,
  hyperactivity_score INTEGER NOT NULL DEFAULT 0,
  peer_score INTEGER NOT NULL DEFAULT 0,
  prosocial_score INTEGER NOT NULL DEFAULT 0,
  total_difficulties_score INTEGER NOT NULL DEFAULT 0,
  emotional_status TEXT NOT NULL DEFAULT 'normal' CHECK (emotional_status IN ('normal', 'borderline', 'abnormal')),
  conduct_status TEXT NOT NULL DEFAULT 'normal' CHECK (conduct_status IN ('normal', 'borderline', 'abnormal')),
  hyperactivity_status TEXT NOT NULL DEFAULT 'normal' CHECK (hyperactivity_status IN ('normal', 'borderline', 'abnormal')),
  peer_status TEXT NOT NULL DEFAULT 'normal' CHECK (peer_status IN ('normal', 'borderline', 'abnormal')),
  prosocial_status TEXT NOT NULL DEFAULT 'normal' CHECK (prosocial_status IN ('normal', 'borderline', 'abnormal')),
  total_status TEXT NOT NULL DEFAULT 'normal' CHECK (total_status IN ('normal', 'borderline', 'abnormal')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_student_sdq_eval UNIQUE (student_id, evaluator_type, academic_year, term)
);

-- Indexing for rapid queries
CREATE INDEX IF NOT EXISTS idx_sdq_student_id ON public.student_sdq_evaluations(student_id);
CREATE INDEX IF NOT EXISTS idx_sdq_year_term ON public.student_sdq_evaluations(academic_year, term);
CREATE INDEX IF NOT EXISTS idx_sdq_total_status ON public.student_sdq_evaluations(total_status);

-- 2. Student Home Visits Table
CREATE TABLE IF NOT EXISTS public.student_home_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  academic_year TEXT NOT NULL DEFAULT '2568',
  term TEXT NOT NULL DEFAULT '1',
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  visitor_teacher_id TEXT,
  visitor_teacher_name TEXT,
  gps_lat NUMERIC(10, 7),
  gps_lng NUMERIC(10, 7),
  address_visited TEXT,
  living_environment TEXT,
  family_relationship TEXT,
  economic_status TEXT,
  risk_issues TEXT[] DEFAULT '{}',
  audio_transcript TEXT,
  ai_summary TEXT,
  photos JSONB DEFAULT '[]'::jsonb,
  guardian_met TEXT,
  guardian_signature_url TEXT,
  status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('DRAFT', 'COMPLETED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_student_home_visit UNIQUE (student_id, academic_year, term)
);

CREATE INDEX IF NOT EXISTS idx_home_visits_student_id ON public.student_home_visits(student_id);
CREATE INDEX IF NOT EXISTS idx_home_visits_year_term ON public.student_home_visits(academic_year, term);

-- Enable RLS
ALTER TABLE public.student_sdq_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_home_visits ENABLE ROW LEVEL SECURITY;

-- Permissive policies for authenticated and service roles
CREATE POLICY "Permissive SDQ access for authenticated" ON public.student_sdq_evaluations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Permissive Home Visits access for authenticated" ON public.student_home_visits
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Anon read access for student_sdq_evaluations" ON public.student_sdq_evaluations
  FOR SELECT TO anon USING (true);

CREATE POLICY "Anon read access for student_home_visits" ON public.student_home_visits
  FOR SELECT TO anon USING (true);
