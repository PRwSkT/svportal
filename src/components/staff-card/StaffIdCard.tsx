'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import QRCode from 'qrcode';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  RotateCw, 
  ShieldCheck, 
  Clock, 
  Sparkles, 
  QrCode as QrIcon, 
  ExternalLink,
  CheckCircle2,
  Building2,
  Phone,
  Globe,
  Award
} from 'lucide-react';
import { Personnel } from '@/types';
import { formatStaffName, formatStaffPosition, getStaffVerificationUrl } from '@/lib/staff-card/utils';
import { SCHOOL_INFO, DEFAULT_ACADEMIC_YEAR } from '@/lib/constants/school';

interface StaffIdCardProps {
  personnel: Partial<Personnel>;
  width?: number; // Base width in px, default 360px (height = 570px)
  showControls?: boolean;
  isFlipped?: boolean;
  onFlipChange?: (flipped: boolean) => void;
  className?: string;
  frontRef?: React.RefObject<HTMLDivElement | null>;
  backRef?: React.RefObject<HTMLDivElement | null>;
}

export function StaffIdCard({
  personnel,
  width = 360,
  showControls = true,
  isFlipped: controlledFlipped,
  onFlipChange,
  className = '',
  frontRef,
  backRef,
}: StaffIdCardProps) {
  const [internalFlipped, setInternalFlipped] = useState(false);
  const isFlipped = controlledFlipped !== undefined ? controlledFlipped : internalFlipped;

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');

  const nameInfo = formatStaffName(personnel.name_en, personnel.name_th);
  const positionEn = formatStaffPosition(personnel.position_en, personnel.position_th);

  // Height based on 720:1140 aspect ratio
  const height = Math.round(width * (1140 / 720));

  // Ticking Clock for dynamic anti-screenshot proof
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateStr = now.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
      setCurrentTime(timeStr);
      setCurrentDate(dateStr);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Generate QR code for verification in Somkid Navy
  useEffect(() => {
    const verificationUrl = getStaffVerificationUrl(personnel.id || 'preview');
    QRCode.toDataURL(verificationUrl, {
      width: 360,
      margin: 1,
      color: {
        dark: '#183e66',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch((err) => console.error('Failed to generate QR code:', err));
  }, [personnel.id]);

  const handleToggleFlip = () => {
    const next = !isFlipped;
    setInternalFlipped(next);
    onFlipChange?.(next);
  };

  // Profile image fallback: ONLY Kru Chattraporn defaults to sample teacher image
  const isSampleKruChattraporn = !personnel.image_url && (
    Boolean(personnel.name_th?.includes('ฉัตรพร')) || 
    Boolean(personnel.name_en?.toUpperCase().includes('CHATTRAPORN'))
  );
  const photoUrl = personnel.image_url || (isSampleKruChattraporn ? '/staff-card/sample-teacher.png' : null);

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      {/* 3D Flip Card Container */}
      <div 
        className="relative group cursor-pointer"
        style={{
          width: `${width}px`,
          height: `${height}px`,
          perspective: '1200px',
        }}
        onClick={handleToggleFlip}
      >
        <div
          className="w-full h-full relative transition-transform duration-700 ease-out"
          style={{
            transformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* ======================================================== */}
          {/* FRONT SIDE (หน้าบัตร)                                   */}
          {/* ======================================================== */}
          <div
            ref={frontRef as any}
            className="absolute inset-0 w-full h-full rounded-[28px] sm:rounded-[32px] overflow-hidden bg-white shadow-2xl border border-slate-200/80"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(0deg) translateZ(1px)',
              zIndex: isFlipped ? 1 : 2,
              pointerEvents: isFlipped ? 'none' : 'auto',
              opacity: isFlipped ? 0 : 1,
              transition: 'opacity 0.25s ease-out',
            }}
          >
            {/* Layer 1: Background Template (Building sketch + Top/Bottom logos) */}
            <div 
              className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat pointer-events-none"
              style={{ backgroundImage: "url('/staff-card/card-bg.png')" }}
            />

            {/* Layer 2: Person Portrait Photo or Silhouette Placeholder */}
            {photoUrl ? (
              <div 
                className="absolute pointer-events-none overflow-hidden"
                style={{
                  width: '110.24%',
                  left: '-1.17%',
                  bottom: 0,
                  height: '92.83%',
                  zIndex: 2,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoUrl}
                  alt={nameInfo.fullNameEn || 'Staff Portrait'}
                  className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.01]"
                  loading="eager"
                />
              </div>
            ) : (
              <div 
                className="absolute inset-x-0 pointer-events-none flex flex-col items-center justify-center z-[2]"
                style={{
                  top: '22%',
                  bottom: '32%',
                }}
              >
                <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-white/70 backdrop-blur-xs border border-dashed border-[#183e66]/30 shadow-xs max-w-[70%] text-center">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr from-[#183e66] to-[#255f9a] text-white flex items-center justify-center shadow-md mb-2.5">
                    {nameInfo.firstName ? (
                      <span className="text-xl sm:text-2xl font-bold tracking-wider font-mono">
                        {nameInfo.firstName.slice(0, 2)}
                      </span>
                    ) : (
                      <User className="w-8 h-8 text-white/90" />
                    )}
                  </div>
                  <p className="text-[11px] font-bold text-[#183e66]">ยังไม่มีรูปถ่ายประจำตัว</p>
                  <p className="text-[9px] text-slate-500 mt-0.5 leading-snug">
                    สามารถใส่รูปและข้อมูลติดต่อได้ที่ปุ่ม &quot;แก้ไขข้อมูลติดต่อ / โซเชียล&quot;
                  </p>
                </div>
              </div>
            )}

            {/* Layer 2.5: Soft White Bottom Gradient Overlay (Covers bottom of photo & building sketch behind text) */}
            <div 
              className="absolute inset-x-0 bottom-0 pointer-events-none z-[3]"
              style={{
                height: `${Math.round(height * 0.30)}px`,
                background: 'linear-gradient(to top, rgba(255,255,255,1) 0%, rgba(255,255,255,0.96) 25%, rgba(255,255,255,0.65) 60%, rgba(255,255,255,0) 100%)',
              }}
            />

            {/* Layer 3: Dynamic Live Security Seal & Pulse Indicator */}
            <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-md shadow-xs border border-emerald-200/80">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-bold text-emerald-800 tracking-wider">ACTIVE</span>
              <span className="text-[10px] text-slate-400 font-mono pl-1 border-l border-slate-200">
                {currentTime || '--:--:--'}
              </span>
            </div>

            {/* Layer 4: Foreground Typography (Right-aligned First Name, Last Name, Position) */}
            <div 
              className="absolute inset-x-0 bottom-0 z-10 pointer-events-none text-right"
              style={{
                paddingLeft: `${Math.round(width * 0.0726)}px`,
                paddingRight: `${Math.round(width * 0.0726)}px`,
                paddingBottom: `${Math.round(height * 0.072)}px`,
              }}
            >
              <div className="flex flex-col items-end">
                {/* First Name (Large Bold Navy) */}
                <h1 
                  className="font-bold tracking-tight text-[#183e66] leading-[0.92] uppercase drop-shadow-xs"
                  style={{
                    fontSize: `${Math.round(width * 0.12)}px`,
                    fontFamily: '"Sukhumvit Set", sans-serif',
                  }}
                >
                  {nameInfo.firstName}
                </h1>

                {/* Last Name (Medium Navy, Right Aligned) */}
                {nameInfo.lastName && (
                  <h2 
                    className="font-medium text-[#183e66] leading-tight uppercase drop-shadow-xs mt-0.5"
                    style={{
                      fontSize: `${Math.round(width * 0.068)}px`,
                      fontFamily: '"Sukhumvit Set", sans-serif',
                    }}
                  >
                    {nameInfo.lastName}
                  </h2>
                )}

                {/* Position with matching underline, Right Aligned */}
                <div className="flex flex-col items-end mt-1.5">
                  <span 
                    className="text-[#183e66] font-bold tracking-wider uppercase opacity-95"
                    style={{
                      fontSize: `${Math.max(9, Math.round(width * 0.024))}px`,
                    }}
                  >
                    {positionEn}
                  </span>
                  <div className="w-full h-[1.5px] bg-[#183e66] opacity-80 mt-0.5 rounded-full" />
                </div>
              </div>
            </div>

            {/* Layer 4.5: Crisp S1RI THAM Logo (Above white gradient so it never fades/sinks) */}
            <div 
              className="absolute inset-x-0 flex justify-center pointer-events-none z-20"
              style={{ bottom: `${Math.round(height * 0.018)}px` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src="/staff-card/siritham-logo.png" 
                alt="S1RI THAM" 
                style={{ height: `${Math.round(height * 0.03)}px` }}
                className="w-auto object-contain"
              />
            </div>

            {/* Hologram Light Sheen (Simulates Physical Card Lamination Reflection) */}
            <div 
              className="absolute inset-0 pointer-events-none opacity-30 mix-blend-overlay group-hover:opacity-60 transition-opacity duration-500"
              style={{
                background: 'linear-gradient(115deg, transparent 20%, rgba(255,255,255,0.7) 40%, rgba(255,255,255,0.9) 45%, rgba(255,255,255,0.2) 50%, transparent 70%)',
                backgroundSize: '200% 200%',
              }}
            />
          </div>

          {/* ======================================================== */}
          {/* BACK SIDE (หลังบัตร - ดีไซน์เดียวกับด้านหน้า ขาว-กรมท่า #183e66) */}
          {/* ======================================================== */}
          <div
            ref={backRef as any}
            className="absolute inset-0 w-full h-full rounded-[28px] sm:rounded-[32px] overflow-hidden bg-white text-[#183e66] shadow-2xl border border-slate-200/80 p-6 flex flex-col justify-between"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg) translateZ(1px)',
              zIndex: isFlipped ? 2 : 1,
              pointerEvents: isFlipped ? 'auto' : 'none',
              opacity: isFlipped ? 1 : 0,
              transition: 'opacity 0.25s ease-out',
            }}
          >
            {/* Subtle Architectural Sketch Watermark (building only, no overlapping logos) */}
            <div 
              className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat pointer-events-none opacity-[0.08]"
              style={{ backgroundImage: "url('/staff-card/building-bg.png')" }}
            />

            {/* Top: Official School Crest & Wordmark (using uncropped logo2.png) */}
            <div className="relative z-10 flex flex-col items-center pt-1 pb-3 border-b border-[#183e66]/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src="/logo2.png" 
                alt="Somkidvittaya School" 
                className="h-14 sm:h-16 w-auto object-contain" 
              />
            </div>

            {/* Middle: Crisp Navy QR Code & Center-Aligned Thai Staff Info */}
            <div className="relative z-10 flex flex-col items-center justify-center my-auto py-2 w-full">
              <div className="p-2.5 bg-white rounded-2xl border border-[#183e66]/15 shadow-xs flex flex-col items-center">
                {qrCodeDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrCodeDataUrl}
                    alt="Staff Verification QR"
                    className="w-32 h-32 sm:w-36 sm:h-36 object-contain"
                  />
                ) : (
                  <div className="w-32 h-32 sm:w-36 sm:h-36 flex items-center justify-center bg-slate-50 rounded-xl">
                    <QrIcon className="w-8 h-8 text-[#183e66]/40 animate-pulse" />
                  </div>
                )}
              </div>

              {/* Center-aligned Staff Details in consistent Thai */}
              <div className="w-full mt-4 text-center px-2">
                <p 
                  className="text-sm sm:text-base font-bold text-[#183e66] leading-snug"
                  style={{ fontFamily: '"Sukhumvit Set", sans-serif' }}
                >
                  {nameInfo.fullNameTh || personnel.name_th || nameInfo.fullNameEn}
                </p>
                <p className="text-xs font-medium text-slate-600 mt-0.5">
                  {personnel.position_th || positionEn}
                </p>
              </div>
            </div>

            {/* Bottom: Validity Dates (consistent Thai) & Official School Footer */}
            <div className="relative z-10 space-y-2.5 pt-3 border-t border-[#183e66]/15">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <span className="block text-[8.5px] font-bold text-slate-400">ปีการศึกษา</span>
                  <span className="text-[11px] font-bold text-[#183e66]">{personnel.academic_year || '2569'}</span>
                </div>
                <div>
                  <span className="block text-[8.5px] font-bold text-slate-400">วันออกบัตร</span>
                  <span className="text-[10px] font-semibold text-[#183e66]">{personnel.card_issue_date || '16 พ.ค. 2569'}</span>
                </div>
                <div>
                  <span className="block text-[8.5px] font-bold text-slate-400">วันหมดอายุ</span>
                  <span className="text-[10px] font-semibold text-[#183e66]">{personnel.card_expire_date || '15 พ.ค. 2571'}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[8.5px] text-slate-500 pt-1.5 border-t border-slate-100">
                <span>โทร. 038-611251 • www.somkidvittaya.ac.th</span>
                <span className="inline-flex items-center gap-1 text-[#183e66]/60">
                  <RotateCw className="w-2.5 h-2.5" />
                  <span>พลิกบัตร</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Controls Toolbar under the Card */}
      {showControls && (
        <div className="flex items-center gap-2 mt-4">
          <button
            type="button"
            onClick={handleToggleFlip}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 shadow-xs border border-slate-200 transition-all hover:scale-105 active:scale-95"
          >
            <RotateCw className="w-3.5 h-3.5 text-sky-600" />
            <span>{isFlipped ? 'ดูด้านหน้าบัตร' : 'พลิกดูหลังบัตร'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
