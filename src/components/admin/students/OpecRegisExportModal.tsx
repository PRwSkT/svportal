'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Download, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  RefreshCw, 
  ShieldCheck, 
  Users, 
  ExternalLink,
  ChevronRight,
  Info,
  Calendar,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface OpecRegisExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableGrades: string[];
}

interface AuditSummary {
  total: number;
  thaiCount: number;
  foreignCount: number;
  readyCount: number;
  warningCount: number;
  errorCount: number;
  gradeBreakdown: Record<string, { total: number; ready: number; error: number; warning: number }>;
  studentResults: any[];
  criticalIssuesList: { studentId: string; studentName: string; grade: string; issues: any[] }[];
}

export default function OpecRegisExportModal({
  isOpen,
  onClose,
  availableGrades,
}: OpecRegisExportModalProps) {
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('กำลังศึกษาอยู่');
  const [activeTab, setActiveTab] = useState<'overview' | 'errors' | 'warnings' | 'foreign'>('overview');
  
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [auditData, setAuditData] = useState<AuditSummary | null>(null);

  // Fetch audit results whenever modal opens or filters change
  const runAudit = async () => {
    setIsLoadingAudit(true);
    try {
      const res = await fetch(
        `/api/opec/export-regis-excel?mode=audit&grade=${encodeURIComponent(selectedGrade)}&status=${encodeURIComponent(statusFilter)}`
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'ไม่สามารถตรวจสอบข้อมูลได้');
      }
      const data = await res.json();
      if (data.summary) {
        setAuditData(data.summary);
      }
    } catch (err: any) {
      console.error('Audit fetch error:', err);
      toast.error('การตรวจสุขภาพข้อมูล สช. ไม่สำเร็จ', { description: err.message });
    } finally {
      setIsLoadingAudit(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      runAudit();
    }
  }, [isOpen, selectedGrade, statusFilter]);

  const handleDownload = async () => {
    if (auditData && auditData.errorCount > 0) {
      toast.warning('ตรวจพบข้อมูลไม่ถูกต้องตามเกณฑ์ สช.', {
        description: `มีนักเรียน ${auditData.errorCount} คนที่ข้อมูลไม่ผ่าน หากส่งออกอาจถูกระบบ สช. REGIS ตีกลับ`,
      });
    }

    setIsExporting(true);
    const toastId = toast.loading('กำลังสร้างไฟล์ Excel สช. REGIS...');
    try {
      const url = `/api/opec/export-regis-excel?mode=download&grade=${encodeURIComponent(selectedGrade)}&status=${encodeURIComponent(statusFilter)}`;
      const res = await fetch(url);
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'ดาวน์โหลดไฟล์ล้มเหลว');
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      
      // Extract filename from header if available
      const disposition = res.headers.get('content-disposition');
      let filename = `OPEC_REGIS_Somkid_${selectedGrade === 'all' ? 'All' : selectedGrade}.xlsx`;
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) filename = decodeURIComponent(match[1]);
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      toast.success('ดาวน์โหลดไฟล์ Excel สช. REGIS สำเร็จ', {
        id: toastId,
        description: 'ไฟล์ผ่านการแปลงวันที่ ปปปปดดวว และจัดโครงสร้าง 2 ชีตพร้อมนำเข้า regis.opec.go.th',
      });
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาดในการดาวน์โหลด', { id: toastId, description: err.message });
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          transition={{ duration: 0.2 }}
          className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden"
        >
          {/* Header */}
          <div className="p-4 sm:p-6 bg-gradient-to-r from-[#7B1C3E] via-[#8E2147] to-[#1E3A8A] text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-md border border-white/20">
                <FileSpreadsheet className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white uppercase tracking-wider">
                    สช. REGIS 2.0 Engine
                  </span>
                  <span className="text-[10px] text-amber-200 font-medium">
                    รหัสโรงเรียน 1121100013
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold tracking-tight">
                  ส่งออกข้อมูลนักเรียนเข้า สช. REGIS (1-Click)
                </h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Filter Bar */}
          <div className="px-4 sm:px-6 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 flex-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                <span>เลือกระดับชั้น:</span>
                <select
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value)}
                  className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]/30"
                >
                  <option value="all">ทุกระดับชั้น (อ.1 - ป.6)</option>
                  {availableGrades.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                <span>สถานะ:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]/30"
                >
                  <option value="กำลังศึกษาอยู่">กำลังศึกษาอยู่ / เข้าใหม่</option>
                  <option value="นักเรียนเข้าใหม่">เฉพาะนักเรียนเข้าใหม่</option>
                  <option value="all">ทุกสถานะ</option>
                </select>
              </div>
            </div>

            <button
              onClick={runAudit}
              disabled={isLoadingAudit}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-[#7B1C3E] hover:text-[#7B1C3E] transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAudit ? 'animate-spin' : ''}`} />
              <span>ตรวจสุขภาพข้อมูลใหม่</span>
            </button>
          </div>

          {/* KPI Dashboard */}
          <div className="p-4 sm:p-6 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
            {/* Total */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center gap-3">
              <div className="p-2.5 bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400">นักเรียนในขอบเขต</p>
                <p className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                  {isLoadingAudit ? '...' : auditData?.total ?? 0} <span className="text-xs font-normal">คน</span>
                </p>
              </div>
            </div>

            {/* Ready */}
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200 dark:border-emerald-800/40 flex items-center gap-3">
              <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-xl">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">พร้อมนำเข้า 100%</p>
                <p className="text-lg sm:text-xl font-extrabold text-emerald-700 dark:text-emerald-300">
                  {isLoadingAudit ? '...' : auditData?.readyCount ?? 0} <span className="text-xs font-normal">คน</span>
                </p>
              </div>
            </div>

            {/* Errors */}
            <div
              onClick={() => auditData?.errorCount && auditData.errorCount > 0 && setActiveTab('errors')}
              className={`p-3 rounded-2xl border flex items-center gap-3 cursor-pointer transition-all ${
                auditData && auditData.errorCount > 0
                  ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800 hover:ring-2 hover:ring-rose-400'
                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800'
              }`}
            >
              <div
                className={`p-2.5 rounded-xl ${
                  auditData && auditData.errorCount > 0
                    ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                }`}
              >
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400">สช. จะตีกลับ (Errors)</p>
                <p
                  className={`text-lg sm:text-xl font-extrabold ${
                    auditData && auditData.errorCount > 0
                      ? 'text-rose-700 dark:text-rose-300'
                      : 'text-slate-400'
                  }`}
                >
                  {isLoadingAudit ? '...' : auditData?.errorCount ?? 0} <span className="text-xs font-normal">คน</span>
                </p>
              </div>
            </div>

            {/* Foreign / G-Code */}
            <div
              onClick={() => setActiveTab('foreign')}
              className="p-3 bg-teal-50 dark:bg-teal-950/20 rounded-2xl border border-teal-200 dark:border-teal-800/40 flex items-center gap-3 cursor-pointer hover:ring-2 hover:ring-teal-400 transition-all"
            >
              <div className="p-2.5 bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 rounded-xl">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-teal-600 dark:text-teal-400">ต่างชาติ / G-CODE</p>
                <p className="text-lg sm:text-xl font-extrabold text-teal-700 dark:text-teal-300">
                  {isLoadingAudit ? '...' : auditData?.foreignCount ?? 0} <span className="text-xs font-normal">คน</span>
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 bg-slate-50/50 dark:bg-slate-800/30">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'overview'
                  ? 'border-[#7B1C3E] text-[#7B1C3E] dark:text-rose-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" /> ภาพรวมและส่งออก
            </button>
            <button
              onClick={() => setActiveTab('errors')}
              className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'errors'
                  ? 'border-rose-600 text-rose-600 dark:text-rose-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <AlertCircle className="w-4 h-4" /> รายการที่ต้องแก้
              {auditData && auditData.errorCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-600 text-white font-extrabold">
                  {auditData.errorCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('foreign')}
              className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'foreign'
                  ? 'border-teal-600 text-teal-600 dark:text-teal-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Users className="w-4 h-4" /> นักเรียนต่างชาติ (ชีต 2)
              {auditData && auditData.foreignCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-teal-600 text-white font-extrabold">
                  {auditData.foreignCount}
                </span>
              )}
            </button>
          </div>

          {/* Content Body */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 max-h-[46vh] space-y-4">
            {activeTab === 'overview' && (
              <div className="space-y-4">
                {/* Status Notice */}
                {auditData && auditData.errorCount > 0 ? (
                  <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-rose-800 dark:text-rose-200">
                        พบข้อผิดพลาด {auditData.errorCount} รายการ ที่ระบบ สช. จะตีกลับ
                      </h4>
                      <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                        เช่น เลขประจำตัวประชาชน 13 หลักไม่ถูกต้องตามสูตร Modulo 11 หรือไม่มีวันเกิด
                        แนะนำให้คลิกแท็บ &quot;รายการที่ต้องแก้&quot; เพื่อแก้ไขก่อนนำเข้า สช.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-200">
                        ผ่านการตรวจสอบ 100%! ข้อมูลพร้อมส่งออกเข้า สช. REGIS
                      </h4>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                        ระบบแปลงวันเกิดเป็นตัวเลข 8 หลัก <code className="font-mono bg-emerald-200/50 dark:bg-emerald-900/50 px-1 py-0.5 rounded">ปปปปดดวว</code> (พ.ศ.) 
                        และจัดแยกชีตนักเรียนไทยและต่างชาติให้เรียบร้อยแล้วค่ะ
                      </p>
                    </div>
                  </div>
                )}

                {/* Grade breakdown cards */}
                {auditData?.gradeBreakdown && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      สรุปความพร้อมแยกตามห้องเรียน
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {Object.entries(auditData.gradeBreakdown).map(([grade, stats]) => (
                        <div
                          key={grade}
                          className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs"
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-extrabold text-slate-800 dark:text-slate-200">{grade}</span>
                            <span className="font-mono text-slate-500">{stats.total} คน</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <span className="text-emerald-600 font-bold">✓ {stats.ready}</span>
                            {stats.error > 0 && (
                              <span className="text-rose-600 font-bold">✗ {stats.error}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* OPEC REGIS Official Upload Guidelines */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                    <Info className="w-4 h-4 text-[#7B1C3E]" />
                    <span>ขั้นตอนการนำไฟล์ไปอัปโหลดบน regis.opec.go.th:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-300 ml-1">
                    <li>กดปุ่ม <strong>&quot;ดาวน์โหลดไฟล์ Excel สช. REGIS (.xlsx)&quot;</strong> ด้านล่าง</li>
                    <li>เข้าสู่ระบบ <a href="https://regis.opec.go.th" target="_blank" rel="noreferrer" className="text-blue-600 underline font-semibold inline-flex items-center gap-0.5">regis.opec.go.th <ExternalLink className="w-3 h-3" /></a></li>
                    <li>ไปที่เมนู <strong>2.2.3 นำเข้านักเรียนจาก Excel File</strong></li>
                    <li>เลือก <strong>&quot;นำเข้านักเรียนที่มีเลข 13 หลัก&quot;</strong> สำหรับชีตที่ 1 หรือ <strong>&quot;นำเข้านักเรียนต่างชาติ (G-CODE)&quot;</strong> สำหรับชีตที่ 2</li>
                    <li>อัปโหลดไฟล์แล้วกดยืนยัน ข้อมูลจะเข้าสู่ระบบ สช. โดยสมบูรณ์</li>
                  </ol>
                </div>
              </div>
            )}

            {activeTab === 'errors' && (
              <div className="space-y-3">
                {auditData?.criticalIssuesList && auditData.criticalIssuesList.length > 0 ? (
                  auditData.criticalIssuesList.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white text-sm">
                            {item.studentName}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 font-mono text-[10px]">
                            รหัส {item.studentId}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 font-bold text-[10px]">
                            {item.grade}
                          </span>
                        </div>
                        <div className="mt-1.5 space-y-1">
                          {item.issues.map((iss, iIdx) => (
                            <p key={iIdx} className="text-rose-600 dark:text-rose-400 flex items-center gap-1.5 font-medium">
                              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                              <span><strong>{iss.fieldLabel}:</strong> {iss.message}</span>
                            </p>
                          ))}
                        </div>
                      </div>

                      <Link
                        href={`/admin/students/${item.studentId}`}
                        target="_blank"
                        className="self-start sm:self-center px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-all shadow-sm flex items-center gap-1 text-[11px] whitespace-nowrap"
                      >
                        <span>แก้ไขข้อมูล</span>
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">ยอดเยี่ยมมากค่ะ!</p>
                    <p>ไม่พบรายการข้อผิดพลาดร้ายแรง ข้อมูลผ่านเกณฑ์ สช. 100%</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'foreign' && (
              <div className="space-y-3">
                <div className="p-3 bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 rounded-xl text-xs text-teal-800 dark:text-teal-200">
                  <p className="font-bold">ข้อมูลนักเรียนต่างชาติ / G-CODE:</p>
                  <p className="text-[11px] mt-0.5">
                    นักเรียนกลุ่มนี้ถูกแยกไปยัง <strong>ชีต 2 (&quot;ข้อมูลนักเรียนต่างชาติ (G-CODE)&quot;)</strong> โดยอัตโนมัติ เพื่อนำเข้าผ่านเมนู 2.2.3.2 ในระบบ สช.
                  </p>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {auditData?.studentResults
                    ?.filter((s) => s.isForeign)
                    .map((fs, idx) => (
                      <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-200">
                            {fs.studentName}
                          </p>
                          <p className="text-[11px] text-slate-400 font-mono">
                            รหัสประจำตัว: {fs.studentId} | ชั้น: {fs.grade} | เลขระบุ: {fs.citizenId || 'ยังไม่มี G-Code'}
                          </p>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300">
                          ชีต 2 (G-CODE)
                        </span>
                      </div>
                    ))}
                  {auditData && auditData.foreignCount === 0 && (
                    <p className="py-8 text-center text-slate-400 text-xs">
                      ไม่มีนักเรียนต่างชาติในเงื่อนไขการค้นหานี้
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>
                จัดรูปแบบ <strong>ExcelJS (.xlsx)</strong> มาตรฐาน สช. 8 หลัก พร้อมนำเข้า 100%
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={onClose}
                className="flex-1 sm:flex-initial px-4 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-xs sm:text-sm"
              >
                ปิดหน้าต่าง
              </button>
              <button
                onClick={handleDownload}
                disabled={isExporting || isLoadingAudit}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#7B1C3E] to-[#9B234F] hover:from-[#6A1835] hover:to-[#7B1C3E] text-white font-extrabold rounded-xl shadow-lg shadow-[#7B1C3E]/20 transition-all active:scale-95 disabled:opacity-50 text-xs sm:text-sm"
              >
                <Download className="w-4 h-4" />
                <span>{isExporting ? 'กำลังส่งออก...' : 'ดาวน์โหลดไฟล์ Excel สช. REGIS'}</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
