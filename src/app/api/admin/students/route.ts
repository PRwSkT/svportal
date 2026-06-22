import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    // Add auth check
    const auth = await requireAuth();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get('q') || '';
    const statusFilter = searchParams.get('status') || 'all';
    const gradeFilter = searchParams.get('grade') || 'all';

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const supabase = await createClient();

    let query = supabase
      .from('students')
      .select('*, student_addresses(*), student_parents(*)', { count: 'exact' });

    // Custom sorting: If viewing all grades, sort by grade first, then id. 
    // Otherwise, just sort by id.
    if (gradeFilter === 'all') {
      query = query.order('grade', { ascending: true, nullsFirst: false }).order('id', { ascending: true });
    } else {
      query = query.order('id', { ascending: true });
    }

    if (searchQuery) {
      const sanitized = searchQuery.replace(/[,()"]/g, '');
      query = query.or(`id.ilike.%${sanitized}%,name.ilike.%${sanitized}%`);
    }
    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }
    if (gradeFilter && gradeFilter !== 'all') {
      query = query.eq('grade', gradeFilter);
    }

    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({
      data,
      count,
      page,
      limit,
      totalPages: count ? Math.ceil(count / limit) : 0
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
