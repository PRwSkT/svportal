import crypto from 'node:crypto';
import { BRAND_PROFILES } from './brand-glossary';
import { BrandId } from './types';

const DEFAULT_GRAPH_VERSION = 'v22.0';
const PAGE_TOKEN_TTL_MS = 30 * 60 * 1000;

interface CachedPageToken {
  token: string;
  name: string;
  cachedAt: number;
}

const pageTokenCache = new Map<string, CachedPageToken>();

function getGraphVersion(): string {
  return (process.env.META_GRAPH_VERSION || DEFAULT_GRAPH_VERSION).trim();
}

function getSystemUserToken(): string {
  const token = (process.env.META_SYSTEM_USER_TOKEN || '').trim();
  if (!token) {
    throw new Error('META_SYSTEM_USER_TOKEN is not configured in server environment variables');
  }
  return token;
}

function getAppSecretProof(accessToken: string): string | null {
  const secret = (process.env.META_APP_SECRET || '').trim();
  if (!secret) return null;
  return crypto.createHmac('sha256', secret).update(accessToken).digest('hex');
}

export function getBrandMetaIds(brand: BrandId): { pageId: string; igId: string | null } {
  const profile = BRAND_PROFILES[brand];
  const envPageMap: Record<BrandId, string | undefined> = {
    main: process.env.META_FB_PAGE_ID_MAIN,
    football: process.env.META_FB_PAGE_ID_FOOTBALL,
    swimming: process.env.META_FB_PAGE_ID_SWIMMING,
    tutoring: process.env.META_FB_PAGE_ID_TUTORING,
  };
  const pageId = (envPageMap[brand] || profile.defaultFbPageId).trim();
  const igId =
    brand === 'main'
      ? (process.env.META_IG_BUSINESS_ID_MAIN || profile.defaultIgAccountId || '').trim() || null
      : null;
  return { pageId, igId };
}

type MetaJsonResponse = Record<string, unknown> & {
  error?: { message?: string; code?: number };
  id?: string;
  access_token?: string;
  name?: string;
  data?: { is_valid?: boolean; expires_at?: number; scopes?: string[] };
  status_code?: string;
  status?: string;
  permalink?: string;
};

