import {
  LateFeeMode,
  ReceiptSeries,
  PaymentMethod,
  AgreementStatus,
  TrancheStatus,
  LateFeePolicy,
  DEFAULT_LATE_FEE_POLICY,
  FeeLineInput,
  ReceiptLine,
  BuiltTranche,
  BuiltSchedule,
  ScheduleRowLike,
  TrancheLateFeeView,
  COA_CODES,
  COA_META,
  RECEIPT_SERIES_LABELS,
  classifyFeeCoa,
  seriesForCoa,
  roundBaht,
  bangkokDateString,
  diffDays,
  addDaysYmd,
  TERM_MONTHS,
  buildDueDates,
  computeLateFeeAmount,
  computeAgreementLateFees,
  buildInstallmentSchedule,
  DualReceiptPreview,
  splitDualReceipt,
  splitFeeItemsToDualReceipt,
  InstallmentPlanRow,
  AgreementRow,
  ScheduleRow,
  AgreementWithSchedule,
  WaiverRequestRow,
  FinanceOverview
} from "./installment-types-and-pure";

export * from "./installment-types-and-pure";

// ===========================================================================
// SERVER SERVICE LAYER (service_role). Authenticate in the route BEFORE calling.
// ===========================================================================

type Json = Record<string, unknown>;

async function adminDb() {
  const { getAdminClient } = await import('@/lib/supabase/admin');
  return getAdminClient();
}

const num = (v: unknown): number => Number(v ?? 0) || 0;

function mapPolicy(row: Json | null, academicYear: string): LateFeePolicy {
  if (!row) return { ...DEFAULT_LATE_FEE_POLICY, academic_year: academicYear };
  return {
    id: String(row.id),
    academic_year: String(row.academic_year),
    policy_name: String(row.policy_name ?? ''),
    grace_period_days: num(row.grace_period_days),
    calculation_mode: row.calculation_mode as LateFeeMode,
    rate_amount: num(row.rate_amount),
    max_cap_per_tranche: num(row.max_cap_per_tranche),
    max_cap_per_term: num(row.max_cap_per_term),
    is_active: Boolean(row.is_active),
  };
}

export async function getLateFeePolicy(academicYear: string): Promise<LateFeePolicy> {
  try {
    const db = await adminDb();
    const { data } = await db
      .from('late_fee_policies')
      .select('*')
      .eq('academic_year', academicYear)
      .eq('is_active', true)
      .maybeSingle();
    return mapPolicy((data as Json) ?? null, academicYear);
  } catch {
    return { ...DEFAULT_LATE_FEE_POLICY, academic_year: academicYear };
  }
}

export async function upsertLateFeePolicy(
  input: Omit<LateFeePolicy, 'id' | 'is_active'>,
  userId: string | null
): Promise<LateFeePolicy> {
  if (!['FIXED_PER_TRANCHE', 'DAILY_RATE', 'PERCENTAGE'].includes(input.calculation_mode)) {
    throw new Error('โหมดการคำนวณค่าปรับไม่ถูกต้อง');
  }
  if (input.grace_period_days < 0 || input.grace_period_days > 60) throw new Error('ช่วงผ่อนผันต้องอยู่ระหว่าง 0–60 วัน');
  if (input.rate_amount < 0 || input.max_cap_per_tranche < 0 || input.max_cap_per_term < 0) throw new Error('ค่าที่กำหนดต้องไม่ติดลบ');
  if (input.max_cap_per_term < input.max_cap_per_tranche) throw new Error('เพดานรวมต่อภาคเรียนต้องไม่น้อยกว่าเพดานต่อสัญญา/งวด');

  const db = await adminDb();
  const { data: previous } = await db
    .from('late_fee_policies')
    .select('id')
    .eq('academic_year', input.academic_year)
    .eq('is_active', true);

  await db.from('late_fee_policies').update({ is_active: false }).eq('academic_year', input.academic_year).eq('is_active', true);
  const { data, error } = await db
    .from('late_fee_policies')
    .insert({
      academic_year: input.academic_year,
      policy_name: input.policy_name || `ค่าปรับชำระล่าช้า ปีการศึกษา ${input.academic_year}`,
      grace_period_days: Math.floor(input.grace_period_days),
      calculation_mode: input.calculation_mode,
      rate_amount: input.rate_amount,
      max_cap_per_tranche: input.max_cap_per_tranche,
      max_cap_per_term: input.max_cap_per_term,
      is_active: true,
      created_by: userId,
    })
    .select('*')
    .single();

  if (error) {
    // restore previous active policy so the year is never left without one
    const ids = ((previous as Array<{ id: string }>) ?? []).map((p) => p.id);
    if (ids.length) await db.from('late_fee_policies').update({ is_active: true }).in('id', ids);
    throw new Error(error.message);
  }
  return mapPolicy(data as Json, input.academic_year);
}

