'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Student, StudentAddress, StudentParent } from '@/types';
import Link from 'next/link';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Save,
  User,
  MapPin,
  Users,
  PlusCircle,
  CheckCircle2,
  Trash2,
  Heart,
  ShieldAlert,
  AlertTriangle,
  ShieldCheck,
  QrCode,
  KeyRound,
  Lock,
  Check,
  X,
  Copy,
  FileCheck2,
  ExternalLink,
} from 'lucide-react';
import ThaiAddressRow from '@/components/admin/ThaiAddressRow';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  getPipelineState,
  PIPELINE_EVENT_NAME,
  updateGuardianLinkPermissions,
  createGuardianInviteCode,
  toggleStudentConsent,
} from '@/lib/pipeline/bidirectional-store';
import {
  BidirectionalPipelineState,
  ConsentPurposeCode,
  GuardianPermissionFlags,
} from '@/types/family-pipeline';

const PERMISSION_META: {
  key: keyof Omit<GuardianPermissionFlags, 'is_legal_guardian'>;
  labelTh: string;
  labelEn: string;
  descTh: string;
  descEn: string;
}[] = [
  {
    key: 'can_view_daily',
    labelTh: 'ดูรายงานประจำวัน & เช็กชื่อ (Daily & Attendance)',
    labelEn: 'View Daily Care & Attendance',
    descTh: 'เข้าถึงเวลาเข้า-ออกเรียน สมุดพกอนุบาลรายวัน และส่งใบลาออนไลน์',
    descEn: 'Access check-in/out logs, daily care book, and submit leave requests',
  },
  {
    key: 'can_view_academic',
    labelTh: 'ดูผลการเรียน & การบ้าน (Academic & Homework)',
    labelEn: 'View Academic Grades & Assignments',
    descTh: 'ดูผลการเรียนรายวิชา พัฒนาการ 4 ด้าน และสถานะการส่งการบ้าน',
    descEn: 'View subject grades, 4-domain milestones, and homework tracking',
  },
  {
    key: 'can_view_health',
    labelTh: 'ดูข้อมูลสุขภาพ & ฝากป้อนยา (Health & Infirmary)',
    labelEn: 'View Health Records & Medication Queue',
    descTh: 'ดูประวัติห้องพยาบาล รายงานการปฐมพยาบาล และส่งคำร้องฝากป้อนยา',
    descEn: 'View infirmary logs, incident reports, and submit medication requests',
  },
  {
    key: 'can_view_finance',
    labelTh: 'ดูใบแจ้งหนี้ & เงินอุดหนุน 15 ปี (Finance View)',
    labelEn: 'View Tuition Invoices & Subsidies',
    descTh: 'ดูรายการค่าธรรมเนียมการศึกษา ใบเสร็จ และสิทธิ์เรียนฟรี 15 ปี',
    descEn: 'View tuition invoices, receipts, and 15-Year Free Education subsidies',
  },
  {
    key: 'can_pay',
    labelTh: 'ชำระเงิน & เติมเงินกระเป๋า (Payment & Wallet)',
    labelEn: 'Make Payments & Top-Up Wallet',
    descTh: 'อนุญาตให้ชำระค่าเทอม QR PromptPay เติมเงินบัตรนักเรียน และลงนามรับเงินอุดหนุน',
    descEn: 'Pay tuition via PromptPay, top-up student wallet, and sign subsidy receipts',
  },
  {
    key: 'can_message_teacher',
    labelTh: 'แชทสื่อสารกับครูประจำชั้น (Parent-Teacher Chat)',
    labelEn: 'Two-Way Teacher Messaging',
    descTh: 'ส่งข้อความพูดคุยกับครูประจำชั้นและฝ่ายธุรการภายใต้เวลาทำการ',
    descEn: 'Send and receive direct messages with homeroom teachers',
  },
  {
    key: 'can_pickup',
    labelTh: 'มีสิทธิ์รับนักเรียนกลับบ้าน (Authorized Pickup)',
    labelEn: 'Authorized Student Pickup',
    descTh: 'สามารถแสดง QR/TOTP ที่จุดรับ-ส่งอัจฉริยะเพื่อรับนักเรียนออกจากโรงเรียน',
    descEn: 'Use dynamic QR/TOTP at the Smart Dismissal Gate to pick up student',
  },
  {
    key: 'can_manage_pickup',
    labelTh: 'จัดการผู้รับแทน & ออกรหัส OTP ชั่วคราว (Manage Delegates)',
    labelEn: 'Manage Pickup Delegates & Temp OTP',
    descTh: 'เปลี่ยนวิธีเดินทางรายวัน และออกรหัส OTP มอบอำนาจให้ญาติมารับแทน',
    descEn: 'Change daily transport mode and issue temporary delegate OTP codes',
  },
  {
    key: 'can_give_consent',
    labelTh: 'จัดการความยินยอม PDPA (Manage PDPA Consents)',
    labelEn: 'Grant or Revoke PDPA Consents',
    descTh: 'อนุญาตหรือถอนความยินยอมการใช้รูปภาพ ทัศนศึกษา และการปฐมพยาบาล',
    descEn: 'Modify granular PDPA consent preferences for photos and activities',
  },
  {
    key: 'receives_emergency_alert',
    labelTh: 'รับแจ้งเตือนฉุกเฉินลำดับแรก (Emergency SOS)',
    labelEn: 'Receive Priority Emergency Alerts',
    descTh: 'รับการแจ้งเตือนทันทีเมื่อมีอุบัติเหตุ เจ็บป่วยฉุกเฉิน หรือไม่มาเรียนโดยไม่แจ้งลา',
    descEn: 'Receive immediate high-priority alerts for incidents or unexplained absence',
  },
];

