'use client';

import { useState, useEffect } from 'react';
import { exportToCSV } from '@/lib/export';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { FileBarChart, Download, Calendar, Activity, Banknote, ShoppingBag, Wallet } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function ReportsPage() {
  const { dict, isThai, formatDate, formatCurrency } = useLanguage();
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
      try {
        const res = await fetch(`/api/admin/reports?date=${dateStr}&limit=50`);
        if (!res.ok) throw new Error('Failed to fetch reports');
        const data = await res.json();
        setSummary(data.summary);
        setAuditLogs(data.auditLogs);
      } catch (err: any) {
        toast.error(isThai ? 'ไม่สามารถโหลดข้อมูลรายงานได้' : 'Failed to load report data', { description: err.message });
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [dateStr, isThai]);

  const handleExportCSV = () => {
    if (!summary) return;
    
    const headers = isThai 
      ? ['วันที่', 'ยอดรวม', 'ค่าเทอม (จำนวน)', 'ค่าเทอม (บาท)', 'ร้านสหกรณ์ (จำนวน)', 'ร้านสหกรณ์ (บาท)', 'เติมเงิน (จำนวน)', 'เติมเงิน (บาท)']
      : ['Date', 'Total', 'Tuition Count', 'Tuition (THB)', 'Co-op Count', 'Co-op (THB)', 'Top-up Count', 'Top-up (THB)'];
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
    toast.success(isThai ? 'ดาวน์โหลดรายงานสรุปยอดเรียบร้อย' : 'Summary report exported successfully');
  };

  const handleExportAuditCSV = () => {
    if (auditLogs.length === 0) return;

    const headers = isThai 
      ? ['วัน/เวลา', 'ผู้ทำรายการ', 'การกระทำ', 'ตาราง', 'ID', 'ค่าเดิม', 'ค่าใหม่']
      : ['Date / Time', 'Operator', 'Action', 'Table', 'Record ID', 'Old Value', 'New Value'];
    const rows = auditLogs.map(log => [
      new Date(log.created_at).toLocaleString(isThai ? 'th-TH' : 'en-US'),
      log.user_name || 'System',
      log.action,
      log.table_name,
      log.record_id,
      JSON.stringify(log.old_value || {}),
      JSON.stringify(log.new_value || {})
    ]);

    exportToCSV(`audit_logs_${dateStr}.csv`, headers, rows);
    toast.success(isThai ? 'ดาวน์โหลด Audit Trail เรียบร้อย' : 'Audit trail exported successfully');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8 font-sans"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-6 bg-white dark:bg-slate-900 backdrop-blur-xl p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#7B1C3E]/10 text-[#7B1C3E] dark:text-pink-400 rounded-2xl flex items-center justify-center shrink-0 border border-[#7B1C3E]/20">
            <FileBarChart className="w-6 h-6 sm:w-8 sm:h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {isThai ? 'รายงานและการตรวจสอบ' : 'Financial Reports & Audit Trail'}
              </h1>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                {dict.common.officialBadge}
              </span>
            </div>
            <p className="text-slate-500 text-xs sm:text-sm font-medium mt-0.5">
              {isThai ? 'สรุปยอดประจำวันและประวัติการทำรายการ (Audit Trail)' : 'Daily financial summary and system transaction audit trail'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Date Shortcuts */}
          <button
            type="button"
            onClick={() => {
              const today = new Date();
              const offset = today.getTimezoneOffset() * 60000;
              setDateStr((new Date(today.getTime() - offset)).toISOString().split('T')[0]);
            }}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-[#7B1C3E]/10 hover:text-[#7B1C3E] text-slate-700 dark:text-slate-300 transition-colors border border-slate-200 dark:border-slate-700"
          >
            {dict.dashboard.today}
          </button>
          <button
            type="button"
            onClick={() => {
              const yesterday = new Date(Date.now() - 86400000);
              const offset = yesterday.getTimezoneOffset() * 60000;
              setDateStr((new Date(yesterday.getTime() - offset)).toISOString().split('T')[0]);
            }}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-[#7B1C3E]/10 hover:text-[#7B1C3E] text-slate-700 dark:text-slate-300 transition-colors border border-slate-200 dark:border-slate-700"
          >
            {dict.dashboard.yesterday}
          </button>

          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
            <Calendar className="w-4 h-4 text-[#7B1C3E] dark:text-pink-400 shrink-0" />
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="bg-transparent border-none focus:ring-0 text-slate-900 dark:text-white text-sm font-bold outline-none cursor-pointer pr-1"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-8">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-lg border border-slate-200 dark:border-slate-800 p-6 h-48 animate-pulse flex flex-col justify-between">
            <div className="w-48 h-8 bg-slate-100 dark:bg-slate-800 rounded-xl"></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl"></div>
              ))}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-lg border border-slate-200 dark:border-slate-800 p-6 h-96 animate-pulse">
            <div className="w-48 h-8 bg-slate-100 dark:bg-slate-800 rounded-xl mb-6"></div>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 rounded-xl"></div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Summary Report */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 backdrop-blur-xl rounded-3xl shadow-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50 dark:bg-slate-800/30">
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Banknote className="w-5 h-5 text-[#7B1C3E] dark:text-pink-400" /> {isThai ? 'สรุปยอดประจำวัน' : 'Daily Revenue Summary'} ({formatDate(new Date(dateStr + 'T00:00:00+07:00'), { dateStyle: 'medium' })})
              </h2>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 bg-[#7B1C3E] hover:bg-[#681834] text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-md shadow-[#7B1C3E]/20 active:scale-95 text-sm"
              >
                <Download className="w-4 h-4" /> {isThai ? 'ดาวน์โหลด CSV' : 'Download CSV'}
              </button>
            </div>
            <div className="p-4 sm:p-6 md:p-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              <div className="bg-[#7B1C3E]/5 dark:bg-[#7B1C3E]/10 p-4 sm:p-6 rounded-2xl border border-[#7B1C3E]/10">
                <p className="text-xs sm:text-sm font-bold text-[#7B1C3E] dark:text-pink-400 mb-2">{dict.dashboard.totalReceived}</p>
                <p className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#7B1C3E] dark:text-pink-400">{formatCurrency(summary?.total_received || 0)}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300">{dict.dashboard.tuitionFees}</p>
                  <span className="text-[10px] sm:text-xs font-bold bg-white dark:bg-slate-700 px-2 py-1 rounded-full text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">{summary?.tuition_count} {dict.dashboard.items}</span>
                </div>
                <p className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white">{formatCurrency(summary?.tuition_amount || 0)}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1"><ShoppingBag className="w-4 h-4"/> {dict.dashboard.coopShop}</p>
                  <span className="text-[10px] sm:text-xs font-bold bg-white dark:bg-slate-700 px-2 py-1 rounded-full text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">{summary?.shop_count} {dict.dashboard.items}</span>
                </div>
                <p className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white">{formatCurrency(summary?.shop_amount || 0)}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1"><Wallet className="w-4 h-4"/> {dict.dashboard.walletTopup}</p>
                  <span className="text-[10px] sm:text-xs font-bold bg-white dark:bg-slate-700 px-2 py-1 rounded-full text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">{summary?.topup_count} {dict.dashboard.items}</span>
                </div>
                <p className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white">{formatCurrency(summary?.topup_amount || 0)}</p>
              </div>
            </div>
          </motion.div>

          {/* Audit Trail */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 backdrop-blur-xl rounded-3xl shadow-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden"
          >
            <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50 dark:bg-slate-800/30">
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#7B1C3E] dark:text-pink-400" /> {isThai ? 'Audit Trail (ล่าสุด 50 รายการ)' : 'Audit Trail (Recent 50 Activities)'}
              </h2>
              <button
                onClick={handleExportAuditCSV}
                className="flex items-center gap-2 bg-[#7B1C3E] hover:bg-[#681834] text-white px-4 sm:px-5 py-2.5 rounded-xl font-bold transition-all shadow-md shadow-[#7B1C3E]/20 active:scale-95 text-xs sm:text-sm"
              >
                <Download className="w-4 h-4" /> {isThai ? 'ดาวน์โหลด Audit CSV' : 'Download Audit CSV'}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[650px]">
                <thead className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="p-5 font-bold text-slate-500 text-xs uppercase tracking-wider">{isThai ? 'วัน/เวลา' : 'Date / Time'}</th>
                    <th className="p-5 font-bold text-slate-500 text-xs uppercase tracking-wider">{isThai ? 'ผู้ทำรายการ' : 'Operator'}</th>
                    <th className="p-5 font-bold text-slate-500 text-xs uppercase tracking-wider">{isThai ? 'การกระทำ' : 'Action'}</th>
                    <th className="p-5 font-bold text-slate-500 text-xs uppercase tracking-wider">{isThai ? 'รายละเอียด' : 'Details'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {auditLogs.length === 0 ? (
                    <tr><td colSpan={4} className="p-12 text-center text-slate-400 font-medium">{isThai ? 'ไม่มีข้อมูลการเคลื่อนไหวในขณะนี้' : 'No audit trail logs recorded for this date'}</td></tr>
                  ) : auditLogs.map((log, i) => (
                    <motion.tr 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02 }}
                      key={log.id} 
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="p-5 text-sm font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {formatDate(new Date(log.created_at), { dateStyle: 'short', timeStyle: 'medium' })}
                      </td>
                      <td className="p-5 font-bold text-[#7B1C3E] dark:text-pink-400 whitespace-nowrap">{log.user_name || 'System'}</td>
                      <td className="p-5 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase ${
                          log.action === 'INSERT' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' :
                          log.action === 'UPDATE' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300' :
                          log.action === 'DELETE' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300' :
                          'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="p-5 font-mono text-xs text-slate-500 w-full">
                        <div className="flex flex-col gap-1 max-w-xl">
                          <span className="font-bold text-slate-700 dark:text-slate-300">Table: {log.table_name} <span className="font-normal text-slate-400">(ID: {log.record_id})</span></span>
                          {log.action === 'UPDATE' && log.new_value && (
                            <span className="truncate opacity-70">Changes recorded</span>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
