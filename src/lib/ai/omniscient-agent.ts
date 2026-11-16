/**
 * Omniscient "Nong Fah AI" Agent (น้องฟ้า ผู้ช่วยอัจฉริยะรอบรู้ประจำโรงเรียนสมคิดวิทยา)
 * Capable of live database reasoning across all 14 school sub-systems with strict RBAC & PDPA protection.
 */

import { getAdminClient } from '@/lib/supabase/admin';
import { callGeminiWithTools, callGeminiWithTwoPassSearch, GeminiToolCall } from '@/lib/ai/gemma';
import { getBangkokDateString } from '@/lib/db/netlify-bridge';
import { formatPromptPayPayload } from '@/lib/finance/emvco-promptpay';
import { getCollectiveMemoryContext } from '@/lib/ai/collective-memory';

export interface CallerContext {
  isStaff: boolean;
  userId: string | null;
  userEmail?: string | null;
  userName?: string | null;
  role: string; // 'admin' | 'executive' | 'teacher' | 'cashier' | 'parent' | 'staff'
  assignedFeatures?: string[];
  guardianId?: string | null;
  allowedStudentIds?: string[]; // strictly enforced for parents!
}

export interface OmniscientAgentResponse {
  answer: string;
  actionCard?: {
    type: 'PROMPTPAY_QR' | 'WAIVER_SUMMARY' | 'KITCHEN_ORDER' | 'DOCUMENT_DRAFT' | 'DEEP_LINK' | 'GENERIC_CARD';
    title: string;
    description: string;
    data: Record<string, unknown>;
  };
  toolsUsed: string[];
}

/**
 * Redacts 13-digit citizen IDs and telephone numbers for PDPA compliance
 */
export function maskPdpaData(text: string): string {
  if (!text) return '';
  // Mask 13-digit citizen IDs
  let masked = text.replace(/\b(\d{1})(\d{4})(\d{5})(\d{2})(\d{1})\b/g, '$1-xxxx-xxxxx-$4-$5');
  masked = masked.replace(/\b\d{13}\b/g, (match) => `${match.slice(0, 1)}xxxxxxxxxxxx${match.slice(-1)}`);
  // Mask phone numbers (08x, 09x, 06x, 02x, 03x)
  masked = masked.replace(/\b(0[689]\d{1})[-]?(\d{3})[-]?(\d{4})\b/g, '$1-xxx-$3');
  masked = masked.replace(/\b(0[23457]\d{1})[-]?(\d{3})[-]?(\d{3,4})\b/g, '$1-xxx-$3');
  return masked;
}

/**
 * Performs Entity Resolution before PDPA masking: finds candidate students by nickname, name, or student ID.
 */
export async function resolveStudentEntity(query: string, allowedStudentIds?: string[]): Promise<any[]> {
  const cleanQ = query.trim();
  if (!cleanQ || cleanQ.length < 2) return [];

  const supabase = getAdminClient();
  let qBuilder = supabase
    .from('students')
    .select('id, student_id, name, prefix, first_name, last_name, nickname, grade, classroom, wallet_balance, status')
    .or(`name.ilike.%${cleanQ}%,first_name.ilike.%${cleanQ}%,nickname.ilike.%${cleanQ}%,student_id.eq.${cleanQ}`);

  if (allowedStudentIds && allowedStudentIds.length > 0) {
    qBuilder = qBuilder.in('id', allowedStudentIds);
  }

  const { data } = await qBuilder.limit(5);
  return data || [];
}

/**
 * 14 Database Tools Definitions for Gemini Native Tool Calling
 */
