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
