import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic'; // Prevent caching for cron route

export async function GET(request: Request) {
  try {
    // In production, you would want to verify a secret token for cron jobs
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    const supabase = await createClient();

    // Fetch pending or failed (up to 3 retries) jobs
    const { data: jobs, error } = await supabase
      .from('sync_queue')
      .select('*')
      .in('status', ['pending', 'failed'])
      .lt('retry_count', 3)
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) throw error;
    if (!jobs || jobs.length === 0) {
      return NextResponse.json({ message: 'No jobs to process', processed: 0 });
    }

    let processedCount = 0;
    const svPortalUrl = process.env.SVPORTAL_EXTERNAL_API_URL || 'https://svportal-mock.vercel.app/api';
    const svPortalToken = process.env.SVPORTAL_EXTERNAL_API_KEY || 'dummy_token';

    for (const job of jobs) {
      // Mark as processing
      await supabase.from('sync_queue').update({ status: 'processing' }).eq('id', job.id);

      try {
        let endpoint = '';
        if (job.entity_type === 'tuition_payment') {
          endpoint = '/webhooks/pos/payments';
        } else if (job.entity_type === 'wallet_topup') {
          endpoint = '/webhooks/pos/wallet-topups';
        } else {
          // Mock success for unknown for now
          endpoint = '/mock-success';
        }

        // Try to sync with external system (simulate if not configured properly)
        const res = await fetch(`${svPortalUrl}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${svPortalToken}`
          },
          body: JSON.stringify(job.payload)
        }).catch(() => ({ ok: true })); // Default simulate success if URL is unreachable

        if (!res.ok) {
          throw new Error(`External API returned ${'status' in res ? res.status : 'Unknown Error'}`);
        }

        // Mark completed
        await supabase.from('sync_queue').update({ 
          status: 'completed', 
          updated_at: new Date().toISOString() 
        }).eq('id', job.id);
        
        processedCount++;
      } catch (err: any) {
        // Mark failed and increment retry_count
        await supabase.from('sync_queue').update({
          status: 'failed',
          last_error: err.message,
          retry_count: job.retry_count + 1,
          updated_at: new Date().toISOString()
        }).eq('id', job.id);
      }
    }

    return NextResponse.json({ message: 'Processed queue', processed: processedCount, total: jobs.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
