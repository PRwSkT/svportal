'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Calendar,
  CheckCircle2,
  DollarSign,
  FileText,
  Plus,
  Receipt,
  RefreshCw,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  KITCHEN_COA_CODE,
  KITCHEN_COA_NAME,
  KITCHEN_VOUCHER_CATEGORIES,
  KITCHEN_VOUCHER_CATEGORY_LABELS,
  getKitchenBangkokDate,
  type KitchenCostSummary,
  type KitchenVoucherCategory,
} from '@/lib/kitchen/inhouse-kitchen-engine';

interface VoucherRow {
  id: string;
  voucher_date: string;
  supplier_name: string;
  category: KitchenVoucherCategory;
  description: string;
  quantity?: number | null;
  unit?: string | null;
  amount: number;
  receipt_no?: string | null;
  coa_code: string;
  status: 'RECORDED' | 'VOID';
  void_reason?: string | null;
  recorded_by?: string | null;
}

export default function KitchenCostTab() {
  const today = getKitchenBangkokDate();
  const [monthStr, setMonthStr] = useState<string>(() => today.slice(0, 7)); // YYYY-MM
  const [summary, setSummary] = useState<KitchenCostSummary | null>(null);
  const [vouchers, setVouchers] = useState<VoucherRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // New voucher form
  const [newVoucher, setNewVoucher] = useState({
    voucher_date: today,
    supplier_name: '',
    category: 'MEAT' as KitchenVoucherCategory,
    description: '',
    quantity: '',
    unit: '',
    amount: '',
    receipt_no: '',
  });

  const from = `${monthStr}-01`;
  const to = (() => {
    const [y, m] = monthStr.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    return `${monthStr}-${String(lastDay).padStart(2, '0')}`;
  })();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [costRes, vouchersRes] = await Promise.all([
        fetch(`/api/admin/kitchen?action=cost&from=${from}&to=${to}`),
        fetch(`/api/admin/kitchen?action=vouchers&from=${from}&to=${to}`),
      ]);

      const costJson = await costRes.json();
      const vouchersJson = await vouchersRes.json();

      if (costRes.ok) setSummary(costJson.summary);
      if (vouchersRes.ok) setVouchers(vouchersJson.vouchers || []);
    } catch (err) {
      toast.error('โหลดข้อมูลงบประมาณวัตถุดิบไม่สำเร็จ');
    } finally {
      setIsLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVoucher.supplier_name.trim() || !newVoucher.description.trim()) {
      toast.error('กรุณาระบุร้านค้าและรายละเอียดวัตถุดิบ');
      return;
    }
    const amt = parseFloat(newVoucher.amount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('กรุณาระบุจำนวนเงินที่ถูกต้อง');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/kitchen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_voucher',
          ...newVoucher,
          amount: amt,
          quantity: newVoucher.quantity ? parseFloat(newVoucher.quantity) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'บันทึกใบสำคัญจ่ายไม่สำเร็จ');

      toast.success('บันทึกใบสำคัญจ่ายวัตถุดิบเรียบร้อยแล้ว');
      setShowAddModal(false);
      setNewVoucher({
        voucher_date: today,
        supplier_name: '',
        category: 'MEAT',
        description: '',
        quantity: '',
        unit: '',
        amount: '',
        receipt_no: '',
      });
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'บันทึกใบสำคัญจ่ายไม่สำเร็จ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVoidVoucher = async (id: string) => {
    const reason = prompt('กรุณาระบุเหตุผลในการยกเลิกใบสำคัญจ่ายนี้ (อย่างน้อย 5 ตัวอักษร):');
    if (!reason || reason.trim().length < 5) {
      if (reason !== null) toast.error('เหตุผลต้องมีอย่างน้อย 5 ตัวอักษร');
      return;
    }

    try {
      const res = await fetch('/api/admin/kitchen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'void_voucher',
          id,
          reason: reason.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'ยกเลิกไม่สำเร็จ');
      toast.success('ยกเลิกใบสำคัญจ่ายเรียบร้อยแล้ว');
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ยกเลิกไม่สำเร็จ');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 font-mono">
              COA {KITCHEN_COA_CODE}
            </span>
            <span className="text-xs text-slate-500 font-semibold">{KITCHEN_COA_NAME}</span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Banknote className="w-6 h-6 text-[#7B1C3E]" />
            ควบคุมต้นทุนวัตถุดิบโรงครัวรายวัน & รายเดือน
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            บันทึกใบสำคัญจ่ายซื้อของสด/วัตถุดิบ คำนวณต้นทุนเฉลี่ยต่อมื้อ/คน เทียบกับงบประมาณที่รวมอยู่ในค่าเทอม
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <Calendar className="w-4 h-4 text-slate-500" />
            <input
              type="month"
              value={monthStr}
              onChange={(e) => setMonthStr(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
            />
          </div>
          <button
            onClick={() => fetchData()}
            disabled={isLoading}
            className="p-2 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 text-slate-600"
            title="รีเฟรช"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#7B1C3E] hover:bg-[#681834] text-white font-bold rounded-xl shadow-md text-xs sm:text-sm"
          >
            <Plus className="w-4 h-4" /> บันทึกใบเสร็จ/จ่ายวัตถุดิบ
          </button>
        </div>
      </div>

      {/* Analytics KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <p className="text-xs font-bold text-slate-400">ค่าวัตถุดิบรวมทั้งเดือน</p>
            <p className="text-2xl font-extrabold text-[#7B1C3E]">
              {summary.totalCost.toLocaleString('th-TH', { minimumFractionDigits: 2 })}{' '}
              <span className="text-xs font-normal text-slate-400">บาท</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">ผังบัญชี สช. ม.32 รหัส 52200</p>
          </div>

          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <p className="text-xs font-bold text-slate-400">จำนวนมื้อ/ถาดทั้งหมด</p>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {summary.totalTrays.toLocaleString()}{' '}
              <span className="text-xs font-normal text-slate-400">ถาด</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">รวมนักเรียนและบุคลากร</p>
          </div>

          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <p className="text-xs font-bold text-slate-400">ต้นทุนเฉลี่ยต่อมื้อ/คน</p>
            <p className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400">
              {summary.averageCostPerTray != null ? summary.averageCostPerTray.toFixed(2) : '-'}{' '}
              <span className="text-xs font-normal text-slate-400">บาท</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              เป้าหมาย {summary.targetPerTray.toFixed(2)} บาท/คน
            </p>
          </div>

          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <p className="text-xs font-bold text-slate-400">สถานะเทียบงบประมาณ</p>
            {summary.budgetVariance != null ? (
              summary.budgetVariance <= 0 ? (
                <>
                  <p className="text-xl font-extrabold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-5 h-5" /> ต่ำกว่างบ {Math.abs(summary.budgetVariance).toFixed(2)} บ.
                  </p>
                  <p className="text-[11px] text-emerald-700 mt-0.5">ควบคุมต้นทุนได้ตามเกณฑ์</p>
                </>
              ) : (
                <>
                  <p className="text-xl font-extrabold text-red-600 flex items-center gap-1">
                    <AlertTriangle className="w-5 h-5" /> เกินงบ +{summary.budgetVariance.toFixed(2)} บ.
                  </p>
                  <p className="text-[11px] text-red-600 mt-0.5">ควรตรวจสอบปริมาณอาหารเหลือทิ้ง</p>
                </>
              )
            ) : (
              <p className="text-lg font-bold text-slate-400">-</p>
            )}
          </div>
        </div>
      )}

      {/* Category Breakdown Bar */}
      {summary && Object.keys(summary.byCategory).length > 0 && (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
            สัดส่วนค่าใช้จ่ายแยกตามหมวดวัตถุดิบ
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {Object.entries(summary.byCategory).map(([cat, amt]) => (
              <div key={cat} className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                <span className="text-[11px] text-slate-500 font-medium block">
                  {KITCHEN_VOUCHER_CATEGORY_LABELS[cat as KitchenVoucherCategory] || cat}
                </span>
                <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {amt.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บ.
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vouchers Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#7B1C3E]" />
            รายการใบสำคัญจ่ายซื้อวัตถุดิบ ({vouchers.length} รายการ)
          </h3>
          <span className="text-xs text-slate-400">ประจำเดือน {monthStr}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">วันที่</th>
                <th className="py-3 px-3">หมวด</th>
                <th className="py-3 px-4">ร้านค้า / ผู้ขาย</th>
                <th className="py-3 px-4">รายการวัตถุดิบ</th>
                <th className="py-3 px-3 text-right">จำนวน</th>
                <th className="py-3 px-4 text-right">ยอดเงิน (บาท)</th>
                <th className="py-3 px-3">สถานะ</th>
                <th className="py-3 px-3 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {vouchers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    ยังไม่มีรายการใบสำคัญจ่ายในเดือนนี้
                  </td>
                </tr>
              ) : (
                vouchers.map((v) => {
                  const isVoid = v.status === 'VOID';
                  return (
                    <tr
                      key={v.id}
                      className={isVoid ? 'opacity-50 bg-slate-50/50 line-through' : 'hover:bg-slate-50/60'}
                    >
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                        {v.voucher_date}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {KITCHEN_VOUCHER_CATEGORY_LABELS[v.category] || v.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        {v.supplier_name}
                        {v.receipt_no && (
                          <span className="block text-[10px] font-mono text-slate-400 font-normal">
                            บิล: {v.receipt_no}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{v.description}</td>
                      <td className="py-3 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                        {v.quantity ? `${v.quantity} ${v.unit || ''}` : '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-extrabold text-slate-900 dark:text-white">
                        {Number(v.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3">
                        {isVoid ? (
                          <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                            ยกเลิก ({v.void_reason})
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                            สมบูรณ์
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {!isVoid && (
                          <button
                            onClick={() => handleVoidVoucher(v.id)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                            title="ยกเลิกใบสำคัญจ่าย"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Voucher Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#7B1C3E]" /> บันทึกใบสำคัญจ่ายซื้อวัตถุดิบ (COA 52200)
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateVoucher} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">วันที่ซื้อ</label>
                  <input
                    type="date"
                    required
                    value={newVoucher.voucher_date}
                    onChange={(e) => setNewVoucher({ ...newVoucher, voucher_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">หมวดวัตถุดิบ</label>
                  <select
                    value={newVoucher.category}
                    onChange={(e) => setNewVoucher({ ...newVoucher, category: e.target.value as KitchenVoucherCategory })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                  >
                    {KITCHEN_VOUCHER_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {KITCHEN_VOUCHER_CATEGORY_LABELS[cat]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ชื่อร้านค้า / ตลาดสด / ซัพพลายเออร์ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น ตลาดสดเทศบาล / แม็คโคร..."
                  value={newVoucher.supplier_name}
                  onChange={(e) => setNewVoucher({ ...newVoucher, supplier_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  รายการวัตถุดิบที่ซื้อ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น สันในไก่ 15 กก., ไข่ไก่เบอร์ 3 จำนวน 2 แผง..."
                  value={newVoucher.description}
                  onChange={(e) => setNewVoucher({ ...newVoucher, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">ปริมาณ (ตัวเลข)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="เช่น 15"
                    value={newVoucher.quantity}
                    onChange={(e) => setNewVoucher({ ...newVoucher, quantity: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">หน่วยนับ</label>
                  <input
                    type="text"
                    placeholder="เช่น กก., แผง, ลัง"
                    value={newVoucher.unit}
                    onChange={(e) => setNewVoucher({ ...newVoucher, unit: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    ยอดเงินรวม (บาท) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={newVoucher.amount}
                    onChange={(e) => setNewVoucher({ ...newVoucher, amount: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">เลขที่บิล / ใบเสร็จ (ถ้ามี)</label>
                  <input
                    type="text"
                    placeholder="เลขที่ใบเสร็จ"
                    value={newVoucher.receipt_no}
                    onChange={(e) => setNewVoucher({ ...newVoucher, receipt_no: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-600"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[#7B1C3E] hover:bg-[#681834] text-white font-bold rounded-xl text-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกใบสำคัญจ่าย'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
