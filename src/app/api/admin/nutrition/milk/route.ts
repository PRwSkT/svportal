import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth';

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
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const grade = searchParams.get('grade');

    const supabase = getAdminClient();

    let query = supabase
      .from('daily_milk_logs')
      .select('*')
      .order('grade', { ascending: true });

    if (date) {
      query = query.eq('date', date);
    }
    if (grade && grade !== 'all') {
      const baseGrade = grade.split('/')[0].trim();
      query = query.or(`grade.eq.${grade},grade.eq.${baseGrade},grade.ilike.${baseGrade}/%`);
    }

    const { data: logs, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      logs: logs || [],
      date,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth('admin', 'student_nutrition');
    if (auth.error) {
      const fallbackAuth = await requireAuth('admin', 'admin_students');
      if (fallbackAuth.error) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
      }
    }

    const body = await request.json();
    const {
      date = new Date().toISOString().split('T')[0],
      grade,
      academicYear = '2568',
      term = 1,
      presentCount = 0,
      milkConsumedCount = 0,
      dairyAllergyCount = 0,
      flavor = 'รสจืด',
      packaging = 'UHT',
      notes = '',
    } = body;

    if (!grade) {
      return NextResponse.json({ error: 'กรุณาระบุชั้นเรียน' }, { status: 400 });
    }

    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from('daily_milk_logs')
      .upsert({
        date,
        grade,
        academic_year: String(academicYear),
        term: Number(term),
        present_count: Number(presentCount),
        milk_consumed_count: Number(milkConsumedCount),
        dairy_allergy_count: Number(dairyAllergyCount),
        flavor,
        packaging,
        notes,
        recorded_by: (auth.user as any)?.email || 'admin',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'date,grade' })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      log: data,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
