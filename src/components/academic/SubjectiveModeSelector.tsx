'use client';

import React from 'react';
import { 
  PenTool, 
  Sparkles, 
  Loader2, 
  Calculator, 
  ListOrdered, 
  Table, 
  Image as ImageIcon, 
  GitFork, 
  Brush, 
  FileText, 
  BookOpen, 
  Check, 
  Layers, 
  Eye,
  Info
} from 'lucide-react';
import { AcademicExamQuestion } from '@/types/academic';
import { KaTeXInline } from '@/components/academic/MathEquationEditor';

export type SubjectiveModeId = 
  | 'short_fill'
  | 'step_by_step_math'
  | 'sub_questions'
  | 'comparison_table'
  | 'diagram_labeling'
  | 'sequencing_flow'
  | 'drawing_and_explain'
  | 'language_writing'
  | 'essay_extended';

export interface SubjectiveModeDef {
  id: SubjectiveModeId;
  title: string;
  subtitle: string;
  fallbackChoiceB: string;
  iconName: string;
  suggestedPoints: number;
  description: string;
  modelAnswerPlaceholder: string;
  defaultRubric: string;
}

export const SUBJECTIVE_MODES: SubjectiveModeDef[] = [
  {
    id: 'short_fill',
    title: '1. เติมคำตอบสั้น / ช่องว่าง',
    subtitle: 'คำตอบสั้น 1-2 คำ หรือตัวเลขพร้อมหน่วย',
    fallbackChoiceB: 'lines_3',
    iconName: 'PenTool',
    suggestedPoints: 2,
    description: 'เหมาะสำหรับข้อสอบจำแนกศัพท์ นิยาม หรือคำนวณผลลัพธ์ตัวเลขสั้นๆ',
    modelAnswerPlaceholder: 'ระบุคำตอบที่ถูกต้อง เช่น 45 องศาเซลเซียส หรือ คลอโรฟิลล์',
    defaultRubric: 'เกณฑ์คะแนน (2 คะแนน): ตอบคำศัพท์หรือตัวเลขพร้อมหน่วยได้ถูกต้องครบถ้วน'
  },
  {
    id: 'step_by_step_math',
    title: '2. แสดงวิธีทำคณิต / ฟิสิกส์',
    subtitle: 'สูตร → แทนค่า → สรุปคำตอบพร้อมหน่วย',
    fallbackChoiceB: 'grid_box',
    iconName: 'Calculator',
    suggestedPoints: 5,
    description: 'มีกรอบตารางกราฟพิกัดและขั้นตอนแสดงวิธีทำอย่างเป็นระบบ',
    modelAnswerPlaceholder: 'สูตร: พื้นที่ = 1/2 x ฐาน x สูง\nแทนค่า: = 1/2 x 8 x 6\nคำตอบ: 24 ตารางเซนติเมตร',
    defaultRubric: 'เกณฑ์คะแนน (5 คะแนน): เขียนสูตรถูกต้อง (1), แสดงวิธีคำนวณถูกต้อง (3), สรุปคำตอบพร้อมหน่วย (1)'
  },
  {
    id: 'sub_questions',
    title: '3. มีข้อย่อย (1.1, 1.2, 1.3)',
    subtitle: 'สถานการณ์เดียว ตอบคำถามย่อยหลายข้อ',
    fallbackChoiceB: 'lines_5',
    iconName: 'ListOrdered',
    suggestedPoints: 5,
    description: 'กำหนดสถานการณ์ร่วม แล้วถามประเด็นย่อย 1.1, 1.2, 1.3 พร้อมแบ่งคะแนนย่อย',
    modelAnswerPlaceholder: '1.1 ตอบ: ก๊าซออกซิเจน (2 คะแนน)\n1.2 ตอบ: แสงแดดและคลอโรฟิลล์ (2 คะแนน)\n1.3 ตอบ: แป้ง (1 คะแนน)',
    defaultRubric: 'เกณฑ์คะแนน (5 คะแนน): ตรวจให้คะแนนแยกตามแต่ละข้อย่อย 1.1, 1.2, 1.3'
  },
  {
    id: 'comparison_table',
    title: '4. ตารางเปรียบเทียบ',
    subtitle: 'ตาราง 2-3 คอลัมน์ เปรียบเทียบความเหมือน/ต่าง',
    fallbackChoiceB: 'blank_box',
    iconName: 'Table',
    suggestedPoints: 4,
    description: 'ให้นักเรียนตีตารางเปรียบเทียบคุณสมบัติ ข้อดี-ข้อเสีย หรือจำแนกประเภท',
    modelAnswerPlaceholder: 'เกณฑ์: พืชใบเลี้ยงเดี่ยว vs พืชใบเลี้ยงคู่\n- ระบบราก: รากฝอย vs รากแก้ว\n- เส้นใบ: ขนาน vs ร่างแห\n- กลีบดอก: ทวีคูณ 3 vs ทวีคูณ 4-5',
    defaultRubric: 'เกณฑ์คะแนน (4 คะแนน): เปรียบเทียบได้ตรงประเด็นและถูกต้องครบทั้ง 2 ฝั่ง'
  },
  {
    id: 'diagram_labeling',
    title: '5. ชี้ส่วนประกอบภาพ',
    subtitle: 'ดูแผนภาพ/ภาพถ่าย แล้วระบุชื่อส่วนประกอบ',
    fallbackChoiceB: 'blank_box',
    iconName: 'ImageIcon',
    suggestedPoints: 4,
    description: 'ใช้ร่วมกับภาพโจทย์หรือแผนภาพ InStudio SVG ระบุหมายเลข 1, 2, 3',
    modelAnswerPlaceholder: 'หมายเลข 1: คลอโรพลาสต์\nหมายเลข 2: ผนังเซลล์\nหมายเลข 3: เยื่อหุ้มเซลล์\nหมายเลข 4: นิวเคลียส',
    defaultRubric: 'เกณฑ์คะแนน (4 คะแนน): ระบุชื่อส่วนประกอบถูกต้องตำแหน่งละ 1 คะแนน'
  },
  {
    id: 'sequencing_flow',
    title: '6. เรียงลำดับขั้นตอน',
    subtitle: 'จัดลำดับเหตุการณ์ ลำดับขั้นตอน หรือ Flowchart',
    fallbackChoiceB: 'lines_5',
    iconName: 'GitFork',
    suggestedPoints: 3,
    description: 'ทดสอบทักษะกระบวนการคิดเชิงขั้นตอนและการเชื่อมโยงเหตุการณ์',
    modelAnswerPlaceholder: 'ลำดับที่ถูกต้อง: 3 → 1 → 4 → 2\n(คำอธิบาย: การเตรียมดิน → หว่านเมล็ด → รดน้ำใส่ปุ๋ย → เก็บเกี่ยว)',
    defaultRubric: 'เกณฑ์คะแนน (3 คะแนน): เรียงลำดับขั้นตอนได้ถูกต้องสมบูรณ์'
  },
  {
    id: 'drawing_and_explain',
    title: '7. วาดภาพพร้อมคำอธิบาย',
    subtitle: 'กรอบวาดภาพประกอบ + บรรทัดเขียนสรุป',
    fallbackChoiceB: 'blank_box',
    iconName: 'Brush',
    suggestedPoints: 5,
    description: 'ให้นักเรียนวาดแผนภาพ วงจรไฟฟ้า หรือโครงสร้างทางชีวภาพ พร้อมเขียนอธิบาย',
    modelAnswerPlaceholder: 'ภาพวาดวงจร: มีแหล่งกำเนิด สวิตช์ หลอดไฟ ต่ออนุกรม\nคำอธิบาย: กระแสไฟฟ้าไหลจากขั้วบวกผ่านหลอดไฟไปยังขั้วลบ',
    defaultRubric: 'เกณฑ์คะแนน (5 คะแนน): วาดภาพถูกต้องตามหลักวิชาการ (3), คำอธิบายประกอบชัดเจน (2)'
  },
  {
    id: 'language_writing',
    title: '8. เส้นบรรทัด 4 เส้น / คัดลายมือ',
    subtitle: 'เส้นบรรทัดคัดลายมือภาษาไทย / 4-lines ภาษาอังกฤษ',
    fallbackChoiceB: 'lines_5',
    iconName: 'FileText',
    suggestedPoints: 5,
    description: 'สำหรับวิชาภาษาไทยและภาษาอังกฤษ ประถมต้น-ประถมปลาย ฝึกคัดลายมือและสะกดคำ',
    modelAnswerPlaceholder: 'คัดลายมือตัวบรรจงเต็มบรรทัด ถูกต้องตามอักขรวิธี เว้นวรรคตอนถูกต้อง สะอาดเรียบร้อย',
    defaultRubric: 'เกณฑ์คะแนน (5 คะแนน): ความถูกต้องของตัวสะกด (2), รูปแบบตัวอักษรและวรรณยุกต์ (2), ความสะอาดเรียบร้อย (1)'
  },
  {
    id: 'essay_extended',
    title: '9. เขียนบรรยายความเรียง',
    subtitle: 'บทนำ เนื้อหา สรุป การวัดผลระดับสูง (Bloom)',
    fallbackChoiceB: 'lines_8',
    iconName: 'BookOpen',
    suggestedPoints: 10,
    description: 'การเขียนตอบแบบความเรียงยาวเพื่อประเมินการคิดวิเคราะห์ สังเคราะห์ และการประเมินค่า',
    modelAnswerPlaceholder: 'บทนำ (2 คะแนน): ระบุปัญหาและประเด็นสำคัญ\nเนื้อหา (5 คะแนน): ให้เหตุผลสนับสนุนพร้อมยกตัวอย่าง 2 ประการ\nสรุป (3 คะแนน): ข้อเสนอแนะเชิงสร้างสรรค์',
    defaultRubric: 'เกณฑ์คะแนน (10 คะแนน): รูบริกเชิงวิเคราะห์ 3 มิติ (การจัดโครงสร้างเนื้อหา, การใช้หลักฐานสนับสนุน, ภาษาและการสื่อสาร)'
  }
];

