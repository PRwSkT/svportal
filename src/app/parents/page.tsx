'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import {
  getPipelineState,
  savePipelineState,
  resetPipelineState,
  PIPELINE_EVENT_NAME,
  generatePickupTotp,
  getPickupBucketSecondsRemaining,
  submitLeaveRequest,
  updatePickupDailyPlan,
  submitEarlyYearsDropoffNote,
  submitMedicationRequest,
  acknowledgeStudentIncident,
  signFree15YSubsidyReceipt,
  topupChildWalletFromParent,
  payFeeInvoiceFromParent,
  sendParentTeacherMessage,
  toggleStudentConsent,
} from '@/lib/pipeline/bidirectional-store';
import type {
  BidirectionalPipelineState,
  ConsentPurposeCode,
  ConsentRecord,
  LeaveRequestType,
  MedicationMealTiming,
  ParentChildProfile,
  ParentFeeInvoiceItem,
  PickupArrivalStatus,
  TransportMode,
} from '@/types/family-pipeline';
import {
  Sun,
  MessageCircle,
  CalendarDays,
  Users,
  Wallet,
  QrCode,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Bus,
  Car,
  Baby,
  BookOpen,
  HeartPulse,
  Pill,
  FileSignature,
  CreditCard,
  Sparkles,
  Send,
  Download,
  RefreshCw,
  ArrowUpRight,
  Phone,
  Utensils,
  Moon,
  Smile,
  Thermometer,
  Award,
  Lock,
  BellRing,
  Check,
  Copy,
  X,
  UserCheck,
  FileText,
  Stethoscope,
  HandCoins,
  Globe,
  ShieldAlert,
  ChevronRight,
  GraduationCap,
  MessageSquare,
} from 'lucide-react';

type MainTabId = 'today' | 'messages' | 'calendar' | 'children' | 'more';
type ChildrenSubTabId = 'leave' | 'academics' | 'health' | 'pickup';

const CONSENT_CATALOG: Array<{
  code: ConsentPurposeCode;
  title_th: string;
  title_en: string;
  desc_th: string;
  desc_en: string;
  badge_th: string;
  badge_en: string;
}> = [
  {
    code: 'PHOTO_INTERNAL',
    title_th: 'การถ่ายภาพกิจกรรมสำหรับรายงานผู้ปกครองภายในระบบโรงเรียน',
    title_en: 'Internal Classroom & Daily Care Activity Photos',
    desc_th: 'อนุญาตให้ครูประจำชั้นบันทึกภาพกิจกรรมพัฒนาการและสมุดพกอนุบาลเพื่อส่งให้ผู้ปกครองเฉพาะรายบุคคล',
    desc_en: 'Allow homeroom teachers to capture classroom activity photos shared privately with parents.',
    badge_th: 'ภายในระบบโรงเรียน',
    badge_en: 'Internal Portal Only',
  },
  {
    code: 'PHOTO_PUBLIC_PR',
    title_th: 'การเผยแพร่ภาพกิจกรรมนักเรียนบนเว็บไซต์และเพจประชาสัมพันธ์โรงเรียน',
    title_en: 'Public Website & School PR Media Publication',
    desc_th: 'อนุญาตให้นำภาพกิจกรรมสร้างสรรค์และผลงานวิชาการของนักเรียนขึ้นแสดงในข่าวสารเว็บไซต์โรงเรียนสมคิดวิทยา',
    desc_en: 'Allow publishing student activity photos on the official school website and PR channels.',
    badge_th: 'สื่อประชาสัมพันธ์สาธารณะ',
    badge_en: 'Public PR Media',
  },
  {
    code: 'FIELD_TRIP',
    title_th: 'การเข้าร่วมกิจกรรมทัศนศึกษาและแหล่งเรียนรู้นอกสถานที่',
    title_en: 'Educational Field Trips & Off-Campus Learning',
    desc_th: 'อนุญาตให้นักเรียนเดินทางไปทัศนศึกษาตามโครงการวิชาการของโรงเรียนภายใต้การดูแลของครู',
    desc_en: 'Authorize participation in supervised off-campus educational field trips.',
    badge_th: 'กิจกรรมวิชาการนอกสถานที่',
    badge_en: 'Off-Campus Trips',
  },
  {
    code: 'FIRST_AID',
    title_th: 'การปฐมพยาบาลเบื้องต้นและการส่งต่อสถานพยาบาลฉุกเฉิน',
    title_en: 'Emergency First Aid & Hospital Referral',
    desc_th: 'อนุญาตให้พยาบาลประจำห้องพยาบาลปฐมพยาบาลเบื้องต้นและนำส่งโรงพยาบาลใกล้เคียงในกรณีฉุกเฉิน',
    desc_en: 'Authorize school nurse first-aid treatment and emergency hospital referral if required.',
    badge_th: 'ความปลอดภัยและสุขภาพ',
    badge_en: 'Health & Safety',
  },
  {
    code: 'AI_TRANSLATE',
    title_th: 'การใช้ระบบ AI ช่วยแปลภาษาและสรุปรายงานพัฒนาการสองภาษา (TH/EN)',
    title_en: 'AI Bilingual Translation & Learning Digest Assistance',
    desc_th: 'อนุญาตให้ระบบประมวลผลข้อความประกาศและรายงานประจำวันเพื่อแปลภาษาไทย-อังกฤษอัตโนมัติโดยไม่เปิดเผยข้อมูลส่วนบุคคลภายนอก',
    desc_en: 'Allow privacy-safe AI translation of teacher notes and school announcements between Thai and English.',
    badge_th: 'AI สองภาษา (PDPA Safe)',
    badge_en: 'Bilingual AI Assist',
  },
];

const PRIMARY_TIMETABLE_TODAY = [
  {
    period: 'คาบ 1 (08:30 - 09:20)',
    subject_th: 'คณิตศาสตร์พื้นฐาน (ค14101)',
    subject_en: 'Mathematics (MA14101)',
    topic_th: 'โจทย์ปัญหาการคูณและการหารหลายขั้นตอน',
    topic_en: 'Multi-step Multiplication & Division Word Problems',
    teacher: 'ครูธนกฤต สุวรรณภูมิ (ครูต้น)',
    room: 'ห้อง ป.4/1 (อาคาร 2 ชั้น 2)',
  },
  {
    period: 'คาบ 2 (09:20 - 10:10)',
    subject_th: 'วิทยาศาสตร์และเทคโนโลยี (ว14101)',
    subject_en: 'Science & Technology (SC14101)',
    topic_th: 'การทดลองตัวกลางของแสง (โปร่งใส โปร่งแสง ทึบแสง)',
    topic_en: 'Light Media Lab: Transparent, Translucent & Opaque',
    teacher: 'ครูสุพัตรา วิริยะกุล',
    room: 'ห้องปฏิบัติการวิทยาศาสตร์ประถม',
  },
  {
    period: 'คาบ 3 (10:25 - 11:15)',
    subject_th: 'ภาษาอังกฤษเพื่อการสื่อสาร (อ14101)',
    subject_en: 'Communicative English (EN14101)',
    topic_th: 'Speaking & Reading Aloud: My Favorite Weekend',
    topic_en: 'Speaking & Reading Aloud: My Favorite Weekend',
    teacher: 'Teacher Michael & ครูอารยา',
    room: 'English Smart Classroom',
  },
  {
    period: 'คาบ 4 (12:15 - 13:05)',
    subject_th: 'ภาษาไทย (ท14101)',
    subject_en: 'Thai Language (TH14101)',
    topic_th: 'การอ่านจับใจความสำคัญและคำราชาศัพท์น่ารู้',
    topic_en: 'Reading Comprehension & Thai Royal Vocabulary',
    teacher: 'ครูวันเพ็ญ ศรีสวัสดิ์',
    room: 'ห้อง ป.4/1 (อาคาร 2 ชั้น 2)',
  },
  {
    period: 'คาบ 5 (13:05 - 14:00)',
    subject_th: 'วิทยาการคำนวณและโค้ดดิ้ง (ว14201)',
    subject_en: 'Computing Science & Block Coding',
    topic_th: 'การออกแบบอัลกอริทึมแบบมีเงื่อนไขด้วย Scratch',
    topic_en: 'Conditional Logic & Loops with Scratch',
    teacher: 'ครูธนกฤต สุวรรณภูมิ (ครูต้น)',
    room: 'ห้องปฏิบัติการคอมพิวเตอร์ 1',
  },
];

// Deterministic visual SVG QR Code renderer for TOTP & PromptPay
function DeterministicQrSvg({
  value,
  accentColor = '#7B1C3E',
}: {
  value: string;
  accentColor?: string;
}) {
  const cells = useMemo(() => {
    const size = 21;
    const grid: boolean[][] = Array.from({ length: size }, () =>
      Array(size).fill(false)
    );

    const drawFinder = (r0: number, c0: number) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
          const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          grid[r0 + r][c0 + c] = isBorder || isInner;
        }
      }
    };

    drawFinder(0, 0);
    drawFinder(0, size - 7);
    drawFinder(size - 7, 0);

    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const inTopLeft = r < 8 && c < 8;
        const inTopRight = r < 8 && c >= size - 8;
        const inBottomLeft = r >= size - 8 && c < 8;
        if (inTopLeft || inTopRight || inBottomLeft) continue;

        if (r === 6 || c === 6) {
          grid[r][c] = (r + c) % 2 === 0;
          continue;
        }

        const bitSeed = Math.imul(hash ^ (r * 31 + c * 17), 1597334677);
        grid[r][c] = Math.abs(bitSeed) % 10 < 5;
      }
    }

    return grid;
  }, [value]);

  return (
    <svg
      viewBox="0 0 25 25"
      className="w-full h-full sv-avatar-media rounded-2xl bg-white p-2 shadow-inner border border-slate-200"
      role="img"
      aria-label={`QR Code for ${value}`}
    >
      <rect width="25" height="25" fill="#FFFFFF" rx="2" />
      {cells.map((row, rIdx) =>
        row.map((filled, cIdx) =>
          filled ? (
            <rect
              key={`${rIdx}-${cIdx}`}
              x={cIdx + 2}
              y={rIdx + 2}
              width="0.92"
              height="0.92"
              rx="0.18"
              fill={
                (rIdx < 7 && cIdx < 7) ||
                (rIdx < 7 && cIdx >= 14) ||
                (rIdx >= 14 && cIdx < 7)
                  ? accentColor
                  : '#1A1A1A'
              }
            />
          ) : null
        )
      )}
    </svg>
  );
}

