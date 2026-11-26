'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';

export default function PostAssistantError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('PostAssistant Error:', error);
  }, [error]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 text-center space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
        <AlertTriangle className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold text-slate-900">เกิดข้อผิดพลาดใน Social Post Assistant</h2>
      <p className="text-xs font-mono text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
        {error.message}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#7B1C3E] text-white text-sm font-bold hover:opacity-95"
        >
          <RefreshCcw className="w-4 h-4" />
          <span>ลองใหม่</span>
        </button>
        <Link
          href="/home"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1B3A6B] text-white text-sm font-bold hover:opacity-95"
        >
          <Home className="w-4 h-4" />
          <span>กลับหน้าหลัก</span>
        </Link>
      </div>
    </div>
  );
}
