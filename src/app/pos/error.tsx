'use client';

import { useEffect } from 'react';
import { AlertOctagon, RefreshCcw } from 'lucide-react';

export default function PosError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('POS Error Boundary caught an error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center p-12 bg-white rounded-[3rem] shadow-xl min-h-[500px] text-center font-sans mx-auto max-w-3xl border-4 border-red-50 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-red-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
      
      <div className="relative z-10">
        <div className="w-24 h-24 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertOctagon className="w-12 h-12" />
        </div>
        <h2 className="text-3xl font-black text-foreground mb-4">ระบบ POS ขัดข้อง</h2>
        <p className="text-foreground/60 text-lg mb-8 max-w-lg mx-auto">
          ไม่สามารถดำเนินการได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง
          <br />
          <span className="text-sm font-bold text-red-500/80 mt-4 block">{error.message}</span>
        </p>
        
        <button
          onClick={() => reset()}
          className="px-8 py-4 bg-red-600 text-white font-black text-lg rounded-2xl flex items-center justify-center gap-3 hover:bg-red-700 transition-all shadow-lg shadow-red-600/20 active:scale-95 mx-auto"
        >
          <RefreshCcw className="w-6 h-6" /> โหลดระบบ POS ใหม่
        </button>
      </div>
    </div>
  );
}
