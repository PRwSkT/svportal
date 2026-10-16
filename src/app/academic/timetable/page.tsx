'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  CalendarDays, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  Users, 
  Clock, 
  Plus, 
  RefreshCw, 
  ArrowLeft, 
  Search,
  BookOpen,
  ShieldAlert,
  Sliders,
  Check,
  X,
  FileText,
  Coffee,
  Utensils,
  Moon,
  Flag,
  Bell,
  Pencil,
  ArrowLeftRight,
  Trash2,
  Info,
  Settings2,
  Bot,
  CalendarOff,
  Lock,
  Printer
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  PRIMARY_SCHEDULE_SLOTS, 
  KINDERGARTEN_SCHEDULE_SLOTS, 
  DAILY_ROUTINE_CONFIG,
  getDayName 
} from '@/lib/academic/timetable-engine';
import { TimetableScheduleSlot } from '@/types/academic';
import { NongFahAcademicChatBox } from '@/components/academic/NongFahAcademicChatBox';

interface ClassItem {
  id: string;
  name: string;
  grade_level: string;
}

interface TeacherItem {
  id: string;
  name_th: string;
  position_th: string;
}

interface CourseItem {
  id: string;
  course_code: string;
  name_th: string;
  name_en?: string | null;
  subject_group: string;
  grade_level: string;
  course_type?: string;
}

interface TimetableSlotItem {
  id: string;
  day_of_week: number;
  period_number: number;
  room_name: string | null;
  class_id: string;
  course_id: string;
  teacher_id: string;
  class?: { id: string; name: string; grade_level: string };
  course?: { id: string; course_code: string; name_th: string; subject_group: string };
  teacher?: { id: string; name_th: string; position_th: string };
}

const ALL_SUBJECT_GROUPS = [
  'คณิตศาสตร์',
  'ภาษาไทย',
  'วิทยาศาสตร์และเทคโนโลยี',
  'ภาษาต่างประเทศ',
  'สังคมศึกษา ศาสนา และวัฒนธรรม',
  'สุขศึกษาและพลศึกษา',
  'ศิลปะ',
  'การงานอาชีพ'
];

const ALL_GRADE_LEVELS = [
  { id: 'K1', label: 'อนุบาล 1 (K1)', section: 'kindergarten' },
  { id: 'K2', label: 'อนุบาล 2 (K2)', section: 'kindergarten' },
  { id: 'K3', label: 'อนุบาล 3 (K3)', section: 'kindergarten' },
  { id: 'P1', label: 'ประถมศึกษาปีที่ 1 (P1)', section: 'primary' },
  { id: 'P2', label: 'ประถมศึกษาปีที่ 2 (P2)', section: 'primary' },
  { id: 'P3', label: 'ประถมศึกษาปีที่ 3 (P3)', section: 'primary' },
  { id: 'P4', label: 'ประถมศึกษาปีที่ 4 (P4)', section: 'primary' },
  { id: 'P5', label: 'ประถมศึกษาปีที่ 5 (P5)', section: 'primary' },
  { id: 'P6', label: 'ประถมศึกษาปีที่ 6 (P6)', section: 'primary' }
];

