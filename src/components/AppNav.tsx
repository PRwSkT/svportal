'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';

import { isSystemAdmin } from '@/lib/constants/auth';

export function AppNav() {
  const pathname = usePathname();
  const { user, role, isLoading, signOut } = useAuth();

  if (isLoading || !user) return null;
  if (pathname === '/login' || pathname.startsWith('/website')) return null;

  const cashierLinks = [
    { href: '/pos/shop', label: 'POS ร้านค้า' },
    { href: '/pos/fees', label: 'ค่าเทอม' },
    { href: '/pos/wallet/topup', label: 'เติม Wallet' },
  ];

  const adminLinks = [
    { href: '/dashboard', label: 'แดชบอร์ด' },
    { href: '/admin/reports', label: 'รายงาน' },
    { href: '/admin/users', label: 'จัดการผู้ใช้' },
    { href: '/admin/students', label: 'งานระเบียน' },
    { href: '/admin/products', label: 'จัดการสินค้า' },
    { href: '/admin/wallet/students', label: 'Wallet นักเรียน' },
    { href: '/admin/website', label: 'จัดการเว็บไซต์' },
  ];

  const isAdmin = role === 'admin' || isSystemAdmin(user?.email);
  const links = isAdmin ? [...cashierLinks, ...adminLinks] : cashierLinks;

  const getRoleBadge = () => {
    if (isAdmin) return { label: 'Admin', color: 'bg-primary/10 text-primary border-primary/20' };
    if (role === 'cashier') return { label: 'Cashier', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    if (role === 'teacher') return { label: 'Teacher', color: 'bg-blue-100 text-blue-800 border-blue-300' };
    if (role === 'executive') return { label: 'Executive', color: 'bg-purple-100 text-purple-800 border-purple-300' };
    return { label: role || 'Staff', color: 'bg-foreground/10 text-foreground/80 border-foreground/20' };
  };

  const roleBadge = getRoleBadge();

  return (
    <nav className="bg-surface/80 backdrop-blur-md border-b border-foreground/5 shadow-sm sticky top-0 z-50 print:hidden transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center min-w-0 flex-1 overflow-hidden">
            <Link href="/home" className="flex-shrink-0 flex items-center gap-3 mr-4 group">
              <Image src="/logo2.png" alt="School Logo" width={320} height={180} className="h-10 w-auto drop-shadow-md group-hover:scale-105 transition-transform object-contain" />
              <Image src="/SV-Portal.png" alt="SVPortal" width={120} height={34} className="h-8 w-auto hidden sm:block drop-shadow-sm group-hover:opacity-90 transition-opacity" />
            </Link>
            <div className="flex sm:ml-6 space-x-2 sm:space-x-4 overflow-x-auto overflow-y-hidden pb-1 scrollbar-none">
              {links.map(link => {
                const isActive = pathname.startsWith(link.href) && 
                                 (link.href !== '/dashboard' || pathname === '/dashboard');
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
            <div className="flex items-center space-x-2 sm:space-x-4">
              <span className="text-sm text-foreground/80 hidden sm:inline-block">
                {user.email} 
              </span>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${roleBadge.color}`}>
                {roleBadge.label}
              </span>
              <button
                onClick={signOut}
                className="text-sm font-semibold text-secondary hover:text-secondary/80 px-3 py-2 min-h-[44px] rounded-lg hover:bg-secondary/10 transition-colors flex items-center justify-center"
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
