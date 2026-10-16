import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    const auth = await requireAuth('staff', 'academic_hub');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabase = getAdminClient();

    // Fetch teachers with competencies
    const { data: teachers, error: teacherError } = await supabase
      .from('personnel')
      .select('id, name_th, position_th, email, is_active')
      .eq('is_active', true)
      .order('name_th', { ascending: true });

    if (teacherError) throw teacherError;

    const { data: competencies, error: compError } = await supabase
      .from('academic_teacher_competencies')
      .select('*');

    if (compError) throw compError;

    const compMap = new Map((competencies || []).map((c: any) => [c.teacher_id, c]));

    const enriched = (teachers || []).map((t: any) => {
      const existing = compMap.get(t.id);
      return {
        teacher_id: t.id,
        name_th: t.name_th,
        position_th: t.position_th,
        eligible_subject_groups: existing?.eligible_subject_groups || [
          'คณิตศาสตร์', 'ภาษาไทย', 'วิทยาศาสตร์และเทคโนโลยี', 'ภาษาต่างประเทศ', 
          'สังคมศึกษา ศาสนา และวัฒนธรรม', 'สุขศึกษาและพลศึกษา', 'ศิลปะ', 'การงานอาชีพ'
        ],
        eligible_grade_levels: existing?.eligible_grade_levels || ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
        target_weekly_hours: existing?.target_weekly_hours || 18,
        max_weekly_hours: existing?.max_weekly_hours || 22,
        unavailable_slots: existing?.unavailable_slots || [],
        is_active: existing?.is_active ?? true
      };
    });

    return NextResponse.json({ success: true, competencies: enriched });
  } catch (error: any) {
    console.error('Error fetching teacher competencies:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth('academic staff', 'academic_hub');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabase = getAdminClient();
    const body = await req.json();

    const {
      teacher_id,
      eligible_subject_groups = [],
      eligible_grade_levels = [],
      target_weekly_hours = 18,
      max_weekly_hours = 22,
      unavailable_slots = [],
      is_active = true
    } = body;

    if (!teacher_id) {
      return NextResponse.json({ success: false, error: 'Teacher ID is required' }, { status: 400 });
    }

    let { data, error } = await supabase
      .from('academic_teacher_competencies')
      .upsert({
        teacher_id,
        eligible_subject_groups,
        eligible_grade_levels,
        target_weekly_hours,
        max_weekly_hours,
        unavailable_slots,
        is_active
      }, { onConflict: 'teacher_id' })
      .select()
      .single();

    if (error && (error.message?.includes('unavailable_slots') || error.code === '42703')) {
      const fallback = await supabase
        .from('academic_teacher_competencies')
        .upsert({
          teacher_id,
          eligible_subject_groups,
          eligible_grade_levels,
          target_weekly_hours,
          max_weekly_hours,
          is_active
        }, { onConflict: 'teacher_id' })
        .select()
        .single();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;

    return NextResponse.json({
      success: true,
      competency: data,
      message: 'บันทึกคุณสมบัติวิชาและระดับชั้นที่สอนได้เรียบร้อยแล้ว'
    });
  } catch (error: any) {
    console.error('Error saving teacher competency:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
