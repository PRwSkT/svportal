'use client';

import { useState, useEffect, useCallback } from 'react';
import { WalletAccount } from '@/types';
import {
  getWalletByStudentId,
  getWalletByCardUID,
  topupWallet,
  getTodaySpend,
} from '@/lib/supabase/wallet';
import type { WalletTransaction } from '@/types';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Search, CheckCircle2, ChevronRight, CreditCard, RotateCcw, ArrowRight } from 'lucide-react';

type Step = 'identify' | 'amount' | 'confirm' | 'success';

export default function TopupPage() {
  const [step, setStep] = useState<Step>('identify');
  const [wallet, setWallet] = useState<WalletAccount | null>(null);
  const [studentName, setStudentName] = useState('');
  const [todaySpend, setTodaySpend] = useState(0);
  const [amount, setAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [transaction, setTransaction] = useState<WalletTransaction | null>(null);
  const [countdown, setCountdown] = useState(5);

  // NFC / Manual input
  const [inputValue, setInputValue] = useState('');
  const [searching, setSearching] = useState(false);
  const [nfcMode] = useState<'hid' | 'serial' | 'manual'>('manual');

  // Auto-reset after success
  useEffect(() => {
    if (step !== 'success') return;
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleReset();
          return 5;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [step]);

  // HID keyboard listener for NFC card scan
  useEffect(() => {
    if (step !== 'identify') return;

    let buffer = '';
    let timeout: NodeJS.Timeout | null = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only capture when not focused on an input
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'Enter' && buffer.length > 0) {
        e.preventDefault();
        handleCardScan(buffer.trim().toUpperCase());
        buffer = '';
        return;
      }

      if (e.key.length === 1) {
        buffer += e.key;
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => { buffer = ''; }, 300);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeout) clearTimeout(timeout);
    };
  }, [step]);

  const handleCardScan = useCallback(async (uid: string) => {
    setSearching(true);
    const loadingToast = toast.loading('กำลังตรวจสอบข้อมูลบัตร...');
    try {
      const w = await getWalletByCardUID(uid);
      if (w) {
        await loadStudentInfo(w, loadingToast);
      } else {
        toast.error('ไม่พบบัตรในระบบ', { id: loadingToast, description: 'กรุณาลองกรอกรหัสนักเรียนด้วยตนเอง' });
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการค้นหา', { id: loadingToast });
    } finally {
      setSearching(false);
    }
  }, []);

  async function loadStudentInfo(w: WalletAccount, toastId?: string | number) {
    setWallet(w);
    // Fetch student name
    let name = 'ไม่พบชื่อ';
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data } = await supabase
        .from('students')
        .select('name')
        .eq('id', w.student_id)
        .single();
      if (data?.name) name = data.name;
      setStudentName(name);

      const spend = await getTodaySpend(w.student_id);
      setTodaySpend(spend);
      
      if (toastId) toast.success(`พบข้อมูลนักเรียน: ${name}`, { id: toastId });
    } catch {
      setStudentName(name);
      if (toastId) toast.success(`พบข้อมูลนักเรียน: ${name}`, { id: toastId });
    }
    setStep('amount');
  }

  async function handleSearch() {
    if (!inputValue.trim()) return;
    setSearching(true);
    const loadingToast = toast.loading('กำลังค้นหาข้อมูล...');
    try {
      // Check if it's a card UID (hex) or student ID (numeric)
      const isStudentId = /^\d{4,5}$/.test(inputValue.trim());

      let w: WalletAccount | null = null;
      if (isStudentId) {
        w = await getWalletByStudentId(inputValue.trim());
      } else {
        w = await getWalletByCardUID(inputValue.trim());
      }

      if (!w) {
        toast.error(isStudentId ? `ไม่พบนักเรียนรหัส ${inputValue}` : `ไม่พบบัตร UID ${inputValue}`, { id: loadingToast });
        return;
      }

      if (!w.is_active) {
        toast.error('Wallet ถูกระงับการใช้งาน', { id: loadingToast });
        return;
      }

      await loadStudentInfo(w, loadingToast);
    } catch {
      toast.error('เกิดข้อผิดพลาดในการค้นหา', { id: loadingToast });
    } finally {
      setSearching(false);
    }
  }

  async function handleConfirmTopup() {
    if (!wallet) return;
    const topupAmount = parseFloat(amount);
    if (isNaN(topupAmount) || topupAmount < 20) {
      toast.error('จำนวนเงินขั้นต่ำ 20 บาท');
      return;
    }

    setProcessing(true);
    const loadingToast = toast.loading('กำลังประมวลผลการเติมเงิน...');
    try {
      const tx = await topupWallet(wallet.student_id, topupAmount, 'counter');
      setTransaction(tx);
      setStep('success');
      setCountdown(5);
      toast.success('เติมเงินสำเร็จ!', { id: loadingToast });
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      toast.error('เติมเงินไม่สำเร็จ', { id: loadingToast, description: e.message });
    } finally {
      setProcessing(false);
    }
  }

  function handleReset() {
    setStep('identify');
    setWallet(null);
    setStudentName('');
    setTodaySpend(0);
    setAmount('');
    setTransaction(null);
    setInputValue('');
    setCountdown(5);
  }

  const quickAmounts = [50, 100, 200, 500];

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden font-sans relative">
      {/* Background Element */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-secondary/5 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3 pointer-events-none"></div>

      {/* Header */}
      <div className="bg-surface/80 backdrop-blur-xl border-b border-white/20 shadow-sm px-8 py-5 flex justify-between items-center z-10">
        <h1 className="text-2xl font-extrabold text-primary flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-xl"><Wallet className="w-6 h-6" /></div>
          เติมเงิน Wallet นักเรียน
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-xs font-bold bg-foreground/5 text-foreground/50 px-4 py-1.5 rounded-full shadow-inner uppercase tracking-wider">
            Mode: {nfcMode === 'hid' ? 'HID' : nfcMode === 'serial' ? 'Serial' : 'Manual'}
          </span>
          {step !== 'identify' && (
            <button onClick={handleReset} className="text-sm font-bold text-primary hover:text-primary/70 transition-colors flex items-center gap-1">
              <RotateCcw className="w-4 h-4" /> เริ่มใหม่
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-8 z-10 overflow-y-auto">
        <div className="w-full max-w-xl">
          <AnimatePresence mode="wait">
            {/* STEP 1: Identify Student */}
            {step === 'identify' && (
              <motion.div 
                key="identify"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                className="bg-surface/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl p-12 text-center border border-white/20 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                
                <div className="relative z-10 mb-8">
                  <div className="w-32 h-32 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                    <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse"></div>
                    <CreditCard className="w-16 h-16 text-primary relative z-10" />
                  </div>
                  <h2 className="text-3xl font-black text-primary mb-3 tracking-tight">แตะบัตรนักเรียน</h2>
                  <p className="text-foreground/50 font-bold tracking-wide">หรือกรอกรหัสนักเรียนด้วยตนเอง</p>
                </div>

                <div className="flex gap-4 relative z-10">
                  <div className="flex-1 relative group">
                    <input
                      type="text"
                      value={inputValue}
                      onChange={e => setInputValue(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSearch()}
                      placeholder="รหัส หรือ UID..."
                      className="w-full px-6 py-5 pl-14 border-2 border-transparent rounded-2xl text-xl font-bold focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none bg-background shadow-inner text-foreground placeholder:text-foreground/30 transition-all uppercase tracking-wider"
                      autoFocus
                    />
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-foreground/30 group-focus-within:text-primary transition-colors" />
                  </div>
                  <button
                    onClick={handleSearch}
                    disabled={searching || !inputValue.trim()}
                    className="px-8 py-5 bg-primary text-white rounded-2xl font-black text-xl hover:bg-primary/90 disabled:opacity-50 shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center gap-2"
                  >
                    {searching ? <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div> : 'ค้นหา'}
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 2: Enter Amount */}
            {step === 'amount' && wallet && (
              <motion.div 
                key="amount"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                className="bg-surface/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl p-10 border border-white/20"
              >
                {/* Student Info */}
                <div className="text-center mb-8 pb-8 border-b border-foreground/5 relative">
                  <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest mb-2">ข้อมูลนักเรียน</p>
                  <h2 className="text-3xl font-black text-primary mb-1">{studentName}</h2>
                  <p className="text-sm font-bold text-foreground/50 tracking-widest mb-4">ID: {wallet.student_id}</p>
                  
                  <div className={`inline-flex flex-col items-center px-8 py-4 rounded-3xl border-2 ${wallet.balance < 100 ? 'bg-secondary/5 border-secondary/20 text-secondary' : 'bg-primary/5 border-primary/20 text-primary'}`}>
                    <span className="text-xs font-bold uppercase tracking-widest opacity-70 mb-1">ยอดเงินคงเหลือ</span>
                    <span className="text-4xl font-black">฿{wallet.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                  
                  {wallet.daily_limit !== null && (
                    <div className="mt-4 flex flex-col items-center max-w-xs mx-auto">
                      <div className="flex justify-between w-full text-xs font-bold text-foreground/50 mb-2 uppercase tracking-widest">
                        <span>ใช้ไปแล้ว ฿{todaySpend.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        <span>วงเงิน ฿{wallet.daily_limit.toLocaleString('en-US')}</span>
                      </div>
                      <div className="w-full h-2 bg-foreground/5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${todaySpend >= wallet.daily_limit ? 'bg-secondary' : 'bg-primary'}`}
                          style={{ width: `${Math.min(100, (todaySpend / wallet.daily_limit) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Amount Input */}
                <div className="mb-8 relative">
                  <label className="block text-sm font-bold text-foreground/50 uppercase tracking-widest mb-3 text-center">ระบุจำนวนเงินที่ต้องการเติม</label>
                  <div className="relative max-w-sm mx-auto">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-3xl font-black text-primary/40 pointer-events-none">฿</span>
                    <input
                      type="number"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      min="20"
                      step="10"
                      placeholder="0.00"
                      className="w-full px-6 py-6 pl-16 border-2 border-transparent rounded-3xl text-5xl font-black text-center focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none bg-background shadow-inner text-primary placeholder:text-foreground/20 transition-all"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Quick Amounts */}
                <div className="grid grid-cols-4 gap-4 mb-10">
                  {quickAmounts.map(qa => (
                    <button
                      key={qa}
                      onClick={() => setAmount(qa.toString())}
                      className={`py-4 rounded-2xl font-black text-xl transition-all active:scale-95 border-2
                        ${amount === qa.toString() ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-background text-foreground/70 border-transparent hover:border-primary/30 hover:text-primary shadow-sm'}`}
                    >
                      {qa}
                    </button>
                  ))}
                </div>

                <div className="flex gap-4">
                  <button onClick={handleReset} className="flex-1 py-5 bg-surface border-2 border-foreground/10 text-foreground/60 rounded-2xl font-bold text-lg hover:bg-background transition-colors">
                    ยกเลิก
                  </button>
                  <button
                    onClick={() => {
                      const a = parseFloat(amount);
                      if (isNaN(a) || a < 20) {
                        toast.warning('กรุณากรอกจำนวนเงินขั้นต่ำ 20 บาท');
                        return;
                      }
                      setStep('confirm');
                    }}
                    className="flex-[2] py-5 bg-primary text-white rounded-2xl font-black text-xl hover:bg-primary/90 shadow-xl shadow-primary/20 transition-all active:scale-95 flex justify-center items-center gap-2"
                  >
                    ดำเนินการต่อ <ArrowRight className="w-6 h-6" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 3: Confirm */}
            {step === 'confirm' && wallet && (
              <motion.div 
                key="confirm"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                className="bg-surface/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl p-10 text-center border border-white/20"
              >
                <h2 className="text-3xl font-black text-primary mb-8 tracking-tight">ยืนยันการเติมเงิน</h2>

                <div className="bg-background rounded-3xl p-8 mb-10 space-y-5 border border-foreground/5 shadow-inner">
                  <div className="flex justify-between items-center pb-5 border-b border-foreground/5">
                    <span className="text-sm font-bold text-foreground/50 uppercase tracking-widest">นักเรียน</span>
                    <div className="text-right">
                      <div className="font-extrabold text-lg text-primary">{studentName}</div>
                      <div className="text-xs font-bold text-foreground/40">{wallet.student_id}</div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-foreground/50 uppercase tracking-widest">ยอดปัจจุบัน</span>
                    <span className="font-bold text-foreground/70 text-xl">฿{wallet.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="py-4 flex justify-between items-center relative">
                    <div className="absolute inset-0 bg-primary/5 -mx-8"></div>
                    <span className="text-sm font-bold text-primary/70 uppercase tracking-widest relative z-10">จำนวนที่เติม</span>
                    <span className="text-5xl font-black text-primary relative z-10 tracking-tight">+฿{parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center pt-5 border-t border-foreground/5">
                    <span className="text-sm font-bold text-foreground/50 uppercase tracking-widest">ยอดคงเหลือสุทธิ</span>
                    <span className="font-black text-3xl text-foreground">
                      ฿{(wallet.balance + parseFloat(amount)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button onClick={() => setStep('amount')} className="flex-1 py-5 bg-surface border-2 border-foreground/10 text-foreground/60 rounded-2xl font-bold text-lg hover:bg-background transition-colors">
                    ย้อนกลับ
                  </button>
                  <button
                    onClick={handleConfirmTopup}
                    disabled={processing}
                    className="flex-[2] py-5 bg-green-500 text-white rounded-2xl font-black text-2xl hover:bg-green-600 disabled:opacity-50 shadow-xl shadow-green-500/30 transition-all active:scale-95 flex justify-center items-center gap-3"
                  >
                    {processing ? (
                      <><div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" /> กำลังดำเนินการ...</>
                    ) : (
                      <><CheckCircle2 className="w-8 h-8" /> ยืนยันการเติมเงิน</>
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 4: Success */}
            {step === 'success' && transaction && (
              <motion.div 
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-green-500 rounded-[3rem] shadow-2xl p-12 text-center text-white relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
                
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', bounce: 0.5 }}
                  className="w-32 h-32 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner relative z-10"
                >
                  <CheckCircle2 className="w-20 h-20 text-green-500" />
                </motion.div>
                
                <h2 className="text-4xl font-black mb-2 relative z-10">เติมเงินสำเร็จ!</h2>
                <p className="text-green-100 font-bold tracking-widest uppercase mb-10 relative z-10">Ref: {transaction.id.slice(-8).toUpperCase()}</p>

                <div className="bg-black/10 rounded-3xl p-8 mb-10 backdrop-blur-md relative z-10 border border-white/10">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-green-100 font-bold uppercase tracking-wider text-sm">นักเรียน</span>
                    <span className="font-extrabold text-xl">{studentName}</span>
                  </div>
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-green-100 font-bold uppercase tracking-wider text-sm">จำนวนเติม</span>
                    <span className="font-black text-3xl">+฿{transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="border-t border-white/20 pt-6 flex justify-between items-center">
                    <span className="text-white font-black uppercase tracking-wider">ยอดคงเหลือสุทธิ</span>
                    <span className="text-5xl font-black">
                      ฿{transaction.balance_after.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleReset}
                  className="w-full py-5 bg-white text-green-600 rounded-2xl font-black text-xl hover:bg-green-50 shadow-xl transition-all active:scale-95 relative z-10"
                >
                  เริ่มรายการใหม่ ({countdown})
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
