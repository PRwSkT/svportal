'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  Download,
  Share2,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Star,
  Globe,
  RefreshCw,
} from 'lucide-react';

function FacebookBadgeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
    </svg>
  );
}

function InstagramBadgeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

function toErrMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
import { toast } from 'sonner';
import {
  BRAND_PROFILES,
  assembleFacebookCaption,
  assembleInstagramCaption,
} from '@/lib/post-assistant/brand-glossary';
import { safeReadJson } from '@/lib/post-assistant/client-fetch';
import {
  renderCleanOgCoverJpeg,
  renderCleanWebsiteWebP,
  renderFacebookPhotoByIndex,
  renderInstagramPhotoByIndex,
  yieldFrame,
} from '@/lib/post-assistant/canvas-renderer';
import {
  exportPostAssetsZip,
  shareImageFile,
  triggerBlobDownload,
} from '@/lib/post-assistant/zip-exporter';
import {
  ActivityBrief,
  BrandId,
  CoverHeadline,
  MediaMode,
  StructuredCaptions,
  TargetChannelsConfig,
  WebsitePublishPayload,
} from '@/lib/post-assistant/types';
import { StudioPhotoItem } from './MediaDropzoneGrid';

interface PublishDrawerModalProps {
  isOpen: boolean;
  onClose: () => void;
  draftId: string | null;
  onEnsureDraftId: () => Promise<string>;
  brand: BrandId;
  mediaMode: MediaMode;
  brief: ActivityBrief;
  photos: StudioPhotoItem[];
  videoFile: File | null;
  headline: CoverHeadline;
  captions: StructuredCaptions;
  channels: TargetChannelsConfig;
  onChangeChannels: (next: TargetChannelsConfig) => void;
  isGoldExample: boolean;
  onToggleGoldExample: (next: boolean) => Promise<void>;
  onPublishedSuccess: () => void;
  isThai: boolean;
}

type StepStatus = 'idle' | 'running' | 'done' | 'error';

async function uploadBlobViaSignedUrl(params: {
  draftId: string;
  bucket: 'website-content' | 'post-media';
  variant: 'fb' | 'ig' | 'gallery' | 'cover' | 'og' | 'video';
  blob: Blob;
  contentType: string;
}): Promise<{ storagePath: string; publicUrl: string }> {
  const mintRes = await fetch('/api/post-assistant/media/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      draftId: params.draftId,
      bucket: params.bucket,
      variant: params.variant,
      contentType: params.contentType,
      fileSizeBytes: params.blob.size,
    }),
  });
  const mintParsed = await safeReadJson<{
    data?: { signedUrl?: string; storagePath?: string; publicUrl?: string };
  }>(mintRes);
  if (!mintParsed.ok || !mintParsed.data?.data?.signedUrl) {
    throw new Error(mintParsed.errorMessage || 'Failed to get signed upload URL');
  }

  const signedData = mintParsed.data.data;
  const putRes = await fetch(signedData.signedUrl as string, {
    method: 'PUT',
    headers: {
      'Content-Type': params.contentType,
      'x-upsert': 'false',
    },
    body: params.blob,
  });

  if (!putRes.ok) {
    throw new Error(`Storage upload failed (HTTP ${putRes.status})`);
  }

  return {
    storagePath: signedData.storagePath || '',
    publicUrl: signedData.publicUrl || '',
  };
}

