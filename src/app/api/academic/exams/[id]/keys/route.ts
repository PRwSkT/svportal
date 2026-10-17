import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth';

/**
 * Secure, authorized endpoint for retrieving exam answer keys.
 * Access is logged and restricted to authorized teachers and academic administrators.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('teacher', 'academic_hub');
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const supabase = getAdminClient();

    // 1. Verify exam existence and permissions
    const { data: exam, error: examError } = await supabase
      .from('academic_exams')
      .select('id, title, course_id, created_by, status')
      .eq('id', id)
      .single();

    if (examError || !exam) {
      return NextResponse.json({ success: false, error: 'Exam not found' }, { status: 404 });
    }

    // 2. Fetch answer keys from sets
    const { data: sets, error: setError } = await supabase
      .from('academic_exam_sets')
      .select('id, set_name, answer_key')
      .eq('exam_id', id)
      .order('set_name', { ascending: true });

    if (setError) throw setError;

    // 3. Security audit log
    console.info(`[SECURITY_AUDIT] Answer key retrieved for exam: ${id} (${exam.title}) by user: ${auth.user?.id || 'unknown'}`);

    const keysBySet: Record<string, Record<string, string>> = {};
    (sets || []).forEach(s => {
      keysBySet[s.set_name] = s.answer_key || {};
    });

    return NextResponse.json({
      success: true,
      exam_id: id,
      sets: sets || [],
      keys_by_set: keysBySet
    });
  } catch (error: any) {
    console.error('Error fetching secure answer keys:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * Update answer keys for an exam set with security audit
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('teacher', 'academic_hub');
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const supabase = getAdminClient();
    const body = await req.json();
    const { set_name, answer_key } = body;

    if (!set_name || !answer_key) {
      return NextResponse.json({ success: false, error: 'Set name and answer key are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('academic_exam_sets')
      .update({ answer_key })
      .eq('exam_id', id)
      .eq('set_name', set_name)
      .select()
      .single();

    if (error) throw error;

    console.info(`[SECURITY_AUDIT] Answer key updated for exam: ${id}, set: ${set_name} by user: ${auth.user?.id || 'unknown'}`);

    return NextResponse.json({
      success: true,
      message: `Answer key for set ${set_name} updated successfully`,
      set: data
    });
  } catch (error: any) {
    console.error('Error updating secure answer key:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
