import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = await createClient();

    // Fetch only grades to group in memory
    const { data, error } = await supabase
      .from('students')
      .select('grade');

    if (error) throw error;

    const counts: Record<string, number> = {};
    let total = 0;
    
    if (data) {
      data.forEach((student) => {
        const g = student.grade || 'ไม่ระบุ';
        counts[g] = (counts[g] || 0) + 1;
        total++;
      });
    }

    return NextResponse.json({
      counts,
      total
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
