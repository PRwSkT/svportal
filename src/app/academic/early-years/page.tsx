'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Baby,
  Save,
  Sparkles,
  CheckCircle2,
  Heart,
  Activity,
  Smile,
  Moon,
  Utensils,
  MessageSquareHeart,
  Thermometer,
  Camera,
  ShieldCheck,
  ShieldAlert,
  Send,
  ExternalLink,
  Check,
  Clock,
  BookOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { evaluateEarlyYearsGrowth } from '@/lib/academic/calculation';
import { DEFAULT_ACADEMIC_YEAR } from '@/lib/constants/school';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  getPipelineState,
  PIPELINE_EVENT_NAME,
  saveEarlyYearsDailyCare,
  acknowledgeEarlyYearsDropoffNote,
} from '@/lib/pipeline/bidirectional-store';
import {
  BidirectionalPipelineState,
  EarlyYearsDailyCare,
  EarlyYearsMood,
  MealConsumptionStatus,
  MilkConsumptionStatus,
  NapQualityStatus,
} from '@/types/family-pipeline';

function EarlyYearsAssessmentContent() {
  const { isThai } = useLanguage();
  // Default to Mode 1 ('daily_care') so teachers & testers immediately see the new Daily Care + Morning Drop-off Note pipeline!
  const [activeMode, setActiveMode] = useState<
    'daily_care' | 'term_evaluation'
  >('daily_care');

  // Bidirectional Pipeline State for Mode 1
  const [pipeline, setPipeline] = useState<BidirectionalPipelineState>(() =>
    getPipelineState()
  );
  const [careDrafts, setCareDrafts] = useState<EarlyYearsDailyCare[]>(() =>
    getPipelineState().early_years_care
  );

  const syncPipeline = useCallback(() => {
    const latest = getPipelineState();
    setPipeline({ ...latest });
    setCareDrafts(latest.early_years_care.map((item) => ({ ...item })));
  }, []);

  useEffect(() => {
    syncPipeline();
    const handleUpdate = () => syncPipeline();
    window.addEventListener(PIPELINE_EVENT_NAME, handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener(PIPELINE_EVENT_NAME, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [syncPipeline]);

  const handleCareDraftChange = <K extends keyof EarlyYearsDailyCare>(
    studentId: string,
    field: K,
    value: EarlyYearsDailyCare[K]
  ) => {
    setCareDrafts((prev) =>
      prev.map((item) =>
        item.student_id === studentId ? { ...item, [field]: value } : item
      )
    );
  };

  const handlePublishSingleCare = (record: EarlyYearsDailyCare) => {
    saveEarlyYearsDailyCare(record);
    syncPipeline();
    toast.success(
      isThai
        ? `บันทึกและส่งรายงานประจำวันของ ${record.nickname} ไปยัง Parents Portal เรียบร้อยแล้ว!`
        : `Published Daily Care for ${record.nickname} to Parents Portal!`
    );
  };

  const handleBatchPublishAllCare = () => {
    careDrafts.forEach((rec) => {
      saveEarlyYearsDailyCare(rec);
    });
    syncPipeline();
    toast.success(
      isThai
        ? 'บันทึกและส่งสมุดพกอนุบาลประจำวันครบทุกคนไปยัง Parents Portal เรียบร้อยแล้ว!'
        : 'Published all Early Years Daily Care records to Parents Portal!'
    );
  };

  const handleAcknowledgeDropoff = (noteId: string, studentName: string) => {
    acknowledgeEarlyYearsDropoffNote(noteId, 'ครูนภัสสร ใจดี (ครูแนน)');
    syncPipeline();
    toast.success(
      isThai
        ? `ครูรับทราบบันทึกส่งน้องตอนเช้าของ ${studentName} แล้ว (แจ้งผู้ปกครองทันที)`
        : `Acknowledged morning drop-off note for ${studentName}`
    );
  };

  // ============================================================================
  // Mode 2 State: Term 4-Domain Evaluation & AI Assistant (Preserved 100%)
  // ============================================================================
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedTerm, setSelectedTerm] = useState<string>('1');

  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  const [activeStudentCommentIdx, setActiveStudentCommentIdx] = useState<
    number | null
  >(null);
  const [aiDraftPrompt, setAiDraftPrompt] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const searchParams = useSearchParams();
  const paramClassId =
    searchParams.get('class_id') || searchParams.get('classId');
  const paramTerm = searchParams.get('term');

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (paramTerm && ['1', '2'].includes(paramTerm)) {
      setSelectedTerm(paramTerm);
    }
  }, [paramTerm]);

  useEffect(() => {
    async function loadClasses() {
      try {
        const res = await fetch(
          `/api/academic/classes?year=${DEFAULT_ACADEMIC_YEAR}&department=kindergarten`
        );
        if (res.ok) {
          const d = await res.json();
          const clsList = d.classes || [];
          setClasses(clsList);
          if (clsList.length > 0) {
            const defaultId =
              paramClassId && clsList.some((c: any) => c.id === paramClassId)
                ? paramClassId
                : clsList[0].id;
            setSelectedClassId(defaultId);
          }
        }
      } catch {
        toast.error('โหลดห้องเรียนปฐมวัยไม่สำเร็จ');
      }
    }
    loadClasses();
  }, [paramClassId]);

  const loadEvaluations = useCallback(async (classId: string, term: string) => {
    if (!classId) return;
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/academic/early-years?class_id=${classId}&term=${term}`
      );
      const data = await res.json();
      if (!res.ok || !data.success)
        throw new Error(data.error || 'โหลดข้อมูลไม่สำเร็จ');

      const enrollments = data.enrollments || [];
      const existingEvals = data.evaluations || [];
      const evalMap = new Map(
        existingEvals.map((e: any) => [e.student_id, e as any])
      );

      const combined = enrollments.map((enr: any) => {
        const existing = evalMap.get(enr.student_id) as any;
        const w = existing?.weight_kg || 16;
        const h = existing?.height_cm || 105;
        const growth = evaluateEarlyYearsGrowth({
          gender: enr.student?.gender || 'male',
          ageYears: 4,
          weightKg: w,
          heightCm: h,
        });

        return {
          class_id: classId,
          student_id: enr.student_id,
          term,
          roll_number: enr.roll_number,
          student_name: enr.student?.name || 'นักเรียน',
          student_gender: enr.student?.gender || 'male',
          physical_score: existing?.physical_score ?? 3,
          emotional_score: existing?.emotional_score ?? 3,
          social_score: existing?.social_score ?? 3,
          intellectual_score: existing?.intellectual_score ?? 3,
          weight_kg: w,
          height_cm: h,
          growth_status: existing?.growth_status || growth.growthStatus,
          growth_badge: growth.badgeColor,
          milk_drinking: existing?.milk_drinking || 'หมดกล่อง',
          nap_habit: existing?.nap_habit || 'หลับสนิท',
          teacher_comment: existing?.teacher_comment || '',
        };
      });

      setEvaluations(combined);
    } catch (err: any) {
      toast.error('ไม่สามารถโหลดข้อมูลพัฒนาการได้: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      loadEvaluations(selectedClassId, selectedTerm);
    }
  }, [selectedClassId, selectedTerm, loadEvaluations]);

  const handleFieldChange = (index: number, field: string, value: any) => {
    const updated = [...evaluations];
    const item = { ...updated[index], [field]: value };

    if (field === 'weight_kg' || field === 'height_cm') {
      const growth = evaluateEarlyYearsGrowth({
        gender: item.student_gender,
        ageYears: 4,
        weightKg: Number(item.weight_kg) || 16,
        heightCm: Number(item.height_cm) || 105,
      });
      item.growth_status = growth.growthStatus;
      item.growth_badge = growth.badgeColor;
    }

    updated[index] = item;
    setEvaluations(updated);

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      triggerSave(updated);
    }, 600);
  };

  const triggerSave = async (dataToSave: any[]) => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/academic/early-years', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluations: dataToSave }),
      });
      const data = await res.json();
      if (!res.ok || !data.success)
        throw new Error(data.error || 'บันทึกไม่สำเร็จ');

      setLastSavedTime(new Date().toLocaleTimeString('th-TH'));
    } catch (e: any) {
      console.error('Save early years error:', e);
      toast.error('บันทึกอัตโนมัติไม่สำเร็จ: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBatchSetAllGood = () => {
    const updated = evaluations.map((item) => ({
      ...item,
      physical_score: 3,
      emotional_score: 3,
      social_score: 3,
      intellectual_score: 3,
    }));
    setEvaluations(updated);
    triggerSave(updated);
    toast.success('ตั้งค่าเริ่มต้นพัฒนาการทุกคนเป็น: ดี (3) เรียบร้อยแล้ว');
  };

  const handleBatchSetMilk = () => {
    const updated = evaluations.map((item) => ({
      ...item,
      milk_drinking: 'หมดกล่อง',
    }));
    setEvaluations(updated);
    triggerSave(updated);
    toast.success('บันทึกการดื่มนมทุกคนเป็น: หมดกล่อง เรียบร้อยแล้ว');
  };

  const handleBatchSetNap = () => {
    const updated = evaluations.map((item) => ({
      ...item,
      nap_habit: 'หลับสนิท',
    }));
    setEvaluations(updated);
    triggerSave(updated);
    toast.success('บันทึกการนอนกลางวันทุกคนเป็น: หลับสนิท เรียบร้อยแล้ว');
  };

  const handleGenerateAiComment = async () => {
    if (activeStudentCommentIdx === null) return;
    setIsGeneratingAi(true);
    try {
      const current = evaluations[activeStudentCommentIdx];
      const prompt = `คุณคือผู้ช่วยครูปฐมวัยโรงเรียนสมคิดวิทยา กรุณาเขียนข้อความสรุปพัฒนาการเด็กสั้นๆ สละสลวย ทางการและอบอุ่นสำหรับใส่ในสมุดรายงานพัฒนาการ
ชื่อนักเรียน: ${current.student_name}
พัฒนาการ 4 ด้าน: ร่างกาย=${current.physical_score}/3, อารมณ์=${current.emotional_score}/3, สังคม=${current.social_score}/3, สติปัญญา=${current.intellectual_score}/3
สุขอนามัย: การดื่มนม=${current.milk_drinking}, การนอนกลางวัน=${current.nap_habit}, รูปร่าง=${current.growth_status}
หมายเหตุพฤติกรรมจากครู: ${aiDraftPrompt || 'ร่าเริงแจ่มใส ชอบทำกิจกรรมและเล่นกับเพื่อน มีน้ำใจช่วยเหลือผู้อื่น'}
ตอบเฉพาะข้อความสรุปความยาว 2-3 บรรทัด`;

      const res = await fetch('/api/academic/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt }),
      });
      const data = await res.json();
      const generatedText =
        data.response ||
        data.text ||
        'นักเรียนมีพัฒนาการสมวัยในทุกด้าน ร่าเริงแจ่มใส เข้ากับเพื่อนได้เป็นอย่างดี มีวินัยในการทำกิจวัตรประจำวัน';

      handleFieldChange(
        activeStudentCommentIdx,
        'teacher_comment',
        generatedText
      );
      toast.success('น้องฟ้าช่วยเขียนสรุปพัฒนาการเรียบร้อยแล้ว');
      setActiveStudentCommentIdx(null);
      setAiDraftPrompt('');
    } catch {
      toast.error('ไม่สามารถสร้างข้อความ AI ได้');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const totalStudents = evaluations.length;
  const allGoodCount = evaluations.filter(
    (e) =>
      e.physical_score === 3 &&
      e.emotional_score === 3 &&
      e.social_score === 3 &&
      e.intellectual_score === 3
  ).length;
  const normalGrowthCount = evaluations.filter(
    (e) => e.growth_status === 'สมส่วน'
  ).length;
  const milkFullCount = evaluations.filter(
    (e) => e.milk_drinking === 'หมดกล่อง'
  ).length;

  return (
    <div className="sv-container-context min-h-[100dvh] bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Link
                href="/academic"
                className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#7B1C3E]/10 text-[#7B1C3E] dark:text-amber-300 border border-[#7B1C3E]/20 hover:bg-[#7B1C3E]/20 transition-all inline-flex items-center gap-1.5"
              >
                Somkid Academic Studio
              </Link>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs text-slate-500 font-medium">
                {isThai ? 'ระบบปฐมวัย (Early Years Hub)' : 'Early Years Studio'}
              </span>
            </div>
            <h1 className="sv-fluid-title text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
              <Baby className="w-8 h-8 text-[#7B1C3E]" />
              {isThai
                ? 'สมุดบันทึกกิจวัตรปฐมวัยรายวัน & ประเมินพัฒนาการ 4 ด้าน'
                : 'Early Years Daily Care Pipeline & 4-Domain Assessment'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              {isThai
                ? 'เชื่อมโยงบันทึกฝากครูตอนเช้าจากผู้ปกครอง • รายงานกิน-นอน-ขับถ่าย-กิจกรรมรายวัน • ประเมินพัฒนาการ 4 ด้านรายภาคเรียน'
                : 'Connected with Parent Morning Drop-off Notes, Daily Care Reports, PDPA Photo Guard, and Term 4-Domain Evaluation'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/parents"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-[#7B1C3E] dark:text-amber-300 border border-[#D4AF37]/40 text-xs font-bold hover:bg-amber-100 transition-all"
            >
              <ExternalLink className="w-4 h-4" />
              {isThai
                ? 'ดูสมุดพกในมุมมองผู้ปกครอง (/parents)'
                : 'View in Parents Portal'}
            </Link>
          </div>
        </div>

        {/* Top Mode Switcher (2 Modes) */}
        <div className="flex flex-wrap gap-3 bg-white dark:bg-slate-900 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <button
            type="button"
            onClick={() => setActiveMode('daily_care')}
            className={`flex-1 min-w-[260px] py-3 px-4 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeMode === 'daily_care'
                ? 'bg-[#7B1C3E] text-white shadow-md shadow-[#7B1C3E]/20'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <MessageSquareHeart className="w-4 h-4" />
            {isThai
              ? 'สมุดบันทึกกิจวัตรปฐมวัยรายวัน (Daily Care & Morning Drop-off Pipeline)'
              : 'Mode 1: Daily Care & Morning Drop-off Pipeline'}
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('term_evaluation')}
            className={`flex-1 min-w-[260px] py-3 px-4 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeMode === 'term_evaluation'
                ? 'bg-[#7B1C3E] text-white shadow-md shadow-[#7B1C3E]/20'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            {isThai
              ? 'ประเมินพัฒนาการ 4 ด้านรายภาคเรียน (Term 4-Domain Evaluation & AI Assistant)'
              : 'Mode 2: Term 4-Domain Evaluation & AI Assistant'}
          </button>
        </div>

        {/* ===================================================================== */}
        {/* MODE 1: Daily Care & Morning Drop-off Pipeline (Default Active Tab)    */}
        {/* ===================================================================== */}
        {activeMode === 'daily_care' && (
          <div className="space-y-6">
            {/* Section A: Parent Morning Drop-off Notes */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border-2 border-amber-300/70 dark:border-amber-800/60 shadow-sm space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-[#7B1C3E] dark:text-amber-300">
                    <MessageSquareHeart className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                      {isThai
                        ? 'บันทึกฝากครูตอนเช้าจากผู้ปกครอง (Parent Morning Drop-off Notes)'
                        : 'Parent Morning Drop-off Notes'}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {isThai
                        ? 'ข้อมูลสุขภาพเมื่อคืน การทานอาหารเช้า อารมณ์ และข้อควรระวังแพ้อาหารที่ผู้ปกครองส่งมาจาก /parents'
                        : 'Live morning check-in notes submitted by parents from /parents'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {pipeline.dropoff_notes.map((note) => {
                  const isAcked = Boolean(note.acknowledged_at);
                  return (
                    <div
                      key={note.id}
                      className="p-5 rounded-2xl bg-amber-50/50 dark:bg-slate-800/60 border border-amber-200 dark:border-slate-700 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-[#7B1C3E] text-white">
                            {note.grade_level}
                          </span>
                          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                            {note.student_name}
                          </h3>
                          <span className="text-xs text-slate-500">
                            • ส่งโดย {note.guardian_name} ({note.note_date})
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                            <span className="text-slate-400 block text-[11px] mb-1">
                              {isThai ? 'ชั่วโมงการนอนเมื่อคืน' : 'Sleep Hours'}
                            </span>
                            <strong className="text-slate-900 dark:text-white inline-flex items-center gap-1.5 font-bold">
                              <Moon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              <span>{note.sleep_hours} {isThai ? 'ชั่วโมง' : 'hours'}</span>
                            </strong>
                          </div>
                          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                            <span className="text-slate-400 block text-[11px] mb-1">
                              {isThai ? 'อาหารเช้าจากบ้าน' : 'Breakfast'}
                            </span>
                            <strong className="text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1.5 font-bold">
                              <Utensils className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              <span>{note.ate_breakfast
                                ? (isThai ? 'ทานเรียบร้อยแล้ว' : 'Ate at home')
                                : (isThai ? 'ยังไม่ได้ทาน' : 'Not yet')}</span>
                            </strong>
                          </div>
                          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                            <span className="text-slate-400 block text-[11px] mb-1">
                              {isThai ? 'อารมณ์เช้านี้' : 'Morning Mood'}
                            </span>
                            <strong className="text-slate-900 dark:text-white inline-flex items-center gap-1.5 font-bold">
                              <Smile className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span>{note.morning_mood}</span>
                            </strong>
                          </div>
                          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                            <span className="text-slate-400 block text-[11px] mb-1">
                              {isThai ? 'ผู้มารับกลับวันนี้' : 'Pickup Today'}
                            </span>
                            <strong className="text-slate-900 dark:text-white inline-flex items-center gap-1.5 font-bold">
                              <Clock className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                              <span>{note.pickup_person_today}</span>
                            </strong>
                          </div>
                        </div>

                        {note.special_note && (
                          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-bold text-rose-800 dark:text-rose-200 flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>
                              ข้อควรระวังพิเศษ/แพ้อาหาร: {note.special_note}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {isAcked && (
                          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            รับทราบโดย {note.acknowledged_by_teacher}
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            handleAcknowledgeDropoff(note.id, note.student_name)
                          }
                          className="px-4 py-2.5 rounded-xl bg-[#7B1C3E] hover:bg-[#631430] text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                          {isThai
                            ? 'ครูรับทราบแล้ว (Acknowledge)'
                            : 'Acknowledge Drop-off Note'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section B: Classroom Daily Care Batch & Individual Editor */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <Baby className="w-5 h-5 text-[#7B1C3E]" />
                    {isThai
                      ? 'สมุดพกอนุบาลรายวันรายบุคคล & แบบกลุ่ม (Classroom Daily Care Editor)'
                      : 'Classroom Daily Care Batch & Individual Editor'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {isThai
                      ? 'บันทึกมื้ออาหาร นม การนอนกลางวัน การขับถ่าย อุณหภูมิ กิจกรรมเสริมประสบการณ์ พร้อมตรวจสอบสิทธิ์ภาพถ่าย PDPA อัตโนมัติ'
                      : 'Record meals, milk, nap, toilet, temperature, learning activities, with automatic PDPA photo consent verification'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCareDrafts((prev) =>
                        prev.map((c) => ({
                          ...c,
                          lunch_status: 'ALL',
                          milk_morning: 'ALL',
                          milk_afternoon: 'ALL',
                          nap_quality: 'SOUND',
                        }))
                      );
                      toast.success(
                        isThai
                          ? 'ตั้งค่าด่วน: ทานอาหารหมดถาด + ดื่มนมหมด + นอนหลับสนิท ทั้งห้อง!'
                          : 'Batch set all meals, milk, and nap to optimal!'
                      );
                    }}
                    className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-[#7B1C3E] border border-[#D4AF37]/40 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {isThai
                      ? 'ตั้งค่าด่วนทั้งห้อง (ทานหมด + นอนหลับสนิท)'
                      : 'Quick Fill All Optimal'}
                  </button>

                  <button
                    type="button"
                    onClick={handleBatchPublishAllCare}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {isThai
                      ? 'บันทึกและส่งรายงานทั้งห้องไปยัง Parents Portal'
                      : 'Publish All to Parents Portal'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {careDrafts.map((care) => {
                  const internalPhotoConsent = pipeline.consents.find(
                    (c) =>
                      c.student_id === care.student_id &&
                      c.purpose_code === 'PHOTO_INTERNAL'
                  );
                  const publicPrConsent = pipeline.consents.find(
                    (c) =>
                      c.student_id === care.student_id &&
                      c.purpose_code === 'PHOTO_PUBLIC_PR'
                  );
                  const allowInternalPhoto = internalPhotoConsent
                    ? internalPhotoConsent.is_granted
                    : true;
                  const allowPublicPhoto = publicPrConsent
                    ? publicPrConsent.is_granted
                    : true;

                  return (
                    <div
                      key={care.id}
                      className="p-6 rounded-3xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-4"
                    >
                      {/* Top Student Row + PDPA Photo Consent Badge */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200/70 dark:border-slate-700 pb-3">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="px-3 py-1 rounded-xl bg-[#7B1C3E] text-white font-extrabold text-xs">
                            {care.class_id}
                          </span>
                          <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                            {care.student_name}{' '}
                            <span className="text-[#7B1C3E] dark:text-amber-300">
                              ({care.nickname})
                            </span>
                          </h3>
                          <span className="text-xs font-mono text-slate-400">
                            #{care.student_id}
                          </span>
                        </div>

                        {/* PDPA Photo Consent Badges */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 ${
                              allowInternalPhoto
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            <Camera className="w-3.5 h-3.5" />
                            {allowInternalPhoto
                              ? isThai
                                ? 'PDPA ภาพรายงานผปค.: อนุญาต'
                                : 'Internal Photo: Granted'
                              : isThai
                              ? 'PDPA ภาพรายงานผปค.: ไม่อนุญาต'
                              : 'Internal Photo: Revoked'}
                          </span>

                          <span
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 ${
                              allowPublicPhoto
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            {allowPublicPhoto
                              ? isThai
                                ? 'PDPA ภาพเพจโรงเรียน: อนุญาต'
                                : 'Public PR Photo: Granted'
                              : isThai
                              ? 'PDPA ภาพเพจโรงเรียน: ห้ามเผยแพร่'
                              : 'Public PR Photo: Do Not Publish'}
                          </span>
                        </div>
                      </div>

                      {/* Quick Selectors Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                        {/* Morning Mood */}
                        <div>
                          <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                            {isThai ? 'อารมณ์ (Mood)' : 'Morning Mood'}
                          </label>
                          <select
                            value={care.morning_mood}
                            onChange={(e) =>
                              handleCareDraftChange(
                                care.student_id,
                                'morning_mood',
                                e.target.value as EarlyYearsMood
                              )
                            }
                            className="w-full p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold"
                          >
                            <option value="CHEERFUL">ร่าเริงสดใส (CHEERFUL)</option>
                            <option value="CALM">สงบเรียบร้อย (CALM)</option>
                            <option value="TIRED">ง่วงนอน/เพลีย (TIRED)</option>
                            <option value="CLINGY">คิดถึงบ้าน (CLINGY)</option>
                            <option value="UNWELL">ไม่สบายตัว (UNWELL)</option>
                          </select>
                        </div>

                        {/* Breakfast */}
                        <div>
                          <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                            {isThai ? 'อาหารเช้า (Breakfast)' : 'Breakfast'}
                          </label>
                          <select
                            value={care.breakfast_status}
                            onChange={(e) =>
                              handleCareDraftChange(
                                care.student_id,
                                'breakfast_status',
                                e.target.value as MealConsumptionStatus
                              )
                            }
                            className="w-full p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold"
                          >
                            <option value="ALL">ทานหมด (ALL)</option>
                            <option value="HALF">ครึ่งถาด (HALF)</option>
                            <option value="LITTLE">เล็กน้อย (LITTLE)</option>
                            <option value="NONE">ไม่ทาน (NONE)</option>
                          </select>
                        </div>

                        {/* Lunch */}
                        <div>
                          <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                            {isThai ? 'อาหารกลางวัน (Lunch)' : 'Lunch'}
                          </label>
                          <select
                            value={care.lunch_status}
                            onChange={(e) =>
                              handleCareDraftChange(
                                care.student_id,
                                'lunch_status',
                                e.target.value as MealConsumptionStatus
                              )
                            }
                            className="w-full p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold"
                          >
                            <option value="ALL">ทานหมดถาด (ALL)</option>
                            <option value="HALF">ครึ่งถาด (HALF)</option>
                            <option value="LITTLE">เล็กน้อย (LITTLE)</option>
                            <option value="NONE">ไม่ทาน (NONE)</option>
                          </select>
                        </div>

                        {/* Morning & Afternoon Milk */}
                        <div>
                          <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                            {isThai ? 'ดื่มนม เช้า/บ่าย' : 'Milk AM/PM'}
                          </label>
                          <select
                            value={care.milk_morning}
                            onChange={(e) => {
                              const val = e.target.value as MilkConsumptionStatus;
                              handleCareDraftChange(
                                care.student_id,
                                'milk_morning',
                                val
                              );
                              handleCareDraftChange(
                                care.student_id,
                                'milk_afternoon',
                                val
                              );
                            }}
                            className="w-full p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold"
                          >
                            <option value="ALL">หมดกล่อง (ALL)</option>
                            <option value="HALF">ครึ่งกล่อง (HALF)</option>
                            <option value="NONE">ไม่ดื่ม (NONE)</option>
                          </select>
                        </div>

                        {/* Nap Quality */}
                        <div>
                          <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                            {isThai ? 'การนอนกลางวัน (Nap)' : 'Nap Quality'}
                          </label>
                          <select
                            value={care.nap_quality}
                            onChange={(e) =>
                              handleCareDraftChange(
                                care.student_id,
                                'nap_quality',
                                e.target.value as NapQualityStatus
                              )
                            }
                            className="w-full p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold"
                          >
                            <option value="SOUND">
                              หลับสนิท ({care.nap_start}-{care.nap_end})
                            </option>
                            <option value="RESTLESS">หลับๆ ตื่นๆ (RESTLESS)</option>
                            <option value="NO_NAP">ไม่นอน (NO_NAP)</option>
                          </select>
                        </div>

                        {/* Toilet & Temperature */}
                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                              {isThai ? 'ห้องน้ำ' : 'Toilet'}
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={care.toilet_count}
                              onChange={(e) =>
                                handleCareDraftChange(
                                  care.student_id,
                                  'toilet_count',
                                  Number(e.target.value)
                                )
                              }
                              className="w-full p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-center"
                            />
                          </div>
                          <div>
                            <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                              °C
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              value={care.temperature_c}
                              onChange={(e) =>
                                handleCareDraftChange(
                                  care.student_id,
                                  'temperature_c',
                                  Number(e.target.value)
                                )
                              }
                              className="w-full p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono font-bold text-center"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Learning Activity, Home Suggestion, Teacher Note */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        <div>
                          <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                            {isThai
                              ? 'กิจกรรมเสริมประสบการณ์วันนี้ (Learning Activity):'
                              : 'Learning Activity:'}
                          </label>
                          <input
                            type="text"
                            value={care.learning_activity}
                            onChange={(e) =>
                              handleCareDraftChange(
                                care.student_id,
                                'learning_activity',
                                e.target.value
                              )
                            }
                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                            {isThai
                              ? 'คำแนะนำกิจกรรมต่อยอดที่บ้าน (Home Suggestion):'
                              : 'Home Suggestion:'}
                          </label>
                          <input
                            type="text"
                            value={care.home_suggestion}
                            onChange={(e) =>
                              handleCareDraftChange(
                                care.student_id,
                                'home_suggestion',
                                e.target.value
                              )
                            }
                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                            {isThai
                              ? 'บันทึกจากครูประจำชั้นถึงคุณแม่ (Teacher Note):'
                              : 'Teacher Note:'}
                          </label>
                          <input
                            type="text"
                            value={care.teacher_note}
                            onChange={(e) =>
                              handleCareDraftChange(
                                care.student_id,
                                'teacher_note',
                                e.target.value
                              )
                            }
                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                          />
                        </div>
                      </div>

                      {/* Publish Action Row */}
                      <div className="flex items-center justify-between pt-2">
                        <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {care.published_at
                            ? `ส่งรายงานล่าสุดเมื่อ ${new Date(
                                care.published_at
                              ).toLocaleTimeString('th-TH', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })} น.`
                            : 'พร้อมส่งรายงาน'}
                        </span>

                        <button
                          type="button"
                          onClick={() => handlePublishSingleCare(care)}
                          className="px-5 py-2.5 rounded-xl bg-[#7B1C3E] hover:bg-[#631430] text-white text-xs font-extrabold flex items-center gap-2 shadow-md cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          {isThai
                            ? 'บันทึกและส่งรายงานประจำวันไปยัง Parents Portal'
                            : 'Save & Send Daily Care to Parents Portal'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* MODE 2: Term 4-Domain Evaluation & AI Assistant (Preserved 100%)      */}
        {/* ===================================================================== */}
        {activeMode === 'term_evaluation' && (
          <div className="space-y-6">
            {/* Batch Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                {isSaving ? (
                  <span className="text-xs text-amber-600 animate-pulse font-medium">
                    กำลังบันทึก...
                  </span>
                ) : lastSavedTime ? (
                  <span className="text-xs text-emerald-600 font-medium">
                    บันทึกแล้ว ({lastSavedTime})
                  </span>
                ) : (
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    ประเมินพัฒนาการ 4 ด้านรายภาคเรียน (ร่างกาย • อารมณ์ • สังคม • สติปัญญา)
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleBatchSetAllGood}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#7B1C3E] hover:bg-[#631430] text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  ตั้งค่าทุกคน: ดี (3) ทั้งห้อง
                </button>
                <button
                  onClick={handleBatchSetMilk}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
                >
                  <Utensils className="w-3.5 h-3.5" />
                  ดื่มนมหมดกล่องทุกคน
                </button>
                <button
                  onClick={handleBatchSetNap}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
                >
                  <Moon className="w-3.5 h-3.5" />
                  นอนหลับสนิททุกคน
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#7B1C3E]/10 flex items-center justify-center text-[#7B1C3E] shrink-0">
                  <Baby className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">
                    นักเรียนปฐมวัย
                  </p>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                    {totalStudents}
                  </h3>
                  <p className="text-[11px] text-slate-400">ในห้องเรียนที่เลือก</p>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-pink-50 dark:bg-pink-950/40 flex items-center justify-center text-pink-600 shrink-0">
                  <Smile className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">
                    พัฒนาการดีทุกด้าน
                  </p>
                  <h3 className="text-2xl font-bold text-pink-700 dark:text-pink-400">
                    {allGoodCount}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {totalStudents > 0
                      ? Math.round((allGoodCount / totalStudents) * 100)
                      : 0}
                    % ระดับ 3 ทั้ง 4 ด้าน
                  </p>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 shrink-0">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">
                    ภาวะสมส่วนตามเกณฑ์
                  </p>
                  <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {normalGrowthCount}
                  </h3>
                  <p className="text-[11px] text-slate-400">เกณฑ์กรมอนามัย</p>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 shrink-0">
                  <Utensils className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">
                    ดื่มนมหมดกล่อง
                  </p>
                  <h3 className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {milkFullCount}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {totalStudents > 0
                      ? Math.round((milkFullCount / totalStudents) * 100)
                      : 0}
                    % มีสุขนิสัยที่ดี
                  </p>
                </div>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <label
                  htmlFor="early-years-class-select"
                  className="block text-xs font-medium text-slate-500 mb-1"
                >
                  ระดับชั้นอนุบาล
                </label>
                <select
                  id="early-years-class-select"
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-slate-900 dark:text-white"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="early-years-term-select"
                  className="block text-xs font-medium text-slate-500 mb-1"
                >
                  ภาคเรียน
                </label>
                <select
                  id="early-years-term-select"
                  value={selectedTerm}
                  onChange={(e) => setSelectedTerm(e.target.value)}
                  className="text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-slate-900 dark:text-white"
                >
                  <option value="1">ภาคเรียนที่ 1</option>
                  <option value="2">ภาคเรียนที่ 2</option>
                </select>
              </div>

              <div className="ml-auto text-xs text-slate-500 flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <strong className="text-pink-600">3:</strong> ดี
                </span>
                <span className="flex items-center gap-1.5">
                  <strong className="text-blue-600">2:</strong> พอใช้
                </span>
                <span className="flex items-center gap-1.5">
                  <strong className="text-amber-600">1:</strong> ควรส่งเสริม
                </span>
              </div>
            </div>

            {/* Evaluations Grid */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              {isLoading ? (
                <div className="p-12 text-center text-sm text-slate-500">
                  กำลังโหลดข้อมูลพัฒนาการ...
                </div>
              ) : evaluations.length === 0 ? (
                <div className="p-12 text-center text-sm text-slate-500">
                  ไม่พบรายชื่อนักเรียนในห้องนี้
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-pink-50/50 dark:bg-pink-950/20 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                        <th className="py-3 px-3 text-center w-12">เลขที่</th>
                        <th className="py-3 px-4 min-w-[160px]">
                          ชื่อ-สกุล นักเรียน
                        </th>
                        <th className="py-3 px-3 text-center w-24 text-pink-700 font-bold">
                          1. ร่างกาย
                        </th>
                        <th className="py-3 px-3 text-center w-24 text-rose-700 font-bold">
                          2. อารมณ์
                        </th>
                        <th className="py-3 px-3 text-center w-24 text-indigo-700 font-bold">
                          3. สังคม
                        </th>
                        <th className="py-3 px-3 text-center w-24 text-purple-700 font-bold">
                          4. สติปัญญา
                        </th>
                        <th className="py-3 px-3 text-center w-36">
                          น้ำหนัก / ส่วนสูง
                        </th>
                        <th className="py-3 px-3 text-center w-28">
                          ภาวะเจริญเติบโต
                        </th>
                        <th className="py-3 px-3 text-center w-28">
                          ดื่มนม / นอน
                        </th>
                        <th className="py-3 px-4 min-w-[200px]">
                          ความเห็นครู / AI สรุป
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {evaluations.map((row, idx) => (
                        <tr
                          key={row.student_id}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20"
                        >
                          <td className="py-2.5 px-3 text-center font-bold text-slate-500">
                            {row.roll_number || idx + 1}
                          </td>
                          <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-white">
                            {row.student_name}
                          </td>

                          <td className="py-2 px-3 text-center">
                            <select
                              value={row.physical_score}
                              onChange={(e) =>
                                handleFieldChange(
                                  idx,
                                  'physical_score',
                                  Number(e.target.value)
                                )
                              }
                              className="font-bold text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1 text-slate-900 dark:text-white"
                            >
                              <option value="3">3 (ดี)</option>
                              <option value="2">2 (พอใช้)</option>
                              <option value="1">1 (ปรับปรุง)</option>
                            </select>
                          </td>

                          <td className="py-2 px-3 text-center">
                            <select
                              value={row.emotional_score}
                              onChange={(e) =>
                                handleFieldChange(
                                  idx,
                                  'emotional_score',
                                  Number(e.target.value)
                                )
                              }
                              className="font-bold text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1 text-slate-900 dark:text-white"
                            >
                              <option value="3">3 (ดี)</option>
                              <option value="2">2 (พอใช้)</option>
                              <option value="1">1 (ปรับปรุง)</option>
                            </select>
                          </td>

                          <td className="py-2 px-3 text-center">
                            <select
                              value={row.social_score}
                              onChange={(e) =>
                                handleFieldChange(
                                  idx,
                                  'social_score',
                                  Number(e.target.value)
                                )
                              }
                              className="font-bold text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1 text-slate-900 dark:text-white"
                            >
                              <option value="3">3 (ดี)</option>
                              <option value="2">2 (พอใช้)</option>
                              <option value="1">1 (ปรับปรุง)</option>
                            </select>
                          </td>

                          <td className="py-2 px-3 text-center">
                            <select
                              value={row.intellectual_score}
                              onChange={(e) =>
                                handleFieldChange(
                                  idx,
                                  'intellectual_score',
                                  Number(e.target.value)
                                )
                              }
                              className="font-bold text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1 text-slate-900 dark:text-white"
                            >
                              <option value="3">3 (ดี)</option>
                              <option value="2">2 (พอใช้)</option>
                              <option value="1">1 (ปรับปรุง)</option>
                            </select>
                          </td>

                          <td className="py-2 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                step="0.1"
                                value={row.weight_kg ?? ''}
                                onChange={(e) =>
                                  handleFieldChange(
                                    idx,
                                    'weight_kg',
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className="w-14 text-center p-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                                placeholder="กก."
                              />
                              <span className="text-slate-400">/</span>
                              <input
                                type="number"
                                step="0.5"
                                value={row.height_cm ?? ''}
                                onChange={(e) =>
                                  handleFieldChange(
                                    idx,
                                    'height_cm',
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className="w-14 text-center p-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                                placeholder="ซม."
                              />
                            </div>
                          </td>

                          <td className="py-2 px-3 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${row.growth_badge}`}
                            >
                              {row.growth_status}
                            </span>
                          </td>

                          <td className="py-2 px-3 text-center text-[11px] text-slate-600 dark:text-slate-400">
                            <div>
                              นม: <strong>{row.milk_drinking}</strong>
                            </div>
                            <div>
                              นอน: <strong>{row.nap_habit}</strong>
                            </div>
                          </td>

                          <td className="py-2 px-4">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={row.teacher_comment || ''}
                                onChange={(e) =>
                                  handleFieldChange(
                                    idx,
                                    'teacher_comment',
                                    e.target.value
                                  )
                                }
                                placeholder="ข้อความสรุปพัฒนาการ..."
                                className="w-full text-xs p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                              />
                              <button
                                onClick={() => {
                                  setActiveStudentCommentIdx(idx);
                                  setAiDraftPrompt(row.teacher_comment || '');
                                }}
                                className="p-1.5 rounded-lg bg-pink-50 hover:bg-pink-100 text-pink-600 flex-shrink-0"
                                title="ให้น้องฟ้าช่วยเขียนข้อความพัฒนาการ"
                              >
                                <Sparkles className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* AI Comment Assistant Modal */}
        {activeStudentCommentIdx !== null && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">
                    น้องฟ้า ช่วยเขียนสรุปพัฒนาการ
                  </h3>
                  <p className="text-xs text-slate-500">
                    {evaluations[activeStudentCommentIdx]?.student_name}
                  </p>
                </div>
              </div>

              <div>
                <label
                  htmlFor="ai-keywords-input"
                  className="block text-xs font-medium text-slate-500 mb-1"
                >
                  พิมพ์คำสำคัญสั้นๆ หรือสิ่งที่ต้องการเน้น (ถ้ามี):
                </label>
                <textarea
                  id="ai-keywords-input"
                  rows={3}
                  value={aiDraftPrompt}
                  onChange={(e) => setAiDraftPrompt(e.target.value)}
                  placeholder="เช่น พูดจาไพเราะ มีสมาธิฟังนิทาน ชอบวาดรูปแบ่งปันเพื่อน..."
                  className="w-full text-xs p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setActiveStudentCommentIdx(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleGenerateAiComment}
                  disabled={isGeneratingAi}
                  className="px-5 py-2 bg-gradient-to-r from-pink-600 to-rose-600 text-white rounded-xl text-xs font-semibold shadow-md flex items-center gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {isGeneratingAi ? 'กำลังเรียบเรียง...' : 'สร้างข้อความ'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function EarlyYearsAssessmentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-8 text-slate-500">
          <div className="flex items-center gap-3">
            <Baby className="w-5 h-5 text-pink-600 animate-pulse" />
            <span>กำลังโหลดระบบประเมินพัฒนาการปฐมวัย...</span>
          </div>
        </div>
      }
    >
      <EarlyYearsAssessmentContent />
    </Suspense>
  );
}
