// ============================================================================
// Somkidvittaya School (SV-Portal & Parents Portal)
// Bidirectional Operational Pipeline Store (Server + Client Isomorphic)
// Storage Key: sv_bidirectional_pipeline_v1
// ============================================================================

import {
  AcademicAssignmentItem,
  AttendanceStatus,
  BidirectionalPipelineState,
  ConsentPurposeCode,
  ConsentRecord,
  DevelopmentalMilestoneItem,
  DomainEventSeverity,
  EarlyYearsDailyCare,
  EarlyYearsDropoffNote,
  Free15YSubsidyItem,
  GuardianInvitation,
  GuardianPermissionFlags,
  GuardianProfile,
  GuardianStudentLink,
  LeaveRequestStatus,
  LeaveRequestType,
  MedicationMealTiming,
  MedicationRequest,
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

export const PIPELINE_STORAGE_KEY = 'sv_bidirectional_pipeline_v1';
export const PIPELINE_EVENT_NAME = 'sv-pipeline-updated';

// ----------------------------------------------------------------------------
// Deterministic 30-second Rotating TOTP Generator & Verifier for Pickup Kiosk
// ----------------------------------------------------------------------------
export function getPickupTimeBucket(timestampMs: number = Date.now()): number {
  return Math.floor(timestampMs / 30000);
}

export function getPickupBucketSecondsRemaining(timestampMs: number = Date.now()): number {
  return 30 - (Math.floor(timestampMs / 1000) % 30);
}

export function generatePickupTotp(
  studentId: string,
  bucket: number = getPickupTimeBucket()
): string {
  const seed = `SV-PICKUP-${studentId.trim()}-${bucket}`;
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const positive = Math.abs(hash) % 900000;
  return String(100000 + positive);
}

export function verifyPickupTotp(
  studentId: string,
  inputCode: string,
  timestampMs: number = Date.now()
): { valid: boolean; matchedMode: 'TOTP_CURRENT' | 'TOTP_PREVIOUS' | 'DELEGATE_OTP' | 'NONE' } {
  const clean = inputCode.replace(/\D/g, '');
  if (!clean) return { valid: false, matchedMode: 'NONE' };

  const currentBucket = getPickupTimeBucket(timestampMs);
  if (clean === generatePickupTotp(studentId, currentBucket)) {
    return { valid: true, matchedMode: 'TOTP_CURRENT' };
  }
  if (clean === generatePickupTotp(studentId, currentBucket - 1)) {
    return { valid: true, matchedMode: 'TOTP_PREVIOUS' };
  }

  // Also check if there is a temporary delegate OTP on today's pickup plan
  const state = getPipelineState();
  const plan = state.pickup_plans.find((p) => p.student_id === studentId);
  if (plan?.temp_otp_code && plan.temp_otp_code.replace(/\D/g, '') === clean) {
    return { valid: true, matchedMode: 'DELEGATE_OTP' };
  }

  return { valid: false, matchedMode: 'NONE' };
}

// ----------------------------------------------------------------------------
// Default Full Guardian Permissions
// ----------------------------------------------------------------------------
export const FULL_GUARDIAN_PERMISSIONS: GuardianPermissionFlags = {
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

// ----------------------------------------------------------------------------
// Initial Realistic Seed Data for Somkidvittaya School (โรงเรียนสมคิดวิทยา)
// ----------------------------------------------------------------------------
export function createInitialPipelineState(): BidirectionalPipelineState {
  const todayStr = new Date().toISOString().slice(0, 10);

  const guardian: GuardianProfile = {
    id: 'g-somkid-001',
    citizen_id: '1200100458912',
    prefix: 'นาง',
    first_name: 'ศิริพร',
    last_name: 'รัตนโชติ',
    full_name: 'นางศิริพร รัตนโชติ',
    phone_number: '081-942-5618',
    email: 'siriporn.rat@family-somkid.com',
    line_user_id: 'U98f12somkidparent',
    occupation: 'ประกอบธุรกิจส่วนตัว',
    annual_income: 480000,
    photo_url: null,
    preferred_lang: 'th',
    is_active: true,
    created_at: '2026-05-10T08:00:00.000Z',
    updated_at: '2026-10-20T08:00:00.000Z',
  };

  const children: ParentChildProfile[] = [
    {
      id: '67012',
      public_uid: 'c1a9f012-6701-4000-8000-000000067012',
      learner_id: '1209901458219',
      prefix: 'ด.ญ.',
      first_name: 'พิมพ์ชนก',
      last_name: 'รัตนโชติ',
      full_name: 'ด.ญ.พิมพ์ชนก รัตนโชติ',
      name_en: 'Pimchanok Rattanachot',
      nickname: 'น้องพราว',
      grade: 'อ.2/1',
      classroom: '1',
      stage: 'EARLY_YEARS',
      homeroom_teacher: 'ครูนภัสสร ใจดี (ครูแนน)',
      homeroom_teacher_phone: '089-214-8890',
      blood_group: 'O',
      allergies: 'แพ้อาหารทะเล (กุ้ง)',
      medical_conditions: 'ไม่มี',
      height_cm: 104.5,
      weight_kg: 16.8,
      wallet_balance: 340.0,
      wallet_daily_limit: 80.0,
      attendance_rate_pct: 98.2,
      gpa_or_assessment: 'พัฒนาการสมวัยดีมาก (4 ด้าน)',
      photo_url: null,
      permissions: { ...FULL_GUARDIAN_PERMISSIONS },
    },
    {
      id: '64008',
      public_uid: 'c1a9f008-6400-4000-8000-000000064008',
      learner_id: '1209901120984',
      prefix: 'ด.ช.',
      first_name: 'กิตติภพ',
      last_name: 'รัตนโชติ',
      full_name: 'ด.ช.กิตติภพ รัตนโชติ',
      name_en: 'Kittipop Rattanachot',
      nickname: 'น้องกัปตัน',
      grade: 'ป.4/1',
      classroom: '1',
      stage: 'PRIMARY',
      homeroom_teacher: 'ครูธนกฤต สุวรรณภูมิ (ครูต้น)',
      homeroom_teacher_phone: '086-511-3349',
      blood_group: 'B',
      allergies: 'ไม่มี',
      medical_conditions: 'ภูมิแพ้อากาศเมื่ออากาศเย็นจัด',
      height_cm: 138.0,
      weight_kg: 33.5,
      wallet_balance: 525.0,
      wallet_daily_limit: 120.0,
      attendance_rate_pct: 99.1,
      gpa_or_assessment: '3.85',
      photo_url: null,
      permissions: { ...FULL_GUARDIAN_PERMISSIONS },
    },
  ];

  const links: GuardianStudentLink[] = [
    {
      id: 'gsl-67012-1',
      guardian_id: guardian.id,
      student_id: '67012',
      relationship: 'มารดา',
      role_type: 'PRIMARY',
      ...FULL_GUARDIAN_PERMISSIONS,
      has_legal_restriction: false,
      restriction_note: null,
      valid_from: '2026-05-01T00:00:00.000Z',
      valid_until: null,
      created_at: '2026-05-01T00:00:00.000Z',
      updated_at: '2026-10-20T00:00:00.000Z',
    },
    {
      id: 'gsl-64008-1',
      guardian_id: guardian.id,
      student_id: '64008',
      relationship: 'มารดา',
      role_type: 'PRIMARY',
      ...FULL_GUARDIAN_PERMISSIONS,
      has_legal_restriction: false,
      restriction_note: null,
      valid_from: '2026-05-01T00:00:00.000Z',
      valid_until: null,
      created_at: '2026-05-01T00:00:00.000Z',
      updated_at: '2026-10-20T00:00:00.000Z',
    },
  ];

  const invitations: GuardianInvitation[] = [
    {
      id: 'inv-001',
      guardian_id: guardian.id,
      guardian_name: 'นางศิริพร รัตนโชติ',
      guardian_phone: '081-942-5618',
      student_id: '67012',
      student_name: 'ด.ญ.พิมพ์ชนก รัตนโชติ (น้องพราว)',
      grade_level: 'อ.2/1',
      invite_code: 'SV-FAM-67012',
      expires_at: '2026-12-31T23:59:59.000Z',
      used_at: '2026-05-16T09:12:00.000Z',
      created_by: 'ฝ่ายทะเบียนโรงเรียนสมคิดวิทยา',
      created_at: '2026-05-15T08:30:00.000Z',
    },
    {
      id: 'inv-002',
      guardian_id: 'g-somkid-002',
      guardian_name: 'นายวรพจน์ รัตนโชติ (บิดา)',
      guardian_phone: '081-775-1920',
      student_id: '64008',
      student_name: 'ด.ช.กิตติภพ รัตนโชติ (น้องกัปตัน)',
      grade_level: 'ป.4/1',
      invite_code: 'SV-FAM-64008B',
      expires_at: '2026-12-31T23:59:59.000Z',
      used_at: null,
      created_by: 'ฝ่ายทะเบียนโรงเรียนสมคิดวิทยา',
      created_at: '2026-10-18T10:00:00.000Z',
    },
  ];

  const consents: ConsentRecord[] = [
    {
      id: 'con-67012-1',
      student_id: '67012',
      guardian_id: guardian.id,
      purpose_code: 'PHOTO_INTERNAL',
      purpose_title_th: 'การถ่ายภาพกิจกรรมสำหรับรายงานผู้ปกครองภายในระบบโรงเรียน',
      purpose_title_en: 'Internal Classroom & Daily Care Activity Photos',
      purpose_desc_th: 'อนุญาตให้ครูประจำชั้นบันทึกภาพกิจกรรมพัฒนาการและสมุดพกอนุบาลเพื่อส่งให้ผู้ปกครองเฉพาะรายบุคคล',
      policy_version: 'v1.2-2569',
      is_granted: true,
      ip_address: '171.96.42.18',
      signed_at: '2026-05-16T09:15:00.000Z',
    },
    {
      id: 'con-67012-2',
      student_id: '67012',
      guardian_id: guardian.id,
      purpose_code: 'PHOTO_PUBLIC_PR',
      purpose_title_th: 'การเผยแพร่ภาพกิจกรรมนักเรียนบนเว็บไซต์และเพจประชาสัมพันธ์โรงเรียน',
      purpose_title_en: 'Public Website & School PR Media Publication',
      purpose_desc_th: 'อนุญาตให้นำภาพกิจกรรมสร้างสรรค์ของนักเรียนขึ้นแสดงในข่าวสารเว็บไซต์โรงเรียนสมคิดวิทยา',
      policy_version: 'v1.2-2569',
      is_granted: true,
      ip_address: '171.96.42.18',
      signed_at: '2026-05-16T09:15:00.000Z',
    },
    {
      id: 'con-67012-3',
      student_id: '67012',
      guardian_id: guardian.id,
      purpose_code: 'FIRST_AID',
      purpose_title_th: 'การปฐมพยาบาลเบื้องต้นและการส่งต่อสถานพยาบาลฉุกเฉิน',
      purpose_title_en: 'Emergency First Aid & Hospital Referral',
      purpose_desc_th: 'อนุญาตให้พยาบาลประจำห้องพยาบาลปฐมพยาบาลเบื้องต้นและนำส่งโรงพยาบาลใกล้เคียงในกรณีฉุกเฉิน',
      policy_version: 'v1.2-2569',
      is_granted: true,
      ip_address: '171.96.42.18',
      signed_at: '2026-05-16T09:15:00.000Z',
    },
    {
      id: 'con-67012-4',
      student_id: '67012',
      guardian_id: guardian.id,
      purpose_code: 'FIELD_TRIP',
      purpose_title_th: 'การเข้าร่วมกิจกรรมทัศนศึกษาและแหล่งเรียนรู้นอกสถานที่',
      purpose_title_en: 'Educational Field Trips & Off-Campus Learning',
      purpose_desc_th: 'อนุญาตให้นักเรียนเดินทางไปทัศนศึกษาตามโครงการวิชาการของโรงเรียนภายใต้การดูแลของครู',
      policy_version: 'v1.2-2569',
      is_granted: true,
      ip_address: '171.96.42.18',
      signed_at: '2026-05-16T09:15:00.000Z',
    },
    {
      id: 'con-64008-1',
      student_id: '64008',
      guardian_id: guardian.id,
      purpose_code: 'PHOTO_INTERNAL',
      purpose_title_th: 'การถ่ายภาพกิจกรรมสำหรับรายงานผู้ปกครองภายในระบบโรงเรียน',
      purpose_title_en: 'Internal Classroom & Activity Photos',
      purpose_desc_th: 'อนุญาตให้ครูประจำชั้นบันทึกภาพกิจกรรมการเรียนรู้เพื่อส่งให้ผู้ปกครองในระบบ',
      policy_version: 'v1.2-2569',
      is_granted: true,
      ip_address: '171.96.42.18',
      signed_at: '2026-05-16T09:16:00.000Z',
    },
    {
      id: 'con-64008-2',
      student_id: '64008',
      guardian_id: guardian.id,
      purpose_code: 'PHOTO_PUBLIC_PR',
      purpose_title_th: 'การเผยแพร่ภาพกิจกรรมนักเรียนบนเว็บไซต์และเพจประชาสัมพันธ์โรงเรียน',
      purpose_title_en: 'Public Website & School PR Media Publication',
      purpose_desc_th: 'อนุญาตให้นำภาพการแข่งขันวิชาการและกิจกรรมโรงเรียนขึ้นประชาสัมพันธ์',
      policy_version: 'v1.2-2569',
      is_granted: false,
      ip_address: '171.96.42.18',
      signed_at: '2026-05-16T09:16:00.000Z',
      revoked_at: '2026-09-01T10:00:00.000Z',
    },
    {
      id: 'con-64008-3',
      student_id: '64008',
      guardian_id: guardian.id,
      purpose_code: 'FIRST_AID',
      purpose_title_th: 'การปฐมพยาบาลเบื้องต้นและการส่งต่อสถานพยาบาลฉุกเฉิน',
      purpose_title_en: 'Emergency First Aid & Hospital Referral',
      purpose_desc_th: 'อนุญาตให้พยาบาลประจำห้องพยาบาลปฐมพยาบาลเบื้องต้นและนำส่งโรงพยาบาลใกล้เคียงในกรณีฉุกเฉิน',
      policy_version: 'v1.2-2569',
      is_granted: true,
      ip_address: '171.96.42.18',
      signed_at: '2026-05-16T09:16:00.000Z',
    },
    {
      id: 'con-64008-4',
      student_id: '64008',
      guardian_id: guardian.id,
      purpose_code: 'FIELD_TRIP',
      purpose_title_th: 'การเข้าร่วมกิจกรรมทัศนศึกษาและแหล่งเรียนรู้นอกสถานที่',
      purpose_title_en: 'Educational Field Trips & Off-Campus Learning',
      purpose_desc_th: 'อนุญาตให้นักเรียนเดินทางไปทัศนศึกษาตามโครงการวิชาการของโรงเรียน',
      policy_version: 'v1.2-2569',
      is_granted: true,
      ip_address: '171.96.42.18',
      signed_at: '2026-05-16T09:16:00.000Z',
    },
  ];

  const attendance_logs: StudentAttendanceLog[] = [
    {
      id: 'att-67012-today',
      student_id: '67012',
      student_name: 'ด.ญ.พิมพ์ชนก รัตนโชติ',
      nickname: 'น้องพราว',
      grade_level: 'อ.2/1',
      attendance_date: todayStr,
      period: 'MORNING_HOMEROOM',
      status: 'PRESENT',
      check_in_time: '07:42 น.',
      check_out_time: null,
      source: 'TEACHER_APP',
      recorded_by: 'ครูนภัสสร ใจดี',
      notes: 'คุณแม่มาส่งหน้าห้องเรียน ยิ้มแย้มแจ่มใส',
      created_at: `${todayStr}T00:42:00.000Z`,
      updated_at: `${todayStr}T00:42:00.000Z`,
    },
    {
      id: 'att-67013-today',
      student_id: '67013',
      student_name: 'ด.ช.ปุณณวิชญ์ วัฒนากุล',
      nickname: 'น้องปั้นจั่น',
      grade_level: 'อ.2/1',
      attendance_date: todayStr,
      period: 'MORNING_HOMEROOM',
      status: 'PRESENT',
      check_in_time: '07:48 น.',
      check_out_time: null,
      source: 'VAN_SYNC',
      recorded_by: 'รถตู้สาย 1 (ตลาดศรีราชา)',
      notes: 'เดินทางด้วยรถรับส่งสาย 1 ปกติ',
      created_at: `${todayStr}T00:48:00.000Z`,
      updated_at: `${todayStr}T00:48:00.000Z`,
    },
    {
      id: 'att-67014-today',
      student_id: '67014',
      student_name: 'ด.ญ.ณัฐนิชา อารีย์',
      nickname: 'น้องณิชา',
      grade_level: 'อ.2/1',
      attendance_date: todayStr,
      period: 'MORNING_HOMEROOM',
      status: 'PRESENT',
      check_in_time: '07:55 น.',
      check_out_time: null,
      source: 'TEACHER_APP',
      recorded_by: 'ครูนภัสสร ใจดี',
      notes: null,
      created_at: `${todayStr}T00:55:00.000Z`,
      updated_at: `${todayStr}T00:55:00.000Z`,
    },
    {
      id: 'att-64008-today',
      student_id: '64008',
      student_name: 'ด.ช.กิตติภพ รัตนโชติ',
      nickname: 'น้องกัปตัน',
      grade_level: 'ป.4/1',
      attendance_date: todayStr,
      period: 'MORNING_HOMEROOM',
      status: 'PRESENT',
      check_in_time: '07:38 น.',
      check_out_time: null,
      source: 'NFC_GATE',
      recorded_by: 'ระบบสแกนบัตรประตูหน้า',
      notes: 'แตะบัตรเข้าโรงเรียนตรงเวลา',
      created_at: `${todayStr}T00:38:00.000Z`,
      updated_at: `${todayStr}T00:38:00.000Z`,
    },
    {
      id: 'att-64009-today',
      student_id: '64009',
      student_name: 'ด.ญ.ปาลิตา วงศ์สวัสดิ์',
      nickname: 'น้องปาล์ม',
      grade_level: 'ป.4/1',
      attendance_date: todayStr,
      period: 'MORNING_HOMEROOM',
      status: 'PRESENT',
      check_in_time: '07:45 น.',
      check_out_time: null,
      source: 'NFC_GATE',
      recorded_by: 'ระบบสแกนบัตรประตูหน้า',
      notes: null,
      created_at: `${todayStr}T00:45:00.000Z`,
      updated_at: `${todayStr}T00:45:00.000Z`,
    },
  ];

  const leave_requests: StudentLeaveRequest[] = [
    {
      id: 'lv-64008-01',
      student_id: '64008',
      student_name: 'ด.ช.กิตติภพ รัตนโชติ (น้องกัปตัน)',
      grade_level: 'ป.4/1',
      guardian_id: guardian.id,
      guardian_name: 'นางศิริพร รัตนโชติ',
      leave_type: 'PERSONAL_LEAVE',
      start_date: '2026-10-28',
      end_date: '2026-10-28',
      reason: 'พาน้องไปตรวจสุขภาพฟันตามนัดทันตแพทย์ รพ.พญาไท ศรีราชา ช่วงบ่าย',
      attachment_url: null,
      status: 'APPROVED',
      reviewed_by: 'ครูธนกฤต สุวรรณภูมิ',
      reviewed_at: '2026-10-19T14:20:00.000Z',
      review_note: 'รับทราบครับ ครูแจ้งงานวิชาคณิตศาสตร์ไว้ในระบบการบ้านแล้วครับ',
      created_at: '2026-10-19T11:05:00.000Z',
      updated_at: '2026-10-19T14:20:00.000Z',
    },
  ];

  const pickup_plans: PickupDailyPlan[] = [
    {
      id: 'pk-67012-today',
      student_id: '67012',
      student_name: 'ด.ญ.พิมพ์ชนก รัตนโชติ',
      nickname: 'น้องพราว',
      grade_level: 'อ.2/1',
      plan_date: todayStr,
      transport_mode: 'PARENT_PICKUP',
      collector_name: 'นางศิริพร รัตนโชติ (คุณแม่)',
      collector_relationship: 'มารดา',
      collector_phone: '081-942-5618',
      collector_photo_url: null,
      temp_otp_code: null,
      arrival_status: 'SCHEDULED',
      arrived_at: null,
      released_at: null,
      released_by_staff: null,
      van_route_name: null,
      van_plate_number: null,
      van_status_text: null,
      notes: 'รับที่จุดรับส่งอนุบาล ประตู 2 เวลา 15:15 น.',
      created_at: `${todayStr}T00:00:00.000Z`,
      updated_at: `${todayStr}T00:00:00.000Z`,
    },
    {
      id: 'pk-64008-today',
      student_id: '64008',
      student_name: 'ด.ช.กิตติภพ รัตนโชติ',
      nickname: 'น้องกัปตัน',
      grade_level: 'ป.4/1',
      plan_date: todayStr,
      transport_mode: 'PARENT_PICKUP',
      collector_name: 'นางศิริพร รัตนโชติ (คุณแม่)',
      collector_relationship: 'มารดา',
      collector_phone: '081-942-5618',
      collector_photo_url: null,
      temp_otp_code: null,
      arrival_status: 'SCHEDULED',
      arrived_at: null,
      released_at: null,
      released_by_staff: null,
      van_route_name: 'สาย 1 (ศรีราชา - เก้ากิโล)',
      van_plate_number: 'นข-4512 ชลบุรี',
      van_status_text: 'วันนี้คุณแม่แจ้งรับกลับเองพร้อมน้องพราว เวลา 15:30 น.',
      notes: 'รอรับพร้อมน้องพราวที่จุดรอรับหน้าอาคารประถม',
      created_at: `${todayStr}T00:00:00.000Z`,
      updated_at: `${todayStr}T00:00:00.000Z`,
    },
    {
      id: 'pk-67013-today',
      student_id: '67013',
      student_name: 'ด.ช.ปุณณวิชญ์ วัฒนากุล',
      nickname: 'น้องปั้นจั่น',
      grade_level: 'อ.2/1',
      plan_date: todayStr,
      transport_mode: 'SCHOOL_VAN',
      collector_name: 'รถตู้โรงเรียนสาย 1 (ครูพี่เลี้ยงประจำรถ: ครูกานดา)',
      collector_relationship: 'รถรับส่งโรงเรียน',
      collector_phone: '089-441-2201',
      collector_photo_url: null,
      temp_otp_code: null,
      arrival_status: 'SCHEDULED',
      arrived_at: null,
      released_at: null,
      released_by_staff: null,
      van_route_name: 'สาย 1 (ตลาดศรีราชา - อัสสัมชัญ)',
      van_plate_number: 'นข-4512 ชลบุรี',
      van_status_text: 'เตรียมขึ้นรถรอบ 15:40 น.',
      notes: 'ส่งที่บ้านหมู่บ้านแกรนด์มณีรินทร์',
      created_at: `${todayStr}T00:00:00.000Z`,
      updated_at: `${todayStr}T00:00:00.000Z`,
    },
  ];

  const early_years_care: EarlyYearsDailyCare[] = [
    {
      id: 'eyc-67012-today',
      student_id: '67012',
      student_name: 'ด.ญ.พิมพ์ชนก รัตนโชติ',
      nickname: 'น้องพราว',
      class_id: 'อ.2/1',
      care_date: todayStr,
      morning_mood: 'CHEERFUL',
      breakfast_status: 'ALL',
      lunch_status: 'ALL',
      milk_morning: 'ALL',
      milk_afternoon: 'ALL',
      nap_start: '12:30',
      nap_end: '14:15',
      nap_quality: 'SOUND',
      toilet_count: 3,
      diaper_count: 0,
      toilet_note: 'บอกคุณครูเข้าห้องน้ำเองได้ทุกครั้ง เก่งมากค่ะ',
      temperature_c: 36.5,
      learning_activity: 'กิจกรรมศิลปะสร้างสรรค์: พิมพ์ภาพใบไม้จากธรรมชาติและเล่านิทานเรื่องกระต่ายน้อยแบ่งปัน',
      home_suggestion: 'ชวนน้องพราวเล่าเรื่องสีของใบไม้ที่ประทับใจให้คุณแม่ฟังนะคะ',
      teacher_note: 'วันนี้น้องพราวทานข้าวต้มปลาและผัดบล็อกโคลี่หมดถาดเลยค่ะ นอนกลางวันหลับสนิทและตื่นมาดื่มนมครบค่ะ',
      photo_urls: [],
      is_published: true,
      published_at: `${todayStr}T07:30:00.000Z`,
      created_at: `${todayStr}T04:00:00.000Z`,
      updated_at: `${todayStr}T07:30:00.000Z`,
    },
    {
      id: 'eyc-67013-today',
      student_id: '67013',
      student_name: 'ด.ช.ปุณณวิชญ์ วัฒนากุล',
      nickname: 'น้องปั้นจั่น',
      class_id: 'อ.2/1',
      care_date: todayStr,
      morning_mood: 'CALM',
      breakfast_status: 'ALL',
      lunch_status: 'HALF',
      milk_morning: 'ALL',
      milk_afternoon: 'ALL',
      nap_start: '12:35',
      nap_end: '14:10',
      nap_quality: 'SOUND',
      toilet_count: 2,
      diaper_count: 0,
      toilet_note: 'ปกติ',
      temperature_c: 36.6,
      learning_activity: 'กิจกรรมศิลปะสร้างสรรค์: พิมพ์ภาพใบไม้จากธรรมชาติและเล่านิทานเรื่องกระต่ายน้อยแบ่งปัน',
      home_suggestion: 'ฝึกการเก็บของเล่นเข้าที่หลังเล่นเสร็จ',
      teacher_note: 'วันนี้น้องปั้นจั่นตั้งใจระบายสีดีมากครับ มื้อเที่ยงทานผักได้มากขึ้นครับ',
      photo_urls: [],
      is_published: true,
      published_at: `${todayStr}T07:30:00.000Z`,
      created_at: `${todayStr}T04:00:00.000Z`,
      updated_at: `${todayStr}T07:30:00.000Z`,
    },
    {
      id: 'eyc-67014-today',
      student_id: '67014',
      student_name: 'ด.ญ.ณัฐนิชา อารีย์',
      nickname: 'น้องณิชา',
      class_id: 'อ.2/1',
      care_date: todayStr,
      morning_mood: 'CHEERFUL',
      breakfast_status: 'ALL',
      lunch_status: 'ALL',
      milk_morning: 'ALL',
      milk_afternoon: 'ALL',
      nap_start: '12:30',
      nap_end: '14:15',
      nap_quality: 'SOUND',
      toilet_count: 3,
      diaper_count: 0,
      toilet_note: 'ปกติ',
      temperature_c: 36.4,
      learning_activity: 'กิจกรรมศิลปะสร้างสรรค์: พิมพ์ภาพใบไม้จากธรรมชาติและเล่านิทานเรื่องกระต่ายน้อยแบ่งปัน',
      home_suggestion: 'ชวนร้องเพลงสวัสดีคุณครูที่บ้าน',
      teacher_note: 'น้องณิชาช่วยคุณครูแจกสมุดนิทานให้เพื่อนๆ น่ารักมากค่ะ',
      photo_urls: [],
      is_published: true,
      published_at: `${todayStr}T07:30:00.000Z`,
      created_at: `${todayStr}T04:00:00.000Z`,
      updated_at: `${todayStr}T07:30:00.000Z`,
    },
  ];

  const dropoff_notes: EarlyYearsDropoffNote[] = [
    {
      id: 'drop-67012-today',
      student_id: '67012',
      student_name: 'ด.ญ.พิมพ์ชนก รัตนโชติ (น้องพราว)',
      grade_level: 'อ.2/1',
      note_date: todayStr,
      guardian_name: 'นางศิริพร รัตนโชติ',
      sleep_hours: 10,
      ate_breakfast: true,
      morning_mood: 'สดใส อารมณ์ดี ตื่นเต้นอยากทำศิลปะ',
      medication_today: false,
      pickup_person_today: 'คุณแม่มารับเอง เวลา 15:15 น.',
      special_note: 'ฝากครูแนนดูแลไม่ให้น้องทานเมนูกุ้งนะคะ ขอบคุณค่ะ',
      acknowledged_by_teacher: 'ครูนภัสสร ใจดี (ครูแนน)',
      acknowledged_at: `${todayStr}T00:50:00.000Z`,
      created_at: `${todayStr}T00:15:00.000Z`,
      updated_at: `${todayStr}T00:50:00.000Z`,
    },
  ];

  const medication_requests: MedicationRequest[] = [
    {
      id: 'med-64008-01',
      student_id: '64008',
      student_name: 'ด.ช.กิตติภพ รัตนโชติ (น้องกัปตัน)',
      grade_level: 'ป.4/1',
      guardian_name: 'นางศิริพร รัตนโชติ',
      medication_name: 'ยาแก้แพ้อากาศ Cetirizine Syrup (ชนิดไม่ง่วง)',
      dosage: '1 ช้อนชา (5 มล.)',
      schedule_times: ['12:30'],
      meal_timing: 'AFTER_MEAL',
      start_date: todayStr,
      end_date: todayStr,
      reason: 'มีอาการคัดจมูกเล็กน้อยช่วงเช้าเนื่องจากอากาศเปลี่ยน ไม่มีไข้',
      signature_data_url: 'SIGNED_BY_SIRIPORN_RATTANACHOT',
      status: 'ADMINISTERED_TODAY',
      last_administered_at: `${todayStr}T05:35:00.000Z`,
      last_administered_by: 'ครูพยาบาลวิชาชีพ พรทิพย์ สุขสวัสดิ์',
      nurse_note: 'ป้อนยาหลังอาหารกลางวันเรียบร้อย วัดอุณหภูมิ 36.6°C ปกติดีค่ะ',
      created_at: `${todayStr}T00:20:00.000Z`,
      updated_at: `${todayStr}T05:35:00.000Z`,
    },
  ];

  const incidents: StudentIncident[] = [
    {
      id: 'inc-64008-01',
      student_id: '64008',
      student_name: 'ด.ช.กิตติภพ รัตนโชติ (น้องกัปตัน)',
      grade_level: 'ป.4/1',
      incident_date: todayStr,
      incident_time: '10:25',
      location: 'สนามฟุตซอลหญ้าเทียม (ช่วงพักเบรกเช้า)',
      severity: 'LOW',
      description: 'สะดุดเชือกรองเท้าขณะวิ่งเล่นกับเพื่อน มีรอยถลอกตื้นบริเวณหัวเข่าขวาขนาดประมาณ 1 ซม.',
      first_aid_given: 'ล้างแผลด้วยน้ำเกลือ Normal Saline ทายาโพวิโดน-ไอโอดีน และปิดพลาสเตอร์กันน้ำ น้องกลับเข้าเรียนคาบต่อไปได้ตามปกติ',
      hospital_referred: false,
      reported_by: 'ครูพยาบาลวิชาชีพ พรทิพย์ สุขสวัสดิ์',
      parent_acknowledged: false,
      parent_acknowledged_at: null,
      acknowledged_by_name: null,
      created_at: `${todayStr}T03:30:00.000Z`,
      updated_at: `${todayStr}T03:30:00.000Z`,
    },
  ];

  const assignments: AcademicAssignmentItem[] = [
    {
      id: 'asg-p4-math-01',
      class_id: 'ป.4/1',
      grade_level: 'ป.4/1',
      subject_name: 'คณิตศาสตร์พื้นฐาน (ค14101)',
      title_th: 'แบบฝึกหัดที่ 4.3 เรื่อง โจทย์ปัญหาการคูณและการหารหลายขั้นตอน',
      title_en: 'Workbook Ex 4.3: Multi-step Multiplication & Division Word Problems',
      description: 'ทำในหนังสือแบบฝึกหัดคณิตศาสตร์ หน้า 78-79 ข้อ 1-6 แสดงวิธีทำอย่างละเอียด',
      due_date: '2026-10-22',
      max_score: 10,
      assigned_by: 'ครูธนกฤต สุวรรณภูมิ',
      student_id: '64008',
      submission_status: 'PENDING',
      score: null,
      teacher_feedback: null,
      updated_at: `${todayStr}T02:00:00.000Z`,
    },
    {
      id: 'asg-p4-sci-01',
      class_id: 'ป.4/1',
      grade_level: 'ป.4/1',
      subject_name: 'วิทยาศาสตร์และเทคโนโลยี (ว14101)',
      title_th: 'ใบงานสรุปแผนผังความคิด: ตัวกลางของแสง (โปร่งใส โปร่งแสง ทึบแสง)',
      title_en: 'Mind Map: Light Media Classification (Transparent, Translucent, Opaque)',
      description: 'วาดภาพประกอบยกตัวอย่างวัสดุในบ้านอย่างละ 3 ชนิด พร้อมระบายสีให้สวยงาม',
      due_date: '2026-10-20',
      max_score: 10,
      assigned_by: 'ครูสุพัตรา วิริยะกุล',
      student_id: '64008',
      submission_status: 'SUBMITTED',
      score: 9.5,
      teacher_feedback: 'ยกตัวอย่างวัสดุในชีวิตประจำวันได้ชัดเจนและวาดแผนผังสวยงามมากครับ',
      updated_at: `${todayStr}T04:15:00.000Z`,
    },
    {
      id: 'asg-p4-eng-01',
      class_id: 'ป.4/1',
      grade_level: 'ป.4/1',
      subject_name: 'ภาษาอังกฤษเพื่อการสื่อสาร (อ14101)',
      title_th: 'บันทึกคลิปอ่านออกเสียง Reading Passage: My Favorite Weekend (1 นาที)',
      title_en: 'Short Reading Aloud Audio/Worksheet: My Favorite Weekend',
      description: 'ฝึกอ่านออกเสียงคำศัพท์ในบทที่ 5 และทำแบบฝึกหัดจับคู่ประโยคหน้า 44',
      due_date: '2026-10-24',
      max_score: 10,
      assigned_by: 'Teacher Michael & ครูอารยา',
      student_id: '64008',
      submission_status: 'PENDING',
      score: null,
      teacher_feedback: null,
      updated_at: `${todayStr}T01:30:00.000Z`,
    },
    {
      id: 'asg-k2-art-01',
      class_id: 'อ.2/1',
      grade_level: 'อ.2/1',
      subject_name: 'กิจกรรมเสริมประสบการณ์ปฐมวัย',
      title_th: 'กิจกรรมครอบครัวสัมพันธ์: ชวนน้องพราวสำรวจใบไม้รอบบ้าน 3 ชนิด',
      title_en: 'Family Nature Discovery: Collect 3 Leaf Shapes Around Home',
      description: 'ไม่ต้องเขียนส่งเป็นเล่มนะคะ ให้คุณแม่ชวนน้องสังเกตรูปร่างใบไม้แล้วมาเล่าให้เพื่อนฟังวันพรุ่งนี้ค่ะ',
      due_date: '2026-10-21',
      max_score: 5,
      assigned_by: 'ครูนภัสสร ใจดี (ครูแนน)',
      student_id: '67012',
      submission_status: 'SUBMITTED',
      score: 5,
      teacher_feedback: 'น้องพราวเล่าเรื่องใบมะม่วงกับใบชบาให้เพื่อนๆ ฟังได้คล่องแคล่วมากค่ะ',
      updated_at: `${todayStr}T06:00:00.000Z`,
    },
  ];

  const threads: ParentTeacherThread[] = [
    {
      id: 'thd-67012-homeroom',
      student_id: '67012',
      student_name: 'ด.ญ.พิมพ์ชนก รัตนโชติ (น้องพราว)',
      grade_level: 'อ.2/1',
      guardian_name: 'นางศิริพร รัตนโชติ',
      teacher_name: 'ครูนภัสสร ใจดี (ครูประจำชั้น อ.2/1)',
      channel_type: 'HOMEROOM',
      last_message_text: 'วันนี้ครูแนบรายงานสมุดพกอนุบาลและภาพกิจกรรมพิมพ์ใบไม้ของน้องพราวให้แล้วนะคะ',
      last_message_at: `${todayStr}T07:32:00.000Z`,
      unread_staff_count: 0,
      unread_parent_count: 1,
      office_hours_note: 'เวลาทำการตอบกลับ: จันทร์-ศุกร์ 07:30 - 17:00 น. (นอกเวลาทำการระบบจะแจ้งเตือนครูในเช้าวันถัดไป)',
      created_at: '2026-05-16T08:00:00.000Z',
      updated_at: `${todayStr}T07:32:00.000Z`,
    },
    {
      id: 'thd-64008-homeroom',
      student_id: '64008',
      student_name: 'ด.ช.กิตติภพ รัตนโชติ (น้องกัปตัน)',
      grade_level: 'ป.4/1',
      guardian_name: 'นางศิริพร รัตนโชติ',
      teacher_name: 'ครูธนกฤต สุวรรณภูมิ (ครูประจำชั้น ป.4/1)',
      channel_type: 'HOMEROOM',
      last_message_text: 'น้องกัปตันส่งงานแผนผังวิทยาศาสตร์เรียบร้อย ได้ 9.5/10 คะแนนครับคุณแม่',
      last_message_at: `${todayStr}T06:45:00.000Z`,
      unread_staff_count: 0,
      unread_parent_count: 0,
      office_hours_note: 'เวลาทำการตอบกลับ: จันทร์-ศุกร์ 07:30 - 17:00 น.',
      created_at: '2026-05-16T08:00:00.000Z',
      updated_at: `${todayStr}T06:45:00.000Z`,
    },
  ];

  const messages: ParentTeacherMessage[] = [
    {
      id: 'msg-67012-1',
      thread_id: 'thd-67012-homeroom',
      sender_type: 'PARENT',
      sender_name: 'นางศิริพร รัตนโชติ (คุณแม่)',
      body_th: 'สวัสดีค่ะครูแนน เมื่อคืนน้องพราวนอนเต็มอิ่ม 10 ชม. เช้านี้ทานโจ๊กหมูมาเรียบร้อยค่ะ ฝากครูแนนระวังเมนูกุ้งเหมือนเดิมนะคะ',
      body_en: 'Good morning Teacher Nan. Proud slept 10 hours last night and had pork porridge. Please continue avoiding shrimp.',
      require_acknowledgement: false,
      acknowledged_at: `${todayStr}T00:50:00.000Z`,
      created_at: `${todayStr}T00:16:00.000Z`,
    },
    {
      id: 'msg-67012-2',
      thread_id: 'thd-67012-homeroom',
      sender_type: 'STAFF',
      sender_name: 'ครูนภัสสร ใจดี (ครูแนน)',
      body_th: 'สวัสดีค่ะคุณแม่ ครูแนนรับทราบและแยกถาดอาหารปลอดกุ้งให้น้องพราวเรียบร้อยค่ะ วันนี้น้องพราวทานข้าวต้มปลามื้อเที่ยงหมดถาดเลยค่ะ และวันนี้ครูแนบรายงานสมุดพกอนุบาลและภาพกิจกรรมพิมพ์ใบไม้ของน้องพราวให้แล้วนะคะ',
      body_en: 'Received with thanks! Proud finished her entire fish porridge tray at lunch today and enjoyed the leaf printing art activity.',
      require_acknowledgement: true,
      acknowledged_at: null,
      created_at: `${todayStr}T07:32:00.000Z`,
    },
    {
      id: 'msg-64008-1',
      thread_id: 'thd-64008-homeroom',
      sender_type: 'STAFF',
      sender_name: 'ครูธนกฤต สุวรรณภูมิ (ครูต้น)',
      body_th: 'เรียนคุณแม่ศิริพรครับ น้องกัปตันส่งงานแผนผังวิทยาศาสตร์เรียบร้อย ได้ 9.5/10 คะแนนครับคุณแม่ ส่วนแบบฝึกหัดคณิตศาสตร์ 4.3 กำหนดส่งวันพุธที่ 22 ต.ค. ครับ',
      body_en: 'Dear Khun Siriporn, Captain submitted his Science Mind Map and scored 9.5/10. Math Ex 4.3 is due Wednesday Oct 22.',
      require_acknowledgement: false,
      acknowledged_at: `${todayStr}T07:00:00.000Z`,
      created_at: `${todayStr}T06:45:00.000Z`,
    },
  ];

  const fee_invoices: ParentFeeInvoiceItem[] = [
    {
      id: 'fee-67012-2569-2',
      student_id: '67012',
      title_th: 'ค่าธรรมเนียมการศึกษาและกิจกรรมพัฒนาผู้เรียน ระดับอนุบาล 2 (ภาคเรียนที่ 2/2569)',
      title_en: 'Kindergarten 2 Tuition & Enrichment Fee (Semester 2/2026)',
      term_label: 'ภาคเรียนที่ 2/2569',
      amount: 8500,
      due_date: '2026-11-05',
      status: 'unpaid',
      receipt_number: null,
      paid_at: null,
      payment_method: null,
    },
    {
      id: 'fee-67012-2569-1',
      student_id: '67012',
      title_th: 'ค่าธรรมเนียมการศึกษาและอาหารเสริม ระดับอนุบาล 2 (ภาคเรียนที่ 1/2569)',
      title_en: 'Kindergarten 2 Tuition & Nutrition Fee (Semester 1/2026)',
      term_label: 'ภาคเรียนที่ 1/2569',
      amount: 8500,
      due_date: '2026-05-15',
      status: 'paid',
      receipt_number: 'REC-2569-00142',
      paid_at: '2026-05-12T10:24:00.000Z',
      payment_method: 'QR PromptPay',
    },
    {
      id: 'fee-64008-2569-2',
      student_id: '64008',
      title_th: 'ค่าธรรมเนียมห้องเรียนเสริมทักษะคอมพิวเตอร์และภาษาอังกฤษ ป.4 (ภาคเรียนที่ 2/2569)',
      title_en: 'Primary 4 English & Coding Enrichment Fee (Semester 2/2026)',
      term_label: 'ภาคเรียนที่ 2/2569',
      amount: 6200,
      due_date: '2026-11-05',
      status: 'unpaid',
      receipt_number: null,
      paid_at: null,
      payment_method: null,
    },
    {
      id: 'fee-64008-2569-1',
      student_id: '64008',
      title_th: 'ค่าธรรมเนียมห้องเรียนเสริมทักษะคอมพิวเตอร์และภาษาอังกฤษ ป.4 (ภาคเรียนที่ 1/2569)',
      title_en: 'Primary 4 English & Coding Enrichment Fee (Semester 1/2026)',
      term_label: 'ภาคเรียนที่ 1/2569',
      amount: 6200,
      due_date: '2026-05-15',
      status: 'paid',
      receipt_number: 'REC-2569-00143',
      paid_at: '2026-05-12T10:26:00.000Z',
      payment_method: 'QR PromptPay',
    },
  ];

  const free15y_subsidies: Free15YSubsidyItem[] = [
    {
      id: 'sub-67012-uniform',
      student_id: '67012',
      academic_year: '2569',
      semester: '1/2569',
      category_th: 'ค่าเครื่องแบบนักเรียน (โครงการเรียนฟรี 15 ปี อย่างมีคุณภาพ สช.)',
      category_en: '15-Year Free Education Subsidy: Student Uniforms',
      amount: 325,
      parent_signed: true,
      signed_by_name: 'นางศิริพร รัตนโชติ',
      signed_at: '2026-06-10T09:15:00.000Z',
      receipt_code: 'OPEC-15Y-67012-U',
    },
    {
      id: 'sub-67012-supply',
      student_id: '67012',
      academic_year: '2569',
      semester: '2/2569',
      category_th: 'ค่าอุปกรณ์การเรียน ภาคเรียนที่ 2/2569 (โครงการเรียนฟรี 15 ปี สช.)',
      category_en: '15-Year Free Education Subsidy: Learning Supplies (Term 2)',
      amount: 100,
      parent_signed: false,
      signed_by_name: null,
      signed_at: null,
      receipt_code: 'OPEC-15Y-67012-S2',
    },
    {
      id: 'sub-64008-uniform',
      student_id: '64008',
      academic_year: '2569',
      semester: '1/2569',
      category_th: 'ค่าเครื่องแบบนักเรียน ระดับประถมศึกษา (โครงการเรียนฟรี 15 ปี สช.)',
      category_en: '15-Year Free Education Subsidy: Primary Student Uniforms',
      amount: 400,
      parent_signed: true,
      signed_by_name: 'นางศิริพร รัตนโชติ',
      signed_at: '2026-06-10T09:16:00.000Z',
      receipt_code: 'OPEC-15Y-64008-U',
    },
    {
      id: 'sub-64008-supply',
      student_id: '64008',
      academic_year: '2569',
      semester: '2/2569',
      category_th: 'ค่าอุปกรณ์การเรียน ระดับประถมศึกษา ภาคเรียนที่ 2/2569 (โครงการเรียนฟรี 15 ปี สช.)',
      category_en: '15-Year Free Education Subsidy: Primary Learning Supplies (Term 2)',
      amount: 210,
      parent_signed: false,
      signed_by_name: null,
      signed_at: null,
      receipt_code: 'OPEC-15Y-64008-S2',
    },
  ];

  const early_years_milestones: DevelopmentalMilestoneItem[] = [
    {
      id: 'ms-67012-1',
      student_id: '67012',
      domain: 'PHYSICAL',
      domain_th: 'พัฒนาการด้านร่างกาย',
      domain_en: 'Physical & Motor Development',
      indicator_th: 'ใช้กรรไกรตัดกระดาษตามแนวเส้นตรงและร้อยลูกปัดขนาดกลางได้อย่างคล่องแคล่ว',
      indicator_en: 'Uses scissors along lines and threads medium beads with steady hand-eye coordination',
      rating: 3,
      teacher_comment: 'กล้ามเนื้อมัดเล็กและมัดใหญ่แข็งแรง ทรงตัวเดินบนเส้นตรงได้ดีมากค่ะ',
      evaluated_at: '2026-10-15',
    },
    {
      id: 'ms-67012-2',
      student_id: '67012',
      domain: 'EMOTIONAL_SOCIAL',
      domain_th: 'พัฒนาการด้านอารมณ์ จิตใจ และสังคม',
      domain_en: 'Emotional & Social Development',
      indicator_th: 'เล่นและทำกิจกรรมร่วมกับเพื่อนเป็นกลุ่ม รู้จักการรอคอยตามลำดับและแบ่งปันของเล่น',
      indicator_en: 'Plays cooperatively in groups, waits for turns, and shares classroom materials willingly',
      rating: 3,
      teacher_comment: 'น้องพราวมีน้ำใจ ชอบช่วยเหลือเพื่อนในห้องและเก็บของเข้าที่ทุกครั้งค่ะ',
      evaluated_at: '2026-10-15',
    },
    {
      id: 'ms-67012-3',
      student_id: '67012',
      domain: 'INTELLECTUAL',
      domain_th: 'พัฒนาการด้านสติปัญญา',
      domain_en: 'Cognitive & Intellectual Development',
      indicator_th: 'จำแนกสิ่งของตามรูปร่าง สี ขนาด และนับจำนวนสิ่งของ 1-10 พร้อมบอกค่าจำนวนได้ถูกต้อง',
      indicator_en: 'Classifies objects by shape, color, and size; counts 1-10 accurately',
      rating: 3,
      teacher_comment: 'ช่างสังเกตและตั้งคำถามเกี่ยวกับธรรมชาติรอบตัวได้ดีมากค่ะ',
      evaluated_at: '2026-10-15',
    },
    {
      id: 'ms-67012-4',
      student_id: '67012',
      domain: 'LANGUAGE',
      domain_th: 'พัฒนาการด้านภาษาและการสื่อสาร',
      domain_en: 'Language & Communication',
      indicator_th: 'เล่านิทานหรือเหตุการณ์สั้นๆ ด้วยประโยคต่อเนื่องและออกเสียงพยัญชนะชัดเจน',
      indicator_en: 'Retells short stories in complete sentences and communicates needs clearly',
      rating: 3,
      teacher_comment: 'กล้าแสดงออกในการเล่าเรื่องหน้าชั้นเรียนด้วยน้ำเสียงสดใสค่ะ',
      evaluated_at: '2026-10-15',
    },
  ];

  const primary_grades: Record<string, SubjectGradeSummaryItem[]> = {
    '64008': [
      {
        subject_code: 'ท14101',
        subject_name_th: 'ภาษาไทย',
        subject_name_en: 'Thai Language',
        teacher_name: 'ครูวันเพ็ญ ศรีสวัสดิ์',
        accumulated_score: 44,
        max_accumulated: 50,
        midterm_score: 18,
        max_midterm: 20,
        final_score: 26,
        max_final: 30,
        total_score: 88,
        grade_label: '4.0',
      },
      {
        subject_code: 'ค14101',
        subject_name_th: 'คณิตศาสตร์',
        subject_name_en: 'Mathematics',
        teacher_name: 'ครูธนกฤต สุวรรณภูมิ',
        accumulated_score: 43,
        max_accumulated: 50,
        midterm_score: 17,
        max_midterm: 20,
        final_score: 25,
        max_final: 30,
        total_score: 85,
        grade_label: '4.0',
      },
      {
        subject_code: 'ว14101',
        subject_name_th: 'วิทยาศาสตร์และเทคโนโลยี',
        subject_name_en: 'Science & Technology',
        teacher_name: 'ครูสุพัตรา วิริยะกุล',
        accumulated_score: 45,
        max_accumulated: 50,
        midterm_score: 18,
        max_midterm: 20,
        final_score: 27,
        max_final: 30,
        total_score: 90,
        grade_label: '4.0',
      },
      {
        subject_code: 'ส14101',
        subject_name_th: 'สังคมศึกษา ศาสนา และวัฒนธรรม',
        subject_name_en: 'Social Studies',
        teacher_name: 'ครูพงศกร เจริญสุข',
        accumulated_score: 40,
        max_accumulated: 50,
        midterm_score: 16,
        max_midterm: 20,
        final_score: 23,
        max_final: 30,
        total_score: 79,
        grade_label: '3.5',
      },
      {
        subject_code: 'อ14101',
        subject_name_th: 'ภาษาอังกฤษพื้นฐาน',
        subject_name_en: 'Fundamental English',
        teacher_name: 'Teacher Michael & ครูอารยา',
        accumulated_score: 42,
        max_accumulated: 50,
        midterm_score: 17,
        max_midterm: 20,
        final_score: 24,
        max_final: 30,
        total_score: 83,
        grade_label: '4.0',
      },
    ],
  };

  const domain_events: SystemDomainEvent[] = [
    {
      id: 'evt-001',
      event_type: 'DAILY_CARE_PUBLISHED',
      student_id: '67012',
      student_name: 'ด.ญ.พิมพ์ชนก รัตนโชติ (น้องพราว)',
      severity: 'NORMAL',
      title_th: 'ครูประจำชั้นอัปเดตสมุดพกอนุบาลประจำวัน (Daily Care)',
      title_en: 'Early Years Daily Care Published',
      body_th: 'น้องพราวทานอาหารกลางวันหมดถาด นอนหลับสนิท 12:30-14:15 น. และร่วมกิจกรรมพิมพ์ภาพใบไม้',
      body_en: 'Proud finished her lunch, napped soundly 12:30-14:15, and completed the leaf printing activity.',
      actor_role: 'STAFF',
      actor_name: 'ครูนภัสสร ใจดี (ครูแนน)',
      created_at: `${todayStr}T07:30:00.000Z`,
    },
    {
      id: 'evt-002',
      event_type: 'MEDICATION_ADMINISTERED',
      student_id: '64008',
      student_name: 'ด.ช.กิตติภพ รัตนโชติ (น้องกัปตัน)',
      severity: 'HIGH',
      title_th: 'ห้องพยาบาลป้อนยาตามคำร้องผู้ปกครองเรียบร้อยแล้ว',
      title_en: 'Infirmary Administered Requested Medication',
      body_th: 'ครูพยาบาลป้อนยา Cetirizine Syrup 1 ช้อนชา หลังอาหารกลางวันให้น้องกัปตัน อุณหภูมิ 36.6°C ปกติ',
      body_en: 'Nurse administered 5ml Cetirizine Syrup after lunch. Temp 36.6°C normal.',
      actor_role: 'STAFF',
      actor_name: 'ครูพยาบาลวิชาชีพ พรทิพย์ สุขสวัสดิ์',
      created_at: `${todayStr}T05:35:00.000Z`,
    },
    {
      id: 'evt-003',
      event_type: 'INCIDENT_REPORTED',
      student_id: '64008',
      student_name: 'ด.ช.กิตติภพ รัตนโชติ (น้องกัปตัน)',
      severity: 'HIGH',
      title_th: 'แจ้งการปฐมพยาบาลเบื้องต้นจากห้องพยาบาล (รอผู้ปกครองรับทราบ)',
      title_en: 'Infirmary First-Aid Notification (Awaiting Parent Ack)',
      body_th: 'น้องกัปตันมีแผลถลอกตื้นที่หัวเข่าขวาจากการวิ่งเล่น ล้างแผลและปิดพลาสเตอร์เรียบร้อยแล้ว',
      body_en: 'Minor right knee scrape treated with saline and waterproof bandage.',
      actor_role: 'STAFF',
      actor_name: 'ครูพยาบาลวิชาชีพ พรทิพย์ สุขสวัสดิ์',
      created_at: `${todayStr}T03:30:00.000Z`,
    },
  ];

  return {
    version: 1,
    guardian,
    children,
    links,
    invitations,
    consents,
    attendance_logs,
    leave_requests,
    pickup_plans,
    early_years_care,
    dropoff_notes,
    medication_requests,
    incidents,
    assignments,
    threads,
    messages,
    domain_events,
    fee_invoices,
    free15y_subsidies,
    early_years_milestones,
    primary_grades,
  };
}

// ----------------------------------------------------------------------------
// Server-Side In-Memory Singleton + Client localStorage Persistence
// ----------------------------------------------------------------------------
let serverMemoryState: BidirectionalPipelineState | null = null;

export function getPipelineState(): BidirectionalPipelineState {
  if (typeof window === 'undefined') {
    if (!serverMemoryState) {
      serverMemoryState = createInitialPipelineState();
    }
    return serverMemoryState;
  }

  try {
    const raw = window.localStorage.getItem(PIPELINE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as BidirectionalPipelineState;
      if (parsed && parsed.version === 1 && Array.isArray(parsed.children)) {
        return parsed;
      }
    }
  } catch {
    // Fallback to initial seed state if storage is unavailable
  }

  const initial = createInitialPipelineState();
  savePipelineState(initial);
  return initial;
}

export function savePipelineState(nextState: BidirectionalPipelineState): BidirectionalPipelineState {
  serverMemoryState = nextState;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(PIPELINE_STORAGE_KEY, JSON.stringify(nextState));
      window.dispatchEvent(new CustomEvent(PIPELINE_EVENT_NAME, { detail: nextState }));
    } catch {
      // Ignore storage quota errors
    }
  }
  return nextState;
}

