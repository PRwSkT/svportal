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

type Step = 'identify' | 'amount' | 'confirm' | 'success';

export default function TopupPage() {
  const [step, setStep] = useState<Step>('identify');
  const [wallet, setWallet] = useState<WalletAccount | null>(null);
  const [studentName, setStudentName] = useState('');
  const [todaySpend, setTodaySpend] = useState(0); // Thai Baht
  const [amount, setAmount] = useState('');         // Thai Baht
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    setError(null);
    try {
      const w = await getWalletByCardUID(uid);
      if (w) {
        await loadStudentInfo(w);
      } else {
        setError('ไม่พบบัตรในระบบ กรุณาลองกรอกรหัสนักเรียนด้วยตนเอง');
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการค้นหา');
    } finally {
      setSearching(false);
    }
  }, []);

  async function loadStudentInfo(w: WalletAccount) {
    setWallet(w);
    // Fetch student name
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data } = await supabase
        .from('students')
        .select('name')
        .eq('id', w.student_id)
        .single();
      setStudentName(data?.name || 'ไม่พบชื่อ');

      const spend = await getTodaySpend(w.student_id);
      setTodaySpend(spend); // Thai Baht
    } catch {
      setStudentName('ไม่พบชื่อ');
    }
    setStep('amount');
  }

  async function handleSearch() {
    if (!inputValue.trim()) return;
    setSearching(true);
    setError(null);
    try {
      // Check if it's a card UID (hex) or student ID (numeric)
      const isStudentId = /^\d{4,5}$/.test(inputValue.trim());

      let w: WalletAccount | null = null;
      if (isStudentId) {
        w = await getWalletByStudentId(inputValue.trim()); // 4–5 digit numeric string
      } else {
        w = await getWalletByCardUID(inputValue.trim());
      }

      if (!w) {
        setError(isStudentId ? 'ไม่พบนักเรียนรหัส ' + inputValue : 'ไม่พบบัตร UID ' + inputValue);
        return;
      }

      if (!w.is_active) {
        setError('Wallet ถูกระงับการใช้งาน');
        return;
      }

      await loadStudentInfo(w);
    } catch {
      setError('เกิดข้อผิดพลาดในการค้นหา');
    } finally {
      setSearching(false);
    }
  }

  async function handleConfirmTopup() {
    if (!wallet) return;
    const topupAmount = parseFloat(amount); // Thai Baht
    if (isNaN(topupAmount) || topupAmount < 20) {
      setError('จำนวนเงินขั้นต่ำ 20 บาท');
      return;
    }

    setProcessing(true);
    setError(null);
    try {
      const tx = await topupWallet(wallet.student_id, topupAmount, 'counter');
      setTransaction(tx);
      setStep('success');
      setCountdown(5);
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(`เติมเงินไม่สำเร็จ: ${e.message}`);
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
    setError(null);
    setTransaction(null);
    setInputValue('');
    setCountdown(5);
  }

  const quickAmounts = [50, 100, 200, 500]; // Thai Baht

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden font-sans">
      {/* Header */}
      <div className="bg-surface border-b shadow-sm px-8 py-4 flex justify-between items-center border-foreground/5">
        <h1 className="text-xl font-bold text-primary">💰 เติมเงิน Wallet นักเรียน</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-foreground/5 text-foreground/50 px-3 py-1 rounded-full">
            โหมด: {nfcMode === 'hid' ? 'HID' : nfcMode === 'serial' ? 'Serial' : 'Manual'}
          </span>
          {step !== 'identify' && (
            <button onClick={handleReset} className="text-sm text-primary hover:underline">เริ่มใหม่</button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-xl">
          {/* STEP 1: Identify Student */}
          {step === 'identify' && (
            <div className="bg-surface rounded-3xl shadow-xl p-12 text-center border border-foreground/5">
              <div className="text-8xl mb-6 animate-pulse">💳</div>
              <h2 className="text-3xl font-bold text-primary mb-2">แตะบัตรนักเรียน</h2>
              <p className="text-foreground/70 mb-8">หรือกรอกรหัสนักเรียนด้วยตนเอง</p>

              <div className="flex gap-3">
                <input
                  type="text"
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="รหัสนักเรียน หรือ UID บัตร..."
                  className="flex-1 px-5 py-4 border-2 border-foreground/10 rounded-xl text-lg focus:border-primary outline-none bg-surface text-foreground"
                  autoFocus
                />
                <button
                  onClick={handleSearch}
                  disabled={searching}
                  className="px-8 py-4 bg-primary text-white rounded-xl font-bold text-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  {searching ? '...' : 'ค้นหา'}
                </button>
              </div>

              {error && (
                <div className="mt-6 p-4 bg-secondary/10 text-secondary rounded-xl text-sm border border-secondary/20">{error}</div>
              )}
            </div>
          )}

          {/* STEP 2: Enter Amount */}
          {step === 'amount' && wallet && (
            <div className="bg-surface rounded-3xl shadow-xl p-10 border border-foreground/5">
              {/* Student Info */}
              <div className="text-center mb-8 pb-6 border-b border-foreground/10">
                <p className="text-sm text-foreground/70">นักเรียน</p>
                <h2 className="text-2xl font-bold text-primary">{studentName}</h2>
                <p className="text-sm text-foreground/50">รหัส: {wallet.student_id}</p>
                <div className={`mt-3 inline-block px-6 py-2 rounded-full ${wallet.balance < 100 ? 'bg-secondary/10 text-secondary' : 'bg-primary/10 text-primary'}`}>
                  ยอดปัจจุบัน: <strong>฿{wallet.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                </div>
                {wallet.daily_limit !== null && (
                  <p className="text-xs text-foreground/50 mt-2">
                    ใช้ไปวันนี้: ฿{todaySpend.toLocaleString('en-US', { minimumFractionDigits: 2 })} / {wallet.daily_limit.toLocaleString('en-US')} บาท
                  </p>
                )}
              </div>

              {/* Amount Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-foreground/70 mb-2">จำนวนเงินที่ต้องการเติม (บาท)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  min="20"
                  step="10"
                  placeholder="ขั้นต่ำ 20 บาท"
                  className="w-full px-6 py-5 border-2 border-foreground/10 rounded-xl text-3xl font-bold text-center focus:border-primary outline-none bg-surface text-foreground"
                  autoFocus
                />
              </div>

              {/* Quick Amounts */}
              <div className="grid grid-cols-4 gap-3 mb-8">
                {quickAmounts.map(qa => (
                  <button
                    key={qa}
                    onClick={() => setAmount(qa.toString())}
                    className={`py-3 rounded-xl font-bold text-lg transition-colors
                      ${amount === qa.toString() ? 'bg-primary text-white' : 'bg-foreground/5 text-foreground/70 hover:bg-foreground/10'}`}
                  >
                    ฿{qa}
                  </button>
                ))}
              </div>

              {error && (
                <div className="mb-6 p-4 bg-secondary/10 text-secondary rounded-xl text-sm border border-secondary/20">{error}</div>
              )}

              <div className="flex gap-4">
                <button onClick={handleReset} className="flex-1 py-4 bg-foreground/5 text-foreground/70 rounded-xl font-medium text-lg hover:bg-foreground/10">
                  ยกเลิก
                </button>
                <button
                  onClick={() => {
                    const a = parseFloat(amount);
                    if (isNaN(a) || a < 20) {
                      setError('กรุณากรอกจำนวนเงินขั้นต่ำ 20 บาท');
                      return;
                    }
                    setError(null);
                    setStep('confirm');
                  }}
                  className="flex-[2] py-4 bg-primary text-white rounded-xl font-bold text-lg hover:bg-primary/90"
                >
                  ถัดไป →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Confirm */}
          {step === 'confirm' && wallet && (
            <div className="bg-surface rounded-3xl shadow-xl p-10 text-center border border-foreground/5">
              <h2 className="text-2xl font-bold text-primary mb-8">ยืนยันการเติมเงิน</h2>

              <div className="bg-background/50 rounded-2xl p-6 mb-8 space-y-4 border border-foreground/10">
                <div className="flex justify-between">
                  <span className="text-foreground/70">นักเรียน</span>
                  <span className="font-bold text-primary">{studentName} ({wallet.student_id})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground/70">ยอดปัจจุบัน</span>
                  <span className="text-primary">฿{wallet.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="border-t border-foreground/10 pt-4 flex justify-between">
                  <span className="text-foreground/70">จำนวนเติม</span>
                  <span className="text-3xl font-extrabold text-secondary">+฿{parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground/70">ยอดหลังเติม</span>
                  <span className="font-bold text-primary">
                    ฿{(wallet.balance + parseFloat(amount)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-secondary/10 text-secondary rounded-xl text-sm border border-secondary/20">{error}</div>
              )}

              <div className="flex gap-4">
                <button onClick={() => setStep('amount')} className="flex-1 py-4 bg-foreground/5 text-foreground/70 rounded-xl font-medium text-lg hover:bg-foreground/10">
                  ← กลับ
                </button>
                <button
                  onClick={handleConfirmTopup}
                  disabled={processing}
                  className="flex-[2] py-4 bg-secondary text-white rounded-xl font-bold text-lg hover:bg-secondary/90 disabled:opacity-50"
                >
                  {processing ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                      กำลังดำเนินการ...
                    </span>
                  ) : '✓ ยืนยันเติมเงิน'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Success */}
          {step === 'success' && transaction && (
            <div className="bg-surface rounded-3xl shadow-xl p-10 text-center border border-foreground/5">
              <div className="text-7xl mb-4">✅</div>
              <h2 className="text-3xl font-bold text-secondary mb-2">เติมเงินสำเร็จ!</h2>
              <p className="text-foreground/50 mb-8">รหัสอ้างอิง: {transaction.id.slice(-8).toUpperCase()}</p>

              <div className="bg-secondary/10 rounded-2xl p-6 mb-8 space-y-3 border border-secondary/20">
                <div className="flex justify-between">
                  <span className="text-foreground/70">นักเรียน</span>
                  <span className="font-bold text-primary">{studentName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground/70">จำนวนเติม</span>
                  <span className="font-bold text-secondary">+฿{transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="border-t border-secondary/20 pt-3 flex justify-between">
                  <span className="text-foreground/70">ยอดคงเหลือ</span>
                  <span className="text-2xl font-extrabold text-primary">
                    ฿{transaction.balance_after.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <button
                onClick={handleReset}
                className="w-full py-4 bg-primary text-white rounded-xl font-bold text-lg hover:bg-primary/90"
              >
                เติมเงินรายการถัดไป ({countdown})
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
