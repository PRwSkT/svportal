import { NextRequest, NextResponse } from 'next/server';
import { generatePP3ReportData, generatePP3OrssExcel } from '@/lib/academic/pp3-orss';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth';
import { DEFAULT_ACADEMIC_YEAR } from '@/lib/constants/school';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth('staff', 'academic_hub');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(req.url);
    const academicYear = searchParams.get('academic_year') || DEFAULT_ACADEMIC_YEAR;
    const mode = searchParams.get('mode') || 'data'; // 'data' | 'excel'

    const supabase = getAdminClient();
    const summary = await generatePP3ReportData({ academicYear, customClient: supabase });

    if (mode === 'excel') {
      const buffer = await generatePP3OrssExcel(summary);
      const filename = `OPEC_ORSS_PP3_${summary.schoolId}_${summary.academicYear}.xlsx`;

      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store'
        }
      });
    }

    return NextResponse.json({ success: true, summary });
  } catch (error: any) {
    console.error('Error generating PP3 ORSS data:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