export function resetPipelineState(): BidirectionalPipelineState {
  const fresh = createInitialPipelineState();
  return savePipelineState(fresh);
}

// ----------------------------------------------------------------------------
// Domain Event Helper
// ----------------------------------------------------------------------------
function prependDomainEvent(
  state: BidirectionalPipelineState,
  event: Omit<SystemDomainEvent, 'id' | 'created_at'>
): void {
  const newEvt: SystemDomainEvent = {
    ...event,
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    created_at: new Date().toISOString(),
  };
  state.domain_events = [newEvt, ...state.domain_events].slice(0, 50);
}

// ----------------------------------------------------------------------------
// Bidirectional Mutation Actions (Parent <-> Staff Portal)
// ----------------------------------------------------------------------------

/**
 * 1. Parent submits a Leave Request -> Instantly visible in Teacher Attendance & Leave Queue
 */
export function submitLeaveRequest(input: {
  student_id: string;
  leave_type: LeaveRequestType;
  start_date: string;
  end_date: string;
  reason: string;
}): StudentLeaveRequest {
  const state = getPipelineState();
  const child = state.children.find((c) => c.id === input.student_id);
  const nowIso = new Date().toISOString();

  const newReq: StudentLeaveRequest = {
    id: `lv-${Date.now()}`,
    student_id: input.student_id,
    student_name: child ? `${child.full_name} (${child.nickname})` : input.student_id,
    grade_level: child?.grade || '-',
    guardian_id: state.guardian.id,
    guardian_name: state.guardian.full_name,
    leave_type: input.leave_type,
    start_date: input.start_date,
    end_date: input.end_date,
    reason: input.reason,
    attachment_url: null,
    status: 'PENDING',
    reviewed_by: null,
    reviewed_at: null,
    review_note: null,
    created_at: nowIso,
    updated_at: nowIso,
  };

  state.leave_requests = [newReq, ...state.leave_requests];

  const typeLabel =
    input.leave_type === 'SICK_LEAVE'
      ? 'ลาป่วย'
      : input.leave_type === 'PERSONAL_LEAVE'
      ? 'ลากิจ'
      : 'ขอรับกลับก่อนเวลา';

  prependDomainEvent(state, {
    event_type: 'LEAVE_SUBMITTED',
    student_id: input.student_id,
    student_name: newReq.student_name,
    severity: 'HIGH',
    title_th: `ผู้ปกครองส่งใบ${typeLabel}ออนไลน์ (${newReq.student_name})`,
    title_en: `Parent Submitted ${input.leave_type} Request`,
    body_th: `วันที่ ${input.start_date} ถึง ${input.end_date}: ${input.reason}`,
    body_en: `Date ${input.start_date} to ${input.end_date}: ${input.reason}`,
    actor_role: 'PARENT',
    actor_name: state.guardian.full_name,
  });

  savePipelineState(state);
  return newReq;
}

