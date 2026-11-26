import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { extractClientIp, logServerAuditAction } from '@/lib/audit-server';
import {
  checkInstagramContainerStatus,
  publishInstagramContainer,
} from '@/lib/post-assistant/meta-client';
import { getErrorMessage, isValidUuid, requirePostAssistantAuth } from '@/lib/post-assistant/api-helpers';

export async function GET(request: Request) {
  const auth = await requirePostAssistantAuth();
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const containerId = (searchParams.get('containerId') || '').trim();
    const draftId = searchParams.get('draftId');
    const autoPublish = searchParams.get('publish') !== 'false';

    if (!containerId) {
      return NextResponse.json({ error: 'containerId is required' }, { status: 400 });
    }

    const status = await checkInstagramContainerStatus(containerId);
    if (status.statusCode === 'ERROR') {
      if (isValidUuid(draftId)) {
        const admin = getAdminClient();
        const { data: draft } = await admin
          .from('social_posts')
          .select('channel_errors')
          .eq('id', draftId)
          .maybeSingle();
        await admin
          .from('social_posts')
          .update({
            status: 'partial',
            channel_errors: { ...(draft?.channel_errors || {}), instagram: status.statusDetail || 'Instagram processing error' },
            updated_at: new Date().toISOString(),
          })
          .eq('id', draftId);
      }
      return NextResponse.json({
        success: false,
        statusCode: 'ERROR',
        error: status.statusDetail || 'Instagram media processing failed',
      });
    }

    if (status.statusCode === 'FINISHED' && autoPublish) {
      const published = await publishInstagramContainer(containerId);
      if (isValidUuid(draftId)) {
        const admin = getAdminClient();
        const { data: draft } = await admin
          .from('social_posts')
          .select('channel_errors')
          .eq('id', draftId)
          .maybeSingle();
        const nextErrors = { ...(draft?.channel_errors || {}) };
        delete nextErrors.instagram;
        await admin
          .from('social_posts')
          .update({
            ig_media_id: published.mediaId,
            ig_permalink: published.permalink,
            status: 'published',
            published_at: new Date().toISOString(),
            channel_errors: nextErrors,
            updated_by: auth.user.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', draftId);

        await logServerAuditAction({
          userId: auth.user.id,
          action: 'POST_ASSISTANT_PUBLISH_INSTAGRAM',
          tableName: 'social_posts',
          recordId: draftId,
          newValue: { ig_media_id: published.mediaId, ig_permalink: published.permalink },
          ipAddress: extractClientIp(request),
        });
      }

      return NextResponse.json({
        success: true,
        statusCode: 'PUBLISHED',
        mediaId: published.mediaId,
        permalink: published.permalink,
      });
    }

    return NextResponse.json({
      success: true,
      statusCode: status.statusCode,
      statusDetail: status.statusDetail,
    });
  } catch (err: unknown) {
    console.error('[PostAssistant IG Status]', err);
    return NextResponse.json({ error: getErrorMessage(err, 'Instagram status check failed') }, { status: 500 });
  }
}
