'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Send, Download, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  BRAND_PROFILES,
  CAPTION_TONES,
  assembleFacebookCaption,
  assembleInstagramCaption,
} from '@/lib/post-assistant/brand-glossary';
import {
  renderAiThumbnail,
  renderBrandCoverPreviews,
} from '@/lib/post-assistant/canvas-renderer';
import {
  clearLocalAutosave,
  loadLocalAutosave,
  saveLocalAutosave,
} from '@/lib/post-assistant/draft-storage';
import { exportPostAssetsZip, triggerBlobDownload } from '@/lib/post-assistant/zip-exporter';
import {
  AIGenerateResponse,
  ActivityBrief,
  BrandId,
  CoverHeadline,
  FocalPoint,
  MediaMode,
  RefinePreset,
  SocialPostRecord,
  StructuredCaptions,
  TargetChannelsConfig,
} from '@/lib/post-assistant/types';
import { BrandAndModeBar, MetaHealthStatus } from './BrandAndModeBar';
import { ActivityBriefForm } from './ActivityBriefForm';
import { MediaDropzoneGrid, StudioPhotoItem } from './MediaDropzoneGrid';
import { CoverPreviewEditor } from './CoverPreviewEditor';
import { StructuredCaptionEditor } from './StructuredCaptionEditor';
import { PublishDrawerModal } from './PublishDrawerModal';
import { DraftHistoryDrawer } from './DraftHistoryDrawer';

function createEmptyBrief(): ActivityBrief {
  return {
    activityName: '',
    eventDate: '',
    studentGroup: '',
    activityTypes: [],
    details: '',
    objective: '',
    desiredHashtags: '',
    tone: CAPTION_TONES[0].value,
  };
}

function createEmptyHeadline(): CoverHeadline {
  return {
    headline: 'SOMKIDVITTAYA SCHOOL',
    subhead: 'Learning Beyond the Classroom',
    detail: 'Somkidvittaya School, Rayong',
  };
}

function createEmptyCaptions(): StructuredCaptions {
  return {
    social: {
      fb_th: '',
      fb_en: '',
      fb_zh: '',
      ig_en: '',
      hashtags: ['#Somkidvittaya', '#SomkidvittayaSchool'],
      signature_en: 'Experience creates confidence.',
    },
    website: {
      title: { th: '', en: '', zh: '' },
      excerpt: { th: '', en: '', zh: '' },
      body: { th: '', en: '', zh: '' },
      category: 'activity',
      tags: [],
      slug_en: '',
    },
    hook_alternatives: [],
    observed_micro_moments: [],
    cover_reason_th: '',
    grade_warnings: [],
  };
}

function defaultChannelsForBrand(brand: BrandId): TargetChannelsConfig {
  const profile = BRAND_PROFILES[brand];
  return {
    facebook: true,
    instagram: profile.supportsInstagram,
    website: profile.supportsWebsiteDefault,
    websiteMode: 'publish',
    scheduledAt: null,
    triggerRebuild: false,
  };
}