const ALL_CONSENT_PURPOSES: {
  code: ConsentPurposeCode;
  titleTh: string;
  titleEn: string;
  descTh: string;
}[] = [
  {
    code: 'PHOTO_INTERNAL',
    titleTh: 'การถ่ายภาพกิจกรรมสำหรับรายงานผู้ปกครองภายในระบบโรงเรียน',
    titleEn: 'Internal Classroom & Daily Care Activity Photos',
    descTh: 'อนุญาตให้ครูประจำชั้นบันทึกภาพกิจกรรมพัฒนาการและสมุดพกอนุบาลเพื่อส่งให้ผู้ปกครองเฉพาะรายบุคคล',
  },
  {
    code: 'PHOTO_PUBLIC_PR',
    titleTh: 'การเผยแพร่ภาพกิจกรรมนักเรียนบนเว็บไซต์และเพจประชาสัมพันธ์โรงเรียน',
    titleEn: 'Public Website & School PR Media Publication',
    descTh: 'อนุญาตให้นำภาพกิจกรรมสร้างสรรค์ของนักเรียนขึ้นแสดงในข่าวสารเว็บไซต์โรงเรียนสมคิดวิทยา',
  },
  {
    code: 'FIELD_TRIP',
    titleTh: 'การเข้าร่วมกิจกรรมทัศนศึกษาและแหล่งเรียนรู้นอกสถานที่',
    titleEn: 'Educational Field Trips & Off-Campus Learning',
    descTh: 'อนุญาตให้นักเรียนเดินทางไปทัศนศึกษาตามโครงการวิชาการของโรงเรียนภายใต้การดูแลของครู',
  },
  {
    code: 'FIRST_AID',
    titleTh: 'การปฐมพยาบาลเบื้องต้นและการส่งต่อสถานพยาบาลฉุกเฉิน',
    titleEn: 'Emergency First Aid & Hospital Referral',
    descTh: 'อนุญาตให้พยาบาลประจำห้องพยาบาลปฐมพยาบาลเบื้องต้นและนำส่งโรงพยาบาลใกล้เคียงในกรณีฉุกเฉิน',
  },
  {
    code: 'AI_TRANSLATE',
    titleTh: 'การใช้ AI ช่วยแปลภาษาและสรุปรายงานพัฒนาการเด็ก (AI Assistant)',
    titleEn: 'AI Narrative Summary & Multilingual Translation',
    descTh: 'อนุญาตให้ใช้ระบบปัญญาประดิษฐ์ภายในโรงเรียนช่วยเรียบเรียงรายงานพัฒนาการและแปลภาษาให้ผู้ปกครอง',
  },
];

