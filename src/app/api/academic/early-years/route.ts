import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth('staff', 'academic_hub');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabase = getAdminClient();
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get('class_id');
    const term = searchParams.get('term') || '1';

    if (!classId) {
      return NextResponse.json({ success: false, error: 'Missing class_id' }, { status: 400 });
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(classId);
    if (!isUuid) {
      return NextResponse.json({ success: false, error: 'รหัสห้องเรียนไม่ถูกต้อง (Invalid UUID)' }, { status: 400 });
    }

    // 1. Fetch class details
    const { data: classData, error: clsErr } = await supabase
      .from('academic_classes')
      .select('*')
      .eq('id', classId)
      .maybeSingle();

    if (clsErr) throw clsErr;

    if (!classData) {
      return NextResponse.json({ success: false, error: 'ไม่พบห้องเรียนที่ระบุ' }, { status: 404 });
    }

    // 2. Fetch enrolled students
    const { data: enrollments, error: enrErr } = await supabase
      .from('academic_class_enrollments')
      .select('student_id, roll_number, student:students(id, name, gender)')
      .eq('class_id', classId)
      .order('roll_number', { ascending: true });

    if (enrErr) throw enrErr;

    // 3. Fetch existing evaluations
    const { data: existingEvals, error: evalErr } = await supabase
      .from('academic_early_years_evaluations')
      .select('*')
      .eq('class_id', classId)
      .eq('term', term);

    if (evalErr) throw evalErr;

    return NextResponse.json({
      success: true,
      class: classData,
      enrollments: enrollments || [],
      evaluations: existingEvals || []
    });
  } catch (error: any) {
    console.error('Error fetching early years data:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth('teacher', 'academic_hub');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabase = getAdminClient();
    const body = await req.json();
    const { evaluations } = body;

    if (!Array.isArray(evaluations)) {
      return NextResponse.json({ success: false, error: 'Expected evaluations array' }, { status: 400 });
    }

    const payload = evaluations.map((item: any) => ({
      class_id: item.class_id,
      student_id: item.student_id,
      term: item.term || '1',
      physical_score: item.physical_score ?? null,
      emotional_score: item.emotional_score ?? null,
      social_score: item.social_score ?? null,
      intellectual_score: item.intellectual_score ?? null,
      weight_kg: item.weight_kg ? Number(item.weight_kg) : null,
      height_cm: item.height_cm ? Number(item.height_cm) : null,
      growth_status: item.growth_status || null,
      milk_drinking: item.milk_drinking || null,
      nap_habit: item.nap_habit || null,
      hygiene_score: item.hygiene_score ?? null,
      teacher_comment: item.teacher_comment || null,
      approval_status: item.approval_status || 'DRAFT',
      updated_at: new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from('academic_early_years_evaluations')
      .upsert(payload, { onConflict: 'class_id, student_id, term' })
      .select();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      saved_count: (data || []).length,
      message: 'บันทึกแบบประเมินพัฒนาการปฐมวัยเรียบร้อยแล้ว'
    });
  } catch (error: any) {
    console.error('Error saving early years evaluations:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
