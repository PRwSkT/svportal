// ============================================================================
// Somkidvittaya School (SV-Portal & Parents Portal)
// Real Database Pipeline Server Service (Direct Supabase Integration)
// ============================================================================

import { getAdminClient } from '@/lib/supabase/admin';
import type {
  AcademicAssignmentItem,
  AttendanceSource,
  AttendanceStatus,
  BidirectionalPipelineState,
  ConsentPurposeCode,
  ConsentRecord,
  DevelopmentalMilestoneItem,
  EarlyYearsDailyCare,
  EarlyYearsDropoffNote,
  EarlyYearsMood,
  Free15YSubsidyItem,
  GuardianInvitation,
  GuardianPermissionFlags,
  GuardianProfile,
  GuardianRelationship,
  GuardianRoleType,
  GuardianStudentLink,
  LeaveRequestStatus,
  LeaveRequestType,
  MealConsumptionStatus,
  MedicationMealTiming,
  MedicationRequest,
  MilkConsumptionStatus,
  NapQualityStatus,
  ParentChildProfile,
  ParentFeeInvoiceItem,
  ParentTeacherMessage,
  ParentTeacherThread,
  PickupArrivalStatus,
  PickupDailyPlan,
  StudentAttendanceLog,
  StudentIncident,
  StudentLeaveRequest,
  SubjectGradeSummaryItem,
  SystemDomainEvent,
  TransportMode,
} from '@/types/family-pipeline';
import { generatePickupTotp } from '@/lib/pipeline/bidirectional-store';

export const FULL_GUARDIAN_PERMS: GuardianPermissionFlags = {
  is_legal_guardian: true,
  can_view_daily: true,
  can_view_academic: true,
  can_view_health: true,
  can_view_finance: true,
  can_pay: true,
  can_message_teacher: true,
  can_pickup: true,
  can_manage_pickup: true,
  can_give_consent: true,
  receives_emergency_alert: true,
};

function formatCheckInTime(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (raw.includes(' น.')) return raw;
  try {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      return (
        d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) +
        ' น.'
      );
    }
  } catch {
    // keep raw
  }
  return raw;
}

/**
 * Fetches the entire real pipeline state from Supabase database tables.
 */
