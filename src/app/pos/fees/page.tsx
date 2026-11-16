'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { syncPaymentToSVPortal, StudentWithFees } from '@/lib/supabase/fees';
import { getCurrentAcademicYear } from '@/lib/utils';
import { FeeItem } from '@/types';
import { ReceiptPrint } from '@/components/ReceiptPrint';
import { printDocumentViaSandbox, openDocumentPreviewInTab } from '@/lib/documents/print-service';
import { renderReceiptA4OfficialHtml } from '@/components/documents/receipts/ReceiptA4Official';
import { renderReceiptThermalHtml } from '@/components/documents/receipts/ReceiptThermalSlip';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  User,
  CreditCard,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Printer,
  Banknote,
  QrCode,
  Building2,
  ExternalLink,
  Calendar,
  Clock,
  ShieldAlert,
  Percent,
  Plus,
  X,
  Check,
  AlertCircle,
  Receipt,
  FileCheck2,
  Sparkles,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  AgreementWithSchedule,
  ScheduleRow,
  TrancheLateFeeView,
  DualReceiptPreview,
  splitDualReceipt,
  splitFeeItemsToDualReceipt,
  ReceiptLine,
  RECEIPT_SERIES_LABELS,
} from '@/lib/finance/installment-types-and-pure';
import {
  formatPromptPayPayload,
  generatePromptPayQrDataUrl,
  buildTuitionQrRefs,
} from '@/lib/finance/emvco-promptpay';

type Step = 1 | 2 | 3 | 4;

