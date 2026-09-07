import Link from 'next/link';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full p-8 bg-surface/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/60 space-y-4">
        <h1 className="text-6xl font-black text-primary">404</h1>
        <h2 className="text-xl font-bold text-foreground">ไม่พบหน้าที่คุณต้องการ</h2>
        <p className="text-sm text-foreground/60">
          หน้าที่คุณกำลังค้นหาอาจถูกย้าย ลบ หรือไม่มีอยู่จริง
        </p>
        <div className="pt-2">
          <Link
            href="/home"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-bold rounded-2xl shadow-md hover:bg-primary/90 transition-all text-sm"
          >
            <Home className="w-4 h-4" /> กลับสู่หน้าหลัก
          </Link>
        </div>
      </div>
    </div>
  );
}
