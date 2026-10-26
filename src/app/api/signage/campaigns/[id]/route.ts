import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getAdminClient();
    const { error } = await supabase.from('signage_campaigns').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true, message: 'Campaign deleted' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
