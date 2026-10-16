'use client';

import { useState, useEffect } from 'react';
import { 
  FileCheck2, 
  Download, 
  Layers, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink,
  ChevronRight,
  RefreshCw,
  School,
  FileSpreadsheet,
  X,
  Users,
  BookOpen
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function OpecRegisExportPage() {
  const [academicYear, setAcademicYear] = useState('2568');
  const [selectedGradeLevel, setSelectedGradeLevel] = useState('P3');
  const [exportData, setExportData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchExportPreview = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/academic/opec-export?year=${academicYear}&grade_level=${selectedGradeLevel}`);
      if (!res.ok) throw new Error('โหลดข้อมูลล้มเหลว');
      const data = await res.json();
      setExportData(data);
    } catch (e: any) {
      toast.error('ไม่สามารถโหลดข้อมูลส่งออก สช. ได้: ' + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExportPreview();
  }, [academicYear, selectedGradeLevel]);

  const handleDownloadCsv = () => {
    window.open(`/api/academic/opec-export?year=${academicYear}&grade_level=${selectedGradeLevel}&format=csv`, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Link href="/academic" className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#7B1C3E]/10 text-[#7B1C3E] border border-[#7B1C3E]/20 hover:bg-[#7B1C3E]/20 transition-all inline-flex items-center gap-1.5">
                Somkid Academic Studio
              </Link>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs text-slate-500 font-medium">ส่งออก REGIS (สช.)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
              <span className="p-2 bg-[#7B1C3E]/10 text-[#7B1C3E] border border-[#7B1C3E]/20 rounded-xl">
                <FileCheck2 className="w-7 h-7" />
              </span>
              ระบบส่งออกผลการเรียนเข้า REGIS (สช. Dual-Layer Export)
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              แปลงข้อมูลจากระบบจริงของโรงเรียน ให้ตรงตามมาตรฐานของสำนักงานคณะกรรมการส่งเสริมการศึกษาเอกชน 100%
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href="https://sso.opec.go.th"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 transition-all"
            >
              เปิดเว็บ สช. (sso.opec.go.th)
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              onClick={handleDownloadCsv}
              disabled={!exportData || exportData.rows?.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#7B1C3E] hover:bg-[#631430] text-white rounded-xl text-xs font-bold shadow-md shadow-[#7B1C3E]/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              ดาวน์โหลดไฟล์สำหรับ REGIS (CSV)
            </button>
          </div>
        </div>

        {/* Quick Metrics Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#7B1C3E]/10 flex items-center justify-center text-[#7B1C3E] shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">นักเรียนในสายชั้น</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{exportData?.summary?.totalStudents || 0}</h3>
              <p className="text-[11px] text-slate-400">ระดับชั้น {selectedGradeLevel}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/40 flex items-center justify-center text-purple-600 shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">แถวข้อมูลผลการเรียน</p>
              <h3 className="text-2xl font-bold text-purple-600 dark:text-purple-400">{exportData?.rows?.length || 0}</h3>
              <p className="text-[11px] text-slate-400">พร้อมอัปโหลดเข้า REGIS</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 shrink-0">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">ห้องเรียนรวม (สช.)</p>
              <h3 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{exportData?.summary?.consolidatedRooms?.length || 0}</h3>
              <p className="text-[11px] text-slate-400">ยุบห้องย่อยอัตโนมัติ</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-600 shrink-0">
              <Filter className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">วิชา MEP ที่ตัดออก</p>
              <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400">{exportData?.summary?.excludedMepCourses?.length || 0}</h3>
              <p className="text-[11px] text-slate-400">ไม่ส่งซ้ำซ้อน สช.</p>
            </div>
          </div>
        </div>

        {/* Dual-Layer Transformation Summary Cards */}
        {exportData && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Card 1: Room Consolidation */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs mb-2">
                <Layers className="w-4 h-4" />
                <span>การรวมห้องเรียนย่อย (Class Consolidation)</span>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                รวมห้องเรียนจริงของโรงเรียน เข้าสู่ห้องเดี่ยวตามทะเบียน สช.
              </p>
              <div className="space-y-1">
                {exportData.summary?.consolidatedRooms?.map((r: string, i: number) => (
                  <span key={i} className="inline-block px-2.5 py-1 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs font-semibold mr-1.5">
                    {r}
                  </span>
                ))}
              </div>
            </div>

            {/* Card 2: MEP Course Filtering */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-2 text-amber-600 font-bold text-xs mb-2">
                <Filter className="w-4 h-4" />
                <span>วิชาที่ตัดออกอัตโนมัติ (Excluded MEP Courses)</span>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                แสดงในใบเกรดผู้ปกครอง แต่ตัดออกจากไฟล์ส่ง สช. อัตโนมัติ
              </p>
              <div className="space-y-1">
                {exportData.summary?.excludedMepCourses?.length > 0 ? (
                  exportData.summary.excludedMepCourses.map((c: string, i: number) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-xs font-semibold mr-1.5">
                      <X className="w-3 h-3 text-amber-700 dark:text-amber-400" />
                      <span>{c}</span>
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400">ไม่มีวิชาที่ถูกตัดออก</span>
                )}
              </div>
            </div>

            {/* Card 3: Ready Status */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs mb-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>ความพร้อมส่งออก (Export Readiness)</span>
              </div>
              <p className="text-xs text-slate-500 mb-2">
                ตรวจสอบความสมบูรณ์ของเลข 13 หลักและชื่อครูตามวิทยฐานะ
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {exportData.rows?.length || 0}
                </span>
                <span className="text-xs text-slate-500">แถวข้อมูลพร้อมอัปโหลด ({exportData.summary?.totalStudents} คน)</span>
              </div>
            </div>

          </div>
        )}

        {/* Filter Controls */}
        <div className="flex items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">ระดับชั้น:</span>
            <select
              value={selectedGradeLevel}
              onChange={(e) => setSelectedGradeLevel(e.target.value)}
              className="text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 text-slate-900 dark:text-white"
            >
              <option value="P1">ประถมศึกษาปีที่ 1 (ป.1)</option>
              <option value="P2">ประถมศึกษาปีที่ 2 (ป.2)</option>
              <option value="P3">ประถมศึกษาปีที่ 3 (ป.3 - มีตัวอย่าง MEP)</option>
              <option value="P4">ประถมศึกษาปีที่ 4 (ป.4)</option>
              <option value="P5">ประถมศึกษาปีที่ 5 (ป.5)</option>
              <option value="P6">ประถมศึกษาปีที่ 6 (ป.6)</option>
            </select>
          </div>

          <button
            onClick={fetchExportPreview}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 dark:border-slate-700 dark:text-slate-300"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Preview Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="font-bold text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-purple-600" />
              ตัวอย่างข้อมูลที่จะส่งเข้าสู่ระบบ REGIS สช. (Preview)
            </span>
            <span className="text-[11px] text-slate-400">จัดเรียงตาม: ห้องเรียน สช. &gt; รหัสวิชา &gt; รหัสนักเรียน</span>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-xs text-slate-500">กำลังประมวลผลข้อมูล Dual-Layer...</div>
          ) : !exportData || exportData.rows?.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500">ไม่พบข้อมูลผลการเรียนที่พร้อมส่งออกในระดับชั้นนี้</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <th className="py-2.5 px-3">รหัสนักเรียน</th>
                    <th className="py-2.5 px-3">เลขประจำตัวประชาชน (13 หลัก)</th>
                    <th className="py-2.5 px-4">ชื่อ-สกุล นักเรียน</th>
                    <th className="py-2.5 px-3 text-center">ห้องเรียน (สช.)</th>
                    <th className="py-2.5 px-3">รหัสวิชา (สช.)</th>
                    <th className="py-2.5 px-4">ชื่อวิชา</th>
                    <th className="py-2.5 px-3 text-center">คะแนนรวม</th>
                    <th className="py-2.5 px-3 text-center">เกรด</th>
                    <th className="py-2.5 px-4">ครูผู้สอนตามทะเบียน สช.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {exportData.rows.map((r: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300">{r.studentCode}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">{r.citizenId || '-'}</td>
                      <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-white">{r.studentName}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-purple-700 dark:text-purple-400">{r.opecRoomName}</td>
                      <td className="py-2.5 px-3 font-mono font-semibold">{r.opecCourseCode}</td>
                      <td className="py-2.5 px-4 text-slate-800 dark:text-slate-200">{r.courseName}</td>
                      <td className="py-2.5 px-3 text-center font-bold">{r.totalScore}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-extrabold text-xs">
                          {r.finalGrade}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">{r.teacherName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
