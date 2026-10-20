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
  Bell,
  BookOpen,
  CalendarDays,
  CheckSquare,
  FileCheck2,
  Baby,
  HeartHandshake,
  Apple,
  Bus,
  Stethoscope,
  ShieldCheck,
  HandCoins,
  ScrollText,
  UserCheck,
  Smartphone,
  MessageCircle,
  ClipboardList
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
        { id: "admin_reports", name: dict.nav.adminReports, href: "/admin/reports", icon: <FileText className="w-6 h-6" />, color: "bg-emerald-500/20 text-emerald-600" },
        { id: "subsidy_free15y", name: language === 'th' ? "เรียนฟรี 15 ปี (อร.11)" : "15Y Free Subsidy", href: "/admin/subsidy/free15y", icon: <HandCoins className="w-6 h-6" />, color: "bg-teal-500/20 text-teal-600" }
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
        { id: "admin_students", name: dict.nav.adminStudents, href: "/admin/students", icon: <Users className="w-6 h-6" />, color: "bg-indigo-500 text-white" },
        { id: "student_attendance", name: language === 'th' ? "เช็กชื่อ & ใบลา 360°" : "Attendance & Leave", href: "/admin/students/attendance", icon: <UserCheck className="w-6 h-6" />, color: "bg-indigo-500/20 text-indigo-600" },
        { id: "pickup_dismissal", name: language === 'th' ? "จุดรับ-ส่งเด็ก (QR)" : "Smart Pickup", href: "/admin/safety/pickup", icon: <QrCode className="w-6 h-6" />, color: "bg-[#7B1C3E] text-white" },
        { id: "pastoral_care", name: language === 'th' ? "ดูแลนักเรียน (SDQ)" : "Pastoral Care", href: "/pastoral", icon: <HeartHandshake className="w-6 h-6" />, color: "bg-rose-500/20 text-rose-600" },
        { id: "student_nutrition", name: language === 'th' ? "โภชนาการ & นม" : "Nutrition & Milk", href: "/admin/students/nutrition", icon: <Apple className="w-6 h-6" />, color: "bg-emerald-500/20 text-emerald-600" },
        { id: "van_safety", name: language === 'th' ? "รถตู้รับ-ส่ง" : "Van Safety", href: "/admin/safety/van", icon: <Bus className="w-6 h-6" />, color: "bg-amber-500/20 text-amber-600" },
        { id: "school_infirmary", name: language === 'th' ? "ห้องพยาบาล" : "Infirmary", href: "/admin/health/infirmary", icon: <Stethoscope className="w-6 h-6" />, color: "bg-red-500/20 text-red-600" }
      ]
    },
    {
      title: dict.nav.hrAdmin,
      icon: <Users className="w-5 h-5 text-purple-500" />,
      color: "border-purple-500/20 bg-purple-500/5",
      tools: [
        { id: "admin_users", name: dict.nav.adminUsers, href: "/admin/users", icon: <Users className="w-6 h-6" />, color: "bg-purple-500/20 text-purple-600" },
        { id: "admin_attendance", name: dict.nav.adminAttendance, href: "/admin/attendance", icon: <Clock className="w-6 h-6" />, color: "bg-purple-500/20 text-purple-600" },
        { id: "admin_kpi", name: dict.nav.adminKpi, href: "/admin/kpi", icon: <Award className="w-6 h-6" />, color: "bg-[#7B1C3E] text-white" },
        { id: "esar_governance", name: language === 'th' ? "รายงาน e-SAR & ใบอนุญาต" : "e-SAR & Governance", href: "/admin/governance", icon: <ShieldCheck className="w-6 h-6" />, color: "bg-indigo-500/20 text-indigo-600" }
      ]
    },
    {
      title: dict.nav.pr,
      icon: <Megaphone className="w-5 h-5 text-rose-500" />,
      color: "border-rose-500/20 bg-rose-500/5",
      tools: [
        { id: "parent_communications", name: language === 'th' ? "ศูนย์สื่อสารผู้ปกครอง" : "Parent Comms", href: "/admin/communications", icon: <MessageCircle className="w-6 h-6" />, color: "bg-[#7B1C3E] text-white" },
        { id: "parents_portal_preview", name: language === 'th' ? "Parents Portal PWA" : "Parents Portal PWA", href: "/parents", icon: <Smartphone className="w-6 h-6" />, color: "bg-amber-500 text-white" },
        { id: "admin_notifications", name: language === 'th' ? "ระบบแจ้งเตือน AI" : "AI Notifications", href: "/admin/notifications", icon: <Bell className="w-6 h-6" />, color: "bg-rose-500/20 text-rose-600" },
        { id: "admin_website", name: dict.nav.adminWebsite, href: "/admin/website", icon: <Globe className="w-6 h-6" />, color: "bg-rose-500/20 text-rose-600" },
        { id: "admin_forms", name: dict.nav.adminForms, href: "/admin/forms", icon: <FileText className="w-6 h-6" />, color: "bg-[#7B1C3E]/20 text-[#7B1C3E]" },
        { id: "post_assistant", name: dict.nav.postAssistant, href: "/post-assistant", icon: <MessageSquare className="w-6 h-6" />, color: "bg-rose-500/20 text-rose-600" },
        { id: "audio_remote", name: dict.nav.audioRemote, href: "/audio-remote", icon: <Radio className="w-6 h-6" />, color: "bg-rose-500 text-white" },
        { id: "qr_generator", name: dict.nav.qrGenerator, href: "/qr-generator", icon: <QrCode className="w-6 h-6" />, color: "bg-rose-500 text-white" }
      ]
    },
    {
      title: language === 'th' ? "งานวิชาการและงานวัดผล" : "Academic & Measurement",
      icon: <GraduationCap className="w-5 h-5 text-indigo-500" />,
      color: "border-indigo-500/20 bg-indigo-500/5",
      tools: [
        { id: "academic_hub", name: language === 'th' ? "ศูนย์รวมวิชาการ" : "Academic Hub", href: "/academic", icon: <GraduationCap className="w-6 h-6" />, color: "bg-indigo-500 text-white" },
        { id: "academic_gradebook", name: language === 'th' ? "Smart Gradebook (ปพ.5)" : "Gradebook (P.P.5)", href: "/academic/gradebook", icon: <BookOpen className="w-6 h-6" />, color: "bg-emerald-500/20 text-emerald-600" },
        { id: "academic_early_years", name: language === 'th' ? "ปฐมวัย & กิจวัตรรายวัน" : "Early Years & Care", href: "/academic/early-years", icon: <Baby className="w-6 h-6" />, color: "bg-pink-500/20 text-pink-600" },
        { id: "academic_assignments", name: language === 'th' ? "การบ้าน & ชิ้นงาน" : "Assignments", href: "/academic/assignments", icon: <ClipboardList className="w-6 h-6" />, color: "bg-blue-500/20 text-blue-600" },
        { id: "academic_exams", name: language === 'th' ? "คลังข้อสอบ & ตรวจ OMR" : "Exams & OMR", href: "/academic/exams", icon: <CheckSquare className="w-6 h-6" />, color: "bg-amber-500/20 text-amber-600" },
        { id: "academic_timetable", name: language === 'th' ? "ตารางสอน & จัดสอนแทน" : "Timetable", href: "/academic/timetable", icon: <CalendarDays className="w-6 h-6" />, color: "bg-sky-500/20 text-sky-600" },
        { id: "academic_documents", name: language === 'th' ? "เอกสาร ปพ.1-3 & ปพ.6" : "Statutory Docs (PP.1-6)", href: "/academic/documents", icon: <ScrollText className="w-6 h-6" />, color: "bg-teal-500/20 text-teal-600" },
        { id: "academic_opec", name: language === 'th' ? "ส่งออก REGIS (สช.)" : "OPEC REGIS Export", href: "/academic/opec", icon: <FileCheck2 className="w-6 h-6" />, color: "bg-purple-500/20 text-purple-600" },
        { id: "calendar", name: language === 'th' ? "ปฏิทินปฏิบัติงาน & เวรครู" : "Operational Calendar", href: "/calendar", icon: <CalendarDays className="w-6 h-6" />, color: "bg-indigo-500/20 text-indigo-600" },
        { id: "admin_academic", name: language === 'th' ? "ตั้งค่าหลักสูตร" : "Academic Setup", href: "/admin/academic", icon: <Settings className="w-6 h-6" />, color: "bg-slate-500/20 text-slate-600" }
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
        <div className="flex flex-wrap gap-3">
          <Link href="/parents">
            <motion.div 
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white px-5 py-3.5 rounded-2xl shadow-md hover:shadow-lg transition-all"
            >
              <div className="p-2 bg-white/20 rounded-xl">
                <Smartphone className="w-5 h-5" />
              </div>
              <div className="text-left">
                <span className="font-bold text-sm block leading-tight">Parents Portal PWA</span>
                <span className="text-[10px] text-amber-100 block">parents.portal.somkidvittaya.ac.th</span>
              </div>
            </motion.div>
          </Link>
          <Link href="/attendance">
            <motion.div 
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-3 bg-gradient-to-r from-primary to-primary/80 text-white px-5 py-3.5 rounded-2xl shadow-md hover:shadow-lg transition-all"
            >
              <div className="p-2 bg-white/20 rounded-xl">
                <Clock className="w-5 h-5" />
              </div>
              <span className="font-bold text-sm md:text-base">{dict.nav.adminAttendance}</span>
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
