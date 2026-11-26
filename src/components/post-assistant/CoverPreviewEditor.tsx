'use client';

import React, { useState } from 'react';
import { Image as ImageIcon, Info, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { BRAND_PROFILES } from '@/lib/post-assistant/brand-glossary';
import {
  BrandId,
  CoverHeadline,
  PostQualityAssessment,
} from '@/lib/post-assistant/types';

interface CoverPreviewEditorProps {
  brand: BrandId;
  fbPreviewUrl: string | null;
  igPreviewUrl: string | null;
  isRenderingCovers: boolean;
  headline: CoverHeadline;
  onChangeHeadline: (hl: CoverHeadline) => void;
  coverReasonTh?: string;
  observedMoments?: string[];
  quality?: PostQualityAssessment;
  gradeWarnings?: string[];
  isThai: boolean;
}

export function CoverPreviewEditor({
  brand,
  fbPreviewUrl,
  igPreviewUrl,
  isRenderingCovers,
  headline,
  onChangeHeadline,
  coverReasonTh,
  observedMoments,
  quality,
  gradeWarnings,
  isThai,
}: CoverPreviewEditorProps) {
  const profile = BRAND_PROFILES[brand];
  const [showInsights, setShowInsights] = useState(false);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-slate-500" />
          <h2 className="font-semibold text-slate-900 text-sm sm:text-base">
            {isThai ? 'พรีวิวภาพปก & พาดหัว' : 'Cover Preview & Headline'}
          </h2>
        </div>
        {isRenderingCovers && (
          <span className="inline-flex items-center gap-1 text-xs text-[#1B3A6B] font-medium">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>{isThai ? 'กำลังวาดภาพ...' : 'Rendering...'}</span>
          </span>
        )}
      </div>

      {/* Live Canvas Cover Previews */}
      <div className={`grid gap-4 ${profile.supportsInstagram ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            Facebook Cover (1:1 · 2160×2160)
          </span>
          <div className="aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center">
            {fbPreviewUrl ? (
              <img src={fbPreviewUrl} alt="FB Cover Preview" className="w-full h-full object-contain" />
            ) : (
              <span className="text-xs text-slate-400">
                {isThai ? 'อัปโหลดภาพเพื่อดูพรีวิวปก' : 'Upload photo to preview cover'}
              </span>
            )}
          </div>
        </div>

        {profile.supportsInstagram && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
              Instagram Cover (4:5 · 2048×2560)
            </span>
            <div className="aspect-[4/5] max-h-[340px] mx-auto rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center">
              {igPreviewUrl ? (
                <img src={igPreviewUrl} alt="IG Cover Preview" className="w-full h-full object-contain" />
              ) : (
                <span className="text-xs text-slate-400">
                  {isThai ? 'อัปโหลดภาพเพื่อดูพรีวิว IG' : 'Upload photo to preview IG'}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3-line English Headline Editor (Main Brand Only) */}
      {profile.supportsCoverHeadline && (
        <div className="space-y-2.5 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">
              {isThai
                ? 'พาดหัวบนภาพปก (ภาษาอังกฤษล้วน — อัปเดตพรีวิวอัตโนมัติ)'
                : 'Cover Headline (English Only — Live Auto-Preview)'}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Line 1 (UPPERCASE)</label>
              <input
                type="text"
                value={headline.headline}
                onChange={(e) => onChangeHeadline({ ...headline, headline: e.target.value })}
                placeholder="FUTURE BUILDERS"
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-900"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Line 2 (Title Case)</label>
              <input
                type="text"
                value={headline.subhead}
                onChange={(e) => onChangeHeadline({ ...headline, subhead: e.target.value })}
                placeholder="Learning Beyond the Classroom"
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Line 3 (Detail ≤ 40 chars)</label>
              <input
                type="text"
                value={headline.detail}
                onChange={(e) => onChangeHeadline({ ...headline, detail: e.target.value })}
                placeholder="Nov 26, 2026 · Prep School"
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900"
              />
            </div>
          </div>
        </div>
      )}

      {/* Editorial Notes & Quality Check (Collapsible) */}
      {(coverReasonTh || (observedMoments && observedMoments.length > 0) || quality) && (
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-2">
          <button
            type="button"
            onClick={() => setShowInsights((v) => !v)}
            className="w-full flex items-center justify-between text-xs font-semibold text-slate-800"
          >
            <span className="inline-flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-slate-500" />
              <span>
                {isThai ? 'หมายเหตุการเลือกภาพ & ตรวจสอบคุณภาพ' : 'Editorial Notes & Quality Check'}
                {quality ? ` (${quality.overall}/100)` : ''}
              </span>
            </span>
            {showInsights ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showInsights && (
            <div className="space-y-2 pt-1 text-xs text-slate-700">
              {coverReasonTh && (
                <p>
                  <strong>{isThai ? 'เหตุผลเลือกปก:' : 'Cover Pick:'}</strong> {coverReasonTh}
                </p>
              )}
              {observedMoments && observedMoments.length > 0 && (
                <div>
                  <strong>{isThai ? 'รายละเอียดที่ตรวจพบในภาพ:' : 'Observed Details:'}</strong>
                  <ul className="list-disc pl-4 mt-0.5 space-y-0.5 text-slate-600">
                    {observedMoments.map((m, idx) => (
                      <li key={idx}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
              {quality && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="px-2 py-0.5 rounded bg-white border border-slate-200">
                    Brand: <strong>{quality.brand}</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-white border border-slate-200">
                    Story: <strong>{quality.story}</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-white border border-slate-200">
                    Emotion: <strong>{quality.emotion}</strong>
                  </span>
                  {quality.suggestion_th && (
                    <span className="text-slate-600 italic">{quality.suggestion_th}</span>
                  )}
                </div>
              )}
              {gradeWarnings && gradeWarnings.length > 0 && (
                <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                  Auto-fixed grade rules: {gradeWarnings.join(' · ')}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
