-- Students Table
CREATE TABLE IF NOT EXISTS students (
  id             text primary key,               -- 4-5 digit numeric string
  name           text not null,
  grade          text,
  wallet_balance numeric(10,2) not null default 0 check (wallet_balance >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Products Table
CREATE TABLE IF NOT EXISTS products (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  price        numeric(10,2) not null check (price >= 0),  -- Thai Baht, 2 decimal places
  category     text,
  stock_qty    integer not null default 0 check (stock_qty >= 0),
  barcode      text unique,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Shop Transactions Table
CREATE TABLE IF NOT EXISTS shop_transactions (
  id              uuid primary key default gen_random_uuid(),
  student_id      text references students(id),  -- nullable: walk-in customer (no student card)
  items           jsonb not null,                -- snapshot of cart at time of sale
  total_amount    numeric(10,2) not null check (total_amount >= 0),  -- Thai Baht
  payment_method  text not null check (payment_method in ('cash', 'wallet')),
  cashier_note    text,
  created_at      timestamptz not null default now()
);

-- Shop Transaction Items Table (normalized line items)
CREATE TABLE IF NOT EXISTS shop_transaction_items (
  id              uuid primary key default gen_random_uuid(),
  transaction_id  uuid not null references shop_transactions(id) on delete cascade,
  product_id      uuid not null references products(id),
  product_name    text not null,   -- snapshot at time of sale
  unit_price      numeric(10,2) not null,
  quantity        integer not null check (quantity > 0),
  subtotal        numeric(10,2) not null
);

-- Basic RLS setup (Assuming 'cashier' and 'admin' roles or using service role for now)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_transaction_items ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users (or anon if appropriate for POS) to read active products
CREATE POLICY "Enable read access for all users on active products" ON products FOR SELECT USING (is_active = true);
CREATE POLICY "Enable read access for admins on all products" ON products FOR SELECT USING (true); -- Requires proper admin role check in real app
CREATE POLICY "Enable insert for authenticated users" ON shop_transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for authenticated users" ON shop_transaction_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for products" ON products FOR UPDATE USING (true); -- In reality, check admin/cashier role
CREATE POLICY "Enable update for students" ON students FOR UPDATE USING (true);

-- Checkout RPC for Atomic Transaction
CREATE OR REPLACE FUNCTION checkout_shop_transaction(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_transaction_id uuid;
    v_student_id text;
    v_total_amount numeric(10,2);
    v_payment_method text;
    v_cashier_note text;
    v_items jsonb;
    v_item jsonb;
    v_product_id uuid;
    v_qty integer;
    v_current_stock integer;
    v_wallet_balance numeric(10,2);
BEGIN
    v_student_id := payload->>'student_id';
    v_total_amount := (payload->>'total_amount')::numeric;
    v_payment_method := payload->>'payment_method';
    v_cashier_note := payload->>'cashier_note';
    v_items := payload->'items';

    -- Wallet check
    IF v_payment_method = 'wallet' THEN
        IF v_student_id IS NULL THEN
            RAISE EXCEPTION 'student_id is required for wallet payments';
        END IF;

        SELECT wallet_balance INTO v_wallet_balance
        FROM students
        WHERE id = v_student_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Student not found';
        END IF;

        IF v_wallet_balance < v_total_amount THEN
            RAISE EXCEPTION 'INSUFFICIENT_WALLET';
        END IF;
    END IF;

    -- Insert Transaction
    INSERT INTO shop_transactions (student_id, items, total_amount, payment_method, cashier_note)
    VALUES (v_student_id, v_items, v_total_amount, v_payment_method, v_cashier_note)
    RETURNING id INTO v_transaction_id;

    -- Deduct Stock and Insert Line Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
        v_product_id := (v_item->'product'->>'id')::uuid;
        v_qty := (v_item->>'quantity')::integer;

        UPDATE products
        SET stock_qty = stock_qty - v_qty
        WHERE id = v_product_id AND stock_qty >= v_qty
        RETURNING stock_qty INTO v_current_stock;

        IF v_current_stock IS NULL THEN
            RAISE EXCEPTION 'INSUFFICIENT_STOCK';
        END IF;

        INSERT INTO shop_transaction_items (transaction_id, product_id, product_name, unit_price, quantity, subtotal)
        VALUES (
            v_transaction_id,
            v_product_id,
            v_item->'product'->>'name',
            (v_item->'product'->>'price')::numeric,
            v_qty,
            (v_item->>'subtotal')::numeric
        );
    END LOOP;

    -- Deduct Wallet
    IF v_payment_method = 'wallet' THEN
        UPDATE students
        SET wallet_balance = wallet_balance - v_total_amount,
            updated_at = now()
        WHERE id = v_student_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'transaction_id', v_transaction_id);
END;
$$;
-- ==============================================================================
-- Phase 3: Tuition & Fee Collection
-- ==============================================================================

-- 1. fee_types
CREATE TABLE IF NOT EXISTS fee_types (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,              -- e.g. "ค่าเทอม 1/2568", "ค่าประกันอุบัติเหตุ"
  amount       numeric(10,2) not null,     -- Thai Baht, 2 decimal places
  academic_year text not null,             -- e.g. "2568"
  semester     text,                       -- "1", "2", or null for one-time fees
  due_date     date,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

-- 2. fee_items
CREATE TABLE IF NOT EXISTS fee_items (
  id              uuid primary key default gen_random_uuid(),
  student_id      text not null references students(id), -- 4–5 digit numeric string
  fee_type_id     uuid not null references fee_types(id),
  amount          numeric(10,2) not null,  -- Thai Baht
  status          text not null default 'unpaid' check (status in ('unpaid', 'paid', 'waived')),
  svportal_ref    text,                    -- nullable: filled when SVPortal integration is ready
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 3. tuition_payments
CREATE TABLE IF NOT EXISTS tuition_payments (
  id              uuid primary key default gen_random_uuid(),
  student_id      text not null references students(id), 
  fee_item_ids    uuid[] not null,         -- array of paid fee items
  total_amount    numeric(10,2) not null,  -- Thai Baht
  payment_method  text not null check (payment_method in ('cash', 'qr', 'transfer')),
  receipt_number  text not null unique,    -- running number
  slip_url        text,                    -- Google Drive URL / Image
  cashier_note    text,
  svportal_sync_at timestamptz,           
  created_at      timestamptz not null default now()
);

-- 4. receipt_sequences
CREATE TABLE IF NOT EXISTS receipt_sequences (
  academic_year  text primary key,         -- e.g. "2568"
  last_number    integer not null default 0
);
-- Seed current year
INSERT INTO receipt_sequences (academic_year, last_number) VALUES ('2568', 0) ON CONFLICT DO NOTHING;

-- RLS setup
ALTER TABLE fee_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tuition_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_sequences ENABLE ROW LEVEL SECURITY;

-- Simple policies (assuming authenticated users can access for POS, restrict to roles in reality)
CREATE POLICY "Enable read for all authenticated users" ON fee_types FOR SELECT USING (true);
CREATE POLICY "Enable insert for all authenticated users" ON fee_types FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable read for all authenticated users" ON fee_items FOR SELECT USING (true);
CREATE POLICY "Enable insert for all authenticated users" ON fee_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all authenticated users" ON fee_items FOR UPDATE USING (true);

CREATE POLICY "Enable read for all authenticated users" ON tuition_payments FOR SELECT USING (true);
CREATE POLICY "Enable insert for all authenticated users" ON tuition_payments FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all authenticated users" ON receipt_sequences FOR UPDATE USING (true);

-- ==============================================================================
-- RPC Functions
-- ==============================================================================

-- 1. Generate next receipt number (called internally by checkout)
CREATE OR REPLACE FUNCTION get_next_receipt_number(p_year text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  next_num integer;
BEGIN
  UPDATE receipt_sequences
  SET last_number = last_number + 1
  WHERE academic_year = p_year
  RETURNING last_number INTO next_num;

  IF NOT FOUND THEN
    INSERT INTO receipt_sequences (academic_year, last_number) VALUES (p_year, 1);
    next_num := 1;
  END IF;

  RETURN 'REC-' || p_year || '-' || lpad(next_num::text, 5, '0');
END;
$$;

-- 2. Process Tuition Payment (Atomic Write)
CREATE OR REPLACE FUNCTION process_tuition_payment(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_payment_id uuid;
    v_student_id text;
    v_fee_item_ids uuid[];
    v_total_amount numeric(10,2);
    v_payment_method text;
    v_year text;
    v_receipt_number text;
BEGIN
    v_student_id := payload->>'student_id';
    -- Extract uuid array properly
    SELECT ARRAY(SELECT jsonb_array_elements_text(payload->'fee_item_ids')::uuid) INTO v_fee_item_ids;
    
    v_total_amount := (payload->>'total_amount')::numeric;
    v_payment_method := payload->>'payment_method';
    v_year := payload->>'academic_year';

    -- Generate Receipt Number atomically
    v_receipt_number := get_next_receipt_number(v_year);

    -- Insert Tuition Payment
    INSERT INTO tuition_payments (
        student_id, 
        fee_item_ids, 
        total_amount, 
        payment_method, 
        receipt_number
    )
    VALUES (
        v_student_id, 
        v_fee_item_ids, 
        v_total_amount, 
        v_payment_method, 
        v_receipt_number
    )
    RETURNING id INTO v_payment_id;

    -- Mark fee items as paid
    UPDATE fee_items
    SET status = 'paid', updated_at = now()
    WHERE id = ANY(v_fee_item_ids) AND status = 'unpaid';

    RETURN jsonb_build_object(
        'success', true, 
        'payment_id', v_payment_id,
        'receipt_number', v_receipt_number
    );
END;
$$;
-- ==============================================================================
-- Phase 4: Wallet & NFC Card System
-- ==============================================================================

-- 1. wallet_accounts — one row per student
CREATE TABLE IF NOT EXISTS wallet_accounts (
  id              uuid primary key default gen_random_uuid(),
  student_id      text not null unique,          -- 4–5 digit numeric string
  balance         numeric(10,2) not null default 0.00
                  check (balance >= 0),           -- Thai Baht, never goes negative
  daily_limit     numeric(10,2),                  -- Thai Baht, null = no limit
  card_uid        text unique,                    -- NFC card UID (hex string, e.g. "A3F2C1B0")
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 2. wallet_transactions — immutable ledger
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id              uuid primary key default gen_random_uuid(),
  student_id      text not null,                  -- 4–5 digit numeric string
  type            text not null check (type in ('topup', 'purchase', 'refund', 'adjustment')),
  amount          numeric(10,2) not null,         -- Thai Baht, always positive
  balance_before  numeric(10,2) not null,         -- Thai Baht, snapshot before transaction
  balance_after   numeric(10,2) not null,         -- Thai Baht, snapshot after transaction
  channel         text check (channel in ('counter', 'svportal', 'system')),
  reference_id    text,                           -- shop_transaction.id for purchases
  svportal_ref    text,                           -- filled when topup from SVPortal
  cashier_note    text,
  created_at      timestamptz not null default now()
);

-- 3. daily_spend_tracking — per-student per-day spend totals
CREATE TABLE IF NOT EXISTS daily_spend_tracking (
  id              uuid primary key default gen_random_uuid(),
  student_id      text not null,                  -- 4–5 digit numeric string
  spend_date      date not null default current_date,
  total_spent     numeric(10,2) not null default 0.00, -- Thai Baht
  unique (student_id, spend_date)
);

-- ==============================================================================
-- RLS Policies
-- ==============================================================================

ALTER TABLE wallet_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_spend_tracking ENABLE ROW LEVEL SECURITY;

-- wallet_accounts: read + insert + update (for card linking, balance updates via RPC)
CREATE POLICY "Allow read wallet_accounts" ON wallet_accounts FOR SELECT USING (true);
CREATE POLICY "Allow insert wallet_accounts" ON wallet_accounts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update wallet_accounts" ON wallet_accounts FOR UPDATE USING (true);

-- wallet_transactions: read + insert ONLY (immutable ledger — no UPDATE/DELETE)
CREATE POLICY "Allow read wallet_transactions" ON wallet_transactions FOR SELECT USING (true);
CREATE POLICY "Allow insert wallet_transactions" ON wallet_transactions FOR INSERT WITH CHECK (true);

-- daily_spend_tracking: read + insert + update (for upsert pattern)
CREATE POLICY "Allow read daily_spend_tracking" ON daily_spend_tracking FOR SELECT USING (true);
CREATE POLICY "Allow insert daily_spend_tracking" ON daily_spend_tracking FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update daily_spend_tracking" ON daily_spend_tracking FOR UPDATE USING (true);

-- ==============================================================================
-- Seed: Create wallet_accounts for all existing students (balance = 0)
-- ==============================================================================
INSERT INTO wallet_accounts (student_id, balance)
SELECT id, 0.00 FROM students
ON CONFLICT (student_id) DO NOTHING;

-- ==============================================================================
-- RPC Function 1: topup_wallet
-- Atomically adds funds to a student's wallet
-- ==============================================================================
CREATE OR REPLACE FUNCTION topup_wallet(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_student_id    text;
    v_amount        numeric(10,2);
    v_channel       text;
    v_cashier_note  text;
    v_svportal_ref  text;
    v_balance_before numeric(10,2);
    v_balance_after  numeric(10,2);
    v_transaction_id uuid;
    v_is_active     boolean;
BEGIN
    v_student_id   := payload->>'student_id';
    v_amount       := (payload->>'amount')::numeric;
    v_channel      := payload->>'channel';
    v_cashier_note := payload->>'cashier_note';
    v_svportal_ref := payload->>'svportal_ref';

    IF v_amount <= 0 THEN
        RAISE EXCEPTION 'INVALID_AMOUNT';
    END IF;

    -- Lock the wallet row
    SELECT balance, is_active INTO v_balance_before, v_is_active
    FROM wallet_accounts
    WHERE student_id = v_student_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'WALLET_NOT_FOUND';
    END IF;

    IF NOT v_is_active THEN
        RAISE EXCEPTION 'WALLET_INACTIVE';
    END IF;

    v_balance_after := v_balance_before + v_amount;

    -- Update balance
    UPDATE wallet_accounts
    SET balance = v_balance_after,
        updated_at = now()
    WHERE student_id = v_student_id;

    -- Insert transaction record
    INSERT INTO wallet_transactions (
        student_id, type, amount,
        balance_before, balance_after,
        channel, svportal_ref, cashier_note
    ) VALUES (
        v_student_id, 'topup', v_amount,
        v_balance_before, v_balance_after,
        v_channel, v_svportal_ref, v_cashier_note
    ) RETURNING id INTO v_transaction_id;

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'balance_before', v_balance_before,
        'balance_after', v_balance_after
    );
END;
$$;

-- ==============================================================================
-- RPC Function 2: deduct_wallet_balance
-- Atomically deducts funds with daily limit + balance checks
-- ==============================================================================
CREATE OR REPLACE FUNCTION deduct_wallet_balance(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_student_id     text;
    v_amount         numeric(10,2);
    v_reference_id   text;
    v_balance_before numeric(10,2);
    v_balance_after  numeric(10,2);
    v_daily_limit    numeric(10,2);
    v_today_spent    numeric(10,2);
    v_transaction_id uuid;
    v_is_active      boolean;
BEGIN
    v_student_id   := payload->>'student_id';
    v_amount       := (payload->>'amount')::numeric;
    v_reference_id := payload->>'reference_id';

    IF v_amount <= 0 THEN
        RAISE EXCEPTION 'INVALID_AMOUNT';
    END IF;

    -- Lock the wallet row
    SELECT balance, daily_limit, is_active
    INTO v_balance_before, v_daily_limit, v_is_active
    FROM wallet_accounts
    WHERE student_id = v_student_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'WALLET_NOT_FOUND';
    END IF;

    IF NOT v_is_active THEN
        RAISE EXCEPTION 'WALLET_INACTIVE';
    END IF;

    -- Check sufficient balance
    IF v_balance_before < v_amount THEN
        RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
    END IF;

    -- Check daily spending limit
    IF v_daily_limit IS NOT NULL THEN
        SELECT COALESCE(total_spent, 0) INTO v_today_spent
        FROM daily_spend_tracking
        WHERE student_id = v_student_id AND spend_date = current_date;

        IF NOT FOUND THEN
            v_today_spent := 0;
        END IF;

        IF (v_today_spent + v_amount) > v_daily_limit THEN
            RAISE EXCEPTION 'DAILY_LIMIT_EXCEEDED';
        END IF;
    END IF;

    v_balance_after := v_balance_before - v_amount;

    -- Update balance
    UPDATE wallet_accounts
    SET balance = v_balance_after,
        updated_at = now()
    WHERE student_id = v_student_id;

    -- Insert transaction record
    INSERT INTO wallet_transactions (
        student_id, type, amount,
        balance_before, balance_after,
        reference_id
    ) VALUES (
        v_student_id, 'purchase', v_amount,
        v_balance_before, v_balance_after,
        v_reference_id
    ) RETURNING id INTO v_transaction_id;

    -- Upsert daily spend tracking
    INSERT INTO daily_spend_tracking (student_id, spend_date, total_spent)
    VALUES (v_student_id, current_date, v_amount)
    ON CONFLICT (student_id, spend_date)
    DO UPDATE SET total_spent = daily_spend_tracking.total_spent + v_amount;

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'balance_before', v_balance_before,
        'balance_after', v_balance_after
    );
END;
$$;
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
-- -----------------------------------------------------------------------------
-- Phase 5.1: Google SSO Auto-provisioning
-- -----------------------------------------------------------------------------

-- Create a function to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Insert into app_users with default role 'cashier'
  -- Google OAuth sets full_name in raw_user_meta_data
  INSERT INTO public.app_users (id, full_name, role, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'cashier',
    true
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Trigger the function every time a user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
