'use client';

import { useState, useEffect, useRef } from 'react';
import { Student } from '@/types';
import { importStudentsFromCSV } from '@/lib/supabase/students';
import Link from 'next/link';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, Upload, Plus, UserX, UserSquare2, ChevronRight, Download } from 'lucide-react';
import ExportModal from '@/components/admin/students/ExportModal';
import PromotionModal from '@/components/admin/students/PromotionModal';

export default function StudentRecordsPage() {
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
      toast.error('ไม่สามารถโหลดข้อมูลนักเรียนได้', { description: err.message });
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

    const toastId = toast.loading('กำลังนำเข้าข้อมูล...');
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
          toast.error('ไฟล์ CSV ไม่ถูกต้อง', { id: toastId, description: 'ต้องมีคอลัมน์ เลขประจำตัวนักเรียน, ชื่อ - นามสกุล, ชั้นเรียน เป็นอย่างน้อย' });
          return;
        }

        // แปลงเลขไทยเป็นอารบิก
        const thaiToArabic = (str: string | undefined) => {
          if (!str) return undefined;
          const thaiNums = ['๐','๑','๒','๓','๔','๕','๖','๗','๘','๙'];
          return str.toString().split('').map(char => {
              const idx = thaiNums.indexOf(char);
              return idx !== -1 ? idx.toString() : char;
          }).join('');
        };

        const toImport = [];
        for (let i = 1; i < rows.length; i++) {
          const cols = rows[i].split(',').map(c => c.trim());
          if (cols.length < 3) continue;
          
          toImport.push({
            id: cols[idIdx],
            name: cols[nameIdx],
            grade: cols[gradeIdx],
            citizen_id: citizenIdIdx !== -1 ? thaiToArabic(cols[citizenIdIdx]) : undefined,
            status: 'กำลังศึกษาอยู่'
          });
        }

        const result = await importStudentsFromCSV(toImport);
        toast.success('นำเข้าข้อมูลเรียบร้อย', { 
          id: toastId,
          description: `สำเร็จ ${result.success} รายการ, ล้มเหลว ${result.failed} รายการ`
        });
        fetchStats();
        fetchStudents();
      } catch (err) {
        toast.error('เกิดข้อผิดพลาดในการอ่านไฟล์ CSV', { id: toastId });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-8 max-w-7xl mx-auto space-y-8 font-sans"
    >
      <div className="flex justify-between items-center bg-surface/80 backdrop-blur-xl p-6 rounded-3xl shadow-lg border border-white/20">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
            <UserSquare2 className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-primary mb-1">งานระเบียนนักเรียน</h1>
            <p className="text-foreground/60 font-medium">จัดการข้อมูลประวัตินักเรียนและสถานะการศึกษา</p>
          </div>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-surface border-2 border-foreground/10 text-foreground/70 font-bold rounded-xl hover:border-primary hover:text-primary transition-all active:scale-95"
          >
            <Download className="w-5 h-5" /> Export CSV
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-6 py-3 bg-surface border-2 border-foreground/10 text-foreground/70 font-bold rounded-xl hover:border-primary hover:text-primary transition-all active:scale-95"
          >
            <Upload className="w-5 h-5" /> Import CSV
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
            className="flex items-center gap-2 px-6 py-3 bg-secondary/10 border-2 border-secondary/20 text-secondary font-bold rounded-xl hover:bg-secondary hover:text-white transition-all active:scale-95 shadow-sm"
          >
            <Upload className="w-5 h-5 rotate-180" /> เลื่อนชั้นประจำปี
          </button>
          <Link href="/admin/students/new">
            <button className="flex items-center gap-2 px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95">
              <Plus className="w-5 h-5" /> เพิ่มนักเรียน
            </button>
          </Link>
        </div>
      </div>

      <div className="flex gap-4 bg-surface/80 backdrop-blur-xl p-4 rounded-2xl shadow-sm border border-foreground/5">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground/40" />
          <input 
            type="text" 
            placeholder="ค้นหารหัส หรือ ชื่อนักเรียน จากทุกห้องเรียน..." 
            className="w-full pl-12 pr-4 py-3 bg-background border border-foreground/10 rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-foreground transition-all"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="relative w-56">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground/40" />
          <select 
            className="w-full pl-12 pr-4 py-3 bg-background border border-foreground/10 rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-foreground appearance-none transition-all"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">ทุกสถานะ</option>
            <option value="กำลังศึกษาอยู่">กำลังศึกษาอยู่</option>
            <option value="สำเร็จการศึกษา">สำเร็จการศึกษา</option>
            <option value="ลาออก">ลาออก</option>
            <option value="active">Active (Legacy)</option>
          </select>
        </div>
      </div>

      {/* Grade Tabs Navigation */}
      <div className="flex overflow-x-auto pb-2 gap-2 snap-x scrollbar-hide">
        <button
          onClick={() => setSelectedGradeTab('all')}
          className={`snap-start whitespace-nowrap px-5 py-2.5 rounded-full font-bold text-sm transition-all shadow-sm border ${
            selectedGradeTab === 'all' 
              ? 'bg-primary text-white border-primary shadow-primary/20' 
              : 'bg-surface text-foreground/60 border-foreground/10 hover:bg-foreground/5 hover:text-foreground'
          }`}
        >
          ทั้งหมด <span className="ml-1 opacity-70 text-xs font-mono">({gradeStats.total})</span>
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
                ? 'bg-primary text-white border-primary shadow-primary/20' 
                : 'bg-surface text-foreground/60 border-foreground/10 hover:bg-foreground/5 hover:text-foreground'
            }`}
          >
            {grade} <span className="ml-1 opacity-70 text-xs font-mono">({gradeStats.counts[grade]})</span>
          </button>
        ))}
      </div>

      <div className="bg-surface/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 overflow-hidden min-h-[400px]">
        {isLoading ? (
          <div className="p-8 space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="w-20 h-12 bg-foreground/5 rounded-xl"></div>
                <div className="flex-1 h-12 bg-foreground/[0.02] rounded-xl"></div>
                <div className="w-32 h-12 bg-foreground/5 rounded-xl"></div>
                <div className="w-24 h-12 bg-foreground/5 rounded-xl"></div>
              </div>
            ))}
          </div>
        ) : students.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-foreground/40 space-y-4">
            <UserX className="w-20 h-20 opacity-20" />
            <p className="text-xl font-medium">ไม่พบข้อมูลนักเรียน</p>
          </div>
        ) : (
          <>
          <table className="w-full text-left">
            <thead className="bg-foreground/[0.02] border-b border-foreground/5">
              <tr>
                <th className="p-5 font-bold text-foreground/50 text-sm uppercase tracking-wider">รหัส</th>
                <th className="p-5 font-bold text-foreground/50 text-sm uppercase tracking-wider">ชื่อ-สกุล</th>
                {selectedGradeTab === 'all' && (
                  <th className="p-5 font-bold text-foreground/50 text-sm uppercase tracking-wider">ชั้นเรียน</th>
                )}
                <th className="p-5 font-bold text-foreground/50 text-sm uppercase tracking-wider">สถานะ</th>
                <th className="p-5 font-bold text-foreground/50 text-sm uppercase tracking-wider text-right">Wallet</th>
                <th className="p-5 font-bold text-foreground/50 text-sm uppercase tracking-wider text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/5">
              <AnimatePresence>
                {students.map(s => (
                  <motion.tr 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    layout
                    key={s.id} 
                    className="hover:bg-foreground/[0.02] transition-colors group cursor-pointer"
                    onClick={() => document.getElementById(`link-${s.id}`)?.click()}
                  >
                    <td className="p-5 font-mono font-medium text-foreground/70">{s.id}</td>
                    <td className="p-5 font-bold text-primary">
                      {s.first_name && s.last_name 
                        ? `${s.prefix || ''}${s.first_name} ${s.last_name}`.trim()
                        : s.name}
                    </td>
                    {selectedGradeTab === 'all' && (
                      <td className="p-5 font-medium text-foreground/80">{s.grade || '-'}</td>
                    )}
                    <td className="p-5">
                      <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                        s.status?.includes('กำลังศึกษา') || s.status === 'active' ? 'bg-secondary/10 text-secondary' : 
                        'bg-foreground/10 text-foreground/50'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="p-5 text-right font-mono font-bold text-foreground/80">฿{(s.wallet_balance || 0).toLocaleString()}</td>
                    <td className="p-5 text-center">
                      <Link id={`link-${s.id}`} href={`/admin/students/${s.id}`} className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-surface border border-foreground/10 text-primary hover:bg-primary hover:text-white transition-all shadow-sm group-hover:scale-110">
                        <ChevronRight className="w-5 h-5" />
                      </Link>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          
          {totalPages > 1 && (
            <div className="flex justify-between items-center p-4 bg-foreground/[0.02] border-t border-foreground/5">
              <button 
                onClick={() => {
                  const newPage = Math.max(1, page - 1);
                  setPage(newPage);
                  fetchStudents(newPage);
                }}
                disabled={page === 1}
                className="px-4 py-2 border border-foreground/10 rounded-lg disabled:opacity-50 text-sm font-bold bg-surface hover:bg-foreground/5 transition-colors"
              >
                ก่อนหน้า
              </button>
              <span className="text-sm font-bold text-foreground/50">หน้า {page} จาก {totalPages}</span>
              <button 
                onClick={() => {
                  const newPage = Math.min(totalPages, page + 1);
                  setPage(newPage);
                  fetchStudents(newPage);
                }}
                disabled={page >= totalPages}
                className="px-4 py-2 border border-foreground/10 rounded-lg disabled:opacity-50 text-sm font-bold bg-surface hover:bg-foreground/5 transition-colors"
              >
                ถัดไป
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