export default function FeeCollectionPage() {
  const { dict, isThai, formatDate, formatCurrency } = useLanguage();
  const [step, setStep] = useState<Step>(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<StudentWithFees[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentWithFees | null>(null);

  // Mode: standard full fee items or 5-month installment plan
  const [paymentMode, setPaymentMode] = useState<'standard' | 'installment'>('standard');
  const [installmentAgreements, setInstallmentAgreements] = useState<AgreementWithSchedule[]>([]);
  const [isLoadingInstallments, setIsLoadingInstallments] = useState<boolean>(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);

  // Standard fee selection
  const [selectedFeeIds, setSelectedFeeIds] = useState<Set<string>>(new Set());

  // Payment Method
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qr' | 'transfer'>('cash');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [isGeneratingQr, setIsGeneratingQr] = useState<boolean>(false);

  // Processing & Receipt state
  const [isProcessing, setIsProcessing] = useState(false);
  const [receiptData, setReceiptData] = useState<{
    id: string;
    number: string;
    date: Date;
    recNumber?: string | null;
    srvNumber?: string | null;
    recAmount?: number;
    srvAmount?: number;
    isInstallment?: boolean;
    installmentNo?: number;
    lines?: ReceiptLine[];
  } | null>(null);

  // Waiver Request Modal (Maker-Checker)
  const [isWaiverModalOpen, setIsWaiverModalOpen] = useState(false);
  const [waiverReason, setWaiverReason] = useState('');
  const [waiverScheduleTarget, setWaiverScheduleTarget] = useState<(ScheduleRow & { view: TrancheLateFeeView }) | null>(null);
  const [isSubmittingWaiver, setIsSubmittingWaiver] = useState(false);

  // New Installment Agreement Modal (Counter Setup)
  const [isCreateAgreementModalOpen, setIsCreateAgreementModalOpen] = useState(false);
  const [numInstallmentsChoice, setNumInstallmentsChoice] = useState<number>(5);
  const [isSubmittingAgreement, setIsSubmittingAgreement] = useState(false);

  const receiptRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const paymentLockRef = useRef(false);

  useEffect(() => {
    if (step === 1) {
      searchInputRef.current?.focus();
    }
  }, [step]);

  // Fetch student installments when selected
  const fetchStudentInstallments = useCallback(async (studentId: string) => {
    setIsLoadingInstallments(true);
    try {
      const res = await fetch(`/api/fees/installments?student_id=${studentId}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.agreements)) {
        setInstallmentAgreements(data.agreements);
        if (data.agreements.length > 0) {
          setPaymentMode('installment');
          // auto-select first unpaid tranche
          const active = data.agreements[0];
          const firstUnpaid = active.schedules.find((s: any) => s.status !== 'PAID');
          if (firstUnpaid) {
            setSelectedScheduleId(firstUnpaid.id);
          }
        } else {
          setPaymentMode('standard');
        }
      }
    } catch (err) {
      console.error('Failed to load installments:', err);
    } finally {
      setIsLoadingInstallments(false);
    }
  }, []);

  // Step 1: Search
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const res = await fetch(`/api/pos/fees?q=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) {
        throw new Error('Failed to fetch students');
      }
      const results = await res.json();
      setSearchResults(results);
      if (results.length === 0) {
        toast.error(isThai ? 'ไม่พบนักเรียน กรุณาตรวจสอบรหัสนักเรียนหรือชื่ออีกครั้ง' : 'Student not found. Please verify the ID or name.');
      }
    } catch (err) {
      console.error(err);
      toast.error(isThai ? 'เกิดข้อผิดพลาดในการค้นหา' : 'An error occurred while searching.');
    } finally {
      setIsSearching(false);
    }
  };

  const selectStudent = (student: StudentWithFees) => {
    setSelectedStudent(student);
    setSelectedFeeIds(new Set(student.unpaid_fees.map((f) => f.id)));
    setSelectedScheduleId(null);
    setInstallmentAgreements([]);
    fetchStudentInstallments(student.id);
    setStep(2);
  };

  // Step 2: Fees Selection
  const toggleFee = (feeId: string) => {
    const newSelected = new Set(selectedFeeIds);
    if (newSelected.has(feeId)) {
      newSelected.delete(feeId);
    } else {
      newSelected.add(feeId);
    }
    setSelectedFeeIds(newSelected);
  };

  const selectedFees = selectedStudent?.unpaid_fees.filter((f) => selectedFeeIds.has(f.id)) || [];

  // Active installment schedule & tranche
  const activeAgreement = installmentAgreements[0] || null;
  const activeTranche = useMemo(() => {
    if (!activeAgreement || !selectedScheduleId) return null;
    return activeAgreement.schedules.find((s) => s.id === selectedScheduleId) || null;
  }, [activeAgreement, selectedScheduleId]);

  // Total amount to pay
  const totalAmount = useMemo(() => {
    if (paymentMode === 'installment') {
      if (!activeTranche) return 0;
      return activeTranche.view.totalDue;
    }
    return selectedFees.reduce((sum, item) => sum + Number(item.amount), 0);
  }, [paymentMode, activeTranche, selectedFees]);

  // Dual Receipt Preview
  const dualReceiptPreview: DualReceiptPreview = useMemo(() => {
    if (paymentMode === 'installment' && activeTranche) {
      return activeTranche.dual;
    }
    // Standard mode: group selected fee items
    return splitFeeItemsToDualReceipt(
      selectedFees.map((f) => ({
        id: f.id,
        name: f.fee_type?.name || 'ค่าธรรมเนียม',
        amount: Number(f.amount),
        coa_code: (f.fee_type as any)?.coa_code,
      }))
    );
  }, [paymentMode, activeTranche, selectedFees]);

  // Generate dynamic EMVCo PromptPay Tag 30 QR when switching to QR in Step 3
  const generatePromptPayQr = useCallback(async () => {
    if (!selectedStudent || totalAmount <= 0) return;
    setIsGeneratingQr(true);
    try {
      const billerTaxId = process.env.NEXT_PUBLIC_SCHOOL_TAX_ID || '0994000168391';
      const refNo = paymentMode === 'installment' && activeTranche
        ? `INST-${selectedStudent.id}-${activeTranche.installment_no}`
        : `TUITION-${selectedStudent.id}-${Date.now().toString().slice(-4)}`;
      
      const { ref1, ref2 } = buildTuitionQrRefs(selectedStudent.id, refNo);

      const payload = formatPromptPayPayload({
        targetId: billerTaxId,
        amount: totalAmount,
        ref1,
        ref2,
        merchantName: 'SOMKIDVITTAYA SCHOOL',
      });

      const dataUrl = await generatePromptPayQrDataUrl(payload, 300);
      setQrCodeDataUrl(dataUrl);
    } catch (err) {
      console.error('Failed to generate PromptPay QR:', err);
    } finally {
      setIsGeneratingQr(false);
    }
  }, [selectedStudent, totalAmount, paymentMode, activeTranche]);

  const proceedToPayment = () => {
    if (paymentMode === 'installment') {
      if (!activeTranche) {
        toast.warning('กรุณาเลือกงวดผ่อนชำระที่ต้องการรับเงิน');
        return;
      }
      if (activeTranche.status === 'PAID') {
        toast.warning('งวดนี้ชำระเงินเรียบร้อยแล้ว');
        return;
      }
    } else {
      if (selectedFeeIds.size === 0) {
        toast.warning(isThai ? 'กรุณาเลือกรายการที่ต้องการชำระ' : 'Please select at least one item to pay.');
        return;
      }
    }
    setStep(3);
    if (paymentMethod === 'qr') {
      generatePromptPayQr();
    }
  };

  useEffect(() => {
    if (step === 3 && paymentMethod === 'qr') {
      generatePromptPayQr();
    }
  }, [step, paymentMethod, generatePromptPayQr]);

  // Step 3: Payment Method & Confirmation
  const confirmPayment = async () => {
    if (!selectedStudent) return;
    if (paymentLockRef.current || isProcessing) return;
    paymentLockRef.current = true;

    setIsProcessing(true);
    const loadingToast = toast.loading(isThai ? 'กำลังประมวลผลการชำระเงิน...' : 'Processing payment...');

    try {
      if (paymentMode === 'installment') {
        if (!activeTranche) throw new Error('ไม่พบงวดผ่อนชำระ');

        const res = await fetch('/api/fees/installments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'pay_tranche',
            scheduleId: activeTranche.id,
            paymentMethod,
            cashierNote: `รับชำระเคาน์เตอร์ POS งวดที่ ${activeTranche.installment_no}`,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to pay installment tranche');
        }

        const data = await res.json();
        const r = data.result;

        setReceiptData({
          id: r.payment_id,
          number: r.rec_number || r.srv_number || 'REC-INST',
          recNumber: r.rec_number,
          srvNumber: r.srv_number,
          recAmount: r.rec_amount,
          srvAmount: r.srv_amount,
          date: new Date(),
          isInstallment: true,
          installmentNo: activeTranche.installment_no,
          lines: r.lines,
        });

        setStep(4);
        toast.success(
          r.rec_number && r.srv_number
            ? `รับชำระงวดที่ ${activeTranche.installment_no} สำเร็จ! ออกใบเสร็จแยกเล่ม ${r.rec_number} (ค่าเทอม) และ ${r.srv_number} (ค่าบริการ)`
            : `รับชำระงวดที่ ${activeTranche.installment_no} สำเร็จ!`,
          { id: loadingToast }
        );
      } else {
        // Standard full payment
        const res = await fetch('/api/pos/fees/pay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId: selectedStudent.id,
            feeItemIds: Array.from(selectedFeeIds),
            paymentMethod,
            totalAmount,
            academicYear: getCurrentAcademicYear(),
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to process payment');
        }

        const result = await res.json();

        setReceiptData({
          id: result.payment_id,
          number: result.receipt_number,
          date: new Date(),
          isInstallment: false,
        });

        // Sync stub
        syncPaymentToSVPortal(result.payment_id).catch(console.error);

        setStep(4);
        toast.success(isThai ? 'รับชำระเงินสำเร็จ!' : 'Payment completed successfully!', { id: loadingToast });
        setTimeout(() => captureAndUploadReceipt(result.payment_id, result.receipt_number), 500);
      }
    } catch (err: any) {
      console.error('Payment Error:', err);
      toast.error(err.message || (isThai ? 'เกิดข้อผิดพลาดในการชำระเงิน' : 'Payment processing failed'), {
        id: loadingToast,
      });
    } finally {
      paymentLockRef.current = false;
      setIsProcessing(false);
    }
  };

  const captureAndUploadReceipt = async (paymentId: string, receiptNumber: string) => {
    if (!selectedStudent) return;
    try {
      const htmlContent = renderReceiptA4OfficialHtml({
        student: selectedStudent,
        receiptNumber,
        items: selectedFees,
        totalAmount,
        paymentMethod,
        date: new Date(),
      });

      fetch('/api/fees/receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_id: paymentId,
          receipt_number: receiptNumber,
          student_id: selectedStudent?.id,
          total_amount: totalAmount,
          htmlContent,
        }),
      }).catch(console.error);
    } catch (err) {
      console.error('Failed to capture receipt:', err);
    }
  };

  // Submit Late Fee Waiver Request (Maker)
  const handleSubmitWaiver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waiverScheduleTarget || !waiverReason.trim()) return;

    setIsSubmittingWaiver(true);
    const toastId = toast.loading('กำลังส่งคำขอยกเว้นค่าปรับ...');
    try {
      const res = await fetch('/api/fees/late-fee-waiver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit',
          scheduleId: waiverScheduleTarget.id,
          reason: waiverReason.trim(),
          waiveFull: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);

      toast.success('ส่งคำขอยกเว้นค่าปรับเรียบร้อยแล้ว รอผู้อำนวยการ/หัวหน้าการเงินอนุมัติ (Maker-Checker)', {
        id: toastId,
      });
      setIsWaiverModalOpen(false);
      setWaiverReason('');
      setWaiverScheduleTarget(null);
      if (selectedStudent) fetchStudentInstallments(selectedStudent.id);
    } catch (err: any) {
      toast.error(err.message || 'ส่งคำขอไม่สำเร็จ', { id: toastId });
    } finally {
      setIsSubmittingWaiver(false);
    }
  };

  // Create Installment Agreement from POS counter
  const handleCreateAgreement = async () => {
    if (!selectedStudent || selectedStudent.unpaid_fees.length === 0) return;
    setIsSubmittingAgreement(true);
    const toastId = toast.loading('กำลังตั้งค่าแผนผ่อนชำระ...');
    try {
      const res = await fetch('/api/fees/installments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_agreement',
          studentId: selectedStudent.id,
          academicYear: getCurrentAcademicYear(),
          term: 1,
          numInstallments: numInstallmentsChoice,
          feeItemIds: selectedStudent.unpaid_fees.map((f) => f.id),
          signedByName: 'ผู้ปกครอง (ทำรายการที่เคาน์เตอร์ POS)',
          autoApprove: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);

      toast.success(`สร้างแผนผ่อนชำระ ${numInstallmentsChoice} งวดเรียบร้อยแล้ว`, { id: toastId });
      setIsCreateAgreementModalOpen(false);
      fetchStudentInstallments(selectedStudent.id);
    } catch (err: any) {
      toast.error(err.message || 'ไม่สามารถสร้างแผนผ่อนชำระได้', { id: toastId });
    } finally {
      setIsSubmittingAgreement(false);
    }
  };

  // Print Handlers
  const handlePrintA4 = async () => {
    if (!selectedStudent || !receiptData) return;
    const html = renderReceiptA4OfficialHtml({
      student: selectedStudent,
      receiptNumber: receiptData.number,
      items: selectedFees,
      totalAmount,
      paymentMethod,
      date: receiptData.date,
    });
    await printDocumentViaSandbox({
      title: `ใบเสร็จรับเงินทางการ_${receiptData.number}_${selectedStudent.name}`,
      paperSize: 'A4_PORTRAIT',
      contentHtml: html,
    });
  };

  const handlePrintThermal = async (rollWidth: '80mm' | '58mm' = '80mm') => {
    if (!selectedStudent || !receiptData) return;
    const html = renderReceiptThermalHtml({
      student: selectedStudent,
      receiptNumber: receiptData.number,
      items: selectedFees,
      totalAmount,
      paymentMethod,
      date: receiptData.date,
      rollWidth,
    });
    await printDocumentViaSandbox({
      title: `สลิปใบเสร็จ_${receiptData.number}`,
      paperSize: rollWidth === '58mm' ? 'THERMAL_58MM' : 'THERMAL_80MM',
      contentHtml: html,
    });
  };

  const handlePreviewPdf = () => {
    if (!selectedStudent || !receiptData) return;
    const html = renderReceiptA4OfficialHtml({
      student: selectedStudent,
      receiptNumber: receiptData.number,
      items: selectedFees,
      totalAmount,
      paymentMethod,
      date: receiptData.date,
    });
    openDocumentPreviewInTab({
      title: `ใบเสร็จรับเงินทางการ_${receiptData.number}`,
      paperSize: 'A4_PORTRAIT',
      contentHtml: html,
    });
  };

  const resetFlow = () => {
    setStep(1);
    setSelectedStudent(null);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedFeeIds(new Set());
    setInstallmentAgreements([]);
    setSelectedScheduleId(null);
    setPaymentMode('standard');
    setPaymentMethod('cash');
    setReceiptData(null);
    setQrCodeDataUrl(null);
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto print:p-0 min-h-screen bg-background font-sans">
      {/* Print-only component */}
      {step === 4 && selectedStudent && receiptData && !receiptData.isInstallment && (
        <ReceiptPrint
          ref={receiptRef}
          student={selectedStudent}
          receiptNumber={receiptData.number}
          items={selectedFees}
          totalAmount={totalAmount}
          paymentMethod={paymentMethod}
          date={receiptData.date}
        />
      )}

      {/* Screen UI - Hidden when printing */}
      <div className="print:hidden h-full">
        {/* Header Card */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 backdrop-blur-xl p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 mb-8">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#7B1C3E]/10 text-[#7B1C3E] dark:text-pink-400 rounded-2xl flex items-center justify-center shrink-0 border border-[#7B1C3E]/20">
              <CreditCard className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  {dict.fees.title}
                </h1>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {dict.common.officialBadge}
                </span>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#7B1C3E]/10 text-[#7B1C3E] dark:text-pink-400 border border-[#7B1C3E]/20">
                  ผ่อนชำระสูงสุด 5 เดือน & แยกเล่ม 01/02
                </span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium mt-0.5">
                เคาน์เตอร์รับชำระค่าธรรมเนียมการศึกษา, ผ่อนชำระรายงวด, ค่าปรับล่าช้า, และออกใบเสร็จทางการ
              </p>
            </div>
          </div>
          {step > 1 && (
            <button
              onClick={resetFlow}
              className="text-xs sm:text-sm font-bold text-[#7B1C3E] dark:text-pink-400 hover:bg-[#7B1C3E]/10 px-4 py-2 rounded-xl transition-all border border-[#7B1C3E]/20 shrink-0 flex items-center gap-1.5 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" /> {dict.fees.newTransaction}
            </button>
          )}
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center mb-10 max-w-3xl mx-auto px-4">
          {[
            { s: 1, label: dict.fees.step1 },
            { s: 2, label: dict.fees.step2 },
            { s: 3, label: dict.fees.step3 },
            { s: 4, label: dict.fees.step4 },
          ].map(({ s, label }) => (
            <div key={s} className="flex items-center flex-1 last:flex-none relative">
              <div className="flex flex-col items-center gap-2 relative z-10 w-full">
                <motion.div
                  initial={false}
                  animate={{
                    scale: step === s ? 1.15 : 1,
                    backgroundColor: step === s ? '#7B1C3E' : step > s ? '#10B981' : '#E2E8F0',
                    color: step >= s ? '#ffffff' : '#64748B',
                  }}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm transition-all duration-300"
                >
                  {step > s ? <CheckCircle2 className="w-5 h-5" /> : s}
                </motion.div>
                <span
                  className={`text-xs font-bold whitespace-nowrap absolute -bottom-6 ${
                    step === s
                      ? 'text-[#7B1C3E] dark:text-pink-400'
                      : step > s
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-slate-400'
                  }`}
                >
                  {label}
                </span>
              </div>
              {s < 4 && (
                <div className="absolute top-5 left-1/2 w-full h-1 -z-0">
                  <div className="w-full h-full bg-slate-200 dark:bg-slate-700 rounded-full">
                    <motion.div
                      className="h-full bg-emerald-500 rounded-full"
                      initial={{ width: '0%' }}
                      animate={{ width: step > s ? '100%' : '0%' }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-12">
          <AnimatePresence mode="wait">
            {/* STEP 1: Search */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-white dark:bg-slate-900 p-8 md:p-12 rounded-3xl shadow-xl border border-slate-200/80 dark:border-slate-800 relative overflow-hidden"
              >
                <div className="text-center mb-8 relative z-10">
                  <div className="w-16 h-16 bg-[#7B1C3E]/10 text-[#7B1C3E] dark:text-pink-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-2">{dict.fees.searchTitle}</h2>
                  <p className="text-slate-500 dark:text-slate-400 font-medium">{dict.fees.searchHint}</p>
                </div>

                <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 max-w-2xl mx-auto mb-10 relative z-10">
                  <div className="flex-1 relative group">
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder={dict.fees.searchStudentPlaceholder}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-14 pr-4 py-4 border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-2xl focus:border-[#7B1C3E] focus:ring-4 focus:ring-[#7B1C3E]/10 outline-none text-xl font-medium text-slate-900 dark:text-white placeholder:text-slate-400 transition-all"
                    />
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400 group-focus-within:text-[#7B1C3E] transition-colors" />
                  </div>
                  <button
                    type="submit"
                    disabled={isSearching || !searchQuery.trim()}
                    className="px-10 py-4 bg-[#7B1C3E] hover:bg-[#681834] text-white font-black text-lg rounded-2xl shadow-lg shadow-[#7B1C3E]/20 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 cursor-pointer"
                  >
                    {isSearching ? (isThai ? 'กำลังค้นหา...' : 'Searching...') : dict.common.search}
                  </button>
                </form>

                {searchResults.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4 max-w-3xl mx-auto relative z-10">
                    {searchResults.map((student, i) => (
                      <div
                        key={student.id}
                        onClick={() => selectStudent(student)}
                        className="flex justify-between items-center p-6 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border-2 border-transparent hover:border-[#7B1C3E]/50 shadow-sm hover:shadow-md cursor-pointer transition-all group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-[#7B1C3E]/10 rounded-full flex items-center justify-center text-[#7B1C3E] dark:text-pink-400 group-hover:scale-110 transition-transform">
                            <User className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="font-extrabold text-xl text-slate-900 dark:text-white">{student.name}</h3>
                            <p className="text-slate-500 font-bold text-sm tracking-wider">
                              ID: {student.id} <span className="mx-2">•</span> {dict.students.grade}: {student.grade || '-'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          {student.unpaid_fees.length > 0 ? (
                            <span className="text-rose-700 dark:text-rose-400 font-black bg-rose-50 dark:bg-rose-950/30 px-4 py-2 rounded-xl text-sm border border-rose-200 dark:border-rose-900 shadow-sm">
                              {isThai ? `ค้างชำระ ${student.unpaid_fees.length} รายการ` : `${student.unpaid_fees.length} Unpaid`}
                            </span>
                          ) : (
                            <span className="text-emerald-700 dark:text-emerald-400 font-black bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2 rounded-xl text-sm border border-emerald-200 dark:border-emerald-900">
                              {dict.fees.noUnpaid}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* STEP 2: Selection (Standard vs Installment) */}
            {step === 2 && selectedStudent && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white dark:bg-slate-900 p-8 md:p-10 rounded-3xl shadow-xl border border-slate-200/80 dark:border-slate-800 space-y-6"
              >
                {/* Student header bar */}
                <div className="flex justify-between items-center pb-6 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-[#7B1C3E]/10 rounded-full flex items-center justify-center text-[#7B1C3E] dark:text-pink-400">
                      <User className="w-7 h-7" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">{selectedStudent.name}</h2>
                      <p className="text-slate-500 font-bold tracking-wider">
                        {dict.students.studentId}: {selectedStudent.id} • {selectedStudent.grade}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setStep(1)}
                    className="text-slate-500 hover:text-[#7B1C3E] dark:hover:text-pink-400 font-bold flex items-center gap-2 transition-colors px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" /> {dict.fees.changeStudent}
                  </button>
                </div>

                {/* Mode Switcher Tabs */}
                <div className="flex items-center justify-between gap-4 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setPaymentMode('installment')}
                      className={`py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                        paymentMode === 'installment'
                          ? 'bg-[#7B1C3E] text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      <Calendar className="w-4 h-4" />
                      <span>ผ่อนชำระรายงวด (สูงสุด 5 งวด)</span>
                      {installmentAgreements.length > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-white/20 text-white">
                          มีแผนผ่อน
                        </span>
                      )}
                    </button>

                    <button
                      onClick={() => setPaymentMode('standard')}
                      className={`py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                        paymentMode === 'standard'
                          ? 'bg-[#7B1C3E] text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      <Receipt className="w-4 h-4" />
                      <span>ชำระเต็มจำนวน (รายการปกติ)</span>
                    </button>
                  </div>

                  {paymentMode === 'installment' && installmentAgreements.length === 0 && (
                    <button
                      onClick={() => setIsCreateAgreementModalOpen(true)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> เปิดแผนผ่อนชำระใหม่ให้นักเรียน
                    </button>
                  )}
                </div>

                {/* MODE A: INSTALLMENTS */}
                {paymentMode === 'installment' && (
                  <div className="space-y-4">
                    {isLoadingInstallments ? (
                      <div className="text-center py-12 text-slate-400">กำลังตรวจสอบข้อมูลแผนผ่อนชำระ...</div>
                    ) : installmentAgreements.length === 0 ? (
                      <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 space-y-3">
                        <Calendar className="w-12 h-12 text-slate-400 mx-auto" />
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                          นักเรียนคนนี้ยังไม่มีแผนผ่อนชำระ
                        </h3>
                        <p className="text-xs text-slate-500 max-w-md mx-auto">
                          หากผู้ปกครองต้องการผ่อนชำระค่าธรรมเนียม สามารถคลิกปุ่มด้านล่างเพื่อแบ่งจ่ายได้สูงสุด 5 งวดต่อภาคเรียน
                        </p>
                        <button
                          onClick={() => setIsCreateAgreementModalOpen(true)}
                          disabled={selectedStudent.unpaid_fees.length === 0}
                          className="px-5 py-2.5 bg-[#7B1C3E] hover:bg-[#681834] text-white rounded-xl text-xs font-bold shadow-md shadow-[#7B1C3E]/20 transition-all cursor-pointer"
                        >
                          ตั้งค่าแผนผ่อนชำระ 5 เดือน (สำหรับนักเรียนคนนี้)
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {activeAgreement && (
                          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 flex items-center justify-between text-xs">
                            <div>
                              <span className="font-extrabold text-amber-900 dark:text-amber-200">
                                สัญญาผ่อนชำระ: {activeAgreement.num_installments} งวด (ภาคเรียนที่ {activeAgreement.term}/{activeAgreement.academic_year})
                              </span>
                              <p className="text-amber-800/80 dark:text-amber-400 mt-0.5">
                                ครบกำหนดทุกวันที่ {activeAgreement.due_day_of_month} ของเดือน • ยอดเงินต้นรวม ฿{activeAgreement.total_principal.toLocaleString('th-TH')}
                              </p>
                            </div>
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-600 text-white">
                              {activeAgreement.status}
                            </span>
                          </div>
                        )}

                        <div className="space-y-3">
                          {activeAgreement?.schedules.map((s) => {
                            const isSelected = selectedScheduleId === s.id;
                            const isPaid = s.status === 'PAID';
                            const hasLateFee = s.view.netLateFee > 0;

                            return (
                              <div
                                key={s.id}
                                onClick={() => !isPaid && setSelectedScheduleId(s.id)}
                                className={`p-5 rounded-2xl border-2 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                                  isPaid
                                    ? 'bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 opacity-60 cursor-not-allowed'
                                    : isSelected
                                    ? 'bg-[#7B1C3E]/5 border-[#7B1C3E] shadow-md shadow-[#7B1C3E]/10 cursor-pointer'
                                    : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-[#7B1C3E]/40 cursor-pointer'
                                }`}
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-extrabold text-base text-slate-900 dark:text-white">
                                      งวดที่ {s.installment_no} / {activeAgreement.num_installments}
                                    </span>
                                    {isPaid ? (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" /> ชำระแล้ว
                                      </span>
                                    ) : s.view.inGracePeriod ? (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> อยู่ในช่วงผ่อนผัน 5 วัน (ไม่มีค่าปรับ)
                                      </span>
                                    ) : s.view.displayStatus === 'OVERDUE' ? (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" /> เกินกำหนด {s.view.daysLate} วัน
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                                        รอชำระ
                                      </span>
                                    )}
                                  </div>

                                  <p className="text-xs text-slate-500">
                                    กำหนดชำระ: <strong className="text-slate-800 dark:text-slate-200">{s.due_date}</strong>
                                    {' • '}เงินต้น: ฿{s.principal_amount.toLocaleString('th-TH')}
                                    {hasLateFee && (
                                      <span className="text-rose-600 font-bold ml-2">
                                        (ค่าปรับล่าช้า: +฿{s.view.netLateFee.toLocaleString('th-TH')})
                                      </span>
                                    )}
                                  </p>

                                  {/* Dual breakdown mini preview */}
                                  <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1">
                                    <span>เล่ม 01 (REC- ค่าเทอม): ฿{s.dual.rec.total.toLocaleString('th-TH')}</span>
                                    <span>•</span>
                                    <span>เล่ม 02 (SRV- บริการ/อาหาร): ฿{s.dual.srv.total.toLocaleString('th-TH')}</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 self-end sm:self-center">
                                  {!isPaid && hasLateFee && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setWaiverScheduleTarget(s);
                                        setIsWaiverModalOpen(true);
                                      }}
                                      className="px-3 py-1.5 rounded-xl border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 text-xs font-bold transition-colors cursor-pointer"
                                      title="ส่งคำขออนุมัติยกเว้นค่าปรับ (Maker-Checker)"
                                    >
                                      ขอยกเว้นค่าปรับ
                                    </button>
                                  )}

                                  <div className="text-right">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">ยอดชำระงวดนี้</p>
                                    <p className="text-xl font-black text-[#7B1C3E] dark:text-pink-400">
                                      ฿{s.view.totalDue.toLocaleString('th-TH')}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* MODE B: STANDARD FULL UNPAID FEES */}
                {paymentMode === 'standard' && (
                  <div className="space-y-4">
                    {selectedStudent.unpaid_fees.length === 0 ? (
                      <div className="text-center py-16 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
                        <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white">{dict.fees.noUnpaid}</h3>
                        <p className="text-slate-500 mt-2">{dict.fees.noUnpaidHint}</p>
                      </div>
                    ) : (
                      <div className="space-y-4 mb-6">
                        {selectedStudent.unpaid_fees.map((fee) => {
                          const isOverdue = fee.fee_type?.due_date && new Date(fee.fee_type.due_date) < new Date();
                          const isSelected = selectedFeeIds.has(fee.id);
                          return (
                            <label
                              key={fee.id}
                              className={`flex items-center justify-between p-6 border-2 rounded-2xl cursor-pointer transition-all ${
                                isSelected
                                  ? 'border-[#7B1C3E] bg-[#7B1C3E]/5 shadow-md shadow-[#7B1C3E]/5'
                                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-[#7B1C3E]/30'
                              } ${isOverdue && !isSelected ? 'bg-rose-50/50 border-rose-200' : ''}`}
                            >
                              <div className="flex items-center gap-6">
                                <div
                                  className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                                    isSelected ? 'bg-[#7B1C3E] text-white' : 'bg-white border-2 border-slate-300'
                                  }`}
                                >
                                  {isSelected && <CheckCircle2 className="w-4 h-4" />}
                                </div>
                                <div>
                                  <p className="font-extrabold text-xl text-slate-900 dark:text-white mb-1">
                                    {fee.fee_type?.name || dict.fees.invoiceItems}
                                  </p>
                                  <p className="text-sm font-medium text-slate-500">
                                    {dict.fees.dueDate}: {fee.fee_type?.due_date ? formatDate(new Date(fee.fee_type.due_date)) : '-'}
                                    {isOverdue && (
                                      <span className="text-rose-700 font-bold ml-3 bg-rose-100 px-2 py-0.5 rounded-md text-xs">
                                        {dict.fees.overdue}
                                      </span>
                                    )}
                                  </p>
                                </div>
                              </div>
                              <div className={`font-black text-2xl ${isSelected ? 'text-[#7B1C3E]' : 'text-slate-900 dark:text-white'}`}>
                                {formatCurrency(Number(fee.amount))}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Step 2 Bottom Checkout Bar */}
                <div className="flex flex-col md:flex-row justify-between items-center p-6 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-inner">
                  <div className="text-slate-600 dark:text-slate-300 font-bold mb-4 md:mb-0 text-xs">
                    {paymentMode === 'installment' ? (
                      activeTranche ? (
                        <span>
                          ชำระงวดที่ <strong className="text-[#7B1C3E] text-base">{activeTranche.installment_no}</strong> (เงินต้น ฿{activeTranche.principal_amount} + ค่าปรับ ฿{activeTranche.view.netLateFee})
                        </span>
                      ) : (
                        <span>กรุณาเลือกงวดผ่อนชำระ</span>
                      )
                    ) : (
                      <span>
                        เลือกแล้ว <strong className="text-[#7B1C3E] text-base">{selectedFeeIds.size}</strong> รายการ
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{dict.fees.totalDue}</p>
                      <div className="text-4xl font-black text-[#7B1C3E] dark:text-pink-400 tracking-tight">
                        {formatCurrency(totalAmount)}
                      </div>
                    </div>
                    <button
                      onClick={proceedToPayment}
                      disabled={totalAmount <= 0}
                      className="px-8 py-4 bg-[#7B1C3E] hover:bg-[#681834] text-white font-black text-lg rounded-2xl shadow-lg shadow-[#7B1C3E]/20 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
                    >
                      {dict.fees.proceedToPayment} <ChevronRight className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 3: Payment & Dual Receipt Breakdown Preview */}
            {step === 3 && selectedStudent && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white dark:bg-slate-900 p-8 md:p-10 rounded-3xl shadow-xl border border-slate-200/80 dark:border-slate-800 max-w-3xl mx-auto space-y-8"
              >
                <div className="flex justify-between items-center pb-6 border-b border-slate-200 dark:border-slate-800">
                  <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
                    <CreditCard className="w-7 h-7 text-[#7B1C3E] dark:text-pink-400" /> {dict.fees.selectMethod}
                  </h2>
                  <button
                    onClick={() => setStep(2)}
                    className="text-slate-500 hover:text-[#7B1C3E] dark:hover:text-pink-400 font-bold flex items-center gap-2 transition-colors px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" /> {dict.common.back}
                  </button>
                </div>

                {/* Amount to pay banner */}
                <div className="text-center bg-[#7B1C3E]/5 dark:bg-[#7B1C3E]/10 p-6 rounded-3xl border border-[#7B1C3E]/10">
                  <p className="text-[#7B1C3E] dark:text-pink-400 font-bold uppercase tracking-widest text-xs mb-1">
                    {paymentMode === 'installment' && activeTranche
                      ? `ยอดรับชำระงวดที่ ${activeTranche.installment_no} (รวมค่าปรับหากมี)`
                      : dict.fees.amountToPay}
                  </p>
                  <h3 className="text-5xl font-black text-[#7B1C3E] dark:text-pink-400 tracking-tight mb-1">
                    {formatCurrency(totalAmount)}
                  </h3>
                  <p className="text-xs font-bold text-slate-500">
                    สำหรับนักเรียน: {selectedStudent.name} ({selectedStudent.id})
                  </p>
                </div>

                {/* Dual-Receipt Breakdown Preview Card */}
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Receipt className="w-4 h-4 text-[#7B1C3E]" />
                      ตัวอย่างการแยกเล่มใบเสร็จรับเงิน (Dual-Receipt Structure ตามระเบียบ สช.)
                    </span>
                    <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                      อัตโนมัติ
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* Series 01 preview */}
                    <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-indigo-700 dark:text-indigo-300">เล่ม 01 (REC- ค่าเล่าเรียน)</span>
                        <span className="text-[10px] text-emerald-600 font-bold">เบิกสวัสดิการได้</span>
                      </div>
                      <p className="text-lg font-black text-slate-900 dark:text-white">
                        ฿{dualReceiptPreview.rec.total.toLocaleString('th-TH')}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {dualReceiptPreview.rec.lines.map((l) => l.label).join(', ') || 'ไม่มีรายการ'}
                      </p>
                    </div>

                    {/* Series 02 preview */}
                    <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-pink-200 dark:border-pink-900 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#7B1C3E] dark:text-pink-300">เล่ม 02 (SRV- บริการ/อาหาร)</span>
                        <span className="text-[10px] text-slate-400 font-medium">โรงครัว & ค่าปรับ</span>
                      </div>
                      <p className="text-lg font-black text-slate-900 dark:text-white">
                        ฿{dualReceiptPreview.srv.total.toLocaleString('th-TH')}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {dualReceiptPreview.srv.lines.map((l) => l.label).join(', ') || 'ไม่มีรายการ'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Payment Methods */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Cash */}
                  <label
                    className={`flex flex-col items-center justify-center p-6 border-2 rounded-2xl cursor-pointer transition-all relative overflow-hidden ${
                      paymentMethod === 'cash'
                        ? 'border-[#7B1C3E] bg-[#7B1C3E]/5 text-[#7B1C3E] shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 bg-slate-50 dark:bg-slate-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value="cash"
                      className="hidden"
                      checked={paymentMethod === 'cash'}
                      onChange={() => setPaymentMethod('cash')}
                    />
                    <Banknote className="w-10 h-10 mb-2" />
                    <div className="font-extrabold text-base">{dict.fees.cash}</div>
                    {paymentMethod === 'cash' && (
                      <CheckCircle2 className="w-5 h-5 text-[#7B1C3E] absolute top-3 right-3" />
                    )}
                  </label>

                  {/* QR PromptPay Tag 30 */}
                  <label
                    className={`flex flex-col items-center justify-center p-6 border-2 rounded-2xl cursor-pointer transition-all relative overflow-hidden ${
                      paymentMethod === 'qr'
                        ? 'border-[#7B1C3E] bg-[#7B1C3E]/5 text-[#7B1C3E] shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 bg-slate-50 dark:bg-slate-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value="qr"
                      className="hidden"
                      checked={paymentMethod === 'qr'}
                      onChange={() => setPaymentMethod('qr')}
                    />
                    <QrCode className="w-10 h-10 mb-2" />
                    <div className="font-extrabold text-base">Thai QR PromptPay</div>
                    <span className="text-[10px] text-slate-400">Tag 30 Bill Payment</span>
                    {paymentMethod === 'qr' && (
                      <CheckCircle2 className="w-5 h-5 text-[#7B1C3E] absolute top-3 right-3" />
                    )}
                  </label>

                  {/* Transfer */}
                  <label
                    className={`flex flex-col items-center justify-center p-6 border-2 rounded-2xl cursor-pointer transition-all relative overflow-hidden ${
                      paymentMethod === 'transfer'
                        ? 'border-[#7B1C3E] bg-[#7B1C3E]/5 text-[#7B1C3E] shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 bg-slate-50 dark:bg-slate-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value="transfer"
                      className="hidden"
                      checked={paymentMethod === 'transfer'}
                      onChange={() => setPaymentMethod('transfer')}
                    />
                    <Building2 className="w-10 h-10 mb-2" />
                    <div className="font-extrabold text-base">{dict.fees.transfer}</div>
                    {paymentMethod === 'transfer' && (
                      <CheckCircle2 className="w-5 h-5 text-[#7B1C3E] absolute top-3 right-3" />
                    )}
                  </label>
                </div>

                {/* PromptPay QR Code Display */}
                {paymentMethod === 'qr' && (
                  <div className="bg-slate-50 dark:bg-slate-850 p-6 rounded-2xl text-center border border-slate-200 dark:border-slate-700 space-y-3">
                    {isGeneratingQr ? (
                      <div className="py-8 text-xs text-slate-400">กำลังสร้างคิวอาร์โค้ดพร้อมเพย์มาตรฐาน ธปท. (Tag 30)...</div>
                    ) : qrCodeDataUrl ? (
                      <div>
                        <img
                          src={qrCodeDataUrl}
                          alt="PromptPay QR Code"
                          className="w-56 h-56 mx-auto bg-white p-2 rounded-xl shadow-md border"
                        />
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-2">
                          สแกนจ่ายได้ทุกแอปพลิเคชันธนาคาร (Ref1: {selectedStudent.id})
                        </p>
                      </div>
                    ) : null}
                  </div>
                )}

                <button
                  onClick={confirmPayment}
                  disabled={isProcessing}
                  className="w-full py-5 bg-[#7B1C3E] hover:bg-[#681834] text-white font-black text-xl rounded-2xl shadow-xl shadow-[#7B1C3E]/20 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 flex items-center justify-center gap-3 cursor-pointer"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                      กำลังบันทึกการชำระเงิน...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-6 h-6" /> ยืนยันรับชำระเงิน (Confirm Payment)
                    </>
                  )}
                </button>
              </motion.div>
            )}

            {/* STEP 4: Success & Dual Receipt Numbers */}
            {step === 4 && receiptData && selectedStudent && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center max-w-2xl mx-auto space-y-6"
              >
                <div className="bg-emerald-600 p-10 rounded-[3rem] shadow-2xl shadow-emerald-600/20 text-white relative overflow-hidden">
                  <CheckCircle2 className="w-20 h-20 mx-auto mb-4" />
                  <h2 className="text-3xl font-black mb-2">{dict.fees.paymentSuccess}</h2>
                  <p className="text-sm font-medium text-emerald-100">
                    นักเรียน: {selectedStudent.name} ({selectedStudent.id})
                  </p>

                  {/* Dual receipt numbers display */}
                  <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-3 text-xs">
                    {receiptData.recNumber && (
                      <div className="bg-black/25 px-3 py-1.5 rounded-xl font-mono">
                        เล่ม 01 (ค่าเทอม): <strong>{receiptData.recNumber}</strong>
                      </div>
                    )}
                    {receiptData.srvNumber && (
                      <div className="bg-black/25 px-3 py-1.5 rounded-xl font-mono">
                        เล่ม 02 (ค่าบริการ): <strong>{receiptData.srvNumber}</strong>
                      </div>
                    )}
                    {!receiptData.recNumber && !receiptData.srvNumber && (
                      <div className="bg-black/25 px-3 py-1.5 rounded-xl font-mono">
                        เลขที่ใบเสร็จ: <strong>{receiptData.number}</strong>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center">
                  <button
                    onClick={handlePrintA4}
                    className="px-6 py-4 bg-[#7B1C3E] hover:bg-[#681834] text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2.5 shadow-lg shadow-[#7B1C3E]/20 transition-all active:scale-95 cursor-pointer"
                  >
                    <Printer className="w-5 h-5" /> พิมพ์ใบเสร็จทางการ A4 (เบิกสวัสดิการ)
                  </button>
                  <button
                    onClick={() => handlePrintThermal('80mm')}
                    className="px-6 py-4 bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2.5 shadow-md transition-all active:scale-95 cursor-pointer"
                  >
                    <Printer className="w-5 h-5" /> พิมพ์สลิปความร้อน (80mm)
                  </button>
                  <button
                    onClick={handlePreviewPdf}
                    className="px-5 py-4 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold text-sm rounded-2xl hover:bg-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ExternalLink className="w-5 h-5" /> ดูตัวอย่าง / บันทึก PDF
                  </button>
                  <button
                    onClick={resetFlow}
                    className="px-6 py-4 bg-white dark:bg-slate-800 text-slate-800 dark:text-white border-2 border-slate-200 dark:border-slate-700 font-bold text-sm rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95 cursor-pointer"
                  >
                    {dict.fees.nextStudent}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* MODAL: SUBMIT LATE FEE WAIVER REQUEST (MAKER) */}
      <AnimatePresence>
        {isWaiverModalOpen && waiverScheduleTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-purple-600" />
                    ขอยกเว้นค่าปรับชำระล่าช้า
                  </h3>
                  <p className="text-xs text-slate-500">Maker-Checker Authorization</p>
                </div>
                <button
                  onClick={() => setIsWaiverModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 text-xs space-y-1 border border-purple-200 dark:border-purple-800">
                <p>
                  งวดที่: <strong>{waiverScheduleTarget.installment_no}</strong> • กำหนดชำระ:{' '}
                  {waiverScheduleTarget.due_date}
                </p>
                <p className="text-purple-700 dark:text-purple-300 font-bold">
                  ค่าปรับที่เกิดขึ้น: ฿{waiverScheduleTarget.view?.netLateFee.toLocaleString('th-TH')}
                </p>
              </div>

              <form onSubmit={handleSubmitWaiver} className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    เหตุผลความจำเป็นในการขอยกเว้นค่าปรับ <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={waiverReason}
                    onChange={(e) => setWaiverReason(e.target.value)}
                    placeholder="เช่น ผู้ปกครองแจ้งว่าติดภารกิจต่างจังหวัด / มีปัญหาการโอนเงินจากธนาคาร ขออนุโลม"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium focus:outline-none focus:border-purple-600"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    คำขอนี้จะถูกส่งไปยังหัวหน้าการเงิน/ผู้อำนวยการเพื่อพิจารณาอนุมัติออกใบลดหนี้
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsWaiverModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingWaiver || !waiverReason.trim()}
                    className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-md shadow-purple-600/20 disabled:opacity-50 cursor-pointer"
                  >
                    ส่งคำขอยกเว้นค่าปรับ
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: CREATE INSTALLMENT AGREEMENT AT POS */}
      <AnimatePresence>
        {isCreateAgreementModalOpen && selectedStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-[#7B1C3E]" />
                    ตั้งค่าแผนผ่อนชำระค่าธรรมเนียม
                  </h3>
                  <p className="text-xs text-slate-500">สำหรับนักเรียน: {selectedStudent.name}</p>
                </div>
                <button
                  onClick={() => setIsCreateAgreementModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs space-y-1">
                <p>
                  รายการค้างชำระ: <strong>{selectedStudent.unpaid_fees.length} รายการ</strong>
                </p>
                <p>
                  ยอดรวมทั้งสิ้น:{' '}
                  <strong className="text-[#7B1C3E]">
                    ฿
                    {selectedStudent.unpaid_fees
                      .reduce((sum, f) => sum + Number(f.amount), 0)
                      .toLocaleString('th-TH')}
                  </strong>
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">
                  เลือกจำนวนเดือนที่ต้องการผ่อน (2–5 เดือน)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setNumInstallmentsChoice(n)}
                      className={`py-3 rounded-xl font-bold border transition-all cursor-pointer ${
                        numInstallmentsChoice === n
                          ? 'bg-[#7B1C3E] text-white border-[#7B1C3E] shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {n} เดือน
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400">
                  ระบบจะแบ่งเงินต้นเป็น {numInstallmentsChoice} งวด ครบกำหนดทุกวันที่ 5 ของแต่ละเดือน
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateAgreementModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={isSubmittingAgreement}
                  onClick={handleCreateAgreement}
                  className="px-5 py-2.5 rounded-xl bg-[#7B1C3E] hover:bg-[#681834] text-white font-bold shadow-md shadow-[#7B1C3E]/20 cursor-pointer"
                >
                  {isSubmittingAgreement ? 'กำลังบันทึก...' : 'ยืนยันเปิดแผนผ่อนชำระ'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
