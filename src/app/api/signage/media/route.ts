import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth';
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
    const auth = await requireAuth('admin', 'admin_signage');
    if (auth.error) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const reqContentType = request.headers.get('content-type') || '';

    // Mode 1: JSON metadata registration after direct-to-Supabase Signed URL upload (supports large files > 6MB)
    if (reqContentType.includes('application/json')) {
      const body = await request.json();
      const title = (typeof body?.title === 'string' && body.title.trim()) || 'Untitled Media';
      const filePath = typeof body?.file_path === 'string' ? body.file_path.trim() : '';
      const fileUrl = typeof body?.file_url === 'string' ? body.file_url.trim() : '';
      const type = body?.type === 'video' ? 'video' : 'image';
      const duration = parseInt(String(body?.duration_seconds), 10) || 10;
      const fileSize = parseInt(String(body?.file_size_bytes), 10) || 0;
      const checksum = typeof body?.checksum_sha256 === 'string' ? body.checksum_sha256 : null;

      if (!filePath || !fileUrl) {
        return NextResponse.json(
          { success: false, error: 'file_path and file_url are required' },
          { status: 400 }
        );
      }

      const supabase = getAdminClient();
      const id = 'med_' + crypto.randomBytes(4).toString('hex');
      const { data: created, error: dbError } = await supabase
        .from('signage_media')
        .insert({
          id,
          title,
          type,
          file_path: filePath,
          file_url: fileUrl,
          checksum_sha256: checksum,
          duration_seconds: duration,
          file_size_bytes: fileSize,
        })
        .select()
        .single();

      if (dbError) throw dbError;
      return NextResponse.json({ success: true, data: created });
    }

    // Mode 2: Legacy multipart/form-data upload (for small files <= 6MB)
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
