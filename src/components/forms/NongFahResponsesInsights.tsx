'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, ShieldCheck, RefreshCw, Loader2, AlertCircle,
  TrendingUp, Lightbulb, CheckCircle2, ChevronDown, ChevronUp,
  FileSpreadsheet, MessageSquare, Bot, UserCheck
} from 'lucide-react';
import { toast } from 'sonner';

export interface StudentInsightItem {
  student_id: string;
  category: 'urgent_followup' | 'health_allergy' | 'update_record' | 'special_request' | 'general';
  topic: string;
  details: string;
  suggested_action: string;
  student_profile?: {
    id: string;
    name: string;
    grade: string;
    status: string;
    current_height?: number | null;
    current_weight?: number | null;
    current_disability?: string | null;
    parent_phone?: string | null;
  } | null;
}

interface NongFahSummaryData {
  executive_summary?: string;
  executiveSummary?: string;
  total_analyzed?: number;
  totalAnalyzed?: number;
  key_findings?: string[];
  keyFindings?: string[];
  sentiment_overview?: {
    overall?: 'positive' | 'neutral' | 'negative' | 'mixed';
    details?: string;
    summary?: string;
  };
  sentimentOverview?: {
    positivePercentage?: number;
    neutralPercentage?: number;
    negativePercentage?: number;
    summary?: string;
  };
  recommendations?: string[];
  actionableRecommendations?: string[];
  studentSpecificInsights?: StudentInsightItem[];
  student_specific_insights?: StudentInsightItem[];
  anonymized_metrics?: {
    label: string;
    value: string | number;
  }[];
}

interface NongFahResponsesInsightsProps {
  formId: string;
  totalResponses: number;
}

