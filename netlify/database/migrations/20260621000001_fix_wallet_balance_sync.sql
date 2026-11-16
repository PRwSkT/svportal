-- Migration: Unify Wallet Balance System
-- Problem: checkout_shop_transaction deducted from students.wallet_balance, 
-- while topup_wallet/deduct_wallet_balance updated wallet_accounts.balance.
-- Solution:
-- 1. Ensure all students have a wallet_account
-- 2. Sync students.wallet_balance to wallet_accounts.balance
-- 3. Update checkout_shop_transaction to use wallet_accounts
-- 4. Create trigger to keep students.wallet_balance automatically synced (as a read-only mirror)

-- 1. Ensure all students have a wallet_account
INSERT INTO wallet_accounts (student_id, balance)
SELECT id, COALESCE(wallet_balance, 0)
FROM students
WHERE id NOT IN (SELECT student_id FROM wallet_accounts)
ON CONFLICT (student_id) DO NOTHING;

-- 2. Sync wallet_accounts to students.wallet_balance where they differ (prioritize wallet_accounts)
UPDATE students s
SET wallet_balance = w.balance
FROM wallet_accounts w
WHERE s.id = w.student_id AND s.wallet_balance IS DISTINCT FROM w.balance;

-- 3. Update checkout_shop_transaction RPC to use wallet_accounts
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
    v_is_active boolean;
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

        -- Lock the wallet_accounts row instead of students
        SELECT balance, is_active INTO v_wallet_balance, v_is_active
        FROM wallet_accounts
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
        UPDATE wallet_accounts
        SET balance = balance - v_total_amount,
            updated_at = now()
        WHERE student_id = v_student_id;
        
        -- Also insert a wallet_transactions ledger entry for shop purchase!
        INSERT INTO wallet_transactions (
            student_id, type, amount,
            balance_before, balance_after,
            channel, cashier_note
        ) VALUES (
            v_student_id, 'purchase', v_total_amount,
            v_wallet_balance, v_wallet_balance - v_total_amount,
            'system', 'Shop Checkout Transaction: ' || v_transaction_id::text
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction_id
    );
END;
$$;

-- 4. Create trigger to sync wallet_accounts.balance -> students.wallet_balance
CREATE OR REPLACE FUNCTION sync_wallet_balance_to_students()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE students
    SET wallet_balance = NEW.balance,
        updated_at = now()
    WHERE id = NEW.student_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_wallet_balance ON wallet_accounts;
CREATE TRIGGER trg_sync_wallet_balance
AFTER UPDATE OF balance ON wallet_accounts
FOR EACH ROW
EXECUTE FUNCTION sync_wallet_balance_to_students();
