'use client';

import React, { useState, useMemo } from 'react';
import { 
  X, 
  Sparkles, 
  ClipboardPaste, 
  Check, 
  AlertCircle, 
  AlertTriangle, 
  Plus, 
  Trash2, 
  HelpCircle, 
  Pin, 
  Layers,
  FileText,
  RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';
import { parseSmartPaste, ParsedQuestion } from '@/lib/academic/smart-paste-parser';
import { AcademicExamQuestion } from '@/types/academic';
import { KaTeXInline } from '@/components/academic/MathEquationEditor';

interface SmartPasteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (questions: AcademicExamQuestion[], mode: 'append' | 'replace') => void;
  existingQuestionsCount: number;
}

const SAMPLE_MCQ_TEXT = `1. ข้อใดต่อไปนี้เป็นจำนวนเฉพาะทั้งหมด?
ก. 2, 3, 5, 7
ข. 1, 3, 5, 7
ค. 9, 11, 13, 15
ง. 21, 23, 25, 27
เฉลย: ก
คำอธิบาย: 2, 3, 5, 7 มีตัวประกอบเพียง 1 และตัวมันเองเท่านั้น ส่วน 1 ไม่ใช่จำนวนเฉพาะ
(1 คะแนน) [ตัวชี้วัด: ค 1.1 ป.6/1]

2. สมการ 3x - 7 = 14 ค่าของ x มีค่าเท่าใด?
A. 5
B. 7
C. 9
D. 21
ตอบ: B
(1 คะแนน) [ตัวชี้วัด: ค 1.3 ม.1/1]

3. ข้อใดกล่าวถูกต้องที่สุดเกี่ยวกับกระบวนการสังเคราะห์ด้วยแสงของพืช?
ก. เกิดขึ้นเฉพาะในเวลากลางคืน
ข. ปัจจัยสำคัญคือ น้ำ ก๊าซคาร์บอนไดออกไซด์ แสงแดด และคลอโรฟิลล์
ค. ผลผลิตที่ได้คือก๊าซคาร์บอนมอนอกไซด์
ง. ถูกทุกข้อ
เฉลย: ข
(1 คะแนน) [ตัวชี้วัด: ว 1.2 ป.4/1]`;

const SAMPLE_SUBJECTIVE_TEXT = `1. จงอธิบายความสำคัญของวัฏจักรน้ำที่มีต่อสิ่งมีชีวิตบนโลก พร้อมยกตัวอย่างผลกระทบหากวัฏจักรน้ำถูกรบกวน
คำอธิบาย: สิ่งมีชีวิตต้องการน้ำเพื่อการดำรงชีวิต การเกษตร และรักษาสมดุลอุณหภูมิ หากวัฏจักรน้ำถูกรบกวนจะทำให้เกิดภัยแล้งหรือน้ำท่วมเฉียบพลัน
(5 คะแนน) [ตัวชี้วัด: ว 3.2 ป.5/3]

2. จงแสดงวิธีหาพื้นที่ของรูปสี่เหลี่ยมคางหมูที่มีด้านคู่ขนานยาว 12 เซนติเมตร และ 18 เซนติเมตร โดยมีความสูง 10 เซนติเมตร
วิธีทำ: สูตรพื้นที่ = 1/2 x (ผลบวกของด้านคู่ขนาน) x สูง = 1/2 x (12 + 18) x 10 = 150 ตารางเซนติเมตร
(5 คะแนน) [ตัวชี้วัด: ค 2.1 ป.6/2]`;

const SAMPLE_MIXED_TEXT = `1. ดาวเคราะห์ดวงใดในระบบสุริยะที่มีขนาดใหญ่ที่สุด?
ก. ดาวพุธ
ข. ดาวพฤหัสบดี
ค. ดาวเสาร์
ง. ดาวอังคาร
เฉลย: ข
(1 คะแนน)

2. เซลล์พืชแตกต่างจากเซลล์สัตว์อย่างไร จงระบุออร์แกเนลล์สำคัญอย่างน้อย 2 ชนิด
คำอธิบาย: เซลล์พืชมีผนังเซลล์ (Cell Wall) และคลอโรพลาสต์ (Chloroplast) ซึ่งไม่พบในเซลล์สัตว์
(5 คะแนน)`;

