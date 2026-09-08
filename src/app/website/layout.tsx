'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { 
  Home, 
  FileText, 
  Image as ImageIcon, 
  Calendar, 
  FolderDown, 
  Users, 
  LogIn, 
  Menu, 
  X, 
  Phone, 
  Mail, 
  MapPin, 
  ExternalLink 
} from 'lucide-react';

const NAV_LINKS = [
  { href: '/website', label: 'หน้าแรก', icon: Home },
  { href: '/website/news', label: 'ข่าวสารและประกาศ', icon: FileText },
  { href: '/website/albums', label: 'ภาพกิจกรรม', icon: ImageIcon },
  { href: '/website/calendar', label: 'ปฏิทินกิจกรรม', icon: Calendar },
  { href: '/website/documents', label: 'ดาวน์โหลดเอกสาร', icon: FolderDown },
  { href: '/website/personnel', label: 'ทำเนียบบุคลากร', icon: Users },
];

export default function WebsiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary selection:text-white">
      {/* Top Bar info */}
      <div className="bg-primary text-white text-xs py-2 px-4 sm:px-8 flex justify-between items-center z-40">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1.5 opacity-90">
            <MapPin className="w-3.5 h-3.5" /> โรงเรียนสมคิดวิทยา อ.เมือง จ.ระยอง
          </span>
          <span className="hidden sm:flex items-center gap-1.5 opacity-90">
            <Phone className="w-3.5 h-3.5" /> 038-611251
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1 font-bold bg-white/15 hover:bg-white/25 px-2.5 py-0.5 rounded-full transition-colors text-xs"
          >
            <LogIn className="w-3 h-3" /> พอร์ทัล SVPortal
          </Link>
        </div>
      </div>

      {/* Main Navigation */}
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-xl border-b border-foreground/5 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* School Brand */}
            <Link href="/website" className="flex items-center gap-3.5 group">
              <div className="relative w-12 h-12 flex-shrink-0">
                <Image
                  src="/logo2.png"
                  alt="ตราโรงเรียนสมคิดวิทยา"
                  fill
                  className="object-contain drop-shadow-sm group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-primary tracking-tight leading-tight group-hover:text-primary/90 transition-colors">
                  โรงเรียนสมคิดวิทยา
                </h1>
                <p className="text-xs font-semibold text-foreground/50 tracking-wider">
                  SOMKIDVITTYA SCHOOL
                </p>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1 xl:gap-2">
              {NAV_LINKS.map((link) => {
                const isActive = link.href === '/website' 
                  ? pathname === '/website' 
                  : pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3.5 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-primary text-white shadow-md shadow-primary/20'
                        : 'text-foreground/70 hover:text-primary hover:bg-foreground/5'
                    }`}
                  >
                    <link.icon className="w-4 h-4" />
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {/* Mobile Menu Button */}
            <div className="lg:hidden flex items-center">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-xl text-foreground/70 hover:text-primary hover:bg-foreground/5 transition-colors"
                aria-label="Toggle navigation menu"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-foreground/5 bg-surface/95 backdrop-blur-xl px-4 py-4 space-y-1 shadow-xl">
            {NAV_LINKS.map((link) => {
              const isActive = link.href === '/website' 
                ? pathname === '/website' 
                : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-bold transition-colors ${
                    isActive
                      ? 'bg-primary text-white'
                      : 'text-foreground/70 hover:bg-foreground/5 hover:text-primary'
                  }`}
                >
                  <link.icon className="w-5 h-5" />
                  {link.label}
                </Link>
              );
            })}
            <div className="pt-3 border-t border-foreground/10">
              <Link
                href="/"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 w-full py-3 bg-primary/10 text-primary font-bold rounded-xl text-base"
              >
                <LogIn className="w-5 h-5" /> เข้าสู่ระบบ SVPortal
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Page Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-surface border-t border-foreground/5 text-foreground/80 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2 space-y-4">
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10">
                  <Image src="/logo2.png" alt="School Logo" fill className="object-contain" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-primary">โรงเรียนสมคิดวิทยา</h3>
                  <p className="text-xs text-foreground/50">SOMKIDVITTYA SCHOOL BURIRAM</p>
                </div>
              </div>
              <p className="text-sm text-foreground/60 max-w-md leading-relaxed">
                มุ่งมั่นพัฒนาผู้เรียนให้มีความรู้ มีคุณธรรม นำเทคโนโลยี ส่งเสริมความเป็นเลิศตามศักยภาพ
                สู่มาตรฐานสากล บนพื้นฐานความเป็นไทย
              </p>
            </div>

            <div>
              <h4 className="font-extrabold text-sm text-foreground uppercase tracking-wider mb-3">
                เมนูด่วน
              </h4>
              <ul className="space-y-2 text-sm text-foreground/60 font-medium">
                <li><Link href="/website/news" className="hover:text-primary transition-colors">ข่าวสารประชาสัมพันธ์</Link></li>
                <li><Link href="/website/albums" className="hover:text-primary transition-colors">ภาพกิจกรรมและผลงาน</Link></li>
                <li><Link href="/website/calendar" className="hover:text-primary transition-colors">ปฏิทินวิชาการ</Link></li>
                <li><Link href="/website/documents" className="hover:text-primary transition-colors">ดาวน์โหลดแบบฟอร์ม</Link></li>
                <li><Link href="/website/personnel" className="hover:text-primary transition-colors">คณะครูและบุคลากร</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-extrabold text-sm text-foreground uppercase tracking-wider mb-3">
                ติดต่อโรงเรียน
              </h4>
              <ul className="space-y-2.5 text-sm text-foreground/60">
                <li className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>อำเภอเมือง จังหวัดบุรีรัมย์ 31000</span>
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-primary shrink-0" />
                  <span>038-611251</span>
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-primary shrink-0" />
                  <span>somkidvittaya@gmail.com</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-foreground/5 mt-8 pt-8 flex flex-col sm:flex-row justify-between items-center text-xs text-foreground/40 gap-4">
            <p>© {new Date().getFullYear()} โรงเรียนสมคิดวิทยา (Somkidvittaya School). All rights reserved.</p>
            <p className="flex items-center gap-2">
              Powered by <span className="font-bold text-primary">SVPortal</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
