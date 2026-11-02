-- Migration: 20261102_fix_attendance_and_user_rls.sql
-- Description:
-- 1. Fix app_users SELECT policy so all authenticated school staff can resolve colleague names
--    (prevents 'ไม่ทราบชื่อ' / unknown name when viewed by non-admin users with feature access)
-- 2. Clean up and secure attendance_records RLS policies:
--    - Drop accidental public ALL policy
--    - Allow attendance managers (role admin/executive or assigned_features ? 'admin_attendance')
--      to view all attendance records

-- 1. Fix app_users SELECT policy
DROP POLICY IF EXISTS "Cashier can view own app_user record" ON public.app_users;
DROP POLICY IF EXISTS "Authenticated users can view app_users" ON public.app_users;

CREATE POLICY "Authenticated users can view app_users"
  ON public.app_users
  FOR SELECT
  TO authenticated
  USING (true);

-- 2. Fix attendance_records policies
DROP POLICY IF EXISTS "Service role can manage all attendance" ON public.attendance_records;
DROP POLICY IF EXISTS "Admins can view all attendance" ON public.attendance_records;
DROP POLICY IF EXISTS "Attendance managers can view all attendance" ON public.attendance_records;

CREATE POLICY "Attendance managers can view all attendance"
  ON public.attendance_records
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.app_users
      WHERE app_users.id = auth.uid()
      AND (
        app_users.role IN ('admin', 'executive')
        OR app_users.assigned_features ? 'admin_attendance'
      )
    )
  );
