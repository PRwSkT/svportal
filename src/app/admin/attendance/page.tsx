'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  Printer, 
  Search, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  AlertCircle, 
  CheckCircle2,
  Edit2,
  Trash2,
  Plus,
  X,
  Save,
  Users,
  UserCheck,
  ShieldAlert,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

type AttendanceRecord = {
  id: string;
  user_id: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  app_users: {
    full_name: string;
  } | null;
};

type AppUserItem = {
  id: string;
  full_name: string;
};

// เวลาเข้างานที่กำหนด (HH:MM)
const LATE_CUTOFF_TIME = "07:30"; 
// เวลาออกงานที่กำหนด (HH:MM) - ออกก่อนเวลานี้จะถือว่า "ออกก่อนเวลา"
const EARLY_LEAVE_TIME = "17:00";

export default function AdminAttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [allUsers, setAllUsers] = useState<AppUserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editInTime, setEditInTime] = useState<string>('');
  const [editOutTime, setEditOutTime] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);
  const [manualUserId, setManualUserId] = useState<string>('');
  const [manualDate, setManualDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [manualInTime, setManualInTime] = useState<string>('07:15');
  const [manualOutTime, setManualOutTime] = useState<string>('17:00');
  const [isSavingManual, setIsSavingManual] = useState<boolean>(false);

  const fetchRecords = async (date: Date) => {
    setIsLoading(true);
    setSelectedDateFilter('all');
    const supabase = createClient();
    
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;

    try {
      // Parallel fetch attendance records and all app users
      const [attRes, usersRes] = await Promise.all([
        supabase
          .from('attendance_records')
          .select('*')
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: false })
          .order('check_in_time', { ascending: true }),
        supabase
          .from('app_users')
          .select('id, full_name')
          .order('full_name', { ascending: true })
      ]);

      if (usersRes.data) {
        setAllUsers(usersRes.data as AppUserItem[]);
      }

      if (attRes.error) {
        toast.error('ไม่สามารถโหลดข้อมูลได้', { description: attRes.error.message });
        return;
      }

      const data = attRes.data || [];
      const userMap = new Map((usersRes.data || []).map((u: any) => [u.id, u]));

      const mergedData = data.map((record: any) => ({
        ...record,
        app_users: userMap.get(record.user_id) || { full_name: 'ไม่ทราบชื่อ' }
      }));
      setRecords(mergedData as unknown as AttendanceRecord[]);
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords(currentDate);
  }, [currentDate]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const checkIsLate = (timeString: string | null) => {
    if (!timeString) return false;
    const dateObj = new Date(timeString);
    const hours = dateObj.getHours();
    const minutes = dateObj.getMinutes();
    const [cutoffHours, cutoffMinutes] = LATE_CUTOFF_TIME.split(':').map(Number);
    if (hours > cutoffHours) return true;
    if (hours === cutoffHours && minutes > cutoffMinutes) return true;
    return false;
  };

  const checkIsEarlyLeave = (timeString: string | null) => {
    if (!timeString) return false;
    const dateObj = new Date(timeString);
    const hours = dateObj.getHours();
    const minutes = dateObj.getMinutes();
    const [cutoffHours, cutoffMinutes] = EARLY_LEAVE_TIME.split(':').map(Number);
    if (hours < cutoffHours) return true;
    if (hours === cutoffHours && minutes < cutoffMinutes) return true;
    return false;
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return '-';
    return new Date(timeString).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('th-TH', { 
      year: 'numeric', month: 'short', day: 'numeric' 
    });
  };

  const monthName = currentDate.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });

  // Filter records by search query
  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;
    const q = searchQuery.toLowerCase().trim();
    return records.filter(r => (r.app_users?.full_name || '').toLowerCase().includes(q));
  }, [records, searchQuery]);

  // Group records by date
  const groupedRecords = filteredRecords.reduce((acc, record) => {
    if (!acc[record.date]) {
      acc[record.date] = [];
    }
    acc[record.date].push(record);
    return acc;
  }, {} as Record<string, AttendanceRecord[]>);
  
  const sortedDates = Object.keys(groupedRecords).sort((a, b) => b.localeCompare(a)); // Descending dates

  // Quick stats
  const totalPunches = filteredRecords.length;
  const latePunches = filteredRecords.filter(r => checkIsLate(r.check_in_time)).length;
  const earlyPunches = filteredRecords.filter(r => checkIsEarlyLeave(r.check_out_time)).length;
  const onTimePunches = filteredRecords.filter(r => r.check_in_time && !checkIsLate(r.check_in_time)).length;

  // Open Edit Modal
  const openEditModal = (rec: AttendanceRecord) => {
    setEditingRecord(rec);
    if (rec.check_in_time) {
      const d = new Date(rec.check_in_time);
      setEditInTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    } else {
      setEditInTime('');
    }
    if (rec.check_out_time) {
      const d = new Date(rec.check_out_time);
      setEditOutTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    } else {
      setEditOutTime('');
    }
  };

  // Save Edit Punch
  const handleSaveEdit = async () => {
    if (!editingRecord) return;
    setIsSavingEdit(true);
    try {
      let finalIn: string | null = null;
      let finalOut: string | null = null;

      if (editInTime) {
        const [h, m] = editInTime.split(':').map(Number);
        const d = new Date(`${editingRecord.date}T00:00:00`);
        d.setHours(h, m, 0);
        finalIn = d.toISOString();
      }

      if (editOutTime) {
        const [h, m] = editOutTime.split(':').map(Number);
        const d = new Date(`${editingRecord.date}T00:00:00`);
        d.setHours(h, m, 0);
        finalOut = d.toISOString();
      }

      const res = await fetch('/api/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingRecord.id,
          check_in_time: finalIn,
          check_out_time: finalOut
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success('แก้ไขข้อมูลการเข้างานเรียบร้อยแล้ว');
      setEditingRecord(null);
      fetchRecords(currentDate);
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาดในการแก้ไข: ' + err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Delete Record
  const handleDeleteRecord = async (id: string) => {
    if (!window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายการลงเวลานี้?')) return;
    try {
      const res = await fetch(`/api/attendance?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('ลบรายการลงเวลาเรียบร้อยแล้ว');
      setEditingRecord(null);
      fetchRecords(currentDate);
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาดในการลบ: ' + err.message);
    }
  };

  // Save Manual Punch / Leave Entry
  const handleSaveManual = async (preset?: string) => {
    if (!manualUserId) {
      toast.warning('กรุณาเลือกบุคลากร');
      return;
    }
    if (!manualDate) {
      toast.warning('กรุณาระบุวันที่');
      return;
    }

    setIsSavingManual(true);
    try {
      let finalIn: string | null = null;
      let finalOut: string | null = null;

      if (preset === 'normal') {
        finalIn = new Date(`${manualDate}T07:15:00`).toISOString();
        finalOut = new Date(`${manualDate}T17:00:00`).toISOString();
      } else if (preset === 'late') {
        finalIn = new Date(`${manualDate}T08:00:00`).toISOString();
        finalOut = new Date(`${manualDate}T17:00:00`).toISOString();
      } else if (preset === 'leave') {
        finalIn = null;
        finalOut = null;
      } else {
        if (manualInTime) {
          const [h, m] = manualInTime.split(':').map(Number);
          const d = new Date(`${manualDate}T00:00:00`);
          d.setHours(h, m, 0);
          finalIn = d.toISOString();
        }
        if (manualOutTime) {
          const [h, m] = manualOutTime.split(':').map(Number);
          const d = new Date(`${manualDate}T00:00:00`);
          d.setHours(h, m, 0);
          finalOut = d.toISOString();
        }
      }

      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_override: true,
          target_user_id: manualUserId,
          date: manualDate,
          check_in_time: finalIn,
          check_out_time: finalOut
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(data.message || 'บันทึกเวลาเข้างานเรียบร้อยแล้ว');
      setIsManualModalOpen(false);
      fetchRecords(currentDate);
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาดในการบันทึก: ' + err.message);
    } finally {
      setIsSavingManual(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 font-sans print:p-0 print:m-0 print:max-w-none">
      
      {/* Header & Controls (Hidden when printing) */}
      <div className="print:hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-[#7B1C3E]/10 rounded-2xl flex items-center justify-center text-[#7B1C3E] border border-[#7B1C3E]/20 shadow-sm">
            <Clock className="w-7 h-7" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#7B1C3E]/10 text-[#7B1C3E] text-xs font-bold mb-1 border border-[#7B1C3E]/20">
              <Sparkles className="w-3.5 h-3.5" /> ระบบเวลาและงาน HR & ธรรมาภิบาล
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">ข้อมูลการเข้างานบุคลากร</h1>
            <p className="text-slate-500 font-medium text-xs sm:text-sm">ตรวจสอบ ปรับแก้เวลาเข้า-ออกงาน และบันทึกวันลาสำหรับครูและบุคลากร</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
            <button onClick={handlePrevMonth} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
              <ChevronLeft className="w-5 h-5 text-slate-700 dark:text-slate-300" />
            </button>
            <div className="px-3 font-bold min-w-[140px] text-center flex items-center justify-center gap-2 text-xs sm:text-sm text-slate-900 dark:text-white">
              <Calendar className="w-4 h-4 text-[#7B1C3E]" /> {monthName}
            </div>
            <button onClick={handleNextMonth} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
              <ChevronRight className="w-5 h-5 text-slate-700 dark:text-slate-300" />
            </button>
          </div>

          <button
            onClick={() => {
              if (allUsers.length > 0 && !manualUserId) setManualUserId(allUsers[0].id);
              setIsManualModalOpen(true);
            }}
            className="flex items-center gap-2 bg-[#7B1C3E] text-white px-4 py-2.5 rounded-xl font-bold hover:bg-[#641430] shadow-sm text-xs sm:text-sm transition-all"
          >
            <Plus className="w-4 h-4" /> บันทึกเวลาแทน / ลา
          </button>
          
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-xl font-bold border border-slate-200 dark:border-slate-700 text-xs sm:text-sm transition-all"
          >
            <Printer className="w-4 h-4" /> พิมพ์รายงาน
          </button>
        </div>
      </div>

      {/* 4-Card Quick Metrics Bar */}
      <div className="print:hidden grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase">ลงเวลาทั้งหมด</p>
            <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">{totalPunches} <span className="text-xs font-normal text-slate-400">รายการ</span></p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase">เข้าตรงเวลา</p>
            <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">{onTimePunches} <span className="text-xs font-normal text-slate-400">ครั้ง</span></p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center font-bold">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase">มาสาย (&gt; 07:30)</p>
            <p className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400">{latePunches} <span className="text-xs font-normal text-slate-400">ครั้ง</span></p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase">ออกก่อนเวลา (&lt; 17:00)</p>
            <p className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">{earlyPunches} <span className="text-xs font-normal text-slate-400">ครั้ง</span></p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="print:hidden flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ค้นหาชื่อครู / บุคลากร..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]/30"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-bold text-slate-500 shrink-0">กรองวันที่:</span>
          <select
            value={selectedDateFilter}
            onChange={(e) => setSelectedDateFilter(e.target.value)}
            className="w-full sm:w-auto bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-[#7B1C3E]/30 cursor-pointer"
          >
            <option value="all">แสดงทุกวันที่ในเดือนนี้</option>
            {sortedDates.map(dateStr => (
              <option key={dateStr} value={dateStr}>วันที่ {formatDate(dateStr)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Print Header (Only visible when printing) */}
      <div className="hidden print:block text-center mb-8">
        <h1 className="text-2xl font-bold">รายงานการเข้า-ออกงานบุคลากร</h1>
        <p className="text-lg mt-1 font-semibold">โรงเรียนสมคิดวิทยา • ประจำเดือน {monthName}</p>
        <p className="text-sm mt-1 text-slate-600">เวลาเข้างานมาตรฐาน: {LATE_CUTOFF_TIME} น. | เวลาเลิกงานมาตรฐาน: {EARLY_LEAVE_TIME} น.</p>
      </div>

      {/* Table Container */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden min-h-[400px] print:shadow-none print:border-none print:bg-transparent print:min-h-0">
        {isLoading ? (
          <div className="p-8 space-y-4 print:hidden">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="flex-1 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl"></div>
              </div>
            ))}
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[350px] text-slate-400 space-y-3 print:hidden">
            <Search className="w-16 h-16 opacity-30 text-[#7B1C3E]" />
            <p className="text-base font-bold text-slate-600 dark:text-slate-300">ไม่พบข้อมูลการเข้างานตามเงื่อนไขที่เลือก</p>
            <button
              onClick={() => {
                if (allUsers.length > 0 && !manualUserId) setManualUserId(allUsers[0].id);
                setIsManualModalOpen(true);
              }}
              className="text-xs font-bold text-[#7B1C3E] hover:underline"
            >
              + บันทึกเวลาเข้างานแทนให้กับบุคลากร
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 print:bg-gray-100 print:border-y-2 print:border-black">
                <tr>
                  <th className="p-3.5 font-bold text-slate-500 print:text-black text-xs uppercase tracking-wider text-center w-16">ลำดับ</th>
                  <th className="p-3.5 font-bold text-slate-500 print:text-black text-xs uppercase tracking-wider">ชื่อ-นามสกุล บุคลากร</th>
                  <th className="p-3.5 font-bold text-slate-500 print:text-black text-xs uppercase tracking-wider text-center w-32">เวลาเข้างาน</th>
                  <th className="p-3.5 font-bold text-slate-500 print:text-black text-xs uppercase tracking-wider text-center w-32">เวลาออกงาน</th>
                  <th className="p-3.5 font-bold text-slate-500 print:text-black text-xs uppercase tracking-wider text-center w-40">สถานะการลงเวลา</th>
                  <th className="p-3.5 font-bold text-slate-500 print:text-black text-xs uppercase tracking-wider text-center w-28 print:hidden">จัดการ</th>
                </tr>
              </thead>
              
              {sortedDates
                .filter(dateStr => selectedDateFilter === 'all' || dateStr === selectedDateFilter)
                .map(dateStr => (
                <tbody key={dateStr} className="print:border-b-2 print:border-black/50">
                  <tr className="bg-slate-100/70 dark:bg-slate-800/40 print:bg-gray-200 border-y border-slate-200 dark:border-slate-800">
                    <td colSpan={6} className="p-3 px-5 font-black text-[#7B1C3E] dark:text-rose-400 print:text-black text-xs sm:text-sm">
                      วันที่ {formatDate(dateStr)} ({groupedRecords[dateStr]?.length || 0} คน)
                    </td>
                  </tr>
                  
                  {groupedRecords[dateStr].map((record, index) => {
                    const isLate = checkIsLate(record.check_in_time);
                    const isEarlyLeave = checkIsEarlyLeave(record.check_out_time);
                    
                    return (
                      <tr key={record.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors print:hover:bg-transparent border-b border-slate-100 dark:border-slate-800/60 last:border-0">
                        <td className="p-3.5 text-slate-400 print:text-black text-center font-mono text-xs">
                          {index + 1}
                        </td>
                        <td className="p-3.5 font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                          {record.app_users?.full_name || 'ไม่ทราบชื่อ'}
                        </td>
                        <td className="p-3.5 text-center font-mono text-xs font-semibold">
                          {record.check_in_time ? (
                            <span className={isLate ? 'text-rose-600 font-bold' : 'text-slate-800 dark:text-slate-200'}>
                              {formatTime(record.check_in_time)}
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">-</span>
                          )}
                        </td>
                        <td className="p-3.5 text-center font-mono text-xs font-semibold">
                          {record.check_out_time ? (
                            <span className={isEarlyLeave ? 'text-amber-600 font-bold' : 'text-slate-800 dark:text-slate-200'}>
                              {formatTime(record.check_out_time)}
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">-</span>
                          )}
                        </td>
                        <td className="p-3.5">
                          <div className="flex flex-wrap gap-1.5 justify-center items-center">
                            {record.check_in_time && (
                              isLate ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 whitespace-nowrap">
                                  <AlertCircle className="w-3 h-3" /> เข้าสาย
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 whitespace-nowrap">
                                  <CheckCircle2 className="w-3 h-3" /> เข้าปกติ
                                </span>
                              )
                            )}
                            
                            {record.check_out_time && (
                              isEarlyLeave ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 whitespace-nowrap">
                                  <AlertCircle className="w-3 h-3" /> ออกก่อน
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 whitespace-nowrap">
                                  <CheckCircle2 className="w-3 h-3" /> ออกปกติ
                                </span>
                              )
                            )}

                            {!record.check_in_time && !record.check_out_time && (
                               <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                 วันลา / ราชการ
                               </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3.5 text-center print:hidden">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openEditModal(record)}
                              title="แก้ไขเวลาเข้า-ออก"
                              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-[#7B1C3E] rounded-lg transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteRecord(record.id)}
                              title="ลบรายการ"
                              className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          </div>
        )}
      </div>

      {/* Monthly Individual Summary Section */}
      {!isLoading && records.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden print:shadow-none print:border-none print:bg-transparent print:mt-8 break-inside-avoid">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 print:border-black flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white print:text-black">
              สรุปสถิติการเข้างานรายบุคคล (ประจำเดือน {monthName})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 print:bg-gray-100 print:border-y-2 print:border-black">
                 <tr>
                   <th className="p-3.5 font-bold text-slate-500 print:text-black uppercase tracking-wider">ชื่อ-นามสกุล บุคลากร</th>
                   <th className="p-3.5 font-bold text-slate-500 print:text-black uppercase tracking-wider text-center w-28">มาสาย (ครั้ง)</th>
                   <th className="p-3.5 font-bold text-slate-500 print:text-black uppercase tracking-wider text-center w-28">ออกก่อน (ครั้ง)</th>
                   <th className="p-3.5 font-bold text-slate-500 print:text-black uppercase tracking-wider text-center w-28">รวมลงเวลา (วัน)</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-black/20">
                 {Object.values(
                   records.reduce((acc, record) => {
                     const userId = record.user_id;
                     if (!acc[userId]) {
                       acc[userId] = { 
                         name: record.app_users?.full_name || 'ไม่ทราบชื่อ', 
                         late: 0, 
                         earlyLeave: 0,
                         totalDays: 0 
                       };
                     }
                     acc[userId].totalDays += 1;
                     if (checkIsLate(record.check_in_time)) acc[userId].late += 1;
                     if (checkIsEarlyLeave(record.check_out_time)) acc[userId].earlyLeave += 1;
                     return acc;
                   }, {} as Record<string, { name: string, late: number, earlyLeave: number, totalDays: number }>)
                 ).sort((a, b) => a.name.localeCompare(b.name)).map((sum, i) => (
                   <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors print:hover:bg-transparent">
                     <td className="p-3.5 font-bold text-slate-900 dark:text-white print:text-black">{sum.name}</td>
                     <td className="p-3.5 text-center font-mono font-bold text-rose-600 print:text-black">{sum.late > 0 ? sum.late : '-'}</td>
                     <td className="p-3.5 text-center font-mono font-bold text-amber-600 print:text-black">{sum.earlyLeave > 0 ? sum.earlyLeave : '-'}</td>
                     <td className="p-3.5 text-center font-mono font-semibold text-slate-700 dark:text-slate-300 print:text-black">{sum.totalDays}</td>
                   </tr>
                 ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: Edit Punch Modal */}
      <AnimatePresence>
        {editingRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-[#7B1C3E]/10 text-[#7B1C3E] rounded-xl">
                    <Edit2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 dark:text-white text-base">ปรับแก้เวลาเข้า-ออกงาน</h3>
                    <p className="text-xs text-slate-500 font-medium">
                      {editingRecord.app_users?.full_name} • {formatDate(editingRecord.date)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingRecord(null)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs sm:text-sm">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    เวลาเข้างาน (HH:MM):
                  </label>
                  <input
                    type="time"
                    value={editInTime}
                    onChange={(e) => setEditInTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]/30"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">เวลาปกติก่อน 07:30 น. (หากเว้นว่างจะลบเวลาเข้า)</span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    เวลาออกงาน (HH:MM):
                  </label>
                  <input
                    type="time"
                    value={editOutTime}
                    onChange={(e) => setEditOutTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]/30"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">เวลาปกติหลัง 17:00 น. (หากเว้นว่างจะลบเวลาออก)</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 gap-2">
                <button
                  type="button"
                  onClick={() => handleDeleteRecord(editingRecord.id)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                >
                  ลบรายการนี้
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingRecord(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    disabled={isSavingEdit}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-[#7B1C3E] hover:bg-[#641430] text-white shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {isSavingEdit ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: Manual Punch / Leave Entry Modal */}
      <AnimatePresence>
        {isManualModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-[#7B1C3E]/10 text-[#7B1C3E] rounded-xl">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 dark:text-white text-base">บันทึกเวลาเข้างานแทน / วันลา</h3>
                    <p className="text-xs text-slate-500 font-medium">สำหรับกรณีครูลืมสแกน GPS, ลาป่วย, ลากิจ, หรือไปราชการ</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsManualModalOpen(false)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs sm:text-sm">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    เลือกบุคลากร:
                  </label>
                  <select
                    value={manualUserId}
                    onChange={(e) => setManualUserId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]/30"
                  >
                    {allUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.full_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    วันที่:
                  </label>
                  <input
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]/30"
                  />
                </div>

                {/* Quick Presets */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-2">
                    ปุ่มลัดระบุสถานะด่วน (Presets):
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => { setManualInTime('07:15'); setManualOutTime('17:00'); }}
                      className="p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 font-bold text-left hover:bg-emerald-100 transition-colors"
                    >
                      ✓ มาปกติ (07:15 - 17:00)
                    </button>
                    <button
                      type="button"
                      onClick={() => { setManualInTime('08:00'); setManualOutTime('17:00'); }}
                      className="p-2.5 rounded-xl border border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 font-bold text-left hover:bg-rose-100 transition-colors"
                    >
                      ⚠ มาสาย (08:00 - 17:00)
                    </button>
                    <button
                      type="button"
                      onClick={() => { setManualInTime('07:15'); setManualOutTime('15:30'); }}
                      className="p-2.5 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 font-bold text-left hover:bg-amber-100 transition-colors"
                    >
                      ⚠ ออกก่อนเวลา (07:15 - 15:30)
                    </button>
                    <button
                      type="button"
                      onClick={() => { setManualInTime(''); setManualOutTime(''); }}
                      className="p-2.5 rounded-xl border border-blue-200 dark:border-blue-800/60 bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 font-bold text-left hover:bg-blue-100 transition-colors"
                    >
                      📋 วันลา / ไปราชการ (เว้นว่าง)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      เวลาเข้า (HH:MM):
                    </label>
                    <input
                      type="time"
                      value={manualInTime}
                      onChange={(e) => setManualInTime(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]/30"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      เวลาออก (HH:MM):
                    </label>
                    <input
                      type="time"
                      value={manualOutTime}
                      onChange={(e) => setManualOutTime(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]/30"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end pt-3 border-t border-slate-100 dark:border-slate-800 gap-2">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveManual()}
                  disabled={isSavingManual}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#7B1C3E] hover:bg-[#641430] text-white shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isSavingManual ? 'กำลังบันทึก...' : 'บันทึกข้อมูลเข้างาน'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
