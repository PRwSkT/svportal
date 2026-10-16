/**
 * "น้องฟ้า" (Nong Fah) Smart Notification & Reminder Intelligence Engine
 * Somkidvittaya School SV-Portal
 */

import { callGemma } from '@/lib/ai/gemma';
import { getAdminClient } from '@/lib/supabase/admin';

export interface DraftNotificationInput {
  userPrompt: string;
  targetRole?: 'all' | 'teachers' | 'staff' | 'parents' | 'students';
  contextCategory?: 'kpi' | 'forms' | 'attendance' | 'announcement' | 'general';
  urgency?: 'normal' | 'urgent';
  destinationUrl?: string;
}

export interface DraftNotificationResult {
  title: string;
  body: string;
  category: string;
  targetRole: string;
  actionUrl: string;
  urgency: 'normal' | 'urgent';
  nongFahComment: string;
}

export interface SmartReminderItem {
  id: string;
  type:
    | 'kpi_pending'
    | 'form_deadline'
    | 'profile_incomplete'
    | 'academic_pending_head'
    | 'academic_pending_director'
    | 'attendance_at_risk'
    | 'calendar_event'
    | 'duty_upcoming';
  recipientUserId?: string;
  recipientEmail?: string;
  recipientName: string;
  recipientRole: string;
  title: string;
  body: string;
  actionUrl: string;
  urgency: 'normal' | 'urgent';
}

/**
 * Robust JSON Parser with graceful fallback
 */
function safeParseJson<T>(rawText: string, fallbackErrorMessage: string): T {
  let cleaned = (rawText || '').trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch (err: any) {
    console.error('[NongFah Notification AI] JSON parse error:', err?.message, rawText);
    throw new Error(fallbackErrorMessage);
  }
}

/**
 * น้องฟ้าช่วยร่างข้อความแจ้งเตือน (Smart Push Notification Drafter)
 */
export async function draftNotificationWithNongFah(
  input: DraftNotificationInput
): Promise<DraftNotificationResult> {
  const systemPrompt = `You are "น้องฟ้า" (Nong Fah), the polite, friendly, and expert educational AI Assistant for Somkidvittaya School (โรงเรียนสมคิดวิทยา).
Your task is to write high-converting, polite, and clear push notifications for teachers, staff, parents, or students of Somkidvittaya School.

Guidelines for Push Notifications:
1. "title": Maximum 40 characters. Catchy, polite, clear with school identity (e.g. "แจ้งเตือนจากโรงเรียนสมคิดวิทยา", "เตือนความจำ: กรอกแบบประเมิน KPI", "อัปเดตกิจกรรมโรงเรียน").
2. "body": Maximum 110 characters. Friendly and polite in Thai (ใช้คำลงท้าย ค่ะ / นะคะ), explain what needs to be done clearly and courteously.
3. "category": One of 'kpi', 'forms', 'announcement', 'reminder', 'general'.
4. "targetRole": One of 'all', 'teacher', 'staff', 'parent', 'student'.
5. "actionUrl": The most relevant in-app URL (e.g. '/admin/kpi', '/admin/forms', '/home').
6. "urgency": 'normal' or 'urgent'.
7. "nongFahComment": Brief sentence from Nong Fah in Thai explaining why this phrasing was chosen.

Respond ONLY with a valid JSON object matching this schema:
{
  "title": "string",
  "body": "string",
  "category": "string",
  "targetRole": "string",
  "actionUrl": "string",
  "urgency": "normal" | "urgent",
  "nongFahComment": "string"
}`;

  const userPrompt = `ความต้องการของแอดมิน:
- รายละเอียดข้อความ / กิจกรรม: "${input.userPrompt}"
- กลุ่มเป้าหมายที่ต้องการส่ง: ${input.targetRole || 'อัตโนมัติตามความเหมาะสม'}
- หมวดหมู่: ${input.contextCategory || 'ทั่วไป'}
- ระดับความด่วน: ${input.urgency || 'normal'}
- ลิงก์ปลายทาง (ถ้ามี): ${input.destinationUrl || 'เลือกที่เหมาะสม'}

ช่วยน้องฟ้าร่างหัวข้อและข้อความแจ้งเตือนที่สุภาพ น่าอ่าน และกระตุ้นให้ผู้รับกดเข้ามาดูทันทีหน่อยนะคะ`;

  const rawJson = await callGemma({
    systemPrompt,
    userPrompt,
    temperature: 0.3,
    maxTokens: 1024,
    responseMimeType: 'application/json',
  });

  return safeParseJson<DraftNotificationResult>(
    rawJson,
    'น้องฟ้าไม่สามารถประมวลผลข้อความแจ้งเตือนได้ กรุณาลองใหม่อีกครั้ง'
  );
}