export async function listInstallmentPlans(academicYear?: string): Promise<InstallmentPlanRow[]> {
  const db = await adminDb();
  let q = db.from('tuition_installment_plans').select('*').order('academic_year', { ascending: false }).order('term').order('num_installments', { ascending: false });
  if (academicYear) q = q.eq('academic_year', academicYear);
  const { data, error } = await q;
  if (error) return [];
  return (data as Json[]).map((r) => ({
    id: String(r.id),
    academic_year: String(r.academic_year),
    term: num(r.term) as 1 | 2,
    plan_name: String(r.plan_name),
    num_installments: num(r.num_installments),
    due_day_of_month: num(r.due_day_of_month),
    initial_deposit_pct: num(r.initial_deposit_pct),
    is_active: Boolean(r.is_active),
  }));
}

export async function upsertInstallmentPlan(input: {
  id?: string;
  academic_year: string;
  term: 1 | 2;
  plan_name: string;
  num_installments: number;
  due_day_of_month?: number;
  initial_deposit_pct?: number;
  is_active?: boolean;
}): Promise<InstallmentPlanRow> {
  if (input.num_installments < 2 || input.num_installments > 5) throw new Error('จำนวนงวดต้องอยู่ระหว่าง 2–5 งวดต่อภาคเรียน');
  const row = {
    academic_year: input.academic_year,
    term: input.term,
    plan_name: input.plan_name,
    num_installments: Math.floor(input.num_installments),
    due_day_of_month: Math.max(1, Math.min(28, input.due_day_of_month ?? 5)),
    initial_deposit_pct: Math.max(0, Math.min(60, input.initial_deposit_pct ?? 0)),
    is_active: input.is_active ?? true,
  };
  const db = await adminDb();
  const query = input.id
    ? db.from('tuition_installment_plans').update(row).eq('id', input.id)
    : db.from('tuition_installment_plans').upsert(row, { onConflict: 'academic_year,term,num_installments' });
  const { data, error } = await query.select('*').single();
  if (error) throw new Error(error.message);
  const r = data as Json;
  return {
    id: String(r.id),
    academic_year: String(r.academic_year),
    term: num(r.term) as 1 | 2,
    plan_name: String(r.plan_name),
    num_installments: num(r.num_installments),
    due_day_of_month: num(r.due_day_of_month),
    initial_deposit_pct: num(r.initial_deposit_pct),
    is_active: Boolean(r.is_active),
  };
}

function mapAgreement(r: Json): AgreementRow {
  return {
    id: String(r.id),
    student_id: String(r.student_id),
    guardian_id: (r.guardian_id as string) ?? null,
    academic_year: String(r.academic_year),
    term: num(r.term) as 1 | 2,
    plan_id: (r.plan_id as string) ?? null,
    num_installments: num(r.num_installments),
    fee_item_ids: (r.fee_item_ids as string[]) ?? [],
    total_principal: num(r.total_principal),
    mandatory_amount: num(r.mandatory_amount),
    deposit_pct: num(r.deposit_pct),
    due_day_of_month: num(r.due_day_of_month),
    status: r.status as AgreementStatus,
    signed_by_name: (r.signed_by_name as string) ?? null,
    signed_at: (r.signed_at as string) ?? null,
    created_by: (r.created_by as string) ?? null,
    approved_by: (r.approved_by as string) ?? null,
    approved_at: (r.approved_at as string) ?? null,
    created_at: String(r.created_at),
  };
}

