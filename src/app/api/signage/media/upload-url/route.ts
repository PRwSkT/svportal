import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const auth = await requireAuth('admin', 'admin_signage');
    if (auth.error) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const rawName = typeof body?.fileName === 'string' ? body.fileName.trim() : '';
    const contentType = typeof body?.contentType === 'string' ? body.contentType.trim() : '';

    if (!rawName) {
      return NextResponse.json({ success: false, error: 'fileName is required' }, { status: 400 });
    }

    const safeName = rawName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${Date.now()}-${safeName}`;

    const supabase = getAdminClient();
    const { data, error } = await supabase.storage
      .from('signage-media')
      .createSignedUploadUrl(storagePath, { upsert: true });

    if (error || !data) {
      throw error || new Error('Failed to create signed upload URL');
    }

    const { data: pub } = supabase.storage.from('signage-media').getPublicUrl(storagePath);

    const isVideo = contentType.startsWith('video') || /\.(mp4|webm|mov|m4v)$/i.test(rawName);

    return NextResponse.json({
      success: true,
      data: {
        signedUrl: data.signedUrl,
        token: data.token,
        path: storagePath,
        publicUrl: pub.publicUrl,
        type: isVideo ? 'video' : 'image',
        contentType: contentType || (isVideo ? 'video/mp4' : 'image/jpeg'),
      },
    });
  } catch (err: any) {
    console.error('Create signed upload URL error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
