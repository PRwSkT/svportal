'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { LayoutDashboard, Wallet, ShoppingBag, GraduationCap, TrendingUp, Clock, RefreshCw, AlertTriangle, CheckCircle2, Server, Globe, FileText, Image as ImageIcon, Users, Calendar } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function DashboardView({ initialData, thaiDate, localISOTime }: { initialData: any, thaiDate: string, localISOTime: string }) {
  const { dict, language, formatDate, formatCurrency } = useLanguage();
  const [data, setData] = useState(initialData);
  const [lastUpdated, setLastUpdated] = useState<string>(
    new Date().toLocaleTimeString(language === 'th' ? 'th-TH' : 'en-US')
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(localISOTime);

  const fetchData = async (targetDate = selectedDate) => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/admin/dashboard?date=${targetDate}`);
      if (res.ok) {
        const newData = await res.json();
        setData(newData);
        setLastUpdated(new Date().toLocaleTimeString(language === 'th' ? 'th-TH' : 'en-US'));
      }
    } catch (e) {
      console.error('Failed to fetch dashboard data', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData(selectedDate);
    const interval = setInterval(() => fetchData(selectedDate), 15000);
    return () => clearInterval(interval);
  }, [selectedDate, language]);

  const currentDisplayDate = (() => {
    try {
      const d = new Date(selectedDate + 'T00:00:00+07:00');
      return formatDate(d, {
        dateStyle: 'long',
      });
    } catch {
      return thaiDate;
    }
  })();

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

  const websiteStats = data?.website_stats || {
    news: 0,
    albums: 0,
    personnel: 0
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 font-sans"
    >
      {/* Official SV Portal Hero Header */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                {dict.common.officialBadge}
              </span>
              <span className="text-xs text-slate-500 font-medium">{dict.dashboard.subtitle}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {dict.dashboard.title}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {dict.dashboard.dateSummaryPrefix} {currentDisplayDate}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Date Picker */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <Calendar className="w-4 h-4 text-[#7B1C3E] shrink-0" />
              <input 
                type="date" 
                value={selectedDate} 
                onChange={(e) => {
                  if (e.target.value) setSelectedDate(e.target.value);
                }}
                className="bg-transparent text-sm font-bold text-slate-900 dark:text-white outline-none cursor-pointer" 
              />
            </div>

            {/* Quick presets */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setSelectedDate(localISOTime)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedDate === localISOTime 
                    ? 'bg-[#7B1C3E] text-white shadow-sm' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {dict.dashboard.today}
              </button>
              <button
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() - 1);
                  const yesterday = new Intl.DateTimeFormat('en-CA', {
                    timeZone: 'Asia/Bangkok',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                  }).format(d);
                  setSelectedDate(yesterday);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all"
              >
                {dict.dashboard.yesterday}
              </button>
            </div>

            <button 
              onClick={() => fetchData(selectedDate)} 
              disabled={isRefreshing}
              className="flex items-center gap-2 text-sm font-bold text-[#7B1C3E] dark:text-pink-400 bg-[#7B1C3E]/10 hover:bg-[#7B1C3E]/20 px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {dict.common.refresh}
            </button>

            <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-slate-500 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
              <Clock className="w-3.5 h-3.5" /> {dict.dashboard.updated}: {lastUpdated}
            </div>
          </div>
        </div>
      </div>

      {/* Top Level Summary Banner */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-gradient-to-br from-[#7B1C3E] via-[#681834] to-[#1B3A6B] rounded-3xl shadow-xl p-6 sm:p-8 md:p-10 text-white relative overflow-hidden group"
      >
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-white/15 transition-all duration-700 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/20 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <p className="text-base sm:text-lg font-bold text-white/80 mb-2 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-300" /> {dict.dashboard.totalReceived}
            </p>
            <p className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight break-words">{formatCurrency(summary.total_received)}</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Tuition Fees */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 p-6 md:p-8 hover:shadow-md transition-all group"
        >
          <div className="w-12 h-12 rounded-2xl bg-[#1B3A6B]/10 flex items-center justify-center text-[#1B3A6B] dark:text-blue-400 mb-6 group-hover:scale-110 transition-transform">
            <GraduationCap className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-500 dark:text-slate-400 mb-2">{dict.dashboard.tuitionFees}</h2>
          <p className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white mb-4">{formatCurrency(summary.tuition_amount)}</p>
          <div className="inline-flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400">
            <span>{summary.tuition_count} {dict.dashboard.items}</span>
          </div>
        </motion.div>

        {/* Co-op Shop */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 p-6 md:p-8 hover:shadow-md transition-all group"
        >
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-6 group-hover:scale-110 transition-transform">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-500 dark:text-slate-400 mb-2">{dict.dashboard.coopShop}</h2>
          <p className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white mb-4">{formatCurrency(summary.shop_amount)}</p>
          <div className="inline-flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400">
            <span>{summary.shop_count} {dict.dashboard.items}</span>
          </div>
        </motion.div>

        {/* Wallet Topup */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 p-6 md:p-8 hover:shadow-md transition-all group"
        >
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-6 group-hover:scale-110 transition-transform">
            <Wallet className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-500 dark:text-slate-400 mb-2">{dict.dashboard.walletTopup}</h2>
          <p className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white mb-4">{formatCurrency(summary.topup_amount)}</p>
          <div className="inline-flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400">
            <span>{summary.topup_count} {dict.dashboard.items}</span>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sync Queue Monitor */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 p-6 md:p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Server className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{dict.dashboard.syncStatus}</h2>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
              <div className="text-3xl font-black text-blue-500 mb-1">{syncStats.pending}</div>
              <div className="text-xs font-semibold text-slate-500">{dict.dashboard.pending}</div>
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
              <div className="text-3xl font-black text-orange-500 mb-1">{syncStats.processing}</div>
              <div className="text-xs font-semibold text-slate-500">{dict.dashboard.processing}</div>
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
              <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mb-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-5 h-5" />
                {syncStats.completed}
              </div>
              <div className="text-xs font-semibold text-slate-500">{dict.dashboard.completed}</div>
            </div>
            
            <div className={`border rounded-2xl p-4 flex flex-col items-center justify-center text-center ${syncStats.failed > 0 ? 'border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-900' : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/60'}`}>
              <div className={`text-3xl font-black mb-1 flex items-center gap-1.5 ${syncStats.failed > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                {syncStats.failed > 0 && <AlertTriangle className="w-5 h-5" />}
                {syncStats.failed}
              </div>
              <div className="text-xs font-semibold text-slate-500">{dict.dashboard.failed}</div>
            </div>
          </div>
        </motion.div>

        {/* Website Stats */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 p-6 md:p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Globe className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{dict.dashboard.websiteOverview}</h2>
          </div>

          <div className="grid grid-cols-3 gap-3.5">
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
              <FileText className="w-5 h-5 text-slate-400 mb-2" />
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mb-1">{websiteStats.news}</div>
              <div className="text-xs font-semibold text-slate-500">{dict.dashboard.newsArticles}</div>
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
              <ImageIcon className="w-5 h-5 text-slate-400 mb-2" />
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mb-1">{websiteStats.albums}</div>
              <div className="text-xs font-semibold text-slate-500">{dict.dashboard.photoAlbums}</div>
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
              <Users className="w-5 h-5 text-slate-400 mb-2" />
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mb-1">{websiteStats.personnel}</div>
              <div className="text-xs font-semibold text-slate-500">{dict.dashboard.personnel}</div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
