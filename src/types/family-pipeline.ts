// ============================================================================
// Somkidvittaya School (SV-Portal & Parents Portal)
// Phase 19: Family Master Schema & Bidirectional Operational Pipeline Types
// ============================================================================

export type GuardianRoleType =
  | 'PRIMARY'
  | 'SECONDARY'
  | 'FINANCE_ONLY'
  | 'PICKUP_ONLY'
  | 'EMERGENCY_ONLY';

export type GuardianRelationship =
  | 'บิดา'
  | 'มารดา'
  | 'ปู่/ย่า/ตา/ยาย'
  | 'ลุง/ป้า/น้า/อา'
  | 'ผู้ปกครองตามกฎหมาย'
  | 'ผู้รับมอบอำนาจรับ-ส่ง';

export type PreferredLanguage = 'th' | 'en' | 'zh' | 'my';

export interface GuardianPermissionFlags {
  is_legal_guardian: boolean;
  can_view_daily: boolean;
  can_view_academic: boolean;
  can_view_health: boolean;
  can_view_finance: boolean;
  can_pay: boolean;
  can_message_teacher: boolean;
  can_pickup: boolean;
  can_manage_pickup: boolean;
  can_give_consent: boolean;
  receives_emergency_alert: boolean;
}

export interface GuardianProfile {
  id: string;
  citizen_id?: string | null;
  prefix: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone_number: string;
  email?: string | null;
  line_user_id?: string | null;
  occupation?: string | null;
  annual_income?: number | null;
  photo_url?: string | null;
  preferred_lang: PreferredLanguage;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GuardianStudentLink extends GuardianPermissionFlags {
  id: string;
  guardian_id: string;
  student_id: string;
  relationship: GuardianRelationship;
  role_type: GuardianRoleType;
  has_legal_restriction: boolean;
  restriction_note?: string | null;
  valid_from: string;
  valid_until?: string | null;
  created_at: string;
  updated_at: string;
}

export interface GuardianInvitation {
  id: string;
  guardian_id: string;
  guardian_name: string;
  guardian_phone: string;
  student_id: string;
  student_name: string;
  grade_level: string;
  invite_code: string;
  expires_at: string;
  used_at?: string | null;
  created_by?: string | null;
  created_at: string;
}

export type ConsentPurposeCode =
  | 'PHOTO_INTERNAL'
  | 'PHOTO_PUBLIC_PR'
  | 'FIELD_TRIP'
  | 'FIRST_AID'
  | 'AI_TRANSLATE'
  | 'DATA_PROCESSING';

export interface ConsentRecord {
  id: string;
  student_id: string;
  guardian_id?: string | null;
  purpose_code: ConsentPurposeCode;
  purpose_title_th: string;
  purpose_title_en: string;
  purpose_desc_th: string;
  policy_version: string;
  is_granted: boolean;
  ip_address?: string | null;
  signed_at: string;
  revoked_at?: string | null;
}

export type AttendanceStatus =
  | 'PRESENT'
  | 'LATE'
  | 'ABSENT'
  | 'SICK_LEAVE'
  | 'PERSONAL_LEAVE'
  | 'EARLY_PICKUP';

export type AttendanceSource =
  | 'NFC_GATE'
  | 'TEACHER_APP'
  | 'VAN_SYNC'
  | 'DISMISSAL_KIOSK';

export interface StudentAttendanceLog {
  id: string;
  student_id: string;
  student_name: string;
  nickname: string;
  grade_level: string;
  attendance_date: string;
  period: string;
  status: AttendanceStatus;
  check_in_time?: string | null;
  check_out_time?: string | null;
  source: AttendanceSource;
  recorded_by?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type LeaveRequestType = 'SICK_LEAVE' | 'PERSONAL_LEAVE' | 'EARLY_PICKUP';
export type LeaveRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface StudentLeaveRequest {
  id: string;
  student_id: string;
  student_name: string;
  grade_level: string;
  guardian_id?: string | null;
  guardian_name: string;
  leave_type: LeaveRequestType;
  start_date: string;
  end_date: string;
  reason: string;
  attachment_url?: string | null;
  status: LeaveRequestStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_note?: string | null;
  created_at: string;
  updated_at: string;
}

export type TransportMode =
  | 'SCHOOL_VAN'
  | 'PARENT_PICKUP'
  | 'AFTER_SCHOOL'
  | 'WALK_HOME';

export type PickupArrivalStatus =
  | 'SCHEDULED'
  | 'ARRIVING_SOON'
  | 'ARRIVED_AT_GATE'
  | 'RELEASED';

export interface PickupDailyPlan {
  id: string;
  student_id: string;
  student_name: string;
  nickname: string;
  grade_level: string;
  plan_date: string;
  transport_mode: TransportMode;
  collector_name: string;
  collector_relationship: string;
  collector_phone?: string | null;
  collector_photo_url?: string | null;
  temp_otp_code?: string | null;
  arrival_status: PickupArrivalStatus;
  arrived_at?: string | null;
  released_at?: string | null;
  released_by_staff?: string | null;
  van_route_name?: string | null;
  van_plate_number?: string | null;
  van_status_text?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type EarlyYearsMood = 'CHEERFUL' | 'CALM' | 'TIRED' | 'CLINGY' | 'UNWELL';
export type MealConsumptionStatus = 'ALL' | 'HALF' | 'LITTLE' | 'NONE';
export type MilkConsumptionStatus = 'ALL' | 'HALF' | 'NONE';
export type NapQualityStatus = 'SOUND' | 'RESTLESS' | 'NO_NAP';

export interface EarlyYearsDailyCare {
  id: string;
  student_id: string;
  student_name: string;
  nickname: string;
  class_id: string;
  care_date: string;
  morning_mood: EarlyYearsMood;
  breakfast_status: MealConsumptionStatus;
  lunch_status: MealConsumptionStatus;
  milk_morning: MilkConsumptionStatus;
  milk_afternoon: MilkConsumptionStatus;
  nap_start: string;
  nap_end: string;
  nap_quality: NapQualityStatus;
  toilet_count: number;
  diaper_count: number;
  toilet_note?: string | null;
  temperature_c: number;
  learning_activity: string;
  home_suggestion: string;
  teacher_note: string;
  photo_urls: string[];
  is_published: boolean;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EarlyYearsDropoffNote {
  id: string;
  student_id: string;
  student_name: string;
  grade_level: string;
  note_date: string;
  guardian_name: string;
  sleep_hours: number;
  ate_breakfast: boolean;
  morning_mood: string;
  medication_today: boolean;
  pickup_person_today: string;
  special_note: string;
  acknowledged_by_teacher?: string | null;
  acknowledged_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type MedicationMealTiming =
  | 'BEFORE_MEAL'
  | 'AFTER_MEAL'
  | 'WITH_MEAL'
  | 'AS_NEEDED';

export type MedicationStatus =
  | 'ACTIVE'
  | 'ADMINISTERED_TODAY'
  | 'COMPLETED'
  | 'CANCELLED';

export interface MedicationRequest {
  id: string;
  student_id: string;
  student_name: string;
  grade_level: string;
  guardian_name: string;
  medication_name: string;
  dosage: string;
  schedule_times: string[];
  meal_timing: MedicationMealTiming;
  start_date: string;
  end_date: string;
  reason: string;
  signature_data_url?: string | null;
  status: MedicationStatus;
  last_administered_at?: string | null;
  last_administered_by?: string | null;
  nurse_note?: string | null;
  created_at: string;
  updated_at: string;
}

export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface StudentIncident {
  id: string;
  student_id: string;
  student_name: string;
  grade_level: string;
  incident_date: string;
  incident_time: string;
  location: string;
  severity: IncidentSeverity;
  description: string;
  first_aid_given: string;
  hospital_referred: boolean;
  reported_by: string;
  parent_acknowledged: boolean;
  parent_acknowledged_at?: string | null;
  acknowledged_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export type AssignmentSubmissionStatus =
  | 'SUBMITTED'
  | 'PENDING'
  | 'LATE'
  | 'NEEDS_REVISION';

export interface AcademicAssignmentItem {
  id: string;
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
  submission_status: AssignmentSubmissionStatus;
  score?: number | null;
  teacher_feedback?: string | null;
  updated_at: string;
}

export type ThreadChannelType =
  | 'HOMEROOM'
  | 'ADMIN_OFFICE'
  | 'INFIRMARY'
  | 'FINANCE';

export interface ParentTeacherThread {
  id: string;
  student_id: string;
  student_name: string;
  grade_level: string;
  guardian_name: string;
  teacher_name: string;
  channel_type: ThreadChannelType;
  last_message_text: string;
  last_message_at: string;
  unread_staff_count: number;
  unread_parent_count: number;
  office_hours_note: string;
  created_at: string;
  updated_at: string;
}

export interface ParentTeacherMessage {
  id: string;
  thread_id: string;
  sender_type: 'STAFF' | 'PARENT' | 'SYSTEM';
  sender_name: string;
  body_th: string;
  body_en?: string | null;
  require_acknowledgement: boolean;
  acknowledged_at?: string | null;
  created_at: string;
}

export type DomainEventSeverity = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'DIGEST';

export interface SystemDomainEvent {
  id: string;
  event_type: string;
  student_id: string;
  student_name?: string;
  severity: DomainEventSeverity;
  title_th: string;
  title_en: string;
  body_th: string;
  body_en: string;
  actor_role: 'PARENT' | 'STAFF' | 'SYSTEM';
  actor_name: string;
  payload?: Record<string, unknown>;
  created_at: string;
}

export interface ParentFeeInvoiceItem {
  id: string;
  student_id: string;
  title_th: string;
  title_en: string;
  term_label: string;
  amount: number;
  due_date: string;
  status: 'unpaid' | 'paid' | 'pending_verification';
  receipt_number?: string | null;
  paid_at?: string | null;
  payment_method?: string | null;
}

export interface Free15YSubsidyItem {
  id: string;
  student_id: string;
  academic_year: string;
  semester: string;
  category_th: string;
  category_en: string;
  amount: number;
  parent_signed: boolean;
  signed_by_name?: string | null;
  signed_at?: string | null;
  receipt_code: string;
}

export interface DevelopmentalMilestoneItem {
  id: string;
  student_id: string;
  domain: 'PHYSICAL' | 'EMOTIONAL_SOCIAL' | 'INTELLECTUAL' | 'LANGUAGE';
  domain_th: string;
  domain_en: string;
  indicator_th: string;
  indicator_en: string;
  rating: 3 | 2 | 1; // 3 = ดีมาก, 2 = สมวัย, 1 = ควรส่งเสริม
  teacher_comment: string;
  evaluated_at: string;
}

export interface SubjectGradeSummaryItem {
  subject_code: string;
  subject_name_th: string;
  subject_name_en: string;
  teacher_name: string;
  accumulated_score: number;
  max_accumulated: number;
  midterm_score: number;
  max_midterm: number;
  final_score: number;
  max_final: number;
  total_score: number;
  grade_label: string;
}

export interface ParentChildProfile {
  id: string; // Somkidvittaya student ID e.g. '10103' or '10264'
  public_uid: string; // Surrogate UUID
  learner_id: string; // OPEC / MoE 13-digit or learner code
  prefix: string;
  first_name: string;
  last_name: string;
  full_name: string;
  name_en: string;
  nickname: string;
  grade: string; // e.g. 'อ.2/1' or 'ป.4/1'
  classroom: string;
  stage: 'EARLY_YEARS' | 'PRIMARY';
  homeroom_teacher: string;
  homeroom_teacher_phone: string;
  blood_group: string;
  allergies: string;
  medical_conditions: string;
  height_cm: number;
  weight_kg: number;
  wallet_balance: number;
  wallet_daily_limit: number;
  attendance_rate_pct: number;
  gpa_or_assessment: string;
  photo_url?: string | null;
  permissions: GuardianPermissionFlags;
}

export interface BidirectionalPipelineState {
  version: number;
  guardian: GuardianProfile;
  children: ParentChildProfile[];
  links: GuardianStudentLink[];
  invitations: GuardianInvitation[];
  consents: ConsentRecord[];
  attendance_logs: StudentAttendanceLog[];
  leave_requests: StudentLeaveRequest[];
  pickup_plans: PickupDailyPlan[];
  early_years_care: EarlyYearsDailyCare[];
  dropoff_notes: EarlyYearsDropoffNote[];
  medication_requests: MedicationRequest[];
  incidents: StudentIncident[];
  assignments: AcademicAssignmentItem[];
  threads: ParentTeacherThread[];
  messages: ParentTeacherMessage[];
  domain_events: SystemDomainEvent[];
  fee_invoices: ParentFeeInvoiceItem[];
  free15y_subsidies: Free15YSubsidyItem[];
  early_years_milestones: DevelopmentalMilestoneItem[];
  primary_grades: Record<string, SubjectGradeSummaryItem[]>;
}
