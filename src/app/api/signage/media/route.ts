import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';

export async function GET() {
  try {
    const supabase = getAdminClient();
    const { data: media, error } = await supabase
      .from('signage_media')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, data: media });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const title = (formData.get('title') as string) || file?.name || 'Untitled Media';
    const duration = parseInt(formData.get('duration_seconds') as string) || 10;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    const isVideo = file.type.startsWith('video') || file.name.endsWith('.mp4');
    const type = isVideo ? 'video' : 'image';
    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    const supabase = getAdminClient();
    const { error: uploadError } = await supabase.storage
      .from('signage-media')
      .upload(fileName, buffer, {
        contentType: file.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: pub } = supabase.storage.from('signage-media').getPublicUrl(fileName);
    const fileUrl = pub.publicUrl;

    const id = 'med_' + crypto.randomBytes(4).toString('hex');
    const { data: created, error: dbError } = await supabase
      .from('signage_media')
      .insert({
        id,
        title,
        type,
        file_path: fileName,
        file_url: fileUrl,
        checksum_sha256: checksum,
        duration_seconds: duration,
        file_size_bytes: file.size,
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return NextResponse.json({ success: true, data: created });
  } catch (err: any) {
    console.error('Media upload error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
