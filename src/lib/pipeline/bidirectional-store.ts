// ============================================================================
// Somkidvittaya School (SV-Portal & Parents Portal)
// Bidirectional Operational Pipeline Store (Server + Client Isomorphic)
// Storage Key: sv_bidirectional_pipeline_v2
// Production Database: Real Students, Real Guardians, Real Schema Tables
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
} from "@/types/family-pipeline";

export const PIPELINE_STORAGE_KEY = "sv_bidirectional_pipeline_v2";
export const PIPELINE_EVENT_NAME = "sv-pipeline-updated";

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
): { valid: boolean; matchedMode: "TOTP_CURRENT" | "TOTP_PREVIOUS" | "DELEGATE_OTP" | "NONE" } {
  const clean = inputCode.replace(/\D/g, "");
  if (!clean) return { valid: false, matchedMode: "NONE" };

  const currentBucket = getPickupTimeBucket(timestampMs);
  if (clean === generatePickupTotp(studentId, currentBucket)) {
    return { valid: true, matchedMode: "TOTP_CURRENT" };
  }
  if (clean === generatePickupTotp(studentId, currentBucket - 1)) {
    return { valid: true, matchedMode: "TOTP_PREVIOUS" };
  }

  // Also check if there is a temporary delegate OTP on today\x27s pickup plan
  const state = getPipelineState();
  const plan = state.pickup_plans.find((p) => p.student_id === studentId);
  if (plan?.temp_otp_code && plan.temp_otp_code.replace(/\D/g, "") === clean) {
    return { valid: true, matchedMode: "DELEGATE_OTP" };
  }

  return { valid: false, matchedMode: "NONE" };
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
// Background API Sync Helper (Isomorphic Client -> Supabase via /api/pipeline)
// ----------------------------------------------------------------------------
function syncToBackend(action: string, payload: unknown): void {
  if (typeof window === "undefined") return;
  fetch("/api/pipeline", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload }),
  }).catch((err) => {
    console.warn("Pipeline backend sync warning:", err);
  });
}

let hasInitiatedSync = false;

export function initRealClientPipelineSync(): void {
  if (typeof window === "undefined" || hasInitiatedSync) return;
  hasInitiatedSync = true;

  fetch("/api/pipeline")
    .then((res) => res.json())
    .then((data) => {
      if (data?.success && data?.state) {
        const remoteState = data.state as BidirectionalPipelineState;
        if (Array.isArray(remoteState.children) && remoteState.children.length > 0) {
          const currentState = getPipelineState();
          const merged: BidirectionalPipelineState = {
            ...currentState,
            version: 2,
            children: remoteState.children,
            guardian: remoteState.guardian || currentState.guardian,
            attendance_logs: remoteState.attendance_logs?.length > 0 ? remoteState.attendance_logs : currentState.attendance_logs,
            leave_requests: remoteState.leave_requests?.length > 0 ? remoteState.leave_requests : currentState.leave_requests,
            pickup_plans: remoteState.pickup_plans?.length > 0 ? remoteState.pickup_plans : currentState.pickup_plans,
            early_years_care: remoteState.early_years_care?.length > 0 ? remoteState.early_years_care : currentState.early_years_care,
            dropoff_notes: remoteState.dropoff_notes?.length > 0 ? remoteState.dropoff_notes : currentState.dropoff_notes,
            medication_requests: remoteState.medication_requests?.length > 0 ? remoteState.medication_requests : currentState.medication_requests,
            incidents: remoteState.incidents?.length > 0 ? remoteState.incidents : currentState.incidents,
            assignments: remoteState.assignments?.length > 0 ? remoteState.assignments : currentState.assignments,
            threads: remoteState.threads?.length > 0 ? remoteState.threads : currentState.threads,
            messages: remoteState.messages?.length > 0 ? remoteState.messages : currentState.messages,
            consents: remoteState.consents?.length > 0 ? remoteState.consents : currentState.consents,
            fee_invoices: remoteState.fee_invoices?.length > 0 ? remoteState.fee_invoices : currentState.fee_invoices,
            free15y_subsidies: remoteState.free15y_subsidies?.length > 0 ? remoteState.free15y_subsidies : currentState.free15y_subsidies,
          };
          savePipelineState(merged);
        }
      }
    })
    .catch((err) => {
      console.warn("Real pipeline sync initial load warning:", err);
    });
}

