'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';
import { isSystemAdmin } from '@/lib/constants/auth';
import { getRoleConfig } from '@/lib/constants/roles';

export function AppNav() {
  const pathname = usePathname();
  const { user, role, appUser, isLoading, signOut } = useAuth();

  if (isLoading || !user) return null;
  if (pathname === '/login' || pathname.startsWith('/website')) return null;

  const isAdmin = role === 'admin' || appUser?.role === 'admin' || isSystemAdmin(user?.email);
  const assignedFeatures = appUser?.assigned_features || [];

  const allNavItems = [
    { id: 'dashboard', href: '/dashboard', label: 'แดชบอร์ด' },
    { id: 'pos_shop', href: '/pos/shop', label: 'POS ร้านค้า' },
    { id: 'pos_fees', href: '/pos/fees', label: 'ค่าเทอม' },
    { id: 'pos_wallet_topup', href: '/pos/wallet/topup', label: 'เติม Wallet' },
    { id: 'admin_reports', href: '/admin/reports', label: 'รายงาน' },
    { id: 'admin_students', href: '/admin/students', label: 'งานระเบียน' },
    { id: 'admin_products', href: '/admin/products', label: 'จัดการสินค้า' },
    { id: 'admin_wallet_students', href: '/admin/wallet/students', label: 'Wallet นักเรียน' },
    { id: 'admin_attendance', href: '/attendance', label: 'ลงเวลา' },
    { id: 'admin_website', href: '/admin/website', label: 'จัดการเว็บไซต์' },
    { id: 'qr_generator', href: '/qr-generator', label: 'สร้าง QR Code' },
    { id: 'admin_users', href: '/admin/users', label: 'จัดการผู้ใช้' },
  ];

  let dynamicLinks: typeof allNavItems = [];
  if (isAdmin) {
    dynamicLinks = allNavItems;
  } else if (assignedFeatures.length > 0) {
    dynamicLinks = allNavItems.filter(item => assignedFeatures.includes(item.id));
  } else if (role === 'cashier') {
    dynamicLinks = allNavItems.filter(item => ['pos_shop', 'pos_fees', 'pos_wallet_topup'].includes(item.id));
  }

  const links = [
    { id: 'home', href: '/home', label: 'หน้าหลัก' },
    ...dynamicLinks
  ];

  const userRole = isAdmin ? 'admin' : (appUser?.role || role);
  const roleBadge = getRoleConfig(userRole);

  return (
    <nav className="bg-surface/80 backdrop-blur-md border-b border-foreground/5 shadow-sm sticky top-0 z-50 print:hidden transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center min-w-0 flex-1 overflow-hidden">
            <Link href="/home" className="flex-shrink-0 flex items-center gap-3 mr-4 group">
              <Image src="/logo2.png" alt="School Logo" width={320} height={180} className="h-10 w-auto drop-shadow-md group-hover:scale-105 transition-transform object-contain" />
              <Image src="/SV-Portal.png" alt="SVPortal" width={120} height={34} className="h-8 w-auto hidden sm:block drop-shadow-sm group-hover:opacity-90 transition-opacity" />
            </Link>
            <div className="flex sm:ml-4 space-x-1 sm:space-x-2 overflow-x-auto overflow-y-hidden pb-1 scrollbar-none">
              {links.map(link => {
                const isActive = link.href === '/home' 
                  ? pathname === '/home'
                  : pathname.startsWith(link.href) && (link.href !== '/dashboard' || pathname === '/dashboard');

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`inline-flex items-center px-3 py-2 min-h-[44px] whitespace-nowrap border-b-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'border-primary text-primary font-bold'
                        : 'border-transparent text-foreground/60 hover:border-foreground/30 hover:text-foreground'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex items-center ml-auto pl-4 flex-shrink-0">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <span className="text-xs sm:text-sm text-foreground/80 hidden md:inline-block max-w-[160px] truncate" title={user.email || ''}>
                {user.email} 
              </span>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border shadow-sm ${roleBadge.badgeClass}`}>
                {roleBadge.labelEn}
              </span>
              <button
                onClick={signOut}
                className="text-xs sm:text-sm font-semibold text-secondary hover:text-secondary/80 px-2.5 sm:px-3 py-2 min-h-[40px] rounded-lg hover:bg-secondary/10 transition-colors flex items-center justify-center"
              >
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
