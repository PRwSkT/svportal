import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: 'กรุณาระบุชื่อโซน' }, { status: 400 });
    }

    const supabase = getAdminClient();
    const { data: updated, error } = await supabase
      .from('signage_groups')
      .update({
        name: name.trim(),
        description: description !== undefined ? description.trim() : undefined,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getAdminClient();

    // Detach devices from group
    await supabase.from('signage_devices').update({ group_id: null }).eq('group_id', id);

    const { error } = await supabase.from('signage_groups').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true, message: 'ลบโซนเรียบร้อยแล้ว' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