function getModeIcon(iconName: string) {
  switch (iconName) {
    case 'Calculator': return <Calculator className="w-4 h-4" />;
    case 'ListOrdered': return <ListOrdered className="w-4 h-4" />;
    case 'Table': return <Table className="w-4 h-4" />;
    case 'ImageIcon': return <ImageIcon className="w-4 h-4" />;
    case 'GitFork': return <GitFork className="w-4 h-4" />;
    case 'Brush': return <Brush className="w-4 h-4" />;
    case 'FileText': return <FileText className="w-4 h-4" />;
    case 'BookOpen': return <BookOpen className="w-4 h-4" />;
    case 'PenTool':
    default:
      return <PenTool className="w-4 h-4" />;
  }
}

interface SubjectiveModeSelectorProps {
  question: AcademicExamQuestion;
  questionIndex: number;
  onUpdateQuestion: (field: keyof AcademicExamQuestion, value: any) => void;
  onGenerateRubric: () => void;
  isGeneratingRubric: boolean;
  onOpenDiagramBuilder?: () => void;
}

export function SubjectiveModeSelector({
  question,
  questionIndex,
  onUpdateQuestion,
  onGenerateRubric,
  isGeneratingRubric,
  onOpenDiagramBuilder
}: SubjectiveModeSelectorProps) {
  // Current active mode (default to short_fill or fallback from choice_b)
  const currentModeId: SubjectiveModeId = 
    question.question_meta?.subjective_mode || 
    (question.choice_b === 'blank_box' ? 'drawing_and_explain' :
     question.choice_b === 'grid_box' ? 'step_by_step_math' :
     question.choice_b === 'lines_8' ? 'essay_extended' :
     question.choice_b === 'lines_3' ? 'short_fill' : 'step_by_step_math');

  const currentModeDef = SUBJECTIVE_MODES.find(m => m.id === currentModeId) || SUBJECTIVE_MODES[0];

  const handleSelectMode = (mode: SubjectiveModeDef) => {
    const updatedMeta = {
      ...(question.question_meta || {}),
      subjective_mode: mode.id
    };

    onUpdateQuestion('question_meta', updatedMeta);
    // Sync fallback choice_b for print engine backward compatibility
    onUpdateQuestion('choice_b', mode.fallbackChoiceB);

    // If points are still default 1 or unset, update to suggested
    if (!question.points || question.points === 1) {
      onUpdateQuestion('points', mode.suggestedPoints);
    }

    // If rubric is empty, populate with mode default
    if (!question.choice_c || question.choice_c === 'เกณฑ์การให้คะแนน' || question.choice_c === '-') {
      onUpdateQuestion('choice_c', mode.defaultRubric);
    }
  };

  return (
    <div className="p-4 bg-amber-50/40 rounded-2xl border border-amber-200/90 space-y-4">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-amber-200/80">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-600 text-white flex items-center justify-center shadow-2xs">
            <PenTool className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-amber-950">
                รูปแบบข้อสอบอัตนัย (9 Subjective Modes)
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/70 text-amber-900 border border-amber-300">
                {currentModeDef.title}
              </span>
            </div>
            <p className="text-[11px] text-amber-800/80">
              เลือกรูปแบบเพื่อสร้างพื้นที่เขียนตอบและเกณฑ์ตรวจรูบริกให้เหมาะสมกับลักษณะวิชา
            </p>
          </div>
        </div>

        {/* AI Rubric Generator Button */}
        <button
          type="button"
          disabled={isGeneratingRubric}
          onClick={onGenerateRubric}
          className="px-3 py-1.5 text-xs font-semibold text-amber-900 bg-white hover:bg-amber-100 border border-amber-300 rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs disabled:opacity-50"
        >
          {isGeneratingRubric ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          )}
          <span>น้องฟ้าร่างแนวคำตอบและรูบริก</span>
        </button>
      </div>

      {/* 9 Subjective Question Modes Grid */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-stone-600 uppercase tracking-wider block">
          เลือกโหมดข้อสอบอัตนัย (คลิกเพื่อสลับโหมด):
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {SUBJECTIVE_MODES.map((mode) => {
            const isSelected = currentModeId === mode.id;

            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => handleSelectMode(mode)}
                className={`p-2.5 rounded-xl border text-left transition-all flex items-start gap-2.5 relative ${
                  isSelected 
                    ? 'bg-amber-100/70 border-amber-400 ring-2 ring-amber-400/50 text-amber-950 shadow-xs' 
                    : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-700'
                }`}
              >
                <div className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center mt-0.5 ${
                  isSelected ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-600'
                }`}>
                  {getModeIcon(mode.iconName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold truncate">
                      {mode.title}
                    </span>
                    {isSelected && (
                      <Check className="w-4 h-4 text-amber-700 shrink-0 ml-1" />
                    )}
                  </div>
                  <p className="text-[10px] text-stone-500 line-clamp-1 mt-0.5">
                    {mode.subtitle}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mode Description & Guidance Strip */}
      <div className="p-2.5 bg-white/90 rounded-xl border border-amber-200 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Info className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="text-[11px]">
            <strong>คำแนะนำโหมดนี้:</strong> {currentModeDef.description}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-medium text-amber-900">
          <span>รูปแบบกระดาษ: <code>{question.choice_b || currentModeDef.fallbackChoiceB}</code></span>
          <span>•</span>
          <span>แนะนำ: <strong>{currentModeDef.suggestedPoints} คะแนน</strong></span>
        </div>
      </div>

      {/* Model Answer (choice_a) */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-bold text-stone-700 flex items-center gap-1">
            <span>แนวคำตอบที่ถูกต้องและคีย์เวิร์ดสำคัญ (Model Answer & Keywords)</span>
          </label>
          <span className="text-[10px] text-stone-400">สำหรับเป็นเฉลยในคู่มือครูผู้ตรวจ</span>
        </div>
        <textarea
          rows={3}
          value={question.choice_a || ''}
          onChange={(e) => onUpdateQuestion('choice_a', e.target.value)}
          placeholder={currentModeDef.modelAnswerPlaceholder}
          className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl bg-white text-stone-800 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-mono leading-relaxed"
        />
        {question.choice_a && (question.choice_a.includes('$') || question.choice_a.includes('\\')) && (
          <div className="mt-1 p-2 bg-white border border-stone-200 rounded-lg text-xs">
            <span className="text-[10px] text-stone-400 block mb-0.5">พรีวิวสมการในแนวคำตอบ:</span>
            <KaTeXInline content={question.choice_a} />
          </div>
        )}
      </div>

      {/* Answer Space Format (choice_b) & Rubric (choice_c) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        {/* Space Format */}
        <div className="md:col-span-4 space-y-1">
          <label className="text-xs font-semibold text-stone-700 block">
            พื้นที่เขียนตอบในข้อสอบ A4 (Print Layout)
          </label>
          <select
            value={question.choice_b || currentModeDef.fallbackChoiceB}
            onChange={(e) => onUpdateQuestion('choice_b', e.target.value)}
            className="w-full px-2.5 py-2 text-xs border border-stone-300 rounded-xl bg-white font-medium text-stone-800 focus:ring-2 focus:ring-amber-500 cursor-pointer"
          >
            <option value="lines_3">เส้นประเขียนตอบ 3 บรรทัด (ตอบสั้น)</option>
            <option value="lines_5">เส้นประเขียนตอบ 5 บรรทัด (มาตรฐาน)</option>
            <option value="lines_8">เส้นประเขียนตอบ 8 บรรทัด (อธิบายยาว)</option>
            <option value="blank_box">กรอบว่างสี่เหลี่ยม (แสดงวิธีทำ/วาดรูป)</option>
            <option value="grid_box">กรอบตารางกราฟพิกัด (คณิต/ฟิสิกส์)</option>
          </select>
          <span className="text-[10px] text-stone-400 block">
            กำหนดรูปแบบกรอบบนกระดาษข้อสอบฉบับพิมพ์จริง
          </span>
        </div>

        {/* Rubric Criteria (choice_c) */}
        <div className="md:col-span-8 space-y-1">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <label className="text-xs font-semibold text-stone-700 block">
              เกณฑ์การให้คะแนนรูบริก (Scoring Rubric)
            </label>
            {/* Quick Rubric Presets */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onUpdateQuestion('choice_c', currentModeDef.defaultRubric)}
                className="px-2 py-0.5 text-[10px] font-medium bg-white hover:bg-stone-100 text-stone-600 rounded border border-stone-200 transition-colors cursor-pointer"
                title="ใช้เกณฑ์มาตรฐานของโหมดนี้"
              >
                เกณฑ์มาตรฐาน
              </button>
              <button
                type="button"
                onClick={() => onUpdateQuestion('choice_c', 'ระดับ 3 (ดีเยี่ยม): คำตอบสมบูรณ์ ถูกต้องทุกประเด็น\nระดับ 2 (พอใช้): มีความถูกต้องส่วนใหญ่ ขาดรายละเอียดบางส่วน\nระดับ 1 (ปรับปรุง): ตอบไม่ตรงประเด็นหรือมีข้อผิดพลาดมาก')}
                className="px-2 py-0.5 text-[10px] font-medium bg-white hover:bg-stone-100 text-stone-600 rounded border border-stone-200 transition-colors cursor-pointer"
                title="เกณฑ์ 3 ระดับคุณภาพ"
              >
                เกณฑ์ 3 ระดับ
              </button>
            </div>
          </div>
          <textarea
            rows={2}
            value={question.choice_c || ''}
            onChange={(e) => onUpdateQuestion('choice_c', e.target.value)}
            placeholder={currentModeDef.defaultRubric}
            className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl bg-white text-stone-800 focus:ring-2 focus:ring-amber-500 leading-relaxed font-sans"
          />
          {question.choice_c && (question.choice_c.includes('$') || question.choice_c.includes('\\')) && (
            <div className="mt-1 p-2 bg-white border border-stone-200 rounded-lg text-xs">
              <span className="text-[10px] text-stone-400 block mb-0.5">พรีวิวสมการในเกณฑ์ตรวจ:</span>
              <KaTeXInline content={question.choice_c} />
            </div>
          )}
        </div>
      </div>

      {/* Interactive Live Preview of Student Answer Sheet */}
      <div className="p-3 bg-white rounded-xl border border-amber-200/90 space-y-2">
        <div className="flex items-center justify-between text-xs pb-1 border-b border-stone-100">
          <span className="font-bold text-stone-700 flex items-center gap-1.5 text-[11px]">
            <Eye className="w-3.5 h-3.5 text-stone-400" />
            พรีวิวพื้นที่กระดาษคำตอบที่นักเรียนจะเห็นตอนสอบ:
          </span>
          <span className="text-[10px] text-stone-400">
            พิมพ์ใน ตอนที่ 2 ท้ายกระดาษ A4
          </span>
        </div>

        {/* Dynamic preview based on mode & choice_b */}
        <div className="p-3 bg-stone-50/60 rounded-lg border border-dashed border-stone-300 text-xs">
          {currentModeId === 'step_by_step_math' || question.choice_b === 'grid_box' ? (
            <div className="space-y-2">
              <div className="h-28 border border-stone-300 rounded bg-white relative overflow-hidden flex items-start p-2">
                <div 
                  className="absolute inset-0 opacity-20"
                  style={{
                    backgroundImage: 'linear-gradient(to right, #cbd5e1 1px, transparent 1px), linear-gradient(to bottom, #cbd5e1 1px, transparent 1px)',
                    backgroundSize: '16px 16px'
                  }}
                />
                <span className="relative z-10 text-[11px] font-semibold text-stone-400 bg-white/90 px-1 rounded">
                  [ตารางกริดพิกัด] 1. สูตรที่ใช้ / 2. แทนค่าและคำนวณ:
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-stone-200 text-[11px]">
                <span className="font-bold text-stone-700">ตอบ: ........................................................................................</span>
                <span className="text-stone-400">คะแนนเต็ม: {question.points ?? 5} คะแนน</span>
              </div>
            </div>
          ) : currentModeId === 'drawing_and_explain' || question.choice_b === 'blank_box' ? (
            <div className="grid grid-cols-2 gap-3 h-28">
              <div className="border border-stone-300 rounded bg-white p-2 flex items-center justify-center text-stone-400 text-[11px]">
                [ กรอบวาดแผนภาพประกอบ ]
              </div>
              <div className="flex flex-col justify-around py-1">
                <div className="border-b border-dashed border-stone-300 pb-1 text-[11px] text-stone-500">คำอธิบายภาพ:</div>
                <div className="border-b border-dashed border-stone-300 h-4"></div>
                <div className="border-b border-dashed border-stone-300 h-4"></div>
                <div className="border-b border-dashed border-stone-300 h-4"></div>
              </div>
            </div>
          ) : currentModeId === 'language_writing' ? (
            <div className="space-y-2 py-1">
              {[1, 2, 3, 4].map(line => (
                <div key={line} className="relative h-6 border-b border-stone-300 flex items-center">
                  <div className="absolute inset-x-0 top-1/2 border-b border-dashed border-stone-200" />
                  <span className="text-[10px] text-stone-300 pl-1 select-none">{line}.</span>
                </div>
              ))}
            </div>
          ) : currentModeId === 'comparison_table' ? (
            <div className="border border-stone-300 rounded bg-white overflow-hidden text-[11px]">
              <div className="grid grid-cols-3 bg-stone-100 p-1.5 font-bold text-stone-700 border-b border-stone-300 text-center">
                <div>เกณฑ์เปรียบเทียบ</div>
                <div>ประเด็นที่ 1</div>
                <div>ประเด็นที่ 2</div>
              </div>
              <div className="grid grid-cols-3 p-2 border-b border-stone-200 min-h-[30px]">
                <div className="border-r border-stone-200 pr-1 text-stone-400">1.</div>
                <div className="border-r border-stone-200 pr-1"></div>
                <div></div>
              </div>
              <div className="grid grid-cols-3 p-2 min-h-[30px]">
                <div className="border-r border-stone-200 pr-1 text-stone-400">2.</div>
                <div className="border-r border-stone-200 pr-1"></div>
                <div></div>
              </div>
            </div>
          ) : (
            <div className="space-y-2 py-1">
              {Array.from({ length: question.choice_b === 'lines_8' ? 5 : question.choice_b === 'lines_3' ? 3 : 4 }).map((_, lineIdx) => (
                <div key={lineIdx} className="border-b border-dashed border-stone-300 h-6 flex items-end pb-0.5">
                  {lineIdx === 0 && (
                    <span className="font-bold text-stone-700 text-xs pr-2">ตอบ:</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Bottom Score & Grader Strip */}
          <div className="mt-2.5 pt-1.5 border-t border-stone-200 flex items-center justify-between text-[10px] text-stone-500">
            <span>เกณฑ์ตรวจ: {question.choice_c || currentModeDef.defaultRubric}</span>
            <div className="inline-flex items-center gap-2 bg-white px-2 py-0.5 rounded border border-stone-200 font-medium">
              <span>คะแนนเต็ม: <strong>{question.points ?? currentModeDef.suggestedPoints}</strong></span>
              <span>|</span>
              <span>ได้: [ &nbsp;&nbsp;&nbsp;&nbsp; ]</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
