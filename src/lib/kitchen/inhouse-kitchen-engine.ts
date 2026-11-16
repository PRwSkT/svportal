/**
 * In-House School Kitchen Engine (โรงครัวภายใน โรงเรียนสมคิดวิทยา)
 *
 * นโยบายโรงเรียน:
 *  - อาหารกลางวันรวมอยู่ในค่าเทอม ไม่รับเงินอุดหนุนอาหารกลางวันจากรัฐ (ไม่มี 27 บ./วัน)
 *  - นักเรียนทุกคนทานเมนูมาตรฐานเดียวกัน ยกเว้น
 *      1) เด็กแพ้อาหาร / ศาสนา (ฮาลาล) / มังสวิรัติ / โรคประจำตัว / อาหารอ่อนวันนี้ (ห้องพยาบาลหรือผู้ปกครองแจ้ง)
 *      2) ครูและบุคลากร (สำรับแยก)
 *  - ต้นทุนวัตถุดิบบันทึกเป็นใบสำคัญจ่าย ผังบัญชี สช. ม.32 รหัส 52200
 *
 * ไฟล์นี้ใช้ได้เฉพาะฝั่งเซิร์ฟเวอร์ (ต้องส่ง service_role client เข้ามา) ส่วน compileKitchenSheet เป็นฟังก์ชันบริสุทธิ์
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// -----------------------------------------------------------------------------
// Constants & Types
// -----------------------------------------------------------------------------

export const KITCHEN_COA_CODE = '52200';
export const KITCHEN_COA_NAME = 'ค่าอาหารและโภชนาการนักเรียน (โรงครัวภายใน)';
export const KITCHEN_CUTOFF_TIME = '08:30';
export const DEFAULT_TARGET_COST_PER_MEAL = 30;

/** เวลาที่ถ้านักเรียนกลับบ้านก่อนหน้านี้ ถือว่าไม่ทานอาหารกลางวัน */
const LUNCH_CUTOFF_HHMM = '11:00';

export type KitchenDepartment = 'NURSERY' | 'KINDERGARTEN' | 'PRIMARY' | 'OTHER';
export type KitchenDietType = 'ALLERGY' | 'HALAL' | 'VEGETARIAN' | 'MEDICAL_SOFT' | 'MEDICAL_CUSTOM';

export const KITCHEN_DEPARTMENT_LABELS: Record<KitchenDepartment, string> = {
  NURSERY: 'เนอสเซอรี่',
  KINDERGARTEN: 'อนุบาล',
  PRIMARY: 'ประถม',
  OTHER: 'อื่นๆ',
};

export const KITCHEN_DIET_LABELS: Record<KitchenDietType, string> = {
  ALLERGY: 'แพ้อาหาร',
  HALAL: 'ฮาลาล',
  VEGETARIAN: 'มังสวิรัติ',
  MEDICAL_SOFT: 'อาหารอ่อน/ข้าวต้ม (วันนี้)',
  MEDICAL_CUSTOM: 'โรคประจำตัว (ตรวจสอบกับพยาบาล)',
};

export const KITCHEN_VOUCHER_CATEGORIES = [
  'MEAT', 'SEAFOOD', 'VEGETABLE', 'FRUIT', 'RICE_DRY', 'EGG_DAIRY', 'SEASONING', 'OIL_GAS', 'PACKAGING', 'OTHER',
] as const;
export type KitchenVoucherCategory = (typeof KITCHEN_VOUCHER_CATEGORIES)[number];

export const KITCHEN_VOUCHER_CATEGORY_LABELS: Record<KitchenVoucherCategory, string> = {
  MEAT: 'เนื้อสัตว์/หมู/ไก่',
  SEAFOOD: 'อาหารทะเล/ปลา',
  VEGETABLE: 'ผัก',
  FRUIT: 'ผลไม้',
  RICE_DRY: 'ข้าว/อาหารแห้ง',
  EGG_DAIRY: 'ไข่/นม',
  SEASONING: 'เครื่องปรุง',
  OIL_GAS: 'น้ำมัน/แก๊ส',
  PACKAGING: 'บรรจุภัณฑ์/วัสดุ',
  OTHER: 'อื่นๆ',
};