// ----------------------------------------------------------------------------
// Initial Real Seed Data from Somkidvittaya Production Database
// ----------------------------------------------------------------------------
export function createInitialPipelineState(): BidirectionalPipelineState {
  const todayStr = new Date().toISOString().slice(0, 10);

  // Real Guardian: นายศักดิ์ชัย อุ่นอบ (บิดาของน้องมีฟา และน้องจั๊มเปอร์)
  const guardian: GuardianProfile = {
    id: "fe4c7c15-7aff-4729-853a-57fca16021a3",
    citizen_id: "3210500016626",
    prefix: "นาย",
    first_name: "ศักดิ์ชัย",
    last_name: "อุ่นอบ",
    full_name: "นายศักดิ์ชัย อุ่นอบ",
    phone_number: "061-552-0560",
    email: null,
    line_user_id: "mj246395",
    occupation: "ประกอบธุรกิจส่วนตัว",
    annual_income: null,
    photo_url: null,
    preferred_lang: "th",
    is_active: true,
    created_at: "2026-05-10T08:00:00.000Z",
    updated_at: "2026-10-20T08:00:00.000Z",
  };

  // Real Students: 5 Featured across Early Years (อ.1/1, อ.3/1) and Primary (ป.1/1, ป.3/1, ป.6/1)
  const children: ParentChildProfile[] = [
    {
      id: "10103",
      public_uid: "c1a9f103-1010-4000-8000-000000010103",
      learner_id: "3210500016626-1",
      prefix: "ด.ญ.",
      first_name: "ธัญพร",
      last_name: "อุ่นอบ",
      full_name: "เด็กหญิงธัญพร อุ่นอบ",
      name_en: "Thanyaporn Un-ob",
      nickname: "น้องมีฟา",
      grade: "ป.3/1",
      classroom: "1",
      stage: "PRIMARY",
      homeroom_teacher: "ครูประจำชั้น ป.3/1 (แผนกประถมศึกษา)",
      homeroom_teacher_phone: "038-611-195",
      blood_group: "B",
      allergies: "ไม่มี",
      medical_conditions: "ไม่มี",
      height_cm: 132.0,
      weight_kg: 28.5,
      wallet_balance: 450.0,
      wallet_daily_limit: 100.0,
      attendance_rate_pct: 99.2,
      gpa_or_assessment: "3.88",
      photo_url: null,
      permissions: { ...FULL_GUARDIAN_PERMISSIONS },
    },
    {
      id: "9775",
      public_uid: "c1a9f977-9775-4000-8000-000000009775",
      learner_id: "3210500016626-2",
      prefix: "ด.ช.",
      first_name: "ชณธร",
      last_name: "อุ่นอบ",
      full_name: "เด็กชายชณธร อุ่นอบ",
      name_en: "Chanathorn Un-ob",
      nickname: "น้องจั๊มเปอร์",
      grade: "ป.6/1",
      classroom: "1",
      stage: "PRIMARY",
      homeroom_teacher: "ครูประจำชั้น ป.6/1 (แผนกประถมศึกษา)",
      homeroom_teacher_phone: "038-611-195",
      blood_group: "O",
      allergies: "ไม่มี",
      medical_conditions: "ไม่มี",
      height_cm: 148.5,
      weight_kg: 41.0,
      wallet_balance: 580.0,
      wallet_daily_limit: 120.0,
      attendance_rate_pct: 98.7,
      gpa_or_assessment: "3.75",
      photo_url: null,
      permissions: { ...FULL_GUARDIAN_PERMISSIONS },
    },
    {
      id: "10264",
      public_uid: "c1a9f264-1026-4000-8000-000000010264",
      learner_id: "1219800206562-1",
      prefix: "ด.ช.",
      first_name: "ฐิติวัฒน์",
      last_name: "ธนโชติกิจพงศ์",
      full_name: "เด็กชายฐิติวัฒน์ ธนโชติกิจพงศ์",
      name_en: "Thitiwat Thanachotkitpong",
      nickname: "น้องโนอาห์",
      grade: "อ.1/1",
      classroom: "1",
      stage: "EARLY_YEARS",
      homeroom_teacher: "ครูนภัสสร ภักคีรี (แผนกปฐมวัย)",
      homeroom_teacher_phone: "038-611-195",
      blood_group: "A",
      allergies: "ไม่มี",
      medical_conditions: "ไม่มี",
      height_cm: 98.5,
      weight_kg: 15.2,
      wallet_balance: 250.0,
      wallet_daily_limit: 60.0,
      attendance_rate_pct: 98.5,
      gpa_or_assessment: "พัฒนาการสมวัยดีเด่น (4 ด้าน)",
      photo_url: null,
      permissions: { ...FULL_GUARDIAN_PERMISSIONS },
    },
    {
      id: "10247",
      public_uid: "c1a9f247-1024-4000-8000-000000010247",
      learner_id: "3210100435397-1",
      prefix: "ด.ญ.",
      first_name: "ฐิติชญา",
      last_name: "เจริญรัตน์",
      full_name: "เด็กหญิงฐิติชญา เจริญรัตน์",
      name_en: "Thitichaya Charoenrat",
      nickname: "น้องอิมเมจ",
      grade: "อ.3/1",
      classroom: "1",
      stage: "EARLY_YEARS",
      homeroom_teacher: "ครูประจำชั้น อ.3/1 (แผนกปฐมวัย)",
      homeroom_teacher_phone: "038-611-195",
      blood_group: "O",
      allergies: "ไม่มี",
      medical_conditions: "ไม่มี",
      height_cm: 110.0,
      weight_kg: 18.5,
      wallet_balance: 320.0,
      wallet_daily_limit: 80.0,
      attendance_rate_pct: 99.0,
      gpa_or_assessment: "พัฒนาการสมวัยดีเยี่ยม (4 ด้าน)",
      photo_url: null,
      permissions: { ...FULL_GUARDIAN_PERMISSIONS },
    },
    {
      id: "10161",
      public_uid: "c1a9f161-1016-4000-8000-000000010161",
      learner_id: "1210100552194-1",
      prefix: "ด.ช.",
      first_name: "กิตติ์พิพัฒน์",
      last_name: "พรมมีเดช",
      full_name: "เด็กชายกิตติ์พิพัฒน์ พรมมีเดช",
      name_en: "Kittipiphat Prommeedech",
      nickname: "น้องไบร์ท",
      grade: "ป.1/1",
      classroom: "1",
      stage: "PRIMARY",
      homeroom_teacher: "ครูประจำชั้น ป.1/1 (แผนกประถมศึกษา)",
      homeroom_teacher_phone: "038-611-195",
      blood_group: "B",
      allergies: "ไม่มี",
      medical_conditions: "ไม่มี",
      height_cm: 122.0,
      weight_kg: 23.0,
      wallet_balance: 300.0,
      wallet_daily_limit: 80.0,
      attendance_rate_pct: 99.5,
      gpa_or_assessment: "3.90",
      photo_url: null,
      permissions: { ...FULL_GUARDIAN_PERMISSIONS },
    },
  ];

  const links: GuardianStudentLink[] = [
    {
      id: "gsl-10103-1",
      guardian_id: guardian.id,
      student_id: "10103",
      relationship: "บิดา",
      role_type: "PRIMARY",
      ...FULL_GUARDIAN_PERMISSIONS,
      has_legal_restriction: false,
      restriction_note: null,
      valid_from: "2026-05-01T00:00:00.000Z",
      valid_until: null,
      created_at: "2026-05-01T00:00:00.000Z",
      updated_at: "2026-10-20T00:00:00.000Z",
    },
    {
      id: "gsl-9775-1",
      guardian_id: guardian.id,
      student_id: "9775",
      relationship: "บิดา",
      role_type: "PRIMARY",
      ...FULL_GUARDIAN_PERMISSIONS,
      has_legal_restriction: false,
      restriction_note: null,
      valid_from: "2026-05-01T00:00:00.000Z",
      valid_until: null,
      created_at: "2026-05-01T00:00:00.000Z",
      updated_at: "2026-10-20T00:00:00.000Z",
    },
    {
      id: "gsl-10264-1",
      guardian_id: guardian.id,
      student_id: "10264",
      relationship: "บิดา",
      role_type: "PRIMARY",
      ...FULL_GUARDIAN_PERMISSIONS,
      has_legal_restriction: false,
      restriction_note: null,
      valid_from: "2026-05-01T00:00:00.000Z",
      valid_until: null,
      created_at: "2026-05-01T00:00:00.000Z",
      updated_at: "2026-10-20T00:00:00.000Z",
    },
    {
      id: "gsl-10247-1",
      guardian_id: guardian.id,
      student_id: "10247",
      relationship: "บิดา",
      role_type: "PRIMARY",
      ...FULL_GUARDIAN_PERMISSIONS,
      has_legal_restriction: false,
      restriction_note: null,
      valid_from: "2026-05-01T00:00:00.000Z",
      valid_until: null,
      created_at: "2026-05-01T00:00:00.000Z",
      updated_at: "2026-10-20T00:00:00.000Z",
    },
    {
      id: "gsl-10161-1",
      guardian_id: guardian.id,
      student_id: "10161",
      relationship: "บิดา",
      role_type: "PRIMARY",
      ...FULL_GUARDIAN_PERMISSIONS,
      has_legal_restriction: false,
      restriction_note: null,
      valid_from: "2026-05-01T00:00:00.000Z",
      valid_until: null,
      created_at: "2026-05-01T00:00:00.000Z",
      updated_at: "2026-10-20T00:00:00.000Z",
    },
  ];

  const invitations: GuardianInvitation[] = [
    {
      id: "inv-10103",
      guardian_id: guardian.id,
      guardian_name: "นายศักดิ์ชัย อุ่นอบ",
      guardian_phone: "061-552-0560",
      student_id: "10103",
      student_name: "เด็กหญิงธัญพร อุ่นอบ (น้องมีฟา)",
      grade_level: "ป.3/1",
      invite_code: "SV-FAM-10103",
      expires_at: "2026-12-31T23:59:59.000Z",
      used_at: "2026-05-16T09:12:00.000Z",
      created_by: "ฝ่ายทะเบียนโรงเรียนสมคิดวิทยา",
      created_at: "2026-05-15T08:30:00.000Z",
    },
    {
      id: "inv-9775",
      guardian_id: guardian.id,
      guardian_name: "นายศักดิ์ชัย อุ่นอบ",
      guardian_phone: "061-552-0560",
      student_id: "9775",
      student_name: "เด็กชายชณธร อุ่นอบ (น้องจั๊มเปอร์)",
      grade_level: "ป.6/1",
      invite_code: "SV-FAM-9775",
      expires_at: "2026-12-31T23:59:59.000Z",
      used_at: "2026-05-16T09:15:00.000Z",
      created_by: "ฝ่ายทะเบียนโรงเรียนสมคิดวิทยา",
      created_at: "2026-05-15T08:30:00.000Z",
    },
    {
      id: "inv-10264",
      guardian_id: "e43427b2-7695-4e9b-bf86-e9bdea4f7f9f",
      guardian_name: "นางฐิติมา ธนโชติกิจพงศ์",
      guardian_phone: "061-552-0560",
      student_id: "10264",
      student_name: "เด็กชายฐิติวัฒน์ ธนโชติกิจพงศ์ (น้องโนอาห์)",
      grade_level: "อ.1/1",
      invite_code: "SV-FAM-10264",
      expires_at: "2026-12-31T23:59:59.000Z",
      used_at: "2026-05-16T09:20:00.000Z",
      created_by: "ฝ่ายทะเบียนโรงเรียนสมคิดวิทยา",
      created_at: "2026-05-15T08:30:00.000Z",
    },
  ];

  const consents: ConsentRecord[] = [
    {
      id: "con-10103-1",
      student_id: "10103",
      guardian_id: guardian.id,
      purpose_code: "PHOTO_INTERNAL",
      purpose_title_th: "การถ่ายภาพกิจกรรมสำหรับรายงานผู้ปกครองภายในระบบโรงเรียน",
      purpose_title_en: "Internal Classroom & Activity Photos",
      purpose_desc_th: "อนุญาตให้ครูประจำชั้นบันทึกภาพกิจกรรมการเรียนรู้เพื่อรายงานผู้ปกครองเฉพาะบุคคล",
      policy_version: "v1.2-2569",
      is_granted: true,
      ip_address: "171.96.42.18",
      signed_at: "2026-05-16T09:15:00.000Z",
    },
    {
      id: "con-10103-2",
      student_id: "10103",
      guardian_id: guardian.id,
      purpose_code: "PHOTO_PUBLIC_PR",
      purpose_title_th: "การเผยแพร่ภาพกิจกรรมนักเรียนบนเว็บไซต์และเพจประชาสัมพันธ์โรงเรียน",
      purpose_title_en: "Public Website & School PR Media Publication",
      purpose_desc_th: "อนุญาตให้นำภาพกิจกรรมสร้างสรรค์ขึ้นประชาสัมพันธ์",
      policy_version: "v1.2-2569",
      is_granted: true,
      ip_address: "171.96.42.18",
      signed_at: "2026-05-16T09:15:00.000Z",
    },
    {
      id: "con-10103-3",
      student_id: "10103",
      guardian_id: guardian.id,
      purpose_code: "FIRST_AID",
      purpose_title_th: "การปฐมพยาบาลเบื้องต้นและการส่งต่อสถานพยาบาลฉุกเฉิน",
      purpose_title_en: "Emergency First Aid & Hospital Referral",
      purpose_desc_th: "อนุญาตให้พยาบาลประจำห้องพยาบาลปฐมพยาบาลเบื้องต้น",
      policy_version: "v1.2-2569",
      is_granted: true,
      ip_address: "171.96.42.18",
      signed_at: "2026-05-16T09:15:00.000Z",
    },
    {
      id: "con-10264-1",
      student_id: "10264",
      guardian_id: guardian.id,
      purpose_code: "PHOTO_INTERNAL",
      purpose_title_th: "การถ่ายภาพกิจกรรมสำหรับรายงานผู้ปกครองภายในระบบโรงเรียน",
      purpose_title_en: "Internal Classroom & Daily Care Activity Photos",
      purpose_desc_th: "อนุญาตให้ครูประจำชั้นบันทึกภาพพัฒนาการและสมุดพกอนุบาล",
      policy_version: "v1.2-2569",
      is_granted: true,
      ip_address: "171.96.42.18",
      signed_at: "2026-05-16T09:15:00.000Z",
    },
  ];

  const attendance_logs: StudentAttendanceLog[] = [
    {
      id: "att-10103-today",
      student_id: "10103",
      student_name: "เด็กหญิงธัญพร อุ่นอบ",
      nickname: "น้องมีฟา",
      grade_level: "ป.3/1",
      attendance_date: todayStr,
      period: "MORNING_HOMEROOM",
      status: "PRESENT",
      check_in_time: "07:38 น.",
      check_out_time: null,
      source: "TEACHER_APP",
      recorded_by: "ครูประจำชั้น ป.3/1",
      notes: "มาถึงโรงเรียนตรงเวลา สดใสร่าเริง",
      created_at: `${todayStr}T00:38:00.000Z`,
      updated_at: `${todayStr}T00:38:00.000Z`,
    },
    {
      id: "att-9775-today",
      student_id: "9775",
      student_name: "เด็กชายชณธร อุ่นอบ",
      nickname: "น้องจั๊มเปอร์",
      grade_level: "ป.6/1",
      attendance_date: todayStr,
      period: "MORNING_HOMEROOM",
      status: "PRESENT",
      check_in_time: "07:42 น.",
      check_out_time: null,
      source: "NFC_GATE",
      recorded_by: "ระบบสแกนบัตรประตูหน้า",
      notes: "แตะบัตรเข้าโรงเรียนตรงเวลา",
      created_at: `${todayStr}T00:42:00.000Z`,
      updated_at: `${todayStr}T00:42:00.000Z`,
    },
    {
      id: "att-10264-today",
      student_id: "10264",
      student_name: "เด็กชายฐิติวัฒน์ ธนโชติกิจพงศ์",
      nickname: "น้องโนอาห์",
      grade_level: "อ.1/1",
      attendance_date: todayStr,
      period: "MORNING_HOMEROOM",
      status: "PRESENT",
      check_in_time: "07:48 น.",
      check_out_time: null,
      source: "TEACHER_APP",
      recorded_by: "ครูนภัสสร ภักคีรี",
      notes: "คุณแม่มาส่งหน้าห้องเรียน ยิ้มแย้มแจ่มใส",
      created_at: `${todayStr}T00:48:00.000Z`,
      updated_at: `${todayStr}T00:48:00.000Z`,
    },
  ];

  const pickup_plans: PickupDailyPlan[] = [
    {
      id: "pk-10103-today",
      student_id: "10103",
      student_name: "เด็กหญิงธัญพร อุ่นอบ",
      nickname: "น้องมีฟา",
      grade_level: "ป.3/1",
      plan_date: todayStr,
      transport_mode: "PARENT_PICKUP",
      collector_name: "นายศักดิ์ชัย อุ่นอบ (คุณพ่อ)",
      collector_relationship: "บิดา",
      collector_phone: "061-552-0560",
      collector_photo_url: null,
      temp_otp_code: null,
      arrival_status: "SCHEDULED",
      arrived_at: null,
      released_at: null,
      released_by_staff: null,
      van_route_name: null,
      van_plate_number: null,
      van_status_text: null,
      notes: "รับที่จุดรับส่งหน้าอาคารประถม เวลา 16:00 น.",
      created_at: `${todayStr}T00:00:00.000Z`,
      updated_at: `${todayStr}T00:00:00.000Z`,
    },
    {
      id: "pk-9775-today",
      student_id: "9775",
      student_name: "เด็กชายชณธร อุ่นอบ",
      nickname: "น้องจั๊มเปอร์",
      grade_level: "ป.6/1",
      plan_date: todayStr,
      transport_mode: "PARENT_PICKUP",
      collector_name: "นายศักดิ์ชัย อุ่นอบ (คุณพ่อ)",
      collector_relationship: "บิดา",
      collector_phone: "061-552-0560",
      collector_photo_url: null,
      temp_otp_code: null,
      arrival_status: "SCHEDULED",
      arrived_at: null,
      released_at: null,
      released_by_staff: null,
      van_route_name: null,
      van_plate_number: null,
      van_status_text: null,
      notes: "รับพร้อมน้องมีฟา เวลา 16:00 น.",
      created_at: `${todayStr}T00:00:00.000Z`,
      updated_at: `${todayStr}T00:00:00.000Z`,
    },
    {
      id: "pk-10264-today",
      student_id: "10264",
      student_name: "เด็กชายฐิติวัฒน์ ธนโชติกิจพงศ์",
      nickname: "น้องโนอาห์",
      grade_level: "อ.1/1",
      plan_date: todayStr,
      transport_mode: "PARENT_PICKUP",
      collector_name: "นางฐิติมา ธนโชติกิจพงศ์ (คุณแม่)",
      collector_relationship: "มารดา",
      collector_phone: "061-552-0560",
      collector_photo_url: null,
      temp_otp_code: null,
      arrival_status: "SCHEDULED",
      arrived_at: null,
      released_at: null,
      released_by_staff: null,
      van_route_name: null,
      van_plate_number: null,
      van_status_text: null,
      notes: "รับที่จุดรับส่งอนุบาล เวลา 15:15 น.",
      created_at: `${todayStr}T00:00:00.000Z`,
      updated_at: `${todayStr}T00:00:00.000Z`,
    },
  ];

  const threads: ParentTeacherThread[] = [
    {
      id: "thd-10103-homeroom",
      student_id: "10103",
      student_name: "เด็กหญิงธัญพร อุ่นอบ (น้องมีฟา)",
      grade_level: "ป.3/1",
      guardian_name: "นายศักดิ์ชัย อุ่นอบ",
      teacher_name: "ครูประจำชั้น ป.3/1",
      channel_type: "HOMEROOM",
      last_message_text: "สวัสดีค่ะคุณพ่อ วันนี้น้องมีฟาตั้งใจเรียนและช่วยเพื่อนในกลุ่มดีมากค่ะ",
      last_message_at: `${todayStr}T07:15:00.000Z`,
      unread_staff_count: 0,
      unread_parent_count: 0,
      office_hours_note: "เวลาทำการตอบกลับ: จันทร์-ศุกร์ 07:30 - 17:00 น.",
      created_at: "2026-05-16T08:00:00.000Z",
      updated_at: `${todayStr}T07:15:00.000Z`,
    },
    {
      id: "thd-10264-homeroom",
      student_id: "10264",
      student_name: "เด็กชายฐิติวัฒน์ ธนโชติกิจพงศ์ (น้องโนอาห์)",
      grade_level: "อ.1/1",
      guardian_name: "นางฐิติมา ธนโชติกิจพงศ์",
      teacher_name: "ครูนภัสสร ภักคีรี",
      channel_type: "HOMEROOM",
      last_message_text: "สวัสดีค่ะคุณแม่ วันนี้น้องโนอาห์ทานอาหารกลางวันหมดถาดและนอนหลับสนิทค่ะ",
      last_message_at: `${todayStr}T07:30:00.000Z`,
      unread_staff_count: 0,
      unread_parent_count: 0,
      office_hours_note: "เวลาทำการตอบกลับ: จันทร์-ศุกร์ 07:30 - 17:00 น.",
      created_at: "2026-05-16T08:00:00.000Z",
      updated_at: `${todayStr}T07:30:00.000Z`,
    },
  ];

  const messages: ParentTeacherMessage[] = [
    {
      id: "msg-10103-1",
      thread_id: "thd-10103-homeroom",
      sender_type: "STAFF",
      sender_name: "ครูประจำชั้น ป.3/1",
      body_th: "สวัสดีค่ะคุณพ่อ วันนี้น้องมีฟาตั้งใจเรียนและช่วยเพื่อนในกลุ่มดีมากค่ะ มีการบ้านคณิตศาสตร์หน้า 24 ส่งวันพรุ่งนี้ค่ะ",
      body_en: "Hello Khun Sakchai, Mifa did great in class today. Math homework p.24 due tomorrow.",
      require_acknowledgement: false,
      acknowledged_at: `${todayStr}T07:15:00.000Z`,
      created_at: `${todayStr}T07:15:00.000Z`,
    },
    {
      id: "msg-10264-1",
      thread_id: "thd-10264-homeroom",
      sender_type: "STAFF",
      sender_name: "ครูนภัสสร ภักคีรี",
      body_th: "สวัสดีค่ะ วันนี้น้องโนอาห์ร่วมกิจกรรมปั้นแป้งโดว์อย่างมีความสุขและร่าเริงมากค่ะ",
      body_en: "Noah was cheerful and really enjoyed the playdough activity today.",
      require_acknowledgement: false,
      acknowledged_at: null,
      created_at: `${todayStr}T07:30:00.000Z`,
    },
  ];

  const fee_invoices: ParentFeeInvoiceItem[] = [
    {
      id: "fee-10103-2569-1",
      student_id: "10103",
      title_th: "ค่าธรรมเนียมการศึกษา ภาคเรียนที่ 1/2569 (ชั้นประถมศึกษาปีที่ 3)",
      title_en: "Primary 3 Tuition & Educational Services (Term 1/2026)",
      term_label: "ภาคเรียนที่ 1/2569",
      amount: 12500,
      due_date: "2026-06-15",
      status: "paid",
      receipt_number: "REC-2569-10103",
      paid_at: "2026-05-12T10:24:00.000Z",
      payment_method: "QR PromptPay",
    },
    {
      id: "fee-9775-2569-1",
      student_id: "9775",
      title_th: "ค่าธรรมเนียมการศึกษา ภาคเรียนที่ 1/2569 (ชั้นประถมศึกษาปีที่ 6)",
      title_en: "Primary 6 Tuition & Educational Services (Term 1/2026)",
      term_label: "ภาคเรียนที่ 1/2569",
      amount: 12500,
      due_date: "2026-06-15",
      status: "paid",
      receipt_number: "REC-2569-09775",
      paid_at: "2026-05-12T10:26:00.000Z",
      payment_method: "QR PromptPay",
    },
  ];

  const free15y_subsidies: Free15YSubsidyItem[] = [
    {
      id: "sub-10103-uniform",
      student_id: "10103",
      academic_year: "2569",
      semester: "1/2569",
      category_th: "ค่าเครื่องแบบนักเรียน ระดับประถมศึกษา (โครงการเรียนฟรี 15 ปี สช.)",
      category_en: "15-Year Free Education Subsidy: Primary Student Uniforms",
      amount: 400,
      parent_signed: true,
      signed_by_name: "นายศักดิ์ชัย อุ่นอบ",
      signed_at: "2026-06-10T09:15:00.000Z",
      receipt_code: "OPEC-15Y-10103-U",
    },
    {
      id: "sub-9775-uniform",
      student_id: "9775",
      academic_year: "2569",
      semester: "1/2569",
      category_th: "ค่าเครื่องแบบนักเรียน ระดับประถมศึกษา (โครงการเรียนฟรี 15 ปี สช.)",
      category_en: "15-Year Free Education Subsidy: Primary Student Uniforms",
      amount: 400,
      parent_signed: true,
      signed_by_name: "นายศักดิ์ชัย อุ่นอบ",
      signed_at: "2026-06-10T09:16:00.000Z",
      receipt_code: "OPEC-15Y-09775-U",
    },
  ];

  const early_years_milestones: DevelopmentalMilestoneItem[] = [
    {
      id: "ms-10264-1",
      student_id: "10264",
      domain: "PHYSICAL",
      domain_th: "พัฒนาการด้านร่างกาย",
      domain_en: "Physical & Motor Development",
      indicator_th: "การทรงตัวและการใช้กล้ามเนื้อมัดเล็ก-มัดใหญ่ในการปฏิบัติกิจกรรม",
      indicator_en: "Gross and fine motor skills coordination",
      rating: 3,
      teacher_comment: "กล้ามเนื้อมือแข็งแรง หยิบจับอุปกรณ์และทรงตัวได้มั่นคงตามวัย",
      evaluated_at: todayStr,
    },
    {
      id: "ms-10264-2",
      student_id: "10264",
      domain: "EMOTIONAL_SOCIAL",
      domain_th: "พัฒนาการด้านอารมณ์ จิตใจ และสังคม",
      domain_en: "Emotional & Social Development",
      indicator_th: "การปฏิบัติตามข้อตกลงร่วมกันและการแบ่งปันของเล่นกับเพื่อน",
      indicator_en: "Social interaction and sharing with peers",
      rating: 3,
      teacher_comment: "มีน้ำใจ ปรับตัวเข้ากับกลุ่มเพื่อนได้ดีและแสดงออกอย่างเหมาะสม",
      evaluated_at: todayStr,
    },
  ];

  const primary_grades: Record<string, SubjectGradeSummaryItem[]> = {
    "10103": [
      {
        subject_code: "ท13101",
        subject_name_th: "ภาษาไทยพื้นฐาน",
        subject_name_en: "Fundamental Thai Language",
        teacher_name: "ครูประจำชั้น ป.3/1",
        accumulated_score: 46,
        max_accumulated: 50,
        midterm_score: 18,
        max_midterm: 20,
        final_score: 27,
        max_final: 30,
        total_score: 91,
        grade_label: "4.0",
      },
      {
        subject_code: "ค13101",
        subject_name_th: "คณิตศาสตร์พื้นฐาน",
        subject_name_en: "Fundamental Mathematics",
        teacher_name: "ครูประจำชั้น ป.3/1",
        accumulated_score: 44,
        max_accumulated: 50,
        midterm_score: 17,
        max_midterm: 20,
        final_score: 26,
        max_final: 30,
        total_score: 87,
        grade_label: "4.0",
      },
    ],
  };

  return {
    version: 2,
    guardian,
    children,
    links,
    invitations,
    consents,
    attendance_logs,
    leave_requests: [],
    pickup_plans,
    early_years_care: [],
    dropoff_notes: [],
    medication_requests: [],
    incidents: [],
    assignments: [],
    threads,
    messages,
    domain_events: [],
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
  if (typeof window === "undefined") {
    if (!serverMemoryState) {
      serverMemoryState = createInitialPipelineState();
    }
    return serverMemoryState;
  }

  // Trigger background sync to load all 151 students from Supabase
  initRealClientPipelineSync();

  try {
    if (window.localStorage.getItem("sv_bidirectional_pipeline_v1")) {
      window.localStorage.removeItem("sv_bidirectional_pipeline_v1");
    }

    const raw = window.localStorage.getItem(PIPELINE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as BidirectionalPipelineState;
      const hasMock = parsed?.children?.some((c) => c.id === "67012" || c.id === "64008");
      if (parsed && parsed.version === 2 && Array.isArray(parsed.children) && !hasMock) {
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
  if (typeof window !== "undefined") {
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
  event: Omit<SystemDomainEvent, "id" | "created_at">
): void {
  const newEvt: SystemDomainEvent = {
    ...event,
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    created_at: new Date().toISOString(),
  };
  state.domain_events = [newEvt, ...(state.domain_events || [])].slice(0, 50);
}

// ----------------------------------------------------------------------------
// Bidirectional Mutation Actions (Parent <-> Staff Portal)
// ----------------------------------------------------------------------------

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
    grade_level: child?.grade || "-",
    guardian_id: state.guardian.id,
    guardian_name: state.guardian.full_name,
    leave_type: input.leave_type,
    start_date: input.start_date,
    end_date: input.end_date,
    reason: input.reason,
    attachment_url: null,
    status: "PENDING",
    reviewed_by: null,
    reviewed_at: null,
    review_note: null,
    created_at: nowIso,
    updated_at: nowIso,
  };

  state.leave_requests = [newReq, ...(state.leave_requests || [])];

  const typeLabel =
    input.leave_type === "SICK_LEAVE"
      ? "ลาป่วย"
      : input.leave_type === "PERSONAL_LEAVE"
      ? "ลากิจ"
      : "ขอรับกลับก่อนเวลา";

  prependDomainEvent(state, {
    event_type: "LEAVE_SUBMITTED",
    student_id: input.student_id,
    student_name: newReq.student_name,
    severity: "HIGH",
    title_th: `ผู้ปกครองส่งใบ${typeLabel}ออนไลน์ (${newReq.student_name})`,
    title_en: `Parent Submitted ${input.leave_type} Request`,
    body_th: `วันที่ ${input.start_date} ถึง ${input.end_date}: ${input.reason}`,
    body_en: `Date ${input.start_date} to ${input.end_date}: ${input.reason}`,
    actor_role: "PARENT",
    actor_name: state.guardian.full_name,
  });

  savePipelineState(state);
  syncToBackend("SUBMIT_LEAVE", newReq);
  return newReq;
}

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
    review_note: input.review_note || (input.status === "APPROVED" ? "อนุมัติใบลาและซิงค์เข้าสมุดเช็กชื่อเรียบร้อย" : "ไม่อนุมัติ"),
    updated_at: nowIso,
  };
  state.leave_requests[idx] = updated;

  if (input.status === "APPROVED") {
    const attIdx = state.attendance_logs.findIndex((a) => a.student_id === updated.student_id);
    const mappedStatus: AttendanceStatus =
      updated.leave_type === "SICK_LEAVE"
        ? "SICK_LEAVE"
        : updated.leave_type === "EARLY_PICKUP"
        ? "EARLY_PICKUP"
        : "PERSONAL_LEAVE";

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
    event_type: "LEAVE_REVIEWED",
    student_id: updated.student_id,
    student_name: updated.student_name,
    severity: "NORMAL",
    title_th: `ครูประจำชั้น${input.status === "APPROVED" ? "อนุมัติ" : "ปฏิเสธ"}ใบลาของ ${updated.student_name}`,
    title_en: `Leave Request ${input.status} by Homeroom Teacher`,
    body_th: updated.review_note || "",
    body_en: updated.review_note || "",
    actor_role: "STAFF",
    actor_name: input.reviewed_by,
  });

  savePipelineState(state);
  syncToBackend("REVIEW_LEAVE", {
    request_id: input.leave_id,
    status: input.status,
    review_note: input.review_note,
    reviewed_by: input.reviewed_by,
  });
  return updated;
}

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
  actor_role?: "PARENT" | "STAFF";
  actor_name?: string;
}): PickupDailyPlan | null {
  const state = getPipelineState();
  const todayStr = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();
  let idx = state.pickup_plans.findIndex((p) => p.student_id === input.student_id);

  if (idx === -1) {
    const child = state.children.find((c) => c.id === input.student_id);
    const newPlan: PickupDailyPlan = {
      id: `pk-${input.student_id}-${todayStr}`,
      student_id: input.student_id,
      student_name: child?.full_name || input.student_id,
      nickname: child?.nickname || "",
      grade_level: child?.grade || "",
      plan_date: todayStr,
      transport_mode: input.transport_mode || "PARENT_PICKUP",
      collector_name: input.collector_name || state.guardian.full_name,
      collector_relationship: input.collector_relationship || "ผู้ปกครอง",
      collector_phone: input.collector_phone || state.guardian.phone_number,
      collector_photo_url: null,
      temp_otp_code: input.temp_otp_code || null,
      arrival_status: input.arrival_status || "SCHEDULED",
      arrived_at: input.arrival_status === "ARRIVED_AT_GATE" ? new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) + " น." : null,
      released_at: input.arrival_status === "RELEASED" ? new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) + " น." : null,
      released_by_staff: input.released_by_staff || null,
      van_route_name: null,
      van_plate_number: null,
      van_status_text: null,
      notes: input.notes || "",
      created_at: nowIso,
      updated_at: nowIso,
    };
    state.pickup_plans.push(newPlan);
    idx = state.pickup_plans.length - 1;
  }

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
      nextStatus === "ARRIVED_AT_GATE"
        ? new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) + " น."
        : current.arrived_at,
    released_at:
      nextStatus === "RELEASED"
        ? new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) + " น."
        : current.released_at,
    released_by_staff: input.released_by_staff ?? current.released_by_staff,
    notes: input.notes ?? current.notes,
    updated_at: nowIso,
  };

  state.pickup_plans[idx] = updated;

  const statusTextMap: Record<PickupArrivalStatus, string> = {
    SCHEDULED: "ตั้งค่าแผนการรับกลับ",
    ARRIVING_SOON: "ผู้ปกครองกำลังเดินทางใกล้ถึงโรงเรียน (อีก 5 นาที)",
    ARRIVED_AT_GATE: "ผู้ปกครองถึงจุดรอรับหน้าประตูโรงเรียนแล้ว",
    RELEASED: `ส่งมอบนักเรียนให้ ${updated.collector_name} เรียบร้อยแล้ว`,
  };

  prependDomainEvent(state, {
    event_type: `PICKUP_${nextStatus}`,
    student_id: updated.student_id,
    student_name: `${updated.student_name} (${updated.nickname})`,
    severity: nextStatus === "ARRIVED_AT_GATE" || nextStatus === "RELEASED" ? "HIGH" : "NORMAL",
    title_th: `จุดรับ-ส่งนักเรียน: ${statusTextMap[nextStatus]}`,
    title_en: `Pickup Queue Update: ${nextStatus}`,
    body_th: `${updated.student_name} (${updated.grade_level}) • ผู้รับ: ${updated.collector_name}`,
    body_en: `${updated.student_name} (${updated.grade_level}) • Collector: ${updated.collector_name}`,
    actor_role: input.actor_role || "PARENT",
    actor_name: input.actor_name || state.guardian.full_name,
  });

  savePipelineState(state);
  syncToBackend("UPDATE_PICKUP_PLAN", updated);
  return updated;
}

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
    grade_level: child?.grade || "อ.1/1",
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
    state.dropoff_notes = [note, ...(state.dropoff_notes || [])];
  }

  prependDomainEvent(state, {
    event_type: "EARLY_YEARS_DROPOFF_NOTE",
    student_id: input.student_id,
    student_name: note.student_name,
    severity: "NORMAL",
    title_th: `ผู้ปกครองส่งบันทึกส่งน้องตอนเช้า (${note.student_name})`,
    title_en: "Morning Drop-off Note Submitted",
    body_th: `นอน ${input.sleep_hours} ชม. • อาหารเช้า: ${input.ate_breakfast ? "ทานแล้ว" : "ยังไม่ได้ทาน"} • หมายเหตุ: ${input.special_note || "-"}`,
    body_en: `Sleep ${input.sleep_hours}h • Breakfast: ${input.ate_breakfast ? "Yes" : "No"}`,
    actor_role: "PARENT",
    actor_name: state.guardian.full_name,
  });

  savePipelineState(state);
  syncToBackend("SUBMIT_DROPOFF_NOTE", note);
  return note;
}

