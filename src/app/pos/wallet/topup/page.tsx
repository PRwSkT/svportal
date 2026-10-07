'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { WalletAccount } from '@/types';
import type { WalletTransaction } from '@/types';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Search, CheckCircle2, CreditCard, RotateCcw, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

type Step = 'identify' | 'amount' | 'confirm' | 'success';

export default function TopupPage() {
  const { dict, isThai, formatCurrency } = useLanguage();
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

  const isScanningRef = useRef(false);

  const handleCardScan = useCallback(async (uid: string) => {
    if (isScanningRef.current) return;
    isScanningRef.current = true;
    setSearching(true);
    const loadingToast = toast.loading(isThai ? 'กำลังตรวจสอบข้อมูลบัตร...' : 'Verifying student card...');
    try {
      const res = await fetch(`/api/pos/wallet?card_uid=${encodeURIComponent(uid)}`);
      if (res.ok) {
        const { wallet, today_spend, student_name } = await res.json();
        if (!wallet.is_active) {
          toast.error(isThai ? 'Wallet ถูกระงับการใช้งาน' : 'Wallet account is inactive', { id: loadingToast });
          return;
        }
        await loadStudentInfo(wallet, student_name, today_spend, loadingToast);
      } else {
        toast.error(isThai ? 'ไม่พบบัตรในระบบ' : 'Card not recognized', { id: loadingToast, description: isThai ? 'กรุณาลองกรอกรหัสนักเรียนด้วยตนเอง' : 'Please enter student ID manually' });
      }
    } catch {
      toast.error(isThai ? 'เกิดข้อผิดพลาดในการค้นหา' : 'Search error', { id: loadingToast });
    } finally {
      setSearching(false);
      isScanningRef.current = false;
    }
  }, [isThai]);

  async function loadStudentInfo(w: WalletAccount, name: string, spend: number, toastId?: string | number) {
    setWallet(w);
    setStudentName(name);
    setTodaySpend(spend);
    if (toastId) toast.success(isThai ? `พบข้อมูลนักเรียน: ${name}` : `Found student: ${name}`, { id: toastId });
    setStep('amount');
  }

  async function handleSearch() {
    if (!inputValue.trim()) return;
    setSearching(true);
    const loadingToast = toast.loading(isThai ? 'กำลังค้นหาข้อมูล...' : 'Searching...');
    try {
      const isStudentId = /^\d{4,5}$/.test(inputValue.trim());
      const queryParam = isStudentId ? `student_id=${encodeURIComponent(inputValue.trim())}` : `card_uid=${encodeURIComponent(inputValue.trim())}`;
      const res = await fetch(`/api/pos/wallet?${queryParam}`);

      if (!res.ok) {
        toast.error(isStudentId ? (isThai ? `ไม่พบนักเรียนรหัส ${inputValue}` : `Student ${inputValue} not found`) : (isThai ? `ไม่พบบัตร UID ${inputValue}` : `Card UID ${inputValue} not found`), { id: loadingToast });
        return;
      }

      const { wallet, today_spend, student_name } = await res.json();

      if (!wallet.is_active) {
        toast.error(isThai ? 'Wallet ถูกระงับการใช้งาน' : 'Wallet account is inactive', { id: loadingToast });
        return;
      }

      await loadStudentInfo(wallet, student_name, today_spend, loadingToast);
    } catch {
      toast.error(isThai ? 'เกิดข้อผิดพลาดในการค้นหา' : 'Search error', { id: loadingToast });
    } finally {
      setSearching(false);
    }
  }

  const isSubmittingRef = useRef(false);

  async function handleConfirmTopup() {
    if (isSubmittingRef.current) return;
    if (!wallet) return;
    const topupAmount = parseFloat(amount);
    if (isNaN(topupAmount) || topupAmount < 20) {
      toast.error(isThai ? 'จำนวนเงินขั้นต่ำ 20 บาท' : 'Minimum top-up amount is 20 THB');
      return;
    }

    isSubmittingRef.current = true;
    setProcessing(true);
    const loadingToast = toast.loading(isThai ? 'กำลังประมวลผลการเติมเงิน...' : 'Processing top-up...');
    try {
      const res = await fetch('/api/pos/wallet/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: wallet.student_id, amount: topupAmount, topupMethod: 'counter' })
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Topup failed');
      }
      
      const tx = await res.json();
      setTransaction(tx);
      setStep('success');
      setCountdown(5);
      toast.success(isThai ? 'เติมเงินสำเร็จ!' : 'Top-up successful!', { id: loadingToast });
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      toast.error(isThai ? 'เติมเงินไม่สำเร็จ' : 'Top-up failed', { id: loadingToast, description: e.message });
    } finally {
      setProcessing(false);
      isSubmittingRef.current = false;
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

  const quickAmounts = [20, 50, 100, 200, 500];

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col bg-background overflow-x-hidden font-sans relative">
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#7B1C3E]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>

      {/* Header */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800 shadow-sm px-4 sm:px-8 py-4 flex justify-between items-center z-10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              {dict.common.officialBadge}
            </span>
            <span className="text-[11px] text-slate-500 font-medium">{dict.wallet.servicePoint}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#7B1C3E] dark:text-pink-400 flex items-center gap-2 sm:gap-3">
            <div className="bg-[#7B1C3E]/10 p-2 rounded-xl text-[#7B1C3E] dark:text-pink-400"><Wallet className="w-5 h-5 sm:w-6 sm:h-6" /></div>
            <span>{dict.wallet.topupTitle}</span>
          </h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <span className="text-[10px] sm:text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 px-3 sm:px-4 py-1.5 rounded-full uppercase tracking-wider">
            Mode: {nfcMode === 'hid' ? 'HID' : nfcMode === 'serial' ? 'Serial' : 'Manual'}
          </span>
          {step !== 'identify' && (
            <button onClick={handleReset} className="text-xs sm:text-sm font-bold text-[#7B1C3E] hover:text-[#631430] transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#7B1C3E]/5 hover:bg-[#7B1C3E]/10">
              <RotateCcw className="w-4 h-4" /> <span>{dict.fees.newTransaction}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 z-10 overflow-y-auto">
        <div className="w-full max-w-xl">
          <AnimatePresence mode="wait">
            {/* STEP 1: Identify Student */}
            {step === 'identify' && (
              <motion.div 
                key="identify"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                className="bg-white dark:bg-slate-900 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl p-6 sm:p-12 text-center border border-slate-200/80 dark:border-slate-800 relative overflow-hidden"
              >
                <div className="relative z-10 mb-8">
                  <div className="w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-br from-[#7B1C3E]/20 to-[#7B1C3E]/5 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                    <div className="absolute inset-0 bg-[#7B1C3E]/20 blur-xl rounded-full animate-pulse"></div>
                    <CreditCard className="w-12 h-12 sm:w-16 sm:h-16 text-[#7B1C3E] dark:text-pink-400 relative z-10" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mb-2 sm:mb-3 tracking-tight">{dict.wallet.tapCard}</h2>
                  <p className="text-slate-500 font-bold text-xs sm:text-sm tracking-wide">{dict.wallet.tapCardOrManual}</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 relative z-10">
                  <div className="flex-1 relative group">
                    <input
                      type="text"
                      value={inputValue}
                      onChange={e => setInputValue(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSearch()}
                      placeholder={isThai ? 'รหัส หรือ UID...' : 'ID or Card UID...'}
                      className="w-full px-5 sm:px-6 py-4 sm:py-5 pl-12 sm:pl-14 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-lg sm:text-xl font-bold focus:border-[#7B1C3E] focus:ring-4 focus:ring-[#7B1C3E]/10 outline-none bg-slate-50 dark:bg-slate-800 shadow-inner text-slate-900 dark:text-white placeholder:text-slate-400 transition-all uppercase tracking-wider"
                      autoFocus
                    />
                    <Search className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 w-5 h-5 sm:w-6 sm:h-6 text-slate-400 group-focus-within:text-[#7B1C3E] transition-colors" />
                  </div>
                  <button
                    onClick={handleSearch}
                    disabled={searching || !inputValue.trim()}
                    className="px-6 sm:px-8 py-4 sm:py-5 bg-[#7B1C3E] hover:bg-[#681834] text-white rounded-2xl font-black text-base sm:text-xl disabled:opacity-50 shadow-xl shadow-[#7B1C3E]/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    {searching ? <div className="w-5 h-5 sm:w-6 sm:h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div> : dict.common.search}
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
                className="bg-white dark:bg-slate-900 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl p-6 sm:p-10 border border-slate-200/80 dark:border-slate-800"
              >
                {/* Student Info */}
                <div className="text-center mb-8 pb-8 border-b border-slate-200 dark:border-slate-800 relative">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{isThai ? 'ข้อมูลนักเรียน' : 'Student Information'}</p>
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mb-1">{studentName}</h2>
                  <p className="text-xs sm:text-sm font-bold text-slate-500 tracking-widest mb-4">ID: {wallet.student_id}</p>
                  
                  <div className={`inline-flex flex-col items-center px-6 sm:px-8 py-3 sm:py-4 rounded-3xl border-2 ${wallet.balance < 100 ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 text-rose-700 dark:text-rose-400' : 'bg-[#7B1C3E]/5 border-[#7B1C3E]/20 text-[#7B1C3E] dark:text-pink-400'}`}>
                    <span className="text-xs font-bold uppercase tracking-widest opacity-70 mb-1">{dict.wallet.currentBalance}</span>
                    <span className="text-3xl sm:text-4xl font-black">{formatCurrency(wallet.balance)}</span>
                  </div>
                  
                  {wallet.daily_limit !== null && (
                    <div className="mt-4 flex flex-col items-center max-w-xs mx-auto">
                      <div className="flex justify-between w-full text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">
                        <span>{dict.wallet.spentToday} {formatCurrency(todaySpend)}</span>
                        <span>{dict.wallet.dailyLimit} {formatCurrency(wallet.daily_limit)}</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${todaySpend >= wallet.daily_limit ? 'bg-rose-600' : 'bg-[#7B1C3E]'}`}
                          style={{ width: `${Math.min(100, (todaySpend / wallet.daily_limit) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Amount Input */}
                <div className="mb-8 relative">
                  <label className="block text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-widest mb-3 text-center">
                    {isThai ? 'ระบุจำนวนเงินที่ต้องการเติม' : 'Enter Top-up Amount'}
                  </label>
                  <div className="relative max-w-sm mx-auto">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl sm:text-3xl font-black text-slate-400 pointer-events-none">฿</span>
                    <input
                      type="number"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      min="20"
                      step="10"
                      placeholder="0.00"
                      className="w-full px-6 py-4 sm:py-6 pl-14 sm:pl-16 border-2 border-slate-200 dark:border-slate-700 rounded-3xl text-3xl sm:text-5xl font-black text-center focus:border-[#7B1C3E] focus:ring-4 focus:ring-[#7B1C3E]/10 outline-none bg-slate-50 dark:bg-slate-800 shadow-inner text-[#7B1C3E] dark:text-pink-400 placeholder:text-slate-300 transition-all"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Quick Amounts */}
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5 sm:gap-4 mb-8 sm:mb-10">
                  {quickAmounts.map(qa => (
                    <button
                      key={qa}
                      onClick={() => setAmount(qa.toString())}
                      className={`py-3 sm:py-4 rounded-2xl font-black text-lg sm:text-xl transition-all active:scale-95 border-2
                        ${amount === qa.toString() ? 'bg-[#7B1C3E] text-white border-[#7B1C3E] shadow-lg shadow-[#7B1C3E]/20' : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-[#7B1C3E]/30 hover:text-[#7B1C3E] shadow-sm'}`}
                    >
                      {qa}
                    </button>
                  ))}
                </div>

                <div className="flex gap-4">
                  <button onClick={handleReset} className="flex-1 py-5 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl font-bold text-lg hover:bg-slate-50 transition-colors">
                    {dict.common.cancel}
                  </button>
                  <button
                    onClick={() => {
                      const a = parseFloat(amount);
                      if (isNaN(a) || a < 20) {
                        toast.warning(isThai ? 'กรุณากรอกจำนวนเงินขั้นต่ำ 20 บาท' : 'Minimum top-up amount is 20 THB');
                        return;
                      }
                      setStep('confirm');
                    }}
                    className="flex-[2] py-5 bg-[#7B1C3E] hover:bg-[#681834] text-white rounded-2xl font-black text-xl shadow-xl shadow-[#7B1C3E]/20 transition-all active:scale-95 flex justify-center items-center gap-2"
                  >
                    {isThai ? 'ดำเนินการต่อ' : 'Continue'} <ArrowRight className="w-6 h-6" />
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
                className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-10 text-center border border-slate-200/80 dark:border-slate-800"
              >
                <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-8 tracking-tight">{isThai ? 'ยืนยันการเติมเงิน' : 'Confirm Top-up'}</h2>

                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-3xl p-8 mb-10 space-y-5 border border-slate-200 dark:border-slate-700 shadow-inner">
                  <div className="flex justify-between items-center pb-5 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">{dict.students.studentName}</span>
                    <div className="text-right">
                      <div className="font-extrabold text-lg text-slate-900 dark:text-white">{studentName}</div>
                      <div className="text-xs font-bold text-slate-400">{wallet.student_id}</div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">{isThai ? 'ยอดปัจจุบัน' : 'Current Balance'}</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300 text-xl">{formatCurrency(wallet.balance)}</span>
                  </div>
                  <div className="py-4 flex justify-between items-center relative">
                    <div className="absolute inset-0 bg-[#7B1C3E]/5 -mx-8"></div>
                    <span className="text-sm font-bold text-[#7B1C3E] dark:text-pink-400 uppercase tracking-widest relative z-10">{isThai ? 'จำนวนที่เติม' : 'Top-up Amount'}</span>
                    <span className="text-5xl font-black text-[#7B1C3E] dark:text-pink-400 relative z-10 tracking-tight">+{formatCurrency(parseFloat(amount))}</span>
                  </div>
                  <div className="flex justify-between items-center pt-5 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">{isThai ? 'ยอดคงเหลือสุทธิ' : 'Balance After Top-up'}</span>
                    <span className="font-black text-3xl text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(wallet.balance + parseFloat(amount))}
                    </span>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button onClick={() => setStep('amount')} className="flex-1 py-5 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl font-bold text-lg hover:bg-slate-50 transition-colors">
                    {dict.common.back}
                  </button>
                  <button
                    onClick={handleConfirmTopup}
                    disabled={processing}
                    className="flex-[2] py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-2xl disabled:opacity-50 shadow-xl shadow-emerald-600/30 transition-all active:scale-95 flex justify-center items-center gap-3"
                  >
                    {processing ? (
                      <><div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" /> {isThai ? 'กำลังดำเนินการ...' : 'Processing...'}</>
                    ) : (
                      <><CheckCircle2 className="w-8 h-8" /> {isThai ? 'ยืนยันการเติมเงิน' : 'Confirm Top-up'}</>
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
                className="bg-emerald-600 rounded-[3rem] shadow-2xl p-12 text-center text-white relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
                
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', bounce: 0.5 }}
                  className="w-32 h-32 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner relative z-10"
                >
                  <CheckCircle2 className="w-20 h-20 text-emerald-600" />
                </motion.div>
                
                <h2 className="text-4xl font-black mb-2 relative z-10">{isThai ? 'เติมเงินสำเร็จ!' : 'Top-up Successful!'}</h2>
                <p className="text-emerald-100 font-bold tracking-widest uppercase mb-10 relative z-10">Ref: {transaction.id.slice(-8).toUpperCase()}</p>

                <div className="bg-black/10 rounded-3xl p-8 mb-10 backdrop-blur-md relative z-10 border border-white/10">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-emerald-100 font-bold uppercase tracking-wider text-sm">{dict.students.studentName}</span>
                    <span className="font-extrabold text-xl">{studentName}</span>
                  </div>
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-emerald-100 font-bold uppercase tracking-wider text-sm">{isThai ? 'จำนวนเติม' : 'Amount Added'}</span>
                    <span className="font-black text-3xl">+{formatCurrency(transaction.amount)}</span>
                  </div>
                  <div className="border-t border-white/20 pt-6 flex justify-between items-center">
                    <span className="text-white font-black uppercase tracking-wider">{isThai ? 'ยอดคงเหลือสุทธิ' : 'Balance After Top-up'}</span>
                    <span className="text-5xl font-black">
                      {formatCurrency(transaction.balance_after)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleReset}
                  className="w-full py-5 bg-white text-emerald-700 rounded-2xl font-black text-xl hover:bg-emerald-50 shadow-xl transition-all active:scale-95 relative z-10"
                >
                  {isThai ? `เริ่มรายการใหม่ (${countdown})` : `New Transaction (${countdown})`}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
