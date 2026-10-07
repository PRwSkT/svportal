import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    // Add auth check
    const auth = await requireAuth('admin', 'admin_students');
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

    const supabase = getAdminClient();

    const includeDetails = searchParams.get('includeDetails') === 'true';

    const baseQuery = includeDetails
      ? supabase.from('students').select('*, student_addresses(*), student_parents(*)')
      : supabase.from('students').select('id, name, prefix, first_name, last_name, grade, status, wallet_balance, updated_at, created_at, gender, birth_date, citizen_id');

    let query: any = baseQuery.limit(10000);

    if (searchQuery) {
      const sanitized = searchQuery.replace(/[,()"]/g, '');
      query = query.or(`id.ilike.%${sanitized}%,name.ilike.%${sanitized}%`);
    }
    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'กำลังศึกษาอยู่') {
        query = query.in('status', ['กำลังศึกษาอยู่', 'นักเรียนเข้าใหม่']);
      } else {
        query = query.eq('status', statusFilter);
      }
    }
    if (gradeFilter && gradeFilter !== 'all') {
      const grades = gradeFilter.split(',').map(g => g.trim());
      query = query.in('grade', grades);
    }

    // Fetch all matching records to sort them properly in memory
    const { data: allStudents, error } = await query;
    
    if (error) throw error;
    
    let sortedData: any[] = [...(allStudents || [])];
    
    // Sort logic
    sortedData.sort((a: any, b: any) => {
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