/**
 * น้องฟ้าสแกนภารกิจที่ค้างและร่างข้อความเตือนรายบุคคล (Smart Automated Reminders)
 */
export async function scanSystemRemindersWithNongFah(): Promise<SmartReminderItem[]> {
  const supabase = getAdminClient();
  const reminders: SmartReminderItem[] = [];

  try {
    // 1. Scan pending KPI evaluations
    const { data: pendingKpis } = await supabase
      .from('kpi_evaluations')
      .select('id, personnel_id, cycle_id, status, personnel:personnel(name_th, email, user_id), cycle:kpi_cycles(title, end_date)')
      .in('status', ['draft', 'pending_self', 'pending_supervisor'])
      .limit(20);

    if (pendingKpis && pendingKpis.length > 0) {
      for (const k of pendingKpis) {
        const p = (k.personnel as any);
        const cycle = (k.cycle as any);
        if (p?.name_th) {
          reminders.push({
            id: `kpi-${k.id}`,
            type: 'kpi_pending',
            recipientUserId: p.user_id || undefined,
            recipientEmail: p.email || undefined,
            recipientName: p.name_th,
            recipientRole: 'teacher',
            title: `เตือนความจำ: ประเมิน KPI ${cycle?.title || ''}`,
            body: `สวัสดีค่ะ ${p.name_th} อย่าลืมกรอกผลการประเมินการปฏิบัติงานในระบบ SV Portal ให้เรียบร้อยนะคะ`,
            actionUrl: `/admin/kpi/${k.id}/self`,
            urgency: 'normal',
          });
        }
      }
    }

    // 2. Scan active forms nearing end date
    const now = new Date();
    const threeDaysLater = new Date();
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);

    const { data: expiringForms } = await supabase
      .from('forms')
      .select('id, slug, title_th, ends_at, access_type')
      .eq('is_published', true)
      .gte('ends_at', now.toISOString())
      .lte('ends_at', threeDaysLater.toISOString())
      .limit(5);

    if (expiringForms && expiringForms.length > 0) {
      for (const f of expiringForms) {
        reminders.push({
          id: `form-${f.id}`,
          type: 'form_deadline',
          recipientName: f.access_type === 'public' ? 'ผู้ปกครองและนักเรียน' : 'ครูและบุคลากร',
          recipientRole: f.access_type === 'public' ? 'all' : 'teacher',
          title: `ใกล้ปิดรับคำตอบ: ${f.title_th.slice(0, 25)}...`,
          body: `แบบฟอร์ม "${f.title_th}" ใกล้จะปิดรับคำตอบในอีกไม่กี่วัน กรุณากรอกข้อมูลให้ครบถ้วนนะคะ`,
          actionUrl: `/forms/${f.slug}`,
          urgency: 'urgent',
        });
      }
    }

    // 3. Scan Academic Gradebooks pending review (SUBMITTED_TO_HEAD)
    const { data: pendingHeadGbs } = await supabase
      .from('academic_gradebooks')
      .select('id, class:academic_classes(name), course:academic_courses(name_th)')
      .eq('approval_status', 'SUBMITTED_TO_HEAD')
      .limit(5);

    if (pendingHeadGbs && pendingHeadGbs.length > 0) {
      for (const gb of pendingHeadGbs) {
        const clsName = (gb.class as any)?.name || 'ห้องเรียน';
        const crsName = (gb.course as any)?.name_th || 'วิชา';
        reminders.push({
          id: `gb-head-${gb.id}`,
          type: 'academic_pending_head',
          recipientName: 'หัวหน้าแผนกวิชาการ',
          recipientRole: 'academic staff',
          title: `[เล่ม ปพ.5 รอตรวจทาน] (${clsName})`,
          body: `มีผลการเรียนวิชา ${crsName} ห้อง ${clsName} ส่งเข้ามาตรวจทาน กรุณาตรวจสอบความถูกต้องและอนุมัติค่ะ`,
          actionUrl: `/academic/gradebook?gradebook_id=${gb.id}`,
          urgency: 'urgent',
        });
      }
    }

    // 4. Scan Academic Gradebooks pending Director final sign-off (APPROVED_BY_HEAD)
    const { data: pendingDirectorGbs } = await supabase
      .from('academic_gradebooks')
      .select('id, class:academic_classes(name), course:academic_courses(name_th)')
      .eq('approval_status', 'APPROVED_BY_HEAD')
      .limit(5);

    if (pendingDirectorGbs && pendingDirectorGbs.length > 0) {
      for (const gb of pendingDirectorGbs) {
        const clsName = (gb.class as any)?.name || 'ห้องเรียน';
        const crsName = (gb.course as any)?.name_th || 'วิชา';
        reminders.push({
          id: `gb-dir-${gb.id}`,
          type: 'academic_pending_director',
          recipientName: 'ผู้อำนวยการ',
          recipientRole: 'executive',
          title: `[เล่ม ปพ.5 รอลงนามอนุมัติ] (${clsName})`,
          body: `ผลการเรียนวิชา ${crsName} ห้อง ${clsName} ผ่านการตรวจทานจากหัวหน้าแล้ว รอผู้อำนวยการลงนามอนุมัติขั้นสุดท้ายค่ะ`,
          actionUrl: `/academic?tab=review`,
          urgency: 'urgent',
        });
      }
    }

    // 5. Scan Students at risk of failing attendance rule (80% - 85% attendance)
    const { data: atRiskStudents } = await supabase
      .from('academic_student_grades')
      .select(`
        id, 
        attendance_percent, 
        student:students(name), 
        gradebook:academic_gradebooks(
          id, 
          class:academic_classes(name), 
          course:academic_courses(name_th),
          actual_teacher:personnel!academic_gradebooks_actual_teacher_id_fkey(name_th, user_id)
        )
      `)
      .gt('attendance_percent', 0)
      .lte('attendance_percent', 85)
      .neq('final_grade', 'มส')
      .limit(5);

    if (atRiskStudents && atRiskStudents.length > 0) {
      for (const s of atRiskStudents) {
        const stdName = (s.student as any)?.name || 'นักเรียน';
        const gb = (s.gradebook as any);
        const clsName = gb?.class?.name || '';
        const crsName = gb?.course?.name_th || '';
        const teacher = gb?.actual_teacher;

        reminders.push({
          id: `att-risk-${s.id}`,
          type: 'attendance_at_risk',
          recipientUserId: teacher?.user_id || undefined,
          recipientName: teacher?.name_th || 'ครูผู้สอน',
          recipientRole: 'teacher',
          title: `[แจ้งเตือนกลุ่มเสี่ยงติด มส] ${stdName}`,
          body: `นักเรียน ${stdName} ห้อง ${clsName} วิชา ${crsName} มีเวลาเรียนลดลงแตะ ${s.attendance_percent.toFixed(1)}% เสี่ยงติด มส. ค่ะ`,
          actionUrl: `/academic/gradebook?gradebook_id=${gb?.id}`,
          urgency: 'urgent',
        });
      }
    }

    // 6. Scan Upcoming Calendar Events & Duties (within 48 hours)
    const today = new Date().toISOString().split('T')[0];
    const twoDaysLater = new Date();
    twoDaysLater.setDate(twoDaysLater.getDate() + 2);
    const futureDate = twoDaysLater.toISOString().split('T')[0];

    const { data: upcomingCalEvents } = await supabase
      .from('calendar_events')
      .select('*')
      .gte('start_date', today)
      .lte('start_date', futureDate)
      .order('start_date', { ascending: true })
      .limit(6);

    if (upcomingCalEvents && upcomingCalEvents.length > 0) {
      for (const ev of upcomingCalEvents) {
        const isToday = ev.start_date === today;
        const timeText = isToday ? 'วันนี้' : `วันที่ ${ev.start_date}`;

        if (ev.is_duty) {
          reminders.push({
            id: `cal-duty-${ev.id}`,
            type: 'duty_upcoming',
            recipientName: 'ครูผู้ปฏิบัติหน้าที่เวร',
            recipientRole: 'teacher',
            title: `[แจ้งเตือนเวรปฏิบัติหน้าที่] (${timeText}): ${ev.title_th}`,
            body: `ท่านมีเวรปฏิบัติหน้าที่: ${ev.title_th} ${ev.location ? `ณ ${ev.location}` : ''} ${ev.description ? `(${ev.description})` : ''}`,
            actionUrl: `/calendar`,
            urgency: 'urgent',
          });
        } else {
          reminders.push({
            id: `cal-event-${ev.id}`,
            type: 'calendar_event',
            recipientName: ev.target_role === 'all' ? 'บุคลากรทุกคน' : ev.target_role,
            recipientRole: ev.target_role || 'all',
            title: `[ปฏิทินปฏิบัติงาน] (${timeText}): ${ev.title_th}`,
            body: `${ev.description || 'มีกำหนดการตามปฏิทินปฏิบัติงานโรงเรียน'} ${ev.location ? `ณ ${ev.location}` : ''}`,
            actionUrl: ev.action_url || `/calendar`,
            urgency: ev.category === 'academic' ? 'urgent' : 'normal',
          });
        }
      }
    }
  } catch (err: any) {
    console.error('[NongFah Notification AI] Error scanning system reminders:', err?.message);
  }

  return reminders;
}
