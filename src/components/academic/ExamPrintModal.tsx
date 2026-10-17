'use client';

import React, { useState, useEffect, useRef, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { 
  Printer, 
  FileDown, 
  X, 
  CheckCircle2, 
  Users, 
  FileText, 
  Scissors, 
  Sparkles, 
  RefreshCw, 
  Shuffle, 
  QrCode, 
  Droplets,
  Layers,
  ChevronRight,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { printDocumentViaSandbox, openDocumentPreviewInTab } from '@/lib/documents/print-service';
import { 
  generateExamPaperHtml, 
  generateBatchAnswerSheetsHtml, 
  StudentRosterItem 
} from '@/lib/academic/exam-print-engine';

interface ExamPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: any; // AcademicExam with course, gradebook, questions, variant_sets
  onOpenWaterSpill?: () => void;
}

export function ExamPrintModal({
  isOpen,
  onClose,
  exam,
  onOpenWaterSpill
}: ExamPrintModalProps) {
  const [activeTab, setActiveTab] = useState<'questions' | 'answers'>('answers');
  const [selectedSet, setSelectedSet] = useState<string>('A');
  
  // Batch Answer Sheet settings
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [students, setStudents] = useState<StudentRosterItem[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState<boolean>(false);
  const [setDistribution, setSetDistribution] = useState<'alternate_ab' | 'all_a' | 'all_b' | 'by_set'>('alternate_ab');
  const [spareSheetsCount, setSpareSheetsCount] = useState<number>(2);

  // Live preview HTML state
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 1. Fetch classroom roster for this exam
  useEffect(() => {
    if (!isOpen || !exam?.exam?.id) return;

    let isMounted = true;
    async function loadRoster() {
      setIsLoadingStudents(true);
      try {
        const queryParams = new URLSearchParams();
        if (selectedClassId) queryParams.set('class_id', selectedClassId);
        if (selectedGrade) queryParams.set('grade', selectedGrade);

        const res = await fetch(`/api/academic/exams/${exam.exam.id}/roster?${queryParams.toString()}`);
        const data = await res.json();

        if (isMounted && data.success) {
          setClasses(data.classes || []);
          setStudents(data.students || []);
          if (!selectedGrade && data.current_grade) {
            setSelectedGrade(data.current_grade);
          }
          if (!selectedClassId && data.current_class_id) {
            setSelectedClassId(data.current_class_id);
          }
        }
      } catch (err) {
        console.error('Failed to load exam roster:', err);
        toast.error('ไม่สามารถดึงรายชื่อนักเรียนในห้องได้');
      } finally {
        if (isMounted) setIsLoadingStudents(false);
      }
    }

    loadRoster();

    return () => {
      isMounted = false;
    };
  }, [isOpen, exam?.exam?.id, selectedClassId, selectedGrade]);

  // 2. Generate live HTML preview whenever parameters change
  useEffect(() => {
    if (!isOpen || !exam) return;

    let isCancelled = false;

    async function updatePreview() {
      setIsGenerating(true);
      try {
        const examData = exam.exam || exam;
        const questionsList = exam.questions || examData.questions || [];
        const variantSets = exam.variant_sets || examData.variant_sets || [];
        const currentVariant = variantSets.find((v: any) => v.set_name === selectedSet);

        if (activeTab === 'questions') {
          const html = generateExamPaperHtml(
            {
              id: examData.id,
              title: examData.title,
              total_questions: examData.total_questions || questionsList.length,
              duration_minutes: examData.duration_minutes || 60,
              max_score: examData.max_score || 30,
              course: examData.course,
              gradebook: examData.gradebook
            },
            questionsList,
            {
              setName: selectedSet,
              variantSet: currentVariant,
              schoolName: 'โรงเรียนสมคิดวิทยา',
              academicYear: '2568',
              term: '1'
            }
          );
          if (!isCancelled) setPreviewHtml(html);
        } else {
          // OMR Answer Sheets
          const html = await generateBatchAnswerSheetsHtml({
            exam: {
              id: examData.id,
              title: examData.title,
              total_questions: examData.total_questions || questionsList.length,
              duration_minutes: examData.duration_minutes || 60,
              max_score: examData.max_score || 30,
              course: examData.course,
              gradebook: examData.gradebook
            },
            students: students.length > 0 ? students : [
              { id: '10001', name: 'ตัวอย่างนักเรียน 1', grade: selectedGrade || 'ป.3/1', roll_number: 1 },
              { id: '10002', name: 'ตัวอย่างนักเรียน 2', grade: selectedGrade || 'ป.3/1', roll_number: 2 }
            ],
            setDistribution,
            spareSheetsCount,
            schoolName: 'โรงเรียนสมคิดวิทยา',
            academicYear: '2568',
            term: '1'
          });
          if (!isCancelled) setPreviewHtml(html);
        }
      } catch (err) {
        console.error('Error generating preview:', err);
      } finally {
        if (!isCancelled) setIsGenerating(false);
      }
    }

    updatePreview();

    return () => {
      isCancelled = true;
    };
  }, [
    isOpen, 
    exam, 
    activeTab, 
    selectedSet, 
    students, 
    setDistribution, 
    spareSheetsCount, 
    selectedGrade
  ]);

  if (!isOpen || !exam || !mounted) return null;

  const examData = exam.exam || exam;
  const questionsList = exam.questions || examData.questions || [];
  const variantSets = exam.variant_sets || examData.variant_sets || [];
  const availableSets = variantSets.length > 0 ? variantSets.map((s: any) => s.set_name) : ['A', 'B'];

  // Calculate paper counts
  const effectiveStudentsCount = students.length;
  const totalSheetsToPrint = effectiveStudentsCount + spareSheetsCount;
  const totalA4Pages = Math.ceil(totalSheetsToPrint / 2);

  // Handle Print Action
  const handlePrint = async () => {
    if (!previewHtml) return;
    setIsPrinting(true);
    try {
      const title = activeTab === 'questions'
        ? `ข้อสอบ_${examData.title}_ชุด_${selectedSet}`
        : `กระดาษคำตอบ_OMR_${examData.title}_ห้อง_${selectedGrade || 'รวม'}`;

      await printDocumentViaSandbox({
        title,
        paperSize: 'A4_PORTRAIT',
        contentHtml: previewHtml
      });
      toast.success('ส่งคำสั่งพิมพ์ไปยังเครื่องพิมพ์เรียบร้อยแล้ว');
    } catch (err: any) {
      console.error('Print failed:', err);
      toast.error('เกิดข้อผิดพลาดในการพิมพ์: ' + (err.message || ''));
    } finally {
      setIsPrinting(false);
    }
  };

  // Handle Save / Preview Tab Action
  const handleOpenPreviewTab = () => {
    if (!previewHtml) return;
    const title = activeTab === 'questions'
      ? `ข้อสอบ_${examData.title}_ชุด_${selectedSet}`
      : `กระดาษคำตอบ_OMR_${examData.title}_ห้อง_${selectedGrade || 'รวม'}`;

    openDocumentPreviewInTab({
      title,
      paperSize: 'A4_PORTRAIT',
      contentHtml: previewHtml
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl md:rounded-3xl w-full max-w-6xl h-[94vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Top Header Bar */}
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/90 dark:bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#7B1C3E]/10 flex items-center justify-center text-[#7B1C3E] dark:bg-[#7B1C3E]/20">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base md:text-lg font-bold text-slate-900 dark:text-white">
                  ศูนย์การพิมพ์เอกสารและข้อสอบมาตรฐาน
                </h2>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  Vector 100%
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {examData.title} | วิชา: {examData.course?.name_th || 'วิชาสอบ'} ({examData.course?.course_code || '-'})
              </p>
            </div>
          </div>

          {/* Mode Switch Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-200/80 dark:bg-slate-800 rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveTab('answers')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'answers'
                  ? 'bg-white dark:bg-slate-900 text-[#7B1C3E] dark:text-rose-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              กระดาษคำตอบ OMR (พิมพ์ทั้งล็อต)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('questions')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'questions'
                  ? 'bg-white dark:bg-slate-900 text-[#7B1C3E] dark:text-rose-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              กระดาษข้อสอบ (A4 หลายหน้า)
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Left Controls, Right Preview */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-100 dark:bg-slate-950">
          
          {/* LEFT: Controls Panel */}
          <div className="w-full md:w-80 lg:w-96 p-4 md:p-5 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between overflow-hidden">
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            
            {activeTab === 'answers' ? (
              <div className="space-y-5">
                {/* Classroom Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>1. เลือกระดับชั้น / ห้องเรียน</span>
                    {isLoadingStudents && <RefreshCw className="w-3 h-3 animate-spin text-slate-400" />}
                  </label>
                  <select
                    value={selectedGrade}
                    onChange={(e) => {
                      const grade = e.target.value;
                      setSelectedGrade(grade);
                      const matchingClass = classes.find(c => c.name === grade);
                      if (matchingClass) setSelectedClassId(matchingClass.id);
                    }}
                    className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#7B1C3E] outline-none"
                  >
                    {classes.map(c => (
                      <option key={c.id} value={c.name}>
                        ห้อง {c.name} {c.student_count ? `(${c.student_count} คน)` : ''}
                      </option>
                    ))}
                    {!classes.some(c => c.name === selectedGrade) && selectedGrade && (
                      <option value={selectedGrade}>ห้อง {selectedGrade}</option>
                    )}
                  </select>
                </div>

                {/* Set Distribution Strategy */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Shuffle className="w-3.5 h-3.5 text-[#7B1C3E]" />
                    <span>2. รูปแบบการแจกชุดข้อสอบ</span>
                  </label>
                  <div className="space-y-1.5 text-xs">
                    <label className={`flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      setDistribution === 'alternate_ab'
                        ? 'border-[#7B1C3E] bg-rose-50/60 dark:bg-rose-950/30 text-slate-900 dark:text-white'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}>
                      <input
                        type="radio"
                        name="setDistribution"
                        checked={setDistribution === 'alternate_ab'}
                        onChange={() => setSetDistribution('alternate_ab')}
                        className="mt-0.5 text-[#7B1C3E]"
                      />
                      <div>
                        <div className="font-bold">สลับชุด A / B อัตโนมัติ (แนะนำ)</div>
                        <div className="text-[11px] text-slate-500">เลขที่คี่ได้ ชุด A, เลขที่คู่ได้ ชุด B กันการทุจริตข้ามโต๊ะ</div>
                      </div>
                    </label>

                    <label className={`flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      setDistribution === 'all_a'
                        ? 'border-[#7B1C3E] bg-rose-50/60 dark:bg-rose-950/30 text-slate-900 dark:text-white'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}>
                      <input
                        type="radio"
                        name="setDistribution"
                        checked={setDistribution === 'all_a'}
                        onChange={() => setSetDistribution('all_a')}
                        className="mt-0.5 text-[#7B1C3E]"
                      />
                      <div>
                        <div className="font-bold">ชุด A ทั้งหมด (All Set A)</div>
                        <div className="text-[11px] text-slate-500">นักเรียนทุกคนได้รับข้อสอบชุด A เหมือนกัน</div>
                      </div>
                    </label>

                    <label className={`flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      setDistribution === 'by_set'
                        ? 'border-[#7B1C3E] bg-rose-50/60 dark:bg-rose-950/30 text-slate-900 dark:text-white'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}>
                      <input
                        type="radio"
                        name="setDistribution"
                        checked={setDistribution === 'by_set'}
                        onChange={() => setSetDistribution('by_set')}
                        className="mt-0.5 text-[#7B1C3E]"
                      />
                      <div>
                        <div className="font-bold">แบ่งครึ่งห้อง (ครึ่งแรก A, ครึ่งหลัง B)</div>
                        <div className="text-[11px] text-slate-500">จัดแยกเป็น 2 กองตามแถวที่นั่ง</div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Spare Sheets Counter */}
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    <span>3. เพิ่มแผ่นคำตอบสำรอง (ไม่ระบุชื่อ)</span>
                    <span className="text-[#7B1C3E]">+{spareSheetsCount} แผ่น</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {[0, 2, 4, 6].map(num => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setSpareSheetsCount(num)}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                          spareSheetsCount === num
                            ? 'bg-[#7B1C3E] text-white border-[#7B1C3E]'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {num === 0 ? 'ไม่เพิ่ม' : `+${num} แผ่น`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Print Summary Card */}
                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3.5 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#7B1C3E]" />
                    <span>สรุปการจัดพิมพ์กระดาษคำตอบ</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200 dark:border-slate-700 text-[11px]">
                    <div>
                      <span className="text-slate-500">นักเรียนจริง:</span>{' '}
                      <strong className="text-slate-900 dark:text-white">{effectiveStudentsCount} คน</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">แผ่นสำรอง:</span>{' '}
                      <strong className="text-slate-900 dark:text-white">{spareSheetsCount} แผ่น</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">รวมกระดาษคำตอบ:</span>{' '}
                      <strong className="text-slate-900 dark:text-white">{totalSheetsToPrint} ชุด</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">ใช้กระดาษ A4:</span>{' '}
                      <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{totalA4Pages} แผ่น</strong>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 flex items-center gap-1 bg-white dark:bg-slate-900 p-2 rounded-lg border">
                    <Scissors className="w-3 h-3 text-[#7B1C3E]" />
                    <span>จัดหน้า 2 แผ่นคำตอบ / 1 แผ่น A4 (ตัดแบ่งครึ่งที่ 148.5 มม.)</span>
                  </div>
                </div>

                {/* Students Roster Preview Table */}
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    <span>รายชื่อนักเรียนในล็อต ({students.length} คน)</span>
                    <span className="text-[10px] text-slate-400 font-normal">เลื่อนดูได้</span>
                  </div>
                  <div className="max-h-36 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y text-[11px] bg-white dark:bg-slate-800">
                    {students.map((s, idx) => {
                      let assignedSet: 'A' | 'B' = 'A';
                      if (setDistribution === 'alternate_ab') assignedSet = idx % 2 === 0 ? 'A' : 'B';
                      else if (setDistribution === 'all_b') assignedSet = 'B';
                      else if (setDistribution === 'by_set') assignedSet = idx < Math.ceil(students.length / 2) ? 'A' : 'B';

                      return (
                        <div key={s.id || idx} className="p-1.5 px-2.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50">
                          <div className="flex items-center gap-2 truncate">
                            <span className="w-5 text-right font-bold text-slate-400">{s.roll_number || idx + 1}.</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{s.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] font-mono text-slate-400">{s.id}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                              assignedSet === 'A'
                                ? 'bg-rose-100 text-[#7B1C3E] dark:bg-rose-950 dark:text-rose-300'
                                : 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                            }`}>
                              ชุด {assignedSet}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            ) : (
              <div className="space-y-5">
                {/* Exam Paper Controls */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    เลือกชุดข้อสอบที่จะพิมพ์
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {availableSets.map((setName: string) => (
                      <button
                        key={setName}
                        type="button"
                        onClick={() => setSelectedSet(setName)}
                        className={`py-3 px-4 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-between ${
                          selectedSet === setName
                            ? 'bg-[#7B1C3E] text-white border-[#7B1C3E] shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                        }`}
                      >
                        <span>ข้อสอบชุด {setName}</span>
                        {selectedSet === setName && <CheckCircle2 className="w-4 h-4 text-white" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Exam Layout Feature Highlights */}
                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>มาตรฐานการจัดหน้าข้อสอบ A4</span>
                  </div>
                  <ul className="space-y-2 text-[11px] text-slate-600 dark:text-slate-300">
                    <li className="flex items-start gap-1.5">
                      <span className="text-[#7B1C3E] font-bold">✓</span>
                      <span><strong>เรียงข้อลงมาใน 1 คอลัมน์:</strong> ป้องกันปัญหานักเรียนสับสนหรือทำข้ามข้อ</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-[#7B1C3E] font-bold">✓</span>
                      <span><strong>ไม่ตัดขาดครึ่งข้อ (Page-break Avoid):</strong> โจทย์และตัวเลือก ก-ง อยู่ในหน้าเดียวกันเสมอ</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-[#7B1C3E] font-bold">✓</span>
                      <span><strong>Running Header:</strong> พิมพ์หัวข้อสอบและชุดประจำทุกหน้า ป้องกันใบข้อสอบสลับ</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-[#7B1C3E] font-bold">✓</span>
                      <span><strong>ช่องข้อมูลผู้เข้าสอบ:</strong> ช่องกรอกชื่อ-เลขที่-คะแนนเต็ม ในหน้าแรกตามระเบียบ สช.</span>
                    </li>
                  </ul>
                </div>

                {/* Exam Metadata */}
                <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border text-xs space-y-1 text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between">
                    <span>จำนวนข้อสอบ:</span>
                    <strong className="text-slate-900 dark:text-white">{questionsList.length} ข้อ</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>เวลาในการทำ:</span>
                    <strong className="text-slate-900 dark:text-white">{examData.duration_minutes || 60} นาที</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>คะแนนเต็ม:</span>
                    <strong className="text-slate-900 dark:text-white">{examData.max_score || 30} คะแนน</strong>
                  </div>
                </div>
              </div>
            )}
            </div>

            {/* Bottom Actions inside Left Panel */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={isPrinting || isGenerating}
                  className="flex-1 py-3 px-4 bg-[#7B1C3E] hover:bg-[#631430] text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isPrinting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Printer className="w-4 h-4" />
                  )}
                  <span>
                    {activeTab === 'answers'
                      ? `สั่งพิมพ์ทั้งล็อต (${totalA4Pages} แผ่น A4)`
                      : `สั่งพิมพ์ข้อสอบชุด ${selectedSet}`
                    }
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenPreviewTab}
                  disabled={isGenerating}
                  title="เปิดหน้าต่างพิมพ์แยก / บันทึก PDF คุณภาพสูง"
                  className="py-3 px-3.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center justify-center cursor-pointer"
                >
                  <FileDown className="w-4 h-4" />
                </button>
              </div>

              {onOpenWaterSpill && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenWaterSpill();
                  }}
                  className="w-full py-2 text-[11px] text-amber-600 dark:text-amber-400 hover:underline flex items-center justify-center gap-1 font-medium cursor-pointer"
                >
                  <Droplets className="w-3.5 h-3.5" />
                  <span>สลับไปโหมดคีย์แทนฉุกเฉิน (กรณีกระดาษเปียก/ชำรุด)</span>
                </button>
              )}
            </div>

          </div>

          {/* RIGHT: Live Visual Preview Canvas */}
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-200 dark:bg-slate-950 p-4 md:p-6">
            <div className="flex items-center justify-between pb-3 text-xs text-slate-500">
              <div className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300">
                <Eye className="w-4 h-4 text-[#7B1C3E]" />
                <span>ตัวอย่างการแสดงผลจริงตามหน้ากระดาษ A4 (Live Print Preview)</span>
              </div>
              <div className="flex items-center gap-3">
                {isGenerating && (
                  <span className="flex items-center gap-1 text-[#7B1C3E] text-[11px]">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    กำลังเรนเดอร์เอกสาร...
                  </span>
                )}
                <span className="text-[11px] bg-slate-300 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">
                  สเกล 100% มาตรฐานเวกเตอร์
                </span>
              </div>
            </div>

            <div className="flex-1 rounded-2xl overflow-hidden shadow-inner bg-slate-300 dark:bg-slate-900 flex justify-center border border-slate-300 dark:border-slate-800">
              {previewHtml ? (
                <iframe
                  srcDoc={previewHtml}
                  title="Print Preview"
                  className="w-full h-full border-0 bg-white"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#7B1C3E]" />
                  <span className="text-xs">กำลังเตรียมเอกสาร...</span>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>,
    document.body
  );
}