/**
 * 2. Staff/Teacher approves or rejects a Leave Request -> Syncs to Attendance & notifies Parent
 */
export function reviewLeaveRequest(input: {
  leave_id: string;
  status: LeaveRequestStatus;
  reviewed_by: string;
  review_note?: string;
}): StudentLeaveRequest | null {
  const state = getPipelineState();
  const idx = state.leave_requests.findIndex((r) => r.id === input.leave_id);
  if (idx === -1) return null;

  const nowIso = new Date().toISOString();
  const target = state.leave_requests[idx];
  const updated: StudentLeaveRequest = {
    ...target,
    status: input.status,
    reviewed_by: input.reviewed_by,
    reviewed_at: nowIso,
    review_note: input.review_note || (input.status === 'APPROVED' ? 'อนุมัติใบลาและซิงค์เข้าสมุดเช็กชื่อเรียบร้อย' : 'ไม่อนุมัติ'),
    updated_at: nowIso,
  };
  state.leave_requests[idx] = updated;

  // If approved, also update today's attendance log if matching student
  if (input.status === 'APPROVED') {
    const attIdx = state.attendance_logs.findIndex((a) => a.student_id === updated.student_id);
    const mappedStatus: AttendanceStatus =
      updated.leave_type === 'SICK_LEAVE'
        ? 'SICK_LEAVE'
        : updated.leave_type === 'EARLY_PICKUP'
        ? 'EARLY_PICKUP'
        : 'PERSONAL_LEAVE';

    if (attIdx >= 0) {
      state.attendance_logs[attIdx] = {
        ...state.attendance_logs[attIdx],
        status: mappedStatus,
        notes: `อนุมัติใบลาออนไลน์: ${updated.reason}`,
        recorded_by: input.reviewed_by,
        updated_at: nowIso,
      };
    }
  }

  prependDomainEvent(state, {
    event_type: 'LEAVE_REVIEWED',
    student_id: updated.student_id,
    student_name: updated.student_name,
    severity: 'NORMAL',
    title_th: `ครูประจำชั้น${input.status === 'APPROVED' ? 'อนุมัติ' : 'ปฏิเสธ'}ใบลาของ ${updated.student_name}`,
    title_en: `Leave Request ${input.status} by Homeroom Teacher`,
    body_th: updated.review_note || '',
    body_en: updated.review_note || '',
    actor_role: 'STAFF',
    actor_name: input.reviewed_by,
  });

  savePipelineState(state);
  return updated;
}

