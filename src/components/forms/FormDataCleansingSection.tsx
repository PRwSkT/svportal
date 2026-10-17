'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, RefreshCw, CheckCircle2, ArrowRight,
  Loader2, AlertCircle, Database, Phone, UserCheck, ShieldCheck,
  Filter, Check, ChevronDown, ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';
import { FormCleansingAnalysis, ResponseCleansingItem } from '@/lib/forms/data-cleansing';

interface FormDataCleansingSectionProps {
  formId: string;
}

export function FormDataCleansingSection({ formId }: FormDataCleansingSectionProps) {
  const [data, setData] = useState<FormCleansingAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cleansingResponseId, setCleansingResponseId] = useState<string | null>(null);
  const [isCleansingAll, setIsCleansingAll] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'needing' | 'all'>('needing');

  const loadCleansingData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/forms/cleanse-responses?formId=${formId}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setData(json.data || null);
      }
    } catch (err) {
      console.error('Failed to load cleansing data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCleansingData();
    const handleCleansed = () => loadCleansingData();
    window.addEventListener('form-responses-cleansed', handleCleansed);
    return () => window.removeEventListener('form-responses-cleansed', handleCleansed);
  }, [formId]);

  const handleCleanseSingle = async (item: ResponseCleansingItem) => {
    setCleansingResponseId(item.responseId);
    try {
      const res = await fetch('/api/admin/forms/cleanse-responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formId,
          items: [{ responseId: item.responseId, cleanedAnswers: item.cleanedAnswers }],
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'ทำความสะอาดข้อมูลไม่สำเร็จ');
      }

      toast.success(json.message || 'ปรับปรุงข้อมูลรายการนี้เรียบร้อยแล้ว');
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          totalNeedingCleansing: Math.max(0, prev.totalNeedingCleansing - 1),
          items: prev.items.map((i) =>
            i.responseId === item.responseId
              ? { ...i, changes: [], isAlreadyCleaned: true }
              : i
          ),
        };
      });
      window.dispatchEvent(new CustomEvent('form-responses-cleansed'));
      window.dispatchEvent(new CustomEvent('student-database-synced'));
    } catch (err: any) {
      console.error('Cleanse single failed:', err);
      toast.error('ปรับปรุงไม่สำเร็จ', { description: err?.message });
    } finally {
      setCleansingResponseId(null);
    }
  };

  const handleCleanseAll = async () => {
    if (!data || data.totalNeedingCleansing === 0) {
      toast.info('ไม่มีรายการที่ต้องทำความสะอาด ข้อมูลทุกรายการถูกต้องตามมาตรฐานแล้ว');
      return;
    }

    setIsCleansingAll(true);
    try {
      const itemsToCleanse = data.items
        .filter((i) => i.changes.length > 0)
        .map((i) => ({
          responseId: i.responseId,
          cleanedAnswers: i.cleanedAnswers,
        }));

      const res = await fetch('/api/admin/forms/cleanse-responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formId,
          items: itemsToCleanse,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'การทำความสะอาดข้อมูลไม่สำเร็จ');
      }

      toast.success(json.message || `ทำความสะอาดข้อมูลสำเร็จ ${json.totalSuccess || itemsToCleanse.length} รายการ`);
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          totalNeedingCleansing: 0,
          items: prev.items.map((i) => ({ ...i, changes: [], isAlreadyCleaned: true })),
        };
      });
      window.dispatchEvent(new CustomEvent('form-responses-cleansed'));
      window.dispatchEvent(new CustomEvent('student-database-synced'));
    } catch (err: any) {
      console.error('Cleanse all failed:', err);
      toast.error('ทำความสะอาดข้อมูลไม่สำเร็จ', { description: err?.message });
    } finally {
      setIsCleansingAll(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 text-sky-600 animate-spin" />
        <p className="text-xs font-semibold text-slate-500">น้องฟ้ากำลังตรวจสอบและวิเคราะห์การทำความสะอาดข้อมูล...</p>
      </div>
    );
  }

  if (!data) return null;

  const displayItems =
    filterMode === 'needing'
      ? data.items.filter((i) => i.changes.length > 0)
      : data.items;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-sky-900 via-teal-900 to-sky-950 text-white p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
              <Sparkles className="w-5 h-5 text-sky-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-sky-400/20 text-sky-200 border border-sky-400/30">
                  Data Cleansing & Database Enrichment
                </span>
                <span className="text-xs text-sky-200/80">ตรวจพบ {data.totalNeedingCleansing} จาก {data.totalResponses} รายการ</span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white mt-1">
                ทำความสะอาดและจัดฟอร์แมตข้อมูลการตอบกลับ (น้องฟ้า AI)
              </h3>
              <p className="text-xs text-sky-100/80 mt-1 max-w-2xl leading-relaxed">
                ระบบนำข้อมูลนักเรียนจากฐานข้อมูลโรงเรียนสมคิดวิทยามาเติมฟิลด์ที่ขาดหาย เช่น รหัสนักเรียน พร้อมจัดมาตรฐานเบอร์โทรศัพท์ 10 หลัก จัดห้องเรียน และคัดกรองข้อมูลการแพ้
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={loadCleansingData}
              disabled={isLoading}
              className="p-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl transition-all cursor-pointer"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              disabled={isCleansingAll || data.totalNeedingCleansing === 0}
              onClick={handleCleanseAll}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCleansingAll ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>กำลังดำเนินการ...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-100" />
                  <span>ทำความสะอาดทั้งหมด ({data.totalNeedingCleansing} รายการ)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-5 pt-4 border-t border-white/15">
          <div className="bg-white/10 rounded-xl p-2.5">
            <div className="text-[10px] text-sky-200 font-medium">เติมรหัสนักเรียนจาก DB</div>
            <div className="text-lg font-bold text-white mt-0.5">{data.stats.studentIdsEnriched} <span className="text-[11px] font-normal text-sky-200">คน</span></div>
          </div>
          <div className="bg-white/10 rounded-xl p-2.5">
            <div className="text-[10px] text-sky-200 font-medium">ปรับเบอร์โทร 10 หลัก</div>
            <div className="text-lg font-bold text-white mt-0.5">{data.stats.phonesFormatted} <span className="text-[11px] font-normal text-sky-200">เบอร์</span></div>
          </div>
          <div className="bg-white/10 rounded-xl p-2.5">
            <div className="text-[10px] text-sky-200 font-medium">คัดกรองชื่อ-นามสกุล</div>
            <div className="text-lg font-bold text-white mt-0.5">{data.stats.namesCleaned} <span className="text-[11px] font-normal text-sky-200">คน</span></div>
          </div>
          <div className="bg-white/10 rounded-xl p-2.5">
            <div className="text-[10px] text-sky-200 font-medium">จัดมาตรฐานการแพ้อาหาร</div>
            <div className="text-lg font-bold text-white mt-0.5">{data.stats.allergiesStandardized} <span className="text-[11px] font-normal text-sky-200">รายการ</span></div>
          </div>
          <div className="bg-white/10 rounded-xl p-2.5">
            <div className="text-[10px] text-sky-200 font-medium">จัดห้องเรียนมาตรฐาน</div>
            <div className="text-lg font-bold text-white mt-0.5">{data.stats.classroomsAligned} <span className="text-[11px] font-normal text-sky-200">รายการ</span></div>
          </div>
        </div>
      </div>

      {/* Filter and List Toolbar */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilterMode('needing')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterMode === 'needing'
                ? 'bg-sky-800 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            รายการที่ต้องทำความสะอาด ({data.totalNeedingCleansing})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterMode === 'all'
                ? 'bg-sky-800 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            การตอบกลับทั้งหมด ({data.totalResponses})
          </button>
        </div>

        <span className="text-xs text-slate-500 hidden sm:inline">
          แสดง {displayItems.length} รายการ
        </span>
      </div>

      {/* Items List */}
      <div className="p-4 sm:p-5 space-y-3">
        {displayItems.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-800">ข้อมูลทุกรายการผ่านการทำความสะอาดและจัดฟอร์แมตสมบูรณ์แล้ว</p>
            <p className="text-xs text-slate-500 mt-1">ไม่มีรายการที่ต้องปรับปรุงเพิ่มเติมในขณะนี้ค่ะ</p>
          </div>
        ) : (
          displayItems.map((item, idx) => {
            const isCleansingThis = cleansingResponseId === item.responseId;
            const isExpanded = expandedId === item.responseId;
            const hasChanges = item.changes.length > 0;

            return (
              <div
                key={item.responseId || idx}
                className={`border rounded-2xl transition-all ${
                  hasChanges
                    ? 'border-sky-200 bg-white hover:border-sky-300'
                    : 'border-slate-200 bg-slate-50/60'
                }`}
              >
                <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                        hasChanges
                          ? 'bg-sky-100 text-sky-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 truncate">
                          {item.studentName}
                        </span>
                        {item.matchedStudentId && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200 shrink-0">
                            รหัส {item.matchedStudentId}
                          </span>
                        )}
                        {!hasChanges && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                            ข้อมูลสะอาดแล้ว
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                        {hasChanges ? (
                          <span className="text-sky-700 font-medium">
                            ตรวจพบ {item.changes.length} จุดที่ต้องปรับปรุง
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-medium">
                            จัดฟอร์แมตถูกต้องตามมาตรฐาน
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    {hasChanges && (
                      <button
                        type="button"
                        onClick={() => handleCleanseSingle(item)}
                        disabled={isCleansingThis || isCleansingAll}
                        className="px-3.5 py-1.5 bg-sky-700 hover:bg-sky-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isCleansingThis ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                            <span>กำลังแก้ไข...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-sky-200" />
                            <span>แก้ไขทันที</span>
                          </>
                        )}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : item.responseId)}
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                      title={isExpanded ? 'ซ่อนรายละเอียด' : 'ดูรายละเอียดการแก้ไข'}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Collapsible Details */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="px-4 pb-4 pt-1 border-t border-slate-100 overflow-hidden"
                    >
                      {hasChanges ? (
                        <div className="space-y-2 pt-2">
                          <div className="text-[11px] font-bold text-slate-600">
                            การปรับปรุงข้อมูลที่ระบบจะดำเนินการ:
                          </div>
                          {item.changes.map((ch, cIdx) => (
                            <div
                              key={cIdx}
                              className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                            >
                              <div>
                                <span className="font-bold text-slate-800 mr-2">
                                  {ch.fieldLabel}:
                                </span>
                                <span className="line-through text-slate-400 mr-2">
                                  {String(ch.oldValue ?? '(ว่าง)')}
                                </span>
                                <ArrowRight className="w-3 h-3 inline text-slate-400 mr-2" />
                                <span className="font-bold text-emerald-700">
                                  {String(ch.newValue)}
                                </span>
                              </div>
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 shrink-0 self-start sm:self-auto">
                                {ch.reason}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-2 text-xs text-slate-500">
                          ข้อมูลในรายการนี้ไม่มีส่วนใดที่ผิดเพี้ยนหรือตกหล่นค่ะ
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
