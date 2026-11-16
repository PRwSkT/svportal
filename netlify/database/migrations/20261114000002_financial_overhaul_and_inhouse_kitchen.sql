-- ============================================================================
-- 20261114000002 — Financial Overhaul (5-month installments, late fees, waiver
-- maker-checker, dual receipt series) + In-House Kitchen tables
--
-- Somkidvittaya School operating rules encoded here:
--   * Up to 5 monthly installments per term (Term 1: May–Sep, Term 2: Nov–Mar)
--   * Late fee = grace period + calculation mode + per-tranche cap + per-term cap
--   * Waivers are maker-checker (requester != reviewer) and post a credit note
--   * Receipts are split: Series 01 "REC-" (CGD-reimbursable tuition, COA 41110)
--     and Series 02 "SRV-" (in-house meal fee 41210, activities, late fee 44120)
--   * NO government lunch subsidy: meals are cooked in-house and included in tuition
--
-- Idempotent: safe to run more than once. All new tables have RLS enabled with
-- NO policies => reachable only through service_role (server routes after auth).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Chart of accounts (OPEC-style) with receipt series mapping
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
  code                  TEXT PRIMARY KEY,
  name_th               TEXT NOT NULL,
  name_en               TEXT,
  account_type          TEXT NOT NULL CHECK (account_type IN ('ASSET','LIABILITY','REVENUE','EXPENSE','CONTRA_REVENUE')),
  receipt_series        TEXT CHECK (receipt_series IN ('01','02')),
  is_cgd_reimbursable   BOOLEAN NOT NULL DEFAULT false,
  is_pass_through       BOOLEAN NOT NULL DEFAULT false,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.chart_of_accounts (code, name_th, name_en, account_type, receipt_series, is_cgd_reimbursable, is_pass_through) VALUES
  ('11210', 'ลูกหนี้ค่าธรรมเนียมการศึกษา',                         'Tuition Receivable',                         'ASSET',          NULL, false, false),
  ('41110', 'ค่าธรรมเนียมการเรียน',                                   'Tuition Fee',                                'REVENUE',        '01', true,  false),
  ('41130', 'ค่ากิจกรรมพัฒนาผู้เรียนและกิจกรรมเสริมหลักสูตร',        'Extracurricular & Activity Fee',             'REVENUE',        '02', false, false),
  ('41210', 'ค่าอาหารกลางวันและอาหารว่างโรงครัวภายใน',               'In-House Kitchen Meal Fee',                  'REVENUE',        '02', false, false),
  ('41310', 'ค่าหนังสือ อุปกรณ์การเรียน และเครื่องแบบ',               'Books, Supplies & Uniform (pass-through)',   'REVENUE',        '02', false, true),
  ('41410', 'ค่าประกันอุบัติเหตุนักเรียน',                            'Student Accident Insurance (pass-through)',  'REVENUE',        '02', false, true),
  ('41490', 'ส่วนลด/ยกเว้นค่าปรับชำระล่าช้า',                         'Late Fee Waiver / Discount',                 'CONTRA_REVENUE', NULL, false, false),
  ('44120', 'ค่าปรับชำระค่าธรรมเนียมล่าช้า',                          'Late Payment Fee',                           'REVENUE',        '02', false, false),
  ('52200', 'ค่าวัตถุดิบประกอบอาหารและวัสดุโรงครัว',                  'Kitchen Raw Materials & Supplies',           'EXPENSE',        NULL, false, false)
ON CONFLICT (code) DO NOTHING;

-- Optional classification columns on the existing fee catalogue.
ALTER TABLE public.fee_types ADD COLUMN IF NOT EXISTS coa_code TEXT REFERENCES public.chart_of_accounts(code);
ALTER TABLE public.fee_types ADD COLUMN IF NOT EXISTS is_installment_splittable BOOLEAN NOT NULL DEFAULT true;

-- ----------------------------------------------------------------------------
-- 2. Installment plans / agreements / schedules
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tuition_installment_plans (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year        TEXT NOT NULL,                     -- Buddhist Era, e.g. '2569'
  term                 SMALLINT NOT NULL CHECK (term IN (1, 2)),
  plan_name            TEXT NOT NULL,
  num_installments     SMALLINT NOT NULL CHECK (num_installments BETWEEN 2 AND 5),
  due_day_of_month     SMALLINT NOT NULL DEFAULT 5 CHECK (due_day_of_month BETWEEN 1 AND 28),
  initial_deposit_pct  NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (initial_deposit_pct BETWEEN 0 AND 60),
  is_active            BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (academic_year, term, num_installments)
);

