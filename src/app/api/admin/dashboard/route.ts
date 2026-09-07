import { NextResponse } from 'next/server';
import { getDailySummary } from '@/lib/supabase/reports.server';
import { createClient } from '@/lib/supabase/server';
import { isSystemAdmin } from '@/lib/constants/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isSystemAdmin(user.email)) {
      const { data: role, error: roleError } = await supabase.rpc('get_user_role');
      if (roleError || role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date');
    
    // Default to today in Asia/Bangkok
    let localISOTime = dateStr;
    if (!localISOTime) {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      localISOTime = formatter.format(new Date());
    }

    const summary = await getDailySummary(localISOTime);

    // Get Sync Queue Stats using exact count queries
    const [
      { count: pendingCount },
      { count: failedCount },
      { count: completedCount },
      { count: processingCount },
    ] = await Promise.all([
      supabase.from('sync_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('sync_queue').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
      supabase.from('sync_queue').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('sync_queue').select('*', { count: 'exact', head: true }).eq('status', 'processing'),
    ]);

    const sync_stats = {
      pending: pendingCount || 0,
      failed: failedCount || 0,
      completed: completedCount || 0,
      processing: processingCount || 0,
    };

    // Get Website Stats
    const [{ count: newsCount }, { count: albumsCount }, { count: personnelCount }] = await Promise.all([
      supabase.from('news').select('*', { count: 'exact', head: true }),
      supabase.from('albums').select('*', { count: 'exact', head: true }),
      supabase.from('personnel').select('*', { count: 'exact', head: true }),
    ]);

    const website_stats = {
      news: newsCount || 0,
      albums: albumsCount || 0,
      personnel: personnelCount || 0
    };

    return NextResponse.json({ summary, sync_stats, website_stats });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
