'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  FileText, 
  Award, 
  FileSpreadsheet, 
  BookOpen, 
  Sliders, 
  ArrowLeft, 
  Sparkles, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Users
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  DocumentType, 
  PrintAlignmentProfile, 
  loadPrintProfile, 
  DEFAULT_PRINT_PROFILES 
} from '@/lib/academic/print-alignment';
import { PrintAlignmentModal } from '@/components/academic/PrintAlignmentModal';
import { PP1Viewer } from '@/components/academic/PP1Viewer';
import { PP2Viewer } from '@/components/academic/PP2Viewer';
import { PP3OrssTable } from '@/components/academic/PP3OrssTable';
import { PP6BookletViewer } from '@/components/academic/PP6BookletViewer';

export default function AcademicDocumentsPage() {
  const [activeTab, setActiveTab] = useState<'pp1' | 'pp2' | 'pp3' | 'pp6' | 'calibration'>('pp1');
  const [loading, setLoading] = useState(false);

  // Calibration state
  const [isCalibrationOpen, setIsCalibrationOpen] = useState(false);
  const [activeDocType, setActiveDocType] = useState<DocumentType>('PP1_FRONT');
  const [profiles, setProfiles] = useState<Record<DocumentType, PrintAlignmentProfile>>(DEFAULT_PRINT_PROFILES);

  // Student selection
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('10073');
  const [studentSearch, setStudentSearch] = useState<string>('');

  // Loaded document states
  const [pp1Data, setPp1Data] = useState<any | null>(null);
  const [pp2Data, setPp2Data] = useState<any | null>(null);
  const [pp3Summary, setPp3Summary] = useState<any | null>(null);
  const [pp6Report, setPp6Report] = useState<any | null>(null);

  // Load profiles on client mount
  useEffect(() => {
    const loadedProfiles: Record<DocumentType, PrintAlignmentProfile> = {
      PP1_FRONT: loadPrintProfile('PP1_FRONT'),
      PP1_BACK: loadPrintProfile('PP1_BACK'),
      PP2_CERTIFICATE: loadPrintProfile('PP2_CERTIFICATE'),
      PP3_ROSTER: loadPrintProfile('PP3_ROSTER'),
      PP6_BOOKLET: loadPrintProfile('PP6_BOOKLET'),
    };
    setProfiles(loadedProfiles);
    fetchStudentsList();
  }, []);

  const fetchStudentsList = async () => {
    try {
      const res = await fetch('/api/academic/documents/pp3?mode=data');
      const data = await res.json();
      if (data.success && data.summary?.records) {
        setStudents(data.summary.records);
        if (data.summary.records.length > 0 && !selectedStudentId) {
          setSelectedStudentId(data.summary.records[0].studentId);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch students list:', err);
    }
  };

  // Fetch document data whenever activeTab or selectedStudentId changes
  useEffect(() => {
    fetchActiveDocumentData();
  }, [activeTab, selectedStudentId]);

  const fetchActiveDocumentData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'pp1') {
        const res = await fetch(`/api/academic/documents/pp1?student_id=${selectedStudentId}`);
        const data = await res.json();
        if (data.success) setPp1Data(data.data);
      } else if (activeTab === 'pp2') {
        const res = await fetch(`/api/academic/documents/pp2?student_id=${selectedStudentId}`);
        const data = await res.json();
        if (data.success) setPp2Data(data.data);
      } else if (activeTab === 'pp3') {
        const res = await fetch('/api/academic/documents/pp3?mode=data');
        const data = await res.json();
        if (data.success) setPp3Summary(data.summary);
      } else if (activeTab === 'pp6') {
        const res = await fetch(`/api/academic/documents/pp6?student_id=${selectedStudentId}`);
        const data = await res.json();
        if (data.success) setPp6Report(data.report);
      }
    } catch (err) {
      toast.error('โหลดข้อมูลเอกสารล้มเหลว');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileChange = (newProfile: PrintAlignmentProfile) => {
    setProfiles(prev => ({
      ...prev,
      [newProfile.docType]: newProfile
    }));
  };

  const openCalibrationForDoc = (docType: DocumentType) => {
    setActiveDocType(docType);
    setIsCalibrationOpen(true);
  };

  const filteredStudents = students.filter(s => {
    if (!studentSearch) return true;
    const q = studentSearch.toLowerCase();
    return s.fullName.toLowerCase().includes(q) || s.studentId.includes(q);
  });

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      
      {/* Header Banner (Hidden during Print) */}
      <div className="no-print bg-white border-b border-slate-200 shadow-xs">
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
                  ศูนย์พิมพ์เอกสารหลักฐานการศึกษาควบคุม (MOE Controlled Documents)
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                <span>ระบบพิมพ์เอกสาร ปพ. ควบคุม & ส่งออก สช.</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl leading-relaxed">
                พิมพ์ ปพ.1, ปพ.2 บนกระดาษจริงตราครุฑดุนนูนด้วยระบบสอบเทียบมิลลิเมตร (Print Alignment Engine), จัดทำ ปพ.3 ส่ง ORSS สช. 1-Click, และออกเล่ม ปพ.6 ดิจิทัล 16 หน้า
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
                <Sparkles className="w-4 h-4 text-[#7B1C3E]" />
                <span>ถามน้องฟ้า AI งานทะเบียน</span>
              </button>
            </div>
          </div>

          {/* 5 Tab Navigation Bar */}
          <div className="flex items-center gap-2 mt-6 overflow-x-auto border-b border-slate-200 pb-px">
            <button
              onClick={() => setActiveTab('pp1')}
              className={`inline-flex items-center gap-2 px-4 py-3 border-b-2 font-bold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'pp1'
                  ? 'border-[#7B1C3E] text-[#7B1C3E]'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>ปพ.1 (ระเบียนแสดงผลการเรียน)</span>
            </button>

            <button
              onClick={() => setActiveTab('pp2')}
              className={`inline-flex items-center gap-2 px-4 py-3 border-b-2 font-bold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'pp2'
                  ? 'border-[#7B1C3E] text-[#7B1C3E]'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <Award className="w-4 h-4" />
              <span>ปพ.2 (ประกาศนียบัตร)</span>
            </button>

            <button
              onClick={() => setActiveTab('pp3')}
              className={`inline-flex items-center gap-2 px-4 py-3 border-b-2 font-bold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'pp3'
                  ? 'border-[#7B1C3E] text-[#7B1C3E]'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>ปพ.3 (รน.ช. ส่ง ORSS สช.)</span>
            </button>

            <button
              onClick={() => setActiveTab('pp6')}
              className={`inline-flex items-center gap-2 px-4 py-3 border-b-2 font-bold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'pp6'
                  ? 'border-[#7B1C3E] text-[#7B1C3E]'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>ปพ.6 ดิจิทัล (สมุดพก 16 หน้า)</span>
            </button>

            <button
              onClick={() => setActiveTab('calibration')}
              className={`inline-flex items-center gap-2 px-4 py-3 border-b-2 font-bold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'calibration'
                  ? 'border-[#7B1C3E] text-[#7B1C3E]'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>สถานีสอบเทียบพิกัดการพิมพ์</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">

        {/* Student Selector Bar (for PP1, PP2, PP6) */}
        {(activeTab === 'pp1' || activeTab === 'pp2' || activeTab === 'pp6') && (
          <div className="no-print bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                เลือกนักเรียน:
              </span>
              <div className="relative min-w-[240px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อหรือรหัส..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs focus:ring-1 focus:ring-[#7B1C3E]"
                />
              </div>

              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs font-medium focus:ring-1 focus:ring-[#7B1C3E]"
              >
                {filteredStudents.map(s => (
                  <option key={s.studentId} value={s.studentId}>
                    {s.studentId} - {s.fullName} (GPAX: {s.gpax.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchActiveDocumentData}
                disabled={loading}
                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                title="รีเฟรชข้อมูล"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {loading && (
          <div className="no-print p-12 text-center text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#7B1C3E] mb-2" />
            กำลังจัดเตรียมและคำนวณพิกัดเอกสาร...
          </div>
        )}

        {/* TAB 1: PP1 (TRANSCRIPT) */}
        {!loading && activeTab === 'pp1' && pp1Data && (
          <PP1Viewer
            data={pp1Data}
            profile={profiles.PP1_FRONT}
            onOpenCalibration={() => openCalibrationForDoc('PP1_FRONT')}
          />
        )}

        {/* TAB 2: PP2 (CERTIFICATE) */}
        {!loading && activeTab === 'pp2' && pp2Data && (
          <PP2Viewer
            data={pp2Data}
            profile={profiles.PP2_CERTIFICATE}
            onOpenCalibration={() => openCalibrationForDoc('PP2_CERTIFICATE')}
          />
        )}

        {/* TAB 3: PP3 (ORSS ROSTER) */}
        {!loading && activeTab === 'pp3' && pp3Summary && (
          <PP3OrssTable
            summary={pp3Summary}
            onRefresh={fetchActiveDocumentData}
          />
        )}

        {/* TAB 4: PP6 (DIGITAL 16-PAGE BOOKLET) */}
        {!loading && activeTab === 'pp6' && pp6Report && (
          <PP6BookletViewer
            report={pp6Report}
            onRefresh={fetchActiveDocumentData}
          />
        )}

        {/* TAB 5: CALIBRATION STATION OVERVIEW */}
        {activeTab === 'calibration' && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#7B1C3E]/10 flex items-center justify-center text-[#7B1C3E]">
                <Sliders className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  สถานีสอบเทียบและตั้งค่าพิกัดการพิมพ์ (Print Calibration Station)
                </h2>
                <p className="text-xs text-slate-500">
                  ระบบบันทึกค่าชดเชยการเลื่อนกระดาษแยกตามประเภทเอกสารและเครื่องพิมพ์ เพื่อป้องกันการพิมพ์ตกกรอบ 100%
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(profiles).map(([docKey, p]) => (
                <div key={docKey} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">{p.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      p.mode === 'OVERLAY' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'
                    }`}>
                      {p.mode}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-white dark:bg-slate-800 p-2 rounded-xl border">
                      <span className="text-[10px] text-slate-400">X-Offset</span>
                      <div className="font-mono font-bold text-[#7B1C3E]">{p.offsetXmm} มม.</div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-2 rounded-xl border">
                      <span className="text-[10px] text-slate-400">Y-Offset</span>
                      <div className="font-mono font-bold text-[#7B1C3E]">{p.offsetYmm} มม.</div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-2 rounded-xl border">
                      <span className="text-[10px] text-slate-400">Font Scale</span>
                      <div className="font-mono font-bold text-[#7B1C3E]">{p.fontScalePercent}%</div>
                    </div>
                  </div>
                  <button
                    onClick={() => openCalibrationForDoc(docKey as DocumentType)}
                    className="w-full py-2 bg-white dark:bg-slate-800 border border-slate-200 hover:border-[#7B1C3E] text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
                  >
                    ปรับแต่งพิกัดเอกสารนี้
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Calibration Modal */}
      <PrintAlignmentModal
        isOpen={isCalibrationOpen}
        onClose={() => setIsCalibrationOpen(false)}
        docType={activeDocType}
        currentProfile={profiles[activeDocType]}
        onProfileChange={handleProfileChange}
      />

    </div>
  );
}
