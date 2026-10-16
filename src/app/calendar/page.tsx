'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Search, 
  Filter, 
  Globe, 
  Bell, 
  Clock, 
  ShieldCheck, 
  MapPin, 
  Users, 
  ExternalLink, 
  Edit3, 
  Trash2, 
  Sparkles, 
  Check, 
  Send,
  Loader2,
  CalendarDays,
  List,
  AlertCircle,
  Eye,
  CheckCircle2,
  X,
  ArrowLeftRight,
  ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { CalendarCategory, CalendarEvent } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const CATEGORY_CONFIG: Record<CalendarCategory, { label: string; color: string; bg: string; border: string }> = {
  academic: { label: 'วิชาการ', color: 'text-indigo-700 dark:text-indigo-300', bg: 'bg-indigo-500/15', border: 'border-indigo-500/30' },
  duty: { label: 'เวรปฏิบัติหน้าที่', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-500/30' },
  meeting: { label: 'ประชุม / อบรม', color: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-500/15', border: 'border-purple-500/30' },
  activity: { label: 'กิจกรรมโรงเรียน', color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-500/15', border: 'border-blue-500/30' },
  holiday: { label: 'วันหยุด', color: 'text-rose-700 dark:text-rose-300', bg: 'bg-rose-500/15', border: 'border-rose-500/30' },
  administrative: { label: 'ธุรการ / KPI', color: 'text-teal-700 dark:text-teal-300', bg: 'bg-teal-500/15', border: 'border-teal-500/30' },
  other: { label: 'ทั่วไป', color: 'text-slate-700 dark:text-slate-300', bg: 'bg-slate-500/15', border: 'border-slate-500/30' },
};

const DUTY_TYPE_LABELS: Record<string, string> = {
  morning_gate: 'เวรประตูเช้า (07:00-08:00)',
  evening_gate: 'เวรประตูเย็น (16:00-17:00)',
  canteen: 'เวรดูแลโรงอาหารกลางวัน',
  holiday_watch: 'เวรดูแลความปลอดภัยวันหยุด',
  academic_duty: 'เวรวิชาการ / วัดผล',
  other: 'เวรปฏิบัติการอื่น ๆ'
};

export default function OperationalCalendarPage() {
  const { user, appUser, role } = useAuth();
  const isAdminOrStaff = role === 'admin' || role === 'academic staff' || role === 'executive';

  // Date State
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1); // 1-12
  const [viewMode, setViewMode] = useState<'month' | 'agenda' | 'duty'>('month');

  // Data State
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [personnelList, setPersonnelList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showWebOnly, setShowWebOnly] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  // Duty Swap State (Peer-to-Peer Duty Swap)
  const [isDutySwapModalOpen, setIsDutySwapModalOpen] = useState(false);
  const [selectedDutyForSwap, setSelectedDutyForSwap] = useState<CalendarEvent | null>(null);
  const [swapCurrentTeacherId, setSwapCurrentTeacherId] = useState<string>('');
  const [swapTargetTeacherId, setSwapTargetTeacherId] = useState<string>('');
  const [isSwappingDuty, setIsSwappingDuty] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title_th: '',
    title_en: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    is_holiday: false,
    category: 'academic' as CalendarCategory,
    description: '',
    location: '',
    target_role: 'all',
    assigned_personnel_ids: [] as string[],
    is_duty: false,
    duty_type: 'morning_gate',
    publish_to_web: true,
    action_url: '',
    notify_immediately: false
  });

  // Load Events
  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        month: currentMonth.toString(),
        year: currentYear.toString()
      });
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (viewMode === 'duty') params.append('is_duty', 'true');
      if (showWebOnly) params.append('published_only', 'true');

      const res = await fetch(`/api/calendar?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setEvents(data.events || []);
      }
    } catch (e) {
      toast.error('ไม่สามารถโหลดข้อมูลปฏิทินได้');
    } finally {
      setIsLoading(false);
    }
  };

  // Load Personnel for Duty assignment
  const fetchPersonnel = async () => {
    try {
      const res = await fetch('/api/academic/teacher-competencies');
      const data = await res.json();
      if (data.success) {
        setPersonnelList(data.teachers || []);
      }
    } catch (e) {
      console.error('Failed to load personnel:', e);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [currentMonth, currentYear, selectedCategory, viewMode, showWebOnly]);

  useEffect(() => {
    fetchPersonnel();
  }, []);

  // Month Navigation
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleCurrentMonth = () => {
    setCurrentMonth(today.getMonth() + 1);
    setCurrentYear(today.getFullYear());
  };

  // Days in current month grid calculation
  const calendarGrid = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth - 1, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth - 1, 0).getDate();

    const days: Array<{
      dateString: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }> = [];

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevM = currentMonth === 1 ? 12 : currentMonth - 1;
      const prevY = currentMonth === 1 ? currentYear - 1 : currentYear;
      const dateString = `${prevY}-${String(prevM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dateString,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dateString === today.toISOString().split('T')[0]
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const dateString = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        dateString,
        dayNumber: i,
        isCurrentMonth: true,
        isToday: dateString === today.toISOString().split('T')[0]
      });
    }

    // Next month padding to complete 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const nextM = currentMonth === 12 ? 1 : currentMonth + 1;
      const nextY = currentMonth === 12 ? currentYear + 1 : currentYear;
      const dateString = `${nextY}-${String(nextM).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        dateString,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: dateString === today.toISOString().split('T')[0]
      });
    }

    return days;
  }, [currentYear, currentMonth]);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      const matchSearch = (e.title_th || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.location || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchSearch;
    });
  }, [events, searchQuery]);

  // Open Modal for Add
  const handleOpenAdd = (defaultDate?: string) => {
    setEditingEvent(null);
    setFormData({
      title_th: '',
      title_en: '',
      start_date: defaultDate || new Date().toISOString().split('T')[0],
      end_date: defaultDate || '',
      is_holiday: false,
      category: 'academic',
      description: '',
      location: '',
      target_role: 'all',
      assigned_personnel_ids: [],
      is_duty: false,
      duty_type: 'morning_gate',
      publish_to_web: true,
      action_url: '',
      notify_immediately: false
    });
    setIsModalOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEdit = (event: CalendarEvent) => {
    setEditingEvent(event);
    setFormData({
      title_th: event.title_th,
      title_en: event.title_en || '',
      start_date: event.start_date,
      end_date: event.end_date || '',
      is_holiday: Boolean(event.is_holiday),
      category: event.category,
      description: event.description || '',
      location: event.location || '',
      target_role: event.target_role || 'all',
      assigned_personnel_ids: event.assigned_personnel_ids || [],
      is_duty: Boolean(event.is_duty),
      duty_type: event.duty_type || 'morning_gate',
      publish_to_web: event.publish_to_web !== false,
      action_url: event.action_url || '',
      notify_immediately: false
    });
    setIsModalOpen(true);
  };

  // Handle Save Event
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title_th.trim() || !formData.start_date) {
      toast.warning('กรุณากรอกหัวข้อกิจกรรมและวันที่เริ่มต้น');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading('กำลังบันทึกปฏิทินปฏิบัติงาน...');

    try {
      const payload = {
        ...formData,
        end_date: formData.end_date || formData.start_date
      };

      if (editingEvent) {
        const res = await fetch(`/api/calendar/${editingEvent.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        toast.success('อัปเดตกิจกรรมในปฏิทินสำเร็จ', { id: toastId });
      } else {
        const res = await fetch('/api/calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        toast.success(
          payload.publish_to_web 
            ? 'บันทึกสำเร็จ พร้อมซิงก์ขึ้นปฏิทินหน้าเว็บโรงเรียนแล้วค่ะ' 
            : 'บันทึกปฏิทินปฏิบัติงานภายในเรียบร้อยแล้วค่ะ',
          { id: toastId }
        );
      }

      setIsModalOpen(false);
      fetchEvents();
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาดในการบันทึก', { id: toastId, description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete
  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบกิจกรรม "${title}" ออกจากปฏิทิน?`)) return;

    const toastId = toast.loading('กำลังลบกิจกรรม...');
    try {
      const res = await fetch(`/api/calendar/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('ลบกิจกรรมเรียบร้อยแล้ว', { id: toastId });
      fetchEvents();
    } catch (err: any) {
      toast.error('ไม่สามารถลบกิจกรรมได้', { id: toastId, description: err.message });
    }
  };

  // Handle Instant Notification Trigger
  const handleInstantNotify = async (eventId: string, title: string) => {
    const toastId = toast.loading(`กำลังส่งการแจ้งเตือนสำหรับ: ${title}...`);
    try {
      const res = await fetch('/api/calendar/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'instant_notify', eventId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message, { id: toastId });
      fetchEvents();
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาดในการส่งแจ้งเตือน', { id: toastId, description: err.message });
    }
  };

  // NongFah AI Scanner for upcoming events
  const handleNongFahScan = async () => {
    const toastId = toast.loading('น้องฟ้า AI กำลังตรวจสอบกำหนดการและเวรประจำวัน 48 ชม. ข้างหน้า...');
    try {
      const res = await fetch('/api/calendar/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scan_reminders' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message, { id: toastId });
      fetchEvents();
    } catch (err: any) {
      toast.error('ไม่สามารถสแกนกำหนดการได้', { id: toastId, description: err.message });
    }
  };

  // Open Duty Swap Modal
  const handleOpenDutySwap = (duty: CalendarEvent) => {
    setSelectedDutyForSwap(duty);
    setSwapCurrentTeacherId(duty.assigned_personnel_ids?.[0] || '');
    setSwapTargetTeacherId('');
    setIsDutySwapModalOpen(true);
  };

  // Execute Duty Swap (Peer-to-Peer Duty Swap)
  const handleExecuteDutySwap = async () => {
    if (!selectedDutyForSwap || !swapTargetTeacherId) {
      toast.warning('กรุณาเลือกคุณครูผู้ที่จะมาปฏิบัติหน้าที่แทน');
      return;
    }

    setIsSwappingDuty(true);
    const toastId = toast.loading('กำลังบันทึกการสลับเวรปฏิบัติหน้าที่...');

    try {
      const currentIds = selectedDutyForSwap.assigned_personnel_ids || [];
      let updatedIds = [...currentIds];
      if (swapCurrentTeacherId && updatedIds.includes(swapCurrentTeacherId)) {
        updatedIds = updatedIds.map(id => id === swapCurrentTeacherId ? swapTargetTeacherId : id);
      } else {
        updatedIds = [swapTargetTeacherId];
      }

      // Remove duplicates
      updatedIds = Array.from(new Set(updatedIds));

      const res = await fetch(`/api/calendar/${selectedDutyForSwap.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assigned_personnel_ids: updatedIds,
          notify_update: true
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const targetTeacher = personnelList.find(p => p.id === swapTargetTeacherId);
      toast.success(`สลับเวรปฏิบัติหน้าที่ให้คุณครู ${targetTeacher?.name_th || ''} เรียบร้อยแล้ว พร้อมส่งแจ้งเตือนเข้าสู่ระบบทันที`, { id: toastId });
      setIsDutySwapModalOpen(false);
      fetchEvents();
    } catch (err: any) {
      toast.error('ไม่สามารถสลับเวรได้', { id: toastId, description: err.message });
    } finally {
      setIsSwappingDuty(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Top Header Banner (Forms Studio Brand Parity) */}
        <div className="bg-surface/90 backdrop-blur-xl p-6 sm:p-7 rounded-3xl border border-foreground/10 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#7B1C3E]/10 text-[#7B1C3E] flex items-center justify-center flex-shrink-0 shadow-sm border border-[#7B1C3E]/20">
              <CalendarDays className="w-7 h-7" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#7B1C3E]/10 text-[#7B1C3E] text-xs font-bold mb-1.5 border border-[#7B1C3E]/20">
                <Sparkles className="w-3.5 h-3.5" /> ระบบปฏิทินปฏิบัติงานโรงเรียน (School Operational Calendar)
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                ปฏิทินปฏิบัติงาน & เวรประจำวัน
              </h1>
              <p className="text-xs sm:text-sm text-foreground/60 font-medium mt-0.5">
                เชื่อมโยงกำหนดการวิชาการ เวรปฏิบัติหน้าที่ บันทึกกิจกรรม และซิงก์ขึ้นเว็บไซต์โรงเรียนอัตโนมัติ
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/academic"
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-foreground/15 text-foreground/80 font-bold text-xs hover:bg-foreground/5 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>ศูนย์วิชาการ</span>
            </Link>

            <button
              onClick={handleNongFahScan}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#7B1C3E]/10 hover:bg-[#7B1C3E]/20 text-[#7B1C3E] text-xs font-bold transition-all active:scale-95 shadow-sm border border-[#7B1C3E]/20"
              title="ให้น้องฟ้าสแกนและส่งแจ้งเตือนกำหนดการใกล้ถึง"
            >
              <Sparkles className="w-4 h-4" />
              <span>น้องฟ้าสแกนส่งเตือน</span>
            </button>

            {isAdminOrStaff && (
              <button
                onClick={() => handleOpenAdd()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#7B1C3E] text-white text-xs font-bold hover:bg-[#631430] shadow-md shadow-[#7B1C3E]/20 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>เพิ่มกำหนดการ / จัดเวร</span>
              </button>
            )}
          </div>
        </div>

        {/* 4-Column Quick Metrics Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-surface/80 backdrop-blur-xl p-4 sm:p-5 rounded-2xl border border-foreground/10 shadow-sm flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#7B1C3E]/10 text-[#7B1C3E] flex items-center justify-center flex-shrink-0 border border-[#7B1C3E]/20">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-foreground/50 uppercase tracking-wider">กิจกรรมเดือนนี้</p>
              <p className="text-xl sm:text-2xl font-black text-foreground mt-0.5">
                {events.length} <span className="text-xs font-medium text-foreground/50 font-normal">รายการ</span>
              </p>
            </div>
          </div>

          <div className="bg-surface/80 backdrop-blur-xl p-4 sm:p-5 rounded-2xl border border-foreground/10 shadow-sm flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 flex items-center justify-center flex-shrink-0 border border-amber-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-foreground/50 uppercase tracking-wider">เวรปฏิบัติหน้าที่</p>
              <p className="text-xl sm:text-2xl font-black text-foreground mt-0.5">
                {events.filter(e => e.is_duty).length} <span className="text-xs font-medium text-foreground/50 font-normal">เวร</span>
              </p>
            </div>
          </div>

          <div className="bg-surface/80 backdrop-blur-xl p-4 sm:p-5 rounded-2xl border border-foreground/10 shadow-sm flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center flex-shrink-0 border border-rose-500/20">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-foreground/50 uppercase tracking-wider">วันหยุดโรงเรียน</p>
              <p className="text-xl sm:text-2xl font-black text-foreground mt-0.5">
                {events.filter(e => e.is_holiday).length} <span className="text-xs font-medium text-foreground/50 font-normal">วัน</span>
              </p>
            </div>
          </div>

          <div className="bg-surface/80 backdrop-blur-xl p-4 sm:p-5 rounded-2xl border border-foreground/10 shadow-sm flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center flex-shrink-0 border border-sky-500/20">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-foreground/50 uppercase tracking-wider">ซิงก์เว็บไซต์ รร.</p>
              <p className="text-xl sm:text-2xl font-black text-foreground mt-0.5">
                {events.filter(e => e.publish_to_web).length} <span className="text-xs font-medium text-foreground/50 font-normal">รายการ</span>
              </p>
            </div>
          </div>
        </div>

        {/* View Switcher, Month Navigation & Filter Bar */}
        <div className="bg-surface/80 backdrop-blur-xl p-4 sm:p-5 rounded-3xl border border-foreground/10 shadow-sm space-y-4">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
            
            {/* Month & Year Navigation */}
            <div className="flex items-center gap-2 w-full lg:w-auto justify-between lg:justify-start">
              <div className="flex items-center gap-1 bg-foreground/5 p-1 rounded-2xl">
                <button
                  onClick={handlePrevMonth}
                  className="p-2 rounded-xl hover:bg-surface text-foreground/70 hover:text-foreground transition-all"
                  title="เดือนก่อนหน้า"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="px-4 py-1 text-center min-w-[170px]">
                  <h2 className="text-base sm:text-lg font-black text-foreground">
                    {THAI_MONTHS[currentMonth - 1]} {currentYear + 543}
                  </h2>
                </div>
                <button
                  onClick={handleNextMonth}
                  className="p-2 rounded-xl hover:bg-surface text-foreground/70 hover:text-foreground transition-all"
                  title="เดือนถัดไป"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <button
                onClick={handleCurrentMonth}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-foreground/5 hover:bg-foreground/10 text-foreground transition-all"
              >
                เดือนปัจจุบัน
              </button>
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 bg-foreground/5 p-1 rounded-2xl w-full lg:w-auto justify-center">
              <button
                onClick={() => setViewMode('month')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  viewMode === 'month' 
                    ? 'bg-surface text-primary shadow-sm' 
                    : 'text-foreground/60 hover:text-foreground'
                }`}
              >
                <CalendarIcon className="w-4 h-4" />
                <span>มุมมองเดือน</span>
              </button>

              <button
                onClick={() => setViewMode('agenda')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  viewMode === 'agenda' 
                    ? 'bg-surface text-primary shadow-sm' 
                    : 'text-foreground/60 hover:text-foreground'
                }`}
              >
                <List className="w-4 h-4" />
                <span>รายการกำหนดการ</span>
              </button>

              <button
                onClick={() => setViewMode('duty')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  viewMode === 'duty' 
                    ? 'bg-surface text-amber-700 dark:text-amber-300 shadow-sm' 
                    : 'text-foreground/60 hover:text-foreground'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>ตารางเวรครู</span>
              </button>
            </div>
          </div>

          {/* Categories & Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-foreground/5">
            {/* Category Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategory === 'all'
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-foreground/5 text-foreground/60 hover:bg-foreground/10'
                }`}
              >
                ทั้งหมด
              </button>
              {(Object.keys(CATEGORY_CONFIG) as CalendarCategory[]).map(cat => {
                const cfg = CATEGORY_CONFIG[cat];
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                      selectedCategory === cat
                        ? `${cfg.bg} ${cfg.color} ${cfg.border} shadow-sm ring-1 ring-primary/20`
                        : 'bg-foreground/5 border-transparent text-foreground/60 hover:bg-foreground/10'
                    }`}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={() => setShowWebOnly(!showWebOnly)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                  showWebOnly 
                    ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30' 
                    : 'bg-foreground/5 border-transparent text-foreground/60 hover:bg-foreground/10'
                }`}
                title="แสดงเฉพาะกิจกรรมที่เผยแพร่ลงเว็บไซต์โรงเรียน"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>เฉพาะบนเว็บ</span>
              </button>

              <div className="relative w-full sm:w-48">
                <Search className="w-3.5 h-3.5 text-foreground/40 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="ค้นหากิจกรรม..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-foreground/5 border border-foreground/10 text-xs focus:outline-none focus:border-primary text-foreground placeholder:text-foreground/40"
                />
              </div>
            </div>
          </div>
        </div>

        {/* View Mode 1: Month Grid View */}
        {viewMode === 'month' && (
          <div className="bg-surface/80 backdrop-blur-xl rounded-3xl border border-foreground/10 shadow-sm overflow-hidden">
            {/* Day Header (Sun - Sat) */}
            <div className="grid grid-cols-7 border-b border-foreground/10 bg-foreground/[0.02] text-center text-xs font-bold text-foreground/60 py-3">
              <span className="text-rose-600">อา. (Sun)</span>
              <span>จ. (Mon)</span>
              <span>อ. (Tue)</span>
              <span>พ. (Wed)</span>
              <span>พฤ. (Thu)</span>
              <span>ศ. (Fri)</span>
              <span className="text-indigo-600">ส. (Sat)</span>
            </div>

            {/* Calendar Cells */}
            <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-foreground/5">
              {calendarGrid.map((cell, idx) => {
                const dayEvents = filteredEvents.filter(e => {
                  const s = e.start_date;
                  const end = e.end_date || e.start_date;
                  return cell.dateString >= s && cell.dateString <= end;
                });

                return (
                  <div
                    key={idx}
                    onClick={() => isAdminOrStaff && handleOpenAdd(cell.dateString)}
                    className={`min-h-[110px] sm:min-h-[130px] p-2 flex flex-col justify-between transition-colors relative group ${
                      !cell.isCurrentMonth ? 'bg-foreground/[0.01] opacity-40' : 'hover:bg-foreground/[0.02]'
                    } ${cell.isToday ? 'bg-primary/5' : ''}`}
                  >
                    {/* Day number & today marker */}
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-black rounded-lg px-1.5 py-0.5 ${
                        cell.isToday 
                          ? 'bg-primary text-white shadow-sm' 
                          : cell.isCurrentMonth ? 'text-foreground/80' : 'text-foreground/40'
                      }`}>
                        {cell.dayNumber}
                      </span>

                      {isAdminOrStaff && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenAdd(cell.dateString);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all text-[10px]"
                          title="เพิ่มกิจกรรมวันนี้นี้"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Events list in cell */}
                    <div className="space-y-1 my-1 overflow-y-auto max-h-[85px] scrollbar-none">
                      {dayEvents.map(event => {
                        const cat = CATEGORY_CONFIG[event.category] || CATEGORY_CONFIG.other;
                        return (
                          <div
                            key={event.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEdit(event);
                            }}
                            className={`p-1.5 rounded-lg border text-[11px] font-bold cursor-pointer transition-all hover:scale-[1.02] shadow-2xs ${cat.bg} ${cat.color} ${cat.border}`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="truncate leading-tight flex-1 inline-flex items-center gap-1">
                                {event.is_duty && <ShieldCheck className="w-3 h-3 text-amber-500 inline shrink-0" />}
                                {event.is_holiday && <CalendarIcon className="w-3 h-3 text-emerald-500 inline shrink-0" />}
                                <span className="truncate">{event.title_th}</span>
                              </span>
                              {event.publish_to_web && (
                                <span title="เผยแพร่บนเว็บโรงเรียน">
                                  <Globe className="w-2.5 h-2.5 text-sky-600 flex-shrink-0" />
                                </span>
                              )}
                            </div>
                            {event.location && (
                              <p className="text-[9px] opacity-75 truncate flex items-center gap-0.5 mt-0.5 font-normal">
                                <MapPin className="w-2.5 h-2.5" /> {event.location}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="text-[10px] text-foreground/30 text-right">
                      {dayEvents.length > 2 && `${dayEvents.length} รายการ`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* View Mode 2: Agenda View */}
        {viewMode === 'agenda' && (
          <div className="bg-surface/80 backdrop-blur-xl rounded-3xl border border-foreground/10 shadow-sm p-6 space-y-4">
            <h3 className="font-extrabold text-base text-foreground flex items-center gap-2">
              <List className="w-5 h-5 text-primary" /> รายการกำหนดการและกิจกรรม ({filteredEvents.length} รายการ)
            </h3>

            {filteredEvents.length === 0 ? (
              <div className="py-12 text-center text-foreground/40 text-sm">
                <CalendarDays className="w-10 h-10 mx-auto mb-2 opacity-30" />
                ไม่พบรายการกิจกรรมในเดือนที่เลือก
              </div>
            ) : (
              <div className="divide-y divide-foreground/5">
                {filteredEvents.map(event => {
                  const cat = CATEGORY_CONFIG[event.category] || CATEGORY_CONFIG.other;
                  return (
                    <div key={event.id} className="py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-foreground/[0.02] px-2 rounded-2xl transition-colors">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${cat.bg} ${cat.color} ${cat.border}`}>
                            {cat.label}
                          </span>
                          {event.is_duty && (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 inline-flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                              {DUTY_TYPE_LABELS[event.duty_type || ''] || 'เวรปฏิบัติหน้าที่'}
                            </span>
                          )}
                          {event.publish_to_web && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/10 text-sky-600 border border-sky-500/20 flex items-center gap-1">
                              <Globe className="w-3 h-3" /> หน้าเว็บ รร.
                            </span>
                          )}
                        </div>

                        <h4 className="text-sm font-bold text-foreground">
                          {event.title_th}
                          {event.title_en && <span className="text-foreground/50 font-normal ml-2">({event.title_en})</span>}
                        </h4>

                        {event.description && (
                          <p className="text-xs text-foreground/70 leading-relaxed max-w-3xl">
                            {event.description}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-4 text-xs text-foreground/50 pt-1">
                          <span className="flex items-center gap-1 font-semibold text-foreground/70">
                            <Clock className="w-3.5 h-3.5 text-primary" />
                            วันที่: {event.start_date} {event.end_date && event.end_date !== event.start_date ? `ถึง ${event.end_date}` : ''}
                          </span>
                          {event.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5" />
                              สถานที่: {event.location}
                            </span>
                          )}
                          {event.assigned_personnel && event.assigned_personnel.length > 0 && (
                            <span className="flex items-center gap-1 text-primary font-medium">
                              <Users className="w-3.5 h-3.5" />
                              ผู้รับผิดชอบ: {event.assigned_personnel.map(p => p.name_th).join(', ')}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 self-end md:self-center flex-shrink-0">
                        <button
                          onClick={() => handleInstantNotify(event.id, event.title_th)}
                          className="px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-all flex items-center gap-1"
                          title="ส่งการแจ้งเตือนและ Web Push ทันที"
                        >
                          <Bell className="w-3.5 h-3.5" />
                          <span>ส่งเตือน</span>
                        </button>

                        {event.action_url && (
                          <Link
                            href={event.action_url}
                            className="p-2 rounded-xl bg-foreground/5 hover:bg-foreground/10 text-foreground/70 transition-all"
                            title="เปิดหน้าที่เกี่ยวข้อง"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        )}

                        {isAdminOrStaff && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(event)}
                              className="p-2 rounded-xl bg-foreground/5 hover:bg-foreground/10 text-foreground/70 transition-all"
                              title="แก้ไขกิจกรรม"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(event.id, event.title_th)}
                              className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 transition-all"
                              title="ลบกิจกรรม"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* View Mode 3: Teacher Duty Roster */}
        {viewMode === 'duty' && (
          <div className="bg-surface/80 backdrop-blur-xl rounded-3xl border border-foreground/10 shadow-sm p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base text-amber-800 dark:text-amber-400 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5" /> ตารางเวรปฏิบัติหน้าที่ครูและบุคลากร
                </h3>
                <p className="text-xs text-foreground/60 mt-0.5">
                  เวรประตูโรงเรียน เวรโรงอาหาร และเวรความปลอดภัย พร้อมระบบแจ้งเตือนเข้ามือถือในเช้าวันปฏิบัติงาน
                </p>
              </div>

              {isAdminOrStaff && (
                <button
                  onClick={() => {
                    handleOpenAdd();
                    setFormData(prev => ({ ...prev, is_duty: true, category: 'duty' }));
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-500 text-white font-bold text-xs hover:bg-amber-600 shadow-md shadow-amber-500/20 transition-all"
                >
                  <Plus className="w-4 h-4 inline mr-1" /> จัดเวรครูเพิ่ม
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEvents.filter(e => e.is_duty).map(duty => (
                <div key={duty.id} className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] font-bold">
                      {DUTY_TYPE_LABELS[duty.duty_type || ''] || 'เวรปฏิบัติหน้าที่'}
                    </span>
                    <span className="text-xs font-bold text-foreground/70">
                      {duty.start_date}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-foreground">{duty.title_th}</h4>
                    {duty.location && (
                      <p className="text-xs text-foreground/60 flex items-center gap-1 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-amber-600" /> {duty.location}
                      </p>
                    )}
                  </div>

                  {/* Assigned Teachers */}
                  <div className="pt-2 border-t border-amber-500/10">
                    <div className="text-[11px] font-bold text-foreground/50 mb-1 flex items-center gap-1">
                      <Users className="w-3 h-3" /> คุณครูผู้รับผิดชอบ:
                    </div>
                    {duty.assigned_personnel && duty.assigned_personnel.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {duty.assigned_personnel.map(p => (
                          <span key={p.id} className="px-2 py-1 rounded-md bg-surface text-foreground font-semibold text-xs border border-foreground/10">
                            {p.name_th}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-rose-500 font-medium">ยังไม่ได้ระบุคุณครู</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleInstantNotify(duty.id, duty.title_th)}
                        className="text-xs text-amber-700 dark:text-amber-300 font-bold hover:underline flex items-center gap-1"
                      >
                        <Bell className="w-3.5 h-3.5" /> ส่งเตือน
                      </button>

                      <button
                        onClick={() => handleOpenDutySwap(duty)}
                        className="text-xs text-[#7B1C3E] hover:text-[#631430] font-bold flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#7B1C3E]/10 hover:bg-[#7B1C3E]/20 transition-all border border-[#7B1C3E]/20"
                        title="สลับเวรปฏิบัติหน้าที่ให้ครูท่านอื่นแทน"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                        <span>สลับเวร</span>
                      </button>
                    </div>

                    {isAdminOrStaff && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(duty)}
                          className="p-1.5 rounded-lg hover:bg-surface text-foreground/60 transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(duty.id, duty.title_th)}
                          className="p-1.5 rounded-lg hover:bg-surface text-rose-600 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Modal: Add / Edit Event & Duty */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface rounded-3xl border border-foreground/10 shadow-2xl w-full max-w-xl overflow-hidden my-8"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-foreground/10 flex items-center justify-between bg-primary/5">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-primary" />
                  <h3 className="font-extrabold text-base text-foreground">
                    {editingEvent ? 'แก้ไขกิจกรรม / เวรปฏิบัติงาน' : 'เพิ่มกิจกรรมในปฏิทินปฏิบัติงาน'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-foreground/5 text-foreground/50 hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                <div>
                  <label className="block text-xs font-bold text-foreground/70 mb-1">
                    หัวข้อกิจกรรม / ชื่องาน (ภาษาไทย) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title_th}
                    onChange={(e) => setFormData({ ...formData, title_th: e.target.value })}
                    placeholder="เช่น กำหนดส่งเล่ม ปพ.5 ภาคเรียนที่ 1, เวรประตูหน้าโรงเรียน"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-foreground/15 bg-background text-sm font-medium focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground/70 mb-1">
                    หัวข้อภาษาอังกฤษ (ถ้ามี)
                  </label>
                  <input
                    type="text"
                    value={formData.title_en}
                    onChange={(e) => setFormData({ ...formData, title_en: e.target.value })}
                    placeholder="e.g. Gradebook Submission Deadline"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-foreground/15 bg-background text-sm font-medium focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-foreground/70 mb-1">วันที่เริ่มต้น *</label>
                    <input
                      type="date"
                      required
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-foreground/15 bg-background text-sm font-medium focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground/70 mb-1">วันที่สิ้นสุด (ถ้าเป็นช่วงวัน)</label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-foreground/15 bg-background text-sm font-medium focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-foreground/70 mb-1">หมวดหมู่กิจกรรม</label>
                    <select
                      value={formData.category}
                      onChange={(e: any) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-foreground/15 bg-background text-sm font-medium focus:outline-none focus:border-primary"
                    >
                      <option value="academic">วิชาการ (Academic)</option>
                      <option value="duty">เวรปฏิบัติหน้าที่ (Duty)</option>
                      <option value="meeting">ประชุม / อบรม (Meeting)</option>
                      <option value="activity">กิจกรรมโรงเรียน (Activity)</option>
                      <option value="holiday">วันหยุด (Holiday)</option>
                      <option value="administrative">ธุรการ / KPI (Admin)</option>
                      <option value="other">ทั่วไป (Other)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground/70 mb-1">กลุ่มเป้าหมาย</label>
                    <select
                      value={formData.target_role}
                      onChange={(e) => setFormData({ ...formData, target_role: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-foreground/15 bg-background text-sm font-medium focus:outline-none focus:border-primary"
                    >
                      <option value="all">ทุกคน (All)</option>
                      <option value="teacher">คุณครูทุกคน (Teachers)</option>
                      <option value="academic staff">ฝ่ายวิชาการ (Academic Staff)</option>
                      <option value="executive">ผู้บริหาร (Executives)</option>
                      <option value="parent">ผู้ปกครอง (Parents)</option>
                    </select>
                  </div>
                </div>

                {/* Duty Toggle and Selector */}
                <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.is_duty}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          is_duty: e.target.checked,
                          category: e.target.checked ? 'duty' : formData.category
                        })}
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span>เป็นเวรปฏิบัติหน้าที่ของครู (Duty Roster)</span>
                    </label>
                  </div>

                  {formData.is_duty && (
                    <div className="space-y-3 pt-2">
                      <div>
                        <label className="block text-xs font-semibold text-foreground/70 mb-1">ประเภทเวร</label>
                        <select
                          value={formData.duty_type}
                          onChange={(e) => setFormData({ ...formData, duty_type: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-foreground/15 bg-background text-xs font-medium"
                        >
                          {Object.entries(DUTY_TYPE_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-foreground/70 mb-1">
                          คุณครูผู้ปฏิบัติหน้าที่ (เลือกได้หลายท่าน)
                        </label>
                        <select
                          multiple
                          value={formData.assigned_personnel_ids}
                          onChange={(e) => {
                            const selected = Array.from(e.target.selectedOptions, opt => opt.value);
                            setFormData({ ...formData, assigned_personnel_ids: selected });
                          }}
                          className="w-full px-3 py-2 rounded-xl border border-foreground/15 bg-background text-xs font-medium h-28"
                        >
                          {personnelList.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name_th} ({p.role || 'ครู'})
                            </option>
                          ))}
                        </select>
                        <p className="text-[10px] text-foreground/50 mt-1">กด Ctrl / Cmd เพื่อเลือกคุณครูหลายท่าน</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-foreground/70 mb-1">สถานที่ (Location)</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="เช่น ห้องประชุมมรกต, ประตู 1"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-foreground/15 bg-background text-sm font-medium focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground/70 mb-1">ลิงก์ระบบงาน (Action URL)</label>
                    <input
                      type="text"
                      value={formData.action_url}
                      onChange={(e) => setFormData({ ...formData, action_url: e.target.value })}
                      placeholder="เช่น /academic/gradebook"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-foreground/15 bg-background text-sm font-medium focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground/70 mb-1">รายละเอียด / คำชี้แจง</label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="กรอกรายละเอียด หรือวาระการประชุม..."
                    className="w-full px-3.5 py-2 rounded-xl border border-foreground/15 bg-background text-sm font-medium focus:outline-none focus:border-primary"
                  />
                </div>

                {/* Toggles */}
                <div className="space-y-2 pt-1 border-t border-foreground/5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-foreground/80">
                    <input
                      type="checkbox"
                      checked={formData.publish_to_web}
                      onChange={(e) => setFormData({ ...formData, publish_to_web: e.target.checked })}
                      className="rounded text-primary focus:ring-primary"
                    />
                    <Globe className="w-4 h-4 text-sky-600" />
                    <span>เผยแพร่ลงปฏิทินหน้าเว็บไซต์โรงเรียน (Public Website Calendar)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-foreground/80">
                    <input
                      type="checkbox"
                      checked={formData.is_holiday}
                      onChange={(e) => setFormData({ ...formData, is_holiday: e.target.checked })}
                      className="rounded text-rose-600 focus:ring-rose-500"
                    />
                    <span>เป็นวันหยุดโรงเรียน / วันหยุดราชการ</span>
                  </label>

                  {!editingEvent && (
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-primary">
                      <input
                        type="checkbox"
                        checked={formData.notify_immediately}
                        onChange={(e) => setFormData({ ...formData, notify_immediately: e.target.checked })}
                        className="rounded text-primary focus:ring-primary"
                      />
                      <Bell className="w-4 h-4 text-primary" />
                      <span>ส่งการแจ้งเตือนและ Web Push ทันทีหลังบันทึก</span>
                    </label>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="pt-4 border-t border-foreground/10 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-foreground/5 hover:bg-foreground/10 text-foreground font-bold text-xs"
                  >
                    ยกเลิก
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-xl bg-primary text-white font-bold text-xs hover:bg-primary/90 shadow-md shadow-primary/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>{editingEvent ? 'บันทึกการแก้ไข' : 'บันทึกลงปฏิทิน'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Duty Swap (Peer-to-Peer Duty Swap) */}
      <AnimatePresence>
        {isDutySwapModalOpen && selectedDutyForSwap && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface rounded-3xl border border-foreground/10 shadow-2xl w-full max-w-lg overflow-hidden my-8"
            >
              {/* Header */}
              <div className="p-6 border-b border-foreground/10 flex items-center justify-between bg-[#7B1C3E]/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#7B1C3E]/10 text-[#7B1C3E] flex items-center justify-center border border-[#7B1C3E]/20">
                    <ArrowLeftRight className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-foreground">สลับเวรปฏิบัติหน้าที่ (Swap Duty)</h3>
                    <p className="text-xs text-foreground/60 font-medium">เปลี่ยนตัวคุณครูผู้ปฏิบัติหน้าที่เวรประจำวัน</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDutySwapModalOpen(false)}
                  className="p-2 rounded-xl text-foreground/50 hover:text-foreground hover:bg-foreground/5"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-800 dark:text-amber-300">
                    <span>{DUTY_TYPE_LABELS[selectedDutyForSwap.duty_type || ''] || 'เวรปฏิบัติหน้าที่'}</span>
                    <span>วันที่: {selectedDutyForSwap.start_date}</span>
                  </div>
                  <h4 className="font-extrabold text-sm text-foreground">{selectedDutyForSwap.title_th}</h4>
                  {selectedDutyForSwap.location && (
                    <p className="text-xs text-foreground/60 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-amber-600" /> สถานที่: {selectedDutyForSwap.location}
                    </p>
                  )}
                </div>

                {/* Current Assigned Teacher */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground/70">คุณครูผู้ปฏิบัติงานปัจจุบัน</label>
                  <select
                    value={swapCurrentTeacherId}
                    onChange={(e) => setSwapCurrentTeacherId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-foreground/15 bg-surface text-foreground font-medium text-xs focus:ring-2 focus:ring-[#7B1C3E]/30 focus:outline-none"
                  >
                    {selectedDutyForSwap.assigned_personnel && selectedDutyForSwap.assigned_personnel.length > 0 ? (
                      selectedDutyForSwap.assigned_personnel.map(p => (
                        <option key={p.id} value={p.id}>{p.name_th} ({p.role || 'ครูผู้สอน'})</option>
                      ))
                    ) : (
                      <option value="">-- ยังไม่ได้ระบุครู --</option>
                    )}
                  </select>
                </div>

                {/* Arrow Icon Indicator */}
                <div className="flex justify-center py-1">
                  <div className="w-8 h-8 rounded-full bg-[#7B1C3E]/10 text-[#7B1C3E] flex items-center justify-center">
                    <ArrowLeftRight className="w-4 h-4" />
                  </div>
                </div>

                {/* Target Replacement Teacher */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground/70">เลือกคุณครูผู้ที่จะมาปฏิบัติหน้าที่แทน *</label>
                  <select
                    value={swapTargetTeacherId}
                    onChange={(e) => setSwapTargetTeacherId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-foreground/15 bg-surface text-foreground font-medium text-xs focus:ring-2 focus:ring-[#7B1C3E]/30 focus:outline-none"
                  >
                    <option value="">-- เลือกคุณครูผู้แทน --</option>
                    {personnelList
                      .filter(p => p.id !== swapCurrentTeacherId)
                      .map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name_th} {p.department ? `(${p.department})` : ''}
                        </option>
                      ))}
                  </select>
                  <p className="text-[11px] text-foreground/50">
                    ระบบจะส่งการแจ้งเตือนและ Web Push ให้คุณครูผู้รับมอบหมายเวรใหม่อัตโนมัติทันที
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 pt-4 border-t border-foreground/10 flex items-center justify-end gap-3 bg-foreground/[0.02]">
                <button
                  type="button"
                  onClick={() => setIsDutySwapModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-foreground/5 hover:bg-foreground/10 text-foreground font-bold text-xs"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleExecuteDutySwap}
                  disabled={isSwappingDuty || !swapTargetTeacherId}
                  className="px-5 py-2 rounded-xl bg-[#7B1C3E] hover:bg-[#631430] text-white font-bold text-xs shadow-md shadow-[#7B1C3E]/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSwappingDuty ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>ยืนยันการสลับเวร</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
