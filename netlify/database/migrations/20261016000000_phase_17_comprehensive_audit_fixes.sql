-- ============================================================================
-- Phase 17: Comprehensive System Audit & Database Integrity Fixes
-- ============================================================================

-- 1. Add missing columns on public.students queried by Pastoral, Subsidy, Van Safety, Infirmary, and e-SAR
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS student_id TEXT,
  ADD COLUMN IF NOT EXISTS classroom TEXT,
  ADD COLUMN IF NOT EXISTS allergies TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS medical_conditions TEXT DEFAULT '';

-- Backfill existing student rows
UPDATE public.students
SET
  student_id = COALESCE(NULLIF(student_id, ''), id),
  classroom = COALESCE(NULLIF(classroom, ''), NULLIF(split_part(grade, '/', 2), ''), '1'),
  allergies = COALESCE(allergies, ''),
  medical_conditions = COALESCE(medical_conditions, '');

-- Create trigger function to keep student_id and classroom synced on insert/update
CREATE OR REPLACE FUNCTION public.sync_student_derived_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.student_id IS NULL OR NEW.student_id = '' THEN
    NEW.student_id := NEW.id;
  END IF;
  IF NEW.classroom IS NULL OR NEW.classroom = '' THEN
    NEW.classroom := COALESCE(NULLIF(split_part(NEW.grade, '/', 2), ''), '1');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_sync_student_derived_fields
  BEFORE INSERT OR UPDATE ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_student_derived_fields();

-- 2. Fix default school_name on school_annual_sar_records
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'school_annual_sar_records'
  ) THEN
    ALTER TABLE public.school_annual_sar_records
      ALTER COLUMN school_name SET DEFAULT 'โรงเรียนสมคิดวิทยา';
    UPDATE public.school_annual_sar_records
      SET school_name = 'โรงเรียนสมคิดวิทยา'
      WHERE school_name = 'โรงเรียนสาธิตคริสเตียนวิทยา';
  END IF;
END $$;

-- 3. Fix deduct_wallet_balance to keep students.wallet_balance in sync and use Asia/Bangkok date
CREATE OR REPLACE FUNCTION public.deduct_wallet_balance(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id text;
  v_amount numeric(10, 2);
  v_reference_id text;
  v_cashier_note text;
  v_wallet_id uuid;
  v_current_balance numeric(10, 2);
  v_daily_limit numeric(10, 2);
  v_is_active boolean;
  v_new_balance numeric(10, 2);
  v_spent_today numeric(10, 2);
  v_tx_id uuid;
  v_today date;
BEGIN
  v_student_id := payload->>'student_id';
  v_amount := (payload->>'amount')::numeric;
  v_reference_id := payload->>'reference_id';
  v_cashier_note := payload->>'cashier_note';
  v_today := (now() AT TIME ZONE 'Asia/Bangkok')::date;

  IF v_student_id IS NULL OR v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_INPUT: Student ID and positive amount required';
  END IF;

  SELECT id, balance, daily_limit, is_active
  INTO v_wallet_id, v_current_balance, v_daily_limit, v_is_active
  FROM public.wallet_accounts
  WHERE student_id = v_student_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'WALLET_NOT_FOUND: No wallet account for student %', v_student_id;
  END IF;

  IF NOT v_is_active THEN
    RAISE EXCEPTION 'WALLET_FROZEN: Wallet account is inactive/frozen';
  END IF;

  IF v_current_balance < v_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: Available %, requested %', v_current_balance, v_amount;
  END IF;

  IF v_daily_limit > 0 THEN
    INSERT INTO public.daily_spend_tracking (student_id, spend_date, total_spent)
    VALUES (v_student_id, v_today, 0.00)
    ON CONFLICT (student_id, spend_date) DO NOTHING;

    SELECT total_spent INTO v_spent_today
    FROM public.daily_spend_tracking
    WHERE student_id = v_student_id AND spend_date = v_today
    FOR UPDATE;

    IF (v_spent_today + v_amount) > v_daily_limit THEN
      RAISE EXCEPTION 'DAILY_LIMIT_EXCEEDED: Limit %, already spent %, requested %', v_daily_limit, v_spent_today, v_amount;
    END IF;
  END IF;

  v_new_balance := v_current_balance - v_amount;

  UPDATE public.wallet_accounts
  SET balance = v_new_balance, updated_at = now()
  WHERE id = v_wallet_id;

  UPDATE public.students
  SET wallet_balance = v_new_balance, updated_at = now()
  WHERE id = v_student_id;

  INSERT INTO public.wallet_transactions (
    student_id, type, amount, balance_before, balance_after, channel, reference_id, cashier_note
  ) VALUES (
    v_student_id, 'purchase', v_amount, v_current_balance, v_new_balance, 'counter', v_reference_id, v_cashier_note
  ) RETURNING id INTO v_tx_id;

  IF v_daily_limit > 0 THEN
    UPDATE public.daily_spend_tracking
    SET total_spent = total_spent + v_amount
    WHERE student_id = v_student_id AND spend_date = v_today;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'balance_before', v_current_balance,
    'balance_after', v_new_balance
  );
END;
$$;

-- 4. Dedicated admin_adjust_wallet_balance RPC (bypasses canteen daily limit & records type = 'adjustment')
CREATE OR REPLACE FUNCTION public.admin_adjust_wallet_balance(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id text;
  v_amount numeric(10, 2);
  v_cashier_note text;
  v_wallet_id uuid;
  v_current_balance numeric(10, 2);
  v_new_balance numeric(10, 2);
  v_tx_id uuid;
BEGIN
  v_student_id := payload->>'student_id';
  v_amount := (payload->>'amount')::numeric;
  v_cashier_note := COALESCE(payload->>'cashier_note', 'Admin adjustment');

  IF v_student_id IS NULL OR v_amount IS NULL OR v_amount = 0 THEN
    RAISE EXCEPTION 'INVALID_INPUT: Student ID and non-zero amount required';
  END IF;

  SELECT id, balance
  INTO v_wallet_id, v_current_balance
  FROM public.wallet_accounts
  WHERE student_id = v_student_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    INSERT INTO public.wallet_accounts (student_id, balance, daily_limit, is_active)
    VALUES (v_student_id, 0.00, 0.00, true)
    RETURNING id, balance INTO v_wallet_id, v_current_balance;
  END IF;

  v_new_balance := v_current_balance + v_amount;

  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: Available %, adjustment %', v_current_balance, v_amount;
  END IF;

  UPDATE public.wallet_accounts
  SET balance = v_new_balance, updated_at = now()
  WHERE id = v_wallet_id;

  UPDATE public.students
  SET wallet_balance = v_new_balance, updated_at = now()
  WHERE id = v_student_id;

  INSERT INTO public.wallet_transactions (
    student_id, type, amount, balance_before, balance_after, channel, cashier_note
  ) VALUES (
    v_student_id, 'adjustment', abs(v_amount), v_current_balance, v_new_balance, 'system', v_cashier_note
  ) RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'balance_before', v_current_balance,
    'balance_after', v_new_balance
  );
END;
$$;
