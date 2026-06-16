-- Create an admin user with password '1234'
DO $$
DECLARE
  new_user_id uuid := gen_random_uuid();
BEGIN
  -- 1. Create the user in Supabase Auth
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    'admin@svportal.com',
    crypt('1234', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"System Admin"}',
    now(),
    now()
  );

  -- 2. The trigger "on_auth_user_created" will automatically insert into app_users with role 'cashier'
  -- 3. We update the role to 'admin'
  UPDATE public.app_users 
  SET role = 'admin' 
  WHERE id = new_user_id;

END $$;
