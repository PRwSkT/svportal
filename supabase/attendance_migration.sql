-- Add assigned_features to app_users
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS assigned_features jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Create attendance_records table
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null default current_date,
  check_in_time timestamptz,
  check_in_lat numeric,
  check_in_lng numeric,
  check_out_time timestamptz,
  check_out_lat numeric,
  check_out_lng numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  UNIQUE(user_id, date)
);

-- Enable RLS
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- Policies for attendance_records
-- Users can view their own records
CREATE POLICY "Users can view own attendance" ON public.attendance_records FOR SELECT USING (auth.uid() = user_id);

-- Admins can view all records
CREATE POLICY "Admins can view all attendance" ON public.attendance_records FOR SELECT USING (
  EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role = 'admin')
);

-- Only service role (API) can insert/update to prevent spoofing time
-- Note: RLS is bypassed by service_role key automatically.
-- If we want users to insert directly, we could add a policy, but we'll use an API route for secure timestamps.
