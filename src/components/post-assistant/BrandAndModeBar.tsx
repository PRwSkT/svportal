'use client';

import React from 'react';
import {
  Camera,
  Video,
  History,
  RotateCcw,
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
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Title & Channels */}
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">
            Social Post Assistant
          </h1>
          <p className="text-xs text-slate-500">
            {isThai
              ? 'จัดทำและเผยแพร่ข่าวประชาสัมพันธ์ · Facebook, Instagram และ somkidvittaya.ac.th'
              : 'Create and publish posts for Facebook, Instagram & somkidvittaya.ac.th'}
          </p>
        </div>

        {/* Utility Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Meta API Status Pill */}
          {metaHealth && (
            <div
              title={metaHealth.message}
              className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-700 border border-slate-200"
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  metaHealth.healthy ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
          >
            <History className="w-3.5 h-3.5" />
            <span>{isThai ? 'ร่าง & ประวัติ' : 'Drafts & History'}</span>
          </button>

          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 hover:text-[#7B1C3E] hover:border-rose-200 text-slate-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isThai ? 'เริ่มใหม่' : 'New Post'}</span>
          </button>
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
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all border ${
                  active
                    ? 'bg-[#1B3A6B] text-white border-[#1B3A6B] shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <img
                  src={p.avatarPath}
                  alt={p.labelEn}
                  className="w-6 h-6 rounded-full object-cover bg-white ring-1 ring-black/10 shrink-0"
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
        <div className="inline-flex p-1 rounded-lg bg-slate-100 border border-slate-200 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => onSelectMode('photo')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              mediaMode === 'photo'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>{isThai ? 'โพสต์รูปภาพ' : 'Photo Post'}</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectMode('video')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              mediaMode === 'video'
                ? 'bg-white text-slate-900 shadow-xs'
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
