'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  Bus, 
  ShieldAlert, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  Phone, 
  Clock, 
  ChevronLeft, 
  RefreshCw, 
  Volume2, 
  VolumeX, 
  UserCheck, 
  Plus, 
  Check, 
  X,
  Users
} from 'lucide-react';
import { toast } from 'sonner';
import { VanDailyLogItem, VanSafetyAuditResult } from '@/lib/safety/van';

export default function SchoolVanSafetyPage() {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [tripType, setTripType] = useState<'morning' | 'evening'>('morning');
  const [routes, setRoutes] = useState<any[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSirenMuted, setIsSirenMuted] = useState<boolean>(false);

  // Audio Context Ref for Web Audio Siren
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sirenIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchRoutes = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/safety/van?date=${selectedDate}&tripType=${tripType}`);
      const data = await res.json();
      if (res.ok) {
        setRoutes(data.routes || []);
        if (data.routes?.length > 0 && !selectedRouteId) {
          setSelectedRouteId(data.routes[0].id);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('ไม่สามารถโหลดข้อมูลรถรับ-ส่งนักเรียนได้');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutes();
  }, [selectedDate, tripType]);

  // Audio Siren Functions using Web Audio API
  const playSiren = () => {
    if (isSirenMuted) return;
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // Alternating siren tones
      let highTone = false;
      if (sirenIntervalRef.current) clearInterval(sirenIntervalRef.current);

      sirenIntervalRef.current = setInterval(() => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sawtooth';
        osc.frequency.value = highTone ? 1100 : 750;
        highTone = !highTone;

        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

        osc.start();
        osc.stop(ctx.currentTime + 0.38);
      }, 400);
    } catch (e) {
      console.warn('Web Audio Siren unavailable:', e);
    }
  };

  const stopSiren = () => {
    if (sirenIntervalRef.current) {
      clearInterval(sirenIntervalRef.current);
      sirenIntervalRef.current = null;
    }
  };

  // Watch for Trapped Students across active routes
  useEffect(() => {
    const currentRoute = routes.find(r => r.id === selectedRouteId);
    if (currentRoute && currentRoute.audit?.alarmLevel === 'EMERGENCY_ALARM') {
      playSiren();
    } else {
      stopSiren();
    }

    return () => {
      stopSiren();
    };
  }, [routes, selectedRouteId, isSirenMuted]);

  const handleUpdateStatus = async (studentId: string, status: string) => {
    try {
      const res = await fetch('/api/safety/van', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_status',
          route_id: selectedRouteId,
          student_id: studentId,
          status,
          log_date: selectedDate,
          trip_type: tripType
        })
      });

      if (!res.ok) throw new Error('Update failed');
      fetchRoutes();
    } catch (err: any) {
      toast.error('อัปเดตสถานะไม่สำเร็จ');
    }
  };

  const handleMarkAllDisembarked = async () => {
    const currentRoute = routes.find(r => r.id === selectedRouteId);
    if (!currentRoute) return;

    const boardedLogs = (currentRoute.logs || []).filter((l: any) => l.status === 'BOARDED');
    if (boardedLogs.length === 0) {
      toast.info('ไม่มีนักเรียนที่มีสถานะอยู่บนรถ');
      return;
    }

    try {
      await Promise.all(
        boardedLogs.map((l: any) =>
          fetch('/api/safety/van', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'update_status',
              route_id: selectedRouteId,
              student_id: l.studentId,
              status: 'DISEMBARKED',
              log_date: selectedDate,
              trip_type: tripType
            })
          })
        )
      );
      toast.success('เช็กชื่อลงจากรถทุกคนเรียบร้อยแล้ว');
      stopSiren();
      fetchRoutes();
    } catch (err) {
      toast.error('บันทึกล้มเหลว');
    }
  };

  const currentRoute = routes.find(r => r.id === selectedRouteId) || null;
  const audit: VanSafetyAuditResult | null = currentRoute?.audit || null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Link href="/admin/students" className="hover:text-[#7B1C3E] flex items-center gap-1 transition-colors">
              <ChevronLeft className="w-4 h-4" /> ทะเบียนนักเรียน
            </Link>
            <span>/</span>
            <span className="text-amber-600 dark:text-amber-400">ความปลอดภัยรถรับ-ส่งนักเรียน (Child In-Van Safety)</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-2xl shadow-md shadow-amber-500/20">
              <Bus className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Child In-Van Safety Alert
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                ระบบเช็กชื่อขึ้น-ลงรถโรงเรียน และตรวจจับป้องกันเด็กลืมติดในรถตู้ 100% พร้อมไซเรนเตือนภัย
              </p>
            </div>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 dark:text-white"
          />

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setTripType('morning')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                tripType === 'morning' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              🌅 เที่ยวเช้า (มารร.)
            </button>
            <button
              onClick={() => setTripType('evening')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                tripType === 'evening' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              🌆 เที่ยวเย็น (กลับบ้าน)
            </button>
          </div>

          <button
            onClick={() => setIsSirenMuted(!isSirenMuted)}
            className={`p-2.5 rounded-xl border transition-all ${
              isSirenMuted 
                ? 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800' 
                : 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/40'
            }`}
            title={isSirenMuted ? 'เปิดเสียงไซเรน' : 'ปิดเสียงไซเรน'}
          >
            {isSirenMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 animate-pulse" />}
          </button>

          <button
            onClick={fetchRoutes}
            disabled={isLoading}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl transition-all"
            title="รีเฟรช"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Emergency Alarm Siren Banner (if trapped students detected!) */}
      {audit?.alarmLevel === 'EMERGENCY_ALARM' && (
        <div className="p-5 bg-rose-600 text-white rounded-3xl shadow-xl shadow-rose-600/30 border-2 border-rose-400 flex flex-col md:flex-row items-center justify-between gap-4 animate-bounce">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-2xl">
              <ShieldAlert className="w-8 h-8 text-white animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight">
                {audit.message}
              </h2>
              <p className="text-xs sm:text-sm text-rose-100 mt-0.5">
                รายชื่อที่ยังค้างในรถ: {audit.trappedStudents.map(s => `${s.studentName} (${s.grade || '-'})`).join(', ')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkAllDisembarked}
              className="px-5 py-2.5 bg-white text-rose-700 font-extrabold rounded-xl shadow-lg hover:bg-rose-50 active:scale-95 transition-all text-xs sm:text-sm"
            >
              ตรวจค้นครบแล้ว และกดลงรถทุกคน
            </button>
          </div>
        </div>
      )}

      {/* All Clear Banner */}
      {audit?.alarmLevel === 'SAFE' && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <span>{audit.message}</span>
          </div>
          <span className="text-xs text-emerald-700 dark:text-emerald-400">
            ลงรถแล้ว: {audit.disembarkedCount} คน • ขาด: {audit.absentCount} คน
          </span>
        </div>
      )}

      {/* Van Routes Navigation Tabs */}
      <div className="flex overflow-x-auto gap-3 pb-2 hide-scrollbar">
        {routes.map(r => {
          const isSelected = r.id === selectedRouteId;
          const rAudit = r.audit;
          const isAlarm = rAudit?.alarmLevel === 'EMERGENCY_ALARM';

          return (
            <button
              key={r.id}
              onClick={() => setSelectedRouteId(r.id)}
              className={`flex-shrink-0 p-4 rounded-2xl border text-left transition-all ${
                isSelected
                  ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-extrabold text-sm">{r.route_name}</span>
                {isAlarm && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black animate-pulse">
                    เด็กค้างในรถ!
                  </span>
                )}
              </div>
              <div className={`text-xs mt-1 ${isSelected ? 'text-amber-100' : 'text-slate-500'}`}>
                ทะเบียน: {r.license_plate} • {r.driver_name}
              </div>
              <div className={`text-[11px] mt-2 font-semibold ${isSelected ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                ขึ้นรถ: {rAudit?.boardedCount || 0} • ลงแล้ว: {rAudit?.disembarkedCount || 0} / {r.student_ids?.length || 0}
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Route Passenger Checklist */}
      {currentRoute ? (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <span>{currentRoute.route_name}</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {currentRoute.license_plate}
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                พนักงานขับรถ: {currentRoute.driver_name} {currentRoute.driver_phone ? `(${currentRoute.driver_phone})` : ''} • ครูเวรประจำรถ: {currentRoute.teacher_supervisor_name || 'ครูเวร'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleMarkAllDisembarked}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 text-xs sm:text-sm"
              >
                <CheckCircle2 className="w-4 h-4" /> แตะลงจากรถทุกคน (เมื่อถึง รร.)
              </button>
            </div>
          </div>

          {/* Passenger Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(currentRoute.logs || []).map((log: VanDailyLogItem) => {
              const isBoarded = log.status === 'BOARDED';
              const isDisembarked = log.status === 'DISEMBARKED';
              const isAbsent = log.status === 'ABSENT';

              return (
                <div
                  key={log.studentId}
                  className={`p-4 rounded-2xl border transition-all space-y-3 ${
                    isBoarded
                      ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-300 shadow-sm'
                      : isDisembarked
                      ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200'
                      : isAbsent
                      ? 'bg-slate-100/60 dark:bg-slate-800/40 border-slate-200 opacity-60'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                        {log.studentName}
                      </h4>
                      <p className="text-xs text-slate-500 font-mono">
                        ชั้น {log.grade || '-'}
                      </p>
                    </div>
                    {isBoarded && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold animate-pulse">
                        อยู่บนรถ
                      </span>
                    )}
                    {isDisembarked && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                        ลงรถแล้ว
                      </span>
                    )}
                    {isAbsent && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 font-bold text-[10px]">
                        ไม่ขึ้นรถ
                      </span>
                    )}
                  </div>

                  {/* 3 Action Buttons */}
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    <button
                      onClick={() => handleUpdateStatus(log.studentId, 'BOARDED')}
                      className={`py-1.5 rounded-xl font-bold text-xs transition-all border ${
                        isBoarded
                          ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      1. ขึ้นรถ
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(log.studentId, 'DISEMBARKED')}
                      className={`py-1.5 rounded-xl font-bold text-xs transition-all border ${
                        isDisembarked
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      2. ลงรถ
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(log.studentId, 'ABSENT')}
                      className={`py-1.5 rounded-xl font-bold text-xs transition-all border ${
                        isAbsent
                          ? 'bg-slate-700 text-white border-slate-700 shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      ขาด
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      ) : (
        <div className="p-8 text-center text-slate-500 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          ยังไม่มีข้อมูลเส้นทางรถตู้ กรุณาสร้างเส้นทางรถตู้ในระบบ
        </div>
      )}

    </div>
  );
}
