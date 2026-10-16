import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth';
import { evaluateBoardCompliance, calculateUnitCostPerStudent, OPEC_CHART_OF_ACCOUNTS } from '@/lib/governance/board-and-finance';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const academicYear = searchParams.get('academicYear') || '2568';

    const supabase = getAdminClient();

    // 1. Fetch board meetings
    const { data: meetings, error: meetingsError } = await supabase
      .from('school_board_meetings')
      .select('*')
      .eq('academic_year', academicYear)
      .order('meeting_no', { ascending: true });

    if (meetingsError) {
      return NextResponse.json({ error: meetingsError.message }, { status: 500 });
    }

    const compliance = evaluateBoardCompliance(meetings || []);

    // 2. Fetch student count for Unit Cost Calculation (ม.32)
    const { count: studentCount } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .in('status', ['กำลังศึกษาอยู่', 'นักเรียนเข้าใหม่']);

    const totalStudents = studentCount || 100;
    // Estimated annual operating cost baseline for unit cost demo
    const estimatedExpense = totalStudents * 42000;
    const unitCost = calculateUnitCostPerStudent(estimatedExpense, totalStudents);

    return NextResponse.json({
      academicYear,
      meetings: meetings || [],
      compliance,
      unitCost,
      chartOfAccounts: OPEC_CHART_OF_ACCOUNTS
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const {
      id,
      academic_year = '2568',
      meeting_no,
      meeting_date = new Date().toISOString().split('T')[0],
      title,
      attendees = [],
      agenda = [],
      resolutions = [],
      minutes_pdf_url
    } = body;

    if (!meeting_no || !title) {
      return NextResponse.json({ error: 'Missing meeting_no or title' }, { status: 400 });
    }

    const recordToUpsert = {
      ...(id ? { id } : {}),
      academic_year: String(academic_year),
      meeting_no: Number(meeting_no),
      meeting_date,
      title,
      attendees: Array.isArray(attendees) ? attendees : [],
      agenda: Array.isArray(agenda) ? agenda : [],
      resolutions: Array.isArray(resolutions) ? resolutions : [],
      minutes_pdf_url: minutes_pdf_url || null,
      updated_at: new Date().toISOString()
    };

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from('school_board_meetings')
      .upsert(recordToUpsert, {
        onConflict: 'academic_year,meeting_no'
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      meeting: data
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
