'use client';

import Image from 'next/image';
import Link from 'next/link';
import { toast } from 'sonner';

export default function WelcomePage() {
  const handleNotReady = (e: React.MouseEvent) => {
    e.preventDefault();
    toast.info('ฟังก์ชันนี้ยังไม่พร้อมใช้งาน (กำลังพัฒนา)', {
      description: 'This function is coming soon • 此功能正在开发中',
    });
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 relative z-10">
      <div className="max-w-md w-full bg-surface/85 backdrop-blur-xl p-6 sm:p-8 rounded-3xl shadow-xl border border-white/60 relative overflow-hidden">
        {/* Decorative background gradients */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-secondary/10 rounded-full blur-3xl"></div>
        </div>

        <div className="flex flex-col items-center relative z-10 mb-6">
          <Image 
            src="/SV-Portal.png" 
            alt="SVPortal Logo" 
            width={130} 
            height={36} 
            className="mb-3 drop-shadow-sm h-8 sm:h-9 w-auto hover:scale-105 transition-transform duration-300" 
            priority
          />
          <h1 className="text-center text-2xl sm:text-3xl font-extrabold text-primary mb-1.5">
            ยินดีต้อนรับสู่ SV Portal
          </h1>
          <p className="text-center text-xs sm:text-sm text-foreground/60 font-medium mb-3">
            Welcome to SV Portal • 欢迎来到 SV Portal
          </p>
          <p className="text-center text-xs text-foreground/50">
            กรุณาเลือกสถานะของคุณเพื่อเข้าสู่ระบบ
          </p>
        </div>

        <div className="space-y-3 relative z-10 flex flex-col items-center w-full">
          {/* Parents Button */}
          <button
            type="button"
            onClick={handleNotReady}
            className="w-full flex flex-col items-center justify-center p-3 sm:p-3.5 rounded-2xl border border-foreground/10 bg-white/60 hover:bg-white/90 backdrop-blur-sm transition-all duration-300 group shadow-xs hover:shadow-md hover:-translate-y-0.5"
          >
            <span className="text-lg sm:text-xl font-bold text-foreground group-hover:text-primary">ผู้ปกครอง</span>
            <span className="text-xs font-medium text-foreground/50 group-hover:text-primary/70 mt-0.5">Parents • 家长</span>
          </button>

          {/* Students Button */}
          <button
            type="button"
            onClick={handleNotReady}
            className="w-full flex flex-col items-center justify-center p-3 sm:p-3.5 rounded-2xl border border-foreground/10 bg-white/60 hover:bg-white/90 backdrop-blur-sm transition-all duration-300 group shadow-xs hover:shadow-md hover:-translate-y-0.5"
          >
            <span className="text-lg sm:text-xl font-bold text-foreground group-hover:text-primary">นักเรียน</span>
            <span className="text-xs font-medium text-foreground/50 group-hover:text-primary/70 mt-0.5">Students • 学生</span>
          </button>

          {/* Teachers & Staff Button */}
          <Link
            href="/login"
            className="w-full flex flex-col items-center justify-center p-3 sm:p-3.5 rounded-2xl border border-transparent bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary transition-all duration-300 group shadow-md shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5"
          >
            <span className="text-lg sm:text-xl font-bold text-white">ครูและบุคลากร</span>
            <span className="text-xs font-medium text-white/90 mt-0.5">Teachers & Staff • 教师和员工</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
