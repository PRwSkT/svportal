'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  CheckSquare, 
  PenTool, 
  ArrowRightLeft, 
  Check, 
  Plus, 
  AlertCircle, 
  AlertTriangle, 
  ClipboardPaste,
  Sparkles,
  ChevronRight,
  Filter
} from 'lucide-react';
import { AcademicExamQuestion, ExamQuestionType } from '@/types/academic';
import { PreFlightReport } from '@/lib/academic/preflight-validator';

interface QuestionNavigatorSidebarProps {
  questions: AcademicExamQuestion[];
  activeIndex: number;
  onSelectQuestion: (index: number) => void;
  onAddQuestion: (type: ExamQuestionType) => void;
  onOpenSmartPaste: () => void;
  report?: PreFlightReport;
  className?: string;
}

export function QuestionNavigatorSidebar({
  questions,
  activeIndex,
  onSelectQuestion,
  onAddQuestion,
  onOpenSmartPaste,
  report,
  className = ''
}: QuestionNavigatorSidebarProps) {
  const [filterType, setFilterType] = useState<'all' | 'mcq' | 'subjective'>('all');
  const activePillRef = useRef<HTMLButtonElement | null>(null);

  // Scroll active mobile pill into view when activeIndex changes
  useEffect(() => {
    if (activePillRef.current) {
      activePillRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }, [activeIndex]);

  // Map question number to issues
  const questionIssueMap = React.useMemo(() => {
    const map = new Map<number, { hasError: boolean; hasWarning: boolean }>();
    if (!report?.issues) return map;

    for (const issue of report.issues) {
      if (issue.question_number) {
        const cur = map.get(issue.question_number) || { hasError: false, hasWarning: false };
        if (issue.severity === 'error') cur.hasError = true;
        if (issue.severity === 'warning') cur.hasWarning = true;
        map.set(issue.question_number, cur);
      }
    }
    return map;
  }, [report]);

  const filteredQuestions = questions.filter(q => {
    if (filterType === 'mcq') return q.question_type !== 'subjective';
    if (filterType === 'subjective') return q.question_type === 'subjective';
    return true;
  });

  const mcqCount = questions.filter(q => q.question_type !== 'subjective').length;
  const subjectiveCount = questions.filter(q => q.question_type === 'subjective').length;

  return (
    <>
      {/* DESKTOP SIDEBAR (lg+ screens) */}
      <aside 
        className={`hidden lg:flex flex-col w-64 bg-white border-r border-stone-200 shrink-0 select-none ${className}`}
        aria-label="Question Navigator"
      >
        {/* Sidebar Header */}
        <div className="p-3.5 border-b border-stone-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-800 tracking-wide">
              รายการข้อสอบ ({questions.length})
            </span>
            <div className="flex items-center gap-1 text-[11px] text-stone-500 font-medium">
              <span className="bg-stone-100 px-1.5 py-0.5 rounded text-stone-700">
                {questions.reduce((sum, q) => sum + (Number(q.points) || 1), 0)} คะแนน
              </span>
            </div>
          </div>

          {/* Quick Filter Tabs */}
          <div className="grid grid-cols-3 gap-1 bg-stone-100 p-1 rounded-lg text-[10px] font-semibold text-stone-600">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`py-1 rounded text-center transition-colors ${
                filterType === 'all' ? 'bg-white text-stone-900 shadow-2xs font-bold' : 'hover:text-stone-900'
              }`}
            >
              ทั้งหมด ({questions.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('mcq')}
              className={`py-1 rounded text-center transition-colors ${
                filterType === 'mcq' ? 'bg-white text-stone-900 shadow-2xs font-bold' : 'hover:text-stone-900'
              }`}
            >
              ปรนัย ({mcqCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('subjective')}
              className={`py-1 rounded text-center transition-colors ${
                filterType === 'subjective' ? 'bg-white text-amber-900 shadow-2xs font-bold' : 'hover:text-stone-900'
              }`}
            >
              อัตนัย ({subjectiveCount})
            </button>
          </div>
        </div>

        {/* Scrollable Questions List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredQuestions.length === 0 ? (
            <div className="p-6 text-center text-xs text-stone-400">
              ไม่มีข้อสอบในหมวดนี้
            </div>
          ) : (
            filteredQuestions.map((q) => {
              const originalIndex = questions.findIndex(item => item === q);
              const qNum = q.question_number || originalIndex + 1;
              const isActive = originalIndex === activeIndex;
              const issue = questionIssueMap.get(qNum);
              const isSubj = q.question_type === 'subjective';
              const isMatching = q.question_type === 'matching';
              const isTrueFalse = q.question_type === 'true_false';

              return (
                <button
                  key={q.id || originalIndex}
                  type="button"
                  onClick={() => onSelectQuestion(originalIndex)}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-2 text-xs relative group ${
                    isActive 
                      ? 'bg-rose-50/70 border-primary/40 ring-1 ring-primary/30 shadow-2xs' 
                      : 'bg-white hover:bg-stone-50 border-transparent hover:border-stone-200'
                  }`}
                >
                  {/* Number Badge */}
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[11px] shrink-0 ${
                    isActive 
                      ? 'bg-primary text-white shadow-2xs' 
                      : isSubj 
                      ? 'bg-amber-100 text-amber-900' 
                      : 'bg-stone-100 text-stone-700'
                  }`}>
                    {qNum}
                  </div>

                  {/* Info Column */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        isSubj 
                          ? 'bg-amber-100 text-amber-800' 
                          : isMatching 
                          ? 'bg-blue-100 text-blue-800' 
                          : isTrueFalse 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-stone-100 text-stone-600'
                      }`}>
                        {isSubj ? 'อัตนัย' : isMatching ? 'จับคู่' : isTrueFalse ? 'ถูก/ผิด' : 'ปรนัย'}
                      </span>

                      <div className="flex items-center gap-1">
                        {issue?.hasError ? (
                          <span title="พบปัญหาในข้อนี้" className="w-2 h-2 rounded-full bg-rose-500 ring-2 ring-rose-200 animate-pulse" />
                        ) : issue?.hasWarning ? (
                          <span title="มีข้อควรระวัง" className="w-2 h-2 rounded-full bg-amber-500" />
                        ) : null}
                        <span className="text-[10px] font-semibold text-stone-500">
                          {q.points ?? (isSubj ? 5 : 1)} คะแนน
                        </span>
                      </div>
                    </div>

                    <p className={`text-[11px] truncate mt-1 ${isActive ? 'text-stone-900 font-semibold' : 'text-stone-600'}`}>
                      {q.question_text || '(ยังไม่มีข้อความโจทย์)'}
                    </p>

                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {q.diagram_svg && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-0.5" title="มีภาพวาด Goodnotes Ink">
                          <PenTool className="w-2.5 h-2.5 text-indigo-600" />
                          <span>Ink</span>
                        </span>
                      )}
                      {q.question_image_url && !q.diagram_svg && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200" title="มีรูปภาพประกอบ">
                          ภาพ
                        </span>
                      )}
                      {(q.question_text?.includes('$') || q.math_latex) && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200 font-mono" title="มีสูตรสมการ KaTeX">
                          ∑ KaTeX
                        </span>
                      )}
                      {q.indicator_code && (
                        <span className="text-[9px] text-stone-400 font-mono truncate">
                          {q.indicator_code}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Sidebar Footer Quick Action Buttons */}
        <div className="p-3 border-t border-stone-200 bg-stone-50 space-y-1.5 shrink-0">
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => onAddQuestion('mcq')}
              className="px-2 py-1.5 bg-white hover:bg-stone-100 text-stone-700 font-semibold rounded-lg border border-stone-300 transition-colors flex items-center justify-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ ปรนัย</span>
            </button>
            <button
              type="button"
              onClick={() => onAddQuestion('subjective')}
              className="px-2 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 font-semibold rounded-lg border border-amber-300 transition-colors flex items-center justify-center gap-1"
            >
              <PenTool className="w-3.5 h-3.5 text-amber-700" />
              <span>+ อัตนัย</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenSmartPaste}
            className="w-full py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-900 font-semibold rounded-lg border border-purple-200 text-xs transition-colors flex items-center justify-center gap-1.5"
          >
            <ClipboardPaste className="w-3.5 h-3.5 text-purple-600" />
            <span>Smart Paste วางโจทย์</span>
          </button>
        </div>
      </aside>

      {/* MOBILE / TABLET STICKY PILL BAR (< lg screens) */}
      <div className="lg:hidden sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-stone-200 px-3 py-2 flex items-center gap-2 overflow-x-auto shadow-2xs select-none">
        <span className="text-[11px] font-bold text-stone-500 uppercase shrink-0">
          ข้อ:
        </span>
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar">
          {questions.map((q, idx) => {
            const qNum = q.question_number || idx + 1;
            const isActive = idx === activeIndex;
            const issue = questionIssueMap.get(qNum);
            const isSubj = q.question_type === 'subjective';

            return (
              <button
                key={q.id || idx}
                ref={isActive ? activePillRef : null}
                type="button"
                onClick={() => onSelectQuestion(idx)}
                className={`h-8 px-3 rounded-full text-xs font-bold transition-all flex items-center gap-1 shrink-0 ${
                  isActive 
                    ? 'bg-primary text-white shadow-xs scale-105' 
                    : isSubj 
                    ? 'bg-amber-100 text-amber-900 hover:bg-amber-200' 
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                <span>#{qNum}</span>
                {q.diagram_svg && (
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 ring-1 ring-white" title="มีภาพวาด Goodnotes Ink" />
                )}
                {issue?.hasError ? (
                  <span className="w-2 h-2 rounded-full bg-rose-500 ring-1 ring-white" />
                ) : issue?.hasWarning ? (
                  <span className="w-2 h-2 rounded-full bg-amber-500 ring-1 ring-white" />
                ) : null}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => onAddQuestion('mcq')}
          className="h-8 px-2.5 rounded-full bg-stone-900 text-white text-xs font-bold flex items-center gap-1 shrink-0 ml-auto shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>เพิ่ม</span>
        </button>
      </div>
    </>
  );
}
