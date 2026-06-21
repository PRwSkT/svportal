import { NextResponse } from 'next/server';
import { getDailySummary } from '@/lib/supabase/reports.server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date');
    
    // Default to today if no date provided
    let localISOTime = dateStr;
    if (!localISOTime) {
      const today = new Date();
      const offset = today.getTimezoneOffset() * 60000;
      localISOTime = (new Date(today.getTime() - offset)).toISOString().split('T')[0];
    }

    const summary = await getDailySummary(localISOTime);

    // Get Sync Queue Stats
    const supabase = await createClient();
    const { data: syncData, error } = await supabase
      .from('sync_queue')
      .select('status, id');
      
    let sync_stats = {
      pending: 0,
      failed: 0,
      completed: 0,
      processing: 0
    };

    if (!error && syncData) {
      syncData.forEach(job => {
        if (job.status === 'pending') sync_stats.pending++;
        else if (job.status === 'failed') sync_stats.failed++;
        else if (job.status === 'completed') sync_stats.completed++;
        else if (job.status === 'processing') sync_stats.processing++;
      });
    }

    return NextResponse.json({ summary, sync_stats });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
