'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  ArrowDown,
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  LogOut,
  Sparkles,
  TrendingUp,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import type { SchoolAttendanceSummaryResponse } from '@/lib/attendance/analytics';

export interface PunchInfo {
  action: 'check_in' | 'check_out' | 'preview';
  timeStr?: string | null;
  isLate?: boolean;
  isEarlyLeave?: boolean;
}

interface PostPunchStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScrollToDetails: () => void;
  punchInfo: PunchInfo | null;
  summary: SchoolAttendanceSummaryResponse | null;
  isLoading: boolean;
}

const MODAL_TONES: Record<
  'emerald' | 'blue' | 'slate' | 'amber' | 'rose',
  {
    pill: string;
    heroBg: string;
    heroBorder: string;
    accentText: string;
  }
> = {
  emerald: {
    pill: 'bg-emerald-600 text-white shadow-emerald-600/25',
    heroBg: 'from-emerald-500/15 via-emerald-500/5 to-transparent',
    heroBorder: 'border-emerald-500/30',
    accentText: 'text-emerald-700 dark:text-emerald-300',
  },
  blue: {
    pill: 'bg-blue-600 text-white shadow-blue-600/25',
    heroBg: 'from-blue-500/15 via-blue-500/5 to-transparent',
    heroBorder: 'border-blue-500/30',
    accentText: 'text-blue-700 dark:text-blue-300',
  },
  slate: {
    pill: 'bg-slate-700 text-white shadow-slate-700/25',
    heroBg: 'from-slate-500/15 via-slate-500/5 to-transparent',
    heroBorder: 'border-slate-500/30',
    accentText: 'text-slate-700 dark:text-slate-300',
  },
  amber: {
    pill: 'bg-amber-600 text-white shadow-amber-600/25',
    heroBg: 'from-amber-500/15 via-amber-500/5 to-transparent',
    heroBorder: 'border-amber-500/30',
    accentText: 'text-amber-700 dark:text-amber-300',
  },
  rose: {
    pill: 'bg-rose-600 text-white shadow-rose-600/25',
    heroBg: 'from-rose-500/15 via-rose-500/5 to-transparent',
    heroBorder: 'border-rose-500/30',
    accentText: 'text-rose-700 dark:text-rose-300',
  },
};