function mapSchedule(r: Json): ScheduleRow {
  return {
    id: String(r.id),
    agreement_id: String(r.agreement_id),
    student_id: String(r.student_id),
    installment_no: num(r.installment_no),
    due_date: String(r.due_date),
    principal_amount: num(r.principal_amount),
    paid_principal_amount: num(r.paid_principal_amount),
    lines: ((r.lines as ReceiptLine[]) ?? []).map((l) => ({ ...l, amount: num(l.amount) })),
    late_fee_charged: num(r.late_fee_charged),
    waived_late_fee: num(r.waived_late_fee),
    late_fee_fully_waived: Boolean(r.late_fee_fully_waived),
    paid_late_fee: num(r.paid_late_fee),
    status: String(r.status),
    paid_at: (r.paid_at as string) ?? null,
  };
}

/** Agreements + tranches (with live late fee, authoritative via SQL function, TS fallback). */
export async function getStudentInstallments(studentId: string, asOf: string = bangkokDateString()): Promise<AgreementWithSchedule[]> {
  const db = await adminDb();
  const { data: agreementRows, error } = await db
    .from('student_installment_agreements')
    .select('*')
    .eq('student_id', studentId)
    .neq('status', 'CANCELLED')
    .order('created_at', { ascending: false });
  if (error || !agreementRows?.length) return [];

  const out: AgreementWithSchedule[] = [];
  for (const raw of agreementRows as Json[]) {
    const agreement = mapAgreement(raw);
    const { data: scheduleRows } = await db
      .from('invoice_installment_schedules')
      .select('*')
      .eq('agreement_id', agreement.id)
      .order('installment_no');
    const schedules = ((scheduleRows as Json[]) ?? []).map(mapSchedule);
    const policy = await getLateFeePolicy(agreement.academic_year);
    const views = computeAgreementLateFees(schedules, policy, asOf);

    // Prefer the database's own computation so the preview equals what will be charged.
    try {
      const { data: dbFees, error: rpcErr } = await db.rpc('compute_agreement_late_fees', {
        p_agreement_id: agreement.id,
        p_as_of: asOf,
      });
      if (!rpcErr && Array.isArray(dbFees)) {
        const byId = new Map((dbFees as Array<{ schedule_id: string; computed_fee: number }>).map((f) => [f.schedule_id, num(f.computed_fee)]));
        for (const s of schedules) {
          const v = views.get(s.installment_no);
          const dbFee = byId.get(s.id);
          if (v && dbFee !== undefined && s.status !== 'PAID') {
            const waived = s.late_fee_fully_waived ? dbFee : roundBaht(Math.min(dbFee, s.waived_late_fee ?? 0));
            const net = roundBaht(Math.max(0, dbFee - waived));
            v.rawLateFee = dbFee;
            v.waivedLateFee = waived;
            v.netLateFee = net;
            v.totalDue = roundBaht(v.outstandingPrincipal + net);
          }
        }
      }
    } catch {
      // keep TS-computed values
    }

    const withViews = schedules.map((s) => {
      const view = views.get(s.installment_no)!;
      return { ...s, view, dual: splitDualReceipt(s.lines, view.netLateFee) };
    });
    const unpaid = withViews.filter((s) => s.status !== 'PAID');
    out.push({
      ...agreement,
      schedules: withViews,
      totalOutstanding: roundBaht(unpaid.reduce((sum, s) => sum + s.view.totalDue, 0)),
      totalNetLateFee: roundBaht(unpaid.reduce((sum, s) => sum + s.view.netLateFee, 0)),
      nextDueNo: unpaid.length ? Math.min(...unpaid.map((s) => s.installment_no)) : null,
    });
  }
  return out;
}

