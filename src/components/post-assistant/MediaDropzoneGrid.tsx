'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Upload,
  Image as ImageIcon,
  Plus,
  Trash2,
  Star,
  ArrowLeft,
  ArrowRight,
  EyeOff,
  RotateCcw,
  Maximize2,
  Crosshair,
  X,
  Film,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { FocalPoint, MediaMode } from '@/lib/post-assistant/types';

export interface StudioPhotoItem {
  id: string;
  file: File;
  previewUrl: string;
  excluded: boolean;
  aiRejected: boolean;
  focalPoint: FocalPoint;
  width?: number;
  height?: number;
}

interface MediaDropzoneGridProps {
  mediaMode: MediaMode;
  photos: StudioPhotoItem[];
  onAddPhotos: (files: File[]) => void;
  onReplacePhotos: (files: File[]) => void;
  onPromoteCover: (id: string) => void;
  onMovePhoto: (id: string, dir: -1 | 1) => void;
  onToggleExclude: (id: string) => void;
  onRestoreRejected: (id: string) => void;
  onRemovePhoto: (id: string) => void;
  onUpdateFocalPoint: (id: string, fp: FocalPoint) => void;
  videoFile: File | null;
  videoPreviewUrl: string | null;
  onSelectVideo: (file: File | null) => void;
  isThai: boolean;
}

const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // Matches Supabase post-media bucket limit (50MB)

