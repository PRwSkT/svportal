import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('teacher', 'academic_hub');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await params;
    const supabase = getAdminClient();
    const body = await req.json();
    const { status } = body; // 'APPROVED' | 'REJECTED' | 'COMPLETED'

    if (!['APPROVED', 'REJECTED', 'COMPLETED'].includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from('academic_substitutions')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      substitution: updated,
      message: `ปรับสถานะการสอนแทนเป็น ${status} สำเร็จ`
    });
  } catch (error: any) {
    console.error('Error updating substitution status:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
