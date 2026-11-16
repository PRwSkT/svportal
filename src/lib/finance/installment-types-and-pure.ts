/**
 * Installment (up to 5 months / term) + Late-Fee + Waiver + Dual-Receipt engine.
 *
 * Two layers in one module:
 *   1. PURE calculation helpers (safe in client components; no server imports).
 *      Mirrors the SQL functions in
 *      supabase/migrations/20261114000002_financial_overhaul_and_inhouse_kitchen.sql
 *      (compute_late_fee_amount / compute_agreement_late_fees) so the cashier preview
 *      equals what pay_installment_tranche() finally charges.
 *   2. SERVER service functions (DB-backed through the service_role client, lazy-loaded so
 *      client bundles never pull it in). Callers MUST authenticate first.
 *
 * School rules encoded:
 *   - 2..5 monthly tranches per term. Term 1 = May–Sep, Term 2 = Nov–Mar. Default due day = 5.
 *   - Mandatory pass-through items (books/uniform/insurance) fall entirely in tranche 1,
 *     along with an optional initial deposit %. The rest of the tuition is split evenly.
 *   - Late fee only after `grace_period_days`, capped per tranche and per term.
 *   - Waivers are maker-checker; approval posts a credit note (Dr 41490 / Cr 11210).
 *   - Receipts split into Series 01 "REC-" (CGD-reimbursable tuition 41110) and
 *     Series 02 "SRV-" (meal fee 41210, activities, late fee 44120).
 *   - Meals are cooked in-house and included in tuition; NO government lunch subsidy.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LateFeeMode = 'FIXED_PER_TRANCHE' | 'DAILY_RATE' | 'PERCENTAGE';
export type ReceiptSeries = '01' | '02';
export type PaymentMethod = 'cash' | 'qr' | 'transfer';
export type AgreementStatus = 'PENDING_APPROVAL' | 'ACTIVE' | 'COMPLETED' | 'DEFAULTED' | 'CANCELLED';
export type TrancheStatus = 'UPCOMING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'DEFAULTED';

export interface LateFeePolicy {
  id?: string;
  academic_year: string;
  policy_name?: string;
  grace_period_days: number;
  calculation_mode: LateFeeMode;
  rate_amount: number;
  max_cap_per_tranche: number;
  max_cap_per_term: number;
  is_active?: boolean;
}

export const DEFAULT_LATE_FEE_POLICY: LateFeePolicy = {
  academic_year: '',
  policy_name: 'ค่าปรับชำระล่าช้า (ค่าเริ่มต้น)',
  grace_period_days: 5,
  calculation_mode: 'FIXED_PER_TRANCHE',
  rate_amount: 100,
  max_cap_per_tranche: 500,
  max_cap_per_term: 1000,
  is_active: true,
};

export interface FeeLineInput {
  id: string;
  name: string;
  amount: number;
  coa_code?: string | null;
  is_installment_splittable?: boolean | null;
}

export interface ReceiptLine {
  coa_code: string;
  series: ReceiptSeries;
  label: string;
  amount: number;
}

export interface BuiltTranche {
  installment_no: number;
  due_date: string; // YYYY-MM-DD
  principal_amount: number;
  lines: ReceiptLine[];
}

export interface BuiltSchedule {
  total_principal: number;
  mandatory_amount: number;
  deposit_amount: number;
  tranches: BuiltTranche[];
}

export interface ScheduleRowLike {
  id?: string;
  installment_no: number;
  due_date: string;
  principal_amount: number;
  paid_principal_amount?: number;
  status?: TrancheStatus | string;
  late_fee_charged?: number;
  waived_late_fee?: number;
  late_fee_fully_waived?: boolean;
  paid_late_fee?: number;
}

export interface TrancheLateFeeView {
  daysLate: number;
  inGracePeriod: boolean;
  graceEndsOn: string;
  rawLateFee: number;
  waivedLateFee: number;
  netLateFee: number;
  outstandingPrincipal: number;
  totalDue: number;
  displayStatus: TrancheStatus;
}

// ---------------------------------------------------------------------------
// Chart of accounts mapping (mirror of public.chart_of_accounts seeds)
// ---------------------------------------------------------------------------

export const COA_CODES = {
  TUITION: '41110',
  ACTIVITY: '41130',
  MEAL: '41210',
  BOOKS_UNIFORM: '41310',
  INSURANCE: '41410',
  LATE_FEE_WAIVER: '41490',
  LATE_FEE: '44120',
  RECEIVABLE: '11210',
  KITCHEN_RAW_MATERIAL: '52200',
} as const;

export const COA_META: Record<string, { name_th: string; series: ReceiptSeries | null; cgdReimbursable: boolean; passThrough: boolean }> = {
  '41110': { name_th: 'ค่าธรรมเนียมการเรียน', series: '01', cgdReimbursable: true, passThrough: false },
  '41130': { name_th: 'ค่ากิจกรรมพัฒนาผู้เรียน/กิจกรรมเสริม', series: '02', cgdReimbursable: false, passThrough: false },
  '41210': { name_th: 'ค่าอาหารกลางวันและอาหารว่างโรงครัวภายใน', series: '02', cgdReimbursable: false, passThrough: false },
  '41310': { name_th: 'ค่าหนังสือ อุปกรณ์การเรียน และเครื่องแบบ', series: '02', cgdReimbursable: false, passThrough: true },
  '41410': { name_th: 'ค่าประกันอุบัติเหตุนักเรียน', series: '02', cgdReimbursable: false, passThrough: true },
  '44120': { name_th: 'ค่าปรับชำระค่าธรรมเนียมล่าช้า', series: '02', cgdReimbursable: false, passThrough: false },
};

export const RECEIPT_SERIES_LABELS: Record<ReceiptSeries, { prefix: 'REC' | 'SRV'; title_th: string; hint_th: string }> = {
  '01': { prefix: 'REC', title_th: 'เล่ม 01 ใบเสร็จค่าธรรมเนียมการเรียน (REC-)', hint_th: 'ใช้เบิกสวัสดิการ/กรมบัญชีกลางได้' },
  '02': { prefix: 'SRV', title_th: 'เล่ม 02 ใบเสร็จค่าบริการอื่น (SRV-)', hint_th: 'ค่าอาหารโรงครัว กิจกรรม อุปกรณ์ และค่าปรับ' },
};

/** Explicit COA wins; otherwise infer from the Thai fee name. */
export function classifyFeeCoa(fee: Pick<FeeLineInput, 'name' | 'coa_code'>): string {
  if (fee.coa_code && COA_META[fee.coa_code]) return fee.coa_code;
  const n = fee.name || '';
  if (/ปรับ/.test(n)) return COA_CODES.LATE_FEE;
  if (/ประกัน/.test(n)) return COA_CODES.INSURANCE;
  if (/หนังสือ|เครื่องแบบ|ชุดนักเรียน|อุปกรณ์|สมุด|ชุดพละ|ชุดลูกเสือ/.test(n)) return COA_CODES.BOOKS_UNIFORM;
  if (/อาหาร|โรงครัว|โภชนาการ|นมโรงเรียน/.test(n)) return COA_CODES.MEAL;
  if (/กิจกรรม|ชุมนุม|ทัศนศึกษา|เสริม|พิเศษ|ดนตรี|กีฬา|คอมพิวเตอร์|ว่ายน้ำ/.test(n)) return COA_CODES.ACTIVITY;
  return COA_CODES.TUITION;
}

