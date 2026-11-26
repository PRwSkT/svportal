import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import {
  getErrorMessage,
  isSchemaMissingError,
  requirePostAssistantAuth,
  schemaNotMigratedResponse,
} from '@/lib/post-assistant/api-helpers';

export async function GET(request: Request) {
  const auth = await requirePostAssistantAuth();
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const brand = searchParams.get('brand');
    const goldOnly = searchParams.get('gold') === 'true';
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 25));

    const admin = getAdminClient();
    let query = admin
      .from('social_posts')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (brand && ['main', 'football', 'swimming', 'tutoring'].includes(brand)) {
      query = query.eq('brand', brand);
    }
    if (goldOnly) {
      query = query.eq('is_gold_example', true);
    }

    const { data, error } = await query;
    if (error) {
      if (isSchemaMissingError(error)) return schemaNotMigratedResponse();
      throw error;
    }

    return NextResponse.json({ success: true, drafts: data || [] });
  } catch (err: unknown) {
    console.error('[PostAssistant Drafts GET]', err);
    return NextResponse.json({ error: getErrorMessage(err, 'Failed to load drafts') }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requirePostAssistantAuth();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const brand = ['main', 'football', 'swimming', 'tutoring'].includes(body?.brand)
      ? body.brand
      : 'main';
    const mediaMode = body?.media_mode === 'video' ? 'video' : 'photo';

    const admin = getAdminClient();
    const { data, error } = await admin
      .from('social_posts')
      .insert({
        brand,
        media_mode: mediaMode,
        status: 'draft',
        activity_brief: body?.activity_brief || {},
        cover_headline: body?.cover_headline ?? null,
        captions: body?.captions || {},
        media_manifest: Array.isArray(body?.media_manifest) ? body.media_manifest : [],
        target_channels: body?.target_channels || {
          facebook: true,
          instagram: brand === 'main',
          website: brand === 'main',
          websiteMode: 'publish',
        },
        created_by: auth.user.id,
        updated_by: auth.user.id,
      })
      .select('*')
      .single();

    if (error) {
      if (isSchemaMissingError(error)) return schemaNotMigratedResponse();
      throw error;
    }

    return NextResponse.json({ success: true, id: data.id, draft: data });
  } catch (err: unknown) {
    console.error('[PostAssistant Drafts POST]', err);
    return NextResponse.json({ error: getErrorMessage(err, 'Failed to create draft') }, { status: 500 });
  }
}
