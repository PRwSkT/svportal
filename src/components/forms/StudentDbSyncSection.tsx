'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database, RefreshCw, CheckCircle2, ArrowRight, UserPlus,
  Loader2, AlertCircle, Sparkles, Check, UserCheck, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { PendingStudentSyncItem } from '@/lib/forms/database-sync';

interface StudentDbSyncSectionProps {
  formId: string;
}

export function StudentDbSyncSection({ formId }: StudentDbSyncSectionProps) {
  const [items, setItems] = useState<PendingStudentSyncItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncingResponseId, setSyncingResponseId] = useState<string | null>(null);
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  const loadSyncItems = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/forms/sync-student?formId=${formId}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setItems(json.data || []);
      }
    } catch (err) {
      console.error('Failed to load sync items:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSyncItems();
  }, [formId]);

  const handleSyncItem = async (item: PendingStudentSyncItem) => {
    setSyncingResponseId(item.responseId);
    try {
      let body: any = {};
      if (item.syncType === 'update_existing') {
        const updates: Record<string, any> = {};
        for (const diff of item.diffs) {
          if (diff.field === 'height') {
            updates.height = diff.newValue;
          } else if (diff.field === 'weight') {
            updates.weight = diff.newValue;
          } else if (diff.field === 'disability') {
            updates.disability = diff.newValue;
          } else if (diff.field === 'religion') {
            updates.religion = diff.newValue;
          } else if (diff.field === 'parent_phone') {
            updates.parent_phone = diff.newValue;
          }
        }

        body = {
          action: 'sync_update',
          responseId: item.responseId,
          studentId: item.studentId,
          updates,
        };
      } else {
        body = {
          action: 'sync_create_student',
          responseId: item.responseId,
          newStudentPayload: item.newStudentPayload,
        };
      }

      const res = await fetch('/api/admin/forms/sync-student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'การซิงค์ข้อมูลไม่สำเร็จ');
      }

      toast.success(json.message || 'ซิงค์ข้อมูลเข้าฐานข้อมูลนักเรียนเรียบร้อย');
      setItems((prev) =>
        prev.map((i) =>
          i.responseId === item.responseId
            ? { ...i, isAlreadySynced: true, syncedAt: new Date().toISOString() }
            : i
        )
      );
    } catch (err: any) {
      console.error('Sync failed:', err);
      toast.error('ซิงค์ข้อมูลไม่สำเร็จ', { description: err?.message });
    } finally {
      setSyncingResponseId(null);
    }
  };

  const handleSyncAll = async () => {
    const pendingItems = items.filter((i) => !i.isAlreadySynced);
    if (pendingItems.length === 0) {
      toast.info('ไม่มีรายการที่รอการซิงค์');
      return;
    }

    setIsSyncingAll(true);
    let successCount = 0;

    for (const item of pendingItems) {
      try {
        let body: any = {};
        if (item.syncType === 'update_existing') {
          const updates: Record<string, any> = {};
          for (const diff of item.diffs) {
            if (diff.field === 'height') updates.height = diff.newValue;
            else if (diff.field === 'weight') updates.weight = diff.newValue;
            else if (diff.field === 'disability') updates.disability = diff.newValue;
            else if (diff.field === 'religion') updates.religion = diff.newValue;
            else if (diff.field === 'parent_phone') updates.parent_phone = diff.newValue;
          }
          body = {
            action: 'sync_update',
            responseId: item.responseId,
            studentId: item.studentId,
            updates,
          };
        } else {
          body = {
            action: 'sync_create_student',
            responseId: item.responseId,
            newStudentPayload: item.newStudentPayload,
          };
        }

        const res = await fetch('/api/admin/forms/sync-student', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          successCount++;
        }
      } catch (err) {
        console.error('Batch sync item error:', err);
      }
    }

    setIsSyncingAll(false);
    toast.success(`ซิงค์ข้อมูลสำเร็จทั้งหมด ${successCount} รายการ`);
    await loadSyncItems();
  };

  const pendingCount = items.filter((i) => !i.isAlreadySynced).length;

  if (!isLoading && items.length === 0) {
    return null; // No database sync opportunities detected in this form
  }

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs mb-8 transition-all">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                ซิงค์ข้อมูลกับฐานข้อมูลโรงเรียน (Student Database Sync)
              </h3>
              {pendingCount > 0 ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span>รอการอัปเดต {pendingCount} รายการ</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>ข้อมูลเป็นปัจจุบันแล้วทั้งหมด</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              ตรวจพบข้อมูลในแบบฟอร์มที่มีผลต่อประวัตินักเรียน คุณสามารถตรวจสอบความแตกต่างและกดบันทึกเข้าฐานข้อมูลได้ทันที
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <button
            type="button"
            onClick={loadSyncItems}
            disabled={isLoading}
            className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            title="รีเฟรชการตรวจสอบ"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {pendingCount > 0 && (
            <button
              type="button"
              onClick={handleSyncAll}
              disabled={isSyncingAll}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSyncingAll ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>กำลังซิงค์ทั้งหมด...</span>
                </>
              ) : (
                <>
                  <Database className="w-3.5 h-3.5" />
                  <span>ซิงค์ทั้งหมด ({pendingCount})</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
          <span>กำลังตรวจสอบความแตกต่างกับฐานข้อมูลนักเรียน...</span>
        </div>
      )}

      {/* Items List */}
      {!isLoading && items.length > 0 && (
        <div className="mt-4 space-y-3">
          {items.map((item) => {
            const isSyncing = syncingResponseId === item.responseId;

            return (
              <div
                key={item.responseId}
                className={`p-4 rounded-2xl border transition-all ${
                  item.isAlreadySynced
                    ? 'bg-slate-50/60 border-slate-200 opacity-75'
                    : 'bg-white border-purple-200 hover:border-purple-300 shadow-2xs'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Student Info */}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">
                        {item.studentName}
                      </span>
                      {item.studentId && (
                        <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                          รหัส {item.studentId}
                        </span>
                      )}
                      {item.studentGrade && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                          ชั้น {item.studentGrade}
                        </span>
                      )}
                      {item.syncType === 'create_new' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                          ผู้สมัครนักเรียนใหม่
                        </span>
                      )}
                    </div>

                    {/* Diffs Table */}
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {item.diffs.map((diff, dIdx) => (
                        <div
                          key={dIdx}
                          className="inline-flex items-center gap-1.5 py-1 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                        >
                          <span className="font-medium text-slate-600">{diff.labelTh}:</span>
                          <span className="text-slate-400 line-through text-[11px]">{diff.oldValue}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="font-bold text-purple-900">{diff.newValue}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="shrink-0 flex items-center gap-2 self-end md:self-center">
                    {item.isAlreadySynced ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>อัปเดตเข้าฐานข้อมูลแล้ว</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSyncItem(item)}
                        disabled={isSyncing || isSyncingAll}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
                      >
                        {isSyncing ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>กำลังบันทึก...</span>
                          </>
                        ) : item.syncType === 'create_new' ? (
                          <>
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>สร้างนักเรียนใหม่</span>
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>อัปเดตข้อมูล</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
