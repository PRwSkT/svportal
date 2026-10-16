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
    const gradeLevel = searchParams.get('grade_level');

    let query = supabase
      .from('academic_courses')
      .select('*')
      .eq('academic_year', year)
      .order('course_code', { ascending: true });

    if (dept) query = query.eq('department', dept);
    if (gradeLevel) query = query.eq('grade_level', gradeLevel);

    const { data: courses, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, courses: courses || [] });
  } catch (error: any) {
    console.error('Error fetching academic courses:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth('teacher', 'admin_academic');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabase = getAdminClient();
    const body = await req.json();

    // Support Auto-Seeding Standard Curriculum Courses for P.1 - P.6 & K.1 - K.3
    if (body.action === 'seed_standard_curriculum') {
      const year = body.academic_year || '2568';

      const sampleCourses = [
        // ปฐมวัย (Early Years)
        { course_code: 'DEV-K1', name_th: 'พัฒนาการ 4 ด้าน (อ.1)', department: 'kindergarten', grade_level: 'K1', subject_group: 'พัฒนาการ 4 ด้าน', course_type: 'development', annual_hours: 400, credits: 0, is_reported_to_opec: true, show_on_parent_report: true, academic_year: year },
        { course_code: 'DEV-K2', name_th: 'พัฒนาการ 4 ด้าน (อ.2)', department: 'kindergarten', grade_level: 'K2', subject_group: 'พัฒนาการ 4 ด้าน', course_type: 'development', annual_hours: 400, credits: 0, is_reported_to_opec: true, show_on_parent_report: true, academic_year: year },
        { course_code: 'DEV-K3', name_th: 'พัฒนาการ 4 ด้าน (อ.3)', department: 'kindergarten', grade_level: 'K3', subject_group: 'พัฒนาการ 4 ด้าน', course_type: 'development', annual_hours: 400, credits: 0, is_reported_to_opec: true, show_on_parent_report: true, academic_year: year },

        // ประถมศึกษาปีที่ 3 (Primary 3 - พร้อมกรณีตัวอย่าง Dual-Layer MEP)
        { course_code: 'ท13101', name_th: 'ภาษาไทย 3', department: 'primary', grade_level: 'P3', subject_group: 'ภาษาไทย', course_type: 'basic', annual_hours: 200, credits: 5.0, is_reported_to_opec: true, show_on_parent_report: true, opec_course_code: 'ท13101', academic_year: year },
        { course_code: 'ค13101', name_th: 'คณิตศาสตร์ 3 (ไทย)', department: 'primary', grade_level: 'P3', subject_group: 'คณิตศาสตร์', course_type: 'basic', annual_hours: 160, credits: 4.0, is_reported_to_opec: true, show_on_parent_report: true, opec_course_code: 'ค13101', academic_year: year },
        // MEP Mathematics (Dual-layer: แสดงในใบเกรดผู้ปกครอง แต่ตัดออกจาก สช.)
        { course_code: 'MA13101', name_th: 'Mathematics (MEP)', name_en: 'Mathematics (English Program)', department: 'primary', grade_level: 'P3', subject_group: 'คณิตศาสตร์', course_type: 'additional', annual_hours: 80, credits: 2.0, is_reported_to_opec: false, show_on_parent_report: true, opec_course_code: null, academic_year: year },
        { course_code: 'ว13101', name_th: 'วิทยาศาสตร์และเทคโนโลยี 3', department: 'primary', grade_level: 'P3', subject_group: 'วิทยาศาสตร์และเทคโนโลยี', course_type: 'basic', annual_hours: 80, credits: 2.0, is_reported_to_opec: true, show_on_parent_report: true, opec_course_code: 'ว13101', academic_year: year },
        { course_code: 'ส13101', name_th: 'สังคมศึกษา ศาสนา และวัฒนธรรม 3', department: 'primary', grade_level: 'P3', subject_group: 'สังคมศึกษา ศาสนา และวัฒนธรรม', course_type: 'basic', annual_hours: 80, credits: 2.0, is_reported_to_opec: true, show_on_parent_report: true, opec_course_code: 'ส13101', academic_year: year },
        { course_code: 'ส13102', name_th: 'ประวัติศาสตร์ 3', department: 'primary', grade_level: 'P3', subject_group: 'สังคมศึกษา ศาสนา และวัฒนธรรม', course_type: 'basic', annual_hours: 40, credits: 1.0, is_reported_to_opec: true, show_on_parent_report: true, opec_course_code: 'ส13102', academic_year: year },
        { course_code: 'พ13101', name_th: 'สุขศึกษาและพลศึกษา 3', department: 'primary', grade_level: 'P3', subject_group: 'สุขศึกษาและพลศึกษา', course_type: 'basic', annual_hours: 80, credits: 2.0, is_reported_to_opec: true, show_on_parent_report: true, opec_course_code: 'พ13101', academic_year: year },
        { course_code: 'ศ13101', name_th: 'ศิลปะ 3', department: 'primary', grade_level: 'P3', subject_group: 'ศิลปะ', course_type: 'basic', annual_hours: 40, credits: 1.0, is_reported_to_opec: true, show_on_parent_report: true, opec_course_code: 'ศ13101', academic_year: year },
        { course_code: 'ง13101', name_th: 'การงานอาชีพ 3', department: 'primary', grade_level: 'P3', subject_group: 'การงานอาชีพ', course_type: 'basic', annual_hours: 40, credits: 1.0, is_reported_to_opec: true, show_on_parent_report: true, opec_course_code: 'ง13101', academic_year: year },
        { course_code: 'อ13101', name_th: 'ภาษาอังกฤษ 3', department: 'primary', grade_level: 'P3', subject_group: 'ภาษาต่างประเทศ', course_type: 'basic', annual_hours: 120, credits: 3.0, is_reported_to_opec: true, show_on_parent_report: true, opec_course_code: 'อ13101', academic_year: year }
      ];

      const { data, error } = await supabase
        .from('academic_courses')
        .upsert(sampleCourses, { onConflict: 'course_code, academic_year' })
        .select();

      if (error) throw error;
      return NextResponse.json({
        success: true,
        message: `ติดตั้งหลักสูตรมาตรฐานและรายวิชาตัวอย่าง ${data.length} วิชาเรียบร้อยแล้ว`,
        courses: data
      });
    }

    // Normal Course Creation
    const { data, error } = await supabase
      .from('academic_courses')
      .insert([body])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ course: data });
  } catch (error: any) {
    console.error('Error creating academic course:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuth('teacher', 'admin_academic');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabase = getAdminClient();
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing course id' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('academic_courses')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, course: data });
  } catch (error: any) {
    console.error('Error updating academic course:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuth('teacher', 'admin_academic');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabase = getAdminClient();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing course id' }, { status: 400 });
    }

    const { error } = await supabase
      .from('academic_courses')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true, message: 'ลบรายวิชาเรียบร้อยแล้ว' });
  } catch (error: any) {
    console.error('Error deleting academic course:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