/**
 * 3. Parent or Staff updates Daily Pickup Plan / Delegate OTP / Arrival Status
 */
export function updatePickupDailyPlan(input: {
  student_id: string;
  transport_mode?: TransportMode;
  collector_name?: string;
  collector_relationship?: string;
  collector_phone?: string;
  temp_otp_code?: string | null;
  arrival_status?: PickupArrivalStatus;
  released_by_staff?: string | null;
  notes?: string;
  actor_role?: 'PARENT' | 'STAFF';
  actor_name?: string;
}): PickupDailyPlan | null {
  const state = getPipelineState();
  const idx = state.pickup_plans.findIndex((p) => p.student_id === input.student_id);
  if (idx === -1) return null;

  const nowIso = new Date().toISOString();
  const current = state.pickup_plans[idx];

  const nextStatus = input.arrival_status ?? current.arrival_status;
  const updated: PickupDailyPlan = {
    ...current,
    transport_mode: input.transport_mode ?? current.transport_mode,
    collector_name: input.collector_name ?? current.collector_name,
    collector_relationship: input.collector_relationship ?? current.collector_relationship,
    collector_phone: input.collector_phone ?? current.collector_phone,
    temp_otp_code: input.temp_otp_code !== undefined ? input.temp_otp_code : current.temp_otp_code,
    arrival_status: nextStatus,
    arrived_at:
      nextStatus === 'ARRIVED_AT_GATE'
        ? new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'
        : current.arrived_at,
    released_at:
      nextStatus === 'RELEASED'
        ? new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'
        : current.released_at,
    released_by_staff: input.released_by_staff ?? current.released_by_staff,
    notes: input.notes ?? current.notes,
    updated_at: nowIso,
  };

  state.pickup_plans[idx] = updated;

  const statusTextMap: Record<PickupArrivalStatus, string> = {
    SCHEDULED: 'ตั้งค่าแผนการรับกลับ',
    ARRIVING_SOON: 'ผู้ปกครองกำลังเดินทางใกล้ถึงโรงเรียน (อีก 5 นาที)',
    ARRIVED_AT_GATE: 'ผู้ปกครองถึงจุดรอรับหน้าประตูโรงเรียนแล้ว',
    RELEASED: `ส่งมอบนักเรียนให้ ${updated.collector_name} เรียบร้อยแล้ว`,
  };

  prependDomainEvent(state, {
    event_type: `PICKUP_${nextStatus}`,
    student_id: updated.student_id,
    student_name: `${updated.student_name} (${updated.nickname})`,
    severity: nextStatus === 'ARRIVED_AT_GATE' || nextStatus === 'RELEASED' ? 'HIGH' : 'NORMAL',
    title_th: `จุดรับ-ส่งนักเรียน: ${statusTextMap[nextStatus]}`,
    title_en: `Pickup Queue Update: ${nextStatus}`,
    body_th: `${updated.student_name} (${updated.grade_level}) • ผู้รับ: ${updated.collector_name}`,
    body_en: `${updated.student_name} (${updated.grade_level}) • Collector: ${updated.collector_name}`,
    actor_role: input.actor_role || 'PARENT',
    actor_name: input.actor_name || state.guardian.full_name,
  });

  savePipelineState(state);
  return updated;
}

