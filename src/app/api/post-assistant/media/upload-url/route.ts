import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSupabasePublicObjectUrl, getSupabaseStorageAdmin } from '@/lib/supabase/storage-admin';
import { getErrorMessage, isValidUuid, requirePostAssistantAuth } from '@/lib/post-assistant/api-helpers';

const BUCKET_RULES: Record<
  'website-content' | 'post-media',
  { maxBytes: number; mimeToExt: Record<string, string> }
> = {
  'website-content': {
    maxBytes: 15 * 1024 * 1024, // 15MB
    mimeToExt: {
      'image/webp': 'webp',
      'image/jpeg': 'jpg',
      'image/png': 'png',
    },
  },
  'post-media': {
    maxBytes: 50 * 1024 * 1024, // 50MB (Supabase project storage tier max)
    mimeToExt: {
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
      'video/quicktime': 'mov',
    },
  },
};

export async function POST(request: Request) {
  const auth = await requirePostAssistantAuth();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const draftId = body?.draftId;
    const bucket = body?.bucket === 'post-media' ? 'post-media' : 'website-content';
    const variant = ['fb', 'ig', 'gallery', 'cover', 'og', 'video'].includes(body?.variant)
      ? body.variant
      : 'gallery';
    const contentType = String(body?.contentType || '').toLowerCase().trim();
    const fileSizeBytes = Number(body?.fileSizeBytes || 0);

    if (!isValidUuid(draftId)) {
      return NextResponse.json({ error: 'Valid draftId (UUID) is required' }, { status: 400 });
    }

    const rule = BUCKET_RULES[bucket];
    const ext = rule.mimeToExt[contentType];
    if (!ext) {
      return NextResponse.json(
        { error: `Unsupported contentType "${contentType}" for bucket ${bucket}` },
        { status: 400 }
      );
    }

    if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0 || fileSizeBytes > rule.maxBytes) {
      const maxMb = Math.round(rule.maxBytes / (1024 * 1024));
      return NextResponse.json(
        { error: `File size exceeds ${maxMb}MB limit for ${bucket}` },
        { status: 400 }
      );
    }

    const now = new Date();
    const uuid = crypto.randomUUID();
    const storagePath =
      bucket === 'website-content'
        ? `posts/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${draftId}/${variant}-${uuid}.${ext}`
        : `staging/${draftId}/${variant}/${uuid}.${ext}`;

    const storage = getSupabaseStorageAdmin();
    const { data, error } = await storage.storage
      .from(bucket)
      .createSignedUploadUrl(storagePath, { upsert: false });

    if (error || !data) {
      throw error || new Error('Failed to create signed upload URL');
    }

    return NextResponse.json({
      success: true,
      data: {
        bucket,
        storagePath,
        signedUrl: data.signedUrl,
        token: data.token,
        publicUrl: getSupabasePublicObjectUrl(bucket, storagePath),
        contentType,
      },
    });
  } catch (err: unknown) {
    console.error('[PostAssistant UploadURL]', err);
    return NextResponse.json({ error: getErrorMessage(err, 'Failed to mint upload URL') }, { status: 500 });
  }
}
