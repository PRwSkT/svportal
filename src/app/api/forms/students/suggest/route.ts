import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Public API to suggest active students for form respondents (Auto-complete)
 * Requires at least 3 characters.
 * Returns only non-sensitive student identification data (Name, Grade, Student ID) in compliance with PDPA.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q')?.trim() || '';

    // Require at least 3 characters to prevent broad enumeration
    if (query.length < 3) {
      return NextResponse.json({ success: true, data: [] });
    }

    const supabase = getAdminClient();

    // Clean query to avoid SQL wildcard injection
    const cleanQuery = query.replace(/[%_]/g, '');
    if (!cleanQuery) {
      return NextResponse.json({ success: true, data: [] });
    }

    const { data, error } = await supabase
      .from('students')
      .select('id, name, prefix, first_name, last_name, grade, status')
      .or(`name.ilike.%${cleanQuery}%,first_name.ilike.%${cleanQuery}%,last_name.ilike.%${cleanQuery}%,id.ilike.%${cleanQuery}%`)
      .not('status', 'in', '("จบการศึกษา","ลาออก","พ้นสภาพ")')
      .limit(8);

    if (error) {
      console.error('Student suggestion query error:', error);
      return NextResponse.json({ success: false, error: 'ไม่สามารถค้นหาข้อมูลนักเรียนได้' }, { status: 500 });
    }

    const safeResults = (data || []).map((s) => ({
      id: s.id,
      name: (s.name || `${s.prefix || ''}${s.first_name || ''} ${s.last_name || ''}`).replace(/\s+/g, ' ').trim(),
      first_name: s.first_name || '',
      last_name: s.last_name || '',
      grade: s.grade || '',
    }));

    return NextResponse.json({ success: true, data: safeResults });
  } catch (err: any) {
    console.error('Student suggestion error:', err);
    return NextResponse.json({ success: false, error: 'เกิดข้อผิดพลาดในการประมวลผล' }, { status: 500 });
  }
}