async function metaFetch(url: string, init?: RequestInit): Promise<MetaJsonResponse> {
  const res = await fetch(url, {
    ...init,
    signal: init?.signal || AbortSignal.timeout(15000),
  });
  const text = await res.text();
  let json: MetaJsonResponse;
  try {
    json = JSON.parse(text) as MetaJsonResponse;
  } catch {
    throw new Error(`Meta Graph non-JSON response (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok || json?.error) {
    const msg = json?.error?.message || `HTTP ${res.status}`;
    const code = json?.error?.code ? ` (code ${json.error.code})` : '';
    throw new Error(`Meta Graph Error${code}: ${msg}`);
  }
  return json;
}

function appendAuthParams(params: URLSearchParams, accessToken: string) {
  params.set('access_token', accessToken);
  const proof = getAppSecretProof(accessToken);
  if (proof) {
    params.set('appsecret_proof', proof);
  }
}

export async function resolvePageAccessToken(brand: BrandId): Promise<{ pageId: string; pageToken: string; igId: string | null }> {
  const sysToken = getSystemUserToken();
  const version = getGraphVersion();
  const { pageId, igId } = getBrandMetaIds(brand);

  const cached = pageTokenCache.get(pageId);
  if (cached && Date.now() - cached.cachedAt < PAGE_TOKEN_TTL_MS) {
    return { pageId, pageToken: cached.token, igId };
  }

  const params = new URLSearchParams({ fields: 'access_token,name' });
  appendAuthParams(params, sysToken);

  const data = await metaFetch(`https://graph.facebook.com/${version}/${pageId}?${params.toString()}`);
  if (!data?.access_token) {
    throw new Error(`Unable to obtain Page Access Token for ${brand} (${pageId})`);
  }

  pageTokenCache.set(pageId, {
    token: data.access_token,
    name: data.name || brand,
    cachedAt: Date.now(),
  });

  return { pageId, pageToken: data.access_token, igId };
}

export async function checkMetaHealth(): Promise<{
  configured: boolean;
  healthy: boolean;
  graphVersion: string;
  appSecretProofEnabled: boolean;
  expiresAt: string | null;
  scopes: string[];
  message: string;
}> {
  const graphVersion = getGraphVersion();
  const appSecretProofEnabled = Boolean((process.env.META_APP_SECRET || '').trim());
  const rawToken = (process.env.META_SYSTEM_USER_TOKEN || '').trim();

  if (!rawToken) {
    return {
      configured: false,
      healthy: false,
      graphVersion,
      appSecretProofEnabled,
      expiresAt: null,
      scopes: [],
      message: 'META_SYSTEM_USER_TOKEN is not configured yet (ZIP download and Website Sync remain active).',
    };
  }

  try {
    const params = new URLSearchParams({
      input_token: rawToken,
    });
    appendAuthParams(params, rawToken);
    const debugRes = await metaFetch(`https://graph.facebook.com/${graphVersion}/debug_token?${params.toString()}`);
    const info = debugRes?.data || {};
    const expiresAt =
      typeof info.expires_at === 'number' && info.expires_at > 0
        ? new Date(info.expires_at * 1000).toISOString()
        : null;

    return {
      configured: true,
      healthy: Boolean(info.is_valid),
      graphVersion,
      appSecretProofEnabled,
      expiresAt,
      scopes: Array.isArray(info.scopes) ? info.scopes : [],
      message: info.is_valid ? 'Meta System User Token is valid.' : 'Meta token reported invalid.',
    };
  } catch (err: unknown) {
    return {
      configured: true,
      healthy: false,
      graphVersion,
      appSecretProofEnabled,
      expiresAt: null,
      scopes: [],
      message: err instanceof Error ? err.message : 'Failed to validate Meta token',
    };
  }
}

export async function publishFacebookPhotos(params: {
  brand: BrandId;
  imageUrls: string[];
  caption: string;
}): Promise<{ postId: string; permalink: string }> {
  const { brand, imageUrls, caption } = params;
  if (!imageUrls.length) {
    throw new Error('At least 1 image URL is required for Facebook photo post');
  }
  const { pageId, pageToken } = await resolvePageAccessToken(brand);
  const version = getGraphVersion();
  const limitedUrls = imageUrls.slice(0, 20);

  // Upload unpublished photos in batches of 5 to keep total request under Netlify timeout
  const mediaIds: string[] = [];
  for (let i = 0; i < limitedUrls.length; i += 5) {
    const batch = limitedUrls.slice(i, i + 5);
    const uploaded = await Promise.all(
      batch.map(async (url) => {
        const form = new URLSearchParams({
          url,
          published: 'false',
        });
        appendAuthParams(form, pageToken);
        const res = await metaFetch(`https://graph.facebook.com/${version}/${pageId}/photos`, {
          method: 'POST',
          body: form,
        });
        return res.id as string;
      })
    );
    mediaIds.push(...uploaded);
  }

  const feedForm = new URLSearchParams({
    message: caption,
    attached_media: JSON.stringify(mediaIds.map((id) => ({ media_fbid: id }))),
  });
  appendAuthParams(feedForm, pageToken);

  const feedRes = await metaFetch(`https://graph.facebook.com/${version}/${pageId}/feed`, {
    method: 'POST',
    body: feedForm,
  });

  const postId = String(feedRes.id);
  const permalink = `https://www.facebook.com/${postId.replace('_', '/posts/')}`;
  return { postId, permalink };
}

export async function createInstagramPhotoContainers(params: {
  brand: BrandId;
  imageUrls: string[];
  caption: string;
}): Promise<{ creationId: string; mode: 'single' | 'carousel'; igAccountId: string }> {
  if (params.brand !== 'main') {
    throw new Error('Instagram publishing is only supported for Somkidvittaya main page');
  }
  const limitedUrls = params.imageUrls.slice(0, 10);
  if (limitedUrls.length === 0) {
    throw new Error('At least 1 JPEG image URL is required for Instagram');
  }

  const { pageToken, igId } = await resolvePageAccessToken('main');
  if (!igId) {
    throw new Error('META_IG_BUSINESS_ID_MAIN is not configured');
  }
  const version = getGraphVersion();

  if (limitedUrls.length === 1) {
    const form = new URLSearchParams({
      image_url: limitedUrls[0],
      caption: params.caption,
    });
    appendAuthParams(form, pageToken);
    const res = await metaFetch(`https://graph.facebook.com/${version}/${igId}/media`, {
      method: 'POST',
      body: form,
    });
    return { creationId: String(res.id), mode: 'single', igAccountId: igId };
  }

  const childIds = await Promise.all(
    limitedUrls.map(async (url) => {
      const form = new URLSearchParams({
        image_url: url,
        is_carousel_item: 'true',
      });
      appendAuthParams(form, pageToken);
      const res = await metaFetch(`https://graph.facebook.com/${version}/${igId}/media`, {
        method: 'POST',
        body: form,
      });
      return String(res.id);
    })
  );

  const carouselForm = new URLSearchParams({
    media_type: 'CAROUSEL',
    children: childIds.join(','),
    caption: params.caption,
  });
  appendAuthParams(carouselForm, pageToken);

  const carouselRes = await metaFetch(`https://graph.facebook.com/${version}/${igId}/media`, {
    method: 'POST',
    body: carouselForm,
  });

  return { creationId: String(carouselRes.id), mode: 'carousel', igAccountId: igId };
}

export async function checkInstagramContainerStatus(containerId: string): Promise<{
  statusCode: string;
  statusDetail: string | null;
}> {
  const { pageToken } = await resolvePageAccessToken('main');
  const version = getGraphVersion();
  const params = new URLSearchParams({ fields: 'status_code,status' });
  appendAuthParams(params, pageToken);

  const res = await metaFetch(`https://graph.facebook.com/${version}/${containerId}?${params.toString()}`);
  return {
    statusCode: String(res.status_code || 'IN_PROGRESS'),
    statusDetail: res.status || null,
  };
}

export async function publishInstagramContainer(containerId: string): Promise<{
  mediaId: string;
  permalink: string | null;
}> {
  const { pageToken, igId } = await resolvePageAccessToken('main');
  if (!igId) {
    throw new Error('META_IG_BUSINESS_ID_MAIN is not configured');
  }
  const version = getGraphVersion();

  const form = new URLSearchParams({
    creation_id: containerId,
  });
  appendAuthParams(form, pageToken);

  const pubRes = await metaFetch(`https://graph.facebook.com/${version}/${igId}/media_publish`, {
    method: 'POST',
    body: form,
  });
  const mediaId = String(pubRes.id);

  let permalink: string | null = null;
  try {
    const pParams = new URLSearchParams({ fields: 'permalink' });
    appendAuthParams(pParams, pageToken);
    const pRes = await metaFetch(`https://graph.facebook.com/${version}/${mediaId}?${pParams.toString()}`);
    permalink = pRes.permalink || null;
  } catch {
    // non-fatal
  }

  return { mediaId, permalink };
}

export async function publishFacebookVideoByUrl(params: {
  brand: BrandId;
  videoUrl: string;
  caption: string;
  title?: string;
}): Promise<{ postId: string; permalink: string }> {
  const { pageId, pageToken } = await resolvePageAccessToken(params.brand);
  const version = getGraphVersion();

  const form = new URLSearchParams({
    file_url: params.videoUrl,
    description: params.caption,
  });
  if (params.title) {
    form.set('title', params.title.slice(0, 200));
  }
  appendAuthParams(form, pageToken);

  const res = await metaFetch(`https://graph-video.facebook.com/${version}/${pageId}/videos`, {
    method: 'POST',
    body: form,
  });

  const videoId = String(res.id);
  return {
    postId: videoId,
    permalink: `https://www.facebook.com/${pageId}/videos/${videoId}`,
  };
}

export async function createInstagramReelByUrl(params: {
  brand: BrandId;
  videoUrl: string;
  caption: string;
}): Promise<{ containerId: string }> {
  if (params.brand !== 'main') {
    throw new Error('Instagram Reels are only supported for Somkidvittaya main page');
  }
  const { pageToken, igId } = await resolvePageAccessToken('main');
  if (!igId) {
    throw new Error('META_IG_BUSINESS_ID_MAIN is not configured');
  }
  const version = getGraphVersion();

  const form = new URLSearchParams({
    media_type: 'REELS',
    video_url: params.videoUrl,
    caption: params.caption,
    share_to_feed: 'true',
  });
  appendAuthParams(form, pageToken);

  const res = await metaFetch(`https://graph.facebook.com/${version}/${igId}/media`, {
    method: 'POST',
    body: form,
  });

  return { containerId: String(res.id) };
}
