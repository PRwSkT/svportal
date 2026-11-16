-- Phase 20: Exam Studio Enhancements & Multi-Format Meta
-- Adds JSONB question_meta to academic_exam_questions to support:
-- 1. 9 Subjective Question Modes (short_fill, step_by_step_math, sub_questions, comparison_table, etc.)
-- 2. Diagnostic Misconception Distractor tags
-- 3. Dynamic Parametric Question variables
-- 4. Freehand strokes and advanced geometry metadata

ALTER TABLE academic_exam_questions
ADD COLUMN IF NOT EXISTS question_meta JSONB DEFAULT '{}'::jsonb;

-- Optional index for querying specific subjective question formats or tags
CREATE INDEX IF NOT EXISTS idx_academic_exam_questions_meta ON academic_exam_questions USING gin (question_meta);

COMMENT ON COLUMN academic_exam_questions.question_meta IS 'Stores rich pedagogical metadata, subjective question modes, rubric items, and diagnostic distractor tags with backward compatibility to choice_a..d';

-- Subjective scores storage for OMR teacher score bubble recognition (0-5 per subjective item)
ALTER TABLE academic_exam_submissions
ADD COLUMN IF NOT EXISTS subjective_scores JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN academic_exam_submissions.subjective_scores IS 'Stores teacher optical bubble subjective marks (0-5) or manual override subjective scores per question';

