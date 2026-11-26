'use client';

import React, { useState } from 'react';
import {
  Copy,
  Languages,
  Sparkles,
  Loader2,
  Eye,
  Globe,
  Wand2,
} from 'lucide-react';

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}
import { toast } from 'sonner';
import {
  BRAND_PROFILES,
  assembleFacebookCaption,
  assembleInstagramCaption,
  formatHashtags,
} from '@/lib/post-assistant/brand-glossary';
import {
  BrandId,
  HookAlternative,
  PostCategory,
  RefinePreset,
  StructuredCaptions,
} from '@/lib/post-assistant/types';

interface StructuredCaptionEditorProps {
  brand: BrandId;
  captions: StructuredCaptions;
  onChange: (next: StructuredCaptions) => void;
  onTranslateFromThai: () => Promise<void>;
  onRefinePreset: (preset: RefinePreset) => Promise<void>;
  isTranslating: boolean;
  refiningPreset: RefinePreset | null;
  previewCoverUrl: string | null;
  eventDate: string;
  isThai: boolean;
}

const CATEGORIES: PostCategory[] = [
  'activity',
  'academic',
  'competition',
  'award',
  'sports',
  'admission',
  'announcement',
  'community',
  'general',
];

const REFINE_PRESETS: Array<{ id: RefinePreset; labelTh: string; labelEn: string }> = [
  { id: 'warm', labelTh: '✨ อบอุ่นจับใจพ่อแม่', labelEn: '✨ Warmer' },
  { id: 'prestige', labelTh: '🎓 ทรงภูมิแบบอินเตอร์', labelEn: '🎓 Prestigious' },
  { id: 'punchy_ig', labelTh: '⚡ คมกระชับสไตล์ IG', labelEn: '⚡ Punchier IG' },
  { id: 'admissions', labelTh: '🎯 เน้นชวนเยี่ยมชม รร.', labelEn: '🎯 Tour CTA' },
  { id: 'new_hooks', labelTh: '🪝 เปลี่ยน Hook ใหม่', labelEn: '🪝 Fresh Hooks' },
];

function replaceOpeningLine(body: string, newHook: string): string {
  if (!newHook.trim()) return body;
  const trimmed = body.trim();
  if (!trimmed) return newHook.trim();
  const lines = trimmed.split(/\n+/);
  lines[0] = newHook.trim();
  return lines.join('\n\n');
}

