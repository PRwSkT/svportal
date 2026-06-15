'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

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
    { href: '/admin/products', label: 'จัดการสินค้า' },
    { href: '/admin/wallet/students', label: 'Wallet นักเรียน' },
  ];

  const links = role === 'admin' ? [...cashierLinks, ...adminLinks] : cashierLinks;

  return (
    <nav className="bg-white border-b shadow-sm print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <span className="text-xl font-bold text-blue-600">SVPortal POS</span>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {links.map(link => {
                const isActive = pathname.startsWith(link.href) && 
                                 (link.href !== '/dashboard' || pathname === '/dashboard');
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      isActive
                        ? 'border-blue-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                {user.email} 
                <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
                }`}>
                  {role === 'admin' ? 'Admin' : 'Cashier'}
                </span>
              </span>
              <button
                onClick={signOut}
                className="text-sm font-medium text-red-600 hover:text-red-500"
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
