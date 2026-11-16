'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Phone, 
  Mail, 
  ExternalLink,
  MessageCircle, 
  Video, 
  MapPin, 
  Contact, 
  Share2, 
  GraduationCap,
  Briefcase,
} from 'lucide-react';
import { FacebookIcon, InstagramIcon, LinkedInIcon } from '@/components/staff-card/SocialIcons';
import { toast } from 'sonner';
import { Personnel } from '@/types';
import { StaffIdCard } from '@/components/staff-card/StaffIdCard';
import { SCHOOL_INFO } from '@/lib/constants/school';
import { formatStaffName, downloadVCard, getStaffVerificationUrl } from '@/lib/staff-card/utils';

interface StaffVerificationViewProps {
  personnel: Personnel | null;
  requestedId: string;
}

export default function StaffVerificationView({ personnel, requestedId }: StaffVerificationViewProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  // If not found in database
  if (!personnel) {
    return (
      <div className="min-h-screen bg-[#f8f7f2] flex flex-col justify-between font-sans text-[#1c2229]">
        <div>
          <div className="bg-[#091b30] text-white/80 text-[11px] px-4 sm:px-8 py-1.5">
            <div className="max-w-5xl mx-auto flex items-center justify-between">
              <span className="font-semibold text-white">โรงเรียนสมคิดวิทยา จ.ระยอง</span>
              <span>โทร. {SCHOOL_INFO.phone}</span>
            </div>
          </div>
          <header className="bg-white/95 border-b border-[#091b30]/10 px-4 sm:px-8 py-3">
            <div className="max-w-5xl mx-auto flex items-center justify-between">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo2.png" alt={SCHOOL_INFO.nameTh} className="h-11 w-auto object-contain" />
              <a
                href={SCHOOL_INFO.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[8px] text-xs font-bold bg-[#8b1d32] hover:bg-[#701627] text-white transition-colors"
              >
                <span>เว็บไซต์โรงเรียน</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </header>
        </div>

        <main className="max-w-md mx-auto w-full my-12 px-4">
          <div className="bg-white rounded-[8px] p-8 text-center border border-[#091b30]/15 shadow-xs">
            <h2 className="text-lg font-bold text-[#091b30] mb-2">ไม่พบข้อมูลบุคลากร</h2>
            <p className="text-xs text-[#5c6872] mb-6 leading-relaxed">
              รหัสประจำตัว <code className="font-mono bg-[#e9e7df] px-2 py-0.5 rounded text-[#091b30]">{requestedId}</code> ไม่มีอยู่ในสารบบบุคลากรของโรงเรียนสมคิดวิทยา
            </p>
            <Link
              href="/"
              className="inline-flex items-center justify-center px-6 py-2.5 rounded-[8px] text-xs font-bold bg-[#8b1d32] text-white hover:bg-[#701627] transition-colors"
            >
              กลับสู่หน้าหลัก
            </Link>
          </div>
        </main>

        <footer className="bg-[#091b30] text-white/75 py-6 px-4 text-center text-xs">
          <p className="font-semibold text-white">{SCHOOL_INFO.nameTh} ({SCHOOL_INFO.nameEn})</p>
          <p className="text-[11px] mt-1">{SCHOOL_INFO.addressTh} • โทร. {SCHOOL_INFO.phone}</p>
        </footer>
      </div>
    );
  }

  const nameInfo = formatStaffName(personnel.name_en, personnel.name_th);

  const eyebrowLabel = personnel.category === 'executive'
    ? 'คณะผู้บริหารโรงเรียน'
    : personnel.category === 'staff'
    ? 'บุคลากรโรงเรียนสมคิดวิทยา'
    : 'คณาจารย์โรงเรียนสมคิดวิทยา';

  const handleDownloadContact = () => {
    downloadVCard(personnel);
    toast.success('ดาวน์โหลดนามบัตร (.vcf) สำเร็จ');
  };

  const handleShare = async () => {
    const url = getStaffVerificationUrl(personnel.id);
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${personnel.name_th || nameInfo.fullNameEn} — ${SCHOOL_INFO.nameTh}`,
          text: `${personnel.name_th} (${personnel.position_th || personnel.position_en})`,
          url: url,
        });
      } catch (e) {}
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      toast.success('คัดลอกลิงก์แล้ว');
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f7f2] flex flex-col justify-between font-sans text-[#1c2229]">
      {/* Official School Header matching www.somkidvittaya.ac.th */}
      <div className="sticky top-0 z-30">
        <div className="bg-[#091b30] text-white/80 text-[11px] px-4 sm:px-8 py-1.5">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <span className="font-semibold text-white">โรงเรียนสมคิดวิทยา จ.ระยอง</span>
            <div className="flex items-center gap-4">
              <a href="tel:038611251" className="hover:text-white transition-colors">โทร. {SCHOOL_INFO.phone}</a>
              <a href={SCHOOL_INFO.websiteUrl} target="_blank" rel="noreferrer" className="hidden sm:inline hover:text-white transition-colors">
                somkidvittaya.ac.th
              </a>
            </div>
          </div>
        </div>

        <header className="bg-white/95 backdrop-blur-md border-b border-[#091b30]/10 px-4 sm:px-8 py-2.5">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
            <a href={SCHOOL_INFO.websiteUrl} target="_blank" rel="noreferrer" className="flex items-center shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo2.png"
                alt={SCHOOL_INFO.nameTh}
                className="h-11 sm:h-12 w-auto object-contain"
              />
            </a>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[8px] text-xs font-bold text-[#091b30] bg-[#f8f7f2] hover:bg-[#e9e7df] border border-[#091b30]/15 transition-colors cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5 text-[#8b1d32]" />
                <span>แชร์</span>
              </button>
              <a
                href={SCHOOL_INFO.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-[8px] text-xs font-bold bg-[#8b1d32] hover:bg-[#701627] text-white transition-colors"
              >
                <span>เว็บไซต์โรงเรียน</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </header>
      </div>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto w-full px-4 sm:px-8 py-8 sm:py-12 flex-1 flex flex-col lg:flex-row items-center lg:items-start justify-center gap-8 lg:gap-14">
        
        {/* Left: Interactive 3D Staff ID Card */}
        <div className="flex flex-col items-center shrink-0">
          <StaffIdCard
            personnel={personnel}
            width={340}
            showControls={true}
            isFlipped={isFlipped}
            onFlipChange={setIsFlipped}
          />
        </div>

        {/* Right: Clean Architectural Profile matching somkidvittaya.ac.th */}
        <div className="w-full max-w-lg space-y-6">
          
          {/* Identity Header (consistent Thai) */}
          <div className="border-b border-[#091b30]/15 pb-4">
            <p className="text-xs font-bold text-[#8b1d32] mb-1">
              {eyebrowLabel}
            </p>
            
            <h1 className="text-2xl sm:text-3xl font-bold text-[#091b30] tracking-tight leading-snug">
              {personnel.name_th || nameInfo.fullNameEn}
            </h1>

            <p className="mt-1 text-sm font-bold text-[#12395f]">
              {personnel.position_th || personnel.position_en}
            </p>
          </div>

          {/* Primary Action Button (Somkid Crimson #8b1d32) */}
          <div>
            <button
              type="button"
              onClick={handleDownloadContact}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-[8px] text-xs sm:text-sm font-bold bg-[#8b1d32] hover:bg-[#701627] text-white shadow-sm transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            >
              <Contact className="w-4 h-4" />
              <span>บันทึกลงสมุดโทรศัพท์</span>
            </button>
          </div>

          {/* Direct Contact Channels */}
          {(personnel.phone || personnel.line_id || personnel.email || personnel.office_room) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {personnel.phone && (
                <a
                  href={`tel:${personnel.phone}`}
                  className="flex items-center gap-3 p-3.5 rounded-[8px] bg-white border border-[#091b30]/15 hover:border-[#8b1d32]/40 transition-colors group"
                >
                  <Phone className="w-4 h-4 text-[#8b1d32] shrink-0" />
                  <div className="min-w-0">
                    <span className="block text-[10px] font-bold text-[#5c6872] uppercase">โทรศัพท์</span>
                    <span className="block text-xs font-bold text-[#091b30] truncate group-hover:text-[#8b1d32]">
                      {personnel.phone}
                    </span>
                  </div>
                </a>
              )}

              {personnel.line_id && (
                <a
                  href={`https://line.me/ti/p/~${personnel.line_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 p-3.5 rounded-[8px] bg-white border border-[#091b30]/15 hover:border-[#06C755]/50 transition-colors group"
                >
                  <MessageCircle className="w-4 h-4 text-[#06C755] shrink-0" />
                  <div className="min-w-0">
                    <span className="block text-[10px] font-bold text-[#5c6872] uppercase">LINE ID</span>
                    <span className="block text-xs font-bold text-[#091b30] truncate">
                      @{personnel.line_id}
                    </span>
                  </div>
                </a>
              )}

              {personnel.email && (
                <a
                  href={`mailto:${personnel.email}`}
                  className="flex items-center gap-3 p-3.5 rounded-[8px] bg-white border border-[#091b30]/15 hover:border-[#12395f]/40 transition-colors group"
                >
                  <Mail className="w-4 h-4 text-[#12395f] shrink-0" />
                  <div className="min-w-0">
                    <span className="block text-[10px] font-bold text-[#5c6872] uppercase">อีเมล</span>
                    <span className="block text-xs font-bold text-[#091b30] truncate">
                      {personnel.email}
                    </span>
                  </div>
                </a>
              )}

              {personnel.office_room && (
                <div className="flex items-center gap-3 p-3.5 rounded-[8px] bg-white border border-[#091b30]/15">
                  <MapPin className="w-4 h-4 text-[#8b1d32] shrink-0" />
                  <div className="min-w-0">
                    <span className="block text-[10px] font-bold text-[#5c6872] uppercase">สถานที่ติดต่อ</span>
                    <span className="block text-xs font-bold text-[#091b30] truncate">
                      {personnel.office_room}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Education History */}
          {personnel.education_history && (
            <div className="p-4 rounded-[8px] bg-white border border-[#091b30]/15 border-l-3 border-l-[#12395f] space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-[#091b30]">
                <GraduationCap className="w-4 h-4 text-[#8b1d32]" />
                <span>ประวัติการศึกษา</span>
              </div>
              <p className="text-xs text-[#5c6872] leading-relaxed whitespace-pre-line pl-6">
                {personnel.education_history}
              </p>
            </div>
          )}

          {/* Work Experience */}
          {personnel.experience_history && (
            <div className="p-4 rounded-[8px] bg-white border border-[#091b30]/15 border-l-3 border-l-[#8b1d32] space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-[#091b30]">
                <Briefcase className="w-4 h-4 text-[#8b1d32]" />
                <span>ประวัติการทำงานและประสบการณ์</span>
              </div>
              <p className="text-xs text-[#5c6872] leading-relaxed whitespace-pre-line pl-6">
                {personnel.experience_history}
              </p>
            </div>
          )}

          {/* About / Bio */}
          {personnel.card_bio && (
            <div className="p-4 rounded-[8px] bg-white border border-[#091b30]/15 space-y-1">
              <span className="block text-[10px] font-bold text-[#5c6872] uppercase tracking-wider">
                เกี่ยวกับ / งานที่รับผิดชอบ
              </span>
              <p className="text-xs text-[#1c2229] leading-relaxed whitespace-pre-line">
                {personnel.card_bio}
              </p>
            </div>
          )}

          {/* Social Profiles */}
          {(personnel.facebook_url || personnel.instagram_url || personnel.tiktok_url || personnel.linkedin_url) && (
            <div className="flex items-center gap-2.5 pt-1">
              <span className="text-xs text-[#5c6872] font-medium">โซเชียลมีเดีย:</span>
              <div className="flex items-center gap-1.5">
                {personnel.facebook_url && (
                  <a
                    href={personnel.facebook_url.startsWith('http') ? personnel.facebook_url : `https://${personnel.facebook_url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-[8px] bg-white border border-[#091b30]/15 hover:border-blue-600 text-blue-700 transition-colors"
                    title="Facebook"
                  >
                    <FacebookIcon className="w-4 h-4" />
                  </a>
                )}
                {personnel.instagram_url && (
                  <a
                    href={personnel.instagram_url.startsWith('http') ? personnel.instagram_url : `https://instagram.com/${personnel.instagram_url.replace('@', '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-[8px] bg-white border border-[#091b30]/15 hover:border-pink-600 text-pink-700 transition-colors"
                    title="Instagram"
                  >
                    <InstagramIcon className="w-4 h-4" />
                  </a>
                )}
                {personnel.tiktok_url && (
                  <a
                    href={personnel.tiktok_url.startsWith('http') ? personnel.tiktok_url : `https://tiktok.com/@${personnel.tiktok_url.replace('@', '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-[8px] bg-white border border-[#091b30]/15 hover:border-slate-800 text-slate-800 transition-colors"
                    title="TikTok"
                  >
                    <Video className="w-4 h-4" />
                  </a>
                )}
                {personnel.linkedin_url && (
                  <a
                    href={personnel.linkedin_url.startsWith('http') ? personnel.linkedin_url : `https://${personnel.linkedin_url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-[8px] bg-white border border-[#091b30]/15 hover:border-sky-700 text-sky-800 transition-colors"
                    title="LinkedIn"
                  >
                    <LinkedInIcon className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Official Deep Navy Footer matching www.somkidvittaya.ac.th */}
      <footer className="bg-[#091b30] text-white/75 py-5 px-4 text-center text-[11px]">
        <p className="font-semibold text-white">
          {SCHOOL_INFO.addressTh} • โทร. {SCHOOL_INFO.phone} • www.somkidvittaya.ac.th
        </p>
      </footer>
    </div>
  );
}
