'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard,
  Calendar,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  DollarSign,
  Layers,
  Settings,
  Plus,
  RefreshCw,
  Search,
  Check,
  X,
  ChevronRight,
  ArrowRight,
  Sparkles,
  QrCode,
  Building2,
  Receipt,
  UserCheck,
  Percent,
  Sliders,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  InstallmentPlanRow,
  LateFeePolicy,
  WaiverRequestRow,
  FinanceOverview,
  AgreementRow,
  COA_META,
  RECEIPT_SERIES_LABELS,
  ReceiptSeries,
} from '@/lib/finance/installment-types-and-pure';

export default function AdminFeesControlPage() {
  const [activeTab, setActiveTab] = useState<'installments' | 'late_fees' | 'coa_receipts'>('installments');
  const [academicYear, setAcademicYear] = useState<string>('2569');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Data states
  const [plans, setPlans] = useState<InstallmentPlanRow[]>([]);
  const [policy, setPolicy] = useState<LateFeePolicy | null>(null);
  const [overview, setOverview] = useState<FinanceOverview | null>(null);
  const [pendingAgreements, setPendingAgreements] = useState<Array<AgreementRow & { student_name: string | null }>>([]);
  const [waivers, setWaivers] = useState<Array<WaiverRequestRow & { student_name: string | null }>>([]);

  // Modals & Action states
  const [isPolicyEditModalOpen, setIsPolicyEditModalOpen] = useState(false);
  const [policyForm, setPolicyForm] = useState<LateFeePolicy>({
    academic_year: '2569',
    policy_name: 'ค่าปรับชำระล่าช้า ปีการศึกษา 2569 (ผ่อนผัน 5 วัน)',
    grace_period_days: 5,
    calculation_mode: 'FIXED_PER_TRANCHE',
    rate_amount: 100,
    max_cap_per_tranche: 500,
    max_cap_per_term: 1000,
  });

  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [planForm, setPlanForm] = useState({
    academic_year: '2569',
    term: 1 as 1 | 2,
    plan_name: 'ภาคเรียนที่ 1 — ผ่อน 5 งวด (พ.ค.–ก.ย.)',
    num_installments: 5,
    due_day_of_month: 5,
    initial_deposit_pct: 0,
  });

  const [reviewingWaiver, setReviewingWaiver] = useState<(WaiverRequestRow & { student_name: string | null }) | null>(null);
  const [waiverDecisionNote, setWaiverDecisionNote] = useState('');
  const [waiverApprovedAmount, setWaiverApprovedAmount] = useState<number | ''>('');
  const [isProcessingWaiver, setIsProcessingWaiver] = useState(false);

  // Fetch all finance control data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [plansRes, overviewRes, pendingRes, waiversRes] = await Promise.all([
        fetch(`/api/fees/installments?action=plans&academic_year=${academicYear}`),
        fetch('/api/fees/installments?action=overview'),
        fetch('/api/fees/installments?action=pending_agreements'),
        fetch('/api/fees/late-fee-waiver'),
      ]);

      const plansData = await plansRes.json();
      if (plansData.success) {
        setPlans(plansData.plans || []);
        if (plansData.policy) {
          setPolicy(plansData.policy);
          setPolicyForm(plansData.policy);
        }
      }

      const overviewData = await overviewRes.json();
      if (overviewData.success) {
        setOverview(overviewData.overview);
      }

      const pendingData = await pendingRes.json();
      if (pendingData.success) {
        setPendingAgreements(pendingData.pending || []);
      }

      const waiversData = await waiversRes.json();
      if (waiversData.success) {
        setWaivers(waiversData.waivers || []);
      }
    } catch (err) {
      console.error('Failed to load finance data:', err);
      toast.error('ไม่สามารถโหลดข้อมูลระบบการเงินได้');
    } finally {
      setIsLoading(false);
    }
  }, [academicYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Review Agreement (Approve/Reject)
  const handleReviewAgreement = async (agreementId: string, decision: 'APPROVE' | 'REJECT') => {
    const toastId = toast.loading(decision === 'APPROVE' ? 'กำลังอนุมัติแผนผ่อนชำระ...' : 'กำลังปฏิเสธแผนผ่อนชำระ...');
    try {
      const res = await fetch('/api/fees/installments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'review_agreement',
          agreementId,
          decision,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);

      toast.success(data.message, { id: toastId });
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'เกิดข้อผิดพลาดในการพิจารณาแผนผ่อนชำระ', { id: toastId });
    }
  };

  // Handle Review Late Fee Waiver (Approve/Reject)
  const handleReviewWaiver = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!reviewingWaiver) return;
    setIsProcessingWaiver(true);
    const toastId = toast.loading(decision === 'APPROVED' ? 'กำลังอนุมัติยกเว้นค่าปรับและออกใบลดหนี้...' : 'กำลังบันทึก...');

    try {
      const res = await fetch('/api/fees/late-fee-waiver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'review',
          requestId: reviewingWaiver.id,
          decision,
          approvedAmount: waiverApprovedAmount !== '' ? Number(waiverApprovedAmount) : undefined,
          note: waiverDecisionNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);

      toast.success(data.message, { id: toastId });
      setReviewingWaiver(null);
      setWaiverDecisionNote('');
      setWaiverApprovedAmount('');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'เกิดข้อผิดพลาดในการพิจารณาคำขอยกเว้นค่าปรับ', { id: toastId });
    } finally {
      setIsProcessingWaiver(false);
    }
  };

  // Handle Save Policy
  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    const toastId = toast.loading('กำลังบันทึกนโยบายค่าปรับชำระล่าช้า...');
    try {
      const res = await fetch('/api/fees/installments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_policy',
          policy: policyForm,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);

      toast.success('บันทึกนโยบายค่าปรับเรียบร้อยแล้ว', { id: toastId });
      setIsPolicyEditModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'บันทึกนโยบายไม่สำเร็จ', { id: toastId });
    }
  };

  // Handle Save Plan
  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const toastId = toast.loading('กำลังบันทึกแผนผ่อนชำระ...');
    try {
      const res = await fetch('/api/fees/installments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsert_plan',
          plan: planForm,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);

      toast.success('บันทึกแผนผ่อนชำระเรียบร้อยแล้ว', { id: toastId });
      setIsPlanModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'บันทึกแผนผ่อนชำระไม่สำเร็จ', { id: toastId });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8 space-y-6 font-sans">
      {/* Top Header */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#7B1C3E]/10 text-[#7B1C3E] dark:text-pink-400 border border-[#7B1C3E]/20">
              ศูนย์ควบคุมการเงิน & ค่าธรรมเนียม
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-semibold text-slate-500">
              ปีการศึกษา {academicYear}
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
              สอดคล้องระเบียบ สช. 100%
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
            <CreditCard className="w-8 h-8 text-[#7B1C3E]" />
            ระบบบริหารการเงิน ค่าธรรมเนียม & ผ่อนชำระ 5 เดือน
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            ควบคุมแผนผ่อนชำระสูงสุด 5 งวด/เทอม, นโยบายค่าปรับและกระบวนการขอยกเว้น (Maker-Checker), และการแยกเล่มใบเสร็จ 01 REC- vs 02 SRV-
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/pos/fees"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#7B1C3E] hover:bg-[#681834] text-white text-xs font-bold shadow-md shadow-[#7B1C3E]/20 transition-all cursor-pointer"
          >
            <Receipt className="w-4 h-4" />
            <span>ไปที่เคาน์เตอร์ POS รับชำระค่าเทอม</span>
          </Link>
          <button
            onClick={() => fetchData()}
            disabled={isLoading}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Overview Summary Bar */}
      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">แผนผ่อนชำระที่เปิดใช้</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{overview.activeAgreements} ครอบครัว</p>
            <p className="text-[10px] text-slate-500 mt-0.5">รออนุมัติ {overview.pendingAgreements} รายการ</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">งวดที่เกินกำหนดชำระ</p>
            <p className="text-2xl font-black text-rose-600 mt-1">{overview.overdueTranches} งวด</p>
            <p className="text-[10px] text-slate-500 mt-0.5">นักเรียนที่ค้างชำระ</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">เงินต้นค้างชำระรวม</p>
            <p className="text-2xl font-black text-amber-600 mt-1">
              ฿{overview.overduePrincipal.toLocaleString('th-TH')}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Principal Receivable</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">ค่าปรับล่าช้าสะสม</p>
            <p className="text-2xl font-black text-[#7B1C3E] dark:text-pink-400 mt-1">
              ฿{overview.accruedLateFees.toLocaleString('th-TH')}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Accrued Late Fees</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">คิวขอยกเว้นค่าปรับ</p>
            <p className="text-2xl font-black text-purple-600 mt-1">{overview.pendingWaivers} คำขอ</p>
            <p className="text-[10px] text-slate-500 mt-0.5">รอ Maker-Checker</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">ระยะเวลาผ่อนผัน</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">{policy?.grace_period_days ?? 5} วัน</p>
            <p className="text-[10px] text-slate-500 mt-0.5">หลังวันครบกำหนดชำระ</p>
          </div>
        </div>
      )}

      {/* Segmented Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-200/80 dark:bg-slate-850 rounded-2xl max-w-2xl">
        <button
          onClick={() => setActiveTab('installments')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'installments'
              ? 'bg-white dark:bg-slate-900 text-[#7B1C3E] dark:text-pink-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>(1) โครงสร้างแผนผ่อนชำระ 5 งวด</span>
          {pendingAgreements.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">
              {pendingAgreements.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('late_fees')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'late_fees'
              ? 'bg-white dark:bg-slate-900 text-[#7B1C3E] dark:text-pink-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>(2) นโยบายค่าปรับ & คิวยกเว้น</span>
          {overview?.pendingWaivers ? (
            <span className="w-5 h-5 rounded-full bg-purple-600 text-white text-[10px] font-black flex items-center justify-center">
              {overview.pendingWaivers}
            </span>
          ) : null}
        </button>

        <button
          onClick={() => setActiveTab('coa_receipts')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'coa_receipts'
              ? 'bg-white dark:bg-slate-900 text-[#7B1C3E] dark:text-pink-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>(3) แยกเล่ม 01 REC- / 02 SRV-</span>
        </button>
      </div>

      {/* TAB 1: INSTALLMENTS STRUCTURE & PENDING APPROVAL QUEUE */}
      {activeTab === 'installments' && (
        <div className="space-y-6">
          {/* Pending Agreements Approval Queue */}
          {pendingAgreements.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-300 dark:border-amber-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-amber-950 dark:text-amber-200">
                      คำขอเปิดแผนผ่อนชำระจากผู้ปกครองรอการตรวจสอบ ({pendingAgreements.length} รายการ)
                    </h2>
                    <p className="text-xs text-amber-800/80 dark:text-amber-400">
                      ผู้ปกครองลงนามบันทึกข้อตกลงผ่าน Parents Portal เรียบร้อยแล้ว กรุณาตรวจสอบและอนุมัติเปิดงวดผ่อนชำระ
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {pendingAgreements.map((a) => (
                  <div
                    key={a.id}
                    className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-amber-200 dark:border-amber-800/60 shadow-xs flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold text-slate-500">รหัสนักเรียน: {a.student_id}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800">
                          ผ่อน {a.num_installments} งวด
                        </span>
                      </div>
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                        {a.student_name || `นักเรียนรหัส ${a.student_id}`}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        ภาคเรียนที่ {a.term}/{a.academic_year} • กำหนดจ่ายทุกวันที่ {a.due_day_of_month} ของเดือน
                      </p>
                      <div className="mt-2 text-xs font-bold text-[#7B1C3E] dark:text-pink-400">
                        ยอดรวม: ฿{a.total_principal.toLocaleString('th-TH')}
                      </div>
                      {a.signed_by_name && (
                        <p className="text-[11px] text-slate-400 mt-1">
                          ลงนามโดย: {a.signed_by_name} ({a.signed_at?.slice(0, 10)})
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={() => handleReviewAgreement(a.id, 'APPROVE')}
                        className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" /> อนุมัติแผน
                      </button>
                      <button
                        onClick={() => handleReviewAgreement(a.id, 'REJECT')}
                        className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" /> ปฏิเสธ
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Installment Plans Configuration */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-[#7B1C3E]" />
                  โครงสร้างแผนผ่อนชำระค่าธรรมเนียมการศึกษา (2–5 งวดต่อภาคเรียน)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  กำหนดการแบ่งงวดตามปฏิทินโรงเรียน: ภาคเรียนที่ 1 (พ.ค.–ก.ย.) และ ภาคเรียนที่ 2 (พ.ย.–มี.ค.)
                </p>
              </div>

              <button
                onClick={() => setIsPlanModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#7B1C3E]/10 hover:bg-[#7B1C3E]/20 text-[#7B1C3E] dark:text-pink-400 text-xs font-bold transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" /> เพิ่มโครงสร้างแผนผ่อนชำระใหม่
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {plans.map((p) => (
                <div
                  key={p.id}
                  className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-3 relative overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-[#7B1C3E] text-white">
                      ผ่อน {p.num_installments} เดือน
                    </span>
                    <span className="text-xs text-slate-500 font-bold">
                      เทอม {p.term}/{p.academic_year}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">{p.plan_name}</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      จ่ายทุกวันที่ <strong className="text-slate-800 dark:text-slate-200">{p.due_day_of_month}</strong> ของเดือน
                    </p>
                    <p className="text-xs text-slate-500">
                      เงินดาวน์งวดแรก:{' '}
                      <strong className="text-slate-800 dark:text-slate-200">
                        {p.initial_deposit_pct > 0 ? `${p.initial_deposit_pct}%` : 'แบ่งเท่ากันทุกงวด'}
                      </strong>
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between text-xs">
                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> เปิดใช้งาน
                    </span>
                    <span className="text-slate-400 text-[11px]">สูงสุด 5 เดือน</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LATE FEE POLICY & MAKER-CHECKER WAIVER QUEUE */}
      {activeTab === 'late_fees' && (
        <div className="space-y-6">
          {/* Policy Card */}
          {policy && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                      <Clock className="w-5 h-5 text-[#7B1C3E]" />
                      นโยบายค่าปรับชำระล่าช้า (Late Payment Fee Policy)
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      ใช้งานอยู่
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    อัตราค่าปรับและการผ่อนผันที่คำนวณอัตโนมัติเมื่อพ้นกำหนดชำระของแต่ละงวด
                  </p>
                </div>

                <button
                  onClick={() => setIsPolicyEditModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                >
                  <Settings className="w-4 h-4" /> ปรับแต่งนโยบายค่าปรับ
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <p className="text-xs text-slate-400 font-bold uppercase">ระยะเวลาผ่อนผัน (Grace Period)</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                    {policy.grace_period_days} วัน
                  </p>
                  <p className="text-[11px] text-emerald-600 mt-0.5">ไม่มีค่าปรับหากชำระภายใน {policy.grace_period_days} วัน</p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <p className="text-xs text-slate-400 font-bold uppercase">รูปแบบการคำนวณ</p>
                  <p className="text-lg font-black text-slate-900 dark:text-white mt-1">
                    {policy.calculation_mode === 'FIXED_PER_TRANCHE'
                      ? 'คงที่ต่องวด (Fixed)'
                      : policy.calculation_mode === 'DAILY_RATE'
                      ? 'คิดรายวัน (Daily)'
                      : 'ร้อยละต่อเดือน (Percentage)'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {policy.calculation_mode === 'FIXED_PER_TRANCHE'
                      ? `฿${policy.rate_amount} ต่องวดที่เลยกำหนด`
                      : policy.calculation_mode === 'DAILY_RATE'
                      ? `฿${policy.rate_amount} ต่อวันหลังพ้นผ่อนผัน`
                      : `${policy.rate_amount}% ต่อเดือน`}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <p className="text-xs text-slate-400 font-bold uppercase">เพดานสูงสุดต่องวด (Tranche Cap)</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                    ฿{policy.max_cap_per_tranche.toLocaleString('th-TH')}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">ค่าปรับแต่ละงวดจะไม่เกินจำนวนนี้</p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <p className="text-xs text-slate-400 font-bold uppercase">เพดานรวมต่อภาคเรียน (Term Cap)</p>
                  <p className="text-2xl font-black text-[#7B1C3E] dark:text-pink-400 mt-1">
                    ฿{policy.max_cap_per_term.toLocaleString('th-TH')}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">เพื่อความเป็นธรรม ไม่ให้สะสมเกินขอบเขต</p>
                </div>
              </div>
            </div>
          )}

          {/* Pending Waiver Approval Queue (Maker-Checker) */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-purple-600" />
                  คิวรอพิจารณาคำขอยกเว้นค่าปรับ (Maker-Checker Queue)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  แคชเชียร์/ครูเป็นผู้ส่งคำขอ (Maker) • หัวหน้าการเงิน/ผู้อำนวยการเป็นผู้อนุมัติ (Checker) พร้อมออกใบลดหนี้ (Credit Note) อัตโนมัติ
                </p>
              </div>
            </div>

            {waivers.filter((w) => w.status === 'PENDING').length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm font-medium border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                ไม่มีคำขอยกเว้นค่าปรับที่ค้างการพิจารณาในขณะนี้
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {waivers
                  .filter((w) => w.status === 'PENDING')
                  .map((w) => (
                    <div key={w.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                            {w.student_name || `นักเรียนรหัส ${w.student_id}`}
                          </span>
                          <span className="text-xs font-mono text-slate-400">({w.student_id})</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800">
                            ขอยกเว้น: ฿{w.requested_amount.toLocaleString('th-TH')}
                            {w.waive_full ? ' (ยกเว้นเต็มจำนวน)' : ''}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          <strong className="text-slate-700 dark:text-slate-200">เหตุผล:</strong> {w.reason}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          ผู้ขอ: {w.requested_by_name || 'เจ้าหน้าที่การเงิน'} • เมื่อ {w.created_at.slice(0, 16).replace('T', ' ')} น.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => {
                            setReviewingWaiver(w);
                            setWaiverApprovedAmount(w.requested_amount);
                            setWaiverDecisionNote('');
                          }}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
                        >
                          พิจารณาคำขอ (1-Click Review)
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: DUAL RECEIPT SERIES & CHART OF ACCOUNTS (สช.) */}
      {activeTab === 'coa_receipts' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Series 01 Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border-2 border-indigo-200 dark:border-indigo-900 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-600 text-white">
                  เล่ม 01 (Prefix: REC-)
                </span>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
                  เบิกจ่ายสวัสดิการได้ 100%
                </span>
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  {RECEIPT_SERIES_LABELS['01'].title_th}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  หมวดบัญชี: <strong className="text-slate-800 dark:text-slate-200">41110 ค่าธรรมเนียมการเรียน</strong> ตามระเบียบกระทรวงศึกษาธิการ / กรมบัญชีกลาง (CGD)
                </p>
              </div>
              <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>รองรับการเบิกสวัสดิการการศึกษาบุตรข้าราชการ/พนักงานรัฐวิสาหกิจ</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>รูปแบบ A4 ทางการ พร้อมลายมือชื่ออิเล็กทรอนิกส์ผู้อำนวยการ</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>รหัสคิวอาร์สำหรับตรวจสอบความถูกต้องของเอกสารทันที</span>
                </li>
              </ul>
            </div>

            {/* Series 02 Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border-2 border-[#7B1C3E]/30 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full text-xs font-black bg-[#7B1C3E] text-white">
                  เล่ม 02 (Prefix: SRV-)
                </span>
                <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                  บริการโรงเรียน & ค่าปรับ
                </span>
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  {RECEIPT_SERIES_LABELS['02'].title_th}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  ครอบคลุม: ค่าอาหารโรงครัวภายใน (41210), กิจกรรมเสริม (41130), อุปกรณ์/เครื่องแบบ (41310), และค่าปรับล่าช้า (44120)
                </p>
              </div>
              <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#7B1C3E] shrink-0" />
                  <span>โรงเรียนไม่มีเงินอุดหนุนอาหารกลางวันรัฐบาล (โรงครัวปรุงสด รวมในค่าบริการ)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#7B1C3E] shrink-0" />
                  <span>แยกรายการโปร่งใส ชี้แจงรายรับต้นทุน ม.32 ได้อย่างถูกต้อง</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#7B1C3E] shrink-0" />
                  <span>ค่าปรับชำระล่าช้า (ถ้ามี) จะถูกบันทึกในเล่มนี้ เพื่อไม่ปะปนกับค่าเล่าเรียน</span>
                </li>
              </ul>
            </div>
          </div>

          {/* COA Table */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              ผังบัญชีมาตรฐานและเล่มใบเสร็จรับเงิน (Chart of Accounts & Receipt Series Mapping)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase">
                    <th className="py-3 px-4">รหัสบัญชี</th>
                    <th className="py-3 px-4">ชื่อบัญชีภาษาไทย</th>
                    <th className="py-3 px-4">หมวดบัญชี</th>
                    <th className="py-3 px-4">เล่มใบเสร็จ</th>
                    <th className="py-3 px-4">เบิกสวัสดิการราชการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {Object.entries(COA_META).map(([code, meta]) => (
                    <tr key={code} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">{code}</td>
                      <td className="py-3 px-4">{meta.name_th}</td>
                      <td className="py-3 px-4 text-slate-500">รายได้สถานศึกษา (4XXXX)</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            meta.series === '01'
                              ? 'bg-indigo-100 text-indigo-800 font-black'
                              : 'bg-pink-100 text-[#7B1C3E] font-black'
                          }`}
                        >
                          เล่ม {meta.series} ({meta.series === '01' ? 'REC-' : 'SRV-'})
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {meta.cgdReimbursable ? (
                          <span className="text-emerald-600 font-bold flex items-center gap-1">
                            <Check className="w-4 h-4" /> ได้ (กรมบัญชีกลาง)
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT POLICY */}
      <AnimatePresence>
        {isPolicyEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  แก้ไขนโยบายค่าปรับชำระล่าช้า
                </h3>
                <button
                  onClick={() => setIsPolicyEditModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSavePolicy} className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    ระยะเวลาผ่อนผัน (วัน)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={policyForm.grace_period_days}
                    onChange={(e) => setPolicyForm({ ...policyForm, grace_period_days: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    แนะนำ 5–7 วัน (ไม่มีการคิดค่าปรับในระหว่างช่วงผ่อนผัน)
                  </p>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    รูปแบบการคำนวณ
                  </label>
                  <select
                    value={policyForm.calculation_mode}
                    onChange={(e) => setPolicyForm({ ...policyForm, calculation_mode: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold"
                  >
                    <option value="FIXED_PER_TRANCHE">คงที่ต่องวด (Fixed per tranche)</option>
                    <option value="DAILY_RATE">คิดรายวันหลังพ้นผ่อนผัน (Daily Rate)</option>
                    <option value="PERCENTAGE">ร้อยละต่อเดือน (Percentage / Month)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    อัตราค่าปรับ (บาท หรือ %)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={policyForm.rate_amount}
                    onChange={(e) => setPolicyForm({ ...policyForm, rate_amount: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      เพดานต่องวด (บาท)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={policyForm.max_cap_per_tranche}
                      onChange={(e) => setPolicyForm({ ...policyForm, max_cap_per_tranche: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      เพดานรวมต่อเทอม (บาท)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={policyForm.max_cap_per_term}
                      onChange={(e) => setPolicyForm({ ...policyForm, max_cap_per_term: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPolicyEditModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#7B1C3E] text-white font-bold shadow-md shadow-[#7B1C3E]/20"
                  >
                    บันทึกนโยบาย
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: CREATE PLAN */}
      <AnimatePresence>
        {isPlanModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  เพิ่มโครงสร้างแผนผ่อนชำระใหม่
                </h3>
                <button
                  onClick={() => setIsPlanModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSavePlan} className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    ชื่อแผนผ่อนชำระ
                  </label>
                  <input
                    type="text"
                    required
                    value={planForm.plan_name}
                    onChange={(e) => setPlanForm({ ...planForm, plan_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">ภาคเรียน</label>
                    <select
                      value={planForm.term}
                      onChange={(e) => setPlanForm({ ...planForm, term: Number(e.target.value) as 1 | 2 })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold"
                    >
                      <option value={1}>ภาคเรียนที่ 1</option>
                      <option value={2}>ภาคเรียนที่ 2</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">จำนวนงวด (2–5)</label>
                    <input
                      type="number"
                      min="2"
                      max="5"
                      required
                      value={planForm.num_installments}
                      onChange={(e) => setPlanForm({ ...planForm, num_installments: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      ครบกำหนดทุกวันที่
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="28"
                      value={planForm.due_day_of_month}
                      onChange={(e) => setPlanForm({ ...planForm, due_day_of_month: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      เงินดาวน์งวดแรก (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={planForm.initial_deposit_pct}
                      onChange={(e) => setPlanForm({ ...planForm, initial_deposit_pct: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPlanModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#7B1C3E] text-white font-bold shadow-md shadow-[#7B1C3E]/20"
                  >
                    บันทึกแผน
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: REVIEW WAIVER REQUEST */}
      <AnimatePresence>
        {reviewingWaiver && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-purple-600" />
                    พิจารณาอนุมัติคำขอยกเว้นค่าปรับ
                  </h3>
                  <p className="text-xs text-slate-500">Maker-Checker Authorization</p>
                </div>
                <button
                  onClick={() => setReviewingWaiver(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">นักเรียน:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {reviewingWaiver.student_name || reviewingWaiver.student_id} ({reviewingWaiver.student_id})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">จำนวนที่ขอยกเว้น:</span>
                  <span className="font-extrabold text-purple-700 dark:text-purple-300">
                    ฿{reviewingWaiver.requested_amount.toLocaleString('th-TH')}
                    {reviewingWaiver.waive_full ? ' (ยกเว้นเต็มจำนวน)' : ''}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">ผู้ขอ (Maker):</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">{reviewingWaiver.requested_by_name}</span>
                </div>
                <div className="pt-2 border-t border-purple-200/60 dark:border-purple-800/60">
                  <span className="text-slate-500 block mb-0.5">เหตุผลความจำเป็น:</span>
                  <p className="text-slate-800 dark:text-slate-200 font-medium italic">
                    &quot;{reviewingWaiver.reason}&quot;
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    จำนวนเงินค่าปรับที่อนุมัติยกเว้น (บาท)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={reviewingWaiver.requested_amount}
                    value={waiverApprovedAmount}
                    onChange={(e) => setWaiverApprovedAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold text-purple-700"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    หากอนุมัติ ระบบจะออกใบลดหนี้ (Credit Note CN-) อัตโนมัติ เพื่อปรับปรุงยอดทางบัญชี
                  </p>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    บันทึกข้อคิดเห็นของผู้อนุมัติ (Review Note)
                  </label>
                  <textarea
                    rows={2}
                    value={waiverDecisionNote}
                    onChange={(e) => setWaiverDecisionNote(e.target.value)}
                    placeholder="เช่น อนุมัติตามคำร้องเนื่องจากผู้ปกครองประสบอุบัติเหตุฉุกเฉิน"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isProcessingWaiver}
                  onClick={() => handleReviewWaiver('REJECTED')}
                  className="px-4 py-2.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold transition-colors cursor-pointer"
                >
                  ไม่อนุมัติคำขอ
                </button>
                <button
                  type="button"
                  disabled={isProcessingWaiver}
                  onClick={() => handleReviewWaiver('APPROVED')}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-600/20 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" /> อนุมัติ & ออกใบลดหนี้ (CN-)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
