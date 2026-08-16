'use client';

import Image from 'next/image';
import Link from 'next/link';

export default function WelcomePage() {
  const handleNotReady = (e: React.MouseEvent) => {
    e.preventDefault();
    alert('ฟังก์ชันนี้ยังไม่พร้อมใช้งาน\nThis function is not ready yet.\n此功能尚未准备好');
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative z-10 bg-gray-50">
      <div className="max-w-xl w-full space-y-8 bg-white/90 backdrop-blur-xl p-10 rounded-[24px] shadow-2xl border border-gray-100 relative overflow-hidden">
        {/* Decorative background gradients */}
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-blue-100 rounded-full blur-3xl pointer-events-none opacity-50"></div>
        <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-purple-100 rounded-full blur-3xl pointer-events-none opacity-50"></div>

        <div className="flex flex-col items-center relative z-10">
          <Image 
            src="/logo.png" 
            alt="School Logo" 
            width={96} 
            height={96} 
            className="mb-6 drop-shadow-md hover:scale-105 transition-transform duration-300" 
          />
          <h1 className="text-center text-3xl font-extrabold text-blue-900 mb-2">
            ยินดีต้อนรับสู่สมคิดวิทยา
          </h1>
          <p className="text-center text-gray-500 font-medium mb-8">
            Welcome to Somkidvittaya • 欢迎来到 Somkidvittaya
          </p>
          <p className="text-center text-sm text-gray-400 mb-6">
            กรุณาเลือกสถานะของคุณเพื่อเข้าสู่ระบบ
          </p>
        </div>

        <div className="space-y-4 relative z-10 flex flex-col items-center w-full">
          {/* Parents Button */}
          <button
            onClick={handleNotReady}
            className="w-full flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-gray-100 bg-white hover:border-blue-300 hover:bg-blue-50 transition-all duration-300 group shadow-sm hover:shadow-md"
          >
            <span className="text-xl font-bold text-gray-800 group-hover:text-blue-700">ผู้ปกครอง</span>
            <span className="text-sm font-medium text-gray-500 group-hover:text-blue-500 mt-1">Parents • 家长</span>
          </button>

          {/* Students Button */}
          <button
            onClick={handleNotReady}
            className="w-full flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-gray-100 bg-white hover:border-purple-300 hover:bg-purple-50 transition-all duration-300 group shadow-sm hover:shadow-md"
          >
            <span className="text-xl font-bold text-gray-800 group-hover:text-purple-700">นักเรียน</span>
            <span className="text-sm font-medium text-gray-500 group-hover:text-purple-500 mt-1">Students • 学生</span>
          </button>

          {/* Teachers & Staff Button */}
          <Link
            href="/login"
            className="w-full flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-transparent bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 group shadow-lg shadow-blue-200 hover:shadow-blue-300 hover:-translate-y-0.5"
          >
            <span className="text-xl font-bold text-white">ครูและบุคลากร</span>
            <span className="text-sm font-medium text-blue-100 mt-1">Teachers & Staff • 教师和员工</span>
          </Link>
        </div>
        
        <div className="mt-8 text-center relative z-10">
          <Image 
            src="/SV-Portal.png" 
            alt="SVPortal Logo" 
            width={100} 
            height={28} 
            className="h-7 w-auto mx-auto opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-300" 
          />
        </div>
      </div>
    </div>
  );
}
