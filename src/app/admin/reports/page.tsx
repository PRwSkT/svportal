'use client';

import { useState, useEffect } from 'react';
import { getDailySummary, getAuditLogs } from '@/lib/supabase/reports';
import { exportToCSV } from '@/lib/export';

const formatTHB = (amount: number) => {
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(amount);
};

export default function ReportsPage() {
  const [dateStr, setDateStr] = useState<string>(() => {
    const today = new Date();
    const offset = today.getTimezoneOffset() * 60000;
    return (new Date(today.getTime() - offset)).toISOString().split('T')[0];
  });
  
  const [summary, setSummary] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const sum = await getDailySummary(dateStr);
      const logs = await getAuditLogs(50); // Get recent 50 logs
      setSummary(sum);
      setAuditLogs(logs);
      setIsLoading(false);
    };
    loadData();
  }, [dateStr]);

  const handleExportCSV = () => {
    if (!summary) return;
    
    const headers = ['วันที่', 'ยอดรวม', 'ค่าเทอม (จำนวน)', 'ค่าเทอม (บาท)', 'ร้านสหกรณ์ (จำนวน)', 'ร้านสหกรณ์ (บาท)', 'เติมเงิน (จำนวน)', 'เติมเงิน (บาท)'];
    const rows = [
      [
        summary.date,
        summary.total_received,
        summary.tuition_count,
        summary.tuition_amount,
        summary.shop_count,
        summary.shop_amount,
        summary.topup_count,
        summary.topup_amount
      ]
    ];
    
    exportToCSV(`summary_report_${summary.date}.csv`, headers, rows);
  };

  const handleExportAuditCSV = () => {
    if (auditLogs.length === 0) return;

    const headers = ['วัน/เวลา', 'ผู้ทำรายการ', 'การกระทำ', 'ตาราง', 'ID', 'ค่าเดิม', 'ค่าใหม่'];
    const rows = auditLogs.map(log => [
      new Date(log.created_at).toLocaleString('th-TH'),
      log.user_name || 'System',
      log.action,
      log.table_name,
      log.record_id,
      JSON.stringify(log.old_value || {}),
      JSON.stringify(log.new_value || {})
    ]);

    exportToCSV(`audit_logs_${dateStr}.csv`, headers, rows);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">รายงานการเงินและ Audit Trail</h1>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border flex items-center gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">เลือกวันที่</label>
          <input
            type="date"
            value={dateStr}
            onChange={(e) => setDateStr(e.target.value)}
            className="border rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center text-gray-500 py-12">กำลังโหลดข้อมูล...</div>
      ) : (
        <div className="space-y-8">
          {/* Summary Report */}
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-800">สรุปยอดประจำวัน</h2>
              <button
                onClick={handleExportCSV}
                className="bg-green-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-green-700 text-sm"
              >
                ดาวน์โหลด CSV
              </button>
            </div>
            <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-gray-500">ยอดรับรวม</p>
                <p className="text-2xl font-bold text-blue-600">{formatTHB(summary?.total_received || 0)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">ค่าเทอม ({summary?.tuition_count} รายการ)</p>
                <p className="text-2xl font-bold text-purple-600">{formatTHB(summary?.tuition_amount || 0)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">ร้านสหกรณ์ ({summary?.shop_count} รายการ)</p>
                <p className="text-2xl font-bold text-green-600">{formatTHB(summary?.shop_amount || 0)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">เติม Wallet ({summary?.topup_count} รายการ)</p>
                <p className="text-2xl font-bold text-orange-600">{formatTHB(summary?.topup_amount || 0)}</p>
              </div>
            </div>
          </div>

          {/* Audit Trail */}
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-800">Audit Trail (ล่าสุด 50 รายการ)</h2>
              <button
                onClick={handleExportAuditCSV}
                className="bg-gray-800 text-white px-4 py-2 rounded-xl font-bold hover:bg-gray-900 text-sm"
              >
                ดาวน์โหลด Audit CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="p-4 font-semibold text-gray-600">เวลา</th>
                    <th className="p-4 font-semibold text-gray-600">ผู้ทำรายการ</th>
                    <th className="p-4 font-semibold text-gray-600">Action</th>
                    <th className="p-4 font-semibold text-gray-600">รายละเอียด</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {auditLogs.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-gray-500">ไม่มีข้อมูลการเคลื่อนไหว</td></tr>
                  ) : auditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="p-4 text-gray-600 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('th-TH')}
                      </td>
                      <td className="p-4 font-medium text-gray-800 whitespace-nowrap">{log.user_name || 'System'}</td>
                      <td className="p-4 text-blue-600 font-medium whitespace-nowrap">{log.action}</td>
                      <td className="p-4 text-gray-500 font-mono text-xs max-w-xs truncate" title={`${log.table_name}:${log.record_id}`}>
                        {log.table_name}:{log.record_id}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