export function seriesForCoa(coa: string): ReceiptSeries {
  return COA_META[coa]?.series ?? '02';
}

// ---------------------------------------------------------------------------
// Money + date helpers (pure)
// ---------------------------------------------------------------------------

const toSatang = (n: number) => Math.round((Number(n) || 0) * 100);
const fromSatang = (s: number) => Math.round(s) / 100;
export const roundBaht = (n: number) => fromSatang(toSatang(n));

/** Asia/Bangkok calendar date (YYYY-MM-DD) — never UTC. */
export function bangkokDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function parseYmd(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1);
}

/** Whole days from `fromYmd` to `toYmd` (positive when `to` is later). */
export function diffDays(fromYmd: string, toYmd: string): number {
  return Math.round((parseYmd(toYmd) - parseYmd(fromYmd)) / 86_400_000);
}

export function addDaysYmd(ymd: string, days: number): string {
  const t = new Date(parseYmd(ymd) + days * 86_400_000);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

/** Calendar months of each term (CE months). Term 1 = May–Sep, Term 2 = Nov–Mar. */
export const TERM_MONTHS: Record<1 | 2, Array<{ month: number; yearOffset: number }>> = {
  1: [5, 6, 7, 8, 9].map((month) => ({ month, yearOffset: 0 })),
  2: [
    { month: 11, yearOffset: 0 },
    { month: 12, yearOffset: 0 },
    { month: 1, yearOffset: 1 },
    { month: 2, yearOffset: 1 },
    { month: 3, yearOffset: 1 },
  ],
};

/** Due dates for N tranches of a term. `academicYearBE` is Buddhist Era (e.g. 2569). */
export function buildDueDates(academicYearBE: number | string, term: 1 | 2, numInstallments: number, dueDay = 5): string[] {
  const n = Math.max(2, Math.min(5, Math.floor(numInstallments)));
  const ce = Number(academicYearBE) - 543;
  const day = Math.max(1, Math.min(28, Math.floor(dueDay)));
  return TERM_MONTHS[term].slice(0, n).map(({ month, yearOffset }) =>
    `${ce + yearOffset}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  );
}

// ---------------------------------------------------------------------------
// Late fee (pure) — must stay identical to SQL compute_late_fee_amount()
// ---------------------------------------------------------------------------

export function computeLateFeeAmount(params: {
  policy: Pick<LateFeePolicy, 'calculation_mode' | 'rate_amount' | 'max_cap_per_tranche' | 'grace_period_days'>;
  dueDate: string;
  outstandingPrincipal: number;
  asOf: string;
}): number {
  const { policy, dueDate, outstandingPrincipal, asOf } = params;
  if (outstandingPrincipal <= 0) return 0;
  const daysLate = diffDays(dueDate, asOf);
  if (daysLate <= policy.grace_period_days) return 0;
  const chargeableDays = daysLate - policy.grace_period_days;
  let raw = 0;
  switch (policy.calculation_mode) {
    case 'FIXED_PER_TRANCHE':
      raw = policy.rate_amount;
      break;
    case 'DAILY_RATE':
      raw = policy.rate_amount * chargeableDays;
      break;
    case 'PERCENTAGE':
      raw = outstandingPrincipal * (policy.rate_amount / 100) * Math.ceil(chargeableDays / 30);
      break;
  }
  return roundBaht(Math.min(policy.max_cap_per_tranche, raw));
}

/**
 * Late fee for every tranche of one agreement (ordered), honouring the per-term cap.
 * PAID tranches keep their frozen `late_fee_charged`.
 */
export function computeAgreementLateFees(
  schedules: ScheduleRowLike[],
  policy: LateFeePolicy,
  asOf: string = bangkokDateString()
): Map<number, TrancheLateFeeView> {
  const ordered = [...schedules].sort((a, b) => a.installment_no - b.installment_no);
  const result = new Map<number, TrancheLateFeeView>();
  let running = 0;

  for (const row of ordered) {
    const paid = row.status === 'PAID';
    const outstanding = roundBaht(row.principal_amount - (row.paid_principal_amount ?? 0));
    const daysLate = diffDays(row.due_date, asOf);
    const graceEndsOn = addDaysYmd(row.due_date, policy.grace_period_days);

    let raw: number;
    if (paid) {
      raw = row.late_fee_charged ?? 0;
      running += raw;
    } else {
      const uncapped = computeLateFeeAmount({
        policy,
        dueDate: row.due_date,
        outstandingPrincipal: outstanding,
        asOf,
      });
      raw = roundBaht(Math.min(uncapped, Math.max(0, policy.max_cap_per_term - running)));
      running += raw;
    }

    const waived = paid
      ? row.waived_late_fee ?? 0
      : row.late_fee_fully_waived
        ? raw
        : roundBaht(Math.min(raw, row.waived_late_fee ?? 0));
    const net = paid ? row.paid_late_fee ?? 0 : roundBaht(Math.max(0, raw - waived));

    let displayStatus: TrancheStatus = 'UPCOMING';
    if (paid) displayStatus = 'PAID';
    else if (row.status === 'DEFAULTED') displayStatus = 'DEFAULTED';
    else if (daysLate > 0) displayStatus = 'OVERDUE';
    else if ((row.paid_principal_amount ?? 0) > 0) displayStatus = 'PARTIALLY_PAID';

    result.set(row.installment_no, {
      daysLate,
      inGracePeriod: !paid && daysLate > 0 && daysLate <= policy.grace_period_days,
      graceEndsOn,
      rawLateFee: raw,
      waivedLateFee: waived,
      netLateFee: net,
      outstandingPrincipal: paid ? 0 : outstanding,
      totalDue: paid ? 0 : roundBaht(outstanding + net),
      displayStatus,
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Installment schedule builder (pure)
// ---------------------------------------------------------------------------

function isMandatoryPassThrough(coa: string, fee: FeeLineInput): boolean {
  if (fee.is_installment_splittable === false) return true;
  return Boolean(COA_META[coa]?.passThrough);
}

/**
 * Builds N tranches from fee items:
 *  - mandatory pass-through items (books/uniform/insurance or non-splittable) -> tranche 1 only
 *  - initial deposit % of the splittable amount -> tranche 1
 *  - remaining splittable amount -> split evenly across 1..N (rounding remainder goes to last tranche)
 * Each tranche carries receipt `lines` grouped by COA so the right series (REC/SRV) is issued.
 */
export function buildInstallmentSchedule(params: {
  academicYearBE: number | string;
  term: 1 | 2;
  numInstallments: number;
  dueDay?: number;
  depositPct?: number;
  feeItems: FeeLineInput[];
}): BuiltSchedule {
  const n = Math.max(2, Math.min(5, Math.floor(params.numInstallments)));
  const dueDates = buildDueDates(params.academicYearBE, params.term, n, params.dueDay ?? 5);
  const depositPct = Math.max(0, Math.min(60, params.depositPct ?? 0));

  // satang per tranche per coa
  const perTranche: Array<Map<string, { amount: number; label: string }>> = Array.from({ length: n }, () => new Map());
  const add = (idx: number, coa: string, label: string, satang: number) => {
    if (satang <= 0) return;
    const cur = perTranche[idx].get(coa);
    perTranche[idx].set(coa, { amount: (cur?.amount ?? 0) + satang, label: cur?.label ?? COA_META[coa]?.name_th ?? label });
  };

  let mandatory = 0;
  let deposit = 0;
  let total = 0;

  for (const fee of params.feeItems) {
    const coa = classifyFeeCoa(fee);
    const amountS = toSatang(fee.amount);
    if (amountS <= 0) continue;
    total += amountS;

    if (isMandatoryPassThrough(coa, fee)) {
      mandatory += amountS;
      add(0, coa, fee.name, amountS);
      continue;
    }

    const depositS = Math.round((amountS * depositPct) / 100);
    const remainderS = amountS - depositS;
    deposit += depositS;
    add(0, coa, fee.name, depositS);

    const base = Math.floor(remainderS / n);
    for (let i = 0; i < n; i++) {
      const share = i === n - 1 ? remainderS - base * (n - 1) : base;
      add(i, coa, fee.name, share);
    }
  }

  const tranches: BuiltTranche[] = perTranche.map((map, i) => {
    const lines: ReceiptLine[] = [...map.entries()]
      .map(([coa, v]) => ({ coa_code: coa, series: seriesForCoa(coa), label: v.label, amount: fromSatang(v.amount) }))
      .sort((a, b) => a.coa_code.localeCompare(b.coa_code));
    return {
      installment_no: i + 1,
      due_date: dueDates[i],
      principal_amount: roundBaht(lines.reduce((s, l) => s + l.amount, 0)),
      lines,
    };
  });

  return {
    total_principal: fromSatang(total),
    mandatory_amount: fromSatang(mandatory),
    deposit_amount: fromSatang(deposit),
    tranches,
  };
}

// ---------------------------------------------------------------------------
// Dual receipt split (pure) — Series 01 REC- vs Series 02 SRV-
// ---------------------------------------------------------------------------

export interface DualReceiptPreview {
  rec: { series: '01'; prefix: 'REC'; lines: ReceiptLine[]; total: number };
  srv: { series: '02'; prefix: 'SRV'; lines: ReceiptLine[]; total: number };
  grandTotal: number;
}

export function splitDualReceipt(lines: ReceiptLine[], lateFeeNet = 0): DualReceiptPreview {
  const all: ReceiptLine[] = [...lines];
  if (lateFeeNet > 0) {
    all.push({ coa_code: COA_CODES.LATE_FEE, series: '02', label: COA_META[COA_CODES.LATE_FEE].name_th, amount: roundBaht(lateFeeNet) });
  }
  const rec = all.filter((l) => l.series === '01');
  const srv = all.filter((l) => l.series === '02');
  const sum = (ls: ReceiptLine[]) => roundBaht(ls.reduce((s, l) => s + l.amount, 0));
  return {
    rec: { series: '01', prefix: 'REC', lines: rec, total: sum(rec) },
    srv: { series: '02', prefix: 'SRV', lines: srv, total: sum(srv) },
    grandTotal: sum(all),
  };
}

/** Preview for a plain (non-installment) selection of fee items. */
export function splitFeeItemsToDualReceipt(fees: FeeLineInput[]): DualReceiptPreview {
  const grouped = new Map<string, number>();
  for (const f of fees) {
    const coa = classifyFeeCoa(f);
    grouped.set(coa, (grouped.get(coa) ?? 0) + toSatang(f.amount));
  }
  const lines: ReceiptLine[] = [...grouped.entries()].map(([coa, s]) => ({
    coa_code: coa,
    series: seriesForCoa(coa),
    label: COA_META[coa]?.name_th ?? coa,
    amount: fromSatang(s),
  }));
  return splitDualReceipt(lines, 0);
}

export interface InstallmentPlanRow {
  id: string;
  academic_year: string;
  term: 1 | 2;
  plan_name: string;
  num_installments: number;
  due_day_of_month: number;
  initial_deposit_pct: number;
  is_active: boolean;
}

export interface AgreementRow {
  id: string;
  student_id: string;
  guardian_id: string | null;
  academic_year: string;
  term: 1 | 2;
  plan_id: string | null;
  num_installments: number;
  fee_item_ids: string[];
  total_principal: number;
  mandatory_amount: number;
  deposit_pct: number;
  due_day_of_month: number;
  status: AgreementStatus;
  signed_by_name: string | null;
  signed_at: string | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface ScheduleRow extends ScheduleRowLike {
  id: string;
  agreement_id: string;
  student_id: string;
  lines: ReceiptLine[];
  paid_at: string | null;
}

export interface AgreementWithSchedule extends AgreementRow {
  schedules: Array<ScheduleRow & { view: TrancheLateFeeView; dual: DualReceiptPreview }>;
  totalOutstanding: number;
  totalNetLateFee: number;
  nextDueNo: number | null;
}

export interface WaiverRequestRow {
  id: string;
  schedule_id: string;
  agreement_id: string;
  student_id: string;
  requested_amount: number;
  waive_full: boolean;
  reason: string;
  requested_by: string;
  requested_by_name: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approved_amount: number | null;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  credit_note_id: string | null;
  created_at: string;
}

export interface FinanceOverview {
  asOf: string;
  activeAgreements: number;
  pendingAgreements: number;
  overdueTranches: number;
  overduePrincipal: number;
  accruedLateFees: number;
  pendingWaivers: number;
  overdueList: Array<{
    student_id: string;
    student_name: string | null;
    installment_no: number;
    num_installments: number;
    due_date: string;
    daysLate: number;
    inGracePeriod: boolean;
    principal: number;
    netLateFee: number;
  }>;
}
