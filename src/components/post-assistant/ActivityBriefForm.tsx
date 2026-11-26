'use client';

import React, { useEffect, useState } from 'react';
import { Globe, ShieldAlert, ShieldCheck, Sparkles, Loader2 } from 'lucide-react';
import { ACTIVITY_TAGS, CAPTION_TONES } from '@/lib/post-assistant/brand-glossary';
import { ActivityBrief, MediaMode } from '@/lib/post-assistant/types';

interface PdpaStatus {
  optedOutCount: number;
  matchedGradeCount: number;
  matchedClassrooms: string[];
  advisory: string;
}

interface ActivityBriefFormProps {
  brief: ActivityBrief;
  onChange: (next: ActivityBrief) => void;
  enableResearch: boolean;
  onToggleResearch: (val: boolean) => void;
  mediaMode: MediaMode;
  mediaCount: number;
  isGenerating: boolean;
  onGenerate: () => void;
  isThai: boolean;
}

export function ActivityBriefForm({
  brief,
  onChange,
  enableResearch,
  onToggleResearch,
  mediaMode,
  mediaCount,
  isGenerating,
  onGenerate,
  isThai,
}: ActivityBriefFormProps) {
  const [pdpa, setPdpa] = useState<PdpaStatus | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const qs = brief.studentGroup.trim()
          ? `?grade=${encodeURIComponent(brief.studentGroup.trim())}`
          : '';
        const res = await fetch(`/api/post-assistant/pdpa-check${qs}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const json = await res.json();
          setPdpa(json);
        }
      } catch {
        // ignore abort/network error
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [brief.studentGroup]);

  const toggleTag = (tagVal: string) => {
    const exists = brief.activityTypes.includes(tagVal);
    const next = exists
      ? brief.activityTypes.filter((t) => t !== tagVal)
      : [...brief.activityTypes, tagVal];
    onChange({ ...brief, activityTypes: next });
  };

  const canGenerate = Boolean(brief.activityName.trim()) && mediaCount > 0 && !isGenerating;

  return (
    <div className="bg-white/95 border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-[#7B1C3E] text-white text-xs font-bold flex items-center justify-center">
            1
          </span>
          <h2 className="font-bold text-slate-900 text-sm sm:text-base">
            {isThai ? 'ข้อมูลกิจกรรม (Activity Brief)' : 'Activity Information'}
          </h2>
        </div>
        <span className="text-[11px] text-slate-400">
          {isThai ? '* ยิ่งรายละเอียดชัด AI ยิ่งเขียนตรงจุด' : '* Richer context yields sharper copy'}
        </span>
      </div>

      {/* Activity Name */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          {isThai ? 'ชื่อกิจกรรม' : 'Activity Name'} <span className="text-[#7B1C3E]">*</span>
        </label>
        <input
          type="text"
          value={brief.activityName}
          onChange={(e) => onChange({ ...brief, activityName: e.target.value })}
          placeholder={
            isThai
              ? 'เช่น กิจกรรม Stem Robotics, วันไหว้ครู, กีฬาสีสมคิดวิทยา 2569'
              : 'e.g. STEM Robotics Showcase, Sports Day 2026'
          }
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]/30 focus:border-[#7B1C3E]"
        />
      </div>

      {/* Date & Student Group */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            {isThai ? 'วันที่จัดกิจกรรม' : 'Event Date'}{' '}
            <span className="text-slate-400 font-normal">({isThai ? 'ไม่บังคับ' : 'Optional'})</span>
          </label>
          <input
            type="date"
            value={brief.eventDate}
            onChange={(e) => onChange({ ...brief, eventDate: e.target.value })}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]/30 focus:border-[#7B1C3E]"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            {isThai ? 'ระดับ / กลุ่มนักเรียน' : 'Student Level / Group'}{' '}
            <span className="text-slate-400 font-normal">({isThai ? 'ไม่บังคับ' : 'Optional'})</span>
          </label>
          <input
            type="text"
            value={brief.studentGroup}
            onChange={(e) => onChange({ ...brief, studentGroup: e.target.value })}
            placeholder={
              isThai
                ? 'เช่น เตรียมอนุบาล (Prep School), อ.1–อ.3, ป.4–ป.6'
                : 'e.g. Prep School, K.1–K.3, G.4–G.6'
            }
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]/30 focus:border-[#7B1C3E]"
          />
        </div>
      </div>

      {/* PDPA Advisory Banner */}
      {pdpa && (
        <div
          className={`rounded-xl px-3 py-2 text-xs flex items-start gap-2 border ${
            pdpa.optedOutCount > 0
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
          }`}
        >
          {pdpa.optedOutCount > 0 ? (
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
          ) : (
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
          )}
          <span>{pdpa.advisory}</span>
        </div>
      )}

      {/* Activity Tags */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
          {isThai ? 'ประเภทกิจกรรม (เลือกได้หลายข้อ)' : 'Activity Tags (Multi-select)'}
        </label>
        <div className="flex flex-wrap gap-1.5">
          {ACTIVITY_TAGS.map((tag) => {
            const selected = brief.activityTypes.includes(tag.value);
            return (
              <button
                key={tag.value}
                type="button"
                onClick={() => toggleTag(tag.value)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                  selected
                    ? 'bg-[#7B1C3E] text-white border-[#7B1C3E]'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {isThai ? tag.labelTh : tag.labelEn}
              </button>
            );
          })}
        </div>
      </div>

      {/* Details */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-semibold text-slate-700">
            {isThai ? 'รายละเอียด / ไฮไลต์ที่อยากเน้น' : 'Activity Details / Highlights'}
          </label>
          <span className="text-[11px] text-slate-400">{brief.details.length} / 1000</span>
        </div>
        <textarea
          rows={3}
          maxLength={1000}
          value={brief.details}
          onChange={(e) => onChange({ ...brief, details: e.target.value })}
          placeholder={
            isThai
              ? '- เด็ก ๆ ลงมือประดิษฐ์หุ่นยนต์ด้วยตัวเอง\n- คุณครูคอยให้คำแนะนำอย่างใกล้ชิด'
              : '- Students designed prototypes hands-on\n- Teachers mentored collaborative problem-solving'
          }
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]/30 focus:border-[#7B1C3E]"
        />
      </div>

      {/* Objective & Hashtags */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            {isThai ? 'วัตถุประสงค์หลัก (สั้น ๆ)' : 'Main Objective'}
          </label>
          <input
            type="text"
            value={brief.objective}
            onChange={(e) => onChange({ ...brief, objective: e.target.value })}
            placeholder={isThai ? 'เช่น ฝึกคิดวิเคราะห์และความกล้าแสดงออก' : 'e.g. Build creative confidence'}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]/30 focus:border-[#7B1C3E]"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            {isThai ? 'Hashtag ที่อยากใส่เพิ่ม' : 'Desired Hashtags'}
          </label>
          <input
            type="text"
            value={brief.desiredHashtags}
            onChange={(e) => onChange({ ...brief, desiredHashtags: e.target.value })}
            placeholder="#Somkidvittaya #ActiveLearning"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7B1C3E]/30 focus:border-[#7B1C3E]"
          />
        </div>
      </div>

      {/* Tone Selector */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
          {isThai ? 'โทนเสียงของแคปชั่น' : 'Caption Tone'}
        </label>
        <div className="flex flex-wrap gap-1.5">
          {CAPTION_TONES.map((tone) => {
            const selected = brief.tone === tone.value;
            return (
              <button
                key={tone.value}
                type="button"
                onClick={() => onChange({ ...brief, tone: tone.value })}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                  selected
                    ? 'bg-[#1B3A6B] text-white border-[#1B3A6B]'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {isThai ? tone.labelTh : tone.labelEn}
              </button>
            );
          })}
        </div>
      </div>

      {/* Conditional Google Search Grounding Switch */}
      <label className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 cursor-pointer">
        <div className="flex items-center gap-2 text-xs text-slate-700">
          <Globe className="w-4 h-4 text-[#1B3A6B] shrink-0" />
          <span>
            {isThai
              ? 'ค้นคว้าคำศัพท์เฉพาะ / ชื่อรายการแข่งขันผ่าน Google Search'
              : 'Verify competition names & technical terms via Google Search'}
          </span>
        </div>
        <input
          type="checkbox"
          checked={enableResearch}
          onChange={(e) => onToggleResearch(e.target.checked)}
          className="h-4 w-4 accent-[#1B3A6B] rounded"
        />
      </label>

      {/* Generate CTA */}
      <button
        type="button"
        disabled={!canGenerate}
        onClick={onGenerate}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#7B1C3E] to-[#1B3A6B] hover:opacity-95 disabled:opacity-45 disabled:cursor-not-allowed shadow-md transition-all"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>
              {isThai ? 'AI กำลังวิเคราะห์ภาพและร่างโพสต์ระดับ Global...' : 'Analyzing & crafting post...'}
            </span>
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            <span>
              {mediaCount === 0 || !brief.activityName.trim()
                ? isThai
                  ? 'กรุณากรอกชื่อกิจกรรมและอัปโหลดสื่อ'
                  : 'Enter activity name and upload media'
                : mediaMode === 'photo'
                ? isThai
                  ? `ให้ AI วิเคราะห์ภาพและสร้างโพสต์ (${mediaCount} รูป)`
                  : `Analyze & Generate Post (${mediaCount} photos)`
                : isThai
                ? 'ให้ AI สร้างแคปชั่นวิดีโอ / Reels'
                : 'Generate Video / Reels Post'}
            </span>
          </>
        )}
      </button>
    </div>
  );
}
