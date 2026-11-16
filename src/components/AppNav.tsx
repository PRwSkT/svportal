'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import Image from 'next/image';
import { isSystemAdmin } from '@/lib/constants/auth';
import { getRoleConfig } from '@/lib/constants/roles';
import {
  LayoutGrid,
  Home,
  CreditCard,
  ShoppingBag,
  DollarSign,
  Wallet,
  FileBarChart,
  GraduationCap,
  Package,
  Clock,
  Globe,
  FileText,
  Award,
  QrCode,
  Sparkles,
  Radio,
  Users,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Bell,
  BookOpen,
  CalendarDays,
  CheckSquare,
  FileCheck2,
  Baby,
  Settings as SettingsIcon,
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
  ClipboardList,
  Tv,
} from 'lucide-react';
import { NotificationBell } from '@/components/NotificationBell';

interface NavModule {
  id: string;
  href: string;
  label: string;
  category: string;
  icon: any;
  colorClass: string;
}

export function AppNav() {
  const pathname = usePathname();
  const { user, role, appUser, isLoading, signOut } = useAuth();
  const { language, dict } = useLanguage();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close menus on route change
  useEffect(() => {
    setIsMenuOpen(false);
    setIsUserMenuOpen(false);
    setIsMobileDrawerOpen(false);
  }, [pathname]);

  const allModules: NavModule[] = useMemo(() => [
    // Finance & Accounting
    { id: 'dashboard', href: '/dashboard', label: dict.nav.dashboard, category: dict.nav.financeAccounting, icon: FileBarChart, colorClass: 'text-blue-600 bg-blue-50 border-blue-200' },
    { id: 'pos_fees', href: '/pos/fees', label: dict.nav.posFees, category: dict.nav.financeAccounting, icon: CreditCard, colorClass: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
    { id: 'admin_fees', href: '/admin/fees', label: language === 'th' ? 'ระบบผ่อนชำระ 5 เดือน & ค่าปรับ' : 'Installments & Late Fees', category: dict.nav.financeAccounting, icon: CreditCard, colorClass: 'text-rose-600 bg-rose-50 border-rose-200' },
    { id: 'admin_reports', href: '/admin/reports', label: dict.nav.adminReports, category: dict.nav.financeAccounting, icon: DollarSign, colorClass: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    { id: 'subsidy_free15y', href: '/admin/subsidy/free15y', label: language === 'th' ? 'เงินอุดหนุนเรียนฟรี 15 ปี (อร.11)' : '15Y Free Education Subsidy', category: dict.nav.financeAccounting, icon: HandCoins, colorClass: 'text-teal-600 bg-teal-50 border-teal-200' },
    // Co-op Store
    { id: 'pos_shop', href: '/pos/shop', label: dict.nav.posShop, category: dict.nav.coopStore, icon: ShoppingBag, colorClass: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    { id: 'admin_products', href: '/admin/products', label: dict.nav.adminProducts, category: dict.nav.coopStore, icon: Package, colorClass: 'text-amber-600 bg-amber-50 border-amber-200' },
    { id: 'pos_wallet_topup', href: '/pos/wallet/topup', label: dict.nav.posWalletTopup, category: dict.nav.coopStore, icon: Wallet, colorClass: 'text-teal-600 bg-teal-50 border-teal-200' },
    { id: 'admin_wallet_students', href: '/admin/wallet/students', label: dict.nav.adminWalletStudents, category: dict.nav.coopStore, icon: Wallet, colorClass: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
    // Registrar & Student Care
    { id: 'admin_students', href: '/admin/students', label: dict.nav.adminStudents, category: dict.nav.registrar, icon: GraduationCap, colorClass: 'text-blue-600 bg-blue-50 border-blue-200' },
    { id: 'student_attendance', href: '/admin/students/attendance', label: language === 'th' ? 'เช็กชื่อนักเรียน & ใบลา 360°' : 'Attendance & Leave 360°', category: dict.nav.registrar, icon: UserCheck, colorClass: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
    { id: 'pickup_dismissal', href: '/admin/safety/pickup', label: language === 'th' ? 'จุดรับ-ส่งเด็ก (Smart Pickup)' : 'Smart Pickup Kiosk', category: dict.nav.registrar, icon: QrCode, colorClass: 'text-[#7B1C3E] bg-[#7B1C3E]/10 border-[#7B1C3E]/20' },
    { id: 'pastoral_care', href: '/pastoral', label: language === 'th' ? 'ดูแลช่วยเหลือนักเรียน (SDQ & เยี่ยมบ้าน)' : 'Pastoral Care 360', category: dict.nav.registrar, icon: HeartHandshake, colorClass: 'text-rose-600 bg-rose-50 border-rose-200' },
    { id: 'student_nutrition', href: '/admin/students/nutrition', label: language === 'th' ? 'โรงครัวภายใน & โภชนาการ' : 'In-House Kitchen & Nutrition', category: dict.nav.registrar, icon: Apple, colorClass: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    { id: 'van_safety', href: '/admin/safety/van', label: language === 'th' ? 'ความปลอดภัยรถตู้รับ-ส่ง' : 'School Van Safety', category: dict.nav.registrar, icon: Bus, colorClass: 'text-amber-600 bg-amber-50 border-amber-200' },
    { id: 'school_infirmary', href: '/admin/health/infirmary', label: language === 'th' ? 'ห้องพยาบาล & แจ้งเตือนแพ้ยา' : 'School Infirmary', category: dict.nav.registrar, icon: Stethoscope, colorClass: 'text-red-600 bg-red-50 border-red-200' },
    // HR & Administration
    { id: 'admin_forms', href: '/admin/forms', label: dict.nav.adminForms, category: dict.nav.hrAdmin, icon: FileText, colorClass: 'text-rose-600 bg-rose-50 border-rose-200' },
    { id: 'admin_staff_cards', href: '/admin/personnel/cards', label: language === 'th' ? 'บัตรประจำตัวบุคลากร (Digital ID)' : 'Staff Digital ID Cards', category: dict.nav.hrAdmin, icon: ShieldCheck, colorClass: 'text-[#183e66] bg-sky-50 border-sky-200' },
    { id: 'admin_kpi', href: '/admin/kpi', label: dict.nav.adminKpi, category: dict.nav.hrAdmin, icon: Award, colorClass: 'text-[#7B1C3E] bg-[#7B1C3E]/10 border-[#7B1C3E]/20' },
    { id: 'admin_attendance', href: '/admin/attendance', label: dict.nav.adminAttendance, category: dict.nav.hrAdmin, icon: Clock, colorClass: 'text-purple-600 bg-purple-50 border-purple-200' },
    { id: 'admin_users', href: '/admin/users', label: dict.nav.adminUsers, category: dict.nav.hrAdmin, icon: Users, colorClass: 'text-violet-600 bg-violet-50 border-violet-200' },
    { id: 'esar_governance', href: '/admin/governance', label: language === 'th' ? 'ธรรมาภิบาล & รายงาน e-SAR' : 'Governance & e-SAR', category: dict.nav.hrAdmin, icon: ShieldCheck, colorClass: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
    // PR & Communications
    { id: 'parent_communications', href: '/admin/communications', label: language === 'th' ? 'ศูนย์สื่อสารครู-ผู้ปกครอง (2-Way)' : 'Parent-Teacher Comms', category: dict.nav.pr, icon: MessageCircle, colorClass: 'text-[#7B1C3E] bg-[#7B1C3E]/10 border-[#7B1C3E]/20' },
    { id: 'parents_portal_preview', href: '/parents', label: language === 'th' ? 'Parents Portal (PWA ผู้ปกครอง)' : 'Parents Portal PWA', category: dict.nav.pr, icon: Smartphone, colorClass: 'text-amber-700 bg-amber-50 border-amber-200' },
    { id: 'admin_notifications', href: '/admin/notifications', label: language === 'th' ? 'ระบบแจ้งเตือน AI' : 'AI Notifications', category: dict.nav.pr, icon: Bell, colorClass: 'text-rose-600 bg-rose-50 border-rose-200' },
    { id: 'admin_website', href: '/admin/website', label: dict.nav.adminWebsite, category: dict.nav.pr, icon: Globe, colorClass: 'text-sky-600 bg-sky-50 border-sky-200' },
    { id: 'post_assistant', href: '/post-assistant', label: dict.nav.postAssistant, category: dict.nav.pr, icon: Sparkles, colorClass: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
    { id: 'audio_remote', href: '/audio-remote', label: dict.nav.audioRemote, category: dict.nav.pr, icon: Radio, colorClass: 'text-amber-600 bg-amber-50 border-amber-200' },
    { id: 'admin_signage', href: '/admin/signage', label: language === 'th' ? 'จอประชาสัมพันธ์ทีวี (Signage)' : 'Digital Signage TV', category: dict.nav.pr, icon: Tv, colorClass: 'text-blue-700 bg-blue-50 border-blue-200' },
    { id: 'room_booking', href: '/admin/room-booking', label: language === 'th' ? 'ระบบจองห้อง & จอแสดงผลหน้าห้อง' : 'Smart Room Booking & Display', category: dict.nav.pr, icon: CalendarDays, colorClass: 'text-[#091b30] bg-amber-50 border-amber-200' },
    { id: 'qr_generator', href: '/qr-generator', label: dict.nav.qrGenerator, category: dict.nav.pr, icon: QrCode, colorClass: 'text-pink-600 bg-pink-50 border-pink-200' },
    // Academic Affairs (งานวิชาการและงานวัดผล)
    { id: 'academic_hub', href: '/academic', label: language === 'th' ? 'ศูนย์รวมวิชาการ' : 'Academic Hub', category: language === 'th' ? 'งานวิชาการ' : 'Academic Affairs', icon: GraduationCap, colorClass: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
    { id: 'academic_gradebook', href: '/academic/gradebook', label: language === 'th' ? 'Smart Gradebook (ปพ.5)' : 'Gradebook (P.P.5)', category: language === 'th' ? 'งานวิชาการ' : 'Academic Affairs', icon: BookOpen, colorClass: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    { id: 'academic_early_years', href: '/academic/early-years', label: language === 'th' ? 'สมุดปฐมวัย & กิจวัตรรายวัน' : 'Early Years & Daily Care', category: language === 'th' ? 'งานวิชาการ' : 'Academic Affairs', icon: Baby, colorClass: 'text-pink-600 bg-pink-50 border-pink-200' },
    { id: 'academic_assignments', href: '/academic/assignments', label: language === 'th' ? 'สั่งการบ้าน & ชิ้นงานประถม' : 'Primary Assignments', category: language === 'th' ? 'งานวิชาการ' : 'Academic Affairs', icon: ClipboardList, colorClass: 'text-blue-600 bg-blue-50 border-blue-200' },
    { id: 'academic_exams', href: '/academic/exams', label: language === 'th' ? 'คลังข้อสอบ & ตรวจ OMR' : 'Exams & OMR', category: language === 'th' ? 'งานวิชาการ' : 'Academic Affairs', icon: CheckSquare, colorClass: 'text-amber-600 bg-amber-50 border-amber-200' },
    { id: 'academic_timetable', href: '/academic/timetable', label: language === 'th' ? 'ตารางสอน & จัดสอนแทน' : 'Timetable', category: language === 'th' ? 'งานวิชาการ' : 'Academic Affairs', icon: CalendarDays, colorClass: 'text-sky-600 bg-sky-50 border-sky-200' },
    { id: 'academic_documents', href: '/academic/documents', label: language === 'th' ? 'ออกเอกสาร ปพ.1-3 & ปพ.6' : 'Statutory Docs (PP.1-6)', category: language === 'th' ? 'งานวิชาการ' : 'Academic Affairs', icon: ScrollText, colorClass: 'text-teal-600 bg-teal-50 border-teal-200' },
    { id: 'academic_opec', href: '/academic/opec', label: language === 'th' ? 'ส่งออก REGIS (สช.)' : 'OPEC REGIS', category: language === 'th' ? 'งานวิชาการ' : 'Academic Affairs', icon: FileCheck2, colorClass: 'text-purple-600 bg-purple-50 border-purple-200' },
    { id: 'admin_academic', href: '/admin/academic', label: language === 'th' ? 'ตั้งค่าหลักสูตร & ห้องเรียน' : 'Academic Setup', category: language === 'th' ? 'งานวิชาการ' : 'Academic Affairs', icon: SettingsIcon, colorClass: 'text-slate-600 bg-slate-50 border-slate-200' },
    { id: 'calendar', href: '/calendar', label: language === 'th' ? 'ปฏิทินปฏิบัติงาน & เวรครู' : 'Operational Calendar', category: language === 'th' ? 'งานวิชาการ' : 'Academic Affairs', icon: CalendarDays, colorClass: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  ], [dict, language]);

  if (pathname === '/' || pathname === '/login' || pathname.startsWith('/website') || pathname.startsWith('/forms/') || pathname.startsWith('/parents') || pathname.startsWith('/room-checkin') || pathname.startsWith('/verify')) return null;
  if (isLoading || !user) return null;

  const isAdmin = role === 'admin' || appUser?.role === 'admin' || isSystemAdmin(user?.email);
  const assignedFeatures = appUser?.assigned_features || [];

  // Filter accessible modules based on permissions
  const accessibleModules = allModules.filter((item) => {
    if (isAdmin) return true;
    if (assignedFeatures.includes(item.id)) return true;
    if (role === 'teacher' && ['academic_hub', 'academic_gradebook', 'academic_early_years', 'academic_assignments', 'academic_exams', 'academic_timetable', 'calendar', 'pastoral_care', 'student_attendance', 'parent_communications', 'admin_forms', 'admin_kpi'].includes(item.id)) return true;
    if (role === 'academic staff' && ['academic_hub', 'academic_gradebook', 'academic_early_years', 'academic_assignments', 'academic_exams', 'academic_timetable', 'academic_documents', 'academic_opec', 'admin_academic', 'calendar', 'student_attendance', 'admin_students', 'parent_communications', 'admin_forms'].includes(item.id)) return true;
    if (role === 'cashier' && ['pos_shop', 'pos_fees', 'admin_fees', 'pos_wallet_topup'].includes(item.id)) return true;
    return false;
  });

  // Unique categories of accessible modules
  const categories = Array.from(new Set(accessibleModules.map((m) => m.category)));

  // Current active module if any
  const currentActiveModule = allModules.find(
    (m) => pathname === m.href || (m.href !== '/dashboard' && pathname.startsWith(m.href))
  );

  const userRole = isAdmin ? 'admin' : (appUser?.role || role);
  const roleBadge = getRoleConfig(userRole);

  const displayName = appUser?.full_name || (user.email ? user.email.split('@')[0] : 'ผู้ใช้งาน');

  return (
    <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 shadow-xs sticky top-0 z-50 transition-all">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2 sm:gap-4">
          
          {/* ======================================================== */}
          {/* Left: Brand Logo & Desktop Navigation                     */}
          {/* ======================================================== */}
          <div className="flex items-center gap-2 sm:gap-4 lg:gap-6 min-w-0">
            <Link
              href="/home"
              className="flex items-center gap-2 group focus:outline-none shrink-0"
              title="SV Portal - หน้าหลัก"
            >
              <Image
                src="/SV-Portal.png"
                alt="SV Portal"
                width={128}
                height={34}
                className="h-7 sm:h-8 w-auto object-contain transition-transform group-hover:scale-105"
                priority
              />
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1 sm:gap-1.5 min-w-0">
              <Link
                href="/home"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                  pathname === '/home'
                    ? 'bg-[#7B1C3E] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800'
                }`}
              >
                <Home className="w-4 h-4 shrink-0" />
                <span className="hidden lg:inline">{language === 'th' ? 'หน้าหลัก' : 'Home'}</span>
              </Link>

              {/* Dropdown: เมนูระบบ (All Modules Menu) */}
              <div className="relative shrink-0" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold border transition-all ${
                    isMenuOpen
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600 shadow-xs'
                      : 'text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700'
                  }`}
                  aria-expanded={isMenuOpen}
                >
                  <LayoutGrid className="w-4 h-4 text-[#7B1C3E] dark:text-pink-400 shrink-0" />
                  <span>{language === 'th' ? 'เมนูระบบ' : 'Menu'}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                      isMenuOpen ? 'rotate-180 text-slate-700 dark:text-slate-200' : ''
                    }`}
                  />
                </button>

                {/* Desktop Dropdown Panel */}
                {isMenuOpen && (
                  <div className="absolute left-0 mt-2 w-[480px] lg:w-[540px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-800 p-4 lg:p-5 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
                      <div className="flex items-center gap-2">
                        <LayoutGrid className="w-4 h-4 text-[#7B1C3E] dark:text-pink-400" />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                          {dict.nav.navigationMenu}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-slate-400">
                        {accessibleModules.length} {language === 'th' ? 'ระบบที่ใช้งานได้' : 'modules'}
                      </span>
                    </div>

                    <div className="space-y-4 max-h-[68vh] overflow-y-auto pr-1">
                      {categories.map((category) => {
                        const items = accessibleModules.filter((m) => m.category === category);
                        return (
                          <div key={category}>
                            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                              {category}
                            </h4>
                            <div className="grid grid-cols-2 gap-2">
                              {items.map((item) => {
                                const ItemIcon = item.icon;
                                const isItemActive =
                                  pathname === item.href ||
                                  (item.href !== '/dashboard' && pathname.startsWith(item.href));
                                return (
                                  <Link
                                    key={item.id}
                                    href={item.href}
                                    onClick={() => setIsMenuOpen(false)}
                                    className={`flex items-center gap-2.5 p-2 rounded-xl border transition-all ${
                                      isItemActive
                                        ? 'bg-[#7B1C3E]/10 border-[#7B1C3E]/30 text-[#7B1C3E] dark:text-pink-300 font-semibold'
                                        : 'bg-slate-50/60 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-100 dark:border-slate-700/80 text-slate-700 dark:text-slate-200'
                                    }`}
                                  >
                                    <div
                                      className={`w-7 h-7 rounded-lg flex items-center justify-center border shrink-0 ${item.colorClass}`}
                                    >
                                      <ItemIcon className="w-3.5 h-3.5" />
                                    </div>
                                    <span className="text-xs font-medium truncate">
                                      {item.label}
                                    </span>
                                  </Link>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Active Module Indicator Tab (Only on extra wide screens to avoid clutter) */}
              {pathname !== '/home' && currentActiveModule && (
                <div className="hidden 2xl:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#7B1C3E]/10 text-[#7B1C3E] dark:text-pink-300 border border-[#7B1C3E]/20 max-w-[220px] truncate shrink-0">
                  <currentActiveModule.icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{currentActiveModule.label}</span>
                </div>
              )}
            </nav>
          </div>

          {/* ======================================================== */}
          {/* Right: Actions & Responsive User Profile Menu            */}
          {/* ======================================================== */}
          <div className="hidden md:flex items-center gap-2 lg:gap-2.5 shrink-0">
            {/* Quick Launch: My Staff ID Card (Only on xl+ screens) */}
            <Link
              href="/staff/id-card"
              className={`hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                pathname === '/staff/id-card'
                  ? 'bg-[#183e66] text-white border-[#183e66] shadow-xs'
                  : 'bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/40 text-[#183e66] dark:text-sky-300 border-sky-200/80 dark:border-sky-800/80'
              }`}
              title="เปิดบัตรประจำตัวบุคลากรออนไลน์ (My Digital Staff ID)"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
              <span>{language === 'th' ? 'บัตรของฉัน' : 'My ID'}</span>
            </Link>

            {/* Notification Bell */}
            <NotificationBell />

            {/* Language Switcher */}
            <LanguageSwitcher size="sm" />

            {/* Vertical Separator */}
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />

            {/* Unified User Profile Menu Dropdown */}
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className={`flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-2xl border transition-all ${
                  isUserMenuOpen
                    ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 shadow-xs ring-2 ring-slate-200/80 dark:ring-slate-700'
                    : 'bg-slate-50/80 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200/80 dark:border-slate-700'
                }`}
                aria-expanded={isUserMenuOpen}
                aria-label="User Profile Menu"
              >
                {/* User Avatar Initial */}
                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#7B1C3E] to-[#9B2C4E] text-white flex items-center justify-center font-bold text-xs uppercase shadow-xs shrink-0">
                  {displayName.charAt(0)}
                </div>

                {/* Display Name (Shown on lg+ screens) */}
                <span className="hidden lg:inline-block text-xs font-semibold text-slate-800 dark:text-slate-100 max-w-[110px] truncate" title={displayName}>
                  {displayName}
                </span>

                {/* Role Badge (Shown on xl+ screens) */}
                <span className={`hidden xl:inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold border ${roleBadge.badgeClass}`}>
                  {language === 'th' ? roleBadge.labelTh : roleBadge.labelEn}
                </span>

                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                    isUserMenuOpen ? 'rotate-180 text-slate-700 dark:text-slate-200' : ''
                  }`}
                />
              </button>

              {/* User Dropdown Panel */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-800 p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                  {/* User Profile Header */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-100 dark:border-slate-800 mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#7B1C3E] text-white flex items-center justify-center font-bold text-sm uppercase shrink-0 shadow-xs">
                        {displayName.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate" title={displayName}>
                          {displayName}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate" title={user.email || ''}>
                          {user.email}
                        </p>
                        <div className="mt-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${roleBadge.badgeClass}`}>
                            {language === 'th' ? roleBadge.labelTh : roleBadge.labelEn}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Links */}
                  <div className="space-y-1">
                    {/* My Staff ID Card */}
                    <Link
                      href="/staff/id-card"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center justify-between p-2.5 rounded-xl hover:bg-sky-50 dark:hover:bg-sky-950/40 text-slate-700 dark:text-slate-200 hover:text-[#183e66] dark:hover:text-sky-300 transition-colors group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-900/50 text-[#183e66] dark:text-sky-300 flex items-center justify-center shrink-0">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold leading-tight truncate">
                            {language === 'th' ? 'บัตรประจำตัวบุคลากร' : 'Staff ID Card'}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {language === 'th' ? 'นามบัตรดิจิทัล & NFC' : 'Digital ID & NFC'}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-sky-600 bg-sky-100/80 dark:bg-sky-900/60 dark:text-sky-300 px-2 py-0.5 rounded-md shrink-0">
                        Active
                      </span>
                    </Link>

                    {/* Parents Portal Link */}
                    <Link
                      href="/parents"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-950/40 text-slate-700 dark:text-slate-200 hover:text-amber-800 dark:hover:text-amber-300 transition-colors"
                    >
                      <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 flex items-center justify-center shrink-0">
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold leading-tight truncate">
                          Parents Portal (PWA)
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {language === 'th' ? 'ระบบผู้ปกครอง' : 'Parent Web App'}
                        </p>
                      </div>
                    </Link>

                    {/* If Admin: User Management */}
                    {isAdmin && (
                      <Link
                        href="/admin/users"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
                      >
                        <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                          <Users className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold leading-tight truncate">
                            {language === 'th' ? 'จัดการผู้ใช้งาน' : 'User Management'}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {language === 'th' ? 'สิทธิ์และบทบาท' : 'Roles & Permissions'}
                          </p>
                        </div>
                      </Link>
                    )}
                  </div>

                  {/* Sign Out Button */}
                  <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        signOut();
                      }}
                      className="w-full flex items-center gap-2 p-2 rounded-xl text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>{dict.nav.logout}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ======================================================== */}
          {/* Mobile Right Controls: Bell + Language + Hamburger       */}
          {/* ======================================================== */}
          <div className="flex md:hidden items-center gap-1.5 sm:gap-2 shrink-0">
            <NotificationBell />
            <LanguageSwitcher size="sm" />
            <button
              type="button"
              onClick={() => setIsMobileDrawerOpen(!isMobileDrawerOpen)}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="เมนูหลัก"
            >
              {isMobileDrawerOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <Menu className="w-5 h-5 sm:w-6 sm:h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* Mobile Drawer (Responsive Overlay)                       */}
      {/* ======================================================== */}
      {isMobileDrawerOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl animate-in slide-in-from-top-2 duration-200 max-h-[85vh] overflow-y-auto">
          {/* User Profile Card */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#7B1C3E] text-white flex items-center justify-center font-bold text-sm uppercase shrink-0">
                {displayName.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight truncate">{displayName}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[190px]">{user.email}</p>
              </div>
            </div>
            <div className="shrink-0 ml-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${roleBadge.badgeClass}`}>
                {language === 'th' ? roleBadge.labelTh : roleBadge.labelEn}
              </span>
            </div>
          </div>

          {/* Quick Action Navigation Grid */}
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/home"
                onClick={() => setIsMobileDrawerOpen(false)}
                className={`flex items-center gap-2 p-2.5 rounded-xl font-bold text-xs transition-all ${
                  pathname === '/home'
                    ? 'bg-[#7B1C3E] text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200'
                }`}
              >
                <Home className="w-4 h-4 shrink-0" />
                <span>{language === 'th' ? 'หน้าหลัก' : 'Home'}</span>
              </Link>

              <Link
                href="/staff/id-card"
                onClick={() => setIsMobileDrawerOpen(false)}
                className={`flex items-center gap-2 p-2.5 rounded-xl font-bold text-xs transition-all ${
                  pathname === '/staff/id-card'
                    ? 'bg-[#183e66] text-white shadow-xs'
                    : 'bg-sky-50 dark:bg-sky-950/50 text-[#183e66] dark:text-sky-300 hover:bg-sky-100 border border-sky-200/80'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0" />
                <span>{language === 'th' ? 'บัตรของฉัน' : 'My ID'}</span>
              </Link>
            </div>

            {categories.map((category) => {
              const items = accessibleModules.filter((m) => m.category === category);
              return (
                <div key={category} className="space-y-1.5">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                    {category}
                  </h4>
                  <div className="grid grid-cols-1 gap-1">
                    {items.map((item) => {
                      const ItemIcon = item.icon;
                      const isItemActive =
                        pathname === item.href ||
                        (item.href !== '/dashboard' && pathname.startsWith(item.href));
                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          onClick={() => setIsMobileDrawerOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                            isItemActive
                              ? 'bg-[#7B1C3E]/10 border-[#7B1C3E]/30 text-[#7B1C3E] font-bold'
                              : 'bg-white dark:bg-slate-800 hover:bg-slate-50 border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center border shrink-0 ${item.colorClass}`}>
                            <ItemIcon className="w-3.5 h-3.5" />
                          </div>
                          <span className="truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={signOut}
                className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>{dict.nav.logout}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
