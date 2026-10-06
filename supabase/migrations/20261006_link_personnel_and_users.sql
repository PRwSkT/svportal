-- ==========================================
-- SV Portal Phase 9: Link Personnel and App Users (Mail Accounts)
-- Description: Unifies personnel directory with auth.users / app_users
-- ==========================================

-- 1. Add email and user_id columns to personnel
ALTER TABLE public.personnel 
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_personnel_email ON public.personnel(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_personnel_user_id ON public.personnel(user_id);

-- 2. Add personnel_id column to app_users
ALTER TABLE public.app_users 
  ADD COLUMN IF NOT EXISTS personnel_id UUID REFERENCES public.personnel(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_app_users_personnel_id ON public.app_users(personnel_id);

-- 3. Add full admin access policy on personnel for authenticated users
DROP POLICY IF EXISTS "Allow admin full access on personnel" ON public.personnel;
CREATE POLICY "Allow admin full access on personnel"
  ON public.personnel FOR ALL TO authenticated USING (true);

-- 4. Sync trigger for Google SSO and new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_personnel RECORD;
  v_role TEXT := 'cashier';
  v_name TEXT;
BEGIN
  -- Look up in personnel by email
  SELECT * INTO v_personnel FROM public.personnel WHERE LOWER(email) = LOWER(NEW.email) LIMIT 1;
  
  IF v_personnel.id IS NOT NULL THEN
    v_name := v_personnel.name_th;
    IF v_personnel.category = 'executive' THEN
      v_role := 'executive';
    ELSIF v_personnel.category = 'teacher' THEN
      v_role := 'teacher';
    ELSIF v_personnel.category = 'staff' THEN
      v_role := 'non-academic staff';
    END IF;
  ELSE
    v_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);
  END IF;

  INSERT INTO public.app_users (id, full_name, role, is_active, personnel_id)
  VALUES (
    NEW.id,
    v_name,
    v_role,
    true,
    v_personnel.id
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    personnel_id = COALESCE(EXCLUDED.personnel_id, public.app_users.personnel_id);

  IF v_personnel.id IS NOT NULL THEN
    UPDATE public.personnel SET user_id = NEW.id WHERE id = v_personnel.id;
  END IF;

  RETURN NEW;
END;
$$;
