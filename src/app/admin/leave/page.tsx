import { Suspense } from 'react';
import LeaveDashboardClient from './LeaveDashboardClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function AdminLeaveDashboardPage() {
  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-background to-surface py-8 md:py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Suspense
          fallback={
            <div className="py-20 text-center text-sm text-foreground/50">
              กำลังโหลดแดชบอร์ดการลาและโครงสร้างแจ้งเตือน...
            </div>
          }
        >
          <LeaveDashboardClient />
        </Suspense>
      </div>
    </div>
  );
}