export function saveEarlyYearsDailyCare(
  updatedRecord: Partial<EarlyYearsDailyCare> & { student_id: string }
): EarlyYearsDailyCare | null {
  const state = getPipelineState();
  const todayStr = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();
  let idx = state.early_years_care.findIndex((c) => c.student_id === updatedRecord.student_id);

  if (idx === -1) {
    const child = state.children.find((c) => c.id === updatedRecord.student_id);
    const newCare: EarlyYearsDailyCare = {
      id: `eyc-${updatedRecord.student_id}-${todayStr}`,
      student_name: child?.full_name || updatedRecord.student_id,
      nickname: child?.nickname || "",
      class_id: child?.classroom || "1",
      care_date: todayStr,
      morning_mood: updatedRecord.morning_mood || "CHEERFUL",
      breakfast_status: updatedRecord.breakfast_status || "ALL",
      lunch_status: updatedRecord.lunch_status || "ALL",
      milk_morning: updatedRecord.milk_morning || "ALL",
      milk_afternoon: updatedRecord.milk_afternoon || "ALL",
      nap_start: updatedRecord.nap_start || "12:30",
      nap_end: updatedRecord.nap_end || "14:15",
      nap_quality: updatedRecord.nap_quality || "SOUND",
      toilet_count: updatedRecord.toilet_count ?? 2,
      diaper_count: updatedRecord.diaper_count ?? 0,
      toilet_note: updatedRecord.toilet_note || null,
      temperature_c: updatedRecord.temperature_c ?? 36.5,
      learning_activity: updatedRecord.learning_activity || "กิจกรรมเสริมประสบการณ์และการเรียนรู้ตามวัย",
      home_suggestion: updatedRecord.home_suggestion || "ชวนน้องพูดคุยทบทวนกิจกรรมประจำวัน",
      teacher_note: updatedRecord.teacher_note || "น้องร่วมกิจกรรมอย่างมีความสุข",
      photo_urls: updatedRecord.photo_urls || [],
      is_published: true,
      published_at: nowIso,
      created_at: nowIso,
      updated_at: nowIso,
      ...updatedRecord,
    };
    state.early_years_care.push(newCare);
    idx = state.early_years_care.length - 1;
  }

  const next: EarlyYearsDailyCare = {
    ...state.early_years_care[idx],
    ...updatedRecord,
    is_published: true,
    published_at: nowIso,
    updated_at: nowIso,
  };

  state.early_years_care[idx] = next;

  prependDomainEvent(state, {
    event_type: "DAILY_CARE_PUBLISHED",
    student_id: next.student_id,
    student_name: `${next.student_name} (${next.nickname})`,
    severity: "NORMAL",
    title_th: `ครูประจำชั้นบันทึกสมุดพกอนุบาลประจำวัน (${next.nickname})`,
    title_en: `Early Years Daily Care Updated (${next.nickname})`,
    body_th: `มื้อเที่ยง: ${next.lunch_status} • นอนกลางวัน: ${next.nap_start}-${next.nap_end} • ${next.teacher_note}`,
    body_en: `Lunch: ${next.lunch_status} • Nap: ${next.nap_start}-${next.nap_end}`,
    actor_role: "STAFF",
    actor_name: "ครูนภัสสร ภักคีรี",
  });

  savePipelineState(state);
  syncToBackend("SAVE_DAILY_CARE", next);
  return next;
}

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
    grade_level: child?.grade || "-",
    guardian_name: state.guardian.full_name,
    medication_name: input.medication_name,
    dosage: input.dosage,
    schedule_times: input.schedule_times,
    meal_timing: input.meal_timing,
    start_date: input.start_date,
    end_date: input.end_date,
    reason: input.reason,
    signature_data_url: `SIGNED_BY_${state.guardian.full_name}`,
    status: "ACTIVE",
    last_administered_at: null,
    last_administered_by: null,
    nurse_note: null,
    created_at: nowIso,
    updated_at: nowIso,
  };

  state.medication_requests = [med, ...(state.medication_requests || [])];

  prependDomainEvent(state, {
    event_type: "MEDICATION_REQUESTED",
    student_id: input.student_id,
    student_name: med.student_name,
    severity: "HIGH",
    title_th: `ผู้ปกครองส่งคำร้องฝากป้อนยา (${med.student_name})`,
    title_en: "Parent Submitted Medication Administration Request",
    body_th: `ยา: ${input.medication_name} (${input.dosage}) เวลา ${input.schedule_times.join(", ")}`,
    body_en: `Medication: ${input.medication_name} (${input.dosage})`,
    actor_role: "PARENT",
    actor_name: state.guardian.full_name,
  });

  savePipelineState(state);
  syncToBackend("SUBMIT_MEDICATION", med);
  return med;
}

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
    status: "ADMINISTERED_TODAY",
    last_administered_at: nowIso,
    last_administered_by: input.administered_by,
    nurse_note: input.nurse_note,
    updated_at: nowIso,
  };

  state.medication_requests[idx] = updated;

  prependDomainEvent(state, {
    event_type: "MEDICATION_ADMINISTERED",
    student_id: updated.student_id,
    student_name: updated.student_name,
    severity: "HIGH",
    title_th: `ห้องพยาบาลป้อนยา ${updated.medication_name} เรียบร้อยแล้ว`,
    title_en: "Medication Administered by School Nurse",
    body_th: `${updated.student_name}: ${input.nurse_note}`,
    body_en: `${updated.student_name}: ${input.nurse_note}`,
    actor_role: "STAFF",
    actor_name: input.administered_by,
  });

  savePipelineState(state);
  syncToBackend("ADMINISTER_MEDICATION", {
    request_id: input.medication_id,
    nurse_name: input.administered_by,
    nurse_note: input.nurse_note,
  });
  return updated;
}

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
    event_type: "INCIDENT_ACKNOWLEDGED",
    student_id: updated.student_id,
    student_name: updated.student_name,
    severity: "NORMAL",
    title_th: `ผู้ปกครองลงนามรับทราบรายงานการปฐมพยาบาล (${updated.student_name})`,
    title_en: "Parent Acknowledged Infirmary Incident Report",
    body_th: `รับทราบโดย ${state.guardian.full_name}`,
    body_en: `Acknowledged by ${state.guardian.full_name}`,
    actor_role: "PARENT",
    actor_name: state.guardian.full_name,
  });

  savePipelineState(state);
  return updated;
}

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
    event_type: "FREE15Y_SUBSIDY_SIGNED",
    student_id: updated.student_id,
    student_name: child ? `${child.full_name} (${child.nickname})` : updated.student_id,
    severity: "NORMAL",
    title_th: `ผู้ปกครองลงนามรับเงินอุดหนุนเรียนฟรี 15 ปี (${updated.category_th})`,
    title_en: "Parent Signed 15-Year Free Education Subsidy Receipt",
    body_th: `รหัสใบสำคัญ ${updated.receipt_code} จำนวน ${updated.amount.toLocaleString()} บาท`,
    body_en: `Receipt ${updated.receipt_code} for ${updated.amount.toLocaleString()} THB`,
    actor_role: "PARENT",
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
    event_type: "WALLET_TOPUP",
    student_id: studentId,
    student_name: `${updated.full_name} (${updated.nickname})`,
    severity: "NORMAL",
    title_th: `ผู้ปกครองเติมเงินกระเป๋าเงินดิจิทัล +${amount.toLocaleString()} บาท`,
    title_en: `Parent Topped Up Student Wallet +${amount.toLocaleString()} THB`,
    body_th: `ยอดคงเหลือใหม่ของ ${updated.nickname}: ${updated.wallet_balance.toLocaleString()} บาท`,
    body_en: `New balance for ${updated.nickname}: ${updated.wallet_balance.toLocaleString()} THB`,
    actor_role: "PARENT",
    actor_name: state.guardian.full_name,
  });

  savePipelineState(state);
  syncToBackend("TOPUP_WALLET", { student_id: studentId, amount, payment_method: "PROMPTPAY" });
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
    status: "paid",
    receipt_number: receiptNo,
    paid_at: nowIso,
    payment_method: "QR PromptPay (Parents Portal)",
  };
  state.fee_invoices[idx] = updated;

  const child = state.children.find((c) => c.id === updated.student_id);
  prependDomainEvent(state, {
    event_type: "TUITION_PAID",
    student_id: updated.student_id,
    student_name: child ? `${child.full_name} (${child.nickname})` : updated.student_id,
    severity: "HIGH",
    title_th: `ชำระค่าธรรมเนียมการศึกษาสำเร็จ (${receiptNo})`,
    title_en: `Tuition Fee Paid (${receiptNo})`,
    body_th: `${updated.title_th} ยอด ${updated.amount.toLocaleString()} บาท`,
    body_en: `${updated.title_en} (${updated.amount.toLocaleString()} THB)`,
    actor_role: "PARENT",
    actor_name: state.guardian.full_name,
  });

  savePipelineState(state);
  return updated;
}

