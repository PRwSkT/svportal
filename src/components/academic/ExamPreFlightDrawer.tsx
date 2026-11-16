'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShieldCheck, 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  Pin, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  BarChart3, 
  Award,
  Sparkles,
  Check,
  Loader2,
  RefreshCw,
  Brain,
  BookOpen,
  HelpCircle,
  TrendingUp
} from 'lucide-react';
import { PreFlightReport, PreFlightIssue, PreFlightSeverity } from '@/lib/academic/preflight-validator';
import { ChoiceOption, AcademicExamQuestion } from '@/types/academic';

export interface AiAuditSummary {
  overall_score: number;
  verdict: string;
  blooms_distribution: {
    remembering: number;
    understanding: number;
    applying: number;
    analyzing: number;
    evaluating: number;
    creating: number;
  };
  difficulty_distribution: {
    easy: number;
    medium: number;
    hard: number;
  };
  key_distribution: Record<string, number>;
  key_distribution_bias: string;
}

export interface AiAuditIssue {
  question_number: number;
  severity: 'error' | 'warning' | 'suggestion';
  category: 'ambiguity' | 'curriculum' | 'distractor' | 'formatting' | 'key_bias';
  issue: string;
  recommendation: string;
}

export interface AiAuditResult {
  success: boolean;
  audit_summary: AiAuditSummary;
  issues: AiAuditIssue[];
  actionable_recommendations: string[];
}

interface ExamPreFlightDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  report: PreFlightReport;
  examConfig?: {
    total_score?: number;
    duration_minutes?: number;
  };
  onJumpToQuestion: (questionNumber: number) => void;
  onAutoFixPinAll: () => void;
  onAutoFixPinQuestion: (questionNumber: number) => void;
  questions?: AcademicExamQuestion[];
  subjectName?: string;
  gradeLevel?: string;
  examTitle?: string;
  initialTab?: 'preflight' | 'ai_audit';
}

