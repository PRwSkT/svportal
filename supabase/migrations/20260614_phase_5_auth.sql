-- -----------------------------------------------------------------------------
-- Phase 5: Admin Dashboard, Reports, Auth & Audit Trail
-- -----------------------------------------------------------------------------

-- 1. Create app_users table (extends auth.users with role)
CREATE TABLE public.app_users (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  role        text not null check (role in ('cashier', 'admin')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Enable RLS on app_users
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

-- 2. Create audit_logs table for immutable write history
CREATE TABLE public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.app_users(id),
  user_name   text,                    -- snapshot in case user deleted
  action      text not null,           -- e.g. 'topup_wallet', 'mark_fee_paid', 'edit_product'
  table_name  text not null,
  record_id   text not null,           -- the affected row ID
  old_value   jsonb,                   -- snapshot before change (null for INSERT)
  new_value   jsonb,                   -- snapshot after change (null for DELETE)
  ip_address  text,
  created_at  timestamptz not null default now()
);

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 3. Helper function to get current user's role securely
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT role FROM public.app_users WHERE id = auth.uid();
$$;

-- 4. RLS Policies for app_users
-- Admin can do everything on app_users
CREATE POLICY "Admin has full access to app_users"
  ON public.app_users
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin');

-- Cashier can only view their own record
CREATE POLICY "Cashier can view own app_user record"
  ON public.app_users
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- 5. RLS Policies for audit_logs
-- Admin can view all audit_logs
CREATE POLICY "Admin can view all audit_logs"
  ON public.audit_logs
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (public.get_user_role() = 'admin');

-- Cashier can view only their own audit_logs
CREATE POLICY "Cashier can view own audit_logs"
  ON public.audit_logs
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Everyone authenticated can insert audit_logs (fire-and-forget by the application)
CREATE POLICY "Authenticated users can insert audit_logs"
  ON public.audit_logs
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- No one can UPDATE or DELETE audit_logs (immutable)
-- (No policies for UPDATE/DELETE means they are denied by default)
