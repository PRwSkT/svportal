'use client';

import { BRAND_PROFILES, HeadlineLineSpec } from './brand-glossary';
import { BrandId, CoverHeadline, FocalPoint } from './types';

const overlayImageCache = new Map<string, Promise<HTMLImageElement | null>>();
let fontReadyPromise: Promise<void> | null = null;

function ensureFontsReady(): Promise<void> {
  if (!fontReadyPromise && typeof document !== 'undefined' && document.fonts?.ready) {
    fontReadyPromise = document.fonts.ready.then(() => undefined).catch(() => undefined);
  }
  return fontReadyPromise || Promise.resolve();
}

function loadOverlayImage(url: string | null): Promise<HTMLImageElement | null> {
  if (!url || typeof window === 'undefined') return Promise.resolve(null);
  const existing = overlayImageCache.get(url);
  if (existing) return existing;

  const promise = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
  overlayImageCache.set(url, promise);
  return promise;
}

function yieldFrame(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function fitAndDrawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  basePx: number,
  weight: HeadlineLineSpec['weight'],
  maxWidth: number
) {
  if (!text) return;
  const family = "'Sukhumvit Set', 'DM Sans', sans-serif";
  let size = basePx;
  ctx.font = `${weight} ${size}px ${family}`;
  while (ctx.measureText(text).width > maxWidth && size > 24) {
    size -= 1;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  ctx.fillText(text, x, y);
}

async function decodeImageSource(file: Blob): Promise<{
  width: number;
  height: number;
  drawTo: (ctx: CanvasRenderingContext2D, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number) => void;
  cleanup: () => void;
}> {
  if (typeof createImageBitmap === 'function') {
    const bmp = await createImageBitmap(file);
    return {
      width: bmp.width,
      height: bmp.height,
      drawTo: (ctx, sx, sy, sw, sh, dx, dy, dw, dh) => ctx.drawImage(bmp, sx, sy, sw, sh, dx, dy, dw, dh),
      cleanup: () => {
        try {
          bmp.close();
        } catch {
          // ignore
        }
      },
    };
  }

  const objUrl = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Failed to decode image'));
    el.src = objUrl;
  });
  return {
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
    drawTo: (ctx, sx, sy, sw, sh, dx, dy, dw, dh) => ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh),
    cleanup: () => URL.revokeObjectURL(objUrl),
  };
}

function computeCoverSourceCrop(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
  focalPoint?: FocalPoint
): { sx: number; sy: number; sw: number; sh: number } {
  const fx = Math.max(0, Math.min(1, focalPoint?.x ?? 0.5));
  const fy = Math.max(0, Math.min(1, focalPoint?.y ?? 0.5));

  const srcAspect = srcW / srcH;
  const dstAspect = dstW / dstH;

  let sw = srcW;
  let sh = srcH;

  if (srcAspect > dstAspect) {
    // Source is wider than target; crop horizontally around fx
    sw = srcH * dstAspect;
    sh = srcH;
  } else {
    // Source is taller than target; crop vertically around fy
    sw = srcW;
    sh = srcW / dstAspect;
  }

  const maxOffsetX = Math.max(0, srcW - sw);
  const maxOffsetY = Math.max(0, srcH - sh);
  const sx = Math.max(0, Math.min(maxOffsetX, fx * srcW - sw / 2));
  const sy = Math.max(0, Math.min(maxOffsetY, fy * srcH - sh / 2));

  return { sx, sy, sw, sh };
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          if (mime === 'image/webp') {
            canvas.toBlob(
              (fallbackBlob) => {
                if (fallbackBlob) resolve(fallbackBlob);
                else reject(new Error('Canvas encoding returned empty blob'));
              },
              'image/jpeg',
              quality
            );
            return;
          }
          reject(new Error('Canvas encoding returned empty blob'));
          return;
        }
        resolve(blob);
      },
      mime,
      quality
    );
  });
}

function resetCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
}

