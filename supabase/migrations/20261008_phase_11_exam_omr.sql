-- Migration: Phase 11 - Smart Exam Maker & OMR Paper Grading
-- Description: Tables for Exam Creation, Multi-Set (A/B/C) Shuffling, Answer Keys, and OMR Submissions

CREATE TABLE IF NOT EXISTS academic_exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    course_id UUID NOT NULL REFERENCES academic_courses(id) ON DELETE CASCADE,
    gradebook_id UUID REFERENCES academic_gradebooks(id) ON DELETE SET NULL,
    academic_year TEXT NOT NULL DEFAULT '2568',
    term TEXT NOT NULL DEFAULT '1',
    exam_type TEXT NOT NULL DEFAULT 'midterm' CHECK (exam_type IN ('midterm', 'final', 'quiz', 'unit_test')),
    total_questions INTEGER NOT NULL DEFAULT 20,
    max_score NUMERIC(5,2) NOT NULL DEFAULT 20,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    instructions TEXT,
    created_by UUID REFERENCES personnel(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS academic_exam_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES academic_exams(id) ON DELETE CASCADE,
    question_number INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    question_image_url TEXT,
    choice_a TEXT NOT NULL,
    choice_b TEXT NOT NULL,
    choice_c TEXT NOT NULL,
    choice_d TEXT NOT NULL,
    correct_choice TEXT NOT NULL CHECK (correct_choice IN ('A', 'B', 'C', 'D')),
    indicator_code TEXT, -- e.g. ค 1.1 ป.3/1 (สพฐ. Indicator)
    points NUMERIC(4,2) NOT NULL DEFAULT 1.0,
    pin_choice_position BOOLEAN NOT NULL DEFAULT false, -- If true, choice e.g. ถูกทุกข้อ cannot be shuffled to A/B/C
    pinned_choice_index TEXT, -- 'D' or null
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS academic_exam_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES academic_exams(id) ON DELETE CASCADE,
    set_name TEXT NOT NULL CHECK (set_name IN ('A', 'B', 'C', 'D')),
    question_order_mapping JSONB NOT NULL DEFAULT '[]'::jsonb,
    answer_key JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    UNIQUE(exam_id, set_name)
);

CREATE TABLE IF NOT EXISTS academic_exam_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES academic_exams(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    set_name TEXT NOT NULL DEFAULT 'A',
    student_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    raw_score NUMERIC(5,2) NOT NULL DEFAULT 0,
    total_score NUMERIC(5,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'GRADED' CHECK (status IN ('GRADED', 'FLAGGED_AMBIGUOUS', 'MANUAL_OVERRIDE')),
    is_damaged_or_spill BOOLEAN NOT NULL DEFAULT false,
    manual_override BOOLEAN NOT NULL DEFAULT false,
    override_reason TEXT,
    scanned_image_url TEXT,
    scanned_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    UNIQUE(exam_id, student_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_academic_exams_course ON academic_exams(course_id);
CREATE INDEX IF NOT EXISTS idx_academic_exam_q_exam ON academic_exam_questions(exam_id, question_number);
CREATE INDEX IF NOT EXISTS idx_academic_exam_sets_exam ON academic_exam_sets(exam_id);
CREATE INDEX IF NOT EXISTS idx_academic_exam_sub_exam_student ON academic_exam_submissions(exam_id, student_id);

-- RLS Enablement
ALTER TABLE academic_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_exam_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_exam_submissions ENABLE ROW LEVEL SECURITY;

-- Permissive RLS Policies
DROP POLICY IF EXISTS "Allow public read on academic_exams" ON academic_exams;
DROP POLICY IF EXISTS "Allow authenticated manage on academic_exams" ON academic_exams;
CREATE POLICY "Allow public read on academic_exams" ON academic_exams FOR SELECT USING (true);
CREATE POLICY "Allow authenticated manage on academic_exams" ON academic_exams FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow public read on academic_exam_questions" ON academic_exam_questions;
DROP POLICY IF EXISTS "Allow authenticated manage on academic_exam_questions" ON academic_exam_questions;
CREATE POLICY "Allow public read on academic_exam_questions" ON academic_exam_questions FOR SELECT USING (true);
CREATE POLICY "Allow authenticated manage on academic_exam_questions" ON academic_exam_questions FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow public read on academic_exam_sets" ON academic_exam_sets;
DROP POLICY IF EXISTS "Allow authenticated manage on academic_exam_sets" ON academic_exam_sets;
CREATE POLICY "Allow public read on academic_exam_sets" ON academic_exam_sets FOR SELECT USING (true);
CREATE POLICY "Allow authenticated manage on academic_exam_sets" ON academic_exam_sets FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow public read on academic_exam_submissions" ON academic_exam_submissions;
DROP POLICY IF EXISTS "Allow authenticated manage on academic_exam_submissions" ON academic_exam_submissions;
CREATE POLICY "Allow public read on academic_exam_submissions" ON academic_exam_submissions FOR SELECT USING (true);
CREATE POLICY "Allow authenticated manage on academic_exam_submissions" ON academic_exam_submissions FOR ALL USING (true);
