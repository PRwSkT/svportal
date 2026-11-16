-- =============================================================================
-- Migration: 20261114000004_academic_history_and_rollover.sql
-- Academic History Archive & 2-Phase Academic Rollover Support
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.student_academic_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  academic_year TEXT NOT NULL,
  grade_level TEXT NOT NULL,
  classroom TEXT,
  gpax NUMERIC(4, 2),
  attendance_percent NUMERIC(5, 2),
  promotion_status TEXT NOT NULL DEFAULT 'PROMOTED' CHECK (promotion_status IN (
    'PROMOTED', 'GRADUATED', 'RETAINED', 'TRANSFERRED', 'WITHDRAWN'
  )),
  remedial_required BOOLEAN NOT NULL DEFAULT FALSE,
  remedial_notes TEXT,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_by TEXT,
  UNIQUE(student_id, academic_year)
);

CREATE INDEX IF NOT EXISTS idx_student_academic_history_student ON public.student_academic_history(student_id);
CREATE INDEX IF NOT EXISTS idx_student_academic_history_year ON public.student_academic_history(academic_year);

-- Enable RLS
ALTER TABLE public.student_academic_history ENABLE ROW LEVEL SECURITY;
