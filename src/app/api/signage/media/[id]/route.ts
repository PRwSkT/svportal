import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getAdminClient();

    const { data: media } = await supabase
      .from('signage_media')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (media?.file_path) {
      await supabase.storage.from('signage-media').remove([media.file_path]);
    }

    const { error } = await supabase.from('signage_media').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Media deleted' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