/**
 * 4. Parent submits Morning Drop-off Note for Early Years -> Teacher sees it immediately
 */
export function submitEarlyYearsDropoffNote(input: {
  student_id: string;
  sleep_hours: number;
  ate_breakfast: boolean;
  morning_mood: string;
  medication_today: boolean;
  pickup_person_today: string;
  special_note: string;
}): EarlyYearsDropoffNote {
  const state = getPipelineState();
  const child = state.children.find((c) => c.id === input.student_id);
  const todayStr = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  const existingIdx = state.dropoff_notes.findIndex(
    (n) => n.student_id === input.student_id && n.note_date === todayStr
  );

  const note: EarlyYearsDropoffNote = {
    id: existingIdx >= 0 ? state.dropoff_notes[existingIdx].id : `drop-${Date.now()}`,
    student_id: input.student_id,
    student_name: child ? `${child.full_name} (${child.nickname})` : input.student_id,
    grade_level: child?.grade || 'อ.2/1',
    note_date: todayStr,
    guardian_name: state.guardian.full_name,
    sleep_hours: input.sleep_hours,
    ate_breakfast: input.ate_breakfast,
    morning_mood: input.morning_mood,
    medication_today: input.medication_today,
    pickup_person_today: input.pickup_person_today,
    special_note: input.special_note,
    acknowledged_by_teacher: null,
    acknowledged_at: null,
    created_at: existingIdx >= 0 ? state.dropoff_notes[existingIdx].created_at : nowIso,
    updated_at: nowIso,
  };

  if (existingIdx >= 0) {
    state.dropoff_notes[existingIdx] = note;
  } else {
    state.dropoff_notes = [note, ...state.dropoff_notes];
  }

  prependDomainEvent(state, {
    event_type: 'EARLY_YEARS_DROPOFF_NOTE',
    student_id: input.student_id,
    student_name: note.student_name,
    severity: 'NORMAL',
    title_th: `ผู้ปกครองส่งบันทึกส่งน้องตอนเช้า (${note.student_name})`,
    title_en: `Morning Drop-off Note Submitted`,
    body_th: `นอน ${input.sleep_hours} ชม. • อาหารเช้า: ${input.ate_breakfast ? 'ทานแล้ว' : 'ยังไม่ได้ทาน'} • หมายเหตุ: ${input.special_note || '-'}`,
    body_en: `Sleep ${input.sleep_hours}h • Breakfast: ${input.ate_breakfast ? 'Yes' : 'No'}`,
    actor_role: 'PARENT',
    actor_name: state.guardian.full_name,
  });

  savePipelineState(state);
  return note;
}

