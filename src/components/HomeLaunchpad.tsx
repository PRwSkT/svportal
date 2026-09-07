'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
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
  Clock
} from 'lucide-react';

export default function HomeLaunchpad() {
  const { user, appUser, role, isLoading } = useAuth();

  if (isLoading && !appUser && !user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <p className="text-foreground/50 text-sm font-medium">กำลังโหลดข้อมูลระบบ...</p>
        </div>
      </div>
    );
  }
  
  // All possible departments and tools
  const allDepartments = [
    {
      title: "งานการเงิน",
      icon: <Wallet className="w-5 h-5 text-emerald-500" />,
      color: "border-emerald-500/20 bg-emerald-500/5",
      tools: [
        { id: "dashboard", name: "แดชบอร์ดสรุปยอด", href: "/dashboard", icon: <LineChart className="w-6 h-6" />, color: "bg-emerald-500 text-white" },
        { id: "pos_fees", name: "ชำระค่าเทอม", href: "/pos/fees", icon: <CreditCard className="w-6 h-6" />, color: "bg-emerald-500/20 text-emerald-600" },
        { id: "admin_reports", name: "รายงานการเงิน", href: "/admin/reports", icon: <FileText className="w-6 h-6" />, color: "bg-emerald-500/20 text-emerald-600" }
      ]
    },
    {
      title: "งานร้านค้าสหกรณ์",
      icon: <ShoppingBag className="w-5 h-5 text-blue-500" />,
      color: "border-blue-500/20 bg-blue-500/5",
      tools: [
        { id: "pos_shop", name: "POS ขายสินค้า", href: "/pos/shop", icon: <ShoppingCart className="w-6 h-6" />, color: "bg-blue-500 text-white" },
        { id: "admin_products", name: "จัดการสินค้า", href: "/admin/products", icon: <ShoppingBag className="w-6 h-6" />, color: "bg-blue-500/20 text-blue-600" },
        { id: "pos_wallet_topup", name: "เติมเงิน Wallet", href: "/pos/wallet/topup", icon: <Wallet className="w-6 h-6" />, color: "bg-blue-500/20 text-blue-600" },
        { id: "admin_wallet_students", name: "Wallet นักเรียน", href: "/admin/wallet/students", icon: <Users className="w-6 h-6" />, color: "bg-blue-500/20 text-blue-600" }
      ]
    },
    {
      title: "งานทะเบียน",
      icon: <FileText className="w-5 h-5 text-indigo-500" />,
      color: "border-indigo-500/20 bg-indigo-500/5",
      tools: [
        { id: "admin_students", name: "ข้อมูลนักเรียน", href: "/admin/students", icon: <Users className="w-6 h-6" />, color: "bg-indigo-500/20 text-indigo-600" }
      ]
    },
    {
      title: "งาน HR",
      icon: <Users className="w-5 h-5 text-purple-500" />,
      color: "border-purple-500/20 bg-purple-500/5",
      tools: [
        { id: "admin_users", name: "จัดการผู้ใช้งาน", href: "/admin/users", icon: <Users className="w-6 h-6" />, color: "bg-purple-500/20 text-purple-600" },
        { id: "admin_attendance", name: "ข้อมูลการเข้างาน", href: "/admin/attendance", icon: <Clock className="w-6 h-6" />, color: "bg-purple-500/20 text-purple-600" }
      ]
    },
    {
      title: "งานประชาสัมพันธ์ (PR)",
      icon: <Megaphone className="w-5 h-5 text-rose-500" />,
      color: "border-rose-500/20 bg-rose-500/5",
      tools: [
        { id: "admin_website", name: "จัดการเว็บไซต์", href: "/admin/website", icon: <Globe className="w-6 h-6" />, color: "bg-rose-500/20 text-rose-600" },
        { id: "post_assistant", name: "Post Assistance", href: "/post-assistant.html", icon: <MessageSquare className="w-6 h-6" />, color: "bg-rose-500/20 text-rose-600" },
        { id: "audio_remote", name: "Audio Remote", href: "/audio-remote.html", icon: <Radio className="w-6 h-6" />, color: "bg-rose-500 text-white" },
        { id: "qr_generator", name: "สร้าง QR Code", href: "/qr-generator", icon: <QrCode className="w-6 h-6" />, color: "bg-rose-500 text-white" }
      ]
    },
    {
      title: "งานบริหารทั่วไป",
      icon: <Settings className="w-5 h-5 text-slate-500" />,
      color: "border-slate-500/20 bg-slate-500/5",
      tools: [
        { id: "settings", name: "การตั้งค่า", href: "#", icon: <Settings className="w-6 h-6" />, color: "bg-slate-500/20 text-slate-600" }
      ]
    },
    {
      title: "งานวิชาการ",
      icon: <GraduationCap className="w-5 h-5 text-orange-500" />,
      color: "border-orange-500/20 bg-orange-500/5",
      tools: [
        { id: "academic_todo", name: "รอการพัฒนา", href: "#", icon: <GraduationCap className="w-6 h-6" />, color: "bg-orange-500/20 text-orange-600" }
      ]
    }
  ];

  // Filter departments based on assigned features
  // If the user has 'admin' role, maybe show everything? 
  // "ถ้าทำเป็นroleเลยอาจจะไม่เวิร์คเพราะหลายคนทำหลายจ็อบ ให้adminเป็นคนassignฟีเจอร์แต่ละหมวดให้แต่ละยูสเซอร์"
  // This implies even admins should be filtered by assigned_features if we want it truly individualized,
  // but let's assume if assigned_features is empty and they are admin, maybe we show nothing until assigned.
  // We'll strictly rely on assigned_features, but for fallback (e.g. before migration), we can fallback to all if admin.
  const adminEmails = ['admin@somkidvittaya.ac.th', 'peerawat@somkidvittaya.ac.th', 'media@somkidvittaya.ac.th', 'admin@svportal.com'];
  const isAdmin = appUser?.role === 'admin' || role === 'admin' || (user?.email ? adminEmails.includes(user.email.toLowerCase()) : false);
  const assignedFeatures = appUser?.assigned_features || [];
  const showAll = isAdmin && assignedFeatures.length === 0;

  const filteredDepartments = allDepartments.map(dept => {
    return {
      ...dept,
      tools: dept.tools.filter(tool => showAll || assignedFeatures.includes(tool.id) || (isAdmin && assignedFeatures.length === 0))
    };
  }).filter(dept => dept.tools.length > 0);

  let displayName = appUser?.full_name;
  if (!displayName) {
    if (user?.email?.toLowerCase() === 'admin@somkidvittaya.ac.th') displayName = 'Workspace Admin';
    else if (user?.email?.toLowerCase() === 'peerawat@somkidvittaya.ac.th') displayName = 'peerawat';
    else if (user?.email?.toLowerCase() === 'media@somkidvittaya.ac.th') displayName = 'media';
    else displayName = user?.email ? user.email.split('@')[0] : 'ผู้ใช้งาน';
  }

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
          <h1 className="text-3xl font-extrabold tracking-tight text-primary mb-1">
            สวัสดี, {displayName}
          </h1>
          <p className="text-foreground/60 font-medium">ยินดีต้อนรับสู่ศูนย์กลางระบบงาน (SVPortal)</p>
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
              <span className="font-bold text-lg">ลงเวลาทำงาน</span>
            </motion.div>
          </Link>
        </div>
      </div>

      {/* Departments Grid */}
      {filteredDepartments.length === 0 ? (
        <div className="bg-surface backdrop-blur-xl rounded-3xl p-12 text-center border border-white/60">
          <Settings className="w-16 h-16 text-foreground/20 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground/60 mb-2">ยังไม่มีโมดูลที่ได้รับมอบหมาย</h2>
          <p className="text-foreground/40">กรุณาติดต่อผู้ดูแลระบบเพื่อกำหนดสิทธิ์การเข้าถึงฟีเจอร์ต่างๆ</p>
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
