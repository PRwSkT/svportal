'use client';

import { useState, useEffect } from 'react';
import { WalletAccount } from '@/types';
import { getAllWalletAccounts, linkCardToStudent, updateDailyLimit, adjustBalance, getWalletHistory } from '@/lib/supabase/wallet';
import type { WalletTransaction } from '@/types';

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

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAccounts();
  }, []);

  async function fetchAccounts() {
    setLoading(true);
    try {
      const data = await getAllWalletAccounts();
      setAccounts(data);
    } catch (err) {
      console.error(err);
      setError('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  }

  const filteredAccounts = accounts.filter(a => {
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!a.student_id.includes(q) && !(a.student_name?.toLowerCase().includes(q))) return false;
    }
    // Category filter
    switch (filter) {
      case 'has_card': return a.card_uid !== null;
      case 'no_card': return a.card_uid === null;
      case 'low_balance': return a.balance < 50; // Thai Baht
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
    } catch (err) {
      console.error(err);
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
    try {
      await linkCardToStudent(selectedAccount.student_id, cardUIDInput.trim());
      setLinkingCard(false);
      setCardUIDInput('');
      await fetchAccounts();
      // Refresh panel
      const updated = accounts.find(a => a.student_id === selectedAccount.student_id);
      if (updated) setSelectedAccount({ ...updated, card_uid: cardUIDInput.trim().toUpperCase() });
    } catch (err) {
      console.error(err);
      setError('ไม่สามารถผูกบัตรได้');
    }
  }

  async function handleSaveLimit() {
    if (!selectedAccount) return;
    const newLimit = limitInput.trim() === '' ? null : parseFloat(limitInput);
    if (newLimit !== null && (isNaN(newLimit) || newLimit < 0)) {
      setError('กรุณากรอกวงเงินที่ถูกต้อง');
      return;
    }
    try {
      await updateDailyLimit(selectedAccount.student_id, newLimit); // Thai Baht
      setEditingLimit(false);
      await fetchAccounts();
      setSelectedAccount(prev => prev ? { ...prev, daily_limit: newLimit } : null);
    } catch (err) {
      console.error(err);
      setError('ไม่สามารถอัปเดตวงเงินได้');
    }
  }

  async function handleAdjustment() {
    if (!selectedAccount || !adjAmount || !adjNote.trim()) return;
    setAdjProcessing(true);
    try {
      const amount = parseFloat(adjAmount); // Thai Baht
      await adjustBalance(selectedAccount.student_id, amount, adjNote);
      setShowAdjustment(false);
      setAdjAmount('');
      setAdjNote('');
      await fetchAccounts();
      // Refresh panel
      const history = await getWalletHistory(selectedAccount.student_id, 30);
      setPanelHistory(history);
      const updated = accounts.find(a => a.student_id === selectedAccount.student_id);
      if (updated) setSelectedAccount(updated);
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(`ปรับยอดไม่สำเร็จ: ${e.message}`);
    } finally {
      setAdjProcessing(false);
    }
  }

  const txTypeLabel: Record<string, string> = {
    topup: '💰 เติมเงิน',
    purchase: '🛒 ซื้อสินค้า',
    refund: '↩️ คืนเงิน',
    adjustment: '⚙️ ปรับยอด',
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Main List */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${selectedAccount ? 'mr-[480px]' : ''}`}>
        <div className="p-6 bg-white border-b shadow-sm">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">จัดการ Wallet นักเรียน</h1>

          <div className="flex flex-wrap gap-4 items-center">
            <input
              type="text"
              placeholder="ค้นหารหัสหรือชื่อนักเรียน..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <div className="flex gap-2">
              {([
                ['all', 'ทั้งหมด'],
                ['has_card', 'มีบัตร'],
                ['no_card', 'ไม่มีบัตร'],
                ['low_balance', 'ยอดต่ำ'],
              ] as [FilterType, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                    ${filter === key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">ปิด</button>
          </div>
        )}

        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="text-center py-20 text-gray-400 text-lg">กำลังโหลด...</div>
          ) : (
            <table className="w-full bg-white rounded-xl shadow-sm overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">รหัส</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">ชื่อนักเรียน</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">ยอดคงเหลือ</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">วงเงิน/วัน</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-500">บัตร NFC</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-500">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAccounts.map(account => (
                  <tr
                    key={account.id}
                    onClick={() => openPanel(account)}
                    className={`hover:bg-blue-50 cursor-pointer transition-colors
                      ${account.balance < 100 ? 'bg-amber-50/50' : ''} 
                      ${selectedAccount?.id === account.id ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-4 py-3 font-mono font-medium text-gray-800">{account.student_id}</td>
                    <td className="px-4 py-3 text-gray-700">{account.student_name || '-'}</td>
                    <td className={`px-4 py-3 text-right font-bold ${account.balance < 50 ? 'text-red-600' : account.balance < 100 ? 'text-amber-600' : 'text-green-600'}`}>
                      ฿{account.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {account.daily_limit !== null ? `${account.daily_limit.toLocaleString('en-US')} บาท` : 'ไม่จำกัด'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {account.card_uid ? (
                        <span className="text-green-600 bg-green-50 px-2 py-1 rounded text-xs font-medium">ผูกแล้ว</span>
                      ) : (
                        <span className="text-gray-400 bg-gray-50 px-2 py-1 rounded text-xs">ยังไม่ผูก</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {account.is_active ? (
                        <span className="text-green-600">●</span>
                      ) : (
                        <span className="text-red-500">●</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="text-sm text-gray-400 mt-4 text-center">
            แสดง {filteredAccounts.length} จาก {accounts.length} รายการ
          </div>
        </div>
      </div>

      {/* Slide-in Panel */}
      {selectedAccount && (
        <div className="fixed right-0 top-0 bottom-0 w-[480px] bg-white shadow-2xl border-l flex flex-col z-40 animate-in slide-in-from-right duration-200">
          {/* Panel Header */}
          <div className="p-6 bg-gray-50 border-b flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-gray-800">{selectedAccount.student_name || 'ไม่พบชื่อ'}</h2>
              <p className="text-sm text-gray-500">รหัส: {selectedAccount.student_id}</p>
            </div>
            <button onClick={closePanel} className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-600">✕</button>
          </div>

          {/* Balance */}
          <div className={`p-6 text-center border-b ${selectedAccount.balance < 100 ? 'bg-amber-50' : 'bg-blue-50'}`}>
            <p className="text-sm text-gray-500 mb-1">ยอดคงเหลือ</p>
            <p className={`text-4xl font-extrabold ${selectedAccount.balance < 50 ? 'text-red-600' : selectedAccount.balance < 100 ? 'text-amber-600' : 'text-blue-700'}`}>
              ฿{selectedAccount.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-400 mt-1">บาท</p>
          </div>

          {/* Panel Body */}
          <div className="flex-1 overflow-auto p-6 space-y-6">
            {/* Daily Limit */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-600">วงเงินรายวัน</span>
                <button
                  onClick={() => { setEditingLimit(!editingLimit); setLimitInput(selectedAccount.daily_limit?.toString() || ''); }}
                  className="text-blue-600 text-sm hover:underline"
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
                    className="flex-1 px-3 py-2 border rounded-lg text-sm"
                  />
                  <button onClick={handleSaveLimit} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">บันทึก</button>
                </div>
              ) : (
                <p className="font-bold text-lg">
                  {selectedAccount.daily_limit !== null ? `${selectedAccount.daily_limit.toLocaleString('en-US')} บาท/วัน` : 'ไม่จำกัด'}
                </p>
              )}
            </div>

            {/* Card UID */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-600">บัตร NFC</span>
                <button
                  onClick={() => { setLinkingCard(!linkingCard); setCardUIDInput(''); }}
                  className="text-blue-600 text-sm hover:underline"
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
                    placeholder="สแกนหรือกรอก UID บัตร..."
                    className="flex-1 px-3 py-2 border rounded-lg text-sm font-mono"
                    autoFocus
                  />
                  <button onClick={handleLinkCard} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">ผูก</button>
                </div>
              ) : (
                <p className="font-mono text-lg">
                  {selectedAccount.card_uid || <span className="text-gray-400">ยังไม่ได้ผูกบัตร</span>}
                </p>
              )}
            </div>

            {/* Adjustment Button */}
            <button
              onClick={() => setShowAdjustment(!showAdjustment)}
              className="w-full py-3 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-900 transition-colors"
            >
              ⚙️ ปรับยอด (Adjustment)
            </button>

            {showAdjustment && (
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนเงิน (บวก = เพิ่ม, ลบ = หัก)</label>
                  <input
                    type="number"
                    value={adjAmount}
                    onChange={e => setAdjAmount(e.target.value)}
                    placeholder="เช่น 100 หรือ -50"
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">เหตุผล (จำเป็น)</label>
                  <input
                    type="text"
                    value={adjNote}
                    onChange={e => setAdjNote(e.target.value)}
                    placeholder="เช่น แก้ไขยอดผิดพลาด"
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <button
                  onClick={handleAdjustment}
                  disabled={adjProcessing || !adjAmount || !adjNote.trim()}
                  className="w-full py-2 bg-yellow-600 text-white rounded-lg font-medium hover:bg-yellow-700 disabled:opacity-50"
                >
                  {adjProcessing ? 'กำลังดำเนินการ...' : 'ยืนยันปรับยอด'}
                </button>
              </div>
            )}

            {/* Transaction History */}
            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-3">ประวัติธุรกรรม (30 รายการล่าสุด)</h3>
              {panelLoading ? (
                <p className="text-gray-400 text-sm text-center py-4">กำลังโหลด...</p>
              ) : panelHistory.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">ยังไม่มีธุรกรรม</p>
              ) : (
                <div className="space-y-2">
                  {panelHistory.map(tx => (
                    <div key={tx.id} className="flex justify-between items-center p-3 bg-white rounded-lg border border-gray-100 text-sm">
                      <div>
                        <p className="font-medium">{txTypeLabel[tx.type] || tx.type}</p>
                        <p className="text-xs text-gray-400">
                          {new Intl.DateTimeFormat('th-TH', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(tx.created_at))}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${tx.type === 'purchase' ? 'text-red-600' : 'text-green-600'}`}>
                          {tx.type === 'purchase' ? '-' : '+'}฿{tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-gray-400">คงเหลือ ฿{tx.balance_after.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