async function pollInstagramContainer(params: {
  containerId: string;
  draftId: string;
  maxPolls: number;
  intervalMs: number;
  mediaLabel: string;
  onProgress: (text: string) => void;
}): Promise<{ permalink?: string }> {
  const { containerId, draftId, maxPolls, intervalMs, mediaLabel, onProgress } = params;
  for (let poll = 0; poll < maxPolls; poll++) {
    onProgress(`รอ Instagram ประมวลผล${mediaLabel} (${poll + 1}/${maxPolls})...`);
    await new Promise((r) => setTimeout(r, intervalMs));
    const stRes = await fetch(
      `/api/post-assistant/publish/instagram/status?containerId=${encodeURIComponent(
        containerId
      )}&draftId=${encodeURIComponent(draftId)}`
    );
    const stParsed = await safeReadJson<{
      statusCode?: string;
      permalink?: string;
      error?: string;
    }>(stRes);
    if (!stParsed.ok && !stParsed.data) {
      throw new Error(stParsed.errorMessage || 'Failed to check Instagram status');
    }
    const stJson = stParsed.data;
    if (stJson?.statusCode === 'PUBLISHED') {
      return { permalink: stJson.permalink };
    }
    if (stJson?.statusCode === 'ERROR' || stJson?.statusCode === 'EXPIRED') {
      throw new Error(stJson.error || `Instagram failed to process ${mediaLabel}`);
    }
  }
  const timeoutSec = Math.round((maxPolls * intervalMs) / 1000);
  throw new Error(
    `Instagram ประมวลผล${mediaLabel}นานเกินกำหนด (${timeoutSec} วินาที) กรุณาลองกดเผยแพร่เฉพาะ Instagram อีกครั้ง`
  );
}