export const NONGFAH_TOOL_DECLARATIONS = [
  {
    name: 'search_students_and_profiles',
    description: 'ค้นหาประวัตินักเรียน ชั้นเรียน ข้อมูลผู้ปกครอง และสถานะการศึกษา (RBAC: ผู้ปกครองค้นได้เฉพาะบุตรหลานตนเอง)',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'ชื่อ, นามสกุล, ชื่อเล่น หรือรหัสนักเรียน' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_attendance_and_kitchen_summary',
    description: 'ดึงสถิติเช็คชื่อการมาเรียนของนักเรียนวันนี้ และยอดสั่งผลิตอาหารโรงครัวประจำวัน (ไม่มีเงินอุดหนุนรัฐ 27 บ.)',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'วันที่ในรูปแบบ YYYY-MM-DD (ค่าเริ่มต้นคือวันนี้)' },
        grade: { type: 'string', description: 'ระดับชั้น เช่น อ.2, ป.4 หรือเว้นว่างเพื่อดูทั้งโรงเรียน' },
      },
    },
  },
  {
    name: 'get_canteen_menu_and_allergens',
    description: 'ดึงรายการอาหารกลางวันประจำวัน สารก่อภูมิแพ้ และเมนูทดแทน (ฮาลาล, มังสวิรัติ, อาหารอ่อน, ปลอดสารก่อภูมิแพ้)',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'วันที่ในรูปแบบ YYYY-MM-DD' },
      },
    },
  },
  {
    name: 'get_student_finance_and_installments',
    description: 'ตรวจสอบสถานะค่าเทอม แผนผ่อนชำระ 5 งวด/เทอม ค่าปรับล่าช้า วันผ่อนผัน 5 วัน คำขอยกเว้นค่าปรับ และใบเสร็จแยกเล่ม (01 REC- vs 02 SRV-)',
    parameters: {
      type: 'object',
      properties: {
        student_id: { type: 'string', description: 'รหัสประจำตัวนักเรียน หรือ UUID' },
      },
      required: ['student_id'],
    },
  },
  {
    name: 'get_wallet_and_pos_activity',
    description: 'ตรวจสอบยอดเงินในกระเป๋าเงินดิจิทัล (Wallet) วงเงินใช้จ่ายต่อวัน และประวัติการซื้อของที่ร้านค้าสหกรณ์/โรงอาหาร',
    parameters: {
      type: 'object',
      properties: {
        student_id: { type: 'string', description: 'รหัสประจำตัวนักเรียน' },
        limit: { type: 'number', description: 'จำนวนรายการล่าสุด (ค่าเริ่มต้น 5)' },
      },
      required: ['student_id'],
    },
  },
  {
    name: 'get_academic_grades_and_pp_status',
    description: 'ตรวจสอบผลการเรียน เกรดเฉลี่ย (GPA/GPAX) และความพร้อมของเอกสารหลักฐานทางการศึกษา (ปพ.1, ปพ.2, ปพ.3, ปพ.6)',
    parameters: {
      type: 'object',
      properties: {
        student_id: { type: 'string', description: 'รหัสประจำตัวนักเรียน' },
      },
      required: ['student_id'],
    },
  },
  {
    name: 'get_timetable_and_substitutions',
    description: 'ตรวจสอบตารางสอน ห้องเรียน และการสอนแทนของคุณครูในวันนี้',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'วันที่ในรูปแบบ YYYY-MM-DD' },
        teacher_id: { type: 'string', description: 'รหัสหรือชื่อคุณครู' },
        grade: { type: 'string', description: 'ระดับชั้น/ห้องเรียน' },
      },
    },
  },
  {
    name: 'get_infirmary_and_medication_queue',
    description: 'ตรวจสอบการเข้าห้องพยาบาล อุณหภูมิ อาการป่วย และรายการฝากจ่ายยาของนักเรียน',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'วันที่ในรูปแบบ YYYY-MM-DD' },
        student_id: { type: 'string', description: 'รหัสประจำตัวนักเรียน' },
      },
    },
  },
  {
    name: 'get_van_and_pickup_status',
    description: 'ตรวจสอบสถานะรถรับส่งนักเรียน และแผนการรับนักเรียนกลับบ้าน (ผู้มารับ, รหัสความปลอดภัย TOTP, สถานะการปล่อยตัว)',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'วันที่ในรูปแบบ YYYY-MM-DD' },
        student_id: { type: 'string', description: 'รหัสประจำตัวนักเรียน' },
      },
    },
  },
  {
    name: 'get_pastoral_care_summary',
    description: 'ดึงข้อมูลระบบดูแลช่วยเหลือนักเรียน: ผลการประเมิน SDQ 5 ด้าน, บันทึกการเยี่ยมบ้าน และระดับความเสี่ยง (ครู/แอดมินเท่านั้น)',
    parameters: {
      type: 'object',
      properties: {
        student_id: { type: 'string', description: 'รหัสประจำตัวนักเรียน' },
      },
      required: ['student_id'],
    },
  },
  {
    name: 'get_calendar_and_duty_roster',
    description: 'ตรวจสอบปฏิทินกิจกรรมโรงเรียน วันหยุด กำหนดการสอบ และเวรประจำวันของคุณครู (เวรประตูเช้า/เย็น)',
    parameters: {
      type: 'object',
      properties: {
        month: { type: 'string', description: 'เดือน YYYY-MM' },
        date: { type: 'string', description: 'วันที่ YYYY-MM-DD' },
      },
    },
  },
  {
    name: 'get_room_bookings_and_signage',
    description: 'ตรวจสอบการจองห้องเรียนรวม (ห้อง LLC, ห้องประชุม) และสื่อประชาสัมพันธ์ที่กำลังเล่นบนหน้าจอทีวีในโรงเรียน',
    parameters: {
      type: 'object',
      properties: {
        room_code: { type: 'string', description: 'รหัสห้อง เช่น LLC' },
        date: { type: 'string', description: 'วันที่ YYYY-MM-DD' },
      },
    },
  },
  {
    name: 'get_executive_kpi_and_treasury',
    description: 'ข้อมูลระดับผู้บริหาร: ความคืบหน้าการประเมิน KPI ครู และยอดรวมจัดเก็บค่าธรรมเนียมการศึกษา (แอดมิน/ผู้บริหารเท่านั้น)',
    parameters: {
      type: 'object',
      properties: {
        cycle_id: { type: 'string', description: 'รหัสรอบการประเมิน KPI (ถ้ามี)' },
      },
    },
  },
  {
    name: 'execute_portal_action',
    description: 'สร้างการ์ดคำสั่งสำหรับให้ผู้ใช้กดชำระเงิน PromptPay QR, สร้างใบลดหนี้/ขอยกเว้นค่าปรับ, ใบสั่งผลิตอาหาร หรือเปิดหน้าจอในระบบ',
    parameters: {
      type: 'object',
      properties: {
        action_type: {
          type: 'string',
          enum: ['PROMPTPAY_QR', 'WAIVER_SUMMARY', 'KITCHEN_ORDER', 'DOCUMENT_DRAFT', 'DEEP_LINK'],
          description: 'ประเภทของการ์ดคำสั่ง',
        },
        payload: { type: 'object', description: 'ข้อมูลประกอบการสั่งการ' },
      },
      required: ['action_type', 'payload'],
    },
  },
];