export default function AcademicTimetablePage() {
  const [activeTab, setActiveTab] = useState<'class' | 'teacher' | 'substitute' | 'matrix'>('class');
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [competencies, setCompetencies] = useState<any[]>([]);
  const [slots, setSlots] = useState<TimetableSlotItem[]>([]);
  const [collisions, setCollisions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [selectedTerm, setSelectedTerm] = useState<string>('1');

  // Substitute State
  const [subDate, setSubDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [subAbsentTeacherId, setSubAbsentTeacherId] = useState<string>('');
  const [subReason, setSubReason] = useState<string>('ลาป่วย/ลากิจ');
  const [isMatchingSub, setIsMatchingSub] = useState(false);
  const [proposedSubs, setProposedSubs] = useState<any[]>([]);
  const [activeSubstitutions, setActiveSubstitutions] = useState<any[]>([]);

  // Manual Substitution Adjustment & Slip Print State
  const [editingSub, setEditingSub] = useState<any | null>(null);
  const [isEditSubModalOpen, setIsEditSubModalOpen] = useState(false);
  const [isSavingSub, setIsSavingSub] = useState(false);
  const [subEditTeacherId, setSubEditTeacherId] = useState('');
  const [subEditWorksheet, setSubEditWorksheet] = useState('');
  const [subEditReason, setSubEditReason] = useState('');
  const [subEditStatus, setSubEditStatus] = useState('PROPOSED');

  const [printingSub, setPrintingSub] = useState<any | null>(null);
  const [isPrintSubModalOpen, setIsPrintSubModalOpen] = useState(false);

  // Generator State
  const [isGenerating, setIsGenerating] = useState(false);

  // Schedule Slot Configuration & Break Times State
  const [schedulePreset, setSchedulePreset] = useState<'primary' | 'kindergarten'>('primary');
  const [primarySlots, setPrimarySlots] = useState<TimetableScheduleSlot[]>(PRIMARY_SCHEDULE_SLOTS);
  const [kindergartenSlots, setKindergartenSlots] = useState<TimetableScheduleSlot[]>(KINDERGARTEN_SCHEDULE_SLOTS);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [editingSlots, setEditingSlots] = useState<TimetableScheduleSlot[]>(PRIMARY_SCHEDULE_SLOTS);

  // Quick Swap Mode State
  const [isQuickSwapMode, setIsQuickSwapMode] = useState(false);
  const [quickSwapSource, setQuickSwapSource] = useState<{
    dayOfWeek: number;
    periodNumber: number;
    slot: TimetableSlotItem | null;
  } | null>(null);

  // Manual Slot Edit / Create / Swap Modal State
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualContext, setManualContext] = useState<{
    dayOfWeek: number;
    periodNumber: number;
    slot: TimetableSlotItem | null;
  } | null>(null);
  const [manualTab, setManualTab] = useState<'edit' | 'swap'>('edit');
  const [manualCourseId, setManualCourseId] = useState('');
  const [manualTeacherId, setManualTeacherId] = useState('');
  const [manualRoomName, setManualRoomName] = useState('');
  const [swapTargetDay, setSwapTargetDay] = useState<number>(1);
  const [swapTargetPeriod, setSwapTargetPeriod] = useState<number>(1);
  const [isSavingManual, setIsSavingManual] = useState(false);

  // Teacher Competency Adjustment State
  const [isCompetencyModalOpen, setIsCompetencyModalOpen] = useState(false);
  const [editingCompetency, setEditingCompetency] = useState<{
    teacher_id: string;
    name_th: string;
    position_th: string;
    eligible_subject_groups: string[];
    eligible_grade_levels: string[];
    target_weekly_hours: number;
    max_weekly_hours: number;
    unavailable_slots?: string[];
    is_active: boolean;
  } | null>(null);
  const [isSavingCompetency, setIsSavingCompetency] = useState(false);
  const [competencySearch, setCompetencySearch] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, [selectedTerm]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'substitute' || tabParam === 'chat') {
        setActiveTab('substitute');
      } else if (tabParam === 'teacher' || tabParam === 'matrix') {
        setActiveTab(tabParam as any);
      }
      if (params.get('chat') === 'open') {
        window.dispatchEvent(new CustomEvent('open-nongfah-chat'));
      }
    }
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // 1. Fetch classes
      const cRes = await fetch('/api/academic/classes?academic_year=2568');
      const cData = await cRes.json();
      if (cData.success && cData.classes) {
        setClasses(cData.classes);
        if (cData.classes.length > 0 && !selectedClassId) {
          setSelectedClassId(cData.classes[0].id);
        }
      }

      // 2. Fetch teacher competencies & teachers
      const tRes = await fetch('/api/academic/teacher-competencies');
      const tData = await tRes.json();
      if (tData.success) {
        setCompetencies(tData.competencies || []);
        const teacherList = (tData.competencies || []).map((c: any) => ({
          id: c.teacher_id,
          name_th: c.name_th,
          position_th: c.position_th
        }));
        setTeachers(teacherList);
        if (teacherList.length > 0 && !selectedTeacherId) {
          setSelectedTeacherId(teacherList[0].id);
        }
      }

      // 3. Fetch courses
      const coRes = await fetch('/api/academic/courses?academic_year=2568');
      const coData = await coRes.json();
      if (coData.success && coData.courses) {
        setCourses(coData.courses);
      }

      // 4. Fetch timetable slots
      await fetchTimetableSlots();

      // 5. Fetch recent substitutions
      const sRes = await fetch('/api/academic/substitutions');
      const sData = await sRes.json();
      if (sData.success) {
        setActiveSubstitutions(sData.substitutions || []);
      }
    } catch (err) {
      console.error(err);
      toast.error('โหลดข้อมูลตารางสอนไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const fetchTimetableSlots = async () => {
    try {
      const res = await fetch(`/api/academic/timetable?term=${selectedTerm}&academic_year=2568`);
      const data = await res.json();
      if (data.success) {
        setSlots(data.slots || []);
        setCollisions(data.collisions || []);
      }
    } catch (err) {
      console.error('Fetch slots error:', err);
    }
  };

  // Run NongFah AI Solver
  const handleGenerateTimetable = async () => {
    setIsGenerating(true);
    const toastId = toast.loading('น้องฟ้า AI กำลังคำนวณหลบชั่วโมงชนและเกลี่ยภาระงาน...');
    try {
      const res = await fetch('/api/academic/timetable/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academic_year: '2568',
          term: selectedTerm,
          clear_existing: true
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message, { id: toastId });
        await fetchTimetableSlots();
      } else {
        toast.error(data.error || 'คำนวณตารางสอนไม่สำเร็จ', { id: toastId });
      }
    } catch (err) {
      toast.error('เกิดข้อผิดพลาดในการคำนวณ', { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  };

  // Find 5-Tier Substitute
  const handleMatchSubstitute = async () => {
    if (!subAbsentTeacherId) {
      toast.error('กรุณาเลือกครูที่ต้องการลา');
      return;
    }
    setIsMatchingSub(true);
    const toastId = toast.loading('น้องฟ้ากำลังสแกนค้นหาครูว่างด้วยอัลกอริทึม 5 ลำดับขั้น...');
    try {
      const res = await fetch('/api/academic/substitutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: subDate,
          original_teacher_id: subAbsentTeacherId,
          reason: subReason
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message, { id: toastId });
        setProposedSubs(data.substitutions || []);
        const sRes = await fetch('/api/academic/substitutions');
        const sData = await sRes.json();
        if (sData.success) setActiveSubstitutions(sData.substitutions || []);
      } else {
        toast.error(data.error || 'ค้นหาครูสอนแทนไม่สำเร็จ', { id: toastId });
      }
    } catch (err) {
      toast.error('เกิดข้อผิดพลาด', { id: toastId });
    } finally {
      setIsMatchingSub(false);
    }
  };

  // Approve Substitution
  const handleUpdateSubStatus = async (subId: string, status: string) => {
    try {
      const res = await fetch(`/api/academic/substitutions/${subId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        const sRes = await fetch('/api/academic/substitutions');
        const sData = await sRes.json();
        if (sData.success) setActiveSubstitutions(sData.substitutions || []);
      }
    } catch (err) {
      toast.error('ปรับสถานะไม่สำเร็จ');
    }
  };

  // Open Manual Edit Modal for Substitution
  const handleOpenEditSub = (sub: any) => {
    setEditingSub(sub);
    setSubEditTeacherId(sub.substitute_teacher_id || '');
    setSubEditWorksheet(sub.worksheet_info || '');
    setSubEditReason(sub.reason || '');
    setSubEditStatus(sub.status || 'PROPOSED');
    setIsEditSubModalOpen(true);
  };

  // Save Manual Changes to Substitution
  const handleSaveEditSub = async () => {
    if (!editingSub) return;
    setIsSavingSub(true);
    const toastId = toast.loading('กำลังบันทึกการปรับปรุงข้อมูลการสอนแทน...');
    try {
      const res = await fetch(`/api/academic/substitutions/${editingSub.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          substitute_teacher_id: subEditTeacherId || null,
          worksheet_info: subEditWorksheet,
          reason: subEditReason,
          status: subEditStatus
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('บันทึกการปรับปรุงข้อมูลการสอนแทนเรียบร้อยแล้ว', { id: toastId });
        setIsEditSubModalOpen(false);
        const sRes = await fetch('/api/academic/substitutions');
        const sData = await sRes.json();
        if (sData.success) setActiveSubstitutions(sData.substitutions || []);
      } else {
        toast.error(data.error || 'บันทึกไม่สำเร็จ', { id: toastId });
      }
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาดในการบันทึก: ' + err.message, { id: toastId });
    } finally {
      setIsSavingSub(false);
    }
  };

  // Delete / Cancel Substitution
  const handleDeleteSub = async (subId: string) => {
    if (!confirm('ยืนยันยกเลิกและลบรายการสอนแทนนี้?')) return;
    const toastId = toast.loading('กำลังลบรายการสอนแทน...');
    try {
      const res = await fetch(`/api/academic/substitutions/${subId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'ลบรายการสอนแทนเรียบร้อยแล้ว', { id: toastId });
        setIsEditSubModalOpen(false);
        const sRes = await fetch('/api/academic/substitutions');
        const sData = await sRes.json();
        if (sData.success) setActiveSubstitutions(sData.substitutions || []);
      } else {
        toast.error(data.error || 'ลบไม่สำเร็จ', { id: toastId });
      }
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาดในการลบ', { id: toastId });
    }
  };

  // Open Handover Slip Print Preview
  const handleOpenPrintSub = (sub: any) => {
    setPrintingSub(sub);
    setIsPrintSubModalOpen(true);
  };

  // Helper days
  const days = [
    { num: 1, name: 'จันทร์', color: 'border-l-amber-400' },
    { num: 2, name: 'อังคาร', color: 'border-l-pink-400' },
    { num: 3, name: 'พุธ', color: 'border-l-emerald-400' },
    { num: 4, name: 'พฤหัสบดี', color: 'border-l-orange-400' },
    { num: 5, name: 'ศุกร์', color: 'border-l-blue-400' }
  ];

  // Selected class & department detection
  const selectedClass = classes.find(c => c.id === selectedClassId);
  const isKindergarten = selectedClass?.grade_level?.startsWith('K') || selectedClass?.name?.startsWith('อ.');

  // Automatically sync preset when selected class changes
  useEffect(() => {
    if (isKindergarten) {
      setSchedulePreset('kindergarten');
    } else {
      setSchedulePreset('primary');
    }
  }, [isKindergarten]);

  // Load custom schedule from localStorage if previously edited
  useEffect(() => {
    try {
      const savedP = localStorage.getItem('sv_primary_schedule_slots');
      if (savedP) setPrimarySlots(JSON.parse(savedP));
      const savedK = localStorage.getItem('sv_kindergarten_schedule_slots');
      if (savedK) setKindergartenSlots(JSON.parse(savedK));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const activeScheduleSlots = schedulePreset === 'kindergarten' ? kindergartenSlots : primarySlots;
  const activeRoutine = schedulePreset === 'kindergarten' ? DAILY_ROUTINE_CONFIG.kindergarten : DAILY_ROUTINE_CONFIG.primary;

  // Break icon renderer without emojis
  const renderBreakIcon = (iconName?: string, breakType?: string, className = "w-4 h-4") => {
    if (breakType === 'lunch' || iconName === 'utensils') return <Utensils className={className} />;
    if (breakType === 'nap' || iconName === 'moon') return <Moon className={className} />;
    return <Coffee className={className} />;
  };

  // Routine icon renderer without emojis
  const renderRoutineIcon = (iconName: string) => {
    if (iconName === 'flag') return <Flag className="w-3.5 h-3.5 text-sky-600" />;
    if (iconName === 'bell') return <Bell className="w-3.5 h-3.5 text-amber-600" />;
    return <Clock className="w-3.5 h-3.5 text-slate-500" />;
  };

  const handleOpenScheduleModal = () => {
    setEditingSlots(JSON.parse(JSON.stringify(activeScheduleSlots)));
    setIsScheduleModalOpen(true);
  };

  const handleSaveScheduleSlots = () => {
    if (schedulePreset === 'kindergarten') {
      setKindergartenSlots(editingSlots);
      try {
        localStorage.setItem('sv_kindergarten_schedule_slots', JSON.stringify(editingSlots));
      } catch (e) {}
    } else {
      setPrimarySlots(editingSlots);
      try {
        localStorage.setItem('sv_primary_schedule_slots', JSON.stringify(editingSlots));
      } catch (e) {}
    }
    setIsScheduleModalOpen(false);
    toast.success('บันทึกการกำหนดช่วงเวลาเรียนและเวลาพักเรียบร้อยแล้ว');
  };

  const handleResetScheduleSlots = (presetType: 'primary' | 'kindergarten') => {
    if (presetType === 'kindergarten') {
      setEditingSlots(KINDERGARTEN_SCHEDULE_SLOTS);
      setKindergartenSlots(KINDERGARTEN_SCHEDULE_SLOTS);
      try {
        localStorage.removeItem('sv_kindergarten_schedule_slots');
      } catch (e) {}
    } else {
      setEditingSlots(PRIMARY_SCHEDULE_SLOTS);
      setPrimarySlots(PRIMARY_SCHEDULE_SLOTS);
      try {
        localStorage.removeItem('sv_primary_schedule_slots');
      } catch (e) {}
    }
    toast.success(`คืนค่าช่วงเวลาและเวลาพักตามมาตรฐาน${presetType === 'kindergarten' ? 'ปฐมวัย' : 'ประถม'}เรียบร้อยแล้ว`);
  };

  const handleSlotChange = (index: number, field: 'startTime' | 'endTime' | 'label', value: string) => {
    setEditingSlots(prev => {
      const next = [...prev];
      const item = { ...next[index], [field]: value };
      if (field === 'startTime' || field === 'endTime') {
        const s = field === 'startTime' ? value : item.startTime;
        const e = field === 'endTime' ? value : item.endTime;
        item.timeRange = `${s} - ${e}`;
        const [sh, sm] = s.split(':').map(Number);
        const [eh, em] = e.split(':').map(Number);
        if (!isNaN(sh) && !isNaN(sm) && !isNaN(eh) && !isNaN(em)) {
          const diff = (eh * 60 + em) - (sh * 60 + sm);
          if (diff > 0) {
            item.durationMinutes = diff;
          }
        }
      }
      next[index] = item;
      return next;
    });
  };

  // Filter slots for class view
  const currentClassSlots = slots.filter(s => s.class_id === selectedClassId);
  // Filter slots for teacher view
  const currentTeacherSlots = slots.filter(s => s.teacher_id === selectedTeacherId);

  // Available courses filtered for current class
  const classEligibleCourses = courses.filter(c => !selectedClass?.grade_level || c.grade_level === selectedClass.grade_level);
  const availableCourses = classEligibleCourses.length > 0 ? classEligibleCourses : courses;

  // MANUAL ADJUSTMENT HANDLERS
  const handleCellClick = (day: number, period: number, slot: TimetableSlotItem | null) => {
    if (isQuickSwapMode) {
      if (!quickSwapSource) {
        setQuickSwapSource({ dayOfWeek: day, periodNumber: period, slot });
        toast.info(`เลือกคาบเริ่มต้น: วัน${getDayName(day)} คาบที่ ${period} แล้ว กรุณาคลิกคาบปลายทางเพื่อสลับ`);
      } else {
        if (quickSwapSource.dayOfWeek === day && quickSwapSource.periodNumber === period) {
          setQuickSwapSource(null);
          toast.info('ยกเลิกการเลือกคาบ');
          return;
        }

        const s1 = quickSwapSource.slot;
        const s2 = slot;

        if (!s1 && !s2) {
          toast.error('ไม่สามารถสลับระหว่างสองคาบว่างได้');
          setQuickSwapSource(null);
          return;
        }

        executeQuickSwap(quickSwapSource, { dayOfWeek: day, periodNumber: period, slot });
      }
    } else {
      openManualModal(day, period, slot);
    }
  };

  const executeQuickSwap = async (
    source: { dayOfWeek: number; periodNumber: number; slot: TimetableSlotItem | null },
    target: { dayOfWeek: number; periodNumber: number; slot: TimetableSlotItem | null }
  ) => {
    const s1 = source.slot;
    const s2 = target.slot;
    const toastId = toast.loading('กำลังสลับคาบและตรวจสอบข้อขัดแย้ง...');

    try {
      let body: any;
      if (s1 && s2) {
        body = {
          action: 'swap',
          slot_id_1: s1.id,
          slot_id_2: s2.id,
          class_id: selectedClassId,
          academic_year: '2568',
          term: selectedTerm
        };
      } else if (s1 && !s2) {
        body = {
          action: 'swap',
          slot_id_1: s1.id,
          target_day: target.dayOfWeek,
          target_period: target.periodNumber,
          class_id: selectedClassId,
          academic_year: '2568',
          term: selectedTerm
        };
      } else if (!s1 && s2) {
        body = {
          action: 'swap',
          slot_id_1: s2.id,
          target_day: source.dayOfWeek,
          target_period: source.periodNumber,
          class_id: selectedClassId,
          academic_year: '2568',
          term: selectedTerm
        };
      }

      const res = await fetch('/api/academic/timetable', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (data.success) {
        toast.success(data.message || 'สลับคาบเรียนสำเร็จ', { id: toastId });
        await fetchTimetableSlots();
      } else {
        toast.error(data.error || 'ไม่สามารถสลับคาบได้', { id: toastId });
      }
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาดในการสลับคาบ', { id: toastId });
    } finally {
      setQuickSwapSource(null);
    }
  };

  const openManualModal = (day: number, period: number, slot: TimetableSlotItem | null) => {
    setManualContext({ dayOfWeek: day, periodNumber: period, slot });
    setManualTab('edit');

    if (slot) {
      setManualCourseId(slot.course_id);
      setManualTeacherId(slot.teacher_id);
      setManualRoomName(slot.room_name || selectedClass?.name || '');
    } else {
      setManualCourseId(availableCourses[0]?.id || '');
      setManualTeacherId(teachers[0]?.id || '');
      setManualRoomName(selectedClass?.name || '');
    }

    const nextPeriod = period === 6 ? 1 : period + 1;
    const nextDay = period === 6 ? (day === 5 ? 1 : day + 1) : day;
    setSwapTargetDay(nextDay);
    setSwapTargetPeriod(nextPeriod);

    setIsManualModalOpen(true);
  };

  const handleSaveManualSlot = async () => {
    if (!manualContext || !manualCourseId || !manualTeacherId) {
      toast.error('กรุณาเลือกรายวิชาและครูผู้สอนให้ครบถ้วน');
      return;
    }

    // Pre-check collision with teacher in other classes
    const existingConflict = slots.find(
      s => s.teacher_id === manualTeacherId &&
           s.day_of_week === manualContext.dayOfWeek &&
           s.period_number === manualContext.periodNumber &&
           s.class_id !== selectedClassId
    );

    if (existingConflict) {
      toast.error(`ไม่สามารถบันทึกได้: คุณครูมีสอนที่ห้อง ${existingConflict.class?.name || 'อื่น'} ในคาบนี้แล้ว`);
      return;
    }

    setIsSavingManual(true);
    const toastId = toast.loading('กำลังบันทึกคาบเรียน...');
    try {
      const res = await fetch('/api/academic/timetable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academic_year: '2568',
          term: selectedTerm,
          class_id: selectedClassId,
          course_id: manualCourseId,
          teacher_id: manualTeacherId,
          day_of_week: manualContext.dayOfWeek,
          period_number: manualContext.periodNumber,
          room_name: manualRoomName
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'บันทึกคาบเรียนเรียบร้อยแล้ว', { id: toastId });
        await fetchTimetableSlots();
        setIsManualModalOpen(false);
      } else {
        toast.error(data.error || 'บันทึกคาบเรียนไม่สำเร็จ', { id: toastId });
      }
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาดในการบันทึก', { id: toastId });
    } finally {
      setIsSavingManual(false);
    }
  };

  const handleClearManualSlot = async () => {
    if (!manualContext?.slot?.id) {
      setIsManualModalOpen(false);
      return;
    }

    setIsSavingManual(true);
    const toastId = toast.loading('กำลังลบวิชาออกจากคาบนี้...');
    try {
      const res = await fetch(`/api/academic/timetable?id=${manualContext.slot.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        toast.success('ลบวิชาออกจากคาบนี้เรียบร้อยแล้ว (ปรับเป็นคาบว่าง)', { id: toastId });
        await fetchTimetableSlots();
        setIsManualModalOpen(false);
      } else {
        toast.error(data.error || 'ลบไม่สำเร็จ', { id: toastId });
      }
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาดในการลบ', { id: toastId });
    } finally {
      setIsSavingManual(false);
    }
  };

  const handleExecuteSwapFromModal = async () => {
    if (!manualContext) return;
    const s1 = manualContext.slot;
    const targetSlot = currentClassSlots.find(
      s => s.day_of_week === swapTargetDay && s.period_number === swapTargetPeriod
    );

    if (!s1 && !targetSlot) {
      toast.error('คาบทั้งสองเป็นคาบว่าง ไม่สามารถสลับได้');
      return;
    }

    setIsSavingManual(true);
    const toastId = toast.loading('กำลังสลับคาบเรียนและตรวจสอบข้อขัดแย้ง...');
    try {
      let body: any;
      if (s1 && targetSlot) {
        body = {
          action: 'swap',
          slot_id_1: s1.id,
          slot_id_2: targetSlot.id,
          class_id: selectedClassId,
          academic_year: '2568',
          term: selectedTerm
        };
      } else if (s1 && !targetSlot) {
        body = {
          action: 'swap',
          slot_id_1: s1.id,
          target_day: swapTargetDay,
          target_period: swapTargetPeriod,
          class_id: selectedClassId,
          academic_year: '2568',
          term: selectedTerm
        };
      } else if (!s1 && targetSlot) {
        body = {
          action: 'swap',
          slot_id_1: targetSlot.id,
          target_day: manualContext.dayOfWeek,
          target_period: manualContext.periodNumber,
          class_id: selectedClassId,
          academic_year: '2568',
          term: selectedTerm
        };
      }

      const res = await fetch('/api/academic/timetable', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'สลับคาบเรียนสำเร็จ', { id: toastId });
        await fetchTimetableSlots();
        setIsManualModalOpen(false);
      } else {
        toast.error(data.error || 'ไม่สามารถสลับคาบได้', { id: toastId });
      }
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาดในการสลับคาบ', { id: toastId });
    } finally {
      setIsSavingManual(false);
    }
  };

  // Competency Handlers
  const handleOpenCompetencyModal = (comp: any) => {
    setEditingCompetency({
      teacher_id: comp.teacher_id,
      name_th: comp.name_th,
      position_th: comp.position_th || '',
      eligible_subject_groups: Array.isArray(comp.eligible_subject_groups) ? [...comp.eligible_subject_groups] : [],
      eligible_grade_levels: Array.isArray(comp.eligible_grade_levels) ? [...comp.eligible_grade_levels] : [],
      target_weekly_hours: Number(comp.target_weekly_hours) || 18,
      max_weekly_hours: Number(comp.max_weekly_hours) || 22,
      unavailable_slots: Array.isArray(comp.unavailable_slots) ? [...comp.unavailable_slots] : [],
      is_active: comp.is_active ?? true
    });
    setIsCompetencyModalOpen(true);
  };

  const handleToggleSubjectGroup = (group: string) => {
    if (!editingCompetency) return;
    const current = editingCompetency.eligible_subject_groups;
    const exists = current.includes(group);
    const updated = exists ? current.filter(g => g !== group) : [...current, group];
    setEditingCompetency({ ...editingCompetency, eligible_subject_groups: updated });
  };

  const handleToggleGradeLevel = (gl: string) => {
    if (!editingCompetency) return;
    const current = editingCompetency.eligible_grade_levels;
    const exists = current.includes(gl);
    const updated = exists ? current.filter(g => g !== gl) : [...current, gl];
    setEditingCompetency({ ...editingCompetency, eligible_grade_levels: updated });
  };

  const handleToggleUnavailableSlot = (day: number, period: number) => {
    if (!editingCompetency) return;
    const key = `${day}-${period}`;
    const current = editingCompetency.unavailable_slots || [];
    const exists = current.includes(key);
    const updated = exists ? current.filter(k => k !== key) : [...current, key];
    setEditingCompetency({ ...editingCompetency, unavailable_slots: updated });
  };

  const handleSaveCompetency = async () => {
    if (!editingCompetency) return;
    setIsSavingCompetency(true);
    const toastId = toast.loading('กำลังบันทึกคุณสมบัติครูผู้สอน...');
    try {
      const res = await fetch('/api/academic/teacher-competencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacher_id: editingCompetency.teacher_id,
          eligible_subject_groups: editingCompetency.eligible_subject_groups,
          eligible_grade_levels: editingCompetency.eligible_grade_levels,
          target_weekly_hours: editingCompetency.target_weekly_hours,
          max_weekly_hours: editingCompetency.max_weekly_hours,
          unavailable_slots: editingCompetency.unavailable_slots || [],
          is_active: editingCompetency.is_active
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'บันทึกคุณสมบัติครูเรียบร้อยแล้ว', { id: toastId });
        setCompetencies(prev => prev.map(c => {
          if (c.teacher_id === editingCompetency.teacher_id) {
            return {
              ...c,
              eligible_subject_groups: editingCompetency.eligible_subject_groups,
              eligible_grade_levels: editingCompetency.eligible_grade_levels,
              target_weekly_hours: editingCompetency.target_weekly_hours,
              max_weekly_hours: editingCompetency.max_weekly_hours,
              is_active: editingCompetency.is_active
            };
          }
          return c;
        }));
        setIsCompetencyModalOpen(false);
      } else {
        toast.error(data.error || 'บันทึกคุณสมบัติไม่สำเร็จ', { id: toastId });
      }
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาดในการบันทึก: ' + err.message, { id: toastId });
    } finally {
      setIsSavingCompetency(false);
    }
  };

  // Filtered competencies based on search
  const filteredCompetencies = competencies.filter(c => {
    if (!competencySearch.trim()) return true;
    const q = competencySearch.toLowerCase();
    const nameMatch = (c.name_th || '').toLowerCase().includes(q);
    const posMatch = (c.position_th || '').toLowerCase().includes(q);
    const subMatch = (c.eligible_subject_groups || []).some((sg: string) => sg.toLowerCase().includes(q));
    const gradeMatch = (c.eligible_grade_levels || []).some((gl: string) => gl.toLowerCase().includes(q));
    return nameMatch || posMatch || subMatch || gradeMatch;
  });

  const totalTeachersCount = competencies.length;
  const activeTeachersCount = competencies.filter(c => c.is_active !== false).length;
  const avgMaxHours = totalTeachersCount > 0
    ? Math.round((competencies.reduce((acc, c) => acc + (Number(c.max_weekly_hours) || 22), 0) / totalTeachersCount) * 10) / 10
    : 22;
  const primaryTeachersCount = competencies.filter(c => (c.eligible_grade_levels || []).some((gl: string) => gl.startsWith('P'))).length;
  const earlyYearsTeachersCount = competencies.filter(c => (c.eligible_grade_levels || []).some((gl: string) => gl.startsWith('K'))).length;

  // Live conflict evaluation for manual modal
  const modalSelectedTeacherObj = teachers.find(t => t.id === manualTeacherId);
  const modalSelectedCourseObj = courses.find(c => c.id === manualCourseId);
  const modalTeacherConflict = manualContext
    ? slots.find(
        s => s.teacher_id === manualTeacherId &&
             s.day_of_week === manualContext.dayOfWeek &&
             s.period_number === manualContext.periodNumber &&
             s.class_id !== selectedClassId
      )
    : null;

  const modalTeacherComp = competencies.find(c => c.teacher_id === manualTeacherId);
  const modalCompetencyMatch = modalSelectedCourseObj && modalTeacherComp?.eligible_subject_groups
    ? modalTeacherComp.eligible_subject_groups.includes(modalSelectedCourseObj.subject_group)
    : true;

  const modalSwapTargetSlot = currentClassSlots.find(
    s => s.day_of_week === swapTargetDay && s.period_number === swapTargetPeriod
  );

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      {/* Header Banner - Matching Forms Studio */}
      <div className="bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Link
                  href="/academic"
                  className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#7B1C3E]/10 text-[#7B1C3E] border border-[#7B1C3E]/20 hover:bg-[#7B1C3E]/20 transition-all inline-flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Somkid Academic Studio
                </Link>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs text-slate-500 font-medium">
                  ระบบจัดตารางสอน & น้องฟ้า AI จัดสอนแทน
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                ตารางเรียนตารางสอน & จัดสอนแทนอัจฉริยะ
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
                ระบบจัดตารางสอนโรงเรียนสมคิดวิทยา คำนวณหลบชั่วโมงชน 100% เกลี่ยภาระงานครูอย่างสมดุล พร้อมจัดครูสอนแทนน้องฟ้า AI และระบบ Manual Adjust
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('open-nongfah-chat'));
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:border-[#7B1C3E]/40 hover:bg-[#7B1C3E]/5 text-slate-700 rounded-2xl text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer"
              >
                <Bot className="w-4 h-4 text-[#7B1C3E]" />
                <span>คุยกับน้องฟ้า AI</span>
              </button>
              <button
                onClick={handleGenerateTimetable}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#7B1C3E] hover:bg-[#631430] text-white rounded-2xl text-xs sm:text-sm font-bold shadow-md shadow-[#7B1C3E]/20 transition-all cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isGenerating ? 'น้องฟ้ากำลังร่างตาราง...' : 'น้องฟ้าร่างตารางใหม่'}</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar: 4 Cards matching Forms Studio rhythm */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6">
            <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600">ห้องเรียนทั้งหมด</span>
                <BookOpen className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2">{classes.length} ห้อง</div>
              <div className="text-xs text-slate-400 mt-0.5">อนุบาล (K1-K3) และประถม (P1-P6)</div>
            </div>

            <div className="bg-amber-50/70 border border-amber-200/70 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-amber-900">ครูผู้สอนในระบบ</span>
                <Users className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-bold text-amber-950 mt-2">{teachers.length} ท่าน</div>
              <div className="text-xs text-amber-700/80 mt-0.5">พร้อมเกณฑ์ภาระงานรายสัปดาห์</div>
            </div>

            <div className="bg-purple-50/70 border border-purple-200/70 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-purple-900">คาบสอนที่จัดแล้ว</span>
                <CalendarDays className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-bold text-purple-950 mt-2">{slots.length} คาบ</div>
              <div className="text-xs text-purple-700/80 mt-0.5">ภาคเรียนที่ {selectedTerm}/2568</div>
            </div>

            <div className={`border rounded-2xl p-4 transition-all ${
              collisions.length > 0
                ? 'bg-rose-50/80 border-rose-200 ring-2 ring-rose-400'
                : 'bg-[#7B1C3E]/5 border-[#7B1C3E]/15'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium ${collisions.length > 0 ? 'text-rose-900' : 'text-[#7B1C3E]'}`}>
                  {collisions.length > 0 ? 'ตรวจพบข้อขัดแย้ง' : 'ความพร้อมตารางสอน'}
                </span>
                {collisions.length > 0 ? (
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-[#7B1C3E]" />
                )}
              </div>
              <div className={`text-2xl font-bold mt-2 ${collisions.length > 0 ? 'text-rose-950' : 'text-[#7B1C3E]'}`}>
                {collisions.length > 0 ? `${collisions.length} จุดชน` : '100% สมบูรณ์'}
              </div>
              <div className={`text-xs mt-0.5 ${collisions.length > 0 ? 'text-rose-700' : 'text-[#7B1C3E]/70'}`}>
                {collisions.length > 0 ? 'มีครูหรือห้องชนกัน กรุณาตรวจสอบ' : 'ไม่มีคาบสอนชนกัน'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Navigation Tab Bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 overflow-x-auto py-2.5 scrollbar-none">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl border border-slate-200/80">
              <button
                onClick={() => setActiveTab('class')}
                className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'class'
                    ? 'bg-[#7B1C3E] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                ตารางเรียนรายห้อง ({classes.length})
              </button>
              <button
                onClick={() => setActiveTab('teacher')}
                className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'teacher'
                    ? 'bg-[#7B1C3E] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                ตารางสอนรายครู ({teachers.length})
              </button>
              <button
                onClick={() => setActiveTab('substitute')}
                className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'substitute'
                    ? 'bg-[#7B1C3E] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                น้องฟ้า AI จัดสอนแทน
              </button>
              <button
                onClick={() => setActiveTab('matrix')}
                className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'matrix'
                    ? 'bg-[#7B1C3E] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                ภาระงาน & คุณสมบัติครู ({competencies.length})
              </button>
            </div>

            {/* Right side Term Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium hidden sm:inline">ภาคเรียน:</span>
              <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setSelectedTerm('1')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    selectedTerm === '1'
                      ? 'bg-white text-[#7B1C3E] shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  เทอม 1
                </button>
                <button
                  onClick={() => setSelectedTerm('2')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    selectedTerm === '2'
                      ? 'bg-white text-[#7B1C3E] shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  เทอม 2
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {/* Collision Warning Banner */}
        {collisions.length > 0 && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-sm shadow-xs">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
            <div className="flex-1">
              <span className="font-bold">ตรวจพบชั่วโมงชน {collisions.length} จุด: </span>
              {collisions[0].description}
            </div>
          </div>
        )}

        {/* TAB 1: CLASS TIMETABLE VIEW */}
        {activeTab === 'class' && (
          <div className="space-y-4">
            {/* Header controls: Classroom selector + Quick Routine summary + Quick Swap Mode Button */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center gap-3 flex-wrap">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 shrink-0">เลือกห้องเรียน:</label>
                <select
                  value={selectedClassId}
                  onChange={(e) => {
                    setSelectedClassId(e.target.value);
                    setQuickSwapSource(null);
                  }}
                  className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium"
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>
                      ห้อง {c.name} ({c.grade_level})
                    </option>
                  ))}
                </select>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                  isKindergarten
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    : 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                }`}>
                  {isKindergarten ? 'ระดับปฐมวัย (อ.1 - อ.3)' : 'ระดับประถมศึกษา (ป.1 - ป.6)'}
                </span>

                {/* Quick Swap Mode Toggle Button */}
                <button
                  onClick={() => {
                    setIsQuickSwapMode(!isQuickSwapMode);
                    setQuickSwapSource(null);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer ${
                    isQuickSwapMode
                      ? 'bg-[#7B1C3E] text-white ring-2 ring-[#7B1C3E]/30'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  {isQuickSwapMode ? 'กำลังเปิดโหมดสลับคาบด่วน' : 'โหมดสลับคาบด่วน (Quick Swap)'}
                </button>
              </div>

              {/* Routine summary pills & settings button */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-xl text-slate-600 font-medium">
                  {renderRoutineIcon(activeRoutine.morningAssembly.icon)}
                  <span>{activeRoutine.morningAssembly.label}:</span>
                  <strong className="text-slate-900 font-mono">{activeRoutine.morningAssembly.timeRange}</strong>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-xl text-slate-600 font-medium">
                  {renderRoutineIcon(activeRoutine.dismissal.icon)}
                  <span>{activeRoutine.dismissal.label}:</span>
                  <strong className="text-slate-900 font-mono">{activeRoutine.dismissal.timeRange}</strong>
                </div>
                <button
                  onClick={handleOpenScheduleModal}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#7B1C3E]/10 hover:bg-[#7B1C3E]/20 text-[#7B1C3E] rounded-xl font-bold transition shadow-xs cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  กำหนดช่วงเวลา & เวลาพัก
                </button>
              </div>
            </div>

            {/* Quick Swap Active Notice Banner */}
            {isQuickSwapMode && (
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-indigo-950 dark:text-indigo-200 text-xs">
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="w-4 h-4 text-indigo-600 animate-pulse" />
                  <span>
                    {quickSwapSource ? (
                      <>
                        เลือกคาบเริ่มต้น: <strong>วัน{getDayName(quickSwapSource.dayOfWeek)} คาบที่ {quickSwapSource.periodNumber} ({quickSwapSource.slot?.course?.name_th || 'คาบว่าง'})</strong> แล้ว — คลิกอีกคาบหนึ่งเพื่อสลับตำแหน่งทันที
                      </>
                    ) : (
                      <>
                        <strong>โหมดสลับคาบด่วน:</strong> คลิกเลือกคาบแรกที่ต้องการสลับ จากนั้นคลิกคาบที่สองเพื่อสลับที่กันทันที
                      </>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {quickSwapSource && (
                    <button
                      onClick={() => setQuickSwapSource(null)}
                      className="px-2.5 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-100 border"
                    >
                      ยกเลิกการเลือก
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setIsQuickSwapMode(false);
                      setQuickSwapSource(null);
                    }}
                    className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700"
                  >
                    ปิดโหมดสลับคาบด่วน
                  </button>
                </div>
              </div>
            )}

            {/* Timetable Grid with Exact Class Time Intervals & Break Columns */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[950px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 font-bold uppercase">
                    <th className="p-3.5 w-28 text-center bg-slate-100/60 dark:bg-slate-800">วัน / เวลา</th>
                    {activeScheduleSlots.map(slot => {
                      if (slot.type === 'break') {
                        const isLunch = slot.breakType === 'lunch';
                        const isNap = slot.breakType === 'nap';
                        return (
                          <th
                            key={slot.key}
                            className={`p-3 text-center border-l border-slate-200 dark:border-slate-800 min-w-[110px] ${
                              isLunch
                                ? 'bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200'
                                : isNap
                                ? 'bg-purple-50/70 dark:bg-purple-950/30 text-purple-900 dark:text-purple-200'
                                : 'bg-amber-50/70 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200'
                            }`}
                          >
                            <div className="flex items-center justify-center gap-1.5 text-xs font-bold">
                              {renderBreakIcon(slot.icon, slot.breakType)}
                              <span>{slot.label}</span>
                            </div>
                            <div className="text-[11px] font-mono font-bold mt-0.5">
                              {slot.timeRange}
                            </div>
                            <div className="text-[10px] font-normal opacity-70">
                              ({slot.durationMinutes} นาที)
                            </div>
                          </th>
                        );
                      }

                      return (
                        <th key={slot.key} className="p-3 text-center border-l border-slate-200 dark:border-slate-800 min-w-[145px]">
                          <div className="text-slate-900 dark:text-white font-bold text-xs">
                            {slot.label}
                          </div>
                          <div className="text-[11px] font-mono text-sky-700 dark:text-sky-400 font-bold mt-0.5">
                            {slot.timeRange}
                          </div>
                          <div className="text-[10px] font-normal text-slate-400">
                            {slot.sublabel} ({slot.durationMinutes} นาที)
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {days.map(d => (
                    <tr key={d.num} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className={`p-4 font-bold text-center border-l-4 ${d.color} bg-slate-50/40 dark:bg-slate-800/20`}>
                        <div className="text-sm text-slate-900 dark:text-white">{d.name}</div>
                      </td>
                      {activeScheduleSlots.map(slot => {
                        if (slot.type === 'break') {
                          const isLunch = slot.breakType === 'lunch';
                          const isNap = slot.breakType === 'nap';
                          return (
                            <td
                              key={slot.key}
                              className={`p-2 border-l border-slate-200 dark:border-slate-800 text-center align-middle ${
                                isLunch
                                  ? 'bg-emerald-50/40 dark:bg-emerald-950/10'
                                  : isNap
                                  ? 'bg-purple-50/40 dark:bg-purple-950/10'
                                  : 'bg-amber-50/40 dark:bg-amber-950/10'
                              }`}
                            >
                              <div className={`flex flex-col items-center justify-center p-2 rounded-xl border border-dashed h-24 ${
                                isLunch
                                  ? 'border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 bg-white/70 dark:bg-slate-900/60'
                                  : isNap
                                  ? 'border-purple-300 dark:border-purple-800 text-purple-800 dark:text-purple-300 bg-white/70 dark:bg-slate-900/60'
                                  : 'border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 bg-white/70 dark:bg-slate-900/60'
                              }`}>
                                <div className="mb-1">{renderBreakIcon(slot.icon, slot.breakType, 'w-5 h-5')}</div>
                                <span className="text-xs font-bold leading-tight">{slot.label}</span>
                                <span className="text-[10px] font-mono font-medium opacity-80 mt-0.5">{slot.timeRange}</span>
                              </div>
                            </td>
                          );
                        }

                        const p = slot.periodNumber!;
                        const slotItem = currentClassSlots.find(s => s.day_of_week === d.num && s.period_number === p);
                        const isSourceSelected = quickSwapSource?.dayOfWeek === d.num && quickSwapSource?.periodNumber === p;

                        return (
                          <td 
                            key={slot.key} 
                            onClick={() => handleCellClick(d.num, p, slotItem || null)}
                            className="p-2 border-l border-slate-200 dark:border-slate-800 text-center align-top h-28 min-w-[145px] cursor-pointer"
                          >
                            {slotItem ? (
                              <div className={`group p-2.5 rounded-xl h-full flex flex-col justify-between text-xs transition relative ${
                                isSourceSelected
                                  ? 'bg-indigo-100 dark:bg-indigo-950 border-2 border-indigo-600 shadow-md ring-2 ring-indigo-300'
                                  : 'bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900 hover:border-sky-400 hover:shadow-xs'
                              }`}>
                                <div>
                                  <div className="flex items-start justify-between gap-1">
                                    <div className="font-bold text-sky-950 dark:text-sky-100 line-clamp-1 text-left">
                                      {slotItem.course?.name_th}
                                    </div>
                                    <button 
                                      className="opacity-0 group-hover:opacity-100 p-1 text-sky-600 hover:text-sky-800 rounded transition shrink-0"
                                      title="คลิกเพื่อปรับแก้คาบนี้"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-mono mt-0.5 text-left">
                                    {slotItem.course?.course_code}
                                  </div>
                                </div>
                                <div className="mt-1 pt-1 border-t border-sky-100 dark:border-sky-900 flex items-center justify-between text-[11px] text-sky-700 dark:text-sky-300 font-medium">
                                  <span className="truncate">{slotItem.teacher?.name_th || 'ไม่ระบุครู'}</span>
                                  <span className="text-[10px] text-slate-400 shrink-0 ml-1">{slotItem.room_name}</span>
                                </div>
                                {isSourceSelected && (
                                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-indigo-600 text-white rounded-full text-[9px] font-bold shadow-xs">
                                    คาบที่เลือก
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className={`group h-full flex flex-col items-center justify-center text-xs rounded-xl border border-dashed transition relative ${
                                isSourceSelected
                                  ? 'bg-indigo-100 border-2 border-indigo-600'
                                  : 'text-slate-300 dark:text-slate-600 border-slate-200 dark:border-slate-800 hover:border-sky-400 hover:bg-sky-50/50 hover:text-sky-600'
                              }`}>
                                <Plus className="w-4 h-4 mb-0.5 opacity-60 group-hover:scale-110 transition" />
                                <span>คาบว่าง</span>
                                {isQuickSwapMode && (
                                  <span className="text-[9px] opacity-75">คลิกเพื่อย้ายมาที่นี่</span>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              <span>เคล็ดลับ: สามารถคลิกที่คาบเรียนใดก็ได้ เพื่อแก้ไขรายวิชา เปลี่ยนครูผู้สอน หรือสลับคาบได้ด้วยตนเอง (Manual Adjust)</span>
            </div>
          </div>
        )}

        {/* TAB 2: TEACHER TIMETABLE VIEW */}
        {activeTab === 'teacher' && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center gap-3">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">เลือกครูผู้สอน:</label>
                <select
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium"
                >
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name_th} ({t.position_th})
                    </option>
                  ))}
                </select>
                <span className="text-xs text-slate-500">
                  ชั่วโมงสอนรวมสัปดาห์นี้: <strong className="text-sky-600">{currentTeacherSlots.length}</strong> คาบ
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenScheduleModal}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 rounded-xl font-bold text-xs transition shadow-xs"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  กำหนดช่วงเวลา & เวลาพัก
                </button>
              </div>
            </div>

            {/* Teacher Grid */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[950px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 font-bold uppercase">
                    <th className="p-3.5 w-28 text-center bg-slate-100/60 dark:bg-slate-800">วัน / เวลา</th>
                    {activeScheduleSlots.map(slot => {
                      if (slot.type === 'break') {
                        const isLunch = slot.breakType === 'lunch';
                        const isNap = slot.breakType === 'nap';
                        return (
                          <th
                            key={slot.key}
                            className={`p-3 text-center border-l border-slate-200 dark:border-slate-800 min-w-[110px] ${
                              isLunch
                                ? 'bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200'
                                : isNap
                                ? 'bg-purple-50/70 dark:bg-purple-950/30 text-purple-900 dark:text-purple-200'
                                : 'bg-amber-50/70 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200'
                            }`}
                          >
                            <div className="flex items-center justify-center gap-1.5 text-xs font-bold">
                              {renderBreakIcon(slot.icon, slot.breakType)}
                              <span>{slot.label}</span>
                            </div>
                            <div className="text-[11px] font-mono font-bold mt-0.5">
                              {slot.timeRange}
                            </div>
                            <div className="text-[10px] font-normal opacity-70">
                              ({slot.durationMinutes} นาที)
                            </div>
                          </th>
                        );
                      }

                      return (
                        <th key={slot.key} className="p-3 text-center border-l border-slate-200 dark:border-slate-800 min-w-[145px]">
                          <div className="text-slate-900 dark:text-white font-bold text-xs">
                            {slot.label}
                          </div>
                          <div className="text-[11px] font-mono text-sky-700 dark:text-sky-400 font-bold mt-0.5">
                            {slot.timeRange}
                          </div>
                          <div className="text-[10px] font-normal text-slate-400">
                            {slot.sublabel} ({slot.durationMinutes} นาที)
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {days.map(d => (
                    <tr key={d.num}>
                      <td className={`p-4 font-bold text-center border-l-4 ${d.color} bg-slate-50/40 dark:bg-slate-800/20`}>
                        <div className="text-sm text-slate-900 dark:text-white">{d.name}</div>
                      </td>
                      {activeScheduleSlots.map(slot => {
                        if (slot.type === 'break') {
                          const isLunch = slot.breakType === 'lunch';
                          const isNap = slot.breakType === 'nap';
                          return (
                            <td
                              key={slot.key}
                              className={`p-2 border-l border-slate-200 dark:border-slate-800 text-center align-middle ${
                                isLunch
                                  ? 'bg-emerald-50/40 dark:bg-emerald-950/10'
                                  : isNap
                                  ? 'bg-purple-50/40 dark:bg-purple-950/10'
                                  : 'bg-amber-50/40 dark:bg-amber-950/10'
                              }`}
                            >
                              <div className={`flex flex-col items-center justify-center p-2 rounded-xl border border-dashed h-24 ${
                                isLunch
                                  ? 'border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 bg-white/70 dark:bg-slate-900/60'
                                  : isNap
                                  ? 'border-purple-300 dark:border-purple-800 text-purple-800 dark:text-purple-300 bg-white/70 dark:bg-slate-900/60'
                                  : 'border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 bg-white/70 dark:bg-slate-900/60'
                              }`}>
                                <div className="mb-1">{renderBreakIcon(slot.icon, slot.breakType, 'w-5 h-5')}</div>
                                <span className="text-xs font-bold leading-tight">{slot.label}</span>
                                <span className="text-[10px] font-mono font-medium opacity-80 mt-0.5">{slot.timeRange}</span>
                              </div>
                            </td>
                          );
                        }

                        const p = slot.periodNumber!;
                        const slotItem = currentTeacherSlots.find(s => s.day_of_week === d.num && s.period_number === p);
                        return (
                          <td key={slot.key} className="p-2 border-l border-slate-200 dark:border-slate-800 text-center align-top h-28 min-w-[145px]">
                            {slotItem ? (
                              <div 
                                onClick={() => {
                                  setSelectedClassId(slotItem.class_id);
                                  setActiveTab('class');
                                }}
                                className="group p-2.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 rounded-xl h-full flex flex-col justify-between text-xs hover:border-indigo-400 hover:shadow-xs transition cursor-pointer"
                                title="คลิกเพื่อไปที่ตารางห้องเรียนนี้"
                              >
                                <div>
                                  <div className="font-bold text-indigo-900 dark:text-indigo-200 line-clamp-1">
                                    {slotItem.course?.name_th}
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                    ห้อง {slotItem.class?.name}
                                  </div>
                                </div>
                                <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium flex items-center justify-between">
                                  <span>{slotItem.room_name || slotItem.class?.name}</span>
                                  <span className="opacity-0 group-hover:opacity-100 text-[10px] underline font-bold">ปรับแต่ง</span>
                                </div>
                              </div>
                            ) : (
                              <div className="h-full flex items-center justify-center text-xs text-slate-300 dark:text-slate-600 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                                คาบว่าง
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: SUBSTITUTE TEACHER & NONGFAH AI CHAT */}
        {activeTab === 'substitute' && (
          <div className="space-y-6">
            {/* Embedded NongFah AI Chat Box */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Bot className="w-5 h-5 text-[#7B1C3E]" />
                  กล่องแชทน้องฟ้า AI ผู้ช่วยจัดครูสอนแทนและงานวิชาการ
                </h3>
                <p className="text-xs text-slate-500">
                  คุณครูสามารถพิมพ์บอกน้องฟ้าในกล่องแชทนี้เพื่อค้นหาครูสอนแทน ตรวจสอบชั่วโมงชน หรือสั่งการงานวิชาการแบบโต้ตอบได้ทันที
                </p>
              </div>

              <div className="h-[580px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
                <NongFahAcademicChatBox
                  mode="embedded"
                  academicYear="2568"
                  term={selectedTerm}
                  onTimetableUpdated={fetchTimetableSlots}
                />
              </div>
            </div>

            {/* Manual Form Search Accordion */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border p-6 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#7B1C3E]" />
                หรือค้นหาครูสอนแทนผ่านแบบฟอร์ม (NongFah 5-Tier Substitution Engine)
              </h3>
              <p className="text-xs text-slate-500">
                เมื่อครูติดภารกิจหรือลา ระบบจะจับคู่ครูว่างที่มีคุณสมบัติเหมาะสมที่สุด พร้อมดึงใบงานสำเร็จรูปตามรายวิชามาให้ทันที
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    วันที่ครูลา:
                  </label>
                  <input
                    type="date"
                    value={subDate}
                    onChange={(e) => setSubDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    เลือกครูที่ลา:
                  </label>
                  <select
                    value={subAbsentTeacherId}
                    onChange={(e) => setSubAbsentTeacherId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs"
                  >
                    <option value="">-- เลือกครูผู้สอน --</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name_th} ({t.position_th})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    เหตุผลการลา:
                  </label>
                  <input
                    type="text"
                    value={subReason}
                    onChange={(e) => setSubReason(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs"
                    placeholder="เช่น ลาป่วย, ไปราชการ อบรม สพป."
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleMatchSubstitute}
                  disabled={isMatchingSub}
                  className="px-5 py-2.5 bg-[#7B1C3E] hover:bg-[#631430] text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-[#7B1C3E]/20 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <Search className="w-4 h-4" />
                  {isMatchingSub ? 'น้องฟ้ากำลังค้นหา...' : 'สแกนค้นหาครูสอนแทน (5 ลำดับขั้น)'}
                </button>
              </div>
            </div>

            {/* Proposed Candidates List */}
            {proposedSubs.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border p-6 space-y-4">
                <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ผลการจัดสรรครูสอนแทนที่เหมาะสม (Proposed Substitutions)
                </h4>

                <div className="space-y-3">
                  {proposedSubs.map((ps, idx) => {
                    const subId = ps.id || ps.substitution_id;
                    const courseName = ps.course?.name_th || ps.course_name || 'รายวิชา';
                    const className = ps.class?.name || ps.class_name || 'ห้องเรียน';
                    const subTeacherName = ps.substitute_teacher?.name_th || ps.substitute_teacher_name || 'ยังไม่ระบุ';
                    const matchCriteria = ps.matching_criteria || ps.tier_badge || ps.match_reason || 'ระบบจัดสรรอัตโนมัติ';
                    const worksheet = ps.worksheet_info || ps.worksheet_title || 'ตามแผนการจัดการเรียนรู้ประจำสัปดาห์';

                    return (
                      <div
                        key={idx}
                        className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-white">
                              คาบที่ {ps.period_number}: {courseName} (ห้อง {className})
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 text-[10px] font-bold">
                              {matchCriteria}
                            </span>
                          </div>
                          <div className="text-slate-500">
                            ครูสอนแทนที่แนะนำ: <strong className="text-emerald-600">{subTeacherName}</strong>
                          </div>
                          <div className="text-slate-500 dark:text-slate-400 text-[11px] flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5 text-[#7B1C3E]" />
                            ใบงาน/งานที่มอบหมาย: <strong className="text-slate-700 dark:text-slate-200">{worksheet}</strong>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleOpenPrintSub(ps)}
                            className="px-3 py-2 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border rounded-xl font-bold transition text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                            title="พิมพ์ใบมอบหมายงานสอนแทน"
                          >
                            <Printer className="w-3.5 h-3.5 text-[#7B1C3E]" />
                            <span>พิมพ์ใบมอบงาน</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditSub(ps)}
                            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition text-xs flex items-center gap-1.5 cursor-pointer"
                            title="ปรับเปลี่ยนครูสอนแทนหรือใบงานด้วยตนเอง"
                          >
                            <Pencil className="w-3.5 h-3.5 text-slate-500" />
                            <span>ปรับเปลี่ยน</span>
                          </button>
                          {ps.status !== 'APPROVED' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateSubStatus(subId, 'APPROVED')}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition text-xs shadow-xs cursor-pointer flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>อนุมัติการสอนแทน</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Historical Table */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                  บันทึกประวัติการจัดสอนแทน (Substitution History)
                </h4>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>พิมพ์บันทึกสอนแทนรวม</span>
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800 border-b text-slate-500 uppercase font-bold">
                      <th className="p-3">วันที่</th>
                      <th className="p-3">คาบ</th>
                      <th className="p-3">ห้อง</th>
                      <th className="p-3">วิชา</th>
                      <th className="p-3">ครูประจำ</th>
                      <th className="p-3">ครูสอนแทน</th>
                      <th className="p-3 min-w-[150px]">ใบงาน / คำสั่งสอนแทน</th>
                      <th className="p-3 text-center">สถานะ</th>
                      <th className="p-3 text-right">ดำเนินการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {activeSubstitutions.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-6 text-center text-slate-400">ยังไม่มีประวัติการสอนแทน</td>
                      </tr>
                    ) : (
                      activeSubstitutions.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50/50">
                          <td className="p-3 font-medium">{s.date}</td>
                          <td className="p-3">คาบ {s.period_number}</td>
                          <td className="p-3 font-semibold">{s.class?.name || '-'}</td>
                          <td className="p-3">{s.course?.name_th || '-'}</td>
                          <td className="p-3 text-rose-600 font-medium">{s.original_teacher?.name_th || '-'}</td>
                          <td className="p-3 text-emerald-600 font-bold">{s.substitute_teacher?.name_th || '-'}</td>
                          <td className="p-3">
                            {s.worksheet_info ? (
                              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                                <FileText className="w-3.5 h-3.5 text-[#7B1C3E] shrink-0" />
                                <span className="truncate max-w-[170px]" title={s.worksheet_info}>{s.worksheet_info}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px]">-</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              s.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                              s.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' :
                              s.status === 'REJECTED' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' :
                              'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}>
                              {s.status}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenPrintSub(s)}
                                className="p-1.5 text-slate-500 hover:text-[#7B1C3E] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                                title="พิมพ์ใบมอบหมายงานสอนแทน"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditSub(s)}
                                className="p-1.5 text-slate-500 hover:text-[#7B1C3E] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                                title="ปรับปรุงข้อมูลการสอนแทน"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              {s.status === 'PROPOSED' && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateSubStatus(s.id, 'APPROVED')}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                                  title="อนุมัติการสอนแทน"
                                >
                                  อนุมัติ
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: TEACHER COMPETENCY MATRIX */}
        {activeTab === 'matrix' && (
          <div className="space-y-6">
            {/* Top Overview & Action Header */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold text-[#7B1C3E] uppercase tracking-wider mb-1">
                    <Settings2 className="w-4 h-4" />
                    Teacher Competency & Workload Engine
                  </div>
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-xl">
                    เมทริกซ์คุณสมบัติครูผู้สอน & เพดานชั่วโมงสอน
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ปรับแต่งกลุ่มสาระการเรียนรู้ ระดับชั้น และเพดานชั่วโมงสอนสูงสุด เพื่อควบคุมการจัดตารางสอนและจับคู่ครูสอนแทนของระบบน้องฟ้า AI
                  </p>
                </div>

                {/* Search Bar */}
                <div className="relative w-full md:w-72">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={competencySearch}
                    onChange={(e) => setCompetencySearch(e.target.value)}
                    placeholder="ค้นหาชื่อครู, ตำแหน่ง, วิชา..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]"
                  />
                  {competencySearch && (
                    <button
                      onClick={() => setCompetencySearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Stat Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="text-[11px] text-slate-500 font-medium">บุคลากรครูทั้งหมด</div>
                  <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                    {totalTeachersCount} <span className="text-xs font-normal text-slate-400">ท่าน</span>
                  </div>
                </div>
                <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">พร้อมรับตารางสอน</div>
                  <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                    {activeTeachersCount} <span className="text-xs font-normal text-emerald-600/70">ท่าน</span>
                  </div>
                </div>
                <div className="p-3.5 bg-[#7B1C3E]/5 rounded-2xl border border-[#7B1C3E]/15">
                  <div className="text-[11px] text-[#7B1C3E] font-medium">เพดานชั่วโมงสอนเฉลี่ย</div>
                  <div className="text-lg font-bold text-[#7B1C3E] mt-0.5">
                    {avgMaxHours} <span className="text-xs font-normal text-[#7B1C3E]/70">คาบ/สัปดาห์</span>
                  </div>
                </div>
                <div className="p-3.5 bg-purple-50/70 dark:bg-purple-950/20 rounded-2xl border border-purple-200/70 dark:border-purple-900/30">
                  <div className="text-[11px] text-purple-900 dark:text-purple-400 font-medium">ครูประถม / ครูปฐมวัย</div>
                  <div className="text-lg font-bold text-purple-950 dark:text-purple-300 mt-0.5">
                    {primaryTeachersCount} <span className="text-xs font-normal text-purple-700">/</span> {earlyYearsTeachersCount} <span className="text-xs font-normal text-purple-600">ท่าน</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Competency Table */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-bold uppercase tracking-wider">
                      <th className="p-3.5 min-w-[160px]">ครูผู้สอน</th>
                      <th className="p-3.5 min-w-[120px]">ตำแหน่ง</th>
                      <th className="p-3.5 min-w-[240px]">กลุ่มสาระที่สอนได้ (Eligible Subjects)</th>
                      <th className="p-3.5 min-w-[180px]">ระดับชั้นที่สอนได้ (Eligible Grades)</th>
                      <th className="p-3.5 text-center w-28">เพดานชั่วโมง/สัปดาห์</th>
                      <th className="p-3.5 text-center w-24">สถานะ</th>
                      <th className="p-3.5 text-right w-36">ดำเนินการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredCompetencies.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400">
                          ไม่พบข้อมูลครูผู้สอนที่ตรงกับคำค้นหา
                        </td>
                      </tr>
                    ) : (
                      filteredCompetencies.map((comp) => {
                        const subjectCount = (comp.eligible_subject_groups || []).length;
                        const gradeCount = (comp.eligible_grade_levels || []).length;
                        const isAllSubjects = subjectCount >= 8;
                        const isAllGrades = gradeCount >= 9;

                        return (
                          <tr key={comp.teacher_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                            <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                              {comp.name_th}
                            </td>
                            <td className="p-3.5 text-slate-500">
                              {comp.position_th || 'ครูผู้สอน'}
                            </td>
                            <td className="p-3.5">
                              {isAllSubjects ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 rounded-lg text-[11px] font-bold">
                                  <CheckCircle2 className="w-3 h-3 text-sky-600" />
                                  ครบทุกกลุ่มสาระ (8 สาระ)
                                </span>
                              ) : subjectCount === 0 ? (
                                <span className="text-slate-400 italic">ยังไม่ได้กำหนดกลุ่มสาระ</span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {(comp.eligible_subject_groups || []).map((sg: string) => (
                                    <span key={sg} className="px-2 py-0.5 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-100 dark:border-sky-900/40 rounded-md text-[10px] font-medium">
                                      {sg}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="p-3.5">
                              {isAllGrades ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 rounded-lg text-[11px] font-bold">
                                  <CheckCircle2 className="w-3 h-3 text-indigo-600" />
                                  ทุกระดับชั้น (อ.1 - ป.6)
                                </span>
                              ) : gradeCount === 0 ? (
                                <span className="text-slate-400 italic">ยังไม่ได้กำหนดระดับชั้น</span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {(comp.eligible_grade_levels || []).map((gl: string) => {
                                    const isKinder = gl.startsWith('K');
                                    return (
                                      <span
                                        key={gl}
                                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                          isKinder
                                            ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/40'
                                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/40'
                                        }`}
                                      >
                                        {gl}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </td>
                            <td className="p-3.5 text-center">
                              <span className="inline-flex items-center justify-center font-bold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 text-xs">
                                {comp.max_weekly_hours || 22} คาบ
                              </span>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                เป้าหมาย {comp.target_weekly_hours || 18} คาบ
                              </div>
                            </td>
                            <td className="p-3.5 text-center">
                              {comp.is_active !== false ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  พร้อมรับตาราง
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                  พักการสอน
                                </span>
                              )}
                            </td>
                            <td className="p-3.5 text-right">
                              <button
                                onClick={() => handleOpenCompetencyModal(comp)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#7B1C3E] hover:bg-[#631430] text-white rounded-xl text-xs font-bold shadow-2xs transition hover:scale-[1.02] cursor-pointer"
                              >
                                <Pencil className="w-3 h-3" />
                                ปรับแต่งคุณสมบัติ
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* MANUAL SLOT ADJUSTER & SWAP MODAL */}
        {isManualModalOpen && manualContext && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#7B1C3E]/10 text-[#7B1C3E] border border-[#7B1C3E]/20 rounded-2xl">
                    <Pencil className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      ปรับแต่งคาบเรียนด้วยตนเอง (Manual Adjust)
                    </h2>
                    <p className="text-xs text-slate-500">
                      ห้อง {selectedClass?.name} | วัน{getDayName(manualContext.dayOfWeek)} คาบที่ {manualContext.periodNumber} ({activeScheduleSlots.find(s => s.periodNumber === manualContext.periodNumber)?.timeRange || ''})
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsManualModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mode Tabs */}
              <div className="px-6 pt-4 border-b border-slate-200 dark:border-slate-800 flex gap-4 text-xs font-bold">
                <button
                  onClick={() => setManualTab('edit')}
                  className={`pb-3 border-b-2 transition cursor-pointer ${
                    manualTab === 'edit'
                      ? 'border-[#7B1C3E] text-[#7B1C3E]'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {manualContext.slot ? 'แก้ไขวิชาและครูผู้สอน' : 'กำหนดวิชาลงในคาบว่าง'}
                </button>
                <button
                  onClick={() => setManualTab('swap')}
                  className={`pb-3 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                    manualTab === 'swap'
                      ? 'border-[#7B1C3E] text-[#7B1C3E]'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  สลับหรือย้ายคาบเรียน (Swap / Move)
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-4 text-xs">
                {manualTab === 'edit' ? (
                  <>
                    {/* Course Selection */}
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700 dark:text-slate-300">
                        เลือกรายวิชา:
                      </label>
                      <select
                        value={manualCourseId}
                        onChange={(e) => setManualCourseId(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium"
                      >
                        {availableCourses.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.course_code} - {c.name_th} ({c.subject_group})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Teacher Selection */}
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700 dark:text-slate-300">
                        เลือกครูผู้สอน:
                      </label>
                      <select
                        value={manualTeacherId}
                        onChange={(e) => setManualTeacherId(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium"
                      >
                        {teachers.map(t => {
                          const hasOtherClass = slots.some(
                            s => s.teacher_id === t.id &&
                                 s.day_of_week === manualContext.dayOfWeek &&
                                 s.period_number === manualContext.periodNumber &&
                                 s.class_id !== selectedClassId
                          );
                          return (
                            <option key={t.id} value={t.id}>
                              {t.name_th} ({t.position_th}) {hasOtherClass ? '*** [ติดสอนห้องอื่นในคาบนี้] ***' : ''}
                            </option>
                          );
                        })}
                      </select>

                      {/* Competency & Clash Status Badges */}
                      <div className="flex items-center gap-2 pt-1">
                        {modalCompetencyMatch ? (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold flex items-center gap-1">
                            <Check className="w-3 h-3" /> ตรงตามกลุ่มสาระการเรียนรู้
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-[10px] font-semibold">
                            การสอนข้ามกลุ่มสาระ
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Collision Alert Banner */}
                    {modalTeacherConflict && (
                      <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl flex items-start gap-2.5 text-rose-800 dark:text-rose-300 text-xs">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="font-bold">ตรวจพบข้อขัดแย้ง (ชั่วโมงชน):</strong> คุณครู {modalSelectedTeacherObj?.name_th} มีคาบสอนอยู่ที่ห้อง {modalTeacherConflict.class?.name || 'อื่น'} ในวัน{getDayName(manualContext.dayOfWeek)} คาบที่ {manualContext.periodNumber}
                        </div>
                      </div>
                    )}

                    {/* Room Name */}
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700 dark:text-slate-300">
                        ห้องเรียน / สถานที่สอน:
                      </label>
                      <input
                        type="text"
                        value={manualRoomName}
                        onChange={(e) => setManualRoomName(e.target.value)}
                        placeholder="เช่น ห้อง ป.1/1, ห้องคอมพิวเตอร์ 1, โรงยิม"
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {/* SWAP TAB */}
                    <div className="space-y-3">
                      <p className="text-slate-600 dark:text-slate-400">
                        สลับคาบเรียนนี้กับคาบอื่นในห้อง {selectedClass?.name} (หากคาบปลายทางเป็นคาบว่าง ระบบจะทำการย้ายคาบให้โดยอัตโนมัติ)
                      </p>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="font-bold text-slate-700 dark:text-slate-300">วันปลายทาง:</label>
                          <select
                            value={swapTargetDay}
                            onChange={(e) => setSwapTargetDay(Number(e.target.value))}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs"
                          >
                            {days.map(d => (
                              <option key={d.num} value={d.num}>วัน{d.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-slate-700 dark:text-slate-300">คาบปลายทาง:</label>
                          <select
                            value={swapTargetPeriod}
                            onChange={(e) => setSwapTargetPeriod(Number(e.target.value))}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs"
                          >
                            {[1, 2, 3, 4, 5, 6].map(p => (
                              <option key={p} value={p}>คาบที่ {p}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Destination Preview */}
                      <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div className="text-[11px] text-slate-500 font-semibold mb-1">
                          ข้อมูลคาบปลายทางปัจจุบัน:
                        </div>
                        {modalSwapTargetSlot ? (
                          <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                            <span>{modalSwapTargetSlot.course?.name_th} ({modalSwapTargetSlot.course?.course_code})</span>
                            <span className="text-sky-600 text-xs">{modalSwapTargetSlot.teacher?.name_th}</span>
                          </div>
                        ) : (
                          <div className="font-semibold text-slate-400">
                            (คาบว่าง — จะเป็นการย้ายวิชานี้ไปยังคาบดังกล่าว)
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50/50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  {manualTab === 'edit' && manualContext.slot && (
                    <button
                      onClick={handleClearManualSlot}
                      disabled={isSavingManual}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl text-xs font-semibold transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      ลบวิชา (ทำให้เป็นคาบว่าง)
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsManualModalOpen(false)}
                    className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 text-xs font-semibold rounded-xl"
                  >
                    ยกเลิก
                  </button>
                  {manualTab === 'edit' ? (
                    <button
                      onClick={handleSaveManualSlot}
                      disabled={isSavingManual || !!modalTeacherConflict}
                      className="px-5 py-2.5 bg-[#7B1C3E] hover:bg-[#631430] text-white rounded-2xl text-xs font-bold shadow-md shadow-[#7B1C3E]/20 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      บันทึกคาบเรียน
                    </button>
                  ) : (
                    <button
                      onClick={handleExecuteSwapFromModal}
                      disabled={isSavingManual}
                      className="px-5 py-2.5 bg-[#7B1C3E] hover:bg-[#631430] text-white rounded-2xl text-xs font-bold shadow-md shadow-[#7B1C3E]/20 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      <ArrowLeftRight className="w-4 h-4" />
                      ยืนยันสลับคาบเรียน
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SCHEDULE & BREAK SETTINGS MODAL */}
        {isScheduleModalOpen && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#7B1C3E]/10 text-[#7B1C3E] border border-[#7B1C3E]/20 rounded-2xl">
                    <Sliders className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      กำหนดช่วงเวลาเรียน & เวลาพัก (Timetable Period & Break Settings)
                    </h2>
                    <p className="text-xs text-slate-500">
                      กำหนดเวลาเริ่ม-สิ้นสุดของแต่ละคาบเรียน และช่วงเวลาพักดื่มนม พักกลางวัน หรือนอนกลางวัน
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Preset Selector */}
              <div className="p-4 bg-slate-100/70 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">กลุ่มระดับชั้น:</span>
                  <div className="flex bg-white dark:bg-slate-900 rounded-xl p-1 border border-slate-200 dark:border-slate-700 shadow-xs">
                    <button
                      onClick={() => {
                        setSchedulePreset('primary');
                        setEditingSlots(JSON.parse(JSON.stringify(primarySlots)));
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        schedulePreset === 'primary'
                          ? 'bg-[#7B1C3E] text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      ประถมศึกษา (ป.1 - ป.6)
                    </button>
                    <button
                      onClick={() => {
                        setSchedulePreset('kindergarten');
                        setEditingSlots(JSON.parse(JSON.stringify(kindergartenSlots)));
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        schedulePreset === 'kindergarten'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      ปฐมวัย (อ.1 - อ.3)
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleResetScheduleSlots(schedulePreset)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-medium transition shadow-xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    คืนค่ามาตรฐาน ({schedulePreset === 'kindergarten' ? 'ปฐมวัย' : 'ประถม'})
                  </button>
                </div>
              </div>

              {/* Routine Context Banner */}
              <div className="px-6 py-3 bg-sky-50/50 dark:bg-sky-950/20 border-b border-sky-100 dark:border-sky-900/30 flex flex-wrap items-center justify-between text-xs text-slate-600 dark:text-slate-400 gap-2">
                <div className="flex items-center gap-1.5">
                  {renderRoutineIcon(activeRoutine.morningAssembly.icon)}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{activeRoutine.morningAssembly.label}:</span>
                  <span className="font-mono font-bold text-sky-700 dark:text-sky-400">{activeRoutine.morningAssembly.timeRange}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {renderRoutineIcon(activeRoutine.dismissal.icon)}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{activeRoutine.dismissal.label}:</span>
                  <span className="font-mono font-bold text-sky-700 dark:text-sky-400">{activeRoutine.dismissal.timeRange}</span>
                </div>
              </div>

              {/* Slots List Table */}
              <div className="p-6 overflow-y-auto flex-1 space-y-3">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-bold uppercase">
                      <th className="p-3 w-16 text-center">ลำดับ</th>
                      <th className="p-3">ประเภท</th>
                      <th className="p-3">ชื่อรายการ / กิจกรรม</th>
                      <th className="p-3 w-28 text-center">เวลาเริ่ม</th>
                      <th className="p-3 w-28 text-center">เวลาสิ้นสุด</th>
                      <th className="p-3 w-24 text-center">ระยะเวลา</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {editingSlots.map((slot, index) => {
                      const isBreak = slot.type === 'break';
                      return (
                        <tr
                          key={slot.key}
                          className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition ${
                            isBreak ? 'bg-amber-50/20 dark:bg-amber-950/10 font-medium' : ''
                          }`}
                        >
                          <td className="p-3 text-center font-mono text-slate-400">
                            {index + 1}
                          </td>
                          <td className="p-3">
                            {isBreak ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                                {renderBreakIcon(slot.icon, slot.breakType, 'w-3.5 h-3.5')}
                                เวลาพัก
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300">
                                <Clock className="w-3.5 h-3.5" />
                                คาบเรียนที่ {slot.periodNumber}
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={slot.label}
                              onChange={(e) => handleSlotChange(index, 'label', e.target.value)}
                              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="p-3 text-center">
                            <input
                              type="time"
                              value={slot.startTime}
                              onChange={(e) => handleSlotChange(index, 'startTime', e.target.value)}
                              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-center text-slate-900 dark:text-white w-24"
                            />
                          </td>
                          <td className="p-3 text-center">
                            <input
                              type="time"
                              value={slot.endTime}
                              onChange={(e) => handleSlotChange(index, 'endTime', e.target.value)}
                              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-center text-slate-900 dark:text-white w-24"
                            />
                          </td>
                          <td className="p-3 text-center">
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                              {slot.durationMinutes}
                            </span>
                            <span className="text-[10px] text-slate-400 ml-1">นาที</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50/50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  * การปรับเปลี่ยนช่วงเวลาจะมีผลกับมุมมองตารางเรียนและตารางสอนทันที
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsScheduleModalOpen(false)}
                    className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 text-xs font-semibold rounded-xl"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={handleSaveScheduleSlots}
                    className="px-5 py-2.5 bg-[#7B1C3E] hover:bg-[#631430] text-white rounded-2xl text-xs font-bold shadow-md shadow-[#7B1C3E]/20 transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    บันทึกและนำไปใช้ในตาราง
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TEACHER COMPETENCY ADJUSTMENT MODAL */}
        {isCompetencyModalOpen && editingCompetency && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[88vh]">
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#7B1C3E]/10 text-[#7B1C3E] border border-[#7B1C3E]/20 rounded-2xl">
                    <Settings2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      ปรับแต่งคุณสมบัติครูผู้สอน (Manual Competency Adjust)
                    </h2>
                    <p className="text-xs text-slate-500">
                      คุณครู{editingCompetency.name_th} ({editingCompetency.position_th || 'ครูผู้สอน'})
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsCompetencyModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                
                {/* Active Status Switch */}
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      สถานะความพร้อมในการจัดตารางสอน
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {editingCompetency.is_active ? 'พร้อมรับคาบสอนในระบบจัดตารางสอนและจับคู่ครูสอนแทน' : 'พักการจัดตารางสอนชั่วคราว (ระบบจะไม่จัดคาบสอนให้)'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingCompetency({ ...editingCompetency, is_active: !editingCompetency.is_active })}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      editingCompetency.is_active
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {editingCompetency.is_active ? 'พร้อมสอน (Active)' : 'พักการสอน (Inactive)'}
                  </button>
                </div>

                {/* Section 1: Subject Groups */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-sky-600" />
                        กลุ่มสาระการเรียนรู้ที่สอนได้ ({editingCompetency.eligible_subject_groups.length}/8 สาระ)
                      </h4>
                      <p className="text-[11px] text-slate-500">เลือกกลุ่มสาระที่ครูมีวุฒิหรือความเชี่ยวชาญในการสอน</p>
                    </div>

                    <div className="flex items-center gap-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setEditingCompetency({ ...editingCompetency, eligible_subject_groups: [...ALL_SUBJECT_GROUPS] })}
                        className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950/60 dark:text-sky-300 font-semibold transition cursor-pointer"
                      >
                        เลือกทั้งหมด
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCompetency({ ...editingCompetency, eligible_subject_groups: [] })}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 font-semibold transition cursor-pointer"
                      >
                        ล้างทั้งหมด
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {ALL_SUBJECT_GROUPS.map((group) => {
                      const isSelected = editingCompetency.eligible_subject_groups.includes(group);
                      return (
                        <button
                          key={group}
                          type="button"
                          onClick={() => handleToggleSubjectGroup(group)}
                          className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition flex items-center justify-between gap-2 cursor-pointer ${
                            isSelected
                              ? 'bg-sky-50 border-sky-300 text-sky-900 dark:bg-sky-950/40 dark:border-sky-800 dark:text-sky-200 shadow-2xs'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800/40 dark:border-slate-700 dark:text-slate-400'
                          }`}
                        >
                          <span>{group}</span>
                          {isSelected ? (
                            <Check className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                          ) : (
                            <div className="w-3.5 h-3.5 rounded border border-slate-300 dark:border-slate-600 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Section 2: Grade Levels */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-indigo-600" />
                        ระดับชั้นที่สามารถสอนได้ ({editingCompetency.eligible_grade_levels.length}/9 ชั้น)
                      </h4>
                      <p className="text-[11px] text-slate-500">กำหนดช่วงชั้นที่ครูได้รับมอบหมายให้เข้าสอน</p>
                    </div>

                    <div className="flex items-center gap-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setEditingCompetency({ ...editingCompetency, eligible_grade_levels: ALL_GRADE_LEVELS.map(g => g.id) })}
                        className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 font-semibold transition cursor-pointer"
                      >
                        ทุกระดับ
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCompetency({ ...editingCompetency, eligible_grade_levels: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'] })}
                        className="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold transition cursor-pointer"
                      >
                        เฉพาะประถม
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCompetency({ ...editingCompetency, eligible_grade_levels: ['K1', 'K2', 'K3'] })}
                        className="px-2 py-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 font-semibold transition cursor-pointer"
                      >
                        เฉพาะปฐมวัย
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCompetency({ ...editingCompetency, eligible_grade_levels: [] })}
                        className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 font-semibold transition cursor-pointer"
                      >
                        ล้าง
                      </button>
                    </div>
                  </div>

                  {/* Kindergarten Toggles */}
                  <div>
                    <div className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1.5">
                      ระดับปฐมวัย (Early Childhood)
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {ALL_GRADE_LEVELS.filter(g => g.section === 'kindergarten').map(gl => {
                        const isSelected = editingCompetency.eligible_grade_levels.includes(gl.id);
                        return (
                          <button
                            key={gl.id}
                            type="button"
                            onClick={() => handleToggleGradeLevel(gl.id)}
                            className={`p-2 rounded-xl border text-xs font-semibold text-center transition flex items-center justify-center gap-1.5 cursor-pointer ${
                              isSelected
                                ? 'bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200 font-bold shadow-2xs'
                                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-800/40 dark:border-slate-700 dark:text-slate-400'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 text-amber-600" />}
                            <span>{gl.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Primary Toggles */}
                  <div>
                    <div className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider mb-1.5">
                      ระดับประถมศึกษา (Primary Education)
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {ALL_GRADE_LEVELS.filter(g => g.section === 'primary').map(gl => {
                        const isSelected = editingCompetency.eligible_grade_levels.includes(gl.id);
                        return (
                          <button
                            key={gl.id}
                            type="button"
                            onClick={() => handleToggleGradeLevel(gl.id)}
                            className={`p-2 rounded-xl border text-xs font-semibold text-center transition flex items-center justify-center gap-1 cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-50 border-indigo-300 text-indigo-900 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-200 font-bold shadow-2xs'
                                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-800/40 dark:border-slate-700 dark:text-slate-400'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 text-indigo-600" />}
                            <span>{gl.id}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Section 3: Teaching Hours Ceiling */}
                <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" />
                      เพดานและเป้าหมายชั่วโมงสอนต่อสัปดาห์ (Weekly Teaching Hours Load)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      ระบบจัดตารางสอนและจับคู่สอนแทนจะไม่มอบหมายคาบสอนเกินกว่าเพดานที่กำหนดนี้
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        เพดานสอนสูงสุด (Max Weekly Periods):
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max="40"
                          value={editingCompetency.max_weekly_hours}
                          onChange={(e) => setEditingCompetency({ ...editingCompetency, max_weekly_hours: parseInt(e.target.value) || 22 })}
                          className="w-24 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-center"
                        />
                        <span className="text-xs text-slate-500 font-medium">คาบ / สัปดาห์</span>
                      </div>
                      {/* Presets */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {[18, 20, 22, 24, 26].map(hours => (
                          <button
                            key={hours}
                            type="button"
                            onClick={() => setEditingCompetency({ ...editingCompetency, max_weekly_hours: hours })}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition cursor-pointer ${
                              editingCompetency.max_weekly_hours === hours
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {hours} คาบ
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        ชั่วโมงสอนเป้าหมาย (Target Weekly Periods):
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max="40"
                          value={editingCompetency.target_weekly_hours}
                          onChange={(e) => setEditingCompetency({ ...editingCompetency, target_weekly_hours: parseInt(e.target.value) || 18 })}
                          className="w-24 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-center"
                        />
                        <span className="text-xs text-slate-500 font-medium">คาบ / สัปดาห์</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-2">
                        เกณฑ์มาตรฐานโรงเรียนเอกชน: 18 - 22 คาบ/สัปดาห์
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 4: Visual Blockout Matrix (Teacher Unavailable Slots) */}
                <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <CalendarOff className="w-3.5 h-3.5 text-rose-600" />
                        ช่วงเวลาติดภารกิจห้ามจัดคาบ (Blockout Hours Matrix)
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        คลิกที่ช่องคาบเพื่อระบุช่วงเวลาที่คุณครูติดเวรหรือติดภารกิจประจำ (ระบบ AI จะไม่จัดคาบสอนลงในช่องเหล่านี้)
                      </p>
                    </div>

                    <div className="flex items-center gap-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setEditingCompetency({ ...editingCompetency, unavailable_slots: [] })}
                        className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 font-semibold transition cursor-pointer"
                      >
                        ล้างทุกช่อง (ว่างทั้งหมด)
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto pt-1">
                    <table className="w-full text-xs text-center border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold">
                          <th className="py-2 px-2 text-left w-20">วัน</th>
                          {[1, 2, 3, 4, 5, 6].map(p => (
                            <th key={p} className="py-2 px-2 w-16">
                              คาบ {p}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/60 dark:divide-slate-700/60">
                        {[
                          { day: 1, name: 'จันทร์', color: 'text-amber-600' },
                          { day: 2, name: 'อังคาร', color: 'text-pink-600' },
                          { day: 3, name: 'พุธ', color: 'text-emerald-600' },
                          { day: 4, name: 'พฤหัสฯ', color: 'text-orange-600' },
                          { day: 5, name: 'ศุกร์', color: 'text-blue-600' }
                        ].map(({ day, name, color }) => (
                          <tr key={day}>
                            <td className={`py-2 px-2 text-left font-bold ${color}`}>{name}</td>
                            {[1, 2, 3, 4, 5, 6].map(period => {
                              const key = `${day}-${period}`;
                              const isBlocked = (editingCompetency.unavailable_slots || []).includes(key);
                              return (
                                <td key={period} className="py-1 px-1">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleUnavailableSlot(day, period)}
                                    className={`w-full py-1.5 px-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 border ${
                                      isBlocked
                                        ? 'bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/30'
                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                                    }`}
                                    title={isBlocked ? 'ติดภารกิจ (คลิกเพื่อปลดล็อก)' : 'ว่าง (คลิกเพื่อล็อกเป็นติดภารกิจ)'}
                                  >
                                    {isBlocked ? (
                                      <>
                                        <Lock className="w-3 h-3 text-rose-600" />
                                        <span className="text-[9px]">ติดภารกิจ</span>
                                      </>
                                    ) : (
                                      <>
                                        <span className="text-[10px] text-slate-300">-</span>
                                        <span className="text-[9px] text-slate-400 font-normal">ว่าง</span>
                                      </>
                                    )}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div className="p-4 px-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsCompetencyModalOpen(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleSaveCompetency}
                  disabled={isSavingCompetency}
                  className="px-5 py-2.5 bg-[#7B1C3E] hover:bg-[#631430] text-white rounded-2xl text-xs font-bold shadow-md shadow-[#7B1C3E]/20 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  {isSavingCompetency ? 'กำลังบันทึก...' : 'บันทึกคุณสมบัติครู'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 5: MANUAL ADJUST SUBSTITUTION */}
        {isEditSubModalOpen && editingSub && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl my-6">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Pencil className="w-5 h-5 text-[#7B1C3E]" /> ปรับปรุงรายการสอนแทน (Manual Adjust)
                  </h3>
                  <p className="text-xs text-slate-500">
                    ปรับเปลี่ยนครูผู้สอนแทน ใบงาน หรือสถานะด้วยตนเอง โดยไม่ต้องรันระบบจับคู่อัตโนมัติใหม่
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditSubModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Context Summary */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    วันที่ {editingSub.date} • คาบที่ {editingSub.period_number}
                  </span>
                  <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    ห้อง {editingSub.class?.name || '-'}
                  </span>
                </div>
                <div className="text-slate-600 dark:text-slate-400">
                  วิชา: <strong className="text-slate-900 dark:text-white">{editingSub.course?.name_th || '-'}</strong> | ครูประจำวิชา: <strong className="text-rose-600">{editingSub.original_teacher?.name_th || '-'}</strong>
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    เลือกครูผู้ปฏิบัติการสอนแทน *
                  </label>
                  <select
                    value={subEditTeacherId}
                    onChange={(e) => setSubEditTeacherId(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl font-medium text-slate-900 dark:text-white"
                  >
                    <option value="">-- ยังไม่ระบุครูสอนแทน --</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name_th} {t.position_th ? `(${t.position_th})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    ใบงาน / กิจกรรมที่มอบหมายให้นักเรียนปฏิบัติ *
                  </label>
                  <textarea
                    rows={3}
                    value={subEditWorksheet}
                    onChange={(e) => setSubEditWorksheet(e.target.value)}
                    placeholder="ระบุชื่อใบงาน ลิงก์เอกสาร หรือหัวข้อแบบฝึกหัดในคาบ..."
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      เหตุผลการลา / ความจำเป็น
                    </label>
                    <input
                      type="text"
                      value={subEditReason}
                      onChange={(e) => setSubEditReason(e.target.value)}
                      placeholder="เช่น ลาป่วย, ไปราชการ อบรม สพป."
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      สถานะการสอนแทน
                    </label>
                    <select
                      value={subEditStatus}
                      onChange={(e) => setSubEditStatus(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl font-medium text-slate-900 dark:text-white"
                    >
                      <option value="PROPOSED">PROPOSED (รออนุมัติ)</option>
                      <option value="APPROVED">APPROVED (อนุมัติแล้ว)</option>
                      <option value="COMPLETED">COMPLETED (สอนแทนเรียบร้อย)</option>
                      <option value="REJECTED">REJECTED (ยกเลิกรายการ)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between pt-4 border-t">
                <button
                  type="button"
                  onClick={() => handleDeleteSub(editingSub.id)}
                  className="px-4 py-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" /> ยกเลิกรายการสอนแทนนี้
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditSubModalOpen(false)}
                    className="px-4 py-2 border rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    ปิด
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEditSub}
                    disabled={isSavingSub}
                    className="px-5 py-2 bg-[#7B1C3E] hover:bg-[#631430] text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    {isSavingSub ? 'กำลังบันทึก...' : 'บันทึกการปรับปรุง'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 6: OFFICIAL HANDOVER SLIP PRINT (ใบมอบหมายงานสอนแทน) */}
        {isPrintSubModalOpen && printingSub && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full p-6 space-y-6 shadow-2xl my-6 max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Printer className="w-5 h-5 text-[#7B1C3E]" /> ใบมอบหมายหน้าที่ปฏิบัติการสอนแทน
                  </h3>
                  <p className="text-xs text-slate-500">
                    แบบฟอร์มคำสั่งสอนแทนทางราชการ โรงเรียนสมคิดวิทยา
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPrintSubModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Printable Official Document Layout */}
              <div className="flex-1 overflow-y-auto p-6 bg-slate-100 dark:bg-slate-950 rounded-2xl flex justify-center border">
                <div className="w-full max-w-2xl bg-white text-slate-900 p-8 rounded-xl shadow-lg border border-slate-300 font-sans text-xs space-y-5">
                  {/* Official Header */}
                  <div className="text-center space-y-1 border-b pb-4">
                    <div className="font-bold text-base text-slate-900 tracking-wide">บันทึกข้อความ</div>
                    <div className="font-bold text-sm text-[#7B1C3E]">โรงเรียนสมคิดวิทยา</div>
                    <div className="text-slate-600 text-[11px] pt-1">ฝ่ายบริหารงานวิชาการ • กลุ่มบริหารงานบุคคล</div>
                  </div>

                  {/* Memorandum Metadata */}
                  <div className="grid grid-cols-2 gap-2 text-slate-700 border-b pb-3">
                    <div><strong>ส่วนราชการ:</strong> ฝ่ายบริหารงานวิชาการ</div>
                    <div><strong>วันที่:</strong> {printingSub.date}</div>
                    <div className="col-span-2"><strong>เรื่อง:</strong> มอบหมายหน้าที่ปฏิบัติการสอนแทน (คาบที่ {printingSub.period_number})</div>
                  </div>

                  {/* Body Content */}
                  <div className="space-y-3 leading-relaxed text-slate-800">
                    <p>
                      <strong>เรียน:</strong> คุณครู{printingSub.substitute_teacher?.name_th || '...................................................'} (ครูผู้รับมอบหมายสอนแทน)
                    </p>
                    <p className="indent-6">
                      ด้วย คุณครู<strong>{printingSub.original_teacher?.name_th || '...................................................'}</strong> ตำแหน่งครูประจำวิชา มีความจำเป็นต้อง{printingSub.reason || 'ลากิจ / ลาป่วย'} ในวันที่ {printingSub.date} ส่งผลให้ไม่สามารถปฏิบัติหน้าที่การสอนตามตารางเรียนปกติได้
                    </p>
                    <p className="indent-6">
                      ในการนี้ ฝ่ายบริหารงานวิชาการจึงขอมอบหมายให้ท่านปฏิบัติหน้าที่สอนแทน เพื่อให้การจัดการเรียนการสอนดำเนินไปอย่างต่อเนื่อง โดยมีรายละเอียดดังนี้:
                    </p>

                    {/* Duty Table */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 my-2">
                      <div className="grid grid-cols-3 gap-2">
                        <div><strong>คาบที่:</strong> {printingSub.period_number}</div>
                        <div><strong>ห้องเรียน:</strong> {printingSub.class?.name || '-'}</div>
                        <div><strong>ระดับชั้น:</strong> {printingSub.class?.grade_level || 'ป.3'}</div>
                      </div>
                      <div>
                        <strong>รายวิชา:</strong> {printingSub.course?.name_th || '-'} {printingSub.course?.course_code ? `(${printingSub.course.course_code})` : ''}
                      </div>
                      <div>
                        <strong>กิจกรรม / ใบงานที่มอบหมาย:</strong>
                        <div className="mt-1 p-2 bg-white rounded-lg border text-slate-900 font-medium">
                          {printingSub.worksheet_info || 'ให้นักเรียนศึกษาและทำแบบฝึกหัดตามแผนการจัดการเรียนรู้ประจำสัปดาห์'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Signatures */}
                  <div className="grid grid-cols-3 gap-4 pt-8 text-center text-[11px] text-slate-700">
                    <div className="space-y-8">
                      <div>(ลงชื่อ)................................................</div>
                      <div>({printingSub.original_teacher?.name_th || '...........................................'})<br /><span className="text-[10px] text-slate-500">ครูผู้มอบหมาย</span></div>
                    </div>
                    <div className="space-y-8">
                      <div>(ลงชื่อ)................................................</div>
                      <div>({printingSub.substitute_teacher?.name_th || '...........................................'})<br /><span className="text-[10px] text-slate-500">ครูผู้รับมอบหมายสอนแทน</span></div>
                    </div>
                    <div className="space-y-8">
                      <div>(ลงชื่อ)................................................</div>
                      <div>(...................................................)<br /><span className="text-[10px] text-slate-500">หัวหน้าฝ่ายบริหารงานวิชาการ</span></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsPrintSubModalOpen(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold cursor-pointer"
                >
                  ปิด
                </button>
                <button
                  type="button"
                  onClick={() => {
                    window.print();
                    toast.success('ส่งคำสั่งพิมพ์ใบมอบหมายงานสอนแทนเรียบร้อยแล้ว');
                  }}
                  className="px-5 py-2 bg-[#7B1C3E] hover:bg-[#631430] text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> สั่งพิมพ์ใบมอบงาน (Print Slip)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
