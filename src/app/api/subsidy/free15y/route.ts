import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth';
import { 
  calculateDisbursementAmount, 
  FREE_15Y_RATES 
} from '@/lib/subsidy/free15y';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const grade = searchParams.get('grade');
    const academicYear = searchParams.get('academicYear') || '2568';
    const term = searchParams.get('term') || '1';

    const supabase = getAdminClient();

    // 1. Fetch Students
    let studentsQuery = supabase
      .from('students')
      .select('id, student_id, name, grade, classroom, status, student_parents(*)')
      .in('status', ['กำลังศึกษาอยู่', 'นักเรียนเข้าใหม่', 'นักเรียนเก่าเข้าใหม่']);

    if (grade && grade !== 'all') {
      studentsQuery = studentsQuery.or(`grade.eq.${grade},grade.ilike.${grade}/%`);
    }

    const { data: students, error: studentsError } = await studentsQuery;
    if (studentsError) {
      return NextResponse.json({ error: studentsError.message }, { status: 500 });
    }

    const studentIds = (students || []).map(s => s.id);

    // 2. Fetch Disbursements for this term
    let disburseQuery = supabase
      .from('subsidy_free15y_disbursements')
      .select('*')
      .eq('academic_year', academicYear)
      .eq('term', term);

    if (studentIds.length > 0) {
      disburseQuery = disburseQuery.in('student_id', studentIds);
    } else {
      return NextResponse.json({
        students: [],
        disbursements: [],
        stats: { totalStudents: 0, signedCount: 0, pendingCount: 0, totalDisbursed: 0, rates: FREE_15Y_RATES }
      });
    }

    const { data: disbursements, error: disburseError } = await disburseQuery;
    if (disburseError) {
      return NextResponse.json({ error: disburseError.message }, { status: 500 });
    }

    // Calculate totals
    let signedCount = 0;
    let totalDisbursed = 0;
    (disbursements || []).forEach(d => {
      if (d.signature_data) signedCount++;
      totalDisbursed += Number(d.total_amount || 0);
    });

    return NextResponse.json({
      students: students || [],
      disbursements: disbursements || [],
      stats: {
        totalStudents: students?.length || 0,
        signedCount,
        pendingCount: (students?.length || 0) - signedCount,
        totalDisbursed,
        rates: FREE_15Y_RATES
      }
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
      student_id,
      grade = 'ป.1',
      academic_year = '2568',
      term = '1',
      recipient_name,
      recipient_relation = 'บิดา/มารดา',
      recipient_citizen_id,
      signature_data,
      disbursed_by
    } = body;

    if (!student_id || !recipient_name || !signature_data) {
      return NextResponse.json({ error: 'Missing student_id, recipient_name, or signature_data' }, { status: 400 });
    }

    // Auto-calculate statutory amounts based on grade and term
    const { uniformAmount, stationeryAmount, totalCashDisbursement } = calculateDisbursementAmount(grade, term);

    const recordToUpsert = {
      student_id,
      academic_year: String(academic_year),
      term: String(term),
      disbursement_type: 'ALL',
      uniform_amount: uniformAmount,
      stationery_amount: stationeryAmount,
      books_amount: 0,
      activities_amount: 0,
      total_amount: totalCashDisbursement,
      recipient_name,
      recipient_relation,
      recipient_citizen_id: recipient_citizen_id || null,
      signature_data,
      disbursed_at: new Date().toISOString(),
      disbursed_by: disbursed_by || auth.user?.email || 'เจ้าหน้าที่การเงิน',
      form_or1_1_number: `อร11-${academic_year}-${term}-${student_id}`,
      updated_at: new Date().toISOString()
    };

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from('subsidy_free15y_disbursements')
      .upsert(recordToUpsert, {
        onConflict: 'student_id,academic_year,term,disbursement_type'
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving free 15y disbursement:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      disbursement: data
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
