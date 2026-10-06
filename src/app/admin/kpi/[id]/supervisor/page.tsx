'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { KpiEvaluation, KpiTemplate } from '@/types/kpi';
import { getEvaluationDetail, submitSupervisorEvaluation } from '../../actions';
import { calculateKpiScoreSummaries } from '@/lib/kpi/scoring';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle2,
  HelpCircle,
  Info,
  Loader2,
  Save,
  Sparkles,
  Star,
  User,
  UserCheck,
  AlertCircle,
  FileText,
  TrendingUp,
  Clock,
  Users,
} from 'lucide-react';

const RATING_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'ต้องปรับปรุง', color: 'text-rose-700 bg-rose-50 border-rose-200' },
  2: { label: 'พอใช้', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  3: { label: 'ตามมาตรฐาน (ดี)', color: 'text-blue-700 bg-blue-50 border-blue-200' },
  4: { label: 'ดีมาก', color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  5: { label: 'ดีเด่น (ยอดเยี่ยม)', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
};

export default function SupervisorEvaluationPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const evaluationId = resolvedParams.id;
  const router = useRouter();

  const [evaluation, setEvaluation] = useState<KpiEvaluation | null>(null);
  const [currentUserContext, setCurrentUserContext] = useState<{
    userId: string | null;
    personnelId: string | null;
    isAdmin: boolean;
  } | null>(null);
  const [activeEvaluatorId, setActiveEvaluatorId] = useState<string>('');

  const [scores, setScores] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [overallComment, setOverallComment] = useState('');
  const [strengths, setStrengths] = useState('');
  const [improvements, setImprovements] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const res = await getEvaluationDetail(evaluationId);
      if (res.success && res.data) {
        setEvaluation(res.data);
        setCurrentUserContext(res.currentUserContext || null);

        const assigned = res.data.assigned_evaluators || [];
        const myPId = res.currentUserContext?.personnelId;
        const defaultEvalId =
          assigned.find((a) => a.id === myPId)?.id ||
          assigned[0]?.id ||
          myPId ||
          '3da9e72c-e913-4606-9b33-46aa9427ff43';

        setActiveEvaluatorId(defaultEvalId);

        // Pre-fill from review if exists
        const initialReview =
          res.myReview ||
          (res.data.reviews || []).find((r) => r.evaluator_id === defaultEvalId);

        if (initialReview && Object.keys(initialReview.scores || {}).length > 0) {
          setScores(initialReview.scores || {});
          setFeedback(initialReview.feedback || {});
          setOverallComment(initialReview.overall_comment || '');
          setStrengths(initialReview.strengths || '');
          setImprovements(initialReview.improvements || '');
        } else if (res.data.status === 'completed' && res.data.supervisor_scores) {
          setScores(res.data.supervisor_scores);
          setFeedback(res.data.supervisor_feedback || {});
          setOverallComment(res.data.supervisor_overall_comment || '');
          setStrengths(res.data.supervisor_strengths || '');
          setImprovements(res.data.supervisor_improvements || '');
        }
      } else {
        toast.error('ไม่สามารถโหลดข้อมูลการประเมินได้', { description: res.error });
      }
      setIsLoading(false);
    }
    loadData();
  }, [evaluationId]);

  const handleSwitchEvaluator = (evalId: string) => {
    setActiveEvaluatorId(evalId);
    if (!evaluation) return;
    const review = (evaluation.reviews || []).find((r) => r.evaluator_id === evalId);
    if (review && Object.keys(review.scores || {}).length > 0) {
      setScores(review.scores || {});
      setFeedback(review.feedback || {});
      setOverallComment(review.overall_comment || '');
      setStrengths(review.strengths || '');
      setImprovements(review.improvements || '');
    } else {
      setScores({});
      setFeedback({});
      setOverallComment('');
      setStrengths('');
      setImprovements('');
    }
  };

  const handleScoreChange = (itemId: string, score: number) => {
    setScores((prev) => ({ ...prev, [itemId]: score }));
  };

  const handleFeedbackChange = (sectionId: string, text: string) => {
    setFeedback((prev) => ({ ...prev, [sectionId]: text }));
  };

  // Compute live score
  const liveSummary = evaluation
    ? calculateKpiScoreSummaries({
        ...evaluation,
        supervisor_scores: scores,
        supervisor_feedback: feedback,
      })
    : { supervisorTotal: 0, finalGrade: 'B', sections: [] };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evaluation || !evaluation.template) return;

    // Check completion of all items
    const allItems = evaluation.template.sections.flatMap((s) => s.items);
    const missing = allItems.filter((item) => !scores[item.id]);

    if (missing.length > 0) {
      toast.error(`กรุณาให้คะแนนประเมินให้ครบทุกข้อ (ยังขาดอีก ${missing.length} ตัวชี้วัด)`, {
        description: `เช่น ข้อ ${missing[0].code} ${missing[0].title}`,
      });
      const el = document.getElementById(`kpi-item-${missing[0].id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setIsSubmitting(true);
    const res = await submitSupervisorEvaluation(
      evaluationId,
      {
        supervisor_scores: scores,
        supervisor_feedback: feedback,
        supervisor_overall_comment: overallComment,
        supervisor_strengths: strengths,
        supervisor_improvements: improvements,
      },
      activeEvaluatorId
    );
    setIsSubmitting(false);

    if (res.success) {
      if (res.allCompleted) {
        toast.success('🎉 คณะกรรมการประเมินครบทุกคนแล้ว! ระบบได้คำนวณคะแนนถัวเฉลี่ยและส่งอีเมลแจ้งผลเรียบร้อยแล้ว ✉️');
        router.push(`/admin/kpi/${evaluationId}/analytics`);
      } else {
        toast.success(
          `บันทึกผลการประเมินเรียบร้อยแล้ว! (ประเมินแล้ว ${res.submittedCount}/${res.totalAssigned} ท่าน — รอคณะกรรมการที่เหลือเพื่อเฉลี่ยคะแนนและส่งอีเมลอัตโนมัติ)`
        );
        router.push('/admin/kpi');
      }
    } else {
      toast.error('บันทึกไม่สำเร็จ', { description: res.error });
    }
  };

  if (isLoading || !evaluation) {
    return (
      <div className="min-h-screen bg-[#F5F4F2] flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#1B3A6B]" />
          <p className="text-sm font-medium text-slate-500">กำลังเตรียมแบบประเมินโดยหัวหน้างาน...</p>
        </div>
      </div>
    );
  }

  const p = evaluation.personnel;
  const template = evaluation.template;

  return (
    <div className="min-h-screen bg-[#F5F4F2] pb-32 font-sans text-slate-800">
      {/* Sticky Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/kpi"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-[#1B3A6B]/10 text-[#1B3A6B]">
                  หัวหน้างานประเมิน (Supervisor Evaluation)
                </span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs text-slate-500">{evaluation.cycle?.title}</span>
              </div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                {p?.name_th || 'บุคลากร'} ({p?.position_th})
              </h1>
            </div>
          </div>

          {/* Live Score Display & Submit */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-[10px] uppercase font-bold text-slate-400">เกรดและคะแนนสรุป</div>
              <div className="text-base font-extrabold text-[#1B3A6B]">
                {liveSummary.supervisorTotal.toFixed(2)}% (เกรด {liveSummary.finalGrade})
              </div>
            </div>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1B3A6B] hover:bg-[#122748] text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังบันทึก...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>บันทึกผลการประเมิน</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personnel Details Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-2xs">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                {p?.image_url ? (
                  <img
                    src={p.image_url}
                    alt={p.name_th}
                    className="w-full h-full object-cover object-top"
                  />
                ) : (
                  <User className="w-8 h-8 text-slate-400 m-auto mt-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-[#1B3A6B] uppercase tracking-wider">
                  การประเมินโดยหัวหน้างาน / ผู้บริหาร
                </div>
                <h2 className="text-xl font-extrabold text-slate-900 mt-0.5">
                  {p?.name_th}
                </h2>
                <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-2">
                  <span>ตำแหน่ง: {p?.position_th}</span>
                  {evaluation.self_total_score !== null && (
                    <span className="text-amber-700 font-semibold">
                      • คะแนนประเมินตนเอง: {Number(evaluation.self_total_score).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Self Evaluation Summary Banner if available */}
            {evaluation.self_overall_comment && (
              <div className="mt-4 p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                <strong>ความเห็นสะท้อนคิดตนเองของบุคลากร:</strong>
                <p className="mt-1 text-amber-800 italic">"{evaluation.self_overall_comment}"</p>
              </div>
            )}
          </div>

          {/* Committee Review Progress Box */}
          {evaluation.assigned_evaluators && evaluation.assigned_evaluators.length > 0 && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      คณะกรรมการผู้มีสิทธิ์ประเมิน ({evaluation.reviews?.filter((r) => r.status === 'submitted').length || 0}/
                      {evaluation.assigned_evaluators.length} ท่านประเมินแล้ว)
                    </h3>
                    <p className="text-xs text-slate-500">
                      เมื่อกรรมการทุกท่านประเมินครบแล้ว ระบบจะคำนวณคะแนนถัวเฉลี่ยและส่งอีเมลแจ้งผลอัตโนมัติ ✉️
                    </p>
                  </div>
                </div>

                {/* Admin Evaluator Switcher */}
                {currentUserContext?.isAdmin && evaluation.assigned_evaluators.length > 1 && (
                  <div className="flex items-center gap-2 bg-purple-50/60 p-1.5 px-3 rounded-2xl border border-purple-200/80">
                    <span className="text-xs text-purple-900 font-bold shrink-0">กำลังบันทึกในนาม:</span>
                    <select
                      value={activeEvaluatorId}
                      onChange={(e) => handleSwitchEvaluator(e.target.value)}
                      className="text-xs font-semibold py-1 px-2.5 bg-white border border-purple-200 rounded-xl text-purple-950 focus:outline-none focus:ring-2 focus:ring-purple-400"
                    >
                      {evaluation.assigned_evaluators.map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          {ev.name_th} ({ev.position_th})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Evaluator Chips */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-4">
                {evaluation.assigned_evaluators.map((ev) => {
                  const review = (evaluation.reviews || []).find(
                    (r) => r.evaluator_id === ev.id && r.status === 'submitted'
                  );
                  const isDone = Boolean(review);
                  const isCurrentActive = ev.id === activeEvaluatorId;

                  return (
                    <div
                      key={ev.id}
                      className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                        isCurrentActive
                          ? 'border-purple-300 bg-purple-50/50 ring-2 ring-purple-200'
                          : 'border-slate-200/80 bg-slate-50/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-200 shrink-0">
                          {ev.image_url ? (
                            <img
                              src={ev.image_url}
                              alt={ev.name_th}
                              className="w-full h-full object-cover object-top"
                            />
                          ) : (
                            <User className="w-4 h-4 text-slate-400 m-auto mt-2" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-800 truncate">{ev.name_th}</div>
                          <div className="text-[11px] text-slate-400 truncate">{ev.position_th}</div>
                        </div>
                      </div>

                      <div className="shrink-0 ml-2">
                        {isDone ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            ประเมินแล้ว
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-500" />
                            รอประเมิน
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Render Sections */}
          {template?.sections.map((section, sIdx) => {
            const selfNote = evaluation.self_notes?.[section.id];

            return (
              <div
                key={section.id}
                className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-2xs space-y-6"
              >
                {/* Section Title */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
                  <div>
                    <span className="text-xs font-bold text-[#1B3A6B] uppercase tracking-wider">
                      ส่วนที่ {sIdx + 1}
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 mt-0.5">{section.title}</h3>
                  </div>
                  <div className="inline-flex items-center px-3 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold shrink-0">
                    น้ำหนัก {section.weight}%
                  </div>
                </div>

                {/* Evidence Note from Staff */}
                {selfNote && (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 leading-relaxed">
                    <span className="font-bold text-slate-900 block mb-1">
                      📁 ร่องรอยหลักฐานเชิงประจักษ์ที่บุคลากรระบุไว้:
                    </span>
                    <p className="whitespace-pre-wrap">{selfNote}</p>
                  </div>
                )}

                {/* Section Items */}
                <div className="space-y-6">
                  {section.items.map((item) => {
                    const currentRating = scores[item.id] || 0;
                    const selfRating = evaluation.self_scores?.[item.id] || 0;

                    return (
                      <div
                        key={item.id}
                        id={`kpi-item-${item.id}`}
                        className={`p-5 rounded-2xl border transition-all ${
                          currentRating > 0
                            ? 'border-slate-200 bg-white'
                            : 'border-slate-200/80 bg-slate-50/50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-lg bg-[#1B3A6B]/10 text-[#1B3A6B] text-xs font-bold">
                                {item.code}
                              </span>
                              <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                            </div>
                            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                              {item.description}
                            </p>
                          </div>

                          {/* Self Rating Reference Tag */}
                          {selfRating > 0 && (
                            <div className="shrink-0 px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold text-center" title="คะแนนที่ครูประเมินตนเอง">
                              ตนเอง: <strong>{selfRating} / 5</strong>
                            </div>
                          )}
                        </div>

                        {/* Supervisor Rating Selector (1 - 5) */}
                        <div className="pt-2">
                          <div className="text-[11px] font-bold text-slate-400 mb-2 uppercase tracking-wider">
                            คะแนนประเมินโดยหัวหน้างาน (1 - 5)
                          </div>
                          <div className="grid grid-cols-5 gap-2">
                            {[1, 2, 3, 4, 5].map((val) => {
                              const isSelected = currentRating === val;
                              return (
                                <button
                                  key={val}
                                  type="button"
                                  onClick={() => handleScoreChange(item.id, val)}
                                  className={`py-3 px-2 rounded-xl text-center border text-xs transition-all flex flex-col items-center justify-center gap-1 ${
                                    isSelected
                                      ? 'border-[#1B3A6B] bg-[#1B3A6B] text-white font-bold shadow-xs scale-[1.02]'
                                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                                  }`}
                                >
                                  <span className="text-sm sm:text-base font-extrabold">{val}</span>
                                  <span className="text-[10px] hidden sm:block truncate w-full text-center">
                                    {RATING_LABELS[val].label}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Section Constructive Feedback */}
                <div className="pt-3 border-t border-slate-100">
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    💬 ข้อเสนอแนะเชิงพัฒนาสำหรับหมวดนี้ (Section Feedback):
                  </label>
                  <textarea
                    rows={2}
                    placeholder="ระบุข้อชื่นชมหรือจุดที่แนะนำให้ต่อยอดในหมวดนี้..."
                    value={feedback[section.id] || ''}
                    onChange={(e) => handleFeedbackChange(section.id, e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A6B] focus:bg-white transition-all resize-y"
                  />
                </div>
              </div>
            );
          })}

          {/* Supervisor Feedback Cards */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-2xs space-y-5">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>สรุปผลการประเมินและการสะท้อนคิด (Constructive Evaluation)</span>
            </h3>

            {/* Strengths */}
            <div>
              <label className="block text-xs font-bold text-emerald-700 mb-2">
                🌟 จุดเด่นและข้อชื่นชม (Key Strengths & Commendations):
              </label>
              <textarea
                rows={3}
                placeholder="ระบุความสามารถที่โดดเด่น ผลงานที่เป็นแบบอย่างที่ดี หรือความทุ่มเทที่น่าประทับใจ..."
                value={strengths}
                onChange={(e) => setStrengths(e.target.value)}
                className="w-full px-4 py-3 bg-emerald-50/40 border border-emerald-200 rounded-2xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all resize-y"
              />
            </div>

            {/* Improvements */}
            <div>
              <label className="block text-xs font-bold text-blue-700 mb-2">
                💡 ข้อเสนอแนะเพื่อการพัฒนาและต่อยอด (Growth & Improvements):
              </label>
              <textarea
                rows={3}
                placeholder="ระบุประเด็นหรือทักษะที่ควรพัฒนาต่อยอด เช่น การทำวิจัยในชั้นเรียน หรือการจัดการเรียนรู้..."
                value={improvements}
                onChange={(e) => setImprovements(e.target.value)}
                className="w-full px-4 py-3 bg-blue-50/40 border border-blue-200 rounded-2xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all resize-y"
              />
            </div>

            {/* Overall Comment */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                📝 ความเห็นภาพรวมจากหัวหน้างาน:
              </label>
              <textarea
                rows={3}
                placeholder="สรุปความเห็นภาพรวมของรอบการประเมินนี้..."
                value={overallComment}
                onChange={(e) => setOverallComment(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A6B] focus:bg-white transition-all resize-y"
              />
            </div>
          </div>

          {/* Submit Action Bar */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 px-6 bg-[#1B3A6B] hover:bg-[#122748] active:scale-[0.99] text-white rounded-2xl font-bold text-base shadow-md hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>กำลังบันทึกผลการประเมิน...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>ยืนยันบันทึกผลการประเมิน (เสร็จสิ้น)</span>
                </>
              )}
            </button>
            <p className="text-center text-xs text-slate-400 mt-3">
              เมื่อบันทึกเสร็จสิ้น ระบบจะคำนวณเกรด ตัดยอดคะแนน และเปิดให้เข้าดูเรดาร์ชาร์ตวิเคราะห์ผลรายบุคคล
            </p>
          </div>
        </form>
      </main>
    </div>
  );
}