async function loadEligibleFeeItems(db: Awaited<ReturnType<typeof adminDb>>, studentId: string, feeItemIds: string[]) {
  const { data, error } = await db
    .from('fee_items')
    .select('id, student_id, amount, status, installment_agreement_id, fee_type:fee_types(name, coa_code, is_installment_splittable, academic_year, semester)')
    .in('id', feeItemIds);
  if (error) throw new Error(error.message);
  const rows = (data as unknown as Array<{
    id: string; student_id: string; amount: number; status: string; installment_agreement_id: string | null;
    fee_type: { name: string; coa_code: string | null; is_installment_splittable: boolean | null; academic_year: string; semester: string | null } | Array<{ name: string; coa_code: string | null; is_installment_splittable: boolean | null; academic_year: string; semester: string | null }> | null;
  }>) ?? [];
  if (rows.length !== feeItemIds.length) throw new Error('พบรายการค่าธรรมเนียมที่ไม่มีอยู่ในระบบ');
  for (const r of rows) {
    if (r.student_id !== studentId) throw new Error('รายการค่าธรรมเนียมไม่ตรงกับนักเรียน');
    if (r.status !== 'unpaid') throw new Error('มีรายการที่ชำระหรือยกเว้นแล้ว ไม่สามารถนำมาผ่อนได้');
    if (r.installment_agreement_id) throw new Error('มีรายการที่อยู่ในแผนผ่อนชำระอื่นแล้ว');
  }
  return rows.map((r) => {
    const ft = Array.isArray(r.fee_type) ? r.fee_type[0] : r.fee_type;
    return {
      id: r.id,
      name: ft?.name ?? 'ค่าธรรมเนียม',
      amount: num(r.amount),
      coa_code: ft?.coa_code ?? null,
      is_installment_splittable: ft?.is_installment_splittable ?? true,
    } as FeeLineInput;
  });
}