export function sendParentTeacherMessage(input: {
  thread_id: string;
  sender_type: "PARENT" | "STAFF";
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

  state.messages = [...(state.messages || []), msg];
  state.threads[thdIdx] = {
    ...thread,
    last_message_text: input.body_th,
    last_message_at: nowIso,
    unread_staff_count: input.sender_type === "PARENT" ? thread.unread_staff_count + 1 : 0,
    unread_parent_count: input.sender_type === "STAFF" ? thread.unread_parent_count + 1 : 0,
    updated_at: nowIso,
  };

  prependDomainEvent(state, {
    event_type: "MESSAGE_SENT",
    student_id: thread.student_id,
    student_name: thread.student_name,
    severity: "NORMAL",
    title_th:
      input.sender_type === "PARENT"
        ? `ข้อความใหม่จากผู้ปกครอง (${thread.student_name})`
        : `ข้อความใหม่จากครูประจำชั้น (${thread.teacher_name})`,
    title_en: `New Chat Message (${thread.student_name})`,
    body_th: input.body_th,
    body_en: input.body_th,
    actor_role: input.sender_type,
    actor_name: input.sender_name,
  });

  savePipelineState(state);
  syncToBackend("SEND_MESSAGE", {
    thread_id: input.thread_id,
    sender_type: input.sender_type,
    sender_name: input.sender_name,
    body_th: input.body_th,
    body_en: input.body_th,
    require_acknowledgement: input.require_acknowledgement,
  });
  return msg;
}

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
    event_type: isGranted ? "CONSENT_GRANTED" : "CONSENT_REVOKED",
    student_id: studentId,
    student_name: child ? `${child.full_name} (${child.nickname})` : studentId,
    severity: isGranted ? "NORMAL" : "HIGH",
    title_th: `ผู้ปกครอง${isGranted ? "อนุญาต" : "ถอนความยินยอม"} PDPA: ${updated.purpose_title_th}`,
    title_en: `Parent ${isGranted ? "Granted" : "Revoked"} PDPA Consent: ${purposeCode}`,
    body_th: `เวอร์ชันนโยบาย ${updated.policy_version} • มีผลทันทีในระบบกรองรูปภาพและกิจกรรมโรงเรียน`,
    body_en: `Policy ${updated.policy_version} updated immediately.`,
    actor_role: "PARENT",
    actor_name: state.guardian.full_name,
  });

  savePipelineState(state);
  syncToBackend("TOGGLE_CONSENT", {
    student_id: studentId,
    purpose_code: purposeCode,
    is_granted: isGranted,
  });
  return updated;
}

