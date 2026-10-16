import { NextRequest, NextResponse } from 'next/server';
import { generateOpecRegisExportData } from '@/lib/academic/opec';
import { requireAuth } from '@/lib/auth';
import { DEFAULT_ACADEMIC_YEAR } from '@/lib/constants/school';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth('staff', 'academic_hub');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(req.url);
    const year = searchParams.get('year') || DEFAULT_ACADEMIC_YEAR;
    const gradeLevel = searchParams.get('grade_level') || undefined;
    const format = searchParams.get('format'); // 'json' or 'csv'

    const exportData = await generateOpecRegisExportData({
      academicYear: year,
      gradeLevel
    });

    if (format === 'csv') {
      const headers = [
        'รหัสนักเรียน',
        'เลขประจำตัวประชาชน',
        'ชื่อ-สกุล',
        'ห้องเรียน (สช.)',
        'รหัสวิชา (สช.)',
        'ชื่อวิชา',
        'คะแนนรวม',
        'ผลการเรียน',
        'ครูผู้สอนตามทะเบียน สช.'
      ];

      const rows = exportData.rows.map(r => [
        r.studentCode,
        r.citizenId,
        r.studentName,
        r.opecRoomName,
        r.opecCourseCode,
        r.courseName,
        r.totalScore,
        r.finalGrade,
        r.teacherName
      ]);

      const BOM = '\uFEFF';
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      return new NextResponse(BOM + csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="OPEC_REGIS_Export_${year}_${gradeLevel || 'ALL'}.csv"`
        }
      });
    }

    return NextResponse.json(exportData);
  } catch (error: any) {
    console.error('Error generating OPEC export:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
