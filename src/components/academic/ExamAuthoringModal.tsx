'use client';

import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  X, 
  Plus, 
  Trash2, 
  Sparkles, 
  Calculator, 
  Shapes, 
  Pin, 
  ChevronUp, 
  ChevronDown, 
  Check, 
  HelpCircle, 
  Loader2, 
  Image as ImageIcon,
  ArrowRightLeft,
  BookOpen,
  Wand2,
  Copy,
  Sliders
} from 'lucide-react';
import { toast } from 'sonner';
import { AcademicCourse, AcademicExam, AcademicExamQuestion, ChoiceOption, ExamQuestionType, ExamStatus } from '@/types/academic';
import { MathEquationEditorModal, KaTeXInline } from '@/components/academic/MathEquationEditor';
import { InStudioDiagramBuilderModal } from '@/components/academic/InStudioDiagramBuilder';

interface ExamAuthoringModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  examId?: string;
  courses: AcademicCourse[];
  gradebooks: any[];
  onClose: () => void;
  onSaved: () => void;
}

export function ExamAuthoringModal({
  isOpen,
  mode,
  examId,
  courses,
  gradebooks,
  onClose,
  onSaved
}: ExamAuthoringModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form Metadata
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState('');
  const [gradebookId, setGradebookId] = useState('');
  const [academicYear, setAcademicYear] = useState('2568');
  const [term, setTerm] = useState('1');
  const [examType, setExamType] = useState('midterm');
  const [status, setStatus] = useState<ExamStatus>('ready');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [maxScore, setMaxScore] = useState(20);
  const [instructions, setInstructions] = useState('');

  // Questions List
  const [questions, setQuestions] = useState<AcademicExamQuestion[]>([]);

  // Sub-modal states
  const [mathTarget, setMathTarget] = useState<{ qIdx: number; field: 'question_text' | 'choice_a' | 'choice_b' | 'choice_c' | 'choice_d' | 'choice_e' } | null>(null);
  const [diagramTargetIdx, setDiagramTargetIdx] = useState<number | null>(null);

  // Nano Banana AI Diagram Prompt Modal
  const [aiDiagramPrompt, setAiDiagramPrompt] = useState('');
  const [aiDiagramTargetIdx, setAiDiagramTargetIdx] = useState<number | null>(null);
  const [isGeneratingAiDiagram, setIsGeneratingAiDiagram] = useState(false);

  // AI Draft Batch Modal
  const [isAiDraftModalOpen, setIsAiDraftModalOpen] = useState(false);
  const [aiSubject, setAiSubject] = useState('คณิตศาสตร์');
  const [aiTopic, setAiTopic] = useState('');
  const [aiIndicator, setAiIndicator] = useState('ค 1.1 ป.3/1');
  const [aiCount, setAiCount] = useState(5);
  const [aiDifficulty, setAiDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [isDraftingAi, setIsDraftingAi] = useState(false);

  // Single Question AI Adjuster
  const [adjustingQIdx, setAdjustingQIdx] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && examId) {
        fetchExamDetails(examId);
      } else {
        resetForm();
      }
    }
  }, [isOpen, mode, examId]);

  const resetForm = () => {
    setTitle('');
    setCourseId(courses[0]?.id || '');
    setGradebookId('');
    setAcademicYear('2568');
    setTerm('1');
    setExamType('midterm');
    setStatus('ready');
    setDurationMinutes(60);
    setMaxScore(20);
    setInstructions('ให้นักเรียนเลือกคำตอบที่ถูกต้องที่สุดเพียงข้อเดียว แล้วทำเครื่องหมายลงในกระดาษคำตอบ');
    setQuestions([
      {
        id: 'temp-1',
        exam_id: '',
        question_number: 1,
        question_type: 'mcq',
        question_text: '5 + 7 มีค่าเท่ากับเท่าใด?',
        math_latex: null,
        question_image_url: null,
        diagram_svg: null,
        choice_a: '10',
        choice_b: '12',
        choice_c: '14',
        choice_d: '15',
        choice_e: null,
        correct_choice: 'B',
        indicator_code: 'ค 1.1 ป.3/1',
        points: 1,
        pin_choice_position: false,
        pinned_choice_index: null,
        created_at: new Date().toISOString()
      },
      {
        id: 'temp-2',
        exam_id: '',
        question_number: 2,
        question_type: 'mcq',
        question_text: 'ข้อใดคือจำนวนคู่ทั้งหมด?',
        math_latex: null,
        question_image_url: null,
        diagram_svg: null,
        choice_a: '2, 4, 6',
        choice_b: '8, 10, 12',
        choice_c: '14, 16, 18',
        choice_d: 'ถูกทุกข้อ',
        choice_e: null,
        correct_choice: 'D',
        indicator_code: 'ค 1.1 ป.3/2',
        points: 1,
        pin_choice_position: true,
        pinned_choice_index: 'D',
        created_at: new Date().toISOString()
      }
    ]);
  };

  const fetchExamDetails = async (id: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/academic/exams/${id}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'ไม่สามารถโหลดข้อมูลข้อสอบได้');
      }

      const exam = data.exam;
      setTitle(exam.title || '');
      setCourseId(exam.course_id || '');
      setGradebookId(exam.gradebook_id || '');
      setAcademicYear(exam.academic_year || '2568');
      setTerm(exam.term || '1');
      setExamType(exam.exam_type || 'midterm');
      setStatus(exam.status || 'ready');
      setDurationMinutes(exam.duration_minutes || 60);
      setMaxScore(exam.max_score || 20);
      setInstructions(exam.instructions || '');

      if (data.questions && data.questions.length > 0) {
        setQuestions(data.questions);
      } else {
        setQuestions([]);
      }
    } catch (err: any) {
      toast.error(err.message || 'เกิดข้อผิดพลาดในการโหลดข้อสอบ');
    } finally {
      setLoading(false);
    }
  };

  const handleAddQuestion = (type: ExamQuestionType = 'mcq') => {
    const nextNum = questions.length + 1;
    const newQ: AcademicExamQuestion = {
      id: `temp-${Date.now()}-${nextNum}`,
      exam_id: examId || '',
      question_number: nextNum,
      question_type: type,
      question_text: type === 'matching' 
        ? 'จงจับคู่ความสัมพันธ์ระหว่างคอลัมน์ A และคอลัมน์ B ให้ถูกต้อง'
        : type === 'true_false'
        ? 'ข้อความต่อไปนี้ถูกต้องหรือไม่?'
        : `ข้อที่ ${nextNum}`,
      math_latex: null,
      question_image_url: null,
      diagram_svg: null,
      choice_a: type === 'true_false' ? 'ถูกต้อง' : 'ตัวเลือก ก',
      choice_b: type === 'true_false' ? 'ไม่ถูกต้อง' : 'ตัวเลือก ข',
      choice_c: type === 'true_false' ? '-' : 'ตัวเลือก ค',
      choice_d: type === 'true_false' ? '-' : 'ตัวเลือก ง',
      choice_e: null,
      correct_choice: 'A',
      indicator_code: questions[questions.length - 1]?.indicator_code || null,
      points: 1,
      pin_choice_position: false,
      pinned_choice_index: null,
      created_at: new Date().toISOString()
    };
    setQuestions(prev => [...prev, newQ]);
  };

  const handleRemoveQuestion = (idx: number) => {
    setQuestions(prev => {
      const updated = prev.filter((_, i) => i !== idx);
      return updated.map((q, i) => ({ ...q, question_number: i + 1 }));
    });
  };

  const handleMoveQuestion = (idx: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === questions.length - 1)) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const updated = [...questions];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;
    setQuestions(updated.map((q, i) => ({ ...q, question_number: i + 1 })));
  };

  const handleDuplicateQuestion = (idx: number) => {
    const source = questions[idx];
    const clone: AcademicExamQuestion = {
      ...source,
      id: `temp-${Date.now()}`,
      question_number: questions.length + 1,
      question_text: `${source.question_text} (สำเนา)`
    };
    setQuestions(prev => [...prev, clone]);
  };

  const updateQuestionField = (idx: number, field: keyof AcademicExamQuestion, val: any) => {
    setQuestions(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: val };
      return updated;
    });
  };

  // Generate AI Diagram via Nano Banana / Imagen 3
  const handleGenerateAiDiagram = async () => {
    if (aiDiagramTargetIdx === null || !aiDiagramPrompt.trim()) return;
    try {
      setIsGeneratingAiDiagram(true);
      const res = await fetch('/api/academic/exams/ai-diagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiDiagramPrompt,
          subject: courses.find(c => c.id === courseId)?.name_th || 'วิทยาศาสตร์',
          style: 'line_art'
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'ไม่สามารถสร้างภาพได้');
      }

      if (data.diagram_svg) {
        updateQuestionField(aiDiagramTargetIdx, 'diagram_svg', data.diagram_svg);
        toast.success('แทรกแผนภาพเวกเตอร์สำเร็จ');
      } else if (data.image_url) {
        updateQuestionField(aiDiagramTargetIdx, 'question_image_url', data.image_url);
        toast.success('แทรกภาพจาก Nano Banana สำเร็จ');
      }
      setAiDiagramTargetIdx(null);
      setAiDiagramPrompt('');
    } catch (err: any) {
      toast.error(err.message || 'เกิดข้อผิดพลาดในการสร้างแผนภาพ AI');
    } finally {
      setIsGeneratingAiDiagram(false);
    }
  };

  // Single Question AI Adjuster
  const handleAiAdjustQuestion = async (idx: number, adjustType: 'simplify' | 'increase_rigor' | 'create_parallel_twin') => {
    const q = questions[idx];
    try {
      setAdjustingQIdx(idx);
      const res = await fetch('/api/academic/exams/ai-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'adjust_question',
          question_to_adjust: q,
          adjust_type: adjustType
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.question) {
        throw new Error(data.error || 'ไม่สามารถปรับปรุงโจทย์ได้');
      }

      const adj = data.question;
      setQuestions(prev => {
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          question_text: adj.question_text || updated[idx].question_text,
          choice_a: adj.choice_a || updated[idx].choice_a,
          choice_b: adj.choice_b || updated[idx].choice_b,
          choice_c: adj.choice_c || updated[idx].choice_c,
          choice_d: adj.choice_d || updated[idx].choice_d,
          correct_choice: adj.correct_choice || updated[idx].correct_choice,
          pin_choice_position: adj.pin_choice_position ?? updated[idx].pin_choice_position
        };
        return updated;
      });
      toast.success('น้องฟ้าปรับปรุงข้อสอบเรียบร้อยแล้ว');
    } catch (err: any) {
      toast.error(err.message || 'เกิดข้อผิดพลาดในการปรับปรุงโจทย์');
    } finally {
      setAdjustingQIdx(null);
    }
  };

  // AI Batch Draft
  const handleAiBatchDraft = async () => {
    try {
      setIsDraftingAi(true);
      const res = await fetch('/api/academic/exams/ai-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'draft_batch',
          subject_name: aiSubject,
          topic: aiTopic || 'ทักษะและการประยุกต์ใช้',
          indicator_code: aiIndicator,
          count: aiCount,
          difficulty: aiDifficulty,
          language: 'th'
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.questions) {
        throw new Error(data.error || 'ไม่สามารถร่างข้อสอบด้วย AI ได้');
      }

      const newBatch: AcademicExamQuestion[] = data.questions.map((q: any, i: number) => ({
        id: `ai-${Date.now()}-${i}`,
        exam_id: examId || '',
        question_number: questions.length + i + 1,
        question_type: 'mcq',
        question_text: q.question_text,
        math_latex: null,
        question_image_url: null,
        diagram_svg: null,
        choice_a: q.choice_a,
        choice_b: q.choice_b,
        choice_c: q.choice_c,
        choice_d: q.choice_d,
        choice_e: null,
        correct_choice: q.correct_choice || 'A',
        indicator_code: q.indicator_code || aiIndicator,
        points: 1,
        pin_choice_position: q.pin_choice_position ?? false,
        pinned_choice_index: q.pin_choice_position ? 'D' : null,
        created_at: new Date().toISOString()
      }));

      setQuestions(prev => [...prev, ...newBatch]);
      setIsAiDraftModalOpen(false);
      toast.success(`น้องฟ้าร่างข้อสอบเพิ่มสำเร็จ ${newBatch.length} ข้อ`);
    } catch (err: any) {
      toast.error(err.message || 'เกิดข้อผิดพลาดในการร่างข้อสอบ');
    } finally {
      setIsDraftingAi(false);
    }
  };

  // Submit Save
  const handleSaveExam = async () => {
    if (!title.trim()) {
      toast.error('กรุณาระบุชื่อการสอบ');
      return;
    }
    if (!courseId) {
      toast.error('กรุณาเลือกรายวิชา');
      return;
    }
    if (questions.length === 0) {
      toast.error('ต้องมีข้อสอบอย่างน้อย 1 ข้อ');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        title,
        course_id: courseId,
        gradebook_id: gradebookId || null,
        academic_year: academicYear,
        term,
        exam_type: examType,
        status,
        duration_minutes: Number(durationMinutes),
        max_score: Number(maxScore),
        instructions,
        questions: questions.map((q, idx) => ({
          question_number: idx + 1,
          question_type: q.question_type || 'mcq',
          question_text: q.question_text,
          math_latex: q.math_latex,
          question_image_url: q.question_image_url,
          diagram_svg: q.diagram_svg,
          choice_a: q.choice_a,
          choice_b: q.choice_b,
          choice_c: q.choice_c,
          choice_d: q.choice_d,
          choice_e: q.choice_e,
          correct_choice: q.correct_choice,
          indicator_code: q.indicator_code,
          points: q.points,
          pin_choice_position: q.pin_choice_position,
          pinned_choice_index: q.pinned_choice_index
        }))
      };

      const url = mode === 'edit' && examId ? `/api/academic/exams/${examId}` : '/api/academic/exams';
      const method = mode === 'edit' ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'ไม่สามารถบันทึกข้อสอบได้');
      }

      toast.success(mode === 'edit' ? 'บันทึกการแก้ไขข้อสอบเรียบร้อยแล้ว' : 'สร้างข้อสอบและชุด A/B/C สำเร็จ');
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อสอบ');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 md:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-6xl overflow-hidden flex flex-col max-h-[96vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 text-rose-300 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg leading-tight">
                  {mode === 'edit' ? 'สตูดิโอแก้ไขข้อสอบ (Edit Exam Studio)' : 'สตูดิโอออกข้อสอบมาตรฐานระดับสูง (Next-Gen Exam Studio)'}
                </h3>
                <span className="px-2.5 py-0.5 text-[11px] rounded-full font-semibold bg-primary/30 text-rose-200 border border-primary/40">
                  {status === 'draft' ? 'ร่างข้อสอบ' : status === 'review' ? 'รอตรวจสอบ' : status === 'archived' ? 'จัดเก็บในคลัง' : 'พร้อมจัดสอบ'}
                </span>
              </div>
              <p className="text-xs text-stone-400">
                รองรับสมการเวกเตอร์ KaTeX, แผนภาพ In-Studio SVG, ปัญญาประดิษฐ์น้องฟ้า และการพิมพ์ A4 มาตรฐาน
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Top Control Bar: Metadata */}
        <div className="p-4 bg-stone-50 border-b border-stone-200 grid grid-cols-2 md:grid-cols-6 gap-3 shrink-0 text-xs">
          <div className="col-span-2">
            <label className="block text-stone-600 font-semibold mb-1">ชื่อการสอบ / รหัสชุดข้อสอบ</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น การสอบกลางภาค วิชาคณิตศาสตร์พื้นฐาน ป.3"
              className="w-full px-3 py-1.5 border border-stone-300 rounded-lg font-medium text-stone-900 focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-stone-600 font-semibold mb-1">รายวิชา</label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="w-full px-2 py-1.5 border border-stone-300 rounded-lg text-stone-900"
            >
              <option value="">-- เลือกรายวิชา --</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.course_code} - {c.name_th} ({c.grade_level})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-stone-600 font-semibold mb-1">สมุด ปพ.5 ที่เชื่อมโยง</label>
            <select
              value={gradebookId}
              onChange={(e) => setGradebookId(e.target.value)}
              className="w-full px-2 py-1.5 border border-stone-300 rounded-lg text-stone-900"
            >
              <option value="">-- ไม่เชื่อมโยง ปพ.5 --</option>
              {gradebooks.map(g => (
                <option key={g.id} value={g.id}>
                  ห้อง {g.class?.name || 'ไม่ระบุ'} ({g.course?.course_code || ''})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-stone-600 font-semibold mb-1">ประเภทการสอบ</label>
            <select
              value={examType}
              onChange={(e) => setExamType(e.target.value)}
              className="w-full px-2 py-1.5 border border-stone-300 rounded-lg text-stone-900"
            >
              <option value="midterm">สอบกลางภาค</option>
              <option value="final">สอบปลายภาค</option>
              <option value="unit_test">สอบท้ายหน่วย</option>
              <option value="quiz">ควิซย่อย</option>
            </select>
          </div>

          <div>
            <label className="block text-stone-600 font-semibold mb-1">สถานะข้อสอบ</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ExamStatus)}
              className="w-full px-2 py-1.5 border border-stone-300 rounded-lg font-semibold text-stone-900"
            >
              <option value="draft">ร่าง (Draft)</option>
              <option value="review">รอตรวจสอบ (Review)</option>
              <option value="ready">พร้อมสอบ (Ready)</option>
              <option value="conducted">จัดสอบแล้ว (Conducted)</option>
              <option value="archived">จัดเก็บในคลัง (Archived)</option>
            </select>
          </div>
        </div>

        {/* Main Workspace (Questions list) */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-stone-100/50">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 text-stone-500">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
              <p className="text-sm">กำลังโหลดข้อมูลข้อสอบ...</p>
            </div>
          ) : (
            <>
              {/* Question Tools Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                    จำนวนข้อสอบทั้งหมด: {questions.length} ข้อ
                  </span>
                  <span className="text-stone-300">|</span>
                  <span className="text-xs text-stone-500">
                    คะแนนรวม: {questions.reduce((sum, q) => sum + (Number(q.points) || 1), 0)} คะแนน
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* AI Batch Draft Button */}
                  <button
                    onClick={() => {
                      const selectedCourse = courses.find(c => c.id === courseId);
                      if (selectedCourse) {
                        setAiSubject(selectedCourse.name_th);
                      }
                      setIsAiDraftModalOpen(true);
                    }}
                    className="px-3.5 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <Wand2 className="w-4 h-4 text-purple-600" />
                    ให้น้องฟ้าร่างข้อสอบอัตโนมัติ
                  </button>

                  {/* Add Standard MCQ */}
                  <button
                    onClick={() => handleAddQuestion('mcq')}
                    className="px-3 py-1.5 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    เพิ่มข้อปรนัย (MCQ)
                  </button>

                  {/* Add Matching */}
                  <button
                    onClick={() => handleAddQuestion('matching')}
                    className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    เพิ่มข้อโยงเส้นจับคู่
                  </button>

                  {/* Add True/False */}
                  <button
                    onClick={() => handleAddQuestion('true_false')}
                    className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    เพิ่มข้อถูก/ผิด
                  </button>
                </div>
              </div>

              {/* Questions Loop */}
              <div className="space-y-4">
                {questions.map((q, idx) => (
                  <div 
                    key={q.id || idx} 
                    className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs transition-shadow hover:shadow-md space-y-4"
                  >
                    {/* Question Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-lg bg-stone-900 text-white font-bold text-xs flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-stone-100 text-stone-700">
                          {q.question_type === 'matching' ? 'ข้อสอบจับคู่ 2 คอลัมน์' : q.question_type === 'true_false' ? 'ข้อสอบถูก/ผิด' : 'ปรนัย 4-5 ตัวเลือก'}
                        </span>
                        <input
                          type="text"
                          value={q.indicator_code || ''}
                          onChange={(e) => updateQuestionField(idx, 'indicator_code', e.target.value)}
                          placeholder="ตัวชี้วัด เช่น ค 1.1 ป.3/1"
                          className="text-xs px-2.5 py-1 border border-stone-200 rounded-md w-36 text-stone-700"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Adjust with Nong Fah */}
                        <div className="relative group">
                          <button
                            disabled={adjustingQIdx === idx}
                            className="px-2.5 py-1 text-xs font-medium text-stone-600 hover:text-stone-900 bg-stone-50 hover:bg-stone-100 rounded-md flex items-center gap-1 border border-stone-200"
                          >
                            {adjustingQIdx === idx ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-500" />}
                            น้องฟ้าปรับระดับ
                          </button>
                          <div className="absolute right-0 top-full mt-1 hidden group-hover:flex flex-col bg-white border border-stone-200 rounded-lg shadow-lg z-20 py-1 min-w-[160px]">
                            <button
                              onClick={() => handleAiAdjustQuestion(idx, 'simplify')}
                              className="px-3 py-1.5 text-xs text-left text-stone-700 hover:bg-stone-50"
                            >
                              ปรับให้เข้าใจง่ายขึ้น
                            </button>
                            <button
                              onClick={() => handleAiAdjustQuestion(idx, 'increase_rigor')}
                              className="px-3 py-1.5 text-xs text-left text-stone-700 hover:bg-stone-50"
                            >
                              เพิ่มความท้าทาย (คิดวิเคราะห์)
                            </button>
                            <button
                              onClick={() => handleAiAdjustQuestion(idx, 'create_parallel_twin')}
                              className="px-3 py-1.5 text-xs text-left text-stone-700 hover:bg-stone-50"
                            >
                              สร้างข้อสอบคู่ขนาน (Twin)
                            </button>
                          </div>
                        </div>

                        {/* Move Up/Down */}
                        <button
                          onClick={() => handleMoveQuestion(idx, 'up')}
                          disabled={idx === 0}
                          className="p-1 text-stone-400 hover:text-stone-700 disabled:opacity-30 rounded hover:bg-stone-100"
                          title="เลื่อนขึ้น"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleMoveQuestion(idx, 'down')}
                          disabled={idx === questions.length - 1}
                          className="p-1 text-stone-400 hover:text-stone-700 disabled:opacity-30 rounded hover:bg-stone-100"
                          title="เลื่อนลง"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>

                        {/* Duplicate */}
                        <button
                          onClick={() => handleDuplicateQuestion(idx)}
                          className="p-1 text-stone-400 hover:text-stone-700 rounded hover:bg-stone-100"
                          title="คัดลอกข้อนี้"
                        >
                          <Copy className="w-4 h-4" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleRemoveQuestion(idx)}
                          className="p-1 text-stone-400 hover:text-rose-600 rounded hover:bg-rose-50"
                          title="ลบข้อนี้"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Question Text & Media Controls */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-stone-700">
                          ข้อความโจทย์
                        </label>
                        <div className="flex items-center gap-2">
                          {/* Math Equation Button */}
                          <button
                            type="button"
                            onClick={() => setMathTarget({ qIdx: idx, field: 'question_text' })}
                            className="px-2.5 py-1 text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-md font-medium flex items-center gap-1"
                          >
                            <Calculator className="w-3.5 h-3.5 text-amber-600" />
                            สูตรคณิต (KaTeX)
                          </button>

                          {/* In-Studio Diagram Button */}
                          <button
                            type="button"
                            onClick={() => setDiagramTargetIdx(idx)}
                            className="px-2.5 py-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-md font-medium flex items-center gap-1"
                          >
                            <Shapes className="w-3.5 h-3.5 text-blue-600" />
                            สร้างแผนภาพ (Diagram)
                          </button>

                          {/* Nano Banana AI Image Generator */}
                          <button
                            type="button"
                            onClick={() => {
                              setAiDiagramTargetIdx(idx);
                              setAiDiagramPrompt(q.question_text || '');
                            }}
                            className="px-2.5 py-1 text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-md font-medium flex items-center gap-1"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                            Nano Banana (AI Diagram)
                          </button>
                        </div>
                      </div>

                      <textarea
                        value={q.question_text}
                        onChange={(e) => updateQuestionField(idx, 'question_text', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 text-sm border border-stone-300 rounded-xl focus:ring-1 focus:ring-primary"
                        placeholder="พิมพ์ข้อความโจทย์..."
                      />

                      {/* Live Equation / Math Preview if present */}
                      {q.question_text && (q.question_text.includes('$') || q.question_text.includes('\\')) && (
                        <div className="p-2.5 bg-stone-50 border border-stone-200 rounded-lg text-xs">
                          <span className="text-stone-400 block text-[10px] mb-1">พรีวิวสมการ:</span>
                          <KaTeXInline content={q.question_text} />
                        </div>
                      )}

                      {/* Attached Diagram / Image Preview */}
                      {(q.diagram_svg || q.question_image_url) && (
                        <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex flex-col items-center relative group">
                          <button
                            onClick={() => {
                              updateQuestionField(idx, 'diagram_svg', null);
                              updateQuestionField(idx, 'question_image_url', null);
                            }}
                            className="absolute top-2 right-2 p-1 bg-white/80 hover:bg-rose-50 text-rose-600 rounded-full border border-stone-200 shadow-xs"
                            title="ลบแผนภาพนี้"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          {q.diagram_svg ? (
                            <div 
                              className="max-h-[160px] flex items-center justify-center overflow-hidden"
                              dangerouslySetInnerHTML={{ __html: q.diagram_svg }} 
                            />
                          ) : (
                            <img 
                              src={q.question_image_url!} 
                              alt="แผนภาพประกอบ" 
                              className="max-h-[160px] object-contain rounded-lg border border-stone-200"
                            />
                          )}
                          <span className="text-[11px] text-stone-400 mt-1">แผนภาพประกอบโจทย์ข้อนี้</span>
                        </div>
                      )}
                    </div>

                    {/* Choices Section */}
                    {q.question_type !== 'matching' && (
                      <div className="space-y-3 pt-2 border-t border-stone-100">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-stone-700">
                            ตัวเลือกคำตอบและการกำหนดเฉลย
                          </span>
                          <div className="flex items-center gap-3">
                            {/* Toggle 5th Choice */}
                            <button
                              type="button"
                              onClick={() => {
                                updateQuestionField(idx, 'choice_e', q.choice_e ? null : 'ตัวเลือก จ');
                              }}
                              className="text-xs text-stone-600 hover:text-stone-900 underline"
                            >
                              {q.choice_e ? 'ลบตัวเลือก จ (ใช้ 4 ช้อยส์)' : '+ เพิ่มตัวเลือก จ (เป็น 5 ช้อยส์)'}
                            </button>

                            {/* Pin Choice D/E */}
                            <label className="flex items-center gap-1.5 text-xs text-stone-600 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={q.pin_choice_position}
                                onChange={(e) => updateQuestionField(idx, 'pin_choice_position', e.target.checked)}
                                className="rounded border-stone-300 text-primary focus:ring-primary"
                              />
                              <Pin className="w-3.5 h-3.5 text-stone-400" />
                              <span>ตรึงตำแหน่งช้อยส์สุดท้าย (ไม่ให้ระบบสลับ)</span>
                            </label>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {[
                            { key: 'A', field: 'choice_a', label: 'ก. (A)' },
                            { key: 'B', field: 'choice_b', label: 'ข. (B)' },
                            { key: 'C', field: 'choice_c', label: 'ค. (C)' },
                            { key: 'D', field: 'choice_d', label: 'ง. (D)' },
                            ...(q.choice_e ? [{ key: 'E', field: 'choice_e', label: 'จ. (E)' }] : [])
                          ].map(choice => (
                            <div 
                              key={choice.key}
                              className={`p-2.5 rounded-xl border transition-colors flex items-center gap-2 ${
                                q.correct_choice === choice.key 
                                  ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-400' 
                                  : 'bg-stone-50/70 border-stone-200'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`correct-${idx}`}
                                checked={q.correct_choice === choice.key}
                                onChange={() => updateQuestionField(idx, 'correct_choice', choice.key)}
                                className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              />
                              <span className="text-xs font-bold text-stone-600 w-12 shrink-0">
                                {choice.label}
                              </span>
                              <input
                                type="text"
                                value={(q as any)[choice.field] || ''}
                                onChange={(e) => updateQuestionField(idx, choice.field as any, e.target.value)}
                                className="flex-1 px-2.5 py-1 text-xs border border-stone-300 rounded-lg bg-white"
                                placeholder={`ข้อความตัวเลือก ${choice.label}`}
                              />
                              <button
                                type="button"
                                onClick={() => setMathTarget({ qIdx: idx, field: choice.field as any })}
                                className="p-1 text-stone-400 hover:text-stone-700 rounded hover:bg-stone-200"
                                title="แทรกสูตรในตัวเลือก"
                              >
                                <Calculator className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Matching Question 2-Column Layout */}
                    {q.question_type === 'matching' && (
                      <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200 space-y-3">
                        <div className="text-xs font-semibold text-blue-900">
                          กำหนดคู่จับคู่ (คอลัมน์ A เทียบกับคอลัมน์ B):
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="font-bold text-stone-700 block mb-1">คอลัมน์ A (โจทย์ย่อย)</span>
                            <input
                              type="text"
                              value={q.choice_a}
                              onChange={(e) => updateQuestionField(idx, 'choice_a', e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg bg-white mb-2"
                              placeholder="1. Photosynthesis"
                            />
                            <input
                              type="text"
                              value={q.choice_b}
                              onChange={(e) => updateQuestionField(idx, 'choice_b', e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg bg-white"
                              placeholder="2. Chlorophyll"
                            />
                          </div>
                          <div>
                            <span className="font-bold text-stone-700 block mb-1">คอลัมน์ B (ตัวเลือกคำตอบ)</span>
                            <input
                              type="text"
                              value={q.choice_c}
                              onChange={(e) => updateQuestionField(idx, 'choice_c', e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg bg-white mb-2"
                              placeholder="ก. การสังเคราะห์แสง"
                            />
                            <input
                              type="text"
                              value={q.choice_d}
                              onChange={(e) => updateQuestionField(idx, 'choice_d', e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg bg-white"
                              placeholder="ข. สารสีเขียวในพืช"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 pt-2 border-t border-blue-200/60 text-xs">
                          <span className="text-blue-900 font-semibold">เฉลยสำหรับกระดาษคำตอบ OMR:</span>
                          <select
                            value={q.correct_choice}
                            onChange={(e) => updateQuestionField(idx, 'correct_choice', e.target.value)}
                            className="px-2 py-1 border border-stone-300 rounded-lg bg-white font-bold"
                          >
                            <option value="A">ก (A)</option>
                            <option value="B">ข (B)</option>
                            <option value="C">ค (C)</option>
                            <option value="D">ง (D)</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-stone-600 bg-white border border-stone-300 rounded-xl hover:bg-stone-50 transition-colors"
          >
            ยกเลิก
          </button>

          <div className="flex items-center gap-3">
            <span className="text-xs text-stone-500">
              เมื่อบันทึกแล้ว ระบบจะคำนวณชุดสลับข้อ A, B, C อัตโนมัติ
            </span>
            <button
              type="button"
              onClick={handleSaveExam}
              disabled={saving}
              className="px-6 py-2.5 text-xs font-semibold text-white bg-primary hover:bg-primary/90 disabled:opacity-50 rounded-xl transition-colors shadow-sm flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  กำลังบันทึกและสร้างชุดสลับข้อ...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  {mode === 'edit' ? 'บันทึกการแก้ไขข้อสอบ' : 'บันทึกและสร้างข้อสอบ'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Sub-Modal: Math Equation Editor */}
      {mathTarget && (
        <MathEquationEditorModal
          isOpen={true}
          initialValue={questions[mathTarget.qIdx]?.[mathTarget.field] || ''}
          onClose={() => setMathTarget(null)}
          onInsert={(latex) => {
            const currentVal = questions[mathTarget.qIdx]?.[mathTarget.field] || '';
            updateQuestionField(mathTarget.qIdx, mathTarget.field, currentVal ? `${currentVal} ${latex}` : latex);
          }}
        />
      )}

      {/* Sub-Modal: In-Studio Diagram Builder */}
      {diagramTargetIdx !== null && (
        <InStudioDiagramBuilderModal
          isOpen={true}
          onClose={() => setDiagramTargetIdx(null)}
          onInsert={(svg) => {
            updateQuestionField(diagramTargetIdx, 'diagram_svg', svg);
          }}
        />
      )}

      {/* Sub-Modal: Nano Banana AI Diagram Prompt Modal */}
      {aiDiagramTargetIdx !== null && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-600" />
                <h4 className="font-bold text-sm text-stone-900">สร้างแผนภาพด้วย Nano Banana (Imagen 3)</h4>
              </div>
              <button onClick={() => setAiDiagramTargetIdx(null)} className="text-stone-400 hover:text-stone-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                ป้อนคำอธิบายแผนภาพที่ต้องการสร้าง:
              </label>
              <textarea
                value={aiDiagramPrompt}
                onChange={(e) => setAiDiagramPrompt(e.target.value)}
                rows={3}
                placeholder="เช่น แผนภาพวงจรไฟฟ้าอย่างง่าย มีแบตเตอรี่ สวิตช์ และหลอดไฟ 2 หลอดต่อแบบอนุกรม"
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl"
              />
              <p className="text-[11px] text-stone-500 mt-1">
                ระบบจะสร้างภาพลายเส้นขาว-ดำ (Black-and-white Line Art) ความคมชัดสูง เพื่อการพิมพ์ที่ประหยัดหมึก
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setAiDiagramTargetIdx(null)}
                className="px-3 py-1.5 text-xs text-stone-600 bg-stone-100 rounded-lg hover:bg-stone-200"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleGenerateAiDiagram}
                disabled={isGeneratingAiDiagram || !aiDiagramPrompt.trim()}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg flex items-center gap-1.5"
              >
                {isGeneratingAiDiagram ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                สร้างแผนภาพและแนบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Modal: AI Batch Draft Modal */}
      {isAiDraftModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div className="flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-purple-600" />
                <h4 className="font-bold text-sm text-stone-900">ให้น้องฟ้าร่างข้อสอบตามมาตรฐาน สพฐ.</h4>
              </div>
              <button onClick={() => setIsAiDraftModalOpen(false)} className="text-stone-400 hover:text-stone-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-stone-600 font-semibold mb-1">กลุ่มสาระการเรียนรู้</label>
                <input
                  type="text"
                  value={aiSubject}
                  onChange={(e) => setAiSubject(e.target.value)}
                  className="w-full px-3 py-1.5 border border-stone-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-stone-600 font-semibold mb-1">หัวข้อบทเรียน / สาระสำคัญ</label>
                <input
                  type="text"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="เช่น การแก้โจทย์ปัญหาเศษส่วนสองขั้นตอน"
                  className="w-full px-3 py-1.5 border border-stone-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-600 font-semibold mb-1">รหัสตัวชี้วัด</label>
                  <input
                    type="text"
                    value={aiIndicator}
                    onChange={(e) => setAiIndicator(e.target.value)}
                    className="w-full px-3 py-1.5 border border-stone-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-stone-600 font-semibold mb-1">จำนวนข้อ</label>
                  <select
                    value={aiCount}
                    onChange={(e) => setAiCount(parseInt(e.target.value) || 5)}
                    className="w-full px-3 py-1.5 border border-stone-300 rounded-lg"
                  >
                    <option value={3}>3 ข้อ</option>
                    <option value={5}>5 ข้อ</option>
                    <option value={10}>10 ข้อ</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-stone-600 font-semibold mb-1">ระดับความยาก</label>
                <select
                  value={aiDifficulty}
                  onChange={(e) => setAiDifficulty(e.target.value as any)}
                  className="w-full px-3 py-1.5 border border-stone-300 rounded-lg"
                >
                  <option value="easy">พื้นฐาน (เน้นความจำและความเข้าใจ)</option>
                  <option value="medium">ปานกลาง (เน้นการนำไปใช้ตามเกณฑ์)</option>
                  <option value="hard">ท้าทาย (เน้นการวิเคราะห์และการประยุกต์ใช้)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setIsAiDraftModalOpen(false)}
                className="px-3 py-1.5 text-xs text-stone-600 bg-stone-100 rounded-lg hover:bg-stone-200"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleAiBatchDraft}
                disabled={isDraftingAi}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg flex items-center gap-1.5"
              >
                {isDraftingAi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                เริ่มร่างข้อสอบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
