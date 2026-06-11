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
