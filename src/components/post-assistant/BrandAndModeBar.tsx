'use client';

import React from 'react';
import Link from 'next/link';
import {
  Camera,
  Video,
  History,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Save,
} from 'lucide-react';
import { BRAND_PROFILES } from '@/lib/post-assistant/brand-glossary';
import { BrandId, MediaMode } from '@/lib/post-assistant/types';

export interface MetaHealthStatus {
  configured: boolean;
  healthy: boolean;
  message: string;
}

interface BrandAndModeBarProps {
  brand: BrandId;
  onSelectBrand: (b: BrandId) => void;
  mediaMode: MediaMode;
  onSelectMode: (m: MediaMode) => void;
  metaHealth: MetaHealthStatus | null;
  isSavingDraft: boolean;
  lastSavedAt: string | null;
  onOpenHistory: () => void;
  onReset: () => void;
  isThai: boolean;
}

const BRAND_ORDER: BrandId[] = ['main', 'football', 'swimming', 'tutoring'];

export function BrandAndModeBar({
  brand,
  onSelectBrand,
  mediaMode,
  onSelectMode,
  metaHealth,
  isSavingDraft,
  lastSavedAt,
  onOpenHistory,
  onReset,
  isThai,
}: BrandAndModeBarProps) {
  return (
    <div className="bg-white/90 backdrop-blur-md border border-slate-200/80 rounded-2xl p-3 sm:p-4 shadow-sm space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Title & Legacy Fallback */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7B1C3E] to-[#1B3A6B] flex items-center justify-center text-white font-bold shadow-sm">
            SV
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-[#1B3A6B]">
                Social Post Assistant
              </h1>
              <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                v2 Studio Beta
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {isThai
                ? 'ระบบสร้างโพสต์ระดับ Global (FB · IG · somkidvittaya.ac.th)'
                : 'Global Editorial Studio (FB · IG · somkidvittaya.ac.th)'}
            </p>
          </div>
        </div>

        {/* Utility Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Meta API Status Pill */}
          {metaHealth && (
            <div
              title={metaHealth.message}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                metaHealth.healthy
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              {metaHealth.healthy ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">
                {metaHealth.healthy
                  ? 'Meta API Ready'
                  : metaHealth.configured
                  ? 'Meta Token Issue'
                  : 'Meta Key Pending'}
              </span>
            </div>
          )}

          {/* Autosave indicator */}
          <span className="inline-flex items-center gap-1 text-xs text-slate-500 px-2">
            <Save className="w-3.5 h-3.5" />
            {isSavingDraft
              ? isThai
                ? 'กำลังบันทึก...'
                : 'Saving...'
              : lastSavedAt
              ? `${isThai ? 'บันทึกล่าสุด' : 'Saved'} ${lastSavedAt}`
              : isThai
              ? 'บันทึกร่างอัตโนมัติ'
              : 'Autosave ready'}
          </span>

          <button
            type="button"
            onClick={onOpenHistory}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            <History className="w-3.5 h-3.5" />
            <span>{isThai ? 'ร่าง & ประวัติ' : 'Drafts & History'}</span>
          </button>

          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-[#7B1C3E] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isThai ? 'เริ่มใหม่' : 'New Post'}</span>
          </button>

          <Link
            href="/post-assistant"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <span>{isThai ? 'เวอร์ชันเดิม' : 'Legacy'}</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Brand Selector & Media Mode */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2 border-t border-slate-100">
        <div className="flex flex-wrap items-center gap-2">
          {BRAND_ORDER.map((id) => {
            const p = BRAND_PROFILES[id];
            const active = brand === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectBrand(id)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all border ${
                  active
                    ? 'bg-[#1B3A6B] text-white border-[#1B3A6B] shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <img
                  src={p.avatarPath}
                  alt={p.labelEn}
                  className="w-5 h-5 rounded-full object-cover bg-white"
                />
                <span>{p.labelEn}</span>
                {p.supportsInstagram && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    3 ภาษา + IG + Web
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Photo vs Video Mode */}
        <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => onSelectMode('photo')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              mediaMode === 'photo'
                ? 'bg-white text-[#7B1C3E] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>{isThai ? 'โพสต์รูปภาพ' : 'Photo Post'}</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectMode('video')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              mediaMode === 'video'
                ? 'bg-white text-[#7B1C3E] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>{isThai ? 'วิดีโอ / Reels' : 'Video / Reels'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
