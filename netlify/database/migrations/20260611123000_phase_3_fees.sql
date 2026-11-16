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