export function SmartPasteModal({
  isOpen,
  onClose,
  onImport,
  existingQuestionsCount
}: SmartPasteModalProps) {
  const [rawText, setRawText] = useState('');
  const [showConfirmReplace, setShowConfirmReplace] = useState(false);

  // Parse questions live whenever rawText updates
  const parseResult = useMemo(() => {
    if (!rawText.trim()) {
      return { success: false, questions: [], rawItemCount: 0, parseWarnings: [] };
    }
    return parseSmartPaste(rawText);
  }, [rawText]);

  if (!isOpen) return null;

  const handleApplyImport = (mode: 'append' | 'replace') => {
    if (parseResult.questions.length === 0) {
      toast.error('ไม่พบข้อสอบที่สามารถนำเข้าได้ กรุณาตรวจสอบข้อความที่วาง');
      return;
    }

    if (mode === 'replace' && existingQuestionsCount > 0 && !showConfirmReplace) {
      setShowConfirmReplace(true);
      return;
    }

    const startingNum = mode === 'append' ? existingQuestionsCount + 1 : 1;
    const newQuestions: AcademicExamQuestion[] = parseResult.questions.map((pq, idx) => ({
      id: `smart-paste-${Date.now()}-${idx}`,
      exam_id: '',
      question_number: startingNum + idx,
      question_type: pq.question_type,
      question_text: pq.question_text,
      math_latex: null,
      question_image_url: null,
      diagram_svg: null,
      choice_a: pq.choice_a,
      choice_b: pq.choice_b,
      choice_c: pq.choice_c,
      choice_d: pq.choice_d,
      choice_e: pq.choice_e || null,
      correct_choice: pq.correct_choice,
      indicator_code: pq.indicator_code || null,
      points: pq.points ?? (pq.question_type === 'subjective' ? 5 : 1),
      pin_choice_position: pq.pin_choice_position,
      pinned_choice_index: pq.pin_choice_position ? 'D' : null,
      question_meta: pq.question_type === 'subjective' 
        ? { subjective_mode: 'short_fill' } 
        : {},
      created_at: new Date().toISOString()
    }));

    onImport(newQuestions, mode);
    toast.success(`นำเข้าข้อสอบสำเร็จ ${newQuestions.length} ข้อ (${mode === 'append' ? 'แทรกต่อท้าย' : 'แทนที่ทั้งหมด'})`);
    setRawText('');
    setShowConfirmReplace(false);
    onClose();
  };

  const mcqCount = parseResult.questions.filter(q => q.question_type === 'mcq').length;
  const subjectiveCount = parseResult.questions.filter(q => q.question_type === 'subjective').length;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center justify-center">
              <ClipboardPaste className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg">Smart Paste วางข้อความโจทย์อัจฉริยะ</h3>
                <span className="px-2 py-0.5 text-[10px] uppercase font-bold rounded-full bg-purple-500/30 text-purple-200 border border-purple-400/30">
                  AI Text Parser
                </span>
              </div>
              <p className="text-xs text-stone-300">
                คัดลอกจาก Word, Google Docs หรือ PDF มาวางได้ทันที รองรับทั้งข้อสอบปรนัย (ก ข ค ง / 1 2 3 4) และอัตนัย
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            title="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Template Sample Chips & Instruction Bar */}
        <div className="px-6 py-3 bg-stone-50 border-b border-stone-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span className="font-semibold text-stone-700">ตัวอย่างข้อสอบด่วน:</span>
            <button
              type="button"
              onClick={() => setRawText(SAMPLE_MCQ_TEXT)}
              className="px-2.5 py-1 bg-white hover:bg-stone-100 text-stone-700 rounded-md border border-stone-300 font-medium transition-colors"
            >
              ปรนัย 3 ข้อ (MCQ)
            </button>
            <button
              type="button"
              onClick={() => setRawText(SAMPLE_SUBJECTIVE_TEXT)}
              className="px-2.5 py-1 bg-white hover:bg-stone-100 text-stone-700 rounded-md border border-stone-300 font-medium transition-colors"
            >
              อัตนัย 2 ข้อ (เขียนตอบ)
            </button>
            <button
              type="button"
              onClick={() => setRawText(SAMPLE_MIXED_TEXT)}
              className="px-2.5 py-1 bg-white hover:bg-stone-100 text-stone-700 rounded-md border border-stone-300 font-medium transition-colors"
            >
              ปรนัย + อัตนัย
            </button>
          </div>

          {rawText && (
            <button
              type="button"
              onClick={() => {
                setRawText('');
                setShowConfirmReplace(false);
              }}
              className="text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              ล้างข้อความ
            </button>
          )}
        </div>

        {/* Modal Body: Split Pane (Left: Textarea, Right: Live Parsed Preview) */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-stone-200">
          {/* Left Pane: Raw Text Input */}
          <div className="p-4 sm:p-5 flex flex-col h-full bg-white">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-stone-500" />
                วางข้อความต้นฉบับที่นี่
              </label>
              <span className="text-[11px] text-stone-400">
                {rawText.length > 0 ? `${rawText.length} ตัวอักษร` : 'ยังไม่มีข้อความ'}
              </span>
            </div>

            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="วางข้อความที่คัดลอกมา เช่น:&#10;&#10;1. ข้อใดคือสัตว์เลี้ยงลูกด้วยนม?&#10;ก. วาฬ&#10;ข. ฉลาม&#10;ค. ปลากัด&#10;ง. เพนกวิน&#10;เฉลย: ก&#10;(1 คะแนน) [ตัวชี้วัด: ว 1.2 ป.4/1]&#10;&#10;2. จงอธิบายวัฏจักรของผีเสื้อ...&#10;คำอธิบาย: ไข่ -> ตัวหนอน -> ดักแด้ -> ผีเสื้อตัวเต็มวัย&#10;(5 คะแนน)"
              className="flex-1 w-full min-h-[220px] p-3.5 text-xs font-mono border border-stone-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none leading-relaxed text-stone-800 bg-stone-50/40"
            />

            <div className="mt-3 p-2.5 bg-purple-50/70 border border-purple-200/80 rounded-lg text-[11px] text-purple-900 space-y-1">
              <p className="font-semibold flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5 text-purple-600" />
                รูปแบบที่ระบบรองรับอัตโนมัติ:
              </p>
              <p className="text-purple-800/90 leading-tight">
                • ขึ้นต้นข้อด้วย <strong>1.</strong>, <strong>ข้อ 1.</strong>, <strong>Item 1.</strong> หรือ <strong>[1]</strong><br />
                • ตัวเลือก: <strong>ก. ข. ค. ง.</strong> หรือ <strong>A. B. C. D.</strong> หรือ <strong>1. 2. 3. 4.</strong><br />
                • เฉลย: <strong>เฉลย: ข</strong>, <strong>ตอบ: ค</strong>, <strong>Ans: B</strong>, <strong>Key: A</strong><br />
                • อัตนัย: ข้อที่ไม่มีตัวเลือก ก-ง จะถูกจัดเป็นอัตนัยพร้อมดึงแนวคำตอบให้อัตโนมัติ
              </p>
            </div>
          </div>

          {/* Right Pane: Live Parsed Preview */}
          <div className="p-4 sm:p-5 flex flex-col h-full bg-stone-50/60 overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                  พรีวิวผลการแยกข้อสอบ
                </span>
                {parseResult.questions.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    พบ {parseResult.questions.length} ข้อ
                  </span>
                )}
              </div>

              {parseResult.questions.length > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] text-stone-500 font-medium">
                  {mcqCount > 0 && <span className="bg-white px-2 py-0.5 rounded border border-stone-200">ปรนัย: {mcqCount}</span>}
                  {subjectiveCount > 0 && <span className="bg-white px-2 py-0.5 rounded border border-stone-200">อัตนัย: {subjectiveCount}</span>}
                </div>
              )}
            </div>

            {/* Warnings notification if any */}
            {parseResult.parseWarnings.length > 0 && (
              <div className="mb-2.5 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-[11px] space-y-0.5">
                  <span className="font-bold">ข้อควรทราบในการวิเคราะห์:</span>
                  {parseResult.parseWarnings.slice(0, 3).map((w, idx) => (
                    <div key={idx}>• {w}</div>
                  ))}
                  {parseResult.parseWarnings.length > 3 && (
                    <div>...และอีก {parseResult.parseWarnings.length - 3} รายการ</div>
                  )}
                </div>
              </div>
            )}

            {/* Preview List or Empty State */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {parseResult.questions.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-stone-400 border-2 border-dashed border-stone-200 rounded-xl bg-white">
                  <ClipboardPaste className="w-10 h-10 text-stone-300 mb-2 stroke-1" />
                  <p className="text-xs font-semibold text-stone-600">ยังไม่มีข้อมูลสำหรับพรีวิว</p>
                  <p className="text-[11px] text-stone-400 mt-1 max-w-xs">
                    วางข้อความโจทย์ทางฝั่งซ้าย หรือคลิกเลือกตัวอย่างด่วนด้านบนเพื่อทดสอบการทำงาน
                  </p>
                </div>
              ) : (
                parseResult.questions.map((q, idx) => {
                  const isSubj = q.question_type === 'subjective';
                  return (
                    <div 
                      key={idx}
                      className="p-3.5 bg-white rounded-xl border border-stone-200 shadow-2xs space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between pb-1.5 border-b border-stone-100">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-stone-800 text-white font-bold text-[11px] flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isSubj ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {isSubj ? 'อัตนัย (เขียนตอบ)' : 'ปรนัย (MCQ)'}
                          </span>
                          {q.pin_choice_position && (
                            <span className="flex items-center gap-0.5 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              <Pin className="w-2.5 h-2.5" />
                              ตรึงช้อยส์ ง.
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-stone-500">
                          {q.indicator_code && (
                            <span className="bg-stone-100 px-1.5 py-0.5 rounded font-mono text-[10px] text-stone-600">
                              {q.indicator_code}
                            </span>
                          )}
                          <span className="font-bold text-stone-700">
                            {q.points || (isSubj ? 5 : 1)} คะแนน
                          </span>
                        </div>
                      </div>

                      <p className="font-semibold text-stone-800 leading-snug">
                        {q.question_text}
                      </p>

                      {!isSubj ? (
                        <div className="grid grid-cols-2 gap-1.5 pt-1">
                          {[
                            { key: 'A', text: q.choice_a },
                            { key: 'B', text: q.choice_b },
                            { key: 'C', text: q.choice_c },
                            { key: 'D', text: q.choice_d },
                            ...(q.choice_e ? [{ key: 'E', text: q.choice_e }] : [])
                          ].map(c => {
                            const isCorrect = q.correct_choice === c.key;
                            return (
                              <div
                                key={c.key}
                                className={`px-2 py-1 rounded text-[11px] flex items-center gap-1.5 ${
                                  isCorrect 
                                    ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-300' 
                                    : 'bg-stone-50 text-stone-600 border border-stone-100'
                                }`}
                              >
                                <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${
                                  isCorrect ? 'bg-emerald-600 text-white' : 'bg-stone-200 text-stone-600'
                                }`}>
                                  {c.key}
                                </span>
                                <span className="truncate">{c.text}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-2 bg-amber-50/60 rounded border border-amber-200/70 text-[11px] text-amber-900">
                          <span className="font-bold block mb-0.5">แนวคำตอบ / คีย์เวิร์ด:</span>
                          <span className="text-stone-700">{q.choice_a}</span>
                        </div>
                      )}

                      {q.explanation && (
                        <p className="text-[11px] text-stone-500 italic bg-stone-50 p-1.5 rounded">
                          <strong>คำอธิบาย:</strong> {q.explanation}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 bg-stone-50 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-stone-600 bg-white border border-stone-300 rounded-xl hover:bg-stone-100 transition-colors"
            >
              ยกเลิก
            </button>
            {existingQuestionsCount > 0 && (
              <span className="text-xs text-stone-500 hidden sm:inline">
                ปัจจุบันมีข้อสอบอยู่แล้ว <strong>{existingQuestionsCount} ข้อ</strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {showConfirmReplace ? (
              <div className="flex items-center gap-2 bg-rose-50 p-1.5 px-3 rounded-xl border border-rose-200 animate-in fade-in">
                <span className="text-xs text-rose-800 font-semibold">
                  แน่ใจหรือไม่ที่จะลบ {existingQuestionsCount} ข้อเดิมทิ้ง?
                </span>
                <button
                  type="button"
                  onClick={() => handleApplyImport('replace')}
                  className="px-3 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs"
                >
                  ยืนยันแทนที่ทั้งหมด
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirmReplace(false)}
                  className="px-2 py-1 text-xs text-stone-600 hover:text-stone-900"
                >
                  ยกเลิก
                </button>
              </div>
            ) : (
              <>
                {existingQuestionsCount > 0 && (
                  <button
                    type="button"
                    onClick={() => handleApplyImport('replace')}
                    disabled={parseResult.questions.length === 0}
                    className="px-4 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 disabled:opacity-40 border border-rose-200 rounded-xl transition-colors"
                  >
                    แทนที่ทั้งหมด ({parseResult.questions.length} ข้อ)
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleApplyImport('append')}
                  disabled={parseResult.questions.length === 0}
                  className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-40 rounded-xl transition-colors shadow-sm flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    {existingQuestionsCount > 0 
                      ? `แทรกต่อท้าย (+${parseResult.questions.length} ข้อ)` 
                      : `นำเข้าข้อสอบ (${parseResult.questions.length} ข้อ)`}
                  </span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
