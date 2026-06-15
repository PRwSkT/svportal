'use client';

import { useState, useRef, useEffect } from 'react';
import { searchStudentsWithFees, createTuitionPayment, syncPaymentToSVPortal, StudentWithFees } from '@/lib/supabase/fees';
import { FeeItem } from '@/types';
import { ReceiptPrint } from '@/components/ReceiptPrint';
import html2canvas from 'html2canvas';

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
  const [error, setError] = useState<string | null>(null);

  const receiptRef = useRef<HTMLDivElement>(null);

  // Step 1: Search
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError(null);
    try {
      const results = await searchStudentsWithFees(searchQuery);
      setSearchResults(results);
      if (results.length === 0) {
        setError('ไม่พบนักเรียน กรุณาตรวจสอบรหัสนักเรียนหรือชื่ออีกครั้ง');
      }
    } catch (err) {
      console.error(err);
      setError('เกิดข้อผิดพลาดในการค้นหา');
    } finally {
      setIsSearching(false);
    }
  };

  const selectStudent = (student: StudentWithFees) => {
    setSelectedStudent(student);
    // Auto-select all unpaid fees
    setSelectedFeeIds(new Set(student.unpaid_fees.map(f => f.id)));
    setStep(2);
    setError(null);
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
      setError('กรุณาเลือกรายการที่ต้องการชำระ');
      return;
    }
    setError(null);
    setStep(3);
  };

  // Step 3: Payment Method
  const confirmPayment = async () => {
    if (!selectedStudent || selectedFeeIds.size === 0) return;
    
    setIsProcessing(true);
    setError(null);
    
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
      
      // Delay to ensure the receipt component is rendered before capturing
      setTimeout(() => captureAndUploadReceipt(result.payment_id, result.receipt_number), 500);

    } catch (err: any) {
      console.error('Payment Error:', err);
      setError(err.message || 'เกิดข้อผิดพลาดในการชำระเงิน');
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
    setError(null);
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto print:p-0">
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
      <div className="print:hidden">
        {/* Progress Indicator */}
        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                ${step === s ? 'bg-primary text-white' : 
                  step > s ? 'bg-secondary text-white' : 'bg-foreground/10 text-foreground/50'}`}
              >
                {step > s ? '✓' : s}
              </div>
              {s < 4 && (
                <div className={`w-12 md:w-24 h-1 ${step > s ? 'bg-secondary' : 'bg-foreground/10'}`} />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-secondary/10 text-secondary rounded-lg border border-secondary/20 text-center">
            {error}
          </div>
        )}

        {/* STEP 1 */}
        {step === 1 && (
          <div className="bg-surface p-6 md:p-10 rounded-xl shadow-sm border border-foreground/5">
            <h2 className="text-2xl font-bold mb-6 text-center text-primary">ค้นหานักเรียน</h2>
            <form onSubmit={handleSearch} className="flex gap-4 max-w-xl mx-auto mb-8">
              <input
                type="text"
                placeholder="พิมพ์รหัสนักเรียน หรือ ชื่อ-นามสกุล..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-4 py-3 border border-foreground/20 rounded-lg focus:ring-2 focus:ring-primary outline-none text-lg bg-surface text-foreground"
                autoFocus
              />
              <button 
                type="submit"
                disabled={isSearching}
                className="px-8 py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {isSearching ? 'ค้นหา...' : 'ค้นหา'}
              </button>
            </form>

            {searchResults.length > 0 && (
              <div className="grid gap-4 max-w-3xl mx-auto">
                {searchResults.map(student => (
                  <div 
                    key={student.id}
                    onClick={() => selectStudent(student)}
                    className="flex justify-between items-center p-4 border border-foreground/10 rounded-lg hover:border-primary hover:bg-background/50 cursor-pointer transition-colors"
                  >
                    <div>
                      <h3 className="font-bold text-lg text-primary">{student.name}</h3>
                      <p className="text-foreground/70 text-sm">รหัส: {student.id} | ชั้น: {student.grade || '-'}</p>
                    </div>
                    <div className="text-right">
                      {student.unpaid_fees.length > 0 ? (
                        <span className="text-secondary font-medium bg-secondary/10 px-3 py-1 rounded-full text-sm">
                          ค้างชำระ {student.unpaid_fees.length} รายการ
                        </span>
                      ) : (
                        <span className="text-primary font-medium bg-primary/10 px-3 py-1 rounded-full text-sm">
                          ไม่มียอดค้างชำระ
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && selectedStudent && (
          <div className="bg-surface p-6 md:p-8 rounded-xl shadow-sm border border-foreground/5">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-foreground/5">
              <div>
                <h2 className="text-xl font-bold text-primary">รายการค้างชำระ</h2>
                <p className="text-foreground/70">{selectedStudent.name} (รหัส {selectedStudent.id})</p>
              </div>
              <button onClick={() => setStep(1)} className="text-foreground/50 hover:text-primary">
                &larr; กลับไปค้นหา
              </button>
            </div>

            {selectedStudent.unpaid_fees.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-green-500 text-5xl mb-4">✓</div>
                <h3 className="text-xl font-bold text-gray-700">ไม่มีรายการค้างชำระ</h3>
              </div>
            ) : (
              <>
                <div className="space-y-3 mb-8">
                  {selectedStudent.unpaid_fees.map((fee) => {
                    const isOverdue = fee.fee_type?.due_date && new Date(fee.fee_type.due_date) < new Date();
                    return (
                      <label 
                        key={fee.id}
                        className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors
                          ${selectedFeeIds.has(fee.id) ? 'border-primary bg-background/50' : 'border-foreground/10'}
                          ${isOverdue ? 'bg-secondary/5 border-secondary/20' : ''}
                        `}
                      >
                        <div className="flex items-center gap-4">
                          <input 
                            type="checkbox"
                            checked={selectedFeeIds.has(fee.id)}
                            onChange={() => toggleFee(fee.id)}
                            className="w-5 h-5 text-primary rounded"
                          />
                          <div>
                            <p className="font-bold text-primary">{fee.fee_type?.name || 'ค่าธรรมเนียม'}</p>
                            <p className="text-sm text-foreground/70">
                              กำหนดชำระ: {fee.fee_type?.due_date ? new Intl.DateTimeFormat('th-TH').format(new Date(fee.fee_type.due_date)) : '-'}
                              {isOverdue && <span className="text-secondary ml-2">(เกินกำหนด)</span>}
                            </p>
                          </div>
                        </div>
                        <div className="font-bold text-lg text-primary">
                          {Number(fee.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                      </label>
                    );
                  })}
                </div>

                <div className="flex justify-between items-center pt-6 border-t border-foreground/10">
                  <div className="text-foreground/70">
                    เลือกแล้ว {selectedFeeIds.size} รายการ
                  </div>
                  <div className="text-right flex items-center gap-6">
                    <div className="text-2xl font-bold text-primary">
                      รวม: {totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} บาท
                    </div>
                    <button 
                      onClick={proceedToPayment}
                      disabled={selectedFeeIds.size === 0}
                      className="px-8 py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 disabled:opacity-50"
                    >
                      ดำเนินการชำระเงิน &rarr;
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && selectedStudent && (
          <div className="bg-surface p-6 md:p-8 rounded-xl shadow-sm border border-foreground/5 max-w-3xl mx-auto">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-foreground/5">
              <h2 className="text-xl font-bold text-primary">เลือกวิธีชำระเงิน</h2>
              <button onClick={() => setStep(2)} className="text-foreground/50 hover:text-primary">
                &larr; กลับไปเลือกรายการ
              </button>
            </div>

            <div className="text-center mb-8">
              <p className="text-foreground/70">ยอดที่ต้องชำระ</p>
              <h3 className="text-4xl font-bold text-primary my-2">
                {totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} บาท
              </h3>
              <p className="text-sm text-foreground/50">สำหรับ {selectedStudent.name}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {/* Cash */}
              <label className={`
                flex flex-col items-center justify-center p-6 border-2 rounded-xl cursor-pointer transition-all
                ${paymentMethod === 'cash' ? 'border-primary bg-background/50' : 'border-foreground/10 hover:border-primary/50'}
              `}>
                <input 
                  type="radio" name="payment" value="cash" className="hidden"
                  checked={paymentMethod === 'cash'} onChange={() => setPaymentMethod('cash')} 
                />
                <div className="text-4xl mb-3">💵</div>
                <div className="font-bold text-lg text-primary">เงินสด</div>
              </label>

              {/* QR */}
              <label className={`
                flex flex-col items-center justify-center p-6 border-2 rounded-xl cursor-pointer transition-all
                ${paymentMethod === 'qr' ? 'border-primary bg-background/50' : 'border-foreground/10 hover:border-primary/50'}
              `}>
                <input 
                  type="radio" name="payment" value="qr" className="hidden"
                  checked={paymentMethod === 'qr'} onChange={() => setPaymentMethod('qr')} 
                />
                <div className="text-4xl mb-3">📱</div>
                <div className="font-bold text-lg text-primary">สแกน QR Code</div>
              </label>

              {/* Transfer */}
              <label className={`
                flex flex-col items-center justify-center p-6 border-2 rounded-xl cursor-pointer transition-all
                ${paymentMethod === 'transfer' ? 'border-primary bg-background/50' : 'border-foreground/10 hover:border-primary/50'}
              `}>
                <input 
                  type="radio" name="payment" value="transfer" className="hidden"
                  checked={paymentMethod === 'transfer'} onChange={() => setPaymentMethod('transfer')} 
                />
                <div className="text-4xl mb-3">🏦</div>
                <div className="font-bold text-lg text-primary">โอนธนาคาร</div>
              </label>
            </div>

            {/* Payment Method Details */}
            {paymentMethod === 'qr' && (
              <div className="bg-background/50 p-6 rounded-lg text-center mb-8 border border-foreground/5">
                <div className="w-48 h-48 bg-surface border-4 border-foreground/10 mx-auto flex items-center justify-center text-foreground/40 mb-4 rounded-lg">
                  [ QR Code Placeholder ]
                </div>
                <p className="text-sm text-foreground/70">ให้ผู้ปกครองสแกน QR Code ด้านบนเพื่อชำระเงิน</p>
              </div>
            )}

            {paymentMethod === 'transfer' && (
              <div className="bg-background/50 p-6 rounded-lg text-center mb-8 border border-foreground/5">
                <p className="text-sm text-foreground/70 mb-2">บัญชีรับโอนของโรงเรียน</p>
                <div className="text-2xl font-bold tracking-wider text-primary mb-1">
                  {process.env.NEXT_PUBLIC_SCHOOL_BANK_ACCOUNT || '123-4-56789-0 (ธนาคารตัวอย่าง)'}
                </div>
                <p className="font-medium text-primary">ชื่อบัญชี: โรงเรียนสมคิดวิทยา</p>
              </div>
            )}

            <button 
              onClick={confirmPayment}
              disabled={isProcessing}
              className="w-full py-4 bg-primary text-white font-bold text-xl rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isProcessing ? 'กำลังประมวลผล...' : 'ยืนยันรับชำระเงิน'}
            </button>
          </div>
        )}

        {/* STEP 4 */}
        {step === 4 && receiptData && (
          <div className="text-center max-w-2xl mx-auto">
            <div className="bg-primary/10 text-primary p-8 rounded-2xl mb-8 border border-primary/20">
              <div className="text-6xl mb-4">✅</div>
              <h2 className="text-3xl font-bold mb-2 text-primary">ชำระเงินสำเร็จ</h2>
              <p className="text-lg text-primary">เลขที่ใบเสร็จ: {receiptData.number}</p>
            </div>

            <div className="flex gap-4 justify-center">
              <button 
                onClick={handlePrint}
                className="px-8 py-4 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 flex items-center gap-2"
              >
                🖨️ พิมพ์ใบเสร็จ
              </button>
              <button 
                onClick={resetFlow}
                className="px-8 py-4 bg-surface text-foreground border-2 border-foreground/10 font-bold rounded-xl hover:bg-background/50"
              >
                รับชำระรายถัดไป
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