export interface KitchenStudentInput {
  id: string;
  name: string;
  nickname?: string | null;
  grade: string;
  classroom?: string | null;
  allergies?: string | null;
  religion?: string | null;
  medical_conditions?: string | null;
}

export interface KitchenAttendanceInput {
  student_id: string;
  status: string; // PRESENT | LATE | ABSENT | SICK_LEAVE | PERSONAL_LEAVE | EARLY_PICKUP
  check_out_time?: string | null;
}

export interface KitchenInfirmaryInput {
  student_id: string;
  symptoms?: string[] | null;
  temperature_celsius?: number | string | null;
  diagnosed_contagious_disease?: string | null;
  rest_in_bed?: boolean | null;
  time_left?: string | null; // 'HH:MM:SS'
  notes?: string | null;
}

export interface KitchenDietaryProfileInput {
  student_id: string;
  diet_type: 'REGULAR' | 'HALAL' | 'VEGETARIAN' | 'MEDICAL_SOFT' | 'CUSTOM_ALLERGY';
  allergens?: string[] | null;
  forbidden_ingredients?: string[] | null;
  substitute_preference?: string | null;
  medical_note?: string | null;
  verified_by_nurse?: boolean | null;
}

export interface KitchenMenu {
  menu_date: string;
  standard_main_dish: string;
  standard_side_dish?: string | null;
  standard_soup?: string | null;
  standard_fruit?: string | null;
  standard_allergens?: string[] | null;
  halal_substitute?: string | null;
  vegetarian_substitute?: string | null;
  allergy_free_substitute?: string | null;
  soft_diet_substitute?: string | null;
  staff_special_dish?: string | null;
  target_cost_per_head?: number | string | null;
}

export interface KitchenSheetInput {
  date: string;
  students: KitchenStudentInput[];
  attendance: KitchenAttendanceInput[];
  infirmary: KitchenInfirmaryInput[];
  profiles: KitchenDietaryProfileInput[];
  menu: KitchenMenu | null;
  staffPresent: number;
  staffOverride?: number | null;
}

export interface KitchenSpecialTray {
  studentId: string;
  studentName: string;
  nickname: string;
  grade: string;
  classroom: string;
  department: KitchenDepartment;
  dietTypes: KitchenDietType[];
  allergens: string[];
  forbiddenIngredients: string[];
  substituteDish: string | null;
  notes: string[];
  /** CRITICAL: เมนูมาตรฐานวันนี้อาจมีสารก่อภูมิแพ้ของเด็ก (หรือยังไม่ได้ระบุสารก่อภูมิแพ้ในเมนู) */
  severity: 'CRITICAL' | 'NORMAL';
  /** มีมากกว่าหนึ่งเงื่อนไข เช่น ฮาลาล + แพ้ถั่ว ต้องให้หัวหน้าโรงครัวตรวจสอบ */
  needsKitchenReview: boolean;
  verifiedByNurse: boolean;
}

export interface KitchenExcludedStudent {
  studentId: string;
  studentName: string;
  grade: string;
  reason: string;
}

