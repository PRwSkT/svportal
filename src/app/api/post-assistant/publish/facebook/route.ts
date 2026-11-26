import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { extractClientIp, logServerAuditAction } from '@/lib/audit-server';
import { publishFacebookPhotos } from '@/lib/post-assistant/meta-client';
import {
  getErrorMessage,
  isSchemaMissingError,
  isValidUuid,
  requirePostAssistantAuth,
  resolveSafePostMediaUrl,
  schemaNotMigratedResponse,
} from '@/lib/post-assistant/api-helpers';
import { BrandId } from '@/lib/post-assistant/types';

export async function POST(request: Request) {
  const auth = await requirePostAssistantAuth();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const draftId = body?.draftId;
    const brand: BrandId = ['main', 'football', 'swimming', 'tutoring'].includes(body?.brand)
      ? body.brand
      : 'main';
    const caption = typeof body?.caption === 'string' ? body.caption.trim() : '';
    const storagePaths: string[] = Array.isArray(body?.storagePaths) ? body.storagePaths : [];
    const pdpaAttested = body?.pdpaAttested === true;

    if (!isValidUuid(draftId)) {
      return NextResponse.json({ error: 'Valid draftId is required' }, { status: 400 });
    }
    if (!pdpaAttested) {
      return NextResponse.json({ error: 'ต้องยืนยันการตรวจสอบ PDPA ก่อนเผยแพร่โพสต์' }, { status: 400 });
    }
    if (!caption) {
      return NextResponse.json({ error: 'Caption is required' }, { status: 400 });
    }
    if (storagePaths.length === 0) {
      return NextResponse.json({ error: 'At least 1 uploaded photo path is required' }, { status: 400 });
    }

    const admin = getAdminClient();
    const { data: draft, error: draftErr } = await admin
      .from('social_posts')
      .select('id, fb_post_id, fb_permalink, channel_errors')
      .eq('id', draftId)
      .maybeSingle();

    if (draftErr) {
      if (isSchemaMissingError(draftErr)) return schemaNotMigratedResponse();
      throw draftErr;
    }

    // Idempotency guard: do not double-post to Facebook if already succeeded
    if (draft?.fb_post_id) {
      return NextResponse.json({
        success: true,
        alreadyPublished: true,
        postId: draft.fb_post_id,
        permalink: draft.fb_permalink || null,
      });
    }

    const imageUrls = storagePaths.slice(0, 20).map((p) => resolveSafePostMediaUrl(p, draftId));

    try {
      const published = await publishFacebookPhotos({
        brand,
        imageUrls,
        caption,
      });

      const nextErrors = { ...(draft?.channel_errors || {}) };
      delete nextErrors.facebook;

      await admin
        .from('social_posts')
        .update({
          fb_post_id: published.postId,
          fb_permalink: published.permalink,
          status: 'published',
          pdpa_attested: true,
          pdpa_attested_by: auth.user.id,
          pdpa_attested_at: new Date().toISOString(),
          published_at: new Date().toISOString(),
          channel_errors: nextErrors,
          updated_by: auth.user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', draftId);

      await logServerAuditAction({
        userId: auth.user.id,
        action: 'POST_ASSISTANT_PUBLISH_FACEBOOK',
        tableName: 'social_posts',
        recordId: draftId,
        newValue: {
          brand,
          fb_post_id: published.postId,
          fb_permalink: published.permalink,
          photo_count: imageUrls.length,
          pdpa_attested: true,
        },
        ipAddress: extractClientIp(request),
      });

      return NextResponse.json({
        success: true,
        postId: published.postId,
        permalink: published.permalink,
      });
    } catch (pubErr: unknown) {
      const nextErrors = {
        ...(draft?.channel_errors || {}),
        facebook: getErrorMessage(pubErr, 'Facebook publish failed'),
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
      throw pubErr;
    }
  } catch (err: unknown) {
    console.error('[PostAssistant Publish FB]', err);
    return NextResponse.json({ error: getErrorMessage(err, 'Facebook publish failed') }, { status: 500 });
  }
}
