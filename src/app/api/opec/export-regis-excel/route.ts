import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth';
import { auditBatchForOpec } from '@/lib/opec/regis-validator';
import { generateOpecRegisBuffer } from '@/lib/opec/regis-excel';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth('admin', 'admin_students');
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'download';
    const gradeFilter = searchParams.get('grade') || 'all';
    const statusFilter = searchParams.get('status') || 'กำลังศึกษาอยู่';
    const searchQuery = searchParams.get('q') || '';

    const supabase = getAdminClient();

    // Query students with complete address and parent relationships
    let query = supabase
      .from('students')
      .select('*, student_addresses(*), student_parents(*)')
      .limit(10000);

    if (searchQuery) {
      const sanitized = searchQuery.replace(/[,()"]/g, '').trim();
      if (sanitized) {
        query = query.or(`id.ilike.%${sanitized}%,name.ilike.%${sanitized}%`);
      }
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

    const { data: students, error } = await query;
    if (error) {
      console.error('OPEC export database fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch student data: ' + error.message }, { status: 500 });
    }

    const studentList = students || [];

    // Sort students by Grade level then Student ID
    studentList.sort((a: any, b: any) => {
      const gradeA = a.grade || '';
      const gradeB = b.grade || '';
      const isAnubanA = gradeA.startsWith('อ.');
      const isAnubanB = gradeB.startsWith('อ.');
      if (isAnubanA && !isAnubanB) return -1;
      if (!isAnubanA && isAnubanB) return 1;
      if (gradeA !== gradeB) {
        return gradeA.localeCompare(gradeB);
      }
      const numA = parseInt(a.id, 10);
      const numB = parseInt(b.id, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return (a.id || '').localeCompare(b.id || '');
    });

    // 1. Audit Mode: Return detailed pre-flight audit report as JSON
    if (mode === 'audit') {
      const auditSummary = auditBatchForOpec(studentList);
      return NextResponse.json({
        success: true,
        summary: auditSummary
      });
    }

    // 2. Download Mode: Generate official OPEC REGIS Excel workbook
    const buffer = await generateOpecRegisBuffer(studentList, {
      schoolId: '1121100013',
      schoolName: 'โรงเรียนสมคิดวิทยา',
      gradeFilter: gradeFilter,
      includeInstructionsSheet: true,
    });

    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const gradeLabel = gradeFilter === 'all' ? 'All_Grades' : gradeFilter.replace(/[/\\?%*:|"<>]/g, '_');
    const filename = `OPEC_REGIS_Somkid_${gradeLabel}_${timestamp}.xlsx`;

    return new Response(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Content-Length': buffer.length.toString(),
      },
    });

  } catch (err: any) {
    console.error('OPEC REGIS export route error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // Support POST for downloading with custom filters or payload
  return GET(request);
}
