'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  HelpCircle, 
  X, 
  Smartphone, 
  Compass, 
  Info,
  Bell,
  ShieldCheck,
  AlertTriangle,
  CalendarPlus,
  LayoutDashboard,
  Maximize2
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { getBangkokDate } from '@/lib/utils';
import {
  MIN_CHECKOUT_ELAPSED_MINUTES,
  getBangkokMinutesOfDay,
  EARLY_LEAVE_TIME,
  isLateCheckIn,
  isEarlyCheckOut,
  type SchoolAttendanceSummaryResponse,
} from '@/lib/attendance/analytics';
import {
  getExistingPushSubscription,
  subscribeToPushNotifications,
} from '@/lib/notifications/client';
import { PersonalAttendanceSummary } from '@/components/attendance/PersonalAttendanceSummary';
import {
  PostPunchStatsModal,
  type PunchInfo,
} from '@/components/attendance/PostPunchStatsModal';

type AttendanceRecord = {
  id: string;
  check_in_time: string | null;
  check_out_time: string | null;
  date: string;
};

export default function AttendanceClient() {
  const { user, role, appUser, isLoading: authLoading } = useAuth();
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [submittingAction, setSubmittingAction] = useState<'check_in' | 'check_out' | null>(null);
  const [submittingStep, setSubmittingStep] = useState<string>('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [summaryRefreshKey, setSummaryRefreshKey] = useState(0);
  const [currentMonthSummary, setCurrentMonthSummary] =
    useState<SchoolAttendanceSummaryResponse | null>(null);
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [statsModalLoading, setStatsModalLoading] = useState(false);
  const [statsModalPunchInfo, setStatsModalPunchInfo] = useState<PunchInfo | null>(null);

  // Modals & Detection
  const [showCheckoutConfirmModal, setShowCheckoutConfirmModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [helpTab, setHelpTab] = useState<'samsung' | 'chrome' | 'line'>('samsung');
  const [isLineBrowser, setIsLineBrowser] = useState(false);
  const [isIosSafariBrowser, setIsIosSafariBrowser] = useState(false);

  // Push opt-in banner state
  const [pushStatus, setPushStatus] = useState<'checking' | 'subscribed' | 'unsubscribed' | 'unsupported'>('checking');
  const [isSubscribingPush, setIsSubscribingPush] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ua = navigator.userAgent || '';
      setIsLineBrowser(/Line\//i.test(ua));
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone;
      const isIos = /iPad|iPhone|iPod/i.test(ua);
      setIsIosSafariBrowser(isIos && !standalone);

      if (/SamsungBrowser/i.test(ua)) {
        setHelpTab('samsung');
      } else {
        setHelpTab('chrome');
      }

      // Silent GPS pre-warming ONLY if permission was already granted (no unsolicited prompt)
      if ('permissions' in navigator && 'geolocation' in navigator) {
        navigator.permissions
          .query({ name: 'geolocation' as PermissionName })
          .then((res) => {
            if (res.state === 'granted') {
              navigator.geolocation.getCurrentPosition(
                () => {},
                () => {},
                { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
              );
            }
          })
          .catch(() => {});
      }

      // Check Web Push subscription status
      if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        setPushStatus('unsupported');
      } else {
        getExistingPushSubscription()
          .then((sub) => setPushStatus(sub ? 'subscribed' : 'unsubscribed'))
          .catch(() => setPushStatus('unsubscribed'));
      }
    }
  }, []);

  const fetchRecord = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/attendance?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setRecord(data.record || null);
      }
    } catch (error) {
      console.error('Failed to fetch attendance record:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecord();
  }, []);

  /**
   * Smart Robust Geolocation with 2-Stage Fallback
   * 1. Stage 1: High Accuracy GPS (12s timeout)
   * 2. Stage 2: Fallback to Cellular/Wi-Fi triangulation (15s timeout)
   */
  const getCoordinatesWithFallback = async (
    action: 'check_in' | 'check_out'
  ): Promise<GeolocationPosition> => {
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      throw new Error('SECURE_CONTEXT_REQUIRED');
    }

    if (!navigator.geolocation) {
      throw new Error('GEOLOCATION_NOT_SUPPORTED');
    }

    const tryGetPosition = (highAccuracy: boolean, timeoutMs: number, maxAgeMs: number) => {
      return new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: highAccuracy,
          timeout: timeoutMs,
          maximumAge: maxAgeMs,
        });
      });
    };

    const stage1MaxAge = action === 'check_out' ? 0 : 15000;

    try {
      setSubmittingStep('กำลังตรวจสอบสัญญาณพิกัด GPS...');
      return await tryGetPosition(true, 12000, stage1MaxAge);
    } catch (firstErr: any) {
      if (firstErr?.code === 1) {
        throw firstErr;
      }

      console.warn('High accuracy GPS timed out or unavailable, attempting standard accuracy fallback...', firstErr);
      setSubmittingStep('กำลังปรับจูนสัญญาณตำแหน่งสำรอง (Wi-Fi/เซลลูลาร์)...');
      return await tryGetPosition(false, 15000, action === 'check_out' ? 0 : 20000);
    }
  };

  const handleAttendance = async (
    action: 'check_in' | 'check_out',
    options?: { confirmEarlyCheckout?: boolean }
  ) => {
    // Synchronous guard to prevent rapid double-tap race conditions before React disables the button
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setSubmittingAction(action);
    setSubmittingStep('กำลังตรวจสอบตำแหน่งพิกัด...');

    let position: GeolocationPosition;
    try {
      position = await getCoordinatesWithFallback(action);
    } catch (err: any) {
      console.error('GPS Acquisition Error:', err);
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      setSubmittingAction(null);
      setSubmittingStep('');

      if (err?.message === 'SECURE_CONTEXT_REQUIRED') {
        toast.error('ระบบต้องการการเชื่อมต่อ HTTPS เพื่อเรียกใช้ GPS', {
          description: 'กรุณาเข้าใช้งานผ่าน https:// เพื่อความปลอดภัย',
          duration: 6000
        });
        return;
      }

      if (err?.message === 'GEOLOCATION_NOT_SUPPORTED') {
        toast.error('อุปกรณ์หรือเบราว์เซอร์ไม่รองรับ GPS');
        return;
      }

      if (err?.code === 1) {
        toast.error('ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง (Permission Denied)', {
          description: 'เบราว์เซอร์บล็อกสิทธิ์ตำแหน่งไว้ กรุณาปลดบล็อกในตั้งค่า',
          duration: 7000
        });
        setShowHelpModal(true);
        return;
      }

      if (err?.code === 2) {
        toast.error('ไม่พบสัญญาณตำแหน่ง (Position Unavailable)', {
          description: 'กรุณาเปิดสวิตช์ "ตำแหน่ง / GPS" ในแถบตั้งค่าด่วนของโทรศัพท์ แล้วลองใหม่อีกครั้ง',
          duration: 7000
        });
        return;
      }

      if (err?.code === 3) {
        toast.error('หมดเวลาค้นหาสัญญาณพิกัด (Timeout)', {
          description: 'อุปกรณ์ค้นหาดาวเทียม GPS ไม่ทัน แนะนำขยับเข้าใกล้หน้าต่างหรือที่โล่งแจ้ง แล้วกดใหม่อีกครั้ง',
          duration: 7000
        });
        return;
      }

      toast.error('ไม่สามารถระบุตำแหน่งที่ตั้งได้', {
        description: err.message || 'เกิดข้อผิดพลาดในการดึงพิกัด GPS'
      });
      return;
    }

    const { latitude, longitude } = position.coords;
    setSubmittingStep('กำลังบันทึกข้อมูลเข้าสู่ระบบ...');

    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          lat: latitude,
          lng: longitude,
          confirmEarlyCheckout: options?.confirmEarlyCheckout === true,
        })
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.code === 'EARLY_CHECKOUT_CONFIRM_REQUIRED') {
          setShowCheckoutConfirmModal(true);
          return;
        }
        throw new Error(data.error || 'เกิดข้อผิดพลาดในการบันทึกเวลา');
      }

      toast.success(action === 'check_in' ? 'ลงเวลาเข้างานสำเร็จ!' : 'ลงเวลาออกงานสำเร็จ!', {
        description: `พิกัด: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
      });
      setRecord(data.record);
      setShowCheckoutConfirmModal(false);
      setSummaryRefreshKey((k) => k + 1);

      const punchedAtIso =
        action === 'check_in'
          ? data.record?.check_in_time
          : data.record?.check_out_time;
      const timeStr = punchedAtIso
        ? new Date(punchedAtIso).toLocaleTimeString('th-TH', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: 'Asia/Bangkok',
          })
        : formatHHMM(new Date());

      setStatsModalPunchInfo({
        action,
        timeStr,
        isLate: action === 'check_in' ? isLateCheckIn(punchedAtIso || null) : false,
        isEarlyLeave: action === 'check_out' ? isEarlyCheckOut(punchedAtIso || null) : false,
      });
      setStatsModalOpen(true);
      refreshCurrentMonthSummary();
    } catch (err: any) {
      toast.error(action === 'check_in' ? 'ลงเวลาเข้างานไม่สำเร็จ' : 'ลงเวลาออกงานไม่สำเร็จ', {
        description: err.message
      });
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      setSubmittingAction(null);
      setSubmittingStep('');
    }
  };

  const handleEnablePush = async () => {
    setIsSubscribingPush(true);
    const toastId = toast.loading('กำลังเปิดรับการแจ้งเตือนลงเวลาบนอุปกรณ์นี้...');
    const res = await subscribeToPushNotifications({
      userRole: role || 'staff',
    });
    setIsSubscribingPush(false);

    if (res.success) {
      setPushStatus('subscribed');
      toast.success('เปิดรับการแจ้งเตือนลงเวลาเรียบร้อยแล้ว!', {
        id: toastId,
        description: 'ระบบจะแจ้งเตือนเวลา 07:00, 07:20, 17:00 และ 17:20 น. ในวันทำการ',
      });
    } else {
      toast.error('ไม่สามารถเปิดการแจ้งเตือนได้', {
        id: toastId,
        description: res.error,
      });
    }
  };

  const refreshCurrentMonthSummary = async () => {
    setStatsModalLoading(true);
    try {
      const monthStr = getBangkokDate().slice(0, 7);
      const res = await fetch(`/api/attendance/summary?month=${monthStr}&t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
      if (res.ok) {
        const data = (await res.json()) as SchoolAttendanceSummaryResponse;
        setCurrentMonthSummary(data);
      }
    } catch {
      // ignore non-fatal background refresh error
    } finally {
      setStatsModalLoading(false);
    }
  };

  const scrollToSummaryDetails = () => {
    const el = document.getElementById('personal-attendance-summary');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '--:--:--';
    return new Date(dateStr).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' });
  };

  const formatHHMM = (dateObj: Date) => {
    return dateObj.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Bangkok',
    });
  };

  // Strictly bind attendance status to today's date in Bangkok (GMT+7)
  const todayBangkokDate = getBangkokDate(currentTime);
  const isTodayRecord = record?.date === todayBangkokDate;
  const activeRecord = isTodayRecord ? record : null;

  const hasCheckedIn = !!activeRecord?.check_in_time;
  const hasCheckedOut = !!activeRecord?.check_out_time;

  // Cooldown calculation after check-in (15 minutes)
  const checkInDateObj = activeRecord?.check_in_time ? new Date(activeRecord.check_in_time) : null;
  const elapsedAfterCheckInMs = checkInDateObj ? currentTime.getTime() - checkInDateObj.getTime() : Infinity;
  const cooldownMs = MIN_CHECKOUT_ELAPSED_MINUTES * 60 * 1000;
  const isCheckoutLocked = hasCheckedIn && !hasCheckedOut && elapsedAfterCheckInMs < cooldownMs;
  const remainingCooldownMinutes = isCheckoutLocked
    ? Math.max(1, Math.ceil((cooldownMs - elapsedAfterCheckInMs) / 60000))
    : 0;
  const unlockTimeObj = checkInDateObj ? new Date(checkInDateObj.getTime() + cooldownMs) : null;

  const [earlyH, earlyM] = EARLY_LEAVE_TIME.split(':').map(Number);
  const earlyLeaveCutoffMinutes = (earlyH || 17) * 60 + (earlyM || 0);
  const isCurrentlyEarlyLeave =
    getBangkokMinutesOfDay(currentTime.toISOString()) < earlyLeaveCutoffMinutes;

  // Detect unclosed attendance from a previous day
  const isPastUnclosed = !!(record && record.date !== todayBangkokDate && record.check_in_time && !record.check_out_time);

  if (authLoading) return <div className="text-center py-12 text-foreground/50">กำลังตรวจสอบสิทธิ์...</div>;
  if (!user) {
    if (typeof window !== 'undefined') window.location.href = '/login';
    return null;
  }

  const quickBannerTone: Record<'emerald' | 'blue' | 'slate' | 'amber' | 'rose', string> = {
    emerald: 'from-emerald-600/15 via-emerald-500/5 to-surface border-emerald-500/35 text-emerald-700 dark:text-emerald-300',
    blue: 'from-blue-600/15 via-blue-500/5 to-surface border-blue-500/35 text-blue-700 dark:text-blue-300',
    slate: 'from-slate-600/15 via-slate-500/5 to-surface border-slate-500/30 text-slate-700 dark:text-slate-300',
    amber: 'from-amber-500/15 via-amber-500/5 to-surface border-amber-500/35 text-amber-700 dark:text-amber-300',
    rose: 'from-rose-600/15 via-rose-500/5 to-surface border-rose-500/35 text-rose-700 dark:text-rose-300',
  };

  const bannerToneClass = currentMonthSummary
    ? quickBannerTone[currentMonthSummary.benchmark.classification.badgeTone]
    : quickBannerTone.slate;

  return (
    <div className="space-y-6">
      {/* Above-the-Fold Glanceable Stats Spotlight Banner */}
      {currentMonthSummary && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`bg-gradient-to-br ${bannerToneClass} p-4 md:p-5 rounded-3xl border-2 shadow-lg space-y-3`}
        >
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={scrollToSummaryDetails}
              className="flex items-center gap-3 text-left group min-w-0"
            >
              <div className="w-11 h-11 rounded-2xl bg-surface/90 border border-foreground/10 shadow-xs flex flex-col items-center justify-center shrink-0">
                <span className="text-base font-black leading-none tabular-nums">
                  {currentMonthSummary.personal.score}
                </span>
                <span className="text-[9px] font-bold text-foreground/50 leading-none mt-0.5">
                  /100
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-black text-foreground">สถิติเดือนนี้ของคุณ</span>
                  {!currentMonthSummary.benchmark.insufficientData && (
                    <>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-surface/90 border border-foreground/10">
                        {currentMonthSummary.benchmark.classification.labelTh}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface/75 text-foreground/80 tabular-nums">
                        {currentMonthSummary.benchmark.zScore >= 0 ? '+' : ''}
                        {currentMonthSummary.benchmark.zScore.toFixed(2)} S.D.
                      </span>
                    </>
                  )}
                </div>
                <p className="text-[11px] text-foreground/65 truncate mt-0.5 group-hover:underline">
                  แตะเพื่อเลื่อนดูกราฟเทียบค่าเฉลี่ยโรงเรียน ({currentMonthSummary.benchmark.schoolMean.toFixed(1)} คะแนน)
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setStatsModalPunchInfo({ action: 'preview' });
                setStatsModalOpen(true);
              }}
              className="px-3 py-2 rounded-xl bg-surface/90 hover:bg-surface border border-foreground/15 text-foreground font-bold text-xs flex items-center gap-1.5 shadow-xs shrink-0 transition-all active:scale-95"
            >
              <Maximize2 className="w-3.5 h-3.5 text-primary" />
              <span>ดูแบบเต็ม</span>
            </button>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-[11px]">
            <div className="px-2.5 py-1.5 rounded-xl bg-surface/85 border border-foreground/10 flex items-center justify-between">
              <span className="text-foreground/60 font-semibold">มา</span>
              <span className="font-black text-emerald-700 dark:text-emerald-300 tabular-nums">
                {currentMonthSummary.personal.presentDays}/{currentMonthSummary.elapsedWorkingDays}
              </span>
            </div>
            <div className="px-2.5 py-1.5 rounded-xl bg-surface/85 border border-foreground/10 flex items-center justify-between">
              <span className="text-foreground/60 font-semibold">สาย</span>
              <span className="font-black text-amber-700 dark:text-amber-300 tabular-nums">
                {currentMonthSummary.personal.lateCount}
              </span>
            </div>
            <div className="px-2.5 py-1.5 rounded-xl bg-surface/85 border border-foreground/10 flex items-center justify-between">
              <span className="text-foreground/60 font-semibold">ขาด</span>
              <span className="font-black text-rose-700 dark:text-rose-300 tabular-nums">
                {currentMonthSummary.personal.absentCount}
              </span>
            </div>
            <div className="px-2.5 py-1.5 rounded-xl bg-surface/85 border border-foreground/10 flex items-center justify-between">
              <span className="text-foreground/60 font-semibold">ลา</span>
              <span className="font-black text-sky-700 dark:text-sky-300 tabular-nums">
                {currentMonthSummary.personal.leaveCount}
              </span>
            </div>
            <div className="px-2.5 py-1.5 rounded-xl bg-surface/85 border border-foreground/10 flex items-center justify-between">
              <span className="text-foreground/60 font-semibold">ไม่ลงออก</span>
              <span className="font-black text-purple-700 dark:text-purple-300 tabular-nums">
                {currentMonthSummary.personal.missingCheckoutCount}
              </span>
            </div>
            <div className="px-2.5 py-1.5 rounded-xl bg-surface/85 border border-foreground/10 flex items-center justify-between">
              <span className="text-foreground/60 font-semibold">ออกก่อน</span>
              <span className="font-black text-orange-700 dark:text-orange-300 tabular-nums">
                {currentMonthSummary.personal.earlyLeaveCount}
              </span>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-surface backdrop-blur-xl p-6 md:p-8 rounded-3xl shadow-xl border border-foreground/5 relative overflow-hidden"
      >
        {/* Past Unclosed Notice Banner */}
        {isPastUnclosed && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-200 flex items-start gap-3">
            <Info className="w-5 h-5 flex-shrink-0 text-amber-600 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <span className="font-bold block text-sm mb-0.5">ระบบเริ่มต้นรอบลงเวลาใหม่สำหรับวันนี้เรียบร้อยแล้ว</span>
              ในวันก่อนหน้า (วันที่ {record?.date}) ไม่ได้มีการบันทึกเวลาออกงาน ระบบได้เปิดรอบลงเวลาเข้างานของวันนี้ ({todayBangkokDate}) ให้โดยอัตโนมัติ คุณสามารถกดปุ่ม <strong>&quot;ลงเวลาเข้างาน&quot;</strong> ได้ทันทีค่ะ
            </div>
          </div>
        )}

        {/* LINE In-App Browser Warning Banner */}
        {isLineBrowser && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-600 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <span className="font-bold block text-sm mb-0.5">เปิดผ่านแอป LINE (In-App Browser)</span>
              ระบบพิกัด GPS ใน LINE อาจถูกจำกัด แนะนำให้แตะปุ่ม <strong>จุด 3 จุด</strong> ที่มุมหน้าจอ แล้วเลือก <strong>&quot;เปิดด้วยเบราว์เซอร์อื่น / Chrome&quot;</strong> เพื่อความแม่นยำสูงสุด
            </div>
          </div>
        )}

        {/* Push Notification Opt-In Banner */}
        {pushStatus === 'unsubscribed' && (
          <div className="mb-6 p-4 rounded-2xl bg-primary/10 border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 text-xs">
              <Bell className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-foreground block">
                  เปิดรับแจ้งเตือนลงชื่อเข้า-ออกงาน
                </span>
                <span className="text-foreground/65">
                  เตือนอัตโนมัติ 07:00, 07:20 น. และ 17:00, 17:20 น. (เฉพาะวันที่ยังไม่ลงเวลา)
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleEnablePush}
              disabled={isSubscribingPush}
              className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              {isSubscribingPush ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Bell className="w-3.5 h-3.5" />
              )}
              <span>เปิดแจ้งเตือน</span>
            </button>
          </div>
        )}

        {pushStatus === 'unsupported' && isIosSafariBrowser && (
          <div className="mb-6 p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-900 dark:text-sky-200 flex items-start gap-2.5 text-xs">
            <Smartphone className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" />
            <span>
              <strong>สำหรับผู้ใช้ iPhone/iPad:</strong> แตะปุ่ม <strong>แชร์ (Share)</strong> แล้วเลือก <strong>&quot;เพิ่มไปยังหน้าจอโฮม (Add to Home Screen)&quot;</strong> เพื่อเปิดรับแจ้งเตือนบนหน้าจอมือถือ
            </span>
          </div>
        )}

        {/* Current Time Display */}
        <div className="flex flex-col items-center justify-center mb-8">
          <div className="bg-primary/5 p-6 rounded-[2rem] w-full text-center border border-primary/10">
            <div className="text-sm font-bold text-primary/70 mb-2 uppercase tracking-widest">เวลาปัจจุบัน</div>
            <div className="text-5xl md:text-6xl font-black text-primary tracking-tighter tabular-nums">
              {currentTime.toLocaleTimeString('th-TH', { hour12: false })}
            </div>
            <div className="text-foreground/60 font-medium mt-3">
              {new Intl.DateTimeFormat('th-TH', { dateStyle: 'full' }).format(currentTime)}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-10 h-10 animate-spin text-primary/50" />
            <p className="mt-4 text-foreground/50 font-medium">กำลังโหลดข้อมูลการลงเวลา...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Status Display */}
            <div className="grid grid-cols-2 gap-4">
              <div className={`p-4 rounded-2xl border ${hasCheckedIn ? 'bg-green-500/10 border-green-500/20' : 'bg-foreground/5 border-foreground/10'} flex flex-col items-center text-center`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${hasCheckedIn ? 'bg-green-500 text-white' : 'bg-foreground/10 text-foreground/40'}`}>
                  {hasCheckedIn ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                </div>
                <div className="text-xs font-bold text-foreground/50 mb-1">เวลาเข้างาน</div>
                <div className={`text-xl font-black tabular-nums ${hasCheckedIn ? 'text-green-600' : 'text-foreground/80'}`}>
                  {formatTime(activeRecord?.check_in_time || null)}
                </div>
              </div>
              <div className={`p-4 rounded-2xl border ${hasCheckedOut ? 'bg-blue-500/10 border-blue-500/20' : 'bg-foreground/5 border-foreground/10'} flex flex-col items-center text-center`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${hasCheckedOut ? 'bg-blue-500 text-white' : 'bg-foreground/10 text-foreground/40'}`}>
                  {hasCheckedOut ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                </div>
                <div className="text-xs font-bold text-foreground/50 mb-1">เวลาออกงาน</div>
                <div className={`text-xl font-black tabular-nums ${hasCheckedOut ? 'text-blue-600' : 'text-foreground/80'}`}>
                  {formatTime(activeRecord?.check_out_time || null)}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 space-y-3">
              {!hasCheckedIn ? (
                <button
                  key="btn-check-in"
                  type="button"
                  onClick={() => handleAttendance('check_in')}
                  disabled={isSubmitting}
                  className="w-full bg-primary hover:bg-primary/90 text-white p-5 rounded-2xl font-bold text-lg shadow-lg shadow-primary/20 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 disabled:opacity-70"
                >
                  <div className="flex items-center gap-2">
                    {isSubmitting && submittingAction === 'check_in' ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <MapPin className="w-6 h-6" />
                    )}
                    <span>ลงเวลาเข้างาน</span>
                  </div>
                  {isSubmitting && submittingAction === 'check_in' && (
                    <span className="text-xs font-normal text-white/80 animate-pulse mt-0.5">
                      {submittingStep || 'กำลังประมวลผล...'}
                    </span>
                  )}
                </button>
              ) : !hasCheckedOut ? (
                <>
                  {isCheckoutLocked && unlockTimeObj && (
                    <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-800 dark:text-emerald-200 flex items-start gap-2.5 text-xs leading-relaxed">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="block">ลงเวลาเข้างานเรียบร้อยแล้ว</strong>
                        ระบบป้องกันการกดซ้ำโดยล็อกปุ่มลงเวลาออกงานชั่วคราว จะเปิดให้กดได้ตั้งแต่เวลา{' '}
                        <strong className="tabular-nums">{formatHHMM(unlockTimeObj)} น.</strong> (อีก {remainingCooldownMinutes} นาที)
                      </div>
                    </div>
                  )}

                  <button
                    key="btn-check-out"
                    type="button"
                    onClick={() => setShowCheckoutConfirmModal(true)}
                    disabled={isSubmitting || isCheckoutLocked}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white p-5 rounded-2xl font-bold text-lg shadow-lg shadow-blue-500/20 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 disabled:opacity-45 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-2">
                      {isSubmitting && submittingAction === 'check_out' ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        <MapPin className="w-6 h-6" />
                      )}
                      <span>
                        {isCheckoutLocked
                          ? `ลงเวลาออกงาน (เปิดอีก ${remainingCooldownMinutes} นาที)`
                          : 'ลงเวลาออกงาน'}
                      </span>
                    </div>
                    {isSubmitting && submittingAction === 'check_out' && (
                      <span className="text-xs font-normal text-white/80 animate-pulse mt-0.5">
                        {submittingStep || 'กำลังประมวลผล...'}
                      </span>
                    )}
                  </button>
                </>
              ) : (
                <div className="bg-foreground/5 border border-foreground/10 p-5 rounded-2xl text-center flex flex-col items-center gap-2">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                  <p className="font-bold text-foreground/80">คุณได้ลงเวลาครบถ้วนแล้วสำหรับวันนี้</p>
                  <p className="text-sm text-foreground/50">ขอบคุณสำหรับการทำงานในวันนี้!</p>
                </div>
              )}
            </div>

            {/* Leave / Official Duty Quick Action Bar */}
            <div className="pt-2 flex flex-wrap gap-2.5">
              <Link
                href="/leave"
                className="flex-1 min-w-[180px] p-3.5 rounded-2xl bg-[#7B1C3E]/10 hover:bg-[#7B1C3E]/15 border border-[#7B1C3E]/20 text-[#7B1C3E] dark:text-pink-300 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <CalendarPlus className="w-4 h-4" />
                <span>แจ้งลา / ไปราชการ</span>
              </Link>
              {(role === 'admin' ||
                role === 'executive' ||
                appUser?.assigned_features?.includes('admin_leave')) && (
                <Link
                  href="/admin/leave"
                  className="p-3.5 px-4 rounded-2xl bg-indigo-500/10 hover:bg-indigo-500/15 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>แดชบอร์ดอนุมัติลา</span>
                </Link>
              )}
            </div>

            {/* GPS Info & Help Shortcut Box */}
            <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-foreground/70 mt-6">
              <div className="flex items-start gap-2.5">
                <Compass className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <span>ระบบตรวจสอบพิกัดให้อยู่ในรัศมีบริเวณโรงเรียนสมคิดวิทยา</span>
              </div>
              <button
                type="button"
                onClick={() => setShowHelpModal(true)}
                className="inline-flex items-center gap-1.5 text-primary hover:underline font-bold text-xs whitespace-nowrap self-end sm:self-center"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>วิธีเปิดสิทธิ์ GPS บนมือถือ</span>
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Personal Monthly Status & School S.D. Benchmark */}
      <PersonalAttendanceSummary
        refreshTrigger={summaryRefreshKey}
        onSummaryChange={(data, isCurrentMonth) => {
          if (isCurrentMonth && data) {
            setCurrentMonthSummary(data);
          }
        }}
      />

      {/* Post-Punch & Preview Stats Spotlight Modal */}
      <PostPunchStatsModal
        isOpen={statsModalOpen}
        onClose={() => setStatsModalOpen(false)}
        onScrollToDetails={scrollToSummaryDetails}
        punchInfo={statsModalPunchInfo}
        summary={currentMonthSummary}
        isLoading={statsModalLoading}
      />

      {/* 2-Step Check-Out Confirmation Modal */}
      <AnimatePresence>
        {showCheckoutConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface border border-foreground/10 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-5 border-b border-foreground/10 flex items-center justify-between bg-blue-600/5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-600/15 text-blue-600 flex items-center justify-center">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-base">ยืนยันการลงเวลาออกงาน</h3>
                    <p className="text-[11px] text-foreground/55">กรุณาตรวจสอบเวลาก่อนกดยืนยัน</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowCheckoutConfirmModal(false)}
                  className="w-8 h-8 rounded-full hover:bg-foreground/5 flex items-center justify-center text-foreground/50 hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="p-3 rounded-2xl bg-foreground/5 border border-foreground/10">
                    <div className="text-[11px] font-bold text-foreground/50">เวลาเข้างานวันนี้</div>
                    <div className="text-lg font-black text-green-600 tabular-nums mt-0.5">
                      {formatTime(activeRecord?.check_in_time || null)}
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                    <div className="text-[11px] font-bold text-blue-700 dark:text-blue-300">เวลาที่จะลงออก</div>
                    <div className="text-lg font-black text-blue-600 tabular-nums mt-0.5">
                      {formatHHMM(currentTime)} น.
                    </div>
                  </div>
                </div>

                {isCurrentlyEarlyLeave && (
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 flex items-start gap-2.5 text-xs leading-relaxed">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="block">ยังไม่ถึงเวลาเลิกงานมาตรฐาน ({EARLY_LEAVE_TIME} น.)</strong>
                      หากกดยืนยันตอนนี้ ระบบจะบันทึกสถานะเป็น <strong>&quot;ออกก่อนเวลา&quot;</strong> แน่ใจหรือไม่ว่าต้องการลงเวลาออกงาน?
                    </div>
                  </div>
                )}

                {isSubmitting && submittingAction === 'check_out' && (
                  <div className="text-center text-xs font-medium text-blue-600 animate-pulse">
                    {submittingStep || 'กำลังบันทึกข้อมูล...'}
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-foreground/10 bg-foreground/[0.02] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowCheckoutConfirmModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-foreground/10 hover:bg-foreground/15 text-foreground font-bold text-xs transition-all"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() =>
                    handleAttendance('check_out', {
                      confirmEarlyCheckout: isCurrentlyEarlyLeave,
                    })
                  }
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-60"
                >
                  {isSubmitting && submittingAction === 'check_out' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>ยืนยันลงเวลาออกงาน</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Troubleshooting & Permission Guide Modal */}
      <AnimatePresence>
        {showHelpModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface border border-foreground/10 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-5 border-b border-foreground/10 flex items-center justify-between bg-primary/5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-sm">คู่มือตั้งค่าและเปิดสิทธิ์ GPS</h3>
                    <p className="text-[11px] text-foreground/50">สำหรับผู้ใช้ที่กดลงเวลาแล้วระบบไม่ตอบสนอง</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="w-8 h-8 rounded-full hover:bg-foreground/5 flex items-center justify-center text-foreground/50 hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-foreground/10 bg-foreground/[0.02] p-1.5 gap-1.5 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setHelpTab('samsung')}
                  className={`flex-1 py-2 px-3 rounded-xl transition-all ${
                    helpTab === 'samsung'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-foreground/60 hover:text-foreground hover:bg-foreground/5'
                  }`}
                >
                  Samsung Internet
                </button>
                <button
                  type="button"
                  onClick={() => setHelpTab('chrome')}
                  className={`flex-1 py-2 px-3 rounded-xl transition-all ${
                    helpTab === 'chrome'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-foreground/60 hover:text-foreground hover:bg-foreground/5'
                  }`}
                >
                  Google Chrome
                </button>
                <button
                  type="button"
                  onClick={() => setHelpTab('line')}
                  className={`flex-1 py-2 px-3 rounded-xl transition-all ${
                    helpTab === 'line'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-foreground/60 hover:text-foreground hover:bg-foreground/5'
                  }`}
                >
                  เปิดผ่าน LINE
                </button>
              </div>

              {/* Tab Contents */}
              <div className="p-6 overflow-y-auto space-y-4 text-xs text-foreground/80 leading-relaxed">
                {helpTab === 'samsung' && (
                  <div className="space-y-4">
                    <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-900 flex items-start gap-2.5">
                      <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong>ทำไมในตั้งค่าแอปไม่มี SV-Portal?</strong>
                        <p className="mt-0.5 text-[11px] text-blue-800">
                          แอปที่ติดตั้งผ่าน Samsung Internet เป็นเว็บแอป (PWA) สิทธิ์ทั้งหมดจะถูกควบคุมผ่าน <strong>แอป Samsung Internet</strong> ครับ
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-black flex items-center justify-center flex-shrink-0 text-xs mt-0.5">1</span>
                        <div>
                          <strong className="text-foreground">ปลดบล็อกในตัวแอป Samsung Internet (สำคัญที่สุด):</strong>
                          <p className="text-foreground/60 mt-1">
                            เปิดแอป <strong>Samsung Internet (รูปดาวเสาร์)</strong> &rarr; แตะเมนู <strong>3 ขีด</strong> มุมขวาล่าง &rarr; เลือก <strong>การตั้งค่า (รูปฟันเฟือง)</strong>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-black flex items-center justify-center flex-shrink-0 text-xs mt-0.5">2</span>
                        <div>
                          <strong className="text-foreground">ตรวจสอบสิทธิ์ตำแหน่งของเว็บไซต์:</strong>
                          <p className="text-foreground/60 mt-1">
                            เลือก <strong>ไซต์และการดาวน์โหลด</strong> &rarr; <strong>การอนุญาตไซต์</strong> &rarr; แตะที่ <strong>ตำแหน่ง</strong> &rarr; ตรวจสอบว่าเปิดอยู่ และดูในหัวข้อ <em>&quot;ถูกบล็อก&quot;</em> หากมีชื่อเว็บโรงเรียนอยู่ ให้แตะเข้าไปแล้วเปลี่ยนเป็น <strong>อนุญาต (Allow)</strong> หรือกด <strong>ลบ/รีเซ็ต</strong> เพื่อให้ระบบเด้งถามใหม่อีกครั้ง
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-black flex items-center justify-center flex-shrink-0 text-xs mt-0.5">3</span>
                        <div>
                          <strong className="text-foreground">เปิดสิทธิ์แอปในเครื่อง Samsung:</strong>
                          <p className="text-foreground/60 mt-1">
                            ไปที่ <strong>การตั้งค่ามือถือ (Settings)</strong> &rarr; <strong>แอป (Apps)</strong> &rarr; เลือก <strong>Samsung Internet</strong> &rarr; <strong>การอนุญาต</strong> &rarr; เลือก <strong>ตำแหน่ง</strong> เป็น <em>&quot;อนุญาตเฉพาะขณะใช้แอป&quot;</em>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-black flex items-center justify-center flex-shrink-0 text-xs mt-0.5">4</span>
                        <div>
                          <strong className="text-foreground">เปิด GPS รวมของเครื่อง:</strong>
                          <p className="text-foreground/60 mt-1">
                            รูดแถบด้านบนของหน้าจอมือถือลงมา ตรวจสอบว่าเปิดปุ่ม <strong>&quot;ตำแหน่ง / GPS&quot;</strong> เป็นสีฟ้าแล้ว
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {helpTab === 'chrome' && (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-black flex items-center justify-center flex-shrink-0 text-xs mt-0.5">1</span>
                      <div>
                        <strong className="text-foreground">เปิดสิทธิ์ผ่านแถบ URL ของ Chrome:</strong>
                        <p className="text-foreground/60 mt-1">
                          เปิดหน้าเว็บนี้ใน <strong>Google Chrome</strong> &rarr; แตะที่ <strong>ไอคอนตัวปรับแต่ง/แม่กุญแจ</strong> ข้างชื่อเว็บที่แถบ URL ด้านบน &rarr; เลือก <strong>การอนุญาต (Permissions)</strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-black flex items-center justify-center flex-shrink-0 text-xs mt-0.5">2</span>
                      <div>
                        <strong className="text-foreground">เปิดสวิตช์ตำแหน่ง:</strong>
                        <p className="text-foreground/60 mt-1">
                          เปิดสวิตช์ <strong>ตำแหน่ง (Location)</strong> หรือแตะ <em>&quot;รีเซ็ตสิทธิ์&quot;</em> จากนั้นรีเฟรชหน้าเว็บแล้วกดลงเวลาอีกครั้ง
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-black flex items-center justify-center flex-shrink-0 text-xs mt-0.5">3</span>
                      <div>
                        <strong className="text-foreground">สิทธิ์แอป Chrome ในเครื่อง Android:</strong>
                        <p className="text-foreground/60 mt-1">
                          ไปที่ <strong>การตั้งค่าโทรศัพท์</strong> &rarr; <strong>แอป</strong> &rarr; <strong>Chrome</strong> &rarr; <strong>การอนุญาต</strong> &rarr; เลือก <strong>ตำแหน่ง</strong> เป็น <em>&quot;อนุญาตขณะใช้แอป&quot;</em>
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {helpTab === 'line' && (
                  <div className="space-y-4">
                    <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-900 flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong>ข้อจำกัดของแอป LINE บนมือถือ:</strong>
                        <p className="mt-0.5 text-[11px] text-amber-800">
                          เมื่อเปิดลิงก์ในแอป LINE ตัวเว็บจะทำงานบน WebView ซึ่งมักจะไม่รองรับการขอสิทธิ์ GPS อย่างสมบูรณ์
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-black flex items-center justify-center flex-shrink-0 text-xs mt-0.5">1</span>
                      <div>
                        <strong className="text-foreground">เปิดด้วยเบราว์เซอร์หลัก:</strong>
                        <p className="text-foreground/60 mt-1">
                          แตะที่ปุ่ม <strong>จุด 3 จุด</strong> ที่มุมขวาบนหรือขวาล่างของหน้าจอ LINE &rarr; เลือก <strong>&quot;เปิดด้วยเบราว์เซอร์อื่น&quot;</strong> หรือ <strong>&quot;Open in Chrome&quot;</strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-black flex items-center justify-center flex-shrink-0 text-xs mt-0.5">2</span>
                      <div>
                        <strong className="text-foreground">แนะนำให้ติดตั้งเป็นแอปผ่าน Chrome:</strong>
                        <p className="text-foreground/60 mt-1">
                          เมื่อเปิดใน Chrome แล้ว แตะจุด 3 จุด &rarr; เลือก <strong>&quot;ติดตั้งแอป&quot;</strong> หรือ <strong>&quot;เพิ่มลงในหน้าจอหลัก&quot;</strong> เพื่อให้เปิดใช้งานสะดวกและสิทธิ์ไม่หลุด
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-foreground/10 bg-foreground/[0.02] flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setShowHelpModal(false)}
                  className="px-5 py-2.5 bg-primary text-white font-bold rounded-xl text-xs hover:bg-primary/90 transition-all active:scale-95"
                >
                  เข้าใจแล้ว ปิดหน้าต่าง
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
