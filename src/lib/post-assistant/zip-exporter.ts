'use client';

import { zipSync, strToU8 } from 'fflate';
import {
  renderFacebookPhotoByIndex,
  renderInstagramPhotoByIndex,
  renderCleanWebsiteWebP,
  yieldFrame,
} from './canvas-renderer';
import { BRAND_PROFILES } from './brand-glossary';
import { BrandId, CoverHeadline, FocalPoint } from './types';

export interface ZipPhotoItem {
  file: Blob;
  focalPoint: FocalPoint;
}

export interface ZipProgressEvent {
  current: number;
  total: number;
  message: string;
}

function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
  return blob.arrayBuffer().then((buf) => new Uint8Array(buf));
}

export async function exportPostAssetsZip(params: {
  brand: BrandId;
  items: ZipPhotoItem[];
  headline: CoverHeadline | null;
  fbCaption: string;
  igCaption: string;
  includeWebsiteCleanWebp?: boolean;
  onProgress?: (ev: ZipProgressEvent) => void;
}): Promise<Blob> {
  const { brand, items, headline, fbCaption, igCaption, includeWebsiteCleanWebp = true, onProgress } = params;
  const profile = BRAND_PROFILES[brand];
  const cappedItems = items.slice(0, 100);
  const filesMap: Record<string, Uint8Array> = {};

  for (let i = 0; i < cappedItems.length; i++) {
    const item = cappedItems[i];
    const num = String(i + 1).padStart(2, '0');
    onProgress?.({
      current: i + 1,
      total: cappedItems.length,
      message: `กำลังเตรียมภาพที่ ${i + 1} จาก ${cappedItems.length}...`,
    });

    const fbBlob = await renderFacebookPhotoByIndex({
      brand,
      index: i,
      file: item.file,
      headline,
      focalPoint: item.focalPoint,
    });
    const fbBytes = await blobToUint8Array(fbBlob);
    filesMap[`1_Facebook_Set/${num}_${i === 0 ? 'FB_Cover' : 'FB_Photo'}.jpg`] = fbBytes;

    if (profile.supportsInstagram && i < 10) {
      const igBlob = await renderInstagramPhotoByIndex({
        brand,
        index: i,
        file: item.file,
        headline,
        focalPoint: item.focalPoint,
      });
      if (igBlob) {
        filesMap[`2_Instagram_Set/${num}_${i === 0 ? 'IG_Cover' : 'IG_Photo'}.jpg`] =
          await blobToUint8Array(igBlob);
      }
    }

    if (includeWebsiteCleanWebp) {
      const cleanWebp = await renderCleanWebsiteWebP(item.file);
      const ext = cleanWebp.mimeType === 'image/jpeg' ? 'jpg' : 'webp';
      filesMap[`3_Website_Clean_WebP/${num}_Website.${ext}`] = await blobToUint8Array(cleanWebp.blob);
    }

    await yieldFrame();
  }

  const captionSummary = profile.supportsInstagram && igCaption.trim()
    ? `=== FACEBOOK CAPTION ===\n\n${fbCaption.trim()}\n\n\n=== INSTAGRAM CAPTION ===\n\n${igCaption.trim()}\n`
    : `${fbCaption.trim()}\n`;

  filesMap['caption.txt'] = strToU8(captionSummary);

  // Level 0 (STORE) is 10x faster and uses minimal RAM because JPEG/WebP are already compressed
  const zipped = zipSync(filesMap, { level: 0 });
  const bufferCopy = new ArrayBuffer(zipped.byteLength);
  new Uint8Array(bufferCopy).set(zipped);
  return new Blob([bufferCopy], { type: 'application/zip' });
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1500);
}

/**
 * Mobile / iOS-friendly Share Sheet fallback for saving cover or image blobs directly to Photos.
 */
export async function shareImageFile(blob: Blob, filename: string, title?: string): Promise<boolean> {
  const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });
  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        title: title || filename,
        files: [file],
      });
      return true;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return false;
    }
  }
  triggerBlobDownload(blob, filename);
  return true;
}
