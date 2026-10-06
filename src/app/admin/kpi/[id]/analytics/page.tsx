'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { KpiEvaluation, SectionScoreSummary } from '@/types/kpi';
import { getEvaluationDetail, dispatchEvaluationEmail } from '../../actions';
import { calculateKpiScoreSummaries, generateAnonymousKpiEmailHtml } from '@/lib/kpi/scoring';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Mail,
  Printer,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  User,
  X,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

export default function IndividualKpiAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const evaluationId = resolvedParams.id;

  const [evaluation, setEvaluation] = useState<KpiEvaluation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [showEmailPreviewModal, setShowEmailPreviewModal] = useState(false);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const res = await getEvaluationDetail(evaluationId);
      if (res.success && res.data) {
        setEvaluation(res.data);
      } else {
        toast.error('ไม่สามารถโหลดข้อมูลการประเมินได้', { description: res.error });
      }
      setIsLoading(false);
    }
    loadData();
  }, [evaluationId]);

  if (isLoading || !evaluation) {
    return (
      <div className="min-h-screen bg-[#F5F4F2] flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#7B1C3E]" />
          <p className="text-sm font-medium text-slate-500">กำลังประมวลผลการวิเคราะห์ KPI...</p>
        </div>
      </div>
    );
  }

  const p = evaluation.personnel;
  const cycle = evaluation.cycle;
  const template = evaluation.template;
  const { sections, selfTotal, supervisorTotal, finalGrade } = calculateKpiScoreSummaries(evaluation);

  // Prepare Radar Chart Data
  const radarData = sections.map((s) => ({
    dimension: s.sectionTitle.split(':')[1]?.trim() || s.sectionTitle,
    ตนเอง: s.selfAvg,
    หัวหน้างาน: s.supervisorAvg,
    fullMark: 5,
  }));

  // Prepare Gap Analysis Bar Data
  const gapData = sections.map((s) => ({
    name: s.sectionTitle.split(':')[1]?.trim() || s.sectionTitle,
    ตนเอง: s.selfScoreWeighted,
    หัวหน้างาน: s.supervisorScoreWeighted,
    น้ำหนักเต็ม: s.weight,
    gap: s.gap,
  }));

  // Send anonymous email
  const handleSendEmail = async () => {
    if (!p?.email) {
      toast.error('บุคลากรท่านนี้ยังไม่มีที่อยู่อีเมลในระบบ');
      return;
    }

    setIsSendingEmail(true);
    const res = await dispatchEvaluationEmail(evaluationId);
    setIsSendingEmail(false);

    if (res.success) {
      toast.success(`ส่งผลการประเมินไปยัง ${res.recipientEmail} เรียบร้อยแล้ว (ไม่เปิดเผยตัวตนผู้ประเมิน)`);
      setShowEmailModal(false);
      setEvaluation((prev) =>
        prev
          ? {
              ...prev,
              email_notified_at: new Date().toISOString(),
              email_notified_status: 'sent',
            }
          : null
      );

      if (res.mode === 'simulated' && res.gmailComposeUrl) {
        window.open(res.gmailComposeUrl, '_blank');
      }
    } else {
      toast.error('ส่งอีเมลไม่สำเร็จ', { description: res.error });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const emailHtml = generateAnonymousKpiEmailHtml(evaluation);

  return (
    <div className="min-h-screen bg-[#F5F4F2] pb-24 font-sans text-slate-800 print:bg-white print:p-0">
      {/* Top Header Bar (Hidden in Print) */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs print:hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/kpi"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-800">
                  หน้าวิเคราะห์ผลประเมินรายบุคคล (KPI Analytics)
                </span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs text-slate-500">{cycle?.title}</span>
              </div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                {p?.name_th} ({p?.position_th})
              </h1>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์รายงาน</span>
            </button>

            <button
              onClick={() => setShowEmailPreviewModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
            >
              <FileText className="w-4 h-4" />
              <span>ดูพรีวิวอีเมล</span>
            </button>

            <button
              onClick={() => setShowEmailModal(true)}
              disabled={!p?.email}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#7B1C3E] hover:bg-[#631430] text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50"
            >
              <Mail className="w-4 h-4" />
              <span>{evaluation.email_notified_status === 'sent' ? 'ส่งผลเข้า Gmail อีกครั้ง' : 'ส่งผลเข้า Gmail (ไม่ระบุผู้ประเมิน)'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Analytics Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Printable Official School Header (Only visible when printing) */}
        <div className="hidden print:block text-center border-b-2 border-slate-900 pb-4 mb-6">
          <Image
            src="/logo2.png"
            alt="School Logo"
            width={120}
            height={60}
            className="h-14 w-auto mx-auto object-contain mb-2"
          />
          <h2 className="text-xl font-bold text-slate-900">โรงเรียนสมคิดวิทยา อ.เมือง จ.ระยอง</h2>
          <p className="text-sm font-semibold text-slate-700">
            แบบรายงานผลการประเมินการปฏิบัติงานและสมรรถนะบุคลากร (KPI Report)
          </p>
          <p className="text-xs text-slate-500 mt-1">
            รอบการประเมิน: {cycle?.title} (ปีการศึกษา {cycle?.academic_year} ภาคเรียนที่ {cycle?.semester})
          </p>
        </div>

        {/* Personnel Profile & Grand Score Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-2xs print:shadow-none print:border-none">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Personnel Info */}
            <div className="flex items-center gap-4 text-center sm:text-left">
              <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200 shadow-xs">
                {p?.image_url ? (
                  <img
                    src={p.image_url}
                    alt={p.name_th}
                    className="w-full h-full object-cover object-top"
                  />
                ) : (
                  <User className="w-10 h-10 text-slate-400 m-auto mt-5" />
                )}
              </div>
              <div>
                <div className="text-xs font-bold text-[#7B1C3E] uppercase tracking-wider">
                  รายงานผลการประเมินรายบุคคล
                </div>
                <h2 className="text-2xl font-extrabold text-slate-900 mt-0.5">
                  {p?.name_th}
                </h2>
                <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-2 items-center">
                  <span>ตำแหน่ง: <strong>{p?.position_th}</strong></span>
                  {p?.email && (
                    <span className="text-indigo-600 font-mono">• {p.email}</span>
                  )}
                  {evaluation.assigned_evaluators && evaluation.assigned_evaluators.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200 text-[11px] font-semibold">
                      👥 คณะกรรมการ {evaluation.assigned_evaluators.length} ท่าน (ถัวเฉลี่ยคะแนนร่วมกัน)
                    </span>
                  )}
                </div>
                {evaluation.email_notified_status === 'sent' && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>แจ้งผลผ่าน Gmail เรียบร้อยแล้ว ({new Date(evaluation.email_notified_at || '').toLocaleDateString('th-TH')})</span>
                  </div>
                )}
              </div>
            </div>

            {/* Score Badges */}
            <div className="flex items-center gap-4">
              <div className="text-center p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 min-w-[120px]">
                <div className="text-[11px] font-bold text-amber-700 uppercase">ประเมินตนเอง</div>
                <div className="text-2xl font-extrabold text-amber-900 mt-1">
                  {selfTotal.toFixed(1)}%
                </div>
                <div className="text-[10px] text-amber-600 mt-0.5">Self Score</div>
              </div>

              <div className="text-center p-4 rounded-2xl bg-gradient-to-br from-[#7B1C3E] to-[#631430] text-white shadow-md min-w-[150px]">
                <div className="text-[11px] font-bold text-white/80 uppercase">คะแนนสรุปจากกรรมการ</div>
                <div className="text-3xl font-black mt-1">
                  {supervisorTotal.toFixed(1)}%
                </div>
                <div className="mt-1">
                  <span className="inline-block px-2.5 py-0.5 bg-white text-[#7B1C3E] text-xs font-black rounded-md shadow-2xs">
                    เกรด {finalGrade}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Grid: Radar Chart & Gap Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-1">
          {/* 1. Radar Chart (สมรรถนะเปรียบเทียบ 2 มิติ) */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-[#7B1C3E]" />
                  <span>เรดาร์ชาร์ตเปรียบเทียบสมรรถนะ (Competency Radar)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  เปรียบเทียบคะแนนเฉลี่ย (1 - 5) ระหว่างการประเมินตนเอง และกรรมการ
                </p>
              </div>
            </div>

            <div className="h-72 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius={90}>
                  <PolarGrid stroke="#E2E8F0" />
                  <PolarAngleAxis
                    dataKey="dimension"
                    tick={{ fill: '#334155', fontSize: 11, fontWeight: 600 }}
                  />
                  <PolarRadiusAxis angle={30} domain={[0, 5]} stroke="#CBD5E1" />
                  <Radar
                    name="คะแนนตนเอง (Self)"
                    dataKey="ตนเอง"
                    stroke="#D97706"
                    fill="#D97706"
                    fillOpacity={0.25}
                  />
                  <Radar
                    name="คะแนนเฉลี่ยกรรมการ (Committee Avg)"
                    dataKey="หัวหน้างาน"
                    stroke="#7B1C3E"
                    fill="#7B1C3E"
                    fillOpacity={0.4}
                  />
                  <Legend
                    wrapperStyle={{ paddingTop: 10, fontSize: 12, fontWeight: 600 }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 2. Gap Analysis Bar Chart */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-600" />
                  <span>การวิเคราะห์ช่องว่างคะแนน (Gap Analysis)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  เปรียบเทียบคะแนนตามสัดส่วนน้ำหนัก (%) ในแต่ละหมวด
                </p>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gapData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#475569', fontSize: 10, fontWeight: 500 }}
                    interval={0}
                    angle={-10}
                    textAnchor="end"
                  />
                  <YAxis tick={{ fill: '#64748B', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 12,
                      border: '1px solid #E2E8F0',
                      fontSize: 12,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: 10, fontSize: 12, fontWeight: 600 }} />
                  <Bar dataKey="ตนเอง" fill="#F59E0B" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="หัวหน้างาน" fill="#7B1C3E" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Competency Breakdown Table */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">
              รายละเอียดผลคะแนนตามหมวดสมรรถนะ
            </h3>
            <span className="text-xs text-slate-400">มาตรวัดมาตรฐาน 1 - 5</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px] font-bold">
                  <th className="py-3.5 px-6">หมวดสมรรถนะ</th>
                  <th className="py-3.5 px-4 text-center">น้ำหนัก</th>
                  <th className="py-3.5 px-4 text-center">คะแนนตนเอง (เฉลี่ย)</th>
                  <th className="py-3.5 px-4 text-center">คะแนนกรรมการ (เฉลี่ย)</th>
                  <th className="py-3.5 px-4 text-center">ผลต่าง (Gap)</th>
                  <th className="py-3.5 px-6 text-right">คะแนนสุทธิ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sections.map((s) => {
                  const isPositive = s.gap > 0;
                  const isNegative = s.gap < 0;

                  return (
                    <tr key={s.sectionId} className="hover:bg-slate-50/50">
                      <td className="py-4 px-6 font-semibold text-slate-900">
                        {s.sectionTitle}
                      </td>
                      <td className="py-4 px-4 text-center text-slate-600 font-medium">
                        {s.weight}%
                      </td>
                      <td className="py-4 px-4 text-center font-bold text-amber-700">
                        {s.selfAvg.toFixed(2)} / 5.0
                      </td>
                      <td className="py-4 px-4 text-center font-bold text-[#7B1C3E]">
                        {s.supervisorAvg.toFixed(2)} / 5.0
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-md ${
                            isPositive
                              ? 'bg-emerald-50 text-emerald-700'
                              : isNegative
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {isPositive && '+'}
                          {s.gap.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right font-extrabold text-slate-900 text-sm">
                        {s.supervisorScoreWeighted.toFixed(2)} / {s.weight}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
                  <td className="py-4 px-6 text-slate-900 text-sm">รวมคะแนนทั้งหมด</td>
                  <td className="py-4 px-4 text-center text-slate-700">100%</td>
                  <td className="py-4 px-4 text-center text-amber-800 text-sm">
                    {selfTotal.toFixed(2)}%
                  </td>
                  <td className="py-4 px-4 text-center text-[#7B1C3E] text-base font-extrabold">
                    {supervisorTotal.toFixed(2)}%
                  </td>
                  <td className="py-4 px-4 text-center text-slate-500">-</td>
                  <td className="py-4 px-6 text-right text-base text-[#7B1C3E] font-black">
                    {supervisorTotal.toFixed(2)}% (เกรด {finalGrade})
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Constructive Feedback Grid (Strictly Anonymous) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Strengths */}
          <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-3xl p-6 shadow-2xs">
            <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm mb-3">
              <Sparkles className="w-5 h-5 text-emerald-600" />
              <span>จุดเด่นและข้อชื่นชมจากคณะกรรมการ (Key Strengths)</span>
            </div>
            {evaluation.supervisor_strengths ? (
              <p className="text-xs sm:text-sm text-emerald-950 whitespace-pre-wrap leading-relaxed">
                {evaluation.supervisor_strengths}
              </p>
            ) : (
              <p className="text-xs text-emerald-600/70 italic">ยังไม่มีการบันทึกข้อชื่นชม</p>
            )}
          </div>

          {/* Improvements */}
          <div className="bg-blue-50/70 border border-blue-200/90 rounded-3xl p-6 shadow-2xs">
            <div className="flex items-center gap-2 text-blue-800 font-bold text-sm mb-3">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <span>ข้อเสนอแนะเพื่อการพัฒนา (Areas for Continuous Growth)</span>
            </div>
            {evaluation.supervisor_improvements ? (
              <p className="text-xs sm:text-sm text-blue-950 whitespace-pre-wrap leading-relaxed">
                {evaluation.supervisor_improvements}
              </p>
            ) : (
              <p className="text-xs text-blue-600/70 italic">ยังไม่มีการระบุข้อเสนอแนะ</p>
            )}
          </div>
        </div>

        {/* Overall Comment */}
        {evaluation.supervisor_overall_comment && (
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-2xs">
            <h4 className="text-sm font-bold text-slate-900 mb-2">
              📝 ความเห็นสะท้อนคิดภาพรวมจากคณะกรรมการ:
            </h4>
            <p className="text-xs sm:text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
              {evaluation.supervisor_overall_comment}
            </p>
          </div>
        )}

        {/* Printable Signature Block (Print-only) */}
        <div className="hidden print:grid grid-cols-2 gap-12 pt-12 mt-12 border-t border-slate-200 text-center text-xs">
          <div>
            <div className="h-16" />
            <div className="border-t border-slate-400 w-48 mx-auto pt-2">
              ลงชื่อ......................................................
            </div>
            <div className="font-bold text-slate-800 mt-1">({p?.name_th})</div>
            <div className="text-slate-500">ผู้รับการประเมิน</div>
          </div>
          <div>
            <div className="h-16" />
            <div className="border-t border-slate-400 w-48 mx-auto pt-2">
              ลงชื่อ......................................................
            </div>
            <div className="font-bold text-slate-800 mt-1">คณะกรรมการประเมินผลการปฏิบัติงาน</div>
            <div className="text-slate-500">โรงเรียนสมคิดวิทยา</div>
          </div>
        </div>
      </main>

      {/* 1. Anonymous Email Confirmation Modal */}
      <AnimatePresence>
        {showEmailModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 text-slate-800 relative"
            >
              <button
                onClick={() => setShowEmailModal(false)}
                className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center">
                  <Mail className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    แจ้งผลการประเมินผ่าน Gmail
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold mt-0.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>ระบบไม่เปิดเผยตัวตนผู้ประเมิน (Anonymous Notification)</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 mb-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">ผู้รับ:</span>
                  <strong className="text-slate-800">{p?.name_th}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">อีเมลปลายทาง:</span>
                  <span className="font-mono text-indigo-700 font-semibold">{p?.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">รอบการประเมิน:</span>
                  <span className="text-slate-700">{cycle?.title}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200/60 pt-2">
                  <span className="text-slate-500">คะแนนสรุป / เกรด:</span>
                  <strong className="text-[#7B1C3E] text-sm">
                    {supervisorTotal.toFixed(2)}% (เกรด {finalGrade})
                  </strong>
                </div>
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-[11px] text-emerald-800 leading-relaxed mb-6">
                อีเมลจะส่งตรงถึงกล่องจดหมายของบุคลากร พร้อมตารางผลคะแนนแต่ละหมวด และข้อเสนอแนะเชิงพัฒนา โดย<strong>ไม่ระบุชื่อ นามสกุล หรือบทบาทของผู้ประเมิน</strong>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowEmailModal(false)}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={isSendingEmail}
                  onClick={handleSendEmail}
                  className="flex-1 py-2.5 px-4 bg-[#7B1C3E] hover:bg-[#631430] text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSendingEmail ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>กำลังส่ง...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>ยืนยันส่งอีเมล</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. HTML Email Preview Modal */}
      <AnimatePresence>
        {showEmailPreviewModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-3xl w-full h-[85vh] p-6 shadow-2xl border border-slate-200 flex flex-col relative"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-[#7B1C3E]" />
                  <h3 className="text-base font-bold text-slate-900">
                    ตัวอย่างอีเมลแจ้งผลการประเมิน (Email Preview)
                  </h3>
                </div>
                <button
                  onClick={() => setShowEmailPreviewModal(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Iframe Preview */}
              <div className="flex-1 mt-4 rounded-2xl overflow-hidden border border-slate-200 bg-slate-50">
                <iframe
                  title="Email Preview"
                  srcDoc={emailHtml}
                  className="w-full h-full border-0"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowEmailPreviewModal(false)}
                  className="py-2 px-4 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  ปิดหน้าต่าง
                </button>
                <button
                  onClick={() => {
                    setShowEmailPreviewModal(false);
                    setShowEmailModal(true);
                  }}
                  className="py-2 px-5 bg-[#7B1C3E] text-white rounded-xl text-xs font-bold shadow-sm"
                >
                  ดำเนินการส่งอีเมล &rarr;
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