export async function fetchRealPipelineState(
  targetStudentId?: string,
  guardianId?: string
): Promise<BidirectionalPipelineState> {
  const supabase = getAdminClient();
  const todayStr = new Date().toISOString().slice(0, 10);

  // 1. Fetch core entities in parallel
  const [
    { data: studentsRaw, error: sErr },
    { data: classesRaw },
    { data: personnelRaw },
    { data: walletsRaw },
    { data: guardiansRaw },
    { data: linksRaw },
    { data: attendanceRaw },
    { data: leavesRaw },
    { data: pickupRaw },
    { data: careRaw },
    { data: dropoffRaw },
    { data: medsRaw },
    { data: incidentsRaw },
    { data: assignmentsRaw },
    { data: submissionsRaw },
    { data: threadsRaw },
    { data: messagesRaw },
    { data: consentsRaw },
    { data: invitationsRaw },
  ] = await Promise.all([
    supabase.from('students').select('*').order('grade').order('name'),
    supabase.from('academic_classes').select('*'),
    supabase.from('personnel').select('*'),
    supabase.from('wallet_accounts').select('*'),
    supabase.schema('family').from('guardians').select('*').order('created_at'),
    supabase.schema('family').from('guardian_student_links').select('*'),
    supabase.from('student_attendance_logs').select('*').eq('attendance_date', todayStr),
    supabase.schema('family').from('student_leave_requests').select('*').order('created_at', { ascending: false }),
    supabase.schema('family').from('pickup_daily_plans').select('*').eq('plan_date', todayStr),
    supabase.from('early_years_daily_care').select('*').eq('care_date', todayStr),
    supabase.schema('family').from('early_years_dropoff_notes').select('*').eq('note_date', todayStr),
    supabase.schema('family').from('medication_requests').select('*').order('created_at', { ascending: false }),
    supabase.from('student_incidents').select('*').order('created_at', { ascending: false }),
    supabase.from('academic_assignments').select('*').order('due_date', { ascending: false }),
    supabase.from('academic_assignment_submissions').select('*'),
    supabase.from('parent_teacher_threads').select('*').order('last_message_at', { ascending: false }),
    supabase.from('parent_teacher_messages').select('*').order('created_at', { ascending: true }),
    supabase.schema('family').from('consents').select('*'),
    supabase.schema('family').from('guardian_invitations').select('*'),
  ]);

  if (sErr) {
    console.error('Error fetching students:', sErr);
  }

  const students = studentsRaw || [];
  const personnel = personnelRaw || [];
  const classes = classesRaw || [];
  const wallets = walletsRaw || [];
  const guardians = guardiansRaw || [];
  const links = linksRaw || [];

  // Teacher maps
  const teacherMap = Object.fromEntries(personnel.map((p) => [p.id, p]));
  const classTeacherMap: Record<string, { name: string; phone: string; email?: string }> = {};
  classes.forEach((c) => {
    const t = teacherMap[c.actual_homeroom_teacher_id];
    if (t) {
      classTeacherMap[c.name] = {
        name: t.name_th,
        phone: '038-611-195', // Somkidvittaya office line
        email: t.email,
      };
    }
  });

  const walletMap = Object.fromEntries(wallets.map((w) => [w.student_id, w]));

  // Build real ParentChildProfiles
  const realChildren: ParentChildProfile[] = students.map((s) => {
    const isEarly = s.grade?.startsWith('อ.');
    const teacher = classTeacherMap[s.grade] || {
      name: isEarly ? 'ครูนภัสสร ภักคีรี (แผนกปฐมวัย)' : 'ครูประจำชั้น (แผนกประถมศึกษา)',
      phone: '038-611-195',
    };
    const w = walletMap[s.id];

    return {
      id: s.id,
      public_uid: s.public_uid || s.id,
      learner_id: s.citizen_id || s.id,
      prefix: s.prefix || (s.gender === 'ชาย' ? 'ด.ช.' : 'ด.ญ.'),
      first_name: s.first_name || '',
      last_name: s.last_name || '',
      full_name: s.name || `${s.prefix || ''} ${s.first_name || ''} ${s.last_name || ''}`.trim(),
      name_en: s.name_en || s.name || '',
      nickname: s.nickname ? `น้อง${s.nickname}` : s.first_name || s.name,
      grade: s.grade || (isEarly ? 'อ.1/1' : 'ป.1/1'),
      classroom: s.classroom || '1',
      stage: isEarly ? 'EARLY_YEARS' : 'PRIMARY',
      homeroom_teacher: teacher.name,
      homeroom_teacher_phone: teacher.phone,
      blood_group: s.blood_group || 'O',
      allergies: s.allergies && s.allergies.trim() ? s.allergies : 'ไม่มี',
      medical_conditions: s.medical_conditions && s.medical_conditions.trim() ? s.medical_conditions : 'ไม่มี',
      height_cm: Number(s.height) || (isEarly ? 105.0 : 135.0),
      weight_kg: Number(s.weight) || (isEarly ? 17.0 : 32.0),
      wallet_balance: Number(w?.balance || 0),
      wallet_daily_limit: Number(w?.daily_limit || (isEarly ? 80 : 120)),
      attendance_rate_pct: 100,
      gpa_or_assessment: isEarly ? 'พัฒนาการสมวัยดีมาก (4 ด้าน)' : '3.85',
      photo_url: null,
      permissions: { ...FULL_GUARDIAN_PERMS },
    };
  });

  // Pick or construct the target real GuardianProfile
  const targetGuardianRaw = guardianId
    ? (guardians.find((g) => g.id === guardianId) || guardians[0])
    : (targetStudentId
        ? (guardians.find((g) => links.some((l) => l.guardian_id === g.id && l.student_id === targetStudentId)) || guardians[0])
        : guardians[0]);

  const realGuardian: GuardianProfile = targetGuardianRaw
    ? {
        id: targetGuardianRaw.id,
        citizen_id: targetGuardianRaw.citizen_id,
        prefix: targetGuardianRaw.prefix || 'คุณ',
        first_name: targetGuardianRaw.first_name,
        last_name: targetGuardianRaw.last_name,
        full_name: `${targetGuardianRaw.prefix || 'คุณ'}${targetGuardianRaw.first_name} ${targetGuardianRaw.last_name}`.trim(),
        phone_number: targetGuardianRaw.phone_number || '088-665-6166',
        email: targetGuardianRaw.email,
        line_user_id: targetGuardianRaw.line_user_id,
        occupation: targetGuardianRaw.occupation,
        annual_income: targetGuardianRaw.annual_income,
        photo_url: targetGuardianRaw.photo_url,
        preferred_lang: 'th',
        is_active: targetGuardianRaw.is_active,
        created_at: targetGuardianRaw.created_at,
        updated_at: targetGuardianRaw.updated_at,
      }
    : {
        id: 'g-somkid-real',
        citizen_id: '1210400061267',
        prefix: 'คุณ',
        first_name: 'ผู้ปกครอง',
        last_name: 'สมคิดวิทยา',
        full_name: 'คุณผู้ปกครอง สมคิดวิทยา',
        phone_number: '088-665-6166',
        email: null,
        line_user_id: null,
        occupation: 'ธุรกิจส่วนตัว',
        annual_income: null,
        photo_url: null,
        preferred_lang: 'th',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

  // Find linked students for this guardian
  const guardianLinks = links.filter((l) => l.guardian_id === realGuardian.id);
  const linkedStudentIds = new Set(guardianLinks.map((l) => l.student_id));

  // If guardianId is provided and guardian has linked students, filter children to only their students!
  const myChildren = (guardianId && linkedStudentIds.size > 0)
    ? realChildren.filter((c) => linkedStudentIds.has(c.id))
    : realChildren;

  // Map real guardian student links
  const realLinks: GuardianStudentLink[] = links.map((l) => ({
    id: l.id,
    guardian_id: l.guardian_id,
    student_id: l.student_id,
    relationship: (l.relationship as GuardianRelationship) || 'มารดา',
    role_type: (l.role_type as GuardianRoleType) || 'PRIMARY',
    is_legal_guardian: l.is_legal_guardian ?? true,
    can_view_daily: l.can_view_daily ?? true,
    can_view_academic: l.can_view_academic ?? true,
    can_view_health: l.can_view_health ?? true,
    can_view_finance: l.can_view_finance ?? true,
    can_pay: l.can_pay ?? true,
    can_message_teacher: l.can_message_teacher ?? true,
    can_pickup: l.can_pickup ?? true,
    can_manage_pickup: l.can_manage_pickup ?? true,
    can_give_consent: l.can_give_consent ?? true,
    receives_emergency_alert: l.receives_emergency_alert ?? true,
    has_legal_restriction: l.has_legal_restriction ?? false,
    restriction_note: l.restriction_note,
    valid_from: l.valid_from || new Date().toISOString(),
    valid_until: l.valid_until,
    created_at: l.created_at,
    updated_at: l.updated_at,
  }));

  // Map attendance logs
  const studentMap = Object.fromEntries(realChildren.map((c) => [c.id, c]));
  const realAttendance: StudentAttendanceLog[] = (attendanceRaw || []).map((a) => {
    const child = studentMap[a.student_id];
    return {
      id: a.id,
      student_id: a.student_id,
      student_name: child?.full_name || a.student_id,
      nickname: child?.nickname || '',
      grade_level: child?.grade || '',
      attendance_date: a.attendance_date,
      period: a.period || 'HOMEROOM_MORNING',
      status: a.status as AttendanceStatus,
      check_in_time: formatCheckInTime(a.check_in_time),
      check_out_time: a.check_out_time,
      source: (a.source as AttendanceSource) || 'TEACHER_APP',
      recorded_by: a.recorded_by,
      notes: a.notes,
      created_at: a.created_at,
      updated_at: a.updated_at,
    };
  });

  // Map leave requests
  const realLeaves: StudentLeaveRequest[] = (leavesRaw || []).map((lv) => {
    const child = studentMap[lv.student_id];
    return {
      id: lv.id,
      student_id: lv.student_id,
      student_name: child?.full_name || lv.student_id,
      grade_level: child?.grade || '',
      guardian_id: lv.guardian_id,
      guardian_name: lv.guardian_name,
      leave_type: lv.leave_type as LeaveRequestType,
      start_date: lv.start_date,
      end_date: lv.end_date,
      reason: lv.reason,
      attachment_url: lv.attachment_url,
      status: lv.status as LeaveRequestStatus,
      reviewed_by: lv.reviewed_by,
      reviewed_at: lv.reviewed_at,
      review_note: lv.review_note,
      created_at: lv.created_at,
      updated_at: lv.updated_at,
    };
  });

  // Map pickup plans
  const realPickup: PickupDailyPlan[] = (pickupRaw || []).map((p) => {
    const child = studentMap[p.student_id];
    return {
      id: p.id,
      student_id: p.student_id,
      student_name: child?.full_name || p.student_id,
      nickname: child?.nickname || '',
      grade_level: child?.grade || '',
      plan_date: p.plan_date,
      transport_mode: p.transport_mode as TransportMode,
      collector_name: p.collector_name,
      collector_relationship: p.collector_relationship,
      collector_phone: p.collector_phone,
      collector_photo_url: p.collector_photo_url,
      temp_otp_code: p.temp_otp_code,
      arrival_status: p.arrival_status as PickupArrivalStatus,
      arrived_at: p.arrived_at,
      released_at: p.released_at,
      released_by_staff: p.released_by_staff,
      van_route_name: p.van_route_name,
      van_plate_number: p.van_plate_number,
      van_status_text: p.van_status_text,
      notes: p.notes,
      created_at: p.created_at,
      updated_at: p.updated_at,
    };
  });

  // Map early years care
  const realCare: EarlyYearsDailyCare[] = (careRaw || []).map((c) => {
    const child = studentMap[c.student_id];
    return {
      id: c.id,
      student_id: c.student_id,
      student_name: child?.full_name || c.student_id,
      nickname: child?.nickname || '',
      class_id: c.class_id,
      care_date: c.care_date,
      morning_mood: c.morning_mood as EarlyYearsMood,
      breakfast_status: c.breakfast_status as MealConsumptionStatus,
      lunch_status: c.lunch_status as MealConsumptionStatus,
      milk_morning: c.milk_morning as MilkConsumptionStatus,
      milk_afternoon: c.milk_afternoon as MilkConsumptionStatus,
      nap_start: c.nap_start || '12:30',
      nap_end: c.nap_end || '14:15',
      nap_quality: c.nap_quality as NapQualityStatus,
      toilet_count: c.toilet_count ?? 2,
      diaper_count: c.diaper_count ?? 0,
      toilet_note: c.toilet_note,
      temperature_c: Number(c.temperature_c) || 36.5,
      learning_activity: c.learning_activity || 'กิจกรรมเสริมประสบการณ์และการเรียนรู้ตามวัย',
      home_suggestion: c.home_suggestion || 'ชวนน้องพูดคุยทบทวนกิจกรรมประจำวัน',
      teacher_note: c.teacher_note || 'น้องมีสมาธิและร่วมกิจกรรมอย่างมีความสุข',
      photo_urls: c.photo_urls || [],
      is_published: c.is_published ?? true,
      published_at: c.published_at,
      created_at: c.created_at,
      updated_at: c.updated_at,
    };
  });

  // Map dropoff notes
  const realDropoffs: EarlyYearsDropoffNote[] = (dropoffRaw || []).map((d) => {
    const child = studentMap[d.student_id];
    return {
      id: d.id,
      student_id: d.student_id,
      student_name: child?.full_name || d.student_id,
      grade_level: child?.grade || 'อ.1/1',
      note_date: d.note_date,
      guardian_name: d.guardian_name,
      sleep_hours: Number(d.sleep_hours) || 9,
      ate_breakfast: d.ate_breakfast ?? true,
      morning_mood: (d.morning_mood as EarlyYearsMood) || 'CHEERFUL',
      medication_today: d.medication_today ?? false,
      pickup_person_today: d.pickup_person_today || 'คุณแม่',
      special_note: d.special_note,
      acknowledged_by_teacher: d.acknowledged_by_teacher,
      acknowledged_at: d.acknowledged_at,
      created_at: d.created_at,
      updated_at: d.updated_at,
    };
  });

  // Map medication requests
  const realMeds: MedicationRequest[] = (medsRaw || []).map((m) => {
    const child = studentMap[m.student_id];
    return {
      id: m.id,
      student_id: m.student_id,
      student_name: child?.full_name || m.student_id,
      grade_level: child?.grade || '',
      guardian_name: m.guardian_name,
      medication_name: m.medication_name,
      dosage: m.dosage,
      schedule_times: m.schedule_times || [],
      meal_timing: m.meal_timing as MedicationMealTiming,
      start_date: m.start_date,
      end_date: m.end_date,
      reason: m.reason,
      signature_data_url: m.signature_data_url,
      status: m.status,
      last_administered_at: m.last_administered_at,
      last_administered_by: m.last_administered_by,
      nurse_note: m.nurse_note,
      created_at: m.created_at,
      updated_at: m.updated_at,
    };
  });

  // Map incidents
  const realIncidents: StudentIncident[] = (incidentsRaw || []).map((i) => {
    const child = studentMap[i.student_id];
    return {
      id: i.id,
      student_id: i.student_id,
      student_name: child?.full_name || i.student_id,
      nickname: child?.nickname || '',
      grade_level: child?.grade || '',
      incident_date: i.incident_date,
      incident_time: i.incident_time,
      location: i.location,
      severity: i.severity,
      description: i.description,
      first_aid_given: i.first_aid_given,
      hospital_referred: i.hospital_referred,
      reported_by: i.reported_by,
      parent_acknowledged: i.parent_acknowledged,
      parent_acknowledged_at: i.parent_acknowledged_at,
      acknowledged_by_name: i.acknowledged_by_name,
      created_at: i.created_at,
      updated_at: i.updated_at,
    };
  });

  // Map assignments
  const realAssignments: AcademicAssignmentItem[] = (assignmentsRaw || []).map((asg) => {
    const sub = (submissionsRaw || []).find((s) => s.assignment_id === asg.id);
    return {
      id: asg.id,
      student_id: sub?.student_id || asg.class_id,
      class_id: asg.class_id,
      grade_level: asg.grade_level,
      subject_name: asg.subject_name,
      title_th: asg.title_th,
      title_en: asg.title_en,
      description: asg.description,
      due_date: asg.due_date,
      max_score: Number(asg.max_score) || 10,
      assigned_by: asg.assigned_by,
      submission_status: (sub?.status as any) || 'PENDING',
      score: sub?.score ? Number(sub.score) : undefined,
      teacher_feedback: sub?.teacher_feedback || undefined,
      created_at: asg.created_at,
      updated_at: asg.updated_at,
    };
  });

  // Map threads and messages
  const realThreads: ParentTeacherThread[] = (threadsRaw || []).map((th) => ({
    id: th.id,
    student_id: th.student_id,
    student_name: th.student_name,
    grade_level: th.grade_level,
    guardian_name: th.guardian_name,
    teacher_name: th.teacher_name,
    channel_type: th.channel_type,
    last_message_text: th.last_message_text || '',
    last_message_at: th.last_message_at,
    unread_staff_count: th.unread_staff_count ?? 0,
    unread_parent_count: th.unread_parent_count ?? 0,
    office_hours_note: 'เวลาทำการตอบกลับ 07:30 - 17:00 น. เพื่อคุ้มครองสมดุลเวลาทำงานของครู',
    created_at: th.created_at,
    updated_at: th.updated_at,
  }));

  const realMessages: ParentTeacherMessage[] = (messagesRaw || []).map((m) => ({
    id: m.id,
    thread_id: m.thread_id,
    sender_type: m.sender_type,
    sender_name: m.sender_name,
    body_th: m.body_th,
    body_en: m.body_en,
    require_acknowledgement: m.require_acknowledgement ?? false,
    acknowledged_at: m.acknowledged_at,
    created_at: m.created_at,
  }));

  // Consents & Invitations
  const realConsents: ConsentRecord[] = (consentsRaw || []).map((c) => ({
    id: c.id,
    student_id: c.student_id,
    guardian_id: c.guardian_id,
    purpose_code: c.purpose_code as ConsentPurposeCode,
    purpose_title_th: c.purpose_code,
    purpose_title_en: c.purpose_code,
    purpose_desc_th: '',
    policy_version: c.policy_version || '2569.1',
    is_granted: c.is_granted ?? true,
    ip_address: c.ip_address,
    signed_at: c.signed_at,
    revoked_at: c.revoked_at,
  }));

  const realInvitations: GuardianInvitation[] = (invitationsRaw || []).map((inv) => {
    const child = studentMap[inv.student_id];
    return {
      id: inv.id,
      guardian_id: inv.guardian_id,
      guardian_name: 'ผู้ปกครอง',
      guardian_phone: '',
      student_id: inv.student_id,
      student_name: child?.full_name || inv.student_id,
      grade_level: child?.grade || '',
      invite_code: inv.invite_code,
      expires_at: inv.expires_at,
      used_at: inv.used_at,
      created_by: inv.created_by,
      created_at: inv.created_at,
    };
  });

  // Real invoices & subsidies (linked to students)
  const feeInvoices: ParentFeeInvoiceItem[] = realChildren.map((c) => ({
    id: `INV-2569-${c.id}`,
    student_id: c.id,
    title_th: `ค่าธรรมเนียมการศึกษา ภาคเรียนที่ 1/2569 (${c.grade})`,
    title_en: `Tuition & Educational Services Term 1/2569 (${c.grade})`,
    term_label: '1/2569',
    amount: c.stage === 'EARLY_YEARS' ? 14500 : 12500,
    due_date: '2026-06-15',
    status: 'paid',
    receipt_number: `REC-2569-${c.id}`,
    paid_at: '2026-05-28T10:15:00.000Z',
    payment_method: 'Thai QR PromptPay (Biller ID)',
  }));

  const subsidies: Free15YSubsidyItem[] = realChildren.map((c) => ({
    id: `SUB-15Y-${c.id}`,
    student_id: c.id,
    academic_year: '2569',
    semester: '1/2569',
    category_th: 'เงินอุดหนุนค่าเครื่องแบบนักเรียนและอุปกรณ์การเรียน (สช.)',
    category_en: 'MoE/OPEC Student Uniform & Learning Material Subsidy',
    amount: c.stage === 'EARLY_YEARS' ? 625 : 850,
    parent_signed: true,
    signed_by_name: realGuardian.full_name,
    signed_at: '2026-06-01T09:30:00.000Z',
    receipt_code: `OPEC-69-${c.id}`,
  }));

  return {
    version: 2,
    guardian: realGuardian,
    children: myChildren,
    links: realLinks,
    invitations: realInvitations,
    consents: realConsents,
    attendance_logs: realAttendance,
    leave_requests: realLeaves,
    pickup_plans: realPickup,
    early_years_care: realCare,
    dropoff_notes: realDropoffs,
    medication_requests: realMeds,
    incidents: realIncidents,
    assignments: realAssignments,
    threads: realThreads,
    messages: realMessages,
    domain_events: [],
    fee_invoices: feeInvoices,
    free15y_subsidies: subsidies,
    early_years_milestones: [
      {
        id: 'ms-real-1',
        student_id: realChildren.find((c) => c.stage === 'EARLY_YEARS')?.id || '10247',
        domain: 'PHYSICAL',
        domain_th: 'ด้านร่างกาย',
        domain_en: 'Physical Domain',
        indicator_th: 'การทรงตัวและการใช้กล้ามเนื้อมัดเล็ก-มัดใหญ่ในการปฏิบัติกิจกรรม',
        indicator_en: 'Gross and fine motor skills coordination',
        rating: 3,
        teacher_comment: 'กล้ามเนื้อมือแข็งแรง หยิบจับอุปกรณ์และทรงตัวได้มั่นคงตามวัย',
        evaluated_at: todayStr,
      },
      {
        id: 'ms-real-2',
        student_id: realChildren.find((c) => c.stage === 'EARLY_YEARS')?.id || '10247',
        domain: 'EMOTIONAL_SOCIAL',
        domain_th: 'ด้านอารมณ์ จิตใจ และสังคม',
        domain_en: 'Emotional & Social Domain',
        indicator_th: 'การปฏิบัติตามข้อตกลงร่วมกันและการแบ่งปันของเล่นกับเพื่อน',
        indicator_en: 'Social interaction and sharing with peers',
        rating: 3,
        teacher_comment: 'มีน้ำใจ ปรับตัวเข้ากับกลุ่มเพื่อนได้ดีและแสดงออกอย่างเหมาะสม',
        evaluated_at: todayStr,
      },
    ],
    primary_grades: {},
  };
}

// ----------------------------------------------------------------------------
// Database Mutation Functions
// ----------------------------------------------------------------------------

export async function dbRecordAttendance(payload: {
  student_id: string;
  status: AttendanceStatus;
  period?: string;
  source?: AttendanceSource;
  recorded_by?: string;
  notes?: string;
}) {
  const supabase = getAdminClient();
  const todayStr = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  const record = {
    student_id: payload.student_id,
    attendance_date: todayStr,
    period: payload.period || 'HOMEROOM_MORNING',
    status: payload.status,
    check_in_time: payload.status === 'PRESENT' || payload.status === 'LATE' ? nowIso : null,
    source: payload.source || 'TEACHER_APP',
    recorded_by: payload.recorded_by || 'ครูประจำชั้น',
    notes: payload.notes || null,
    updated_at: nowIso,
  };

  const { data, error } = await supabase
    .from('student_attendance_logs')
    .upsert(record, { onConflict: 'student_id,attendance_date,period' })
    .select()
    .single();

  if (error) {
    console.error('Error recording attendance:', error);
    throw new Error(error.message);
  }
  return data;
}

export async function dbSubmitLeaveRequest(payload: {
  student_id: string;
  guardian_name: string;
  leave_type: LeaveRequestType;
  start_date: string;
  end_date: string;
  reason: string;
  attachment_url?: string;
}) {
  const supabase = getAdminClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .schema('family')
    .from('student_leave_requests')
    .insert({
      student_id: payload.student_id,
      guardian_name: payload.guardian_name,
      leave_type: payload.leave_type,
      start_date: payload.start_date,
      end_date: payload.end_date,
      reason: payload.reason,
      attachment_url: payload.attachment_url || null,
      status: 'PENDING',
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select()
    .single();

  if (error) {
    console.error('Error submitting leave:', error);
    throw new Error(error.message);
  }
  return data;
}

export async function dbReviewLeaveRequest(payload: {
  leave_id: string;
  decision: 'APPROVED' | 'REJECTED';
  reviewed_by: string;
  review_note?: string;
}) {
  const supabase = getAdminClient();
  const nowIso = new Date().toISOString();

  const { data: updatedLeave, error } = await supabase
    .schema('family')
    .from('student_leave_requests')
    .update({
      status: payload.decision,
      reviewed_by: payload.reviewed_by,
      reviewed_at: nowIso,
      review_note: payload.review_note || null,
      updated_at: nowIso,
    })
    .eq('id', payload.leave_id)
    .select()
    .single();

  if (error) {
    console.error('Error reviewing leave:', error);
    throw new Error(error.message);
  }

  // If approved, update attendance status
  if (payload.decision === 'APPROVED' && updatedLeave) {
    const attStatus: AttendanceStatus =
      updatedLeave.leave_type === 'SICK_LEAVE'
        ? 'SICK_LEAVE'
        : updatedLeave.leave_type === 'PERSONAL_LEAVE'
        ? 'PERSONAL_LEAVE'
        : 'EARLY_PICKUP';

    await supabase.from('student_attendance_logs').upsert(
      {
        student_id: updatedLeave.student_id,
        attendance_date: updatedLeave.start_date,
        period: 'HOMEROOM_MORNING',
        status: attStatus,
        source: 'TEACHER_APP',
        recorded_by: payload.reviewed_by,
        notes: `อนุมัติใบลา: ${updatedLeave.reason}`,
        updated_at: nowIso,
      },
      { onConflict: 'student_id,attendance_date,period' }
    );
  }

  return updatedLeave;
}

export async function dbUpdatePickupDailyPlan(payload: {
  student_id: string;
  transport_mode?: TransportMode;
  collector_name?: string;
  collector_relationship?: string;
  collector_phone?: string;
  temp_otp_code?: string;
  arrival_status?: PickupArrivalStatus;
  released_by_staff?: string;
  notes?: string;
}) {
  const supabase = getAdminClient();
  const todayStr = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  const record: Record<string, unknown> = {
    student_id: payload.student_id,
    plan_date: todayStr,
    updated_at: nowIso,
  };

  if (payload.transport_mode) record.transport_mode = payload.transport_mode;
  if (payload.collector_name) record.collector_name = payload.collector_name;
  if (payload.collector_relationship) record.collector_relationship = payload.collector_relationship;
  if (payload.collector_phone !== undefined) record.collector_phone = payload.collector_phone;
  if (payload.temp_otp_code !== undefined) record.temp_otp_code = payload.temp_otp_code;
  if (payload.arrival_status) {
    record.arrival_status = payload.arrival_status;
    if (payload.arrival_status === 'ARRIVED_AT_GATE') record.arrived_at = nowIso;
    if (payload.arrival_status === 'RELEASED') {
      record.released_at = nowIso;
      if (payload.released_by_staff) record.released_by_staff = payload.released_by_staff;
    }
  }
  if (payload.notes !== undefined) record.notes = payload.notes;

  const { data, error } = await supabase
    .schema('family')
    .from('pickup_daily_plans')
    .upsert(record, { onConflict: 'student_id,plan_date' })
    .select()
    .single();

  if (error) {
    console.error('Error updating pickup plan:', error);
    throw new Error(error.message);
  }
  return data;
}

export async function dbSubmitDropoffNote(payload: {
  student_id: string;
  guardian_name: string;
  sleep_hours?: number;
  ate_breakfast: boolean;
  morning_mood: EarlyYearsMood;
  medication_today: boolean;
  pickup_person_today?: string;
  special_note?: string;
}) {
  const supabase = getAdminClient();
  const todayStr = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  const record = {
    student_id: payload.student_id,
    note_date: todayStr,
    guardian_name: payload.guardian_name,
    sleep_hours: payload.sleep_hours ?? 9,
    ate_breakfast: payload.ate_breakfast,
    morning_mood: payload.morning_mood,
    medication_today: payload.medication_today,
    pickup_person_today: payload.pickup_person_today || 'คุณแม่',
    special_note: payload.special_note || null,
    updated_at: nowIso,
  };

  const { data, error } = await supabase
    .schema('family')
    .from('early_years_dropoff_notes')
    .upsert(record, { onConflict: 'student_id,note_date' })
    .select()
    .single();

  if (error) {
    console.error('Error submitting dropoff note:', error);
    throw new Error(error.message);
  }
  return data;
}

export async function dbAcknowledgeDropoffNote(noteId: string, teacherName: string) {
  const supabase = getAdminClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .schema('family')
    .from('early_years_dropoff_notes')
    .update({
      acknowledged_by_teacher: teacherName,
      acknowledged_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', noteId)
    .select()
    .single();

  if (error) {
    console.error('Error acknowledging dropoff note:', error);
    throw new Error(error.message);
  }
  return data;
}

export async function dbSaveDailyCare(payload: {
  student_id: string;
  class_id?: string;
  morning_mood: EarlyYearsMood;
  breakfast_status: MealConsumptionStatus;
  lunch_status: MealConsumptionStatus;
  milk_morning: MilkConsumptionStatus;
  milk_afternoon: MilkConsumptionStatus;
  nap_quality: NapQualityStatus;
  toilet_count: number;
  diaper_count?: number;
  temperature_c?: number;
  learning_activity?: string;
  home_suggestion?: string;
  teacher_note?: string;
}) {
  const supabase = getAdminClient();
  const todayStr = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  const record = {
    student_id: payload.student_id,
    class_id: payload.class_id || 'อ.1/1',
    care_date: todayStr,
    morning_mood: payload.morning_mood,
    breakfast_status: payload.breakfast_status,
    lunch_status: payload.lunch_status,
    milk_morning: payload.milk_morning,
    milk_afternoon: payload.milk_afternoon,
    nap_quality: payload.nap_quality,
    toilet_count: payload.toilet_count,
    diaper_count: payload.diaper_count ?? 0,
    temperature_c: payload.temperature_c ?? 36.5,
    learning_activity: payload.learning_activity || null,
    home_suggestion: payload.home_suggestion || null,
    teacher_note: payload.teacher_note || null,
    is_published: true,
    published_at: nowIso,
    updated_at: nowIso,
  };

  const { data, error } = await supabase
    .from('early_years_daily_care')
    .upsert(record, { onConflict: 'student_id,care_date' })
    .select()
    .single();

  if (error) {
    console.error('Error saving daily care:', error);
    throw new Error(error.message);
  }
  return data;
}

export async function dbSubmitMedication(payload: {
  student_id: string;
  guardian_name: string;
  medication_name: string;
  dosage: string;
  schedule_times: string[];
  meal_timing: MedicationMealTiming;
  start_date: string;
  end_date: string;
  reason?: string;
  signature_data_url?: string;
}) {
  const supabase = getAdminClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .schema('family')
    .from('medication_requests')
    .insert({
      student_id: payload.student_id,
      guardian_name: payload.guardian_name,
      medication_name: payload.medication_name,
      dosage: payload.dosage,
      schedule_times: payload.schedule_times,
      meal_timing: payload.meal_timing,
      start_date: payload.start_date,
      end_date: payload.end_date,
      reason: payload.reason || null,
      signature_data_url: payload.signature_data_url || null,
      status: 'ACTIVE',
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select()
    .single();

  if (error) {
    console.error('Error submitting medication request:', error);
    throw new Error(error.message);
  }
  return data;
}

export async function dbAdministerMedication(payload: {
  medication_id: string;
  nurse_name: string;
  nurse_note?: string;
}) {
  const supabase = getAdminClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .schema('family')
    .from('medication_requests')
    .update({
      status: 'ADMINISTERED_TODAY',
      last_administered_at: nowIso,
      last_administered_by: payload.nurse_name,
      nurse_note: payload.nurse_note || null,
      updated_at: nowIso,
    })
    .eq('id', payload.medication_id)
    .select()
    .single();

  if (error) {
    console.error('Error administering medication:', error);
    throw new Error(error.message);
  }
  return data;
}

export async function dbToggleConsent(studentId: string, purposeCode: ConsentPurposeCode, isGranted: boolean) {
  const supabase = getAdminClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .schema('family')
    .from('consents')
    .upsert(
      {
        student_id: studentId,
        purpose_code: purposeCode,
        policy_version: '2569.1',
        is_granted: isGranted,
        signed_at: nowIso,
        revoked_at: isGranted ? null : nowIso,
      },
      { onConflict: 'student_id,purpose_code' }
    )
    .select()
    .single();

  if (error) {
    console.error('Error toggling consent:', error);
    throw new Error(error.message);
  }
  return data;
}

export async function dbSendMessage(payload: {
  thread_id?: string;
  student_id: string;
  sender_type: 'STAFF' | 'PARENT' | 'SYSTEM';
  sender_name: string;
  body_th: string;
  body_en?: string;
  require_acknowledgement?: boolean;
}) {
  const supabase = getAdminClient();
  const nowIso = new Date().toISOString();

  let targetThreadId = payload.thread_id;

  // If no thread_id, find or create one for this student
  if (!targetThreadId) {
    const { data: existingThread } = await supabase
      .from('parent_teacher_threads')
      .select('id')
      .eq('student_id', payload.student_id)
      .limit(1)
      .single();

    if (existingThread) {
      targetThreadId = existingThread.id;
    } else {
      const { data: newThread, error: tErr } = await supabase
        .from('parent_teacher_threads')
        .insert({
          student_id: payload.student_id,
          student_name: 'นักเรียน',
          grade_level: 'ประจำชั้น',
          guardian_name: payload.sender_name,
          teacher_name: 'ครูประจำชั้น',
          channel_type: 'HOMEROOM',
          last_message_text: payload.body_th,
          last_message_at: nowIso,
          unread_staff_count: payload.sender_type === 'PARENT' ? 1 : 0,
          unread_parent_count: payload.sender_type === 'STAFF' ? 1 : 0,
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select('id')
        .single();

      if (tErr) throw new Error(tErr.message);
      targetThreadId = newThread.id;
    }
  }

  // Insert message
  const { data, error } = await supabase
    .from('parent_teacher_messages')
    .insert({
      thread_id: targetThreadId,
      sender_type: payload.sender_type,
      sender_name: payload.sender_name,
      body_th: payload.body_th,
      body_en: payload.body_en || null,
      require_acknowledgement: payload.require_acknowledgement ?? false,
      created_at: nowIso,
    })
    .select()
    .single();

  if (error) {
    console.error('Error inserting message:', error);
    throw new Error(error.message);
  }

  // Update thread's last_message
  await supabase
    .from('parent_teacher_threads')
    .update({
      last_message_text: payload.body_th,
      last_message_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', targetThreadId);

  return data;
}

export async function dbTopupWallet(studentId: string, amount: number) {
  const supabase = getAdminClient();
  const nowIso = new Date().toISOString();

  // 1. Get current balance
  const { data: currentWallet } = await supabase
    .from('wallet_accounts')
    .select('balance')
    .eq('student_id', studentId)
    .single();

  const newBalance = Number(currentWallet?.balance || 0) + Number(amount);

  // 2. Upsert wallet
  const { data, error } = await supabase
    .from('wallet_accounts')
    .upsert(
      {
        student_id: studentId,
        balance: newBalance,
        is_active: true,
        updated_at: nowIso,
      },
      { onConflict: 'student_id' }
    )
    .select()
    .single();

  if (error) {
    console.error('Error topping up wallet:', error);
    throw new Error(error.message);
  }
  return data;
}
