'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Award,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Info,
  Loader2,
  LogOut,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';
import { getBangkokDate } from '@/lib/utils';
import type {
  DailyAttendanceLogItem,
  SchoolAttendanceSummaryResponse,
} from '@/lib/attendance/analytics';

interface PersonalAttendanceSummaryProps {
  refreshTrigger?: number;
  onSummaryChange?: (
    summary: SchoolAttendanceSummaryResponse | null,
    isCurrentMonth: boolean
  ) => void;
}

function getPrevMonth(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, '0')}`;
}

function getNextMonth(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number);
  if (m === 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

function formatMonthTh(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString('th-TH', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatDateTh(isoDate: string): string {
  const [y, m, day] = isoDate.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, day));
  return d.toLocaleDateString('th-TH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

function formatTimeBkk(isoStr: string | null): string {
  if (!isoStr) return '-';
  return new Date(isoStr).toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Bangkok',
  });
}

const TONE_CLASSES: Record<
  'emerald' | 'blue' | 'slate' | 'amber' | 'rose',
  { pill: string; border: string; accent: string; bgSoft: string }
> = {
  emerald: {
    pill: 'bg-emerald-600 text-white shadow-sm',
    border: 'border-emerald-500/35',
    accent: 'text-emerald-600 dark:text-emerald-400',
    bgSoft: 'bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent',
  },
  blue: {
    pill: 'bg-blue-600 text-white shadow-sm',
    border: 'border-blue-500/35',
    accent: 'text-blue-600 dark:text-blue-400',
    bgSoft: 'bg-gradient-to-br from-blue-500/15 via-blue-500/5 to-transparent',
  },
  slate: {
    pill: 'bg-slate-700 text-white shadow-sm',
    border: 'border-slate-500/35',
    accent: 'text-slate-700 dark:text-slate-300',
    bgSoft: 'bg-gradient-to-br from-slate-500/15 via-slate-500/5 to-transparent',
  },
  amber: {
    pill: 'bg-amber-600 text-white shadow-sm',
    border: 'border-amber-500/35',
    accent: 'text-amber-600 dark:text-amber-400',
    bgSoft: 'bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent',
  },
  rose: {
    pill: 'bg-rose-600 text-white shadow-sm',
    border: 'border-rose-500/35',
    accent: 'text-rose-600 dark:text-rose-400',
    bgSoft: 'bg-gradient-to-br from-rose-500/15 via-rose-500/5 to-transparent',
  },
};

export function PersonalAttendanceSummary({
  refreshTrigger = 0,
  onSummaryChange,
}: PersonalAttendanceSummaryProps) {
  const currentBangkokMonth = getBangkokDate().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentBangkokMonth);
  const [summary, setSummary] = useState<SchoolAttendanceSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showFormula, setShowFormula] = useState<boolean>(false);
  const [showDailyLogs, setShowDailyLogs] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    const loadSummary = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/attendance/summary?month=${selectedMonth}&t=${Date.now()}`,
          {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
          }
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'ไม่สามารถโหลดสรุปการเข้างานได้');
        }
        if (active) {
          const parsed = data as SchoolAttendanceSummaryResponse;
          setSummary(parsed);
          onSummaryChange?.(parsed, selectedMonth === currentBangkokMonth);
        }
      } catch (err: any) {
        if (active) {
          setError(err?.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    loadSummary();
    return () => {
      active = false;
    };
  }, [selectedMonth, refreshTrigger]);

  const canGoNext = selectedMonth < currentBangkokMonth;

  const zClamped = summary
    ? Math.max(-2.2, Math.min(2.2, summary.benchmark.zScore))
    : 0;
  // Map [-2.2, +2.2] to [4%, 96%] width percentage
  const markerPercent = 50 + (zClamped / 2.2) * 46;

  const tone = summary
    ? TONE_CLASSES[summary.benchmark.classification.badgeTone]
    : TONE_CLASSES.slate;

  const renderStatusBadges = (log: DailyAttendanceLogItem) => {
    return (
      <div className="flex flex-wrap gap-1 justify-end">
        {log.statuses.map((st) => {
          switch (st) {
            case 'on_time':
              return (
                <span
                  key={st}
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                >
                  เข้าปกติ
                </span>
              );
            case 'late':
              return (
                <span
                  key={st}
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300"
                >
                  มาสาย
                </span>
              );
            case 'early_leave':
              return (
                <span
                  key={st}
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/15 text-orange-700 dark:text-orange-300"
                >
                  ออกก่อน
                </span>
              );
            case 'missing_checkout':
              return (
                <span
                  key={st}
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-700 dark:text-purple-300"
                >
                  ไม่ลงชื่อออก
                </span>
              );
            case 'leave':
              return (
                <span
                  key={st}
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-700 dark:text-sky-300"
                >
                  ลา / ราชการ
                </span>
              );
            case 'absent':
              return (
                <span
                  key={st}
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300"
                >
                  ขาดงาน
                </span>
              );
          }
        })}
      </div>
    );
  };

  return (
    <div
      id="personal-attendance-summary"
      className="bg-surface backdrop-blur-xl p-6 md:p-8 rounded-3xl shadow-xl border-2 border-primary/15 space-y-6"
    >
      {/* Header & Month Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-extrabold text-foreground text-base leading-tight">
              สรุปการเข้างานของฉัน
            </h2>
            <p className="text-[11px] text-foreground/55">
              สถิติรายเดือนและระดับเทียบค่ามาตรฐาน (S.D.) โรงเรียน
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end bg-foreground/5 rounded-xl p-1 border border-foreground/10">
          <button
            type="button"
            onClick={() => setSelectedMonth(getPrevMonth(selectedMonth))}
            className="p-1.5 rounded-lg hover:bg-foreground/10 text-foreground/70 transition-colors"
            aria-label="เดือนก่อนหน้า"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="px-3 text-xs font-bold text-foreground flex items-center gap-1.5 min-w-[130px] justify-center">
            <Calendar className="w-3.5 h-3.5 text-primary" />
            <span>{formatMonthTh(selectedMonth)}</span>
          </div>
          <button
            type="button"
            disabled={!canGoNext}
            onClick={() => canGoNext && setSelectedMonth(getNextMonth(selectedMonth))}
            className="p-1.5 rounded-lg hover:bg-foreground/10 text-foreground/70 transition-colors disabled:opacity-30 disabled:pointer-events-none"
            aria-label="เดือนถัดไป"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-10 text-foreground/50">
          <Loader2 className="w-7 h-7 animate-spin text-primary/60 mb-2" />
          <span className="text-xs font-medium">กำลังประมวลผลสถิติการเข้างาน...</span>
        </div>
      ) : error ? (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : summary ? (
        <>
          {/* Hero School S.D. Benchmark Card (Placed First for High Visual Prominence) */}
          <div className={`p-5 md:p-6 rounded-2xl border-2 ${tone.border} ${tone.bgSoft} shadow-md space-y-4`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Award className={`w-4 h-4 ${tone.accent}`} />
                  <span className="text-xs font-bold text-foreground/75">
                    ระดับ Performance เทียบ S.D. โรงเรียน
                  </span>
                </div>
                {summary.benchmark.insufficientData ? (
                  <p className="text-xs text-foreground/65">
                    ข้อมูลในเดือนนี้ยังมีไม่ถึง 3 คน จึงยังไม่สามารถคำนวณ S.D. เปรียบเทียบได้
                  </p>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-3.5 py-1 rounded-full text-xs font-black ${tone.pill}`}>
                      {summary.benchmark.classification.labelTh}
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-xs font-black bg-surface/90 border border-foreground/15 text-foreground tabular-nums">
                      {summary.benchmark.zScore >= 0 ? '+' : ''}
                      {summary.benchmark.zScore.toFixed(2)} S.D.
                    </span>
                  </div>
                )}
              </div>

              <div className="text-right">
                <div className="text-[11px] font-bold text-foreground/60">คะแนนวินัยเดือนนี้</div>
                <div className={`text-4xl font-black leading-none tabular-nums ${tone.accent}`}>
                  {summary.personal.score}
                  <span className="text-xs font-bold text-foreground/45 ml-1">/ 100</span>
                </div>
              </div>
            </div>

            {!summary.benchmark.insufficientData && (
              <>
                <p className="text-xs text-foreground/80 leading-relaxed font-medium">
                  {summary.benchmark.classification.descriptionTh}
                </p>

                {/* 5-Zone S.D. Gauge */}
                <div className="space-y-1.5 pt-1">
                  <div className="relative h-3.5 w-full rounded-full overflow-hidden flex border border-foreground/15 shadow-inner">
                    <div className="h-full bg-rose-500/80" style={{ width: '27.3%' }} title="< -1.0 SD" />
                    <div className="h-full bg-amber-400/85" style={{ width: '11.4%' }} title="-1.0 to -0.5 SD" />
                    <div className="h-full bg-slate-400/75" style={{ width: '22.6%' }} title="-0.5 to +0.5 SD" />
                    <div className="h-full bg-blue-500/80" style={{ width: '11.4%' }} title="+0.5 to +1.0 SD" />
                    <div className="h-full bg-emerald-500/85" style={{ width: '27.3%' }} title=">= +1.0 SD" />
                  </div>
                  <div className="relative h-4">
                    <div
                      className="absolute -top-4.5 -translate-x-1/2 flex flex-col items-center transition-all duration-300"
                      style={{ left: `${markerPercent}%` }}
                    >
                      <div className="w-4 h-4 rounded-full bg-foreground border-2 border-surface shadow-md" />
                    </div>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold text-foreground/55 tabular-nums -mt-2">
                    <span>-2 S.D.</span>
                    <span>-1 S.D.</span>
                    <span>ค่าเฉลี่ย (0)</span>
                    <span>+1 S.D.</span>
                    <span>+2 S.D.</span>
                  </div>
                </div>

                {/* Comparison Stats Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs">
                  <div className="p-3 rounded-xl bg-surface/85 border border-foreground/10 flex items-center justify-between">
                    <span className="text-foreground/65 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-primary" />
                      ค่าเฉลี่ยโรงเรียน ({summary.benchmark.cohortSize} คน)
                    </span>
                    <span className="font-black text-foreground tabular-nums">
                      {summary.benchmark.schoolMean.toFixed(1)} ± {summary.benchmark.schoolSd.toFixed(1)}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-surface/85 border border-foreground/10 flex items-center justify-between">
                    <span className="text-foreground/65 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-primary" />
                      เวลาเข้าเฉลี่ย (คุณ / รร.)
                    </span>
                    <span className="font-black text-foreground tabular-nums">
                      {summary.personal.avgCheckInTime || '-'} / {summary.benchmark.schoolAvgCheckInTime || '-'} น.
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* Formula Info Toggle */}
            <div className="pt-1 border-t border-foreground/10">
              <button
                type="button"
                onClick={() => setShowFormula((v) => !v)}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-primary hover:underline"
              >
                <Info className="w-3.5 h-3.5" />
                <span>{showFormula ? 'ซ่อนเกณฑ์การคำนวณคะแนน' : 'ดูเกณฑ์การคำนวณคะแนนและ S.D.'}</span>
              </button>
              {showFormula && (
                <div className="mt-2 text-[11px] text-foreground/70 space-y-1 leading-relaxed bg-surface/80 p-3 rounded-xl border border-foreground/10">
                  <div>
                    <strong>คะแนนตั้งต้น 100 คะแนน:</strong> หัก ขาดงาน −{summary.cutoffs.penalties.absent}, มาสาย −{summary.cutoffs.penalties.late}, ออกก่อนเวลา −{summary.cutoffs.penalties.earlyLeave}, ไม่ได้ลงชื่อออก −{summary.cutoffs.penalties.missingCheckout} (วันลา/ราชการ ไม่หักคะแนน)
                  </div>
                  <div>
                    <strong>การเทียบ S.D.:</strong> Z = (คะแนนของคุณ − ค่าเฉลี่ยโรงเรียน) ÷ S.D. ของบุคลากรที่ลงเวลาในเดือนนั้น
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 6-Stat Monthly Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 shadow-xs">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 mb-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>มาทำงาน</span>
              </div>
              <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 tabular-nums">
                {summary.personal.presentDays}
                <span className="text-xs font-semibold text-foreground/50 ml-1">
                  / {summary.elapsedWorkingDays} วัน
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 shadow-xs">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-300 mb-1">
                <Clock className="w-3.5 h-3.5" />
                <span>มาสาย (&gt;{summary.cutoffs.lateCutoffTime})</span>
              </div>
              <div className="text-2xl font-black text-amber-700 dark:text-amber-300 tabular-nums">
                {summary.personal.lateCount}
                <span className="text-xs font-semibold text-foreground/50 ml-1">ครั้ง</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 shadow-xs">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-700 dark:text-rose-300 mb-1">
                <XCircle className="w-3.5 h-3.5" />
                <span>ขาดงาน</span>
              </div>
              <div className="text-2xl font-black text-rose-700 dark:text-rose-300 tabular-nums">
                {summary.personal.absentCount}
                <span className="text-xs font-semibold text-foreground/50 ml-1">ครั้ง</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/30 shadow-xs">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-sky-700 dark:text-sky-300 mb-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>ลา / ราชการ</span>
              </div>
              <div className="text-2xl font-black text-sky-700 dark:text-sky-300 tabular-nums">
                {summary.personal.leaveCount}
                <span className="text-xs font-semibold text-foreground/50 ml-1">ครั้ง</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30 shadow-xs">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-purple-700 dark:text-purple-300 mb-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>ไม่ได้ลงชื่อออก</span>
              </div>
              <div className="text-2xl font-black text-purple-700 dark:text-purple-300 tabular-nums">
                {summary.personal.missingCheckoutCount}
                <span className="text-xs font-semibold text-foreground/50 ml-1">ครั้ง</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/30 shadow-xs">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-orange-700 dark:text-orange-300 mb-1">
                <LogOut className="w-3.5 h-3.5" />
                <span>ออกก่อน (&lt;{summary.cutoffs.earlyLeaveTime})</span>
              </div>
              <div className="text-2xl font-black text-orange-700 dark:text-orange-300 tabular-nums">
                {summary.personal.earlyLeaveCount}
                <span className="text-xs font-semibold text-foreground/50 ml-1">ครั้ง</span>
              </div>
            </div>
          </div>

          {/* Collapsible Personal Daily History */}
          <div className="border border-foreground/10 rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowDailyLogs((v) => !v)}
              className="w-full px-4 py-3 bg-foreground/[0.03] hover:bg-foreground/[0.06] flex items-center justify-between text-xs font-bold text-foreground transition-colors"
            >
              <span>ดูประวัติการเข้างานรายวันของฉัน ({summary.personal.dailyLogs.length} วัน)</span>
              {showDailyLogs ? (
                <ChevronUp className="w-4 h-4 text-foreground/60" />
              ) : (
                <ChevronDown className="w-4 h-4 text-foreground/60" />
              )}
            </button>

            {showDailyLogs && (
              <div className="max-h-72 overflow-y-auto divide-y divide-foreground/5">
                {summary.personal.dailyLogs.length === 0 ? (
                  <div className="p-6 text-center text-xs text-foreground/45">
                    ยังไม่มีข้อมูลการเข้างานในเดือนนี้
                  </div>
                ) : (
                  summary.personal.dailyLogs.map((log) => (
                    <div
                      key={log.date}
                      className="px-4 py-2.5 flex items-center justify-between gap-2 text-xs hover:bg-foreground/[0.02]"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-foreground">{formatDateTh(log.date)}</div>
                        <div className="text-[11px] text-foreground/55 tabular-nums">
                          เข้า {formatTimeBkk(log.checkInTime)} • ออก {formatTimeBkk(log.checkOutTime)}
                        </div>
                      </div>
                      {renderStatusBadges(log)}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
