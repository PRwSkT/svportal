import { getAdminClient } from '@/lib/supabase/admin';
import { getSupabasePublicObjectUrl, getSupabaseStorageAdmin } from '@/lib/supabase/storage-admin';
import { triggerWebsiteRebuild } from '@/lib/website-sync';
import { WebsitePublishPayload } from './types';

const REBUILD_COOLDOWN_MS = 15 * 60 * 1000;
let lastRebuildTriggerMs = 0;

export class SchemaNotMigratedError extends Error {
  constructor(detail: string) {
    super(
      `ฐานข้อมูลยังไม่รองรับโครงสร้าง v2 (${detail}) — กรุณารันไฟล์ supabase/deploy_20261126_post_assistant_v2.sql ใน Supabase Dashboard -> SQL Editor`
    );
    this.name = 'SchemaNotMigratedError';
  }
}

function isMissingSchemaError(err: unknown): boolean {
  const errObj = err as { code?: unknown; message?: unknown } | null;
  const code = String(errObj?.code || '');
  const msg = String(errObj?.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === '42703' ||
    code === 'PGRST204' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the')
  );
}

function assertValidWebsiteStoragePath(storagePath: string, draftId: string): string {
  const clean = storagePath.replace(/^\/+/, '');
  if (!clean.startsWith('posts/') || !clean.includes(`/${draftId}/`) || clean.includes('..')) {
    throw new Error(`Invalid website storage_path: ${storagePath}`);
  }
  return clean;
}

