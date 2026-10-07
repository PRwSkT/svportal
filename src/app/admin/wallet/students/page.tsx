'use client';

import { useState, useEffect } from 'react';
import { WalletAccount } from '@/types';
import type { WalletTransaction } from '@/types';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Search, CreditCard, Settings, X, Activity, TrendingDown, TrendingUp, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

type WalletAccountWithStudent = WalletAccount & {
  student_name?: string;
  student_grade?: string;
};

type FilterType = 'all' | 'has_card' | 'no_card' | 'low_balance';

export default function AdminWalletStudentsPage() {
  const { dict, isThai, formatDate, formatCurrency } = useLanguage();
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
      const res = await fetch('/api/admin/wallet');
      if (!res.ok) throw new Error('Failed to fetch accounts');
      const data = await res.json();
      setAccounts(data);
      return data;
    } catch (err: any) {
      toast.error(isThai ? 'ไม่สามารถโหลดข้อมูลได้' : 'Failed to fetch accounts', { description: err.message });
      return null;
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
      const res = await fetch(`/api/admin/wallet/history?student_id=${account.student_id}&limit=30`);
      if (!res.ok) throw new Error('Failed to load history');
      const history = await res.json();
      setPanelHistory(history);
    } catch (err: any) {
      toast.error(isThai ? 'ไม่สามารถโหลดประวัติได้' : 'Failed to load history', { description: err.message });
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
    const loadingToast = toast.loading(isThai ? 'กำลังผูกบัตร...' : 'Linking card...');
    try {
      const res = await fetch('/api/admin/wallet', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'link_card', student_id: selectedAccount.student_id, card_uid: cardUIDInput.trim() })
      });
      if (!res.ok) throw new Error('Failed to link card');
      setLinkingCard(false);
      setCardUIDInput('');
      const newData = await fetchAccounts();
      const updated = newData?.find((a: any) => a.student_id === selectedAccount.student_id);
      if (updated) setSelectedAccount({ ...updated, card_uid: cardUIDInput.trim().toUpperCase() });
      toast.success(isThai ? 'ผูกบัตรสำเร็จ' : 'Card linked successfully', { id: loadingToast });
    } catch (err: any) {
      toast.error(isThai ? 'ไม่สามารถผูกบัตรได้' : 'Failed to link card', { id: loadingToast, description: err.message });
    }
  }

  async function handleSaveLimit() {
    if (!selectedAccount) return;
    const newLimit = limitInput.trim() === '' ? null : parseFloat(limitInput);
    if (newLimit !== null && (isNaN(newLimit) || newLimit < 0)) {
      toast.error(isThai ? 'กรุณากรอกวงเงินที่ถูกต้อง' : 'Please enter a valid limit');
      return;
    }
    const loadingToast = toast.loading(isThai ? 'กำลังอัปเดตวงเงิน...' : 'Updating limit...');
    try {
      const res = await fetch('/api/admin/wallet', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_limit', student_id: selectedAccount.student_id, daily_limit: newLimit })
      });
      if (!res.ok) throw new Error('Failed to update limit');
      setEditingLimit(false);
      await fetchAccounts();
      setSelectedAccount(prev => prev ? { ...prev, daily_limit: newLimit } : null);
      toast.success(isThai ? 'อัปเดตวงเงินสำเร็จ' : 'Daily limit updated successfully', { id: loadingToast });
    } catch (err: any) {
      toast.error(isThai ? 'ไม่สามารถอัปเดตวงเงินได้' : 'Failed to update limit', { id: loadingToast, description: err.message });
    }
  }

  async function handleAdjustment() {
    if (!selectedAccount || !adjAmount || !adjNote.trim()) return;
    setAdjProcessing(true);
    const loadingToast = toast.loading(isThai ? 'กำลังปรับยอด...' : 'Adjusting balance...');
    try {
      const amount = parseFloat(adjAmount);
      const res = await fetch('/api/admin/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: selectedAccount.student_id, amount, note: adjNote })
      });
      if (!res.ok) throw new Error('Failed to adjust balance');
      
      setShowAdjustment(false);
      setAdjAmount('');
      setAdjNote('');
      const newData = await fetchAccounts();
      
      const historyRes = await fetch(`/api/admin/wallet/history?student_id=${selectedAccount.student_id}&limit=30`);
      if (historyRes.ok) setPanelHistory(await historyRes.json());
      
      const updated = newData?.find((a: any) => a.student_id === selectedAccount.student_id);
      if (updated) setSelectedAccount(updated);
      toast.success(isThai ? 'ปรับยอดสำเร็จ' : 'Balance adjusted successfully', { id: loadingToast });
    } catch (err: any) {
      toast.error(isThai ? 'ปรับยอดไม่สำเร็จ' : 'Adjustment failed', { id: loadingToast, description: err.message });
    } finally {
      setAdjProcessing(false);
    }
  }

  const txTypeLabel: Record<string, { icon: React.ReactNode, text: string, color: string }> = {
    topup: { icon: <TrendingUp className="w-4 h-4"/>, text: isThai ? 'เติมเงิน' : 'Top-up', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' },
    purchase: { icon: <TrendingDown className="w-4 h-4"/>, text: isThai ? 'ซื้อสินค้า' : 'Purchase', color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40' },
    refund: { icon: <TrendingUp className="w-4 h-4"/>, text: isThai ? 'คืนเงิน' : 'Refund', color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40' },
    adjustment: { icon: <Settings className="w-4 h-4"/>, text: isThai ? 'ปรับยอด' : 'Adjustment', color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40' },
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden font-sans relative">
      {/* Main List */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${selectedAccount ? 'lg:pr-[480px]' : ''} p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full overflow-y-auto`}>
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-200/80 dark:border-slate-800 shadow-sm mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {dict.common.officialBadge}
                </span>
                <span className="text-xs text-slate-500 font-medium">{dict.wallet.servicePoint}</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                {dict.wallet.manageTitle}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {dict.wallet.manageSubtitle}
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder={dict.wallet.searchPlaceholder}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-[#7B1C3E] focus:ring-2 focus:ring-[#7B1C3E]/20 transition-all font-medium text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div className="flex gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-x-auto hide-scrollbar">
                {([
                  ['all', dict.common.all],
                  ['has_card', dict.wallet.hasCard],
                  ['no_card', dict.wallet.noCard],
                  ['low_balance', dict.wallet.lowBalance],
                ] as [FilterType, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap
                      ${filter === key ? 'bg-[#7B1C3E] text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="p-8 space-y-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 animate-pulse">
                    <div className="w-20 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl"></div>
                    <div className="flex-1 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl"></div>
                    <div className="w-24 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl"></div>
                    <div className="w-24 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl"></div>
                    <div className="w-20 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl"></div>
                  </div>
                ))}
              </div>
            ) : filteredAccounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4 min-h-[400px]">
                <Wallet className="w-20 h-20 opacity-20" />
                <p className="text-xl font-medium">{isThai ? 'ไม่พบข้อมูล Wallet' : 'No wallet accounts found'}</p>
              </div>
            ) : (
              <table className="w-full text-left min-w-[650px]">
                <thead className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-10 backdrop-blur-md">
                  <tr>
                    <th className="p-5 font-bold text-slate-500 text-xs uppercase tracking-wider">{dict.students.studentId}</th>
                    <th className="p-5 font-bold text-slate-500 text-xs uppercase tracking-wider">{dict.students.studentName}</th>
                    <th className="p-5 font-bold text-slate-500 text-xs uppercase tracking-wider text-right">{dict.wallet.currentBalance}</th>
                    <th className="p-5 font-bold text-slate-500 text-xs uppercase tracking-wider text-right">{dict.wallet.dailyLimit}</th>
                    <th className="p-5 font-bold text-slate-500 text-xs uppercase tracking-wider text-center">{isThai ? 'บัตร NFC' : 'NFC Card'}</th>
                    <th className="p-5 font-bold text-slate-500 text-xs uppercase tracking-wider text-center">{dict.common.status}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  <AnimatePresence>
                    {filteredAccounts.map(account => (
                      <motion.tr
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        layout
                        key={account.id}
                        onClick={() => openPanel(account)}
                        className={`hover:bg-[#7B1C3E]/[0.03] cursor-pointer transition-colors
                          ${account.balance < 50 ? 'bg-rose-50/30 dark:bg-rose-950/10' : account.balance < 100 ? 'bg-amber-50/30 dark:bg-amber-950/10' : ''} 
                          ${selectedAccount?.id === account.id ? 'bg-[#7B1C3E]/[0.05] shadow-inner' : ''}`}
                      >
                        <td className="p-5 font-mono font-bold text-slate-700 dark:text-slate-300">{account.student_id}</td>
                        <td className="p-5 font-bold text-slate-900 dark:text-white">{account.student_name || '-'}</td>
                        <td className={`p-5 text-right font-extrabold text-lg ${account.balance < 50 ? 'text-rose-600' : account.balance < 100 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {formatCurrency(account.balance)}
                        </td>
                        <td className="p-5 text-right font-medium text-slate-600 dark:text-slate-300">
                          {account.daily_limit !== null ? formatCurrency(account.daily_limit) : dict.wallet.unlimited}
                        </td>
                        <td className="p-5 text-center">
                          {account.card_uid ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                              <CheckCircle2 className="w-3 h-3" /> {isThai ? 'ผูกแล้ว' : 'Linked'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              {isThai ? 'ยังไม่ผูก' : 'Unlinked'}
                            </span>
                          )}
                        </td>
                        <td className="p-5 text-center">
                          <div className={`w-3 h-3 rounded-full mx-auto ${account.is_active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500'}`}></div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            )}
          </div>
          {!loading && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 text-center text-sm font-bold text-slate-500">
              {isThai ? `แสดง ${filteredAccounts.length} จาก ${accounts.length} รายการ` : `Showing ${filteredAccounts.length} of ${accounts.length} items`}
            </div>
          )}
        </div>
      </div>

      {/* Slide-in Panel */}
      <AnimatePresence>
        {selectedAccount && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closePanel}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full sm:max-w-[480px] bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col z-50"
            >
            {/* Panel Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-1">{selectedAccount.student_name || (isThai ? 'ไม่พบชื่อ' : 'Unknown')}</h2>
                <p className="text-sm font-bold text-slate-500 flex items-center gap-2">
                  <span className="font-mono bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">{selectedAccount.student_id}</span>
                </p>
              </div>
              <button onClick={closePanel} className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full hover:bg-slate-50 transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Balance */}
            <div className={`p-8 text-center border-b border-slate-100 dark:border-slate-800 ${selectedAccount.balance < 50 ? 'bg-rose-50 dark:bg-rose-950/20' : selectedAccount.balance < 100 ? 'bg-amber-50 dark:bg-amber-950/20' : 'bg-[#7B1C3E]/5'}`}>
              <p className="text-sm font-bold text-slate-500 mb-2 uppercase tracking-widest">{dict.wallet.currentBalance}</p>
              <p className={`text-5xl font-black mb-2 ${selectedAccount.balance < 50 ? 'text-rose-600' : selectedAccount.balance < 100 ? 'text-amber-600' : 'text-[#7B1C3E] dark:text-pink-400'}`}>
                {formatCurrency(selectedAccount.balance)}
              </p>
            </div>

            {/* Panel Body */}
            <div className="flex-1 overflow-auto p-6 space-y-6">
              {/* Daily Limit */}
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-5 rounded-2xl shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2 uppercase tracking-wider"><Activity className="w-4 h-4"/> {dict.wallet.dailyLimit}</span>
                  <button
                    onClick={() => { setEditingLimit(!editingLimit); setLimitInput(selectedAccount.daily_limit?.toString() || ''); }}
                    className="text-[#7B1C3E] dark:text-pink-400 text-sm font-bold hover:underline"
                  >
                    {editingLimit ? dict.common.cancel : dict.common.edit}
                  </button>
                </div>
                {editingLimit ? (
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={limitInput}
                      onChange={e => setLimitInput(e.target.value)}
                      placeholder={isThai ? 'ว่างเปล่า = ไม่จำกัด' : 'Empty = Unlimited'}
                      className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-bold outline-none focus:border-[#7B1C3E] focus:ring-2 focus:ring-[#7B1C3E]/20 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                    <button onClick={handleSaveLimit} className="px-5 py-2 bg-[#7B1C3E] hover:bg-[#681834] text-white text-sm font-bold rounded-xl transition-colors shadow-md shadow-[#7B1C3E]/20">{dict.common.save}</button>
                  </div>
                ) : (
                  <p className="font-extrabold text-2xl text-slate-900 dark:text-white">
                    {selectedAccount.daily_limit !== null ? formatCurrency(selectedAccount.daily_limit) : dict.wallet.unlimited}
                  </p>
                )}
              </div>

              {/* Card UID */}
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-5 rounded-2xl shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2 uppercase tracking-wider"><CreditCard className="w-4 h-4"/> {isThai ? 'บัตร NFC' : 'NFC Card'}</span>
                  <button
                    onClick={() => { setLinkingCard(!linkingCard); setCardUIDInput(''); }}
                    className="text-[#7B1C3E] dark:text-pink-400 text-sm font-bold hover:underline"
                  >
                    {linkingCard ? dict.common.cancel : (isThai ? 'ผูกบัตรใหม่' : 'Link Card')}
                  </button>
                </div>
                {linkingCard ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={cardUIDInput}
                      onChange={e => setCardUIDInput(e.target.value)}
                      placeholder={isThai ? 'แตะบัตรหรือกรอก UID...' : 'Tap card or enter UID...'}
                      className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-mono font-bold outline-none focus:border-[#7B1C3E] focus:ring-2 focus:ring-[#7B1C3E]/20 bg-white dark:bg-slate-900 uppercase text-slate-900 dark:text-white"
                      autoFocus
                    />
                    <button onClick={handleLinkCard} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-colors shadow-md shadow-emerald-600/20">{dict.wallet.linkCard}</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    {selectedAccount.card_uid ? (
                       <div className="flex flex-col">
                          <span className="font-mono text-xl font-bold text-slate-900 dark:text-white tracking-wider">{selectedAccount.card_uid}</span>
                          <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 mt-1"><CheckCircle2 className="w-3 h-3"/> Active</span>
                       </div>
                    ) : (
                      <span className="text-slate-400 font-bold italic">{isThai ? 'ยังไม่ได้ผูกบัตร' : 'No card linked'}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Adjustment Button */}
              <button
                onClick={() => setShowAdjustment(!showAdjustment)}
                className="w-full py-4 bg-slate-900 dark:bg-slate-800 border border-slate-800 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-xl active:scale-95"
              >
                <Settings className="w-5 h-5" /> {isThai ? 'ปรับปรุงยอดเงิน (Adjustment)' : 'Balance Adjustment'}
              </button>

              <AnimatePresence>
                {showAdjustment && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-amber-50 dark:bg-amber-950/30 p-5 rounded-2xl border border-amber-200 dark:border-amber-900 space-y-4">
                      <div>
                        <label className="block text-sm font-bold text-amber-900 dark:text-amber-300 mb-1">{isThai ? 'จำนวนเงิน (บวก = เพิ่ม, ลบ = หัก)' : 'Amount (+ to add, - to deduct)'}</label>
                        <input
                          type="number"
                          value={adjAmount}
                          onChange={e => setAdjAmount(e.target.value)}
                          placeholder={isThai ? 'เช่น 100 หรือ -50' : 'e.g. 100 or -50'}
                          className="w-full px-4 py-2 border border-amber-300 dark:border-amber-800 rounded-xl bg-white dark:bg-slate-900 focus:ring-2 focus:ring-amber-500/50 outline-none font-bold text-amber-900 dark:text-amber-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-amber-900 dark:text-amber-300 mb-1">{isThai ? 'เหตุผล (จำเป็น)' : 'Reason (Required)'}</label>
                        <input
                          type="text"
                          value={adjNote}
                          onChange={e => setAdjNote(e.target.value)}
                          placeholder={isThai ? 'เช่น แก้ไขยอดผิดพลาด' : 'e.g. Correction of previous error'}
                          className="w-full px-4 py-2 border border-amber-300 dark:border-amber-800 rounded-xl bg-white dark:bg-slate-900 focus:ring-2 focus:ring-amber-500/50 outline-none text-sm font-medium text-amber-900 dark:text-amber-100"
                        />
                      </div>
                      <button
                        onClick={handleAdjustment}
                        disabled={adjProcessing || !adjAmount || !adjNote.trim()}
                        className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold disabled:opacity-50 transition-colors shadow-lg shadow-amber-500/20"
                      >
                        {adjProcessing ? (isThai ? 'กำลังดำเนินการ...' : 'Processing...') : (isThai ? 'ยืนยันการปรับยอด' : 'Confirm Adjustment')}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Transaction History */}
              <div className="pt-4">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">
                  {isThai ? 'ประวัติธุรกรรม (30 รายการล่าสุด)' : 'Transaction History (Last 30)'}
                </h3>
                {panelLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                       <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse"></div>
                    ))}
                  </div>
                ) : panelHistory.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 border-dashed">
                    <Activity className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-400 font-bold">{isThai ? 'ยังไม่มีประวัติการทำรายการ' : 'No transaction history yet'}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {panelHistory.map((tx, i) => {
                      const typeInfo = txTypeLabel[tx.type] || { icon: <Activity className="w-4 h-4"/>, text: tx.type, color: 'text-slate-700 bg-slate-100' };
                      return (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          key={tx.id} 
                          className="flex justify-between items-center p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-slate-300 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${typeInfo.color}`}>
                              {typeInfo.icon}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white text-sm mb-0.5">{typeInfo.text}</p>
                              <p className="text-xs font-medium text-slate-500">
                                {formatDate(new Date(tx.created_at), { dateStyle: 'short', timeStyle: 'short' })}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-extrabold ${tx.type === 'purchase' ? 'text-rose-600' : tx.type === 'topup' ? 'text-emerald-600' : 'text-slate-900 dark:text-white'}`}>
                              {tx.type === 'purchase' ? '-' : '+'}{formatCurrency(tx.amount)}
                            </p>
                            <p className="text-xs font-bold text-slate-400 mt-0.5">{dict.wallet.currentBalance} {formatCurrency(tx.balance_after)}</p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
      </AnimatePresence>
    </div>
  );
}
