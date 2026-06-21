import DashboardView from './DashboardView';
import { headers } from 'next/headers';

export default async function DashboardPage() {
  // Get today's summary in YYYY-MM-DD
  const today = new Date();
  const offset = today.getTimezoneOffset() * 60000;
  const localISOTime = (new Date(today.getTime() - offset)).toISOString().split('T')[0];
  
  // Format date to Thai format
  const thaiDate = new Intl.DateTimeFormat('th-TH', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }).format(today);

  // We fetch initial data on server to keep SSR
  let initialData = { summary: null, sync_stats: null };
  try {
    const headersList = await headers();
    const host = headersList.get('host') || 'localhost:3000';
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const res = await fetch(`${protocol}://${host}/api/admin/dashboard?date=${localISOTime}`, { cache: 'no-store' });
    if (res.ok) {
      initialData = await res.json();
    }
  } catch (e) {
    console.error('Failed to fetch initial dashboard data', e);
  }

  return <DashboardView initialData={initialData} thaiDate={thaiDate} localISOTime={localISOTime} />;
}