/**
 * 5. Teacher saves/publishes Early Years Daily Care -> Parent sees it immediately in Daily Care Card
 */
export function saveEarlyYearsDailyCare(
  updatedRecord: Partial<EarlyYearsDailyCare> & { student_id: string }
): EarlyYearsDailyCare | null {
  const state = getPipelineState();
  const idx = state.early_years_care.findIndex((c) => c.student_id === updatedRecord.student_id);
  if (idx === -1) return null;

  const nowIso = new Date().toISOString();
  const next: EarlyYearsDailyCare = {
    ...state.early_years_care[idx],
    ...updatedRecord,
    is_published: true,
    published_at: nowIso,
    updated_at: nowIso,
  };

  state.early_years_care[idx] = next;

  prependDomainEvent(state, {
    event_type: 'DAILY_CARE_PUBLISHED',
    student_id: next.student_id,
    student_name: `${next.student_name} (${next.nickname})`,
    severity: 'NORMAL',
    title_th: `ครูประจำชั้นบันทึกสมุดพกอนุบาลประจำวัน (${next.nickname})`,
    title_en: `Early Years Daily Care Updated (${next.nickname})`,
    body_th: `มื้อเที่ยง: ${next.lunch_status} • นอนกลางวัน: ${next.nap_start}-${next.nap_end} • ${next.teacher_note}`,
    body_en: `Lunch: ${next.lunch_status} • Nap: ${next.nap_start}-${next.nap_end}`,
    actor_role: 'STAFF',
    actor_name: 'ครูนภัสสร ใจดี (ครูแนน)',
  });

  savePipelineState(state);
  return next;
}

