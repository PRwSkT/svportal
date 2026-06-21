'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';

export function AppNav() {
  const pathname = usePathname();
  const { user, role, isLoading, signOut } = useAuth();

  if (isLoading || !user) return null;
  if (pathname === '/login') return null;

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
  ];

  const links = role === 'admin' ? [...cashierLinks, ...adminLinks] : cashierLinks;

  return (
    <nav className="bg-surface/80 backdrop-blur-md border-b border-foreground/5 shadow-sm sticky top-0 z-50 print:hidden transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex-shrink-0 flex items-center gap-3 mr-4 group">
              <Image src="/logo.png" alt="School Logo" width={40} height={40} className="h-10 w-auto drop-shadow-md group-hover:scale-105 transition-transform" />
              <Image src="/SV-Portal.png" alt="SVPortal" width={120} height={34} className="h-8 w-auto hidden sm:block drop-shadow-sm group-hover:opacity-90 transition-opacity" />
            </Link>
            <div className="flex sm:ml-6 space-x-4 sm:space-x-8 overflow-x-auto overflow-y-hidden pb-1">
              {links.map(link => {
                const isActive = pathname.startsWith(link.href) && 
                                 (link.href !== '/dashboard' || pathname === '/dashboard');
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      isActive
                        ? 'border-primary text-primary'
                        : 'border-transparent text-foreground/60 hover:border-foreground/30 hover:text-foreground'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex items-center ml-auto pl-4">
            <div className="flex items-center space-x-4">
              <span className="text-sm text-foreground/80">
                {user.email} 
                <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-primary/10 text-primary'
                }`}>
                  {role === 'admin' ? 'Admin' : 'Cashier'}
                </span>
              </span>
              <button
                onClick={signOut}
                className="text-sm font-medium text-secondary hover:text-secondary/80"
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
