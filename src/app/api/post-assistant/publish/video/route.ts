import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { extractClientIp, logServerAuditAction } from '@/lib/audit-server';
import {
  createInstagramReelByUrl,
  publishFacebookVideoByUrl,
} from '@/lib/post-assistant/meta-client';
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
    const channel: 'facebook' | 'instagram' = body?.channel === 'instagram' ? 'instagram' : 'facebook';
    const storagePath = typeof body?.storagePath === 'string' ? body.storagePath : '';
    const caption = typeof body?.caption === 'string' ? body.caption.trim() : '';
    const title = typeof body?.title === 'string' ? body.title.trim() : undefined;
    const pdpaAttested = body?.pdpaAttested === true;

    if (!isValidUuid(draftId)) {
      return NextResponse.json({ error: 'Valid draftId is required' }, { status: 400 });
    }
    if (!pdpaAttested) {
      return NextResponse.json({ error: 'ต้องยืนยันการตรวจสอบ PDPA ก่อนเผยแพร่โพสต์' }, { status: 400 });
    }
    if (channel === 'instagram' && brand !== 'main') {
      return NextResponse.json(
        { error: 'Instagram Reels publishing is only supported for Somkidvittaya main page' },
        { status: 400 }
      );
    }
    if (!storagePath || !caption) {
      return NextResponse.json({ error: 'storagePath and caption are required' }, { status: 400 });
    }

    const admin = getAdminClient();
    const { data: draft, error: draftErr } = await admin
      .from('social_posts')
      .select('id, fb_post_id, fb_permalink, ig_media_id, ig_permalink, channel_errors')
      .eq('id', draftId)
      .maybeSingle();

    if (draftErr) {
      if (isSchemaMissingError(draftErr)) return schemaNotMigratedResponse();
      throw draftErr;
    }

    const videoUrl = resolveSafePostMediaUrl(storagePath, draftId);

    if (channel === 'facebook') {
      if (draft?.fb_post_id) {
        return NextResponse.json({
          success: true,
          alreadyPublished: true,
          postId: draft.fb_post_id,
          permalink: draft.fb_permalink || null,
        });
      }

      const published = await publishFacebookVideoByUrl({ brand, videoUrl, caption, title });
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
        action: 'POST_ASSISTANT_PUBLISH_FB_VIDEO',
        tableName: 'social_posts',
        recordId: draftId,
        newValue: { brand, fb_post_id: published.postId, video_url: videoUrl },
        ipAddress: extractClientIp(request),
      });

      return NextResponse.json({
        success: true,
        postId: published.postId,
        permalink: published.permalink,
      });
    }

    // Instagram Reels
    if (draft?.ig_media_id) {
      return NextResponse.json({
        success: true,
        alreadyPublished: true,
        mediaId: draft.ig_media_id,
        permalink: draft.ig_permalink || null,
      });
    }

    const reel = await createInstagramReelByUrl({ brand, videoUrl, caption });
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
      containerId: reel.containerId,
    });
  } catch (err: unknown) {
    console.error('[PostAssistant Publish Video]', err);
    return NextResponse.json({ error: getErrorMessage(err, 'Video publish failed') }, { status: 500 });
  }
}