export function updateGuardianLinkPermissions(
  linkId: string,
  patch: Partial<GuardianStudentLink>,
  staffName: string = "ฝ่ายทะเบียนโรงเรียนสมคิดวิทยา"
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
    event_type: "GUARDIAN_PERMISSION_UPDATED",
    student_id: updated.student_id,
    severity: updated.has_legal_restriction ? "CRITICAL" : "NORMAL",
    title_th: `อัปเดตสิทธิ์ผู้ปกครองรหัสนักเรียน ${updated.student_id}`,
    title_en: `Updated Guardian Access Matrix for Student ${updated.student_id}`,
    body_th: updated.has_legal_restriction
      ? `เปิดใช้งานคำสั่งระงับสิทธิ์ตามกฎหมาย: ${updated.restriction_note || "-"}`
      : "ปรับปรุงสิทธิ์ 10 ด้านของผู้ปกครองเรียบร้อยแล้ว",
    body_en: `Guardian permissions updated by ${staffName}`,
    actor_role: "STAFF",
    actor_name: staffName,
  });

  savePipelineState(state);
  return updated;
}

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
    expires_at: "2026-12-31T23:59:59.000Z",
    used_at: null,
    created_by: "ฝ่ายทะเบียนโรงเรียนสมคิดวิทยา",
    created_at: nowIso,
  };

  state.invitations = [inv, ...(state.invitations || [])];
  savePipelineState(state);
  return inv;
}

