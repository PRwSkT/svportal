-- Migration: Comprehensive Pre-Deployment Fixes
-- Applied: 2026-09-08

-- 1. documents category constraint
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_category_check;
ALTER TABLE public.documents ADD CONSTRAINT documents_category_check 
  CHECK (category IN ('form', 'policy', 'other', 'manual', 'forms', 'policies', 'manuals'));

-- 2. calendar_events category constraint
ALTER TABLE public.calendar_events DROP CONSTRAINT IF EXISTS calendar_events_category_check;
ALTER TABLE public.calendar_events ADD CONSTRAINT calendar_events_category_check 
  CHECK (category IN ('academic', 'activity', 'other', 'holiday'));

-- 3. album_id on news table
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS album_id UUID REFERENCES public.albums(id) ON DELETE SET NULL;

-- 4. Automatic wallet creation trigger on students
CREATE OR REPLACE FUNCTION public.handle_new_student_wallet()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.wallet_accounts (student_id, balance)
    VALUES (NEW.id, 0.00)
    ON CONFLICT (student_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_create_student_wallet ON public.students;
CREATE TRIGGER trg_create_student_wallet
AFTER INSERT ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_student_wallet();

-- Ensure all current students have a wallet account
INSERT INTO public.wallet_accounts (student_id, balance)
SELECT id, 0.00 FROM public.students
ON CONFLICT (student_id) DO NOTHING;

-- 5. Create sync_wallet_balance_to_students function and trigger
CREATE OR REPLACE FUNCTION public.sync_wallet_balance_to_students()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.students
    SET wallet_balance = NEW.balance,
        updated_at = now()
    WHERE id = NEW.student_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_wallet_balance ON public.wallet_accounts;
CREATE TRIGGER trg_sync_wallet_balance
AFTER INSERT OR UPDATE OF balance ON public.wallet_accounts
FOR EACH ROW
EXECUTE FUNCTION public.sync_wallet_balance_to_students();

-- 6. Atomic & concurrency-safe get_next_receipt_number
CREATE OR REPLACE FUNCTION public.get_next_receipt_number(p_year text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_num integer;
BEGIN
  INSERT INTO public.receipt_sequences (academic_year, last_number)
  VALUES (p_year, 1)
  ON CONFLICT (academic_year)
  DO UPDATE SET last_number = public.receipt_sequences.last_number + 1
  RETURNING last_number INTO next_num;

  RETURN 'REC-' || p_year || '-' || lpad(next_num::text, 5, '0');
END;
$$;

-- 7. Add UPDATE policy on tuition_payments for slip upload
DROP POLICY IF EXISTS "Enable update for all authenticated users" ON public.tuition_payments;
CREATE POLICY "Enable update for all authenticated users" 
  ON public.tuition_payments FOR UPDATE TO authenticated USING (true);

-- 8. Add admin SELECT policy on news so drafts can be seen in CMS
DROP POLICY IF EXISTS "Allow admin full access on news" ON public.news;
CREATE POLICY "Allow admin full access on news"
  ON public.news FOR ALL TO authenticated USING (true);

-- 9. Drop and recreate student ID functions
DROP FUNCTION IF EXISTS public.get_max_student_id();
DROP FUNCTION IF EXISTS public.get_next_student_id(text);
DROP FUNCTION IF EXISTS public.get_next_student_id();
DROP FUNCTION IF EXISTS public.migrate_student_id(text, text);

-- 10. checkout_shop_transaction with daily limit enforcement and idempotency
CREATE OR REPLACE FUNCTION public.checkout_shop_transaction(payload jsonb)
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
    v_is_active boolean;
    v_daily_limit numeric(10,2);
    v_today_spent numeric(10,2);
BEGIN
    IF payload->>'id' IS NOT NULL THEN
        v_transaction_id := (payload->>'id')::uuid;
        IF EXISTS (SELECT 1 FROM public.shop_transactions WHERE id = v_transaction_id) THEN
            RETURN jsonb_build_object('success', true, 'transaction_id', v_transaction_id, 'duplicate', true);
        END IF;
    ELSE
        v_transaction_id := gen_random_uuid();
    END IF;

    v_student_id := payload->>'student_id';
    v_total_amount := (payload->>'total_amount')::numeric;
    v_payment_method := payload->>'payment_method';
    v_cashier_note := payload->>'cashier_note';
    v_items := payload->'items';

    IF v_items IS NULL OR jsonb_array_length(v_items) = 0 THEN
        RAISE EXCEPTION 'CART_EMPTY';
    END IF;

    IF v_payment_method = 'wallet' THEN
        IF v_student_id IS NULL THEN
            RAISE EXCEPTION 'STUDENT_ID_REQUIRED_FOR_WALLET';
        END IF;

        SELECT balance, is_active, daily_limit 
        INTO v_wallet_balance, v_is_active, v_daily_limit
        FROM public.wallet_accounts
        WHERE student_id = v_student_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'WALLET_NOT_FOUND';
        END IF;

        IF NOT v_is_active THEN
            RAISE EXCEPTION 'WALLET_INACTIVE';
        END IF;

        IF v_wallet_balance < v_total_amount THEN
            RAISE EXCEPTION 'INSUFFICIENT_WALLET';
        END IF;

        IF v_daily_limit IS NOT NULL THEN
            SELECT COALESCE(total_spent, 0) INTO v_today_spent
            FROM public.daily_spend_tracking
            WHERE student_id = v_student_id AND spend_date = current_date;

            IF NOT FOUND THEN
                v_today_spent := 0;
            END IF;

            IF (v_today_spent + v_total_amount) > v_daily_limit THEN
                RAISE EXCEPTION 'DAILY_LIMIT_EXCEEDED';
            END IF;
        END IF;
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
        v_product_id := (v_item->'product'->>'id')::uuid;
        v_qty := (v_item->>'quantity')::integer;

        SELECT stock_qty INTO v_current_stock
        FROM public.products
        WHERE id = v_product_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'PRODUCT_NOT_FOUND';
        END IF;

        IF v_current_stock < v_qty THEN
            RAISE EXCEPTION 'INSUFFICIENT_STOCK';
        END IF;

        UPDATE public.products
        SET stock_qty = stock_qty - v_qty,
            updated_at = now()
        WHERE id = v_product_id;
    END LOOP;

    INSERT INTO public.shop_transactions (id, student_id, items, total_amount, payment_method, cashier_note)
    VALUES (v_transaction_id, v_student_id, v_items, v_total_amount, v_payment_method, v_cashier_note);

    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
        v_product_id := (v_item->'product'->>'id')::uuid;
        v_qty := (v_item->>'quantity')::integer;

        INSERT INTO public.shop_transaction_items (transaction_id, product_id, product_name, unit_price, quantity, subtotal)
        VALUES (
            v_transaction_id,
            v_product_id,
            v_item->'product'->>'name',
            (v_item->'product'->>'price')::numeric,
            v_qty,
            (v_item->>'subtotal')::numeric
        );
    END LOOP;

    IF v_payment_method = 'wallet' THEN
        UPDATE public.wallet_accounts
        SET balance = balance - v_total_amount,
            updated_at = now()
        WHERE student_id = v_student_id;
        
        INSERT INTO public.wallet_transactions (
            student_id, type, amount,
            balance_before, balance_after,
            channel, cashier_note
        ) VALUES (
            v_student_id, 'purchase', v_total_amount,
            v_wallet_balance, v_wallet_balance - v_total_amount,
            'system', 'Shop Checkout Transaction: ' || v_transaction_id::text
        );

        INSERT INTO public.daily_spend_tracking (student_id, spend_date, total_spent)
        VALUES (v_student_id, current_date, v_total_amount)
        ON CONFLICT (student_id, spend_date)
        DO UPDATE SET total_spent = public.daily_spend_tracking.total_spent + v_total_amount;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction_id
    );
END;
$$;

-- 11. process_tuition_payment with duplicate prevention
CREATE OR REPLACE FUNCTION public.process_tuition_payment(payload jsonb)
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
    v_unpaid_count integer;
    v_expected_count integer;
BEGIN
    v_student_id := payload->>'student_id';
    SELECT ARRAY(SELECT jsonb_array_elements_text(payload->'fee_item_ids')::uuid) INTO v_fee_item_ids;
    v_expected_count := array_length(v_fee_item_ids, 1);
    
    IF v_expected_count IS NULL OR v_expected_count = 0 THEN
        RAISE EXCEPTION 'EMPTY_FEE_ITEMS';
    END IF;

    SELECT count(*) INTO v_unpaid_count
    FROM public.fee_items
    WHERE id = ANY(v_fee_item_ids) AND student_id = v_student_id AND status = 'unpaid'
    FOR UPDATE;

    IF v_unpaid_count <> v_expected_count THEN
        RAISE EXCEPTION 'FEES_ALREADY_PAID_OR_INVALID';
    END IF;

    v_total_amount := (payload->>'total_amount')::numeric;
    v_payment_method := payload->>'payment_method';
    v_year := payload->>'academic_year';

    v_receipt_number := public.get_next_receipt_number(v_year);

    INSERT INTO public.tuition_payments (
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

    UPDATE public.fee_items
    SET status = 'paid', updated_at = now()
    WHERE id = ANY(v_fee_item_ids);

    RETURN jsonb_build_object(
        'success', true, 
        'payment_id', v_payment_id,
        'receipt_number', v_receipt_number
    );
END;
$$;

-- 12. Student ID functions
CREATE OR REPLACE FUNCTION public.get_next_student_id(p_type text DEFAULT 'normal')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_max_id bigint;
BEGIN
    IF p_type = 'e' THEN
        SELECT COALESCE(MAX(NULLIF(regexp_replace(id, '^E', '', 'i'), '')::bigint), 0)
        INTO v_max_id
        FROM public.students
        WHERE id ILIKE 'E%';
        
        RETURN 'E' || lpad((v_max_id + 1)::text, 4, '0');
    ELSE
        SELECT COALESCE(MAX(NULLIF(regexp_replace(id, '[^0-9]', '', 'g'), '')::bigint), 0)
        INTO v_max_id
        FROM public.students
        WHERE id ~ '^[0-9]+$';

        IF v_max_id < 1000 THEN
            v_max_id := 1000;
        END IF;

        RETURN (v_max_id + 1)::text;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_max_student_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_max_id bigint;
BEGIN
    SELECT COALESCE(MAX(NULLIF(regexp_replace(id, '[^0-9]', '', 'g'), '')::bigint), 0)
    INTO v_max_id
    FROM public.students
    WHERE id ~ '^[0-9]+$';

    RETURN v_max_id::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.migrate_student_id(old_id text, new_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.students SET id = new_id WHERE id = old_id;
    UPDATE public.wallet_accounts SET student_id = new_id WHERE student_id = old_id;
    UPDATE public.wallet_transactions SET student_id = new_id WHERE student_id = old_id;
    UPDATE public.fee_items SET student_id = new_id WHERE student_id = old_id;
    UPDATE public.tuition_payments SET student_id = new_id WHERE student_id = old_id;
    UPDATE public.student_addresses SET student_id = new_id WHERE student_id = old_id;
    UPDATE public.student_parents SET student_id = new_id WHERE student_id = old_id;
    RETURN true;
END;
$$;

-- 13. RLS Policies Hardening
DROP POLICY IF EXISTS "Allow read wallet_accounts" ON public.wallet_accounts;
DROP POLICY IF EXISTS "Allow insert wallet_accounts" ON public.wallet_accounts;
DROP POLICY IF EXISTS "Allow update wallet_accounts" ON public.wallet_accounts;
DROP POLICY IF EXISTS "Staff can read wallet_accounts" ON public.wallet_accounts;

CREATE POLICY "Staff can read wallet_accounts"
  ON public.wallet_accounts FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('admin', 'cashier'));

CREATE POLICY "Admin can manage wallet_accounts"
  ON public.wallet_accounts FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "Allow read wallet_transactions" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Allow insert wallet_transactions" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Staff can read wallet_transactions" ON public.wallet_transactions;

CREATE POLICY "Staff can read wallet_transactions"
  ON public.wallet_transactions FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('admin', 'cashier'));

DROP POLICY IF EXISTS "Allow read daily_spend_tracking" ON public.daily_spend_tracking;
DROP POLICY IF EXISTS "Allow insert daily_spend_tracking" ON public.daily_spend_tracking;
DROP POLICY IF EXISTS "Allow update daily_spend_tracking" ON public.daily_spend_tracking;
DROP POLICY IF EXISTS "Staff can read daily_spend_tracking" ON public.daily_spend_tracking;

CREATE POLICY "Staff can read daily_spend_tracking"
  ON public.daily_spend_tracking FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('admin', 'cashier'));

DROP POLICY IF EXISTS "Enable update for students" ON public.students;
