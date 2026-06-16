-- -----------------------------------------------------------------------------
-- Phase 6: Student Records (Relational Schema)
-- -----------------------------------------------------------------------------

-- 1. Alter existing students table to add detailed fields
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS prefix text,
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS last_name text,
ADD COLUMN IF NOT EXISTS birth_date date,
ADD COLUMN IF NOT EXISTS gender text,
ADD COLUMN IF NOT EXISTS nationality text,
ADD COLUMN IF NOT EXISTS religion text,
ADD COLUMN IF NOT EXISTS height numeric(5,2),
ADD COLUMN IF NOT EXISTS weight numeric(5,2),
ADD COLUMN IF NOT EXISTS disability text,
ADD COLUMN IF NOT EXISTS enrolled_date date,
ADD COLUMN IF NOT EXISTS status text not null default 'กำลังศึกษาอยู่';

-- Note: We keep `id` as text (student_code) and `name` (full name) 
-- and `grade` (class_level) as they were originally created in Phase 2.

-- 2. Create student_addresses table
CREATE TABLE IF NOT EXISTS public.student_addresses (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students(id) on delete cascade,
  house_code text,
  house_number text,
  moo text,
  soi text,
  road text,
  sub_district text,
  district text,
  province text,
  zip_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Create student_parents table
CREATE TABLE IF NOT EXISTS public.student_parents (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students(id) on delete cascade,
  relationship text not null check (relationship in ('บิดา', 'มารดา', 'ผู้ปกครอง')),
  citizen_id text,
  prefix text,
  first_name text,
  last_name text,
  occupation text,
  salary text,
  phone_number text,
  status text, -- มีชีวิต / ถึงแก่กรรม
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. RLS Setup
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_parents ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist to recreate them
DROP POLICY IF EXISTS "Admin has full access to students" ON public.students;
DROP POLICY IF EXISTS "Cashier can read students" ON public.students;

CREATE POLICY "Admin has full access to students"
  ON public.students FOR ALL TO authenticated USING (public.get_user_role() = 'admin');

CREATE POLICY "Cashier can read students"
  ON public.students FOR SELECT TO authenticated USING (public.get_user_role() = 'cashier');

-- Addresses Policies
CREATE POLICY "Admin has full access to addresses"
  ON public.student_addresses FOR ALL TO authenticated USING (public.get_user_role() = 'admin');
CREATE POLICY "Cashier can read addresses"
  ON public.student_addresses FOR SELECT TO authenticated USING (public.get_user_role() = 'cashier');

-- Parents Policies
CREATE POLICY "Admin has full access to parents"
  ON public.student_parents FOR ALL TO authenticated USING (public.get_user_role() = 'admin');
CREATE POLICY "Cashier can read parents"
  ON public.student_parents FOR SELECT TO authenticated USING (public.get_user_role() = 'cashier');
