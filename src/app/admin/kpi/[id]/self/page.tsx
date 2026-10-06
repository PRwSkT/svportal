'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { KpiEvaluation, KpiTemplate } from '@/types/kpi';
import { getEvaluationDetail, submitSelfEvaluation } from '../../actions';
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
  AlertCircle,
  FileText,
} from 'lucide-react';

const RATING_LABELS: Record<number, { label: string; desc: string; color: string }> = {
  1: { label: 'ต้องปรับปรุง', desc: 'ยังไม่บรรลุเกณฑ์มาตรฐาน จำเป็นต้องได้รับการพัฒนาอย่างเร่งด่วน', color: 'border-rose-300 text-rose-700 bg-rose-50' },
  2: { label: 'พอใช้', desc: 'บรรลุเกณฑ์บางส่วน ต้องการคำแนะนำเพื่อพัฒนาให้ได้ตามเกณฑ์', color: 'border-amber-300 text-amber-700 bg-amber-50' },
  3: { label: 'ตามมาตรฐาน (ดี)', desc: 'ปฏิบัติงานได้ตามเกณฑ์มาตรฐานของโรงเรียนอย่างครบถ้วน', color: 'border-blue-300 text-blue-700 bg-blue-50' },
  4: { label: 'ดีมาก', desc: 'ปฏิบัติงานได้สูงกว่ามาตรฐาน มีความคิดริเริ่มและประสิทธิผลสูง', color: 'border-indigo-300 text-indigo-700 bg-indigo-50' },
  5: { label: 'ดีเด่น (ยอดเยี่ยม)', desc: 'เป็นแบบอย่างที่ดีเยี่ยม สร้างผลงานเชิงประจักษ์โดดเด่น', color: 'border-emerald-300 text-emerald-700 bg-emerald-50' },
};

