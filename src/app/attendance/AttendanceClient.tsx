'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, MapPin, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
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
  const [currentTime, setCurrentTime] = useState(new Date());
  const [locationStatus, setLocationStatus] = useState<'pending' | 'success' | 'error'>('pending');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
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

  const getCurrentLocation = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('เบราว์เซอร์ของคุณไม่รองรับ GPS'));
      } else {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      }
    });
  };

  const handleAttendance = async (action: 'check_in' | 'check_out') => {
    setIsSubmitting(true);
    setLocationStatus('pending');
    
    let position: GeolocationPosition;
    try {
      position = await getCurrentLocation();
      setLocationStatus('success');
    } catch (err: any) {
      console.error(err);
      setLocationStatus('error');
      toast.error('ไม่สามารถดึงข้อมูลตำแหน่งที่ตั้งได้', {
        description: 'กรุณาอนุญาตให้เว็บไซต์เข้าถึงตำแหน่งที่ตั้ง (GPS) ของคุณ'
      });
      setIsSubmitting(false);
      return;
    }

    const { latitude, longitude } = position.coords;
    
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
        throw new Error(data.error || 'เกิดข้อผิดพลาด');
      }

      toast.success(action === 'check_in' ? 'ลงเวลาเข้างานสำเร็จ!' : 'ลงเวลาออกงานสำเร็จ!');
      setRecord(data.record);
    } catch (err: any) {
      toast.error(action === 'check_in' ? 'ลงเวลาเข้างานไม่สำเร็จ' : 'ลงเวลาออกงานไม่สำเร็จ', {
        description: err.message
      });
    } finally {
      setIsSubmitting(false);
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
    // Ideally redirect, but for now just show message
    if (typeof window !== 'undefined') window.location.href = '/login';
    return null;
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface backdrop-blur-xl p-8 rounded-3xl shadow-xl border border-foreground/5 relative overflow-hidden"
    >
      {/* Current Time Display */}
      <div className="flex flex-col items-center justify-center mb-10">
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
          <p className="mt-4 text-foreground/50 font-medium">กำลังโหลดข้อมูล...</p>
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
          <div className="pt-6">
            {!hasCheckedIn ? (
              <button
                onClick={() => handleAttendance('check_in')}
                disabled={isSubmitting}
                className="w-full bg-primary hover:bg-primary/90 text-white p-5 rounded-2xl font-bold text-lg shadow-lg shadow-primary/20 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-70"
              >
                {isSubmitting ? (
                  <><Loader2 className="w-6 h-6 animate-spin" /> กำลังบันทึก...</>
                ) : (
                  <><MapPin className="w-6 h-6" /> ลงเวลาเข้างาน</>
                )}
              </button>
            ) : !hasCheckedOut ? (
              <button
                onClick={() => handleAttendance('check_out')}
                disabled={isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white p-5 rounded-2xl font-bold text-lg shadow-lg shadow-blue-500/20 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-70"
              >
                {isSubmitting ? (
                  <><Loader2 className="w-6 h-6 animate-spin" /> กำลังบันทึก...</>
                ) : (
                  <><MapPin className="w-6 h-6" /> ลงเวลาออกงาน</>
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

          {/* GPS Info Note */}
          <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-800 text-sm mt-6">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p>ระบบจำเป็นต้องเข้าถึงตำแหน่ง GPS ของคุณเพื่อใช้ในการลงเวลา กรุณากดอนุญาต (Allow) เมื่อเบราว์เซอร์ร้องขอ</p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
