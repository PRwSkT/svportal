import DashboardView from './DashboardView';
import { getDailySummary } from '@/lib/supabase/reports.server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const localISOTime = formatter.format(new Date());

  const thaiDate = new Intl.DateTimeFormat('th-TH', { 
    timeZone: 'Asia/Bangkok',
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }).format(new Date());

  let initialData: any = { summary: null, sync_stats: null, website_stats: null };
  try {
    const summary = await getDailySummary(localISOTime);
    const supabase = await createClient();

    const [
      { count: pendingCount },
      { count: failedCount },
      { count: completedCount },
      { count: processingCount },
      { count: newsCount },
      { count: albumsCount },
      { count: personnelCount },
    ] = await Promise.all([
      supabase.from('sync_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('sync_queue').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
      supabase.from('sync_queue').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('sync_queue').select('*', { count: 'exact', head: true }).eq('status', 'processing'),
      supabase.from('news').select('*', { count: 'exact', head: true }),
      supabase.from('albums').select('*', { count: 'exact', head: true }),
      supabase.from('personnel').select('*', { count: 'exact', head: true }),
    ]);

    initialData = {
      summary,
      sync_stats: {
        pending: pendingCount || 0,
        failed: failedCount || 0,
        completed: completedCount || 0,
        processing: processingCount || 0,
      },
      website_stats: {
        news: newsCount || 0,
        albums: albumsCount || 0,
        personnel: personnelCount || 0,
      },
    };
  } catch (e) {
    console.error('Failed to fetch initial dashboard data', e);
  }

  return <DashboardView initialData={initialData} thaiDate={thaiDate} localISOTime={localISOTime} />;
}