export async function createInstallmentAgreement(input: {
  studentId: string;
  guardianId?: string | null;
  academicYear: string;
  term: 1 | 2;
  numInstallments: number;
  feeItemIds: string[];
  planId?: string | null;
  depositPct?: number;
  dueDay?: number;
  signedByName?: string | null;
  createdBy?: string | null;
  /** staff-created agreements start ACTIVE; parent-created ones wait for approval */
  autoApprove: boolean;
}): Promise<AgreementRow> {
  if (input.numInstallments < 2 || input.numInstallments > 5) throw new Error('ผ่อนชำระได้ 2–5 งวดต่อภาคเรียน');
  if (!input.feeItemIds.length) throw new Error('กรุณาเลือกรายการค่าธรรมเนียมที่ต้องการผ่อน');

  const db = await adminDb();
  const feeLines = await loadEligibleFeeItems(db, input.studentId, input.feeItemIds);

  let dueDay = input.dueDay ?? 5;
  let depositPct = input.depositPct ?? 0;
  if (input.planId) {
    const { data: plan } = await db.from('tuition_installment_plans').select('*').eq('id', input.planId).maybeSingle();
    if (plan) {
      dueDay = num((plan as Json).due_day_of_month) || dueDay;
      depositPct = num((plan as Json).initial_deposit_pct);
    }
  }

  const built = buildInstallmentSchedule({
    academicYearBE: input.academicYear,
    term: input.term,
    numInstallments: input.numInstallments,
    dueDay,
    depositPct,
    feeItems: feeLines,
  });
  if (built.total_principal <= 0) throw new Error('ยอดรวมที่จะผ่อนต้องมากกว่า 0');

  const nowIso = new Date().toISOString();
  const { data: agr, error: aErr } = await db
    .from('student_installment_agreements')
    .insert({
      student_id: input.studentId,
      guardian_id: input.guardianId ?? null,
      academic_year: input.academicYear,
      term: input.term,
      plan_id: input.planId ?? null,
      num_installments: input.numInstallments,
      fee_item_ids: input.feeItemIds,
      total_principal: built.total_principal,
      mandatory_amount: built.mandatory_amount,
      deposit_pct: depositPct,
      due_day_of_month: dueDay,
      status: input.autoApprove ? 'ACTIVE' : 'PENDING_APPROVAL',
      signed_by_name: input.signedByName ?? null,
      signed_at: input.signedByName ? nowIso : null,
      created_by: input.createdBy ?? null,
      approved_by: input.autoApprove ? input.createdBy ?? null : null,
      approved_at: input.autoApprove ? nowIso : null,
    })
    .select('*')
    .single();
  if (aErr) {
    if (/uq_installment_agreement_student_term|duplicate key/i.test(aErr.message)) {
      throw new Error('นักเรียนคนนี้มีแผนผ่อนชำระของภาคเรียนนี้อยู่แล้ว');
    }
    throw new Error(aErr.message);
  }
  const agreement = mapAgreement(agr as Json);

  const { error: sErr } = await db.from('invoice_installment_schedules').insert(
    built.tranches.map((t) => ({
      agreement_id: agreement.id,
      student_id: input.studentId,
      installment_no: t.installment_no,
      due_date: t.due_date,
      principal_amount: t.principal_amount,
      lines: t.lines,
    }))
  );
  if (sErr) {
    await db.from('student_installment_agreements').delete().eq('id', agreement.id);
    throw new Error(sErr.message);
  }

  if (input.autoApprove) {
    const { error: lErr } = await db
      .from('fee_items')
      .update({ installment_agreement_id: agreement.id })
      .in('id', input.feeItemIds);
    if (lErr) {
      await db.from('student_installment_agreements').delete().eq('id', agreement.id);
      throw new Error(lErr.message);
    }
  }
  return agreement;
}

export async function reviewInstallmentAgreement(
  agreementId: string,
  decision: 'APPROVE' | 'REJECT',
  reviewerId: string | null
): Promise<AgreementRow> {
  const db = await adminDb();
  const { data: row, error } = await db.from('student_installment_agreements').select('*').eq('id', agreementId).single();
  if (error || !row) throw new Error('ไม่พบแผนผ่อนชำระ');
  const agreement = mapAgreement(row as Json);
  if (agreement.status !== 'PENDING_APPROVAL') throw new Error('แผนนี้ไม่ได้อยู่ในสถานะรออนุมัติ');

  if (decision === 'REJECT') {
    const { data } = await db
      .from('student_installment_agreements')
      .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
      .eq('id', agreementId)
      .select('*')
      .single();
    return mapAgreement(data as Json);
  }

  // re-verify the fee items are still free
  await loadEligibleFeeItems(db, agreement.student_id, agreement.fee_item_ids);
  const nowIso = new Date().toISOString();
  const { data, error: uErr } = await db
    .from('student_installment_agreements')
    .update({ status: 'ACTIVE', approved_by: reviewerId, approved_at: nowIso, updated_at: nowIso })
    .eq('id', agreementId)
    .eq('status', 'PENDING_APPROVAL')
    .select('*')
    .single();
  if (uErr) throw new Error(uErr.message);
  const { error: lErr } = await db.from('fee_items').update({ installment_agreement_id: agreementId }).in('id', agreement.fee_item_ids);
  if (lErr) throw new Error(lErr.message);
  return mapAgreement(data as Json);
}

export interface PayTrancheResult {
  payment_id: string;
  rec_number: string | null;
  rec_amount: number;
  srv_number: string | null;
  srv_amount: number;
  principal_paid: number;
  late_fee_paid: number;
  late_fee_waived: number;
  total_paid: number;
  agreement_completed: boolean;
  lines: ReceiptLine[];
  idempotent_replay?: boolean;
}

