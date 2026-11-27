-- ============================================================================
-- Migration: 20261126000002_staff_leave_and_org_routing.sql
-- Description:
--   1. Create public.org_responsibility_roles for configurable school org
--      structure & leave notification routing (Director-only approval).
--   2. Create public.staff_leave_requests for staff leave & official duty
--      requests, approval history, attendance sync tracking, and notification audit.
--   3. Seed default school organizational roles and grant 'admin_leave' feature.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.org_responsibility_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key TEXT UNIQUE NOT NULL,
  title_th TEXT NOT NULL,
  description_th TEXT,
  category TEXT NOT NULL DEFAULT 'operations'
    CHECK (category IN ('approver', 'executive', 'department_head', 'operations', 'notification')),
  department_scope TEXT NOT NULL DEFAULT 'all',
  assigned_user_ids UUID[] NOT NULL DEFAULT ARRAY[]::uuid[],
  notify_on_submit BOOLEAN NOT NULL DEFAULT false,
  notify_on_approve BOOLEAN NOT NULL DEFAULT true,
  notify_on_reject BOOLEAN NOT NULL DEFAULT false,
  leave_types TEXT[] NOT NULL DEFAULT ARRAY['sick', 'personal', 'official_duty', 'maternity', 'ordination', 'other']::text[],
  can_approve BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_responsibility_roles_sort
  ON public.org_responsibility_roles (sort_order ASC, created_at ASC);

CREATE TABLE IF NOT EXISTS public.staff_leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_code TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  personnel_id UUID REFERENCES public.personnel(id) ON DELETE SET NULL,
  applicant_name TEXT NOT NULL,
  applicant_position TEXT,
  applicant_department TEXT NOT NULL DEFAULT 'ทั่วไป',
  leave_type TEXT NOT NULL
    CHECK (leave_type IN ('sick', 'personal', 'official_duty', 'maternity', 'ordination', 'other')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  duration_type TEXT NOT NULL DEFAULT 'full_day'
    CHECK (duration_type IN ('full_day', 'half_day_morning', 'half_day_afternoon')),
  working_dates DATE[] NOT NULL DEFAULT ARRAY[]::date[],
  total_days NUMERIC(4,1) NOT NULL DEFAULT 1.0,
  reason TEXT NOT NULL,
  destination TEXT,
  document_ref TEXT,
  contact_phone TEXT,
  substitute_note TEXT,
  attachment_path TEXT,
  attachment_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  approver_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approver_name TEXT,
  approved_at TIMESTAMPTZ,
  approver_comment TEXT,
  attendance_synced BOOLEAN NOT NULL DEFAULT false,
  attendance_synced_dates DATE[] NOT NULL DEFAULT ARRAY[]::date[],
  notified_recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT staff_leave_date_range_chk CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_staff_leave_requests_user_created
  ON public.staff_leave_requests (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_staff_leave_requests_status_start
  ON public.staff_leave_requests (status, start_date DESC);

CREATE INDEX IF NOT EXISTS idx_staff_leave_requests_date_range
  ON public.staff_leave_requests (start_date, end_date);

-- Enable RLS
ALTER TABLE public.org_responsibility_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_leave_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_roles_authenticated_read" ON public.org_responsibility_roles;
CREATE POLICY "org_roles_authenticated_read"
  ON public.org_responsibility_roles FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "org_roles_admin_manage" ON public.org_responsibility_roles;
CREATE POLICY "org_roles_admin_manage"
  ON public.org_responsibility_roles FOR ALL TO authenticated
  USING (public.get_user_role() IN ('admin', 'executive'))
  WITH CHECK (public.get_user_role() IN ('admin', 'executive'));

DROP POLICY IF EXISTS "staff_leave_select_own" ON public.staff_leave_requests;
CREATE POLICY "staff_leave_select_own"
  ON public.staff_leave_requests FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.get_user_role() IN ('admin', 'executive')
  );

DROP POLICY IF EXISTS "staff_leave_insert_own" ON public.staff_leave_requests;
CREATE POLICY "staff_leave_insert_own"
  ON public.staff_leave_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "staff_leave_update_own_or_exec" ON public.staff_leave_requests;
CREATE POLICY "staff_leave_update_own_or_exec"
  ON public.staff_leave_requests FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR public.get_user_role() IN ('admin', 'executive')
  )
  WITH CHECK (
    auth.uid() = user_id
    OR public.get_user_role() IN ('admin', 'executive')
  );