export interface KitchenProductionSheet {
  date: string;
  cutoffTime: string;
  generatedAt: string;
  attendanceSource: 'LIVE_ATTENDANCE' | 'ROSTER_FORECAST';
  menu: KitchenMenu | null;
  standard: Record<KitchenDepartment, number> & { total: number };
  specialByDepartment: Record<KitchenDepartment, number>;
  specialByDiet: Record<KitchenDietType, number>;
  special: KitchenSpecialTray[];
  excluded: KitchenExcludedStudent[];
  staff: { present: number; override: number | null; effective: number };
  totals: { studentTrays: number; staffMeals: number; grandTotal: number };
  unmarkedCount: number;
  warnings: string[];
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** วันที่ตามเวลาประเทศไทย (YYYY-MM-DD) */
export function getKitchenBangkokDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function isValidDateString(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

export function classifyKitchenDepartment(grade: string | null | undefined): KitchenDepartment {
  const g = String(grade || '').trim().toLowerCase();
  if (!g) return 'OTHER';
  if (g.includes('เนอส') || g.includes('nurs') || g.includes('เตรียม') || g.includes('เด็กเล็ก')) return 'NURSERY';
  if (g.startsWith('อ.') || g.includes('อนุบาล') || g.startsWith('kg')) return 'KINDERGARTEN';
  if (g.startsWith('ป.') || g.includes('ประถม') || g.startsWith('p.')) return 'PRIMARY';
  return 'OTHER';
}

const NONE_TEXT = /^(-|--|—|ไม่มี|ไม่แพ้|ไม่มีประวัติ|ปกติ|none|n\/a|na|no|null|nil)$/i;

export function isNoneText(text: string | null | undefined): boolean {
  const t = String(text ?? '').trim();
  return t === '' || NONE_TEXT.test(t);
}

/** แยกรายการแพ้อาหารจากข้อความอิสระ เช่น "แพ้กุ้ง, ถั่วลิสง และนมวัว" */
export function parseAllergens(text: string | null | undefined): string[] {
  if (isNoneText(text)) return [];
  const cleaned = String(text)
    .replace(/แพ้(อาหาร|ยา)?/g, ' ')
    .replace(/(?:^|\s)และ(?:\s|$)/g, ',')
    .replace(/[\n;/|]+/g, ',');
  const parts = cleaned
    .split(',')
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p && !isNoneText(p));
  return Array.from(new Set(parts));
}

export function isMuslimReligion(religion: string | null | undefined): boolean {
  const r = String(religion ?? '').trim().toLowerCase();
  return r.includes('อิสลาม') || r.includes('มุสลิม') || r.includes('islam') || r.includes('muslim');
}

const MEDICAL_DIET_KEYWORDS = ['เบาหวาน', 'โรคไต', 'ไตวาย', 'โรคหัวใจ', 'g6pd', 'ถั่วปากอ้า', 'celiac', 'เซลิแอก', 'ลำไส้', 'โรคตับ'];
const GI_SYMPTOM_KEYWORDS = ['ท้องเสีย', 'ท้องร่วง', 'อาเจียน', 'คลื่นไส้', 'ปวดท้อง', 'diarrhea', 'vomit', 'nausea'];

function hhmm(timeLike: string | null | undefined): string | null {
  if (!timeLike) return null;
  const m = String(timeLike).match(/(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : null;
}

function bangkokHhmmFromIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

function normalizeAllergen(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase();
}

function allergensConflict(studentAllergens: string[], menuAllergens: string[]): boolean {
  const menu = menuAllergens.map(normalizeAllergen).filter(Boolean);
  return studentAllergens.some((a) => {
    const n = normalizeAllergen(a);
    return menu.some((m) => m.includes(n) || n.includes(m));
  });
}

function emptyDeptCounts(): Record<KitchenDepartment, number> {
  return { NURSERY: 0, KINDERGARTEN: 0, PRIMARY: 0, OTHER: 0 };
}

// -----------------------------------------------------------------------------
// Pure compiler
// -----------------------------------------------------------------------------

const PRESENT_STATUSES = new Set(['PRESENT', 'LATE', 'EARLY_PICKUP']);

export function compileKitchenSheet(input: KitchenSheetInput): KitchenProductionSheet {
  const { date, students, attendance, infirmary, profiles, menu } = input;
  const warnings: string[] = [];

  const profileMap = new Map(profiles.map((p) => [p.student_id, p]));
  const attendanceByStudent = new Map<string, KitchenAttendanceInput[]>();
  attendance.forEach((row) => {
    const list = attendanceByStudent.get(row.student_id) || [];
    list.push(row);
    attendanceByStudent.set(row.student_id, list);
  });

  const hasRollCall = attendance.length > 0;
  const attendanceSource: KitchenProductionSheet['attendanceSource'] = hasRollCall ? 'LIVE_ATTENDANCE' : 'ROSTER_FORECAST';
  if (!hasRollCall) {
    warnings.push('ยังไม่มีการเช็กชื่อนักเรียนวันนี้ ระบบจึงใช้รายชื่อนักเรียนทั้งหมดเป็นตัวเลขพยากรณ์ — ปรับใหม่หลังครูเช็กชื่อเช้า');
  }

  const infirmaryByStudent = new Map<string, KitchenInfirmaryInput[]>();
  infirmary.forEach((v) => {
    const list = infirmaryByStudent.get(v.student_id) || [];
    list.push(v);
    infirmaryByStudent.set(v.student_id, list);
  });

  const standard = emptyDeptCounts();
  const specialByDepartment = emptyDeptCounts();
  const specialByDiet: Record<KitchenDietType, number> = {
    ALLERGY: 0, HALAL: 0, VEGETARIAN: 0, MEDICAL_SOFT: 0, MEDICAL_CUSTOM: 0,
  };
  const special: KitchenSpecialTray[] = [];
  const excluded: KitchenExcludedStudent[] = [];
  let unmarkedCount = 0;

  const menuAllergens = (menu?.standard_allergens || []).filter(Boolean);

  for (const s of students) {
    const rows = attendanceByStudent.get(s.id) || [];

    // 1. มาเรียนหรือไม่
    let isPresent = true;
    if (hasRollCall) {
      if (rows.length === 0) {
        unmarkedCount++;
        isPresent = false;
      } else {
        isPresent = rows.some((r) => {
          if (!PRESENT_STATUSES.has(r.status)) return false;
          if (r.status === 'EARLY_PICKUP') {
            const out = bangkokHhmmFromIso(r.check_out_time);
            if (out && out < LUNCH_CUTOFF_HHMM) return false;
          }
          return true;
        });
      }
    }
    if (!isPresent) continue;

    const department = classifyKitchenDepartment(s.grade);
    const profile = profileMap.get(s.id);
    const visits = infirmaryByStudent.get(s.id) || [];
    const notes: string[] = [];

    // 2. ห้องพยาบาลวันนี้: โรคติดต่อ / กลับบ้านก่อนเที่ยง => ไม่ทำถาด, ไข้/ท้องเสีย => อาหารอ่อน
    let excludeReason: string | null = null;
    let softToday = false;
    for (const v of visits) {
      const disease = String(v.diagnosed_contagious_disease || 'NONE').toUpperCase();
      if (disease !== 'NONE') {
        excludeReason = `โรคติดต่อ (${disease}) — ควรหยุดพักที่บ้าน ไม่เตรียมถาด`;
        break;
      }
      const left = hhmm(v.time_left);
      if (left && left < LUNCH_CUTOFF_HHMM) {
        excludeReason = `กลับบ้านจากห้องพยาบาลเวลา ${left} น. (ก่อนพักเที่ยง)`;
        break;
      }
      const temp = v.temperature_celsius != null ? Number(v.temperature_celsius) : NaN;
      const symptomText = (v.symptoms || []).join(' ').toLowerCase();
      if (
        (!Number.isNaN(temp) && temp >= 37.8) ||
        v.rest_in_bed ||
        GI_SYMPTOM_KEYWORDS.some((k) => symptomText.includes(k))
      ) {
        softToday = true;
        notes.push('ห้องพยาบาลแจ้งวันนี้: ไข้/ท้องเสีย/พักห้องพยาบาล → อาหารอ่อน');
      }
    }
    if (excludeReason) {
      excluded.push({ studentId: s.id, studentName: s.name, grade: s.grade, reason: excludeReason });
      continue;
    }

    // 3. รวมเงื่อนไขอาหารของเด็ก
    const dietTypes = new Set<KitchenDietType>();
    const allergens = new Set<string>([...parseAllergens(s.allergies), ...(profile?.allergens || [])].filter(Boolean));
    const forbidden = new Set<string>((profile?.forbidden_ingredients || []).filter(Boolean));

    if (allergens.size > 0 || profile?.diet_type === 'CUSTOM_ALLERGY') dietTypes.add('ALLERGY');
    if (profile?.diet_type === 'HALAL' || isMuslimReligion(s.religion)) {
      dietTypes.add('HALAL');
      forbidden.add('หมู');
    }
    if (profile?.diet_type === 'VEGETARIAN') dietTypes.add('VEGETARIAN');
    if (profile?.diet_type === 'MEDICAL_SOFT' || softToday) dietTypes.add('MEDICAL_SOFT');

    const medical = String(s.medical_conditions || '').trim();
    if (!isNoneText(medical) && MEDICAL_DIET_KEYWORDS.some((k) => medical.toLowerCase().includes(k))) {
      dietTypes.add('MEDICAL_CUSTOM');
      notes.push(`โรคประจำตัว: ${medical}`);
    }
    if (profile?.medical_note) notes.push(profile.medical_note);

    if (dietTypes.size === 0) {
      standard[department]++;
      continue;
    }

    const dietList = Array.from(dietTypes);
    const allergenList = Array.from(allergens);

    // 4. เมนูทดแทน
    let substitute: string | null = profile?.substitute_preference?.trim() || null;
    if (!substitute && menu) {
      if (dietTypes.has('ALLERGY')) substitute = menu.allergy_free_substitute || null;
      if (!substitute && dietTypes.has('MEDICAL_SOFT')) substitute = menu.soft_diet_substitute || null;
      if (!substitute && dietTypes.has('HALAL')) substitute = menu.halal_substitute || null;
      if (!substitute && dietTypes.has('VEGETARIAN')) substitute = menu.vegetarian_substitute || null;
    }
    if (!menu) {
      // จะเตือนรวมครั้งเดียวด้านล่าง
    } else if (!substitute) {
      notes.push('ยังไม่ได้ตั้งเมนูทดแทนสำหรับเงื่อนไขนี้ — แจ้งหัวหน้าโรงครัว');
    }

    // 5. ความรุนแรง
    let severity: KitchenSpecialTray['severity'] = 'NORMAL';
    if (dietTypes.has('ALLERGY') && allergenList.length > 0) {
      severity = menuAllergens.length === 0 || allergensConflict(allergenList, menuAllergens) ? 'CRITICAL' : 'NORMAL';
    }
    if (dietTypes.has('ALLERGY') && allergenList.length === 0) severity = 'CRITICAL';

    specialByDepartment[department]++;
    dietList.forEach((d) => { specialByDiet[d]++; });
    special.push({
      studentId: s.id,
      studentName: s.name,
      nickname: s.nickname || '',
      grade: s.grade,
      classroom: s.classroom || '',
      department,
      dietTypes: dietList,
      allergens: allergenList,
      forbiddenIngredients: Array.from(forbidden),
      substituteDish: substitute,
      notes,
      severity,
      needsKitchenReview: dietList.length > 1,
      verifiedByNurse: Boolean(profile?.verified_by_nurse),
    });
  }

  // เรียงถาดพิเศษ: CRITICAL ก่อน แล้วตามชั้น/ชื่อ
  special.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'CRITICAL' ? -1 : 1;
    if (a.grade !== b.grade) return a.grade.localeCompare(b.grade, 'th');
    return a.studentName.localeCompare(b.studentName, 'th');
  });

  const standardTotal = standard.NURSERY + standard.KINDERGARTEN + standard.PRIMARY + standard.OTHER;
  const studentTrays = standardTotal + special.length;

  const staffPresent = Math.max(0, Math.floor(input.staffPresent || 0));
  const override = input.staffOverride != null && Number.isFinite(Number(input.staffOverride))
    ? Math.max(0, Math.floor(Number(input.staffOverride)))
    : null;
  const staffEffective = override ?? staffPresent;

  if (!menu) {
    warnings.push('ยังไม่ได้ตั้งเมนูประจำวัน — กรอกที่แท็บ "เมนูประจำสัปดาห์" เพื่อให้ป้ายถาดพิเศษระบุเมนูทดแทนได้');
  }
  if (menu && menuAllergens.length === 0 && special.some((t) => t.dietTypes.includes('ALLERGY'))) {
    warnings.push('เมนูวันนี้ยังไม่ระบุสารก่อภูมิแพ้ ระบบจึงทำเครื่องหมายเด็กแพ้อาหารทุกคนเป็น "ระวังสูงสุด" จนกว่าจะระบุสารก่อภูมิแพ้ในเมนู');
  }
  if (unmarkedCount > 0) {
    warnings.push(`มีนักเรียน ${unmarkedCount} คนที่ครูยังไม่ได้เช็กชื่อ (ไม่นับในถาด) — แนะนำสำรองอาหารเพิ่มตามความเหมาะสม`);
  }
  if (special.some((t) => t.needsKitchenReview)) {
    warnings.push('มีเด็กที่มีหลายเงื่อนไขอาหารพร้อมกัน (เช่น ฮาลาล + แพ้อาหาร) — หัวหน้าโรงครัวต้องตรวจสอบสูตรก่อนเสิร์ฟ');
  }
  if (staffPresent === 0 && override == null) {
    warnings.push('ไม่พบข้อมูลลงเวลาครู/บุคลากรวันนี้ — ระบุจำนวนสำรับครูด้วยตนเองได้');
  }

  return {
    date,
    cutoffTime: KITCHEN_CUTOFF_TIME,
    generatedAt: new Date().toISOString(),
    attendanceSource,
    menu,
    standard: { ...standard, total: standardTotal },
    specialByDepartment,
    specialByDiet,
    special,
    excluded,
    staff: { present: staffPresent, override, effective: staffEffective },
    totals: {
      studentTrays,
      staffMeals: staffEffective,
      grandTotal: studentTrays + staffEffective,
    },
    unmarkedCount,
    warnings,
  };
}

// -----------------------------------------------------------------------------
// Data loading (server-side, service_role client)
// -----------------------------------------------------------------------------

const ACTIVE_STUDENT_STATUSES = ['กำลังศึกษาอยู่', 'นักเรียนเข้าใหม่', 'นักเรียนเก่าเข้าใหม่'];

function isMissingTableError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message || '');
}

