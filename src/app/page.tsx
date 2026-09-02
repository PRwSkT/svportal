'use client';

import Image from 'next/image';
import Link from 'next/link';

export default function WelcomePage() {
  const handleNotReady = (e: React.MouseEvent) => {
    e.preventDefault();
    alert('ฟังก์ชันนี้ยังไม่พร้อมใช้งาน\nThis function is not ready yet.\n此功能尚未准备好');
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative z-10">
      <div className="max-w-xl w-full space-y-8 bg-surface/80 backdrop-blur-xl p-10 rounded-[24px] shadow-2xl border border-white/60 relative">
        {/* Decorative background gradients (wrapped to fix Safari overflow border-radius bug) */}
        <div className="absolute inset-0 pointer-events-none" style={{ clipPath: 'inset(0px round 24px)' }}>
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-secondary/10 rounded-full blur-3xl"></div>
        </div>

        <div className="flex flex-col items-center relative z-10">
          <Image 
            src="/SV-Portal.png" 
            alt="SVPortal Logo" 
            width={140} 
            height={40} 
            className="mb-4 drop-shadow-sm h-10 w-auto hover:scale-105 transition-transform duration-300" 
          />
          <h1 className="text-center text-3xl font-extrabold text-primary mb-2">
            ยินดีต้อนรับสู่ SV Portal
          </h1>
          <p className="text-center text-foreground/60 font-medium mb-8">
            Welcome to SV Portal • 欢迎来到 SV Portal
          </p>
          <p className="text-center text-sm text-foreground/50 mb-6">
            กรุณาเลือกสถานะของคุณเพื่อเข้าสู่ระบบ
          </p>
        </div>

        <div className="space-y-4 relative z-10 flex flex-col items-center w-full">
          {/* Parents Button */}
          <button
            onClick={handleNotReady}
            className="w-full flex flex-col items-center justify-center p-4 rounded-[16px] border border-foreground/10 bg-white/60 hover:bg-white/90 backdrop-blur-sm transition-all duration-300 group shadow-sm hover:shadow-md hover:-translate-y-0.5"
          >
            <span className="text-xl font-bold text-foreground group-hover:text-primary">ผู้ปกครอง</span>
            <span className="text-sm font-medium text-foreground/50 group-hover:text-primary/70 mt-1">Parents • 家长</span>
          </button>

          {/* Students Button */}
          <button
            onClick={handleNotReady}
            className="w-full flex flex-col items-center justify-center p-4 rounded-[16px] border border-foreground/10 bg-white/60 hover:bg-white/90 backdrop-blur-sm transition-all duration-300 group shadow-sm hover:shadow-md hover:-translate-y-0.5"
          >
            <span className="text-xl font-bold text-foreground group-hover:text-primary">นักเรียน</span>
            <span className="text-sm font-medium text-foreground/50 group-hover:text-primary/70 mt-1">Students • 学生</span>
          </button>

          {/* Teachers & Staff Button */}
          <Link
            href="/login"
            className="w-full flex flex-col items-center justify-center p-4 rounded-[16px] border border-transparent bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary transition-all duration-300 group shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5"
          >
            <span className="text-xl font-bold text-white">ครูและบุคลากร</span>
            <span className="text-sm font-medium text-white/90 mt-1">Teachers & Staff • 教师和员工</span>
          </Link>
        </div>
        
        <div className="mt-8 text-center relative z-10 flex justify-center">
          <Image 
            src="/logo2.png" 
            alt="School Logo" 
            width={320} 
            height={180} 
            className="h-16 w-auto opacity-60 hover:opacity-100 transition-all duration-300 drop-shadow-sm" 
          />
        </div>
      </div>
    </div>
  );
}