export function NongFahResponsesInsights({
  formId,
  totalResponses,
}: NongFahResponsesInsightsProps) {
  const [summary, setSummary] = useState<NongFahSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  const fetchSummary = async () => {
    if (totalResponses === 0) {
      toast.info('ยังไม่มีข้อมูลการตอบกลับสำหรับสรุปผล');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/forms/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formId }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'ไม่สามารถวิเคราะห์ข้อมูลได้');
      }

      setSummary(json.data);
      setIsExpanded(true);
      toast.success('น้องฟ้ารวบรวมและวิเคราะห์ผลสำเร็จเรียบร้อยแล้ว');
    } catch (err: any) {
      console.error('Nong Fah summary error:', err);
      setError(err?.message || 'เกิดข้อผิดพลาดในการประมวลผล');
      toast.error('การวิเคราะห์ข้อมูลไม่สำเร็จ', { description: err?.message });
    } finally {
      setIsLoading(false);
    }
  };

  const getSentimentBadge = (overall?: string) => {
    switch (overall) {
      case 'positive':
        return { text: 'เชิงบวกและพึงพอใจสูง', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
      case 'negative':
        return { text: 'มีประเด็นที่ควรปรับปรุง', bg: 'bg-rose-50 text-rose-800 border-rose-200' };
      case 'mixed':
        return { text: 'มีความคิดเห็นหลากหลาย', bg: 'bg-amber-50 text-amber-800 border-amber-200' };
      default:
        return { text: 'ระดับปกติ / เป็นกลาง', bg: 'bg-slate-50 text-slate-800 border-slate-200' };
    }
  };

  return (
    <div id="nong-fah-insights" className="bg-gradient-to-br from-sky-50/70 via-white to-indigo-50/40 border border-sky-200 rounded-3xl p-5 sm:p-6 shadow-xs mb-8 transition-all scroll-mt-24">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-md shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                น้องฟ้าสรุปผลการตอบ (AI Executive Insights)
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                <span>PDPA Zero-PII Protected</span>
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              ใช้โมเดล Gemma วิเคราะห์แนวโน้ม สรุปประเด็นสำคัญ และข้อเสนอแนะเชิงบริหาร โดยข้อมูลส่วนบุคคลถูกลบ 100% ก่อนประมวลผล
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <button
            type="button"
            onClick={fetchSummary}
            disabled={isLoading || totalResponses === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all hover:shadow disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>กำลังวิเคราะห์...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>{summary ? 'วิเคราะห์ข้อมูลใหม่' : 'ให้น้องฟ้าสรุปผลข้อมูล'}</span>
              </>
            )}
          </button>

          {summary && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2.5 text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
              title={isExpanded ? 'ย่อเนื้อหา' : 'ขยายเนื้อหา'}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Initial Empty Banner when not yet summarized */}
      {!summary && !isLoading && !error && (
        <div className="mt-4 pt-4 border-t border-sky-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 bg-white/70 p-4 rounded-2xl border border-sky-100">
          <div className="flex items-center gap-2.5">
            <Bot className="w-5 h-5 text-sky-600 shrink-0" />
            <span>
              {totalResponses === 0
                ? 'ยังไม่มีผู้ตอบแบบฟอร์ม เมื่อมีผู้ตอบเข้ามา คุณสามารถกดให้น้องฟ้าสรุปผลได้ทันที'
                : `มีข้อมูลพร้อมวิเคราะห์ทั้งหมด ${totalResponses} ชุดข้อมูล กดปุ่ม "ให้น้องฟ้าสรุปผลข้อมูล" ด้านบนเพื่อดูบทสรุปผู้บริหาร`}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <span>ระบบคัดกรองชื่อ, เบอร์โทร, เลขประจำตัว อัตโนมัติ</span>
          </div>
        </div>
      )}

      {/* Loading state skeleton */}
      {isLoading && (
        <div className="mt-5 pt-5 border-t border-sky-100 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-sky-800">
            <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
            <span>น้องฟ้ากำลังดึงสถิติ กรองข้อมูลส่วนบุคคล และประมวลผลข้อคิดเห็นผ่าน Gemma AI...</span>
          </div>
          <div className="h-20 bg-white/60 animate-pulse rounded-2xl border border-sky-100" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="h-24 bg-white/60 animate-pulse rounded-2xl border border-sky-100" />
            <div className="h-24 bg-white/60 animate-pulse rounded-2xl border border-sky-100" />
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <div className="mt-4 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">การสรุปผลไม่สำเร็จ: </span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Result Display */}
      <AnimatePresence>
        {summary && isExpanded && !isLoading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-6 pt-6 border-t border-sky-100 space-y-5"
          >
            {/* Executive Summary */}
            <div className="bg-white rounded-2xl p-5 border border-sky-200/80 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-bold text-sky-900 mb-2">
                <FileSpreadsheet className="w-4 h-4 text-sky-600" />
                <span>บทสรุปผู้บริหาร (Executive Summary)</span>
                <span className="text-[11px] font-normal text-slate-500 font-mono ml-auto">
                  วิเคราะห์จาก {summary.total_analyzed || summary.totalAnalyzed || totalResponses} การตอบกลับ
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                {summary.executive_summary || summary.executiveSummary}
              </p>
            </div>

            {/* Two-column insights: Key Findings & Recommendations */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Key Findings */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 mb-3">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <span>ประเด็นและข้อสังเกตสำคัญ (Key Findings)</span>
                </div>
                <ul className="space-y-2.5">
                  {(summary.key_findings || summary.keyFindings || []).map((finding, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="leading-snug">{finding}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Recommendations */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 mb-3">
                  <Lightbulb className="w-4 h-4 text-amber-500" />
                  <span>ข้อเสนอแนะเชิงบริหาร (Actionable Recommendations)</span>
                </div>
                <ul className="space-y-2.5">
                  {(summary.recommendations || summary.actionableRecommendations || []).map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700">
                      <span className="w-4 h-4 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="leading-snug">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Student-Specific Insights (Live DB Enriched) */}
            {((summary.studentSpecificInsights || summary.student_specific_insights) || []).length > 0 && (
              <div className="bg-white rounded-2xl p-5 border border-sky-200/90 shadow-2xs">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                    <UserCheck className="w-4 h-4 text-sky-600" />
                    <span>ข้อมูลและประเด็นเฉพาะรายบุคคล (Student-Specific Insights)</span>
                  </div>
                  <span className="text-[11px] font-semibold text-sky-800 bg-sky-50 border border-sky-200 px-2.5 py-0.5 rounded-full">
                    ดึงข้อมูลสดจากฐานข้อมูล {((summary.studentSpecificInsights || summary.student_specific_insights) || []).length} รายการ
                  </span>
                </div>
                <div className="space-y-3">
                  {((summary.studentSpecificInsights || summary.student_specific_insights) || []).map((item, idx) => {
                    const profile = item.student_profile;
                    return (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-sky-300 transition-all"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">
                              {profile?.name || `นักเรียนรหัส ${item.student_id}`}
                            </span>
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                              รหัส {item.student_id}
                            </span>
                            {profile?.grade && (
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-sky-100 text-sky-800">
                                ชั้น {profile.grade}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 self-start sm:self-auto">
                            {item.topic}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed">
                          {item.details}
                        </p>
                        {item.suggested_action && (
                          <div className="mt-2 text-[11px] text-sky-900 bg-sky-50/80 border border-sky-100 p-2 rounded-lg flex items-start gap-1.5">
                            <span className="font-bold shrink-0">ข้อแนะนำ:</span>
                            <span>{item.suggested_action}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sentiment & Tone (if available) */}
            {summary.sentiment_overview && (
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <MessageSquare className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      โทนความคิดเห็นและความพึงพอใจโดยรวม
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5">
                      {summary.sentiment_overview.details}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 self-start sm:self-center">
                  {(() => {
                    const badge = getSentimentBadge(summary.sentiment_overview.overall);
                    return (
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${badge.bg}`}>
                        {badge.text}
                      </span>
                    );
                  })()}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
