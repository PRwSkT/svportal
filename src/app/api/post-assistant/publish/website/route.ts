import { NextResponse } from 'next/server';
import { extractClientIp, logServerAuditAction } from '@/lib/audit-server';
import {
  publishDraftToWebsite,
  SchemaNotMigratedError,
} from '@/lib/post-assistant/website-publisher';
import { getErrorMessage, isValidUuid, requirePostAssistantAuth } from '@/lib/post-assistant/api-helpers';
import { WebsitePublishPayload } from '@/lib/post-assistant/types';

export async function POST(request: Request) {
  const auth = await requirePostAssistantAuth();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const draftId = body?.draftId;
    const payload = body?.payload as WebsitePublishPayload | undefined;
    const pdpaAttested = body?.pdpaAttested === true;

    if (!isValidUuid(draftId) || !payload) {
      return NextResponse.json({ error: 'Valid draftId and payload are required' }, { status: 400 });
    }

    const isNonPublicAction = payload.mode === 'draft' || payload.mode === 'delete' || payload.mode === 'unpublish';
    if (!isNonPublicAction && !pdpaAttested) {
      return NextResponse.json({ error: 'ต้องยืนยันการตรวจสอบ PDPA ก่อนเผยแพร่ขึ้นเว็บไซต์' }, { status: 400 });
    }

    const result = await publishDraftToWebsite({
      draftId,
      payload,
      userId: auth.user.id,
    });

    await logServerAuditAction({
      userId: auth.user.id,
      action: `POST_ASSISTANT_WEBSITE_${payload.mode.toUpperCase()}`,
      tableName: 'news',
      recordId: result.newsId || draftId,
      newValue: {
        draft_id: draftId,
        album_id: result.albumId,
        slug: result.slug,
        mode: payload.mode,
        rebuild_triggered: result.rebuildTriggered,
      },
      ipAddress: extractClientIp(request),
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err: unknown) {
    if (err instanceof SchemaNotMigratedError) {
      return NextResponse.json({ error: err.message, code: 'SCHEMA_NOT_MIGRATED' }, { status: 503 });
    }
    console.error('[PostAssistant Publish Website]', err);
    return NextResponse.json({ error: getErrorMessage(err, 'Website publish failed') }, { status: 500 });
  }
}
