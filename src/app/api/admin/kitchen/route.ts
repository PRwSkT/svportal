import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth';
import {
  KITCHEN_COA_CODE,
  KITCHEN_VOUCHER_CATEGORIES,
  buildKitchenProductionSheet,
  getKitchenBangkokDate,
  isValidDateString,
  loadKitchenCostSummary,
  type KitchenProductionSheet,
} from '@/lib/kitchen/inhouse-kitchen-engine';

// In-House Kitchen API (โรงครัวภายใน) — tuition-included lunch, NO government lunch subsidy.
// GET  ?action=sheet|menus|vouchers|cost|profiles
// POST {action: save_menu | save_voucher | void_voucher | lock_sheet | set_staff_override | save_dietary_profile}

type AuthResult = Awaited<ReturnType<typeof requireAuth>>;

async function authorize(level: 'read' | 'write' | 'void'): Promise<AuthResult> {
  if (level === 'void') return requireAuth('admin');
  if (level === 'write') {
    const primary = await requireAuth('non-academic staff', 'kitchen_ops');
    if (!primary.error) return primary;
    return requireAuth('non-academic staff', 'student_nutrition');
  }
  const primary = await requireAuth('staff', 'kitchen_ops');
  if (!primary.error) return primary;
  return requireAuth('staff', 'student_nutrition');
}

function fail(auth: AuthResult) {
  return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: auth.status || 401 });
}

async function audit(
  supabase: ReturnType<typeof getAdminClient>,
  auth: AuthResult,
  action: string,
  table: string,
  recordId: string,
  oldValue: unknown,
  newValue: unknown
) {
  try {
    await supabase.from('audit_logs').insert({
      user_id: auth.user?.id || null,
      user_name: auth.appUser?.full_name || auth.user?.email || null,
      action,
      table_name: table,
      record_id: recordId,
      old_value: oldValue ?? null,
      new_value: newValue ?? null,
    });
  } catch (err) {
    console.warn('Kitchen audit log failed:', err);
  }
}

function actorName(auth: AuthResult): string {
  return auth.appUser?.full_name || auth.user?.email || auth.user?.id || 'unknown';
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(/[,\n]/).map((v) => v.trim()).filter(Boolean);
  return [];
}

function optionalText(value: unknown): string | null {
  const t = typeof value === 'string' ? value.trim() : '';
  return t ? t : null;
}

