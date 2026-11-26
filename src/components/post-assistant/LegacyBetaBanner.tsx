'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Sparkles, X, ArrowRight } from 'lucide-react';

export function LegacyBetaBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="bg-gradient-to-r from-[#1B3A6B] via-[#274c8a] to-[#7B1C3E] text-white px-4 py-2 flex items-center justify-between gap-3 text-xs sm:text-sm shadow-sm">
      <div className="flex items-center gap-2 min-w-0">
        <Sparkles className="w-4 h-4 shrink-0 text-amber-300" />
        <span className="truncate font-medium">
          ใหม่! <strong>Social Post Assistant v2 (Beta)</strong> — เขียนแคปชั่นระดับ Global, อัปโหลดตรงไม่ติดขนาดไฟล์, ซิงก์เว็บไซต์ 3 ภาษาสะอาดไร้บั๊ก
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/post-assistant/v2"
          className="inline-flex items-center gap-1.5 bg-white text-[#1B3A6B] hover:bg-amber-50 font-bold px-3 py-1 rounded-full text-xs transition-colors"
        >
          <span>ทดลองใช้ v2 (Beta)</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="ปิดแถบแนะนำ"
          className="p-1 rounded-full hover:bg-white/15 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
