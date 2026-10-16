'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  HeartHandshake, 
  MapPin, 
  Home, 
  Users, 
  AlertTriangle, 
  CheckCircle2, 
  Save, 
  RefreshCw, 
  ChevronLeft, 
  Sparkles, 
  Printer, 
  Calendar, 
  FileText, 
  ShieldAlert, 
  ShieldCheck, 
  Search, 
  ExternalLink, 
  Compass, 
  PhoneCall, 
  Info,
  Layers,
  ChevronRight,
  Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  SDQ_QUESTIONS, 
  calculateSDQ, 
  compareTriangulatedSDQ, 
  EvaluatorType, 
  SDQEvaluationResult 
} from '@/lib/pastoral/sdq';
import { 
  LIVING_ENVIRONMENT_OPTIONS, 
  FAMILY_RELATIONSHIP_OPTIONS, 
  ECONOMIC_STATUS_OPTIONS, 
  STANDARD_RISK_FACTORS, 
  evaluateHomeVisitRisk, 
  synthesizeHomeVisitSummary, 
  validateThailandGPS,
  getGoogleMapsUrl,
  HomeVisitRecord
} from '@/lib/pastoral/home-visit';
import HomeVisitPrintModal from '@/components/pastoral/HomeVisitPrintModal';

interface StudentInfo {
  id: string;
  student_id?: string;
  name: string;
  grade: string;
  classroom?: string;
  status?: string;
}

