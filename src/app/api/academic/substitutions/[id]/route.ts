import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('staff', 'academic_hub');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await params;
    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from('academic_substitutions')
      .select(`
        *,
        class:academic_classes(name, grade_level),
        course:academic_courses(course_code, name_th, subject_group),
        original_teacher:personnel!academic_substitutions_original_teacher_id_fkey(name_th),
        substitute_teacher:personnel!academic_substitutions_substitute_teacher_id_fkey(name_th)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false, error: 'ไม่พบรายการสอนแทน' }, { status: 404 });
    }

    return NextResponse.json({ success: true, substitution: data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('teacher', 'academic_hub');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await params;
    const supabase = getAdminClient();
    const body = await req.json();

    const {
      substitute_teacher_id,
      worksheet_info,
      reason,
      status
    } = body;

    const updateData: any = {};
    if (substitute_teacher_id !== undefined) updateData.substitute_teacher_id = substitute_teacher_id;
    if (worksheet_info !== undefined) updateData.worksheet_info = worksheet_info;
    if (reason !== undefined) updateData.reason = reason;
    if (status !== undefined) updateData.status = status;

    const { data: updated, error } = await supabase
      .from('academic_substitutions')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        class:academic_classes(name, grade_level),
        course:academic_courses(course_code, name_th, subject_group),
        original_teacher:personnel!academic_substitutions_original_teacher_id_fkey(name_th),
        substitute_teacher:personnel!academic_substitutions_substitute_teacher_id_fkey(name_th)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      substitution: updated,
      message: 'ปรับปรุงรายการสอนแทนเรียบร้อยแล้ว'
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('teacher', 'academic_hub');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await params;
    const supabase = getAdminClient();

    const { error } = await supabase
      .from('academic_substitutions')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'ลบรายการสอนแทนเรียบร้อยแล้ว'
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