export function PublishDrawerModal({
  isOpen,
  onClose,
  draftId,
  onEnsureDraftId,
  brand,
  mediaMode,
  brief,
  photos,
  videoFile,
  headline,
  captions,
  channels,
  onChangeChannels,
  isGoldExample,
  onToggleGoldExample,
  onPublishedSuccess,
  isThai,
}: PublishDrawerModalProps) {
  const profile = BRAND_PROFILES[brand];
  const [pdpaAttested, setPdpaAttested] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [isSharingCover, setIsSharingCover] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);

  const [fbState, setFbState] = useState<StepStatus>('idle');
  const [igState, setIgState] = useState<StepStatus>('idle');
  const [webState, setWebState] = useState<StepStatus>('idle');
  const [channelError, setChannelError] = useState<Record<string, string>>({});
  const [resultLinks, setResultLinks] = useState<{ fb?: string; ig?: string; webSlug?: string }>({});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isPublishing) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, isPublishing, onClose]);

  if (!isOpen) return null;

  const activePhotos = photos.filter((p) => !p.aiRejected && !p.excluded);
  const fbCaption = assembleFacebookCaption(brand, captions.social);
  const igCaption = assembleInstagramCaption(brand, captions.social);

  const handleDownloadZip = async () => {
    if (!activePhotos.length) return;
    setIsExportingZip(true);
    try {
      const zipBlob = await exportPostAssetsZip({
        brand,
        items: activePhotos.map((p) => ({ file: p.file, focalPoint: p.focalPoint })),
        headline: profile.supportsCoverHeadline ? headline : null,
        fbCaption,
        igCaption,
        includeWebsiteCleanWebp: brand === 'main',
        onProgress: (ev) => setProgressText(ev.message),
      });
      triggerBlobDownload(zipBlob, `SomkidPost_${Date.now()}.zip`);
      toast.success(isThai ? 'ดาวน์โหลดไฟล์ .zip สำเร็จ!' : 'ZIP exported successfully!');
    } catch (err: unknown) {
      toast.error(toErrMessage(err, 'ZIP export failed'));
    } finally {
      setIsExportingZip(false);
      setProgressText('');
    }
  };

  const handleShareCover = async () => {
    if (!activePhotos.length) return;
    setIsSharingCover(true);
    try {
      const blob = await renderFacebookPhotoByIndex({
        brand,
        index: 0,
        file: activePhotos[0].file,
        headline: profile.supportsCoverHeadline ? headline : null,
        focalPoint: activePhotos[0].focalPoint,
      });
      await shareImageFile(blob, `Somkid_Cover_${Date.now()}.jpg`, brief.activityName);
    } catch (err: unknown) {
      toast.error(toErrMessage(err, 'Share failed'));
    } finally {
      setIsSharingCover(false);
    }
  };

  const runPublishFlow = async (onlyFailed?: boolean) => {
    if (!pdpaAttested) {
      toast.error(isThai ? 'กรุณาติ๊กยืนยัน PDPA ก่อนโพสต์' : 'Please attest PDPA compliance first');
      return;
    }

    setIsPublishing(true);
    setChannelError({});

    try {
      const resolvedDraftId = draftId || (await onEnsureDraftId());

      if (mediaMode === 'photo') {
        const fbTargetPhotos = activePhotos.slice(0, 20);
        const igTargetPhotos = profile.supportsInstagram ? activePhotos.slice(0, 10) : [];

        // 1. Render & direct-upload required variants with concurrency pool
        const fbPaths: string[] = [];
        const igPaths: string[] = [];
        const webGallery: WebsitePublishPayload['gallery'] = [];
        let webCover: WebsitePublishPayload['cover'] = null;

        if (channels.facebook && (!onlyFailed || fbState !== 'done')) {
          setFbState('running');
          for (let i = 0; i < fbTargetPhotos.length; i++) {
            setProgressText(`เตรียมและอัปโหลดภาพ Facebook ${i + 1}/${fbTargetPhotos.length}...`);
            const blob = await renderFacebookPhotoByIndex({
              brand,
              index: i,
              file: fbTargetPhotos[i].file,
              headline: profile.supportsCoverHeadline ? headline : null,
              focalPoint: fbTargetPhotos[i].focalPoint,
            });
            const uploaded = await uploadBlobViaSignedUrl({
              draftId: resolvedDraftId,
              bucket: 'post-media',
              variant: 'fb',
              blob,
              contentType: 'image/jpeg',
            });
            fbPaths.push(uploaded.storagePath);
            await yieldFrame();
          }

          try {
            setProgressText('กำลังเผยแพร่โพสต์บน Facebook...');
            const fbRes = await fetch('/api/post-assistant/publish/facebook', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                draftId: resolvedDraftId,
                brand,
                caption: fbCaption,
                storagePaths: fbPaths,
                pdpaAttested: true,
              }),
            });
            const fbParsed = await safeReadJson<{ permalink?: string }>(fbRes);
            if (!fbParsed.ok) throw new Error(fbParsed.errorMessage || 'Facebook publish failed');
            setFbState('done');
            setResultLinks((prev) => ({ ...prev, fb: fbParsed.data?.permalink }));
          } catch (err: unknown) {
            setFbState('error');
            setChannelError((prev) => ({ ...prev, facebook: toErrMessage(err, 'FB error') }));
          }
        }

        if (profile.supportsInstagram && channels.instagram && (!onlyFailed || igState !== 'done')) {
          setIgState('running');
          try {
            for (let i = 0; i < igTargetPhotos.length; i++) {
              setProgressText(`เตรียมและอัปโหลดภาพ Instagram ${i + 1}/${igTargetPhotos.length}...`);
              const blob = await renderInstagramPhotoByIndex({
                brand,
                index: i,
                file: igTargetPhotos[i].file,
                headline: profile.supportsCoverHeadline ? headline : null,
                focalPoint: igTargetPhotos[i].focalPoint,
              });
              if (!blob) continue;
              const uploaded = await uploadBlobViaSignedUrl({
                draftId: resolvedDraftId,
                bucket: 'post-media',
                variant: 'ig',
                blob,
                contentType: 'image/jpeg',
              });
              igPaths.push(uploaded.storagePath);
              await yieldFrame();
            }

            setProgressText('กำลังสร้าง Instagram Container...');
            const igRes = await fetch('/api/post-assistant/publish/instagram', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                draftId: resolvedDraftId,
                brand,
                caption: igCaption,
                storagePaths: igPaths,
                pdpaAttested: true,
              }),
            });
            const igParsed = await safeReadJson<{
              alreadyPublished?: boolean;
              permalink?: string;
              containerId?: string;
            }>(igRes);
            if (!igParsed.ok) throw new Error(igParsed.errorMessage || 'Instagram create failed');
            const igJson = igParsed.data;

            if (igJson?.alreadyPublished) {
              setIgState('done');
              setResultLinks((prev) => ({ ...prev, ig: igJson.permalink }));
            } else if (igJson?.containerId) {
              const igPub = await pollInstagramContainer({
                containerId: igJson.containerId,
                draftId: resolvedDraftId,
                maxPolls: 20,
                intervalMs: 2000,
                mediaLabel: 'ภาพ',
                onProgress: setProgressText,
              });
              setResultLinks((prev) => ({ ...prev, ig: igPub.permalink }));
              setIgState('done');
            } else {
              throw new Error('Missing Instagram container ID');
            }
          } catch (err: unknown) {
            setIgState('error');
            setChannelError((prev) => ({ ...prev, instagram: toErrMessage(err, 'IG error') }));
          }
        }

        if (channels.website && (!onlyFailed || webState !== 'done')) {
          setWebState('running');
          try {
            for (let i = 0; i < activePhotos.length; i++) {
              setProgressText(`ปรับภาพ WebP สะอาดสำหรับเว็บไซต์ ${i + 1}/${activePhotos.length}...`);
              const cleanWebp = await renderCleanWebsiteWebP(activePhotos[i].file);
              const uploaded = await uploadBlobViaSignedUrl({
                draftId: resolvedDraftId,
                bucket: 'website-content',
                variant: i === 0 ? 'cover' : 'gallery',
                blob: cleanWebp.blob,
                contentType: cleanWebp.mimeType,
              });
              webGallery.push({
                storage_path: uploaded.storagePath,
                width: cleanWebp.width,
                height: cleanWebp.height,
                sort_order: i,
              });
              if (i === 0) {
                const ogJpeg = await renderCleanOgCoverJpeg(
                  activePhotos[0].file,
                  activePhotos[0].focalPoint
                );
                const ogUploaded = await uploadBlobViaSignedUrl({
                  draftId: resolvedDraftId,
                  bucket: 'website-content',
                  variant: 'og',
                  blob: ogJpeg.blob,
                  contentType: 'image/jpeg',
                });
                webCover = {
                  storage_path: uploaded.storagePath,
                  og_jpeg_storage_path: ogUploaded.storagePath,
                };
              }
              await yieldFrame();
            }

            setProgressText('กำลังซิงก์ขึ้นเว็บไซต์ somkidvittaya.ac.th...');
            const payload: WebsitePublishPayload = {
              mode: channels.websiteMode || 'publish',
              scheduled_at: channels.scheduledAt || null,
              brand,
              site_targets: profile.defaultSiteTargets,
              category: captions.website.category,
              tags: captions.website.tags,
              event_date: brief.eventDate || new Date().toISOString().split('T')[0],
              slug_en: captions.website.slug_en,
              titles: {
                th: captions.website.title.th || brief.activityName,
                en: captions.website.title.en || captions.website.title.th || brief.activityName,
                zh: captions.website.title.zh || '',
              },
              excerpts: captions.website.excerpt,
              contents: captions.website.body,
              cover: webCover,
              gallery: webGallery,
              show_in_parent_portal: true,
              trigger_static_rebuild: Boolean(channels.triggerRebuild),
            };

            const webRes = await fetch('/api/post-assistant/publish/website', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                draftId: resolvedDraftId,
                payload,
                pdpaAttested: true,
              }),
            });
            const webParsed = await safeReadJson<{ data?: { slug?: string } }>(webRes);
            if (!webParsed.ok) throw new Error(webParsed.errorMessage || 'Website sync failed');
            setWebState('done');
            setResultLinks((prev) => ({ ...prev, webSlug: webParsed.data?.data?.slug }));
          } catch (err: unknown) {
            setWebState('error');
            setChannelError((prev) => ({ ...prev, website: toErrMessage(err, 'Website error') }));
          }
        }
      } else {
        // Video Mode
        if (!videoFile) throw new Error('กรุณาเลือกไฟล์วิดีโอก่อนเผยแพร่');
        setProgressText('กำลังอัปโหลดวิดีโอตรงสู่ Supabase Storage...');
        const uploadedVideo = await uploadBlobViaSignedUrl({
          draftId: resolvedDraftId,
          bucket: 'post-media',
          variant: 'video',
          blob: videoFile,
          contentType: videoFile.type || 'video/mp4',
        });

        if (channels.facebook && (!onlyFailed || fbState !== 'done')) {
          setFbState('running');
          setProgressText('กำลังเผยแพร่วิดีโอสู่ Facebook...');
          try {
            const res = await fetch('/api/post-assistant/publish/video', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                draftId: resolvedDraftId,
                brand,
                channel: 'facebook',
                storagePath: uploadedVideo.storagePath,
                caption: fbCaption,
                title: brief.activityName,
                pdpaAttested: true,
              }),
            });
            const parsed = await safeReadJson<{ permalink?: string }>(res);
            if (!parsed.ok) throw new Error(parsed.errorMessage || 'FB Video failed');
            setFbState('done');
            setResultLinks((prev) => ({ ...prev, fb: parsed.data?.permalink }));
          } catch (err: unknown) {
            setFbState('error');
            setChannelError((prev) => ({ ...prev, facebook: toErrMessage(err, 'FB video error') }));
          }
        }

        if (profile.supportsInstagram && channels.instagram && (!onlyFailed || igState !== 'done')) {
          setIgState('running');
          setProgressText('กำลังสร้าง Instagram Reels Container...');
          try {
            const res = await fetch('/api/post-assistant/publish/video', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                draftId: resolvedDraftId,
                brand,
                channel: 'instagram',
                storagePath: uploadedVideo.storagePath,
                caption: igCaption,
                pdpaAttested: true,
              }),
            });
            const parsed = await safeReadJson<{
              alreadyPublished?: boolean;
              permalink?: string;
              containerId?: string;
            }>(res);
            if (!parsed.ok) throw new Error(parsed.errorMessage || 'IG Reels failed');
            const igJson = parsed.data;
            if (igJson?.alreadyPublished) {
              setResultLinks((prev) => ({ ...prev, ig: igJson.permalink }));
              setIgState('done');
            } else if (igJson?.containerId) {
              const igPub = await pollInstagramContainer({
                containerId: igJson.containerId,
                draftId: resolvedDraftId,
                maxPolls: 40,
                intervalMs: 3000,
                mediaLabel: 'วิดีโอ Reels',
                onProgress: setProgressText,
              });
              setResultLinks((prev) => ({ ...prev, ig: igPub.permalink }));
              setIgState('done');
            } else {
              throw new Error('Missing Instagram Reels container ID');
            }
          } catch (err: unknown) {
            setIgState('error');
            setChannelError((prev) => ({ ...prev, instagram: toErrMessage(err, 'IG Reels error') }));
          }
        }

        if (channels.website && (!onlyFailed || webState !== 'done')) {
          setWebState('running');
          setProgressText('กำลังซิงก์วิดีโอขึ้นเว็บไซต์ somkidvittaya.ac.th...');
          try {
            const payload: WebsitePublishPayload = {
              mode: channels.websiteMode || 'publish',
              scheduled_at: channels.scheduledAt || null,
              brand,
              site_targets: profile.defaultSiteTargets,
              category: captions.website.category,
              tags: captions.website.tags,
              event_date: brief.eventDate || new Date().toISOString().split('T')[0],
              slug_en: captions.website.slug_en,
              titles: {
                th: captions.website.title.th || brief.activityName,
                en: captions.website.title.en || captions.website.title.th || brief.activityName,
                zh: captions.website.title.zh || '',
              },
              excerpts: captions.website.excerpt,
              contents: captions.website.body,
              cover: null,
              gallery: [],
              video: { storage_path: uploadedVideo.storagePath },
              show_in_parent_portal: true,
              trigger_static_rebuild: Boolean(channels.triggerRebuild),
            };
            const webRes = await fetch('/api/post-assistant/publish/website', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                draftId: resolvedDraftId,
                payload,
                pdpaAttested: true,
              }),
            });
            const webParsed = await safeReadJson<{ data?: { slug?: string } }>(webRes);
            if (!webParsed.ok) throw new Error(webParsed.errorMessage || 'Website video sync failed');
            setWebState('done');
            setResultLinks((prev) => ({ ...prev, webSlug: webParsed.data?.data?.slug }));
          } catch (err: unknown) {
            setWebState('error');
            setChannelError((prev) => ({ ...prev, website: toErrMessage(err, 'Website error') }));
          }
        }
      }

      onPublishedSuccess();
    } catch (err: unknown) {
      toast.error(toErrMessage(err, 'Publish failed'));
    } finally {
      setIsPublishing(false);
      setProgressText('');
    }
  };

  const hasChannelErrors = Object.keys(channelError).length > 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
      onClick={() => !isPublishing && onClose()}
    >
      <div
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90dvh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              {isThai ? 'ส่งออก & เผยแพร่โพสต์' : 'Export & Publish Post'}
            </h3>
            <p className="text-xs text-slate-500">
              {profile.labelEn} · {mediaMode === 'photo' ? `${activePhotos.length} photos` : 'Video'}
            </p>
          </div>
          <button
            type="button"
            disabled={isPublishing}
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200/70 text-slate-500 disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Quick Export Actions (ZIP + iOS Share Sheet) */}
          {mediaMode === 'photo' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={isExportingZip || activePhotos.length === 0}
                onClick={handleDownloadZip}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-45 transition-colors"
              >
                {isExportingZip ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>{isThai ? 'ดาวน์โหลดไฟล์ทั้งหมด (.zip)' : 'Download All Assets (.zip)'}</span>
              </button>
              <button
                type="button"
                disabled={isSharingCover || activePhotos.length === 0}
                onClick={handleShareCover}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-slate-100 hover:bg-slate-200 text-slate-800 disabled:opacity-45 transition-colors"
              >
                {isSharingCover ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                <span>{isThai ? 'บันทึก / แชร์ภาพปก (iOS)' : 'Save / Share Cover'}</span>
              </button>
            </div>
          )}

          {/* Target Channel Selection */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
              {isThai ? 'เลือกช่องทางที่ต้องการเผยแพร่อัตโนมัติ' : 'Select Publishing Channels'}
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
              <div className="flex items-center gap-2.5">
                <FacebookBadgeIcon className="w-4 h-4 text-[#1877F2]" />
                <div>
                  <div className="text-sm font-semibold text-slate-800">Facebook ({profile.fbPageName})</div>
                  <div className="text-[11px] text-slate-500">
                    {fbState === 'done' && (resultLinks.fb || 'เผยแพร่แล้ว')}
                    {fbState === 'error' && <span className="text-rose-600">{channelError.facebook}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {fbState === 'running' && <Loader2 className="w-4 h-4 animate-spin text-[#1B3A6B]" />}
                {fbState === 'done' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                {fbState === 'error' && <AlertCircle className="w-4 h-4 text-rose-600" />}
                <input
                  type="checkbox"
                  checked={channels.facebook}
                  onChange={(e) => onChangeChannels({ ...channels, facebook: e.target.checked })}
                  className="h-4 w-4 accent-[#1B3A6B]"
                />
              </div>
            </label>

            {profile.supportsInstagram && (
              <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
                <div className="flex items-center gap-2.5">
                  <InstagramBadgeIcon className="w-4 h-4 text-[#E4405F]" />
                  <div>
                    <div className="text-sm font-semibold text-slate-800">
                      Instagram (@{profile.igHandle})
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {igState === 'done' && (resultLinks.ig || 'เผยแพร่แล้ว')}
                      {igState === 'error' && <span className="text-rose-600">{channelError.instagram}</span>}
                      {igState === 'idle' && (mediaMode === 'photo' ? 'สูงสุด 10 รูป (4:5 JPEG)' : 'Reels MP4')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {igState === 'running' && <Loader2 className="w-4 h-4 animate-spin text-[#7B1C3E]" />}
                  {igState === 'done' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  {igState === 'error' && <AlertCircle className="w-4 h-4 text-rose-600" />}
                  <input
                    type="checkbox"
                    checked={channels.instagram}
                    onChange={(e) => onChangeChannels({ ...channels, instagram: e.target.checked })}
                    className="h-4 w-4 accent-[#7B1C3E]"
                  />
                </div>
              </label>
            )}

            <div className="p-3 rounded-xl border border-slate-200 space-y-2.5">
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <Globe className="w-4 h-4 text-[#8b1d32]" />
                  <div>
                    <div className="text-sm font-semibold text-slate-800">
                      เว็บไซต์ somkidvittaya.ac.th (ภาพสะอาด WebP)
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {webState === 'done' && `ซิงก์สำเร็จ (${resultLinks.webSlug || 'saved'})`}
                      {webState === 'error' && <span className="text-rose-600">{channelError.website}</span>}
                      {webState === 'idle' && 'ซิงก์ข่าว 3 ภาษา + อัลบั้มภาพสะอาดแบบ Real-time (ไม่เปลืองโควต้า Netlify)'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {webState === 'running' && <Loader2 className="w-4 h-4 animate-spin text-[#8b1d32]" />}
                  {webState === 'done' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  {webState === 'error' && <AlertCircle className="w-4 h-4 text-rose-600" />}
                  <input
                    type="checkbox"
                    checked={channels.website}
                    onChange={(e) => onChangeChannels({ ...channels, website: e.target.checked })}
                    className="h-4 w-4 accent-[#8b1d32]"
                  />
                </div>
              </label>

              {channels.website && (
                <div className="pl-6 flex flex-wrap items-center gap-3 pt-1 text-xs">
                  <select
                    value={channels.websiteMode}
                    onChange={(e) =>
                      onChangeChannels({
                        ...channels,
                        websiteMode: e.target.value as TargetChannelsConfig['websiteMode'],
                      })
                    }
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-800"
                  >
                    <option value="publish">{isThai ? 'เผยแพร่บนเว็บทันที' : 'Publish Immediately'}</option>
                    <option value="draft">{isThai ? 'บันทึกเป็นฉบับร่างใน CMS' : 'Save as CMS Draft'}</option>
                    <option value="schedule">{isThai ? 'ตั้งเวลาเผยแพร่' : 'Schedule Publish'}</option>
                  </select>
                  {channels.websiteMode === 'schedule' && (
                    <input
                      type="datetime-local"
                      value={channels.scheduledAt || ''}
                      onChange={(e) => onChangeChannels({ ...channels, scheduledAt: e.target.value })}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-800"
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Gold Example Toggle */}
          {draftId && (
            <button
              type="button"
              onClick={() => onToggleGoldExample(!isGoldExample)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-colors ${
                isGoldExample
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <Star className={`w-4 h-4 ${isGoldExample ? 'fill-amber-500 text-amber-500' : 'text-slate-400'}`} />
                <span>
                  {isThai
                    ? '⭐ บันทึกโพสต์นี้เป็นสไตล์ต้นแบบ (Gold Example) ให้ AI เรียนรู้'
                    : '⭐ Mark as Gold Example for AI Style Learning'}
                </span>
              </span>
              <span>{isGoldExample ? 'Active' : 'Off'}</span>
            </button>
          )}

          {/* Mandatory PDPA Attestation */}
          <label className="flex items-start gap-2.5 p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 cursor-pointer text-xs text-emerald-950">
            <input
              type="checkbox"
              checked={pdpaAttested}
              onChange={(e) => setPdpaAttested(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-emerald-700 rounded"
            />
            <div className="space-y-0.5">
              <div className="font-bold inline-flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                <span>{isThai ? 'ยืนยันความถูกต้อง PDPA ก่อนเผยแพร่ (จำเป็น)' : 'PDPA Consent Attestation (Required)'}</span>
              </div>
              <p className="text-emerald-800">
                {isThai
                  ? 'ข้าพเจ้ายืนยันว่าได้ตรวจสอบภาพและข้อความแล้ว ไม่มีนักเรียนที่ผู้ปกครองปฏิเสธ PHOTO_PUBLIC_PR หรือข้อมูลส่วนบุคคลต้องห้ามปรากฏในโพสต์นี้'
                  : 'I attest that all media and copy comply with school PDPA student photo consent rules.'}
              </p>
            </div>
          </label>

          {progressText && (
            <div className="text-xs font-medium text-[#1B3A6B] bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span>{progressText}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={isPublishing}
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-200/70 disabled:opacity-40"
          >
            {isThai ? 'ปิดหน้าต่าง' : 'Close'}
          </button>

          {hasChannelErrors && (
            <button
              type="button"
              disabled={isPublishing || !pdpaAttested}
              onClick={() => runPublishFlow(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-45"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{isThai ? 'ลองส่งเฉพาะช่องทางที่ค้าง' : 'Retry Failed Channels'}</span>
            </button>
          )}

          <button
            type="button"
            disabled={
              isPublishing ||
              !pdpaAttested ||
              (!channels.facebook && !channels.instagram && !channels.website)
            }
            onClick={() => runPublishFlow(false)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs sm:text-sm font-semibold text-white bg-[#1B3A6B] hover:bg-[#142d54] disabled:opacity-45 shadow-xs transition-colors"
          >
            {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>{isThai ? 'ยืนยันเผยแพร่ตอนนี้' : 'Publish Now'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
