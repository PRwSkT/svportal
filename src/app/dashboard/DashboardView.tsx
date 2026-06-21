'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { LayoutDashboard, Wallet, ShoppingBag, GraduationCap, TrendingUp, Clock, RefreshCw, AlertTriangle, CheckCircle2, Server } from 'lucide-react';

const formatTHB = (amount: number) => {
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(amount || 0);
};

export default function DashboardView({ initialData, thaiDate, localISOTime }: { initialData: any, thaiDate: string, localISOTime: string }) {
  const [data, setData] = useState(initialData);
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toLocaleTimeString('th-TH'));
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/admin/dashboard?date=${localISOTime}`);
      if (res.ok) {
        const newData = await res.json();
        setData(newData);
        setLastUpdated(new Date().toLocaleTimeString('th-TH'));
      }
    } catch (e) {
      console.error('Failed to fetch dashboard data', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [localISOTime]);

  const summary = data?.summary || {
    total_received: 0,
    tuition_amount: 0,
    tuition_count: 0,
    shop_amount: 0,
    shop_count: 0,
    topup_amount: 0,
    topup_count: 0
  };

  const syncStats = data?.sync_stats || {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-8 max-w-7xl mx-auto space-y-8 font-sans"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-surface backdrop-blur-xl p-6 rounded-3xl shadow-lg border border-white/60">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
            <LayoutDashboard className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-primary mb-1">แดชบอร์ดสรุปยอด</h1>
            <p className="text-foreground/60 font-medium">ข้อมูล ณ วันที่ {thaiDate}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={fetchData} 
            disabled={isRefreshing}
            className="flex items-center gap-2 text-sm font-bold text-primary bg-primary/10 hover:bg-primary/20 px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            รีเฟรช
          </button>
          <div className="flex items-center gap-2 text-sm font-bold text-foreground/50 bg-background px-4 py-2 rounded-xl border border-foreground/10">
            <Clock className="w-4 h-4" /> อัปเดตล่าสุด: {lastUpdated}
          </div>
        </div>
      </div>

      {/* Top Level Summary */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-gradient-to-br from-primary to-primary/80 rounded-3xl shadow-xl p-8 md:p-10 text-white relative overflow-hidden group"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-white/20 transition-all duration-700"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <p className="text-xl font-bold text-white/80 mb-2 flex items-center gap-2">
              <TrendingUp className="w-6 h-6" /> ยอดรับรวมทั้งสิ้น
            </p>
            <p className="text-5xl md:text-7xl font-black tracking-tight">{formatTHB(summary.total_received)}</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Tuition Fees */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-surface backdrop-blur-xl rounded-3xl shadow-lg border border-white/60 p-8 hover:shadow-xl hover:border-primary/20 transition-all group"
        >
          <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary mb-6 group-hover:scale-110 transition-transform">
            <GraduationCap className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-foreground/70 mb-2">ค่าเทอม</h2>
          <p className="text-4xl font-extrabold text-foreground mb-4">{formatTHB(summary.tuition_amount)}</p>
          <div className="inline-flex items-center gap-2 bg-foreground/5 px-3 py-1.5 rounded-lg text-sm font-bold text-foreground/60">
            <span>{summary.tuition_count} รายการ</span>
          </div>
        </motion.div>

        {/* Co-op Shop */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-surface backdrop-blur-xl rounded-3xl shadow-lg border border-white/60 p-8 hover:shadow-xl hover:border-primary/20 transition-all group"
        >
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 mb-6 group-hover:scale-110 transition-transform">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-foreground/70 mb-2">ร้านสหกรณ์</h2>
          <p className="text-4xl font-extrabold text-foreground mb-4">{formatTHB(summary.shop_amount)}</p>
          <div className="inline-flex items-center gap-2 bg-foreground/5 px-3 py-1.5 rounded-lg text-sm font-bold text-foreground/60">
            <span>{summary.shop_count} รายการ</span>
          </div>
        </motion.div>

        {/* Wallet Topup */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-surface backdrop-blur-xl rounded-3xl shadow-lg border border-white/60 p-8 hover:shadow-xl hover:border-primary/20 transition-all group"
        >
          <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-500 mb-6 group-hover:scale-110 transition-transform">
            <Wallet className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-foreground/70 mb-2">เติมเงิน Wallet</h2>
          <p className="text-4xl font-extrabold text-foreground mb-4">{formatTHB(summary.topup_amount)}</p>
          <div className="inline-flex items-center gap-2 bg-foreground/5 px-3 py-1.5 rounded-lg text-sm font-bold text-foreground/60">
            <span>{summary.topup_count} รายการ</span>
          </div>
        </motion.div>
      </div>

      {/* Sync Queue Monitor */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-surface backdrop-blur-xl rounded-3xl shadow-lg border border-white/60 p-8"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
            <Server className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold text-foreground">สถานะคิวซิงค์ข้อมูล (SVPortal Sync)</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-background border border-foreground/10 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
            <div className="text-3xl font-black text-blue-500 mb-1">{syncStats.pending}</div>
            <div className="text-sm font-medium text-foreground/60">รอการส่ง (Pending)</div>
          </div>
          
          <div className="bg-background border border-foreground/10 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
            <div className="text-3xl font-black text-orange-500 mb-1">{syncStats.processing}</div>
            <div className="text-sm font-medium text-foreground/60">กำลังส่ง (Processing)</div>
          </div>
          
          <div className="bg-background border border-foreground/10 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
            <div className="text-3xl font-black text-green-500 mb-1 flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6" />
              {syncStats.completed}
            </div>
            <div className="text-sm font-medium text-foreground/60">สำเร็จ (Completed)</div>
          </div>
          
          <div className={`bg-background border ${syncStats.failed > 0 ? 'border-red-500/50 bg-red-500/5' : 'border-foreground/10'} rounded-2xl p-4 flex flex-col items-center justify-center text-center`}>
            <div className={`text-3xl font-black mb-1 flex items-center gap-2 ${syncStats.failed > 0 ? 'text-red-500' : 'text-foreground/30'}`}>
              {syncStats.failed > 0 && <AlertTriangle className="w-6 h-6" />}
              {syncStats.failed}
            </div>
            <div className="text-sm font-medium text-foreground/60">ล้มเหลว (Failed)</div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
