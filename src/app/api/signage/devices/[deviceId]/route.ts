import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const { deviceId } = await params;
    const body = await request.json();
    const { name, group_id, orientation, is_muted, volume } = body;

    const supabase = getAdminClient();
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (group_id !== undefined) updateData.group_id = group_id || null;
    if (orientation !== undefined) updateData.orientation = orientation;
    if (is_muted !== undefined) updateData.is_muted = is_muted ? 1 : 0;
    if (volume !== undefined) updateData.volume = parseInt(volume);

    const { data: updated, error } = await supabase
      .from('signage_devices')
      .update(updateData)
      .eq('id', deviceId)
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
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const { deviceId } = await params;
    const supabase = getAdminClient();
    const { error } = await supabase
      .from('signage_devices')
      .delete()
      .eq('id', deviceId);

    if (error) throw error;
    return NextResponse.json({ success: true, message: 'Device deleted' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
