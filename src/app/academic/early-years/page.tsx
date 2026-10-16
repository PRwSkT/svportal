'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  Baby, 
  Save, 
  Sparkles, 
  CheckCircle2, 
  ChevronRight, 
  Heart, 
  Activity, 
  Smile, 
  Brain,
  MessageSquare,
  Mic,
  RotateCcw,
  ArrowLeft,
  CheckCheck,
  Moon,
  Users,
  Award,
  Utensils
} from 'lucide-react';
import { toast } from 'sonner';
import { evaluateEarlyYearsGrowth } from '@/lib/academic/calculation';
import { DEFAULT_ACADEMIC_YEAR } from '@/lib/constants/school';
import Link from 'next/link';

function EarlyYearsAssessmentContent() {
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedTerm, setSelectedTerm] = useState<string>('1');

  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // AI Comment Generator modal/state
  const [activeStudentCommentIdx, setActiveStudentCommentIdx] = useState<number | null>(null);
  const [aiDraftPrompt, setAiDraftPrompt] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const searchParams = useSearchParams();
  const paramClassId = searchParams.get('class_id') || searchParams.get('classId');
  const paramTerm = searchParams.get('term');

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (paramTerm && ['1', '2'].includes(paramTerm)) {
      setSelectedTerm(paramTerm);
    }
  }, [paramTerm]);

  // 1. Load Kindergarten Classes
  useEffect(() => {
    async function loadClasses() {
      try {
        const res = await fetch(`/api/academic/classes?year=${DEFAULT_ACADEMIC_YEAR}&department=kindergarten`);
        if (res.ok) {
          const d = await res.json();
          const clsList = d.classes || [];
          setClasses(clsList);
          if (clsList.length > 0) {
            const defaultId = paramClassId && clsList.some((c: any) => c.id === paramClassId)
              ? paramClassId
              : clsList[0].id;
            setSelectedClassId(defaultId);
          }
        }
      } catch (e) {
        toast.error('โหลดห้องเรียนปฐมวัยไม่สำเร็จ');
      }
    }
    loadClasses();
  }, [paramClassId]);

  // 2. Load Evaluations for selected class & term
  const loadEvaluations = useCallback(async (classId: string, term: string) => {
    if (!classId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/academic/early-years?class_id=${classId}&term=${term}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'โหลดข้อมูลไม่สำเร็จ');

      const enrollments = data.enrollments || [];
      const existingEvals = data.evaluations || [];
      const evalMap = new Map(existingEvals.map((e: any) => [e.student_id, e as any]));

      const combined = enrollments.map((enr: any) => {
        const existing = evalMap.get(enr.student_id) as any;
        const w = existing?.weight_kg || 16;
        const h = existing?.height_cm || 105;
        const growth = evaluateEarlyYearsGrowth({
          gender: enr.student?.gender || 'male',
          ageYears: 4,
          weightKg: w,
          heightCm: h
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
          teacher_comment: existing?.teacher_comment || ''
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

  // 3. Field Change Handler & Auto-save
  const handleFieldChange = (index: number, field: string, value: any) => {
    const updated = [...evaluations];
    const item = { ...updated[index], [field]: value };

    if (field === 'weight_kg' || field === 'height_cm') {
      const growth = evaluateEarlyYearsGrowth({
        gender: item.student_gender,
        ageYears: 4,
        weightKg: Number(item.weight_kg) || 16,
        heightCm: Number(item.height_cm) || 105
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
        body: JSON.stringify({ evaluations: dataToSave })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'บันทึกไม่สำเร็จ');

      setLastSavedTime(new Date().toLocaleTimeString('th-TH'));
    } catch (e: any) {
      console.error('Save early years error:', e);
      toast.error('บันทึกอัตโนมัติไม่สำเร็จ: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 4. Batch Quick-Fill
  const handleBatchSetAllGood = () => {
    const updated = evaluations.map(item => ({
      ...item,
      physical_score: 3,
      emotional_score: 3,
      social_score: 3,
      intellectual_score: 3
    }));
    setEvaluations(updated);
    triggerSave(updated);
    toast.success('ตั้งค่าเริ่มต้นพัฒนาการทุกคนเป็น: ดี (3) เรียบร้อยแล้ว');
  };

  const handleBatchSetMilk = () => {
    const updated = evaluations.map(item => ({
      ...item,
      milk_drinking: 'หมดกล่อง'
    }));
    setEvaluations(updated);
    triggerSave(updated);
    toast.success('บันทึกการดื่มนมทุกคนเป็น: หมดกล่อง เรียบร้อยแล้ว');
  };

  const handleBatchSetNap = () => {
    const updated = evaluations.map(item => ({
      ...item,
      nap_habit: 'หลับสนิท'
    }));
    setEvaluations(updated);
    triggerSave(updated);
    toast.success('บันทึกการนอนกลางวันทุกคนเป็น: หลับสนิท เรียบร้อยแล้ว');
  };

  // 5. AI Narrative Comment Assistant
  const handleGenerateAiComment = async () => {
    if (activeStudentCommentIdx === null) return;
    setIsGeneratingAi(true);
    try {
      const current = evaluations[activeStudentCommentIdx];
      // Generate prompt for Gemini
      const prompt = `คุณคือผู้ช่วยครูปฐมวัยโรงเรียนสมคิดวิทยา กรุณาเขียนข้อความสรุปพัฒนาการเด็กสั้นๆ สละสลวย ทางการและอบอุ่นสำหรับใส่ในสมุดรายงานพัฒนาการ
ชื่อนักเรียน: ${current.student_name}
พัฒนาการ 4 ด้าน: ร่างกาย=${current.physical_score}/3, อารมณ์=${current.emotional_score}/3, สังคม=${current.social_score}/3, สติปัญญา=${current.intellectual_score}/3
สุขอนามัย: การดื่มนม=${current.milk_drinking}, การนอนกลางวัน=${current.nap_habit}, รูปร่าง=${current.growth_status}
หมายเหตุพฤติกรรมจากครู: ${aiDraftPrompt || 'ร่าเริงแจ่มใส ชอบทำกิจกรรมและเล่นกับเพื่อน มีน้ำใจช่วยเหลือผู้อื่น'}
ตอบเฉพาะข้อความสรุปความยาว 2-3 บรรทัด`;

      const res = await fetch('/api/academic/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt })
      });
      const data = await res.json();
      const generatedText = data.response || data.text || 'นักเรียนมีพัฒนาการสมวัยในทุกด้าน ร่าเริงแจ่มใส เข้ากับเพื่อนได้เป็นอย่างดี มีวินัยในการทำกิจวัตรประจำวัน';

      handleFieldChange(activeStudentCommentIdx, 'teacher_comment', generatedText);
      toast.success('น้องฟ้าช่วยเขียนสรุปพัฒนาการเรียบร้อยแล้ว');
      setActiveStudentCommentIdx(null);
      setAiDraftPrompt('');
    } catch (e: any) {
      toast.error('ไม่สามารถสร้างข้อความ AI ได้');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const totalStudents = evaluations.length;
  const allGoodCount = evaluations.filter(e => e.physical_score === 3 && e.emotional_score === 3 && e.social_score === 3 && e.intellectual_score === 3).length;
  const normalGrowthCount = evaluations.filter(e => e.growth_status === 'สมส่วน').length;
  const milkFullCount = evaluations.filter(e => e.milk_drinking === 'หมดกล่อง').length;

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
              <span className="text-xs text-slate-500 font-medium">ระบบปฐมวัย</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
              <Baby className="w-8 h-8 text-[#7B1C3E]" />
              สมุดรายงานพัฒนาการเด็กปฐมวัย (เตรียมอนุบาล – อ.3)
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              บันทึกและประเมินพัฒนาการ 4 ด้าน, ภาวะการเจริญเติบโต, กิจวัตรประจำวัน พร้อม AI สรุปพัฒนาการรายบุคคล
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isSaving ? (
              <span className="text-xs text-amber-600 animate-pulse font-medium">กำลังบันทึก...</span>
            ) : lastSavedTime ? (
              <span className="text-xs text-emerald-600 font-medium">บันทึกแล้ว ({lastSavedTime})</span>
            ) : null}

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
              <p className="text-xs font-medium text-slate-500">นักเรียนปฐมวัย</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{totalStudents}</h3>
              <p className="text-[11px] text-slate-400">ในห้องเรียนที่เลือก</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-pink-50 dark:bg-pink-950/40 flex items-center justify-center text-pink-600 shrink-0">
              <Smile className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">พัฒนาการดีทุกด้าน</p>
              <h3 className="text-2xl font-bold text-pink-700 dark:text-pink-400">{allGoodCount}</h3>
              <p className="text-[11px] text-slate-400">{totalStudents > 0 ? Math.round((allGoodCount / totalStudents) * 100) : 0}% ระดับ 3 ทั้ง 4 ด้าน</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 shrink-0">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">ภาวะสมส่วนตามเกณฑ์</p>
              <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{normalGrowthCount}</h3>
              <p className="text-[11px] text-slate-400">เกณฑ์กรมอนามัย</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 shrink-0">
              <Utensils className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">ดื่มนมหมดกล่อง</p>
              <h3 className="text-2xl font-bold text-blue-600 dark:text-blue-400">{milkFullCount}</h3>
              <p className="text-[11px] text-slate-400">{totalStudents > 0 ? Math.round((milkFullCount / totalStudents) * 100) : 0}% มีสุขนิสัยที่ดี</p>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <div>
            <label htmlFor="early-years-class-select" className="block text-xs font-medium text-slate-500 mb-1">ระดับชั้นอนุบาล</label>
            <select
              id="early-years-class-select"
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-slate-900 dark:text-white"
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="early-years-term-select" className="block text-xs font-medium text-slate-500 mb-1">ภาคเรียน</label>
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
            <span className="flex items-center gap-1.5"><strong className="text-pink-600">3:</strong> ดี</span>
            <span className="flex items-center gap-1.5"><strong className="text-blue-600">2:</strong> พอใช้</span>
            <span className="flex items-center gap-1.5"><strong className="text-amber-600">1:</strong> ควรส่งเสริม</span>
          </div>
        </div>

        {/* Evaluations Grid */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-sm text-slate-500">กำลังโหลดข้อมูลพัฒนาการ...</div>
          ) : evaluations.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500">ไม่พบรายชื่อนักเรียนในห้องนี้</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-pink-50/50 dark:bg-pink-950/20 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                    <th className="py-3 px-3 text-center w-12">เลขที่</th>
                    <th className="py-3 px-4 min-w-[160px]">ชื่อ-สกุล นักเรียน</th>
                    <th className="py-3 px-3 text-center w-24 text-pink-700 font-bold">1. ร่างกาย</th>
                    <th className="py-3 px-3 text-center w-24 text-rose-700 font-bold">2. อารมณ์</th>
                    <th className="py-3 px-3 text-center w-24 text-indigo-700 font-bold">3. สังคม</th>
                    <th className="py-3 px-3 text-center w-24 text-purple-700 font-bold">4. สติปัญญา</th>
                    <th className="py-3 px-3 text-center w-36">น้ำหนัก / ส่วนสูง</th>
                    <th className="py-3 px-3 text-center w-28">ภาวะเจริญเติบโต</th>
                    <th className="py-3 px-3 text-center w-28">ดื่มนม / นอน</th>
                    <th className="py-3 px-4 min-w-[200px]">ความเห็นครู / AI สรุป</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {evaluations.map((row, idx) => (
                    <tr key={row.student_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                      <td className="py-2.5 px-3 text-center font-bold text-slate-500">{row.roll_number || idx + 1}</td>
                      <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-white">
                        {row.student_name}
                      </td>

                      {/* 1. Physical */}
                      <td className="py-2 px-3 text-center">
                        <select
                          value={row.physical_score}
                          onChange={(e) => handleFieldChange(idx, 'physical_score', Number(e.target.value))}
                          className="font-bold text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1 text-slate-900 dark:text-white"
                        >
                          <option value="3">3 (ดี)</option>
                          <option value="2">2 (พอใช้)</option>
                          <option value="1">1 (ปรับปรุง)</option>
                        </select>
                      </td>

                      {/* 2. Emotional */}
                      <td className="py-2 px-3 text-center">
                        <select
                          value={row.emotional_score}
                          onChange={(e) => handleFieldChange(idx, 'emotional_score', Number(e.target.value))}
                          className="font-bold text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1 text-slate-900 dark:text-white"
                        >
                          <option value="3">3 (ดี)</option>
                          <option value="2">2 (พอใช้)</option>
                          <option value="1">1 (ปรับปรุง)</option>
                        </select>
                      </td>

                      {/* 3. Social */}
                      <td className="py-2 px-3 text-center">
                        <select
                          value={row.social_score}
                          onChange={(e) => handleFieldChange(idx, 'social_score', Number(e.target.value))}
                          className="font-bold text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1 text-slate-900 dark:text-white"
                        >
                          <option value="3">3 (ดี)</option>
                          <option value="2">2 (พอใช้)</option>
                          <option value="1">1 (ปรับปรุง)</option>
                        </select>
                      </td>

                      {/* 4. Intellectual */}
                      <td className="py-2 px-3 text-center">
                        <select
                          value={row.intellectual_score}
                          onChange={(e) => handleFieldChange(idx, 'intellectual_score', Number(e.target.value))}
                          className="font-bold text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1 text-slate-900 dark:text-white"
                        >
                          <option value="3">3 (ดี)</option>
                          <option value="2">2 (พอใช้)</option>
                          <option value="1">1 (ปรับปรุง)</option>
                        </select>
                      </td>

                      {/* Weight / Height */}
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="number"
                            step="0.1"
                            value={row.weight_kg ?? ''}
                            onChange={(e) => handleFieldChange(idx, 'weight_kg', parseFloat(e.target.value) || 0)}
                            className="w-14 text-center p-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                            placeholder="กก."
                          />
                          <span className="text-slate-400">/</span>
                          <input
                            type="number"
                            step="0.5"
                            value={row.height_cm ?? ''}
                            onChange={(e) => handleFieldChange(idx, 'height_cm', parseFloat(e.target.value) || 0)}
                            className="w-14 text-center p-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                            placeholder="ซม."
                          />
                        </div>
                      </td>

                      {/* Growth Status */}
                      <td className="py-2 px-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${row.growth_badge}`}>
                          {row.growth_status}
                        </span>
                      </td>

                      {/* Milk / Nap */}
                      <td className="py-2 px-3 text-center text-[11px] text-slate-600 dark:text-slate-400">
                        <div>นม: <strong>{row.milk_drinking}</strong></div>
                        <div>นอน: <strong>{row.nap_habit}</strong></div>
                      </td>

                      {/* Comment & AI Helper */}
                      <td className="py-2 px-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={row.teacher_comment || ''}
                            onChange={(e) => handleFieldChange(idx, 'teacher_comment', e.target.value)}
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

        {/* AI Comment Assistant Modal */}
        {activeStudentCommentIdx !== null && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">น้องฟ้า ช่วยเขียนสรุปพัฒนาการ</h3>
                  <p className="text-xs text-slate-500">
                    {evaluations[activeStudentCommentIdx]?.student_name}
                  </p>
                </div>
              </div>

              <div>
                <label htmlFor="ai-keywords-input" className="block text-xs font-medium text-slate-500 mb-1">
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
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-8 text-slate-500">
        <div className="flex items-center gap-3">
          <Baby className="w-5 h-5 text-pink-600 animate-pulse" />
          <span>กำลังโหลดระบบประเมินพัฒนาการปฐมวัย...</span>
        </div>
      </div>
    }>
      <EarlyYearsAssessmentContent />
    </Suspense>
  );
}
