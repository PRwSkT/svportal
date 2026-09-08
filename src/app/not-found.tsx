import Link from 'next/link';
import { Home, Globe } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full p-8 bg-surface/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/60 space-y-5">
        <h1 className="text-6xl font-black text-primary">404</h1>
        <h2 className="text-xl font-bold text-foreground">ไม่พบหน้าที่คุณต้องการ</h2>
        <p className="text-sm text-foreground/60">
          หน้าที่คุณกำลังค้นหาอาจถูกย้าย ลบ หรือไม่มีอยู่จริง
        </p>
        <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-white font-bold rounded-2xl shadow-md hover:bg-primary/90 transition-all text-sm"
          >
            <Home className="w-4 h-4" /> พอร์ทัลหลัก
          </Link>
          <Link
            href="/website"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-foreground/5 text-foreground/80 hover:text-primary font-bold rounded-2xl border border-foreground/10 hover:bg-foreground/10 transition-all text-sm"
          >
            <Globe className="w-4 h-4" /> เว็บไซต์โรงเรียน
          </Link>
        </div>
      </div>
    </div>
  );
}
