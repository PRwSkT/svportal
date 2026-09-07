'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="th">
      <body className="min-h-screen flex items-center justify-center bg-surface text-foreground p-6">
        <div className="max-w-md w-full text-center space-y-4 p-8 bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-foreground/10">
          <h2 className="text-xl font-extrabold text-primary">เกิดข้อผิดพลาดของระบบ</h2>
          <p className="text-sm text-foreground/60">ขออภัย ระบบพบข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง</p>
          <button
            onClick={() => reset()}
            className="px-6 py-2.5 bg-primary text-white font-bold rounded-xl shadow-md hover:bg-primary/90 transition-all text-sm"
          >
            โหลดใหม่ (Reload)
          </button>
        </div>
      </body>
    </html>
  );
}
