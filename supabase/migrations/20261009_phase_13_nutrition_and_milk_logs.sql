-- Migration: 20261009_phase_13_nutrition_and_milk_logs.sql
-- Description: Student Nutrition Logs, Growth Tracking, and Daily School Milk Logs

CREATE TABLE IF NOT EXISTS public.student_health_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    academic_year TEXT NOT NULL DEFAULT '2568',
    term INT NOT NULL DEFAULT 1,
    measurement_date DATE NOT NULL DEFAULT CURRENT_DATE,
    height NUMERIC(5,2),
    weight NUMERIC(5,2),
    bmi NUMERIC(4,1),
    weight_for_height TEXT,
    height_for_age TEXT,
    weight_for_age TEXT,
    recorded_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (student_id, academic_year, term)
);

CREATE TABLE IF NOT EXISTS public.daily_milk_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    grade TEXT NOT NULL,
    academic_year TEXT NOT NULL DEFAULT '2568',
    term INT NOT NULL DEFAULT 1,
    present_count INT NOT NULL DEFAULT 0,
    milk_consumed_count INT NOT NULL DEFAULT 0,
    dairy_allergy_count INT NOT NULL DEFAULT 0,
    flavor TEXT DEFAULT 'รสจืด',
    packaging TEXT DEFAULT 'UHT',
    notes TEXT,
    recorded_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (date, grade)
);

-- Enable RLS
ALTER TABLE public.student_health_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_milk_logs ENABLE ROW LEVEL SECURITY;

-- Policies for student_health_logs
CREATE POLICY "Allow authenticated read student_health_logs"
    ON public.student_health_logs FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated insert/update student_health_logs"
    ON public.student_health_logs FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Policies for daily_milk_logs
CREATE POLICY "Allow authenticated read daily_milk_logs"
    ON public.daily_milk_logs FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated insert/update daily_milk_logs"
    ON public.daily_milk_logs FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_health_logs_student_id ON public.student_health_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_health_logs_year_term ON public.student_health_logs(academic_year, term);
CREATE INDEX IF NOT EXISTS idx_milk_logs_date_grade ON public.daily_milk_logs(date, grade);
