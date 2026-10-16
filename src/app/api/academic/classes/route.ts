import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth('staff', 'academic_hub');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabase = getAdminClient();
    const { searchParams } = new URL(req.url);
    const year = searchParams.get('academic_year') || searchParams.get('year') || '2568';
    const dept = searchParams.get('department');

    let query = supabase
      .from('academic_classes')
      .select(`
        *,
        actual_homeroom_teacher:personnel!academic_classes_actual_homeroom_teacher_id_fkey(id, name_th, position_th, image_url),
        assistant_homeroom_teacher:personnel!academic_classes_assistant_homeroom_teacher_id_fkey(id, name_th, position_th, image_url),
        opec_homeroom_teacher:personnel!academic_classes_opec_homeroom_teacher_id_fkey(id, name_th, position_th)
      `)
      .eq('academic_year', year)
      .order('name', { ascending: true });

    if (dept) query = query.eq('department', dept);

    const { data: classes, error } = await query;
    if (error) throw error;

    // Get enrollment counts per class
    const { data: counts, error: countErr } = await supabase
      .from('academic_class_enrollments')
      .select('class_id');

    const countMap: Record<string, number> = {};
    counts?.forEach(c => {
      countMap[c.class_id] = (countMap[c.class_id] || 0) + 1;
    });

    // Get personnel list for teacher assignment
    const { data: personnelList } = await supabase
      .from('personnel')
      .select('id, name_th, position_th, image_url')
      .order('name_th', { ascending: true });

    const enriched = (classes || []).map(cls => ({
      ...cls,
      student_count: countMap[cls.id] || 0
    }));

    return NextResponse.json({ 
      success: true, 
      classes: enriched,
      personnel: personnelList || []
    });
  } catch (error: any) {
    console.error('Error fetching academic classes:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuth('teacher', 'admin_academic');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabase = getAdminClient();
    const body = await req.json();
    const { id, actual_homeroom_teacher_id, assistant_homeroom_teacher_id, opec_homeroom_teacher_id, opec_room_name, name } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing class id' }, { status: 400 });
    }

    const updates: Record<string, any> = {};
    if (actual_homeroom_teacher_id !== undefined) updates.actual_homeroom_teacher_id = actual_homeroom_teacher_id || null;
    if (assistant_homeroom_teacher_id !== undefined) updates.assistant_homeroom_teacher_id = assistant_homeroom_teacher_id || null;
    if (opec_homeroom_teacher_id !== undefined) updates.opec_homeroom_teacher_id = opec_homeroom_teacher_id || null;
    if (opec_room_name !== undefined) updates.opec_room_name = opec_room_name;
    if (name !== undefined) updates.name = name;

    const { data, error } = await supabase
      .from('academic_classes')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        actual_homeroom_teacher:personnel!academic_classes_actual_homeroom_teacher_id_fkey(id, name_th, position_th, image_url),
        assistant_homeroom_teacher:personnel!academic_classes_assistant_homeroom_teacher_id_fkey(id, name_th, position_th, image_url),
        opec_homeroom_teacher:personnel!academic_classes_opec_homeroom_teacher_id_fkey(id, name_th, position_th)
      `)
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, class: data });
  } catch (error: any) {
    console.error('Error updating academic class:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth('teacher', 'admin_academic');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabase = getAdminClient();
    const body = await req.json();

    // Support Auto-Sync from Existing Students Table
    if (body.action === 'sync_from_students') {
      const year = body.academic_year || '2568';
      
      // 1. Get all students with grades
      const { data: students, error: sErr } = await supabase
        .from('students')
        .select('id, name, grade')
        .not('grade', 'is', null);

      if (sErr) throw sErr;

      // Group students by grade
      const gradeGroups: Record<string, any[]> = {};
      students?.forEach(s => {
        if (!gradeGroups[s.grade]) gradeGroups[s.grade] = [];
        gradeGroups[s.grade].push(s);
      });

      const createdClasses: any[] = [];
      let totalEnrolled = 0;

      for (const [gradeName, stList] of Object.entries(gradeGroups)) {
        const isKindergarten = gradeName.startsWith('อ.') || gradeName.includes('เตรียม');
        const dept = isKindergarten ? 'kindergarten' : 'primary';
        
        let gradeLevel = 'P1';
        if (gradeName.includes('อ.1')) gradeLevel = 'K1';
        else if (gradeName.includes('อ.2')) gradeLevel = 'K2';
        else if (gradeName.includes('อ.3')) gradeLevel = 'K3';
        else if (gradeName.includes('ป.1')) gradeLevel = 'P1';
        else if (gradeName.includes('ป.2')) gradeLevel = 'P2';
        else if (gradeName.includes('ป.3')) gradeLevel = 'P3';
        else if (gradeName.includes('ป.4')) gradeLevel = 'P4';
        else if (gradeName.includes('ป.5')) gradeLevel = 'P5';
        else if (gradeName.includes('ป.6')) gradeLevel = 'P6';

        // Dual-layer OPEC room name (e.g. ป.3/1 -> ป.3)
        const opecRoom = gradeName.split('/')[0];

        // Upsert class
        const { data: cls, error: clsErr } = await supabase
          .from('academic_classes')
          .upsert({
            name: gradeName,
            department: dept,
            grade_level: gradeLevel,
            academic_year: year,
            opec_room_name: opecRoom
          }, { onConflict: 'name, academic_year' })
          .select()
          .single();

        if (clsErr) throw clsErr;
        createdClasses.push(cls);

        // Sort students and enroll with roll numbers
        stList.sort((a, b) => a.id.localeCompare(b.id));
        const enrollments = stList.map((st, idx) => ({
          class_id: cls.id,
          student_id: st.id,
          roll_number: idx + 1,
          status: 'active'
        }));

        const { error: enrErr } = await supabase
          .from('academic_class_enrollments')
          .upsert(enrollments, { onConflict: 'class_id, student_id' });

        if (enrErr) console.warn('Enrollment upsert warning:', enrErr);
        totalEnrolled += enrollments.length;
      }

      return NextResponse.json({
        success: true,
        message: `สร้างห้องเรียน ${createdClasses.length} ห้อง และลงทะเบียนนักเรียน ${totalEnrolled} คนเรียบร้อยแล้ว`,
        classes: createdClasses
      });
    }

    // Normal Class Creation
    const { data, error } = await supabase
      .from('academic_classes')
      .insert([body])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ class: data });
  } catch (error: any) {
    console.error('Error creating academic class:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