export default function ParentsPortalPage() {
  const { language, isThai, formatCurrency } = useLanguage();

  // Live Bidirectional Pipeline State
  const [pipeline, setPipeline] = useState<BidirectionalPipelineState>(() =>
    getPipelineState()
  );
  const [selectedChildId, setSelectedChildId] = useState<string>('67012');
  const [showFamilySummary, setShowFamilySummary] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<MainTabId>('today');
  const [childrenSubTab, setChildrenSubTab] =
    useState<ChildrenSubTabId>('leave');
  const [lastSyncedAt, setLastSyncedAt] = useState<string>('');

  // Rotating TOTP QR state
  const [totpModalOpen, setTotpModalOpen] = useState<boolean>(false);
  const [totpCode, setTotpCode] = useState<string>('------');
  const [totpSecondsLeft, setTotpSecondsLeft] = useState<number>(30);

  // PromptPay Invoice Modal state
  const [activeInvoiceModal, setActiveInvoiceModal] =
    useState<ParentFeeInvoiceItem | null>(null);

  // Drop-off Note Form state (Early Years)
  const [dropoffSleepHours, setDropoffSleepHours] = useState<number>(10);
  const [dropoffAteBreakfast, setDropoffAteBreakfast] = useState<boolean>(true);
  const [dropoffMood, setDropoffMood] = useState<string>(
    'สดใส อารมณ์ดี ตื่นเต้นอยากทำศิลปะ'
  );
  const [dropoffMedicationToday, setDropoffMedicationToday] =
    useState<boolean>(false);
  const [dropoffPickupPerson, setDropoffPickupPerson] = useState<string>(
    'คุณแม่มารับเอง เวลา 15:15 น.'
  );
  const [dropoffSpecialNote, setDropoffSpecialNote] = useState<string>(
    'ฝากครูแนนดูแลไม่ให้น้องทานเมนูกุ้งนะคะ ขอบคุณค่ะ'
  );

  // Leave Request Form state
  const [leaveType, setLeaveType] = useState<LeaveRequestType>('SICK_LEAVE');
  const [leaveStartDate, setLeaveStartDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [leaveEndDate, setLeaveEndDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [leaveReason, setLeaveReason] = useState<string>('');

  // Medication Request Form state
  const [medName, setMedName] = useState<string>('');
  const [medDosage, setMedDosage] = useState<string>('1 ช้อนชา (5 มล.)');
  const [medScheduleTime, setMedScheduleTime] = useState<string>('12:30');
  const [medMealTiming, setMedMealTiming] =
    useState<MedicationMealTiming>('AFTER_MEAL');
  const [medReason, setMedReason] = useState<string>('');
  const [medSignatureConfirmed, setMedSignatureConfirmed] =
    useState<boolean>(true);

  // Pickup Delegate & Collector Form state
  const [collectorName, setCollectorName] = useState<string>('');
  const [collectorRelation, setCollectorRelation] = useState<string>('มารดา');
  const [collectorPhone, setCollectorPhone] =
    useState<string>('081-942-5618');
  const [collectorTransportMode, setCollectorTransportMode] =
    useState<TransportMode>('PARENT_PICKUP');
  const [collectorNotes, setCollectorNotes] = useState<string>('');

  // Two-Way Teacher Chat state
  const [chatInput, setChatInput] = useState<string>('');
  const [showEnglishTranslation, setShowEnglishTranslation] =
    useState<boolean>(true);

  // Wallet Daily Limit local edit state
  const [customDailyLimit, setCustomDailyLimit] = useState<number>(80);

  // Refresh state from bidirectional store
  const refreshPipeline = useCallback(() => {
    const fresh = getPipelineState();
    setPipeline({ ...fresh });
    setLastSyncedAt(
      new Date().toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    );
  }, []);

  useEffect(() => {
    refreshPipeline();

    const handlePipelineUpdate = () => {
      refreshPipeline();
    };
    const handleStorageUpdate = (e: StorageEvent) => {
      if (!e.key || e.key.includes('sv_bidirectional_pipeline')) {
        refreshPipeline();
      }
    };

    window.addEventListener(PIPELINE_EVENT_NAME, handlePipelineUpdate);
    window.addEventListener('storage', handleStorageUpdate);
    return () => {
      window.removeEventListener(PIPELINE_EVENT_NAME, handlePipelineUpdate);
      window.removeEventListener('storage', handleStorageUpdate);
    };
  }, [refreshPipeline]);

  // Selected Child Profile
  const selectedChild: ParentChildProfile = useMemo(() => {
    return (
      pipeline.children.find((c) => c.id === selectedChildId) ||
      pipeline.children[0]
    );
  }, [pipeline.children, selectedChildId]);

  const isEarlyYears = selectedChild?.stage === 'EARLY_YEARS';

  // Sync forms when switching child
  useEffect(() => {
    if (!selectedChild) return;
    setCustomDailyLimit(selectedChild.wallet_daily_limit);

    const todayNote = pipeline.dropoff_notes.find(
      (n) => n.student_id === selectedChild.id
    );
    if (todayNote) {
      setDropoffSleepHours(todayNote.sleep_hours);
      setDropoffAteBreakfast(todayNote.ate_breakfast);
      setDropoffMood(todayNote.morning_mood);
      setDropoffMedicationToday(todayNote.medication_today);
      setDropoffPickupPerson(todayNote.pickup_person_today);
      setDropoffSpecialNote(todayNote.special_note);
    }

    const plan = pipeline.pickup_plans.find(
      (p) => p.student_id === selectedChild.id
    );
    if (plan) {
      setCollectorName(plan.collector_name);
      setCollectorRelation(plan.collector_relationship);
      setCollectorPhone(plan.collector_phone || '081-942-5618');
      setCollectorTransportMode(plan.transport_mode);
      setCollectorNotes(plan.notes || '');
    }
  }, [
    selectedChild,
    pipeline.dropoff_notes,
    pipeline.pickup_plans,
  ]);

  // Live 1-second ticker for Rotating TOTP QR Code
  useEffect(() => {
    if (!selectedChild) return;
    const updateTotp = () => {
      const now = Date.now();
      setTotpCode(generatePickupTotp(selectedChild.id));
      setTotpSecondsLeft(getPickupBucketSecondsRemaining(now));
    };
    updateTotp();
    const timer = setInterval(updateTotp, 1000);
    return () => clearInterval(timer);
  }, [selectedChild]);

  // Derived data for selected child
  const childAttendance = useMemo(
    () =>
      pipeline.attendance_logs.find((a) => a.student_id === selectedChild.id),
    [pipeline.attendance_logs, selectedChild.id]
  );

  const childPickupPlan = useMemo(
    () => pipeline.pickup_plans.find((p) => p.student_id === selectedChild.id),
    [pipeline.pickup_plans, selectedChild.id]
  );

  const childDailyCare = useMemo(
    () =>
      pipeline.early_years_care.find((c) => c.student_id === selectedChild.id),
    [pipeline.early_years_care, selectedChild.id]
  );

  const childDropoffNote = useMemo(
    () =>
      pipeline.dropoff_notes.find((n) => n.student_id === selectedChild.id),
    [pipeline.dropoff_notes, selectedChild.id]
  );

  const childUnacknowledgedIncidents = useMemo(
    () =>
      pipeline.incidents.filter(
        (inc) => inc.student_id === selectedChild.id && !inc.parent_acknowledged
      ),
    [pipeline.incidents, selectedChild.id]
  );

  const childAllIncidents = useMemo(
    () =>
      pipeline.incidents.filter((inc) => inc.student_id === selectedChild.id),
    [pipeline.incidents, selectedChild.id]
  );

  const childUnsignedSubsidies = useMemo(
    () =>
      pipeline.free15y_subsidies.filter(
        (sub) => sub.student_id === selectedChild.id && !sub.parent_signed
      ),
    [pipeline.free15y_subsidies, selectedChild.id]
  );

  const childAllSubsidies = useMemo(
    () =>
      pipeline.free15y_subsidies.filter(
        (sub) => sub.student_id === selectedChild.id
      ),
    [pipeline.free15y_subsidies, selectedChild.id]
  );

  const childAssignments = useMemo(
    () =>
      pipeline.assignments.filter((a) => a.student_id === selectedChild.id),
    [pipeline.assignments, selectedChild.id]
  );

  const childLeaveRequests = useMemo(
    () =>
      pipeline.leave_requests.filter(
        (l) => l.student_id === selectedChild.id
      ),
    [pipeline.leave_requests, selectedChild.id]
  );

  const childMedicationRequests = useMemo(
    () =>
      pipeline.medication_requests.filter(
        (m) => m.student_id === selectedChild.id
      ),
    [pipeline.medication_requests, selectedChild.id]
  );

  const childThread = useMemo(
    () => pipeline.threads.find((t) => t.student_id === selectedChild.id),
    [pipeline.threads, selectedChild.id]
  );

  const childMessages = useMemo(
    () =>
      childThread
        ? pipeline.messages.filter((m) => m.thread_id === childThread.id)
        : [],
    [pipeline.messages, childThread]
  );

  const childInvoices = useMemo(
    () =>
      pipeline.fee_invoices.filter((f) => f.student_id === selectedChild.id),
    [pipeline.fee_invoices, selectedChild.id]
  );

  const childMilestones = useMemo(
    () =>
      pipeline.early_years_milestones.filter(
        (m) => m.student_id === selectedChild.id
      ),
    [pipeline.early_years_milestones, selectedChild.id]
  );

  const childGrades = useMemo(
    () => pipeline.primary_grades[selectedChild.id] || [],
    [pipeline.primary_grades, selectedChild.id]
  );

  const childConsents = useMemo(
    () => pipeline.consents.filter((c) => c.student_id === selectedChild.id),
    [pipeline.consents, selectedChild.id]
  );

  // Handlers for Bidirectional Actions
  const handleAcknowledgeIncident = (incidentId: string) => {
    const res = acknowledgeStudentIncident(incidentId);
    if (res) {
      refreshPipeline();
      toast.success(
        isThai
          ? 'ลงนามรับทราบรายงานการปฐมพยาบาลเรียบร้อยแล้ว (ซิงค์เข้าห้องพยาบาลทันที)'
          : 'First-aid report acknowledged and synced with School Infirmary!'
      );
    }
  };

  const handleSignSubsidy = (subsidyId: string) => {
    const res = signFree15YSubsidyReceipt(subsidyId);
    if (res) {
      refreshPipeline();
      toast.success(
        isThai
          ? `ลงนามรับเงินอุดหนุนเรียนฟรี 15 ปี (${res.receipt_code}) สำเร็จ!`
          : `Signed 15-Year Free Education Subsidy (${res.receipt_code})!`
      );
    }
  };

  const handlePickupArrivalStatus = (status: PickupArrivalStatus) => {
    const res = updatePickupDailyPlan({
      student_id: selectedChild.id,
      arrival_status: status,
      actor_role: 'PARENT',
      actor_name: pipeline.guardian.full_name,
    });
    if (res) {
      refreshPipeline();
      toast.success(
        status === 'ARRIVING_SOON'
          ? isThai
            ? `แจ้งจุดรับ-ส่งแล้วว่ากำลังเดินทางมารับ ${selectedChild.nickname} (อีก 5 นาที)`
            : `Notified gate: Arriving in 5 mins for ${selectedChild.nickname}`
          : isThai
          ? `แจ้งครูเวรประตูแล้วว่าถึงจุดรอรับ ${selectedChild.nickname} หน้าโรงเรียนแล้ว!`
          : `Notified gate: You have arrived at the pickup zone for ${selectedChild.nickname}!`
      );
    }
  };

  const handleSaveDropoffNote = (e: React.FormEvent) => {
    e.preventDefault();
    submitEarlyYearsDropoffNote({
      student_id: selectedChild.id,
      sleep_hours: Number(dropoffSleepHours) || 9,
      ate_breakfast: dropoffAteBreakfast,
      morning_mood: dropoffMood.trim() || 'สดใส อารมณ์ดี',
      medication_today: dropoffMedicationToday,
      pickup_person_today:
        dropoffPickupPerson.trim() || 'คุณแม่มารับเอง เวลา 15:15 น.',
      special_note: dropoffSpecialNote.trim(),
    });
    refreshPipeline();
    toast.success(
      isThai
        ? 'ส่งสมุดฝากครูตอนเช้าให้ครูประจำชั้นอนุบาลเรียบร้อยแล้ว!'
        : 'Morning drop-off note sent to Early Years homeroom teacher!'
    );
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !childThread) return;
    sendParentTeacherMessage({
      thread_id: childThread.id,
      sender_type: 'PARENT',
      sender_name: `${pipeline.guardian.full_name} (คุณแม่)`,
      body_th: chatInput.trim(),
    });
    setChatInput('');
    refreshPipeline();
    toast.success(
      isThai
        ? 'ส่งข้อความถึงครูประจำชั้นเรียบร้อยแล้ว (ซิงค์ไปยัง /admin/communications)'
        : 'Message sent to homeroom teacher!'
    );
  };

  const handleAcknowledgeTeacherMessage = (messageId: string) => {
    const current = getPipelineState();
    const msgIdx = current.messages.findIndex((m) => m.id === messageId);
    if (msgIdx === -1) return;
    const nowIso = new Date().toISOString();
    current.messages[msgIdx] = {
      ...current.messages[msgIdx],
      acknowledged_at: nowIso,
    };
    const thdIdx = current.threads.findIndex(
      (t) => t.id === current.messages[msgIdx].thread_id
    );
    if (thdIdx >= 0) {
      current.threads[thdIdx] = {
        ...current.threads[thdIdx],
        unread_parent_count: 0,
      };
    }
    savePipelineState(current);
    refreshPipeline();
    toast.success(
      isThai
        ? 'ยืนยันการรับทราบข้อความครูประจำชั้นเรียบร้อยแล้ว'
        : 'Acknowledged teacher message!'
    );
  };

  const handleLeaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveReason.trim()) {
      toast.error(
        isThai ? 'กรุณาระบุเหตุผลการลาเรียน' : 'Please enter a leave reason'
      );
      return;
    }
    submitLeaveRequest({
      student_id: selectedChild.id,
      leave_type: leaveType,
      start_date: leaveStartDate,
      end_date: leaveEndDate,
      reason: leaveReason.trim(),
    });
    setLeaveReason('');
    refreshPipeline();
    toast.success(
      isThai
        ? 'ส่งใบลาเรียนออนไลน์สำเร็จ! ซิงค์เข้าคิวอนุมัติของครูประจำชั้นทันที'
        : 'Leave request submitted and synced to homeroom teacher queue!'
    );
  };

  const handleMedicationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!medName.trim() || !medReason.trim()) {
      toast.error(
        isThai
          ? 'กรุณาระบุชื่อยาและอาการ/เหตุผลที่ฝากป้อนยา'
          : 'Please specify medication name and reason'
      );
      return;
    }
    if (!medSignatureConfirmed) {
      toast.error(
        isThai
          ? 'กรุณายืนยันลายมือชื่ออิเล็กทรอนิกส์ผู้ปกครองเพื่ออนุญาตป้อนยา'
          : 'Please confirm parent e-signature consent'
      );
      return;
    }
    const todayStr = new Date().toISOString().slice(0, 10);
    submitMedicationRequest({
      student_id: selectedChild.id,
      medication_name: medName.trim(),
      dosage: medDosage.trim() || '1 ช้อนชา (5 มล.)',
      schedule_times: [medScheduleTime || '12:30'],
      meal_timing: medMealTiming,
      start_date: todayStr,
      end_date: todayStr,
      reason: medReason.trim(),
    });
    setMedName('');
    setMedReason('');
    refreshPipeline();
    toast.success(
      isThai
        ? 'ส่งคำร้องฝากห้องพยาบาลป้อนยาออนไลน์สำเร็จ! ซิงค์ไปที่ /admin/health/infirmary ทันที'
        : 'Medication request submitted and synced to School Infirmary!'
    );
  };

  const handleSavePickupCollector = (e: React.FormEvent) => {
    e.preventDefault();
    updatePickupDailyPlan({
      student_id: selectedChild.id,
      transport_mode: collectorTransportMode,
      collector_name: collectorName.trim() || pipeline.guardian.full_name,
      collector_relationship: collectorRelation.trim() || 'มารดา',
      collector_phone: collectorPhone.trim() || pipeline.guardian.phone_number,
      notes: collectorNotes.trim(),
      actor_role: 'PARENT',
      actor_name: pipeline.guardian.full_name,
    });
    refreshPipeline();
    toast.success(
      isThai
        ? 'บันทึกแผนการรับ-ส่งและข้อมูลผู้รับนักเรียนประจำวันเรียบร้อยแล้ว'
        : 'Updated daily pickup plan and authorized collector!'
    );
  };

  const handleGenerateDelegateOtp = () => {
    const randomOtp = String(Math.floor(100000 + Math.random() * 900000));
    updatePickupDailyPlan({
      student_id: selectedChild.id,
      collector_name:
        collectorName.trim() || 'คุณตาสมศักดิ์ รัตนโชติ (ผู้รับมอบอำนาจ)',
      collector_relationship: collectorRelation.trim() || 'ปู่/ย่า/ตา/ยาย',
      collector_phone: collectorPhone.trim() || '081-942-5618',
      temp_otp_code: randomOtp,
      actor_role: 'PARENT',
      actor_name: pipeline.guardian.full_name,
    });
    refreshPipeline();
    toast.success(
      isThai
        ? `สร้างรหัส OTP มอบอำนาจรับแทนชั่วคราว (${randomOtp}) สำเร็จ! ใช้ยืนยันที่หน้าประตูโรงเรียนได้ทันที`
        : `Generated temporary delegate pickup OTP (${randomOtp})!`
    );
  };

  const handleConfirmPromptPayInvoice = (invoice: ParentFeeInvoiceItem) => {
    const paid = payFeeInvoiceFromParent(invoice.id);
    if (paid) {
      setActiveInvoiceModal(paid);
      refreshPipeline();
      toast.success(
        isThai
          ? `ชำระเงินสำเร็จ! ออกใบเสร็จรับเงินดิจิทัลเลขที่ ${paid.receipt_number}`
          : `Payment completed! Official e-Receipt ${paid.receipt_number} issued.`
      );
    }
  };

  const handleWalletTopup = (amount: number) => {
    const updated = topupChildWalletFromParent(selectedChild.id, amount);
    if (updated) {
      refreshPipeline();
      toast.success(
        isThai
          ? `เติมเงินเข้ากระเป๋าสหกรณ์ของ ${selectedChild.nickname} +${amount} บาท สำเร็จ!`
          : `Topped up +${amount} THB to ${selectedChild.nickname}'s Co-op Wallet!`
      );
    }
  };

  const handleSaveDailyLimit = () => {
    const current = getPipelineState();
    const idx = current.children.findIndex((c) => c.id === selectedChild.id);
    if (idx >= 0) {
      current.children[idx] = {
        ...current.children[idx],
        wallet_daily_limit: Number(customDailyLimit) || 100,
      };
      savePipelineState(current);
      refreshPipeline();
      toast.success(
        isThai
          ? `ตั้งวงเงินใช้จ่ายสหกรณ์ต่อวันของ ${selectedChild.nickname} เป็น ${customDailyLimit} บาท/วัน`
          : `Updated daily spending limit to ${customDailyLimit} THB/day`
      );
    }
  };

  const handleToggleConsent = (
    purposeCode: ConsentPurposeCode,
    nextGranted: boolean
  ) => {
    const current = getPipelineState();
    const exists = current.consents.some(
      (c) =>
        c.student_id === selectedChild.id && c.purpose_code === purposeCode
    );
    if (!exists) {
      const meta = CONSENT_CATALOG.find((item) => item.code === purposeCode);
      const newRecord: ConsentRecord = {
        id: `con-${selectedChild.id}-${purposeCode.toLowerCase()}`,
        student_id: selectedChild.id,
        guardian_id: current.guardian.id,
        purpose_code: purposeCode,
        purpose_title_th: meta?.title_th || purposeCode,
        purpose_title_en: meta?.title_en || purposeCode,
        purpose_desc_th: meta?.desc_th || '',
        policy_version: 'v1.2-2569',
        is_granted: nextGranted,
        ip_address: '171.96.42.18',
        signed_at: new Date().toISOString(),
        revoked_at: nextGranted ? null : new Date().toISOString(),
      };
      current.consents.push(newRecord);
      savePipelineState(current);
    }
    toggleStudentConsent(selectedChild.id, purposeCode, nextGranted);
    refreshPipeline();
    toast.success(
      nextGranted
        ? isThai
          ? `อนุญาตความยินยอม PDPA (${purposeCode}) เรียบร้อยแล้ว`
          : `Granted PDPA consent (${purposeCode})`
        : isThai
        ? `ถอนความยินยอม PDPA (${purposeCode}) เรียบร้อยแล้ว (มีผลกรองสื่อทันที)`
        : `Revoked PDPA consent (${purposeCode})`
    );
  };

  const handleDownloadIcsCalendar = () => {
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Somkidvittaya School//Parents Portal PWA//TH',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:sv-event-2026-ptc@somkidvittaya.ac.th',
      'DTSTART:20261031T020000Z',
      'DTEND:20261031T050000Z',
      `SUMMARY:${selectedChild.nickname} - วันประชุมผู้ปกครองและรับสมุดรายงานพัฒนาการ/ปพ.6`,
      'DESCRIPTION:ประชุมผู้ปกครองประจำภาคเรียน โรงเรียนสมคิดวิทยา',
      'LOCATION:หอประชุมสมคิดวิทยา',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:sv-event-2026-health@somkidvittaya.ac.th',
      'DTSTART:20261104T013000Z',
      'DTEND:20261104T043000Z',
      `SUMMARY:${selectedChild.nickname} - ตรวจสุขภาพประจำปีและเคลือบฟลูออไรด์`,
      'DESCRIPTION:ทีมแพทย์และทันตภิบาลโรงพยาบาลแหลมฉบังตรวจสุขภาพนักเรียน',
      'LOCATION:ห้องพยาบาลโรงเรียนสมคิดวิทยา',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:sv-event-2026-loykrathong@somkidvittaya.ac.th',
      'DTSTART:20261112T013000Z',
      'DTEND:20261112T070000Z',
      'SUMMARY:กิจกรรมสืบสานประเพณีลอยกระทงรักษ์โลก โรงเรียนสมคิดวิทยา',
      'DESCRIPTION:ประดิษฐ์กระทงวัสดุธรรมชาติร่วมกับเพื่อนและครูประจำชั้น',
      'LOCATION:ลานกิจกรรมโรงเรียนสมคิดวิทยา',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([icsContent], {
      type: 'text/calendar;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `somkidvittaya-family-calendar-${selectedChild.id}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(
      isThai
        ? 'ดาวน์โหลดไฟล์ปฏิทินโรงเรียน (.ics) สำหรับซิงค์เข้ามือถือเรียบร้อยแล้ว!'
        : 'Downloaded school calendar (.ics) file for mobile sync!'
    );
  };

  const handleResetDemo = () => {
    resetPipelineState();
    refreshPipeline();
    toast.info(
      isThai
        ? 'รีเซ็ตข้อมูลสาธิตกลับสู่ค่าเริ่มต้นของครอบครัวรัตนโชติเรียบร้อยแล้ว'
        : 'Reset demo data to initial family state!'
    );
  };

  const urgentActionCount =
    childUnacknowledgedIncidents.length + childUnsignedSubsidies.length;

  const unreadMessagesCount = childThread?.unread_parent_count || 0;

  return (
    <div className="flex-1 flex flex-col pb-24 md:pb-12">
      {/* ==================================================================
          STICKY TOP APP BAR (Parents Portal Mobile-First Header)
          ================================================================== */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-slate-200/80 shadow-xs">
        <div className="max-w-4xl mx-auto px-3.5 sm:px-6 py-2.5 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#7B1C3E] to-[#9B2C52] flex items-center justify-center text-white font-bold shadow-xs shrink-0 p-1.5">
              <Image
                src="/logo2.png"
                alt="โรงเรียนสมคิดวิทยา"
                width={32}
                height={32}
                className="w-7 h-7 object-contain brightness-0 invert"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm text-[#7B1C3E] tracking-tight truncate">
                  {isThai ? 'สมคิดวิทยา Parents' : 'Somkid Parents'}
                </span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate">
                {isThai
                  ? `${pipeline.guardian.full_name} • มารดา`
                  : `${pipeline.guardian.full_name} • Guardian`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Desktop Navigation Tabs embedded in header on large screens */}
            <nav
              aria-label="Parents Portal Desktop Navigation"
              className="hidden lg:flex items-center gap-1 bg-slate-100/90 p-1 rounded-2xl border border-slate-200/80 mr-1"
            >
              {[
                {
                  id: 'today' as MainTabId,
                  label_th: 'วันนี้',
                  label_en: 'Today',
                  icon: Sun,
                  badge: urgentActionCount,
                },
                {
                  id: 'messages' as MainTabId,
                  label_th: 'แชตครู',
                  label_en: 'Chat',
                  icon: MessageCircle,
                  badge: unreadMessagesCount,
                },
                {
                  id: 'calendar' as MainTabId,
                  label_th: 'ปฏิทิน',
                  label_en: 'Calendar',
                  icon: CalendarDays,
                  badge: 0,
                },
                {
                  id: 'children' as MainTabId,
                  label_th: 'บุตรหลาน',
                  label_en: 'Children',
                  icon: Users,
                  badge: 0,
                },
                {
                  id: 'more' as MainTabId,
                  label_th: 'การเงิน/PDPA',
                  label_en: 'Finance',
                  icon: Wallet,
                  badge: childUnsignedSubsidies.length,
                },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      active
                        ? 'bg-white text-[#7B1C3E] shadow-xs border border-slate-200/70'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{isThai ? tab.label_th : tab.label_en}</span>
                    {tab.badge > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-rose-600 text-white">
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <button
              type="button"
              onClick={handleResetDemo}
              title={isThai ? 'รีเซ็ตข้อมูลสาธิต' : 'Reset Demo'}
              className="p-1.5 rounded-xl text-slate-500 hover:text-[#7B1C3E] hover:bg-rose-50 border border-slate-200/80 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            <Link
              href="/home"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-[#1B3A6B] hover:bg-[#152e56] text-white shadow-xs transition-all"
              title={isThai ? 'สลับไปหน้าบุคลากร' : 'Staff Portal'}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isThai ? 'หน้าบุคลากร' : 'Staff'}</span>
            </Link>

            <LanguageSwitcher size="sm" />
          </div>
        </div>
      </header>

      {/* ==================================================================
          MAIN CONTAINER CONTENT
          ================================================================== */}
      <div className="max-w-4xl w-full mx-auto px-3.5 sm:px-6 pt-3 space-y-4">
        {/* APP CHILD SELECTOR SEGMENTED CONTROL */}
        <section aria-label="Select Child" className="space-y-2">
          <div className="flex items-center justify-between text-xs px-0.5">
            <span className="font-extrabold text-slate-500 uppercase tracking-wider text-[11px]">
              {isThai ? 'บุตรหลานของคุณ' : 'Your Children'}
            </span>
            <button
              type="button"
              onClick={() => setShowFamilySummary((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                showFamilySummary
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200/90'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>{isThai ? 'ภาพรวมครอบครัว (2)' : 'Family Overview'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {pipeline.children.map((child) => {
              const isSelected = !showFamilySummary && child.id === selectedChild.id;
              const isChildEarly = child.stage === 'EARLY_YEARS';
              const childIncidents = pipeline.incidents.filter(
                (i) => i.student_id === child.id && !i.parent_acknowledged
              ).length;

              return (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => {
                    setSelectedChildId(child.id);
                    setShowFamilySummary(false);
                  }}
                  className={`relative p-3 rounded-2xl text-left transition-all border flex items-center gap-2.5 sm:gap-3 cursor-pointer ${
                    isSelected
                      ? isChildEarly
                        ? 'bg-gradient-to-r from-[#7B1C3E] to-[#9B2C52] text-white border-[#7B1C3E] shadow-md ring-2 ring-[#7B1C3E]/20'
                        : 'bg-gradient-to-r from-[#1B3A6B] to-[#254C87] text-white border-[#1B3A6B] shadow-md ring-2 ring-[#1B3A6B]/20'
                      : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200/90 shadow-xs'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : isChildEarly
                        ? 'bg-pink-100 text-[#7B1C3E]'
                        : 'bg-blue-100 text-[#1B3A6B]'
                    }`}
                  >
                    {isChildEarly ? (
                      <Baby className="w-5 h-5" />
                    ) : (
                      <GraduationCap className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-sm truncate">
                        {child.nickname}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                          isSelected
                            ? 'bg-white/25 text-white'
                            : isChildEarly
                            ? 'bg-pink-100 text-[#7B1C3E]'
                            : 'bg-blue-100 text-[#1B3A6B]'
                        }`}
                      >
                        {child.grade}
                      </span>
                    </div>
                    <p
                      className={`text-[11px] truncate mt-0.5 ${
                        isSelected ? 'text-white/85' : 'text-slate-500'
                      }`}
                    >
                      {isThai
                        ? isChildEarly ? 'ปฐมวัย' : 'ประถมศึกษา'
                        : isChildEarly ? 'Early Years' : 'Primary'}
                      {' • '}{child.full_name}
                    </p>
                  </div>
                  {childIncidents > 0 && (
                    <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* NATIVE APP QUICK ACTION HUB (4 HIGH-FREQUENCY DAILY TASKS) */}
        <section aria-label="Quick Actions" className="bg-white rounded-3xl p-3 border border-slate-200/90 shadow-xs">
          <div className="grid grid-cols-4 gap-2 text-center">
            {/* 1. Leave Request */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('children');
                setChildrenSubTab('leave');
              }}
              className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-amber-50/80 transition-all cursor-pointer group"
            >
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-amber-100/90 text-amber-800 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <CalendarDays className="w-5 h-5 text-amber-700" />
              </div>
              <span className="text-xs font-bold text-slate-800 leading-tight">
                {isThai ? 'แจ้งลาเรียน' : 'Leave'}
              </span>
            </button>

            {/* 2. Pickup Pass / TOTP */}
            <button
              type="button"
              onClick={() => setTotpModalOpen(true)}
              className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-rose-50/80 transition-all cursor-pointer group"
            >
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-rose-100/90 text-[#7B1C3E] flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform relative">
                <QrCode className="w-5 h-5 text-[#7B1C3E]" />
                <span className="absolute -top-1 -right-1 px-1 rounded-full text-[9px] font-black bg-[#7B1C3E] text-white">
                  30s
                </span>
              </div>
              <span className="text-xs font-bold text-slate-800 leading-tight">
                {isThai ? 'รหัสรับกลับ' : 'Pickup QR'}
              </span>
            </button>

            {/* 3. Medication Request */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('children');
                setChildrenSubTab('health');
              }}
              className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-purple-50/80 transition-all cursor-pointer group"
            >
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-purple-100/90 text-purple-800 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <Pill className="w-5 h-5 text-purple-700" />
              </div>
              <span className="text-xs font-bold text-slate-800 leading-tight">
                {isThai ? 'ฝากป้อนยา' : 'Medicine'}
              </span>
            </button>

            {/* 4. Tuition / Wallet */}
            <button
              type="button"
              onClick={() => setActiveTab('more')}
              className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-emerald-50/80 transition-all cursor-pointer group"
            >
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-emerald-100/90 text-emerald-800 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <Wallet className="w-5 h-5 text-emerald-700" />
              </div>
              <span className="text-xs font-bold text-slate-800 leading-tight">
                {isThai ? 'ค่าเทอม/เงิน' : 'Tuition/Pay'}
              </span>
            </button>
          </div>
        </section>
        {/* ALL CHILDREN FAMILY SUMMARY BANNER (When toggled on) */}
        {showFamilySummary && (
          <section className="sv-glass-card rounded-3xl p-4 sm:p-5 border-2 border-amber-300/80 bg-gradient-to-br from-amber-50/90 via-white to-rose-50/50">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-600" />
                  <span>
                    {isThai
                      ? 'มุมมองรวมครอบครัวรัตนโชติ (All Children Daily Overview)'
                      : 'Rattanachot Family Overview (All Children)'}
                  </span>
                </h2>
                <p className="text-xs text-slate-600">
                  {isThai
                    ? 'เปรียบเทียบสถานะการมาเรียน กระเป๋าเงิน และรายการที่ต้องดำเนินการของบุตรหลานทั้ง 2 คนในหน้าเดียว'
                    : 'Unified daily status across both children at Somkidvittaya School'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFamilySummary(false)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 px-2.5 py-1 rounded-lg bg-white border border-slate-200 cursor-pointer"
              >
                {isThai ? 'ซ่อนมุมมองรวม' : 'Close Summary'}
              </button>
            </div>

            <div className="sv-adaptive-grid grid grid-cols-1 gap-3.5">
              {pipeline.children.map((child) => {
                const att = pipeline.attendance_logs.find(
                  (a) => a.student_id === child.id
                );
                const plan = pipeline.pickup_plans.find(
                  (p) => p.student_id === child.id
                );
                const unackInc = pipeline.incidents.filter(
                  (i) => i.student_id === child.id && !i.parent_acknowledged
                ).length;
                const unpaidCount = pipeline.fee_invoices.filter(
                  (f) => f.student_id === child.id && f.status === 'unpaid'
                ).length;

                return (
                  <div
                    key={child.id}
                    className="rounded-2xl bg-white p-4 border border-slate-200/90 shadow-sm flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            child.stage === 'EARLY_YEARS'
                              ? 'bg-pink-100 text-[#7B1C3E]'
                              : 'bg-blue-100 text-[#1B3A6B]'
                          }`}
                        >
                          {child.grade} •{' '}
                          {child.stage === 'EARLY_YEARS'
                            ? isThai
                              ? 'ปฐมวัย (อนุบาล)'
                              : 'Early Years'
                            : isThai
                            ? 'ประถมศึกษา'
                            : 'Primary'}
                        </span>
                        <h3 className="font-extrabold text-base text-slate-900 mt-1">
                          {child.nickname} ({child.full_name})
                        </h3>
                        <p className="text-xs text-slate-500">
                          {child.homeroom_teacher}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedChildId(child.id);
                          setShowFamilySummary(false);
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#7B1C3E] text-white hover:bg-[#611530] transition-colors cursor-pointer shrink-0"
                      >
                        {isThai ? 'ดูรายละเอียด' : 'Select'}
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div>
                        <p className="text-[10px] text-slate-500">
                          {isThai ? 'เช็กชื่อเช้านี้' : 'Check-in'}
                        </p>
                        <p className="text-xs font-extrabold text-emerald-700">
                          {att?.check_in_time || '07:40 น.'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500">
                          {isThai ? 'กระเป๋าสหกรณ์' : 'Co-op Wallet'}
                        </p>
                        <p className="text-xs font-extrabold text-slate-900">
                          {formatCurrency(child.wallet_balance)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500">
                          {isThai ? 'การรับกลับวันนี้' : 'Pickup'}
                        </p>
                        <p className="text-xs font-extrabold text-[#1B3A6B]">
                          {plan?.arrival_status || 'SCHEDULED'}
                        </p>
                      </div>
                    </div>

                    {(unackInc > 0 || unpaidCount > 0) && (
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        {unackInc > 0 && (
                          <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800 font-bold">
                            {isThai
                              ? `รอรับทราบห้องพยาบาล ${unackInc} รายการ`
                              : `${unackInc} Infirmary Alert`}
                          </span>
                        )}
                        {unpaidCount > 0 && (
                          <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 font-bold">
                            {isThai
                              ? `ใบแจ้งค่าเทอม ${unpaidCount} รายการ`
                              : `${unpaidCount} Unpaid Invoice`}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* SELECTED CHILD CONTEXT HERO BANNER */}
        <section
          className={`rounded-3xl p-4 sm:p-6 text-white shadow-lg relative overflow-hidden ${
            isEarlyYears
              ? 'bg-gradient-to-r from-[#7B1C3E] via-[#91224A] to-[#B03460]'
              : 'bg-gradient-to-r from-[#1B3A6B] via-[#234982] to-[#2E5C9E]'
          }`}
        >
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center shrink-0 sv-avatar-media">
                {isEarlyYears ? (
                  <Baby className="w-8 h-8 text-white" />
                ) : (
                  <GraduationCap className="w-8 h-8 text-white" />
                )}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-white/20 backdrop-blur-sm">
                    {selectedChild.grade} •{' '}
                    {isEarlyYears
                      ? isThai
                        ? 'ระดับปฐมวัย (Early Years)'
                        : 'Early Years / Kindergarten'
                      : isThai
                      ? 'ระดับประถมศึกษา (Primary)'
                      : 'Primary Education'}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-400/25 text-emerald-100 border border-emerald-300/30">
                    {isThai
                      ? `มาเรียน ${selectedChild.attendance_rate_pct}%`
                      : `Attendance ${selectedChild.attendance_rate_pct}%`}
                  </span>
                  {selectedChild.allergies !== 'ไม่มี' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-rose-500 text-white shadow-sm">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{selectedChild.allergies}</span>
                    </span>
                  )}
                </div>
                <h1 className="sv-fluid-title font-black mt-1">
                  {selectedChild.nickname} —{' '}
                  {isThai ? selectedChild.full_name : selectedChild.name_en}
                </h1>
                <p className="text-xs sm:text-sm text-white/85 flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                  <span>
                    {isThai ? 'รหัสนักเรียน:' : 'Student ID:'}{' '}
                    <strong>{selectedChild.id}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    {isThai ? 'ครูประจำชั้น:' : 'Homeroom:'}{' '}
                    <strong>{selectedChild.homeroom_teacher}</strong> (
                    {selectedChild.homeroom_teacher_phone})
                  </span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap sm:flex-col items-stretch sm:items-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setTotpModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-white text-[#7B1C3E] font-extrabold text-xs sm:text-sm shadow-md hover:bg-rose-50 transition-all cursor-pointer"
              >
                <QrCode className="w-4 h-4" />
                <span>
                  {isThai
                    ? `เปิด QR รับกลับ (${totpCode})`
                    : `Pickup QR Pass (${totpCode})`}
                </span>
              </button>
              <span className="text-[11px] text-white/80 text-right">
                {isThai
                  ? `รหัส TOTP เปลี่ยนทุก 30 วินาที (เหลือ ${totpSecondsLeft} วินาที)`
                  : `Rotating TOTP refreshes in ${totpSecondsLeft}s`}
              </span>
            </div>
          </div>
        </section>

        {/* ==================================================================
            TAB 1: TODAY (วันนี้ — Action-First Age-Adaptive Timeline)
            ================================================================== */}
        {activeTab === 'today' && (
          <div className="space-y-5">
            {/* URGENT / ACTION REQUIRED CARDS */}
            {(childUnacknowledgedIncidents.length > 0 ||
              childUnsignedSubsidies.length > 0) && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm sm:text-base font-extrabold text-rose-800 flex items-center gap-2">
                    <BellRing className="w-4 h-4 text-rose-600 animate-bounce" />
                    <span>
                      {isThai
                        ? 'รายการด่วนที่รอผู้ปกครองดำเนินการ (Action Required)'
                        : 'Urgent Actions Required from Parent'}
                    </span>
                  </h2>
                </div>

                <div className="sv-adaptive-grid grid grid-cols-1 gap-3.5">
                  {/* Unacknowledged Infirmary Incident Card */}
                  {childUnacknowledgedIncidents.map((inc) => (
                    <div
                      key={inc.id}
                      className="rounded-3xl bg-rose-50/95 border-2 border-rose-300 p-4 sm:p-5 shadow-sm flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-rose-600 text-white">
                            <Stethoscope className="w-3.5 h-3.5" />
                            {isThai
                              ? 'แจ้งการปฐมพยาบาลจากห้องพยาบาล'
                              : 'School Infirmary First-Aid Alert'}
                          </span>
                          <span className="text-xs font-bold text-rose-700">
                            {inc.incident_time} น. • {inc.location}
                          </span>
                        </div>
                        <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                          {inc.description}
                        </h3>
                        <div className="rounded-2xl bg-white/90 p-3 border border-rose-200 text-xs text-slate-700 space-y-1">
                          <p>
                            <strong className="text-rose-800">
                              {isThai ? 'การปฐมพยาบาล:' : 'First Aid Given:'}
                            </strong>{' '}
                            {inc.first_aid_given}
                          </p>
                          <p className="text-slate-500">
                            {isThai ? 'ผู้บันทึก:' : 'Reported by:'}{' '}
                            {inc.reported_by}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <Link
                          href="/admin/health/infirmary"
                          className="text-xs font-bold text-rose-700 hover:underline inline-flex items-center gap-1"
                        >
                          <span>
                            {isThai
                              ? 'ดูหน้าห้องพยาบาล (Staff)'
                              : 'View Staff Infirmary'}
                          </span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleAcknowledgeIncident(inc.id)}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs sm:text-sm shadow-sm transition-all cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>
                            {isThai
                              ? 'รับทราบการปฐมพยาบาล (Acknowledge First Aid)'
                              : 'Acknowledge First Aid'}
                          </span>
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Unsigned 15-Year Free Education Subsidy Card */}
                  {childUnsignedSubsidies.map((sub) => (
                    <div
                      key={sub.id}
                      className="rounded-3xl bg-amber-50/95 border-2 border-amber-300 p-4 sm:p-5 shadow-sm flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-600 text-white">
                            <FileSignature className="w-3.5 h-3.5" />
                            {isThai
                              ? 'รอลงนามรับเงินอุดหนุนเรียนฟรี 15 ปี (สช.)'
                              : 'OPEC 15-Year Subsidy e-Signature Required'}
                          </span>
                          <span className="text-xs font-extrabold text-amber-900">
                            {sub.receipt_code}
                          </span>
                        </div>
                        <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                          {isThai ? sub.category_th : sub.category_en}
                        </h3>
                        <p className="text-xs text-slate-700">
                          {isThai
                            ? `ภาคเรียนที่ ${sub.semester} • จำนวนเงินอุดหนุน ${formatCurrency(
                                sub.amount
                              )} (ลงนามอิเล็กทรอนิกส์แทนการเซ็นกระดาษ อร.11)`
                            : `Term ${sub.semester} • Subsidy Amount ${formatCurrency(
                                sub.amount
                              )}`}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <Link
                          href="/admin/subsidy/free15y"
                          className="text-xs font-bold text-amber-800 hover:underline inline-flex items-center gap-1"
                        >
                          <span>
                            {isThai
                              ? 'ดูทะเบียน อร.11 (Staff)'
                              : 'View OPEC Registry'}
                          </span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleSignSubsidy(sub.id)}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#7B1C3E] hover:bg-[#5e152f] text-white font-extrabold text-xs sm:text-sm shadow-sm transition-all cursor-pointer"
                        >
                          <FileSignature className="w-4 h-4" />
                          <span>
                            {isThai
                              ? 'ลงนามรับเงินอุดหนุนเรียนฟรี 15 ปี (Sign OPEC Subsidy)'
                              : 'Sign OPEC Subsidy'}
                          </span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* LIVE ATTENDANCE + SMART PICKUP & ROTATING QR PASS */}
            <section className="sv-adaptive-grid grid grid-cols-1 gap-4">
              {/* Card 1: Live Attendance & School Van Status */}
              <div className="sv-glass-card rounded-3xl p-4 sm:p-5 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-extrabold bg-emerald-100 text-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {isThai
                        ? 'สถานะการมาเรียนวันนี้ (Live Attendance)'
                        : "Today's Live Attendance"}
                    </span>
                    <span className="text-xs font-bold text-slate-500">
                      {childAttendance?.source === 'NFC_GATE'
                        ? isThai
                          ? 'สแกนบัตร NFC หน้าประตู'
                          : 'NFC Gate Scan'
                        : isThai
                        ? 'ครูประจำชั้นเช็กชื่อ'
                        : 'Homeroom App'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between bg-slate-50/90 p-3.5 rounded-2xl border border-slate-200/70">
                    <div>
                      <p className="text-xs text-slate-500">
                        {isThai ? 'เวลาเข้าเรียนเช้านี้' : 'Morning Check-in'}
                      </p>
                      <p className="text-xl font-black text-emerald-700">
                        {childAttendance?.check_in_time || '07:40 น.'}
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {childAttendance?.notes ||
                          (isThai
                            ? 'เข้าเรียนปกติ ยิ้มแย้มแจ่มใส'
                            : 'Checked in on time')}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-3 py-1 rounded-xl text-xs font-extrabold bg-emerald-600 text-white">
                        {childAttendance?.status || 'PRESENT'}
                      </span>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {childAttendance?.recorded_by}
                      </p>
                    </div>
                  </div>

                  {/* School Van / Transport Route Info */}
                  <div className="rounded-2xl bg-blue-50/70 border border-blue-200/70 p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between font-bold text-[#1B3A6B]">
                      <span className="flex items-center gap-1.5">
                        <Bus className="w-4 h-4" />
                        {isThai
                          ? 'สถานะการเดินทาง & รถรับ-ส่งโรงเรียน'
                          : 'Transport & School Van Status'}
                      </span>
                      <span>
                        {childPickupPlan?.transport_mode === 'SCHOOL_VAN'
                          ? isThai
                            ? 'รถตู้โรงเรียน'
                            : 'School Van'
                          : isThai
                          ? 'ผู้ปกครองรับ-ส่งเอง'
                          : 'Parent Pickup'}
                      </span>
                    </div>
                    <p className="text-slate-700">
                      {childPickupPlan?.van_status_text ||
                        childPickupPlan?.notes ||
                        (isThai
                          ? 'ผู้ปกครองรับที่จุดรับส่งตามเวลาเลิกเรียน'
                          : 'Scheduled for parent pickup at dismissal')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('children');
                      setChildrenSubTab('leave');
                    }}
                    className="font-bold text-[#7B1C3E] hover:underline cursor-pointer"
                  >
                    {isThai
                      ? '+ แจ้งลาป่วย / ลากิจ / รับกลับก่อนเวลา'
                      : '+ Submit Leave / Early Pickup'}
                  </button>
                  <Link
                    href="/admin/students/attendance"
                    className="font-semibold text-slate-500 hover:text-slate-800 inline-flex items-center gap-1"
                  >
                    <span>
                      {isThai ? 'สมุดเช็กชื่อครู' : 'Staff Attendance'}
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              {/* Card 2: Smart Pickup Queue & 30s Rotating QR Pass */}
              <div className="sv-glass-card rounded-3xl p-4 sm:p-5 flex flex-col justify-between gap-4 border-2 border-[#7B1C3E]/20">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-extrabold bg-[#7B1C3E]/10 text-[#7B1C3E]">
                      <Car className="w-3.5 h-3.5" />
                      {isThai
                        ? 'ระบบรับ-ส่งอัจฉริยะ (Smart Pickup Queue)'
                        : 'Smart Dismissal & Pickup Queue'}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-slate-900 text-white">
                      {childPickupPlan?.arrival_status || 'SCHEDULED'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-rose-50/80 to-slate-50 p-3.5 rounded-2xl border border-rose-200/60">
                    <div>
                      <p className="text-xs text-slate-500">
                        {isThai
                          ? 'ผู้มีสิทธิ์รับนักเรียนวันนี้'
                          : 'Authorized Collector Today'}
                      </p>
                      <p className="text-sm font-extrabold text-slate-900">
                        {childPickupPlan?.collector_name}
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {childPickupPlan?.notes}
                      </p>
                      {childPickupPlan?.released_at && (
                        <p className="text-xs font-bold text-emerald-700 mt-1 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>
                            {isThai
                              ? `ส่งมอบนักเรียนแล้วเมื่อ ${childPickupPlan.released_at}`
                              : `Released at ${childPickupPlan.released_at}`}
                          </span>
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setTotpModalOpen(true)}
                      className="flex flex-col items-center justify-center px-3.5 py-2.5 rounded-2xl bg-white border-2 border-[#7B1C3E] text-[#7B1C3E] hover:bg-rose-50 transition-all cursor-pointer shrink-0 shadow-sm"
                    >
                      <QrCode className="w-6 h-6" />
                      <span className="font-mono font-black text-xs mt-1">
                        {totpCode}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {totpSecondsLeft}s
                      </span>
                    </button>
                  </div>

                  {/* 1-Click Arrival Notification Buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handlePickupArrivalStatus('ARRIVING_SOON')}
                      className={`px-3 py-2.5 rounded-2xl text-xs font-extrabold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        childPickupPlan?.arrival_status === 'ARRIVING_SOON'
                          ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                          : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                      }`}
                    >
                      <Clock className="w-4 h-4" />
                      <span>
                        {isThai
                          ? 'กำลังเดินทาง (อีก 5 นาที)'
                          : 'Arriving in 5 Mins'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handlePickupArrivalStatus('ARRIVED_AT_GATE')
                      }
                      className={`px-3 py-2.5 rounded-2xl text-xs font-extrabold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        childPickupPlan?.arrival_status === 'ARRIVED_AT_GATE'
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                          : 'bg-[#7B1C3E] hover:bg-[#611530] text-white border-[#7B1C3E]'
                      }`}
                    >
                      <BellRing className="w-4 h-4" />
                      <span>
                        {isThai
                          ? 'ถึงจุดรอรับหน้าโรงเรียนแล้ว (I Have Arrived)'
                          : 'I Have Arrived at Gate'}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                  <button
                    type="button"
                    onClick={() => setTotpModalOpen(true)}
                    className="font-bold text-[#7B1C3E] hover:underline cursor-pointer"
                  >
                    {isThai
                      ? 'เปิดบัตร QR & รหัส TOTP 6 หลัก'
                      : 'Open Rotating QR & 6-Digit TOTP Modal'}
                  </button>
                  <Link
                    href="/admin/safety/pickup"
                    className="font-semibold text-[#1B3A6B] hover:underline inline-flex items-center gap-1"
                  >
                    <span>
                      {isThai
                        ? 'ทดสอบสแกนที่จุดรับ-ส่ง (Kiosk)'
                        : 'Test at Staff Pickup Kiosk'}
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </section>

            {/* ==============================================================
                AGE-ADAPTIVE EXPERIENCE:
                1) EARLY YEARS (น้องพราว อ.2/1) -> Morning Drop-off Note + Daily Care Timeline
                2) PRIMARY (น้องกัปตัน ป.4/1) -> Homework & Assignments + Primary Timetable
                ============================================================== */}
            {isEarlyYears ? (
              <div className="space-y-5">
                {/* Early Years Card A: Morning Drop-off Note (สมุดฝากครูตอนเช้า) */}
                <section className="sv-glass-card rounded-3xl p-4 sm:p-6 border border-pink-200/90">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-extrabold bg-pink-100 text-[#7B1C3E]">
                        <Baby className="w-3.5 h-3.5" />
                        {isThai
                          ? 'สมุดฝากครูตอนเช้า (Early Years Morning Drop-off Note)'
                          : 'Early Years Morning Drop-off Note'}
                      </span>
                      <h2 className="text-base sm:text-lg font-extrabold text-slate-900 mt-1">
                        {isThai
                          ? `แจ้งข้อมูลสุขภาพและการดูแลเช้านี้ของ ${selectedChild.nickname}`
                          : `Morning Care Handover for ${selectedChild.nickname}`}
                      </h2>
                    </div>

                    {childDropoffNote?.acknowledged_by_teacher ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        {isThai
                          ? `ครูประจำชั้นรับทราบแล้ว (${childDropoffNote.acknowledged_by_teacher})`
                          : `Acknowledged by ${childDropoffNote.acknowledged_by_teacher}`}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                        <Clock className="w-4 h-4 text-amber-600" />
                        {isThai
                          ? 'รอครูประจำชั้นกดรับทราบในระบบอนุบาล'
                          : 'Waiting for Homeroom Teacher Acknowledgement'}
                      </span>
                    )}
                  </div>

                  <form
                    onSubmit={handleSaveDropoffNote}
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5"
                  >
                    <label className="block">
                      <span className="text-xs font-bold text-slate-700">
                        {isThai
                          ? 'ชั่วโมงการนอนเมื่อคืน (ชม.)'
                          : 'Sleep Hours Last Night'}
                      </span>
                      <input
                        type="number"
                        min={4}
                        max={14}
                        value={dropoffSleepHours}
                        onChange={(e) =>
                          setDropoffSleepHours(Number(e.target.value))
                        }
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold focus:border-[#7B1C3E] focus:outline-none"
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs font-bold text-slate-700">
                        {isThai ? 'การทานอาหารเช้าจากบ้าน' : 'Breakfast Status'}
                      </span>
                      <select
                        value={dropoffAteBreakfast ? 'yes' : 'no'}
                        onChange={(e) =>
                          setDropoffAteBreakfast(e.target.value === 'yes')
                        }
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold focus:border-[#7B1C3E] focus:outline-none"
                      >
                        <option value="yes">
                          {isThai
                            ? 'ทานอาหารเช้าเรียบร้อยแล้ว'
                            : 'Already Ate Breakfast'}
                        </option>
                        <option value="no">
                          {isThai
                            ? 'ยังไม่ได้ทาน (ฝากทานมื้อเช้าที่โรงเรียน)'
                            : 'Need School Breakfast'}
                        </option>
                      </select>
                    </label>

                    <label className="block">
                      <span className="text-xs font-bold text-slate-700">
                        {isThai ? 'อารมณ์เช้านี้' : 'Morning Mood'}
                      </span>
                      <input
                        type="text"
                        value={dropoffMood}
                        onChange={(e) => setDropoffMood(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold focus:border-[#7B1C3E] focus:outline-none"
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs font-bold text-slate-700">
                        {isThai
                          ? 'ผู้มารับกลับวันนี้'
                          : 'Pickup Person Today'}
                      </span>
                      <input
                        type="text"
                        value={dropoffPickupPerson}
                        onChange={(e) => setDropoffPickupPerson(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold focus:border-[#7B1C3E] focus:outline-none"
                      />
                    </label>

                    <label className="block sm:col-span-2">
                      <span className="text-xs font-bold text-slate-700">
                        {isThai
                          ? 'ข้อควรระวังพิเศษ / เตือนอาการแพ้อาหารถึงครูแนน'
                          : 'Special Note / Allergy Reminder for Teacher Nan'}
                      </span>
                      <input
                        type="text"
                        value={dropoffSpecialNote}
                        onChange={(e) => setDropoffSpecialNote(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold focus:border-[#7B1C3E] focus:outline-none"
                      />
                    </label>

                    <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap items-center justify-between gap-2 pt-2">
                      <Link
                        href="/academic/early-years"
                        className="text-xs font-bold text-[#7B1C3E] hover:underline inline-flex items-center gap-1"
                      >
                        <span>
                          {isThai
                            ? 'เปิดหน้าสมุดปฐมวัยของครูแนนเพื่อทดสอบการกดรับทราบ (/academic/early-years)'
                            : 'Open Staff Early Years Portal (/academic/early-years)'}
                        </span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </Link>

                      <button
                        type="submit"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#7B1C3E] hover:bg-[#5e152f] text-white font-extrabold text-xs sm:text-sm shadow-sm transition-all cursor-pointer"
                      >
                        <Send className="w-4 h-4" />
                        <span>
                          {isThai
                            ? 'บันทึกและส่งสมุดฝากครูตอนเช้า'
                            : 'Save & Send Morning Drop-off Note'}
                        </span>
                      </button>
                    </div>
                  </form>
                </section>

                {/* Early Years Card B: Daily Care Timeline (สมุดพกอนุบาลประจำวัน) */}
                {childDailyCare && (
                  <section className="sv-glass-card rounded-3xl p-4 sm:p-6 border border-pink-200/80 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-extrabold bg-emerald-100 text-emerald-800">
                          <Sparkles className="w-3.5 h-3.5" />
                          {isThai
                            ? 'สมุดพกอนุบาลประจำวัน (Early Years Daily Care Timeline)'
                            : 'Early Years Daily Care Digest'}
                        </span>
                        <h2 className="text-base sm:text-lg font-extrabold text-slate-900 mt-1">
                          {isThai
                            ? `สรุปกิจวัตรประจำวันของ ${selectedChild.nickname} (${childDailyCare.class_id})`
                            : `Daily Care Report for ${selectedChild.nickname}`}
                        </h2>
                      </div>
                      <span className="text-xs font-bold text-slate-500">
                        {isThai ? 'บันทึกโดย:' : 'Recorded by:'}{' '}
                        {selectedChild.homeroom_teacher}
                      </span>
                    </div>

                    {/* 6 Visual Care Metrics Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      <div className="rounded-2xl bg-pink-50/90 border border-pink-200/70 p-3">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#7B1C3E]">
                          <Smile className="w-4 h-4" />
                          <span>{isThai ? 'อารมณ์เช้านี้' : 'Mood'}</span>
                        </div>
                        <p className="text-sm font-black text-slate-900 mt-1">
                          {childDailyCare.morning_mood === 'CHEERFUL'
                            ? isThai
                              ? 'ร่าเริงแจ่มใส'
                              : 'Cheerful'
                            : childDailyCare.morning_mood}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-amber-50/90 border border-amber-200/70 p-3">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                          <Utensils className="w-4 h-4" />
                          <span>
                            {isThai ? 'อาหารเช้า / เที่ยง' : 'Meals'}
                          </span>
                        </div>
                        <p className="text-sm font-black text-slate-900 mt-1">
                          {childDailyCare.breakfast_status} /{' '}
                          {childDailyCare.lunch_status}
                        </p>
                        <p className="text-[11px] text-amber-800">
                          {isThai ? 'ทานหมดถาด (ปลอดกุ้ง)' : 'Finished Tray'}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-sky-50/90 border border-sky-200/70 p-3">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-sky-800">
                          <HeartPulse className="w-4 h-4" />
                          <span>{isThai ? 'นมเช้า / บ่าย' : 'School Milk'}</span>
                        </div>
                        <p className="text-sm font-black text-slate-900 mt-1">
                          {childDailyCare.milk_morning} /{' '}
                          {childDailyCare.milk_afternoon}
                        </p>
                        <p className="text-[11px] text-sky-800">
                          {isThai ? 'ดื่มครบ 2 มื้อ' : 'Both sessions'}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-indigo-50/90 border border-indigo-200/70 p-3">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-800">
                          <Moon className="w-4 h-4" />
                          <span>{isThai ? 'นอนกลางวัน' : 'Nap Time'}</span>
                        </div>
                        <p className="text-sm font-black text-slate-900 mt-1">
                          {childDailyCare.nap_start} - {childDailyCare.nap_end}
                        </p>
                        <p className="text-[11px] text-indigo-800">
                          {childDailyCare.nap_quality === 'SOUND'
                            ? isThai
                              ? 'หลับสนิทดีมาก'
                              : 'Sound sleep'
                            : childDailyCare.nap_quality}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-teal-50/90 border border-teal-200/70 p-3">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-teal-800">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{isThai ? 'การขับถ่าย' : 'Toilet'}</span>
                        </div>
                        <p className="text-sm font-black text-slate-900 mt-1">
                          {childDailyCare.toilet_count}{' '}
                          {isThai ? 'ครั้ง' : 'times'}
                        </p>
                        <p className="text-[11px] text-teal-800 truncate">
                          {childDailyCare.toilet_note}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-emerald-50/90 border border-emerald-200/70 p-3">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                          <Thermometer className="w-4 h-4" />
                          <span>{isThai ? 'อุณหภูมิร่างกาย' : 'Body Temp'}</span>
                        </div>
                        <p className="text-sm font-black text-emerald-800 mt-1">
                          {childDailyCare.temperature_c}°C
                        </p>
                        <p className="text-[11px] text-emerald-700">
                          {isThai ? 'ปกติ ไม่มีไข้' : 'Normal'}
                        </p>
                      </div>
                    </div>

                    {/* Learning Activity, Home Suggestion & Teacher Note */}
                    <div className="sv-adaptive-grid grid grid-cols-1 gap-3.5">
                      <div className="rounded-2xl bg-white p-4 border border-slate-200/80">
                        <h3 className="text-xs font-extrabold text-[#7B1C3E] uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>
                            {isThai
                              ? 'กิจกรรมเสริมประสบการณ์วันนี้'
                              : "Today's Learning Activity"}
                          </span>
                        </h3>
                        <p className="text-sm font-semibold text-slate-800 mt-1">
                          {childDailyCare.learning_activity}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-white p-4 border border-slate-200/80">
                        <h3 className="text-xs font-extrabold text-[#1B3A6B] uppercase tracking-wider flex items-center gap-1.5">
                          <BookOpen className="w-4 h-4 text-[#1B3A6B] shrink-0" />
                          <span>
                            {isThai
                              ? 'คำแนะนำชวนคุยต่อยอดที่บ้าน'
                              : 'Home Connection Suggestion'}
                          </span>
                        </h3>
                        <p className="text-sm font-semibold text-slate-800 mt-1">
                          {childDailyCare.home_suggestion}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-pink-50/60 p-4 border border-pink-200/80">
                        <h3 className="text-xs font-extrabold text-[#7B1C3E] uppercase tracking-wider flex items-center gap-1.5">
                          <MessageSquare className="w-4 h-4 text-[#7B1C3E] shrink-0" />
                          <span>
                            {isThai
                              ? 'บันทึกจากครูแนนถึงคุณแม่'
                              : "Teacher Nan's Daily Note"}
                          </span>
                        </h3>
                        <p className="text-sm font-semibold text-slate-800 mt-1">
                          “{childDailyCare.teacher_note}”
                        </p>
                      </div>
                    </div>
                  </section>
                )}
              </div>
            ) : (
              /* PRIMARY EXPERIENCE (น้องกัปตัน ป.4/1): Homework & Assignments + Timetable */
              <div className="space-y-5">
                {/* Primary Card A: Homework & Assignments Due */}
                <section className="sv-glass-card rounded-3xl p-4 sm:p-6 border border-blue-200/80 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-extrabold bg-blue-100 text-[#1B3A6B]">
                        <BookOpen className="w-3.5 h-3.5" />
                        {isThai
                          ? 'การบ้านและชิ้นงานประถมศึกษา (Homework & Assignments)'
                          : 'Primary Homework & Assignments'}
                      </span>
                      <h2 className="text-base sm:text-lg font-extrabold text-slate-900 mt-1">
                        {isThai
                          ? `รายการการบ้านและคะแนนชิ้นงานของ ${selectedChild.nickname} (${selectedChild.grade})`
                          : `Assignments & Scores for ${selectedChild.nickname}`}
                      </h2>
                    </div>
                    <Link
                      href="/academic/assignments"
                      className="text-xs font-bold text-[#1B3A6B] hover:underline inline-flex items-center gap-1"
                    >
                      <span>
                        {isThai
                          ? 'ดูหน้าสั่งการบ้านของครู (/academic/assignments)'
                          : 'View Staff Assignments Portal'}
                      </span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  <div className="sv-adaptive-grid grid grid-cols-1 gap-3.5">
                    {childAssignments.map((asg) => (
                      <div
                        key={asg.id}
                        className="rounded-2xl bg-white p-4 border border-slate-200/90 shadow-sm flex flex-col justify-between gap-3"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-extrabold text-[#1B3A6B]">
                              {asg.subject_name}
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                                asg.submission_status === 'SUBMITTED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {asg.submission_status === 'SUBMITTED'
                                ? isThai
                                  ? `ส่งแล้ว • ${asg.score}/${asg.max_score} คะแนน`
                                  : `Submitted • ${asg.score}/${asg.max_score}`
                                : isThai
                                ? 'รอส่งงาน (PENDING)'
                                : 'Pending Submission'}
                            </span>
                          </div>

                          <h3 className="font-extrabold text-sm text-slate-900">
                            {isThai ? asg.title_th : asg.title_en}
                          </h3>
                          <p className="text-xs text-slate-600">
                            {asg.description}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-slate-100 space-y-1 text-xs">
                          <div className="flex items-center justify-between text-slate-500">
                            <span>
                              {isThai ? 'กำหนดส่ง:' : 'Due:'}{' '}
                              <strong className="text-slate-800">
                                {asg.due_date}
                              </strong>
                            </span>
                            <span>{asg.assigned_by}</span>
                          </div>
                          {asg.teacher_feedback && (
                            <p className="text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1.5 rounded-xl mt-1 flex items-center gap-1.5">
                              <MessageSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>{asg.teacher_feedback}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Primary Card B: Today's Timetable & Learning Highlights */}
                <section className="sv-glass-card rounded-3xl p-4 sm:p-6 border border-slate-200/90 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-extrabold bg-indigo-100 text-indigo-900">
                        <CalendarDays className="w-3.5 h-3.5" />
                        {isThai
                          ? 'ตารางเรียนวันนี้และสาระสำคัญ (Primary Daily Timetable)'
                          : "Today's Primary Class Schedule"}
                      </span>
                      <h2 className="text-base sm:text-lg font-extrabold text-slate-900 mt-1">
                        {isThai
                          ? `ตารางเรียนชั้น ${selectedChild.grade} • ครูประจำชั้น: ${selectedChild.homeroom_teacher}`
                          : `Class ${selectedChild.grade} Schedule`}
                      </h2>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {PRIMARY_TIMETABLE_TODAY.map((slot, idx) => (
                      <div
                        key={idx}
                        className="rounded-2xl bg-white p-3.5 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-lg text-xs font-extrabold bg-slate-100 text-slate-800">
                              {slot.period}
                            </span>
                            <span className="font-extrabold text-sm text-[#1B3A6B]">
                              {isThai ? slot.subject_th : slot.subject_en}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1">
                            {isThai ? slot.topic_th : slot.topic_en}
                          </p>
                        </div>
                        <div className="text-xs text-slate-500 sm:text-right">
                          <p className="font-semibold text-slate-700">
                            {slot.teacher}
                          </p>
                          <p>{slot.room}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}
          </div>
        )}

        {/* ==================================================================
            TAB 2: MESSAGES (ข้อความ — Two-Way Teacher & School Chat)
            ================================================================== */}
        {activeTab === 'messages' && (
          <section className="sv-glass-card rounded-3xl p-4 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-extrabold bg-[#7B1C3E]/10 text-[#7B1C3E]">
                  <MessageCircle className="w-3.5 h-3.5" />
                  {isThai
                    ? 'สนทนาสองทางกับครูประจำชั้น (Two-Way Teacher Chat)'
                    : 'Two-Way Homeroom Teacher Chat'}
                </span>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 mt-1">
                  {childThread?.teacher_name || selectedChild.homeroom_teacher}{' '}
                  • {selectedChild.nickname} ({selectedChild.grade})
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setShowEnglishTranslation((prev) => !prev)
                  }
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                    showEnglishTranslation
                      ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                      : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>
                    {isThai
                      ? showEnglishTranslation
                        ? 'แสดงคำแปล EN คู่ขนาน'
                        : 'เปิดคำแปลภาษาอังกฤษ'
                      : 'Bilingual TH/EN View'}
                  </span>
                </button>

                <Link
                  href="/admin/communications"
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#1B3A6B] text-white hover:bg-[#142c52] inline-flex items-center gap-1"
                >
                  <span>
                    {isThai
                      ? 'เปิดกล่องข้อความฝั่งครู (/admin/communications)'
                      : 'Open Staff Chat Portal'}
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Office Hours / Quiet Hours Policy Banner */}
            <div className="rounded-2xl bg-amber-50/90 border border-amber-200 px-4 py-2.5 flex items-center justify-between gap-2 text-xs text-amber-900">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  {childThread?.office_hours_note ||
                    (isThai
                      ? 'เวลาทำการตอบกลับ: จันทร์-ศุกร์ 07:30 - 17:00 น. (กรณีฉุกเฉินติดต่อห้องธุรการ 038-311-xxx)'
                      : 'Office Hours: Mon-Fri 07:30 - 17:00')}
                </span>
              </div>
              <span className="font-bold shrink-0">07:30 - 17:00 น.</span>
            </div>

            {/* Messages List */}
            <div className="space-y-3 max-h-[55dvh] overflow-y-auto pr-1">
              {childMessages.map((msg) => {
                const isParent = msg.sender_type === 'PARENT';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      isParent ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-2xl rounded-3xl p-4 space-y-2 shadow-sm border ${
                        isParent
                          ? 'bg-[#7B1C3E] text-white border-[#7B1C3E]'
                          : 'bg-white text-slate-900 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 text-[11px] opacity-85">
                        <span className="font-bold">{msg.sender_name}</span>
                        <span>
                          {new Date(msg.created_at).toLocaleTimeString(
                            'th-TH',
                            { hour: '2-digit', minute: '2-digit' }
                          )}{' '}
                          น.
                        </span>
                      </div>

                      <p className="text-sm leading-relaxed">{msg.body_th}</p>

                      {showEnglishTranslation && msg.body_en && (
                        <p
                          className={`text-xs pt-2 border-t flex items-start gap-1.5 ${
                            isParent
                              ? 'border-white/20 text-white/90'
                              : 'border-slate-100 text-slate-600'
                          }`}
                        >
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200/80 text-slate-700 shrink-0">
                            EN
                          </span>
                          <span>{msg.body_en}</span>
                        </p>
                      )}

                      {/* 1-Click Teacher Message Acknowledgement */}
                      {msg.require_acknowledgement && (
                        <div className="pt-2">
                          {msg.acknowledged_at ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {isThai
                                ? 'ผู้ปกครองกดรับทราบข้อความแล้ว'
                                : 'Acknowledged by Parent'}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                handleAcknowledgeTeacherMessage(msg.id)
                              }
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-[#7B1C3E] text-white hover:bg-[#5e152f] shadow-sm cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>
                                {isThai
                                  ? 'รับทราบข้อความครู (Acknowledge)'
                                  : 'Acknowledge Teacher Message'}
                              </span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Send Message Form */}
            <form
              onSubmit={handleSendMessage}
              className="flex items-center gap-2 pt-2 border-t border-slate-200/80"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={
                  isThai
                    ? `พิมพ์ข้อความถึง ${selectedChild.homeroom_teacher}...`
                    : `Write a message to ${selectedChild.homeroom_teacher}...`
                }
                className="flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium focus:border-[#7B1C3E] focus:outline-none"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#7B1C3E] hover:bg-[#5e152f] text-white font-extrabold text-xs sm:text-sm shadow-sm transition-all cursor-pointer shrink-0"
              >
                <Send className="w-4 h-4" />
                <span>{isThai ? 'ส่งข้อความ' : 'Send'}</span>
              </button>
            </form>
          </section>
        )}

        {/* ==================================================================
            TAB 3: CALENDAR (ปฏิทิน — Unified Family & Academic Calendar + .ics)
            ================================================================== */}
        {activeTab === 'calendar' && (
          <section className="sv-glass-card rounded-3xl p-4 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-extrabold bg-indigo-100 text-indigo-900">
                  <CalendarDays className="w-3.5 h-3.5" />
                  {isThai
                    ? 'ปฏิทินการศึกษาและกิจกรรมครอบครัว (Unified Family Calendar)'
                    : 'Unified Family & School Calendar'}
                </span>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 mt-1">
                  {isThai
                    ? `กำหนดการสำคัญของ ${selectedChild.nickname} (${selectedChild.grade}) และโรงเรียนสมคิดวิทยา`
                    : `Upcoming Events & Deadlines for ${selectedChild.nickname}`}
                </h2>
              </div>

              <button
                type="button"
                onClick={handleDownloadIcsCalendar}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#7B1C3E] hover:bg-[#5e152f] text-white font-extrabold text-xs sm:text-sm shadow-sm transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>
                  {isThai
                    ? 'ซิงค์เข้าปฏิทินมือถือ (Download iCal .ics)'
                    : 'Download iCal (.ics)'}
                </span>
              </button>
            </div>

            <div className="sv-adaptive-grid grid grid-cols-1 gap-3.5">
              {[
                {
                  date: '22 ต.ค. 2569',
                  type_th: 'กำหนดส่งการบ้าน',
                  type_en: 'Assignment Due',
                  title_th: isEarlyYears
                    ? 'กิจกรรมสำรวจใบไม้รอบบ้าน 3 ชนิด (อ.2/1)'
                    : 'ส่งแบบฝึกหัดคณิตศาสตร์ที่ 4.3 (ป.4/1)',
                  title_en: isEarlyYears
                    ? 'Family Nature Leaf Discovery (K.2/1)'
                    : 'Math Workbook Ex 4.3 Due (P.4/1)',
                  location: selectedChild.grade,
                  color: 'bg-blue-50 text-blue-800 border-blue-200',
                },
                {
                  date: '31 ต.ค. 2569',
                  type_th: 'ประชุมผู้ปกครอง',
                  type_en: 'Parent-Teacher Conference',
                  title_th:
                    'วันพบครูประจำชั้นและรับสมุดรายงานพัฒนาการปฐมวัย / ปพ.6',
                  title_en:
                    'Semester Parent-Teacher Conference & Portfolio Review',
                  location: 'หอประชุมสมคิดวิทยา เวลา 09:00 - 12:00 น.',
                  color: 'bg-rose-50 text-[#7B1C3E] border-rose-200',
                },
                {
                  date: '4 พ.ย. 2569',
                  type_th: 'ตรวจสุขภาพประจำปี',
                  type_en: 'School Health Checkup',
                  title_th:
                    'ตรวจสุขภาพประจำปี ชั่งน้ำหนัก-วัดส่วนสูง และเคลือบฟลูออไรด์',
                  title_en: 'Annual Pediatric Health & Dental Fluoride Checkup',
                  location: 'ห้องพยาบาลโรงเรียนสมคิดวิทยา',
                  color: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                },
                {
                  date: '5 พ.ย. 2569',
                  type_th: 'กำหนดชำระค่าธรรมเนียม',
                  type_en: 'Tuition Due Date',
                  title_th:
                    'วันครบกำหนดชำระค่าธรรมเนียมการศึกษา ภาคเรียนที่ 2/2569',
                  title_en: 'Semester 2/2026 Tuition Fee Due Date',
                  location: 'ชำระผ่าน QR PromptPay ในแอปผู้ปกครอง',
                  color: 'bg-amber-50 text-amber-900 border-amber-200',
                },
                {
                  date: '12 พ.ย. 2569',
                  type_th: 'กิจกรรมวัฒนธรรม',
                  type_en: 'Cultural Activity',
                  title_th:
                    'กิจกรรมสืบสานประเพณีลอยกระทงรักษ์โลก (ประดิษฐ์กระทงวัสดุธรรมชาติ)',
                  title_en: 'Eco-Friendly Loy Krathong Workshop',
                  location: 'ลานอเนกประสงค์โรงเรียนสมคิดวิทยา',
                  color: 'bg-purple-50 text-purple-900 border-purple-200',
                },
                {
                  date: '18 ธ.ค. 2569',
                  type_th: 'กีฬาสีสัมพันธ์',
                  type_en: 'Sports Day',
                  title_th:
                    'งานกีฬาสีภายใน “สมคิดวิทยาเกมส์” และขบวนพาเหรดผู้ปกครอง-นักเรียน',
                  title_en: 'Somkidvittaya Annual Family Sports Day',
                  location: 'สนามกีฬาโรงเรียนสมคิดวิทยา',
                  color: 'bg-teal-50 text-teal-900 border-teal-200',
                },
              ].map((ev, i) => (
                <div
                  key={i}
                  className="rounded-2xl bg-white p-4 border border-slate-200/90 shadow-sm flex flex-col justify-between gap-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold border ${ev.color}`}
                    >
                      {isThai ? ev.type_th : ev.type_en}
                    </span>
                    <span className="text-xs font-black text-slate-900">
                      {ev.date}
                    </span>
                  </div>
                  <h3 className="font-extrabold text-sm text-slate-900">
                    {isThai ? ev.title_th : ev.title_en}
                  </h3>
                  <p className="text-xs text-slate-500">{ev.location}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ==================================================================
            TAB 4: CHILDREN (บุตรหลาน 360° — Leave, Academics, Health, Pickup)
            ================================================================== */}
        {activeTab === 'children' && (
          <div className="space-y-4">
            {/* Sub-tab Selector */}
            <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200/90 shadow-sm">
              {[
                {
                  id: 'leave' as ChildrenSubTabId,
                  label_th: 'A. แจ้งลาเรียนออนไลน์ & ประวัติมาเรียน',
                  label_en: 'A. Online Leave & Attendance',
                  icon: UserCheck,
                },
                {
                  id: 'academics' as ChildrenSubTabId,
                  label_th: isEarlyYears
                    ? 'B. พัฒนาการปฐมวัย 4 ด้าน'
                    : 'B. ผลการเรียน ปพ.6',
                  label_en: isEarlyYears
                    ? 'B. 4-Domain Milestones'
                    : 'B. P.P.6 Report Card',
                  icon: Award,
                },
                {
                  id: 'health' as ChildrenSubTabId,
                  label_th: 'C. สุขภาพ & ฝากห้องพยาบาลป้อนยา',
                  label_en: 'C. Health & Infirmary Meds',
                  icon: Stethoscope,
                },
                {
                  id: 'pickup' as ChildrenSubTabId,
                  label_th: 'D. ผู้มีสิทธิ์รับ-ส่ง & รหัส OTP มอบอำนาจ',
                  label_en: 'D. Collectors & Delegate OTP',
                  icon: QrCode,
                },
              ].map((st) => {
                const Icon = st.icon;
                const active = childrenSubTab === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setChildrenSubTab(st.id)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                      active
                        ? 'bg-[#7B1C3E] text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{isThai ? st.label_th : st.label_en}</span>
                  </button>
                );
              })}
            </div>

            {/* SUB-TAB A: แจ้งลาเรียนออนไลน์ & ประวัติการมาเรียน */}
            {childrenSubTab === 'leave' && (
              <div className="sv-adaptive-grid grid grid-cols-1 gap-4">
                <form
                  onSubmit={handleLeaveSubmit}
                  className="sv-glass-card rounded-3xl p-4 sm:p-6 space-y-3.5"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-extrabold text-slate-900">
                      {isThai
                        ? `ส่งใบลาเรียนออนไลน์ (${selectedChild.nickname})`
                        : `Submit Leave Request (${selectedChild.nickname})`}
                    </h3>
                    <Link
                      href="/admin/students/attendance"
                      className="text-xs font-bold text-[#7B1C3E] hover:underline inline-flex items-center gap-1"
                    >
                      <span>
                        {isThai ? 'คิวอนุมัติฝั่งครู' : 'Staff Leave Queue'}
                      </span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700">
                      {isThai ? 'ประเภทการลา' : 'Leave Type'}
                    </label>
                    <select
                      value={leaveType}
                      onChange={(e) =>
                        setLeaveType(e.target.value as LeaveRequestType)
                      }
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"
                    >
                      <option value="SICK_LEAVE">
                        {isThai ? 'ลาป่วย (SICK_LEAVE)' : 'Sick Leave'}
                      </option>
                      <option value="PERSONAL_LEAVE">
                        {isThai ? 'ลากิจ (PERSONAL_LEAVE)' : 'Personal Leave'}
                      </option>
                      <option value="EARLY_PICKUP">
                        {isThai
                          ? 'ขอรับกลับก่อนเวลา (EARLY_PICKUP)'
                          : 'Early Pickup'}
                      </option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700">
                        {isThai ? 'ตั้งแต่วันที่' : 'Start Date'}
                      </label>
                      <input
                        type="date"
                        value={leaveStartDate}
                        onChange={(e) => setLeaveStartDate(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700">
                        {isThai ? 'ถึงวันที่' : 'End Date'}
                      </label>
                      <input
                        type="date"
                        value={leaveEndDate}
                        onChange={(e) => setLeaveEndDate(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700">
                      {isThai
                        ? 'สาเหตุการลา / รายละเอียดแจ้งครูประจำชั้น'
                        : 'Reason / Details for Homeroom Teacher'}
                    </label>
                    <textarea
                      rows={3}
                      value={leaveReason}
                      onChange={(e) => setLeaveReason(e.target.value)}
                      placeholder={
                        isThai
                          ? 'ระบุอาการป่วยหรือธุระจำเป็น เช่น พาน้องไปพบทันตแพทย์...'
                          : 'Enter reason for leave...'
                      }
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-2xl bg-[#7B1C3E] hover:bg-[#5e152f] text-white font-extrabold text-xs sm:text-sm shadow-sm cursor-pointer"
                  >
                    {isThai
                      ? 'ยืนยันส่งใบลาเรียนออนไลน์'
                      : 'Submit Leave Request'}
                  </button>
                </form>

                {/* Leave History & Status List */}
                <div className="sv-glass-card rounded-3xl p-4 sm:p-6 space-y-3">
                  <h3 className="text-base font-extrabold text-slate-900">
                    {isThai
                      ? 'สถานะใบลาออนไลน์และผลการพิจารณาจากครูประจำชั้น'
                      : 'Submitted Leave Requests & Approval Status'}
                  </h3>

                  {childLeaveRequests.length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center">
                      {isThai
                        ? 'ยังไม่มีประวัติการส่งใบลาออนไลน์ของนักเรียนคนนี้'
                        : 'No leave requests submitted yet.'}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {childLeaveRequests.map((lv) => (
                        <div
                          key={lv.id}
                          className="rounded-2xl bg-white p-3.5 border border-slate-200 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-extrabold text-slate-900">
                              {lv.leave_type} • {lv.start_date} - {lv.end_date}
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                                lv.status === 'APPROVED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : lv.status === 'REJECTED'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {lv.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700">{lv.reason}</p>
                          {lv.review_note && (
                            <p className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>{lv.reviewed_by}: {lv.review_note}</span>
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SUB-TAB B: พัฒนาการปฐมวัย 4 ด้าน / ผลการเรียน ปพ.6 */}
            {childrenSubTab === 'academics' && (
              <div className="sv-glass-card rounded-3xl p-4 sm:p-6 space-y-4">
                {/* Policy Guarantee Badge */}
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-emerald-900 text-xs font-extrabold">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      {isThai
                        ? 'สิทธิ์การดูผลพัฒนาการและผลการเรียนไม่ถูกระงับแม้มีรายการค้างชำระ (Protected Child Right)'
                        : 'Protected Child Right: Academic & Developmental Reports are never blocked by unpaid fees'}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700">
                    OPEC Child-First Policy
                  </span>
                </div>

                {isEarlyYears ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-base font-extrabold text-slate-900">
                        {isThai
                          ? `ประเมินพัฒนาการปฐมวัย 4 ด้าน ตามหลักสูตรการศึกษาปฐมวัย (${selectedChild.nickname})`
                          : `4-Domain Early Childhood Developmental Milestones (${selectedChild.nickname})`}
                      </h3>
                      <span className="px-3 py-1 rounded-xl text-xs font-extrabold bg-pink-100 text-[#7B1C3E]">
                        WHO Growth: {selectedChild.height_cm} ซม. •{' '}
                        {selectedChild.weight_kg} กก. (สมส่วนตามเกณฑ์)
                      </span>
                    </div>

                    <div className="sv-adaptive-grid grid grid-cols-1 gap-3.5">
                      {childMilestones.map((ms) => (
                        <div
                          key={ms.id}
                          className="rounded-2xl bg-white p-4 border border-slate-200 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold text-[#7B1C3E]">
                              {isThai ? ms.domain_th : ms.domain_en}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800">
                              {isThai
                                ? `ระดับ ${ms.rating}/3 (ดีมาก)`
                                : `Level ${ms.rating}/3 (Excellent)`}
                            </span>
                          </div>
                          <p className="text-sm font-bold text-slate-900">
                            {isThai ? ms.indicator_th : ms.indicator_en}
                          </p>
                          <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>{ms.teacher_comment}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-base font-extrabold text-slate-900">
                        {isThai
                          ? `สมุดรายงานผลการเรียนรายวิชา (ปพ.6) • ${selectedChild.nickname} (${selectedChild.grade})`
                          : `Primary Subject Grade Summary (P.P.6) • ${selectedChild.nickname}`}
                      </h3>
                      <span className="px-3 py-1 rounded-xl text-xs font-extrabold bg-blue-100 text-[#1B3A6B]">
                        GPAX: {selectedChild.gpa_or_assessment}
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                      <table className="w-full text-left border-collapse text-xs sm:text-sm">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-200">
                            <th className="p-3">
                              {isThai ? 'รหัส/รายวิชา' : 'Subject'}
                            </th>
                            <th className="p-3">
                              {isThai ? 'ครูผู้สอน' : 'Teacher'}
                            </th>
                            <th className="p-3 text-center">
                              {isThai ? 'คะแนนเก็บ (50)' : 'Accum (50)'}
                            </th>
                            <th className="p-3 text-center">
                              {isThai ? 'กลางภาค (20)' : 'Midterm (20)'}
                            </th>
                            <th className="p-3 text-center">
                              {isThai ? 'ปลายภาค (30)' : 'Final (30)'}
                            </th>
                            <th className="p-3 text-center">
                              {isThai ? 'รวม (100)' : 'Total (100)'}
                            </th>
                            <th className="p-3 text-center">
                              {isThai ? 'ระดับผลการเรียน' : 'Grade'}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {childGrades.map((g) => (
                            <tr
                              key={g.subject_code}
                              className="hover:bg-slate-50"
                            >
                              <td className="p-3 font-bold text-slate-900">
                                {g.subject_code} •{' '}
                                {isThai ? g.subject_name_th : g.subject_name_en}
                              </td>
                              <td className="p-3 text-slate-600">
                                {g.teacher_name}
                              </td>
                              <td className="p-3 text-center font-semibold">
                                {g.accumulated_score}/{g.max_accumulated}
                              </td>
                              <td className="p-3 text-center font-semibold">
                                {g.midterm_score}/{g.max_midterm}
                              </td>
                              <td className="p-3 text-center font-semibold">
                                {g.final_score}/{g.max_final}
                              </td>
                              <td className="p-3 text-center font-extrabold text-[#1B3A6B]">
                                {g.total_score}
                              </td>
                              <td className="p-3 text-center">
                                <span className="px-2.5 py-0.5 rounded-lg font-extrabold bg-emerald-100 text-emerald-800">
                                  {g.grade_label}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SUB-TAB C: สุขภาพ & ฝากห้องพยาบาลป้อนยาออนไลน์ */}
            {childrenSubTab === 'health' && (
              <div className="space-y-4">
                {/* Child Health Profile & Drug Allergy Guard Banner */}
                <div className="sv-glass-card rounded-3xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 border border-rose-200">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-rose-600 text-white">
                        Drug & Food Allergy Guard
                      </span>
                      <span className="text-xs font-bold text-slate-600">
                        {isThai ? 'หมู่เลือด:' : 'Blood Group:'}{' '}
                        <strong>{selectedChild.blood_group}</strong> •{' '}
                        {selectedChild.height_cm} cm / {selectedChild.weight_kg}{' '}
                        kg
                      </span>
                    </div>
                    <p className="text-sm font-extrabold text-slate-900">
                      {isThai ? 'ประวัติภูมิแพ้:' : 'Allergies:'}{' '}
                      <span className="text-rose-700">
                        {selectedChild.allergies}
                      </span>{' '}
                      • {isThai ? 'โรคประจำตัว:' : 'Conditions:'}{' '}
                      {selectedChild.medical_conditions}
                    </p>
                  </div>

                  <Link
                    href="/admin/health/infirmary"
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 inline-flex items-center gap-1.5"
                  >
                    <Stethoscope className="w-4 h-4" />
                    <span>
                      {isThai
                        ? 'ดูหน้าห้องพยาบาล (/admin/health/infirmary)'
                        : 'Open School Infirmary'}
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="sv-adaptive-grid grid grid-cols-1 gap-4">
                  {/* Online Medication Administration Request Form */}
                  <form
                    onSubmit={handleMedicationSubmit}
                    className="sv-glass-card rounded-3xl p-4 sm:p-6 space-y-3.5"
                  >
                    <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                      <Pill className="w-4 h-4 text-[#7B1C3E]" />
                      <span>
                        {isThai
                          ? `แบบฟอร์มฝากครูพยาบาลป้อนยาออนไลน์ (${selectedChild.nickname})`
                          : `Online Medication Administration Consent (${selectedChild.nickname})`}
                      </span>
                    </h3>

                    <div>
                      <label className="text-xs font-bold text-slate-700">
                        {isThai
                          ? 'ชื่อยา (ระบุตามฉลากยาของแพทย์/เภสัชกร)'
                          : 'Medication Name'}
                      </label>
                      <input
                        type="text"
                        value={medName}
                        onChange={(e) => setMedName(e.target.value)}
                        placeholder={
                          isThai
                            ? 'เช่น ยาลดน้ำมูก Cetirizine Syrup / ยาละลายเสมหะ'
                            : 'e.g., Cetirizine Syrup 5ml'
                        }
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-700">
                          {isThai ? 'ขนาดยา / ปริมาณ' : 'Dosage'}
                        </label>
                        <input
                          type="text"
                          value={medDosage}
                          onChange={(e) => setMedDosage(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700">
                          {isThai ? 'เวลาที่ให้ป้อน' : 'Schedule Time'}
                        </label>
                        <input
                          type="time"
                          value={medScheduleTime}
                          onChange={(e) => setMedScheduleTime(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700">
                        {isThai ? 'ช่วงเวลามื้ออาหาร' : 'Meal Timing'}
                      </label>
                      <select
                        value={medMealTiming}
                        onChange={(e) =>
                          setMedMealTiming(
                            e.target.value as MedicationMealTiming
                          )
                        }
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"
                      >
                        <option value="AFTER_MEAL">
                          {isThai
                            ? 'หลังอาหาร (AFTER_MEAL)'
                            : 'After Meal'}
                        </option>
                        <option value="BEFORE_MEAL">
                          {isThai
                            ? 'ก่อนอาหาร (BEFORE_MEAL)'
                            : 'Before Meal'}
                        </option>
                        <option value="WITH_MEAL">
                          {isThai
                            ? 'พร้อมมื้ออาหาร (WITH_MEAL)'
                            : 'With Meal'}
                        </option>
                        <option value="AS_NEEDED">
                          {isThai
                            ? 'เมื่อมีอาการ (AS_NEEDED)'
                            : 'As Needed'}
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700">
                        {isThai
                          ? 'อาการของนักเรียน / เหตุผลที่ฝากป้อนยา'
                          : 'Symptoms / Reason'}
                      </label>
                      <input
                        type="text"
                        value={medReason}
                        onChange={(e) => setMedReason(e.target.value)}
                        placeholder={
                          isThai
                            ? 'ระบุอาการ เช่น มีน้ำมูกใสเล็กน้อย ไม่มีไข้'
                            : 'Describe symptoms...'
                        }
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>

                    <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={medSignatureConfirmed}
                        onChange={(e) =>
                          setMedSignatureConfirmed(e.target.checked)
                        }
                        className="mt-0.5 rounded border-slate-300"
                      />
                      <span>
                        {isThai
                          ? `ข้าพเจ้า (${pipeline.guardian.full_name}) ยืนยันลายมือชื่ออิเล็กทรอนิกส์อนุญาตให้ครูพยาบาลป้อนยาตามขนาดที่ระบุ`
                          : `I (${pipeline.guardian.full_name}) digitally sign and authorize the school nurse to administer this medication.`}
                      </span>
                    </label>

                    <button
                      type="submit"
                      className="w-full py-2.5 rounded-2xl bg-[#7B1C3E] hover:bg-[#5e152f] text-white font-extrabold text-xs sm:text-sm shadow-sm cursor-pointer"
                    >
                      {isThai
                        ? 'ลงนามและส่งคำร้องฝากป้อนยาออนไลน์'
                        : 'Sign & Submit Medication Request'}
                    </button>
                  </form>

                  {/* Live Medication & Incident History */}
                  <div className="sv-glass-card rounded-3xl p-4 sm:p-6 space-y-3">
                    <h3 className="text-base font-extrabold text-slate-900">
                      {isThai
                        ? 'สถานะการป้อนยาและบันทึกห้องพยาบาลวันนี้'
                        : 'Medication Administration & Infirmary Log'}
                    </h3>

                    {childMedicationRequests.map((med) => (
                      <div
                        key={med.id}
                        className="rounded-2xl bg-white p-3.5 border border-slate-200 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 font-extrabold text-xs text-slate-900">
                            <Pill className="w-3.5 h-3.5 text-[#7B1C3E] shrink-0" />
                            <span>{med.medication_name} ({med.dosage})</span>
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                              med.status === 'ADMINISTERED_TODAY'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {med.status === 'ADMINISTERED_TODAY'
                              ? isThai
                                ? 'ป้อนยาเรียบร้อยแล้ว'
                                : 'Administered Today'
                              : isThai
                              ? 'รอป้อนยาตามเวลา'
                              : 'Scheduled'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">
                          {isThai ? 'เวลา:' : 'Time:'}{' '}
                          {med.schedule_times.join(', ')} ({med.meal_timing}) •{' '}
                          {med.reason}
                        </p>
                        {med.nurse_note && (
                          <p className="text-xs font-semibold text-emerald-800 bg-emerald-50 p-2 rounded-xl flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>{med.last_administered_by}: {med.nurse_note}</span>
                          </p>
                        )}
                      </div>
                    ))}

                    {childAllIncidents.map((inc) => (
                      <div
                        key={inc.id}
                        className="rounded-2xl bg-rose-50/70 p-3.5 border border-rose-200 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 font-extrabold text-xs text-rose-900">
                            <HeartPulse className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span>{inc.incident_date} เวลา {inc.incident_time} น.</span>
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-white text-rose-800 border border-rose-200">
                            {inc.parent_acknowledged
                              ? isThai
                                ? 'ผู้ปกครองรับทราบแล้ว'
                                : 'Acknowledged'
                              : isThai
                              ? 'รอผู้ปกครองรับทราบ'
                              : 'Pending Ack'}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-900">
                          {inc.description}
                        </p>
                        <p className="text-xs text-slate-600">
                          {inc.first_aid_given}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* SUB-TAB D: ผู้มีสิทธิ์รับ-ส่ง & รหัส OTP มอบอำนาจชั่วคราว */}
            {childrenSubTab === 'pickup' && (
              <div className="sv-adaptive-grid grid grid-cols-1 gap-4">
                <form
                  onSubmit={handleSavePickupCollector}
                  className="sv-glass-card rounded-3xl p-4 sm:p-6 space-y-3.5"
                >
                  <h3 className="text-base font-extrabold text-slate-900">
                    {isThai
                      ? `จัดการผู้มีสิทธิ์รับ-ส่งวันนี้ (${selectedChild.nickname})`
                      : `Manage Today's Pickup Collector (${selectedChild.nickname})`}
                  </h3>

                  <div>
                    <label className="text-xs font-bold text-slate-700">
                      {isThai ? 'รูปแบบการเดินทางกลับ' : 'Transport Mode'}
                    </label>
                    <select
                      value={collectorTransportMode}
                      onChange={(e) =>
                        setCollectorTransportMode(
                          e.target.value as TransportMode
                        )
                      }
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"
                    >
                      <option value="PARENT_PICKUP">
                        {isThai
                          ? 'ผู้ปกครองรับ-ส่งเอง (PARENT_PICKUP)'
                          : 'Parent Pickup'}
                      </option>
                      <option value="SCHOOL_VAN">
                        {isThai
                          ? 'รถตู้รับ-ส่งโรงเรียน (SCHOOL_VAN)'
                          : 'School Van'}
                      </option>
                      <option value="AFTER_SCHOOL">
                        {isThai
                          ? 'เรียนพิเศษหลังเลิกเรียน (AFTER_SCHOOL)'
                          : 'After-School Care'}
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700">
                      {isThai
                        ? 'ชื่อ-นามสกุลผู้มารับนักเรียนวันนี้'
                        : 'Authorized Collector Name'}
                    </label>
                    <input
                      type="text"
                      value={collectorName}
                      onChange={(e) => setCollectorName(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700">
                        {isThai ? 'ความสัมพันธ์' : 'Relationship'}
                      </label>
                      <input
                        type="text"
                        value={collectorRelation}
                        onChange={(e) => setCollectorRelation(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700">
                        {isThai ? 'เบอร์โทรศัพท์ติดต่อ' : 'Phone Number'}
                      </label>
                      <input
                        type="text"
                        value={collectorPhone}
                        onChange={(e) => setCollectorPhone(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700">
                      {isThai
                        ? 'หมายเหตุจุดนัดรับแจ้งครูเวรประตู'
                        : 'Pickup Gate Notes'}
                    </label>
                    <input
                      type="text"
                      value={collectorNotes}
                      onChange={(e) => setCollectorNotes(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-2xl bg-[#1B3A6B] hover:bg-[#142c52] text-white font-extrabold text-xs sm:text-sm shadow-sm cursor-pointer"
                  >
                    {isThai
                      ? 'บันทึกข้อมูลผู้รับนักเรียนวันนี้'
                      : 'Save Daily Pickup Plan'}
                  </button>
                </form>

                {/* Temporary Delegate Pickup OTP Generator Card */}
                <div className="sv-glass-card rounded-3xl p-4 sm:p-6 flex flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-extrabold bg-amber-100 text-amber-900">
                      <Lock className="w-3.5 h-3.5" />
                      {isThai
                        ? 'รหัส OTP มอบอำนาจรับแทนชั่วคราว (Delegate Pickup OTP)'
                        : 'Temporary Delegate Pickup OTP'}
                    </span>
                    <h3 className="text-base font-extrabold text-slate-900">
                      {isThai
                        ? 'กรณีให้คุณปู่ คุณย่า คุณตา คุณยาย หรือญาติมารับแทนเฉพาะกิจ'
                        : 'One-Time Delegate Code for Grandparents / Relatives'}
                    </h3>
                    <p className="text-xs text-slate-600">
                      {isThai
                        ? 'รหัส OTP 6 หลักนี้สามารถส่งต่อทาง LINE ให้ญาติเพื่อใช้แสดงต่อครูเวรที่จุดรับ-ส่งหน้าโรงเรียน (/admin/safety/pickup) ได้ทันที'
                        : 'Generate a 6-digit Delegate OTP that relatives can present at the Smart Pickup Kiosk.'}
                    </p>

                    <div className="rounded-2xl bg-slate-900 text-white p-4 text-center space-y-1">
                      <p className="text-[11px] text-slate-300">
                        {isThai
                          ? 'รหัส OTP มอบอำนาจรับแทนวันนี้'
                          : 'Active Delegate Pickup OTP'}
                      </p>
                      <p className="font-mono text-3xl font-black tracking-widest text-amber-300">
                        {childPickupPlan?.temp_otp_code || '------'}
                      </p>
                      <p className="text-xs text-slate-300">
                        {isThai ? 'ผู้รับ:' : 'Collector:'}{' '}
                        {childPickupPlan?.collector_name}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={handleGenerateDelegateOtp}
                      className="w-full py-2.5 rounded-2xl bg-[#7B1C3E] hover:bg-[#5e152f] text-white font-extrabold text-xs sm:text-sm shadow-sm cursor-pointer"
                    >
                      {isThai
                        ? 'ออกรหัส OTP มอบอำนาจรับแทน 6 หลักใหม่'
                        : 'Generate New 6-Digit Delegate OTP'}
                    </button>

                    <Link
                      href="/admin/safety/pickup"
                      className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5"
                    >
                      <span>
                        {isThai
                          ? 'ไปที่หน้าจุดรับ-ส่งเด็ก (/admin/safety/pickup) เพื่อทดสอบกรอกรหัส'
                          : 'Test OTP at Staff Pickup Kiosk'}
                      </span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================================================================
            TAB 5: MORE (การเงิน, กระเป๋าสหกรณ์, เรียนฟรี 15 ปี & PDPA Center)
            ================================================================== */}
        {activeTab === 'more' && (
          <div className="space-y-5">
            {/* Section 1: Tuition & Digital Receipts + Section 2: Student Co-op Wallet */}
            <div className="sv-adaptive-grid grid grid-cols-1 gap-4">
              {/* Card A: Tuition & Digital Receipts */}
              <div className="sv-glass-card rounded-3xl p-4 sm:p-6 space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-extrabold bg-indigo-100 text-indigo-900">
                      <CreditCard className="w-3.5 h-3.5" />
                      {isThai
                        ? 'ค่าธรรมเนียมการศึกษา & ใบเสร็จดิจิทัล'
                        : 'Tuition & Official e-Receipts'}
                    </span>
                    <h3 className="text-base font-extrabold text-slate-900 mt-1">
                      {selectedChild.nickname} ({selectedChild.grade})
                    </h3>
                  </div>
                </div>

                <div className="space-y-3">
                  {childInvoices.map((inv) => (
                    <div
                      key={inv.id}
                      className="rounded-2xl bg-white p-4 border border-slate-200/90 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-500">
                          {inv.term_label}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                            inv.status === 'paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {inv.status === 'paid'
                            ? isThai
                              ? `ชำระแล้ว (${inv.receipt_number})`
                              : `Paid (${inv.receipt_number})`
                            : isThai
                            ? 'รอชำระเงิน'
                            : 'Unpaid'}
                        </span>
                      </div>

                      <h4 className="font-extrabold text-sm text-slate-900">
                        {isThai ? inv.title_th : inv.title_en}
                      </h4>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <div>
                          <p className="text-lg font-black text-[#7B1C3E]">
                            {formatCurrency(inv.amount)}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {isThai ? 'ครบกำหนด:' : 'Due:'} {inv.due_date}
                          </p>
                        </div>

                        {inv.status === 'unpaid' ? (
                          <button
                            type="button"
                            onClick={() => setActiveInvoiceModal(inv)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#7B1C3E] hover:bg-[#5e152f] text-white font-extrabold text-xs shadow-sm cursor-pointer"
                          >
                            <QrCode className="w-4 h-4" />
                            <span>
                              {isThai
                                ? 'ชำระเงินผ่าน QR PromptPay'
                                : 'Pay via QR PromptPay'}
                            </span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setActiveInvoiceModal(inv)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-extrabold text-xs cursor-pointer"
                          >
                            <FileText className="w-4 h-4" />
                            <span>
                              {isThai ? 'ดูใบเสร็จดิจิทัล' : 'View e-Receipt'}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card B: Student Co-op Wallet & Allergen POS Block */}
              <div className="sv-glass-card rounded-3xl p-4 sm:p-6 space-y-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-extrabold bg-emerald-100 text-emerald-800">
                    <Wallet className="w-3.5 h-3.5" />
                    {isThai
                      ? 'กระเป๋าเงินดิจิทัลสหกรณ์โรงเรียน (Student Co-op Wallet)'
                      : 'Student Co-op Digital Wallet'}
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900 mt-1">
                    {isThai
                      ? `ยอดเงินคงเหลือและวงเงินใช้จ่ายของ ${selectedChild.nickname}`
                      : `Wallet Balance & Daily Limit (${selectedChild.nickname})`}
                  </h3>
                </div>

                <div className="rounded-2xl bg-gradient-to-r from-[#1B3A6B] to-[#285192] text-white p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-white/80">
                      {isThai ? 'ยอดเงินคงเหลือปัจจุบัน' : 'Current Balance'}
                    </p>
                    <p className="text-2xl sm:text-3xl font-black mt-0.5">
                      {formatCurrency(selectedChild.wallet_balance)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-white/80">
                      {isThai ? 'วงเงินใช้จ่ายต่อวัน' : 'Daily Limit'}
                    </p>
                    <p className="text-base font-extrabold">
                      {formatCurrency(selectedChild.wallet_daily_limit)} /{' '}
                      {isThai ? 'วัน' : 'day'}
                    </p>
                  </div>
                </div>

                {/* Allergen Auto-Block Indicator at Co-op POS */}
                <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-900 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-extrabold">
                      {isThai
                        ? `ระบบกรองภูมิแพ้อัตโนมัติที่จุดขายสหกรณ์ (POS Allergen Guard)`
                        : 'Co-op POS Allergen Auto-Block'}
                    </p>
                    <p className="mt-0.5">
                      {isThai
                        ? `บล็อกสินค้าที่มีส่วนผสม: ${selectedChild.allergies}`
                        : `Auto-blocking POS items containing: ${selectedChild.allergies}`}
                    </p>
                  </div>
                </div>

                {/* Quick Top-up Buttons */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-700">
                    {isThai
                      ? 'เติมเงินด่วนผ่าน PromptPay (Quick Top-up):'
                      : 'Quick Top-up via PromptPay:'}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[100, 300, 500].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => handleWalletTopup(amt)}
                        className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm shadow-sm transition-all cursor-pointer"
                      >
                        +{amt} ฿
                      </button>
                    ))}
                  </div>
                </div>

                {/* Daily Spending Limit Control */}
                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-700">
                      {isThai ? 'กำหนดวงเงิน/วัน:' : 'Set Daily Limit:'}
                    </label>
                    <input
                      type="number"
                      min={20}
                      max={500}
                      step={10}
                      value={customDailyLimit}
                      onChange={(e) =>
                        setCustomDailyLimit(Number(e.target.value))
                      }
                      className="w-24 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-extrabold"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveDailyLimit}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                  >
                    {isThai ? 'บันทึกวงเงิน' : 'Save Limit'}
                  </button>
                </div>
              </div>
            </div>

            {/* Section 3: 15-Year Free Education Subsidy (ลงนามรับเงินอุดหนุนเรียนฟรี 15 ปี สช.) */}
            <section className="sv-glass-card rounded-3xl p-4 sm:p-6 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-extrabold bg-teal-100 text-teal-900">
                    <HandCoins className="w-3.5 h-3.5" />
                    {isThai
                      ? 'โครงการเรียนฟรี 15 ปี อย่างมีคุณภาพ (สช. / OPEC Subsidy)'
                      : 'OPEC 15-Year Free Education Subsidy'}
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900 mt-1">
                    {isThai
                      ? `หลักฐานการรับเงินอุดหนุนค่าเครื่องแบบและอุปกรณ์การเรียน (${selectedChild.nickname})`
                      : `Subsidy Vouchers & e-Signatures (${selectedChild.nickname})`}
                  </h3>
                </div>
                <Link
                  href="/admin/subsidy/free15y"
                  className="text-xs font-bold text-teal-800 hover:underline inline-flex items-center gap-1"
                >
                  <span>
                    {isThai
                      ? 'ดูทะเบียนคุมใบสำคัญ อร.11 (/admin/subsidy/free15y)'
                      : 'Open Staff OPEC Subsidy Registry'}
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="sv-adaptive-grid grid grid-cols-1 gap-3.5">
                {childAllSubsidies.map((sub) => (
                  <div
                    key={sub.id}
                    className="rounded-2xl bg-white p-4 border border-slate-200 flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-500">
                          {sub.receipt_code} • {sub.semester}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                            sub.parent_signed
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {sub.parent_signed
                            ? isThai
                              ? 'ลงนามรับเงินแล้ว'
                              : 'Signed'
                            : isThai
                            ? 'รอผู้ปกครองลงนาม'
                            : 'Awaiting Signature'}
                        </span>
                      </div>
                      <h4 className="font-extrabold text-sm text-slate-900 mt-1">
                        {isThai ? sub.category_th : sub.category_en}
                      </h4>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className="text-base font-black text-teal-800">
                        {formatCurrency(sub.amount)}
                      </span>
                      {sub.parent_signed ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{sub.signed_by_name}</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSignSubsidy(sub.id)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#7B1C3E] hover:bg-[#5e152f] text-white font-extrabold text-xs cursor-pointer"
                        >
                          <FileSignature className="w-3.5 h-3.5" />
                          <span>
                            {isThai
                              ? 'ลงนามรับเงินอุดหนุนเรียนฟรี 15 ปี'
                              : 'e-Sign Subsidy'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Section 4: PDPA Granular Consent Center */}
            <section className="sv-glass-card rounded-3xl p-4 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-extrabold bg-[#7B1C3E]/10 text-[#7B1C3E]">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {isThai
                      ? 'ศูนย์จัดการความยินยอมข้อมูลส่วนบุคคล (PDPA Granular Consent Center)'
                      : 'PDPA Granular Consent Center'}
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900 mt-1">
                    {isThai
                      ? `ตั้งค่าความยินยอมแยกตามวัตถุประสงค์ของ ${selectedChild.nickname} (มีผลทันที)`
                      : `Granular Privacy Consents for ${selectedChild.nickname}`}
                  </h3>
                </div>
                <Link
                  href="/admin/governance"
                  className="text-xs font-bold text-[#1B3A6B] hover:underline inline-flex items-center gap-1"
                >
                  <span>
                    {isThai
                      ? 'ดูระบบธรรมาภิบาล & PDPA ฝั่งบุคลากร (/admin/governance)'
                      : 'Open Staff PDPA Governance'}
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="space-y-3">
                {CONSENT_CATALOG.map((item) => {
                  const existing = childConsents.find(
                    (c) => c.purpose_code === item.code
                  );
                  const isGranted = existing ? existing.is_granted : true;

                  return (
                    <div
                      key={item.code}
                      className="rounded-2xl bg-white p-4 border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 text-slate-700">
                            {item.code}
                          </span>
                          <span className="text-xs font-bold text-[#7B1C3E]">
                            {isThai ? item.badge_th : item.badge_en}
                          </span>
                        </div>
                        <h4 className="font-extrabold text-sm text-slate-900">
                          {isThai ? item.title_th : item.title_en}
                        </h4>
                        <p className="text-xs text-slate-600">
                          {isThai ? item.desc_th : item.desc_en}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`text-xs font-extrabold ${
                            isGranted ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {isGranted
                            ? isThai
                              ? 'ยินยอม (Granted)'
                              : 'Granted'
                            : isThai
                            ? 'ถอนความยินยอม (Revoked)'
                            : 'Revoked'}
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isGranted}
                          onClick={() =>
                            handleToggleConsent(item.code, !isGranted)
                          }
                          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors cursor-pointer ${
                            isGranted ? 'bg-emerald-600' : 'bg-slate-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                              isGranted ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </div>

      {/* ==================================================================
          MOBILE BOTTOM NAVIGATION BAR (5 Adaptive Tabs)
          ================================================================== */}
      <nav
        aria-label="Parents Portal Mobile Bottom Navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/90 px-3 py-1.5 shadow-2xl pb-safe"
      >
        <div className="max-w-md mx-auto grid grid-cols-5 gap-1">
          {[
            {
              id: 'today' as MainTabId,
              label_th: 'วันนี้',
              label_en: 'Today',
              icon: Sun,
              badge: urgentActionCount,
            },
            {
              id: 'messages' as MainTabId,
              label_th: 'แชตครู',
              label_en: 'Chat',
              icon: MessageCircle,
              badge: unreadMessagesCount,
            },
            {
              id: 'calendar' as MainTabId,
              label_th: 'ปฏิทิน',
              label_en: 'Calendar',
              icon: CalendarDays,
              badge: 0,
            },
            {
              id: 'children' as MainTabId,
              label_th: 'บุตรหลาน',
              label_en: 'Children',
              icon: Users,
              badge: 0,
            },
            {
              id: 'more' as MainTabId,
              label_th: 'การเงิน',
              label_en: 'More',
              icon: Wallet,
              badge: childUnsignedSubsidies.length,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex flex-col items-center justify-center py-1 px-1 rounded-2xl transition-all cursor-pointer ${
                  active ? 'text-[#7B1C3E]' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <div
                  className={`p-1.5 rounded-xl transition-all ${
                    active
                      ? 'bg-rose-100 text-[#7B1C3E] shadow-xs scale-105'
                      : 'text-slate-500'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span
                  className={`text-[10px] mt-0.5 tracking-tight truncate ${
                    active ? 'font-black text-[#7B1C3E]' : 'font-semibold text-slate-500'
                  }`}
                >
                  {isThai ? tab.label_th : tab.label_en}
                </span>
                {tab.badge > 0 && (
                  <span className="absolute top-1 right-2 w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] font-black flex items-center justify-center ring-2 ring-white">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ==================================================================
          MODAL 1: DYNAMIC 30-SECOND ROTATING QR & 6-DIGIT TOTP PASS
          ================================================================== */}
      {totpModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-[#7B1C3E]/10 text-[#7B1C3E]">
                  Smart Pickup Rotating TOTP Pass
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-1">
                  {selectedChild.nickname} ({selectedChild.full_name} •{' '}
                  {selectedChild.grade})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTotpModalOpen(false)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="w-52 h-52 mx-auto">
              <DeterministicQrSvg
                value={`SV-PICKUP-${selectedChild.id}-${totpCode}`}
                accentColor="#7B1C3E"
              />
            </div>

            <div className="rounded-2xl bg-slate-900 text-white p-4 text-center space-y-2">
              <p className="text-xs text-slate-300">
                {isThai
                  ? 'รหัสรับนักเรียน 6 หลัก (เปลี่ยนอัตโนมัติทุก 30 วินาที)'
                  : '6-Digit Pickup Verification Code (30s TOTP)'}
              </p>
              <div className="flex items-center justify-center gap-3">
                <span className="font-mono text-3xl font-black tracking-widest text-amber-300">
                  {totpCode.slice(0, 3)} {totpCode.slice(3)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(totpCode);
                    toast.success(
                      isThai
                        ? `คัดลอกรหัส ${totpCode} แล้ว`
                        : `Copied ${totpCode}`
                    );
                  }}
                  className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white cursor-pointer"
                  title="Copy Code"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>

              {/* Countdown Progress Bar */}
              <div className="w-full h-2 rounded-full bg-white/15 overflow-hidden">
                <div
                  className="h-full bg-emerald-400 transition-all duration-500"
                  style={{ width: `${(totpSecondsLeft / 30) * 100}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-300">
                {isThai
                  ? `รหัสชุดนี้ใช้ได้อีก ${totpSecondsLeft} วินาที • ทำงานได้แม้ขณะออฟไลน์`
                  : `Refreshes in ${totpSecondsLeft}s • Offline-capable deterministic TOTP`}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Link
                href="/admin/safety/pickup"
                className="flex-1 py-2.5 px-4 rounded-2xl bg-[#1B3A6B] hover:bg-[#142c52] text-white font-extrabold text-xs text-center flex items-center justify-center gap-1.5"
              >
                <span>
                  {isThai
                    ? 'ทดสอบตรวจรหัสนี้ที่หน้าประตู (/admin/safety/pickup)'
                    : 'Verify at Staff Pickup Kiosk'}
                </span>
                <ArrowUpRight className="w-4 h-4" />
              </Link>
              <button
                type="button"
                onClick={() => setTotpModalOpen(false)}
                className="py-2.5 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs cursor-pointer"
              >
                {isThai ? 'ปิดหน้าต่าง' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================
          MODAL 2: QR PROMPTPAY TUITION PAYMENT & OFFICIAL E-RECEIPT
          ================================================================== */}
      {activeInvoiceModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-indigo-100 text-indigo-900">
                  {activeInvoiceModal.status === 'paid'
                    ? isThai
                      ? 'ใบเสร็จรับเงินดิจิทัลโรงเรียนสมคิดวิทยา'
                      : 'Official Digital Receipt'
                    : 'Thai QR PromptPay Billing'}
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-1">
                  {isThai
                    ? activeInvoiceModal.title_th
                    : activeInvoiceModal.title_en}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveInvoiceModal(null)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {activeInvoiceModal.status === 'unpaid' ? (
              <div className="space-y-4">
                <div className="w-48 h-48 mx-auto">
                  <DeterministicQrSvg
                    value={`PROMPTPAY-SOMKID-${activeInvoiceModal.id}-${activeInvoiceModal.amount}`}
                    accentColor="#1B3A6B"
                  />
                </div>
                <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-200 text-center">
                  <p className="text-xs text-slate-500">
                    {isThai
                      ? 'ยอดชำระค่าธรรมเนียมการศึกษา'
                      : 'Total Amount Due'}
                  </p>
                  <p className="text-2xl font-black text-[#7B1C3E]">
                    {formatCurrency(activeInvoiceModal.amount)}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {isThai
                      ? 'บัญชี: โรงเรียนสมคิดวิทยา (PromptPay Biller ID)'
                      : 'Biller: Somkidvittaya School'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleConfirmPromptPayInvoice(activeInvoiceModal)
                  }
                  className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-md cursor-pointer"
                >
                  {isThai
                    ? 'ยืนยันการชำระเงินผ่าน QR PromptPay ทันที'
                    : 'Simulate Instant PromptPay Payment'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between font-extrabold text-emerald-900 text-sm">
                    <span className="inline-flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{isThai ? 'ชำระเงินเรียบร้อยแล้ว' : 'PAID'}</span>
                    </span>
                    <span>{activeInvoiceModal.receipt_number}</span>
                  </div>
                  <p className="text-slate-700">
                    <strong>{isThai ? 'นักเรียน:' : 'Student:'}</strong>{' '}
                    {selectedChild.full_name} ({selectedChild.grade})
                  </p>
                  <p className="text-slate-700">
                    <strong>{isThai ? 'จำนวนเงิน:' : 'Amount:'}</strong>{' '}
                    {formatCurrency(activeInvoiceModal.amount)}
                  </p>
                  <p className="text-slate-700">
                    <strong>{isThai ? 'ช่องทางชำระ:' : 'Method:'}</strong>{' '}
                    {activeInvoiceModal.payment_method}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveInvoiceModal(null)}
                  className="w-full py-2.5 rounded-2xl bg-slate-900 text-white font-extrabold text-xs cursor-pointer"
                >
                  {isThai ? 'ปิดหน้าต่างใบเสร็จ' : 'Close Receipt'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