export function recordStudentAttendance(input: {
  student_id: string;
  status: AttendanceStatus;
  check_in_time?: string | null;
  check_out_time?: string | null;
  source?: "NFC_GATE" | "TEACHER_APP" | "VAN_SYNC" | "DISMISSAL_KIOSK";
  recorded_by?: string;
  notes?: string;
}): StudentAttendanceLog | null {
  const state = getPipelineState();
  const todayStr = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();
  let idx = state.attendance_logs.findIndex((a) => a.student_id === input.student_id);
  const timeStr =
    input.check_in_time !== undefined
      ? input.check_in_time
      : new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

  if (idx === -1) {
    const child = state.children.find((c) => c.id === input.student_id);
    const newLog: StudentAttendanceLog = {
      id: `att-${input.student_id}-${todayStr}`,
      student_id: input.student_id,
      student_name: child?.full_name || input.student_id,
      nickname: child?.nickname || "",
      grade_level: child?.grade || "",
      attendance_date: todayStr,
      period: "MORNING_HOMEROOM",
      status: input.status,
      check_in_time:
        input.status === "PRESENT" || input.status === "LATE"
          ? timeStr || "07:45"
          : null,
      check_out_time: input.check_out_time || null,
      source: input.source || "TEACHER_APP",
      recorded_by: input.recorded_by || "ระบบเช็กชื่อโรงเรียนสมคิดวิทยา",
      notes: input.notes || null,
      created_at: nowIso,
      updated_at: nowIso,
    };
    state.attendance_logs.push(newLog);
    idx = state.attendance_logs.length - 1;
  }

  const updated: StudentAttendanceLog = {
    ...state.attendance_logs[idx],
    status: input.status,
    check_in_time:
      input.status === "PRESENT" || input.status === "LATE"
        ? timeStr || state.attendance_logs[idx].check_in_time || "07:45"
        : null,
    check_out_time: input.check_out_time ?? state.attendance_logs[idx].check_out_time,
    source: input.source || state.attendance_logs[idx].source,
    recorded_by: input.recorded_by || state.attendance_logs[idx].recorded_by,
    notes: input.notes !== undefined ? input.notes : state.attendance_logs[idx].notes,
    updated_at: nowIso,
  };
  state.attendance_logs[idx] = updated;

  prependDomainEvent(state, {
    event_type: "ATTENDANCE_UPDATED",
    student_id: updated.student_id,
    student_name: `${updated.student_name} (${updated.nickname})`,
    severity: input.status === "ABSENT" ? "CRITICAL" : "NORMAL",
    title_th: `อัปเดตสถานะการมาเรียน: ${updated.student_name} (${input.status})`,
    title_en: `Attendance Updated: ${updated.student_name} (${input.status})`,
    body_th: `เวลา: ${updated.check_in_time || "-"} • ช่องทาง: ${updated.source}`,
    body_en: `Time: ${updated.check_in_time || "-"} • Source: ${updated.source}`,
    actor_role: "STAFF",
    actor_name: input.recorded_by || "ระบบเช็กชื่อโรงเรียนสมคิดวิทยา",
  });

  savePipelineState(state);
  syncToBackend("RECORD_ATTENDANCE", {
    student_id: input.student_id,
    status: input.status,
    period: "MORNING_HOMEROOM",
    source: input.source,
    recorded_by: input.recorded_by,
  });
  return updated;
}

