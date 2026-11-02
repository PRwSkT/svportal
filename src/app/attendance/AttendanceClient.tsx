'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  HelpCircle, 
  X, 
  ExternalLink, 
  Smartphone, 
  Compass, 
  ShieldAlert,
  ChevronRight,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

type AttendanceRecord = {
  id: string;
  check_in_time: string | null;
  check_out_time: string | null;
  date: string;
};

export default function AttendanceClient() {
  const { user, isLoading: authLoading } = useAuth();
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingAction, setSubmittingAction] = useState<'check_in' | 'check_out' | null>(null);
  const [submittingStep, setSubmittingStep] = useState<string>('');
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Modals & Detection
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [helpTab, setHelpTab] = useState<'samsung' | 'chrome' | 'line'>('samsung');
  const [isLineBrowser, setIsLineBrowser] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ua = navigator.userAgent || '';
      setIsLineBrowser(/Line\//i.test(ua));
      const standalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
      setIsStandalone(!!standalone);
      if (/SamsungBrowser/i.test(ua)) {
        setHelpTab('samsung');
      } else {
        setHelpTab('chrome');
      }
    }
  }, []);

  const fetchRecord = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/attendance');
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
   * 2. Stage 2: Fallback to Cellular/Wi-Fi triangulation (15s timeout) if Stage 1 times out or has weak satellite lock
   */
  const getCoordinatesWithFallback = async (): Promise<GeolocationPosition> => {
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

    try {
      // Stage 1: Hardware High-Accuracy GPS (12 seconds)
      setSubmittingStep('กำลังเชื่อมต่อสัญญาณพิกัด GPS...');
      return await tryGetPosition(true, 12000, 5000);
    } catch (firstErr: any) {
      // If user/browser explicitly denied permission (code 1), do NOT retry, throw immediately
      if (firstErr?.code === 1) {
        throw firstErr;
      }

      // Stage 2 Fallback: Standard Accuracy (Cellular/Wi-Fi triangulation, 15 seconds)
      console.warn('High accuracy GPS timed out or unavailable, attempting standard accuracy fallback...', firstErr);
      setSubmittingStep('กำลังปรับจูนสัญญาณตำแหน่งสำรอง (Wi-Fi/เซลลูลาร์)...');
      try {
        return await tryGetPosition(false, 15000, 10000);
      } catch (secondErr: any) {
        throw secondErr;
      }
    }
  };

  const handleAttendance = async (action: 'check_in' | 'check_out') => {
    setIsSubmitting(true);
    setSubmittingAction(action);
    setSubmittingStep('กำลังตรวจสอบตำแหน่งพิกัด...');

    let position: GeolocationPosition;
    try {
      position = await getCoordinatesWithFallback();
    } catch (err: any) {
      console.error('GPS Acquisition Error:', err);
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

      // GeolocationPositionError codes:
      // 1 = PERMISSION_DENIED
      // 2 = POSITION_UNAVAILABLE
      // 3 = TIMEOUT
      if (err?.code === 1) {
        toast.error('ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง (Permission Denied)', {
          description: 'เบราว์เซอร์บล็อกสิทธิ์ตำแหน่งไว้ กรุณาปลดบล็อกในตั้งค่า',
          duration: 7000
        });
        // Automatically open the help guide
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
          lng: longitude
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'เกิดข้อผิดพลาดในการบันทึกเวลา');
      }

      toast.success(action === 'check_in' ? 'ลงเวลาเข้างานสำเร็จ!' : 'ลงเวลาออกงานสำเร็จ!', {
        description: `พิกัด: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
      });
      setRecord(data.record);
    } catch (err: any) {
      toast.error(action === 'check_in' ? 'ลงเวลาเข้างานไม่สำเร็จ' : 'ลงเวลาออกงานไม่สำเร็จ', {
        description: err.message
      });
    } finally {
      setIsSubmitting(false);
      setSubmittingAction(null);
      setSubmittingStep('');
    }
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '--:--:--';
    return new Date(dateStr).toLocaleTimeString('th-TH');
  };

  const hasCheckedIn = !!record?.check_in_time;
  const hasCheckedOut = !!record?.check_out_time;

  if (authLoading) return <div className="text-center py-12 text-foreground/50">กำลังตรวจสอบสิทธิ์...</div>;
  if (!user) {
    if (typeof window !== 'undefined') window.location.href = '/login';
    return null;
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface backdrop-blur-xl p-6 md:p-8 rounded-3xl shadow-xl border border-foreground/5 relative overflow-hidden"
    >
      {/* LINE In-App Browser Warning Banner */}
      {isLineBrowser && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-600 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <span className="font-bold block text-sm mb-0.5">เปิดผ่านแอป LINE (In-App Browser)</span>
            ระบบพิกัด GPS ใน LINE อาจถูกจำกัด แนะนำให้แตะปุ่ม <strong>จุด 3 จุด</strong> ที่มุมหน้าจอ แล้วเลือก <strong>&quot;เปิดด้วยเบราว์เซอร์อื่น / Chrome&quot;</strong> เพื่อความแม่นยำสูงสุด
          </div>
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
              <div className={`text-xl font-black ${hasCheckedIn ? 'text-green-600' : 'text-foreground/80'}`}>
                {formatTime(record?.check_in_time || null)}
              </div>
            </div>
            <div className={`p-4 rounded-2xl border ${hasCheckedOut ? 'bg-blue-500/10 border-blue-500/20' : 'bg-foreground/5 border-foreground/10'} flex flex-col items-center text-center`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${hasCheckedOut ? 'bg-blue-500 text-white' : 'bg-foreground/10 text-foreground/40'}`}>
                {hasCheckedOut ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
              </div>
              <div className="text-xs font-bold text-foreground/50 mb-1">เวลาออกงาน</div>
              <div className={`text-xl font-black ${hasCheckedOut ? 'text-blue-600' : 'text-foreground/80'}`}>
                {formatTime(record?.check_out_time || null)}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4">
            {!hasCheckedIn ? (
              <button
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
              <button
                onClick={() => handleAttendance('check_out')}
                disabled={isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white p-5 rounded-2xl font-bold text-lg shadow-lg shadow-blue-500/20 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 disabled:opacity-70"
              >
                <div className="flex items-center gap-2">
                  {isSubmitting && submittingAction === 'check_out' ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <MapPin className="w-6 h-6" />
                  )}
                  <span>ลงเวลาออกงาน</span>
                </div>
                {isSubmitting && submittingAction === 'check_out' && (
                  <span className="text-xs font-normal text-white/80 animate-pulse mt-0.5">
                    {submittingStep || 'กำลังประมวลผล...'}
                  </span>
                )}
              </button>
            ) : (
              <div className="bg-foreground/5 border border-foreground/10 p-5 rounded-2xl text-center flex flex-col items-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
                <p className="font-bold text-foreground/80">คุณได้ลงเวลาครบถ้วนแล้วสำหรับวันนี้</p>
                <p className="text-sm text-foreground/50">ขอบคุณสำหรับการทำงานในวันนี้!</p>
              </div>
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
    </motion.div>
  );
}