export default function StudentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const resolvedId = params?.id as string | undefined;
  const { isThai } = useLanguage();

  const isNew = resolvedId === 'new';

  const [student, setStudent] = useState<Partial<Student>>({
    id: '',
    name: '',
    grade: '',
    status: 'นักเรียนเข้าใหม่',
  });
  const [addresses, setAddresses] = useState<Partial<StudentAddress>[]>([]);
  const [parents, setParents] = useState<Partial<StudentParent>[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'general' | 'health' | 'address' | 'parents' | 'family_portal'
  >('general');
  const [studentType, setStudentType] = useState<'normal' | 'e'>('normal');

  // Bidirectional Pipeline State
  const [pipeline, setPipeline] = useState<BidirectionalPipelineState>(() =>
    getPipelineState()
  );
  const [inviteGuardianName, setInviteGuardianName] = useState(
    'นายวรพจน์ รัตนโชติ (บิดา)'
  );
  const [inviteGuardianPhone, setInviteGuardianPhone] = useState('081-775-1920');
  const [restrictionDraft, setRestrictionDraft] = useState('');

  const syncPipeline = useCallback(() => {
    const current = getPipelineState();
    setPipeline({ ...current });
  }, []);

  useEffect(() => {
    syncPipeline();
    const handleUpdate = () => syncPipeline();
    window.addEventListener(PIPELINE_EVENT_NAME, handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener(PIPELINE_EVENT_NAME, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [syncPipeline]);

  // Match resolvedId or fallback to '67012' so any student page has rich interactive controls
  const effectivePipelineStudentId =
    resolvedId && pipeline.links.some((l) => l.student_id === resolvedId)
      ? resolvedId
      : '67012';

  const activeLink =
    pipeline.links.find((l) => l.student_id === effectivePipelineStudentId) ||
    pipeline.links[0];

  useEffect(() => {
    if (activeLink?.restriction_note !== undefined) {
      setRestrictionDraft(activeLink.restriction_note || '');
    }
  }, [activeLink?.id, activeLink?.restriction_note]);

  useEffect(() => {
    if (isNew) {
      fetch(`/api/admin/students/next-id?type=${studentType}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.nextId) {
            setStudent((s) => ({ ...s, id: data.nextId }));
          }
        })
        .catch((err) => console.error('Failed to fetch next ID:', err));
    }
  }, [isNew, studentType]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 3000);

    if (resolvedId && !isNew) {
      fetchStudent();
    } else if (isNew) {
      setAddresses([{}]);
      setParents([
        { relationship: 'บิดา' },
        { relationship: 'มารดา' },
        { relationship: 'ผู้ปกครอง' },
      ]);
      setIsLoading(false);
    }

    return () => clearTimeout(timer);
  }, [isNew, resolvedId]);

  const fetchStudent = async () => {
    try {
      if (!resolvedId) return;
      const res = await fetch(`/api/admin/students/${resolvedId}`);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();

      if (data) {
        setStudent(data);
        if (data.student_addresses && data.student_addresses.length > 0) {
          setAddresses(data.student_addresses);
        } else {
          setAddresses([{ student_id: data.id }]);
        }

        if (data.student_parents && data.student_parents.length > 0) {
          const roles = ['บิดา', 'มารดา', 'ผู้ปกครอง'];
          const newParents = [...data.student_parents];
          roles.forEach((role) => {
            if (!newParents.find((p: any) => p.relationship === role)) {
              newParents.push({ student_id: data.id, relationship: role });
            }
          });
          newParents.sort((a, b) => {
            const idxA = roles.indexOf(a.relationship);
            const idxB = roles.indexOf(b.relationship);
            if (idxA === -1 && idxB === -1) return 0;
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
          });
          setParents(newParents);
        } else {
          setParents([
            { student_id: data.id, relationship: 'บิดา' },
            { student_id: data.id, relationship: 'มารดา' },
            { student_id: data.id, relationship: 'ผู้ปกครอง' },
          ]);
        }
      } else {
        toast.error('ไม่พบข้อมูลนักเรียน', { description: `รหัส: ${resolvedId}` });
      }
    } catch (err: any) {
      console.error('Fetch student error:', err);
      // Graceful fallback to pipeline child if API fails
      const fallbackChild = pipeline.children.find(
        (c) => c.id === resolvedId || c.id === '67012'
      );
      if (fallbackChild) {
        setStudent({
          id: fallbackChild.id,
          prefix: fallbackChild.prefix,
          first_name: fallbackChild.first_name,
          last_name: fallbackChild.last_name,
          name: fallbackChild.full_name,
          grade: fallbackChild.grade,
          classroom: fallbackChild.classroom,
          allergies: fallbackChild.allergies,
          medical_conditions: fallbackChild.medical_conditions,
          height: fallbackChild.height_cm,
          weight: fallbackChild.weight_kg,
          status: 'กำลังศึกษาอยู่',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!student.id || !student.grade) {
      toast.error('กรุณากรอกข้อมูลที่จำเป็น', {
        description: 'รหัสนักเรียน และระดับชั้น',
      });
      return;
    }

    setIsSaving(true);
    try {
      const {
        student_addresses,
        student_parents,
        wallet_balance,
        created_at,
        updated_at,
        ...studentData
      } = student as any;

      let finalName = studentData.name;
      if (student.first_name || student.last_name) {
        const prefix = (student.prefix || '').trim();
        const fname = (student.first_name || '').trim();
        const lname = (student.last_name || '').trim();
        finalName = `${prefix}${fname}${lname ? ' ' + lname : ''}`.trim();
      }

      const payloadStudentData = {
        ...studentData,
        name: finalName || studentData.name,
      };

      const res = await fetch('/api/admin/students/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentData: payloadStudentData,
          isNew,
          addresses,
          parents,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save student data');
      }

      toast.success('บันทึกข้อมูลสำเร็จ', {
        icon: <CheckCircle2 className="w-5 h-5 text-green-500" />,
      });
      router.push('/admin/students');
    } catch (err: any) {
      console.error('Save error:', err);
      toast.error('เกิดข้อผิดพลาดในการบันทึก', { description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePermission = (
    key: keyof Omit<GuardianPermissionFlags, 'is_legal_guardian'>
  ) => {
    if (!activeLink) return;
    const nextVal = !activeLink[key];
    updateGuardianLinkPermissions(activeLink.id, { [key]: nextVal });
    syncPipeline();
    toast.success(
      isThai
        ? `อัปเดตสิทธิ์ Parents Portal (${key}) เป็น ${nextVal ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}`
        : `Updated permission (${key}) to ${nextVal ? 'Enabled' : 'Disabled'}`
    );
  };

  const handleToggleLegalRestriction = () => {
    if (!activeLink) return;
    const nextRestricted = !activeLink.has_legal_restriction;
    const note = nextRestricted
      ? restrictionDraft.trim() ||
        'ห้ามบุคคลภายนอกหรือผู้ถูกจำกัดสิทธิ์ตามคำสั่งศาลรับนักเรียนออกจากโรงเรียนโดยเด็ดขาด'
      : null;

    updateGuardianLinkPermissions(activeLink.id, {
      has_legal_restriction: nextRestricted,
      restriction_note: note,
      can_pickup: nextRestricted ? false : true,
    });
    syncPipeline();
    if (nextRestricted) {
      toast.error(
        isThai
          ? 'เปิดใช้งานคำสั่งระงับสิทธิ์รับนักเรียน (Child Safeguarding Alert) และซิงค์ไปยังจุดรับ-ส่งอัจฉริยะทันที!'
          : 'Activated Child Safeguarding Custody Restriction at Smart Pickup Kiosk!'
      );
    } else {
      toast.success(
        isThai
          ? 'ปลดล็อกข้อจำกัดสิทธิ์การรับนักเรียนเรียบร้อยแล้ว'
          : 'Cleared Legal Custody Restriction'
      );
    }
  };

  const handleSaveRestrictionNote = () => {
    if (!activeLink) return;
    updateGuardianLinkPermissions(activeLink.id, {
      has_legal_restriction: true,
      restriction_note: restrictionDraft.trim() || 'มีข้อจำกัดสิทธิ์ตามกฎหมาย',
    });
    syncPipeline();
    toast.success(
      isThai
        ? 'บันทึกหมายเหตุคำสั่งศาล/ข้อจำกัดสิทธิ์เรียบร้อย'
        : 'Saved legal restriction note'
    );
  };

  const handleGenerateInviteCode = () => {
    if (!inviteGuardianName.trim() || !inviteGuardianPhone.trim()) {
      toast.error(
        isThai
          ? 'กรุณาระบุชื่อและเบอร์โทรศัพท์ผู้ปกครอง'
          : 'Please enter guardian name and phone'
      );
      return;
    }

    const inv = createGuardianInviteCode({
      student_id: student.id || effectivePipelineStudentId,
      student_name:
        student.name ||
        pipeline.children.find((c) => c.id === effectivePipelineStudentId)
          ?.full_name ||
        'ด.ญ.พิมพ์ชนก รัตนโชติ',
      grade_level: student.grade || 'อ.2/1',
      guardian_name: inviteGuardianName.trim(),
      guardian_phone: inviteGuardianPhone.trim(),
    });
    syncPipeline();
    toast.success(
      isThai
        ? `ออกรหัสเชิญผู้ปกครองสำเร็จ: ${inv.invite_code}`
        : `Generated Guardian Invite Code: ${inv.invite_code}`
    );
  };

  const studentConsents = pipeline.consents.filter(
    (c) => c.student_id === effectivePipelineStudentId
  );

  const studentInvitations = pipeline.invitations.filter(
    (inv) =>
      inv.student_id === effectivePipelineStudentId ||
      inv.student_id === student.id
  );

  if (isLoading) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-8 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-24 h-10 bg-foreground/5 rounded-lg"></div>
          <div className="w-64 h-10 bg-foreground/10 rounded-lg"></div>
        </div>
        <div className="bg-surface rounded-2xl shadow-sm border border-foreground/5 h-[600px] flex flex-col">
          <div className="h-14 border-b border-foreground/5 flex">
            <div className="flex-1 border-r border-foreground/5 bg-foreground/5"></div>
            <div className="flex-1 border-r border-foreground/5 bg-foreground/[0.02]"></div>
            <div className="flex-1 bg-foreground/[0.02]"></div>
          </div>
          <div className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i}>
                  <div className="w-24 h-4 bg-foreground/10 rounded mb-2"></div>
                  <div className="w-full h-12 bg-foreground/5 rounded-xl"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="sv-container-context p-4 sm:p-8 max-w-5xl mx-auto space-y-6 font-sans"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/students"
            className="flex items-center gap-2 px-4 py-2 bg-surface hover:bg-foreground/5 border border-foreground/10 rounded-xl text-foreground/70 font-medium transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" /> {isThai ? 'กลับ' : 'Back'}
          </Link>
          <div>
            <h1 className="sv-fluid-title text-2xl sm:text-3xl font-extrabold tracking-tight text-[#7B1C3E] dark:text-rose-300">
              {isNew
                ? isThai
                  ? 'เพิ่มนักเรียนใหม่'
                  : 'New Student Registration'
                : student.name || student.id}
            </h1>
            <p className="text-xs text-slate-500">
              {isThai
                ? `รหัสประจำตัวนักเรียน: ${student.id || effectivePipelineStudentId} • เชื่อมต่อระบบ Parents Portal แบบเรียลไทม์`
                : `Student ID: ${student.id || effectivePipelineStudentId} • Real-time Bidirectional Parents Portal Link`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/parents"
            className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/40 text-[#7B1C3E] dark:text-amber-300 border border-[#D4AF37]/40 rounded-xl text-xs font-bold hover:bg-amber-100 transition-all"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {isThai ? 'ดูหน้า Parents Portal' : 'Open Parents Portal'}
          </Link>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#7B1C3E] text-white font-bold rounded-xl shadow-lg shadow-[#7B1C3E]/20 hover:bg-[#631430] transition-all disabled:opacity-50 disabled:pointer-events-none text-sm cursor-pointer"
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isSaving
              ? isThai
                ? 'กำลังบันทึก...'
                : 'Saving...'
              : isThai
              ? 'บันทึกข้อมูล'
              : 'Save Student'}
          </button>
        </div>
      </div>

      <div className="bg-surface/80 backdrop-blur-xl rounded-3xl shadow-xl border border-foreground/10 overflow-hidden">
        {/* 5 Tabs including family_portal */}
        <div className="flex flex-wrap border-b border-foreground/5 bg-foreground/[0.02]">
          {[
            {
              id: 'general',
              label: isThai ? 'ข้อมูลพื้นฐาน' : 'General Profile',
              icon: User,
            },
            {
              id: 'health',
              label: isThai ? 'สุขภาพ & แพ้ยา' : 'Health & Allergies',
              icon: Heart,
            },
            {
              id: 'address',
              label: isThai ? 'ข้อมูลที่อยู่' : 'Address',
              icon: MapPin,
            },
            {
              id: 'parents',
              label: isThai ? 'ข้อมูลผู้ปกครอง' : 'Parents Info',
              icon: Users,
            },
            {
              id: 'family_portal',
              label: isThai
                ? 'สิทธิ์ Parents Portal & PDPA'
                : 'Parents Portal & PDPA',
              icon: ShieldCheck,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`relative flex-1 min-w-[140px] flex items-center justify-center gap-2 py-4 px-3 font-bold text-xs sm:text-sm transition-all overflow-hidden cursor-pointer ${
                  isActive
                    ? 'text-[#7B1C3E] dark:text-rose-300 bg-surface'
                    : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive
                      ? 'text-[#7B1C3E] dark:text-rose-300'
                      : 'text-foreground/40'
                  }`}
                />
                <span>{tab.label}</span>
                {tab.id === 'health' && student.allergies && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                )}
                {tab.id === 'family_portal' &&
                  activeLink?.has_legal_restriction && (
                    <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-rose-600 text-white font-black">
                      ALERT
                    </span>
                  )}
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#7B1C3E]"
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="p-6 sm:p-8">
          <AnimatePresence mode="wait">
            {activeTab === 'general' && (
              <motion.div
                key="general"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {isNew && (
                    <div className="sm:col-span-2 mb-2 p-5 bg-primary/5 border border-primary/20 rounded-2xl">
                      <label className="block text-sm font-bold text-primary mb-3">
                        ประเภทนักเรียน (รันรหัสอัตโนมัติ)
                      </label>
                      <div className="flex items-center gap-6">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="studentType"
                            value="normal"
                            checked={studentType === 'normal'}
                            onChange={() => setStudentType('normal')}
                            className="w-5 h-5 text-primary focus:ring-primary/20"
                          />
                          <span className="text-sm font-medium text-foreground/80">
                            นักเรียนในระบบ (รหัสปกติ)
                          </span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="studentType"
                            value="e"
                            checked={studentType === 'e'}
                            onChange={() => setStudentType('e')}
                            className="w-5 h-5 text-primary focus:ring-primary/20"
                          />
                          <span className="text-sm font-medium text-foreground/80">
                            นักเรียนนอกระบบ (รหัส E)
                          </span>
                        </label>
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-semibold text-foreground/70 mb-2">
                      รหัสนักเรียน (id)
                    </label>
                    <input
                      type="text"
                      disabled={!isNew}
                      value={student.id || ''}
                      onChange={(e) =>
                        setStudent({ ...student, id: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none disabled:opacity-50 text-foreground transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground/70 mb-2">
                      เลขประจำตัวประชาชน
                    </label>
                    <input
                      type="text"
                      value={student.citizen_id || ''}
                      onChange={(e) =>
                        setStudent({ ...student, citizen_id: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground/70 mb-2">
                      คำนำหน้าชื่อ
                    </label>
                    <input
                      type="text"
                      list="prefix-list"
                      value={student.prefix || ''}
                      onChange={(e) =>
                        setStudent({ ...student, prefix: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all"
                    />
                    <datalist id="prefix-list">
                      <option value="เด็กชาย" />
                      <option value="เด็กหญิง" />
                      <option value="นาย" />
                      <option value="นาง" />
                      <option value="นางสาว" />
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground/70 mb-2">
                      ชื่อ (First Name)
                    </label>
                    <input
                      type="text"
                      value={student.first_name || ''}
                      onChange={(e) =>
                        setStudent({ ...student, first_name: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground/70 mb-2">
                      นามสกุล (Last Name)
                    </label>
                    <input
                      type="text"
                      value={student.last_name || ''}
                      onChange={(e) =>
                        setStudent({ ...student, last_name: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground/70 mb-2">
                      ระดับชั้น (Grade)
                    </label>
                    <input
                      type="text"
                      list="grade-list"
                      value={student.grade || ''}
                      onChange={(e) =>
                        setStudent({ ...student, grade: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all"
                    />
                    <datalist id="grade-list">
                      <option value="อ.1" />
                      <option value="อ.2" />
                      <option value="อ.3" />
                      <option value="ป.1" />
                      <option value="ป.2" />
                      <option value="ป.3" />
                      <option value="ป.4" />
                      <option value="ป.5" />
                      <option value="ป.6" />
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground/70 mb-2">
                      ห้องเรียน (Classroom)
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น 1 หรือ ป.3/1"
                      value={student.classroom || ''}
                      onChange={(e) =>
                        setStudent({ ...student, classroom: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground/70 mb-2">
                      วันเกิด
                    </label>
                    <input
                      type="date"
                      value={student.birth_date || ''}
                      onChange={(e) =>
                        setStudent({ ...student, birth_date: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground/70 mb-2">
                      สถานะ
                    </label>
                    <select
                      value={student.status || 'นักเรียนเข้าใหม่'}
                      onChange={(e) =>
                        setStudent({ ...student, status: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all"
                    >
                      <option value="นักเรียนเข้าใหม่">นักเรียนเข้าใหม่</option>
                      <option value="กำลังศึกษาอยู่">กำลังศึกษาอยู่</option>
                      <option value="สำเร็จการศึกษา">สำเร็จการศึกษา</option>
                      <option value="ลาออก">ลาออก</option>
                      <option value="active">Active</option>
                    </select>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'health' && (
              <motion.div
                key="health"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-6"
              >
                <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-2xl flex items-start gap-3">
                  <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-rose-900 dark:text-rose-200">
                    <p className="font-extrabold text-sm mb-0.5">
                      การคุ้มครองความปลอดภัยและระบบห้องพยาบาล (Drug Allergy Guard)
                    </p>
                    <p>
                      ข้อมูลประวัติการแพ้ยาและอาหารจะถูกตรวจสอบอัตโนมัติเมื่อครูพยาบาลจ่ายยาในห้องพยาบาล
                      และจะแสดงเตือนไปยังผู้ดูแลระบบโภชนาการอาหารกลางวันทันที
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-rose-700 dark:text-rose-400 mb-1.5 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      ประวัติการแพ้ยา / แพ้อาหาร (Allergies)
                    </label>
                    <textarea
                      rows={3}
                      placeholder="ระบุชื่อยาหรืออาหารที่แพ้ เช่น แพ้เพนิซิลลิน, แพ้ซัลฟา, แพ้อาหารทะเล, แพ้นมวัว, แพ้ถั่วลิสง (หากไม่มีให้เว้นว่างหรือระบุ 'ไม่มี')"
                      value={student.allergies || ''}
                      onChange={(e) =>
                        setStudent({ ...student, allergies: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-background border border-rose-300 dark:border-rose-800 rounded-xl focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20 outline-none text-foreground text-sm font-medium transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      โรคประจำตัว (Medical Conditions)
                    </label>
                    <textarea
                      rows={3}
                      placeholder="ระบุโรคประจำตัว เช่น โรคหอบหืด, G6PD, โรคหัวใจ, โรคลมชัก, ภูมิแพ้อากาศ (หากไม่มีให้เว้นว่างหรือระบุ 'ไม่มี')"
                      value={student.medical_conditions || ''}
                      onChange={(e) =>
                        setStudent({
                          ...student,
                          medical_conditions: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground text-sm font-medium transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-foreground/70 mb-1.5">
                      ความต้องการพิเศษ / ความบกพร่อง (Disability)
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น สมาธิสั้น (ADHD), บกพร่องทางการได้ยิน, มีปัญหาการมองเห็น"
                      value={student.disability || ''}
                      onChange={(e) =>
                        setStudent({ ...student, disability: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground text-sm transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-sm font-semibold text-foreground/70 mb-1.5">
                        ส่วนสูงล่าสุด (ซม.)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="ซม."
                        value={student.height || ''}
                        onChange={(e) =>
                          setStudent({
                            ...student,
                            height: e.target.value
                              ? Number(e.target.value)
                              : null,
                          })
                        }
                        className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground text-sm font-mono transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-foreground/70 mb-1.5">
                        น้ำหนักล่าสุด (กก.)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="กก."
                        value={student.weight || ''}
                        onChange={(e) =>
                          setStudent({
                            ...student,
                            weight: e.target.value
                              ? Number(e.target.value)
                              : null,
                          })
                        }
                        className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground text-sm font-mono transition-all"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'address' && (
              <motion.div
                key="address"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-6"
              >
                {addresses.map((addr, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-2 gap-6 bg-foreground/[0.02] p-6 rounded-2xl border border-foreground/5 relative group"
                  >
                    <div className="col-span-2 flex justify-between items-center mb-2">
                      <div className="text-foreground/30 font-mono text-2xl font-extrabold select-none">
                        #{(idx + 1).toString().padStart(2, '0')}
                      </div>
                      {addresses.length > 1 && (
                        <button
                          onClick={() => {
                            if (confirm('คุณต้องการลบที่อยู่นี้ใช่หรือไม่?')) {
                              const newAddrs = [...addresses];
                              newAddrs.splice(idx, 1);
                              setAddresses(newAddrs);
                            }
                          }}
                          className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                          title="ลบที่อยู่"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-foreground/70 mb-2">
                        บ้านเลขที่
                      </label>
                      <input
                        type="text"
                        value={addr.house_number || ''}
                        onChange={(e) => {
                          const newAddrs = [...addresses];
                          newAddrs[idx].house_number = e.target.value;
                          setAddresses(newAddrs);
                        }}
                        className="w-full px-4 py-3 bg-surface border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-foreground/70 mb-2">
                        หมู่ที่
                      </label>
                      <input
                        type="text"
                        value={addr.moo || ''}
                        onChange={(e) => {
                          const newAddrs = [...addresses];
                          newAddrs[idx].moo = e.target.value;
                          setAddresses(newAddrs);
                        }}
                        className="w-full px-4 py-3 bg-surface border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-foreground/70 mb-2">
                        ซอย / ถนน
                      </label>
                      <input
                        type="text"
                        value={addr.road || addr.soi || ''}
                        onChange={(e) => {
                          const newAddrs = [...addresses];
                          newAddrs[idx].road = e.target.value;
                          setAddresses(newAddrs);
                        }}
                        className="w-full px-4 py-3 bg-surface border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all"
                      />
                    </div>
                    <div className="col-span-2">
                      <ThaiAddressRow
                        address={addr}
                        onChange={(field, value) => {
                          const newAddrs = [...addresses];
                          (newAddrs[idx] as any)[field] = value;
                          setAddresses(newAddrs);
                        }}
                        onAddressSelect={(data) => {
                          const newAddrs = [...addresses];
                          newAddrs[idx] = { ...newAddrs[idx], ...data };
                          setAddresses(newAddrs);
                        }}
                      />
                    </div>
                  </div>
                ))}
                <button
                  onClick={() =>
                    setAddresses([...addresses, { student_id: student.id }])
                  }
                  className="w-full py-4 border-2 border-dashed border-foreground/20 rounded-2xl text-foreground/50 font-bold hover:border-primary hover:bg-primary/5 hover:text-primary transition-all flex items-center justify-center gap-2"
                >
                  <PlusCircle className="w-5 h-5" /> เพิ่มที่อยู่ใหม่
                </button>
              </motion.div>
            )}

            {activeTab === 'parents' && (
              <motion.div
                key="parents"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-6"
              >
                {parents.map((parent, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-2 gap-6 bg-foreground/[0.02] p-6 rounded-2xl border border-foreground/5 relative group"
                  >
                    <div className="col-span-2 flex justify-between items-center border-b border-foreground/10 pb-3 mb-2">
                      <div className="flex items-center gap-4">
                        <h3 className="font-extrabold text-lg text-primary flex items-center gap-2">
                          <Users className="w-5 h-5 opacity-50" />{' '}
                          {parent.relationship || 'ผู้ปกครอง'}
                        </h3>
                        {parent.relationship === 'ผู้ปกครอง' && (
                          <select
                            defaultValue=""
                            className="px-3 py-1.5 bg-surface border border-primary/20 rounded-lg text-sm font-medium text-primary cursor-pointer hover:bg-primary/5 transition-colors outline-none"
                            onChange={(e) => {
                              if (
                                e.target.value === 'บิดา' ||
                                e.target.value === 'มารดา'
                              ) {
                                const source = parents.find(
                                  (p) => p.relationship === e.target.value
                                );
                                if (source) {
                                  const newParents = [...parents];
                                  newParents[idx] = {
                                    ...source,
                                    id: parent.id,
                                    relationship: 'ผู้ปกครอง',
                                  };
                                  setParents(newParents);
                                }
                              } else {
                                const newParents = [...parents];
                                newParents[idx] = {
                                  student_id: student.id,
                                  id: parent.id,
                                  relationship: 'ผู้ปกครอง',
                                };
                                setParents(newParents);
                              }
                              e.target.value = '';
                            }}
                          >
                            <option value="" disabled>
                              -- เลือกคัดลอกข้อมูล --
                            </option>
                            <option value="new">เคลียร์ค่า (กรอกใหม่)</option>
                            <option value="บิดา">คัดลอกข้อมูลบิดา</option>
                            <option value="มารดา">คัดลอกข้อมูลมารดา</option>
                          </select>
                        )}
                      </div>
                      {!['บิดา', 'มารดา', 'ผู้ปกครอง'].includes(
                        parent.relationship || ''
                      ) && (
                        <button
                          onClick={() => {
                            if (
                              confirm(
                                'คุณต้องการลบผู้ปกครองคนนี้ใช่หรือไม่?'
                              )
                            ) {
                              const newParents = [...parents];
                              newParents.splice(idx, 1);
                              setParents(newParents);
                            }
                          }}
                          className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                          title="ลบผู้ปกครอง"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-foreground/70 mb-2">
                        คำนำหน้าชื่อ
                      </label>
                      <input
                        type="text"
                        list="prefix-list"
                        value={parent.prefix || ''}
                        onChange={(e) => {
                          const newParents = [...parents];
                          newParents[idx].prefix = e.target.value;
                          setParents(newParents);
                        }}
                        className="w-full px-4 py-3 bg-surface border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-foreground/70 mb-2">
                        ชื่อ - นามสกุล
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="ชื่อ"
                          value={parent.first_name || ''}
                          onChange={(e) => {
                            const newParents = [...parents];
                            newParents[idx].first_name = e.target.value;
                            setParents(newParents);
                          }}
                          className="w-1/2 px-4 py-3 bg-surface border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all"
                        />
                        <input
                          type="text"
                          placeholder="นามสกุล"
                          value={parent.last_name || ''}
                          onChange={(e) => {
                            const newParents = [...parents];
                            newParents[idx].last_name = e.target.value;
                            setParents(newParents);
                          }}
                          className="w-1/2 px-4 py-3 bg-surface border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-foreground/70 mb-2">
                        เลขบัตรประชาชน
                      </label>
                      <input
                        type="text"
                        value={parent.citizen_id || ''}
                        onChange={(e) => {
                          const newParents = [...parents];
                          newParents[idx].citizen_id = e.target.value;
                          setParents(newParents);
                        }}
                        className="w-full px-4 py-3 bg-surface border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-foreground/70 mb-2">
                        เบอร์โทรศัพท์
                      </label>
                      <input
                        type="text"
                        value={parent.phone_number || ''}
                        onChange={(e) => {
                          const newParents = [...parents];
                          newParents[idx].phone_number = e.target.value;
                          setParents(newParents);
                        }}
                        className="w-full px-4 py-3 bg-surface border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all"
                      />
                    </div>
                  </div>
                ))}
                <button
                  onClick={() =>
                    setParents([
                      ...parents,
                      { student_id: student.id, relationship: 'ผู้ปกครอง' },
                    ])
                  }
                  className="w-full py-4 border-2 border-dashed border-foreground/20 rounded-2xl text-foreground/50 font-bold hover:border-primary hover:bg-primary/5 hover:text-primary transition-all flex items-center justify-center gap-2"
                >
                  <PlusCircle className="w-5 h-5" /> เพิ่มผู้ปกครอง
                </button>
              </motion.div>
            )}

            {/* 5th Tab: family_portal ("สิทธิ์ Parents Portal & PDPA") */}
            {activeTab === 'family_portal' && (
              <motion.div
                key="family_portal"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-8"
              >
                {/* Section 1: Court / Legal Custody Restriction (Child Safeguarding Guard) */}
                <div
                  className={`p-6 rounded-3xl border-2 transition-all ${
                    activeLink?.has_legal_restriction
                      ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 shadow-lg shadow-rose-500/10'
                      : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`p-3 rounded-2xl shrink-0 ${
                          activeLink?.has_legal_restriction
                            ? 'bg-rose-600 text-white'
                            : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        <Lock className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                            {isThai
                              ? 'การคุ้มครองสวัสดิภาพเด็ก & คำสั่งจำกัดสิทธิ์รับนักเรียน (Court / Legal Custody Restriction)'
                              : 'Child Safeguarding & Legal Custody Restriction'}
                          </h3>
                          {activeLink?.has_legal_restriction && (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-600 text-white">
                              {isThai
                                ? 'ระงับการรับนักเรียนที่จุด Kiosk'
                                : 'PICKUP BLOCKED'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                          {isThai
                            ? 'เมื่อเปิดใช้งาน ระบบจุดรับ-ส่งนักเรียนอัจฉริยะ (/admin/safety/pickup) จะขึ้นแบนเนอร์สีแดงแจ้งเตือนครูเวรและบล็อกการส่งมอบนักเรียนทันที'
                            : 'When enabled, the Smart Pickup Kiosk immediately displays a red Child Safeguarding alert and blocks unauthorized release.'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleToggleLegalRestriction}
                      className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm shrink-0 transition-all cursor-pointer ${
                        activeLink?.has_legal_restriction
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20'
                      }`}
                    >
                      {activeLink?.has_legal_restriction
                        ? isThai
                          ? 'ปลดล็อกข้อจำกัดสิทธิ์'
                          : 'Clear Restriction'
                        : isThai
                        ? 'เปิดโหมดจำกัดสิทธิ์ตามคำสั่งศาล'
                        : 'Enable Legal Restriction'}
                    </button>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-200/70 dark:border-slate-800 flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      value={restrictionDraft}
                      onChange={(e) => setRestrictionDraft(e.target.value)}
                      placeholder={
                        isThai
                          ? 'ระบุคำสั่งศาลหรือหมายเหตุความปลอดภัย เช่น ห้ามบิดานอกสมรสรับกลับโดยไม่ได้รับอนุญาตจากมารดา...'
                          : 'Enter court order or safeguarding restriction note...'
                      }
                      className="flex-1 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={handleSaveRestrictionNote}
                      className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-700 text-white text-xs font-bold hover:opacity-90 cursor-pointer shrink-0"
                    >
                      {isThai ? 'บันทึกหมายเหตุคุ้มครองเด็ก' : 'Save Safeguarding Note'}
                    </button>
                  </div>
                </div>

                {/* Section 2: 10 Granular Guardian Permission Flags */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-extrabold text-[#7B1C3E] dark:text-rose-300 flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5" />
                        {isThai
                          ? 'การกำหนดสิทธิ์ผู้ปกครองรายบุคคล 10 ด้าน (10 Granular Guardian Permission Matrix)'
                          : '10 Granular Guardian Permission Flags'}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {isThai
                          ? `ผู้ปกครองหลักที่ผูกบัญชี: ${pipeline.guardian.full_name} (${activeLink?.relationship || 'มารดา'}) • โทร ${pipeline.guardian.phone_number}`
                          : `Linked Primary Guardian: ${pipeline.guardian.full_name} (${activeLink?.relationship || 'Mother'}) • ${pipeline.guardian.phone_number}`}
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {isThai ? 'ซิงค์กับ /parents ทันที' : 'Live Sync with /parents'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {PERMISSION_META.map((perm) => {
                      const enabled = activeLink ? Boolean(activeLink[perm.key]) : true;
                      return (
                        <div
                          key={perm.key}
                          className={`p-4 rounded-2xl border transition-all flex items-start justify-between gap-3 ${
                            enabled
                              ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs'
                              : 'bg-slate-100/70 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/50 opacity-75'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  enabled ? 'bg-emerald-500' : 'bg-slate-400'
                                }`}
                              />
                              <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                {isThai ? perm.labelTh : perm.labelEn}
                              </h4>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                              {isThai ? perm.descTh : perm.descEn}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleTogglePermission(perm.key)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold shrink-0 transition-all cursor-pointer flex items-center gap-1 ${
                              enabled
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300'
                            }`}
                          >
                            {enabled ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                {isThai ? 'อนุญาต' : 'Allowed'}
                              </>
                            ) : (
                              <>
                                <X className="w-3.5 h-3.5" />
                                {isThai ? 'ระงับ' : 'Blocked'}
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Section 3: 6-Digit / QR Parents Portal Invitation Code Generator */}
                <div className="p-6 rounded-3xl bg-gradient-to-br from-[#7B1C3E]/5 via-amber-50/40 to-white dark:from-[#7B1C3E]/20 dark:to-slate-900 border border-[#D4AF37]/40 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-2xl bg-[#7B1C3E] text-white">
                        <QrCode className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                          {isThai
                            ? 'ระบบออกรหัสเชิญผู้ปกครองเชื่อมบัญชี (Parents Portal Invitation Code & QR Generator)'
                            : 'Parents Portal Invitation Code & QR Onboarding'}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {isThai
                            ? 'สำหรับฝ่ายทะเบียนออกรหัส 6 หลัก / QR ให้บิดา มารดา หรือผู้ปกครองสแกนผูกบัญชี LINE Official / Parents Portal'
                            : 'Generate one-time onboarding codes for parents to link their child in Parents Portal'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                        {isThai ? 'ชื่อ-นามสกุล ผู้ปกครอง' : 'Guardian Name'}
                      </label>
                      <input
                        type="text"
                        value={inviteGuardianName}
                        onChange={(e) => setInviteGuardianName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                        {isThai ? 'เบอร์โทรศัพท์ยืนยัน OTP' : 'Phone Number'}
                      </label>
                      <input
                        type="text"
                        value={inviteGuardianPhone}
                        onChange={(e) => setInviteGuardianPhone(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-mono"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={handleGenerateInviteCode}
                        className="w-full py-2.5 px-4 rounded-xl bg-[#7B1C3E] hover:bg-[#631430] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer"
                      >
                        <KeyRound className="w-4 h-4" />
                        {isThai
                          ? 'ออกรหัสเชิญผู้ปกครองใหม่'
                          : 'Generate Invite Code'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {studentInvitations.map((inv) => (
                      <div
                        key={inv.id}
                        className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-black text-[#7B1C3E] dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-0.5 rounded-lg border border-amber-200">
                              {inv.invite_code}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                inv.used_at
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {inv.used_at
                                ? isThai
                                  ? 'เปิดใช้งานแล้ว'
                                  : 'Activated'
                                : isThai
                                ? 'รอผู้ปกครองยืนยัน'
                                : 'Pending Activation'}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {inv.guardian_name} ({inv.guardian_phone})
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {inv.student_name} • หมดอายุ{' '}
                            {inv.expires_at.slice(0, 10)}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(inv.invite_code);
                            toast.success(`คัดลอกรหัส ${inv.invite_code} แล้ว`);
                          }}
                          className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                          title="คัดลอกรหัสเชิญ"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section 4: Real-time PDPA Granular Consent Status */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h3 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                        <FileCheck2 className="w-5 h-5 text-[#7B1C3E]" />
                        {isThai
                          ? 'สถานะความยินยอมตามกฎหมาย PDPA รายวัตถุประสงค์ (Real-Time Granular PDPA Consents)'
                          : 'Real-Time Granular PDPA Consent Status'}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {isThai
                          ? 'เชื่อมต่อโดยตรงกับการตั้งค่า PDPA ของผู้ปกครองใน Parents Portal (มีผลกับระบบคัดกรองภาพถ่ายกิจกรรมอนุบาลและประชาสัมพันธ์ทันที)'
                          : 'Synced directly from parent PDPA preferences in Parents Portal'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {ALL_CONSENT_PURPOSES.map((purpose) => {
                      const record = studentConsents.find(
                        (c) => c.purpose_code === purpose.code
                      );
                      const isGranted = record ? record.is_granted : true;

                      return (
                        <div
                          key={purpose.code}
                          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {purpose.code}
                              </span>
                              <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                {isThai ? purpose.titleTh : purpose.titleEn}
                              </h4>
                            </div>
                            <p className="text-xs text-slate-500">
                              {purpose.descTh}
                            </p>
                            {record && (
                              <p className="text-[11px] text-slate-400 font-mono">
                                Policy {record.policy_version} • IP{' '}
                                {record.ip_address || '171.96.42.18'} •{' '}
                                {record.revoked_at
                                  ? `ถอนความยินยอมเมื่อ ${record.revoked_at.slice(0, 10)}`
                                  : `ลงนามอิเล็กทรอนิกส์เมื่อ ${record.signed_at.slice(0, 10)}`}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 ${
                                isGranted
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300'
                              }`}
                            >
                              {isGranted ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  {isThai ? 'ยินยอม (Granted)' : 'Granted'}
                                </>
                              ) : (
                                <>
                                  <ShieldAlert className="w-3.5 h-3.5" />
                                  {isThai
                                    ? 'ไม่อนุญาตเผยแพร่ (Revoked)'
                                    : 'Revoked'}
                                </>
                              )}
                            </span>

                            {record && (
                              <button
                                type="button"
                                onClick={() => {
                                  toggleStudentConsent(
                                    effectivePipelineStudentId,
                                    purpose.code,
                                    !isGranted
                                  );
                                  syncPipeline();
                                  toast.success(
                                    isThai
                                      ? `อัปเดตสถานะ PDPA (${purpose.code}) เรียบร้อยแล้ว`
                                      : `Updated PDPA consent (${purpose.code})`
                                  );
                                }}
                                className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
                              >
                                {isThai ? 'สลับสถานะ' : 'Toggle'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