function buildSafeSlug(rawSlug: string | undefined, fallbackTitle: string, draftId: string): string {
  const base = (rawSlug || fallbackTitle || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  const shortSuffix = draftId.replace(/-/g, '').slice(0, 6);
  return base ? `${base}-${shortSuffix}` : `post-${shortSuffix}`;
}

export async function publishDraftToWebsite(params: {
  draftId: string;
  payload: WebsitePublishPayload;
  userId: string;
}): Promise<{
  newsId: string | null;
  albumId: string | null;
  slug: string | null;
  rebuildTriggered: boolean;
}> {
  const { draftId, payload, userId } = params;
  const admin = getAdminClient();
  const storageAdmin = getSupabaseStorageAdmin();

  if (payload.mode === 'delete') {
    const { data: existingNews } = await admin
      .from('news')
      .select('id, album_id, cover_storage_path')
      .eq('source_post_id', draftId)
      .maybeSingle();

    const { data: existingAlbum } = await admin
      .from('albums')
      .select('id, cover_storage_path')
      .eq('source_post_id', draftId)
      .maybeSingle();

    const albumId = existingAlbum?.id || existingNews?.album_id || null;
    const pathsToDelete = new Set<string>();

    if (existingNews?.cover_storage_path) pathsToDelete.add(existingNews.cover_storage_path);
    if (existingAlbum?.cover_storage_path) pathsToDelete.add(existingAlbum.cover_storage_path);

    if (albumId) {
      const { data: photoRows } = await admin
        .from('album_photos')
        .select('storage_path')
        .eq('album_id', albumId);
      for (const row of photoRows || []) {
        if (row.storage_path) pathsToDelete.add(row.storage_path);
      }
    }

    const safePaths = Array.from(pathsToDelete).filter(
      (p) => typeof p === 'string' && p.startsWith('posts/') && p.includes(`/${draftId}/`)
    );
    if (safePaths.length > 0) {
      await storageAdmin.storage.from('website-content').remove(safePaths).catch(() => {});
    }

    if (existingNews?.id) {
      await admin.from('news').delete().eq('id', existingNews.id);
    }
    if (albumId) {
      await admin.from('albums').delete().eq('id', albumId);
    }

    await admin
      .from('social_posts')
      .update({
        website_news_id: null,
        website_album_id: null,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', draftId);

    return { newsId: null, albumId: null, slug: null, rebuildTriggered: false };
  }

  const titleTh = (payload.titles?.th || '').trim();
  const titleEn = (payload.titles?.en || titleTh).trim();
  const titleZh = (payload.titles?.zh || '').trim();

  if (!titleTh || titleTh === '[object Object]') {
    throw new Error('ต้องระบุหัวข้อข่าวภาษาไทยที่ถูกต้องก่อนเผยแพร่บนเว็บไซต์');
  }

  const slug = buildSafeSlug(payload.slug_en, titleEn, draftId);
  const siteTargets =
    Array.isArray(payload.site_targets) && payload.site_targets.length > 0
      ? payload.site_targets
      : ['somkidvittaya'];

  const cleanCoverPath = payload.cover?.storage_path
    ? assertValidWebsiteStoragePath(payload.cover.storage_path, draftId)
    : null;
  const cleanOgPath = payload.cover?.og_jpeg_storage_path
    ? assertValidWebsiteStoragePath(payload.cover.og_jpeg_storage_path, draftId)
    : null;

  const coverUrl = cleanCoverPath ? getSupabasePublicObjectUrl('website-content', cleanCoverPath) : null;
  const ogImageUrl = cleanOgPath
    ? getSupabasePublicObjectUrl('website-content', cleanOgPath)
    : coverUrl;

  const galleryItems = (payload.gallery || []).map((item, idx) => {
    const cleanPath = assertValidWebsiteStoragePath(item.storage_path, draftId);
    return {
      storage_path: cleanPath,
      image_url: getSupabasePublicObjectUrl('website-content', cleanPath),
      width: item.width ?? null,
      height: item.height ?? null,
      caption_th: item.caption_th || '',
      caption_en: item.caption_en || '',
      caption_zh: item.caption_zh || '',
      sort_order: typeof item.sort_order === 'number' ? item.sort_order : idx,
    };
  });

  const videoUrl = payload.video?.storage_path
    ? getSupabasePublicObjectUrl('post-media', payload.video.storage_path.replace(/^\/+/, ''))
    : payload.video?.fb_reel_url || payload.video?.ig_reel_url || null;

  const nowIso = new Date().toISOString();
  const scheduledIso = payload.scheduled_at ? new Date(payload.scheduled_at).toISOString() : null;
  const isPublished =
    payload.mode === 'publish' ||
    (payload.mode === 'schedule' && Boolean(scheduledIso && new Date(scheduledIso) <= new Date()));
  const status = payload.mode === 'unpublish' ? 'draft' : payload.mode;

  try {
    // 1. Upsert Album if gallery photos exist
    let albumId: string | null = null;
    if (galleryItems.length > 0) {
      const { data: existingAlbum, error: albLookupErr } = await admin
        .from('albums')
        .select('id')
        .eq('source_post_id', draftId)
        .maybeSingle();
      if (albLookupErr) throw albLookupErr;

      const albumRecord = {
        title_th: titleTh,
        title_en: titleEn,
        title_zh: titleZh || null,
        description_th: (payload.excerpts?.th || payload.contents?.th || '').slice(0, 600),
        description_en: (payload.excerpts?.en || payload.contents?.en || '').slice(0, 600),
        description_zh: (payload.excerpts?.zh || payload.contents?.zh || '').slice(0, 600) || null,
        cover_image_url: coverUrl || galleryItems[0].image_url,
        cover_storage_path: cleanCoverPath || galleryItems[0].storage_path,
        event_date: payload.event_date || nowIso.split('T')[0],
        slug,
        brand: payload.brand,
        site_targets: siteTargets,
        category: payload.category || 'activity',
        is_published: isPublished,
        source_post_id: draftId,
        created_by: userId,
        updated_at: nowIso,
      };

      if (existingAlbum?.id) {
        const { error: updAlbErr } = await admin
          .from('albums')
          .update(albumRecord)
          .eq('id', existingAlbum.id);
        if (updAlbErr) throw updAlbErr;
        albumId = existingAlbum.id;
      } else {
        const { data: insertedAlb, error: insAlbErr } = await admin
          .from('albums')
          .insert(albumRecord)
          .select('id')
          .single();
        if (insAlbErr) throw insAlbErr;
        albumId = insertedAlb.id;
      }

      if (albumId) {
        await admin.from('album_photos').delete().eq('album_id', albumId);
        const { error: photoInsErr } = await admin.from('album_photos').insert(
          galleryItems.map((g) => ({
            album_id: albumId,
            image_url: g.image_url,
            storage_path: g.storage_path,
            width: g.width,
            height: g.height,
            caption_th: g.caption_th || null,
            caption_en: g.caption_en || null,
            caption_zh: g.caption_zh || null,
            sort_order: g.sort_order,
          }))
        );
        if (photoInsErr) throw photoInsErr;
      }
    }

    // 2. Upsert News record
    const { data: existingNews, error: newsLookupErr } = await admin
      .from('news')
      .select('id, published_at')
      .eq('source_post_id', draftId)
      .maybeSingle();
    if (newsLookupErr) throw newsLookupErr;

    const publishedAt =
      existingNews?.published_at ||
      (payload.mode === 'schedule' && scheduledIso ? scheduledIso : isPublished ? nowIso : null);

    const newsRecord = {
      title_th: titleTh,
      title_en: titleEn,
      title_zh: titleZh || null,
      excerpt_th: (payload.excerpts?.th || '').trim() || null,
      excerpt_en: (payload.excerpts?.en || '').trim() || null,
      excerpt_zh: (payload.excerpts?.zh || '').trim() || null,
      content_th: (payload.contents?.th || '').trim(),
      content_en: (payload.contents?.en || '').trim(),
      content_zh: (payload.contents?.zh || '').trim() || null,
      cover_image_url: coverUrl || (galleryItems[0]?.image_url ?? null),
      og_image_url: ogImageUrl,
      cover_storage_path: cleanCoverPath || (galleryItems[0]?.storage_path ?? null),
      album_id: albumId,
      slug,
      brand: payload.brand,
      site_targets: siteTargets,
      category: payload.category || 'activity',
      tags: payload.tags || [],
      seo_title: titleTh.slice(0, 120),
      seo_description: (payload.excerpts?.th || '').slice(0, 160) || null,
      status,
      scheduled_at: payload.mode === 'schedule' ? scheduledIso : null,
      is_published: isPublished,
      published_at: publishedAt,
      video_url: videoUrl,
      source: 'post_assistant',
      source_post_id: draftId,
      social_links: payload.social_links || {},
      calendar_event_id: payload.calendar_event_id || null,
      show_in_parent_portal: payload.show_in_parent_portal ?? true,
      created_by: userId,
      updated_at: nowIso,
    };

    let newsId: string;
    if (existingNews?.id) {
      const { error: updNewsErr } = await admin
        .from('news')
        .update(newsRecord)
        .eq('id', existingNews.id);
      if (updNewsErr) throw updNewsErr;
      newsId = existingNews.id;
    } else {
      const { data: insertedNews, error: insNewsErr } = await admin
        .from('news')
        .insert(newsRecord)
        .select('id')
        .single();
      if (insNewsErr) throw insNewsErr;
      newsId = insertedNews.id;
    }

    // 3. Link back to social_posts
    await admin
      .from('social_posts')
      .update({
        website_news_id: newsId,
        website_album_id: albumId,
        updated_by: userId,
        updated_at: nowIso,
      })
      .eq('id', draftId);

    // 4. Optional debounced Netlify static rebuild
    let rebuildTriggered = false;
    if (payload.trigger_static_rebuild && isPublished) {
      const now = Date.now();
      if (now - lastRebuildTriggerMs >= REBUILD_COOLDOWN_MS) {
        rebuildTriggered = await triggerWebsiteRebuild(`Post Assistant v2: ${titleEn.slice(0, 60)}`);
        if (rebuildTriggered) lastRebuildTriggerMs = now;
      }
    }

    return { newsId, albumId, slug, rebuildTriggered };
  } catch (err: unknown) {
    if (isMissingSchemaError(err)) {
      throw new SchemaNotMigratedError(err instanceof Error ? err.message : 'missing schema');
    }
    throw err;
  }
}
