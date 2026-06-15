-- -----------------------------------------------------------------------------
-- Phase 6: Student Records (งานระเบียนนักเรียน)
-- -----------------------------------------------------------------------------

-- 1. Add status and profile_data to students table
ALTER TABLE public.students 
ADD COLUMN status text not null default 'active' check (status in ('active', 'graduated', 'dropped_out')),
ADD COLUMN profile_data jsonb not null default '{}'::jsonb;

-- 2. Ensure RLS is still intact and admin can access
-- (assuming RLS is enabled, but if not we can just re-affirm or add specific policies for students)
-- Usually students table is read by cashier, read/write by admin.
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Policy: Admin can do all
CREATE POLICY "Admin has full access to students"
  ON public.students
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin');

-- Policy: Cashier can read students
CREATE POLICY "Cashier can read students"
  ON public.students
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (public.get_user_role() = 'cashier');
