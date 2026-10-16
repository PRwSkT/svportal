import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth';
import { generateLunchSubsidyWorkbook, generateOn1Workbook } from '@/lib/opec/psis-engine';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth('admin', 'student_nutrition');
    if (auth.error) {
      const fallbackAuth = await requireAuth('admin', 'admin_students');
      if (fallbackAuth.error) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
      }
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'lunch';
    const grade = searchParams.get('grade') || 'all';
    const academicYear = searchParams.get('year') || '2568';

    const supabase = getAdminClient();

    let query = supabase
      .from('students')
      .select('*, student_addresses(*), student_parents(*)')
      .in('status', ['กำลังศึกษาอยู่', 'นักเรียนเข้าใหม่', 'นักเรียนเก่าเข้าใหม่'])
      .limit(10000);

    if (grade && grade !== 'all') {
      const grades = grade.split(',').map(g => g.trim()).filter(Boolean);
      const orClauses = grades.flatMap(g => [`grade.eq.${g}`, `grade.ilike.${g}/%`]);
      if (orClauses.length > 0) {
        query = query.or(orClauses.join(','));
      }
    }

    const { data: students, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
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
      if (gradeA !== gradeB) return gradeA.localeCompare(gradeB);

      const numA = parseInt(a.id, 10);
      const numB = parseInt(b.id, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return (a.id || '').localeCompare(b.id || '');
    });

    let workbook;
    let filename = '';

    if (type === 'on1') {
      workbook = await generateOn1Workbook(studentList, academicYear);
      filename = `PSIS_Form_On1_Somkid_${academicYear}.xlsx`;
    } else {
      // Default: Lunch subsidy list
      workbook = await generateLunchSubsidyWorkbook(studentList);
      filename = `PSIS_Lunch_Subsidy_Somkid_${academicYear}.xlsx`;
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer);

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
    console.error('Nutrition export API error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
