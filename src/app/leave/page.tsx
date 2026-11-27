import LeavePortalClient from './LeavePortalClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function StaffLeavePage() {
  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-background to-surface py-8 md:py-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <LeavePortalClient />
      </div>
    </div>
  );
}
