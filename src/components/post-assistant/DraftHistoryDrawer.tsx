'use client';

import React, { useEffect, useState } from 'react';
import { X, Star, Trash2, ExternalLink, Loader2, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';
import { BRAND_PROFILES } from '@/lib/post-assistant/brand-glossary';
import { SocialPostRecord } from '@/lib/post-assistant/types';

interface DraftHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadDraft: (draft: SocialPostRecord) => void;
  isThai: boolean;
}

export function DraftHistoryDrawer({
  isOpen,
  onClose,
  onLoadDraft,
  isThai,
}: DraftHistoryDrawerProps) {
  const [drafts, setDrafts] = useState<SocialPostRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [goldOnly, setGoldOnly] = useState(false);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const timer = setTimeout(async () => {
      if (cancelled) return;
      setIsLoading(true);
      setWarningMsg(null);
      try {
        const qs = goldOnly ? '?gold=true' : '';
        const res = await fetch(`/api/post-assistant/drafts${qs}`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setWarningMsg(json?.error || 'Unable to load drafts');
          setDrafts([]);
        } else {
          setDrafts(json.drafts || []);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setWarningMsg(err instanceof Error ? err.message : 'Failed to fetch drafts');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, goldOnly]);

  if (!isOpen) return null;

  const handleToggleGold = async (draft: SocialPostRecord) => {
    try {
      const res = await fetch(`/api/post-assistant/drafts/${draft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_gold_example: !draft.is_gold_example }),
      });
      if (!res.ok) throw new Error('Update failed');
      setDrafts((prev) =>
        prev.map((d) =>
          d.id === draft.id ? { ...d, is_gold_example: !draft.is_gold_example } : d
        )
      );
      toast.success(
        !draft.is_gold_example ? 'บันทึกเป็น Gold Example แล้ว' : 'นำออกจาก Gold Example แล้ว'
      );
    } catch {
      toast.error('อัปเดตไม่สำเร็จ');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(isThai ? 'ต้องการลบร่างโพสต์นี้ใช่หรือไม่?' : 'Delete this draft?')) return;
    try {
      const res = await fetch(`/api/post-assistant/drafts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setDrafts((prev) => prev.filter((d) => d.id !== id));
      toast.success(isThai ? 'ลบร่างแล้ว' : 'Draft deleted');
    } catch {
      toast.error('ลบไม่สำเร็จ');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900">
              {isThai ? 'ร่างโพสต์ & ประวัติย้อนหลัง' : 'Drafts & Post History'}
            </h3>
            <p className="text-xs text-slate-500">
              {isThai ? 'เปิดแก้ไขซ้ำหรือตั้งเป็น Gold Example' : 'Resume drafts or curate Gold Examples'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="px-5 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <button
            type="button"
            onClick={() => setGoldOnly((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
              goldOnly
                ? 'bg-amber-100 border-amber-300 text-amber-900'
                : 'bg-white border-slate-200 text-slate-600'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${goldOnly ? 'fill-amber-500 text-amber-500' : ''}`} />
            <span>{isThai ? 'เฉพาะ Gold Examples' : 'Gold Examples Only'}</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="py-12 flex items-center justify-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : warningMsg ? (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
              {warningMsg}
            </div>
          ) : drafts.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              {isThai ? 'ยังไม่มีรายการร่างโพสต์ในระบบ' : 'No saved drafts found'}
            </div>
          ) : (
            drafts.map((d) => {
              const profile = BRAND_PROFILES[d.brand] || BRAND_PROFILES.main;
              return (
                <div
                  key={d.id}
                  className="rounded-xl border border-slate-200 p-3 space-y-2 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                        <span>{profile.labelEn}</span>
                        <span>·</span>
                        <span className="uppercase">{d.status}</span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-900 truncate">
                        {d.activity_brief?.activityName || '(Untitled Draft)'}
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleGold(d)}
                      title="Toggle Gold Example"
                      className="p-1 rounded hover:bg-amber-50"
                    >
                      <Star
                        className={`w-4 h-4 ${
                          d.is_gold_example ? 'fill-amber-500 text-amber-500' : 'text-slate-300'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-2 text-[11px]">
                      {d.fb_permalink && (
                        <a
                          href={d.fb_permalink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-0.5 text-blue-600 hover:underline"
                        >
                          FB <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {d.ig_permalink && (
                        <a
                          href={d.ig_permalink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-0.5 text-pink-600 hover:underline"
                        >
                          IG <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          onLoadDraft(d);
                          onClose();
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1B3A6B] text-white text-xs font-semibold hover:bg-[#142d54]"
                      >
                        <FolderOpen className="w-3 h-3" />
                        <span>{isThai ? 'เปิดร่าง' : 'Load'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(d.id)}
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
