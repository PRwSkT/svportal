'use client';

import { useState, useEffect, useRef } from 'react';
import { Student } from '@/types';
import { importStudentsFromCSV } from '@/lib/supabase/students';
import Link from 'next/link';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, Upload, Plus, UserX, ChevronRight, Download } from 'lucide-react';
import ExportModal from '@/components/admin/students/ExportModal';
import PromotionModal from '@/components/admin/students/PromotionModal';
import { useLanguage } from '@/contexts/LanguageContext';

export default function StudentRecordsPage() {
  const { dict, isThai, formatCurrency } = useLanguage();
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isPromotionModalOpen, setIsPromotionModalOpen] = useState(false);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('กำลังศึกษาอยู่');
  const [selectedGradeTab, setSelectedGradeTab] = useState('all');
  const [gradeStats, setGradeStats] = useState<{counts: Record<string, number>, total: number}>({counts: {}, total: 0});
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/students/stats');
      if (res.ok) {
        const data = await res.json();
        setGradeStats(data);
      }
    } catch (err) {
      console.error('Fetch stats error:', err);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStudents = async (currentPage: number = page) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/students?q=${encodeURIComponent(searchQuery)}&status=${encodeURIComponent(statusFilter)}&grade=${encodeURIComponent(selectedGradeTab)}&page=${currentPage}&limit=20`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setStudents(data);
        setTotalPages(1);
      } else {
        setStudents(data.data || []);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err: any) {
      console.error('Fetch error:', err);
      toast.error(isThai ? 'ไม่สามารถโหลดข้อมูลนักเรียนได้' : 'Failed to load students', { description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchStudents(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, statusFilter, selectedGradeTab]);

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const toastId = toast.loading(isThai ? 'กำลังนำเข้าข้อมูล...' : 'Importing CSV...');
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const rows = text.split('\n').filter(r => r.trim());
        const headers = rows[0].split(',').map(h => h.trim().toLowerCase());
        
        const idIdx = headers.findIndex(h => h === 'id' || h === 'เลขประจำตัวนักเรียน');
        const nameIdx = headers.findIndex(h => h === 'name' || h === 'ชื่อ - นามสกุล');
        const gradeIdx = headers.findIndex(h => h === 'grade' || h === 'ชั้นเรียน');
        const citizenIdIdx = headers.findIndex(h => h === 'citizen_id' || h === 'เลขประจำตัวประชาชน' || h === 'เลขประจำตัวประชาชนนักเรียน');
        
        if (idIdx === -1 || nameIdx === -1 || gradeIdx === -1) {
          toast.error(isThai ? 'ไฟล์ CSV ไม่ถูกต้อง' : 'Invalid CSV file', { 
            id: toastId, 
            description: isThai ? 'ต้องมีคอลัมน์ เลขประจำตัวนักเรียน, ชื่อ - นามสกุล, ชั้นเรียน เป็นอย่างน้อย' : 'Must include student id, name, and grade columns' 
          });
          return;
        }

        const parseDigits = (str: string) => {
          if (!str) return '';
          return str.replace(/[๐-๙]/g, d => '0123456789'['๐๑๒๓๔๕๖๗๘๙'.indexOf(d)]);
        };

        const parsedStudents: { id: string; name: string; grade: string; citizen_id?: string; status?: string }[] = [];
        for (let i = 1; i < rows.length; i++) {
          const cols = rows[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
          if (cols.length > Math.max(idIdx, nameIdx, gradeIdx)) {
            const rawId = cols[idIdx];
            const rawName = cols[nameIdx];
            const rawGrade = cols[gradeIdx];
            const rawCitizenId = citizenIdIdx !== -1 ? cols[citizenIdIdx] : undefined;

            if (rawId && rawName) {
              const cleanId = parseDigits(rawId).padStart(4, '0');
              const cleanCitizenId = rawCitizenId ? parseDigits(rawCitizenId).replace(/\D/g, '') : undefined;
              
              parsedStudents.push({
                id: cleanId,
                name: rawName,
                grade: rawGrade || '',
                citizen_id: cleanCitizenId,
                status: 'กำลังศึกษาอยู่'
              });
            }
          }
        }

        if (parsedStudents.length === 0) {
          toast.error(isThai ? 'ไม่พบข้อมูลที่ถูกต้องในไฟล์' : 'No valid student records found', { id: toastId });
          return;
        }

        const { success, failed, errors } = await importStudentsFromCSV(parsedStudents);
        if (errors.length > 0 && success === 0) {
          toast.error(isThai ? 'เกิดข้อผิดพลาดในการนำเข้า' : 'Import error', { id: toastId, description: errors[0]?.message });
        } else {
          toast.success(isThai ? `นำเข้าข้อมูลนักเรียนสำเร็จ ${success} รายการ` : `Imported ${success} student records successfully`, { id: toastId });
          fetchStudents(1);
          fetchStats();
        }
      } catch (err: any) {
        toast.error(isThai ? 'การประมวลผลไฟล์ล้มเหลว' : 'File processing failed', { id: toastId, description: err.message });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 font-sans"
    >
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white dark:bg-slate-900 backdrop-blur-xl p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              {dict.common.officialBadge}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-0.5">{dict.students.title}</h1>
          <p className="text-slate-500 text-xs sm:text-sm font-medium">{dict.students.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto">
          <button 
            onClick={() => setIsExportModalOpen(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl hover:border-[#7B1C3E] hover:text-[#7B1C3E] transition-all active:scale-95 text-xs sm:text-sm shadow-sm"
          >
            <Download className="w-4 h-4" /> {isThai ? 'ส่งออก CSV' : 'Export CSV'}
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl hover:border-[#7B1C3E] hover:text-[#7B1C3E] transition-all active:scale-95 text-xs sm:text-sm shadow-sm"
          >
            <Upload className="w-4 h-4" /> {isThai ? 'นำเข้า CSV' : 'Import CSV'}
          </button>
          <input 
            type="file" 
            accept=".csv" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleCsvImport}
          />
          <button 
            onClick={() => setIsPromotionModalOpen(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 font-bold rounded-xl hover:bg-amber-600 hover:text-white transition-all active:scale-95 shadow-sm text-xs sm:text-sm"
          >
            <Upload className="w-4 h-4 rotate-180" /> {dict.students.promote}
          </button>
          <Link href="/admin/students/new" className="flex-1 sm:flex-initial">
            <button className="w-full flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 bg-[#7B1C3E] hover:bg-[#681834] text-white font-bold rounded-xl transition-all shadow-lg shadow-[#7B1C3E]/20 active:scale-95 text-xs sm:text-sm">
              <Plus className="w-4 h-4" /> {dict.students.addStudent}
            </button>
          </Link>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder={isThai ? 'ค้นหารหัส หรือ ชื่อนักเรียน จากทุกห้องเรียน...' : 'Search student ID or name...'} 
            className="w-full pl-10 sm:pl-12 pr-4 py-2.5 sm:py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#7B1C3E] focus:ring-2 focus:ring-[#7B1C3E]/20 text-slate-900 dark:text-white text-xs sm:text-sm transition-all"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="relative w-full sm:w-56">
          <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
          <select 
            className="w-full pl-10 sm:pl-12 pr-4 py-2.5 sm:py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#7B1C3E] focus:ring-2 focus:ring-[#7B1C3E]/20 text-slate-900 dark:text-white appearance-none transition-all text-xs sm:text-sm"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">{isThai ? 'สถานะทั้งหมด' : 'All Statuses'}</option>
            <option value="กำลังศึกษาอยู่">{isThai ? 'กำลังศึกษาอยู่ / เข้าใหม่' : 'Enrolled / New'}</option>
            <option value="นักเรียนเข้าใหม่">{isThai ? 'นักเรียนเข้าใหม่' : 'New Enrollment'}</option>
            <option value="สำเร็จการศึกษา">{isThai ? 'สำเร็จการศึกษา' : 'Graduated'}</option>
            <option value="จำหน่ายออก">{isThai ? 'จำหน่ายออก' : 'Transferred / Inactive'}</option>
          </select>
        </div>
      </div>

      {/* Grade Tabs Navigation */}
      <div className="flex overflow-x-auto pb-2 gap-2 snap-x hide-scrollbar">
        <button
          onClick={() => setSelectedGradeTab('all')}
          className={`snap-start whitespace-nowrap px-5 py-2.5 rounded-full font-bold text-sm transition-all shadow-sm border ${
            selectedGradeTab === 'all' 
              ? 'bg-[#7B1C3E] text-white border-[#7B1C3E] shadow-[#7B1C3E]/20' 
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
          }`}
        >
          {dict.common.all} <span className="ml-1 opacity-70 text-xs font-mono">({gradeStats.total})</span>
        </button>
        
        {Object.keys(gradeStats.counts)
          .sort((a, b) => {
            const isAnubanA = a.startsWith('อ.');
            const isAnubanB = b.startsWith('อ.');
            if (isAnubanA && !isAnubanB) return -1;
            if (!isAnubanA && isAnubanB) return 1;
            return a.localeCompare(b);
          })
          .map(grade => (
          <button
            key={grade}
            onClick={() => setSelectedGradeTab(grade)}
            className={`snap-start whitespace-nowrap px-5 py-2.5 rounded-full font-bold text-sm transition-all shadow-sm border ${
              selectedGradeTab === grade 
                ? 'bg-[#7B1C3E] text-white border-[#7B1C3E] shadow-[#7B1C3E]/20' 
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
            }`}
          >
            {grade} <span className="ml-1 opacity-70 text-xs font-mono">({gradeStats.counts[grade]})</span>
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 overflow-hidden min-h-[400px]">
        {isLoading ? (
          <div className="p-8 space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="w-20 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl"></div>
                <div className="flex-1 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl"></div>
                <div className="w-32 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl"></div>
                <div className="w-24 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl"></div>
              </div>
            ))}
          </div>
        ) : students.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-slate-400 space-y-4">
            <UserX className="w-20 h-20 opacity-20" />
            <p className="text-xl font-medium">{isThai ? 'ไม่พบข้อมูลนักเรียน' : 'No student records found'}</p>
          </div>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[650px]">
              <thead className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="p-5 font-bold text-slate-500 text-sm uppercase tracking-wider">{dict.students.studentId}</th>
                  <th className="p-5 font-bold text-slate-500 text-sm uppercase tracking-wider">{dict.students.studentName}</th>
                  {selectedGradeTab === 'all' && (
                    <th className="p-5 font-bold text-slate-500 text-sm uppercase tracking-wider">{dict.students.grade}</th>
                  )}
                  <th className="p-5 font-bold text-slate-500 text-sm uppercase tracking-wider">{dict.common.status}</th>
                  <th className="p-5 font-bold text-slate-500 text-sm uppercase tracking-wider text-right">Wallet</th>
                  <th className="p-5 font-bold text-slate-500 text-sm uppercase tracking-wider text-center">{dict.common.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                <AnimatePresence>
                  {students.map(s => (
                    <motion.tr 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      layout
                      key={s.id} 
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group cursor-pointer"
                      onClick={() => document.getElementById(`link-${s.id}`)?.click()}
                    >
                      <td className="p-5 font-mono font-medium text-slate-600 dark:text-slate-300">{s.id}</td>
                      <td className="p-5 font-bold text-[#7B1C3E] dark:text-pink-400">
                        {s.first_name && s.last_name 
                          ? `${s.prefix || ''}${s.first_name} ${s.last_name}`.trim()
                          : s.name}
                      </td>
                      {selectedGradeTab === 'all' && (
                        <td className="p-5 font-medium text-slate-700 dark:text-slate-300">{s.grade || '-'}</td>
                      )}
                      <td className="p-5">
                        <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                          s.status?.includes('กำลังศึกษา') || s.status === 'active' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 
                          'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="p-5 text-right font-mono font-bold text-slate-800 dark:text-slate-200">{formatCurrency(s.wallet_balance || 0)}</td>
                      <td className="p-5 text-center">
                        <Link id={`link-${s.id}`} href={`/admin/students/${s.id}`} className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#7B1C3E] hover:bg-[#7B1C3E] hover:text-white transition-all shadow-sm group-hover:scale-110">
                          <ChevronRight className="w-5 h-5" />
                        </Link>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
          
          {totalPages > 1 && (
            <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800">
              <button 
                onClick={() => {
                  const newPage = Math.max(1, page - 1);
                  setPage(newPage);
                  fetchStudents(newPage);
                }}
                disabled={page === 1}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-50 text-sm font-bold bg-white dark:bg-slate-800 hover:bg-slate-50 transition-colors"
              >
                {isThai ? 'ก่อนหน้า' : 'Previous'}
              </button>
              <span className="text-sm font-bold text-slate-500">
                {isThai ? `หน้า ${page} จาก ${totalPages}` : `Page ${page} of ${totalPages}`}
              </span>
              <button 
                onClick={() => {
                  const newPage = Math.min(totalPages, page + 1);
                  setPage(newPage);
                  fetchStudents(newPage);
                }}
                disabled={page >= totalPages}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-50 text-sm font-bold bg-white dark:bg-slate-800 hover:bg-slate-50 transition-colors"
              >
                {isThai ? 'ถัดไป' : 'Next'}
              </button>
            </div>
          )}
        </>
        )}
      </div>

      <ExportModal 
        isOpen={isExportModalOpen} 
        onClose={() => setIsExportModalOpen(false)}
        availableGrades={Object.keys(gradeStats.counts).sort((a, b) => {
          const isAnubanA = a.startsWith('อ.');
          const isAnubanB = b.startsWith('อ.');
          if (isAnubanA && !isAnubanB) return -1;
          if (!isAnubanA && isAnubanB) return 1;
          return a.localeCompare(b);
        })}
      />

      <PromotionModal 
        isOpen={isPromotionModalOpen} 
        onClose={() => setIsPromotionModalOpen(false)}
        onSuccess={() => {
          setIsPromotionModalOpen(false);
          fetchStudents(1);
          fetchStats();
        }}
      />
    </motion.div>
  );
}
