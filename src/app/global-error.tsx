'use client';

import { useEffect } from 'react';
import './globals.css';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Fatal Global Error:', error);
  }, [error]);

  return (
    <html lang="th">
      <body className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
        <div className="max-w-md w-full text-center space-y-4 p-8 bg-surface/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-foreground/10">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-2 text-xl font-bold">
            !
          </div>
          <h2 className="text-xl font-extrabold text-primary">เกิดข้อผิดพลาดของระบบ</h2>
          <p className="text-sm text-foreground/60">ขออภัย ระบบพบข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง</p>
          {error?.digest && (
            <p className="text-xs font-mono text-foreground/40">รหัสอ้างอิง: {error.digest}</p>
          )}
          <div className="pt-2">
            <button
              onClick={() => reset()}
              className="px-6 py-2.5 bg-primary text-white font-bold rounded-xl shadow-md hover:bg-primary/90 transition-all text-sm"
            >
              โหลดใหม่ (Reload)
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
