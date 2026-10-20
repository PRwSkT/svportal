'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  QrCode,
  ShieldCheck,
  ShieldAlert,
  Car,
  Bus,
  Clock,
  Phone,
  CheckCircle2,
  KeyRound,
  ArrowLeft,
  ExternalLink,
  Volume2,
  UserCheck,
  Sparkles,
  RefreshCw,
  Lock,
  User,
  Pin,
  Bell,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  getPipelineState,
  PIPELINE_EVENT_NAME,
  updatePickupDailyPlan,
  verifyPickupTotp,
  generatePickupTotp,
  getPickupBucketSecondsRemaining,
} from '@/lib/pipeline/bidirectional-store';
import {
  BidirectionalPipelineState,
  PickupArrivalStatus,
} from '@/types/family-pipeline';

export default function SmartPickupKioskPage() {
  const { isThai } = useLanguage();
  const [pipeline, setPipeline] = useState<BidirectionalPipelineState>(() =>
    getPipelineState()
  );
  const [selectedStudentId, setSelectedStudentId] = useState<string>(() => {
    const s = getPipelineState();
    return s.children[0]?.id || '10103';
  });
  const [totpInput, setTotpInput] = useState<string>('');
  const [secondsLeft, setSecondsLeft] = useState<number>(() =>
    getPickupBucketSecondsRemaining()
  );
  const [liveTotpCode, setLiveTotpCode] = useState<string>(() => {
    const s = getPipelineState();
    const id = s.children[0]?.id || '10103';
    return generatePickupTotp(id);
  });
  const [verifiedStudentIds, setVerifiedStudentIds] = useState<string[]>([]);
  const [lastVerifiedMode, setLastVerifiedMode] = useState<string | null>(null);

  const syncPipeline = useCallback(() => {
    setPipeline({ ...getPipelineState() });
  }, []);

  useEffect(() => {
    syncPipeline();
    const handleUpdate = () => syncPipeline();
    window.addEventListener(PIPELINE_EVENT_NAME, handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener(PIPELINE_EVENT_NAME, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [syncPipeline]);

  // 1-second timer for live 30-second rotating TOTP display
  useEffect(() => {
    const updateTicker = () => {
      setSecondsLeft(getPickupBucketSecondsRemaining());
      setLiveTotpCode(generatePickupTotp(selectedStudentId));
    };
    updateTicker();
    const interval = setInterval(updateTicker, 1000);
    return () => clearInterval(interval);
  }, [selectedStudentId]);

  const plans = pipeline.pickup_plans;
  const selectedPlan =
    plans.find((p) => p.student_id === selectedStudentId) || plans[0];

  // Check if selected student or any student in queue has a legal custody restriction
  const restrictedLinks = pipeline.links.filter(
    (l) => l.has_legal_restriction === true
  );
  const selectedStudentRestrictedLink = pipeline.links.find(
    (l) => l.student_id === selectedStudentId && l.has_legal_restriction === true
  );

  const handleVerifyCode = (codeToTest?: string) => {
    const code = (codeToTest ?? totpInput).trim();
    if (!code) {
      toast.error(
        isThai ? 'กรุณากรอกรหัส TOTP 6 หลัก หรือรหัสผู้รับแทน' : 'Please enter 6-digit TOTP code'
      );
      return;
    }

    if (selectedStudentRestrictedLink) {
      toast.error(
        isThai
          ? 'คำสั่งระงับการส่งมอบ! นักเรียนรายนี้มีคำสั่งจำกัดสิทธิ์การรับกลับ (Child Safeguarding Alert)'
          : 'BLOCKED! Active Child Safeguarding / Custody Restriction on this student.'
      );
      return;
    }

    const res = verifyPickupTotp(selectedStudentId, code);
    if (res.valid) {
      setVerifiedStudentIds((prev) =>
        prev.includes(selectedStudentId) ? prev : [...prev, selectedStudentId]
      );
      setLastVerifiedMode(res.matchedMode);
      toast.success(
        isThai
          ? `ยืนยันตัวตนสำเร็จ (${res.matchedMode})! พร้อมส่งมอบ ${selectedPlan?.student_name}`
          : `Verified (${res.matchedMode})! Ready to release ${selectedPlan?.student_name}`
      );
    } else {
      toast.error(
        isThai
          ? 'รหัส TOTP ไม่ถูกต้องหรือหมดอายุ กรุณาตรวจสอบรหัสปัจจุบันจากแอปผู้ปกครอง'
          : 'Invalid or expired TOTP code'
      );
    }
  };

  const handleConfirmSafeRelease = (studentId: string, studentName: string) => {
    const linkRestricted = pipeline.links.find(
      (l) => l.student_id === studentId && l.has_legal_restriction === true
    );
    if (linkRestricted) {
      toast.error(
        isThai
          ? `ไม่สามารถส่งมอบ ${studentName} ได้เนื่องจากมีคำสั่งระงับสิทธิ์ตามกฎหมาย: ${linkRestricted.restriction_note || ''}`
          : `Cannot release ${studentName} due to active Legal Custody Restriction!`
      );
      return;
    }

    updatePickupDailyPlan({
      student_id: studentId,
      arrival_status: 'RELEASED',
      released_by_staff: 'ครูเวรจุดรับ-ส่ง อาคารหน้า',
      actor_role: 'STAFF',
      actor_name: 'ครูเวรจุดรับ-ส่ง อาคารหน้า',
    });
    syncPipeline();
    toast.success(
      isThai
        ? `ยืนยันส่งมอบ ${studentName} ให้ผู้ปกครองอย่างปลอดภัยเรียบร้อยแล้ว! (ซิงค์ไปยัง /parents ทันที)`
        : `Confirmed safe release for ${studentName}!`
    );
  };

  const handleSetArrivalStatus = (
    studentId: string,
    status: PickupArrivalStatus
  ) => {
    updatePickupDailyPlan({
      student_id: studentId,
      arrival_status: status,
      actor_role: 'STAFF',
      actor_name: 'ครูเวรจุดรับ-ส่ง อาคารหน้า',
    });
    syncPipeline();
    toast.success(
      isThai
        ? `อัปเดตสถานะคิวรับ-ส่งเป็น ${status}`
        : `Updated queue status to ${status}`
    );
  };

  return (
    <div className="sv-container-context min-h-[100dvh] bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <Link
                href="/admin/students"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:text-[#7B1C3E] transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {isThai ? 'ฝ่ายบริหารและสวัสดิภาพนักเรียน' : 'Student Safety'}
              </Link>
              <span>•</span>
              <span className="text-[#7B1C3E] dark:text-amber-300">
                Smart Pickup & Dismissal Gate Kiosk
              </span>
            </div>

            <h1 className="sv-fluid-title text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
              <span className="p-2.5 rounded-2xl bg-[#7B1C3E] text-white shadow-md shadow-[#7B1C3E]/20">
                <QrCode className="w-6 h-6" />
              </span>
              {isThai
                ? 'จุดรับ-ส่งนักเรียนอัจฉริยะ (Smart Pickup & Dismissal Gate Kiosk)'
                : 'Smart Pickup & Dismissal Gate Kiosk'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              {isThai
                ? 'ตรวจสอบรหัส QR / 6-Digit TOTP หมุนเวียนทุก 30 วินาที • รหัส OTP มอบอำนาจรับแทน • ระบบคัดกรองคำสั่งศาลคุ้มครองสวัสดิภาพเด็ก'
                : 'Verify 30s Rotating QR/TOTP • Temporary Delegate OTP • Real-time Child Safeguarding Custody Guard'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/parents"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-[#7B1C3E] dark:text-amber-300 border border-[#D4AF37]/40 text-xs font-bold hover:bg-amber-100 transition-all"
            >
              <ExternalLink className="w-4 h-4" />
              {isThai ? 'เปิด QR ผู้ปกครอง (/parents)' : 'Open Parent QR (/parents)'}
            </Link>
            <button
              type="button"
              onClick={syncPipeline}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              {isThai ? 'รีเฟรชคิว' : 'Refresh Queue'}
            </button>
          </div>
        </div>

        {/* Child Safeguarding / Custody Restriction Banner */}
        {restrictedLinks.length > 0 && (
          <div className="p-5 rounded-3xl bg-rose-600 text-white shadow-xl shadow-rose-600/25 border-2 border-rose-300 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-2xl bg-white/20 shrink-0">
                <ShieldAlert className="w-7 h-7 text-white animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-white text-rose-700">
                    CHILD SAFEGUARDING / CUSTODY ALERT
                  </span>
                  <h2 className="text-base sm:text-lg font-black">
                    {isThai
                      ? 'แจ้งเตือนคำสั่งคุ้มครองสวัสดิภาพเด็กและระงับสิทธิ์การรับนักเรียน!'
                      : 'Active Child Safeguarding & Legal Custody Restriction Alert!'}
                  </h2>
                </div>
                {restrictedLinks.map((rl) => {
                  const child = pipeline.children.find(
                    (c) => c.id === rl.student_id
                  );
                  return (
                    <p key={rl.id} className="text-xs sm:text-sm text-rose-100">
                      • <strong>{child?.full_name || rl.student_id}</strong> (
                      {child?.grade}): {rl.restriction_note || 'ห้ามส่งมอบโดยไม่ได้รับอนุญาต'}
                    </p>
                  );
                })}
              </div>
            </div>
            <Link
              href={`/admin/students/${restrictedLinks[0].student_id}`}
              className="px-4 py-2.5 rounded-xl bg-white text-rose-700 text-xs font-extrabold shrink-0 hover:bg-rose-50 transition-all"
            >
              {isThai ? 'ตรวจสอบสิทธิ์ในทะเบียนนักเรียน' : 'Manage Custody Settings'}
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 5 cols: Interactive QR / 6-Digit TOTP & Delegate OTP Verifier */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border-2 border-[#7B1C3E]/20 dark:border-rose-900/40 shadow-md space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-[#7B1C3E]/10 text-[#7B1C3E] dark:text-amber-300">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                      {isThai
                        ? 'เครื่องตรวจสอบรหัสรับนักเรียน (TOTP & OTP Verifier)'
                        : 'Interactive TOTP & Delegate OTP Verifier'}
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      {isThai
                        ? 'เลือกนักเรียนและกรอกรหัส 6 หลักจากหน้าจอผู้ปกครอง'
                        : 'Select student and verify 6-digit dynamic TOTP or Delegate OTP'}
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-amber-100 text-amber-900 inline-flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-700" />
                  <span>{secondsLeft}s</span>
                </span>
              </div>

              {/* Student Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                  {isThai ? '1. เลือกนักเรียนที่จุดรับ-ส่ง:' : '1. Select Student at Gate:'}
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {plans.map((p) => {
                    const isSelected = p.student_id === selectedStudentId;
                    const isRestricted = pipeline.links.some(
                      (l) =>
                        l.student_id === p.student_id && l.has_legal_restriction
                    );
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedStudentId(p.student_id);
                          setTotpInput(generatePickupTotp(p.student_id));
                        }}
                        className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-[#7B1C3E] text-white border-[#7B1C3E] shadow-md'
                            : 'bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div>
                          <div className="font-extrabold text-xs sm:text-sm flex items-center gap-2">
                            <span>
                              {p.student_name} ({p.nickname})
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                isSelected
                                  ? 'bg-white/20 text-white'
                                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {p.grade_level}
                            </span>
                            {isRestricted && (
                              <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black">
                                RESTRICTED
                              </span>
                            )}
                          </div>
                          <div
                            className={`text-[11px] mt-0.5 ${
                              isSelected ? 'text-rose-100' : 'text-slate-500'
                            }`}
                          >
                            ผู้มารับ: {p.collector_name} ({p.collector_relationship})
                          </div>
                        </div>
                        <span className="font-mono text-xs font-bold">
                          #{p.student_id}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Helper Pill showing live expected TOTP from generatePickupTotp(studentId) */}
              <div className="p-4 rounded-2xl bg-amber-50/90 dark:bg-amber-950/30 border border-[#D4AF37]/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#7B1C3E] dark:text-amber-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    {isThai
                      ? `รหัส TOTP ปัจจุบันของ #${selectedStudentId} (สำหรับทดสอบ 1-Click):`
                      : `Live Expected TOTP for #${selectedStudentId}:`}
                  </span>
                  <span className="font-mono text-lg font-black tracking-widest text-[#7B1C3E] dark:text-amber-200 bg-white dark:bg-slate-900 px-3 py-1 rounded-xl border border-amber-300">
                    {liveTotpCode}
                  </span>
                </div>

                {selectedPlan?.temp_otp_code && (
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-amber-200/60">
                    <span className="font-bold text-indigo-700 dark:text-indigo-300">
                      {isThai
                        ? 'รหัส OTP ผู้รับแทนชั่วคราว (Delegate OTP):'
                        : 'Active Delegate Temp OTP:'}
                    </span>
                    <span className="font-mono font-black text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-lg">
                      {selectedPlan.temp_otp_code}
                    </span>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setTotpInput(liveTotpCode);
                      handleVerifyCode(liveTotpCode);
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-[#7B1C3E] hover:bg-[#631430] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {isThai
                      ? `กรอกอัตโนมัติ & ยืนยันรหัส TOTP (${liveTotpCode})`
                      : `Auto-fill & Verify TOTP (${liveTotpCode})`}
                  </button>
                </div>
              </div>

              {/* Manual Input & Verify Button */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
                  {isThai
                    ? '2. กรอกรหัส 6 หลัก (TOTP หรือ Delegate OTP):'
                    : '2. Enter 6-Digit Pickup Code:'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={8}
                    value={totpInput}
                    onChange={(e) => setTotpInput(e.target.value)}
                    placeholder="กรอกรหัส 6 หลัก..."
                    className="flex-1 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-base font-black tracking-widest text-center text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleVerifyCode()}
                    className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm shrink-0 shadow-md cursor-pointer"
                  >
                    {isThai ? 'ตรวจสอบรหัส' : 'Verify Code'}
                  </button>
                </div>
              </div>

              {/* Verification Status & 1-Click Release */}
              {selectedPlan && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">
                      {isThai ? 'สถานะการยืนยันตัวตน:' : 'Verification Status:'}
                    </span>
                    {verifiedStudentIds.includes(selectedPlan.student_id) ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {isThai
                          ? `ยืนยันรหัสผ่านแล้ว (${lastVerifiedMode || 'TOTP'})`
                          : `Verified (${lastVerifiedMode || 'TOTP'})`}
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                        {isThai ? 'รอสแกน QR / TOTP' : 'Awaiting TOTP Scan'}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={Boolean(selectedStudentRestrictedLink)}
                    onClick={() =>
                      handleConfirmSafeRelease(
                        selectedPlan.student_id,
                        selectedPlan.student_name
                      )
                    }
                    className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-rose-300 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                  >
                    <UserCheck className="w-5 h-5" />
                    {isThai
                      ? 'ยืนยันส่งมอบนักเรียน (Confirm Safe Release)'
                      : 'Confirm Safe Release'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right 7 cols: Live Queue of pickup_plans */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <Volume2 className="w-5 h-5 text-[#7B1C3E]" />
                    {isThai
                      ? 'คิวรับ-ส่งนักเรียนแบบเรียลไทม์ (Live Dismissal Gate Queue)'
                      : 'Live Dismissal & Transport Queue'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {isThai
                      ? 'ซิงค์อัตโนมัติเมื่อผู้ปกครองกด "กำลังเดินทาง (Arriving Soon)" หรือ "ถึงหน้าประตูแล้ว (Arrived at Gate)" ใน /parents'
                      : 'Automatically updates when parents tap Arriving Soon or Arrived at Gate in /parents'}
                  </p>
                </div>
              </div>

              <div className="space-y-3.5">
                {plans.map((plan) => {
                  const isRestricted = pipeline.links.find(
                    (l) =>
                      l.student_id === plan.student_id &&
                      l.has_legal_restriction === true
                  );
                  const isReleased = plan.arrival_status === 'RELEASED';
                  const isAtGate = plan.arrival_status === 'ARRIVED_AT_GATE';
                  const isArriving = plan.arrival_status === 'ARRIVING_SOON';

                  return (
                    <div
                      key={plan.id}
                      className={`p-5 rounded-3xl border-2 transition-all space-y-4 ${
                        isRestricted
                          ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-500'
                          : isAtGate
                          ? 'bg-amber-50/90 dark:bg-amber-950/30 border-amber-400 shadow-md'
                          : isReleased
                          ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300'
                          : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold flex items-center gap-1 ${
                                plan.transport_mode === 'SCHOOL_VAN'
                                  ? 'bg-blue-100 text-blue-800'
                                  : plan.transport_mode === 'PARENT_PICKUP'
                                  ? 'bg-[#7B1C3E]/10 text-[#7B1C3E] dark:bg-amber-950 dark:text-amber-300'
                                  : 'bg-purple-100 text-purple-800'
                              }`}
                            >
                              {plan.transport_mode === 'SCHOOL_VAN' ? (
                                <Bus className="w-3.5 h-3.5" />
                              ) : (
                                <Car className="w-3.5 h-3.5" />
                              )}
                              {plan.transport_mode}
                            </span>

                            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                              {plan.student_name} ({plan.nickname}) • ชั้น{' '}
                              {plan.grade_level}
                            </h3>
                          </div>

                          <div className="text-xs text-slate-600 dark:text-slate-300 flex flex-wrap items-center gap-3">
                            <span className="inline-flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              <span><strong>{isThai ? 'ผู้รับ:' : 'Collector:'}</strong>{' '}
                              {plan.collector_name} ({plan.collector_relationship})</span>
                            </span>
                            {plan.collector_phone && (
                              <span className="inline-flex items-center gap-1 font-mono">
                                <Phone className="w-3 h-3 text-slate-400" />
                                {plan.collector_phone}
                              </span>
                            )}
                          </div>

                          {plan.notes && (
                            <p className="text-xs text-slate-500 inline-flex items-center gap-1.5">
                              <Pin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{plan.notes}</span>
                            </p>
                          )}
                        </div>

                        {/* Real-time Arrival Status Badge */}
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-black inline-flex items-center gap-1.5 ${
                              isReleased
                                ? 'bg-emerald-600 text-white'
                                : isAtGate
                                ? 'bg-amber-500 text-slate-950 animate-pulse'
                                : isArriving
                                ? 'bg-sky-500 text-white'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            {isAtGate && <Bell className="w-3 h-3 shrink-0" />}
                            <span>
                              {plan.arrival_status === 'SCHEDULED'
                                ? isThai
                                  ? 'รอเวลารับกลับ (SCHEDULED)'
                                  : 'SCHEDULED'
                                : plan.arrival_status === 'ARRIVING_SOON'
                                ? isThai
                                  ? 'กำลังใกล้ถึงโรงเรียน (ARRIVING SOON)'
                                  : 'ARRIVING SOON'
                                : plan.arrival_status === 'ARRIVED_AT_GATE'
                                ? isThai
                                  ? 'ถึงจุดรับหน้าประตูแล้ว (AT GATE)'
                                  : 'ARRIVED AT GATE'
                                : isThai
                                ? 'ส่งมอบปลอดภัยแล้ว (RELEASED)'
                                : 'RELEASED'}
                            </span>
                          </span>

                          {plan.released_at && (
                            <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">
                              ส่งมอบเวลา {plan.released_at} โดย{' '}
                              {plan.released_by_staff}
                            </span>
                          )}
                        </div>
                      </div>

                      {isRestricted && (
                        <div className="p-3 rounded-2xl bg-rose-600 text-white text-xs font-bold flex items-center gap-2">
                          <Lock className="w-4 h-4 shrink-0" />
                          <span>
                            คำสั่งระงับสิทธิ์การรับนักเรียน (Child Safeguarding
                            Alert): {isRestricted.restriction_note}
                          </span>
                        </div>
                      )}

                      {/* Queue Action Bar */}
                      <div className="pt-3 border-t border-slate-200/70 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              handleSetArrivalStatus(
                                plan.student_id,
                                'ARRIVING_SOON'
                              )
                            }
                            className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
                          >
                            {isThai ? 'จำลอง: ใกล้ถึง' : 'Set Arriving Soon'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleSetArrivalStatus(
                                plan.student_id,
                                'ARRIVED_AT_GATE'
                              )
                            }
                            className="px-2.5 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-[11px] font-bold cursor-pointer"
                          >
                            {isThai
                              ? 'จำลอง: ถึงหน้าประตู'
                              : 'Set Arrived at Gate'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStudentId(plan.student_id);
                              const code = generatePickupTotp(plan.student_id);
                              setTotpInput(code);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 text-[11px] font-bold hover:bg-indigo-100 cursor-pointer"
                          >
                            {isThai ? 'ตรวจรหัส TOTP' : 'Load in Verifier'}
                          </button>
                        </div>

                        <button
                          type="button"
                          disabled={Boolean(isRestricted)}
                          onClick={() =>
                            handleConfirmSafeRelease(
                              plan.student_id,
                              plan.student_name
                            )
                          }
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-rose-300 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          {isThai
                            ? 'ยืนยันส่งมอบนักเรียน (Confirm Safe Release)'
                            : 'Confirm Safe Release'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