export function ExamPreFlightDrawer({
  isOpen,
  onClose,
  report,
  examConfig,
  onJumpToQuestion,
  onAutoFixPinAll,
  onAutoFixPinQuestion,
  questions = [],
  subjectName = 'วิชาทั่วไป',
  gradeLevel = 'P3',
  examTitle = 'แบบทดสอบวัดผลสัมฤทธิ์',
  initialTab = 'preflight'
}: ExamPreFlightDrawerProps) {
  const [activeTab, setActiveTab] = useState<'preflight' | 'ai_audit'>(initialTab);
  const [filterSeverity, setFilterSeverity] = useState<PreFlightSeverity | 'all'>('all');

  // AI Pedagogy Audit States
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditData, setAuditData] = useState<AiAuditResult | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  if (!isOpen) return null;

  const filteredIssues = report.issues.filter(issue => {
    if (filterSeverity === 'all') return true;
    return issue.severity === filterSeverity;
  });

  const unpinnedChoiceIssues = report.issues.filter(i => i.autoFixAction === 'pin_choice');
  const hasUnpinnedIssues = unpinnedChoiceIssues.length > 0;

  // Key distribution percentages
  const slots: ChoiceOption[] = ['A', 'B', 'C', 'D'];
  const totalKeys = slots.reduce((acc, slot) => acc + (report.keyDistribution[slot] || 0), 0);

  // Trigger Whole-Exam AI Pedagogy & Curriculum Audit
  const handleRunAiAudit = async () => {
    if (!questions || questions.length === 0) {
      setAuditError('ไม่พบข้อสอบในชุดนี้ กรุณาเพิ่มข้อสอบก่อนตรวจวิเคราะห์');
      return;
    }

    setIsAuditing(true);
    setAuditError(null);
    try {
      const res = await fetch('/api/academic/exams/ai-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'audit_exam',
          questions,
          subject_name: subjectName,
          grade_level: gradeLevel,
          exam_title: examTitle
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setAuditError(data.error || 'เกิดข้อผิดพลาดในการตรวจสอบคุณภาพข้อสอบ');
      } else {
        setAuditData(data);
      }
    } catch (err: any) {
      setAuditError(err?.message || 'ไม่สามารถเชื่อมต่อระบบตรวจวิเคราะห์วิชาการได้');
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[140] flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-xl md:max-w-2xl bg-white h-full shadow-2xl border-l border-stone-200 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
              report.errorCount > 0 
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                : report.warningCount > 0 
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            }`}>
              {report.errorCount > 0 ? (
                <AlertCircle className="w-5 h-5 text-rose-400" />
              ) : report.warningCount > 0 ? (
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              ) : (
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base leading-tight">Pre-Flight & Pedagogy Quality Audit</h3>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                  report.errorCount > 0
                    ? 'bg-rose-500/20 text-rose-200 border-rose-500/30'
                    : report.warningCount > 0
                    ? 'bg-amber-500/20 text-amber-200 border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30'
                }`}>
                  {report.errorCount > 0 ? `พบปัญหา ${report.errorCount} จุด` : report.warningCount > 0 ? `ข้อควรระวัง ${report.warningCount} รายการ` : 'สมบูรณ์ 100%'}
                </span>
              </div>
              <p className="text-xs text-stone-400">
                ระบบตรวจคุณภาพวิชาการ มาตรฐานหลักสูตร Bloom's Taxonomy และความพร้อมพิมพ์
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            title="ปิดพาเนล"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dual Tab Navigator: Rule Pre-Flight vs AI Pedagogy Deep Audit */}
        <div className="flex border-b border-stone-200 bg-stone-100 px-6 pt-2.5 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('preflight')}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'preflight'
                ? 'bg-white text-stone-900 border-t-2 border-primary shadow-xs'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-stone-600" />
            <span>Pre-Flight กฎพื้นฐาน ({report.issues.length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('ai_audit');
              if (!auditData && !isAuditing && questions.length > 0) {
                handleRunAiAudit();
              }
            }}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'ai_audit'
                ? 'bg-white text-purple-900 border-t-2 border-purple-600 shadow-xs'
                : 'text-stone-500 hover:text-purple-700'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>ให้น้องฟ้าตรวจวิเคราะห์เชิงลึก (AI Pedagogy Audit)</span>
            {auditData && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-100 text-purple-700 font-bold">
                {auditData.audit_summary.overall_score} คะแนน
              </span>
            )}
          </button>
        </div>

        {/* ============================================================== */}
        {/* TAB 1: TECHNICAL PRE-FLIGHT VALIDATOR */}
        {/* ============================================================== */}
        {activeTab === 'preflight' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* AI Pedagogy Invitation Banner */}
            <div className="px-5 py-2.5 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-200/60 flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center gap-2 text-purple-950 font-medium">
                <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                <span>วิเคราะห์ความสอดคล้องหลักสูตรแกนกลาง & Bloom's Taxonomy</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('ai_audit');
                  if (!auditData && !isAuditing) handleRunAiAudit();
                }}
                className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg text-xs flex items-center gap-1 transition-colors shadow-2xs shrink-0"
              >
                <span>ตรวจเชิงลึกด้วย AI</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* Quality Summary Metric Cards */}
            <div className="p-4 bg-stone-50 border-b border-stone-200 grid grid-cols-3 gap-2.5 shrink-0 text-xs">
              {/* Questions & Points */}
              <div className="p-2.5 bg-white rounded-xl border border-stone-200 flex flex-col justify-between">
                <span className="text-[11px] text-stone-500 font-medium flex items-center gap-1">
                  <Award className="w-3.5 h-3.5 text-stone-400" />
                  ข้อสอบ / คะแนนรวม
                </span>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-base font-bold text-stone-900">{report.totalQuestions}</span>
                  <span className="text-[11px] text-stone-400">ข้อ</span>
                  <span className="text-stone-300">/</span>
                  <span className="text-sm font-bold text-primary">{report.totalPoints}</span>
                  <span className="text-[11px] text-stone-400">คะแนน</span>
                </div>
                {examConfig?.total_score && Math.abs(report.totalPoints - examConfig.total_score) > 0.01 && (
                  <span className="text-[10px] text-rose-600 font-semibold mt-0.5">
                    (ตั้งไว้ {examConfig.total_score} คะแนน)
                  </span>
                )}
              </div>

              {/* Time Estimate */}
              <div className="p-2.5 bg-white rounded-xl border border-stone-200 flex flex-col justify-between">
                <span className="text-[11px] text-stone-500 font-medium flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-stone-400" />
                  เวลาทำโดยประมาณ
                </span>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-base font-bold text-stone-900">~{report.estimatedCompletionMinutes}</span>
                  <span className="text-[11px] text-stone-400">นาที</span>
                </div>
                {examConfig?.duration_minutes && (
                  <span className="text-[10px] text-stone-400 mt-0.5">
                    เวลาสอบ: {examConfig.duration_minutes} นาที
                  </span>
                )}
              </div>

              {/* Issue Breakdown */}
              <div className="p-2.5 bg-white rounded-xl border border-stone-200 flex flex-col justify-between">
                <span className="text-[11px] text-stone-500 font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-stone-400" />
                  สถานะตรวจสอบ
                </span>
                <div className="mt-1 flex items-center gap-2 font-bold">
                  {report.errorCount > 0 ? (
                    <span className="text-rose-600 flex items-center gap-0.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {report.errorCount} จุด
                    </span>
                  ) : (
                    <span className="text-emerald-600 flex items-center gap-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      ผ่าน
                    </span>
                  )}
                  {report.warningCount > 0 && (
                    <span className="text-amber-600 text-[11px] font-medium">
                      ({report.warningCount} เตือน)
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-stone-400 mt-0.5">
                  {report.canPrint ? '✓ พร้อมสั่งพิมพ์' : '✗ ยังไม่พร้อมพิมพ์'}
                </span>
              </div>
            </div>

            {/* Answer Key Distribution Chart (MCQ) */}
            {totalKeys > 0 && (
              <div className="px-5 py-3 bg-white border-b border-stone-200 text-xs shrink-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-stone-700 flex items-center gap-1.5 text-[11px]">
                    <BarChart3 className="w-3.5 h-3.5 text-stone-500" />
                    การกระจายเฉลยตัวเลือก ({totalKeys} ข้อปรนัย)
                  </span>
                  <span className="text-[10px] text-stone-400">
                    สมดุลเฉลี่ย: 20-30% ต่อตัวเลือก
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {slots.map(slot => {
                    const count = report.keyDistribution[slot] || 0;
                    const pct = totalKeys > 0 ? Math.round((count / totalKeys) * 100) : 0;
                    const isSkewed = pct >= 50;
                    const isMissing = count === 0 && totalKeys >= 8;

                    return (
                      <div 
                        key={slot}
                        className={`p-2 rounded-lg border text-center ${
                          isSkewed 
                            ? 'bg-rose-50 border-rose-200 text-rose-900' 
                            : isMissing 
                            ? 'bg-amber-50 border-amber-200 text-amber-900' 
                            : 'bg-stone-50 border-stone-200 text-stone-700'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                          <span>ข้อ {slot}</span>
                          <span>{pct}%</span>
                        </div>
                        {/* Bar */}
                        <div className="w-full bg-stone-200 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              isSkewed ? 'bg-rose-500' : isMissing ? 'bg-amber-400' : 'bg-primary'
                            }`}
                            style={{ width: `${Math.min(100, pct * 2)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-stone-500 mt-1 block">
                          {count} ข้อ
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 1-Click Quick Fix All Unpinned Banner */}
            {hasUnpinnedIssues && (
              <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-3 text-xs shrink-0">
                <div className="flex items-center gap-2">
                  <Pin className="w-4 h-4 text-amber-600 shrink-0" />
                  <div className="text-[11px] text-amber-900 leading-tight">
                    <strong>ตรวจพบ {unpinnedChoiceIssues.length} ข้อ</strong> ที่มีตัวเลือก "ถูกทุกข้อ" แต่ยังไม่ได้ล็อกตำแหน่ง
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onAutoFixPinAll}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-xs transition-colors shrink-0 shadow-2xs flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  ล็อกตำแหน่งทั้งหมดใน 1 คลิก
                </button>
              </div>
            )}

            {/* Filter Tabs */}
            <div className="px-5 py-2 bg-stone-100 border-b border-stone-200 flex items-center gap-1 text-xs shrink-0">
              <button
                type="button"
                onClick={() => setFilterSeverity('all')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                  filterSeverity === 'all' 
                    ? 'bg-white text-stone-900 shadow-2xs' 
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                ทั้งหมด ({report.issues.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterSeverity('error')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1 ${
                  filterSeverity === 'error' 
                    ? 'bg-rose-600 text-white shadow-2xs' 
                    : 'text-rose-700 hover:bg-rose-50'
                }`}
              >
                <AlertCircle className="w-3 h-3" />
                ข้อผิดพลาด ({report.errorCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterSeverity('warning')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1 ${
                  filterSeverity === 'warning' 
                    ? 'bg-amber-600 text-white shadow-2xs' 
                    : 'text-amber-700 hover:bg-amber-50'
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                ข้อควรระวัง ({report.warningCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterSeverity('info')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1 ${
                  filterSeverity === 'info' 
                    ? 'bg-blue-600 text-white shadow-2xs' 
                    : 'text-blue-700 hover:bg-blue-50'
                }`}
              >
                <Info className="w-3 h-3" />
                คำแนะนำ ({report.infoCount})
              </button>
            </div>

            {/* Issue Cards List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredIssues.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-stone-400">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-2 stroke-1" />
                  <p className="text-sm font-bold text-stone-700">ไม่พบปัญหาในหมวดนี้</p>
                  <p className="text-xs text-stone-400 mt-0.5">
                    ข้อสอบผ่านเกณฑ์คุณภาพมาตรฐานเรียบร้อยแล้ว
                  </p>
                </div>
              ) : (
                filteredIssues.map((issue) => {
                  const isError = issue.severity === 'error';
                  const isWarning = issue.severity === 'warning';

                  return (
                    <div 
                      key={issue.id}
                      className={`p-3.5 rounded-xl border transition-all text-xs space-y-2 ${
                        isError 
                          ? 'bg-rose-50/70 border-rose-200' 
                          : isWarning 
                          ? 'bg-amber-50/70 border-amber-200' 
                          : 'bg-blue-50/70 border-blue-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          {isError ? (
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          ) : isWarning ? (
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          ) : (
                            <Info className="w-4 h-4 text-blue-600 shrink-0" />
                          )}
                          <span className={`font-bold ${
                            isError ? 'text-rose-900' : isWarning ? 'text-amber-900' : 'text-blue-900'
                          }`}>
                            {issue.title}
                          </span>
                        </div>

                        {issue.question_number && (
                          <span className="px-2 py-0.5 rounded bg-white border border-stone-200 text-stone-700 font-mono font-bold text-[11px] shrink-0">
                            ข้อที่ #{issue.question_number}
                          </span>
                        )}
                      </div>

                      <p className="text-stone-600 text-[11px] leading-relaxed">
                        {issue.description}
                      </p>

                      {issue.suggestion && (
                        <div className="p-2 bg-white/80 rounded-lg border border-stone-200/80 text-[11px] text-stone-700 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>{issue.suggestion}</span>
                        </div>
                      )}

                      {/* Action Bar */}
                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-stone-200/60">
                        {issue.autoFixAction === 'pin_choice' && issue.question_number && (
                          <button
                            type="button"
                            onClick={() => onAutoFixPinQuestion(issue.question_number!)}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-md text-[11px] flex items-center gap-1 transition-colors shadow-2xs"
                          >
                            <Pin className="w-3 h-3" />
                            ล็อกตำแหน่งทันที (1-Click)
                          </button>
                        )}

                        {issue.question_number && (
                          <button
                            type="button"
                            onClick={() => {
                              onJumpToQuestion(issue.question_number!);
                              onClose();
                            }}
                            className="px-2.5 py-1 bg-white hover:bg-stone-100 text-stone-700 font-semibold rounded-md border border-stone-300 text-[11px] flex items-center gap-1 transition-colors"
                          >
                            <span>ไปยังข้อสอบข้อนี้</span>
                            <ArrowRight className="w-3 h-3 text-stone-500" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: NONG FAH AI PEDAGOGY DEEP AUDIT */}
        {/* ============================================================== */}
        {activeTab === 'ai_audit' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Loading State */}
            {isAuditing && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3 bg-purple-50/30">
                <div className="w-14 h-14 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center shadow-xs">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-stone-900">
                    น้องฟ้ากำลังตรวจวิเคราะห์ชุดข้อสอบเชิงลึก...
                  </h4>
                  <p className="text-xs text-stone-500 max-w-sm">
                    ประเมินการกระจาย Bloom's Taxonomy, ความกำกวมของภาษา, และวิเคราะห์ตัวลวงเชิงวินิจฉัย (Psychometrics & Curriculum Alignment)
                  </p>
                </div>
              </div>
            )}

            {/* Error State */}
            {!isAuditing && auditError && (
              <div className="p-6 flex flex-col items-center justify-center text-center space-y-3">
                <AlertCircle className="w-10 h-10 text-rose-500" />
                <p className="text-xs font-semibold text-rose-700">{auditError}</p>
                <button
                  type="button"
                  onClick={handleRunAiAudit}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>ลองใหม่อีกครั้ง</span>
                </button>
              </div>
            )}

            {/* Unaudited Invitation State */}
            {!isAuditing && !auditError && !auditData && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-5 bg-gradient-to-b from-stone-50 to-purple-50/30">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-purple-500/20">
                  <Sparkles className="w-8 h-8" />
                </div>
                <div className="max-w-md space-y-2">
                  <h4 className="font-bold text-base text-stone-900">
                    ให้น้องฟ้าตรวจวิเคราะห์เชิงลึก (Pedagogy & Curriculum Audit)
                  </h4>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    ระบบ AI ผู้เชี่ยวชาญด้านการวัดและประเมินผลทางการศึกษา:
                    วิเคราะห์ความสอดคล้องตามมาตรฐานหลักสูตร, การกระจายทักษะคิด 6 ระดับตาม Bloom's Taxonomy, ตรวจจับคำกำกวม และให้ข้อเสนอแนะพัฒนารายข้อ
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-left max-w-sm w-full">
                  <div className="p-2.5 bg-white rounded-xl border border-stone-200 flex items-center gap-2 text-xs">
                    <Brain className="w-4 h-4 text-purple-600 shrink-0" />
                    <div>
                      <strong className="block text-stone-800 text-[11px]">Bloom's Taxonomy</strong>
                      <span className="text-[10px] text-stone-400">กระจายระดับความคิด</span>
                    </div>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-stone-200 flex items-center gap-2 text-xs">
                    <BookOpen className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <strong className="block text-stone-800 text-[11px]">Curriculum Fit</strong>
                      <span className="text-[10px] text-stone-400">ตรงตัวชี้วัดหลักสูตร</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRunAiAudit}
                  disabled={questions.length === 0}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md shadow-purple-500/20 flex items-center gap-2 transition-all hover:scale-105 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>ให้น้องฟ้าตรวจวิเคราะห์เชิงลึก (Pedagogy & Curriculum Audit)</span>
                </button>
              </div>
            )}

            {/* Audit Results View */}
            {!isAuditing && auditData && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* 1. Overall Score & Verdict Banner */}
                <div className="p-4 bg-gradient-to-r from-purple-50 via-indigo-50/60 to-purple-50 rounded-2xl border border-purple-200 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-purple-700">
                        คะแนนคุณภาพวิชาการ (Pedagogy Quality Score)
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        auditData.audit_summary.overall_score >= 80 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : auditData.audit_summary.overall_score >= 70 
                          ? 'bg-amber-100 text-amber-800' 
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {auditData.audit_summary.overall_score >= 80 ? 'ดีเยี่ยม' : 'ควรปรับปรุง'}
                      </span>
                    </div>
                    <p className="text-xs text-stone-700 font-medium leading-relaxed">
                      {auditData.audit_summary.verdict}
                    </p>
                  </div>

                  <div className="flex flex-col items-center shrink-0">
                    <div className="text-2xl font-black text-purple-900">
                      {auditData.audit_summary.overall_score}
                      <span className="text-xs text-stone-400 font-normal">/100</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRunAiAudit}
                      className="mt-1 px-2.5 py-1 bg-white hover:bg-stone-50 border border-purple-200 rounded-lg text-[10px] text-purple-700 font-semibold flex items-center gap-1 shadow-2xs"
                    >
                      <RefreshCw className="w-3 h-3" />
                      ตรวจใหม่
                    </button>
                  </div>
                </div>

                {/* 2. Bloom's Cognitive Taxonomy Breakdown */}
                <div className="p-4 bg-white rounded-xl border border-stone-200 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-800 flex items-center gap-1.5">
                      <Brain className="w-4 h-4 text-purple-600" />
                      การกระจายระดับความคิดตามกรอบ Bloom's Taxonomy
                    </span>
                    <span className="text-[10px] text-stone-400">
                      รวม {questions.length} ข้อ
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {[
                      { key: 'remembering', label: 'ความจำ (Remembering)', count: auditData.audit_summary.blooms_distribution.remembering || 0, color: 'bg-sky-500' },
                      { key: 'understanding', label: 'ความเข้าใจ (Understanding)', count: auditData.audit_summary.blooms_distribution.understanding || 0, color: 'bg-emerald-500' },
                      { key: 'applying', label: 'การประยุกต์ใช้ (Applying)', count: auditData.audit_summary.blooms_distribution.applying || 0, color: 'bg-amber-500' },
                      { key: 'analyzing', label: 'การวิเคราะห์ (Analyzing)', count: auditData.audit_summary.blooms_distribution.analyzing || 0, color: 'bg-purple-500' },
                      { key: 'evaluating', label: 'การประเมินค่า (Evaluating)', count: auditData.audit_summary.blooms_distribution.evaluating || 0, color: 'bg-rose-500' },
                      { key: 'creating', label: 'การสร้างสรรค์ (Creating)', count: auditData.audit_summary.blooms_distribution.creating || 0, color: 'bg-fuchsia-500' }
                    ].map(b => {
                      const total = questions.length || 1;
                      const pct = Math.round((b.count / total) * 100);
                      return (
                        <div key={b.key} className="p-2 rounded-lg bg-stone-50 border border-stone-200">
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="text-stone-700 font-medium truncate">{b.label}</span>
                            <span className="font-bold text-stone-900">{b.count} ข้อ</span>
                          </div>
                          <div className="w-full bg-stone-200 h-1.5 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${b.color}`} style={{ width: `${Math.min(100, pct)}%` }} />
                          </div>
                          <span className="text-[10px] text-stone-400 mt-1 block text-right">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Difficulty Calibration & Key Distribution Bias */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {/* Difficulty */}
                  <div className="p-3.5 bg-white rounded-xl border border-stone-200 space-y-2">
                    <span className="font-bold text-stone-800 flex items-center gap-1.5 text-[11px]">
                      <TrendingUp className="w-3.5 h-3.5 text-stone-500" />
                      ระดับความยากง่าย (Difficulty)
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
                        <span className="text-[10px] text-emerald-700 block font-medium">ง่าย</span>
                        <strong className="text-xs text-emerald-900">{auditData.audit_summary.difficulty_distribution.easy || 0} ข้อ</strong>
                      </div>
                      <div className="flex-1 p-2 rounded-lg bg-amber-50 border border-amber-200 text-center">
                        <span className="text-[10px] text-amber-700 block font-medium">ปานกลาง</span>
                        <strong className="text-xs text-amber-900">{auditData.audit_summary.difficulty_distribution.medium || 0} ข้อ</strong>
                      </div>
                      <div className="flex-1 p-2 rounded-lg bg-rose-50 border border-rose-200 text-center">
                        <span className="text-[10px] text-rose-700 block font-medium">ยาก</span>
                        <strong className="text-xs text-rose-900">{auditData.audit_summary.difficulty_distribution.hard || 0} ข้อ</strong>
                      </div>
                    </div>
                  </div>

                  {/* Key Bias Description */}
                  <div className="p-3.5 bg-white rounded-xl border border-stone-200 space-y-1.5 flex flex-col justify-between">
                    <span className="font-bold text-stone-800 flex items-center gap-1.5 text-[11px]">
                      <BarChart3 className="w-3.5 h-3.5 text-stone-500" />
                      สมดุลเฉลย (Key Balance)
                    </span>
                    <p className="text-[11px] text-stone-600 leading-snug">
                      {auditData.audit_summary.key_distribution_bias || 'การกระจายตัวเลือกเฉลยอยู่ในเกณฑ์สมดุลดี'}
                    </p>
                    <span className="text-[10px] text-stone-400">
                      ตรวจจับการเรียงเฉลยติดกันและความเอนเอียง
                    </span>
                  </div>
                </div>

                {/* 4. Actionable Recommendations from Nong Fah */}
                {Array.isArray(auditData.actionable_recommendations) && auditData.actionable_recommendations.length > 0 && (
                  <div className="p-4 bg-purple-50/60 rounded-xl border border-purple-200/80 space-y-2 text-xs">
                    <span className="font-bold text-purple-950 flex items-center gap-1.5 text-[11px]">
                      <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                      ข้อเสนอแนะเชิงพัฒนาการจากน้องฟ้า (Pedagogy Insights)
                    </span>
                    <ul className="space-y-1.5 pl-1">
                      {auditData.actionable_recommendations.map((rec, rIdx) => (
                        <li key={rIdx} className="flex items-start gap-2 text-stone-700 text-[11px] leading-relaxed">
                          <Check className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 5. Specific Question Issues & Recommendations */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-stone-800">
                      ประเด็นตรวจพบและข้อเสนอแนะรายข้อ ({auditData.issues?.length || 0} รายการ)
                    </span>
                  </div>

                  {(!auditData.issues || auditData.issues.length === 0) ? (
                    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center text-xs text-emerald-800 font-medium">
                      ✓ ไม่พบข้อบกพร่องด้านวิชาการในรายข้อ ข้อสอบมีคุณภาพสูง
                    </div>
                  ) : (
                    auditData.issues.map((issue, iIdx) => {
                      const isErr = issue.severity === 'error';
                      const isWarn = issue.severity === 'warning';

                      return (
                        <div 
                          key={iIdx}
                          className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                            isErr ? 'bg-rose-50/60 border-rose-200' : isWarn ? 'bg-amber-50/60 border-amber-200' : 'bg-stone-50 border-stone-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              {isErr ? (
                                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                              ) : isWarn ? (
                                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                              ) : (
                                <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                              )}
                              <span className="font-bold text-stone-900">
                                {issue.category === 'ambiguity' ? 'ความกำกวมของโจทย์' :
                                 issue.category === 'curriculum' ? 'ความสอดคล้องหลักสูตร' :
                                 issue.category === 'distractor' ? 'คุณภาพตัวเลือกหลอก' :
                                 issue.category === 'key_bias' ? 'สมดุลเฉลย' : 'การจัดรูปแบบ'}
                              </span>
                            </div>

                            {issue.question_number > 0 && (
                              <span className="px-2 py-0.5 rounded bg-white border border-stone-200 text-stone-700 font-mono font-bold text-[11px] shrink-0">
                                ข้อที่ #{issue.question_number}
                              </span>
                            )}
                          </div>

                          <p className="text-stone-700 text-[11px] leading-relaxed">
                            {issue.issue}
                          </p>

                          {issue.recommendation && (
                            <div className="p-2 bg-white/90 rounded-lg border border-stone-200/80 text-[11px] text-purple-900 flex items-start gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                              <span><strong>ข้อเสนอแนะ:</strong> {issue.recommendation}</span>
                            </div>
                          )}

                          {issue.question_number > 0 && (
                            <div className="flex justify-end pt-1 border-t border-stone-200/60">
                              <button
                                type="button"
                                onClick={() => {
                                  onJumpToQuestion(issue.question_number);
                                  onClose();
                                }}
                                className="px-2.5 py-1 bg-white hover:bg-stone-100 text-stone-700 font-semibold rounded-md border border-stone-300 text-[11px] flex items-center gap-1 transition-colors"
                              >
                                <span>ไปยังข้อสอบข้อนี้</span>
                                <ArrowRight className="w-3 h-3 text-stone-500" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-stone-500">
            {activeTab === 'ai_audit' 
              ? 'ระบบตรวจวิเคราะห์วิชาการ Nong Fah AI 2.0 สพฐ. & Bloom’s Taxonomy' 
              : 'ระบบตรวจสอบอัตโนมัติตามมาตรฐานงานวิชาการ สพฐ.'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-xl transition-colors"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
}