export function acknowledgeEarlyYearsDropoffNote(
  noteId: string,
  teacherName: string = "ครูนภัสสร ภักคีรี"
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
    event_type: "DROPOFF_NOTE_ACKNOWLEDGED",
    student_id: updated.student_id,
    student_name: updated.student_name,
    severity: "NORMAL",
    title_th: `ครูประจำชั้นรับทราบบันทึกส่งน้องตอนเช้า (${updated.student_name})`,
    title_en: "Homeroom Teacher Acknowledged Morning Drop-off Note",
    body_th: `รับทราบโดย ${teacherName}`,
    body_en: `Acknowledged by ${teacherName}`,
    actor_role: "STAFF",
    actor_name: teacherName,
  });

  savePipelineState(state);
  syncToBackend("ACKNOWLEDGE_DROPOFF_NOTE", {
    note_id: noteId,
    teacher_name: teacherName,
  });
  return updated;
}

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
  submission_status?: "SUBMITTED" | "PENDING" | "LATE" | "NEEDS_REVISION";
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
    submission_status: input.submission_status || "PENDING",
    score: input.score ?? null,
    teacher_feedback: input.teacher_feedback ?? null,
    updated_at: nowIso,
  };

  if (existingIdx >= 0) {
    state.assignments[existingIdx] = item;
  } else {
    state.assignments = [item, ...(state.assignments || [])];
  }

  prependDomainEvent(state, {
    event_type: "ASSIGNMENT_UPDATED",
    student_id: item.student_id,
    severity: "NORMAL",
    title_th: `อัปเดตการบ้าน/ชิ้นงานวิชา ${item.subject_name}`,
    title_en: `Assignment Updated: ${item.subject_name}`,
    body_th: `${item.title_th} (กำหนดส่ง ${item.due_date})`,
    body_en: `${item.title_en} (Due ${item.due_date})`,
    actor_role: "STAFF",
    actor_name: item.assigned_by,
  });

  savePipelineState(state);
  return item;
}

// ============================================================================
// Parent Client Session Management (LocalStorage & Sync)
// ============================================================================

export const PARENT_SESSION_STORAGE_KEY = 'sv_parent_client_session_v1';

export interface ParentClientSession {
  authenticated: boolean;
  guardian: {
    id: string;
    prefix: string;
    first_name: string;
    last_name: string;
    full_name: string;
    citizen_id?: string | null;
    phone_number?: string | null;
    email?: string | null;
  } | null;
  children: Array<{
    id: string;
    name: string;
    first_name: string;
    last_name: string;
    prefix: string;
    grade: string;
    classroom: string;
    relationship: string;
    wallet_balance: number;
  }>;
}

export function getParentClientSession(): ParentClientSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PARENT_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.authenticated && parsed.guardian) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

export function setParentClientSession(session: ParentClientSession): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PARENT_SESSION_STORAGE_KEY, JSON.stringify(session));
    window.dispatchEvent(new Event('sv_parent_session_change'));
  } catch {
    // ignore
  }
}

export function clearParentClientSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PARENT_SESSION_STORAGE_KEY);
    window.dispatchEvent(new Event('sv_parent_session_change'));
  } catch {
    // ignore
  }
}

