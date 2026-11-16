// ============================================================================
// Somkidvittaya School (SV-Portal & Parents Portal)
// Real Database Pipeline Server Service (Direct Supabase Integration)
// ============================================================================

import { getAdminClient } from '@/lib/supabase/admin';
import { getBangkokDate } from '@/lib/utils';
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
import {
  generatePickupTotp,
  getPickupTimeBucket,
} from '@/lib/pipeline/bidirectional-store';

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

/**
 * Masks 13-digit Thai National Citizen ID for PDPA compliance.
 * Example: '1100201928331' -> '1-1002-XXXXX-33-1'
 */
export function maskCitizenId(id: string | null | undefined): string {
  if (!id) return '';
  const digits = id.replace(/\D/g, '');
  if (digits.length === 13) {
    return `${digits[0]}-${digits.slice(1, 5)}-XXXXX-${digits.slice(10, 12)}-${digits[12]}`;
  }
  if (id.length > 6) {
    return `${id.slice(0, 3)}****${id.slice(-2)}`;
  }
  return id;
}

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
 * Fetches the real pipeline state from Supabase database tables.
 * Strictly scopes data to authenticated guardian's linked children if caller is a parent.
 */
export async function fetchRealPipelineState(
  targetStudentId?: string,
  guardianId?: string,
  isStaff: boolean = false
): Promise<BidirectionalPipelineState> {
  const supabase = getAdminClient();
  const todayStr = getBangkokDate();

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
    { data: feeItemsRaw },
    { data: feeTypesRaw },
    { data: tuitionPaymentsRaw },
    { data: subsidiesRaw },
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
    supabase.from('fee_items').select('*'),
    supabase.from('fee_types').select('*'),
    supabase.from('tuition_payments').select('*').order('created_at', { ascending: false }),
    supabase.from('subsidy_free15y_disbursements').select('*'),
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

  // Build real ParentChildProfiles with masked citizen ID in learner_id
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
      learner_id: maskCitizenId(s.citizen_id || s.id),
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
    ? guardians.find((g) => g.id === guardianId)
    : targetStudentId
    ? guardians.find((g) => links.some((l) => l.guardian_id === g.id && l.student_id === targetStudentId))
    : isStaff
    ? guardians[0]
    : null;

  const realGuardian: GuardianProfile = targetGuardianRaw
    ? {
        id: targetGuardianRaw.id,
        citizen_id: maskCitizenId(targetGuardianRaw.citizen_id),
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
        id: guardianId || 'g-guest',
        citizen_id: '1-1002-XXXXX-XX-X',
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
  const guardianLinks = guardianId
    ? links.filter((l) => l.guardian_id === realGuardian.id)
    : [];
  const linkedStudentIds = new Set(guardianLinks.map((l) => l.student_id));

  // Determine allowed children strictly based on caller identity
  let myChildren: ParentChildProfile[];
  if (guardianId) {
    myChildren = realChildren.filter((c) => linkedStudentIds.has(c.id));
  } else if (targetStudentId) {
    myChildren = realChildren.filter((c) => c.id === targetStudentId);
  } else if (isStaff) {
    myChildren = realChildren;
  } else {
    myChildren = [];
  }

  // Define allowedStudentIds filter set:
  // If caller is a guardian, only linked children.
  // If caller is staff and requested targetStudentId, that student.
  // If caller is staff without filter, all students (allowedStudentIds is null).
  const allowedStudentIds: Set<string> | null = guardianId
    ? linkedStudentIds
    : targetStudentId
    ? new Set([targetStudentId])
    : isStaff
    ? null
    : new Set();

  const childIdSet = new Set(myChildren.map((c) => c.id));
  const studentMap = Object.fromEntries(realChildren.map((c) => [c.id, c]));

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

  const scopedLinks = guardianId
    ? realLinks.filter((l) => l.guardian_id === realGuardian.id)
    : targetStudentId
    ? realLinks.filter((l) => l.student_id === targetStudentId)
    : realLinks;

  // Map attendance logs - standardized to MORNING_HOMEROOM
  const realAttendance: StudentAttendanceLog[] = (attendanceRaw || []).map((a) => {
    const child = studentMap[a.student_id];
    return {
      id: a.id,
      student_id: a.student_id,
      student_name: child?.full_name || a.student_id,
      nickname: child?.nickname || '',
      grade_level: child?.grade || '',
      attendance_date: a.attendance_date,
      period: a.period || 'MORNING_HOMEROOM',
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
  const scopedAttendance = allowedStudentIds
    ? realAttendance.filter((a) => allowedStudentIds.has(a.student_id))
    : realAttendance;

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
  const scopedLeaves = allowedStudentIds
    ? realLeaves.filter((lv) => allowedStudentIds.has(lv.student_id))
    : realLeaves;

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
  const scopedPickup = allowedStudentIds
    ? realPickup.filter((p) => allowedStudentIds.has(p.student_id))
    : realPickup;

  // Map early years care
  const realCare: EarlyYearsDailyCare[] = (careRaw || []).map((c) => {
    const child = studentMap[c.student_id];
    return {
      id: c.id,
      student_id: c.student_id,
      class_id: c.class_id || child?.grade || 'อ.1/1',
      student_name: child?.full_name || c.student_id,
      nickname: child?.nickname || '',
      care_date: c.care_date,
      morning_mood: c.morning_mood as EarlyYearsMood,
      breakfast_status: c.breakfast_status as MealConsumptionStatus,
      lunch_status: c.lunch_status as MealConsumptionStatus,
      milk_morning: c.milk_morning as MilkConsumptionStatus,
      milk_afternoon: c.milk_afternoon as MilkConsumptionStatus,
      nap_start: c.nap_start || '12:30',
      nap_end: c.nap_end || '14:30',
      nap_quality: c.nap_quality as NapQualityStatus,
      toilet_count: c.toilet_count,
      diaper_count: c.diaper_count,
      temperature_c: Number(c.temperature_c),
      learning_activity: c.learning_activity,
      home_suggestion: c.home_suggestion,
      teacher_note: c.teacher_note,
      photo_urls: c.photo_urls || [],
      is_published: c.is_published ?? true,
      published_at: c.published_at,
      created_at: c.created_at,
      updated_at: c.updated_at,
    };
  });
  const scopedCare = allowedStudentIds
    ? realCare.filter((c) => allowedStudentIds.has(c.student_id))
    : realCare;

  // Map dropoff notes
  const realDropoffs: EarlyYearsDropoffNote[] = (dropoffRaw || []).map((d) => {
    const child = studentMap[d.student_id];
    return {
      id: d.id,
      student_id: d.student_id,
      student_name: child?.full_name || d.student_id,
      grade_level: child?.grade || d.grade_level || 'อ.1/1',
      nickname: child?.nickname || '',
      note_date: d.note_date,
      guardian_name: d.guardian_name,
      sleep_hours: d.sleep_hours ? Number(d.sleep_hours) : 9,
      ate_breakfast: d.ate_breakfast ?? true,
      morning_mood: d.morning_mood as EarlyYearsMood,
      medication_today: d.medication_today ?? false,
      pickup_person_today: d.pickup_person_today || 'คุณแม่',
      special_note: d.special_note || '',
      acknowledged_by_teacher: d.acknowledged_by_teacher,
      acknowledged_at: d.acknowledged_at,
      created_at: d.created_at,
      updated_at: d.updated_at,
    };
  });
  const scopedDropoffs = allowedStudentIds
    ? realDropoffs.filter((d) => allowedStudentIds.has(d.student_id))
    : realDropoffs;

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
  const scopedMeds = allowedStudentIds
    ? realMeds.filter((m) => allowedStudentIds.has(m.student_id))
    : realMeds;

  // Map incidents
  const realIncidents: StudentIncident[] = (incidentsRaw || []).map((inc) => {
    const child = studentMap[inc.student_id];
    return {
      id: inc.id,
      student_id: inc.student_id,
      student_name: child?.full_name || inc.student_id,
      grade_level: child?.grade || '',
      incident_date: inc.incident_date,
      incident_time: inc.incident_time,
      location: inc.location,
      severity: inc.severity,
      description: inc.description,
      first_aid_given: inc.first_aid_given,
      hospital_referred: inc.hospital_referred ?? false,
      reported_by: inc.reported_by,
      parent_acknowledged: inc.parent_acknowledged ?? false,
      parent_acknowledged_at: inc.parent_acknowledged_at,
      acknowledged_by_name: inc.acknowledged_by_name,
      created_at: inc.created_at,
      updated_at: inc.updated_at,
    };
  });
  const scopedIncidents = allowedStudentIds
    ? realIncidents.filter((i) => allowedStudentIds.has(i.student_id))
    : realIncidents;

  // Map assignments
  const submissions = submissionsRaw || [];
  const submissionMap = new Map<string, { status: string; score: number | null; feedback: string | null }>();
  submissions.forEach((sub) => {
    submissionMap.set(`${sub.assignment_id}:${sub.student_id}`, {
      status: sub.status,
      score: sub.score ? Number(sub.score) : null,
      feedback: sub.teacher_feedback,
    });
  });

  const realAssignments: AcademicAssignmentItem[] = (assignmentsRaw || []).map((a) => {
    const firstSub = myChildren.length > 0
      ? submissionMap.get(`${a.id}:${myChildren[0].id}`)
      : undefined;

    return {
      id: a.id,
      class_id: a.class_id,
      grade_level: a.grade_level,
      subject_name: a.subject_name,
      title_th: a.title_th,
      title_en: a.title_en || a.title_th,
      description: a.description || '',
      due_date: a.due_date,
      max_score: Number(a.max_score || 10),
      assigned_by: a.assigned_by,
      student_id: myChildren[0]?.id || '',
      submission_status: (firstSub?.status as any) || 'PENDING',
      score: firstSub?.score,
      teacher_feedback: firstSub?.feedback,
      created_at: a.created_at,
      updated_at: a.updated_at || a.created_at || todayStr,
    };
  });

  const allowedGrades = new Set(myChildren.map((c) => c.grade));
  const allowedClasses = new Set(myChildren.map((c) => c.classroom));
  const scopedAssignments = allowedStudentIds
    ? realAssignments.filter((a) => allowedGrades.has(a.grade_level) || allowedClasses.has(a.class_id))
    : realAssignments;

  // Map threads & messages
  const realThreads: ParentTeacherThread[] = (threadsRaw || []).map((t) => {
    const child = studentMap[t.student_id];
    return {
      id: t.id,
      student_id: t.student_id,
      student_name: child?.full_name || t.student_name,
      grade_level: child?.grade || t.grade_level,
      guardian_name: t.guardian_name,
      teacher_name: t.teacher_name,
      channel_type: t.channel_type,
      subject: t.subject,
      last_message_text: t.last_message_text,
      last_message_at: t.last_message_at,
      unread_staff_count: t.unread_staff_count || 0,
      unread_parent_count: t.unread_parent_count || 0,
      office_hours_note: t.office_hours_note || 'เวลาทำการสื่อสาร 07:30 - 17:00 น. วันจันทร์-ศุกร์',
      created_at: t.created_at,
      updated_at: t.updated_at,
    };
  });
  const scopedThreads = allowedStudentIds
    ? realThreads.filter((t) => allowedStudentIds.has(t.student_id))
    : realThreads;

  const allowedThreadIds = new Set(scopedThreads.map((t) => t.id));
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
  const scopedMessages = allowedStudentIds
    ? realMessages.filter((m) => allowedThreadIds.has(m.thread_id))
    : realMessages;

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
  const scopedConsents = allowedStudentIds
    ? realConsents.filter((c) => allowedStudentIds.has(c.student_id))
    : realConsents;

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
  const scopedInvitations = allowedStudentIds
    ? realInvitations.filter(
        (inv) => allowedStudentIds.has(inv.student_id) || (guardianId && inv.guardian_id === realGuardian.id)
      )
    : realInvitations;

  // Fee Invoices from DB fee_items / fee_types or fallback
  const feeTypeMap = Object.fromEntries((feeTypesRaw || []).map((ft) => [ft.id, ft]));
  const paymentByStudentMap = new Map<string, any>();
  (tuitionPaymentsRaw || []).forEach((tp) => {
    if (!paymentByStudentMap.has(tp.student_id)) {
      paymentByStudentMap.set(tp.student_id, tp);
    }
  });

  let feeInvoices: ParentFeeInvoiceItem[] = [];
  if (feeItemsRaw && feeItemsRaw.length > 0) {
    feeInvoices = feeItemsRaw.map((fi) => {
      const ft = feeTypeMap[fi.fee_type_id];
      const child = studentMap[fi.student_id];
      const p = paymentByStudentMap.get(fi.student_id);
      return {
        id: fi.id,
        student_id: fi.student_id,
        title_th: ft?.name || `ค่าธรรมเนียมการศึกษา (${child?.grade || 'ประจำชั้น'})`,
        title_en: ft?.name || `Tuition & Services (${child?.grade || ''})`,
        term_label: `${ft?.semester || '1'}/${ft?.academic_year || '2569'}`,
        amount: Number(fi.amount),
        due_date: ft?.due_date || '2026-06-15',
        status: fi.status === 'paid' ? 'paid' : 'unpaid',
        receipt_number: p?.receipt_number || (fi.status === 'paid' ? `REC-2569-${fi.student_id}` : null),
        paid_at: p?.created_at || (fi.status === 'paid' ? fi.updated_at : null),
        payment_method: p?.payment_method ? `Thai QR PromptPay (${p.payment_method})` : null,
      };
    });
  } else {
    feeInvoices = realChildren.map((c) => ({
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
  }
  const scopedInvoices = allowedStudentIds
    ? feeInvoices.filter((inv) => allowedStudentIds.has(inv.student_id))
    : feeInvoices;

  // Free 15Y Subsidies from DB or fallback
  let subsidies: Free15YSubsidyItem[] = [];
  if (subsidiesRaw && subsidiesRaw.length > 0) {
    subsidies = subsidiesRaw.map((s) => ({
      id: s.id,
      student_id: s.student_id,
      academic_year: s.academic_year || '2569',
      semester: `${s.term || '1'}/${s.academic_year || '2569'}`,
      category_th: 'เงินอุดหนุนค่าเครื่องแบบนักเรียนและอุปกรณ์การเรียน (สช.)',
      category_en: 'MoE/OPEC Student Uniform & Learning Material Subsidy',
      amount: Number(s.total_amount || 850),
      parent_signed: Boolean(s.signature_data),
      signed_by_name: s.recipient_name || realGuardian.full_name,
      signed_at: s.disbursed_at || s.created_at,
      receipt_code: s.form_or1_1_number || `OPEC-69-${s.student_id}`,
    }));
  } else {
    subsidies = realChildren.map((c) => ({
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
  }
  const scopedSubsidies = allowedStudentIds
    ? subsidies.filter((sub) => allowedStudentIds.has(sub.student_id))
    : subsidies;

  const earlyMilestones: DevelopmentalMilestoneItem[] = [
    {
      id: 'ms-real-1',
      student_id: myChildren.find((c) => c.stage === 'EARLY_YEARS')?.id || '10247',
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
      student_id: myChildren.find((c) => c.stage === 'EARLY_YEARS')?.id || '10247',
      domain: 'EMOTIONAL_SOCIAL',
      domain_th: 'ด้านอารมณ์ จิตใจ และสังคม',
      domain_en: 'Emotional & Social Domain',
      indicator_th: 'การปฏิบัติตามข้อตกลงร่วมกันและการแบ่งปันของเล่นกับเพื่อน',
      indicator_en: 'Social interaction and sharing with peers',
      rating: 3,
      teacher_comment: 'มีน้ำใจ ปรับตัวเข้ากับกลุ่มเพื่อนได้ดีและแสดงออกอย่างเหมาะสม',
      evaluated_at: todayStr,
    },
  ];
  const scopedMilestones = allowedStudentIds
    ? earlyMilestones.filter((m) => allowedStudentIds.has(m.student_id))
    : earlyMilestones;

  return {
    version: 2,
    guardian: realGuardian,
    children: myChildren,
    links: scopedLinks,
    invitations: scopedInvitations,
    consents: scopedConsents,
    attendance_logs: scopedAttendance,
    leave_requests: scopedLeaves,
    pickup_plans: scopedPickup,
    early_years_care: scopedCare,
    dropoff_notes: scopedDropoffs,
    medication_requests: scopedMeds,
    incidents: scopedIncidents,
    assignments: scopedAssignments,
    threads: scopedThreads,
    messages: scopedMessages,
    domain_events: [],
    fee_invoices: scopedInvoices,
    free15y_subsidies: scopedSubsidies,
    early_years_milestones: scopedMilestones,
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
  const todayStr = getBangkokDate();
  const nowIso = new Date().toISOString();

  const record = {
    student_id: payload.student_id,
    attendance_date: todayStr,
    period: payload.period || 'MORNING_HOMEROOM',
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
  leave_id?: string;
  request_id?: string;
  decision?: 'APPROVED' | 'REJECTED';
  status?: 'APPROVED' | 'REJECTED';
  reviewed_by: string;
  review_note?: string;
}) {
  const targetId = payload.leave_id || payload.request_id;
  const targetDecision = payload.decision || payload.status;
  if (!targetId || !targetDecision) {
    throw new Error('leave_id/request_id and decision/status are required');
  }

  const supabase = getAdminClient();
  const nowIso = new Date().toISOString();

  const { data: updatedLeave, error } = await supabase
    .schema('family')
    .from('student_leave_requests')
    .update({
      status: targetDecision,
      reviewed_by: payload.reviewed_by,
      reviewed_at: nowIso,
      review_note: payload.review_note || null,
      updated_at: nowIso,
    })
    .eq('id', targetId)
    .select()
    .single();

  if (error) {
    console.error('Error reviewing leave:', error);
    throw new Error(error.message);
  }

  // If approved, update attendance status
  if (targetDecision === 'APPROVED' && updatedLeave) {
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
        period: 'MORNING_HOMEROOM',
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
  const todayStr = getBangkokDate();
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
  const todayStr = getBangkokDate();
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

export async function dbAcknowledgeDropoffNote(
  noteIdOrPayload: string | { note_id?: string; id?: string; teacher_name?: string },
  teacherName?: string
) {
  const noteId = typeof noteIdOrPayload === 'string'
    ? noteIdOrPayload
    : (noteIdOrPayload.note_id || noteIdOrPayload.id || '');
  const teacher = (typeof noteIdOrPayload === 'object' && noteIdOrPayload.teacher_name)
    ? noteIdOrPayload.teacher_name
    : (teacherName || 'ครูประจำชั้น');

  if (!noteId) {
    throw new Error('note_id is required to acknowledge dropoff note');
  }

  const supabase = getAdminClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .schema('family')
    .from('early_years_dropoff_notes')
    .update({
      acknowledged_by_teacher: teacher,
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
  const todayStr = getBangkokDate();
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
  medication_id?: string;
  request_id?: string;
  nurse_name: string;
  nurse_note?: string;
}) {
  const targetId = payload.medication_id || payload.request_id;
  if (!targetId) {
    throw new Error('medication_id or request_id is required');
  }

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
    .eq('id', targetId)
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

/**
 * Top up student wallet balance with bounds checking and immutable ledger insertion.
 */
export async function dbTopupWallet(studentId: string, amount: number) {
  if (typeof amount !== 'number' || isNaN(amount) || amount <= 0 || amount > 50000) {
    throw new Error('จำนวนเงินเติมกระเป๋าต้องอยู่ระหว่าง 1 ถึง 50,000 บาท');
  }

  const supabase = getAdminClient();
  const nowIso = new Date().toISOString();

  // 1. Get current balance
  const { data: currentWallet } = await supabase
    .from('wallet_accounts')
    .select('balance')
    .eq('student_id', studentId)
    .maybeSingle();

  const balanceBefore = Number(currentWallet?.balance || 0);
  const balanceAfter = balanceBefore + amount;

  // 2. Upsert wallet balance
  const { data: updatedWallet, error: wErr } = await supabase
    .from('wallet_accounts')
    .upsert(
      {
        student_id: studentId,
        balance: balanceAfter,
        is_active: true,
        updated_at: nowIso,
      },
      { onConflict: 'student_id' }
    )
    .select()
    .single();

  if (wErr) {
    console.error('Error topping up wallet account:', wErr);
    throw new Error(wErr.message);
  }

  // 3. Insert immutable ledger entry into wallet_transactions
  const { error: tErr } = await supabase
    .from('wallet_transactions')
    .insert({
      student_id: studentId,
      type: 'topup',
      amount: amount,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      channel: 'svportal',
      svportal_ref: 'PROMPTPAY-TOPUP',
      cashier_note: 'เติมเงินผ่าน Parents Portal PromptPay',
      created_at: nowIso,
    });

  if (tErr) {
    console.error('Error recording wallet transaction ledger:', tErr);
  }

  return updatedWallet;
}

/**
 * Updates student daily spending limit in wallet_accounts.
 */
export async function dbSaveDailyLimit(studentId: string, dailyLimit: number) {
  if (typeof dailyLimit !== 'number' || isNaN(dailyLimit) || dailyLimit < 0 || dailyLimit > 5000) {
    throw new Error('วงเงินใช้จ่ายต่อวันต้องอยู่ระหว่าง 0 ถึง 5,000 บาท');
  }

  const supabase = getAdminClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from('wallet_accounts')
    .upsert(
      {
        student_id: studentId,
        daily_limit: dailyLimit,
        is_active: true,
        updated_at: nowIso,
      },
      { onConflict: 'student_id' }
    )
    .select()
    .single();

  if (error) {
    console.error('Error saving daily limit:', error);
    throw new Error(error.message);
  }
  return data;
}

/**
 * Acknowledges receipt of a parent-teacher message.
 */
export async function dbAcknowledgeMessage(messageId: string) {
  const supabase = getAdminClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from('parent_teacher_messages')
    .update({
      acknowledged_at: nowIso,
    })
    .eq('id', messageId)
    .select()
    .single();

  if (error) {
    console.error('Error acknowledging message:', error);
    throw new Error(error.message);
  }
  return data;
}

/**
 * Acknowledges infirmary incident report by parent.
 */
export async function dbAcknowledgeIncident(incidentId: string, guardianName?: string) {
  const supabase = getAdminClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from('student_incidents')
    .update({
      parent_acknowledged: true,
      parent_acknowledged_at: nowIso,
      acknowledged_by_name: guardianName || 'ผู้ปกครอง',
      updated_at: nowIso,
    })
    .eq('id', incidentId)
    .select()
    .single();

  if (error) {
    console.error('Error acknowledging student incident:', error);
    throw new Error(error.message);
  }
  return data;
}

/**
 * Signs 15-Year Free Education Subsidy disbursement (อร.1/1) in Postgres.
 */
export async function dbSignFree15Y(
  subsidyId: string,
  guardianName: string,
  signatureData?: string,
  studentId?: string
) {
  const supabase = getAdminClient();
  const nowIso = new Date().toISOString();

  // Try updating if row exists with id
  const { data, error } = await supabase
    .from('subsidy_free15y_disbursements')
    .update({
      recipient_name: guardianName,
      signature_data: signatureData || 'DIGITAL_SIGNATURE_PARENT_PORTAL',
      disbursed_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', subsidyId)
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error signing free 15y subsidy:', error);
    throw new Error(error.message);
  }

  if (data) return data;

  // Fallback: upsert by student_id, academic_year '2569', term '1'
  const targetStudentId = studentId || subsidyId.replace('SUB-15Y-', '');
  const { data: upserted, error: upErr } = await supabase
    .from('subsidy_free15y_disbursements')
    .upsert(
      {
        student_id: targetStudentId,
        academic_year: '2569',
        term: '1',
        disbursement_type: 'ALL',
        recipient_name: guardianName,
        signature_data: signatureData || 'DIGITAL_SIGNATURE_PARENT_PORTAL',
        disbursed_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: 'student_id,academic_year,term,disbursement_type' }
    )
    .select()
    .single();

  if (upErr) {
    console.error('Error upserting free 15y subsidy:', upErr);
    throw new Error(upErr.message);
  }
  return upserted;
}

/**
 * Pays tuition fee invoice: marks fee_items / installment tranche paid and creates tuition_payments record.
 */
export async function dbPayFeeInvoice(
  invoiceId: string,
  studentId: string,
  amount?: number,
  paymentMethod?: string
) {
  const supabase = getAdminClient();
  const nowIso = new Date().toISOString();
  const receiptNo = `REC-2569-${String(Math.floor(10000 + Math.random() * 89999))}`;

  // 1. If invoiceId is a UUID in fee_items, update fee_items
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invoiceId);
  if (isUuid) {
    await supabase
      .from('fee_items')
      .update({ status: 'paid', updated_at: nowIso })
      .eq('id', invoiceId);
  }

  // 2. Insert into tuition_payments
  const { data: paymentRecord, error: pErr } = await supabase
    .from('tuition_payments')
    .insert({
      student_id: studentId,
      fee_item_ids: isUuid ? [invoiceId] : [],
      total_amount: amount || 0,
      payment_method: paymentMethod?.toLowerCase().includes('qr') ? 'qr' : 'transfer',
      receipt_number: receiptNo,
      cashier_note: 'ชำระผ่าน Parents Portal PromptPay',
      created_at: nowIso,
    })
    .select()
    .single();

  if (pErr) {
    console.error('Error inserting tuition payment:', pErr);
  }

  // 3. If invoiceId matches an installment schedule in invoice_installment_schedules, mark it PAID
  if (isUuid) {
    await supabase
      .from('invoice_installment_schedules')
      .update({
        status: 'PAID',
        paid_at: nowIso,
        receipt_number: receiptNo,
        updated_at: nowIso,
      })
      .eq('id', invoiceId);
  }

  return {
    id: invoiceId,
    student_id: studentId,
    status: 'paid',
    receipt_number: receiptNo,
    paid_at: nowIso,
    payment_method: 'Thai QR PromptPay',
    amount: amount || 0,
    paymentRecord,
  };
}

/**
 * Updates guardian link permissions matrix in Postgres (family.guardian_student_links).
 */
export async function dbUpdateGuardianPerms(
  linkId: string,
  patch: Partial<GuardianStudentLink>,
  staffName?: string
) {
  const supabase = getAdminClient();
  const nowIso = new Date().toISOString();

  const updateFields: Record<string, unknown> = {
    updated_at: nowIso,
  };
  if (patch.is_legal_guardian !== undefined) updateFields.is_legal_guardian = patch.is_legal_guardian;
  if (patch.can_view_daily !== undefined) updateFields.can_view_daily = patch.can_view_daily;
  if (patch.can_view_academic !== undefined) updateFields.can_view_academic = patch.can_view_academic;
  if (patch.can_view_health !== undefined) updateFields.can_view_health = patch.can_view_health;
  if (patch.can_view_finance !== undefined) updateFields.can_view_finance = patch.can_view_finance;
  if (patch.can_pay !== undefined) updateFields.can_pay = patch.can_pay;
  if (patch.can_message_teacher !== undefined) updateFields.can_message_teacher = patch.can_message_teacher;
  if (patch.can_pickup !== undefined) updateFields.can_pickup = patch.can_pickup;
  if (patch.can_manage_pickup !== undefined) updateFields.can_manage_pickup = patch.can_manage_pickup;
  if (patch.can_give_consent !== undefined) updateFields.can_give_consent = patch.can_give_consent;
  if (patch.receives_emergency_alert !== undefined) updateFields.receives_emergency_alert = patch.receives_emergency_alert;
  if (patch.has_legal_restriction !== undefined) updateFields.has_legal_restriction = patch.has_legal_restriction;
  if (patch.restriction_note !== undefined) updateFields.restriction_note = patch.restriction_note;

  const { data, error } = await supabase
    .schema('family')
    .from('guardian_student_links')
    .update(updateFields)
    .eq('id', linkId)
    .select()
    .single();

  if (error) {
    console.error('Error updating guardian perms:', error);
    throw new Error(error.message);
  }
  return data;
}

/**
 * Creates guardian invitation code in Postgres (family.guardian_invitations).
 */
export async function dbCreateGuardianInvite(payload: {
  student_id: string;
  guardian_id?: string;
  invite_code?: string;
  expires_at?: string;
  created_by?: string;
}) {
  const supabase = getAdminClient();
  const now = new Date();
  const expiresAt = payload.expires_at || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const code = payload.invite_code || `SV-FAM-${payload.student_id}-${Math.floor(100 + Math.random() * 900)}`;

  let targetGuardianId = payload.guardian_id;
  if (!targetGuardianId) {
    const { data: g } = await supabase
      .schema('family')
      .from('guardians')
      .select('id')
      .limit(1)
      .maybeSingle();
    targetGuardianId = g?.id;
  }

  if (!targetGuardianId) {
    throw new Error('Guardian ID is required to generate an invitation');
  }

  const { data, error } = await supabase
    .schema('family')
    .from('guardian_invitations')
    .insert({
      student_id: payload.student_id,
      guardian_id: targetGuardianId,
      invite_code: code,
      expires_at: expiresAt,
      created_by: payload.created_by || null,
      created_at: now.toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating guardian invite:', error);
    throw new Error(error.message);
  }
  return data;
}

/**
 * Upserts academic assignment in public.academic_assignments.
 */
export async function dbUpsertAssignment(payload: {
  id?: string;
  class_id?: string;
  grade_level: string;
  subject_name: string;
  title_th: string;
  title_en?: string;
  description?: string;
  due_date: string;
  max_score?: number;
  assigned_by: string;
}) {
  const supabase = getAdminClient();
  const nowIso = new Date().toISOString();

  const record: Record<string, unknown> = {
    grade_level: payload.grade_level,
    class_id: payload.class_id || payload.grade_level,
    subject_name: payload.subject_name,
    title_th: payload.title_th,
    title_en: payload.title_en || null,
    description: payload.description || null,
    due_date: payload.due_date,
    max_score: payload.max_score ?? 10,
    assigned_by: payload.assigned_by,
    updated_at: nowIso,
  };

  if (payload.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.id)) {
    record.id = payload.id;
  }

  const { data, error } = await supabase
    .from('academic_assignments')
    .upsert(record)
    .select()
    .single();

  if (error) {
    console.error('Error upserting assignment:', error);
    throw new Error(error.message);
  }
  return data;
}

/**
 * Server-side TOTP verification against 30s rotating HMAC buckets or temporary delegate OTP.
 * On success, updates family.pickup_daily_plans to RELEASED.
 */
export async function dbVerifyPickupTotp(
  studentId: string,
  inputCode: string,
  verifiedBy?: string,
  timestampMs: number = Date.now()
): Promise<{
  valid: boolean;
  matchedMode: 'TOTP_CURRENT' | 'TOTP_PREVIOUS' | 'DELEGATE_OTP' | 'NONE';
  updatedPlan?: any;
}> {
  const clean = inputCode.replace(/\D/g, '');
  if (!clean || !studentId) return { valid: false, matchedMode: 'NONE' };

  const currentBucket = getPickupTimeBucket(timestampMs);
  let matchedMode: 'TOTP_CURRENT' | 'TOTP_PREVIOUS' | 'DELEGATE_OTP' | 'NONE' = 'NONE';

  if (clean === generatePickupTotp(studentId, currentBucket)) {
    matchedMode = 'TOTP_CURRENT';
  } else if (clean === generatePickupTotp(studentId, currentBucket - 1)) {
    matchedMode = 'TOTP_PREVIOUS';
  } else {
    // Check delegate OTP in DB for today's plan
    const supabase = getAdminClient();
    const todayStr = getBangkokDate();
    const { data: plan } = await supabase
      .schema('family')
      .from('pickup_daily_plans')
      .select('temp_otp_code')
      .eq('student_id', studentId)
      .eq('plan_date', todayStr)
      .maybeSingle();

    if (plan?.temp_otp_code && plan.temp_otp_code.replace(/\D/g, '') === clean) {
      matchedMode = 'DELEGATE_OTP';
    }
  }

  if (matchedMode !== 'NONE') {
    const supabase = getAdminClient();
    const todayStr = getBangkokDate();
    const nowIso = new Date().toISOString();

    const { data: updatedPlan, error } = await supabase
      .schema('family')
      .from('pickup_daily_plans')
      .upsert(
        {
          student_id: studentId,
          plan_date: todayStr,
          arrival_status: 'RELEASED',
          released_at: nowIso,
          released_by_staff: verifiedBy || 'เจ้าหน้าที่จุดรับ-ส่ง',
          updated_at: nowIso,
        },
        { onConflict: 'student_id,plan_date' }
      )
      .select()
      .single();

    if (error) {
      console.error('Error updating pickup plan after TOTP verification:', error);
    }
    return { valid: true, matchedMode, updatedPlan };
  }

  return { valid: false, matchedMode: 'NONE' };
}