CREATE TABLE IF NOT EXISTS public.student_installment_agreements (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id           TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  guardian_id          UUID,
  academic_year        TEXT NOT NULL,
  term                 SMALLINT NOT NULL CHECK (term IN (1, 2)),
  plan_id              UUID REFERENCES public.tuition_installment_plans(id) ON DELETE SET NULL,
  num_installments     SMALLINT NOT NULL CHECK (num_installments BETWEEN 2 AND 5),
  fee_item_ids         UUID[] NOT NULL DEFAULT '{}',
  total_principal      NUMERIC(12,2) NOT NULL CHECK (total_principal > 0),
  mandatory_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  deposit_pct          NUMERIC(5,2) NOT NULL DEFAULT 0,
  due_day_of_month     SMALLINT NOT NULL DEFAULT 5,
  status               TEXT NOT NULL DEFAULT 'PENDING_APPROVAL'
                         CHECK (status IN ('PENDING_APPROVAL','ACTIVE','COMPLETED','DEFAULTED','CANCELLED')),
  signed_agreement_url TEXT,
  signed_by_name       TEXT,
  signed_at            TIMESTAMPTZ,
  created_by           UUID,
  approved_by          UUID,
  approved_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_installment_agreement_student_term
  ON public.student_installment_agreements (student_id, academic_year, term)
  WHERE status <> 'CANCELLED';
CREATE INDEX IF NOT EXISTS idx_installment_agreement_student ON public.student_installment_agreements (student_id);
CREATE INDEX IF NOT EXISTS idx_installment_agreement_status  ON public.student_installment_agreements (status);

CREATE TABLE IF NOT EXISTS public.invoice_installment_schedules (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id            UUID NOT NULL REFERENCES public.student_installment_agreements(id) ON DELETE CASCADE,
  student_id              TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  installment_no          SMALLINT NOT NULL CHECK (installment_no BETWEEN 1 AND 5),
  due_date                DATE NOT NULL,
  principal_amount        NUMERIC(12,2) NOT NULL CHECK (principal_amount >= 0),
  paid_principal_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
  lines                   JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{coa_code, series, label, amount}]
  late_fee_charged        NUMERIC(12,2) NOT NULL DEFAULT 0,     -- frozen at payment time
  waived_late_fee         NUMERIC(12,2) NOT NULL DEFAULT 0,
  late_fee_fully_waived   BOOLEAN NOT NULL DEFAULT false,
  paid_late_fee           NUMERIC(12,2) NOT NULL DEFAULT 0,
  status                  TEXT NOT NULL DEFAULT 'UPCOMING'
                            CHECK (status IN ('UPCOMING','PARTIALLY_PAID','PAID','OVERDUE','DEFAULTED')),
  paid_at                 TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agreement_id, installment_no)
);
CREATE INDEX IF NOT EXISTS idx_installment_schedule_due ON public.invoice_installment_schedules (due_date) WHERE status <> 'PAID';
CREATE INDEX IF NOT EXISTS idx_installment_schedule_student ON public.invoice_installment_schedules (student_id);