function sheetSnapshotRow(sheet: KitchenProductionSheet, lockedBy: string) {
  return {
    prod_date: sheet.date,
    cutoff_time: sheet.cutoffTime,
    attendance_source: sheet.attendanceSource,
    nursery_standard: sheet.standard.NURSERY,
    kindergarten_standard: sheet.standard.KINDERGARTEN,
    primary_standard: sheet.standard.PRIMARY + sheet.standard.OTHER,
    special_tray_count: sheet.special.length,
    staff_count: sheet.staff.present,
    staff_count_override: sheet.staff.override,
    total_trays: sheet.totals.grandTotal,
    special_tray_manifest: sheet.special,
    status: 'LOCKED',
    locked_by: lockedBy,
    locked_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function GET(request: Request) {
  try {
    const auth = await authorize('read');
    if (auth.error) return fail(auth);

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'sheet';
    const today = getKitchenBangkokDate();
    const supabase = getAdminClient();

    if (action === 'sheet') {
      const date = searchParams.get('date') || today;
      if (!isValidDateString(date)) return NextResponse.json({ error: 'รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)' }, { status: 400 });
      const { sheet, missingTables } = await buildKitchenProductionSheet(supabase, date);
      const { data: locked } = await supabase
        .from('kitchen_daily_production_sheets')
        .select('status, locked_by, locked_at')
        .eq('prod_date', date)
        .maybeSingle();
      return NextResponse.json({ success: true, sheet, locked: locked || null, missingTables });
    }

    if (action === 'menus') {
      const from = searchParams.get('from') || today;
      const to = searchParams.get('to') || from;
      if (!isValidDateString(from) || !isValidDateString(to)) return NextResponse.json({ error: 'รูปแบบวันที่ไม่ถูกต้อง' }, { status: 400 });
      const { data, error } = await supabase
        .from('kitchen_cycle_menus')
        .select('*')
        .gte('menu_date', from)
        .lte('menu_date', to)
        .order('menu_date', { ascending: true });
      if (error) return NextResponse.json({ error: error.message, tableMissing: error.code === '42P01' || error.code === 'PGRST205' }, { status: 500 });
      return NextResponse.json({ success: true, menus: data || [] });
    }

    if (action === 'vouchers') {
      const from = searchParams.get('from') || today;
      const to = searchParams.get('to') || from;
      if (!isValidDateString(from) || !isValidDateString(to)) return NextResponse.json({ error: 'รูปแบบวันที่ไม่ถูกต้อง' }, { status: 400 });
      const { data, error } = await supabase
        .from('kitchen_expense_vouchers')
        .select('*')
        .gte('voucher_date', from)
        .lte('voucher_date', to)
        .order('voucher_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) return NextResponse.json({ error: error.message, tableMissing: error.code === '42P01' || error.code === 'PGRST205' }, { status: 500 });
      return NextResponse.json({ success: true, vouchers: data || [] });
    }

    if (action === 'cost') {
      const to = searchParams.get('to') || today;
      const from = searchParams.get('from') || `${to.slice(0, 8)}01`;
      if (!isValidDateString(from) || !isValidDateString(to)) return NextResponse.json({ error: 'รูปแบบวันที่ไม่ถูกต้อง' }, { status: 400 });
      const { summary, missingTables } = await loadKitchenCostSummary(supabase, from, to);
      return NextResponse.json({ success: true, summary, missingTables });
    }

    if (action === 'profiles') {
      const { data, error } = await supabase.from('student_dietary_profiles').select('*').order('updated_at', { ascending: false });
      if (error) return NextResponse.json({ error: error.message, tableMissing: error.code === '42P01' || error.code === 'PGRST205' }, { status: 500 });
      return NextResponse.json({ success: true, profiles: data || [] });
    }

    return NextResponse.json({ error: 'action ไม่ถูกต้อง' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('Kitchen GET error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'รูปแบบข้อมูลไม่ถูกต้อง' }, { status: 400 });
    }
    const action = String(body.action || '');
    const auth = await authorize(action === 'void_voucher' ? 'void' : 'write');
    if (auth.error) return fail(auth);

    const supabase = getAdminClient();
    const actor = actorName(auth);

    if (action === 'save_menu') {
      const menuDate = String(body.menu_date || '');
      const main = optionalText(body.standard_main_dish);
      if (!isValidDateString(menuDate) || !main) {
        return NextResponse.json({ error: 'กรุณาระบุวันที่และเมนูหลักมาตรฐาน' }, { status: 400 });
      }
      const target = body.target_cost_per_head != null && body.target_cost_per_head !== '' ? Number(body.target_cost_per_head) : 30;
      if (!Number.isFinite(target) || target <= 0 || target > 500) {
        return NextResponse.json({ error: 'งบต้นทุนต่อหัวไม่ถูกต้อง' }, { status: 400 });
      }
      const row = {
        menu_date: menuDate,
        standard_main_dish: main,
        standard_side_dish: optionalText(body.standard_side_dish),
        standard_soup: optionalText(body.standard_soup),
        standard_fruit: optionalText(body.standard_fruit),
        standard_allergens: toStringArray(body.standard_allergens),
        halal_substitute: optionalText(body.halal_substitute),
        vegetarian_substitute: optionalText(body.vegetarian_substitute),
        allergy_free_substitute: optionalText(body.allergy_free_substitute),
        soft_diet_substitute: optionalText(body.soft_diet_substitute),
        staff_special_dish: optionalText(body.staff_special_dish),
        target_cost_per_head: target,
        created_by: actor,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from('kitchen_cycle_menus').upsert(row, { onConflict: 'menu_date' }).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await audit(supabase, auth, 'UPSERT', 'kitchen_cycle_menus', menuDate, null, row);
      return NextResponse.json({ success: true, menu: data });
    }

    if (action === 'save_voucher') {
      const voucherDate = String(body.voucher_date || getKitchenBangkokDate());
      const supplier = optionalText(body.supplier_name);
      const description = optionalText(body.description);
      const amount = Number(body.amount);
      const category = String(body.category || 'OTHER');
      if (!isValidDateString(voucherDate)) return NextResponse.json({ error: 'รูปแบบวันที่ไม่ถูกต้อง' }, { status: 400 });
      if (!supplier || !description) return NextResponse.json({ error: 'กรุณาระบุร้านค้า/ผู้ขายและรายการวัตถุดิบ' }, { status: 400 });
      if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
        return NextResponse.json({ error: 'จำนวนเงินต้องมากกว่า 0 และไม่เกิน 1,000,000 บาท' }, { status: 400 });
      }
      if (!(KITCHEN_VOUCHER_CATEGORIES as readonly string[]).includes(category)) {
        return NextResponse.json({ error: 'หมวดวัตถุดิบไม่ถูกต้อง' }, { status: 400 });
      }
      const quantity = body.quantity != null && body.quantity !== '' ? Number(body.quantity) : null;
      if (quantity != null && (!Number.isFinite(quantity) || quantity < 0)) {
        return NextResponse.json({ error: 'ปริมาณไม่ถูกต้อง' }, { status: 400 });
      }
      const row = {
        voucher_date: voucherDate,
        supplier_name: supplier,
        category,
        description,
        quantity,
        unit: optionalText(body.unit),
        amount: Math.round(amount * 100) / 100,
        receipt_no: optionalText(body.receipt_no),
        coa_code: KITCHEN_COA_CODE,
        status: 'RECORDED',
        recorded_by: actor,
      };
      const { data, error } = await supabase.from('kitchen_expense_vouchers').insert(row).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await audit(supabase, auth, 'INSERT', 'kitchen_expense_vouchers', data.id, null, row);
      return NextResponse.json({ success: true, voucher: data });
    }

    if (action === 'void_voucher') {
      const id = String(body.id || '');
      const reason = optionalText(body.reason);
      if (!id || !reason || reason.length < 5) {
        return NextResponse.json({ error: 'กรุณาระบุเหตุผลการยกเลิกใบสำคัญจ่ายอย่างน้อย 5 ตัวอักษร' }, { status: 400 });
      }
      const { data: existing, error: fetchErr } = await supabase.from('kitchen_expense_vouchers').select('*').eq('id', id).single();
      if (fetchErr || !existing) return NextResponse.json({ error: 'ไม่พบใบสำคัญจ่าย' }, { status: 404 });
      if (existing.status === 'VOID') return NextResponse.json({ error: 'ใบสำคัญจ่ายนี้ถูกยกเลิกแล้ว' }, { status: 409 });
      const patch = { status: 'VOID', void_reason: reason, voided_by: actor, voided_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      const { error } = await supabase.from('kitchen_expense_vouchers').update(patch).eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await audit(supabase, auth, 'VOID', 'kitchen_expense_vouchers', id, existing, patch);
      return NextResponse.json({ success: true });
    }

    if (action === 'set_staff_override') {
      const date = String(body.date || getKitchenBangkokDate());
      if (!isValidDateString(date)) return NextResponse.json({ error: 'รูปแบบวันที่ไม่ถูกต้อง' }, { status: 400 });
      const raw = body.staff_count;
      const value = raw === null || raw === '' || raw === undefined ? null : Number(raw);
      if (value != null && (!Number.isInteger(value) || value < 0 || value > 500)) {
        return NextResponse.json({ error: 'จำนวนสำรับครู/บุคลากรไม่ถูกต้อง' }, { status: 400 });
      }
      const { data: existing } = await supabase.from('kitchen_daily_production_sheets').select('*').eq('prod_date', date).maybeSingle();
      if (existing?.status === 'LOCKED') {
        return NextResponse.json({ error: 'ใบสั่งผลิตวันนี้ถูกล็อกแล้ว ไม่สามารถแก้จำนวนสำรับครูได้' }, { status: 409 });
      }
      const { error } = await supabase
        .from('kitchen_daily_production_sheets')
        .upsert(
          { prod_date: date, staff_count_override: value, status: 'DRAFT', updated_at: new Date().toISOString() },
          { onConflict: 'prod_date' }
        );
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await audit(supabase, auth, 'UPDATE', 'kitchen_daily_production_sheets', date, existing, { staff_count_override: value });
      return NextResponse.json({ success: true });
    }

    if (action === 'lock_sheet') {
      const date = String(body.date || getKitchenBangkokDate());
      if (!isValidDateString(date)) return NextResponse.json({ error: 'รูปแบบวันที่ไม่ถูกต้อง' }, { status: 400 });
      const { data: existing } = await supabase.from('kitchen_daily_production_sheets').select('status').eq('prod_date', date).maybeSingle();
      if (existing?.status === 'LOCKED') {
        return NextResponse.json({ error: 'ใบสั่งผลิตวันนี้ถูกล็อกแล้ว' }, { status: 409 });
      }
      const { sheet } = await buildKitchenProductionSheet(supabase, date);
      const row = sheetSnapshotRow(sheet, actor);
      const { error } = await supabase.from('kitchen_daily_production_sheets').upsert(row, { onConflict: 'prod_date' });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await audit(supabase, auth, 'LOCK', 'kitchen_daily_production_sheets', date, null, {
        total_trays: row.total_trays,
        special_tray_count: row.special_tray_count,
      });
      return NextResponse.json({ success: true, sheet });
    }

    if (action === 'save_dietary_profile') {
      const studentId = optionalText(body.student_id);
      const dietType = String(body.diet_type || 'REGULAR');
      if (!studentId) return NextResponse.json({ error: 'กรุณาระบุรหัสนักเรียน' }, { status: 400 });
      if (!['REGULAR', 'HALAL', 'VEGETARIAN', 'MEDICAL_SOFT', 'CUSTOM_ALLERGY'].includes(dietType)) {
        return NextResponse.json({ error: 'ประเภทอาหารไม่ถูกต้อง' }, { status: 400 });
      }
      const isNurse = auth.role === 'admin' || auth.role === 'executive' || auth.role === 'teacher';
      const row = {
        student_id: studentId,
        diet_type: dietType,
        allergens: toStringArray(body.allergens),
        forbidden_ingredients: toStringArray(body.forbidden_ingredients),
        substitute_preference: optionalText(body.substitute_preference),
        medical_note: optionalText(body.medical_note),
        verified_by_nurse: Boolean(body.verified_by_nurse) && isNurse,
        verified_at: Boolean(body.verified_by_nurse) && isNurse ? new Date().toISOString() : null,
        updated_by: actor,
        updated_at: new Date().toISOString(),
      };
      const { data: old } = await supabase.from('student_dietary_profiles').select('*').eq('student_id', studentId).maybeSingle();
      const { data, error } = await supabase.from('student_dietary_profiles').upsert(row, { onConflict: 'student_id' }).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await audit(supabase, auth, old ? 'UPDATE' : 'INSERT', 'student_dietary_profiles', studentId, old, row);
      return NextResponse.json({ success: true, profile: data });
    }

    return NextResponse.json({ error: 'action ไม่ถูกต้อง' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('Kitchen POST error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
