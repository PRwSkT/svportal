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
  MessageSquare
} from 'lucide-react';

export default function HomeLaunchpad() {
  const { role } = useAuth();

  // Temporary: In the future we will filter by role, but for now we show all
  // const isAdmin = role === 'admin';
  // const isCashier = role === 'cashier';
  
  const departments = [
    {
      title: "งานการเงิน",
      icon: <Wallet className="w-5 h-5 text-emerald-500" />,
      color: "border-emerald-500/20 bg-emerald-500/5",
      tools: [
        { name: "แดชบอร์ดสรุปยอด", href: "/dashboard", icon: <LineChart className="w-6 h-6" />, color: "bg-emerald-500 text-white" },
        { name: "ชำระค่าเทอม", href: "/pos/fees", icon: <CreditCard className="w-6 h-6" />, color: "bg-emerald-500/20 text-emerald-600" },
        { name: "รายงานการเงิน", href: "/admin/reports", icon: <FileText className="w-6 h-6" />, color: "bg-emerald-500/20 text-emerald-600" }
      ]
    },
    {
      title: "งานร้านค้าสหกรณ์",
      icon: <ShoppingBag className="w-5 h-5 text-blue-500" />,
      color: "border-blue-500/20 bg-blue-500/5",
      tools: [
        { name: "POS ขายสินค้า", href: "/pos/shop", icon: <ShoppingCart className="w-6 h-6" />, color: "bg-blue-500 text-white" },
        { name: "จัดการสินค้า", href: "/admin/products", icon: <ShoppingBag className="w-6 h-6" />, color: "bg-blue-500/20 text-blue-600" },
        { name: "เติมเงิน Wallet", href: "/pos/wallet/topup", icon: <Wallet className="w-6 h-6" />, color: "bg-blue-500/20 text-blue-600" },
        { name: "Wallet นักเรียน", href: "/admin/wallet/students", icon: <Users className="w-6 h-6" />, color: "bg-blue-500/20 text-blue-600" }
      ]
    },
    {
      title: "งานทะเบียน",
      icon: <FileText className="w-5 h-5 text-indigo-500" />,
      color: "border-indigo-500/20 bg-indigo-500/5",
      tools: [
        { name: "ข้อมูลนักเรียน", href: "/admin/students", icon: <Users className="w-6 h-6" />, color: "bg-indigo-500/20 text-indigo-600" }
      ]
    },
    {
      title: "งาน HR",
      icon: <Users className="w-5 h-5 text-purple-500" />,
      color: "border-purple-500/20 bg-purple-500/5",
      tools: [
        { name: "จัดการผู้ใช้งาน", href: "/admin/users", icon: <Users className="w-6 h-6" />, color: "bg-purple-500/20 text-purple-600" }
      ]
    },
    {
      title: "งานประชาสัมพันธ์ (PR)",
      icon: <Megaphone className="w-5 h-5 text-rose-500" />,
      color: "border-rose-500/20 bg-rose-500/5",
      tools: [
        { name: "Post Assistance", href: "/post-assistant.html", icon: <MessageSquare className="w-6 h-6" />, color: "bg-rose-500/20 text-rose-600" }
      ]
    },
    {
      title: "งานบริหารทั่วไป",
      icon: <Settings className="w-5 h-5 text-slate-500" />,
      color: "border-slate-500/20 bg-slate-500/5",
      tools: [
        { name: "การตั้งค่า", href: "#", icon: <Settings className="w-6 h-6" />, color: "bg-slate-500/20 text-slate-600" }
      ]
    },
    {
      title: "งานวิชาการ",
      icon: <GraduationCap className="w-5 h-5 text-orange-500" />,
      color: "border-orange-500/20 bg-orange-500/5",
      tools: [
        { name: "รอการพัฒนา", href: "#", icon: <GraduationCap className="w-6 h-6" />, color: "bg-orange-500/20 text-orange-600" }
      ]
    }
  ];

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
          <h1 className="text-3xl font-extrabold tracking-tight text-primary mb-1">ศูนย์กลางระบบงาน</h1>
          <p className="text-foreground/60 font-medium">เลือกเครื่องมือที่ต้องการใช้งานตามแผนก</p>
        </div>
        
        {/* Quick Actions / Standalone */}
        <div className="flex gap-4">
          <Link href="/qr-generator">
            <motion.div 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-3 bg-gradient-to-r from-primary to-primary/80 text-white px-5 py-3 rounded-2xl shadow-md hover:shadow-lg transition-all"
            >
              <div className="p-2 bg-white/20 rounded-xl">
                <QrCode className="w-5 h-5" />
              </div>
              <span className="font-bold">สร้าง QR Code</span>
            </motion.div>
          </Link>
        </div>
      </div>

      {/* Departments Grid */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {departments.map((dept, idx) => (
          <motion.div key={idx} variants={itemVariants} className={`rounded-3xl border ${dept.color} overflow-hidden backdrop-blur-md shadow-sm hover:shadow-md transition-shadow`}>
            <div className="p-4 border-b border-foreground/5 flex items-center gap-3 bg-white/40">
              {dept.icon}
              <h2 className="font-bold text-lg text-foreground/80">{dept.title}</h2>
            </div>
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-4 bg-white/20">
              {dept.tools.map((tool, i) => (
                <Link key={i} href={tool.href} className="group flex flex-col items-center text-center gap-2">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 group-hover:shadow-md ${tool.color}`}>
                    {tool.icon}
                  </div>
                  <span className="text-xs font-medium text-foreground/70 group-hover:text-primary transition-colors line-clamp-2">
                    {tool.name}
                  </span>
                </Link>
              ))}
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
