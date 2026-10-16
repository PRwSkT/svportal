'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  FileText, 
  Plus, 
  Printer, 
  Camera, 
  Upload, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  Layers, 
  Pin, 
  RefreshCw, 
  Database, 
  Search, 
  ArrowLeft,
  QrCode,
  Droplets,
  Edit3,
  X,
  FileSpreadsheet,
  ChevronUp,
  ChevronDown,
  CheckCheck,
  Award,
  Sliders,
  Trash2,
  Users,
  Check,
  FileDown
} from 'lucide-react';
import { toast } from 'sonner';
import { printDocumentViaSandbox, openDocumentPreviewInTab } from '@/lib/documents/print-service';

interface ExamItem {
  id: string;
  title: string;
  academic_year: string;
  term: string;
  exam_type: string;
  total_questions: number;
  max_score: number;
  duration_minutes: number;
  submissions_count: number;
  course?: {
    id: string;
    course_code: string;
    name_th: string;
    grade_level: string;
  };
  gradebook?: {
    id: string;
    class?: {
      name: string;
    };
  };
  sets?: Array<{
    id: string;
    set_name: string;
    answer_key: Record<string, string>;
  }>;
}

export default function AcademicExamsPage() {
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<any[]>([]);
  const [gradebooks, setGradebooks] = useState<any[]>([]);
  
  // Filters
  const [selectedTerm, setSelectedTerm] = useState('1');
  const [searchQuery, setSearchQuery] = useState('');

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState('');
  const [gradebookId, setGradebookId] = useState('');
  const [examType, setExamType] = useState('midterm');
  const [duration, setDuration] = useState(60);
  const [maxScore, setMaxScore] = useState(20);
  const [questions, setQuestions] = useState<any[]>([
    {
      question_number: 1,
      question_text: '5 + 7 มีค่าเท่ากับเท่าใด?',
      choice_a: '10',
      choice_b: '12',
      choice_c: '14',
      choice_d: '15',
      correct_choice: 'B',
      indicator_code: 'ค 1.1 ป.3/1',
      pin_choice_position: false
    },
    {
      question_number: 2,
      question_text: 'ข้อใดคือจำนวนคู่ทั้งหมด?',
      choice_a: '2, 4, 6',
      choice_b: '8, 10, 12',
      choice_c: '14, 16, 18',
      choice_d: 'ถูกทุกข้อ',
      correct_choice: 'D',
      indicator_code: 'ค 1.1 ป.3/2',
      pin_choice_position: true
    }
  ]);
  const [isAiDrafting, setIsAiDrafting] = useState(false);

  // Active Exam Modals
  const [activeExam, setActiveExam] = useState<any | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedPrintSet, setSelectedPrintSet] = useState('A');
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isRescoreModalOpen, setIsRescoreModalOpen] = useState(false);
  const [isWaterSpillModalOpen, setIsWaterSpillModalOpen] = useState(false);
  const [isSubmissionsDrawerOpen, setIsSubmissionsDrawerOpen] = useState(false);
  const [printDocType, setPrintDocType] = useState<'questions' | 'bubble_sheet'>('questions');
  const printSheetRef = useRef<HTMLDivElement>(null);

  // Answer Key Editor State
  const [editingAnswerKeySet, setEditingAnswerKeySet] = useState<'A' | 'B' | 'C'>('A');
  const [editableAnswerKeys, setEditableAnswerKeys] = useState<Record<string, string>>({});

  // Submissions state & Enrolled students for active exam
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
  const [selectedScanStudentId, setSelectedScanStudentId] = useState<string>('');
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  // Manual Override Form State
  const [overrideStudentId, setOverrideStudentId] = useState('');
  const [overrideSet, setOverrideSet] = useState('A');
  const [overrideAnswers, setOverrideAnswers] = useState<Record<string, string>>({});
  const [overrideReason, setOverrideReason] = useState('น้ำหกใส่กระดาษคำตอบ (ครูตรวจทานจากต้นฉบับเปียก)');

  useEffect(() => {
    fetchInitialData();
  }, [selectedTerm]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // 1. Fetch exams
      const res = await fetch(`/api/academic/exams?term=${selectedTerm}&academic_year=2568`);
      const data = await res.json();
      if (data.success) {
        setExams(data.exams || []);
      }

      // 2. Fetch courses
      const cRes = await fetch('/api/academic/courses?academic_year=2568');
      const cData = await cRes.json();
      if (cData.success) {
        setCourses(cData.courses || []);
        if (cData.courses.length > 0 && !courseId) {
          setCourseId(cData.courses[0].id);
        }
      }

      // 3. Fetch gradebooks
      const gRes = await fetch(`/api/academic/gradebooks?term=${selectedTerm}&academic_year=2568`);
      const gData = await gRes.json();
      if (gData.success) {
        setGradebooks(gData.gradebooks || []);
      }
    } catch (err) {
      console.error(err);
      toast.error('โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenExamDetails = async (exam: ExamItem) => {
    try {
      const res = await fetch(`/api/academic/exams/${exam.id}`);
      const data = await res.json();
      if (data.success) {
        setActiveExam(data);
        setSubmissions(data.submissions || []);
        const studentsList = data.enrolled_students || [];
        setEnrolledStudents(studentsList);
        if (studentsList.length > 0 && !overrideStudentId) {
          setOverrideStudentId(studentsList[0].id);
        }
        // Initialize answer keys from set A
        const setA = data.sets?.find((s: any) => s.set_name === 'A');
        if (setA?.answer_key) {
          setEditableAnswerKeys({ ...setA.answer_key });
        }
      }
    } catch (err) {
      toast.error('ไม่สามารถดึงข้อมูลข้อสอบได้');
    }
  };

  // Switch editing answer key set (A, B, C)
  const handleSelectEditingSet = (setName: 'A' | 'B' | 'C') => {
    setEditingAnswerKeySet(setName);
    const targetSet = activeExam?.sets?.find((s: any) => s.set_name === setName);
    if (targetSet?.answer_key) {
      setEditableAnswerKeys({ ...targetSet.answer_key });
    }
  };

  // Save updated answer key and re-score instantly
  const handleSaveAnswerKeyAndRescore = async () => {
    if (!activeExam) return;
    const toastId = toast.loading(`กำลังบันทึกเฉลยชุด ${editingAnswerKeySet} และคำนวณคะแนนใหม่...`);
    try {
      const res = await fetch(`/api/academic/exams/${activeExam.exam.id}/recalculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updated_sets: [
            {
              set_name: editingAnswerKeySet,
              answer_key: editableAnswerKeys
            }
          ]
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`อัปเดตเฉลยชุด ${editingAnswerKeySet} เรียบร้อย! คำนวณใหม่ ${data.recalculated_count} คน (${data.elapsed_ms}ms)`, { id: toastId });
        setIsRescoreModalOpen(false);
        await handleOpenExamDetails(activeExam.exam);
        fetchInitialData();
      } else {
        toast.error(data.error || 'คำนวณใหม่ไม่สำเร็จ', { id: toastId });
      }
    } catch (err) {
      toast.error('เกิดข้อผิดพลาดในการบันทึกเฉลย', { id: toastId });
    }
  };

  // Delete single student submission
  const handleDeleteSubmission = async (submissionId: string) => {
    if (!activeExam) return;
    if (!confirm('ยืนยันลบผลการสอบของนักเรียนท่านนี้เพื่อสแกนใหม่?')) return;
    try {
      const res = await fetch(`/api/academic/exams/${activeExam.exam.id}/submissions?submission_id=${submissionId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'ลบผลการสอบเรียบร้อยแล้ว');
        await handleOpenExamDetails(activeExam.exam);
        fetchInitialData();
      } else {
        toast.error(data.error || 'ลบไม่สำเร็จ');
      }
    } catch (err) {
      toast.error('เกิดข้อผิดพลาดในการลบ');
    }
  };

  // AI Question Drafter Handler
  const handleAiDraft = async () => {
    setIsAiDrafting(true);
    try {
      const selectedCourse = courses.find(c => c.id === courseId);
      const res = await fetch('/api/academic/exams/ai-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject_name: selectedCourse?.name_th || 'คณิตศาสตร์',
          grade_level: selectedCourse?.grade_level || 'P3',
          indicator_code: 'ค 1.1 ป.3/1',
          count: 5
        })
      });
      const data = await res.json();
      if (data.success && data.questions) {
        const nextNumber = questions.length + 1;
        const newQuestions = data.questions.map((q: any, i: number) => ({
          ...q,
          question_number: nextNumber + i,
          points: 1
        }));
        setQuestions([...questions, ...newQuestions]);
        toast.success(`น้องฟ้า AI ร่างข้อสอบเพิ่มสำเร็จ ${newQuestions.length} ข้อ`);
      }
    } catch (err) {
      toast.error('AI ร่างข้อสอบไม่สำเร็จ');
    } finally {
      setIsAiDrafting(false);
    }
  };

  const handleCreateExam = async () => {
    if (!title) {
      toast.error('กรุณาระบุชื่อการสอบ');
      return;
    }
    if (!courseId) {
      toast.error('กรุณาเลือกวิชา');
      return;
    }

    try {
      const res = await fetch('/api/academic/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          course_id: courseId,
          gradebook_id: gradebookId || null,
          academic_year: '2568',
          term: selectedTerm,
          exam_type: examType,
          total_questions: questions.length,
          max_score: maxScore,
          duration_minutes: duration,
          questions
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('สร้างข้อสอบและจัดชุด A, B, C สำเร็จแล้ว!');
        setIsCreateOpen(false);
        fetchInitialData();
      } else {
        toast.error(data.error || 'สร้างข้อสอบไม่สำเร็จ');
      }
    } catch (err) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  // 1-Second Retroactive Re-score
  const handleRetroactiveRescore = async (examId: string) => {
    const toastId = toast.loading('กำลังคำนวณคะแนนใหม่ทั้งสายชั้น...');
    try {
      const res = await fetch(`/api/academic/exams/${examId}/recalculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message, { id: toastId });
        if (activeExam) handleOpenExamDetails(activeExam.exam);
        fetchInitialData();
      } else {
        toast.error(data.error || 'คำนวณใหม่ไม่สำเร็จ', { id: toastId });
      }
    } catch (err) {
      toast.error('เกิดข้อผิดพลาด', { id: toastId });
    }
  };

  // Sync to Gradebook
  const handleSyncGradebook = async (examId: string) => {
    const toastId = toast.loading('กำลังซิงค์คะแนนเข้าเล่ม ปพ.5...');
    try {
      const res = await fetch(`/api/academic/exams/${examId}/sync-gradebook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message, { id: toastId });
      } else {
        toast.error(data.error || 'ซิงค์คะแนนไม่สำเร็จ', { id: toastId });
      }
    } catch (err) {
      toast.error('เกิดข้อผิดพลาดในการซิงค์', { id: toastId });
    }
  };

  // Manual Override Submit (Water Spill / Damaged Sheet)
  const handleSubmitManualOverride = async () => {
    if (!activeExam || !overrideStudentId) {
      toast.error('กรุณาเลือกนักเรียน');
      return;
    }
    const studentObj = enrolledStudents.find(s => s.id === overrideStudentId);
    const studentName = studentObj?.name || overrideStudentId;
    try {
      const res = await fetch(`/api/academic/exams/${activeExam.exam.id}/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: overrideStudentId,
          set_name: overrideSet,
          student_answers: overrideAnswers,
          is_damaged_or_spill: true,
          manual_override: true,
          override_reason: overrideReason,
          status: 'MANUAL_OVERRIDE'
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`บันทึกคะแนน ${studentName} (คะแนน: ${data.submission.total_score}/${activeExam.exam.max_score}) เรียบร้อยแล้ว`);
        setIsWaterSpillModalOpen(false);
        await handleOpenExamDetails(activeExam.exam);
        fetchInitialData();
      } else {
        toast.error(data.error || 'บันทึกไม่สำเร็จ');
      }
    } catch (err) {
      toast.error('เกิดข้อผิดพลาดในการบันทึก');
    }
  };

  // Camera Scan with Real Enrolled Students
  const handleSimulateCameraScan = async () => {
    if (!activeExam) return;
    const toastId = toast.loading('กำลังตรวจจับ QR Code และตำแหน่งกระดาษคำตอบ...');

    const candidateList = enrolledStudents.length > 0
      ? enrolledStudents
      : [{ id: '10053', name: 'เด็กชายสิปปวิชญ์ เบ้าทอง' }];

    const alreadyGradedIds = new Set(submissions.map(s => s.student_id));
    const targetStudent = selectedScanStudentId
      ? candidateList.find(s => s.id === selectedScanStudentId) || candidateList[0]
      : candidateList.find(s => !alreadyGradedIds.has(s.id)) || candidateList[0];

    const currentSet = selectedPrintSet || 'A';
    const setKey = activeExam.sets?.find((s: any) => s.set_name === currentSet)?.answer_key || {};
    const mockAnswers: Record<string, string> = {};
    Object.keys(setKey).forEach(k => {
      mockAnswers[k] = Math.random() > 0.15 ? setKey[k] : (setKey[k] === 'A' ? 'B' : 'A');
    });

    setTimeout(async () => {
      try {
        const res = await fetch(`/api/academic/exams/${activeExam.exam.id}/submissions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_id: targetStudent.id,
            set_name: currentSet,
            student_answers: mockAnswers,
            status: 'GRADED'
          })
        });
        const data = await res.json();
        if (data.success) {
          toast.success(`สแกนตรวจสำเร็จ! ${targetStudent.name} (ชุด ${currentSet}) ได้: ${data.submission.total_score}/${activeExam.exam.max_score} คะแนน`, { id: toastId });
          setIsScanModalOpen(false);
          await handleOpenExamDetails(activeExam.exam);
          fetchInitialData();
        } else {
          toast.error(data.error || 'สแกนไม่สำเร็จ', { id: toastId });
        }
      } catch (err) {
        toast.error('สแกนล้มเหลว', { id: toastId });
      }
    }, 800);
  };

  const filteredExams = exams.filter(e => {
    if (searchQuery && !e.title.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !e.course?.name_th.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const moveQuestion = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= questions.length) return;
    const updated = [...questions];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    updated.forEach((q, i) => {
      q.question_number = i + 1;
    });
    setQuestions(updated);
  };

  const totalExamsCount = filteredExams.length;
  const totalQuestionsSum = filteredExams.reduce((sum, e) => sum + (e.total_questions || 0), 0);
  const totalGradedSubmissions = filteredExams.reduce((sum, e) => sum + (e.submissions_count || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Link href="/academic" className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#7B1C3E]/10 text-[#7B1C3E] border border-[#7B1C3E]/20 hover:bg-[#7B1C3E]/20 transition-all inline-flex items-center gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5" />
                Somkid Academic Studio
              </Link>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs text-slate-500 font-medium">ระบบสอบกระดาษอัจฉริยะ (Paper-to-Digital Exam)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
              <span className="p-2 bg-[#7B1C3E]/10 text-[#7B1C3E] border border-[#7B1C3E]/20 rounded-xl">
                <FileText className="w-7 h-7" />
              </span>
              ระบบออกข้อสอบ A/B/C & สแกนตรวจ OMR
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm">
              ออกข้อสอบผูกตัวชี้วัด สพฐ., สลับข้อ/ช้อยส์ป้องกันการลอก, พิมพ์กระดาษคำตอบพร้อม QR และตรวจด้วยกล้องมือถือใน 1 วินาที
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#7B1C3E] hover:bg-[#631430] text-white rounded-2xl text-xs sm:text-sm font-bold shadow-md shadow-[#7B1C3E]/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>สร้างข้อสอบใหม่</span>
            </button>
          </div>
        </div>

        {/* Quick Metrics Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#7B1C3E]/10 flex items-center justify-center text-[#7B1C3E] shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">ชุดข้อสอบทั้งหมด</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{totalExamsCount}</h3>
              <p className="text-[11px] text-slate-400">ในภาคเรียนนี้</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/40 flex items-center justify-center text-purple-600 shrink-0">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">จำนวนข้อสอบรวม</p>
              <h3 className="text-2xl font-bold text-purple-600 dark:text-purple-400">{totalQuestionsSum}</h3>
              <p className="text-[11px] text-slate-400">ข้อสอบทุกวิชา</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 shrink-0">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">ตรวจผ่านกล้องแล้ว</p>
              <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{totalGradedSubmissions}</h3>
              <p className="text-[11px] text-slate-400">แผ่นคำตอบ</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">ปีการศึกษา / เทอม</p>
              <h3 className="text-2xl font-bold text-blue-600 dark:text-blue-400">{selectedTerm}/2568</h3>
              <p className="text-[11px] text-slate-400">ภาคเรียนที่เลือก</p>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
              <button
                onClick={() => setSelectedTerm('1')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  selectedTerm === '1' 
                    ? 'bg-white text-[#7B1C3E] shadow-sm font-bold' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ภาคเรียนที่ 1
              </button>
              <button
                onClick={() => setSelectedTerm('2')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  selectedTerm === '2' 
                    ? 'bg-white text-[#7B1C3E] shadow-sm font-bold' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ภาคเรียนที่ 2
              </button>
            </div>
          </div>

          <div className="relative min-w-[260px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="ค้นหาชื่อการสอบ / รหัสวิชา..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Exam Cards Grid */}
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
            กำลังโหลดข้อมูลการสอบ...
          </div>
        ) : filteredExams.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-dashed border-slate-300 dark:border-slate-800">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">ยังไม่มีรายการข้อสอบในเทอมนี้</h3>
            <p className="text-slate-500 text-sm mt-1">กดปุ่ม "สร้างข้อสอบใหม่" ด้านบนเพื่อเริ่มร่างข้อสอบหรือให้น้องฟ้า AI ช่วยออกข้อสอบ</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredExams.map((exam) => (
              <div 
                key={exam.id}
                className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600">
                      {exam.course?.course_code || 'วิชา'} • ชั้น {exam.course?.grade_level || ''}
                    </span>
                    <span className="text-xs text-slate-500">
                      {exam.exam_type === 'midterm' ? 'กลางภาค' : 'ปลายภาค'}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                    {exam.title}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {exam.course?.name_th}
                  </p>

                  <div className="grid grid-cols-3 gap-2 pt-2 text-center text-xs">
                    <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-xl">
                      <div className="font-semibold text-slate-900 dark:text-white">{exam.total_questions}</div>
                      <div className="text-slate-500">จำนวนข้อ</div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-xl">
                      <div className="font-semibold text-slate-900 dark:text-white">{exam.max_score}</div>
                      <div className="text-slate-500">คะแนนเต็ม</div>
                    </div>
                    <div 
                      onClick={async () => {
                        await handleOpenExamDetails(exam);
                        setIsSubmissionsDrawerOpen(true);
                      }}
                      className="bg-slate-50 dark:bg-slate-800 p-2 rounded-xl cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors border border-transparent hover:border-emerald-300"
                      title="คลิกเพื่อดูรายชื่อนักเรียนและคะแนนที่ตรวจแล้ว"
                    >
                      <div className="font-semibold text-emerald-600 flex items-center justify-center gap-1">
                        <span>{exam.submissions_count}</span>
                        <Search className="w-3 h-3 text-emerald-600" />
                      </div>
                      <div className="text-slate-500">ตรวจแล้ว (คน)</div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={async () => {
                        await handleOpenExamDetails(exam);
                        setIsScanModalOpen(true);
                      }}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-medium transition shadow-sm cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" /> สแกนตรวจ OMR
                    </button>
                    <button
                      onClick={async () => {
                        await handleOpenExamDetails(exam);
                        setIsPrintModalOpen(true);
                      }}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-medium transition cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" /> พิมพ์กระดาษ
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1 gap-1 flex-wrap">
                    <button
                      onClick={async () => {
                        await handleOpenExamDetails(exam);
                        setIsRescoreModalOpen(true);
                      }}
                      className="text-xs text-purple-600 hover:text-purple-700 font-semibold flex items-center gap-1 cursor-pointer"
                      title="เปิดหน้าต่างแก้ไขเฉลยคำตอบชุด A/B/C"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> แก้ไขเฉลย
                    </button>
                    <button
                      onClick={() => handleRetroactiveRescore(exam.id)}
                      className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
                      title="คำนวณคะแนนใหม่ทั้งสายชั้นใน 1 วินาทีเมื่อแก้ไขเฉลย"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> คำนวณใหม่ 1 วิ
                    </button>
                    <button
                      onClick={() => handleSyncGradebook(exam.id)}
                      className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1 cursor-pointer"
                      title="ซิงค์คะแนนเข้าเล่ม ปพ.5 ทันที"
                    >
                      <Database className="w-3.5 h-3.5" /> ซิงค์เข้า ปพ.5
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CREATE EXAM MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full p-6 space-y-6 shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">สร้างข้อสอบใหม่ & จัดชุดอัตโนมัติ</h2>
                <p className="text-xs text-slate-500">ระบบจะสร้างชุด A, B, C สลับข้อ/ช้อยส์ และล็อกตำแหน่งตัวเลือกพิเศษให้อัตโนมัติ</p>
              </div>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">ชื่อการสอบ *</label>
                <input
                  type="text"
                  placeholder="เช่น ข้อสอบวัดผลกลางภาคเรียนที่ 1/2568"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">รายวิชา *</label>
                <select
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-sm"
                >
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.course_code} - {c.name_th} ({c.grade_level})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">ประเภทการสอบ</label>
                <select
                  value={examType}
                  onChange={(e) => setExamType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-sm"
                >
                  <option value="midterm">สอบกลางภาค (Midterm)</option>
                  <option value="final">สอบปลายภาค (Final)</option>
                  <option value="unit_test">สอบท้ายหน่วย (Unit Test)</option>
                  <option value="quiz">แบบทดสอบย่อย (Quiz)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">เล่ม ปพ.5 ที่เชื่อมโยง</label>
                <select
                  value={gradebookId}
                  onChange={(e) => setGradebookId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-sm"
                >
                  <option value="">-- ไม่ระบุ (เลือกภายหลังได้) --</option>
                  {gradebooks.map(gb => (
                    <option key={gb.id} value={gb.id}>
                      ห้อง {gb.class?.name} - {gb.course?.name_th}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">คะแนนเต็ม</label>
                <input
                  type="number"
                  value={maxScore}
                  onChange={(e) => setMaxScore(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">เวลาในการสอบ (นาที)</label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-sm"
                />
              </div>
            </div>

            {/* Questions Section */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    รายการข้อสอบ ({questions.length} ข้อ)
                  </h3>
                  <p className="text-xs text-slate-500">สามารถเพิ่มข้อสอบด้วยตนเอง หรือให้น้องฟ้า AI ช่วยร่างตามตัวชี้วัด สพฐ.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAiDraft}
                    disabled={isAiDrafting}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-linear-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-xs font-medium shadow-xs disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {isAiDrafting ? 'น้องฟ้ากำลังร่างข้อสอบ...' : 'น้องฟ้าช่วยออกข้อสอบ'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = questions.length + 1;
                      setQuestions([
                        ...questions,
                        {
                          question_number: next,
                          question_text: `ข้อที่ ${next}`,
                          choice_a: 'ตัวเลือก ก',
                          choice_b: 'ตัวเลือก ข',
                          choice_c: 'ตัวเลือก ค',
                          choice_d: 'ตัวเลือก ง',
                          correct_choice: 'A',
                          indicator_code: '',
                          pin_choice_position: false
                        }
                      ]);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" /> เพิ่มข้อ
                  </button>
                </div>
              </div>

              {/* Questions List */}
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {questions.map((q, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#7B1C3E]">ข้อที่ {idx + 1}</span>
                        <div className="flex items-center bg-slate-200/80 dark:bg-slate-700 rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() => moveQuestion(idx, -1)}
                            disabled={idx === 0}
                            title="สลับขึ้น"
                            className="p-1 text-slate-600 dark:text-slate-300 hover:text-[#7B1C3E] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveQuestion(idx, 1)}
                            disabled={idx === questions.length - 1}
                            title="สลับลง"
                            className="p-1 text-slate-600 dark:text-slate-300 hover:text-[#7B1C3E] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                          <span>คะแนน:</span>
                          <input
                            type="number"
                            step="0.5"
                            min="0.5"
                            value={q.points || 1}
                            onChange={(e) => {
                              const updated = [...questions];
                              updated[idx].points = parseFloat(e.target.value) || 1;
                              setQuestions(updated);
                            }}
                            className="w-12 px-1.5 py-0.5 text-center bg-white dark:bg-slate-900 border rounded text-xs font-semibold"
                          />
                        </div>
                        <label className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-1 rounded-lg border border-amber-200 dark:border-amber-900 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={q.pin_choice_position}
                            onChange={(e) => {
                              const updated = [...questions];
                              updated[idx].pin_choice_position = e.target.checked;
                              setQuestions(updated);
                            }}
                            className="rounded text-amber-600"
                          />
                          <Pin className="w-3 h-3" /> ล็อกช้อยส์ ง (เช่น ถูกทุกข้อ)
                        </label>
                        <button
                          type="button"
                          onClick={() => setQuestions(questions.filter((_, i) => i !== idx))}
                          className="text-red-500 hover:text-red-700 text-xs cursor-pointer px-1"
                        >
                          ลบ
                        </button>
                      </div>
                    </div>

                    <input
                      type="text"
                      placeholder="โจทย์ข้อสอบ..."
                      value={q.question_text}
                      onChange={(e) => {
                        const updated = [...questions];
                        updated[idx].question_text = e.target.value;
                        setQuestions(updated);
                      }}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border rounded-lg text-sm"
                    />

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {(['A', 'B', 'C', 'D'] as const).map(choiceKey => (
                        <div key={choiceKey} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`correct-${idx}`}
                            checked={q.correct_choice === choiceKey}
                            onChange={() => {
                              const updated = [...questions];
                              updated[idx].correct_choice = choiceKey;
                              setQuestions(updated);
                            }}
                            className="text-indigo-600"
                          />
                          <span className="font-bold text-slate-500">{choiceKey}:</span>
                          <input
                            type="text"
                            value={q[`choice_${choiceKey.toLowerCase()}`]}
                            onChange={(e) => {
                              const updated = [...questions];
                              updated[idx][`choice_${choiceKey.toLowerCase()}`] = e.target.value;
                              setQuestions(updated);
                            }}
                            className="flex-1 px-2 py-1 bg-white dark:bg-slate-900 border rounded text-xs"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-4 py-2 border rounded-xl text-sm font-medium text-slate-600"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleCreateExam}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-md"
              >
                บันทึกและสลับชุด A, B, C
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT MODAL (2-Column Exam & QR Bubble Sheet Preview) */}
      {isPrintModalOpen && activeExam && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full p-6 space-y-6 shadow-2xl my-6 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Printer className="w-5 h-5 text-indigo-600" /> พิมพ์แบบทดสอบ & กระดาษคำตอบ OMR
                </h2>
                <p className="text-xs text-slate-500">พิมพ์ข้อสอบ 2 คอลัมน์แยกชุด และกระดาษคำตอบ OMR พร้อม QR Code ประจำตัว</p>
              </div>
              <button onClick={() => setIsPrintModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Document Type Selector & Set Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">รูปแบบเอกสาร:</span>
                <div className="flex bg-white dark:bg-slate-900 rounded-xl p-1 border shadow-xs">
                  <button
                    type="button"
                    onClick={() => setPrintDocType('questions')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      printDocType === 'questions'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                    }`}
                  >
                    ข้อสอบ 2 คอลัมน์
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintDocType('bubble_sheet')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      printDocType === 'bubble_sheet'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                    }`}
                  >
                    กระดาษคำตอบ OMR
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">ชุดข้อสอบ:</span>
                <div className="flex gap-1.5">
                  {(['A', 'B', 'C'] as const).map(setName => (
                    <button
                      key={setName}
                      type="button"
                      onClick={() => setSelectedPrintSet(setName)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                        selectedPrintSet === setName
                          ? 'bg-[#7B1C3E] text-white border-[#7B1C3E]'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      ชุด {setName}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Printable Preview Sheet */}
            <div className="flex-1 overflow-y-auto border rounded-2xl p-6 bg-slate-100 dark:bg-slate-950 flex justify-center">
              <div ref={printSheetRef} className="w-full max-w-2xl bg-white text-slate-900 p-8 rounded-xl shadow-lg border border-slate-300 text-sm font-sans space-y-4">
                {printDocType === 'questions' ? (
                  <div>
                    {/* Header */}
                    <div className="text-center border-b pb-4 space-y-1">
                      <div className="font-bold text-base text-slate-900">โรงเรียนสมคิดวิทยา</div>
                      <div className="font-bold text-sm text-[#7B1C3E]">{activeExam.exam.title}</div>
                      <div className="text-xs text-slate-600 flex justify-center gap-4">
                        <span>วิชา: {activeExam.exam.course?.name_th} ({activeExam.exam.course?.course_code})</span>
                        <span>ระดับชั้น: {activeExam.exam.course?.grade_level || 'ป.3'}</span>
                        <span className="font-bold text-[#7B1C3E]">ชุด {selectedPrintSet}</span>
                      </div>
                      <div className="text-xs text-slate-500 flex justify-center gap-4">
                        <span>คะแนนเต็ม: {activeExam.exam.max_score} คะแนน</span>
                        <span>เวลาสอบ: {activeExam.exam.duration_minutes} นาที</span>
                        <span>จำนวน: {activeExam.exam.total_questions} ข้อ</span>
                      </div>
                      <p className="text-[11px] text-slate-600 pt-2 italic">
                        คำชี้แจง: ให้นักเรียนเลือกคำตอบที่ถูกต้องที่สุดเพียงข้อเดียว แล้วใช้ดินสอ 2B ฝนลงในกระดาษคำตอบ OMR ให้เต็มวง
                      </p>
                    </div>

                    {/* 2-Column Questions */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 pt-4 text-xs">
                      {(() => {
                        const baseQuestions = activeExam.questions || activeExam.exam?.questions || questions || [];
                        const variantSets = activeExam.variant_sets || activeExam.exam?.variant_sets || [];
                        const currentVariant = variantSets.find((vs: any) => vs.set_name === selectedPrintSet);
                        
                        let orderedQuestions = baseQuestions;
                        if (currentVariant?.question_order_mapping && Array.isArray(currentVariant.question_order_mapping)) {
                          orderedQuestions = currentVariant.question_order_mapping
                            .map((origIdx: number) => baseQuestions[origIdx])
                            .filter(Boolean);
                          if (orderedQuestions.length === 0) orderedQuestions = baseQuestions;
                        }

                        return orderedQuestions.map((q: any, idx: number) => {
                          const origIdx = baseQuestions.indexOf(q);
                          const choiceMap = currentVariant?.choice_map?.[origIdx] || { A: 'A', B: 'B', C: 'C', D: 'D' };
                          const getChoice = (letter: string) => {
                            const mappedLetter = (choiceMap[letter] || letter).toLowerCase();
                            return q[`choice_${mappedLetter}`] || q[`choice_${letter.toLowerCase()}`];
                          };

                          return (
                            <div key={idx} className="space-y-1 p-2 rounded-lg bg-slate-50 border border-slate-100 break-inside-avoid">
                              <div className="font-bold text-slate-900">
                                {idx + 1}. {q.question_text || `โจทย์ข้อที่ ${idx + 1}`}
                              </div>
                              <div className="grid grid-cols-2 gap-1 text-slate-700 pl-2">
                                <div>ก. {getChoice('A') || 'ตัวเลือก ก'}</div>
                                <div>ข. {getChoice('B') || 'ตัวเลือก ข'}</div>
                                <div>ค. {getChoice('C') || 'ตัวเลือก ค'}</div>
                                <div>ง. {getChoice('D') || 'ตัวเลือก ง'}</div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* Bubble Sheet Header */}
                    <div className="border-b-2 border-slate-900 pb-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-base text-slate-900">โรงเรียนสมคิดวิทยา</div>
                          <div className="text-xs font-semibold text-slate-700">กระดาษคำตอบแบบวัดผล (OMR Answer Sheet)</div>
                          <div className="text-xs text-slate-500">{activeExam.exam.title} - {activeExam.exam.course?.name_th}</div>
                        </div>
                        <div className="text-right">
                          <div className="inline-block px-3 py-1 bg-[#7B1C3E] text-white rounded font-bold text-sm">
                            ชุด {selectedPrintSet}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1">รหัสการสอบ: {activeExam.exam.id.slice(0, 8)}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs pt-2 bg-slate-50 p-2.5 rounded-lg border">
                        <div>ชื่อ-นามสกุล: <span className="font-semibold text-slate-900">เด็กชายสิปปวิชญ์ เบ้าทอง</span></div>
                        <div>รหัสประจำตัว: <span className="font-semibold text-slate-900">10053</span></div>
                        <div>ชั้น: <span className="font-semibold text-slate-900">{activeExam.exam.course?.grade_level || 'ป.3/1'}</span></div>
                      </div>
                    </div>

                    {/* QR Code & OMR Grid Instructions */}
                    <div className="flex items-center justify-between py-3 border-b text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <QrCode className="w-10 h-10 text-slate-900 p-1 border rounded bg-slate-50" />
                        <div>
                          <div className="font-bold text-slate-900">รหัสตรวจสอบประจำตัวสอบ</div>
                          <div className="text-[10px] text-slate-500">EXAM-{activeExam.exam.id.slice(0, 6)}-SET-{selectedPrintSet}-10053</div>
                        </div>
                      </div>
                      <div className="text-right text-[11px] text-slate-500">
                        วิธีฝน: ใช้ดินสอ 2B ฝนให้ดำเข้มเต็มวงกลม (A) (B) (C) (D)
                      </div>
                    </div>

                    {/* Bubble Grid */}
                    <div className="pt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      {Array.from({ length: activeExam.exam.total_questions || 10 }).map((_, i) => (
                        <div key={i} className="flex items-center justify-between p-1.5 border rounded-md bg-slate-50">
                          <span className="font-bold text-slate-700 w-6 text-right mr-1">{i + 1}.</span>
                          <div className="flex gap-1.5">
                            {['A', 'B', 'C', 'D'].map(choice => (
                              <span
                                key={choice}
                                className="w-5 h-5 rounded-full border border-slate-400 flex items-center justify-center text-[10px] font-bold text-slate-600 hover:bg-slate-200"
                              >
                                {choice}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <button
                type="button"
                onClick={() => {
                  setIsPrintModalOpen(false);
                  setIsWaterSpillModalOpen(true);
                }}
                className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1 font-medium cursor-pointer"
              >
                <Droplets className="w-4 h-4" /> สลับไปโหมดคีย์แทนฉุกเฉิน (กระดาษเปียก)
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (printSheetRef.current && activeExam) {
                      openDocumentPreviewInTab({
                        title: `แบบทดสอบ_${activeExam.exam.title}_ชุด_${selectedPrintSet}`,
                        paperSize: 'A4_PORTRAIT',
                        contentHtml: printSheetRef.current.innerHTML
                      });
                    }
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <FileDown className="w-4 h-4" /> บันทึก PDF
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (printSheetRef.current && activeExam) {
                      await printDocumentViaSandbox({
                        title: `แบบทดสอบ_${activeExam.exam.title}_ชุด_${selectedPrintSet}`,
                        paperSize: 'A4_PORTRAIT',
                        contentHtml: printSheetRef.current.innerHTML
                      });
                      toast.success('ส่งคำสั่งพิมพ์เอกสารไปยังเครื่องพิมพ์เรียบร้อยแล้ว');
                    }
                  }}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> สั่งพิมพ์ (Print)
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="px-4 py-2 border rounded-xl text-sm cursor-pointer"
                >
                  ปิด
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OMR SCANNER MODAL (Camera & Real Student Queue) */}
      {isScanModalOpen && activeExam && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Camera className="w-6 h-6 text-emerald-600" /> สแกนตรวจกระดาษคำตอบ OMR
                </h2>
                <p className="text-xs text-slate-500">ส่องตรวจผ่านกล้อง (1 วินาที/ใบ) หรือเลือกรายชื่อนักเรียนเพื่อจับภาพ</p>
              </div>
              <button onClick={() => setIsScanModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Target Student Queue Selector */}
            <div className="space-y-1.5 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  นักเรียนในคิวตรวจ ({submissions.length}/{enrolledStudents.length || submissions.length} คนตรวจแล้ว):
                </label>
                <span className="text-[11px] text-indigo-600 dark:text-indigo-400">
                  {selectedScanStudentId ? 'ระบุรายคน' : 'ระบบเลือกคนถัดไปอัตโนมัติ'}
                </span>
              </div>
              <select
                value={selectedScanStudentId}
                onChange={(e) => setSelectedScanStudentId(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl text-sm font-medium"
              >
                <option value="">-- อัตโนมัติ: อ่านรหัสจาก QR Code หรือเลือกคนถัดไปที่ยังไม่ตรวจ --</option>
                {enrolledStudents.map(student => {
                  const isGraded = submissions.some(s => s.student_id === student.id);
                  return (
                    <option key={student.id} value={student.id}>
                      {student.student_id ? `${student.student_id} - ` : ''}{student.name} ({student.grade_level || 'ป.3'}) {isGraded ? '[ตรวจแล้ว]' : '[รอตรวจ]'}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Camera Viewfinder Mock */}
            <div className="relative bg-slate-950 rounded-2xl h-60 flex flex-col items-center justify-center border-2 border-dashed border-emerald-500/50 overflow-hidden">
              <div className="absolute inset-4 border-2 border-emerald-400/40 rounded-xl pointer-events-none flex flex-col justify-between p-2">
                <div className="flex justify-between">
                  <div className="w-6 h-6 border-t-2 border-l-2 border-emerald-400" />
                  <div className="w-6 h-6 border-t-2 border-r-2 border-emerald-400" />
                </div>
                <div className="flex justify-between">
                  <div className="w-6 h-6 border-b-2 border-l-2 border-emerald-400" />
                  <div className="w-6 h-6 border-b-2 border-r-2 border-emerald-400" />
                </div>
              </div>

              <QrCode className="w-14 h-14 text-emerald-400/80 mb-2 animate-pulse" />
              <p className="text-emerald-200 text-sm font-medium">วางกระดาษคำตอบให้อยู่ในกรอบ 4 มุม</p>
              <p className="text-xs text-slate-400 mt-1">ระบบจะอ่าน QR Code ตรวจสอบชุด A, B, C และคำนวณคะแนน</p>
            </div>

            <div className="flex items-center justify-between gap-4 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsScanModalOpen(false);
                  setIsWaterSpillModalOpen(true);
                }}
                className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 font-medium cursor-pointer"
              >
                <Droplets className="w-4 h-4" /> กระดาษเปียกน้ำ / ฉีกขาด (โหมดคีย์แทน)
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsScanModalOpen(false)}
                  className="px-4 py-2 border rounded-xl text-sm cursor-pointer"
                >
                  ปิด
                </button>
                <button
                  type="button"
                  onClick={handleSimulateCameraScan}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <Camera className="w-4 h-4" /> จับภาพ & บันทึกคะแนน (Capture)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WATER SPILL / MANUAL OVERRIDE MODAL */}
      {isWaterSpillModalOpen && activeExam && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h2 className="text-xl font-bold text-amber-600 flex items-center gap-2">
                  <Droplets className="w-6 h-6" /> โหมดฉุกเฉิน: กระดาษเปียกน้ำ / ฉีกขาด
                </h2>
                <p className="text-xs text-slate-500">ครูบันทึกคำตอบแทนนักเรียน พร้อมบันทึกเหตุผลในระบบ Audit Trail ป้องกันข้อพิพาท</p>
              </div>
              <button onClick={() => setIsWaterSpillModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">เลือกนักเรียน *</label>
                  <select
                    value={overrideStudentId}
                    onChange={(e) => setOverrideStudentId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-sm font-medium"
                  >
                    {enrolledStudents.length > 0 ? (
                      enrolledStudents.map(student => (
                        <option key={student.id} value={student.id}>
                          {student.student_id ? `${student.student_id} - ` : ''}{student.name} ({student.grade_level || 'ป.3'})
                        </option>
                      ))
                    ) : (
                      <option value="10053">10053 - เด็กชายสิปปวิชญ์ เบ้าทอง (ป.3/1)</option>
                    )}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">ชุดข้อสอบ</label>
                  <select
                    value={overrideSet}
                    onChange={(e) => setOverrideSet(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-sm"
                  >
                    <option value="A">ชุด A</option>
                    <option value="B">ชุด B</option>
                    <option value="C">ชุด C</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">เหตุผลที่ต้องบันทึกแทน *</label>
                <input
                  type="text"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="ระบุเหตุผล เช่น กระดาษเปียกน้ำ / ฝนดินสอจางมากจนเครื่องอ่านไม่ได้"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-sm"
                />
              </div>

              {/* Answers Grid */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">จิ้มคำตอบตามกระดาษของนักเรียน:</label>
                  <span className="text-[11px] text-slate-500">
                    เลือกแล้ว {Object.keys(overrideAnswers).length} จาก {activeExam.exam.total_questions} ข้อ
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800 rounded-xl border">
                  {Array.from({ length: activeExam.exam.total_questions || 10 }).map((_, i) => {
                    const qNum = (i + 1).toString();
                    return (
                      <div key={qNum} className="p-2 bg-white dark:bg-slate-900 rounded-lg border text-center space-y-1">
                        <div className="text-xs font-bold text-slate-500">ข้อ {qNum}</div>
                        <div className="flex justify-center gap-1 text-xs">
                          {(['A', 'B', 'C', 'D'] as const).map(c => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setOverrideAnswers({ ...overrideAnswers, [qNum]: c })}
                              className={`w-5 h-5 rounded font-bold text-[10px] cursor-pointer transition ${
                                overrideAnswers[qNum] === c
                                  ? 'bg-[#7B1C3E] text-white shadow-xs'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => setIsWaterSpillModalOpen(false)}
                className="px-4 py-2 border rounded-xl text-sm cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSubmitManualOverride}
                className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold shadow-md cursor-pointer"
              >
                บันทึกคะแนนเข้าระบบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ANSWER KEY EDITOR & 1-SECOND RESCORE MODAL */}
      {isRescoreModalOpen && activeExam && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-purple-600" /> แก้ไขเฉลย & คำนวณคะแนนใหม่ทันที (1-Sec Rescore)
                </h2>
                <p className="text-xs text-slate-500">
                  เมื่อคุณครูปรับเปลี่ยนเฉลย ระบบจะคำนวณคะแนนใหม่ให้นักเรียนทุกคนที่ตรวจแล้วโดยอัตโนมัติ
                </p>
              </div>
              <button onClick={() => setIsRescoreModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Set Selector Tabs */}
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">เลือกชุดข้อสอบที่จะแก้เฉลย:</span>
                <div className="flex gap-1.5">
                  {(['A', 'B', 'C'] as const).map(setName => (
                    <button
                      key={setName}
                      type="button"
                      onClick={() => handleSelectEditingSet(setName)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        editingAnswerKeySet === setName
                          ? 'bg-[#7B1C3E] text-white border-[#7B1C3E] shadow-sm'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      ชุด {setName}
                    </button>
                  ))}
                </div>
              </div>
              <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                ชุด {editingAnswerKeySet} มี {activeExam.exam.total_questions} ข้อ
              </span>
            </div>

            {/* Answer Key Grid */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>คลิกตัวเลือก A, B, C, D เพื่อตั้งเป็นคำตอบที่ถูกต้อง</span>
                <span>ตรวจแล้ว {submissions.length} คน (จะถูกคำนวณใหม่)</span>
              </div>
              <div className="grid grid-cols-5 gap-2.5 max-h-60 overflow-y-auto p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border">
                {Array.from({ length: activeExam.exam.total_questions || 10 }).map((_, i) => {
                  const qNum = (i + 1).toString();
                  const currentChoice = editableAnswerKeys[qNum] || '';
                  return (
                    <div key={qNum} className="p-2 bg-white dark:bg-slate-900 rounded-xl border text-center space-y-1 shadow-xs">
                      <div className="text-xs font-bold text-slate-600 dark:text-slate-400">ข้อ {qNum}</div>
                      <div className="flex justify-center gap-1 text-xs">
                        {(['A', 'B', 'C', 'D'] as const).map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => {
                              setEditableAnswerKeys({
                                ...editableAnswerKeys,
                                [qNum]: c
                              });
                            }}
                            className={`w-6 h-6 rounded-lg font-bold text-[11px] cursor-pointer transition ${
                              currentChoice === c
                                ? 'bg-[#7B1C3E] text-white shadow-xs scale-105'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-xl border border-purple-200 dark:border-purple-900/40 text-xs text-purple-700 dark:text-purple-300">
              ข้อควรระวัง: เมื่อกด "บันทึกเฉลยและคำนวณคะแนนใหม่" ระบบจะอัปเดตเฉลยชุด {editingAnswerKeySet} และประมวลผลคะแนนของนักเรียนทุกคนที่สอบชุดนี้ใหม่ในเสี้ยววินาที
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => setIsRescoreModalOpen(false)}
                className="px-4 py-2 border rounded-xl text-sm cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveAnswerKeyAndRescore}
                className="px-6 py-2 bg-[#7B1C3E] hover:bg-[#631732] text-white rounded-xl text-sm font-semibold shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" /> บันทึกเฉลยและคำนวณคะแนนใหม่
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUBMISSIONS LIST DRAWER / MODAL */}
      {isSubmissionsDrawerOpen && activeExam && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full p-6 space-y-6 shadow-2xl my-6 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-emerald-600" /> ผลการตรวจข้อสอบรายบุคคล
                </h2>
                <p className="text-xs text-slate-500">
                  {activeExam.exam.title} ({activeExam.exam.course?.name_th}) • คะแนนเต็ม {activeExam.exam.max_score} คะแนน
                </p>
              </div>
              <button onClick={() => setIsSubmissionsDrawerOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border text-center">
                <div className="text-xs text-slate-500">ตรวจแล้ว</div>
                <div className="text-lg font-bold text-emerald-600">
                  {submissions.length} / {enrolledStudents.length || submissions.length} คน
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border text-center">
                <div className="text-xs text-slate-500">คะแนนเฉลี่ย</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">
                  {submissions.length > 0
                    ? (submissions.reduce((acc, s) => acc + (s.total_score || 0), 0) / submissions.length).toFixed(1)
                    : '-'}
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border text-center">
                <div className="text-xs text-slate-500">คะแนนสูงสุด</div>
                <div className="text-lg font-bold text-indigo-600">
                  {submissions.length > 0 ? Math.max(...submissions.map(s => s.total_score || 0)) : '-'}
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border text-center">
                <div className="text-xs text-slate-500">คะแนนต่ำสุด</div>
                <div className="text-lg font-bold text-amber-600">
                  {submissions.length > 0 ? Math.min(...submissions.map(s => s.total_score || 0)) : '-'}
                </div>
              </div>
            </div>

            {/* Submissions Table */}
            <div className="flex-1 overflow-y-auto border rounded-2xl">
              {submissions.length === 0 ? (
                <div className="p-12 text-center text-slate-500 space-y-2">
                  <FileText className="w-10 h-10 text-slate-300 mx-auto" />
                  <div className="font-semibold text-slate-700 dark:text-slate-300">ยังไม่มีข้อมูลการตรวจข้อสอบ</div>
                  <p className="text-xs text-slate-400">กดปุ่มสแกน OMR เพื่อเริ่มตรวจกระดาษคำตอบชุดแรก</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-800/70 border-b text-slate-600 dark:text-slate-300 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold text-center w-12">ลำดับ</th>
                      <th className="py-2.5 px-3 font-semibold">รหัสประจำตัว</th>
                      <th className="py-2.5 px-3 font-semibold">ชื่อ-นามสกุล</th>
                      <th className="py-2.5 px-3 font-semibold text-center">ชุด</th>
                      <th className="py-2.5 px-3 font-semibold text-right">คะแนน ({activeExam.exam.max_score})</th>
                      <th className="py-2.5 px-3 font-semibold text-center">สถานะ</th>
                      <th className="py-2.5 px-3 font-semibold text-center w-16">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {submissions.map((sub, idx) => {
                      const studentName = sub.student 
                        ? `${sub.student.first_name || ''} ${sub.student.last_name || ''}`.trim()
                        : sub.student_id;
                      const studentCode = sub.student?.student_id || sub.student_id;
                      const isOverride = sub.is_damaged_or_spill || sub.status === 'MANUAL_OVERRIDE';

                      return (
                        <tr key={sub.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                          <td className="py-2 px-3 text-center text-slate-400">{idx + 1}</td>
                          <td className="py-2 px-3 font-mono font-semibold text-slate-700 dark:text-slate-300">{studentCode}</td>
                          <td className="py-2 px-3 font-medium text-slate-900 dark:text-white">{studentName}</td>
                          <td className="py-2 px-3 text-center">
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              ชุด {sub.set_name}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-sm text-[#7B1C3E]">
                            {sub.total_score}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {isOverride ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900">
                                <Droplets className="w-2.5 h-2.5" /> คีย์แทนฉุกเฉิน
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900">
                                <Check className="w-2.5 h-2.5" /> ตรวจสำเร็จ
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteSubmission(sub.id)}
                              title="ลบผลการสอบเพื่อสแกนใหม่"
                              className="p-1 text-slate-400 hover:text-red-600 transition cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Actions Bar */}
            <div className="flex items-center justify-between pt-2 border-t flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleRetroactiveRescore(activeExam.exam.id)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> คำนวณใหม่ทั้งชุด
                </button>
                <button
                  type="button"
                  onClick={() => handleSyncGradebook(activeExam.exam.id)}
                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl text-xs font-semibold border border-amber-200 flex items-center gap-1 cursor-pointer"
                >
                  <Database className="w-3.5 h-3.5" /> ซิงค์เข้าเล่ม ปพ.5
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsSubmissionsDrawerOpen(false);
                    setIsScanModalOpen(true);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" /> สแกนตรวจเพิ่ม
                </button>
                <button
                  type="button"
                  onClick={() => setIsSubmissionsDrawerOpen(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold cursor-pointer"
                >
                  ปิด
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