export function PostPunchStatsModal({
  isOpen,
  onClose,
  onScrollToDetails,
  punchInfo,
  summary,
  isLoading,
}: PostPunchStatsModalProps) {
  const toneKey = summary?.benchmark.classification.badgeTone || 'slate';
  const tone = MODAL_TONES[toneKey];

  const zClamped = summary
    ? Math.max(-2.2, Math.min(2.2, summary.benchmark.zScore))
    : 0;
  const markerPercent = 50 + (zClamped / 2.2) * 46;

  const isCheckIn = punchInfo?.action === 'check_in';
  const isCheckOut = punchInfo?.action === 'check_out';

  const headerGradient = isCheckIn
    ? 'from-emerald-600 to-teal-600'
    : isCheckOut
    ? 'from-blue-600 to-indigo-600'
    : 'from-primary to-[#7B1C3E]';

  const headerTitle = isCheckIn
    ? `ลงเวลาเข้างานสำเร็จ! ${punchInfo?.timeStr ? `${punchInfo.timeStr} น.` : ''}`
    : isCheckOut
    ? `ลงเวลาออกงานสำเร็จ! ${punchInfo?.timeStr ? `${punchInfo.timeStr} น.` : ''}`
    : 'สรุปสถิติการเข้างานเดือนนี้';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ type: 'spring', duration: 0.35 }}
            className="bg-surface border border-foreground/10 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
          >
            {/* Gradient Celebration Header */}
            <div
              className={`bg-gradient-to-r ${headerGradient} text-white p-5 flex items-start justify-between gap-3`}
            >
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                  {isCheckIn || isCheckOut ? (
                    <CheckCircle2 className="w-6 h-6 text-white" />
                  ) : (
                    <Activity className="w-6 h-6 text-white" />
                  )}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-black text-base md:text-lg leading-tight">
                      {headerTitle}
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    {isCheckIn && (
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          punchInfo?.isLate
                            ? 'bg-amber-400 text-amber-950'
                            : 'bg-white/25 text-white'
                        }`}
                      >
                        {punchInfo?.isLate ? 'มาสาย (> 07:30)' : 'ตรงเวลา'}
                      </span>
                    )}
                    {isCheckOut && (
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          punchInfo?.isEarlyLeave
                            ? 'bg-amber-400 text-amber-950'
                            : 'bg-white/25 text-white'
                        }`}
                      >
                        {punchInfo?.isEarlyLeave ? 'ออกก่อน 17:00' : 'ครบเวลาทำงาน'}
                      </span>
                    )}
                    <span className="text-xs text-white/85">
                      อัปเดตสถิติและอันดับ S.D. ประจำเดือนล่าสุดแล้ว
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white shrink-0 transition-colors"
                aria-label="ปิดหน้าต่าง"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 md:p-6 overflow-y-auto space-y-4">
              {isLoading && !summary ? (
                <div className="py-12 flex flex-col items-center justify-center text-foreground/55">
                  <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
                  <p className="text-xs font-bold">กำลังคำนวณสถิติล่าสุดของคุณ...</p>
                </div>
              ) : summary ? (
                <>
                  {/* Hero Score + S.D. Performance Block */}
                  <div
                    className={`p-4 md:p-5 rounded-2xl border ${tone.heroBorder} bg-gradient-to-br ${tone.heroBg} space-y-3.5`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-foreground/65 mb-1.5">
                          <Award className={`w-4 h-4 ${tone.accentText}`} />
                          <span>ระดับ Performance เทียบ S.D. โรงเรียน</span>
                        </div>
                        {summary.benchmark.insufficientData ? (
                          <span className="text-xs font-semibold text-foreground/65">
                            ข้อมูลบุคลากรเดือนนี้ยังไม่ครบ 3 คน
                          </span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-black shadow-sm ${tone.pill}`}
                            >
                              {summary.benchmark.classification.labelTh}
                            </span>
                            <span className="px-2.5 py-1 rounded-full text-xs font-black bg-surface border border-foreground/15 text-foreground tabular-nums">
                              {summary.benchmark.zScore >= 0 ? '+' : ''}
                              {summary.benchmark.zScore.toFixed(2)} S.D.
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-[11px] font-bold text-foreground/55">
                          คะแนนวินัย
                        </div>
                        <div className={`text-4xl font-black leading-none tabular-nums ${tone.accentText}`}>
                          {summary.personal.score}
                          <span className="text-xs font-bold text-foreground/45 ml-1">
                            /100
                          </span>
                        </div>
                      </div>
                    </div>

                    {!summary.benchmark.insufficientData && (
                      <>
                        {/* 5-Zone Gauge */}
                        <div className="space-y-1.5 pt-1">
                          <div className="relative h-3.5 w-full rounded-full overflow-hidden flex border border-foreground/10 shadow-inner">
                            <div className="h-full bg-rose-500/80" style={{ width: '27.3%' }} />
                            <div className="h-full bg-amber-400/85" style={{ width: '11.4%' }} />
                            <div className="h-full bg-slate-400/75" style={{ width: '22.6%' }} />
                            <div className="h-full bg-blue-500/80" style={{ width: '11.4%' }} />
                            <div className="h-full bg-emerald-500/85" style={{ width: '27.3%' }} />
                          </div>
                          <div className="relative h-4">
                            <div
                              className="absolute -top-4.5 -translate-x-1/2 flex flex-col items-center transition-all duration-500"
                              style={{ left: `${markerPercent}%` }}
                            >
                              <div className="w-4 h-4 rounded-full bg-foreground border-2 border-surface shadow-md" />
                            </div>
                          </div>
                          <div className="flex justify-between text-[10px] font-bold text-foreground/50 tabular-nums -mt-2">
                            <span>-2 S.D.</span>
                            <span>ค่าเฉลี่ย รร. (0)</span>
                            <span>+2 S.D.</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="px-3 py-2 rounded-xl bg-surface/85 border border-foreground/10 flex items-center justify-between">
                            <span className="text-foreground/60 flex items-center gap-1">
                              <Users className="w-3.5 h-3.5 text-primary" />
                              รร. ({summary.benchmark.cohortSize} คน)
                            </span>
                            <span className="font-black text-foreground tabular-nums">
                              {summary.benchmark.schoolMean.toFixed(1)} ± {summary.benchmark.schoolSd.toFixed(1)}
                            </span>
                          </div>
                          <div className="px-3 py-2 rounded-xl bg-surface/85 border border-foreground/10 flex items-center justify-between">
                            <span className="text-foreground/60 flex items-center gap-1">
                              <TrendingUp className="w-3.5 h-3.5 text-primary" />
                              เข้าเฉลี่ย
                            </span>
                            <span className="font-black text-foreground tabular-nums">
                              {summary.personal.avgCheckInTime || '-'} / {summary.benchmark.schoolAvgCheckInTime || '-'}
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* 6-Stat Mini Grid */}
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-center">
                      <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>มาทำงาน</span>
                      </div>
                      <div className="text-xl font-black text-emerald-700 dark:text-emerald-300 tabular-nums mt-0.5">
                        {summary.personal.presentDays}
                        <span className="text-[11px] font-semibold text-foreground/50">
                          /{summary.elapsedWorkingDays}
                        </span>
                      </div>
                    </div>

                    <div
                      className={`p-3 rounded-2xl border text-center ${
                        summary.personal.lateCount > 0
                          ? 'bg-amber-500/15 border-amber-500/35'
                          : 'bg-amber-500/5 border-amber-500/20'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                        <Clock className="w-3 h-3" />
                        <span>มาสาย</span>
                      </div>
                      <div className="text-xl font-black text-amber-700 dark:text-amber-300 tabular-nums mt-0.5">
                        {summary.personal.lateCount}
                        <span className="text-[10px] font-semibold text-foreground/50 ml-0.5">ครั้ง</span>
                      </div>
                    </div>

                    <div
                      className={`p-3 rounded-2xl border text-center ${
                        summary.personal.absentCount > 0
                          ? 'bg-rose-500/15 border-rose-500/35'
                          : 'bg-rose-500/5 border-rose-500/20'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-rose-700 dark:text-rose-300">
                        <XCircle className="w-3 h-3" />
                        <span>ขาดงาน</span>
                      </div>
                      <div className="text-xl font-black text-rose-700 dark:text-rose-300 tabular-nums mt-0.5">
                        {summary.personal.absentCount}
                        <span className="text-[10px] font-semibold text-foreground/50 ml-0.5">ครั้ง</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-center">
                      <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-sky-700 dark:text-sky-300">
                        <Calendar className="w-3 h-3" />
                        <span>ลา/ราชการ</span>
                      </div>
                      <div className="text-xl font-black text-sky-700 dark:text-sky-300 tabular-nums mt-0.5">
                        {summary.personal.leaveCount}
                        <span className="text-[10px] font-semibold text-foreground/50 ml-0.5">ครั้ง</span>
                      </div>
                    </div>

                    <div
                      className={`p-3 rounded-2xl border text-center ${
                        summary.personal.missingCheckoutCount > 0
                          ? 'bg-purple-500/15 border-purple-500/35'
                          : 'bg-purple-500/5 border-purple-500/20'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-purple-700 dark:text-purple-300">
                        <AlertCircle className="w-3 h-3" />
                        <span>ไม่ลงออก</span>
                      </div>
                      <div className="text-xl font-black text-purple-700 dark:text-purple-300 tabular-nums mt-0.5">
                        {summary.personal.missingCheckoutCount}
                        <span className="text-[10px] font-semibold text-foreground/50 ml-0.5">ครั้ง</span>
                      </div>
                    </div>

                    <div
                      className={`p-3 rounded-2xl border text-center ${
                        summary.personal.earlyLeaveCount > 0
                          ? 'bg-orange-500/15 border-orange-500/35'
                          : 'bg-orange-500/5 border-orange-500/20'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-orange-700 dark:text-orange-300">
                        <LogOut className="w-3 h-3" />
                        <span>ออกก่อน</span>
                      </div>
                      <div className="text-xl font-black text-orange-700 dark:text-orange-300 tabular-nums mt-0.5">
                        {summary.personal.earlyLeaveCount}
                        <span className="text-[10px] font-semibold text-foreground/50 ml-0.5">ครั้ง</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-8 text-center text-xs text-foreground/55">
                  ไม่สามารถโหลดข้อมูลสถิติได้ในขณะนี้
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-foreground/10 bg-foreground/[0.02] flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onScrollToDetails();
                }}
                className="px-3.5 py-2.5 rounded-xl bg-foreground/5 hover:bg-foreground/10 text-foreground/80 font-bold text-xs flex items-center gap-1.5 transition-all"
              >
                <ArrowDown className="w-3.5 h-3.5" />
                <span>ดูประวัติรายวันด้านล่าง</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs shadow-md flex items-center gap-1.5 transition-all active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>รับทราบ / ปิดหน้าต่าง</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