export function MediaDropzoneGrid({
  mediaMode,
  photos,
  onAddPhotos,
  onReplacePhotos,
  onPromoteCover,
  onMovePhoto,
  onToggleExclude,
  onRestoreRejected,
  onRemovePhoto,
  onUpdateFocalPoint,
  videoFile,
  videoPreviewUrl,
  onSelectVideo,
  isThai,
}: MediaDropzoneGridProps) {
  const addInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showRejected, setShowRejected] = useState(false);
  const [lightboxItem, setLightboxItem] = useState<StudioPhotoItem | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxItem(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const activePhotos = photos.filter((p) => !p.aiRejected && !p.excluded);
  const visiblePhotos = photos.filter((p) => !p.aiRejected);
  const rejectedPhotos = photos.filter((p) => p.aiRejected);

  const handleVideoFilePick = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_VIDEO_BYTES) {
      setVideoError(
        isThai
          ? `ไฟล์วิดีโอขนาด ${(file.size / 1024 / 1024).toFixed(1)} MB เกินลิมิต 50 MB ของพื้นที่จัดเก็บชั่วคราว กรุณาบีบอัดเป็น MP4 ≤ 50 MB`
          : `Video (${(file.size / 1024 / 1024).toFixed(1)} MB) exceeds 50 MB staging limit.`
      );
      return;
    }
    setVideoError(null);
    onSelectVideo(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files || []);
    if (mediaMode === 'photo') {
      const imgs = dropped.filter((f) => f.type.startsWith('image/'));
      if (imgs.length) onAddPhotos(imgs);
    } else {
      const vid = dropped.find((f) => f.type.startsWith('video/'));
      if (vid) handleVideoFilePick(vid);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          {mediaMode === 'photo' ? (
            <ImageIcon className="w-4 h-4 text-slate-500" />
          ) : (
            <Film className="w-4 h-4 text-slate-500" />
          )}
          <h2 className="font-semibold text-slate-900 text-sm sm:text-base">
            {mediaMode === 'photo'
              ? isThai
                ? `จัดการรูปภาพ (${activePhotos.length} พร้อมโพสต์)`
                : `Photos (${activePhotos.length} active)`
              : isThai
              ? 'วิดีโอกิจกรรม (MP4 / MOV)'
              : 'Activity Video (MP4 / MOV)'}
          </h2>
        </div>

        {mediaMode === 'photo' && photos.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => addInputRef.current?.click()}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#1B3A6B] text-white hover:bg-[#142d54] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isThai ? 'เพิ่มรูป' : 'Add More'}</span>
            </button>
            <button
              type="button"
              onClick={() => replaceInputRef.current?.click()}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
            >
              <span>{isThai ? 'เปลี่ยนชุดใหม่' : 'Replace All'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Hidden inputs (NEVER overlaid on video controls!) */}
      <input
        ref={addInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length) onAddPhotos(files);
          e.target.value = '';
        }}
      />
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length) onReplacePhotos(files);
          e.target.value = '';
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/*"
        className="hidden"
        onChange={(e) => {
          handleVideoFilePick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      {mediaMode === 'photo' ? (
        <>
          {/* Photo Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => {
              if (photos.length === 0) addInputRef.current?.click();
            }}
            className={`rounded-xl border-2 border-dashed transition-all p-5 text-center ${
              isDragging
                ? 'border-[#7B1C3E] bg-rose-50/60'
                : photos.length === 0
                ? 'border-slate-300 hover:border-[#7B1C3E] bg-slate-50/70 cursor-pointer'
                : 'border-slate-200 bg-slate-50/40'
            }`}
          >
            {photos.length === 0 ? (
              <div className="space-y-2 py-4">
                <Upload className="w-8 h-8 mx-auto text-[#7B1C3E]" />
                <p className="text-sm font-semibold text-slate-800">
                  {isThai ? 'คลิกหรือลากรูปภาพกิจกรรมมาวางที่นี่' : 'Click or drag activity photos here'}
                </p>
                <p className="text-xs text-slate-500">
                  {isThai
                    ? 'รองรับหลายรูปพร้อมกัน — ระบบประมวลผลในเครื่องและตัดพิกัด GPS (EXIF) ออกอัตโนมัติ'
                    : 'Multi-photo upload — client-side EXIF strip & iOS-safe processing'}
                </p>
              </div>
            ) : (
              <div className="space-y-3 text-left">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                  <span>
                    {isThai
                      ? 'รูปที่ #1 = ภาพปก · คลิกไอคอนเป้าเพื่อตั้งจุดโฟกัสครอปภาพไม่ตัดศีรษะ'
                      : 'Photo #1 = Cover · Click target icon to adjust focal crop point'}
                  </span>
                  <span className="font-medium text-[#1B3A6B]">
                    FB: {Math.min(20, activePhotos.length)}/20 · IG: {Math.min(10, activePhotos.length)}/10 · Web: {activePhotos.length}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {visiblePhotos.map((item, idx) => {
                    const isCover = idx === 0 && !item.excluded;
                    return (
                      <div
                        key={item.id}
                        className={`group relative rounded-xl overflow-hidden border-2 bg-slate-100 ${
                          isCover
                            ? 'border-[#7B1C3E] ring-2 ring-[#7B1C3E]/20'
                            : item.excluded
                            ? 'border-slate-200 opacity-45'
                            : 'border-emerald-500/70'
                        }`}
                      >
                        <div className="aspect-square relative">
                          <img
                            src={item.previewUrl}
                            alt={item.file.name}
                            style={{
                              objectPosition: `${Math.round(item.focalPoint.x * 100)}% ${Math.round(item.focalPoint.y * 100)}%`,
                            }}
                            className="w-full h-full object-cover"
                          />
                          <span
                            className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold text-white shadow ${
                              isCover ? 'bg-[#7B1C3E]' : item.excluded ? 'bg-slate-600' : 'bg-emerald-600'
                            }`}
                          >
                            {isCover ? (isThai ? 'ปก' : 'Cover') : `#${idx + 1}`}
                          </span>

                          {/* Quick Lightbox / Focal Point button */}
                          <button
                            type="button"
                            onClick={() => setLightboxItem(item)}
                            title={isThai ? 'ขยายดูภาพ & ตั้งจุดโฟกัส' : 'Zoom & Set Focal Point'}
                            className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/55 text-white hover:bg-black/80 transition-colors"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Action toolbar */}
                        <div className="p-1.5 bg-white flex items-center justify-between gap-1 text-slate-600">
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => onMovePhoto(item.id, -1)}
                              disabled={idx === 0}
                              title={isThai ? 'เลื่อนซ้าย' : 'Move left'}
                              className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"
                            >
                              <ArrowLeft className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onMovePhoto(item.id, 1)}
                              disabled={idx === visiblePhotos.length - 1}
                              title={isThai ? 'เลื่อนขวา' : 'Move right'}
                              className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center gap-0.5">
                            {idx !== 0 && (
                              <button
                                type="button"
                                onClick={() => onPromoteCover(item.id)}
                                title={isThai ? 'ตั้งเป็นภาพปก' : 'Set as Cover'}
                                className="p-1 rounded hover:bg-rose-50 text-[#7B1C3E]"
                              >
                                <Star className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onToggleExclude(item.id)}
                              title={item.excluded ? (isThai ? 'นำกลับมาใช้' : 'Include') : (isThai ? 'ซ่อนภาพนี้' : 'Exclude')}
                              className={`p-1 rounded hover:bg-slate-100 ${
                                item.excluded ? 'text-emerald-600' : 'text-amber-600'
                              }`}
                            >
                              <EyeOff className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onRemovePhoto(item.id)}
                              title={isThai ? 'ลบภาพออก' : 'Remove'}
                              className="p-1 rounded hover:bg-rose-50 text-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* AI-Rejected Photos Tray (1-click restore) */}
          {rejectedPhotos.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 space-y-2">
              <button
                type="button"
                onClick={() => setShowRejected((v) => !v)}
                className="w-full flex items-center justify-between text-xs font-semibold text-amber-900"
              >
                <span>
                  {isThai
                    ? `ภาพที่ AI คัดออก (เบลอ/ซ้ำ) — ${rejectedPhotos.length} รูป (กดเพื่อกู้คืนได้)`
                    : `AI-Filtered Out (${rejectedPhotos.length} blurry/duplicate — click to restore)`}
                </span>
                {showRejected ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showRejected && (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 pt-1">
                  {rejectedPhotos.map((item) => (
                    <div key={item.id} className="relative rounded-lg overflow-hidden border border-amber-300 bg-white">
                      <img src={item.previewUrl} alt={item.file.name} className="w-full aspect-square object-cover opacity-75" />
                      <button
                        type="button"
                        onClick={() => onRestoreRejected(item.id)}
                        className="w-full py-1 text-[11px] font-semibold bg-amber-600 hover:bg-amber-700 text-white inline-flex items-center justify-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>{isThai ? 'กู้คืน' : 'Restore'}</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        /* Video Mode — Controls are NEVER obscured by file input overlay */
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`rounded-xl border-2 border-dashed p-5 space-y-3 ${
            isDragging ? 'border-[#7B1C3E] bg-rose-50/60' : 'border-slate-300 bg-slate-50/70'
          }`}
        >
          {!videoFile || !videoPreviewUrl ? (
            <div
              onClick={() => videoInputRef.current?.click()}
              className="py-6 text-center space-y-2 cursor-pointer"
            >
              <Film className="w-8 h-8 mx-auto text-[#7B1C3E]" />
              <p className="text-sm font-semibold text-slate-800">
                {isThai ? 'คลิกหรือลากไฟล์วิดีโอ (MP4 / MOV)' : 'Click or drag video file (MP4 / MOV)'}
              </p>
              <p className="text-xs text-slate-500">
                {isThai
                  ? 'รองรับขนาดสูงสุด 50 MB (อัปโหลดตรงสู่ Supabase Storage เพื่อโพสต์ FB Video / IG Reels)'
                  : 'Up to 50 MB (Direct Supabase upload for FB Video / IG Reels)'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <video
                src={videoPreviewUrl}
                controls
                playsInline
                className="w-full max-h-72 rounded-xl bg-black"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-medium text-slate-700 truncate">
                  {videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(1)} MB)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => videoInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-[#1B3A6B] text-white font-semibold hover:bg-[#142d54]"
                  >
                    {isThai ? 'เปลี่ยนวิดีโอ' : 'Change Video'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectVideo(null)}
                    className="px-3 py-1.5 rounded-lg bg-rose-100 text-[#7B1C3E] font-semibold hover:bg-rose-200"
                  >
                    {isThai ? 'ลบออก' : 'Remove'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {videoError && (
            <p className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {videoError}
            </p>
          )}
        </div>
      )}

      {/* Lightbox + Click-to-Set Focal Point Modal */}
      {lightboxItem && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxItem(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full p-4 space-y-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Crosshair className="w-4 h-4 text-[#7B1C3E]" />
                <span>
                  {isThai
                    ? 'คลิกบนภาพเพื่อกำหนดจุดโฟกัสสำหรับการครอป 1:1 / 4:5 / 4:3'
                    : 'Click on image to set focal crop point'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setLightboxItem(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative inline-block w-full bg-slate-900 rounded-xl overflow-hidden">
              <img
                src={lightboxItem.previewUrl}
                alt={lightboxItem.file.name}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                  const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
                  const fp = { x: Number(x.toFixed(3)), y: Number(y.toFixed(3)) };
                  onUpdateFocalPoint(lightboxItem.id, fp);
                  setLightboxItem({ ...lightboxItem, focalPoint: fp });
                }}
                className="w-full max-h-[65vh] object-contain cursor-crosshair select-none"
              />
              <div
                style={{
                  left: `${lightboxItem.focalPoint.x * 100}%`,
                  top: `${lightboxItem.focalPoint.y * 100}%`,
                }}
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full border-2 border-white bg-[#7B1C3E]/70 shadow-lg flex items-center justify-center"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                Focal Point: ({Math.round(lightboxItem.focalPoint.x * 100)}%,{' '}
                {Math.round(lightboxItem.focalPoint.y * 100)}%)
              </span>
              <button
                type="button"
                onClick={() => {
                  const center = { x: 0.5, y: 0.5 };
                  onUpdateFocalPoint(lightboxItem.id, center);
                  setLightboxItem({ ...lightboxItem, focalPoint: center });
                }}
                className="text-[#1B3A6B] font-semibold hover:underline"
              >
                {isThai ? 'รีเซ็ตกึ่งกลาง' : 'Reset Center'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
