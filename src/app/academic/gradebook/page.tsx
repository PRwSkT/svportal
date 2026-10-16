'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  BookOpen, 
  Save, 
  Send, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Search, 
  Download, 
  FileSpreadsheet,
  ChevronRight,
  ShieldAlert,
  HelpCircle,
  Sparkles,
  Lock,
  ArrowLeft,
  Sliders,
  Check,
  X,
  Plus,
  Minus,
  RotateCcw,
  CheckCheck,
  Users,
  Award,
  AlertTriangle,
  ClipboardPaste
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { calculateEightLevelGrade, evaluateAttendanceEligibility } from '@/lib/academic/calculation';
import { DEFAULT_ACADEMIC_YEAR } from '@/lib/constants/school';
import Link from 'next/link';

function SmartGradebookContent() {
  const [classes, setClasses] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');

  const [gradebook, setGradebook] = useState<any>(null);
  const [grades, setGrades] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Pre-flight Audit Modal State
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditResult, setAuditResult] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Batch Curve Modal State
  const [isBatchCurveModalOpen, setIsBatchCurveModalOpen] = useState(false);
  const [batchCurveField, setBatchCurveField] = useState<'formative_score' | 'exam_score'>('formative_score');
  const [batchCurveDelta, setBatchCurveDelta] = useState<number>(2);

  const searchParams = useSearchParams();
  const paramGradebookId = searchParams.get('gradebook_id') || searchParams.get('id');
  const paramClassId = searchParams.get('class_id') || searchParams.get('classId');
  const paramCourseId = searchParams.get('course_id') || searchParams.get('courseId');

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Initial Load: Classes and Courses
  useEffect(() => {
    async function loadMeta() {
      try {
        let directClassId = paramClassId;
        let directCourseId = paramCourseId;

        // If deep-linked by gradebook_id, resolve class and course directly
        if (paramGradebookId) {
          try {
            const gbRes = await fetch(`/api/academic/gradebooks/${paramGradebookId}`);
            if (gbRes.ok) {
              const gbData = await gbRes.json();
              if (gbData?.gradebook) {
                directClassId = gbData.gradebook.class_id;
                directCourseId = gbData.gradebook.course_id;
              }
            }
          } catch (e) {
            console.error('Failed to load deep-linked gradebook:', e);
          }
        }

        const [resCls, resCrs] = await Promise.all([
          fetch(`/api/academic/classes?year=${DEFAULT_ACADEMIC_YEAR}`),
          fetch(`/api/academic/courses?year=${DEFAULT_ACADEMIC_YEAR}`)
        ]);
        if (resCls.ok) {
          const d = await resCls.json();
          const primaryFirst = (d.classes || []).sort((a: any, b: any) => {
            if (a.department === 'primary' && b.department !== 'primary') return -1;
            if (a.department !== 'primary' && b.department === 'primary') return 1;
            return a.name.localeCompare(b.name);
          });
          setClasses(primaryFirst);
          const defaultClass = directClassId && primaryFirst.some((c: any) => c.id === directClassId)
            ? directClassId
            : (primaryFirst.length > 0 ? primaryFirst[0].id : '');
          if (defaultClass) setSelectedClassId(defaultClass);
        }
        if (resCrs.ok) {
          const d = await resCrs.json();
          const courseList = d.courses || [];
          setCourses(courseList);
          if (directCourseId && courseList.some((c: any) => c.id === directCourseId)) {
            setSelectedCourseId(directCourseId);
          }
        }
      } catch (e: any) {
        toast.error('โหลดข้อมูลชั้นเรียนและวิชาไม่สำเร็จ');
      }
    }
    loadMeta();
  }, [paramGradebookId, paramClassId, paramCourseId]);

  const selectedClass = classes.find(c => c.id === selectedClassId);
  const isKindergarten = selectedClass?.department === 'kindergarten';

  const filteredCourses = courses.filter(c => {
    if (!selectedClass) return true;
    return c.grade_level === selectedClass.grade_level;
  });

  // Keep selectedCourseId in sync with filteredCourses
  useEffect(() => {
    if (filteredCourses.length > 0) {
      const exists = filteredCourses.some(c => c.id === selectedCourseId);
      if (!exists) {
        setSelectedCourseId(filteredCourses[0].id);
      }
    } else {
      setSelectedCourseId('');
    }
  }, [selectedClassId, filteredCourses, selectedCourseId]);

  // 2. Fetch Gradebook for selected class & course
  const loadGradebookData = useCallback(async (classId: string, courseId: string) => {
    if (!classId || !courseId) return;
    setIsLoading(true);
    try {
      // Find or create gradebook
      const resCreate = await fetch('/api/academic/gradebooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ class_id: classId, course_id: courseId })
      });
      const dataGb = await resCreate.json();
      if (!resCreate.ok) throw new Error(dataGb.error);

      // Fetch detail with students
      const resDetail = await fetch(`/api/academic/gradebooks/${dataGb.gradebook.id}`);
      const dataDetail = await resDetail.json();
      if (!resDetail.ok) throw new Error(dataDetail.error);

      setGradebook(dataDetail.gradebook);
      const hydratedGrades = (dataDetail.grades || []).map((g: any) => ({
        ...g,
        is_incomplete: g.is_incomplete ?? (g.final_grade === 'ร'),
        is_absent: g.is_absent ?? (g.final_grade === 'ขส')
      }));
      setGrades(hydratedGrades);
    } catch (err: any) {
      toast.error('ไม่สามารถเปิดสมุด ปพ.5 ได้: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedClassId && selectedCourseId) {
      loadGradebookData(selectedClassId, selectedCourseId);
    }
  }, [selectedClassId, selectedCourseId, loadGradebookData]);

  // 3. Score Change Handler with Local Calculation & Debounced Auto-save
  const handleScoreChange = (index: number, field: 'formative_score' | 'exam_score' | 'attendance_hours', value: number) => {
    const updated = [...grades];
    const maxVal = field === 'formative_score' ? 70 : field === 'exam_score' ? 30 : 40;
    const item = { ...updated[index], [field]: Math.min(maxVal, Math.max(0, value)) };

    const formative = Number(item.formative_score) || 0;
    const exam = Number(item.exam_score) || 0;
    const total = Math.min(100, Math.round((formative + exam) * 100) / 100);
    const attended = Number(item.attendance_hours) || 40;
    const totalHours = Number(item.total_course_hours) || 40;

    const { isEligible, attendancePercent } = evaluateAttendanceEligibility(attended, totalHours);

    item.total_score = total;
    item.attendance_percent = attendancePercent;

    if (item.is_incomplete) {
      item.final_grade = 'ร';
    } else if (item.is_absent) {
      item.final_grade = 'ขส';
    } else if (!isEligible) {
      item.final_grade = 'มส';
    } else {
      item.final_grade = calculateEightLevelGrade(total);
    }

    updated[index] = item;
    setGrades(updated);

    // Trigger Debounced Auto-Save
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      triggerAutoSave(updated);
    }, 600);
  };

  // Special Status Change Handler (ปกติ, ร, มส, ขส)
  const handleSpecialStatusChange = (index: number, status: 'NORMAL' | 'INCOMPLETE_R' | 'NO_EXAM_MS' | 'ABSENT_KS') => {
    const updated = [...grades];
    const item = { ...updated[index] };
    
    if (status === 'NORMAL') {
      item.is_incomplete = false;
      item.is_absent = false;
      const formative = Number(item.formative_score) || 0;
      const exam = Number(item.exam_score) || 0;
      const total = Math.min(100, Math.round((formative + exam) * 100) / 100);
      const attended = Number(item.attendance_hours) || 40;
      const totalHours = Number(item.total_course_hours) || 40;
      const { isEligible, attendancePercent } = evaluateAttendanceEligibility(attended, totalHours);
      item.total_score = total;
      item.attendance_percent = attendancePercent;
      item.final_grade = isEligible ? calculateEightLevelGrade(total) : 'มส';
    } else if (status === 'INCOMPLETE_R') {
      item.is_incomplete = true;
      item.is_absent = false;
      item.final_grade = 'ร';
    } else if (status === 'ABSENT_KS') {
      item.is_absent = true;
      item.is_incomplete = false;
      item.final_grade = 'ขส';
    } else if (status === 'NO_EXAM_MS') {
      item.is_incomplete = false;
      item.is_absent = false;
      item.final_grade = 'มส';
    }

    updated[index] = item;
    setGrades(updated);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      triggerAutoSave(updated);
    }, 600);
  };

  // Keyboard Navigation Across Input Cells
  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIdx: number,
    field: 'formative_score' | 'exam_score' | 'attendance_hours'
  ) => {
    const fields: Array<'formative_score' | 'exam_score' | 'attendance_hours'> = [
      'formative_score',
      'exam_score',
      'attendance_hours'
    ];
    const currentFieldIndex = fields.indexOf(field);

    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault();
      if (rowIdx < grades.length - 1) {
        const nextInput = document.getElementById(`cell-${field}-${rowIdx + 1}`);
        nextInput?.focus();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (rowIdx > 0) {
        const prevInput = document.getElementById(`cell-${field}-${rowIdx - 1}`);
        prevInput?.focus();
      }
    } else if (e.key === 'Tab') {
      if (!e.shiftKey && currentFieldIndex < fields.length - 1) {
        e.preventDefault();
        const nextField = fields[currentFieldIndex + 1];
        const nextInput = document.getElementById(`cell-${nextField}-${rowIdx}`);
        nextInput?.focus();
      } else if (e.shiftKey && currentFieldIndex > 0) {
        e.preventDefault();
        const prevField = fields[currentFieldIndex - 1];
        const prevInput = document.getElementById(`cell-${prevField}-${rowIdx}`);
        prevInput?.focus();
      }
    }
  };

  // Clipboard Paste handler (supports Excel/Sheets multi-row copy/paste)
  const handleCellPaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    startRowIdx: number,
    field: 'formative_score' | 'exam_score' | 'attendance_hours'
  ) => {
    const text = e.clipboardData.getData('text');
    if (!text) return;

    const rawRows = text.split(/\r\n|\r|\n/).map(r => r.trim()).filter(r => r !== '');
    if (rawRows.length <= 1 && !rawRows[0].includes('\t')) {
      return;
    }

    e.preventDefault();
    const updated = [...grades];
    let modifiedCount = 0;

    rawRows.forEach((rowText, offset) => {
      const targetIdx = startRowIdx + offset;
      if (targetIdx >= updated.length) return;

      const cells = rowText.split('\t').map(c => c.trim());
      const val = parseFloat(cells[0]);

      if (!isNaN(val)) {
        const maxAllowed = field === 'formative_score' ? 70 : field === 'exam_score' ? 30 : 40;
        const clampedVal = Math.min(maxAllowed, Math.max(0, val));
        
        const item = { ...updated[targetIdx], [field]: clampedVal };
        const formative = Number(item.formative_score) || 0;
        const exam = Number(item.exam_score) || 0;
        const total = Math.min(100, Math.round((formative + exam) * 100) / 100);
        const attended = Number(item.attendance_hours) || 40;
        const totalHours = Number(item.total_course_hours) || 40;
        const { isEligible, attendancePercent } = evaluateAttendanceEligibility(attended, totalHours);

        item.total_score = total;
        item.attendance_percent = attendancePercent;

        if (item.is_incomplete) {
          item.final_grade = 'ร';
        } else if (item.is_absent) {
          item.final_grade = 'ขส';
        } else if (!isEligible) {
          item.final_grade = 'มส';
        } else {
          item.final_grade = calculateEightLevelGrade(total);
        }

        updated[targetIdx] = item;
        modifiedCount++;
      }
    });

    if (modifiedCount > 0) {
      setGrades(updated);
      toast.success(`วางคะแนนจาก Clipboard สำเร็จ ${modifiedCount} แถว`);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        triggerAutoSave(updated);
      }, 600);
    }
  };

  // Batch Set Attendance for all students in one click
  const handleBatchSetAttendance = (hours = 40) => {
    if (isLocked || grades.length === 0) return;
    const updated = grades.map(row => {
      const attended = hours;
      const totalHours = Number(row.total_course_hours) || 40;
      const { isEligible, attendancePercent } = evaluateAttendanceEligibility(attended, totalHours);
      const total = Number(row.total_score) || 0;
      let finalGrade = row.final_grade;
      if (row.is_incomplete) {
        finalGrade = 'ร';
      } else if (row.is_absent) {
        finalGrade = 'ขส';
      } else if (!isEligible) {
        finalGrade = 'มส';
      } else {
        finalGrade = calculateEightLevelGrade(total);
      }
      return {
        ...row,
        attendance_hours: hours,
        attendance_percent: attendancePercent,
        final_grade: finalGrade
      };
    });
    setGrades(updated);
    toast.success(`ตั้งเวลาเรียนนักเรียนทั้งห้องเป็น ${hours} ชั่วโมง (100%) เรียบร้อยแล้ว`);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      triggerAutoSave(updated);
    }, 600);
  };

  // Batch Curve Score (+/- X points across all students)
  const handleBatchCurveScore = () => {
    if (isLocked || grades.length === 0 || batchCurveDelta === 0) return;
    const maxAllowed = batchCurveField === 'formative_score' ? 70 : 30;
    const updated = grades.map(row => {
      const current = Number(row[batchCurveField]) || 0;
      const newVal = Math.min(maxAllowed, Math.max(0, Math.round((current + batchCurveDelta) * 10) / 10));
      const item = { ...row, [batchCurveField]: newVal };
      const formative = Number(item.formative_score) || 0;
      const exam = Number(item.exam_score) || 0;
      const total = Math.min(100, Math.round((formative + exam) * 100) / 100);
      const attended = Number(item.attendance_hours) || 40;
      const totalHours = Number(item.total_course_hours) || 40;
      const { isEligible, attendancePercent } = evaluateAttendanceEligibility(attended, totalHours);
      item.total_score = total;
      item.attendance_percent = attendancePercent;
      if (item.is_incomplete) {
        item.final_grade = 'ร';
      } else if (item.is_absent) {
        item.final_grade = 'ขส';
      } else if (!isEligible) {
        item.final_grade = 'มส';
      } else {
        item.final_grade = calculateEightLevelGrade(total);
      }
      return item;
    });
    setGrades(updated);
    toast.success(`ปรับคะแนน${batchCurveField === 'formative_score' ? 'เก็บ' : 'สอบ'} ${batchCurveDelta > 0 ? '+' : ''}${batchCurveDelta} คะแนน ให้ทั้งห้องแล้ว`);
    setIsBatchCurveModalOpen(false);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      triggerAutoSave(updated);
    }, 600);
  };

  // Export CSV (ปพ.5)
  const handleExportCSV = () => {
    if (grades.length === 0) {
      toast.warning('ไม่พบข้อมูลที่จะส่งออก');
      return;
    }
    const headers = ['เลขที่', 'รหัสนักเรียน', 'ชื่อ-สกุล', 'คะแนนเก็บ (70)', 'คะแนนสอบ (30)', 'คะแนนรวม (100)', 'เกรด', 'เวลาเรียน (ชม.)', 'เวลาเรียน %', 'สถานะ'];
    const rows = grades.map((g, idx) => [
      g.roll_number || idx + 1,
      g.student_id,
      `"${g.student?.name || `${g.student?.first_name || ''} ${g.student?.last_name || ''}`}"`,
      g.formative_score ?? 0,
      g.exam_score ?? 0,
      g.total_score ?? 0,
      g.final_grade ?? '-',
      g.attendance_hours ?? 40,
      `${g.attendance_percent}%`,
      g.is_incomplete ? 'ร' : g.is_absent ? 'ขส' : g.final_grade === 'มส' ? 'มส' : 'ปกติ'
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ปพ5_${selectedClass?.name || 'ห้อง'}_${selectedCourseId || 'วิชา'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('ดาวน์โหลดไฟล์ CSV ปพ.5 เรียบร้อยแล้ว');
  };

  const triggerAutoSave = async (currentGrades: any[]) => {
    if (!gradebook?.id || gradebook?.approval_status === 'OFFICIALLY_LOCKED') return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/academic/gradebooks/${gradebook.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: currentGrades })
      });
      if (res.ok) {
        setLastSavedTime(new Date().toLocaleTimeString('th-TH'));
      }
    } catch (e) {
      console.error('Auto-save error:', e);
    } finally {
      setIsSaving(false);
    }
  };

  // 4. Pre-flight Audit before Submission
  const handleOpenPreflight = async () => {
    if (!gradebook?.id) return;
    try {
      const res = await fetch(`/api/academic/gradebooks/${gradebook.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preflight' })
      });
      const data = await res.json();
      setAuditResult(data);
      setIsAuditModalOpen(true);
    } catch (e: any) {
      toast.error('ไม่สามารถรันระบบตรวจสอบก่อนส่งได้');
    }
  };

  const handleConfirmSubmit = async () => {
    if (!gradebook?.id) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/academic/gradebooks/${gradebook.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message || 'ส่งผลการเรียนให้หัวหน้าแผนกตรวจทานเรียบร้อยแล้ว');
      setIsAuditModalOpen(false);
      loadGradebookData(selectedClassId, selectedCourseId);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLocked = gradebook?.approval_status === 'OFFICIALLY_LOCKED' || gradebook?.approval_status === 'SUBMITTED_TO_HEAD' || gradebook?.approval_status === 'APPROVED_BY_HEAD';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Controls (Forms Studio Brand Parity) */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#7B1C3E]/10 text-[#7B1C3E] flex items-center justify-center flex-shrink-0 border border-[#7B1C3E]/20 shadow-sm">
              <BookOpen className="w-7 h-7" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#7B1C3E]/10 text-[#7B1C3E] text-xs font-bold mb-1.5 border border-[#7B1C3E]/20">
                <Sparkles className="w-3.5 h-3.5" /> Somkid Academic Studio • Smart Gradebook (ปพ.5)
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                สมุดบันทึกผลการเรียนรู้ (ปพ.5 ดิจิทัล)
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                บันทึกคะแนนเก็บ สอบปลายภาค คำนวณเกรด 8 ระดับ สพฐ. และตรวจสอบสิทธิ์สอบ 80% อัตโนมัติ
              </p>
            </div>
          </div>

          {/* Status Badge & Auto-save Indicator & Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Link 
              href="/academic" 
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>ศูนย์วิชาการ</span>
            </Link>

            {isSaving ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/60 animate-pulse">
                <Save className="w-3.5 h-3.5" />
                กำลังบันทึก...
              </span>
            ) : lastSavedTime ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                <CheckCircle2 className="w-3.5 h-3.5" />
                บันทึกแล้ว ({lastSavedTime})
              </span>
            ) : null}

            {gradebook && (
              <span className={`px-3 py-2 rounded-xl text-xs font-bold border ${
                gradebook.approval_status === 'OFFICIALLY_LOCKED' 
                  ? 'bg-purple-100 border-purple-200 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                  : gradebook.approval_status === 'SUBMITTED_TO_HEAD'
                  ? 'bg-amber-100 border-amber-200 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  : gradebook.approval_status === 'APPROVED_BY_HEAD'
                  ? 'bg-blue-100 border-blue-200 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                  : 'bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}>
                สถานะ: {gradebook.approval_status}
              </span>
            )}

            {!isLocked && (
              <button
                onClick={handleOpenPreflight}
                disabled={grades.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#7B1C3E] hover:bg-[#631430] text-white rounded-xl text-xs font-bold shadow-md shadow-[#7B1C3E]/20 transition-all cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                ส่งตรวจทานผลการเรียน
              </button>
            )}
          </div>
        </div>

        {/* 4-Column Quick Metrics Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#7B1C3E]/10 text-[#7B1C3E] flex items-center justify-center flex-shrink-0 border border-[#7B1C3E]/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">นักเรียนในห้อง</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                {grades.length} <span className="text-xs font-normal text-slate-400">คน</span>
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center flex-shrink-0 border border-emerald-500/20">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">ผลการเรียนเกรด 4</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                {grades.filter(g => g.final_grade === '4').length} <span className="text-xs font-normal text-slate-400">คน</span>
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center flex-shrink-0 border border-indigo-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">อัตราการผ่านเกณฑ์</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                {grades.length > 0 
                  ? Math.round((grades.filter(g => g.final_grade && g.final_grade !== '0' && g.final_grade !== 'มส' && g.final_grade !== 'ร' && g.final_grade !== 'ขส').length / grades.length) * 100) 
                  : 0} <span className="text-xs font-normal text-slate-400">%</span>
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center flex-shrink-0 border border-rose-500/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">ต้องติดตาม (ร/มส/ขส/0)</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                {grades.filter(g => g.final_grade === '0' || g.final_grade === 'มส' || g.final_grade === 'ร' || g.final_grade === 'ขส' || g.is_incomplete || g.is_absent).length} <span className="text-xs font-normal text-slate-400">คน</span>
              </p>
            </div>
          </div>
        </div>

        {/* Filter Controls: Classroom & Subject */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label htmlFor="academic-class-select" className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">เลือกชั้นเรียน (Classroom)</label>
              <select
                id="academic-class-select"
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#7B1C3E]/30 focus:outline-none"
              >
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.department === 'kindergarten' ? 'ปฐมวัย' : 'ประถม'})</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="academic-course-select" className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                เลือกรายวิชา (Course) {filteredCourses.length > 0 && `[${filteredCourses.length} วิชา]`}
              </label>
              <select
                id="academic-course-select"
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                disabled={filteredCourses.length === 0}
                className="w-full text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#7B1C3E]/30 focus:outline-none"
              >
                {filteredCourses.length === 0 ? (
                  <option value="">-- ไม่พบรายวิชาในระดับชั้นนี้ --</option>
                ) : (
                  filteredCourses.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.course_code}: {c.name_th} {!c.is_reported_to_opec ? '(MEP - ไม่ส่ง สช.)' : ''}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="flex items-end">
              <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60 w-full">
                <span>สัดส่วนคะแนน: </span>
                <strong className="text-[#7B1C3E]">เก็บ 70% : ปลายปี 30%</strong>
                <span className="block mt-0.5">เกณฑ์เวลาเรียน: <strong>80% (ขาดได้ไม่เกิน 8 ชม.)</strong></span>
              </div>
            </div>
          </div>

          {/* Frictionless Batch Adjustment Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsBatchCurveModalOpen(true)}
                disabled={isLocked || grades.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#7B1C3E]/10 hover:bg-[#7B1C3E]/20 text-[#7B1C3E] text-xs font-bold transition-all border border-[#7B1C3E]/20 disabled:opacity-50"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>ปรับคะแนนทั้งห้อง (+/-)</span>
              </button>

              <button
                type="button"
                onClick={() => handleBatchSetAttendance(40)}
                disabled={isLocked || grades.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold transition-all border border-emerald-500/20 disabled:opacity-50"
                title="ตั้งเวลาเรียนของทุกคนในห้องนี้เป็น 40 ชม. (100%)"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>ตั้งเวลาเรียน 40 ชม. ทั้งห้อง</span>
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                disabled={grades.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all border border-slate-200 dark:border-slate-700 disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>ส่งออก CSV (ปพ.5)</span>
              </button>
            </div>

            <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-800/40 px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              <ClipboardPaste className="w-3.5 h-3.5 text-[#7B1C3E]" />
              <span>
                <strong>คัดลอกจาก Excel วางได้ทันที</strong> (Ctrl+V / Cmd+V) และใช้ลูกศรเลื่อนเซลล์
              </span>
            </div>
          </div>
        </div>

        {/* Early Years Banner Notice if Kindergarten class selected */}
        {isKindergarten && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-3xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  ห้องเรียน {selectedClass?.name} เป็นระดับปฐมวัย (Early Years)
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  การประเมินผลระดับอนุบาลจะประเมินผ่านพัฒนาการ 4 ด้านและบันทึกโภชนาการรายวัน
                </p>
              </div>
            </div>
            <Link
              href="/academic/early-years"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shrink-0 shadow-sm"
            >
              ไปที่ระบบประเมินพัฒนาการปฐมวัย
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* Smart Table Grid */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-sm text-slate-500">กำลังเปิดสมุด ปพ.5...</div>
          ) : grades.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500">
              {isKindergarten ? 'ระดับปฐมวัยไม่มีสมุด ปพ.5 รูปแบบคะแนน กรุณาใช้งานระบบพัฒนาการ 4 ด้าน' : 'ไม่พบบัญชีรายชื่อนักเรียนในห้องเรียนนี้'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                    <th className="py-3.5 px-3 text-center w-12">เลขที่</th>
                    <th className="py-3.5 px-3 w-24">รหัส</th>
                    <th className="py-3.5 px-4 min-w-[180px]">ชื่อ-สกุล นักเรียน</th>
                    <th className="py-3.5 px-3 text-center w-28 bg-[#7B1C3E]/5 dark:bg-[#7B1C3E]/10">
                      คะแนนเก็บ (70)
                    </th>
                    <th className="py-3.5 px-3 text-center w-28 bg-purple-50/50 dark:bg-purple-950/20">
                      สอบปลายปี (30)
                    </th>
                    <th className="py-3.5 px-3 text-center w-24 font-extrabold text-[#7B1C3E]">
                      รวม (100)
                    </th>
                    <th className="py-3.5 px-3 text-center w-20 font-extrabold">เกรด</th>
                    <th className="py-3.5 px-3 text-center w-28">เวลาเรียน (ชม.)</th>
                    <th className="py-3.5 px-3 text-center w-24">เวลาเรียน %</th>
                    <th className="py-3.5 px-3 text-center w-36">สถานะพิเศษ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {grades.map((row, idx) => {
                    const isFailing = row.final_grade === '0';
                    const isMs = row.final_grade === 'มส';
                    const isR = row.final_grade === 'ร' || row.is_incomplete;
                    const isKs = row.final_grade === 'ขส' || row.is_absent;
                    const isWarning = row.attendance_percent >= 80 && row.attendance_percent <= 85;

                    return (
                      <tr 
                        key={row.student_id}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${
                          isMs || isFailing ? 'bg-rose-50/30 dark:bg-rose-950/10' :
                          isR ? 'bg-amber-50/30 dark:bg-amber-950/10' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center font-bold text-slate-500">{row.roll_number || idx + 1}</td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-slate-800 dark:text-slate-300">{row.student_id}</td>
                        <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-white">
                          {row.student?.name || `${row.student?.first_name || ''} ${row.student?.last_name || ''}`}
                        </td>
                        
                        {/* Formative Score Input */}
                        <td className="py-2 px-3 text-center bg-[#7B1C3E]/5 dark:bg-[#7B1C3E]/10">
                          <input
                            id={`cell-formative_score-${idx}`}
                            type="number"
                            disabled={isLocked}
                            min="0"
                            max="70"
                            step="0.5"
                            value={row.formative_score ?? ''}
                            onChange={(e) => handleScoreChange(idx, 'formative_score', parseFloat(e.target.value) || 0)}
                            onKeyDown={(e) => handleCellKeyDown(e, idx, 'formative_score')}
                            onPaste={(e) => handleCellPaste(e, idx, 'formative_score')}
                            className="w-20 text-center font-bold text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 focus:ring-2 focus:ring-[#7B1C3E]/50 focus:outline-none"
                          />
                        </td>

                        {/* Exam Score Input */}
                        <td className="py-2 px-3 text-center bg-purple-50/20 dark:bg-purple-950/10">
                          <input
                            id={`cell-exam_score-${idx}`}
                            type="number"
                            disabled={isLocked}
                            min="0"
                            max="30"
                            step="0.5"
                            value={row.exam_score ?? ''}
                            onChange={(e) => handleScoreChange(idx, 'exam_score', parseFloat(e.target.value) || 0)}
                            onKeyDown={(e) => handleCellKeyDown(e, idx, 'exam_score')}
                            onPaste={(e) => handleCellPaste(e, idx, 'exam_score')}
                            className="w-20 text-center font-bold text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                          />
                        </td>

                        {/* Total Score */}
                        <td className="py-2.5 px-3 text-center font-bold text-sm text-slate-900 dark:text-white">
                          {row.total_score ?? 0}
                        </td>

                        {/* Final Grade 8-Level */}
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                            row.final_grade === '4' ? 'bg-emerald-100 text-emerald-800' :
                            row.final_grade === '3.5' || row.final_grade === '3' ? 'bg-blue-100 text-blue-800' :
                            row.final_grade === '2.5' || row.final_grade === '2' ? 'bg-amber-100 text-amber-800' :
                            row.final_grade === '1.5' || row.final_grade === '1' ? 'bg-orange-100 text-orange-800' :
                            row.final_grade === '0' ? 'bg-rose-100 text-rose-800' :
                            row.final_grade === 'มส' ? 'bg-red-600 text-white' :
                            row.final_grade === 'ร' ? 'bg-amber-500 text-white' :
                            row.final_grade === 'ขส' ? 'bg-orange-500 text-white' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {row.final_grade ?? '-'}
                          </span>
                        </td>

                        {/* Attendance Hours Input */}
                        <td className="py-2 px-3 text-center">
                          <input
                            id={`cell-attendance_hours-${idx}`}
                            type="number"
                            disabled={isLocked}
                            min="0"
                            max="40"
                            value={row.attendance_hours ?? 40}
                            onChange={(e) => handleScoreChange(idx, 'attendance_hours', parseFloat(e.target.value) || 0)}
                            onKeyDown={(e) => handleCellKeyDown(e, idx, 'attendance_hours')}
                            onPaste={(e) => handleCellPaste(e, idx, 'attendance_hours')}
                            className="w-16 text-center text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-1 focus:ring-2 focus:ring-indigo-500"
                          />
                        </td>

                        {/* Attendance Percent */}
                        <td className="py-2.5 px-3 text-center font-mono">
                          <span className={`font-semibold ${
                            row.attendance_percent < 80 ? 'text-rose-600 font-bold' :
                            isWarning ? 'text-amber-600' : 'text-slate-600 dark:text-slate-400'
                          }`}>
                            {row.attendance_percent}%
                          </span>
                        </td>

                        {/* Special Status Dropdown (Manual Adjust) */}
                        <td className="py-2 px-3 text-center">
                          <select
                            disabled={isLocked}
                            value={
                              row.is_incomplete ? 'INCOMPLETE_R' :
                              row.is_absent ? 'ABSENT_KS' :
                              row.final_grade === 'มส' ? 'NO_EXAM_MS' :
                              'NORMAL'
                            }
                            onChange={(e) => handleSpecialStatusChange(idx, e.target.value as any)}
                            className="text-[11px] font-bold py-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]/30"
                          >
                            <option value="NORMAL">ปกติ</option>
                            <option value="INCOMPLETE_R">ร (งานค้าง)</option>
                            <option value="NO_EXAM_MS">มส (เวลาเรียน)</option>
                            <option value="ABSENT_KS">ขส (ขาดสอบ)</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal: Batch Score Curve */}
        <AnimatePresence>
          {isBatchCurveModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md overflow-hidden"
              >
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-[#7B1C3E]/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#7B1C3E]/10 text-[#7B1C3E] flex items-center justify-center border border-[#7B1C3E]/20">
                      <Sliders className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900 dark:text-white">ปรับคะแนนทั้งห้อง (Batch Curve)</h3>
                      <p className="text-xs text-slate-500">เพิ่มหรือลดคะแนนนักเรียนทุกคนพร้อมกัน</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsBatchCurveModalOpen(false)}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">เลือกส่วนคะแนนที่ต้องการปรับ</label>
                    <select
                      value={batchCurveField}
                      onChange={(e) => setBatchCurveField(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]/30"
                    >
                      <option value="formative_score">คะแนนเก็บระหว่างภาค (เต็ม 70 คะแนน)</option>
                      <option value="exam_score">คะแนนสอบปลายภาค (เต็ม 30 คะแนน)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">จำนวนคะแนนที่ปรับ (+ / -)</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setBatchCurveDelta(prev => prev - 1)}
                        className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 font-black text-base"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <input
                        type="number"
                        step="0.5"
                        value={batchCurveDelta}
                        onChange={(e) => setBatchCurveDelta(parseFloat(e.target.value) || 0)}
                        className="flex-1 text-center font-black text-lg py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]/30"
                      />
                      <button
                        type="button"
                        onClick={() => setBatchCurveDelta(prev => prev + 1)}
                        className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 font-black text-base"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      ระบบจะคำนวณและจำกัดคะแนนรวมไม่ให้เกิน 100 และไม่ต่ำกว่า 0 โดยอัตโนมัติ
                    </p>
                  </div>
                </div>

                <div className="p-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 bg-slate-50/50 dark:bg-slate-800/20">
                  <button
                    type="button"
                    onClick={() => setIsBatchCurveModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    onClick={handleBatchCurveScore}
                    className="px-5 py-2 rounded-xl bg-[#7B1C3E] hover:bg-[#631430] text-white font-bold text-xs shadow-md shadow-[#7B1C3E]/20 transition-all flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>ยืนยันปรับคะแนน</span>
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Pre-flight Audit Modal */}
        {isAuditModalOpen && auditResult && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center gap-3">
                {auditResult.isValid ? (
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                    {auditResult.isValid ? 'ผ่านการตรวจสอบความถูกต้อง 100%' : 'พบข้อผิดพลาดที่ต้องแก้ไขก่อนส่ง'}
                  </h3>
                  <p className="text-xs text-slate-500">ระบบ Pre-flight ตรวจสอบตามเกณฑ์ สพฐ. อัตโนมัติ</p>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-center text-xs">
                <div>
                  <p className="text-slate-400">นักเรียนทั้งหมด</p>
                  <p className="text-base font-bold text-slate-900 dark:text-white">{auditResult.stats.totalStudents} คน</p>
                </div>
                <div>
                  <p className="text-slate-400">คะแนนเฉลี่ย</p>
                  <p className="text-base font-bold text-indigo-600">{auditResult.stats.averageScore}</p>
                </div>
                <div>
                  <p className="text-slate-400">ติด 0 / มส.</p>
                  <p className="text-base font-bold text-rose-600">{auditResult.stats.failingCount + auditResult.stats.msCount} คน</p>
                </div>
              </div>

              {/* Error List */}
              {auditResult.errors.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto bg-rose-50 dark:bg-rose-950/30 p-3 rounded-xl border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-300">
                  <p className="font-bold flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" />
                    ข้อผิดพลาด (Blocking Errors):
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    {auditResult.errors.map((err: string, i: number) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Warning List */}
              {auditResult.warnings.length > 0 && (
                <div className="space-y-1.5 max-h-32 overflow-y-auto bg-amber-50 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300">
                  <p className="font-bold">ข้อสังเกตเพิ่มเติม (Warnings):</p>
                  <ul className="list-disc pl-5 space-y-1">
                    {auditResult.warnings.map((w: string, i: number) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setIsAuditModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                >
                  กลับไปแก้ไข
                </button>
                {auditResult.isValid && (
                  <button
                    onClick={handleConfirmSubmit}
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-md transition-all"
                  >
                    {isSubmitting ? 'กำลังส่ง...' : 'ยืนยันส่งผลการเรียน'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default function SmartGradebookPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-8 text-slate-500">
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-indigo-600 animate-pulse" />
          <span>กำลังโหลดสมุดบันทึกผลการเรียน...</span>
        </div>
      </div>
    }>
      <SmartGradebookContent />
    </Suspense>
  );
}
