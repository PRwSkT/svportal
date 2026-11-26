import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { createInstagramPhotoContainers } from '@/lib/post-assistant/meta-client';
import {
  getErrorMessage,
  isSchemaMissingError,
  isValidUuid,
  requirePostAssistantAuth,
  resolveSafePostMediaUrl,
  schemaNotMigratedResponse,
} from '@/lib/post-assistant/api-helpers';

export async function POST(request: Request) {
  const auth = await requirePostAssistantAuth();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const draftId = body?.draftId;
    const brand = body?.brand;
    const caption = typeof body?.caption === 'string' ? body.caption.trim() : '';
    const storagePaths: string[] = Array.isArray(body?.storagePaths) ? body.storagePaths : [];
    const pdpaAttested = body?.pdpaAttested === true;

    if (brand !== 'main') {
      return NextResponse.json(
        { error: 'Instagram publishing is only enabled for Somkidvittaya main page' },
        { status: 400 }
      );
    }
    if (!isValidUuid(draftId)) {
      return NextResponse.json({ error: 'Valid draftId is required' }, { status: 400 });
    }
    if (!pdpaAttested) {
      return NextResponse.json({ error: 'ต้องยืนยันการตรวจสอบ PDPA ก่อนเผยแพร่โพสต์' }, { status: 400 });
    }
    if (!caption) {
      return NextResponse.json({ error: 'Instagram caption is required' }, { status: 400 });
    }
    if (storagePaths.length === 0) {
      return NextResponse.json({ error: 'At least 1 JPEG image path is required for Instagram' }, { status: 400 });
    }

    const admin = getAdminClient();
    const { data: draft, error: draftErr } = await admin
      .from('social_posts')
      .select('id, ig_media_id, ig_permalink, channel_errors')
      .eq('id', draftId)
      .maybeSingle();

    if (draftErr) {
      if (isSchemaMissingError(draftErr)) return schemaNotMigratedResponse();
      throw draftErr;
    }

    if (draft?.ig_media_id) {
      return NextResponse.json({
        success: true,
        alreadyPublished: true,
        mediaId: draft.ig_media_id,
        permalink: draft.ig_permalink || null,
      });
    }

    const imageUrls = storagePaths.slice(0, 10).map((p) => resolveSafePostMediaUrl(p, draftId));

    try {
      const container = await createInstagramPhotoContainers({
        brand: 'main',
        imageUrls,
        caption,
      });

      await admin
        .from('social_posts')
        .update({
          pdpa_attested: true,
          pdpa_attested_by: auth.user.id,
          pdpa_attested_at: new Date().toISOString(),
          updated_by: auth.user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', draftId);

      return NextResponse.json({
        success: true,
        containerId: container.creationId,
        mode: container.mode,
      });
    } catch (igErr: unknown) {
      const nextErrors = {
        ...(draft?.channel_errors || {}),
        instagram: getErrorMessage(igErr, 'IG container failed'),
      };
      await admin
        .from('social_posts')
        .update({
          status: 'partial',
          channel_errors: nextErrors,
          updated_by: auth.user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', draftId);
      throw igErr;
    }
  } catch (err: unknown) {
    console.error('[PostAssistant Publish IG]', err);
    return NextResponse.json({ error: getErrorMessage(err, 'Instagram prepare failed') }, { status: 500 });
  }
}