export async function payInstallmentTranche(input: {
  scheduleId: string;
  paymentMethod: PaymentMethod;
  cashierId: string | null;
  cashierNote?: string | null;
  idempotencyKey?: string | null;
}): Promise<PayTrancheResult> {
  if (!['cash', 'qr', 'transfer'].includes(input.paymentMethod)) throw new Error('วิธีชำระเงินไม่ถูกต้อง');
  const db = await adminDb();
  const { data, error } = await db.rpc('pay_installment_tranche', {
    payload: {
      schedule_id: input.scheduleId,
      payment_method: input.paymentMethod,
      cashier_id: input.cashierId,
      cashier_note: input.cashierNote ?? null,
      idempotency_key: input.idempotencyKey ?? null,
    },
  });
  if (error) throw new Error(error.message);
  const r = data as Json;
  return {
    payment_id: String(r.payment_id),
    rec_number: (r.rec_number as string) ?? null,
    rec_amount: num(r.rec_amount),
    srv_number: (r.srv_number as string) ?? null,
    srv_amount: num(r.srv_amount),
    principal_paid: num(r.principal_paid),
    late_fee_paid: num(r.late_fee_paid),
    late_fee_waived: num(r.late_fee_waived),
    total_paid: num(r.total_paid),
    agreement_completed: Boolean(r.agreement_completed),
    lines: ((r.lines as ReceiptLine[]) ?? []).map((l) => ({ ...l, amount: num(l.amount) })),
    idempotent_replay: Boolean(r.idempotent_replay),
  };
}

// ---- Waivers (maker-checker) ------------------------------------------------

function mapWaiver(r: Json): WaiverRequestRow {
  return {
    id: String(r.id),
    schedule_id: String(r.schedule_id),
    agreement_id: String(r.agreement_id),
    student_id: String(r.student_id),
    requested_amount: num(r.requested_amount),
    waive_full: Boolean(r.waive_full),
    reason: String(r.reason),
    requested_by: String(r.requested_by),
    requested_by_name: (r.requested_by_name as string) ?? null,
    status: r.status as WaiverRequestRow['status'],
    approved_amount: r.approved_amount === null || r.approved_amount === undefined ? null : num(r.approved_amount),
    reviewed_by: (r.reviewed_by as string) ?? null,
    reviewed_by_name: (r.reviewed_by_name as string) ?? null,
    review_note: (r.review_note as string) ?? null,
    reviewed_at: (r.reviewed_at as string) ?? null,
    credit_note_id: (r.credit_note_id as string) ?? null,
    created_at: String(r.created_at),
  };
}

export async function submitLateFeeWaiverRequest(input: {
  scheduleId: string;
  reason: string;
  waiveFull?: boolean;
  requestedAmount?: number;
  requestedBy: string;
  requestedByName?: string | null;
}): Promise<WaiverRequestRow> {
  const reason = input.reason.trim();
  if (reason.length < 5) throw new Error('กรุณาระบุเหตุผลการขอยกเว้นค่าปรับอย่างน้อย 5 ตัวอักษร');

  const db = await adminDb();
  const { data: sched, error } = await db.from('invoice_installment_schedules').select('*').eq('id', input.scheduleId).single();
  if (error || !sched) throw new Error('ไม่พบงวดผ่อนชำระ');
  const schedule = mapSchedule(sched as Json);
  if (schedule.status === 'PAID') throw new Error('งวดนี้ชำระแล้ว ไม่สามารถขอยกเว้นค่าปรับได้');

  const views = await getStudentInstallments(schedule.student_id);
  const agreement = views.find((a) => a.id === schedule.agreement_id);
  const current = agreement?.schedules.find((s) => s.id === schedule.id)?.view;
  if (!current || current.rawLateFee <= 0) throw new Error('งวดนี้ยังไม่มีค่าปรับที่เกิดขึ้น');

  const requested = input.waiveFull ? current.rawLateFee : Math.min(current.rawLateFee, Math.max(0, input.requestedAmount ?? current.rawLateFee));
  if (requested <= 0) throw new Error('จำนวนเงินที่ขอยกเว้นต้องมากกว่า 0');

  const { data, error: iErr } = await db
    .from('late_fee_waiver_requests')
    .insert({
      schedule_id: schedule.id,
      agreement_id: schedule.agreement_id,
      student_id: schedule.student_id,
      requested_amount: requested,
      waive_full: Boolean(input.waiveFull),
      reason,
      requested_by: input.requestedBy,
      requested_by_name: input.requestedByName ?? null,
    })
    .select('*')
    .single();
  if (iErr) {
    if (/uq_waiver_one_pending_per_schedule|duplicate key/i.test(iErr.message)) {
      throw new Error('งวดนี้มีคำขอยกเว้นค่าปรับที่รออนุมัติอยู่แล้ว');
    }
    throw new Error(iErr.message);
  }
  return mapWaiver(data as Json);
}