async function renderBrandedCanvas(params: {
  file: Blob;
  targetW: number;
  targetH: number;
  overlayUrl: string | null;
  headline: CoverHeadline | null;
  coords: [HeadlineLineSpec, HeadlineLineSpec, HeadlineLineSpec] | null;
  focalPoint?: FocalPoint;
  quality?: number;
}): Promise<Blob> {
  await ensureFontsReady();
  const [src, overlayImg] = await Promise.all([
    decodeImageSource(params.file),
    loadOverlayImage(params.overlayUrl),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = params.targetW;
  canvas.height = params.targetH;

  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    const { sx, sy, sw, sh } = computeCoverSourceCrop(
      src.width,
      src.height,
      params.targetW,
      params.targetH,
      params.focalPoint
    );
    src.drawTo(ctx, sx, sy, sw, sh, 0, 0, params.targetW, params.targetH);

    if (overlayImg) {
      ctx.drawImage(overlayImg, 0, 0, params.targetW, params.targetH);
    }

    if (params.headline && params.coords) {
      ctx.fillStyle = '#e6e6d7';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      const leftMost = Math.min(params.coords[0].x, params.coords[1].x, params.coords[2].x);
      const sharedMaxWidth = params.targetW - leftMost - 80;
      fitAndDrawText(ctx, params.headline.headline || '', params.coords[0].x, params.coords[0].y, params.coords[0].size, params.coords[0].weight, sharedMaxWidth);
      fitAndDrawText(ctx, params.headline.subhead || '', params.coords[1].x, params.coords[1].y, params.coords[1].size, params.coords[1].weight, sharedMaxWidth);
      fitAndDrawText(ctx, params.headline.detail || '', params.coords[2].x, params.coords[2].y, params.coords[2].size, params.coords[2].weight, sharedMaxWidth);
    }

    return await canvasToBlob(canvas, 'image/jpeg', params.quality ?? 0.8);
  } finally {
    src.cleanup();
    resetCanvas(canvas);
  }
}

/**
 * Generates a 512px JPEG thumbnail (q=0.72) as base64 (without data URI prefix) for Gemini Vision analysis.
 */
export async function renderAiThumbnail(file: Blob): Promise<string> {
  const src = await decodeImageSource(file);
  const maxDim = 512;
  const scale = Math.min(1, maxDim / Math.max(src.width, src.height));
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;

  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    src.drawTo(ctx, 0, 0, src.width, src.height, 0, 0, w, h);
    const blob = await canvasToBlob(canvas, 'image/jpeg', 0.72);
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to encode thumbnail'));
      reader.readAsDataURL(blob);
    });
    return dataUrl.split(',')[1] || '';
  } finally {
    src.cleanup();
    resetCanvas(canvas);
  }
}

export async function renderBrandCoverPreviews(params: {
  brand: BrandId;
  file: Blob;
  headline: CoverHeadline | null;
  focalPoint?: FocalPoint;
}): Promise<{ fbBlob: Blob; igBlob: Blob | null }> {
  const profile = BRAND_PROFILES[params.brand];
  const fbBlob = await renderBrandedCanvas({
    file: params.file,
    targetW: 2160,
    targetH: 2160,
    overlayUrl: profile.overlays.coverFb,
    headline: profile.supportsCoverHeadline ? params.headline : null,
    coords: profile.headlineCoords.fb,
    focalPoint: params.focalPoint,
  });

  await yieldFrame();

  let igBlob: Blob | null = null;
  if (profile.supportsInstagram && profile.overlays.coverIg) {
    igBlob = await renderBrandedCanvas({
      file: params.file,
      targetW: 2048,
      targetH: 2560,
      overlayUrl: profile.overlays.coverIg,
      headline: profile.supportsCoverHeadline ? params.headline : null,
      coords: profile.headlineCoords.ig,
      focalPoint: params.focalPoint,
    });
  }

  return { fbBlob, igBlob };
}

