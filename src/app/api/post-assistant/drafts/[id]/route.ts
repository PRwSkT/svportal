import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSupabaseStorageAdmin } from '@/lib/supabase/storage-admin';
import { extractClientIp, logServerAuditAction } from '@/lib/audit-server';
import {
  getErrorMessage,
  isSchemaMissingError,
  isValidUuid,
  requirePostAssistantAuth,
  schemaNotMigratedResponse,
} from '@/lib/post-assistant/api-helpers';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requirePostAssistantAuth();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    if (!isValidUuid(id)) {
      return NextResponse.json({ error: 'Invalid draft ID' }, { status: 400 });
    }

    const admin = getAdminClient();
    const { data, error } = await admin
      .from('social_posts')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      if (isSchemaMissingError(error)) return schemaNotMigratedResponse();
      throw error;
    }
    if (!data) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, draft: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err, 'Failed to load draft') }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requirePostAssistantAuth();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    if (!isValidUuid(id)) {
      return NextResponse.json({ error: 'Invalid draft ID' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const allowedUpdates: Record<string, unknown> = {
      updated_by: auth.user.id,
      updated_at: new Date().toISOString(),
    };

    if (['main', 'football', 'swimming', 'tutoring'].includes(body?.brand)) {
      allowedUpdates.brand = body.brand;
    }
    if (body?.media_mode === 'photo' || body?.media_mode === 'video') {
      allowedUpdates.media_mode = body.media_mode;
    }
    if (body?.activity_brief && typeof body.activity_brief === 'object') {
      allowedUpdates.activity_brief = body.activity_brief;
    }
    if (body?.cover_headline !== undefined) {
      allowedUpdates.cover_headline = body.cover_headline;
    }
    if (body?.captions && typeof body.captions === 'object') {
      allowedUpdates.captions = body.captions;
    }
    if (Array.isArray(body?.media_manifest)) {
      allowedUpdates.media_manifest = body.media_manifest;
    }
    if (body?.target_channels && typeof body.target_channels === 'object') {
      allowedUpdates.target_channels = body.target_channels;
    }
    if (typeof body?.is_gold_example === 'boolean') {
      allowedUpdates.is_gold_example = body.is_gold_example;
    }
    if (typeof body?.category === 'string') {
      allowedUpdates.category = body.category;
    }
    if (typeof body?.hook_archetype === 'string') {
      allowedUpdates.hook_archetype = body.hook_archetype;
    }

    const admin = getAdminClient();
    const { data, error } = await admin
      .from('social_posts')
      .update(allowedUpdates)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      if (isSchemaMissingError(error)) return schemaNotMigratedResponse();
      throw error;
    }
    if (!data) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, draft: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err, 'Failed to update draft') }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requirePostAssistantAuth();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    if (!isValidUuid(id)) {
      return NextResponse.json({ error: 'Invalid draft ID' }, { status: 400 });
    }

    // Best-effort cleanup of staging objects in post-media under staging/{id}/
    try {
      const storage = getSupabaseStorageAdmin();
      const { data: folders } = await storage.storage.from('post-media').list(`staging/${id}`, { limit: 100 });
      const pathsToRemove: string[] = [];
      for (const item of folders || []) {
        if (item.id) {
          pathsToRemove.push(`staging/${id}/${item.name}`);
        } else {
          const { data: nested } = await storage.storage
            .from('post-media')
            .list(`staging/${id}/${item.name}`, { limit: 100 });
          for (const file of nested || []) {
            if (file.name) pathsToRemove.push(`staging/${id}/${item.name}/${file.name}`);
          }
        }
      }
      if (pathsToRemove.length > 0) {
        await storage.storage.from('post-media').remove(pathsToRemove);
      }
    } catch {
      // Non-fatal staging cleanup
    }

    const admin = getAdminClient();
    const { data: deleted, error } = await admin
      .from('social_posts')
      .delete()
      .eq('id', id)
      .select('id, brand, status')
      .maybeSingle();

    if (error) {
      if (isSchemaMissingError(error)) return schemaNotMigratedResponse();
      throw error;
    }

    await logServerAuditAction({
      userId: auth.user.id,
      action: 'POST_ASSISTANT_DELETE_DRAFT',
      tableName: 'social_posts',
      recordId: id,
      oldValue: deleted || undefined,
      ipAddress: extractClientIp(request),
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err, 'Failed to delete draft') }, { status: 500 });
  }
}
