'use client';

import { useState, useEffect } from 'react';
import { WalletAccount } from '@/types';
import { getAllWalletAccounts, linkCardToStudent, updateDailyLimit, adjustBalance, getWalletHistory } from '@/lib/supabase/wallet';
import type { WalletTransaction } from '@/types';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Search, Filter, CreditCard, Settings, X, ChevronRight, Activity, TrendingDown, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';

type WalletAccountWithStudent = WalletAccount & {
  student_name?: string;
  student_grade?: string;
};

type FilterType = 'all' | 'has_card' | 'no_card' | 'low_balance';

export default function AdminWalletStudentsPage() {
  const [accounts, setAccounts] = useState<WalletAccountWithStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Slide-in panel state
  const [selectedAccount, setSelectedAccount] = useState<WalletAccountWithStudent | null>(null);
  const [panelHistory, setPanelHistory] = useState<WalletTransaction[]>([]);
  const [panelLoading, setPanelLoading] = useState(false);

  // Adjustment modal
  const [showAdjustment, setShowAdjustment] = useState(false);
  const [adjAmount, setAdjAmount] = useState('');
  const [adjNote, setAdjNote] = useState('');
  const [adjProcessing, setAdjProcessing] = useState(false);

  // Card linking
  const [linkingCard, setLinkingCard] = useState(false);
  const [cardUIDInput, setCardUIDInput] = useState('');

  // Daily limit editing
  const [editingLimit, setEditingLimit] = useState(false);
  const [limitInput, setLimitInput] = useState('');

  useEffect(() => {
    fetchAccounts();
  }, []);

  async function fetchAccounts() {
    setLoading(true);
    try {
      const data = await getAllWalletAccounts();
      setAccounts(data);
    } catch (err: any) {
      toast.error('ไม่สามารถโหลดข้อมูลได้', { description: err.message });
    } finally {
      setLoading(false);
    }
  }

  const filteredAccounts = accounts.filter(a => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!a.student_id.includes(q) && !(a.student_name?.toLowerCase().includes(q))) return false;
    }
    switch (filter) {
      case 'has_card': return a.card_uid !== null;
      case 'no_card': return a.card_uid === null;
      case 'low_balance': return a.balance < 50;
      default: return true;
    }
  });

  async function openPanel(account: WalletAccountWithStudent) {
    setSelectedAccount(account);
    setPanelLoading(true);
    setEditingLimit(false);
    setLinkingCard(false);
    setShowAdjustment(false);
    try {
      const history = await getWalletHistory(account.student_id, 30);
      setPanelHistory(history);
    } catch (err: any) {
      toast.error('ไม่สามารถโหลดประวัติได้', { description: err.message });
    } finally {
      setPanelLoading(false);
    }
  }

  function closePanel() {
    setSelectedAccount(null);
    setPanelHistory([]);
  }

  async function handleLinkCard() {
    if (!selectedAccount || !cardUIDInput.trim()) return;
    const loadingToast = toast.loading('กำลังผูกบัตร...');
    try {
      await linkCardToStudent(selectedAccount.student_id, cardUIDInput.trim());
      setLinkingCard(false);
      setCardUIDInput('');
      await fetchAccounts();
      const updated = accounts.find(a => a.student_id === selectedAccount.student_id);
      if (updated) setSelectedAccount({ ...updated, card_uid: cardUIDInput.trim().toUpperCase() });
      toast.success('ผูกบัตรสำเร็จ', { id: loadingToast });
    } catch (err: any) {
      toast.error('ไม่สามารถผูกบัตรได้', { id: loadingToast, description: err.message });
    }
  }

  async function handleSaveLimit() {
    if (!selectedAccount) return;
    const newLimit = limitInput.trim() === '' ? null : parseFloat(limitInput);
    if (newLimit !== null && (isNaN(newLimit) || newLimit < 0)) {
      toast.error('กรุณากรอกวงเงินที่ถูกต้อง');
      return;
    }
    const loadingToast = toast.loading('กำลังอัปเดตวงเงิน...');
    try {
      await updateDailyLimit(selectedAccount.student_id, newLimit);
      setEditingLimit(false);
      await fetchAccounts();
      setSelectedAccount(prev => prev ? { ...prev, daily_limit: newLimit } : null);
      toast.success('อัปเดตวงเงินสำเร็จ', { id: loadingToast });
    } catch (err: any) {
      toast.error('ไม่สามารถอัปเดตวงเงินได้', { id: loadingToast, description: err.message });
    }
  }

  async function handleAdjustment() {
    if (!selectedAccount || !adjAmount || !adjNote.trim()) return;
    setAdjProcessing(true);
    const loadingToast = toast.loading('กำลังปรับยอด...');
    try {
      const amount = parseFloat(adjAmount);
      await adjustBalance(selectedAccount.student_id, amount, adjNote);
      setShowAdjustment(false);
      setAdjAmount('');
      setAdjNote('');
      await fetchAccounts();
      const history = await getWalletHistory(selectedAccount.student_id, 30);
      setPanelHistory(history);
      const updated = accounts.find(a => a.student_id === selectedAccount.student_id);
      if (updated) setSelectedAccount(updated);
      toast.success('ปรับยอดสำเร็จ', { id: loadingToast });
    } catch (err: any) {
      toast.error('ปรับยอดไม่สำเร็จ', { id: loadingToast, description: err.message });
    } finally {
      setAdjProcessing(false);
    }
  }

  const txTypeLabel: Record<string, { icon: React.ReactNode, text: string, color: string }> = {
    topup: { icon: <TrendingUp className="w-4 h-4"/>, text: 'เติมเงิน', color: 'text-green-600 bg-green-50' },
    purchase: { icon: <TrendingDown className="w-4 h-4"/>, text: 'ซื้อสินค้า', color: 'text-red-600 bg-red-50' },
    refund: { icon: <TrendingUp className="w-4 h-4"/>, text: 'คืนเงิน', color: 'text-blue-600 bg-blue-50' },
    adjustment: { icon: <Settings className="w-4 h-4"/>, text: 'ปรับยอด', color: 'text-amber-600 bg-amber-50' },
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden font-sans relative">
      {/* Main List */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${selectedAccount ? 'pr-[480px]' : ''} p-8 max-w-7xl mx-auto w-full`}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-surface/80 backdrop-blur-xl p-6 rounded-3xl shadow-lg border border-white/20 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
              <Wallet className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-primary mb-1">จัดการ Wallet นักเรียน</h1>
              <p className="text-foreground/60 font-medium">ดูยอดเงิน ตั้งวงเงิน ผูกบัตร และปรับปรุงยอด</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground/40" />
              <input
                type="text"
                placeholder="ค้นหารหัสหรือชื่อ..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-background border border-foreground/10 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium"
              />
            </div>
            <div className="flex gap-2 p-1 bg-background border border-foreground/10 rounded-xl overflow-x-auto hide-scrollbar">
              {([
                ['all', 'ทั้งหมด'],
                ['has_card', 'มีบัตร'],
                ['no_card', 'ไม่มีบัตร'],
                ['low_balance', 'ยอดต่ำ'],
              ] as [FilterType, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap
                    ${filter === key ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 bg-surface/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="p-8 space-y-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 animate-pulse">
                    <div className="w-20 h-12 bg-foreground/5 rounded-xl"></div>
                    <div className="flex-1 h-12 bg-foreground/5 rounded-xl"></div>
                    <div className="w-24 h-12 bg-foreground/5 rounded-xl"></div>
                    <div className="w-24 h-12 bg-foreground/5 rounded-xl"></div>
                    <div className="w-20 h-12 bg-foreground/5 rounded-xl"></div>
                  </div>
                ))}
              </div>
            ) : filteredAccounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-foreground/40 space-y-4 min-h-[400px]">
                <Wallet className="w-20 h-20 opacity-20" />
                <p className="text-xl font-medium">ไม่พบข้อมูล Wallet</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-foreground/[0.02] border-b border-foreground/5 sticky top-0 z-10 backdrop-blur-md">
                  <tr>
                    <th className="p-5 font-bold text-foreground/50 text-xs uppercase tracking-wider">รหัส</th>
                    <th className="p-5 font-bold text-foreground/50 text-xs uppercase tracking-wider">ชื่อนักเรียน</th>
                    <th className="p-5 font-bold text-foreground/50 text-xs uppercase tracking-wider text-right">ยอดคงเหลือ</th>
                    <th className="p-5 font-bold text-foreground/50 text-xs uppercase tracking-wider text-right">วงเงิน/วัน</th>
                    <th className="p-5 font-bold text-foreground/50 text-xs uppercase tracking-wider text-center">บัตร NFC</th>
                    <th className="p-5 font-bold text-foreground/50 text-xs uppercase tracking-wider text-center">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-foreground/5">
                  <AnimatePresence>
                    {filteredAccounts.map(account => (
                      <motion.tr
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        layout
                        key={account.id}
                        onClick={() => openPanel(account)}
                        className={`hover:bg-primary/[0.03] cursor-pointer transition-colors
                          ${account.balance < 50 ? 'bg-red-50/30' : account.balance < 100 ? 'bg-amber-50/30' : ''} 
                          ${selectedAccount?.id === account.id ? 'bg-primary/[0.05] shadow-inner' : ''}`}
                      >
                        <td className="p-5 font-mono font-bold text-foreground/80">{account.student_id}</td>
                        <td className="p-5 font-bold text-foreground">{account.student_name || '-'}</td>
                        <td className={`p-5 text-right font-extrabold text-lg ${account.balance < 50 ? 'text-red-600' : account.balance < 100 ? 'text-amber-600' : 'text-green-600'}`}>
                          ฿{account.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-5 text-right font-medium text-foreground/60">
                          {account.daily_limit !== null ? `${account.daily_limit.toLocaleString('en-US')} ฿` : 'ไม่จำกัด'}
                        </td>
                        <td className="p-5 text-center">
                          {account.card_uid ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-green-100 text-green-800">
                              <CheckCircle2 className="w-3 h-3" /> ผูกแล้ว
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-foreground/10 text-foreground/60">
                              ยังไม่ผูก
                            </span>
                          )}
                        </td>
                        <td className="p-5 text-center">
                          <div className={`w-3 h-3 rounded-full mx-auto ${account.is_active ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`}></div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            )}
          </div>
          {!loading && (
            <div className="p-4 bg-foreground/[0.02] border-t border-foreground/5 text-center text-sm font-bold text-foreground/50">
              แสดง {filteredAccounts.length} จาก {accounts.length} รายการ
            </div>
          )}
        </div>
      </div>

      {/* Slide-in Panel */}
      <AnimatePresence>
        {selectedAccount && (
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-[480px] bg-surface shadow-2xl border-l border-foreground/10 flex flex-col z-50"
          >
            {/* Panel Header */}
            <div className="p-6 border-b border-foreground/5 flex justify-between items-center bg-foreground/[0.02]">
              <div>
                <h2 className="text-2xl font-extrabold text-foreground mb-1">{selectedAccount.student_name || 'ไม่พบชื่อ'}</h2>
                <p className="text-sm font-bold text-foreground/50 flex items-center gap-2">
                  <span className="font-mono bg-background px-2 py-0.5 rounded-md border border-foreground/10">{selectedAccount.student_id}</span>
                </p>
              </div>
              <button onClick={closePanel} className="p-2 bg-background border border-foreground/10 rounded-full hover:bg-foreground/5 transition-colors">
                <X className="w-5 h-5 text-foreground/60" />
              </button>
            </div>

            {/* Balance */}
            <div className={`p-8 text-center border-b border-foreground/5 ${selectedAccount.balance < 50 ? 'bg-red-50' : selectedAccount.balance < 100 ? 'bg-amber-50' : 'bg-primary/5'}`}>
              <p className="text-sm font-bold text-foreground/50 mb-2 uppercase tracking-widest">ยอดคงเหลือ</p>
              <p className={`text-5xl font-black mb-2 ${selectedAccount.balance < 50 ? 'text-red-600' : selectedAccount.balance < 100 ? 'text-amber-600' : 'text-primary'}`}>
                ฿{selectedAccount.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>

            {/* Panel Body */}
            <div className="flex-1 overflow-auto p-6 space-y-6">
              {/* Daily Limit */}
              <div className="bg-background border border-foreground/10 p-5 rounded-2xl shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-bold text-foreground/60 flex items-center gap-2 uppercase tracking-wider"><Activity className="w-4 h-4"/> วงเงินรายวัน</span>
                  <button
                    onClick={() => { setEditingLimit(!editingLimit); setLimitInput(selectedAccount.daily_limit?.toString() || ''); }}
                    className="text-primary text-sm font-bold hover:underline"
                  >
                    {editingLimit ? 'ยกเลิก' : 'แก้ไข'}
                  </button>
                </div>
                {editingLimit ? (
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={limitInput}
                      onChange={e => setLimitInput(e.target.value)}
                      placeholder="ว่างเปล่า = ไม่จำกัด"
                      className="flex-1 px-4 py-2 border border-foreground/20 rounded-xl text-sm font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-surface"
                    />
                    <button onClick={handleSaveLimit} className="px-5 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-md shadow-primary/20">บันทึก</button>
                  </div>
                ) : (
                  <p className="font-extrabold text-2xl text-foreground">
                    {selectedAccount.daily_limit !== null ? `฿${selectedAccount.daily_limit.toLocaleString('en-US')}` : 'ไม่จำกัด'}
                  </p>
                )}
              </div>

              {/* Card UID */}
              <div className="bg-background border border-foreground/10 p-5 rounded-2xl shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-bold text-foreground/60 flex items-center gap-2 uppercase tracking-wider"><CreditCard className="w-4 h-4"/> บัตร NFC</span>
                  <button
                    onClick={() => { setLinkingCard(!linkingCard); setCardUIDInput(''); }}
                    className="text-primary text-sm font-bold hover:underline"
                  >
                    {linkingCard ? 'ยกเลิก' : 'ผูกบัตรใหม่'}
                  </button>
                </div>
                {linkingCard ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={cardUIDInput}
                      onChange={e => setCardUIDInput(e.target.value)}
                      placeholder="แตะบัตรหรือกรอก UID..."
                      className="flex-1 px-4 py-2 border border-foreground/20 rounded-xl text-sm font-mono font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-surface uppercase"
                      autoFocus
                    />
                    <button onClick={handleLinkCard} className="px-5 py-2 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 transition-colors shadow-md shadow-green-600/20">ผูกบัตร</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    {selectedAccount.card_uid ? (
                       <div className="flex flex-col">
                          <span className="font-mono text-xl font-bold text-foreground tracking-wider">{selectedAccount.card_uid}</span>
                          <span className="text-xs font-bold text-green-600 flex items-center gap-1 mt-1"><CheckCircle2 className="w-3 h-3"/> Active</span>
                       </div>
                    ) : (
                      <span className="text-foreground/40 font-bold italic">ยังไม่ได้ผูกบัตร</span>
                    )}
                  </div>
                )}
              </div>

              {/* Adjustment Button */}
              <button
                onClick={() => setShowAdjustment(!showAdjustment)}
                className="w-full py-4 bg-foreground border border-foreground/10 text-background rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-foreground/90 transition-all shadow-xl active:scale-95"
              >
                <Settings className="w-5 h-5" /> ปรับปรุงยอดเงิน (Adjustment)
              </button>

              <AnimatePresence>
                {showAdjustment && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200 space-y-4">
                      <div>
                        <label className="block text-sm font-bold text-amber-900/70 mb-1">จำนวนเงิน (บวก = เพิ่ม, ลบ = หัก)</label>
                        <input
                          type="number"
                          value={adjAmount}
                          onChange={e => setAdjAmount(e.target.value)}
                          placeholder="เช่น 100 หรือ -50"
                          className="w-full px-4 py-2 border border-amber-300/50 rounded-xl bg-white focus:ring-2 focus:ring-amber-500/50 outline-none font-bold text-amber-900"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-amber-900/70 mb-1">เหตุผล (จำเป็น)</label>
                        <input
                          type="text"
                          value={adjNote}
                          onChange={e => setAdjNote(e.target.value)}
                          placeholder="เช่น แก้ไขยอดผิดพลาด"
                          className="w-full px-4 py-2 border border-amber-300/50 rounded-xl bg-white focus:ring-2 focus:ring-amber-500/50 outline-none text-sm font-medium text-amber-900"
                        />
                      </div>
                      <button
                        onClick={handleAdjustment}
                        disabled={adjProcessing || !adjAmount || !adjNote.trim()}
                        className="w-full py-3 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 disabled:opacity-50 transition-colors shadow-lg shadow-amber-500/20"
                      >
                        {adjProcessing ? 'กำลังดำเนินการ...' : 'ยืนยันการปรับยอด'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Transaction History */}
              <div className="pt-4">
                <h3 className="text-sm font-bold text-foreground/50 uppercase tracking-widest mb-4">ประวัติธุรกรรม (30 รายการล่าสุด)</h3>
                {panelLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                       <div key={i} className="h-16 bg-foreground/5 rounded-xl animate-pulse"></div>
                    ))}
                  </div>
                ) : panelHistory.length === 0 ? (
                  <div className="text-center py-8 bg-foreground/[0.02] rounded-2xl border border-foreground/5 border-dashed">
                    <Activity className="w-8 h-8 text-foreground/20 mx-auto mb-2" />
                    <p className="text-foreground/40 font-bold">ยังไม่มีประวัติการทำรายการ</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {panelHistory.map((tx, i) => {
                      const typeInfo = txTypeLabel[tx.type] || { icon: <Activity className="w-4 h-4"/>, text: tx.type, color: 'text-foreground bg-foreground/10' };
                      return (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          key={tx.id} 
                          className="flex justify-between items-center p-4 bg-background rounded-2xl border border-foreground/10 hover:border-foreground/20 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${typeInfo.color}`}>
                              {typeInfo.icon}
                            </div>
                            <div>
                              <p className="font-bold text-foreground text-sm mb-0.5">{typeInfo.text}</p>
                              <p className="text-xs font-medium text-foreground/50">
                                {new Intl.DateTimeFormat('th-TH', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(tx.created_at))}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-extrabold ${tx.type === 'purchase' ? 'text-red-600' : tx.type === 'topup' ? 'text-green-600' : 'text-foreground'}`}>
                              {tx.type === 'purchase' ? '-' : '+'}฿{tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </p>
                            <p className="text-xs font-bold text-foreground/40 mt-0.5">คงเหลือ ฿{tx.balance_after.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