export default function PastoralCarePage() {
  const [activeTab, setActiveTab] = useState<'sdq' | 'visit' | 'matrix'>('sdq');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [academicYear, setAcademicYear] = useState<string>('2568');
  const [term, setTerm] = useState<string>('1');
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // SDQ State
  const [evaluatorType, setEvaluatorType] = useState<EvaluatorType>('teacher');
  const [evaluatorName, setEvaluatorName] = useState<string>('ครูประจำชั้น');
  const [sdqAnswers, setSdqAnswers] = useState<Record<number, number>>({});
  const [currentSdqResult, setCurrentSdqResult] = useState<SDQEvaluationResult | null>(null);
  const [allSdqEvals, setAllSdqEvals] = useState<any[]>([]);
  const [triangulationData, setTriangulationData] = useState<any>(null);
  const [isSavingSdq, setIsSavingSdq] = useState<boolean>(false);

  // Home Visit State
  const [visitDate, setVisitDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [visitorTeacherName, setVisitorTeacherName] = useState<string>('ครูประจำชั้น');
  const [gpsLat, setGpsLat] = useState<number | undefined>(undefined);
  const [gpsLng, setGpsLng] = useState<number | undefined>(undefined);
  const [addressVisited, setAddressVisited] = useState<string>('');
  const [livingEnvironment, setLivingEnvironment] = useState<string>(LIVING_ENVIRONMENT_OPTIONS[0]);
  const [familyRelationship, setFamilyRelationship] = useState<string>(FAMILY_RELATIONSHIP_OPTIONS[0]);
  const [economicStatus, setEconomicStatus] = useState<string>(ECONOMIC_STATUS_OPTIONS[1]);
  const [selectedRisks, setSelectedRisks] = useState<string[]>([]);
  const [guardianMet, setGuardianMet] = useState<string>('บิดา-มารดา');
  const [audioTranscript, setAudioTranscript] = useState<string>('');
  const [aiSummary, setAiSummary] = useState<string>('');
  const [isSavingVisit, setIsSavingVisit] = useState<boolean>(false);
  const [allHomeVisits, setAllHomeVisits] = useState<any[]>([]);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  // Matrix Filter
  const [filterAtRiskOnly, setFilterAtRiskOnly] = useState<boolean>(false);

  // Load students & evaluations
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch SDQ data & students
      const sdqRes = await fetch(`/api/pastoral/sdq?grade=${selectedGrade}&academicYear=${academicYear}&term=${term}`);
      const sdqJson = await sdqRes.json();
      
      if (sdqRes.ok) {
        setStudents(sdqJson.students || []);
        setAllSdqEvals(sdqJson.evaluations || []);
        if (sdqJson.students?.length > 0 && !selectedStudentId) {
          setSelectedStudentId(sdqJson.students[0].id);
        }
      }

      // 2. Fetch Home Visits
      const visitRes = await fetch(`/api/pastoral/home-visit?grade=${selectedGrade}&academicYear=${academicYear}&term=${term}`);
      const visitJson = await visitRes.json();
      if (visitRes.ok) {
        setAllHomeVisits(visitJson.visits || []);
      }
    } catch (err) {
      console.error('Error fetching pastoral data:', err);
      toast.error('ไม่สามารถโหลดข้อมูลระบบดูแลช่วยเหลือนักเรียนได้');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedGrade, academicYear, term]);

  // When selected student or evaluator changes, load their SDQ answers & Triangulation
  useEffect(() => {
    if (!selectedStudentId) return;

    // Load student's specific SDQ evaluations
    const studentEvals = allSdqEvals.filter(e => e.student_id === selectedStudentId);
    const targetEval = studentEvals.find(e => e.evaluator_type === evaluatorType);

    if (targetEval && targetEval.answers) {
      setSdqAnswers(targetEval.answers);
      setEvaluatorName(targetEval.evaluator_name || 'ครูประจำชั้น');
    } else {
      // Initialize with default 0s
      const initial: Record<number, number> = {};
      SDQ_QUESTIONS.forEach(q => { initial[q.id] = 0; });
      setSdqAnswers(initial);
    }

    // Load Home Visit
    const currentVisit = allHomeVisits.find(v => v.student_id === selectedStudentId);
    if (currentVisit) {
      setVisitDate(currentVisit.visit_date || new Date().toISOString().split('T')[0]);
      setVisitorTeacherName(currentVisit.visitor_teacher_name || 'ครูประจำชั้น');
      setGpsLat(currentVisit.gps_lat ? Number(currentVisit.gps_lat) : undefined);
      setGpsLng(currentVisit.gps_lng ? Number(currentVisit.gps_lng) : undefined);
      setAddressVisited(currentVisit.address_visited || '');
      setLivingEnvironment(currentVisit.living_environment || LIVING_ENVIRONMENT_OPTIONS[0]);
      setFamilyRelationship(currentVisit.family_relationship || FAMILY_RELATIONSHIP_OPTIONS[0]);
      setEconomicStatus(currentVisit.economic_status || ECONOMIC_STATUS_OPTIONS[1]);
      setSelectedRisks(currentVisit.risk_issues || []);
      setGuardianMet(currentVisit.guardian_met || 'บิดา-มารดา');
      setAudioTranscript(currentVisit.audio_transcript || '');
      setAiSummary(currentVisit.ai_summary || '');
    } else {
      // Reset form
      setVisitDate(new Date().toISOString().split('T')[0]);
      setGpsLat(undefined);
      setGpsLng(undefined);
      setAddressVisited('');
      setLivingEnvironment(LIVING_ENVIRONMENT_OPTIONS[0]);
      setFamilyRelationship(FAMILY_RELATIONSHIP_OPTIONS[0]);
      setEconomicStatus(ECONOMIC_STATUS_OPTIONS[1]);
      setSelectedRisks([]);
      setGuardianMet('บิดา-มารดา');
      setAudioTranscript('');
      setAiSummary('');
    }

    // Compute triangulation
    const teacherEval = studentEvals.find(e => e.evaluator_type === 'teacher');
    const parentEval = studentEvals.find(e => e.evaluator_type === 'parent');
    const studentEval = studentEvals.find(e => e.evaluator_type === 'student');

    const tRes = teacherEval ? calculateSDQ(teacherEval.answers, 'teacher') : null;
    const pRes = parentEval ? calculateSDQ(parentEval.answers, 'parent') : null;
    const sRes = studentEval ? calculateSDQ(studentEval.answers, 'student') : null;

    setTriangulationData(compareTriangulatedSDQ(tRes, pRes, sRes));
  }, [selectedStudentId, evaluatorType, allSdqEvals, allHomeVisits]);

  // Recalculate SDQ live on answer change
  useEffect(() => {
    const res = calculateSDQ(sdqAnswers, evaluatorType);
    setCurrentSdqResult(res);
  }, [sdqAnswers, evaluatorType]);

  const handleAnswerChange = (questionId: number, value: number) => {
    setSdqAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSaveSdq = async () => {
    if (!selectedStudentId) {
      toast.error('กรุณาเลือกนักเรียน');
      return;
    }
    setIsSavingSdq(true);
    try {
      const res = await fetch('/api/pastoral/sdq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: selectedStudentId,
          evaluator_type: evaluatorType,
          evaluator_name: evaluatorName,
          academic_year: academicYear,
          term: term,
          answers: sdqAnswers
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save SDQ');

      toast.success('บันทึกผลการประเมิน SDQ เรียบร้อยแล้ว');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'บันทึก SDQ ล้มเหลว');
    } finally {
      setIsSavingSdq(false);
    }
  };

  const handleGetGps = () => {
    if (!navigator.geolocation) {
      toast.error('เบราว์เซอร์ไม่รองรับการดึงพิกัด GPS');
      return;
    }
    toast.info('กำลังตรวจหาพิกัด GPS จากอุปกรณ์...');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setGpsLat(lat);
        setGpsLng(lng);
        const check = validateThailandGPS(lat, lng);
        if (check.isValid) {
          toast.success(`จับพิกัดสำเร็จ: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        } else {
          toast.warning(`จับพิกัดได้แล้ว แต่ ${check.message}`);
        }
      },
      err => {
        console.error(err);
        toast.error('ไม่สามารถดึงพิกัดได้ (กรุณาอนุญาต Location Access)');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSynthesizeAiSummary = () => {
    const student = students.find(s => s.id === selectedStudentId);
    const summary = synthesizeHomeVisitSummary({
      studentName: student?.name || 'นักเรียน',
      guardianMet,
      livingEnvironment,
      familyRelationship,
      economicStatus,
      riskIssues: selectedRisks,
      rawNotesOrTranscript: audioTranscript
    });
    setAiSummary(summary);
    toast.success('น้องฟ้า AI เรียบเรียงสรุปการเยี่ยมบ้านสำเร็จ');
  };

  const handleSaveHomeVisit = async () => {
    if (!selectedStudentId) {
      toast.error('กรุณาเลือกนักเรียน');
      return;
    }
    setIsSavingVisit(true);
    try {
      const student = students.find(s => s.id === selectedStudentId);
      const res = await fetch('/api/pastoral/home-visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: selectedStudentId,
          student_name: student?.name,
          academic_year: academicYear,
          term: term,
          visit_date: visitDate,
          visitor_teacher_name: visitorTeacherName,
          gps_lat: gpsLat,
          gps_lng: gpsLng,
          address_visited: addressVisited,
          living_environment: livingEnvironment,
          family_relationship: familyRelationship,
          economic_status: economicStatus,
          risk_issues: selectedRisks,
          audio_transcript: audioTranscript,
          ai_summary: aiSummary,
          guardian_met: guardianMet,
          status: 'COMPLETED'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save Home Visit');

      toast.success('บันทึกข้อมูลการเยี่ยมบ้านเรียบร้อยแล้ว');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'บันทึกการเยี่ยมบ้านล้มเหลว');
    } finally {
      setIsSavingVisit(false);
    }
  };

  const selectedStudent = students.find(s => s.id === selectedStudentId) || null;
  const selectedVisitRecord: HomeVisitRecord | null = selectedStudent ? {
    studentId: selectedStudent.id,
    academicYear,
    term,
    visitDate,
    visitorTeacherName,
    gpsLat,
    gpsLng,
    addressVisited,
    livingEnvironment,
    familyRelationship,
    economicStatus,
    riskIssues: selectedRisks,
    audioTranscript,
    aiSummary,
    photos: [],
    guardianMet,
    status: 'COMPLETED'
  } : null;

  // Filter students for search
  const filteredStudents = students.filter(s => {
    const matchQuery = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                       (s.student_id && s.student_id.includes(searchQuery)) ||
                       s.id.includes(searchQuery);
    return matchQuery;
  });

  // Calculate overall statistics
  const totalStudents = students.length;
  const evaluatedCount = new Set(allSdqEvals.map(e => e.student_id)).size;
  const completedVisitsCount = allHomeVisits.length;
  const abnormalSdqCount = allSdqEvals.filter(e => e.evaluator_type === 'teacher' && e.total_status === 'abnormal').length;
  const criticalVisitCount = allHomeVisits.filter(v => (v.risk_issues || []).length >= 3).length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8 space-y-6">
      
      {/* Header & Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Link href="/admin/students" className="hover:text-[#7B1C3E] flex items-center gap-1 transition-colors">
              <ChevronLeft className="w-4 h-4" /> ทะเบียนนักเรียน
            </Link>
            <span>/</span>
            <span className="text-[#7B1C3E] dark:text-[#E23B72]">ระบบดูแลช่วยเหลือนักเรียน 360°</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-[#7B1C3E] to-[#9E1B46] text-white rounded-2xl shadow-md shadow-[#7B1C3E]/20">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Student Pastoral Care 360°
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                ประเมิน SDQ 25 ข้อมาตรฐานกรมสุขภาพจิต • เยี่ยมบ้านเคลื่อนที่พร้อม GPS & น้องฟ้า AI • ตารางเฝ้าระวังกลุ่มเสี่ยง
              </p>
            </div>
          </div>
        </div>

        {/* Global Selectors */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium">
            <span className="text-slate-500">ปีการศึกษา:</span>
            <select
              value={academicYear}
              onChange={e => setAcademicYear(e.target.value)}
              className="bg-transparent font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
            >
              <option value="2568">2568</option>
              <option value="2567">2567</option>
            </select>
            <span className="text-slate-400">|</span>
            <span className="text-slate-500">เทอม:</span>
            <select
              value={term}
              onChange={e => setTerm(e.target.value)}
              className="bg-transparent font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
            >
              <option value="1">1</option>
              <option value="2">2</option>
            </select>
          </div>

          <select
            value={selectedGrade}
            onChange={e => setSelectedGrade(e.target.value)}
            className="px-3.5 py-2 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#7B1C3E]"
          >
            <option value="all">ทุกระดับชั้น (All Classes)</option>
            <option value="อ.1">อนุบาล 1 (K.1)</option>
            <option value="อ.2">อนุบาล 2 (K.2)</option>
            <option value="อ.3">อนุบาล 3 (K.3)</option>
            <option value="ป.1">ประถมศึกษาปีที่ 1 (G.1)</option>
            <option value="ป.2">ประถมศึกษาปีที่ 2 (G.2)</option>
            <option value="ป.3">ประถมศึกษาปีที่ 3 (G.3)</option>
            <option value="ป.4">ประถมศึกษาปีที่ 4 (G.4)</option>
            <option value="ป.5">ประถมศึกษาปีที่ 5 (G.5)</option>
            <option value="ป.6">ประถมศึกษาปีที่ 6 (G.6)</option>
          </select>

          <button
            onClick={fetchData}
            disabled={isLoading}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-all"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Overview Statistics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium block">นักเรียนในชั้นเรียน</span>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              {totalStudents} <span className="text-xs font-normal text-slate-400">คน</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 rounded-xl">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium block">ประเมิน SDQ แล้ว</span>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              {evaluatedCount} <span className="text-xs font-normal text-slate-400">/ {totalStudents}</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded-xl">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium block">SDQ กลุ่มมีปัญหา/เสี่ยง</span>
            <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400">
              {abnormalSdqCount} <span className="text-xs font-normal text-slate-400">คน</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-xl">
            <Home className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium block">เยี่ยมบ้านแล้ว</span>
            <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {completedVisitsCount} <span className="text-xs font-normal text-slate-400">/ {totalStudents}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 sm:gap-4 overflow-x-auto hide-scrollbar">
        <button
          onClick={() => setActiveTab('sdq')}
          className={`flex items-center gap-2 pb-3 px-3 font-bold text-sm transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'sdq'
              ? 'border-[#7B1C3E] text-[#7B1C3E] dark:text-[#E23B72]'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" /> แบบประเมิน SDQ 25 ข้อ (Assessment Studio)
        </button>
        <button
          onClick={() => setActiveTab('visit')}
          className={`flex items-center gap-2 pb-3 px-3 font-bold text-sm transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'visit'
              ? 'border-[#7B1C3E] text-[#7B1C3E] dark:text-[#E23B72]'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Home className="w-4 h-4" /> เยี่ยมบ้านเคลื่อนที่ & GPS (Mobile Visit Studio)
        </button>
        <button
          onClick={() => setActiveTab('matrix')}
          className={`flex items-center gap-2 pb-3 px-3 font-bold text-sm transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'matrix'
              ? 'border-[#7B1C3E] text-[#7B1C3E] dark:text-[#E23B72]'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" /> เฝ้าระวังกลุ่มเสี่ยง & ส่งต่อ (Care Dashboard)
        </button>
      </div>

      {/* TAB 1: SDQ Assessment Studio */}
      {activeTab === 'sdq' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Student Selector Sidebar (4 Cols) */}
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 max-h-[820px] flex flex-col">
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base">
                รายชื่อนักเรียน ({filteredStudents.length})
              </h2>
            </div>
            
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหาชื่อ หรือ รหัสนักเรียน..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-[#7B1C3E]"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filteredStudents.map(student => {
                const isSelected = student.id === selectedStudentId;
                const studentEvals = allSdqEvals.filter(e => e.student_id === student.id);
                const teacherEval = studentEvals.find(e => e.evaluator_type === 'teacher');
                
                let statusBadge = (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    ยังไม่ประเมิน
                  </span>
                );

                if (teacherEval) {
                  if (teacherEval.total_status === 'abnormal') {
                    statusBadge = <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold">มีปัญหา</span>;
                  } else if (teacherEval.total_status === 'borderline') {
                    statusBadge = <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">เสี่ยง</span>;
                  } else {
                    statusBadge = <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">ปกติ</span>;
                  }
                }

                return (
                  <button
                    key={student.id}
                    onClick={() => setSelectedStudentId(student.id)}
                    className={`w-full text-left p-3 rounded-2xl transition-all flex items-center justify-between border ${
                      isSelected
                        ? 'bg-rose-50/50 dark:bg-rose-950/20 border-[#7B1C3E] text-slate-900 dark:text-white shadow-sm'
                        : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-xs sm:text-sm">{student.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {student.student_id || student.id} • {student.grade} {student.classroom ? `/${student.classroom}` : ''}
                      </div>
                    </div>
                    {statusBadge}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Questionnaire & Realtime Results (8 Cols) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Student & Evaluator Header Card */}
            {selectedStudent ? (
              <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div>
                    <span className="text-xs font-bold text-[#7B1C3E] dark:text-[#E23B72] uppercase tracking-wider">
                      นักเรียนที่กำลังประเมิน
                    </span>
                    <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                      {selectedStudent.name}
                    </h2>
                    <p className="text-xs text-slate-500">
                      รหัส: {selectedStudent.student_id || selectedStudent.id} • ชั้น {selectedStudent.grade} {selectedStudent.classroom ? `/${selectedStudent.classroom}` : ''}
                    </p>
                  </div>

                  {/* Evaluator Perspective Selector */}
                  <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <button
                      onClick={() => setEvaluatorType('teacher')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                        evaluatorType === 'teacher'
                          ? 'bg-[#7B1C3E] text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                      }`}
                    >
                      👨‍🏫 ครูประเมิน
                    </button>
                    <button
                      onClick={() => setEvaluatorType('parent')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                        evaluatorType === 'parent'
                          ? 'bg-[#7B1C3E] text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                      }`}
                    >
                      👨‍👩‍👧 ผู้ปกครอง
                    </button>
                    <button
                      onClick={() => setEvaluatorType('student')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                        evaluatorType === 'student'
                          ? 'bg-[#7B1C3E] text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                      }`}
                    >
                      🧑 นร.ประเมินตนเอง
                    </button>
                  </div>
                </div>

                {/* Live Scores Summary Strip */}
                {currentSdqResult && (
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-1 text-center">
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                      <span className="text-[10px] text-slate-500 block">1. อารมณ์</span>
                      <div className="font-extrabold text-sm">{currentSdqResult.emotional.score}/10</div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full inline-block mt-0.5 ${currentSdqResult.emotional.badgeColor}`}>
                        {currentSdqResult.emotional.statusLabel}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                      <span className="text-[10px] text-slate-500 block">2. ความประพฤติ</span>
                      <div className="font-extrabold text-sm">{currentSdqResult.conduct.score}/10</div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full inline-block mt-0.5 ${currentSdqResult.conduct.badgeColor}`}>
                        {currentSdqResult.conduct.statusLabel}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                      <span className="text-[10px] text-slate-500 block">3. อยู่ไม่นิ่ง</span>
                      <div className="font-extrabold text-sm">{currentSdqResult.hyperactivity.score}/10</div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full inline-block mt-0.5 ${currentSdqResult.hyperactivity.badgeColor}`}>
                        {currentSdqResult.hyperactivity.statusLabel}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                      <span className="text-[10px] text-slate-500 block">4. เพื่อน</span>
                      <div className="font-extrabold text-sm">{currentSdqResult.peer.score}/10</div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full inline-block mt-0.5 ${currentSdqResult.peer.badgeColor}`}>
                        {currentSdqResult.peer.statusLabel}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                      <span className="text-[10px] text-emerald-700 block">5. สังคม (จุดเด่น)</span>
                      <div className="font-extrabold text-sm text-emerald-800 dark:text-emerald-300">{currentSdqResult.prosocial.score}/10</div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full inline-block mt-0.5 ${currentSdqResult.prosocial.badgeColor}`}>
                        {currentSdqResult.prosocial.statusLabel}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800">
                      <span className="text-[10px] text-rose-700 font-bold block">รวมปัญหา</span>
                      <div className="font-black text-sm text-rose-800 dark:text-rose-300">{currentSdqResult.totalDifficulties.score}/40</div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full inline-block mt-0.5 ${currentSdqResult.totalDifficulties.badgeColor}`}>
                        {currentSdqResult.totalDifficulties.statusLabel}
                      </span>
                    </div>
                  </div>
                )}

                {/* Triangulation Discrepancy Note (if exists) */}
                {triangulationData && triangulationData.discrepancies?.length > 0 && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl text-xs space-y-1">
                    <div className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      ตรวจพบความขัดแย้งระหว่างมุมมองครูและผู้ปกครอง (Triangulation Alert):
                    </div>
                    {triangulationData.discrepancies.map((disc: string, idx: number) => (
                      <p key={idx} className="text-amber-700 dark:text-amber-400 pl-5">• {disc}</p>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {/* 25 Questions Form */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-extrabold text-slate-800 dark:text-white text-base">
                  แบบประเมิน SDQ 25 ข้อ (ฉบับมาตรฐาน)
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const allZero: Record<number, number> = {};
                      SDQ_QUESTIONS.forEach(q => { allZero[q.id] = 0; });
                      setSdqAnswers(allZero);
                      toast.info('รีเซ็ตคำตอบทั้งหมดเป็น ไม่จริง (0)');
                    }}
                    className="text-xs text-slate-500 hover:text-slate-800 underline"
                  >
                    ตั้งค่าทั้งหมดเป็น &quot;ไม่จริง (0)&quot;
                  </button>
                  <button
                    onClick={handleSaveSdq}
                    disabled={isSavingSdq}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#7B1C3E] hover:bg-[#681834] text-white font-bold rounded-xl shadow-md transition-all active:scale-95 text-xs sm:text-sm"
                  >
                    <Save className="w-4 h-4" />
                    {isSavingSdq ? 'กำลังบันทึก...' : 'บันทึกผลการประเมิน'}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {SDQ_QUESTIONS.map(q => {
                  const currentVal = sdqAnswers[q.id] ?? 0;
                  return (
                    <div
                      key={q.id}
                      className="p-3 sm:p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-300">
                            {q.id}
                          </span>
                          <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
                            {q.text}
                          </span>
                        </div>
                        {q.isReversed && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 pl-8 block">
                            * ข้อคำถามทางบวก (ระบบกลับคะแนนอัตโนมัติตามเกณฑ์กรมสุขภาพจิต)
                          </span>
                        )}
                      </div>

                      {/* 3 Choices: 0, 1, 2 */}
                      <div className="flex items-center gap-1.5 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleAnswerChange(q.id, 0)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                            currentVal === 0
                              ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-100 dark:text-slate-900 shadow-sm'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          ไม่จริง (0)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAnswerChange(q.id, 1)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                            currentVal === 1
                              ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          จริงบางครั้ง (1)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAnswerChange(q.id, 2)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                            currentVal === 2
                              ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          จริงแน่นอน (2)
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Action */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  onClick={handleSaveSdq}
                  disabled={isSavingSdq}
                  className="flex items-center gap-2 px-6 py-2.5 bg-[#7B1C3E] hover:bg-[#681834] text-white font-bold rounded-xl shadow-md transition-all active:scale-95 text-sm"
                >
                  <Save className="w-4 h-4" />
                  {isSavingSdq ? 'กำลังบันทึก...' : 'บันทึกผลการประเมิน SDQ'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* TAB 2: Mobile Home Visit Studio */}
      {activeTab === 'visit' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Student Selector Sidebar (4 Cols) */}
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 max-h-[820px] flex flex-col">
            <h2 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base">
              เลือกนักเรียนเพื่อบันทึกการเยี่ยมบ้าน
            </h2>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหาชื่อ หรือ รหัสนักเรียน..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-[#7B1C3E]"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filteredStudents.map(student => {
                const isSelected = student.id === selectedStudentId;
                const visitRecord = allHomeVisits.find(v => v.student_id === student.id);
                
                let visitBadge = (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800">
                    ยังไม่เยี่ยม
                  </span>
                );

                if (visitRecord) {
                  const risk = evaluateHomeVisitRisk(visitRecord.risk_issues || [], visitRecord.economic_status || '');
                  visitBadge = (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${risk.badgeColor}`}>
                      {risk.label.split(' ')[0]}
                    </span>
                  );
                }

                return (
                  <button
                    key={student.id}
                    onClick={() => setSelectedStudentId(student.id)}
                    className={`w-full text-left p-3 rounded-2xl transition-all flex items-center justify-between border ${
                      isSelected
                        ? 'bg-rose-50/50 dark:bg-rose-950/20 border-[#7B1C3E] text-slate-900 dark:text-white shadow-sm'
                        : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-xs sm:text-sm">{student.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {student.student_id || student.id} • {student.grade}
                      </div>
                    </div>
                    {visitBadge}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Mobile Home Visit Form (8 Cols) */}
          <div className="lg:col-span-8 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
                  บันทึกการเยี่ยมบ้านนักเรียน
                </span>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  {selectedStudent ? selectedStudent.name : 'กรุณาเลือกนักเรียน'}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPrintModalOpen(true)}
                  disabled={!selectedStudent}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold rounded-xl transition-all text-xs sm:text-sm"
                >
                  <Printer className="w-4 h-4" /> พิมพ์รายงานทางการ
                </button>
                <button
                  onClick={handleSaveHomeVisit}
                  disabled={isSavingVisit || !selectedStudent}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 text-xs sm:text-sm"
                >
                  <Save className="w-4 h-4" /> {isSavingVisit ? 'กำลังบันทึก...' : 'บันทึกการเยี่ยมบ้าน'}
                </button>
              </div>
            </div>

            {/* Visit Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  วันที่ออกตรวจเยี่ยม:
                </label>
                <input
                  type="date"
                  value={visitDate}
                  onChange={e => setVisitDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ครูผู้ตรวจเยี่ยมบ้าน:
                </label>
                <input
                  type="text"
                  value={visitorTeacherName}
                  onChange={e => setVisitorTeacherName(e.target.value)}
                  placeholder="ชื่อ - สกุล ครูประจำชั้น"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    พิกัด GPS ที่ตั้งบ้าน:
                  </label>
                  <button
                    type="button"
                    onClick={handleGetGps}
                    className="flex items-center gap-1 text-xs text-blue-600 font-bold hover:underline"
                  >
                    <Compass className="w-3.5 h-3.5" /> ดึงพิกัดจาก GPS อุปกรณ์ปัจจุบัน
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-rose-500" />
                    <input
                      type="text"
                      readOnly
                      value={gpsLat && gpsLng ? `${gpsLat.toFixed(6)}, ${gpsLng.toFixed(6)}` : 'ยังไม่ได้ระบุพิกัด GPS'}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-mono text-slate-800 dark:text-slate-200"
                    />
                  </div>
                  {gpsLat && gpsLng && (
                    <a
                      href={getGoogleMapsUrl(gpsLat, gpsLng) || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl border border-blue-200 text-xs font-bold flex items-center gap-1"
                    >
                      <ExternalLink className="w-4 h-4" /> ดูแผนที่
                    </a>
                  )}
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ที่อยู่ตามที่ตรวจเยี่ยม:
                </label>
                <input
                  type="text"
                  value={addressVisited}
                  onChange={e => setAddressVisited(e.target.value)}
                  placeholder="เลขที่ หมู่ ซอย ถนน ตำบล อำเภอ จังหวัด..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ผู้ปกครองที่ได้พบในการเยี่ยมบ้าน:
                </label>
                <input
                  type="text"
                  value={guardianMet}
                  onChange={e => setGuardianMet(e.target.value)}
                  placeholder="เช่น มารดา (นางสมใจ), ปู่ย่า"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  สภาพแวดล้อมที่พักอาศัย:
                </label>
                <select
                  value={livingEnvironment}
                  onChange={e => setLivingEnvironment(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-emerald-600"
                >
                  {LIVING_ENVIRONMENT_OPTIONS.map((opt, i) => (
                    <option key={i} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ความสัมพันธ์ในครอบครัว:
                </label>
                <select
                  value={familyRelationship}
                  onChange={e => setFamilyRelationship(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-emerald-600"
                >
                  {FAMILY_RELATIONSHIP_OPTIONS.map((opt, i) => (
                    <option key={i} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  สถานภาพทางเศรษฐกิจของครอบครัว:
                </label>
                <select
                  value={economicStatus}
                  onChange={e => setEconomicStatus(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-emerald-600"
                >
                  {ECONOMIC_STATUS_OPTIONS.map((opt, i) => (
                    <option key={i} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

            </div>

            {/* Risk Issues Checklist */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-xs sm:text-sm text-slate-800 dark:text-white flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-500" />
                  รายการตรวจสอบปัจจัยเสี่ยง (Risk Checklist):
                </span>
                {(() => {
                  const r = evaluateHomeVisitRisk(selectedRisks, economicStatus);
                  return (
                    <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${r.badgeColor}`}>
                      {r.label}
                    </span>
                  );
                })()}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {STANDARD_RISK_FACTORS.map((risk, idx) => {
                  const isChecked = selectedRisks.includes(risk);
                  return (
                    <label
                      key={idx}
                      className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all text-xs font-semibold ${
                        isChecked
                          ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-300 text-rose-900 dark:text-rose-300'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedRisks(prev => [...prev, risk]);
                          } else {
                            setSelectedRisks(prev => prev.filter(r => r !== risk));
                          }
                        }}
                        className="rounded text-rose-600 focus:ring-rose-500"
                      />
                      <span>{risk}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* AI Voice/Field Notes & Synthesis */}
            <div className="p-4 bg-indigo-50/40 dark:bg-indigo-950/20 rounded-2xl border border-indigo-200 dark:border-indigo-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span className="font-extrabold text-xs sm:text-sm text-indigo-950 dark:text-indigo-200">
                    บันทึกดิบภาคสนาม / บันทึกเสียงการสนทนา:
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSynthesizeAiSummary}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5" /> ให้น้องฟ้า AI เรียบเรียงสรุปรายงาน
                </button>
              </div>

              <textarea
                rows={2}
                value={audioTranscript}
                onChange={e => setAudioTranscript(e.target.value)}
                placeholder="พิมพ์ข้อความสรุปสั้นๆ เช่น ยายบอกว่าช่วงนี้น้องนอนดึกช่วยงานบ้านดี ขาดแคลนค่าเดินทาง..."
                className="w-full p-3 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-indigo-600"
              />

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ข้อความสรุปผลการเยี่ยมบ้านแบบทางการ (สำหรับลงรายงาน):
                </label>
                <textarea
                  rows={4}
                  value={aiSummary}
                  onChange={e => setAiSummary(e.target.value)}
                  placeholder="คลิก 'ให้น้องฟ้า AI เรียบเรียงสรุปรายงาน' หรือพิมพ์สรุปด้วยตนเองที่นี่..."
                  className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm leading-relaxed focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setIsPrintModalOpen(true)}
                disabled={!selectedStudent}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-white font-bold rounded-xl text-sm"
              >
                <Printer className="w-4 h-4" /> ดูตัวอย่างรายงานพิมพ์
              </button>
              <button
                onClick={handleSaveHomeVisit}
                disabled={isSavingVisit || !selectedStudent}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 text-sm"
              >
                <Save className="w-4 h-4" /> {isSavingVisit ? 'กำลังบันทึก...' : 'บันทึกการเยี่ยมบ้าน'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* TAB 3: Pastoral Care & Risk Referral Matrix */}
      {activeTab === 'matrix' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                ตารางเฝ้าระวังและส่งต่อนักเรียนกลุ่มเสี่ยง (Care & Referral Matrix)
              </h2>
              <p className="text-xs text-slate-500">
                ประมวลผลความเสี่ยงรอบด้านจากการประเมิน SDQ และการลงพื้นที่เยี่ยมบ้าน
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterAtRiskOnly}
                  onChange={e => setFilterAtRiskOnly(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500"
                />
                <span>แสดงเฉพาะนักเรียนกลุ่มเสี่ยง / มีปัญหา</span>
              </label>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3.5 font-bold">รหัส</th>
                  <th className="p-3.5 font-bold">ชื่อ - นามสกุล</th>
                  <th className="p-3.5 font-bold">ชั้น</th>
                  <th className="p-3.5 font-bold text-center">SDQ (ครู)</th>
                  <th className="p-3.5 font-bold text-center">SDQ (ผู้ปกครอง)</th>
                  <th className="p-3.5 font-bold text-center">สถานะเยี่ยมบ้าน</th>
                  <th className="p-3.5 font-bold">ปัจจัยเสี่ยงที่ตรวจพบ</th>
                  <th className="p-3.5 font-bold">การดูแลช่วยเหลือ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {students
                  .filter(student => {
                    if (!filterAtRiskOnly) return true;
                    const studentEvals = allSdqEvals.filter(e => e.student_id === student.id);
                    const teacherEval = studentEvals.find(e => e.evaluator_type === 'teacher');
                    const visitRecord = allHomeVisits.find(v => v.student_id === student.id);
                    const isSdqRisk = teacherEval && (teacherEval.total_status === 'abnormal' || teacherEval.total_status === 'borderline');
                    const isVisitRisk = visitRecord && (visitRecord.risk_issues?.length > 0 || (visitRecord.economic_status || '').includes('ยากจน'));
                    return isSdqRisk || isVisitRisk;
                  })
                  .map(student => {
                    const studentEvals = allSdqEvals.filter(e => e.student_id === student.id);
                    const teacherEval = studentEvals.find(e => e.evaluator_type === 'teacher');
                    const parentEval = studentEvals.find(e => e.evaluator_type === 'parent');
                    const visitRecord = allHomeVisits.find(v => v.student_id === student.id);

                    const getSdqBadge = (ev: any) => {
                      if (!ev) return <span className="text-slate-400 text-xs">-</span>;
                      if (ev.total_status === 'abnormal') {
                        return <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[11px]">มีปัญหา ({ev.total_difficulties_score})</span>;
                      }
                      if (ev.total_status === 'borderline') {
                        return <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[11px]">เสี่ยง ({ev.total_difficulties_score})</span>;
                      }
                      return <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">ปกติ ({ev.total_difficulties_score})</span>;
                    };

                    const visitRisk = visitRecord ? evaluateHomeVisitRisk(visitRecord.risk_issues || [], visitRecord.economic_status || '') : null;

                    return (
                      <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-3.5 font-mono text-slate-500">{student.student_id || student.id}</td>
                        <td className="p-3.5 font-bold text-slate-900 dark:text-white">{student.name}</td>
                        <td className="p-3.5">{student.grade}</td>
                        <td className="p-3.5 text-center">{getSdqBadge(teacherEval)}</td>
                        <td className="p-3.5 text-center">{getSdqBadge(parentEval)}</td>
                        <td className="p-3.5 text-center">
                          {visitRecord ? (
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] border ${visitRisk?.badgeColor}`}>
                              {visitRisk?.label.split(' ')[0]}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">ยังไม่เยี่ยม</span>
                          )}
                        </td>
                        <td className="p-3.5 max-w-xs truncate text-xs text-slate-600 dark:text-slate-300">
                          {visitRecord && visitRecord.risk_issues?.length > 0 ? (
                            visitRecord.risk_issues.join(', ')
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="p-3.5">
                          <button
                            onClick={() => {
                              setSelectedStudentId(student.id);
                              setActiveTab('sdq');
                            }}
                            className="text-xs font-bold text-[#7B1C3E] dark:text-[#E23B72] hover:underline flex items-center gap-1"
                          >
                            เปิดดูแล <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* Official Home Visit Printable Modal */}
      <HomeVisitPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        visit={selectedVisitRecord}
        student={selectedStudent}
      />

    </div>
  );
}