-- Fee items that belong to an installment plan cannot be settled in full at the counter.
ALTER TABLE public.fee_items
  ADD COLUMN IF NOT EXISTS installment_agreement_id UUID REFERENCES public.student_installment_agreements(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- 3. Late fee policy, waiver workflow, credit notes, payments, receipt series
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.late_fee_policies (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year         TEXT NOT NULL,
  policy_name           TEXT NOT NULL DEFAULT 'นโยบายค่าปรับชำระล่าช้า',
  grace_period_days     INTEGER NOT NULL DEFAULT 5 CHECK (grace_period_days BETWEEN 0 AND 60),
  calculation_mode      TEXT NOT NULL DEFAULT 'FIXED_PER_TRANCHE'
                          CHECK (calculation_mode IN ('FIXED_PER_TRANCHE','DAILY_RATE','PERCENTAGE')),
  rate_amount           NUMERIC(10,2) NOT NULL DEFAULT 100 CHECK (rate_amount >= 0),  -- THB, THB/day, or % per month
  max_cap_per_tranche   NUMERIC(10,2) NOT NULL DEFAULT 500  CHECK (max_cap_per_tranche >= 0),
  max_cap_per_term      NUMERIC(10,2) NOT NULL DEFAULT 1000 CHECK (max_cap_per_term >= 0),
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_by            UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_late_fee_policy_active_year
  ON public.late_fee_policies (academic_year) WHERE is_active;

CREATE TABLE IF NOT EXISTS public.late_fee_waiver_requests (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id        UUID NOT NULL REFERENCES public.invoice_installment_schedules(id) ON DELETE CASCADE,
  agreement_id       UUID NOT NULL REFERENCES public.student_installment_agreements(id) ON DELETE CASCADE,
  student_id         TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  requested_amount   NUMERIC(12,2) NOT NULL CHECK (requested_amount >= 0),
  waive_full         BOOLEAN NOT NULL DEFAULT false,
  reason             TEXT NOT NULL,
  requested_by       UUID NOT NULL,
  requested_by_name  TEXT,
  status             TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  approved_amount    NUMERIC(12,2),
  reviewed_by        UUID,
  reviewed_by_name   TEXT,
  review_note        TEXT,
  reviewed_at        TIMESTAMPTZ,
  credit_note_id     UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_waiver_maker_checker CHECK (reviewed_by IS NULL OR reviewed_by <> requested_by)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_waiver_one_pending_per_schedule
  ON public.late_fee_waiver_requests (schedule_id) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_waiver_status ON public.late_fee_waiver_requests (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.late_fee_credit_notes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_number  TEXT NOT NULL UNIQUE,
  waiver_request_id   UUID NOT NULL REFERENCES public.late_fee_waiver_requests(id) ON DELETE RESTRICT,
  schedule_id         UUID NOT NULL REFERENCES public.invoice_installment_schedules(id) ON DELETE RESTRICT,
  student_id          TEXT NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  amount              NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  debit_account       TEXT NOT NULL DEFAULT '41490',
  credit_account      TEXT NOT NULL DEFAULT '11210',
  note                TEXT,
  created_by          UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.installment_payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id       UUID NOT NULL REFERENCES public.invoice_installment_schedules(id) ON DELETE RESTRICT,
  agreement_id      UUID NOT NULL REFERENCES public.student_installment_agreements(id) ON DELETE RESTRICT,
  student_id        TEXT NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  principal_paid    NUMERIC(12,2) NOT NULL,
  late_fee_paid     NUMERIC(12,2) NOT NULL DEFAULT 0,
  late_fee_waived   NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_paid        NUMERIC(12,2) NOT NULL,
  rec_number        TEXT UNIQUE,          -- Series 01
  rec_amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  srv_number        TEXT UNIQUE,          -- Series 02
  srv_amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  receipt_lines     JSONB NOT NULL DEFAULT '[]'::jsonb,
  payment_method    TEXT NOT NULL CHECK (payment_method IN ('cash','qr','transfer')),
  cashier_id        UUID,
  cashier_note      TEXT,
  idempotency_key   TEXT UNIQUE,
  paid_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_installment_payments_student ON public.installment_payments (student_id, paid_at DESC);

CREATE TABLE IF NOT EXISTS public.receipt_series_sequences (
  series_prefix  TEXT NOT NULL,
  academic_year  TEXT NOT NULL,
  last_number    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (series_prefix, academic_year)
);

-- Default policy for the current academic year (BE 2569). Director can edit in /admin/fees.
INSERT INTO public.late_fee_policies (academic_year, policy_name, grace_period_days, calculation_mode, rate_amount, max_cap_per_tranche, max_cap_per_term)
VALUES ('2569', 'ค่าปรับชำระล่าช้า ปีการศึกษา 2569 (ผ่อนผัน 5 วัน)', 5, 'FIXED_PER_TRANCHE', 100, 500, 1000)
ON CONFLICT DO NOTHING;

INSERT INTO public.tuition_installment_plans (academic_year, term, plan_name, num_installments, due_day_of_month, initial_deposit_pct) VALUES
  ('2569', 1, 'ภาคเรียนที่ 1 — ผ่อน 5 งวด (พ.ค.–ก.ย.)', 5, 5, 0),
  ('2569', 1, 'ภาคเรียนที่ 1 — ผ่อน 3 งวด (พ.ค.–ก.ค.)', 3, 5, 0),
  ('2569', 2, 'ภาคเรียนที่ 2 — ผ่อน 5 งวด (พ.ย.–มี.ค.)', 5, 5, 0),
  ('2569', 2, 'ภาคเรียนที่ 2 — ผ่อน 3 งวด (พ.ย.–ม.ค.)', 3, 5, 0)
ON CONFLICT (academic_year, term, num_installments) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. Functions
-- ----------------------------------------------------------------------------

-- 4.1 Series-aware receipt numbers. 'REC' delegates to the legacy counter so
-- numbering stays continuous; every other prefix (SRV, CN, ...) has its own counter.
CREATE OR REPLACE FUNCTION public.get_next_series_receipt_number(p_prefix TEXT, p_year TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next INTEGER;
BEGIN
  IF p_prefix = 'REC' THEN
    RETURN public.get_next_receipt_number(p_year);
  END IF;

  INSERT INTO public.receipt_series_sequences (series_prefix, academic_year, last_number)
  VALUES (p_prefix, p_year, 1)
  ON CONFLICT (series_prefix, academic_year)
  DO UPDATE SET last_number = public.receipt_series_sequences.last_number + 1
  RETURNING last_number INTO v_next;

  RETURN p_prefix || '-' || p_year || '-' || lpad(v_next::text, 5, '0');
END;
$$;

-- 4.2 Pure late-fee formula (mirrors src/lib/finance/installment-and-latefee-engine.ts)
CREATE OR REPLACE FUNCTION public.compute_late_fee_amount(
  p_mode TEXT, p_rate NUMERIC, p_cap_tranche NUMERIC, p_grace INTEGER,
  p_due DATE, p_outstanding NUMERIC, p_as_of DATE
) RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_outstanding <= 0 THEN 0::numeric
    WHEN (p_as_of - p_due) <= p_grace THEN 0::numeric
    ELSE LEAST(
      p_cap_tranche,
      ROUND(
        CASE p_mode
          WHEN 'FIXED_PER_TRANCHE' THEN p_rate
          WHEN 'DAILY_RATE'        THEN p_rate * ((p_as_of - p_due) - p_grace)
          WHEN 'PERCENTAGE'        THEN p_outstanding * (p_rate / 100.0) * CEIL(((p_as_of - p_due) - p_grace)::numeric / 30.0)
          ELSE 0
        END, 2)
    )
  END
$$;

-- 4.3 Late fee per tranche for an agreement, honouring the per-term cap
-- (tranches evaluated in order; PAID tranches keep their frozen fee).
CREATE OR REPLACE FUNCTION public.compute_agreement_late_fees(p_agreement_id UUID, p_as_of DATE DEFAULT NULL)
RETURNS TABLE (schedule_id UUID, computed_fee NUMERIC)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_as_of    DATE := COALESCE(p_as_of, (now() AT TIME ZONE 'Asia/Bangkok')::date);
  v_year     TEXT;
  v_policy   public.late_fee_policies%ROWTYPE;
  v_running  NUMERIC := 0;
  v_raw      NUMERIC;
  v_eff      NUMERIC;
  r          RECORD;
BEGIN
  SELECT academic_year INTO v_year FROM public.student_installment_agreements WHERE id = p_agreement_id;
  IF v_year IS NULL THEN RETURN; END IF;

  SELECT * INTO v_policy FROM public.late_fee_policies WHERE academic_year = v_year AND is_active LIMIT 1;
  IF NOT FOUND THEN
    v_policy.grace_period_days := 5;
    v_policy.calculation_mode := 'FIXED_PER_TRANCHE';
    v_policy.rate_amount := 100;
    v_policy.max_cap_per_tranche := 500;
    v_policy.max_cap_per_term := 1000;
  END IF;

  FOR r IN
    SELECT s.* FROM public.invoice_installment_schedules s
    WHERE s.agreement_id = p_agreement_id ORDER BY s.installment_no
  LOOP
    IF r.status = 'PAID' THEN
      v_eff := r.late_fee_charged;
      v_running := v_running + v_eff;
    ELSE
      v_raw := public.compute_late_fee_amount(
        v_policy.calculation_mode, v_policy.rate_amount, v_policy.max_cap_per_tranche,
        v_policy.grace_period_days, r.due_date, r.principal_amount - r.paid_principal_amount, v_as_of);
      v_eff := LEAST(v_raw, GREATEST(0, v_policy.max_cap_per_term - v_running));
      v_running := v_running + v_eff;
    END IF;
    schedule_id := r.id;
    computed_fee := v_eff;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- 4.4 Atomic tranche payment: principal + net late fee, dual receipt numbers.
CREATE OR REPLACE FUNCTION public.pay_installment_tranche(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule_id   UUID := (payload->>'schedule_id')::uuid;
  v_method        TEXT := payload->>'payment_method';
  v_cashier       UUID := NULLIF(payload->>'cashier_id', '')::uuid;
  v_note          TEXT := payload->>'cashier_note';
  v_idem          TEXT := NULLIF(payload->>'idempotency_key', '');
  s               public.invoice_installment_schedules%ROWTYPE;
  a               public.student_installment_agreements%ROWTYPE;
  v_existing      public.installment_payments%ROWTYPE;
  v_fee_raw       NUMERIC;
  v_waived        NUMERIC;
  v_fee_net       NUMERIC;
  v_outstanding   NUMERIC;
  v_rec_amount    NUMERIC;
  v_srv_amount    NUMERIC;
  v_rec_no        TEXT;
  v_srv_no        TEXT;
  v_lines         JSONB;
  v_pay_id        UUID;
  v_unpaid_before INTEGER;
  v_remaining     INTEGER;
  v_primary_no    TEXT;
BEGIN
  IF v_method NOT IN ('cash','qr','transfer') THEN
    RAISE EXCEPTION 'วิธีชำระเงินไม่ถูกต้อง';
  END IF;

  IF v_idem IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.installment_payments WHERE idempotency_key = v_idem;
    IF FOUND THEN
      RETURN jsonb_build_object('payment_id', v_existing.id, 'rec_number', v_existing.rec_number,
        'srv_number', v_existing.srv_number, 'total_paid', v_existing.total_paid, 'idempotent_replay', true);
    END IF;
  END IF;

  SELECT * INTO a FROM public.student_installment_agreements
   WHERE id = (SELECT agreement_id FROM public.invoice_installment_schedules WHERE id = v_schedule_id)
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ไม่พบงวดผ่อนชำระ'; END IF;
  IF a.status <> 'ACTIVE' THEN RAISE EXCEPTION 'แผนผ่อนชำระยังไม่ได้รับอนุมัติหรือสิ้นสุดแล้ว (%)', a.status; END IF;

  SELECT * INTO s FROM public.invoice_installment_schedules WHERE id = v_schedule_id FOR UPDATE;
  IF s.status = 'PAID' THEN RAISE EXCEPTION 'งวดนี้ชำระแล้ว'; END IF;

  SELECT count(*) INTO v_unpaid_before FROM public.invoice_installment_schedules
   WHERE agreement_id = a.id AND status <> 'PAID' AND installment_no < s.installment_no;
  IF v_unpaid_before > 0 THEN
    RAISE EXCEPTION 'กรุณาชำระงวดก่อนหน้าให้ครบก่อน (ชำระตามลำดับงวด)';
  END IF;

  SELECT computed_fee INTO v_fee_raw FROM public.compute_agreement_late_fees(a.id) WHERE schedule_id = s.id;
  v_fee_raw := COALESCE(v_fee_raw, 0);
  v_waived  := CASE WHEN s.late_fee_fully_waived THEN v_fee_raw ELSE LEAST(v_fee_raw, s.waived_late_fee) END;
  v_fee_net := GREATEST(0, v_fee_raw - v_waived);

  v_outstanding := s.principal_amount - s.paid_principal_amount;

  SELECT COALESCE(sum((l->>'amount')::numeric), 0) INTO v_rec_amount
    FROM jsonb_array_elements(s.lines) l WHERE l->>'series' = '01';
  SELECT COALESCE(sum((l->>'amount')::numeric), 0) INTO v_srv_amount
    FROM jsonb_array_elements(s.lines) l WHERE l->>'series' = '02';
  v_srv_amount := v_srv_amount + v_fee_net;

  v_lines := s.lines;
  IF v_fee_net > 0 THEN
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'coa_code', '44120', 'series', '02', 'label', 'ค่าปรับชำระล่าช้า', 'amount', v_fee_net));
  END IF;

  IF v_rec_amount > 0 THEN v_rec_no := public.get_next_series_receipt_number('REC', a.academic_year); END IF;
  IF v_srv_amount > 0 THEN v_srv_no := public.get_next_series_receipt_number('SRV', a.academic_year); END IF;

  INSERT INTO public.installment_payments (
    schedule_id, agreement_id, student_id, principal_paid, late_fee_paid, late_fee_waived, total_paid,
    rec_number, rec_amount, srv_number, srv_amount, receipt_lines, payment_method, cashier_id, cashier_note, idempotency_key
  ) VALUES (
    s.id, a.id, a.student_id, v_outstanding, v_fee_net, v_waived, v_outstanding + v_fee_net,
    v_rec_no, v_rec_amount, v_srv_no, v_srv_amount, v_lines, v_method, v_cashier, v_note, v_idem
  ) RETURNING id INTO v_pay_id;

  UPDATE public.invoice_installment_schedules
     SET status = 'PAID', paid_at = now(),
         paid_principal_amount = principal_amount,
         late_fee_charged = v_fee_raw,
         paid_late_fee = v_fee_net,
         waived_late_fee = v_waived
   WHERE id = s.id;

  -- Mirror into tuition_payments so cashier daily-close reports keep working.
  v_primary_no := COALESCE(v_rec_no, v_srv_no);
  INSERT INTO public.tuition_payments (student_id, fee_item_ids, total_amount, payment_method, receipt_number, cashier_note)
  VALUES (a.student_id, a.fee_item_ids, v_outstanding + v_fee_net, v_method, v_primary_no,
          'ผ่อนชำระงวดที่ ' || s.installment_no || '/' || a.num_installments
          || CASE WHEN v_rec_no IS NOT NULL AND v_srv_no IS NOT NULL THEN ' (คู่กับ ' || v_srv_no || ')' ELSE '' END
          || COALESCE(' — ' || v_note, ''));

  SELECT count(*) INTO v_remaining FROM public.invoice_installment_schedules
   WHERE agreement_id = a.id AND status <> 'PAID';
  IF v_remaining = 0 THEN
    UPDATE public.student_installment_agreements SET status = 'COMPLETED', updated_at = now() WHERE id = a.id;
    PERFORM set_config('app.installment_settlement', 'on', true);
    UPDATE public.fee_items SET status = 'paid', updated_at = now() WHERE id = ANY (a.fee_item_ids);
  END IF;

  RETURN jsonb_build_object(
    'payment_id', v_pay_id, 'rec_number', v_rec_no, 'rec_amount', v_rec_amount,
    'srv_number', v_srv_no, 'srv_amount', v_srv_amount,
    'principal_paid', v_outstanding, 'late_fee_paid', v_fee_net, 'late_fee_waived', v_waived,
    'total_paid', v_outstanding + v_fee_net, 'agreement_completed', (v_remaining = 0), 'lines', v_lines);
END;
$$;

-- 4.5 Maker-checker waiver review (requester can never approve their own request).
CREATE OR REPLACE FUNCTION public.review_late_fee_waiver(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_id UUID := (payload->>'request_id')::uuid;
  v_decision   TEXT := payload->>'decision';
  v_reviewer   UUID := (payload->>'reviewer_id')::uuid;
  v_name       TEXT := payload->>'reviewer_name';
  v_note       TEXT := payload->>'review_note';
  v_amount     NUMERIC := NULLIF(payload->>'approved_amount', '')::numeric;
  w            public.late_fee_waiver_requests%ROWTYPE;
  a            public.student_installment_agreements%ROWTYPE;
  v_current    NUMERIC;
  v_approved   NUMERIC;
  v_cn_no      TEXT;
  v_cn_id      UUID;
BEGIN
  IF v_decision NOT IN ('APPROVED','REJECTED') THEN RAISE EXCEPTION 'decision ต้องเป็น APPROVED หรือ REJECTED'; END IF;

  SELECT * INTO w FROM public.late_fee_waiver_requests WHERE id = v_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ไม่พบคำขอยกเว้นค่าปรับ'; END IF;
  IF w.status <> 'PENDING' THEN RAISE EXCEPTION 'คำขอนี้ถูกพิจารณาแล้ว (%)', w.status; END IF;
  IF w.requested_by = v_reviewer THEN RAISE EXCEPTION 'ผู้ขอไม่สามารถอนุมัติคำขอของตนเองได้ (Maker-Checker)'; END IF;

  IF v_decision = 'REJECTED' THEN
    UPDATE public.late_fee_waiver_requests
       SET status = 'REJECTED', reviewed_by = v_reviewer, reviewed_by_name = v_name,
           review_note = v_note, reviewed_at = now()
     WHERE id = w.id;
    RETURN jsonb_build_object('request_id', w.id, 'status', 'REJECTED');
  END IF;

  SELECT * INTO a FROM public.student_installment_agreements WHERE id = w.agreement_id;
  SELECT computed_fee INTO v_current FROM public.compute_agreement_late_fees(a.id) WHERE schedule_id = w.schedule_id;
  v_current := COALESCE(v_current, 0);
  v_approved := LEAST(COALESCE(v_amount, w.requested_amount), v_current);
  IF w.waive_full THEN v_approved := v_current; END IF;

  v_cn_no := public.get_next_series_receipt_number('CN', a.academic_year);

  INSERT INTO public.late_fee_credit_notes (credit_note_number, waiver_request_id, schedule_id, student_id, amount, note, created_by)
  VALUES (v_cn_no, w.id, w.schedule_id, w.student_id, v_approved, v_note, v_reviewer)
  RETURNING id INTO v_cn_id;

  UPDATE public.invoice_installment_schedules
     SET waived_late_fee = waived_late_fee + v_approved,
         late_fee_fully_waived = late_fee_fully_waived OR w.waive_full
   WHERE id = w.schedule_id;

  UPDATE public.late_fee_waiver_requests
     SET status = 'APPROVED', approved_amount = v_approved, reviewed_by = v_reviewer, reviewed_by_name = v_name,
         review_note = v_note, reviewed_at = now(), credit_note_id = v_cn_id
   WHERE id = w.id;

  RETURN jsonb_build_object('request_id', w.id, 'status', 'APPROVED', 'approved_amount', v_approved,
                            'credit_note_number', v_cn_no, 'debit_account', '41490', 'credit_account', '11210');
END;
$$;

-- 4.6 Guard: fee items inside an installment plan can only be settled by the
-- installment RPC (prevents a cashier paying the same tuition twice).
CREATE OR REPLACE FUNCTION public.guard_installment_fee_items()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid'
     AND OLD.installment_agreement_id IS NOT NULL
     AND COALESCE(current_setting('app.installment_settlement', true), 'off') <> 'on' THEN
    RAISE EXCEPTION 'รายการนี้อยู่ในแผนผ่อนชำระ กรุณาชำระรายงวดผ่านเมนูผ่อนชำระ';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_installment_fee_items ON public.fee_items;
CREATE TRIGGER trg_guard_installment_fee_items
  BEFORE UPDATE ON public.fee_items
  FOR EACH ROW EXECUTE FUNCTION public.guard_installment_fee_items();

-- 4.7 Function privileges: server routes only (service_role).
REVOKE ALL ON FUNCTION public.get_next_series_receipt_number(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.compute_agreement_late_fees(UUID, DATE)      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pay_installment_tranche(JSONB)                FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.review_late_fee_waiver(JSONB)                 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_series_receipt_number(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.compute_agreement_late_fees(UUID, DATE)    TO service_role;
GRANT EXECUTE ON FUNCTION public.pay_installment_tranche(JSONB)             TO service_role;
GRANT EXECUTE ON FUNCTION public.review_late_fee_waiver(JSONB)              TO service_role;

-- ----------------------------------------------------------------------------
-- 5. RLS: enabled on all financial overhaul tables, service_role only.
-- (Note: In-House Kitchen tables are maintained in 20261114000003_inhouse_kitchen_engine.sql)
-- ----------------------------------------------------------------------------
ALTER TABLE public.chart_of_accounts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tuition_installment_plans       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_installment_agreements  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_installment_schedules   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.late_fee_policies               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.late_fee_waiver_requests        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.late_fee_credit_notes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installment_payments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_series_sequences        ENABLE ROW LEVEL SECURITY;
