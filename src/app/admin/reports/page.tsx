'use client';

import { useState, useEffect } from 'react';
import { getDailySummary, getAuditLogs } from '@/lib/supabase/reports';
import { exportToCSV } from '@/lib/export';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { FileBarChart, Download, Calendar, Activity, Banknote, ShoppingBag, Wallet } from 'lucide-react';

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
      try {
        const sum = await getDailySummary(dateStr);
        const logs = await getAuditLogs(50); // Get recent 50 logs
        setSummary(sum);
        setAuditLogs(logs);
      } catch (err: any) {
        toast.error('ไม่สามารถโหลดข้อมูลรายงานได้', { description: err.message });
      } finally {
        setIsLoading(false);
      }
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
    toast.success('ดาวน์โหลดรายงานสรุปยอดเรียบร้อย');
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
    toast.success('ดาวน์โหลด Audit Trail เรียบร้อย');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-8 max-w-7xl mx-auto space-y-8 font-sans"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-surface/80 backdrop-blur-xl p-6 rounded-3xl shadow-lg border border-white/20">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
            <FileBarChart className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-primary mb-1">รายงานและการตรวจสอบ</h1>
            <p className="text-foreground/60 font-medium">สรุปยอดประจำวันและประวัติการทำรายการ (Audit Trail)</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 bg-background p-2 rounded-2xl border border-foreground/10">
          <div className="w-10 h-10 bg-primary/5 rounded-xl flex items-center justify-center text-primary">
            <Calendar className="w-5 h-5" />
          </div>
          <input
            type="date"
            value={dateStr}
            onChange={(e) => setDateStr(e.target.value)}
            className="bg-transparent border-none focus:ring-0 text-foreground font-bold outline-none cursor-pointer pr-4"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-8">
          <div className="bg-surface/80 rounded-3xl shadow-lg border p-6 h-48 animate-pulse flex flex-col justify-between">
            <div className="w-48 h-8 bg-foreground/5 rounded-xl"></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 bg-foreground/5 rounded-2xl"></div>
              ))}
            </div>
          </div>
          <div className="bg-surface/80 rounded-3xl shadow-lg border p-6 h-96 animate-pulse">
            <div className="w-48 h-8 bg-foreground/5 rounded-xl mb-6"></div>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-foreground/5 rounded-xl"></div>
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
            className="bg-surface/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 overflow-hidden"
          >
            <div className="p-6 border-b border-foreground/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-foreground/[0.02]">
              <h2 className="text-xl font-extrabold text-foreground flex items-center gap-2">
                <Banknote className="w-5 h-5 text-primary" /> สรุปยอดประจำวัน ({new Date(dateStr).toLocaleDateString('th-TH')})
              </h2>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 bg-secondary text-white px-5 py-2.5 rounded-xl font-bold hover:bg-secondary/90 transition-all shadow-md shadow-secondary/20 active:scale-95 text-sm"
              >
                <Download className="w-4 h-4" /> ดาวน์โหลด CSV
              </button>
            </div>
            <div className="p-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              <div className="bg-primary/5 p-6 rounded-2xl border border-primary/10">
                <p className="text-sm font-bold text-primary/70 mb-2">ยอดรับรวมทั้งสิ้น</p>
                <p className="text-4xl font-extrabold text-primary">{formatTHB(summary?.total_received || 0)}</p>
              </div>
              <div className="bg-background p-6 rounded-2xl border border-foreground/5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-foreground/70">ค่าเทอม</p>
                  <span className="text-xs font-bold bg-foreground/5 px-2 py-1 rounded-full">{summary?.tuition_count} รายการ</span>
                </div>
                <p className="text-3xl font-extrabold text-foreground">{formatTHB(summary?.tuition_amount || 0)}</p>
              </div>
              <div className="bg-background p-6 rounded-2xl border border-foreground/5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-foreground/70 flex items-center gap-1"><ShoppingBag className="w-4 h-4"/> ร้านสหกรณ์</p>
                  <span className="text-xs font-bold bg-foreground/5 px-2 py-1 rounded-full">{summary?.shop_count} รายการ</span>
                </div>
                <p className="text-3xl font-extrabold text-foreground">{formatTHB(summary?.shop_amount || 0)}</p>
              </div>
              <div className="bg-background p-6 rounded-2xl border border-foreground/5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-foreground/70 flex items-center gap-1"><Wallet className="w-4 h-4"/> เติม Wallet</p>
                  <span className="text-xs font-bold bg-foreground/5 px-2 py-1 rounded-full">{summary?.topup_count} รายการ</span>
                </div>
                <p className="text-3xl font-extrabold text-foreground">{formatTHB(summary?.topup_amount || 0)}</p>
              </div>
            </div>
          </motion.div>

          {/* Audit Trail */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 overflow-hidden"
          >
            <div className="p-6 border-b border-foreground/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-foreground/[0.02]">
              <h2 className="text-xl font-extrabold text-foreground flex items-center gap-2">
                <Activity className="w-5 h-5 text-secondary" /> Audit Trail (ล่าสุด 50 รายการ)
              </h2>
              <button
                onClick={handleExportAuditCSV}
                className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-md shadow-primary/20 active:scale-95 text-sm"
              >
                <Download className="w-4 h-4" /> ดาวน์โหลด Audit CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-foreground/[0.02] border-b border-foreground/5">
                  <tr>
                    <th className="p-5 font-bold text-foreground/50 text-xs uppercase tracking-wider">วัน/เวลา</th>
                    <th className="p-5 font-bold text-foreground/50 text-xs uppercase tracking-wider">ผู้ทำรายการ</th>
                    <th className="p-5 font-bold text-foreground/50 text-xs uppercase tracking-wider">การกระทำ</th>
                    <th className="p-5 font-bold text-foreground/50 text-xs uppercase tracking-wider">รายละเอียด</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-foreground/5">
                  {auditLogs.length === 0 ? (
                    <tr><td colSpan={4} className="p-12 text-center text-foreground/40 font-medium">ไม่มีข้อมูลการเคลื่อนไหวในขณะนี้</td></tr>
                  ) : auditLogs.map((log, i) => (
                    <motion.tr 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02 }}
                      key={log.id} 
                      className="hover:bg-foreground/[0.02] transition-colors"
                    >
                      <td className="p-5 text-sm font-medium text-foreground/70 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('th-TH')}
                      </td>
                      <td className="p-5 font-bold text-primary whitespace-nowrap">{log.user_name || 'System'}</td>
                      <td className="p-5 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase ${
                          log.action === 'INSERT' ? 'bg-green-100 text-green-700' :
                          log.action === 'UPDATE' ? 'bg-blue-100 text-blue-700' :
                          log.action === 'DELETE' ? 'bg-red-100 text-red-700' :
                          'bg-foreground/10 text-foreground'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="p-5 font-mono text-xs text-foreground/60 w-full">
                        <div className="flex flex-col gap-1 max-w-xl">
                          <span className="font-bold text-foreground/80">Table: {log.table_name} <span className="font-normal text-foreground/40">(ID: {log.record_id})</span></span>
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
