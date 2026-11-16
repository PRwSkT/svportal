'use client';

import React from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

export function GlobalWatermark() {
  const pathname = usePathname() || '/';
  if (pathname.startsWith('/verify')) {
    return null;
  }

  return (
    <div className="fixed bottom-4 md:bottom-8 right-4 md:right-8 opacity-25 pointer-events-none flex flex-col md:flex-row items-end md:items-center gap-4 md:gap-6 z-0 transition-all duration-500 print:opacity-[0.10] print:z-[-1]">
      <Image src="/logo2.png" alt="School Logo" width={640} height={360} className="h-20 md:h-32 w-auto drop-shadow-lg print:drop-shadow-none" />
      <Image src="/SV-Portal.png" alt="SVPortal" width={240} height={60} className="w-40 md:w-56 h-auto drop-shadow-lg print:drop-shadow-none" />
    </div>
  );
}

export function GlobalMainContainer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const isStandalone = pathname.startsWith('/verify');

  return (
    <main className={isStandalone ? 'flex-1 relative' : 'flex-1 relative pb-24 md:pb-10'}>
      {children}
    </main>
  );
}
