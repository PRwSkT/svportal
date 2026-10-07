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
  User as UserIcon,
  Bell,
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
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close desktop dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close menus on route change
  useEffect(() => {
    setIsMenuOpen(false);
    setIsMobileDrawerOpen(false);
  }, [pathname]);

  const allModules: NavModule[] = useMemo(() => [
    // Finance & Accounting
    { id: 'dashboard', href: '/dashboard', label: dict.nav.dashboard, category: dict.nav.financeAccounting, icon: FileBarChart, colorClass: 'text-blue-600 bg-blue-50 border-blue-200' },
    { id: 'pos_fees', href: '/pos/fees', label: dict.nav.posFees, category: dict.nav.financeAccounting, icon: CreditCard, colorClass: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
    { id: 'admin_reports', href: '/admin/reports', label: dict.nav.adminReports, category: dict.nav.financeAccounting, icon: DollarSign, colorClass: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    // Co-op Store
    { id: 'pos_shop', href: '/pos/shop', label: dict.nav.posShop, category: dict.nav.coopStore, icon: ShoppingBag, colorClass: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    { id: 'admin_products', href: '/admin/products', label: dict.nav.adminProducts, category: dict.nav.coopStore, icon: Package, colorClass: 'text-amber-600 bg-amber-50 border-amber-200' },
    { id: 'pos_wallet_topup', href: '/pos/wallet/topup', label: dict.nav.posWalletTopup, category: dict.nav.coopStore, icon: Wallet, colorClass: 'text-teal-600 bg-teal-50 border-teal-200' },
    { id: 'admin_wallet_students', href: '/admin/wallet/students', label: dict.nav.adminWalletStudents, category: dict.nav.coopStore, icon: Wallet, colorClass: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
    // Registrar
    { id: 'admin_students', href: '/admin/students', label: dict.nav.adminStudents, category: dict.nav.registrar, icon: GraduationCap, colorClass: 'text-blue-600 bg-blue-50 border-blue-200' },
    // HR & Administration
    { id: 'admin_forms', href: '/admin/forms', label: dict.nav.adminForms, category: dict.nav.hrAdmin, icon: FileText, colorClass: 'text-rose-600 bg-rose-50 border-rose-200' },
    { id: 'admin_kpi', href: '/admin/kpi', label: dict.nav.adminKpi, category: dict.nav.hrAdmin, icon: Award, colorClass: 'text-[#7B1C3E] bg-[#7B1C3E]/10 border-[#7B1C3E]/20' },
    { id: 'admin_attendance', href: '/attendance', label: dict.nav.adminAttendance, category: dict.nav.hrAdmin, icon: Clock, colorClass: 'text-purple-600 bg-purple-50 border-purple-200' },
    { id: 'admin_users', href: '/admin/users', label: dict.nav.adminUsers, category: dict.nav.hrAdmin, icon: Users, colorClass: 'text-violet-600 bg-violet-50 border-violet-200' },
    // PR & Communications
    { id: 'admin_notifications', href: '/admin/notifications', label: 'ระบบแจ้งเตือน AI', category: dict.nav.pr, icon: Bell, colorClass: 'text-rose-600 bg-rose-50 border-rose-200' },
    { id: 'admin_website', href: '/admin/website', label: dict.nav.adminWebsite, category: dict.nav.pr, icon: Globe, colorClass: 'text-sky-600 bg-sky-50 border-sky-200' },
    { id: 'post_assistant', href: '/post-assistant', label: dict.nav.postAssistant, category: dict.nav.pr, icon: Sparkles, colorClass: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
    { id: 'audio_remote', href: '/audio-remote', label: dict.nav.audioRemote, category: dict.nav.pr, icon: Radio, colorClass: 'text-amber-600 bg-amber-50 border-amber-200' },
    { id: 'qr_generator', href: '/qr-generator', label: dict.nav.qrGenerator, category: dict.nav.pr, icon: QrCode, colorClass: 'text-pink-600 bg-pink-50 border-pink-200' },
  ], [dict]);

  if (isLoading || !user) return null;
  if (pathname === '/' || pathname === '/login' || pathname.startsWith('/website') || pathname.startsWith('/forms/')) return null;

  const isAdmin = role === 'admin' || appUser?.role === 'admin' || isSystemAdmin(user?.email);
  const assignedFeatures = appUser?.assigned_features || [];

  // Filter accessible modules based on permissions
  const accessibleModules = allModules.filter((item) => {
    if (isAdmin) return true;
    if (assignedFeatures.includes(item.id)) return true;
    if (role === 'cashier' && ['pos_shop', 'pos_fees', 'pos_wallet_topup'].includes(item.id)) return true;
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
    <header className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 shadow-sm sticky top-0 z-50 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Left Brand: SV Portal Logo Only */}
          <div className="flex items-center gap-6">
            <Link
              href="/home"
              className="flex items-center gap-2 group focus:outline-none flex-shrink-0"
              title="SV Portal - หน้าหลัก"
            >
              <Image
                src="/SV-Portal.png"
                alt="SV Portal"
                width={135}
                height={36}
                className="h-8 md:h-9 w-auto object-contain transition-transform group-hover:scale-105"
                priority
              />
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1.5">
              <Link
                href="/home"
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${
                  pathname === '/home'
                    ? 'bg-[#7B1C3E] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <Home className="w-4 h-4" />
                <span>{language === 'th' ? 'หน้าหลัก' : 'Home'}</span>
              </Link>

              {/* Active Module Indicator Tab (if not on /home) */}
              {pathname !== '/home' && currentActiveModule && (
                <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold bg-[#7B1C3E]/10 text-[#7B1C3E] border border-[#7B1C3E]/20">
                  <currentActiveModule.icon className="w-4 h-4" />
                  <span>{currentActiveModule.label}</span>
                </div>
              )}

              {/* Dropdown: เมนูระบบ (All Modules Menu) */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all ${
                    isMenuOpen
                      ? 'bg-slate-100 text-slate-900 border-slate-300 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border-slate-200'
                  }`}
                  aria-expanded={isMenuOpen}
                >
                  <LayoutGrid className="w-4 h-4 text-[#7B1C3E]" />
                  <span>{language === 'th' ? 'เมนูระบบ' : 'System Menu'}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                      isMenuOpen ? 'rotate-180 text-slate-700' : ''
                    }`}
                  />
                </button>

                {/* Desktop Dropdown Panel */}
                {isMenuOpen && (
                  <div className="absolute left-0 mt-2 w-[540px] bg-white rounded-2xl shadow-2xl border border-slate-200/90 p-5 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                      <div className="flex items-center gap-2">
                        <LayoutGrid className="w-4 h-4 text-[#7B1C3E]" />
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          {dict.nav.navigationMenu}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-slate-400">
                        {accessibleModules.length} {language === 'th' ? 'ระบบที่ใช้งานได้' : 'modules'}
                      </span>
                    </div>

                    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
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
                                    className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                                      isItemActive
                                        ? 'bg-[#7B1C3E]/10 border-[#7B1C3E]/30 text-[#7B1C3E] font-semibold'
                                        : 'bg-slate-50/60 hover:bg-slate-100 border-slate-100 hover:border-slate-200 text-slate-700'
                                    }`}
                                  >
                                    <div
                                      className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${item.colorClass}`}
                                    >
                                      <ItemIcon className="w-4 h-4" />
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
            </nav>
          </div>

          {/* Right Controls (Desktop Profile & Sign Out) */}
          <div className="hidden md:flex items-center gap-3">
            {/* Notification Bell */}
            <NotificationBell />

            {/* Language Switcher */}
            <LanguageSwitcher size="sm" showIcon />

            <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 px-3 py-1.5 rounded-xl">
              <div className="w-7 h-7 rounded-lg bg-[#7B1C3E]/15 text-[#7B1C3E] dark:text-pink-300 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                {displayName.charAt(0)}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 max-w-[130px] truncate" title={displayName}>
                  {displayName}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 max-w-[130px] truncate" title={user.email || ''}>
                  {user.email}
                </span>
              </div>
              <span className={`ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${roleBadge.badgeClass}`}>
                {language === 'th' ? roleBadge.labelTh : roleBadge.labelEn}
              </span>
            </div>

            <button
              type="button"
              onClick={signOut}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-100 transition-colors"
              title={dict.nav.logout}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{language === 'th' ? 'ออก' : 'Exit'}</span>
            </button>
          </div>

          {/* Mobile Right Controls: Notification Bell + Language Switcher + Hamburger */}
          <div className="flex md:hidden items-center gap-2">
            <NotificationBell />
            <LanguageSwitcher size="sm" />
            <button
              type="button"
              onClick={() => setIsMobileDrawerOpen(!isMobileDrawerOpen)}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="เมนูหลัก"
            >
              {isMobileDrawerOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer (Responsive Overlay) */}
      {isMobileDrawerOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl animate-in slide-in-from-top-2 duration-200 max-h-[85vh] overflow-y-auto">
          {/* User Profile Card */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#7B1C3E] text-white flex items-center justify-center font-bold text-sm uppercase">
                {displayName.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{displayName}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[170px]">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${roleBadge.badgeClass}`}>
                {language === 'th' ? roleBadge.labelTh : roleBadge.labelEn}
              </span>
            </div>
          </div>

          {/* Mobile Navigation Links */}
          <div className="p-4 space-y-5">
            <Link
              href="/home"
              onClick={() => setIsMobileDrawerOpen(false)}
              className={`flex items-center gap-3 p-3 rounded-xl font-bold text-sm transition-all ${
                pathname === '/home'
                  ? 'bg-[#7B1C3E] text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200'
              }`}
            >
              <Home className="w-5 h-5" />
              <span>{language === 'th' ? 'หน้าหลัก (Home)' : 'Home'}</span>
            </Link>

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
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                            isItemActive
                              ? 'bg-[#7B1C3E]/10 border-[#7B1C3E]/30 text-[#7B1C3E] font-bold'
                              : 'bg-white dark:bg-slate-800 hover:bg-slate-50 border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center border shrink-0 ${item.colorClass}`}>
                            <ItemIcon className="w-3.5 h-3.5" />
                          </div>
                          <span>{item.label}</span>
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
                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl text-sm font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
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
