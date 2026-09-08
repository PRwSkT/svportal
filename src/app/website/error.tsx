'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, RefreshCcw, Home } from 'lucide-react';

export default function WebsiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Website Error Boundary caught an error:', error);
  }, [error]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <div className="p-8 bg-surface rounded-3xl border border-foreground/5 shadow-lg space-y-4">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-2">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-foreground">ขออภัย เกิดข้อผิดพลาด</h2>
        <p className="text-sm text-foreground/60 max-w-md mx-auto">
          ไม่สามารถโหลดข้อมูลในหน้านี้ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง หรือกลับสู่หน้าแรกของเว็บไซต์
        </p>

        <div className="pt-4 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => reset()}
            className="px-5 py-2.5 bg-primary text-white font-bold rounded-xl shadow-md hover:bg-primary/90 transition-all flex items-center gap-2 text-sm"
          >
            <RefreshCcw className="w-4 h-4" /> โหลดข้อมูลใหม่
          </button>
          <Link
            href="/website"
            className="px-5 py-2.5 bg-foreground/5 text-foreground/80 hover:text-primary font-bold rounded-xl border border-foreground/10 hover:bg-foreground/10 transition-all flex items-center gap-2 text-sm"
          >
            <Home className="w-4 h-4" /> กลับสู่หน้าแรกเว็บไซต์
          </Link>
        </div>
      </div>
    </div>
  );
}
