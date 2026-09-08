'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, RefreshCcw, LayoutDashboard } from 'lucide-react';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Admin Error Boundary caught an error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-surface rounded-3xl border border-red-100 shadow-sm min-h-[400px] text-center font-sans mt-8 mx-auto max-w-3xl">
      <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
      <h2 className="text-2xl font-extrabold text-foreground mb-2">ข้อผิดพลาดในระบบแอดมิน</h2>
      <p className="text-foreground/60 mb-6 max-w-lg">
        ไม่สามารถโหลดข้อมูลหน้านี้ได้ หรือเกิดข้อผิดพลาดในการประมวลผล
        <br />
        <span className="text-xs font-mono text-red-500/80 mt-2 block bg-red-50 p-2 rounded-lg">{error.message}</span>
      </p>
      
      <div className="flex flex-wrap gap-3 justify-center">
        <button
          onClick={() => reset()}
          className="px-6 py-3 bg-red-50 text-red-600 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-red-100 transition-colors border border-red-100"
        >
          <RefreshCcw className="w-5 h-5" /> ลองใหม่อีกครั้ง
        </button>
        <Link
          href="/dashboard"
          className="px-6 py-3 bg-primary text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-md shadow-primary/20"
        >
          <LayoutDashboard className="w-5 h-5" /> กลับสู่แดชบอร์ด
        </Link>
      </div>
    </div>
  );
}
