-- =========================================================================
-- SV Portal Phase 11: Online Exam / Quiz System with Anti-Cheating Engine
-- Somkidvittaya School
-- Date: 2026-10-08
-- =========================================================================

-- 1. Add quiz_settings JSONB column to forms table
ALTER TABLE public.forms 
ADD COLUMN IF NOT EXISTS quiz_settings JSONB DEFAULT NULL;

-- 2. Add quiz_score and proctor_log JSONB columns to form_responses table
ALTER TABLE public.form_responses 
ADD COLUMN IF NOT EXISTS quiz_score JSONB DEFAULT NULL;

ALTER TABLE public.form_responses 
ADD COLUMN IF NOT EXISTS proctor_log JSONB DEFAULT NULL;

-- 3. Create index for quiz responses query & integrity sorting
CREATE INDEX IF NOT EXISTS idx_form_responses_quiz_score ON public.form_responses USING gin (quiz_score);
CREATE INDEX IF NOT EXISTS idx_form_responses_proctor_log ON public.form_responses USING gin (proctor_log);