/**
 * Executes a tool call against the SVPortal live database with strict RBAC
 */
export async function executeNongFahTool(
  tool: GeminiToolCall,
  caller: CallerContext
): Promise<Record<string, unknown>> {
  const supabase = getAdminClient();
  const name = tool.name;
  const args = tool.args || {};
  const todayStr = getBangkokDateString();

  switch (name) {
    case 'search_students_and_profiles': {
      const q = String(args.query || '').trim();
      const students = await resolveStudentEntity(q, caller.isStaff ? undefined : caller.allowedStudentIds);
      return { count: students.length, students };
    }

    case 'get_attendance_and_kitchen_summary': {
      const targetDate = String(args.date || todayStr).slice(0, 10);
      const grade = args.grade ? String(args.grade) : null;

      // Attendance
      let attQuery = supabase
        .from('student_attendance_logs')
        .select('status, student_id')
        .eq('attendance_date', targetDate);

      const { data: logs } = await attQuery;
      const totalPresent = (logs || []).filter((l) => l.status === 'PRESENT' || l.status === 'LATE').length;
      const totalAbsent = (logs || []).filter((l) => l.status === 'ABSENT' || l.status === 'SICK_LEAVE').length;

      // In-House Kitchen Sheet
      const { data: sheet } = await supabase
        .from('kitchen_daily_production_sheets')
        .select('*')
        .eq('prod_date', targetDate)
        .maybeSingle();

      return {
        date: targetDate,
        attendance: { present: totalPresent, absent: totalAbsent, total_recorded: logs?.length || 0 },
        kitchen: sheet
          ? {
              status: sheet.status,
              nursery: sheet.nursery_standard,
              kindergarten: sheet.kindergarten_standard,
              primary: sheet.primary_standard,
              special_trays: sheet.special_tray_count,
              staff_meals: sheet.staff_count,
              total_trays: sheet.total_trays,
              note: 'อาหารกลางวันรวมอยู่ในค่าเทอม ดำเนินการโดยโรงครัวภายในโรงเรียน (ไม่มีเงินอุดหนุนรัฐ 27 บ.)',
            }
          : { status: 'PENDING_CUTOFF', note: 'ยังไม่ถึงเวลาตัดยอด 08:30 น.' },
      };
    }

    case 'get_canteen_menu_and_allergens': {
      const targetDate = String(args.date || todayStr).slice(0, 10);
      const { data: menu } = await supabase
        .from('kitchen_cycle_menus')
        .select('*')
        .eq('menu_date', targetDate)
        .maybeSingle();

      if (!menu) {
        return { date: targetDate, found: false, message: 'ไม่มีรายการอาหารระบุในวันนี้ (อาจเป็นวันหยุดเรียน)' };
      }

      return {
        date: targetDate,
        found: true,
        main_dish: menu.standard_main_dish,
        side_dish: menu.standard_side_dish,
        soup: menu.standard_soup,
        fruit: menu.standard_fruit,
        allergens: menu.standard_allergens || [],
        substitutes: {
          halal: menu.halal_substitute,
          vegetarian: menu.vegetarian_substitute,
          allergy_free: menu.allergy_free_substitute,
          soft_diet: menu.soft_diet_substitute,
          staff_dish: menu.staff_special_dish,
        },
      };
    }

    case 'get_student_finance_and_installments': {
      const sid = String(args.student_id || '').trim();
      if (!caller.isStaff && (!caller.allowedStudentIds || !caller.allowedStudentIds.includes(sid))) {
        return { error: 'Forbidden: คุณไม่มีสิทธิ์เข้าถึงข้อมูลการเงินของนักเรียนคนนี้' };
      }

      // 1. Invoices
      const { data: invoices } = await supabase
        .from('fee_invoices')
        .select('*')
        .eq('student_id', sid)
        .order('created_at', { ascending: false })
        .limit(3);

      // 2. Installment Agreement
      const { data: agreement } = await supabase
        .from('student_installment_agreements')
        .select('*, schedules:invoice_installment_schedules(*)')
        .eq('student_id', sid)
        .eq('status', 'ACTIVE')
        .maybeSingle();

      // 3. Waivers
      const { data: waivers } = await supabase
        .from('late_fee_waiver_requests')
        .select('*')
        .eq('student_id', sid)
        .order('created_at', { ascending: false })
        .limit(3);

      return {
        student_id: sid,
        has_installment_plan: !!agreement,
        agreement: agreement
          ? {
              id: agreement.id,
              num_installments: agreement.num_installments,
              total_term_amount: agreement.total_term_amount,
              schedules: (agreement.schedules || []).map((s: any) => ({
                tranche: s.installment_no,
                due_date: s.due_date,
                amount: s.amount,
                status: s.status,
                late_fee_accrued: s.late_fee_amount || 0,
                days_overdue: s.days_overdue || 0,
              })),
            }
          : null,
        invoices: invoices || [],
        recent_waiver_requests: waivers || [],
      };
    }

    case 'get_wallet_and_pos_activity': {
      const sid = String(args.student_id || '').trim();
      if (!caller.isStaff && (!caller.allowedStudentIds || !caller.allowedStudentIds.includes(sid))) {
        return { error: 'Forbidden: คุณไม่มีสิทธิ์เข้าถึงกระเป๋าเงินของนักเรียนคนนี้' };
      }

      const limit = Number(args.limit) || 5;
      const { data: account } = await supabase
        .from('wallet_accounts')
        .select('balance, daily_limit, is_active')
        .eq('student_id', sid)
        .maybeSingle();

      const { data: txs } = await supabase
        .from('wallet_transactions')
        .select('id, amount, type, channel, created_at, cashier_note')
        .eq('student_id', sid)
        .order('created_at', { ascending: false })
        .limit(limit);

      return {
        student_id: sid,
        balance: account?.balance || 0,
        daily_limit: account?.daily_limit || null,
        recent_transactions: txs || [],
      };
    }

    case 'get_academic_grades_and_pp_status': {
      const sid = String(args.student_id || '').trim();
      if (!caller.isStaff && (!caller.allowedStudentIds || !caller.allowedStudentIds.includes(sid))) {
        return { error: 'Forbidden: คุณไม่มีสิทธิ์เข้าถึงผลการเรียนของนักเรียนคนนี้' };
      }

      const { data: grades } = await supabase
        .from('academic_student_grades')
        .select('subject_name, score, grade_level, semester, academic_year')
        .eq('student_id', sid)
        .order('academic_year', { ascending: false });

      return {
        student_id: sid,
        grades_count: grades?.length || 0,
        grades: grades || [],
        pp_readiness: {
          pp1_transcript: 'พร้อมพิมพ์ (เมื่อเกรดครบ)',
          pp6_report_card: 'พร้อมพิมพ์ (ปพ.6 ระดับชั้น เนอสเซอรี่ ถึง ป.6)',
        },
      };
    }

    case 'get_timetable_and_substitutions': {
      const targetDate = String(args.date || todayStr).slice(0, 10);
      const { data: subs } = await supabase
        .from('teacher_substitutions')
        .select('*')
        .eq('substitution_date', targetDate);

      return {
        date: targetDate,
        substitutions: subs || [],
        message: subs && subs.length > 0 ? `มีการสอนแทน ${subs.length} รายการ` : 'การเรียนการสอนดำเนินไปตามตารางปกติ',
      };
    }

    case 'get_infirmary_and_medication_queue': {
      const targetDate = String(args.date || todayStr).slice(0, 10);
      const sid = args.student_id ? String(args.student_id) : null;

      if (sid && !caller.isStaff && (!caller.allowedStudentIds || !caller.allowedStudentIds.includes(sid))) {
        return { error: 'Forbidden: ไม่อนุญาตให้เข้าถึงข้อมูลสุขภาพของนักเรียนท่านอื่น' };
      }

      let infQuery = supabase
        .from('school_infirmary_visits')
        .select('*')
        .eq('visit_date', targetDate);

      if (sid) infQuery = infQuery.eq('student_id', sid);

      const { data: visits } = await infQuery.limit(10);
      return { date: targetDate, visits: visits || [] };
    }

    case 'get_van_and_pickup_status': {
      const targetDate = String(args.date || todayStr).slice(0, 10);
      const sid = args.student_id ? String(args.student_id) : null;

      if (sid && !caller.isStaff && (!caller.allowedStudentIds || !caller.allowedStudentIds.includes(sid))) {
        return { error: 'Forbidden: ไม่อนุญาตให้ตรวจสอบข้อมูลการรับส่งของครอบครัวอื่น' };
      }

      let pQuery = supabase
        .schema('family')
        .from('pickup_daily_plans')
        .select('*')
        .eq('plan_date', targetDate);

      if (sid) pQuery = pQuery.eq('student_id', sid);

      const { data: pickups } = await pQuery;
      return { date: targetDate, pickups: pickups || [] };
    }

    case 'get_pastoral_care_summary': {
      if (!caller.isStaff) {
        return { error: 'Forbidden: ข้อมูลการดูแลช่วยเหลือนักเรียน (SDQ และเยี่ยมบ้าน) สงวนสิทธิ์สำหรับคุณครูและแอดมินเท่านั้น' };
      }
      const sid = String(args.student_id || '').trim();
      const { data: sdq } = await supabase
        .from('student_sdq_evaluations')
        .select('*')
        .eq('student_id', sid)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: visit } = await supabase
        .from('student_home_visits')
        .select('*')
        .eq('student_id', sid)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        student_id: sid,
        sdq_result: sdq
          ? {
              status: sdq.total_status,
              difficulties_score: sdq.total_difficulties_score,
              prosocial_status: sdq.prosocial_status,
            }
          : 'ยังไม่ได้ทำการประเมิน',
        home_visit: visit
          ? {
              status: visit.status,
              visit_date: visit.visit_date,
              living_environment: visit.living_environment,
              risk_issues: visit.risk_issues,
            }
          : 'ยังไม่ได้บันทึกการเยี่ยมบ้าน',
      };
    }

    case 'get_calendar_and_duty_roster': {
      const targetDate = String(args.date || todayStr).slice(0, 10);
      const { data: events } = await supabase
        .from('school_events')
        .select('*')
        .gte('end_date', targetDate)
        .lte('start_date', targetDate)
        .limit(5);

      return {
        date: targetDate,
        events: events || [],
      };
    }

    case 'get_room_bookings_and_signage': {
      const rCode = String(args.room_code || 'LLC').toUpperCase();
      const { data: bookings } = await supabase
        .from('room_bookings')
        .select('*')
        .eq('room_code', rCode)
        .eq('date', todayStr)
        .order('start_time', { ascending: true });

      const { data: campaigns } = await supabase
        .from('signage_campaigns')
        .select('name, target_type, priority')
        .eq('is_active', 1);

      return {
        room_code: rCode,
        date: todayStr,
        bookings: bookings || [],
        active_signage_campaigns: campaigns || [],
      };
    }

    case 'get_executive_kpi_and_treasury': {
      if (caller.role !== 'admin' && caller.role !== 'executive') {
        return { error: 'Forbidden: ข้อมูลบริหารจัดการระดับผู้บริหาร (KPI และกระทรวงการคลัง) สงวนสิทธิ์เฉพาะผู้บริหารโรงเรียนเท่านั้น' };
      }

      const { data: kpiCycles } = await supabase.from('kpi_cycles').select('*').limit(3);
      const { data: coa } = await supabase.from('chart_of_accounts').select('code, name_th, category').limit(10);

      return {
        authorized: true,
        kpi_cycles: kpiCycles || [],
        chart_of_accounts: coa || [],
      };
    }

    case 'execute_portal_action': {
      const actionType = String(args.action_type || 'GENERIC_CARD');
      const payload = (args.payload as Record<string, unknown>) || {};

      if (actionType === 'PROMPTPAY_QR') {
        const studentId = String(payload.studentId || payload.student_id || '99999');
        const amount = Number(payload.amount || 0);
        const ref2 = String(payload.ref2 || payload.invoice_no || 'FEE');
        const qrPayload = formatPromptPayPayload({
          targetId: process.env.NEXT_PUBLIC_PROMPTPAY_BILLER_ID || '099400016839100',
          amount: amount > 0 ? amount : undefined,
          ref1: studentId,
          ref2,
        });

        return {
          action: 'PROMPTPAY_QR',
          qrPayload,
          amount,
          studentId,
          ref2,
          billerName: 'โรงเรียนสมคิดวิทยา (Somkidvittaya School)',
        };
      }

      return {
        action: actionType,
        payload,
        message: 'สร้างการ์ดคำสั่งเรียบร้อยแล้ว',
      };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

/**
 * Main Omniscient Nong Fah Agent Pipeline
 */
export async function runOmniscientNongFahAgent(options: {
  userPrompt: string;
  caller: CallerContext;
  conversationHistory?: Array<{ role: 'user' | 'model'; text: string }>;
}): Promise<OmniscientAgentResponse> {
  const { userPrompt, caller, conversationHistory = [] } = options;
  const todayStr = getBangkokDateString();
  const collectiveContext = await getCollectiveMemoryContext();

  const systemInstruction = `คุณคือ "น้องฟ้า" (Nong Fah AI) ผู้ช่วยอัจฉริยะรอบรู้ประจำโรงเรียนสมคิดวิทยา (Somkidvittaya School, จ.ระยอง)
บุคลิก: สุภาพ อ่อนน้อม น่ารัก ฉลาดรอบรู้ ตอบได้ทั้งคำถามทั่วไป (ความรู้, การสอน, วิทยาศาสตร์, แปลภาษา) และข้อมูลเรียลไทม์ของโรงเรียน
วันที่และเวลาปัจจุบันของระบบ: วันนี้คือวันที่ ${todayStr} (เวลามาตรฐานประเทศไทย ICT)

บริบทผู้ใช้ปัจจุบัน:
- ตัวตน: ${caller.userName || 'ผู้ใช้งาน'} (${caller.userEmail || caller.role})
- สิทธิ์การใช้งาน (Role): ${caller.role} (isStaff: ${caller.isStaff ? 'ใช่' : 'ไม่ใช่'})
- สิทธิ์ดูแลนักเรียน (Allowed Student IDs): ${caller.allowedStudentIds?.join(', ') || (caller.isStaff ? 'ทุกชั้นเรียน' : 'ไม่มี')}

กฎเหล็กด้านความปลอดภัยและนโยบายโรงเรียน:
1. อาหารกลางวัน: โรงเรียนสมคิดวิทยา "ปรุงอาหารในโรงครัวภายในโรงเรียน (In-House Kitchen) รวมอยู่ในค่าธรรมเนียมการศึกษา" **ไม่มีเงินอุดหนุนค่าอาหารกลางวัน 27 บาทจากรัฐ** ห้ามกล่าวถึงเงิน 27 บาทเด็ดขาด!
2. แผนผ่อนชำระ: รองรับผ่อนชำระสูงสุด 5 งวด/เทอม (งวด 1-5) ครบกำหนดวันที่ 5 ของเดือน ผ่อนผันได้ 5 วัน เกินจากนั้นคิดค่าปรับตามนโยบาย มีระบบขอยกเว้นค่าปรับ (Maker-Checker)
3. การเงินแยก 2 เล่มใบเสร็จ: เล่ม 01 (REC-) ค่าเล่าเรียนเบิกต้นสังกัดได้ / เล่ม 02 (SRV-) ค่าอาหารกิจกรรม
4. ความเป็นส่วนตัว PDPA: ห้ามเปิดเผยเลขบัตรประชาชน 13 หลัก หรือเบอร์โทรศัพท์เต็มรูปแบบเด็ดขาด และผู้ปกครองดูได้เฉพาะบุตรหลานตนเอง
5. การใช้เครื่องมือ (Tool Calling): หากคำถามเกี่ยวข้องกับข้อมูลนักเรียน, อาหาร, ค่าเทอม, ห้องพยาบาล, ตารางสอน, ปฏิทิน ให้เรียกใช้เครื่องมือที่กำหนดทันที
6. หากเป็นคำถามทั่วไป (เช่น ไอเดียการสอน, อธิบายแนวคิดวิชาการ, ทักทาย, แต่งกลอน, ข่าวสาร): ตอบได้อย่างเป็นธรรมชาติและเป็นมิตรโดยไม่ต้องเรียกเครื่องมือ
${collectiveContext}`;

  const toolsUsed: string[] = [];
  let actionCardData: OmniscientAgentResponse['actionCard'] | undefined = undefined;

  // Multi-turn contents builder
  const contents: any[] = [];
  for (const hist of conversationHistory.slice(-4)) {
    contents.push({
      role: hist.role === 'model' ? 'model' : 'user',
      parts: [{ text: hist.text }],
    });
  }
  contents.push({
    role: 'user',
    parts: [{ text: userPrompt }],
  });

  try {
    // 1. First Turn: Call Gemini with 14 Tool Declarations
    const initialCall = await callGeminiWithTools({
      systemInstruction,
      contents,
      tools: [{ functionDeclarations: NONGFAH_TOOL_DECLARATIONS as any }],
      temperature: 0.2,
      complexity: 'high',
    });

    // If Gemini requested tool calls, execute them and perform second turn
    if (initialCall.toolCalls && initialCall.toolCalls.length > 0) {
      const toolCallParts: any[] = [];
      const toolResponseParts: any[] = [];

      for (const tc of initialCall.toolCalls) {
        toolsUsed.push(tc.name);
        const result = await executeNongFahTool(tc, caller);

        toolCallParts.push({
          functionCall: {
            name: tc.name,
            args: tc.args,
          },
        });

        toolResponseParts.push({
          functionResponse: {
            name: tc.name,
            response: result,
          },
        });

        if (tc.name === 'execute_portal_action' && (result as any).action) {
          const actType = (result as any).action;
          actionCardData = {
            type: actType,
            title: actType === 'PROMPTPAY_QR' ? 'สแกนชำระผ่าน PromptPay QR' : 'การสั่งการผ่านพอร์ทัล',
            description: actType === 'PROMPTPAY_QR' ? `ยอดชำระ ${(result as any).amount?.toLocaleString()} บาท` : 'คำสั่งระบบดำเนินการเรียบร้อย',
            data: result,
          };
        }
      }

      contents.push({
        role: 'model',
        parts: toolCallParts,
      });

      contents.push({
        role: 'function',
        parts: toolResponseParts,
      });

      // Second turn with tool results
      const finalSynthesis = await callGeminiWithTools({
        systemInstruction,
        contents,
        temperature: 0.2,
        complexity: 'high',
      });

      const finalAnswer = maskPdpaData(finalSynthesis.text || 'น้องฟ้าตรวจสอบข้อมูลให้เรียบร้อยแล้วค่ะ');
      return {
        answer: finalAnswer,
        actionCard: actionCardData,
        toolsUsed,
      };
    }

    // If no tool was called (e.g. general conversational query, math, advice)
    const directAnswer = maskPdpaData(initialCall.text || 'สวัสดีค่ะ น้องฟ้ายินดีให้บริการค่ะ มีอะไรให้ช่วยสอบถามได้เลยนะคะ');
    return {
      answer: directAnswer,
      actionCard: actionCardData,
      toolsUsed,
    };
  } catch (error: any) {
    console.warn('[OmniscientNongFah] Tool call pass failed, falling back to 2-pass search grounding:', error?.message);

    // Fallback: Two-Pass Search Grounding
    const fallbackAnswer = await callGeminiWithTwoPassSearch({
      systemPrompt: systemInstruction,
      userPrompt,
      temperature: 0.2,
      complexity: 'medium',
    });

    return {
      answer: maskPdpaData(fallbackAnswer),
      toolsUsed: ['two_pass_search_fallback'],
    };
  }
}