export async function reviewLateFeeWaiverRequest(input: {
  requestId: string;
  decision: 'APPROVED' | 'REJECTED';
  reviewerId: string;
  reviewerName?: string | null;
  approvedAmount?: number;
  note?: string | null;
}): Promise<{ request_id: string; status: string; approved_amount?: number; credit_note_number?: string }> {
  const db = await adminDb();
  const { data, error } = await db.rpc('review_late_fee_waiver', {
    payload: {
      request_id: input.requestId,
      decision: input.decision,
      reviewer_id: input.reviewerId,
      reviewer_name: input.reviewerName ?? null,
      approved_amount: input.approvedAmount ?? null,
      review_note: input.note ?? null,
    },
  });
  if (error) throw new Error(error.message);
  return data as { request_id: string; status: string; approved_amount?: number; credit_note_number?: string };
}

export async function listLateFeeWaiverRequests(status?: 'PENDING' | 'APPROVED' | 'REJECTED'): Promise<Array<WaiverRequestRow & { student_name: string | null }>> {
  const db = await adminDb();
  let q = db.from('late_fee_waiver_requests').select('*').order('created_at', { ascending: false }).limit(200);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error || !data) return [];
  const rows = (data as Json[]).map(mapWaiver);
  const ids = [...new Set(rows.map((r) => r.student_id))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: students } = await db.from('students').select('id, name').in('id', ids);
    for (const s of (students as Array<{ id: string; name: string }>) ?? []) names.set(s.id, s.name);
  }
  return rows.map((r) => ({ ...r, student_name: names.get(r.student_id) ?? null }));
}

// ---- Admin overview ---------------------------------------------------------

