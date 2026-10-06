'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  KpiCycle,
  KpiEvaluation,
  KpiStatus,
  KpiGrade,
} from '@/types/kpi';
import {
  getKpiCycles,
  getKpiEvaluations,
  dispatchEvaluationEmail,
  syncPersonnelForCycle,
} from './actions';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Award,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck2,
  Filter,
  GraduationCap,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  User,
  UserCheck,
  Users,
  X,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
} from 'lucide-react';

export default function KpiDashboardPage() {
  const [cycles, setCycles] = useState<KpiCycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [evaluations, setEvaluations] = useState<KpiEvaluation[]>([]);
  const [stats, setStats] = useState<{
    total: number;
    pendingSelf: number;
    pendingSupervisor: number;
    completed: number;
    avgScore: number;
  }>({
    total: 0,
    pendingSelf: 0,
    pendingSupervisor: 0,
    completed: 0,
    avgScore: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | KpiStatus>('all');
  const [isSyncing, setIsSyncing] = useState(false);

  // Email Notification Modal State
  const [emailModalEval, setEmailModalEval] = useState<KpiEvaluation | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // 1. Initial Load of Cycles
  const loadCycles = async () => {
    setIsLoading(true);
    const res = await getKpiCycles();
    if (res.success && res.data && res.data.length > 0) {
      setCycles(res.data);
      const active = res.data.find((c) => c.status === 'active') || res.data[0];
      setSelectedCycleId(active.id);
      await loadEvaluations(active.id);
    } else {
      toast.error('ไม่พบรอบการประเมิน');
    }
    setIsLoading(false);
  };

  // 2. Load Evaluations for selected cycle
  const loadEvaluations = async (cycleId: string) => {
    setIsLoading(true);
    const res = await getKpiEvaluations(cycleId);
    if (res.success && res.data) {
      setEvaluations(res.data);
      if (res.stats) setStats(res.stats);
    } else {
      toast.error('ไม่สามารถโหลดข้อมูลการประเมินได้', { description: res.error });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadCycles();
  }, []);

  const handleCycleChange = async (cycleId: string) => {
    setSelectedCycleId(cycleId);
    await loadEvaluations(cycleId);
  };

  // Sync active personnel
  const handleSyncPersonnel = async () => {
    if (!selectedCycleId) return;
    setIsSyncing(true);
    const res = await syncPersonnelForCycle(selectedCycleId);
    setIsSyncing(false);

    if (res.success) {
      toast.success(
        res.insertedCount > 0
          ? `เพิ่มบุคลากรใหม่ ${res.insertedCount} ท่านเข้าสู่รอบประเมินเรียบร้อย`
          : 'ข้อมูลบุคลากรในรอบประเมินนี้เป็นปัจจุบันแล้ว'
      );
      loadEvaluations(selectedCycleId);
    } else {
      toast.error('การซิงค์ล้มเหลว', { description: res.error });
    }
  };

  // Send anonymous email
  const handleSendEmail = async (evaluation: KpiEvaluation) => {
    if (!evaluation.personnel?.email) {
      toast.error('บุคลากรท่านนี้ไม่มีที่อยู่อีเมลในระบบ');
      return;
    }
    setIsSendingEmail(true);
    const res = await dispatchEvaluationEmail(evaluation.id);
    setIsSendingEmail(false);

    if (res.success) {
      toast.success(`ส่งผลประเมินไปยัง ${res.recipientEmail} เรียบร้อยแล้ว (ไม่เปิดเผยตัวตนผู้ประเมิน)`);
      setEmailModalEval(null);
      loadEvaluations(selectedCycleId);

      if (res.mode === 'simulated' && res.gmailComposeUrl) {
        window.open(res.gmailComposeUrl, '_blank');
      }
    } else {
      toast.error('ไม่สามารถส่งอีเมลได้', { description: res.error });
    }
  };

  // Filtered List
  const filteredList = evaluations.filter((e) => {
    const p = e.personnel;
    const matchSearch =
      !searchQuery ||
      p?.name_th?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p?.name_en?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p?.position_th?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p?.email?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchStatus = statusFilter === 'all' || e.status === statusFilter;

    return matchSearch && matchStatus;
  });

  const selectedCycle = cycles.find((c) => c.id === selectedCycleId);

  return (
    <div className="min-h-screen bg-[#F5F4F2] pb-24 font-sans text-slate-800">
      {/* Top Banner / Breadcrumb */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#7B1C3E] text-white flex items-center justify-center shadow-md">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  ระบบประเมินผลการปฏิบัติงานบุคลากร (KPI)
                </h1>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Somkidvittaya Official
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                การประเมินตนเอง (Self) • หัวหน้างานประเมิน (Supervisor) • วิเคราะห์ผล & แจ้งผลอัตโนมัติ
              </p>
            </div>
          </div>

          {/* Cycle Switcher & Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
              <Calendar className="w-4 h-4 text-slate-500 ml-2" />
              <select
                value={selectedCycleId}
                onChange={(e) => handleCycleChange(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 py-1.5 px-2.5 focus:outline-none cursor-pointer"
              >
                {cycles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} ({c.academic_year}/{c.semester})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleSyncPersonnel}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50"
              title="ตรวจสอบและซิงค์รายชื่อบุคลากรที่ยังไม่มีในรอบนี้"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#7B1C3E]' : ''}`} />
              <span>ซิงค์บุคลากร</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* KPI Process Information Banner */}
        <div className="bg-gradient-to-r from-[#7B1C3E] via-[#631430] to-[#1B3A6B] rounded-3xl p-6 sm:p-7 text-white shadow-lg relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-white/5 rounded-full blur-2xl pointer-events-none" />
          <div className="max-w-3xl relative z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-white text-xs font-semibold mb-3 backdrop-blur-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>ขั้นตอนมาตรฐานการประเมิน 3 มิติ</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold leading-snug">
              การประเมินผลการปฏิบัติงานครูและบุคลากร โรงเรียนสมคิดวิทยา
            </h2>
            <p className="text-xs sm:text-sm text-white/80 mt-2 leading-relaxed">
              1. <strong>บุคลากรประเมินตนเอง</strong> พร้อมระบุร่องรอยหลักฐานเชิงประจักษ์ &rarr; 
              2. <strong>หัวหน้างาน/ผู้บริหารประเมิน</strong> และให้ข้อเสนอแนะเชิงพัฒนา &rarr; 
              3. <strong>ระบบประมวลผลเรดาร์ชาร์ตรายบุคคล</strong> และจัดส่งรายงานสรุปผลเข้า Gmail ของบุคลากรโดยไม่เปิดเผยตัวตนผู้ประเมิน
            </p>
          </div>
        </div>

        {/* Overview Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">บุคลากรทั้งหมด</span>
              <div className="p-2 rounded-xl bg-slate-100 text-slate-600">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl sm:text-3xl font-extrabold text-slate-900">
              {stats.total} <span className="text-xs font-normal text-slate-400">ท่าน</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">ในรอบการประเมินปัจจุบัน</div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">รอประเมินตนเอง</span>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl sm:text-3xl font-extrabold text-amber-600">
              {stats.pendingSelf} <span className="text-xs font-normal text-slate-400">ท่าน</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">ยังไม่ได้ส่งการประเมินตนเอง</div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">รอหัวหน้างานประเมิน</span>
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <UserCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl sm:text-3xl font-extrabold text-blue-600">
              {stats.pendingSupervisor} <span className="text-xs font-normal text-slate-400">ท่าน</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">ประเมินตนเองแล้ว รอการตรวจ</div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">ประเมินเสร็จสิ้น</span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl sm:text-3xl font-extrabold text-emerald-600">
              {stats.completed} <span className="text-xs font-normal text-slate-400">ท่าน</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              คะแนนเฉลี่ย: <strong>{stats.avgScore}%</strong>
            </div>
          </div>
        </div>

        {/* Filter Bar & Search */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาชื่อครู, ตำแหน่ง, อีเมล..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#7B1C3E] focus:bg-white transition-all"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto text-xs font-semibold">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ทั้งหมด ({evaluations.length})
            </button>
            <button
              onClick={() => setStatusFilter('pending_self')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'pending_self' ? 'bg-white text-amber-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              รอประเมินตนเอง
            </button>
            <button
              onClick={() => setStatusFilter('self_submitted')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'self_submitted' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              รอหัวหน้างาน
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'completed' ? 'bg-white text-emerald-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              เสร็จสิ้น
            </button>
          </div>
        </div>

        {/* Staff Evaluation Table */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="py-20 text-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-[#7B1C3E]" />
              <p className="text-sm font-medium">กำลังโหลดข้อมูลการประเมิน...</p>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">ไม่พบรายชื่อในเงื่อนไขที่เลือก</h3>
              <p className="text-xs text-slate-500 mt-1">ลองเปลี่ยนคำค้นหาหรือกดปุ่มซิงค์บุคลากร</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px] font-bold">
                    <th className="py-4 px-6">บุคลากร</th>
                    <th className="py-4 px-4">สถานะ</th>
                    <th className="py-4 px-4 text-center">ตนเอง</th>
                    <th className="py-4 px-4 text-center">หัวหน้างาน</th>
                    <th className="py-4 px-4 text-center">เกรดสรุป</th>
                    <th className="py-4 px-6 text-right">ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredList.map((e) => {
                    const p = e.personnel;
                    const hasEmail = Boolean(p?.email);

                    return (
                      <tr key={e.id} className="hover:bg-slate-50/60 transition-colors">
                        {/* Personnel Column */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 shrink-0 border border-slate-200 flex items-center justify-center">
                              {p?.image_url ? (
                                <img
                                  src={p.image_url}
                                  alt={p.name_th}
                                  className="w-full h-full object-cover object-top"
                                />
                              ) : (
                                <User className="w-5 h-5 text-slate-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 truncate">
                                {p?.name_th || 'ไม่ระบุชื่อ'}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate">
                                {p?.position_th || 'ครูผู้สอน'}
                              </div>
                              {p?.email && (
                                <div className="text-[11px] text-indigo-600 truncate font-mono">
                                  {p.email}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Status Column */}
                        <td className="py-4 px-4">
                          {e.status === 'pending_self' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              รอประเมินตนเอง
                            </span>
                          )}
                          {e.status === 'self_submitted' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/80">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                              รอหัวหน้างานประเมิน
                            </span>
                          )}
                          {e.status === 'completed' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              เสร็จสิ้น
                            </span>
                          )}
                        </td>

                        {/* Self Score */}
                        <td className="py-4 px-4 text-center">
                          {e.self_total_score !== null ? (
                            <span className="font-bold text-slate-700">
                              {Number(e.self_total_score).toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* Supervisor Score */}
                        <td className="py-4 px-4 text-center">
                          {e.supervisor_total_score !== null ? (
                            <span className="font-bold text-[#7B1C3E]">
                              {Number(e.supervisor_total_score).toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* Final Grade Badge */}
                        <td className="py-4 px-4 text-center">
                          {e.final_grade ? (
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-lg text-xs font-black text-white shadow-2xs ${
                                e.final_grade === 'A'
                                  ? 'bg-emerald-600'
                                  : e.final_grade === 'B+'
                                  ? 'bg-blue-600'
                                  : e.final_grade === 'B'
                                  ? 'bg-indigo-600'
                                  : e.final_grade === 'C'
                                  ? 'bg-amber-600'
                                  : 'bg-rose-600'
                              }`}
                            >
                              {e.final_grade}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* Actions Column */}
                        <td className="py-4 px-6 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {/* 1. Self Evaluation Button */}
                            <Link
                              href={`/admin/kpi/${e.id}/self`}
                              title="ประเมินตนเอง (Self Evaluation)"
                              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1"
                            >
                              <User className="w-3.5 h-3.5 text-slate-500" />
                              <span className="hidden sm:inline">ประเมินตนเอง</span>
                            </Link>

                            {/* 2. Supervisor Evaluation Button */}
                            <Link
                              href={`/admin/kpi/${e.id}/supervisor`}
                              title="หัวหน้างานประเมิน (Supervisor Evaluation)"
                              className="px-2.5 py-1.5 rounded-xl bg-[#1B3A6B]/10 hover:bg-[#1B3A6B]/20 text-[#1B3A6B] text-xs font-semibold transition-colors flex items-center gap-1"
                            >
                              <UserCheck className="w-3.5 h-3.5 text-[#1B3A6B]" />
                              <span className="hidden sm:inline">หัวหน้างาน</span>
                            </Link>

                            {/* 3. Analytics & Radar Chart Button */}
                            <Link
                              href={`/admin/kpi/${e.id}/analytics`}
                              title="วิเคราะห์ผลคะแนน & เรดาร์ชาร์ต"
                              className="px-2.5 py-1.5 rounded-xl bg-[#7B1C3E] hover:bg-[#631430] text-white text-xs font-semibold transition-colors flex items-center gap-1 shadow-2xs"
                            >
                              <BarChart3 className="w-3.5 h-3.5" />
                              <span>วิเคราะห์ผล</span>
                            </Link>

                            {/* 4. Anonymous Email Notify Button */}
                            <button
                              type="button"
                              onClick={() => setEmailModalEval(e)}
                              disabled={e.status !== 'completed' || !hasEmail}
                              title={
                                !hasEmail
                                  ? 'ไม่มีอีเมลในระบบ'
                                  : e.status !== 'completed'
                                  ? 'ต้องประเมินเสร็จสิ้นก่อนจึงจะแจ้งผลได้'
                                  : 'ส่งผลการประเมินเข้า Gmail (ไม่ระบุชื่อผู้ประเมิน)'
                              }
                              className={`p-1.5 rounded-xl border transition-colors ${
                                e.email_notified_status === 'sent'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200 disabled:opacity-30'
                              }`}
                            >
                              <Mail className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Anonymous Email Confirmation Modal */}
      <AnimatePresence>
        {emailModalEval && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 text-slate-800 relative"
            >
              <button
                onClick={() => setEmailModalEval(null)}
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
                    <span>ระบบไม่ระบุข้อมูลตัวตนผู้ประเมิน (Anonymous Report)</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 mb-5 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">ผู้รับ (บุคลากร):</span>
                  <strong className="text-slate-800">{emailModalEval.personnel?.name_th}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">ที่อยู่อีเมล:</span>
                  <span className="font-mono text-indigo-700 font-semibold">{emailModalEval.personnel?.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">รอบการประเมิน:</span>
                  <span className="text-slate-700">{emailModalEval.cycle?.title}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200/60 pt-2">
                  <span className="text-slate-500">คะแนนสรุป / เกรด:</span>
                  <strong className="text-[#7B1C3E] text-sm">
                    {Number(emailModalEval.final_score).toFixed(2)}% (เกรด {emailModalEval.final_grade})
                  </strong>
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800 leading-relaxed mb-6">
                <strong>ความปลอดภัยและความเป็นส่วนตัว:</strong> อีเมลที่ส่งออกจะแสดงเฉพาะคะแนนประเมินสรุปและข้อเสนอแนะเชิงพัฒนา โดยจะ<strong>ตัดชื่อและข้อมูลของผู้ประเมินออกทั้งหมด</strong> เพื่อสร้างบรรยากาศการสะท้อนผลเชิงสร้างสรรค์
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEmailModalEval(null)}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={isSendingEmail}
                  onClick={() => handleSendEmail(emailModalEval)}
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
    </div>
  );
}
