import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDailySummary } from '@/lib/supabase/reports.server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // 1. Get Summary
    const summary = await getDailySummary(dateStr);

    // 2. Get Audit Logs
    const supabase = await createClient();
    const { data: logs, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching audit logs:', error);
    }

    return NextResponse.json({
      summary,
      auditLogs: logs || []
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