export async function getFinanceOverview(asOf: string = bangkokDateString()): Promise<FinanceOverview> {
  const db = await adminDb();
  const { data: agreements } = await db
    .from('student_installment_agreements')
    .select('id, student_id, academic_year, num_installments, status')
    .in('status', ['ACTIVE', 'PENDING_APPROVAL']);
  const rows = (agreements as Array<{ id: string; student_id: string; academic_year: string; num_installments: number; status: string }>) ?? [];
  const active = rows.filter((r) => r.status === 'ACTIVE');

  const overview: FinanceOverview = {
    asOf,
    activeAgreements: active.length,
    pendingAgreements: rows.length - active.length,
    overdueTranches: 0,
    overduePrincipal: 0,
    accruedLateFees: 0,
    pendingWaivers: 0,
    overdueList: [],
  };

  if (active.length) {
    const { data: scheds } = await db
      .from('invoice_installment_schedules')
      .select('*')
      .in('agreement_id', active.map((a) => a.id))
      .order('installment_no');
    const byAgreement = new Map<string, ScheduleRow[]>();
    for (const s of ((scheds as Json[]) ?? []).map(mapSchedule)) {
      const list = byAgreement.get(s.agreement_id) ?? [];
      list.push(s);
      byAgreement.set(s.agreement_id, list);
    }
    const names = new Map<string, string>();
    const { data: students } = await db.from('students').select('id, name').in('id', [...new Set(active.map((a) => a.student_id))]);
    for (const s of (students as Array<{ id: string; name: string }>) ?? []) names.set(s.id, s.name);

    const policies = new Map<string, LateFeePolicy>();
    for (const a of active) {
      if (!policies.has(a.academic_year)) policies.set(a.academic_year, await getLateFeePolicy(a.academic_year));
      const views = computeAgreementLateFees(byAgreement.get(a.id) ?? [], policies.get(a.academic_year)!, asOf);
      for (const s of byAgreement.get(a.id) ?? []) {
        const v = views.get(s.installment_no);
        if (!v || s.status === 'PAID' || v.daysLate <= 0) continue;
        overview.overdueTranches += 1;
        overview.overduePrincipal = roundBaht(overview.overduePrincipal + v.outstandingPrincipal);
        overview.accruedLateFees = roundBaht(overview.accruedLateFees + v.netLateFee);
        overview.overdueList.push({
          student_id: a.student_id,
          student_name: names.get(a.student_id) ?? null,
          installment_no: s.installment_no,
          num_installments: a.num_installments,
          due_date: s.due_date,
          daysLate: v.daysLate,
          inGracePeriod: v.inGracePeriod,
          principal: v.outstandingPrincipal,
          netLateFee: v.netLateFee,
        });
      }
    }
    overview.overdueList.sort((x, y) => y.daysLate - x.daysLate);
  }

  const { count } = await db.from('late_fee_waiver_requests').select('id', { count: 'exact', head: true }).eq('status', 'PENDING');
  overview.pendingWaivers = count ?? 0;
  return overview;
}

export async function listPendingAgreements(): Promise<Array<AgreementRow & { student_name: string | null }>> {
  const db = await adminDb();
  const { data } = await db.from('student_installment_agreements').select('*').eq('status', 'PENDING_APPROVAL').order('created_at');
  const rows = ((data as Json[]) ?? []).map(mapAgreement);
  const names = new Map<string, string>();
  if (rows.length) {
    const { data: students } = await db.from('students').select('id, name').in('id', [...new Set(rows.map((r) => r.student_id))]);
    for (const s of (students as Array<{ id: string; name: string }>) ?? []) names.set(s.id, s.name);
  }
  return rows.map((r) => ({ ...r, student_name: names.get(r.student_id) ?? null }));
}

/** Parent ownership check: guardian must be linked to the student with finance visibility. */
export async function guardianCanViewFinance(guardianId: string, studentId: string): Promise<boolean> {
  const db = await adminDb();
  const { data } = await db
    .schema('family')
    .from('guardian_student_links')
    .select('id, can_view_finance, has_legal_restriction, valid_until')
    .eq('guardian_id', guardianId)
    .eq('student_id', studentId)
    .maybeSingle();
  const link = data as { can_view_finance?: boolean; has_legal_restriction?: boolean; valid_until?: string | null } | null;
  if (!link) return false;
  if (link.has_legal_restriction) return false;
  if (link.valid_until && new Date(link.valid_until) < new Date()) return false;
  return link.can_view_finance !== false;
}

export async function listChartOfAccounts(): Promise<Array<{ code: string; name_th: string; name_en: string | null; account_type: string; receipt_series: string | null; is_cgd_reimbursable: boolean; is_pass_through: boolean }>> {
  const db = await adminDb();
  const { data } = await db.from('chart_of_accounts').select('*').eq('is_active', true).order('code');
  return ((data as Json[]) ?? []).map((r) => ({
    code: String(r.code),
    name_th: String(r.name_th),
    name_en: (r.name_en as string) ?? null,
    account_type: String(r.account_type),
    receipt_series: (r.receipt_series as string) ?? null,
    is_cgd_reimbursable: Boolean(r.is_cgd_reimbursable),
    is_pass_through: Boolean(r.is_pass_through),
  }));
}
