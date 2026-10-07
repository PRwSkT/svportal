'use client';

import { useState, useRef, useEffect } from 'react';
import { syncPaymentToSVPortal, StudentWithFees } from '@/lib/supabase/fees';
import { getCurrentAcademicYear } from '@/lib/utils';
import { FeeItem } from '@/types';
import { ReceiptPrint } from '@/components/ReceiptPrint';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, User, CreditCard, CheckCircle2, ChevronRight, ChevronLeft, Printer, Banknote, QrCode, Building2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

type Step = 1 | 2 | 3 | 4;

export default function FeeCollectionPage() {
  const { dict, isThai, formatDate, formatCurrency } = useLanguage();
  const [step, setStep] = useState<Step>(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<StudentWithFees[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentWithFees | null>(null);
  
  const [selectedFeeIds, setSelectedFeeIds] = useState<Set<string>>(new Set());
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qr' | 'transfer'>('cash');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [receiptData, setReceiptData] = useState<{ id: string, number: string, date: Date } | null>(null);

  const receiptRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 1) {
      searchInputRef.current?.focus();
    }
  }, [step]);

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
    // Auto-select all unpaid fees
    setSelectedFeeIds(new Set(student.unpaid_fees.map(f => f.id)));
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

  const selectedFees = selectedStudent?.unpaid_fees.filter(f => selectedFeeIds.has(f.id)) || [];
  const totalAmount = selectedFees.reduce((sum, item) => sum + Number(item.amount), 0);

  const proceedToPayment = () => {
    if (selectedFeeIds.size === 0) {
      toast.warning(isThai ? 'กรุณาเลือกรายการที่ต้องการชำระ' : 'Please select at least one item to pay.');
      return;
    }
    setStep(3);
  };

  // Step 3: Payment Method
  const confirmPayment = async () => {
    if (!selectedStudent || selectedFeeIds.size === 0) return;
    
    setIsProcessing(true);
    const loadingToast = toast.loading(isThai ? 'กำลังประมวลผลการชำระเงิน...' : 'Processing payment...');
    
    try {
      // Create payment in DB (atomic receipt generation)
      const res = await fetch('/api/pos/fees/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: selectedStudent.id,
          feeItemIds: Array.from(selectedFeeIds),
          paymentMethod,
          totalAmount,
          academicYear: getCurrentAcademicYear()
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to process payment');
      }

      const result = await res.json();
      
      setReceiptData({
        id: result.payment_id,
        number: result.receipt_number,
        date: new Date()
      });

      // Call SVPortal sync stub (fire and forget)
      syncPaymentToSVPortal(result.payment_id).catch(console.error);

      setStep(4);
      toast.success(isThai ? 'รับชำระเงินสำเร็จ!' : 'Payment completed successfully!', { id: loadingToast });
      
      // Delay to ensure the receipt component is rendered before capturing
      setTimeout(() => captureAndUploadReceipt(result.payment_id, result.receipt_number), 500);

    } catch (err: any) {
      console.error('Payment Error:', err);
      toast.error(err.message || (isThai ? 'เกิดข้อผิดพลาดในการชำระเงิน' : 'Payment processing failed'), { id: loadingToast });
    } finally {
      setIsProcessing(false);
    }
  };

  const captureAndUploadReceipt = async (paymentId: string, receiptNumber: string) => {
    if (!receiptRef.current) return;
    
    try {
      const el = receiptRef.current;
      const originalDisplay = el.style.display;
      el.style.display = 'block';
      
      const canvas = await html2canvas(el, { scale: 2 });
      
      el.style.display = originalDisplay; // restore
      
      const base64Image = canvas.toDataURL('image/png');
      
      // Send to API route to upload and backup
      fetch('/api/fees/receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_id: paymentId,
          receipt_number: receiptNumber,
          student_id: selectedStudent?.id,
          total_amount: totalAmount,
          base64Image
        })
      }).catch(console.error); // fire and forget backup
      
    } catch (err) {
      console.error('Failed to capture receipt:', err);
    }
  };

  // Step 4: Receipt
  const handlePrint = () => {
    window.print();
  };

  const resetFlow = () => {
    setStep(1);
    setSelectedStudent(null);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedFeeIds(new Set());
    setPaymentMethod('cash');
    setReceiptData(null);
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto print:p-0 min-h-screen bg-background font-sans">
      {/* Print-only component */}
      {step === 4 && selectedStudent && receiptData && (
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
        {/* Unified SV Portal Header Card */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 backdrop-blur-xl p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 mb-8">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#7B1C3E]/10 text-[#7B1C3E] dark:text-pink-400 rounded-2xl flex items-center justify-center shrink-0 border border-[#7B1C3E]/20">
              <CreditCard className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">{dict.fees.title}</h1>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {dict.common.officialBadge}
                </span>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {isThai ? `ปีการศึกษา ${getCurrentAcademicYear()}` : `Academic Year ${Number(getCurrentAcademicYear()) - 543}`}
                </span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium mt-0.5">{dict.fees.subtitle}</p>
            </div>
          </div>
          {step > 1 && (
            <button 
              onClick={resetFlow}
              className="text-xs sm:text-sm font-bold text-[#7B1C3E] dark:text-pink-400 hover:bg-[#7B1C3E]/10 px-4 py-2 rounded-xl transition-all border border-[#7B1C3E]/20 shrink-0 flex items-center gap-1.5"
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
            { s: 4, label: dict.fees.step4 }
          ].map(({ s, label }) => (
            <div key={s} className="flex items-center flex-1 last:flex-none relative">
              <div className="flex flex-col items-center gap-2 relative z-10 w-full">
                <motion.div 
                  initial={false}
                  animate={{ 
                    scale: step === s ? 1.15 : 1,
                    backgroundColor: step === s ? '#7B1C3E' : step > s ? '#10B981' : '#E2E8F0',
                    color: step >= s ? '#ffffff' : '#64748B'
                  }}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm transition-all duration-300"
                >
                  {step > s ? <CheckCircle2 className="w-5 h-5" /> : s}
                </motion.div>
                <span className={`text-xs font-bold whitespace-nowrap absolute -bottom-6 ${step === s ? 'text-[#7B1C3E] dark:text-pink-400' : step > s ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400'}`}>
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
            {/* STEP 1 */}
            {step === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-white dark:bg-slate-900 p-8 md:p-12 rounded-3xl shadow-xl border border-slate-200/80 dark:border-slate-800 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#7B1C3E]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

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
                    className="px-10 py-4 bg-[#7B1C3E] hover:bg-[#681834] text-white font-black text-lg rounded-2xl shadow-lg shadow-[#7B1C3E]/20 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
                  >
                    {isSearching ? (isThai ? 'กำลังค้นหา...' : 'Searching...') : dict.common.search}
                  </button>
                </form>

                {searchResults.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid gap-4 max-w-3xl mx-auto relative z-10"
                  >
                    {searchResults.map((student, i) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
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
                            <p className="text-slate-500 font-bold text-sm tracking-wider">ID: {student.id} <span className="mx-2">•</span> {dict.students.grade}: {student.grade || '-'}</p>
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
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* STEP 2 */}
            {step === 2 && selectedStudent && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white dark:bg-slate-900 p-8 md:p-10 rounded-3xl shadow-xl border border-slate-200/80 dark:border-slate-800"
              >
                <div className="flex justify-between items-center mb-8 pb-6 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-[#7B1C3E]/10 rounded-full flex items-center justify-center text-[#7B1C3E] dark:text-pink-400">
                      <User className="w-7 h-7" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">{selectedStudent.name}</h2>
                      <p className="text-slate-500 font-bold tracking-wider">{dict.students.studentId}: {selectedStudent.id} • {selectedStudent.grade}</p>
                    </div>
                  </div>
                  <button onClick={() => setStep(1)} className="text-slate-500 hover:text-[#7B1C3E] dark:hover:text-pink-400 font-bold flex items-center gap-2 transition-colors px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">
                    <ChevronLeft className="w-5 h-5" /> {dict.fees.changeStudent}
                  </button>
                </div>

                {selectedStudent.unpaid_fees.length === 0 ? (
                  <div className="text-center py-16 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                      <CheckCircle2 className="w-12 h-12" />
                    </div>
                    <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white">{dict.fees.noUnpaid}</h3>
                    <p className="text-slate-500 mt-2">{dict.fees.noUnpaidHint}</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4 mb-10">
                      <h3 className="font-bold text-lg text-slate-600 dark:text-slate-300 uppercase tracking-widest mb-4">{dict.fees.unpaidList}</h3>
                      {selectedStudent.unpaid_fees.map((fee) => {
                        const isOverdue = fee.fee_type?.due_date && new Date(fee.fee_type.due_date) < new Date();
                        const isSelected = selectedFeeIds.has(fee.id);
                        return (
                          <label 
                            key={fee.id}
                            className={`flex items-center justify-between p-6 border-2 rounded-2xl cursor-pointer transition-all
                              ${isSelected ? 'border-[#7B1C3E] bg-[#7B1C3E]/5 shadow-md shadow-[#7B1C3E]/5' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-[#7B1C3E]/30'}
                              ${isOverdue && !isSelected ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900' : ''}
                            `}
                          >
                            <div className="flex items-center gap-6">
                              <div className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${isSelected ? 'bg-[#7B1C3E] text-white' : 'bg-white dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600'}`}>
                                {isSelected && <CheckCircle2 className="w-4 h-4" />}
                              </div>
                              <div>
                                <p className="font-extrabold text-xl text-slate-900 dark:text-white mb-1">{fee.fee_type?.name || dict.fees.invoiceItems}</p>
                                <p className="text-sm font-medium text-slate-500">
                                  {dict.fees.dueDate}: {fee.fee_type?.due_date ? formatDate(new Date(fee.fee_type.due_date)) : '-'}
                                  {isOverdue && <span className="text-rose-700 dark:text-rose-400 font-bold ml-3 bg-rose-100 dark:bg-rose-950/50 px-2 py-0.5 rounded-md text-xs">{dict.fees.overdue}</span>}
                                </p>
                              </div>
                            </div>
                            <div className={`font-black text-2xl ${isSelected ? 'text-[#7B1C3E] dark:text-pink-400' : 'text-slate-900 dark:text-white'}`}>
                              {formatCurrency(Number(fee.amount))}
                            </div>
                          </label>
                        );
                      })}
                    </div>

                    <div className="flex flex-col md:flex-row justify-between items-center p-6 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-inner">
                      <div className="text-slate-600 dark:text-slate-300 font-bold mb-4 md:mb-0">
                        {dict.fees.selectedCount} <span className="text-[#7B1C3E] dark:text-pink-400 text-xl mx-1 font-black">{selectedFeeIds.size}</span> {dict.dashboard.items}
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
                          disabled={selectedFeeIds.size === 0}
                          className="px-8 py-4 bg-[#7B1C3E] hover:bg-[#681834] text-white font-black text-lg rounded-2xl shadow-lg shadow-[#7B1C3E]/20 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 flex items-center gap-2"
                        >
                          {dict.fees.proceedToPayment} <ChevronRight className="w-6 h-6" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* STEP 3 */}
            {step === 3 && selectedStudent && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white dark:bg-slate-900 p-8 md:p-10 rounded-3xl shadow-xl border border-slate-200/80 dark:border-slate-800 max-w-3xl mx-auto"
              >
                <div className="flex justify-between items-center mb-8 pb-6 border-b border-slate-200 dark:border-slate-800">
                  <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
                    <CreditCard className="w-7 h-7 text-[#7B1C3E] dark:text-pink-400" /> {dict.fees.selectMethod}
                  </h2>
                  <button onClick={() => setStep(2)} className="text-slate-500 hover:text-[#7B1C3E] dark:hover:text-pink-400 font-bold flex items-center gap-2 transition-colors px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">
                    <ChevronLeft className="w-5 h-5" /> {dict.common.back}
                  </button>
                </div>

                <div className="text-center mb-10 bg-[#7B1C3E]/5 dark:bg-[#7B1C3E]/10 p-8 rounded-3xl border border-[#7B1C3E]/10">
                  <p className="text-[#7B1C3E] dark:text-pink-400 font-bold uppercase tracking-widest text-sm mb-2">{dict.fees.amountToPay}</p>
                  <h3 className="text-6xl font-black text-[#7B1C3E] dark:text-pink-400 tracking-tight mb-2">
                    {formatCurrency(totalAmount)}
                  </h3>
                  <p className="text-sm font-bold text-slate-500">{isThai ? 'สำหรับนักเรียน' : 'For student'}: {selectedStudent.name}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                  {/* Cash */}
                  <label className={`
                    flex flex-col items-center justify-center p-8 border-2 rounded-3xl cursor-pointer transition-all relative overflow-hidden
                    ${paymentMethod === 'cash' ? 'border-[#7B1C3E] bg-[#7B1C3E]/5 text-[#7B1C3E] dark:text-pink-400 shadow-lg shadow-[#7B1C3E]/10' : 'border-slate-200 dark:border-slate-700 hover:border-[#7B1C3E]/30 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800'}
                  `}>
                    <input 
                      type="radio" name="payment" value="cash" className="hidden"
                      checked={paymentMethod === 'cash'} onChange={() => setPaymentMethod('cash')} 
                    />
                    <Banknote className={`w-12 h-12 mb-4 ${paymentMethod === 'cash' ? 'text-[#7B1C3E] dark:text-pink-400' : 'text-slate-400'}`} />
                    <div className="font-extrabold text-lg">{dict.fees.cash}</div>
                    {paymentMethod === 'cash' && <div className="absolute top-4 right-4"><CheckCircle2 className="w-6 h-6 text-[#7B1C3E] dark:text-pink-400"/></div>}
                  </label>

                  {/* QR */}
                  <label className={`
                    flex flex-col items-center justify-center p-8 border-2 rounded-3xl cursor-pointer transition-all relative overflow-hidden
                    ${paymentMethod === 'qr' ? 'border-[#7B1C3E] bg-[#7B1C3E]/5 text-[#7B1C3E] dark:text-pink-400 shadow-lg shadow-[#7B1C3E]/10' : 'border-slate-200 dark:border-slate-700 hover:border-[#7B1C3E]/30 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800'}
                  `}>
                    <input 
                      type="radio" name="payment" value="qr" className="hidden"
                      checked={paymentMethod === 'qr'} onChange={() => setPaymentMethod('qr')} 
                    />
                    <QrCode className={`w-12 h-12 mb-4 ${paymentMethod === 'qr' ? 'text-[#7B1C3E] dark:text-pink-400' : 'text-slate-400'}`} />
                    <div className="font-extrabold text-lg">{dict.fees.qrScan}</div>
                    {paymentMethod === 'qr' && <div className="absolute top-4 right-4"><CheckCircle2 className="w-6 h-6 text-[#7B1C3E] dark:text-pink-400"/></div>}
                  </label>

                  {/* Transfer */}
                  <label className={`
                    flex flex-col items-center justify-center p-8 border-2 rounded-3xl cursor-pointer transition-all relative overflow-hidden
                    ${paymentMethod === 'transfer' ? 'border-[#7B1C3E] bg-[#7B1C3E]/5 text-[#7B1C3E] dark:text-pink-400 shadow-lg shadow-[#7B1C3E]/10' : 'border-slate-200 dark:border-slate-700 hover:border-[#7B1C3E]/30 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800'}
                  `}>
                    <input 
                      type="radio" name="payment" value="transfer" className="hidden"
                      checked={paymentMethod === 'transfer'} onChange={() => setPaymentMethod('transfer')} 
                    />
                    <Building2 className={`w-12 h-12 mb-4 ${paymentMethod === 'transfer' ? 'text-[#7B1C3E] dark:text-pink-400' : 'text-slate-400'}`} />
                    <div className="font-extrabold text-lg">{dict.fees.transfer}</div>
                    {paymentMethod === 'transfer' && <div className="absolute top-4 right-4"><CheckCircle2 className="w-6 h-6 text-[#7B1C3E] dark:text-pink-400"/></div>}
                  </label>
                </div>

                {/* Payment Method Details */}
                <AnimatePresence mode="wait">
                  {paymentMethod === 'qr' && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-slate-50 dark:bg-slate-800/60 p-8 rounded-2xl text-center mb-10 border border-slate-200 dark:border-slate-700 shadow-inner overflow-hidden"
                    >
                      <div className="w-48 h-48 bg-white border-4 border-slate-200 dark:border-slate-600 mx-auto flex items-center justify-center text-slate-300 mb-4 rounded-xl">
                        <QrCode className="w-24 h-24 opacity-30 text-slate-800" />
                      </div>
                      <p className="text-sm font-bold text-slate-600 dark:text-slate-300">{dict.fees.qrScanHint}</p>
                    </motion.div>
                  )}

                  {paymentMethod === 'transfer' && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-slate-50 dark:bg-slate-800/60 p-8 rounded-2xl text-center mb-10 border border-slate-200 dark:border-slate-700 shadow-inner overflow-hidden"
                    >
                      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">{dict.fees.schoolAccount}</p>
                      <div className="flex items-center justify-center gap-3 mb-2 flex-wrap">
                        <div className="text-3xl sm:text-4xl font-mono font-black tracking-wider text-[#7B1C3E] dark:text-pink-400">
                          {process.env.NEXT_PUBLIC_SCHOOL_BANK_ACCOUNT || '123-4-56789-0'}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(process.env.NEXT_PUBLIC_SCHOOL_BANK_ACCOUNT || '123-4-56789-0');
                            toast.success(dict.fees.copied);
                          }}
                          className="px-3 py-1.5 bg-[#7B1C3E]/10 hover:bg-[#7B1C3E]/20 text-[#7B1C3E] dark:text-pink-400 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          {dict.fees.copyAccount}
                        </button>
                      </div>
                      <p className="font-bold text-lg text-slate-700 dark:text-slate-300">{dict.fees.accountName}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button 
                  onClick={confirmPayment}
                  disabled={isProcessing}
                  className="w-full py-5 bg-[#7B1C3E] hover:bg-[#681834] text-white font-black text-xl rounded-2xl shadow-xl shadow-[#7B1C3E]/20 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                  {isProcessing ? (
                    <><div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" /> {isThai ? 'กำลังประมวลผล...' : 'Processing...'}</>
                  ) : (
                    <><CheckCircle2 className="w-6 h-6" /> {dict.fees.confirmPayment}</>
                  )}
                </button>
              </motion.div>
            )}

            {/* STEP 4 */}
            {step === 4 && receiptData && selectedStudent && (
              <motion.div 
                key="step4"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center max-w-2xl mx-auto"
              >
                <div className="bg-emerald-600 p-12 rounded-[3rem] mb-8 shadow-2xl shadow-emerald-600/20 text-white relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', bounce: 0.5 }}
                    className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner"
                  >
                    <CheckCircle2 className="w-16 h-16 text-emerald-600" />
                  </motion.div>
                  <h2 className="text-4xl font-black mb-3">{dict.fees.paymentSuccess}</h2>
                  <p className="text-xl font-medium text-emerald-100">{dict.fees.receiptNumber}: <span className="font-mono bg-black/20 px-3 py-1 rounded-lg ml-2">{receiptData.number}</span></p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button 
                    onClick={handlePrint}
                    className="px-8 py-4 bg-[#7B1C3E] hover:bg-[#681834] text-white font-black text-lg rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-[#7B1C3E]/20 transition-all active:scale-95"
                  >
                    <Printer className="w-6 h-6" /> {dict.fees.printReceipt}
                  </button>
                  <button 
                    onClick={resetFlow}
                    className="px-8 py-4 bg-white dark:bg-slate-800 text-slate-800 dark:text-white border-2 border-slate-200 dark:border-slate-700 font-bold text-lg rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95"
                  >
                    {dict.fees.nextStudent}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