export interface KitchenLoadResult {
  input: KitchenSheetInput;
  /** ตารางที่ยังไม่ถูกสร้างใน DB (ให้ UI แจ้งให้รัน migration) */
  missingTables: string[];
}

export async function loadKitchenSheetInput(supabase: SupabaseClient, date: string): Promise<KitchenLoadResult> {
  const missingTables: string[] = [];

  const [studentsRes, attendanceRes, infirmaryRes, profilesRes, menuRes, staffRes, sheetRes] = await Promise.all([
    supabase
      .from('students')
      .select('id, name, nickname, grade, classroom, allergies, religion, medical_conditions, status')
      .in('status', ACTIVE_STUDENT_STATUSES)
      .limit(10000),
    supabase
      .from('student_attendance_logs')
      .select('student_id, status, check_out_time')
      .eq('attendance_date', date)
      .limit(20000),
    supabase
      .from('school_infirmary_visits')
      .select('student_id, symptoms, temperature_celsius, diagnosed_contagious_disease, rest_in_bed, time_left, notes')
      .eq('visit_date', date)
      .limit(5000),
    supabase.from('student_dietary_profiles').select('*').limit(10000),
    supabase.from('kitchen_cycle_menus').select('*').eq('menu_date', date).maybeSingle(),
    supabase
      .from('attendance_records')
      .select('user_id')
      .eq('date', date)
      .not('check_in_time', 'is', null)
      .limit(2000),
    supabase.from('kitchen_daily_production_sheets').select('staff_count_override').eq('prod_date', date).maybeSingle(),
  ]);

  if (studentsRes.error) throw new Error(`โหลดรายชื่อนักเรียนไม่สำเร็จ: ${studentsRes.error.message}`);

  const tolerate = (name: string, error: { code?: string; message?: string } | null) => {
    if (!error) return;
    if (isMissingTableError(error)) {
      missingTables.push(name);
      return;
    }
    throw new Error(`โหลด ${name} ไม่สำเร็จ: ${error.message}`);
  };
  tolerate('student_attendance_logs', attendanceRes.error);
  tolerate('school_infirmary_visits', infirmaryRes.error);
  tolerate('student_dietary_profiles', profilesRes.error);
  tolerate('kitchen_cycle_menus', menuRes.error);
  tolerate('attendance_records', staffRes.error);
  tolerate('kitchen_daily_production_sheets', sheetRes.error);

  const staffUserIds = new Set<string>((staffRes.data || []).map((r: { user_id: string }) => r.user_id));

  return {
    missingTables,
    input: {
      date,
      students: (studentsRes.data || []) as KitchenStudentInput[],
      attendance: (attendanceRes.data || []) as KitchenAttendanceInput[],
      infirmary: (infirmaryRes.data || []) as KitchenInfirmaryInput[],
      profiles: (profilesRes.data || []) as KitchenDietaryProfileInput[],
      menu: (menuRes.data as KitchenMenu | null) || null,
      staffPresent: staffUserIds.size,
      staffOverride: (sheetRes.data as { staff_count_override: number | null } | null)?.staff_count_override ?? null,
    },
  };
}

