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
      .select('*, student_addresses(*), student_parents(*)');

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

    // Fetch all matching records to sort them properly in memory
    const { data: allStudents, error } = await query;
    
    if (error) throw error;
    
    let sortedData = [...(allStudents || [])];
    
    // Sort logic
    sortedData.sort((a, b) => {
      if (gradeFilter === 'all') {
        // Sort by Grade Level (อ comes before ป)
        const gradeA = a.grade || '';
        const gradeB = b.grade || '';
        const isAnubanA = gradeA.startsWith('อ.');
        const isAnubanB = gradeB.startsWith('อ.');
        
        if (isAnubanA && !isAnubanB) return -1;
        if (!isAnubanA && isAnubanB) return 1;
        
        if (gradeA !== gradeB) {
          return gradeA.localeCompare(gradeB);
        }
      }
      
      // Sort by Numeric ID
      const numA = parseInt(a.id, 10);
      const numB = parseInt(b.id, 10);
      
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      // Fallback to string sort if IDs are not purely numeric
      return (a.id || '').localeCompare(b.id || '');
    });

    const count = sortedData.length;
    const paginatedData = sortedData.slice(from, to + 1);

    return NextResponse.json({
      data: paginatedData,
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