export default function SelfEvaluationPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const evaluationId = resolvedParams.id;
  const router = useRouter();

  const [evaluation, setEvaluation] = useState<KpiEvaluation | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [overallComment, setOverallComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const res = await getEvaluationDetail(evaluationId);
      if (res.success && res.data) {
        setEvaluation(res.data);
        setScores(res.data.self_scores || {});
        setNotes(res.data.self_notes || {});
        setOverallComment(res.data.self_overall_comment || '');
      } else {
        toast.error('ไม่สามารถโหลดข้อมูลการประเมินได้', { description: res.error });
      }
      setIsLoading(false);
    }
    loadData();
  }, [evaluationId]);

  const handleScoreChange = (itemId: string, score: number) => {
    setScores((prev) => ({ ...prev, [itemId]: score }));
  };

  const handleNoteChange = (sectionId: string, text: string) => {
    setNotes((prev) => ({ ...prev, [sectionId]: text }));
  };

  // Compute live score
  const liveSummary = evaluation
    ? calculateKpiScoreSummaries({
        ...evaluation,
        self_scores: scores,
        self_notes: notes,
      })
    : { selfTotal: 0, sections: [] };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evaluation || !evaluation.template) return;

    // Check completion of all items
    const allItems = evaluation.template.sections.flatMap((s) => s.items);
    const missing = allItems.filter((item) => !scores[item.id]);

    if (missing.length > 0) {
      toast.error(`กรุณาประเมินให้ครบทุกข้อ (ยังขาดอีก ${missing.length} ตัวชี้วัด)`, {
        description: `เช่น ข้อ ${missing[0].code} ${missing[0].title}`,
      });
      const el = document.getElementById(`kpi-item-${missing[0].id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setIsSubmitting(true);
    const res = await submitSelfEvaluation(evaluationId, {
      self_scores: scores,
      self_notes: notes,
      self_overall_comment: overallComment,
    });
    setIsSubmitting(false);

    if (res.success) {
      toast.success('บันทึกการประเมินตนเองเรียบร้อยแล้ว!');
      router.push('/admin/kpi');
    } else {
      toast.error('บันทึกไม่สำเร็จ', { description: res.error });
    }
  };

  if (isLoading || !evaluation) {
    return (
      <div className="min-h-screen bg-[#F5F4F2] flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#7B1C3E]" />
          <p className="text-sm font-medium text-slate-500">กำลังเตรียมแบบประเมินตนเอง...</p>
        </div>
      </div>
    );
  }

  const p = evaluation.personnel;
  const template = evaluation.template;

  return (
    <div className="min-h-screen bg-[#F5F4F2] pb-32 font-sans text-slate-800">
      {/* Sticky Header Bar */}
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
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                  การประเมินตนเอง (Self Evaluation)
                </span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs text-slate-500">{evaluation.cycle?.title}</span>
              </div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                {p?.name_th || 'บุคลากร'} ({p?.position_th})
              </h1>
            </div>
          </div>

          {/* Live Score Display */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-[10px] uppercase font-bold text-slate-400">คะแนนประเมินตนเอง</div>
              <div className="text-base font-extrabold text-[#7B1C3E]">
                {liveSummary.selfTotal.toFixed(2)}%
              </div>
            </div>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#7B1C3E] hover:bg-[#631430] text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังบันทึก...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>ส่งผลประเมินตนเอง</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personnel & Instruction Card */}
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
                <div className="text-xs font-bold text-[#7B1C3E] uppercase tracking-wider">
                  แบบประเมินตนเองประจำรอบ
                </div>
                <h2 className="text-xl font-extrabold text-slate-900 mt-0.5">
                  {p?.name_th}
                </h2>
                <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-2">
                  <span>ตำแหน่ง: {p?.position_th}</span>
                  {p?.email && <span className="text-indigo-600 font-mono">• {p.email}</span>}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl">
              <strong>คำชี้แจง:</strong> ให้คุณครูประเมินตนเองตามสภาพจริงในแต่ละตัวชี้วัด (ระดับ 1 - 5) พร้อมทั้งระบุร่องรอยหลักฐานเชิงประจักษ์ หรือผลงานที่เป็นรูปธรรมในแต่ละหมวด เพื่อให้หัวหน้างานใช้ประกอบการพิจารณาประเมินต่อไป
            </div>
          </div>

          {/* Render Sections */}
          {template?.sections.map((section, sIdx) => {
            return (
              <div
                key={section.id}
                className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-2xs space-y-6"
              >
                {/* Section Title */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
                  <div>
                    <span className="text-xs font-bold text-[#7B1C3E] uppercase tracking-wider">
                      ส่วนที่ {sIdx + 1}
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 mt-0.5">{section.title}</h3>
                  </div>
                  <div className="inline-flex items-center px-3 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold shrink-0">
                    น้ำหนัก {section.weight}%
                  </div>
                </div>

                {/* Section Items */}
                <div className="space-y-6">
                  {section.items.map((item) => {
                    const currentRating = scores[item.id] || 0;

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
                              <span className="px-2 py-0.5 rounded-lg bg-[#7B1C3E]/10 text-[#7B1C3E] text-xs font-bold">
                                {item.code}
                              </span>
                              <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                            </div>
                            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                              {item.description}
                            </p>
                          </div>
                        </div>

                        {/* 1-5 Rating Selector */}
                        <div className="pt-2">
                          <div className="text-[11px] font-bold text-slate-400 mb-2 uppercase tracking-wider">
                            เลือกระดับการประเมินตนเอง (1 - 5)
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
                                      ? 'border-[#7B1C3E] bg-[#7B1C3E] text-white font-bold shadow-xs scale-[1.02]'
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

                {/* Section Evidence / Notes */}
                <div className="pt-3 border-t border-slate-100">
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    📁 ร่องรอยหลักฐานเชิงประจักษ์ / ผลงานในหมวดนี้ (Evidence & Reflection)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="ระบุกิจกรรม ลิงก์เอกสาร โครงการ หรือผลงานที่สะท้อนถึงการปฏิบัติงานในหมวดนี้..."
                    value={notes[section.id] || ''}
                    onChange={(e) => handleNoteChange(section.id, e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#7B1C3E] focus:bg-white transition-all resize-y"
                  />
                </div>
              </div>
            );
          })}

          {/* Overall Reflection Comment Card */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-2xs">
            <h3 className="text-base font-bold text-slate-900 mb-2">
              💭 ความเห็นภาพรวมและเป้าหมายการพัฒนาตนเอง
            </h3>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              ระบุความรู้สึกต่อการทำงานในภาคเรียนนี้ อุปสรรคที่พบ และเป้าหมายที่ต้องการพัฒนาในระยะต่อไป
            </p>
            <textarea
              rows={4}
              placeholder="บันทึกความเห็นสะท้อนคิดภาพรวม..."
              value={overallComment}
              onChange={(e) => setOverallComment(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#7B1C3E] focus:bg-white transition-all resize-y"
            />
          </div>

          {/* Submit Action Bar */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 px-6 bg-[#7B1C3E] hover:bg-[#631430] active:scale-[0.99] text-white rounded-2xl font-bold text-base shadow-md hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>กำลังส่งผลประเมิน...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>ยืนยันส่งการประเมินตนเอง</span>
                </>
              )}
            </button>
            <p className="text-center text-xs text-slate-400 mt-3">
              เมื่อส่งผลแล้ว ระบบจะอัปเดตสถานะเป็น "รอหัวหน้างานประเมิน"
            </p>
          </div>
        </form>
      </main>
    </div>
  );
}
