'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Global Error Boundary caught an error:', error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 text-center font-sans">
      <div className="bg-red-50 text-red-500 p-6 rounded-full mb-6">
        <AlertTriangle className="w-16 h-16" />
      </div>
      <h1 className="text-4xl font-extrabold text-foreground mb-4">เกิดข้อผิดพลาด</h1>
      <p className="text-foreground/60 mb-8 max-w-md text-lg">
        ขออภัย ระบบพบข้อผิดพลาดบางประการ: <br />
        <span className="font-mono text-sm text-red-500 mt-2 block">{error.message || 'Unknown error'}</span>
      </p>
      
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={() => reset()}
          className="px-6 py-3 bg-primary text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
        >
          <RefreshCcw className="w-5 h-5" /> ลองใหม่อีกครั้ง
        </button>
        <Link href="/">
          <button className="px-6 py-3 bg-surface border-2 border-foreground/10 text-foreground font-bold rounded-xl flex items-center justify-center gap-2 hover:border-foreground/30 transition-all w-full">
            <Home className="w-5 h-5" /> กลับหน้าหลัก
          </button>
        </Link>
      </div>
    </div>
  );
}