export function PostAssistantStudio() {
  const { isThai } = useLanguage();

  const [draftId, setDraftId] = useState<string | null>(null);
  const [brand, setBrand] = useState<BrandId>('main');
  const [mediaMode, setMediaMode] = useState<MediaMode>('photo');
  const [brief, setBrief] = useState<ActivityBrief>(createEmptyBrief);
  const [coverHeadline, setCoverHeadline] = useState<CoverHeadline>(createEmptyHeadline);
  const [captions, setCaptions] = useState<StructuredCaptions>(createEmptyCaptions);
  const [channels, setChannels] = useState<TargetChannelsConfig>(() => defaultChannelsForBrand('main'));
  const [isGoldExample, setIsGoldExample] = useState(false);

  const [photos, setPhotos] = useState<StudioPhotoItem[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);

  const [enableResearch, setEnableResearch] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [refiningPreset, setRefiningPreset] = useState<RefinePreset | null>(null);
  const [aiResultMeta, setAiResultMeta] = useState<{
    coverReasonTh?: string;
    observedMoments?: string[];
    quality?: AIGenerateResponse['quality'];
    gradeWarnings?: string[];
  }>({});

  const [fbPreviewUrl, setFbPreviewUrl] = useState<string | null>(null);
  const [igPreviewUrl, setIgPreviewUrl] = useState<string | null>(null);
  const [isRenderingCovers, setIsRenderingCovers] = useState(false);

  const [metaHealth, setMetaHealth] = useState<MetaHealthStatus | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const [mobilePane, setMobilePane] = useState<'compose' | 'preview'>('compose');
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isQuickZipExporting, setIsQuickZipExporting] = useState(false);

  const photosRef = useRef<StudioPhotoItem[]>([]);
  const videoUrlRef = useRef<string | null>(null);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    videoUrlRef.current = videoPreviewUrl;
  }, [videoPreviewUrl]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      for (const p of photosRef.current) URL.revokeObjectURL(p.previewUrl);
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
    };
  }, []);

  // Load Meta API health & restore IndexedDB autosave
  useEffect(() => {
    fetch('/api/post-assistant/meta/health')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data) setMetaHealth(json.data);
      })
      .catch(() => {});

    loadLocalAutosave().then((snap) => {
      if (!snap) return;
      const hasContent =
        Boolean(snap.brief?.activityName?.trim()) ||
        Boolean(snap.captions?.social?.fb_th?.trim());
      if (!hasContent) return;
      setDraftId(snap.draftId || null);
      setBrand(snap.brand || 'main');
      setMediaMode(snap.mediaMode || 'photo');
      setBrief(snap.brief || createEmptyBrief());
      setCoverHeadline(snap.coverHeadline || createEmptyHeadline());
      setCaptions(snap.captions || createEmptyCaptions());
      setChannels(snap.targetChannels || defaultChannelsForBrand(snap.brand || 'main'));
      toast.info('กู้คืนร่างล่าสุดจากอุปกรณ์อัตโนมัติแล้ว (กรุณาเลือกรูปใหม่หากเพิ่งรีเฟรช)');
    });
  }, []);

  // Autosave to IndexedDB + Supabase draft (debounced)
  useEffect(() => {
    const timer = setTimeout(async () => {
      const hasAnyInput =
        Boolean(brief.activityName.trim()) ||
        Boolean(captions.social.fb_th.trim());
      if (!hasAnyInput) return;

      const nowStr = new Date().toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
      });

      await saveLocalAutosave({
        draftId,
        brand,
        mediaMode,
        brief,
        coverHeadline,
        captions,
        targetChannels: channels,
        savedAt: nowStr,
      });
      setLastSavedAt(nowStr);

      if (draftId) {
        setIsSavingDraft(true);
        fetch(`/api/post-assistant/drafts/${draftId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brand,
            media_mode: mediaMode,
            activity_brief: brief,
            cover_headline: coverHeadline,
            captions,
            target_channels: channels,
          }),
        })
          .catch(() => {})
          .finally(() => setIsSavingDraft(false));
      }
    }, 900);

    return () => clearTimeout(timer);
  }, [draftId, brand, mediaMode, brief, coverHeadline, captions, channels]);

  // Live debounced cover preview rendering
  const activePhotos = useMemo(
    () => photos.filter((p) => !p.aiRejected && !p.excluded),
    [photos]
  );
  const leadPhoto = activePhotos[0] || null;

  useEffect(() => {
    if (mediaMode !== 'photo' || !leadPhoto) {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsRenderingCovers(true);
      try {
        const { fbBlob, igBlob } = await renderBrandCoverPreviews({
          brand,
          file: leadPhoto.file,
          headline: BRAND_PROFILES[brand].supportsCoverHeadline ? coverHeadline : null,
          focalPoint: leadPhoto.focalPoint,
        });
        if (cancelled) return;
        const nextFbUrl = URL.createObjectURL(fbBlob);
        const nextIgUrl = igBlob ? URL.createObjectURL(igBlob) : null;
        setFbPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return nextFbUrl;
        });
        setIgPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return nextIgUrl;
        });
      } catch {
        // non-fatal preview render issue
      } finally {
        if (!cancelled) setIsRenderingCovers(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [brand, mediaMode, leadPhoto, coverHeadline]);

  const effectiveFbPreviewUrl = mediaMode === 'photo' && leadPhoto ? fbPreviewUrl : null;
  const effectiveIgPreviewUrl = mediaMode === 'photo' && leadPhoto ? igPreviewUrl : null;

  const ensureDraftId = useCallback(async (): Promise<string> => {
    if (draftId) return draftId;
    const res = await fetch('/api/post-assistant/drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand,
        media_mode: mediaMode,
        activity_brief: brief,
        cover_headline: coverHeadline,
        captions,
        target_channels: channels,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json?.id) {
      throw new Error(json?.error || 'Failed to create server draft');
    }
    setDraftId(json.id);
    return json.id as string;
  }, [draftId, brand, mediaMode, brief, coverHeadline, captions, channels]);

  const handleSelectBrand = (nextBrand: BrandId) => {
    setBrand(nextBrand);
    setChannels(defaultChannelsForBrand(nextBrand));
  };

  const handleAddPhotos = (files: File[]) => {
    const newItems: StudioPhotoItem[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      excluded: false,
      aiRejected: false,
      focalPoint: { x: 0.5, y: 0.5 },
    }));
    setPhotos((prev) => [...prev, ...newItems]);
  };

  const handleReplacePhotos = (files: File[]) => {
    setPhotos((prev) => {
      for (const p of prev) URL.revokeObjectURL(p.previewUrl);
      return files.map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        excluded: false,
        aiRejected: false,
        focalPoint: { x: 0.5, y: 0.5 },
      }));
    });
  };

  const handleSelectVideo = (file: File | null) => {
    setVideoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
    setVideoFile(file);
  };

  const handlePromoteCover = (id: string) => {
    setPhotos((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx <= 0) return prev;
      const target = { ...prev[idx], excluded: false, aiRejected: false };
      const rest = prev.filter((p) => p.id !== id);
      return [target, ...rest];
    });
  };

  const handleMovePhoto = (id: string, dir: -1 | 1) => {
    setPhotos((prev) => {
      const visible = prev.filter((p) => !p.aiRejected);
      const rejected = prev.filter((p) => p.aiRejected);
      const idx = visible.findIndex((p) => p.id === id);
      const swapIdx = idx + dir;
      if (idx < 0 || swapIdx < 0 || swapIdx >= visible.length) return prev;
      const copy = [...visible];
      [copy[idx], copy[swapIdx]] = [copy[swapIdx], copy[idx]];
      return [...copy, ...rejected];
    });
  };

  const handleToggleExclude = (id: string) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, excluded: !p.excluded } : p))
    );
  };

  const handleRestoreRejected = (id: string) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, aiRejected: false, excluded: false } : p))
    );
  };

  const handleRemovePhoto = (id: string) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

  const handleUpdateFocalPoint = (id: string, fp: FocalPoint) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, focalPoint: fp } : p))
    );
  };

  const handleGenerate = async () => {
    if (!brief.activityName.trim()) {
      toast.error(isThai ? 'กรุณากรอกชื่อกิจกรรม' : 'Please enter an activity name');
      return;
    }

    setIsGenerating(true);
    try {
      let currentDraftId = draftId;
      if (!currentDraftId) {
        try {
          currentDraftId = await ensureDraftId();
        } catch {
          // Graceful: allow AI generation even before DB migration
        }
      }

      // Diverse sampling up to 25 photos rendered to 512px thumbnails
      const candidatePhotos = photos.filter((p) => !p.excluded);
      let sampledIndices: number[] = [];
      const MAX_AI = 25;
      if (candidatePhotos.length <= MAX_AI) {
        sampledIndices = candidatePhotos.map((_, i) => i);
      } else {
        const step = (candidatePhotos.length - 1) / (MAX_AI - 1);
        const set = new Set<number>();
        for (let i = 0; i < MAX_AI; i++) set.add(Math.round(i * step));
        sampledIndices = Array.from(set);
      }

      const imagesBase64: string[] = [];
      if (mediaMode === 'photo') {
        for (const idx of sampledIndices) {
          const b64 = await renderAiThumbnail(candidatePhotos[idx].file);
          imagesBase64.push(b64);
        }
      }

      const res = await fetch('/api/post-assistant/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId: currentDraftId,
          brand,
          mediaMode,
          brief,
          imagesBase64,
          enableResearch,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.data) {
        throw new Error(json?.error || 'AI generation failed');
      }

      const data = json.data as AIGenerateResponse;

      if (data.cover_headline) {
        setCoverHeadline(data.cover_headline);
      }

      setCaptions({
        social: data.social,
        website: data.website,
        hook_alternatives: data.hook_alternatives,
        observed_micro_moments: data.observed_micro_moments,
        cover_reason_th: data.cover_reason_th,
        quality: data.quality,
        grade_warnings: data.grade_warnings,
      });

      setAiResultMeta({
        coverReasonTh: data.cover_reason_th,
        observedMoments: data.observed_micro_moments,
        quality: data.quality,
        gradeWarnings: data.grade_warnings,
      });

      // Reorder photos according to AI narrative arc & update cover focal point
      if (mediaMode === 'photo' && candidatePhotos.length > 0 && data.ordered_image_indices.length > 0) {
        const keptOriginalIndices = data.ordered_image_indices
          .map((sampledIdx) => sampledIndices[sampledIdx])
          .filter((origIdx) => typeof origIdx === 'number');
        const keptSet = new Set(keptOriginalIndices);
        const sampledSet = new Set(sampledIndices);

        const reordered: StudioPhotoItem[] = [];
        keptOriginalIndices.forEach((origIdx, pos) => {
          const item = candidatePhotos[origIdx];
          if (!item) return;
          reordered.push({
            ...item,
            aiRejected: false,
            focalPoint: pos === 0 ? data.cover_focal_point : item.focalPoint,
          });
        });

        // Keep any unsampled items (when >25 uploaded)
        candidatePhotos.forEach((item, origIdx) => {
          if (!sampledSet.has(origIdx)) {
            reordered.push({ ...item, aiRejected: false });
          }
        });

        // Put AI-rejected items in tray (restorable!)
        candidatePhotos.forEach((item, origIdx) => {
          if (sampledSet.has(origIdx) && !keptSet.has(origIdx)) {
            reordered.push({ ...item, aiRejected: true });
          }
        });

        // Preserve manually excluded photos
        const manualExcluded = photos.filter((p) => p.excluded);
        setPhotos([...reordered, ...manualExcluded]);
      }

      setMobilePane('preview');
      toast.success(
        isThai
          ? `สร้างโพสต์เรียบร้อย (${data.model_used}${data.research_used ? ' + Google Search' : ''})`
          : `Generated with ${data.model_used}`
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'AI generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTranslateFromThai = async () => {
    if (!captions.social.fb_th.trim()) return;
    setIsTranslating(true);
    try {
      const res = await fetch('/api/post-assistant/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thaiText: captions.social.fb_th,
          websiteTitleTh: captions.website.title.th,
          websiteBodyTh: captions.website.body.th,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.data) {
        throw new Error(json?.error || 'Translation failed');
      }
      const d = json.data;
      setCaptions((prev) => ({
        ...prev,
        social: {
          ...prev.social,
          fb_en: d.en || prev.social.fb_en,
          fb_zh: d.zh || prev.social.fb_zh,
          ig_en: d.ig_en || prev.social.ig_en,
        },
        website: {
          ...prev.website,
          title: {
            ...prev.website.title,
            en: d.website_title_en || prev.website.title.en,
            zh: d.website_title_zh || prev.website.title.zh,
          },
          body: {
            ...prev.website.body,
            en: d.website_body_en || prev.website.body.en,
            zh: d.website_body_zh || prev.website.body.zh,
          },
        },
      }));
      toast.success(isThai ? 'อัปเดตภาษาอังกฤษและจีนจากภาษาไทยแล้ว' : 'Translated EN & ZH from Thai');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Translation failed');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleRefinePreset = async (preset: RefinePreset) => {
    setRefiningPreset(preset);
    try {
      const res = await fetch('/api/post-assistant/ai/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand,
          preset,
          social: captions.social,
          brief,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.data?.social) {
        throw new Error(json?.error || 'Refinement failed');
      }
      setCaptions((prev) => ({
        ...prev,
        social: json.data.social,
      }));
      toast.success(isThai ? 'ปรับโทนข้อความเรียบร้อย' : 'Caption refined');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Refine failed');
    } finally {
      setRefiningPreset(null);
    }
  };

  const handleQuickZip = async () => {
    if (!activePhotos.length) return;
    setIsQuickZipExporting(true);
    try {
      const fbCap = assembleFacebookCaption(brand, captions.social);
      const igCap = assembleInstagramCaption(brand, captions.social);
      const zipBlob = await exportPostAssetsZip({
        brand,
        items: activePhotos.map((p) => ({ file: p.file, focalPoint: p.focalPoint })),
        headline: BRAND_PROFILES[brand].supportsCoverHeadline ? coverHeadline : null,
        fbCaption: fbCap,
        igCaption: igCap,
        includeWebsiteCleanWebp: brand === 'main',
      });
      triggerBlobDownload(zipBlob, `SomkidPost_${Date.now()}.zip`);
      toast.success(isThai ? 'ดาวน์โหลด .zip เรียบร้อย!' : 'ZIP downloaded!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'ZIP export failed');
    } finally {
      setIsQuickZipExporting(false);
    }
  };

  const handleReset = async () => {
    if (!confirm(isThai ? 'เริ่มโพสต์ใหม่? ข้อมูลที่ยังไม่บันทึกร่างบนหน้าจอจะถูกล้าง' : 'Start a new post?')) {
      return;
    }
    setPhotos((prev) => {
      for (const p of prev) URL.revokeObjectURL(p.previewUrl);
      return [];
    });
    handleSelectVideo(null);
    setDraftId(null);
    setBrief(createEmptyBrief());
    setCoverHeadline(createEmptyHeadline());
    setCaptions(createEmptyCaptions());
    setAiResultMeta({});
    setIsGoldExample(false);
    setLastSavedAt(null);
    await clearLocalAutosave();
    setMobilePane('compose');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLoadDraft = (draft: SocialPostRecord) => {
    setDraftId(draft.id);
    setBrand(draft.brand);
    setMediaMode(draft.media_mode);
    setBrief(draft.activity_brief || createEmptyBrief());
    setCoverHeadline(draft.cover_headline || createEmptyHeadline());
    setCaptions(draft.captions || createEmptyCaptions());
    setChannels(draft.target_channels || defaultChannelsForBrand(draft.brand));
    setIsGoldExample(Boolean(draft.is_gold_example));
    setAiResultMeta({
      coverReasonTh: draft.captions?.cover_reason_th,
      observedMoments: draft.captions?.observed_micro_moments,
      quality: draft.captions?.quality,
      gradeWarnings: draft.captions?.grade_warnings,
    });
    toast.info(
      isThai
        ? 'โหลดเนื้อหาร่างแล้ว (หากต้องการอัปโหลดรูปชุดใหม่ กรุณาเลือกรูปภาพประกอบ)'
        : 'Loaded draft copy (attach local media files to re-render)'
    );
  };

  const handleToggleGoldExample = async (next: boolean) => {
    if (!draftId) return;
    const res = await fetch(`/api/post-assistant/drafts/${draftId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_gold_example: next }),
    });
    if (res.ok) {
      setIsGoldExample(next);
      toast.success(next ? 'บันทึกเป็น Gold Example แล้ว' : 'นำออกจาก Gold Example แล้ว');
    }
  };

  const mediaCount = mediaMode === 'photo' ? activePhotos.length : videoFile ? 1 : 0;

  return (
    <div className="min-h-[calc(100dvh-4rem)] max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4">
      <BrandAndModeBar
        brand={brand}
        onSelectBrand={handleSelectBrand}
        mediaMode={mediaMode}
        onSelectMode={setMediaMode}
        metaHealth={metaHealth}
        isSavingDraft={isSavingDraft}
        lastSavedAt={lastSavedAt}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onReset={handleReset}
        isThai={isThai}
      />

      {/* Mobile Stepped Switcher */}
      <div className="lg:hidden grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-200/70">
        <button
          type="button"
          onClick={() => setMobilePane('compose')}
          className={`py-2 rounded-lg text-xs font-bold transition-all ${
            mobilePane === 'compose' ? 'bg-white text-[#7B1C3E] shadow-sm' : 'text-slate-600'
          }`}
        >
          {isThai ? '1. ข้อมูล & สื่อ' : '1. Compose & Media'}
        </button>
        <button
          type="button"
          onClick={() => setMobilePane('preview')}
          className={`py-2 rounded-lg text-xs font-bold transition-all ${
            mobilePane === 'preview' ? 'bg-white text-[#1B3A6B] shadow-sm' : 'text-slate-600'
          }`}
        >
          {isThai ? '2. พรีวิว & เผยแพร่' : '2. Preview & Publish'}
        </button>
      </div>

      {/* 2-Column Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Compose */}
        <div className={`lg:col-span-5 space-y-4 ${mobilePane === 'compose' ? 'block' : 'hidden lg:block'}`}>
          <MediaDropzoneGrid
            mediaMode={mediaMode}
            photos={photos}
            onAddPhotos={handleAddPhotos}
            onReplacePhotos={handleReplacePhotos}
            onPromoteCover={handlePromoteCover}
            onMovePhoto={handleMovePhoto}
            onToggleExclude={handleToggleExclude}
            onRestoreRejected={handleRestoreRejected}
            onRemovePhoto={handleRemovePhoto}
            onUpdateFocalPoint={handleUpdateFocalPoint}
            videoFile={videoFile}
            videoPreviewUrl={videoPreviewUrl}
            onSelectVideo={handleSelectVideo}
            isThai={isThai}
          />

          <ActivityBriefForm
            brief={brief}
            onChange={setBrief}
            enableResearch={enableResearch}
            onToggleResearch={setEnableResearch}
            mediaMode={mediaMode}
            mediaCount={mediaCount}
            isGenerating={isGenerating}
            onGenerate={handleGenerate}
            isThai={isThai}
          />
        </div>

        {/* Right Column: Live Preview & Editorial Studio */}
        <div className={`lg:col-span-7 space-y-4 ${mobilePane === 'preview' ? 'block' : 'hidden lg:block'}`}>
          {mediaMode === 'photo' && (
            <CoverPreviewEditor
              brand={brand}
              fbPreviewUrl={effectiveFbPreviewUrl}
              igPreviewUrl={effectiveIgPreviewUrl}
              isRenderingCovers={isRenderingCovers}
              headline={coverHeadline}
              onChangeHeadline={setCoverHeadline}
              coverReasonTh={aiResultMeta.coverReasonTh}
              observedMoments={aiResultMeta.observedMoments}
              quality={aiResultMeta.quality}
              gradeWarnings={aiResultMeta.gradeWarnings}
              isThai={isThai}
            />
          )}

          <StructuredCaptionEditor
            brand={brand}
            captions={captions}
            onChange={setCaptions}
            onTranslateFromThai={handleTranslateFromThai}
            onRefinePreset={handleRefinePreset}
            isTranslating={isTranslating}
            refiningPreset={refiningPreset}
            previewCoverUrl={leadPhoto?.previewUrl || effectiveFbPreviewUrl}
            eventDate={brief.eventDate}
            isThai={isThai}
          />

          {/* Bottom Publish & Export Bar */}
          <div className="bg-white/95 border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#7B1C3E]" />
              <span>
                {isThai
                  ? 'พร้อมส่งออก .zip หรือเผยแพร่ตรงสู่ FB · IG · somkidvittaya.ac.th'
                  : 'Ready to export .zip or publish to FB · IG · somkidvittaya.ac.th'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {mediaMode === 'photo' && (
                <button
                  type="button"
                  disabled={isQuickZipExporting || activePhotos.length === 0}
                  onClick={handleQuickZip}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-45 transition-colors"
                >
                  {isQuickZipExporting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>{isThai ? 'ดาวน์โหลด .zip' : 'Export .zip'}</span>
                </button>
              )}

              <button
                type="button"
                disabled={mediaCount === 0 && !captions.social.fb_th.trim()}
                onClick={() => setIsPublishOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-[#7B1C3E] to-[#1B3A6B] hover:opacity-95 disabled:opacity-45 shadow-md transition-all"
              >
                <Send className="w-4 h-4" />
                <span>{isThai ? 'ตรวจสอบ & เผยแพร่โพสต์' : 'Review & Publish'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <PublishDrawerModal
        isOpen={isPublishOpen}
        onClose={() => setIsPublishOpen(false)}
        draftId={draftId}
        onEnsureDraftId={ensureDraftId}
        brand={brand}
        mediaMode={mediaMode}
        brief={brief}
        photos={photos}
        videoFile={videoFile}
        headline={coverHeadline}
        captions={captions}
        channels={channels}
        onChangeChannels={setChannels}
        isGoldExample={isGoldExample}
        onToggleGoldExample={handleToggleGoldExample}
        onPublishedSuccess={() => {
          toast.success(isThai ? 'อัปเดตสถานะการเผยแพร่เรียบร้อย!' : 'Publish flow updated!');
        }}
        isThai={isThai}
      />

      <DraftHistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onLoadDraft={handleLoadDraft}
        isThai={isThai}
      />
    </div>
  );
}
