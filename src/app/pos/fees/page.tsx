'use client';

import { useState, useRef, useEffect } from 'react';
import { searchStudentsWithFees, createTuitionPayment, syncPaymentToSVPortal, StudentWithFees } from '@/lib/supabase/fees';
import { FeeItem } from '@/types';
import { ReceiptPrint } from '@/components/ReceiptPrint';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, User, CreditCard, CheckCircle2, ChevronRight, ChevronLeft, Printer, Banknote, QrCode, Building2 } from 'lucide-react';

type Step = 1 | 2 | 3 | 4;

export default function FeeCollectionPage() {
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
      const results = await searchStudentsWithFees(searchQuery);
      setSearchResults(results);
      if (results.length === 0) {
        toast.error('ไม่พบนักเรียน กรุณาตรวจสอบรหัสนักเรียนหรือชื่ออีกครั้ง');
      }
    } catch (err) {
      console.error(err);
      toast.error('เกิดข้อผิดพลาดในการค้นหา');
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
      toast.warning('กรุณาเลือกรายการที่ต้องการชำระ');
      return;
    }
    setStep(3);
  };

  // Step 3: Payment Method
  const confirmPayment = async () => {
    if (!selectedStudent || selectedFeeIds.size === 0) return;
    
    setIsProcessing(true);
    const loadingToast = toast.loading('กำลังประมวลผลการชำระเงิน...');
    
    try {
      // Create payment in DB (atomic receipt generation)
      // Assuming academic_year is 2568 for this session based on prompt
      const result = await createTuitionPayment(
        selectedStudent.id,
        Array.from(selectedFeeIds),
        paymentMethod,
        totalAmount,
        '2568'
      );
      
      setReceiptData({
        id: result.payment_id,
        number: result.receipt_number,
        date: new Date()
      });

      // Call SVPortal sync stub (fire and forget)
      syncPaymentToSVPortal(result.payment_id).catch(console.error);

      setStep(4);
      toast.success('รับชำระเงินสำเร็จ!', { id: loadingToast });
      
      // Delay to ensure the receipt component is rendered before capturing
      setTimeout(() => captureAndUploadReceipt(result.payment_id, result.receipt_number), 500);

    } catch (err: any) {
      console.error('Payment Error:', err);
      toast.error(err.message || 'เกิดข้อผิดพลาดในการชำระเงิน', { id: loadingToast });
    } finally {
      setIsProcessing(false);
    }
  };

  const captureAndUploadReceipt = async (paymentId: string, receiptNumber: string) => {
    if (!receiptRef.current) return;
    
    try {
      // Temporarily remove hidden class if it has it for capture
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
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-primary tracking-tight">รับชำระค่าธรรมเนียม</h1>
            <p className="text-foreground/60 font-medium">ระบบรับชำระเงินค่าเทอมและค่าธรรมเนียมต่างๆ</p>
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center mb-10 max-w-3xl mx-auto">
          {[
            { s: 1, label: 'ค้นหา' },
            { s: 2, label: 'เลือกรายการ' },
            { s: 3, label: 'ชำระเงิน' },
            { s: 4, label: 'เสร็จสิ้น' }
          ].map(({ s, label }) => (
            <div key={s} className="flex items-center flex-1 last:flex-none relative">
              <div className="flex flex-col items-center gap-2 relative z-10 w-full">
                <motion.div 
                  initial={false}
                  animate={{ 
                    scale: step === s ? 1.2 : 1,
                    backgroundColor: step === s ? 'var(--primary)' : step > s ? 'var(--secondary)' : 'var(--foreground-10)',
                    color: step >= s ? '#fff' : 'var(--foreground-50)'
                  }}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm transition-colors duration-300"
                >
                  {step > s ? <CheckCircle2 className="w-5 h-5" /> : s}
                </motion.div>
                <span className={`text-xs font-bold whitespace-nowrap absolute -bottom-6 ${step === s ? 'text-primary' : step > s ? 'text-secondary' : 'text-foreground/40'}`}>
                  {label}
                </span>
              </div>
              {s < 4 && (
                <div className="absolute top-5 left-1/2 w-full h-1 -z-0">
                  <div className="w-full h-full bg-foreground/10 rounded-full">
                    <motion.div 
                      className="h-full bg-secondary rounded-full"
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
                className="bg-surface p-8 md:p-12 rounded-3xl shadow-xl border border-white/20 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                <div className="text-center mb-8 relative z-10">
                  <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-extrabold text-foreground mb-2">ค้นหานักเรียน</h2>
                  <p className="text-foreground/60 font-medium">กรอกรหัสนักเรียนหรือชื่อเพื่อเริ่มการรับชำระ</p>
                </div>

                <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 max-w-2xl mx-auto mb-10 relative z-10">
                  <div className="flex-1 relative group">
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="รหัสนักเรียน หรือ ชื่อ-นามสกุล..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-14 pr-4 py-4 border-2 border-transparent bg-background shadow-inner rounded-2xl focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-xl font-medium text-foreground placeholder:text-foreground/40 transition-all"
                    />
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-foreground/40 group-focus-within:text-primary transition-colors" />
                  </div>
                  <button 
                    type="submit"
                    disabled={isSearching || !searchQuery.trim()}
                    className="px-10 py-4 bg-primary text-white font-black text-lg rounded-2xl shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
                  >
                    {isSearching ? 'กำลังค้นหา...' : 'ค้นหา'}
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
                        className="flex justify-between items-center p-6 bg-background rounded-2xl border-2 border-transparent hover:border-primary/50 shadow-sm hover:shadow-md cursor-pointer transition-all group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                            <User className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="font-extrabold text-xl text-primary">{student.name}</h3>
                            <p className="text-foreground/50 font-bold text-sm tracking-wider">ID: {student.id} <span className="mx-2">•</span> ชั้น: {student.grade || '-'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          {student.unpaid_fees.length > 0 ? (
                            <span className="text-secondary font-black bg-secondary/10 px-4 py-2 rounded-xl text-sm border border-secondary/20 shadow-sm">
                              ค้างชำระ {student.unpaid_fees.length} รายการ
                            </span>
                          ) : (
                            <span className="text-green-600 font-black bg-green-50 px-4 py-2 rounded-xl text-sm border border-green-200">
                              ไม่มียอดค้างชำระ
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
                className="bg-surface p-8 md:p-10 rounded-3xl shadow-xl border border-white/20"
              >
                <div className="flex justify-between items-center mb-8 pb-6 border-b border-foreground/5">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                      <User className="w-7 h-7" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-extrabold text-primary">{selectedStudent.name}</h2>
                      <p className="text-foreground/50 font-bold tracking-wider">รหัส {selectedStudent.id} • {selectedStudent.grade}</p>
                    </div>
                  </div>
                  <button onClick={() => setStep(1)} className="text-foreground/50 hover:text-primary font-bold flex items-center gap-2 transition-colors px-4 py-2 hover:bg-background rounded-xl">
                    <ChevronLeft className="w-5 h-5" /> เปลี่ยนนักเรียน
                  </button>
                </div>

                {selectedStudent.unpaid_fees.length === 0 ? (
                  <div className="text-center py-16 bg-background rounded-2xl border border-foreground/5">
                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                      <CheckCircle2 className="w-12 h-12" />
                    </div>
                    <h3 className="text-2xl font-extrabold text-foreground">ไม่มีรายการค้างชำระ</h3>
                    <p className="text-foreground/50 mt-2">นักเรียนรายนี้ชำระค่าธรรมเนียมครบถ้วนแล้ว</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4 mb-10">
                      <h3 className="font-bold text-lg text-foreground/70 uppercase tracking-widest mb-4">รายการค้างชำระ</h3>
                      {selectedStudent.unpaid_fees.map((fee) => {
                        const isOverdue = fee.fee_type?.due_date && new Date(fee.fee_type.due_date) < new Date();
                        const isSelected = selectedFeeIds.has(fee.id);
                        return (
                          <label 
                            key={fee.id}
                            className={`flex items-center justify-between p-6 border-2 rounded-2xl cursor-pointer transition-all
                              ${isSelected ? 'border-primary bg-primary/5 shadow-md shadow-primary/5' : 'border-foreground/10 bg-background hover:border-primary/30'}
                              ${isOverdue && !isSelected ? 'bg-secondary/5 border-secondary/20' : ''}
                            `}
                          >
                            <div className="flex items-center gap-6">
                              <div className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${isSelected ? 'bg-primary text-white' : 'bg-surface border-2 border-foreground/20'}`}>
                                {isSelected && <CheckCircle2 className="w-4 h-4" />}
                              </div>
                              <div>
                                <p className="font-extrabold text-xl text-foreground mb-1">{fee.fee_type?.name || 'ค่าธรรมเนียม'}</p>
                                <p className="text-sm font-medium text-foreground/50">
                                  กำหนดชำระ: {fee.fee_type?.due_date ? new Intl.DateTimeFormat('th-TH').format(new Date(fee.fee_type.due_date)) : '-'}
                                  {isOverdue && <span className="text-secondary font-bold ml-3 bg-secondary/10 px-2 py-0.5 rounded-md text-xs">เกินกำหนด</span>}
                                </p>
                              </div>
                            </div>
                            <div className={`font-black text-2xl ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                              ฿{Number(fee.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </div>
                          </label>
                        );
                      })}
                    </div>

                    <div className="flex flex-col md:flex-row justify-between items-center p-6 bg-background rounded-2xl border border-foreground/5 shadow-inner">
                      <div className="text-foreground/60 font-bold mb-4 md:mb-0">
                        เลือกแล้ว <span className="text-primary text-xl mx-1">{selectedFeeIds.size}</span> รายการ
                      </div>
                      <div className="flex items-center gap-8">
                        <div className="text-right">
                          <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest mb-1">ยอดรวมที่ต้องชำระ</p>
                          <div className="text-4xl font-black text-primary tracking-tight">
                            ฿{totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                        <button 
                          onClick={proceedToPayment}
                          disabled={selectedFeeIds.size === 0}
                          className="px-8 py-4 bg-primary text-white font-black text-lg rounded-2xl shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 flex items-center gap-2"
                        >
                          ดำเนินการชำระเงิน <ChevronRight className="w-6 h-6" />
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
                className="bg-surface p-8 md:p-10 rounded-3xl shadow-xl border border-white/20 max-w-3xl mx-auto"
              >
                <div className="flex justify-between items-center mb-8 pb-6 border-b border-foreground/5">
                  <h2 className="text-2xl font-extrabold text-primary flex items-center gap-3">
                    <CreditCard className="w-7 h-7" /> เลือกวิธีชำระเงิน
                  </h2>
                  <button onClick={() => setStep(2)} className="text-foreground/50 hover:text-primary font-bold flex items-center gap-2 transition-colors px-4 py-2 hover:bg-background rounded-xl">
                    <ChevronLeft className="w-5 h-5" /> กลับ
                  </button>
                </div>

                <div className="text-center mb-10 bg-primary/5 p-8 rounded-3xl border border-primary/10">
                  <p className="text-primary/70 font-bold uppercase tracking-widest text-sm mb-2">ยอดที่ต้องชำระ</p>
                  <h3 className="text-6xl font-black text-primary tracking-tight mb-2">
                    ฿{totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </h3>
                  <p className="text-sm font-bold text-foreground/50">สำหรับนักเรียน: {selectedStudent.name}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                  {/* Cash */}
                  <label className={`
                    flex flex-col items-center justify-center p-8 border-2 rounded-3xl cursor-pointer transition-all relative overflow-hidden
                    ${paymentMethod === 'cash' ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10 text-primary' : 'border-foreground/10 hover:border-primary/30 text-foreground/60 bg-background hover:bg-surface'}
                  `}>
                    <input 
                      type="radio" name="payment" value="cash" className="hidden"
                      checked={paymentMethod === 'cash'} onChange={() => setPaymentMethod('cash')} 
                    />
                    <Banknote className={`w-12 h-12 mb-4 ${paymentMethod === 'cash' ? 'text-primary' : 'text-foreground/40'}`} />
                    <div className="font-extrabold text-lg">เงินสด</div>
                    {paymentMethod === 'cash' && <div className="absolute top-4 right-4"><CheckCircle2 className="w-6 h-6 text-primary"/></div>}
                  </label>

                  {/* QR */}
                  <label className={`
                    flex flex-col items-center justify-center p-8 border-2 rounded-3xl cursor-pointer transition-all relative overflow-hidden
                    ${paymentMethod === 'qr' ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10 text-primary' : 'border-foreground/10 hover:border-primary/30 text-foreground/60 bg-background hover:bg-surface'}
                  `}>
                    <input 
                      type="radio" name="payment" value="qr" className="hidden"
                      checked={paymentMethod === 'qr'} onChange={() => setPaymentMethod('qr')} 
                    />
                    <QrCode className={`w-12 h-12 mb-4 ${paymentMethod === 'qr' ? 'text-primary' : 'text-foreground/40'}`} />
                    <div className="font-extrabold text-lg">สแกน QR Code</div>
                    {paymentMethod === 'qr' && <div className="absolute top-4 right-4"><CheckCircle2 className="w-6 h-6 text-primary"/></div>}
                  </label>

                  {/* Transfer */}
                  <label className={`
                    flex flex-col items-center justify-center p-8 border-2 rounded-3xl cursor-pointer transition-all relative overflow-hidden
                    ${paymentMethod === 'transfer' ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10 text-primary' : 'border-foreground/10 hover:border-primary/30 text-foreground/60 bg-background hover:bg-surface'}
                  `}>
                    <input 
                      type="radio" name="payment" value="transfer" className="hidden"
                      checked={paymentMethod === 'transfer'} onChange={() => setPaymentMethod('transfer')} 
                    />
                    <Building2 className={`w-12 h-12 mb-4 ${paymentMethod === 'transfer' ? 'text-primary' : 'text-foreground/40'}`} />
                    <div className="font-extrabold text-lg">โอนธนาคาร</div>
                    {paymentMethod === 'transfer' && <div className="absolute top-4 right-4"><CheckCircle2 className="w-6 h-6 text-primary"/></div>}
                  </label>
                </div>

                {/* Payment Method Details */}
                <AnimatePresence mode="wait">
                  {paymentMethod === 'qr' && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-background p-8 rounded-2xl text-center mb-10 border border-foreground/5 shadow-inner overflow-hidden"
                    >
                      <div className="w-48 h-48 bg-white border-4 border-foreground/10 mx-auto flex items-center justify-center text-foreground/30 mb-4 rounded-xl">
                        <QrCode className="w-24 h-24 opacity-20" />
                      </div>
                      <p className="text-sm font-bold text-foreground/60">ให้ผู้ปกครองสแกน QR Code ด้านบนเพื่อชำระเงิน</p>
                    </motion.div>
                  )}

                  {paymentMethod === 'transfer' && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-background p-8 rounded-2xl text-center mb-10 border border-foreground/5 shadow-inner overflow-hidden"
                    >
                      <p className="text-sm font-bold text-foreground/50 uppercase tracking-widest mb-3">บัญชีรับโอนของโรงเรียน</p>
                      <div className="text-4xl font-black tracking-wider text-primary mb-2">
                        {process.env.NEXT_PUBLIC_SCHOOL_BANK_ACCOUNT || '123-4-56789-0'}
                      </div>
                      <p className="font-bold text-lg text-foreground/80">ชื่อบัญชี: โรงเรียนสมคิดวิทยา</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button 
                  onClick={confirmPayment}
                  disabled={isProcessing}
                  className="w-full py-5 bg-primary text-white font-black text-xl rounded-2xl shadow-xl shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                  {isProcessing ? (
                    <><div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" /> กำลังประมวลผล...</>
                  ) : (
                    <><CheckCircle2 className="w-6 h-6" /> ยืนยันรับชำระเงิน</>
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
                <div className="bg-green-500 p-12 rounded-[3rem] mb-8 shadow-2xl shadow-green-500/20 text-white relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', bounce: 0.5 }}
                    className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner"
                  >
                    <CheckCircle2 className="w-16 h-16 text-green-500" />
                  </motion.div>
                  <h2 className="text-4xl font-black mb-3">ชำระเงินสำเร็จ</h2>
                  <p className="text-xl font-medium text-green-50">เลขที่ใบเสร็จ: <span className="font-mono bg-black/10 px-3 py-1 rounded-lg ml-2">{receiptData.number}</span></p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button 
                    onClick={handlePrint}
                    className="px-8 py-4 bg-primary text-white font-black text-lg rounded-2xl hover:bg-primary/90 flex items-center justify-center gap-3 shadow-lg shadow-primary/20 transition-all active:scale-95"
                  >
                    <Printer className="w-6 h-6" /> พิมพ์ใบเสร็จ
                  </button>
                  <button 
                    onClick={resetFlow}
                    className="px-8 py-4 bg-surface text-foreground border-2 border-foreground/10 font-bold text-lg rounded-2xl hover:bg-background/50 transition-all active:scale-95"
                  >
                    รับชำระรายถัดไป
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
