'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { motion } from 'framer-motion';
import { Clock, Printer, Search, Calendar, ChevronLeft, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react';
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

// เวลาเข้างานที่กำหนด (HH:MM)
const LATE_CUTOFF_TIME = "07:30"; 
// เวลาออกงานที่กำหนด (HH:MM) - ออกก่อนเวลานี้จะถือว่า "ออกก่อนเวลา"
const EARLY_LEAVE_TIME = "17:00";

export default function AdminAttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('all');

  const fetchRecords = async (date: Date) => {
    setIsLoading(true);
    setSelectedDateFilter('all'); // Reset filter when month changes
    const supabase = createClient();
    
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    
    // First day of the month
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    // Last day of the month
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;

    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false })
      .order('check_in_time', { ascending: true });

    if (error) {
      toast.error('ไม่สามารถโหลดข้อมูลได้', { description: error.message });
      setIsLoading(false);
      return;
    }

    if (data && data.length > 0) {
      // Fetch user details
      const userIds = [...new Set(data.map((r: any) => r.user_id))];
      const { data: usersData } = await supabase
        .from('app_users')
        .select('id, full_name')
        .in('id', userIds);

      const userMap = new Map();
      if (usersData) {
        usersData.forEach((u: any) => userMap.set(u.id, u));
      }

      const mergedData = data.map((record: any) => ({
        ...record,
        app_users: userMap.get(record.user_id) || { full_name: 'ไม่ทราบชื่อ' }
      }));
      setRecords(mergedData as unknown as AttendanceRecord[]);
    } else {
      setRecords([]);
    }
    
    setIsLoading(false);
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
    
    // Parse timeString to get local HH:MM
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
    
    // Parse timeString to get local HH:MM
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

  // Group records by date
  const groupedRecords = records.reduce((acc, record) => {
    if (!acc[record.date]) {
      acc[record.date] = [];
    }
    acc[record.date].push(record);
    return acc;
  }, {} as Record<string, AttendanceRecord[]>);
  
  const sortedDates = Object.keys(groupedRecords).sort((a, b) => a.localeCompare(b)); // Ascending dates (Day 1 to end)

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 font-sans print:p-0 print:m-0 print:max-w-none">
      
      {/* Header & Controls (Hidden when printing) */}
      <div className="print:hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-surface/80 backdrop-blur-xl p-6 rounded-3xl shadow-lg border border-white/20">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
            <Clock className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-primary mb-1">ข้อมูลการเข้างาน</h1>
            <p className="text-foreground/60 font-medium">สรุปรายงานการเข้า-ออกงานรายเดือน</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center bg-foreground/5 rounded-xl p-1">
            <button onClick={handlePrevMonth} className="p-2 hover:bg-foreground/10 rounded-lg transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="px-4 font-bold min-w-[150px] text-center flex items-center justify-center gap-2">
              <Calendar className="w-4 h-4 text-primary" /> {monthName}
            </div>
            <button onClick={handleNextMonth} className="p-2 hover:bg-foreground/10 rounded-lg transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          
          <select
            value={selectedDateFilter}
            onChange={(e) => setSelectedDateFilter(e.target.value)}
            className="bg-foreground/5 rounded-xl px-4 py-3 font-bold outline-none border border-transparent focus:border-primary/30 transition-all cursor-pointer"
          >
            <option value="all">แสดงทุกวันที่</option>
            {sortedDates.map(dateStr => (
              <option key={dateStr} value={dateStr}>วันที่ {formatDate(dateStr)}</option>
            ))}
          </select>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all active:scale-95"
          >
            <Printer className="w-5 h-5" /> พิมพ์รายงาน
          </button>
        </div>
      </div>

      {/* Print Header (Only visible when printing) */}
      <div className="hidden print:block text-center mb-8">
        <h1 className="text-2xl font-bold">รายงานการเข้า-ออกงาน</h1>
        <p className="text-lg mt-2">ประจำเดือน {monthName}</p>
        <p className="text-sm mt-1">เวลาเข้างาน: {LATE_CUTOFF_TIME} น. | เวลาเลิกงาน: {EARLY_LEAVE_TIME} น.</p>
      </div>

      <div className="bg-surface/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 overflow-hidden min-h-[400px] print:shadow-none print:border-none print:bg-transparent print:min-h-0">
        {isLoading ? (
          <div className="p-8 space-y-4 print:hidden">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="flex-1 h-12 bg-foreground/5 rounded-xl"></div>
              </div>
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-foreground/40 space-y-4 print:hidden">
            <Search className="w-20 h-20 opacity-20" />
            <p className="text-xl font-medium">ไม่พบข้อมูลการเข้างานในเดือนนี้</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-foreground/[0.02] border-b border-foreground/10 print:bg-gray-100 print:border-y-2 print:border-black">
                <tr>
                  <th className="p-3 md:p-4 font-bold text-foreground/50 print:text-black text-sm uppercase tracking-wider text-center w-16">ลำดับ</th>
                  <th className="p-3 md:p-4 font-bold text-foreground/50 print:text-black text-sm uppercase tracking-wider">ชื่อ-นามสกุล</th>
                  <th className="p-3 md:p-4 font-bold text-foreground/50 print:text-black text-sm uppercase tracking-wider text-center">เวลาเข้า</th>
                  <th className="p-3 md:p-4 font-bold text-foreground/50 print:text-black text-sm uppercase tracking-wider text-center">เวลาออก</th>
                  <th className="p-3 md:p-4 font-bold text-foreground/50 print:text-black text-sm uppercase tracking-wider text-center">สถานะ</th>
                </tr>
              </thead>
              
              {sortedDates
                .filter(dateStr => selectedDateFilter === 'all' || dateStr === selectedDateFilter)
                .map(dateStr => (
                <tbody key={dateStr} className="print:border-b-2 print:border-black/50">
                  <tr className="bg-foreground/5 print:bg-gray-200 border-y border-foreground/10">
                    <td colSpan={5} className="p-3 px-5 font-extrabold text-primary print:text-black print:font-bold text-sm">
                      วันที่ {formatDate(dateStr)}
                    </td>
                  </tr>
                  
                  {groupedRecords[dateStr].map((record, index) => {
                    const isLate = checkIsLate(record.check_in_time);
                    const isEarlyLeave = checkIsEarlyLeave(record.check_out_time);
                    
                    return (
                      <tr key={record.id} className="hover:bg-foreground/[0.02] transition-colors print:hover:bg-transparent border-b border-foreground/5 last:border-0">
                        <td className="p-3 md:p-4 text-foreground/50 print:text-black text-center font-mono text-sm">
                          {index + 1}
                        </td>
                        <td className="p-3 md:p-4 font-bold text-foreground/90 print:text-black text-sm">
                          {record.app_users?.full_name || 'ไม่ทราบชื่อ'}
                        </td>
                        <td className="p-3 md:p-4 text-center font-mono text-sm">
                          {formatTime(record.check_in_time)}
                        </td>
                        <td className="p-3 md:p-4 text-center font-mono text-sm">
                          {formatTime(record.check_out_time)}
                        </td>
                        <td className="p-3 md:p-4">
                          <div className="flex flex-col gap-1 items-center">
                            {record.check_in_time && (
                              isLate ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-700 print:border print:border-red-700 print:bg-transparent whitespace-nowrap">
                                  <AlertCircle className="w-3 h-3" /> เข้าสาย
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-green-100 text-green-700 print:border print:border-green-700 print:bg-transparent whitespace-nowrap">
                                  <CheckCircle2 className="w-3 h-3" /> เข้าปกติ
                                </span>
                              )
                            )}
                            
                            {record.check_out_time && (
                              isEarlyLeave ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 print:border print:border-orange-700 print:bg-transparent whitespace-nowrap">
                                  <AlertCircle className="w-3 h-3" /> ออกก่อนเวลา
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 print:border print:border-blue-700 print:bg-transparent whitespace-nowrap">
                                  <CheckCircle2 className="w-3 h-3" /> ออกปกติ
                                </span>
                              )
                            )}

                            {!record.check_in_time && !record.check_out_time && (
                               <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-foreground/10 text-foreground/50 print:border print:border-gray-500 print:bg-transparent">
                                 -
                               </span>
                            )}
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

      {/* Summary Section */}
      {!isLoading && records.length > 0 && (
        <div className="mt-12 bg-surface/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 overflow-hidden print:shadow-none print:border-none print:bg-transparent print:mt-8 break-inside-avoid">
          <div className="p-6 border-b border-foreground/10 print:border-black flex items-center justify-between">
            <h2 className="text-xl font-bold text-primary print:text-black">สรุปการเข้างานรายบุคคล (ประจำเดือน {monthName})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-foreground/[0.02] border-b border-foreground/10 print:bg-gray-100 print:border-y-2 print:border-black">
                 <tr>
                   <th className="p-3 md:p-4 font-bold text-foreground/50 print:text-black text-sm uppercase tracking-wider">ชื่อ-นามสกุล</th>
                   <th className="p-3 md:p-4 font-bold text-foreground/50 print:text-black text-sm uppercase tracking-wider text-center">มาสาย (ครั้ง)</th>
                   <th className="p-3 md:p-4 font-bold text-foreground/50 print:text-black text-sm uppercase tracking-wider text-center">ออกก่อน (ครั้ง)</th>
                   <th className="p-3 md:p-4 font-bold text-foreground/50 print:text-black text-sm uppercase tracking-wider text-center">ขาด/ลา (วัน)</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-foreground/5 print:divide-black/20">
                 {Object.values(
                   records.reduce((acc, record) => {
                     const userId = record.user_id;
                     if (!acc[userId]) {
                       acc[userId] = { name: record.app_users?.full_name || 'ไม่ทราบชื่อ', late: 0, earlyLeave: 0 };
                     }
                     if (checkIsLate(record.check_in_time)) acc[userId].late += 1;
                     if (checkIsEarlyLeave(record.check_out_time)) acc[userId].earlyLeave += 1;
                     return acc;
                   }, {} as Record<string, { name: string, late: number, earlyLeave: number }>)
                 ).sort((a, b) => a.name.localeCompare(b.name)).map((sum, i) => (
                   <tr key={i} className="hover:bg-foreground/[0.02] transition-colors print:hover:bg-transparent border-b border-foreground/5 last:border-0">
                     <td className="p-3 md:p-4 font-bold text-foreground/90 print:text-black text-sm">{sum.name}</td>
                     <td className="p-3 md:p-4 text-center font-mono text-red-600 print:text-black text-sm">{sum.late > 0 ? sum.late : '-'}</td>
                     <td className="p-3 md:p-4 text-center font-mono text-orange-600 print:text-black text-sm">{sum.earlyLeave > 0 ? sum.earlyLeave : '-'}</td>
                     <td className="p-3 md:p-4 text-center font-mono text-foreground/40 print:text-black text-sm">-</td>
                   </tr>
                 ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
