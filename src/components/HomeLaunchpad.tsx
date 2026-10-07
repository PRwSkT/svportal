'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  GraduationCap, 
  FileText, 
  Users, 
  Wallet, 
  ShoppingBag, 
  Settings, 
  Megaphone,
  QrCode,
  LineChart,
  ShoppingCart,
  CreditCard,
  MessageSquare,
  Radio,
  Globe,
  Clock,
  Award,
  Bell
} from 'lucide-react';
import { getRoleConfig } from '@/lib/constants/roles';

export default function HomeLaunchpad() {
  const { user, appUser, role, isLoading } = useAuth();
  const { language, dict } = useLanguage();

  if (isLoading || (!appUser && user)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <p className="text-foreground/50 text-sm font-medium">{dict.common.loading}</p>
        </div>
      </div>
    );
  }
  
  // All possible departments and tools with dynamic translations
  const allDepartments = [
    {
      title: dict.nav.financeAccounting,
      icon: <Wallet className="w-5 h-5 text-emerald-500" />,
      color: "border-emerald-500/20 bg-emerald-500/5",
      tools: [
        { id: "dashboard", name: dict.nav.dashboard, href: "/dashboard", icon: <LineChart className="w-6 h-6" />, color: "bg-emerald-500 text-white" },
        { id: "pos_fees", name: dict.nav.posFees, href: "/pos/fees", icon: <CreditCard className="w-6 h-6" />, color: "bg-emerald-500/20 text-emerald-600" },
        { id: "admin_reports", name: dict.nav.adminReports, href: "/admin/reports", icon: <FileText className="w-6 h-6" />, color: "bg-emerald-500/20 text-emerald-600" }
      ]
    },
    {
      title: dict.nav.coopStore,
      icon: <ShoppingBag className="w-5 h-5 text-blue-500" />,
      color: "border-blue-500/20 bg-blue-500/5",
      tools: [
        { id: "pos_shop", name: dict.nav.posShop, href: "/pos/shop", icon: <ShoppingCart className="w-6 h-6" />, color: "bg-blue-500 text-white" },
        { id: "admin_products", name: dict.nav.adminProducts, href: "/admin/products", icon: <ShoppingBag className="w-6 h-6" />, color: "bg-blue-500/20 text-blue-600" },
        { id: "pos_wallet_topup", name: dict.nav.posWalletTopup, href: "/pos/wallet/topup", icon: <Wallet className="w-6 h-6" />, color: "bg-blue-500/20 text-blue-600" },
        { id: "admin_wallet_students", name: dict.nav.adminWalletStudents, href: "/admin/wallet/students", icon: <Users className="w-6 h-6" />, color: "bg-blue-500/20 text-blue-600" }
      ]
    },
    {
      title: dict.nav.registrar,
      icon: <FileText className="w-5 h-5 text-indigo-500" />,
      color: "border-indigo-500/20 bg-indigo-500/5",
      tools: [
        { id: "admin_students", name: dict.nav.adminStudents, href: "/admin/students", icon: <Users className="w-6 h-6" />, color: "bg-indigo-500/20 text-indigo-600" }
      ]
    },
    {
      title: dict.nav.hrAdmin,
      icon: <Users className="w-5 h-5 text-purple-500" />,
      color: "border-purple-500/20 bg-purple-500/5",
      tools: [
        { id: "admin_users", name: dict.nav.adminUsers, href: "/admin/users", icon: <Users className="w-6 h-6" />, color: "bg-purple-500/20 text-purple-600" },
        { id: "admin_attendance", name: dict.nav.adminAttendance, href: "/admin/attendance", icon: <Clock className="w-6 h-6" />, color: "bg-purple-500/20 text-purple-600" },
        { id: "admin_kpi", name: dict.nav.adminKpi, href: "/admin/kpi", icon: <Award className="w-6 h-6" />, color: "bg-[#7B1C3E] text-white" }
      ]
    },
    {
      title: dict.nav.pr,
      icon: <Megaphone className="w-5 h-5 text-rose-500" />,
      color: "border-rose-500/20 bg-rose-500/5",
      tools: [
        { id: "admin_notifications", name: language === 'th' ? "ระบบแจ้งเตือน AI" : "AI Notifications", href: "/admin/notifications", icon: <Bell className="w-6 h-6" />, color: "bg-rose-500/20 text-rose-600" },
        { id: "admin_website", name: dict.nav.adminWebsite, href: "/admin/website", icon: <Globe className="w-6 h-6" />, color: "bg-rose-500/20 text-rose-600" },
        { id: "admin_forms", name: dict.nav.adminForms, href: "/admin/forms", icon: <FileText className="w-6 h-6" />, color: "bg-[#7B1C3E]/20 text-[#7B1C3E]" },
        { id: "post_assistant", name: dict.nav.postAssistant, href: "/post-assistant", icon: <MessageSquare className="w-6 h-6" />, color: "bg-rose-500/20 text-rose-600" },
        { id: "audio_remote", name: dict.nav.audioRemote, href: "/audio-remote", icon: <Radio className="w-6 h-6" />, color: "bg-rose-500 text-white" },
        { id: "qr_generator", name: dict.nav.qrGenerator, href: "/qr-generator", icon: <QrCode className="w-6 h-6" />, color: "bg-rose-500 text-white" }
      ]
    },
    {
      title: dict.nav.generalAdmin,
      icon: <Settings className="w-5 h-5 text-slate-500" />,
      color: "border-slate-500/20 bg-slate-500/5",
      tools: [
        { id: "settings", name: dict.nav.settings, href: "#", icon: <Settings className="w-6 h-6" />, color: "bg-slate-500/20 text-slate-600" }
      ]
    },
    {
      title: language === 'th' ? "งานวิชาการ" : "Academic Affairs",
      icon: <GraduationCap className="w-5 h-5 text-orange-500" />,
      color: "border-orange-500/20 bg-orange-500/5",
      tools: [
        { id: "academic_todo", name: language === 'th' ? "รอการพัฒนา" : "In Development", href: "#", icon: <GraduationCap className="w-6 h-6" />, color: "bg-orange-500/20 text-orange-600" }
      ]
    }
  ];

  const adminEmails = ['admin@somkidvittaya.ac.th', 'peerawat@somkidvittaya.ac.th', 'media@somkidvittaya.ac.th'];
  const isAdmin = appUser?.role === 'admin' || role === 'admin' || (user?.email ? adminEmails.includes(user.email.toLowerCase()) : false);
  const assignedFeatures = appUser?.assigned_features || [];
  const showAll = isAdmin && assignedFeatures.length === 0;

  const filteredDepartments = allDepartments.map(dept => {
    return {
      ...dept,
      tools: dept.tools.filter(tool => isAdmin || showAll || assignedFeatures.includes(tool.id))
    };
  }).filter(dept => dept.tools.length > 0);

  let displayName = appUser?.full_name;
  if (!displayName) {
    if (user?.email?.toLowerCase() === 'admin@somkidvittaya.ac.th') displayName = 'Workspace Admin';
    else if (user?.email?.toLowerCase() === 'peerawat@somkidvittaya.ac.th') displayName = 'peerawat';
    else if (user?.email?.toLowerCase() === 'media@somkidvittaya.ac.th') displayName = 'media';
    else displayName = user?.email ? user.email.split('@')[0] : 'ผู้ใช้งาน';
  }

  const userRole = isAdmin ? 'admin' : (appUser?.role || role);
  const roleBadge = getRoleConfig(userRole);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 font-sans">
      
      {/* Header & Quick Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-surface backdrop-blur-xl p-6 rounded-3xl shadow-lg border border-white/60">
        <div>
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h1 className="text-3xl font-extrabold tracking-tight text-primary">
              {language === 'th' ? `สวัสดี, ${displayName}` : `Welcome, ${displayName}`}
            </h1>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border shadow-sm ${roleBadge.badgeClass}`}>
              {language === 'th' ? roleBadge.fullLabel : `${roleBadge.labelEn} (${roleBadge.labelTh})`}
            </span>
          </div>
          <p className="text-foreground/60 font-medium">
            {dict.home.launchpadSubtitle}
          </p>
        </div>
        
        {/* Quick Actions / Standalone */}
        <div className="flex gap-4">
          <Link href="/attendance">
            <motion.div 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-3 bg-gradient-to-r from-primary to-primary/80 text-white px-6 py-4 rounded-2xl shadow-md hover:shadow-lg transition-all"
            >
              <div className="p-2 bg-white/20 rounded-xl">
                <Clock className="w-6 h-6" />
              </div>
              <span className="font-bold text-lg">{dict.nav.adminAttendance}</span>
            </motion.div>
          </Link>
        </div>
      </div>

      {/* Departments Grid */}
      {filteredDepartments.length === 0 ? (
        <div className="bg-surface backdrop-blur-xl rounded-3xl p-12 text-center border border-white/60">
          <Settings className="w-16 h-16 text-foreground/20 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground/60 mb-2">
            {language === 'th' ? 'ยังไม่มีโมดูลที่ได้รับมอบหมาย' : 'No assigned modules found'}
          </h2>
          <p className="text-foreground/40">
            {language === 'th' ? 'กรุณาติดต่อผู้ดูแลระบบเพื่อกำหนดสิทธิ์การเข้าถึงฟีเจอร์ต่างๆ' : 'Please contact the administrator to configure access permissions'}
          </p>
        </div>
      ) : (
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {filteredDepartments.map((dept, idx) => (
            <motion.div key={idx} variants={itemVariants} className={`rounded-3xl border ${dept.color} overflow-hidden backdrop-blur-md shadow-sm hover:shadow-md transition-shadow flex flex-col md:h-[320px]`}>
              <div className="p-4 md:p-5 border-b border-foreground/5 flex items-center gap-3 bg-white/40 shrink-0">
                {dept.icon}
                <h2 className="font-bold text-lg text-foreground/80">{dept.title}</h2>
              </div>
              <div className="p-4 md:p-5 grid grid-cols-3 gap-4 md:gap-5 bg-white/20 flex-1 min-h-0 overflow-y-auto content-start">
                {dept.tools.map((tool, i) => (
                  <Link key={i} href={tool.href} className="group flex flex-col items-center text-center gap-2">
                    <div className={`w-16 h-16 md:w-14 md:h-14 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 group-hover:shadow-md ${tool.color}`}>
                      {tool.icon}
                    </div>
                    <span className="text-[11px] md:text-xs font-medium text-foreground/80 group-hover:text-primary transition-colors line-clamp-2 leading-tight">
                      {tool.name}
                    </span>
                  </Link>
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