-- Seed default School Organizational Structure & Notification Routing
INSERT INTO public.org_responsibility_roles (
  role_key,
  title_th,
  description_th,
  category,
  department_scope,
  assigned_user_ids,
  notify_on_submit,
  notify_on_approve,
  notify_on_reject,
  leave_types,
  can_approve,
  is_active,
  sort_order
) VALUES
  (
    'director_approver',
    'ผู้อำนวยการโรงเรียน (ผู้อนุมัติหลัก)',
    'ผู้มีอำนาจพิจารณาอนุมัติ/ไม่อนุมัติคำขอลาและไปราชการของบุคลากรทุกตำแหน่ง',
    'approver',
    'all',
    ARRAY['113028b7-fedc-4ee1-acd6-bd7fc01a9fe4'::uuid],
    true,
    false,
    false,
    ARRAY['sick', 'personal', 'official_duty', 'maternity', 'ordination', 'other']::text[],
    true,
    true,
    1
  ),
  (
    'school_manager',
    'ผู้จัดการโรงเรียน',
    'รับทราบเมื่อผู้อำนวยการอนุมัติการลาหรือไปราชการของบุคลากรทุกฝ่าย',
    'executive',
    'all',
    ARRAY['dc565c4c-0267-4b7c-a5ae-89b13ced2418'::uuid],
    false,
    true,
    false,
    ARRAY['sick', 'personal', 'official_duty', 'maternity', 'ordination', 'other']::text[],
    false,
    true,
    2
  ),
  (
    'deputy_manager',
    'รองผู้จัดการโรงเรียน',
    'รับทราบและกำกับติดตามการปฏิบัติงานภาพรวมเมื่อผู้อำนวยการอนุมัติคำขอ',
    'executive',
    'all',
    ARRAY['8767fea9-22a2-4725-be1c-e6f5a6942ab1'::uuid],
    false,
    true,
    false,
    ARRAY['sick', 'personal', 'official_duty', 'maternity', 'ordination', 'other']::text[],
    false,
    true,
    3
  ),
  (
    'hr_admin',
    'ฝ่ายบุคคล / งานธุรการ (บันทึกเวลาทำงาน)',
    'บันทึกข้อมูลการลา/ไปราชการ ตรวจสอบเอกสารแนบ และติดตามสถิติเวลาทำงาน',
    'operations',
    'all',
    ARRAY['52a5f2c6-ce3c-46a1-a2be-4c40c5f34d8e'::uuid, 'd4c39418-f67d-41d8-8aac-1f196a0d85b7'::uuid, '6c03783d-e136-45ab-bd78-568e174491b0'::uuid],
    false,
    true,
    false,
    ARRAY['sick', 'personal', 'official_duty', 'maternity', 'ordination', 'other']::text[],
    false,
    true,
    4
  ),
  (
    'academic_affairs',
    'ฝ่ายวิชาการ (ประสานงานสอนแทน & ตารางสอน)',
    'รับแจ้งเตือนพร้อมโน้ตฝากงานเพื่อประสานงานการจัดสอนแทนและดูแลคาบสอน',
    'operations',
    'all',
    ARRAY[]::uuid[],
    false,
    true,
    false,
    ARRAY['sick', 'personal', 'official_duty', 'maternity', 'ordination', 'other']::text[],
    false,
    true,
    5
  ),
  (
    'head_early_years',
    'หัวหน้าแผนกปฐมวัย / เตรียมอนุบาล',
    'รับแจ้งเตือนเมื่อครูในแผนกปฐมวัยหรือเตรียมอนุบาลได้รับการอนุมัติลา/ไปราชการ',
    'department_head',
    'ปฐมวัย',
    ARRAY[]::uuid[],
    false,
    true,
    false,
    ARRAY['sick', 'personal', 'official_duty', 'maternity', 'ordination', 'other']::text[],
    false,
    true,
    6
  ),
  (
    'head_primary',
    'หัวหน้าแผนกประถมศึกษา',
    'รับแจ้งเตือนเมื่อครูในแผนกประถมศึกษาได้รับการอนุมัติลา/ไปราชการ',
    'department_head',
    'ประถมศึกษา',
    ARRAY[]::uuid[],
    false,
    true,
    false,
    ARRAY['sick', 'personal', 'official_duty', 'maternity', 'ordination', 'other']::text[],
    false,
    true,
    7
  ),
  (
    'head_bilingual',
    'หัวหน้าศูนย์สองภาษา (EP / Bilingual)',
    'รับแจ้งเตือนเมื่อครูในศูนย์สองภาษาได้รับการอนุมัติลา/ไปราชการ',
    'department_head',
    'ศูนย์สองภาษา',
    ARRAY[]::uuid[],
    false,
    true,
    false,
    ARRAY['sick', 'personal', 'official_duty', 'maternity', 'ordination', 'other']::text[],
    false,
    true,
    8
  ),
  (
    'finance_payroll',
    'ฝ่ายการเงิน / เบิกจ่ายราชการ',
    'รับแจ้งเตือนกรณีไปราชการ ลาคลอด หรือลากิจที่มีผลต่อการเบิกจ่าย/ค่าตอบแทน',
    'operations',
    'all',
    ARRAY['d4c39418-f67d-41d8-8aac-1f196a0d85b7'::uuid],
    false,
    true,
    false,
    ARRAY['official_duty', 'maternity', 'personal']::text[],
    false,
    true,
    9
  )
ON CONFLICT (role_key) DO NOTHING;

-- Grant 'admin_leave' feature to Director, Manager, Deputy Manager, and HR Support Staff
UPDATE public.app_users
SET assigned_features = CASE
  WHEN assigned_features IS NULL THEN '["admin_leave"]'::jsonb
  WHEN NOT (assigned_features @> '["admin_leave"]'::jsonb) THEN assigned_features || '["admin_leave"]'::jsonb
  ELSE assigned_features
END
WHERE id IN (
  '113028b7-fedc-4ee1-acd6-bd7fc01a9fe4'::uuid,
  'dc565c4c-0267-4b7c-a5ae-89b13ced2418'::uuid,
  '8767fea9-22a2-4725-be1c-e6f5a6942ab1'::uuid,
  '52a5f2c6-ce3c-46a1-a2be-4c40c5f34d8e'::uuid,
  'd4c39418-f67d-41d8-8aac-1f196a0d85b7'::uuid,
  '6c03783d-e136-45ab-bd78-568e174491b0'::uuid
);