/**
 * 6. Parent submits a Medication Administration Request -> Infirmary Queue
 */
export function submitMedicationRequest(input: {
  student_id: string;
  medication_name: string;
  dosage: string;
  schedule_times: string[];
  meal_timing: MedicationMealTiming;
  start_date: string;
  end_date: string;
  reason: string;
}): MedicationRequest {
  const state = getPipelineState();
  const child = state.children.find((c) => c.id === input.student_id);
  const nowIso = new Date().toISOString();

  const med: MedicationRequest = {
    id: `med-${Date.now()}`,
    student_id: input.student_id,
    student_name: child ? `${child.full_name} (${child.nickname})` : input.student_id,
    grade_level: child?.grade || '-',
    guardian_name: state.guardian.full_name,
    medication_name: input.medication_name,
    dosage: input.dosage,
    schedule_times: input.schedule_times,
    meal_timing: input.meal_timing,
    start_date: input.start_date,
    end_date: input.end_date,
    reason: input.reason,
    signature_data_url: `SIGNED_BY_${state.guardian.full_name}`,
    status: 'ACTIVE',
    last_administered_at: null,
    last_administered_by: null,
    nurse_note: null,
    created_at: nowIso,
    updated_at: nowIso,
  };

  state.medication_requests = [med, ...state.medication_requests];

  prependDomainEvent(state, {
    event_type: 'MEDICATION_REQUESTED',
    student_id: input.student_id,
    student_name: med.student_name,
    severity: 'HIGH',
    title_th: `ผู้ปกครองส่งคำร้องฝากป้อนยา (${med.student_name})`,
    title_en: `Parent Submitted Medication Administration Request`,
    body_th: `ยา: ${input.medication_name} (${input.dosage}) เวลา ${input.schedule_times.join(', ')}`,
    body_en: `Medication: ${input.medication_name} (${input.dosage})`,
    actor_role: 'PARENT',
    actor_name: state.guardian.full_name,
  });

  savePipelineState(state);
  return med;
}

/**
 * 7. Nurse administers Medication -> Updates Parent Health View immediately
 */
export function recordMedicationAdministered(input: {
  medication_id: string;
  administered_by: string;
  nurse_note: string;
}): MedicationRequest | null {
  const state = getPipelineState();
  const idx = state.medication_requests.findIndex((m) => m.id === input.medication_id);
  if (idx === -1) return null;

  const nowIso = new Date().toISOString();
  const updated: MedicationRequest = {
    ...state.medication_requests[idx],
    status: 'ADMINISTERED_TODAY',
    last_administered_at: nowIso,
    last_administered_by: input.administered_by,
    nurse_note: input.nurse_note,
    updated_at: nowIso,
  };

  state.medication_requests[idx] = updated;

  prependDomainEvent(state, {
    event_type: 'MEDICATION_ADMINISTERED',
    student_id: updated.student_id,
    student_name: updated.student_name,
    severity: 'HIGH',
    title_th: `ห้องพยาบาลป้อนยา ${updated.medication_name} เรียบร้อยแล้ว`,
    title_en: `Medication Administered by School Nurse`,
    body_th: `${updated.student_name}: ${input.nurse_note}`,
    body_en: `${updated.student_name}: ${input.nurse_note}`,
    actor_role: 'STAFF',
    actor_name: input.administered_by,
  });

  savePipelineState(state);
  return updated;
}

/**
 * 8. Parent acknowledges an Infirmary Incident Report
 */
export function acknowledgeStudentIncident(incidentId: string): StudentIncident | null {
  const state = getPipelineState();
  const idx = state.incidents.findIndex((inc) => inc.id === incidentId);
  if (idx === -1) return null;

  const nowIso = new Date().toISOString();
  const updated: StudentIncident = {
    ...state.incidents[idx],
    parent_acknowledged: true,
    parent_acknowledged_at: nowIso,
    acknowledged_by_name: state.guardian.full_name,
    updated_at: nowIso,
  };

  state.incidents[idx] = updated;

  prependDomainEvent(state, {
    event_type: 'INCIDENT_ACKNOWLEDGED',
    student_id: updated.student_id,
    student_name: updated.student_name,
    severity: 'NORMAL',
    title_th: `ผู้ปกครองลงนามรับทราบรายงานการปฐมพยาบาล (${updated.student_name})`,
    title_en: `Parent Acknowledged Infirmary Incident Report`,
    body_th: `รับทราบโดย ${state.guardian.full_name}`,
    body_en: `Acknowledged by ${state.guardian.full_name}`,
    actor_role: 'PARENT',
    actor_name: state.guardian.full_name,
  });

  savePipelineState(state);
  return updated;
}

/**
 * 9. Parent signs 15-Year Free Education Subsidy (OPEC / สช.) or Pays Tuition / Top-up Wallet
 */
export function signFree15YSubsidyReceipt(subsidyId: string): Free15YSubsidyItem | null {
  const state = getPipelineState();
  const idx = state.free15y_subsidies.findIndex((s) => s.id === subsidyId);
  if (idx === -1) return null;

  const nowIso = new Date().toISOString();
  const updated: Free15YSubsidyItem = {
    ...state.free15y_subsidies[idx],
    parent_signed: true,
    signed_by_name: state.guardian.full_name,
    signed_at: nowIso,
  };
  state.free15y_subsidies[idx] = updated;

  const child = state.children.find((c) => c.id === updated.student_id);
  prependDomainEvent(state, {
    event_type: 'FREE15Y_SUBSIDY_SIGNED',
    student_id: updated.student_id,
    student_name: child ? `${child.full_name} (${child.nickname})` : updated.student_id,
    severity: 'NORMAL',
    title_th: `ผู้ปกครองลงนามรับเงินอุดหนุนเรียนฟรี 15 ปี (${updated.category_th})`,
    title_en: `Parent Signed 15-Year Free Education Subsidy Receipt`,
    body_th: `รหัสใบสำคัญ ${updated.receipt_code} จำนวน ${updated.amount.toLocaleString()} บาท`,
    body_en: `Receipt ${updated.receipt_code} for ${updated.amount.toLocaleString()} THB`,
    actor_role: 'PARENT',
    actor_name: state.guardian.full_name,
  });

  savePipelineState(state);
  return updated;
}

export function topupChildWalletFromParent(
  studentId: string,
  amount: number
): ParentChildProfile | null {
  if (amount <= 0 || amount > 10000) return null;
  const state = getPipelineState();
  const idx = state.children.findIndex((c) => c.id === studentId);
  if (idx === -1) return null;

  const child = state.children[idx];
  const updated: ParentChildProfile = {
    ...child,
    wallet_balance: Number((child.wallet_balance + amount).toFixed(2)),
  };
  state.children[idx] = updated;

  prependDomainEvent(state, {
    event_type: 'WALLET_TOPUP',
    student_id: studentId,
    student_name: `${updated.full_name} (${updated.nickname})`,
    severity: 'NORMAL',
    title_th: `ผู้ปกครองเติมเงินกระเป๋าเงินดิจิทัล +${amount.toLocaleString()} บาท`,
    title_en: `Parent Topped Up Student Wallet +${amount.toLocaleString()} THB`,
    body_th: `ยอดคงเหลือใหม่ของ ${updated.nickname}: ${updated.wallet_balance.toLocaleString()} บาท`,
    body_en: `New balance for ${updated.nickname}: ${updated.wallet_balance.toLocaleString()} THB`,
    actor_role: 'PARENT',
    actor_name: state.guardian.full_name,
  });

  savePipelineState(state);
  return updated;
}

export function payFeeInvoiceFromParent(invoiceId: string): ParentFeeInvoiceItem | null {
  const state = getPipelineState();
  const idx = state.fee_invoices.findIndex((inv) => inv.id === invoiceId);
  if (idx === -1) return null;

  const nowIso = new Date().toISOString();
  const receiptNo = `REC-2569-${String(Math.floor(10000 + Math.random() * 89999))}`;
  const updated: ParentFeeInvoiceItem = {
    ...state.fee_invoices[idx],
    status: 'paid',
    receipt_number: receiptNo,
    paid_at: nowIso,
    payment_method: 'QR PromptPay (Parents Portal)',
  };
  state.fee_invoices[idx] = updated;

  const child = state.children.find((c) => c.id === updated.student_id);
  prependDomainEvent(state, {
    event_type: 'TUITION_PAID',
    student_id: updated.student_id,
    student_name: child ? `${child.full_name} (${child.nickname})` : updated.student_id,
    severity: 'HIGH',
    title_th: `ชำระค่าธรรมเนียมการศึกษาสำเร็จ (${receiptNo})`,
    title_en: `Tuition Fee Paid (${receiptNo})`,
    body_th: `${updated.title_th} ยอด ${updated.amount.toLocaleString()} บาท`,
    body_en: `${updated.title_en} (${updated.amount.toLocaleString()} THB)`,
    actor_role: 'PARENT',
    actor_name: state.guardian.full_name,
  });

  savePipelineState(state);
  return updated;
}

/**
 * 10. Parent or Staff sends a message in Parent-Teacher Thread
 */
export function sendParentTeacherMessage(input: {
  thread_id: string;
  sender_type: 'PARENT' | 'STAFF';
  sender_name: string;
  body_th: string;
  require_acknowledgement?: boolean;
}): ParentTeacherMessage | null {
  const state = getPipelineState();
  const thdIdx = state.threads.findIndex((t) => t.id === input.thread_id);
  if (thdIdx === -1) return null;

  const nowIso = new Date().toISOString();
  const thread = state.threads[thdIdx];

  const msg: ParentTeacherMessage = {
    id: `msg-${Date.now()}`,
    thread_id: input.thread_id,
    sender_type: input.sender_type,
    sender_name: input.sender_name,
    body_th: input.body_th,
    body_en: null,
    require_acknowledgement: Boolean(input.require_acknowledgement),
    acknowledged_at: null,
    created_at: nowIso,
  };

  state.messages = [...state.messages, msg];
  state.threads[thdIdx] = {
    ...thread,
    last_message_text: input.body_th,
    last_message_at: nowIso,
    unread_staff_count:
      input.sender_type === 'PARENT' ? thread.unread_staff_count + 1 : 0,
    unread_parent_count:
      input.sender_type === 'STAFF' ? thread.unread_parent_count + 1 : 0,
    updated_at: nowIso,
  };

  prependDomainEvent(state, {
    event_type: 'MESSAGE_SENT',
    student_id: thread.student_id,
    student_name: thread.student_name,
    severity: 'NORMAL',
    title_th:
      input.sender_type === 'PARENT'
        ? `ข้อความใหม่จากผู้ปกครอง (${thread.student_name})`
        : `ข้อความใหม่จากครูประจำชั้น (${thread.teacher_name})`,
    title_en: `New Chat Message (${thread.student_name})`,
    body_th: input.body_th,
    body_en: input.body_th,
    actor_role: input.sender_type,
    actor_name: input.sender_name,
  });

  savePipelineState(state);
  return msg;
}