export async function buildKitchenProductionSheet(
  supabase: SupabaseClient,
  date: string
): Promise<{ sheet: KitchenProductionSheet; missingTables: string[] }> {
  const { input, missingTables } = await loadKitchenSheetInput(supabase, date);
  return { sheet: compileKitchenSheet(input), missingTables };
}

// -----------------------------------------------------------------------------
// Raw-material cost control (COA 52200)
// -----------------------------------------------------------------------------

export interface KitchenCostDay {
  date: string;
  rawMaterialCost: number;
  trays: number;
  traysSource: 'LOCKED_SHEET' | 'ATTENDANCE_ESTIMATE' | 'NONE';
  costPerTray: number | null;
  targetPerTray: number;
  overTarget: boolean;
}

export interface KitchenCostSummary {
  from: string;
  to: string;
  coaCode: string;
  coaName: string;
  totalCost: number;
  totalTrays: number;
  averageCostPerTray: number | null;
  targetPerTray: number;
  budgetVariance: number | null; // บวก = เกินงบ
  byCategory: Record<string, number>;
  days: KitchenCostDay[];
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function summarizeKitchenCost(params: {
  from: string;
  to: string;
  vouchers: Array<{ voucher_date: string; amount: number | string; category: string; status: string }>;
  lockedSheets: Array<{ prod_date: string; total_trays: number }>;
  attendanceTrays: Record<string, number>;
  targets: Record<string, number>;
  defaultTarget?: number;
}): KitchenCostSummary {
  const defaultTarget = params.defaultTarget ?? DEFAULT_TARGET_COST_PER_MEAL;
  const active = params.vouchers.filter((v) => v.status !== 'VOID');
  const costByDate = new Map<string, number>();
  const byCategory: Record<string, number> = {};
  active.forEach((v) => {
    const amt = Number(v.amount) || 0;
    costByDate.set(v.voucher_date, (costByDate.get(v.voucher_date) || 0) + amt);
    byCategory[v.category] = round2((byCategory[v.category] || 0) + amt);
  });
  const lockedMap = new Map(params.lockedSheets.map((s) => [s.prod_date, s.total_trays]));

  const dates = new Set<string>([...costByDate.keys(), ...lockedMap.keys()]);
  const days: KitchenCostDay[] = Array.from(dates)
    .sort()
    .map((date) => {
      const cost = round2(costByDate.get(date) || 0);
      let trays = 0;
      let source: KitchenCostDay['traysSource'] = 'NONE';
      if (lockedMap.has(date)) {
        trays = lockedMap.get(date) || 0;
        source = 'LOCKED_SHEET';
      } else if (params.attendanceTrays[date]) {
        trays = params.attendanceTrays[date];
        source = 'ATTENDANCE_ESTIMATE';
      }
      const target = params.targets[date] ?? defaultTarget;
      const perTray = trays > 0 ? round2(cost / trays) : null;
      return {
        date,
        rawMaterialCost: cost,
        trays,
        traysSource: source,
        costPerTray: perTray,
        targetPerTray: target,
        overTarget: perTray != null && perTray > target,
      };
    });

  const totalCost = round2(days.reduce((s, d) => s + d.rawMaterialCost, 0));
  const daysWithTrays = days.filter((d) => d.trays > 0);
  const totalTrays = daysWithTrays.reduce((s, d) => s + d.trays, 0);
  const costOnTrayDays = daysWithTrays.reduce((s, d) => s + d.rawMaterialCost, 0);
  const avg = totalTrays > 0 ? round2(costOnTrayDays / totalTrays) : null;
  const avgTarget = daysWithTrays.length > 0
    ? round2(daysWithTrays.reduce((s, d) => s + d.targetPerTray * d.trays, 0) / totalTrays)
    : defaultTarget;

  return {
    from: params.from,
    to: params.to,
    coaCode: KITCHEN_COA_CODE,
    coaName: KITCHEN_COA_NAME,
    totalCost,
    totalTrays,
    averageCostPerTray: avg,
    targetPerTray: avgTarget,
    budgetVariance: avg != null ? round2(avg - avgTarget) : null,
    byCategory,
    days,
  };
}

export async function loadKitchenCostSummary(
  supabase: SupabaseClient,
  from: string,
  to: string
): Promise<{ summary: KitchenCostSummary; missingTables: string[] }> {
  const missingTables: string[] = [];

  const [vouchersRes, sheetsRes, menusRes, attendanceRes, staffRes] = await Promise.all([
    supabase
      .from('kitchen_expense_vouchers')
      .select('voucher_date, amount, category, status')
      .gte('voucher_date', from)
      .lte('voucher_date', to)
      .limit(20000),
    supabase
      .from('kitchen_daily_production_sheets')
      .select('prod_date, total_trays, status')
      .gte('prod_date', from)
      .lte('prod_date', to)
      .eq('status', 'LOCKED'),
    supabase
      .from('kitchen_cycle_menus')
      .select('menu_date, target_cost_per_head')
      .gte('menu_date', from)
      .lte('menu_date', to),
    supabase
      .from('student_attendance_logs')
      .select('student_id, attendance_date, status')
      .gte('attendance_date', from)
      .lte('attendance_date', to)
      .in('status', ['PRESENT', 'LATE', 'EARLY_PICKUP'])
      .limit(100000),
    supabase
      .from('attendance_records')
      .select('user_id, date')
      .gte('date', from)
      .lte('date', to)
      .not('check_in_time', 'is', null)
      .limit(20000),
  ]);

  const tolerate = (name: string, error: { code?: string; message?: string } | null) => {
    if (!error) return;
    if (isMissingTableError(error)) {
      missingTables.push(name);
      return;
    }
    throw new Error(`โหลด ${name} ไม่สำเร็จ: ${error.message}`);
  };
  tolerate('kitchen_expense_vouchers', vouchersRes.error);
  tolerate('kitchen_daily_production_sheets', sheetsRes.error);
  tolerate('kitchen_cycle_menus', menusRes.error);
  tolerate('student_attendance_logs', attendanceRes.error);
  tolerate('attendance_records', staffRes.error);

  // ประมาณจำนวนถาดจากการเช็กชื่อ: นักเรียนที่มาเรียน (unique ต่อวัน) + บุคลากรที่ลงเวลา
  const studentsPerDay = new Map<string, Set<string>>();
  (attendanceRes.data || []).forEach((r: { student_id: string; attendance_date: string }) => {
    const set = studentsPerDay.get(r.attendance_date) || new Set<string>();
    set.add(r.student_id);
    studentsPerDay.set(r.attendance_date, set);
  });
  const staffPerDay = new Map<string, Set<string>>();
  (staffRes.data || []).forEach((r: { user_id: string; date: string }) => {
    const set = staffPerDay.get(r.date) || new Set<string>();
    set.add(r.user_id);
    staffPerDay.set(r.date, set);
  });
  const attendanceTrays: Record<string, number> = {};
  studentsPerDay.forEach((set, d) => {
    attendanceTrays[d] = set.size + (staffPerDay.get(d)?.size || 0);
  });

  const targets: Record<string, number> = {};
  (menusRes.data || []).forEach((m: { menu_date: string; target_cost_per_head: number | string | null }) => {
    if (m.target_cost_per_head != null) targets[m.menu_date] = Number(m.target_cost_per_head);
  });

  const summary = summarizeKitchenCost({
    from,
    to,
    vouchers: (vouchersRes.data || []) as Array<{ voucher_date: string; amount: number | string; category: string; status: string }>,
    lockedSheets: (sheetsRes.data || []) as Array<{ prod_date: string; total_trays: number }>,
    attendanceTrays,
    targets,
  });
  return { summary, missingTables };
}