export function StructuredCaptionEditor({
  brand,
  captions,
  onChange,
  onTranslateFromThai,
  onRefinePreset,
  isTranslating,
  refiningPreset,
  previewCoverUrl,
  eventDate,
  isThai,
}: StructuredCaptionEditorProps) {
  const profile = BRAND_PROFILES[brand];
  const [activeTab, setActiveTab] = useState<'facebook' | 'instagram' | 'website' | 'preview'>('facebook');
  const [previewChannel, setPreviewChannel] = useState<'website' | 'fb' | 'ig'>('website');
  const [webLang, setWebLang] = useState<'th' | 'en' | 'zh'>('th');

  const { social, website } = captions;
  const assembledFb = assembleFacebookCaption(brand, social);
  const assembledIg = assembleInstagramCaption(brand, social);

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(isThai ? `คัดลอก${label}แล้ว` : `Copied ${label}`);
    } catch {
      toast.error(isThai ? 'ไม่สามารถคัดลอกอัตโนมัติได้' : 'Clipboard access blocked');
    }
  };

  const applyHookAlternative = (alt: HookAlternative) => {
    onChange({
      ...captions,
      social: {
        ...social,
        fb_th: replaceOpeningLine(social.fb_th, alt.hook_th || ''),
        fb_en: profile.supportsTrilingual ? replaceOpeningLine(social.fb_en, alt.hook_en || '') : '',
        fb_zh: profile.supportsTrilingual ? replaceOpeningLine(social.fb_zh, alt.hook_zh || '') : '',
        ig_en: profile.supportsInstagram ? replaceOpeningLine(social.ig_en, alt.hook_en || '') : '',
      },
    });
    toast.success(isThai ? `เปลี่ยนเปิดเรื่องเป็น "${alt.label_th}" แล้ว` : `Applied "${alt.label_th}" hook`);
  };

  const updateSocial = (patch: Partial<typeof social>) => {
    onChange({ ...captions, social: { ...social, ...patch } });
  };

  const updateWebsite = (patch: Partial<typeof website>) => {
    onChange({ ...captions, website: { ...website, ...patch } });
  };

  return (
    <div className="bg-white/95 border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-[#7B1C3E]" />
          <h2 className="font-bold text-slate-900 text-sm sm:text-base">
            {isThai ? 'ปรับแต่งแคปชั่น & เนื้อหาเว็บไซต์' : 'Editorial Caption & Website Copy'}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {profile.supportsTrilingual && (
            <button
              type="button"
              disabled={isTranslating || !social.fb_th.trim()}
              onClick={onTranslateFromThai}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#1B3A6B] text-white hover:bg-[#142d54] disabled:opacity-45 transition-colors"
            >
              {isTranslating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Languages className="w-3.5 h-3.5" />
              )}
              <span>{isThai ? 'แปล EN / ZH จากภาษาไทย' : 'Translate EN/ZH from Thai'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => handleCopy(assembledFb, 'แคปชั่น FB')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{isThai ? 'คัดลอก FB' : 'Copy FB'}</span>
          </button>
          {profile.supportsInstagram && (
            <button
              type="button"
              onClick={() => handleCopy(assembledIg, 'แคปชั่น IG')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{isThai ? 'คัดลอก IG' : 'Copy IG'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Hook Alternatives & Quick-Refine Chips */}
      {((captions.hook_alternatives && captions.hook_alternatives.length > 0) || social.fb_th.trim()) && (
        <div className="space-y-2 bg-slate-50/80 border border-slate-200/70 rounded-xl p-3">
          {captions.hook_alternatives && captions.hook_alternatives.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-600 mr-1">
                {isThai ? 'สลับประโยคเปิด (3 แนว):' : 'Hook Options:'}
              </span>
              {captions.hook_alternatives.map((alt, i) => (
                <button
                  key={`${alt.archetype}-${i}`}
                  type="button"
                  onClick={() => applyHookAlternative(alt)}
                  title={alt.hook_th || alt.hook_en}
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-white border border-slate-200 hover:border-[#7B1C3E] hover:text-[#7B1C3E] text-slate-700 transition-colors"
                >
                  {alt.label_th}
                </button>
              ))}
            </div>
          )}

          {social.fb_th.trim() && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-600 mr-1 inline-flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#7B1C3E]" />
                <span>{isThai ? 'ปรับโทน 1 คลิก:' : 'Quick Refine:'}</span>
              </span>
              {REFINE_PRESETS.filter((p) => profile.supportsInstagram || p.id !== 'punchy_ig').map((preset) => {
                const busy = refiningPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={refiningPreset !== null}
                    onClick={() => onRefinePreset(preset.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-white border border-slate-200 hover:bg-[#1B3A6B] hover:text-white hover:border-[#1B3A6B] disabled:opacity-50 text-slate-700 transition-colors"
                  >
                    {busy && <Loader2 className="w-3 h-3 animate-spin" />}
                    <span>{isThai ? preset.labelTh : preset.labelEn}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Channel Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('facebook')}
          className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-colors ${
            activeTab === 'facebook'
              ? 'border-[#1B3A6B] text-[#1B3A6B]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FacebookIcon className="w-3.5 h-3.5" />
          <span>{profile.supportsTrilingual ? 'Facebook (TH / EN / ZH)' : 'Facebook (TH)'}</span>
        </button>

        {profile.supportsInstagram && (
          <button
            type="button"
            onClick={() => setActiveTab('instagram')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'instagram'
                ? 'border-[#7B1C3E] text-[#7B1C3E]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <InstagramIcon className="w-3.5 h-3.5" />
            <span>Instagram (EN)</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveTab('website')}
          className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-colors ${
            activeTab === 'website'
              ? 'border-[#8b1d32] text-[#8b1d32]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>somkidvittaya.ac.th</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-colors ${
            activeTab === 'preview'
              ? 'border-emerald-700 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>{isThai ? 'พรีวิวโพสต์จริง' : 'Live Previews'}</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'facebook' && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {isThai ? 'ภาษาไทย (แก้ไขแล้วกด "แปล EN / ZH จากภาษาไทย" ได้)' : 'Thai Caption'}
            </label>
            <textarea
              rows={5}
              value={social.fb_th}
              onChange={(e) => updateSocial({ fb_th: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]/30"
            />
          </div>

          {profile.supportsTrilingual && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">English Caption</label>
                <textarea
                  rows={5}
                  value={social.fb_en}
                  onChange={(e) => updateSocial({ fb_en: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  中文 (ใช้ชื่อ somkidvittaya学校)
                </label>
                <textarea
                  rows={5}
                  value={social.fb_zh}
                  onChange={(e) => updateSocial({ fb_zh: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]/30"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Hashtags</label>
              <input
                type="text"
                value={formatHashtags(social.hashtags || [])}
                onChange={(e) =>
                  updateSocial({
                    hashtags: e.target.value
                      .split(/\s+/)
                      .map((t) => t.trim())
                      .filter(Boolean),
                  })
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800"
              />
            </div>
            {profile.supportsTrilingual && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Signature Line
                </label>
                <input
                  type="text"
                  value={social.signature_en || ''}
                  onChange={(e) => updateSocial({ signature_en: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800"
                />
              </div>
            )}
          </div>
          <p className="text-[11px] text-slate-400">
            {isThai
              ? '* ข้อมูลติดต่อ (โทร 038-611251 · mail@somkidvittaya.ac.th · ลิงก์เยี่ยมชม) และเส้นคั่นจะถูกประกอบให้อัตโนมัติตอนโพสต์'
              : '* School contact blocks and dividers are assembled automatically when publishing.'}
          </p>
        </div>
      )}

      {activeTab === 'instagram' && profile.supportsInstagram && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <label className="font-semibold text-slate-700">
              Instagram Caption (English · Global School Style)
            </label>
            <span className="text-slate-400">{social.ig_en.length} chars</span>
          </div>
          <textarea
            rows={6}
            value={social.ig_en}
            onChange={(e) => updateSocial({ ig_en: e.target.value })}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]/30"
          />
        </div>
      )}

      {activeTab === 'website' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex p-1 rounded-lg bg-slate-100">
              {(['th', 'en', 'zh'] as const)
                .filter((l) => l === 'th' || profile.supportsTrilingual)
                .map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setWebLang(lang)}
                    className={`px-3 py-1 rounded-md text-xs font-bold uppercase ${
                      webLang === lang ? 'bg-white text-[#8b1d32] shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
            </div>

            <div className="flex items-center gap-2">
              <select
                value={website.category}
                onChange={(e) => updateWebsite({ category: e.target.value as PostCategory })}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-800"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={website.slug_en}
                onChange={(e) => updateWebsite({ slug_en: e.target.value })}
                placeholder="url-slug-en"
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-700 w-44"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Website Title ({webLang.toUpperCase()})
            </label>
            <input
              type="text"
              value={website.title[webLang] || ''}
              onChange={(e) =>
                updateWebsite({ title: { ...website.title, [webLang]: e.target.value } })
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Excerpt / Summary ({webLang.toUpperCase()})
            </label>
            <textarea
              rows={2}
              value={website.excerpt[webLang] || ''}
              onChange={(e) =>
                updateWebsite({ excerpt: { ...website.excerpt, [webLang]: e.target.value } })
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Clean Editorial Body ({webLang.toUpperCase()}) — ไร้เส้นคั่น ไร้แฮชแท็ก
            </label>
            <textarea
              rows={5}
              value={website.body[webLang] || ''}
              onChange={(e) =>
                updateWebsite({ body: { ...website.body, [webLang]: e.target.value } })
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
          </div>
        </div>
      )}

      {activeTab === 'preview' && (
        <div className="space-y-3">
          <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200">
            <button
              type="button"
              onClick={() => setPreviewChannel('website')}
              className={`px-3 py-1 rounded-lg text-xs font-bold ${
                previewChannel === 'website' ? 'bg-white text-[#8b1d32] shadow-sm' : 'text-slate-600'
              }`}
            >
              somkidvittaya.ac.th
            </button>
            <button
              type="button"
              onClick={() => setPreviewChannel('fb')}
              className={`px-3 py-1 rounded-lg text-xs font-bold ${
                previewChannel === 'fb' ? 'bg-white text-[#1B3A6B] shadow-sm' : 'text-slate-600'
              }`}
            >
              Facebook
            </button>
            {profile.supportsInstagram && (
              <button
                type="button"
                onClick={() => setPreviewChannel('ig')}
                className={`px-3 py-1 rounded-lg text-xs font-bold ${
                  previewChannel === 'ig' ? 'bg-white text-[#7B1C3E] shadow-sm' : 'text-slate-600'
                }`}
              >
                Instagram
              </button>
            )}
          </div>

          {previewChannel === 'website' ? (
            /* Editorial Preview styled with authentic somkidvittaya.ac.th design tokens */
            <div className="rounded-xl border border-[#e9e7df] bg-[#f8f7f2] p-4 space-y-3">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#8b1d32]">
                <span>somkidvittaya.ac.th / news · {website.category}</span>
                <span className="text-[#5c6872]">{eventDate || new Date().toISOString().split('T')[0]}</span>
              </div>
              <div className="bg-white border border-[#e9e7df] rounded-[8px] overflow-hidden shadow-sm">
                {previewCoverUrl && (
                  <img
                    src={previewCoverUrl}
                    alt={website.title.th || 'News preview'}
                    className="w-full h-48 object-cover"
                  />
                )}
                <div className="p-4 space-y-2">
                  <h3 className="text-base font-bold text-[#091b30]">
                    {website.title[webLang] || website.title.th || '(ยังไม่มีหัวข้อข่าว)'}
                  </h3>
                  <p className="text-xs text-[#5c6872]">
                    {website.excerpt[webLang] || website.excerpt.th}
                  </p>
                  <div className="pt-2 border-t border-[#e9e7df] text-xs text-[#1c2229] whitespace-pre-wrap leading-relaxed">
                    {website.body[webLang] || website.body.th || '(ยังไม่มีเนื้อหา)'}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <pre className="whitespace-pre-wrap font-sans text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-800 max-h-96 overflow-y-auto leading-relaxed">
              {previewChannel === 'fb' ? assembledFb : assembledIg}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