/**
 * 11. Parent toggles granular PDPA Consent -> Syncs to Staff PDPA & Media Filter
 */
export function toggleStudentConsent(
  studentId: string,
  purposeCode: ConsentPurposeCode,
  isGranted: boolean
): ConsentRecord | null {
  const state = getPipelineState();
  const idx = state.consents.findIndex(
    (c) => c.student_id === studentId && c.purpose_code === purposeCode
  );
  if (idx === -1) return null;

  const nowIso = new Date().toISOString();
  const updated: ConsentRecord = {
    ...state.consents[idx],
    is_granted: isGranted,
    signed_at: isGranted ? nowIso : state.consents[idx].signed_at,
    revoked_at: isGranted ? null : nowIso,
  };
  state.consents[idx] = updated;

  const child = state.children.find((c) => c.id === studentId);
  prependDomainEvent(state, {
    event_type: isGranted ? 'CONSENT_GRANTED' : 'CONSENT_REVOKED',
    student_id: studentId,
    student_name: child ? `${child.full_name} (${child.nickname})` : studentId,
    severity: isGranted ? 'NORMAL' : 'HIGH',
    title_th: `ผู้ปกครอง${isGranted ? 'อนุญาต' : 'ถอนความยินยอม'} PDPA: ${updated.purpose_title_th}`,
    title_en: `Parent ${isGranted ? 'Granted' : 'Revoked'} PDPA Consent: ${purposeCode}`,
    body_th: `เวอร์ชันนโยบาย ${updated.policy_version} • มีผลทันทีในระบบกรองรูปภาพและกิจกรรมโรงเรียน`,
    body_en: `Policy ${updated.policy_version} updated immediately.`,
    actor_role: 'PARENT',
    actor_name: state.guardian.full_name,
  });

  savePipelineState(state);
  return updated;
}

/**
 * 12. Staff updates Guardian Permission Matrix or Legal Restriction
 */
export function updateGuardianLinkPermissions(
  linkId: string,
  patch: Partial<GuardianStudentLink>,
  staffName: string = 'ฝ่ายทะเบียนโรงเรียนสมคิดวิทยา'
): GuardianStudentLink | null {
  const state = getPipelineState();
  const idx = state.links.findIndex((l) => l.id === linkId);
  if (idx === -1) return null;

  const nowIso = new Date().toISOString();
  const updated: GuardianStudentLink = {
    ...state.links[idx],
    ...patch,
    updated_at: nowIso,
  };
  state.links[idx] = updated;

  // Also sync onto child profile permissions
  const childIdx = state.children.findIndex((c) => c.id === updated.student_id);
  if (childIdx >= 0) {
    state.children[childIdx] = {
      ...state.children[childIdx],
      permissions: {
        is_legal_guardian: updated.is_legal_guardian,
        can_view_daily: updated.can_view_daily,
        can_view_academic: updated.can_view_academic,
        can_view_health: updated.can_view_health,
        can_view_finance: updated.can_view_finance,
        can_pay: updated.can_pay,
        can_message_teacher: updated.can_message_teacher,
        can_pickup: updated.can_pickup,
        can_manage_pickup: updated.can_manage_pickup,
        can_give_consent: updated.can_give_consent,
        receives_emergency_alert: updated.receives_emergency_alert,
      },
    };
  }

  prependDomainEvent(state, {
    event_type: 'GUARDIAN_PERMISSION_UPDATED',
    student_id: updated.student_id,
    severity: updated.has_legal_restriction ? 'CRITICAL' : 'NORMAL',
    title_th: `อัปเดตสิทธิ์ผู้ปกครองรหัสนักเรียน ${updated.student_id}`,
    title_en: `Updated Guardian Access Matrix for Student ${updated.student_id}`,
    body_th: updated.has_legal_restriction
      ? `เปิดใช้งานคำสั่งระงับสิทธิ์ตามกฎหมาย: ${updated.restriction_note || '-'}`
      : `ปรับปรุงสิทธิ์ 10 ด้านของผู้ปกครองเรียบร้อยแล้ว`,
    body_en: `Guardian permissions updated by ${staffName}`,
    actor_role: 'STAFF',
    actor_name: staffName,
  });

  savePipelineState(state);
  return updated;
}

/**
 * 13. Staff generates a new Guardian Invitation Code
 */
export function createGuardianInviteCode(input: {
  student_id: string;
  student_name: string;
  grade_level: string;
  guardian_name: string;
  guardian_phone: string;
}): GuardianInvitation {
  const state = getPipelineState();
  const code = `SV-FAM-${input.student_id}-${Math.floor(100 + Math.random() * 900)}`;
  const nowIso = new Date().toISOString();

  const inv: GuardianInvitation = {
    id: `inv-${Date.now()}`,
    guardian_id: `g-${Date.now()}`,
    guardian_name: input.guardian_name,
    guardian_phone: input.guardian_phone,
    student_id: input.student_id,
    student_name: input.student_name,
    grade_level: input.grade_level,
    invite_code: code,
    expires_at: '2026-12-31T23:59:59.000Z',
    used_at: null,
    created_by: 'ฝ่ายทะเบียนโรงเรียนสมคิดวิทยา',
    created_at: nowIso,
  };

  state.invitations = [inv, ...state.invitations];
  savePipelineState(state);
  return inv;
}

/**
 * 14. Staff records or updates Student Attendance (NFC Gate / Teacher Batch / Van)
 */
export function recordStudentAttendance(input: {
  student_id: string;
  status: AttendanceStatus;
  check_in_time?: string | null;
  check_out_time?: string | null;
  source?: 'NFC_GATE' | 'TEACHER_APP' | 'VAN_SYNC' | 'DISMISSAL_KIOSK';
  recorded_by?: string;
  notes?: string;
}): StudentAttendanceLog | null {
  const state = getPipelineState();
  const idx = state.attendance_logs.findIndex((a) => a.student_id === input.student_id);
  const nowIso = new Date().toISOString();
  const timeStr =
    input.check_in_time !== undefined
      ? input.check_in_time
      : new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

  if (idx >= 0) {
    const updated: StudentAttendanceLog = {
      ...state.attendance_logs[idx],
      status: input.status,
      check_in_time:
        input.status === 'PRESENT' || input.status === 'LATE'
          ? timeStr || state.attendance_logs[idx].check_in_time || '07:45'
          : null,
      check_out_time: input.check_out_time ?? state.attendance_logs[idx].check_out_time,
      source: input.source || state.attendance_logs[idx].source,
      recorded_by: input.recorded_by || state.attendance_logs[idx].recorded_by,
      notes: input.notes !== undefined ? input.notes : state.attendance_logs[idx].notes,
      updated_at: nowIso,
    };
    state.attendance_logs[idx] = updated;

    prependDomainEvent(state, {
      event_type: 'ATTENDANCE_UPDATED',
      student_id: updated.student_id,
      student_name: `${updated.student_name} (${updated.nickname})`,
      severity: input.status === 'ABSENT' ? 'CRITICAL' : 'NORMAL',
      title_th: `อัปเดตสถานะการมาเรียน: ${updated.student_name} (${input.status})`,
      title_en: `Attendance Updated: ${updated.student_name} (${input.status})`,
      body_th: `เวลา: ${updated.check_in_time || '-'} • ช่องทาง: ${updated.source}`,
      body_en: `Time: ${updated.check_in_time || '-'} • Source: ${updated.source}`,
      actor_role: 'STAFF',
      actor_name: input.recorded_by || 'ระบบเช็กชื่อโรงเรียนสมคิดวิทยา',
    });

    savePipelineState(state);
    return updated;
  }
  return null;
}

/**
 * 15. Teacher acknowledges Morning Drop-off Note from Parent
 */
export function acknowledgeEarlyYearsDropoffNote(
  noteId: string,
  teacherName: string = 'ครูนภัสสร ใจดี (ครูแนน)'
): EarlyYearsDropoffNote | null {
  const state = getPipelineState();
  const idx = state.dropoff_notes.findIndex((n) => n.id === noteId);
  if (idx === -1) return null;

  const nowIso = new Date().toISOString();
  const updated: EarlyYearsDropoffNote = {
    ...state.dropoff_notes[idx],
    acknowledged_by_teacher: teacherName,
    acknowledged_at: nowIso,
    updated_at: nowIso,
  };
  state.dropoff_notes[idx] = updated;

  prependDomainEvent(state, {
    event_type: 'DROPOFF_NOTE_ACKNOWLEDGED',
    student_id: updated.student_id,
    student_name: updated.student_name,
    severity: 'NORMAL',
    title_th: `ครูประจำชั้นรับทราบบันทึกส่งน้องตอนเช้า (${updated.student_name})`,
    title_en: `Homeroom Teacher Acknowledged Morning Drop-off Note`,
    body_th: `รับทราบโดย ${teacherName}`,
    body_en: `Acknowledged by ${teacherName}`,
    actor_role: 'STAFF',
    actor_name: teacherName,
  });

  savePipelineState(state);
  return updated;
}

/**
 * 16. Teacher creates or updates Primary Academic Assignment -> Syncs to Parents Portal
 */
export function createOrUpdateAssignment(input: {
  id?: string;
  class_id: string;
  grade_level: string;
  subject_name: string;
  title_th: string;
  title_en: string;
  description: string;
  due_date: string;
  max_score: number;
  assigned_by: string;
  student_id: string;
  submission_status?: 'SUBMITTED' | 'PENDING' | 'LATE' | 'NEEDS_REVISION';
  score?: number | null;
  teacher_feedback?: string | null;
}): AcademicAssignmentItem {
  const state = getPipelineState();
  const nowIso = new Date().toISOString();
  const existingIdx = input.id ? state.assignments.findIndex((a) => a.id === input.id) : -1;

  const item: AcademicAssignmentItem = {
    id: existingIdx >= 0 ? state.assignments[existingIdx].id : `asg-${Date.now()}`,
    class_id: input.class_id,
    grade_level: input.grade_level,
    subject_name: input.subject_name,
    title_th: input.title_th,
    title_en: input.title_en || input.title_th,
    description: input.description,
    due_date: input.due_date,
    max_score: input.max_score,
    assigned_by: input.assigned_by,
    student_id: input.student_id,
    submission_status: input.submission_status || 'PENDING',
    score: input.score ?? null,
    teacher_feedback: input.teacher_feedback ?? null,
    updated_at: nowIso,
  };

  if (existingIdx >= 0) {
    state.assignments[existingIdx] = item;
  } else {
    state.assignments = [item, ...state.assignments];
  }

  prependDomainEvent(state, {
    event_type: 'ASSIGNMENT_UPDATED',
    student_id: item.student_id,
    severity: 'NORMAL',
    title_th: `อัปเดตการบ้าน/ชิ้นงานวิชา ${item.subject_name}`,
    title_en: `Assignment Updated: ${item.subject_name}`,
    body_th: `${item.title_th} (กำหนดส่ง ${item.due_date})`,
    body_en: `${item.title_en} (Due ${item.due_date})`,
    actor_role: 'STAFF',
    actor_name: item.assigned_by,
  });

  savePipelineState(state);
  return item;
}