export async function renderFacebookPhotoByIndex(params: {
  brand: BrandId;
  index: number;
  file: Blob;
  headline: CoverHeadline | null;
  focalPoint?: FocalPoint;
}): Promise<Blob> {
  const profile = BRAND_PROFILES[params.brand];
  if (params.index === 0) {
    return renderBrandedCanvas({
      file: params.file,
      targetW: 2160,
      targetH: 2160,
      overlayUrl: profile.overlays.coverFb,
      headline: profile.supportsCoverHeadline ? params.headline : null,
      coords: profile.headlineCoords.fb,
      focalPoint: params.focalPoint,
    });
  }

  // Sub-photos #2-#5 forced 1:1; #6+ orientation-adaptive (4:3 landscape / 4:5 portrait)
  const src = await decodeImageSource(params.file);
  const isLandscape = src.width >= src.height;
  src.cleanup();

  if (params.index <= 4) {
    return renderBrandedCanvas({
      file: params.file,
      targetW: 2160,
      targetH: 2160,
      overlayUrl: profile.overlays.sub1x1,
      headline: null,
      coords: null,
      focalPoint: params.focalPoint,
    });
  }

  if (isLandscape) {
    return renderBrandedCanvas({
      file: params.file,
      targetW: 2160,
      targetH: 1620,
      overlayUrl: profile.overlays.sub4x3,
      headline: null,
      coords: null,
      focalPoint: params.focalPoint,
    });
  }

  return renderBrandedCanvas({
    file: params.file,
    targetW: 2048,
    targetH: 2560,
    overlayUrl: profile.overlays.sub4x5,
    headline: null,
    coords: null,
    focalPoint: params.focalPoint,
  });
}

export async function renderInstagramPhotoByIndex(params: {
  brand: BrandId;
  index: number;
  file: Blob;
  headline: CoverHeadline | null;
  focalPoint?: FocalPoint;
}): Promise<Blob | null> {
  const profile = BRAND_PROFILES[params.brand];
  if (!profile.supportsInstagram) return null;

  if (params.index === 0 && profile.overlays.coverIg) {
    return renderBrandedCanvas({
      file: params.file,
      targetW: 2048,
      targetH: 2560,
      overlayUrl: profile.overlays.coverIg,
      headline: profile.supportsCoverHeadline ? params.headline : null,
      coords: profile.headlineCoords.ig,
      focalPoint: params.focalPoint,
    });
  }

  return renderBrandedCanvas({
    file: params.file,
    targetW: 2048,
    targetH: 2560,
    overlayUrl: profile.overlays.sub4x5,
    headline: null,
    coords: null,
    focalPoint: params.focalPoint,
  });
}

/**
 * Renders a clean, unwatermarked WebP image (<=1600px, q=0.84, EXIF stripped)
 * for somkidvittaya.ac.th gallery & news storage.
 */
export async function renderCleanWebsiteWebP(
  file: Blob
): Promise<{ blob: Blob; width: number; height: number; mimeType: string }> {
  const src = await decodeImageSource(file);
  const maxDim = 1600;
  const scale = Math.min(1, maxDim / Math.max(src.width, src.height));
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;

  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    src.drawTo(ctx, 0, 0, src.width, src.height, 0, 0, w, h);
    const blob = await canvasToBlob(canvas, 'image/webp', 0.84);
    return { blob, width: w, height: h, mimeType: blob.type || 'image/webp' };
  } finally {
    src.cleanup();
    resetCanvas(canvas);
  }
}

/**
 * Renders a clean, unwatermarked 1200px JPEG cover for universal Open Graph (LINE / FB scrapers).
 */
export async function renderCleanOgCoverJpeg(
  file: Blob,
  focalPoint?: FocalPoint
): Promise<{ blob: Blob; width: number; height: number }> {
  const src = await decodeImageSource(file);
  const targetW = 1200;
  const targetH = 630;
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;

  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    const { sx, sy, sw, sh } = computeCoverSourceCrop(
      src.width,
      src.height,
      targetW,
      targetH,
      focalPoint
    );
    src.drawTo(ctx, sx, sy, sw, sh, 0, 0, targetW, targetH);
    const blob = await canvasToBlob(canvas, 'image/jpeg', 0.86);
    return { blob, width: targetW, height: targetH };
  } finally {
    src.cleanup();
    resetCanvas(canvas);
  }
}

export async function getImageDimensions(file: Blob): Promise<{ width: number; height: number }> {
  const src = await decodeImageSource(file);
  const dims = { width: src.width, height: src.height };
  src.cleanup();
  return dims;
}

export { yieldFrame };
