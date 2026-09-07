'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Users, FileText, Image as ImageIcon, Calendar, FileBox, LayoutDashboard } from 'lucide-react';

export default function WebsiteAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    { href: '/admin/website/personnel', label: 'บุคลากร', icon: Users },
    { href: '/admin/website/news', label: 'ข่าวสาร', icon: FileText },
    { href: '/admin/website/albums', label: 'ภาพกิจกรรม', icon: ImageIcon },
    { href: '/admin/website/calendar', label: 'ปฏิทิน', icon: Calendar },
    { href: '/admin/website/documents', label: 'เอกสารดาวน์โหลด', icon: FileBox },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans">
      <div className="flex flex-col md:flex-row gap-8">
        
        {/* Sidebar Navigation */}
        <div className="w-full md:w-64 flex-shrink-0">
          <div className="bg-surface/80 backdrop-blur-xl rounded-3xl shadow-lg border border-white/20 p-4 sticky top-20 md:top-24">
            <div className="mb-4 px-2 pt-1">
              <div className="text-xs text-foreground/50 mb-1 flex items-center gap-1 font-medium">
                <Link href="/home" className="hover:text-primary transition-colors">หน้าหลัก</Link> 
                <span>/</span>
                <span>จัดการเว็บไซต์</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                  <LayoutDashboard className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-extrabold text-primary">Website CMS</h2>
              </div>
            </div>
            
            <nav className="flex md:flex-col gap-1.5 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
              {navItems.map(item => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link 
                    key={item.href} 
                    href={item.href}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl font-bold transition-all relative whitespace-nowrap text-sm ${
                      isActive 
                        ? 'text-primary bg-primary/10' 
                        : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'
                    }`}
                  >
                    {isActive && (
                      <motion.div 
                        layoutId="active-nav"
                        className="absolute inset-0 bg-primary/10 rounded-2xl"
                        initial={false}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                    <item.icon className={`w-4 h-4 relative z-10 ${isActive ? 'text-primary' : 'opacity-70'}`} />
                    <span className="relative z-10">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0">
          {children}
        </div>
        
      </div>
    </div>
  );
}
