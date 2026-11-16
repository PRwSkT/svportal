'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Building2, 
  Phone, 
  Globe, 
  Mail, 
  ExternalLink,
  MessageCircle, 
  Video, 
  MapPin, 
  Contact, 
  Share2, 
  GraduationCap,
  Briefcase,
  Sparkles,
  RotateCw,
  Calendar,
  CheckCircle2
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
      <div className="min-h-screen bg-[#faf9f6] flex flex-col justify-between p-4 sm:p-6 font-sans">
        <header className="max-w-4xl mx-auto w-full flex items-center justify-between py-4 border-b border-[#b89058]/20">
          <div className="flex items-center gap-3">
            <Image src="/SV-Portal.png" alt="Logo" width={40} height={40} className="object-contain" />
            <div>
              <h1 className="text-sm font-bold text-[#183e66]">{SCHOOL_INFO.nameTh}</h1>
              <p className="text-[10px] text-[#b89058] tracking-widest uppercase">{SCHOOL_INFO.nameEn}</p>
            </div>
          </div>
          <a
            href={SCHOOL_INFO.websiteUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-[#183e66] hover:text-[#b89058] flex items-center gap-1 font-semibold transition-colors"
          >
            <span>เว็บไซต์โรงเรียน</span>
            <ExternalLink className="w-3.5 h-3.5 text-[#b89058]" />
          </a>
        </header>

        <main className="max-w-md mx-auto w-full my-auto text-center py-12 px-6 bg-white rounded-3xl shadow-sm border border-slate-200/80">
          <h2 className="text-lg font-bold text-[#183e66] mb-2">ไม่พบข้อมูลบุคลากร</h2>
          <p className="text-xs text-slate-500 mb-6 leading-relaxed">
            รหัสประจำตัว <code className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700">{requestedId}</code> ไม่มีอยู่ในสารบบบุคลากรของโรงเรียนสมคิดวิทยา
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl text-xs font-bold bg-[#183e66] text-white hover:bg-[#122f4d] transition-all shadow-xs"
          >
            เข้าสู่หน้าหลักระบบ SV Portal
          </Link>
        </main>

        <footer className="text-center text-xs text-slate-400 py-4 border-t border-[#b89058]/20">
          © {new Date().getFullYear()} {SCHOOL_INFO.nameTh} • Somkidvittaya School
        </footer>
      </div>
    );
  }

  const nameInfo = formatStaffName(personnel.name_en, personnel.name_th);

  const handleDownloadContact = () => {
    downloadVCard(personnel);
    toast.success('ดาวน์โหลดนามบัตร (.vcf) สำเร็จ สามารถกดบันทึกลงสมุดโทรศัพท์ได้ทันที');
  };

  const handleShare = async () => {
    const url = getStaffVerificationUrl(personnel.id);
    if (navigator.share) {
      try {
        await navigator.share({
          title: `นามบัตรดิจิทัล: ${personnel.name_th || personnel.name_en}`,
          text: `นามบัตรบุคลากร ${personnel.name_th} (${personnel.position_th || personnel.position_en}) โรงเรียนสมคิดวิทยา`,
          url: url,
        });
      } catch (e) {}
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      toast.success('คัดลอกลิงก์นามบัตรดิจิทัลแล้ว');
    }
  };

  return (
    <div className="min-h-screen bg-[#faf9f6] flex flex-col justify-between font-sans text-slate-800">
      {/* Top Luxury Navigation */}
      <header className="border-b border-[#b89058]/20 bg-white/80 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-8 py-3.5">
        <div className="max-w-5xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center">
              <Image src="/SV-Portal.png" alt="Logo" width={36} height={36} className="object-contain" priority />
            </div>
            <div>
              <h1 className="text-sm font-bold text-[#183e66] tracking-wide leading-tight">
                {SCHOOL_INFO.nameTh}
              </h1>
              <p className="text-[10px] tracking-widest text-[#b89058] font-bold uppercase">
                {SCHOOL_INFO.nameEn} • EST. 1960
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-[#183e66] bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors shadow-2xs"
            >
              <Share2 className="w-3.5 h-3.5 text-[#b89058]" />
              <span className="hidden sm:inline">แชร์นามบัตร</span>
            </button>
            <a
              href={SCHOOL_INFO.websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-[#b89058] hover:text-[#9d7843] transition-colors"
            >
              <span>somkidvittaya.ac.th</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto w-full px-4 sm:px-8 py-8 sm:py-12 flex-1 flex flex-col lg:flex-row items-center lg:items-start justify-center gap-8 lg:gap-14">
        
        {/* Left Column: Interactive 3D Staff Card */}
        <div className="flex flex-col items-center shrink-0">
          <StaffIdCard
            personnel={personnel}
            width={340}
            showControls={true}
            isFlipped={isFlipped}
            onFlipChange={setIsFlipped}
          />
        </div>

        {/* Right Column: Executive Profile Dossier (Clean, Glam, Editorial) */}
        <div className="w-full max-w-lg space-y-6">
          
          {/* Identity Title */}
          <div className="border-b border-[#b89058]/25 pb-5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase bg-[#183e66]/5 text-[#183e66] border border-[#183e66]/15 mb-2">
              <span>FACULTY &amp; STAFF PROFILE</span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-bold text-[#183e66] tracking-tight">
              {personnel.name_th}
            </h1>
            
            <p className="text-sm sm:text-base font-semibold text-[#b89058] tracking-wider uppercase mt-0.5">
              {nameInfo.fullNameEn}
            </p>

            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs font-bold text-slate-700">
                {personnel.position_th || personnel.position_en}
              </span>
              {personnel.position_en && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-xs text-slate-500 font-medium">
                    {personnel.position_en}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Primary Action Button: Add to Contacts */}
          <div>
            <button
              type="button"
              onClick={handleDownloadContact}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl text-xs sm:text-sm font-bold bg-[#183e66] hover:bg-[#122f4d] text-white shadow-md transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              <Contact className="w-4 h-4 text-[#b89058]" />
              <span>บันทึกลงสมุดโทรศัพท์ (Save to Contacts)</span>
            </button>
          </div>

          {/* Quick Contact Channels */}
          {(personnel.phone || personnel.line_id || personnel.email || personnel.office_room) && (
            <div className="grid grid-cols-2 gap-2.5">
              {personnel.phone && (
                <a
                  href={`tel:${personnel.phone}`}
                  className="flex items-center gap-2.5 p-3 rounded-2xl bg-white border border-slate-200/80 hover:border-[#183e66]/30 shadow-2xs transition-colors group"
                >
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase">โทรศัพท์</span>
                    <span className="block text-xs font-bold text-slate-800 truncate group-hover:text-[#183e66]">
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
                  className="flex items-center gap-2.5 p-3 rounded-2xl bg-white border border-slate-200/80 hover:border-[#06C755]/40 shadow-2xs transition-colors group"
                >
                  <div className="w-8 h-8 rounded-xl bg-[#06C755]/10 text-[#06C755] flex items-center justify-center shrink-0">
                    <MessageCircle className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase">LINE ID</span>
                    <span className="block text-xs font-bold text-slate-800 truncate group-hover:text-[#06C755]">
                      @{personnel.line_id}
                    </span>
                  </div>
                </a>
              )}

              {personnel.email && (
                <a
                  href={`mailto:${personnel.email}`}
                  className="flex items-center gap-2.5 p-3 rounded-2xl bg-white border border-slate-200/80 hover:border-sky-300 shadow-2xs transition-colors group"
                >
                  <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase">อีเมล</span>
                    <span className="block text-xs font-bold text-slate-800 truncate group-hover:text-sky-700">
                      {personnel.email}
                    </span>
                  </div>
                </a>
              )}

              {personnel.office_room && (
                <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
                  <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase">สถานที่ติดต่อ</span>
                    <span className="block text-xs font-bold text-slate-800 truncate">
                      {personnel.office_room}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Education History (ประวัติการศึกษา) */}
          {personnel.education_history && (
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-[#183e66]">
                <GraduationCap className="w-4 h-4 text-[#b89058]" />
                <span>ประวัติการศึกษา</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line pl-6">
                {personnel.education_history}
              </p>
            </div>
          )}

          {/* Work Experience (ประวัติการทำงาน / ผลงาน) */}
          {personnel.experience_history && (
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-[#183e66]">
                <Briefcase className="w-4 h-4 text-[#b89058]" />
                <span>ประวัติการทำงานและประสบการณ์</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line pl-6">
                {personnel.experience_history}
              </p>
            </div>
          )}

          {/* About / Bio */}
          {personnel.card_bio && (
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-1">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                เกี่ยวกับ / งานที่รับผิดชอบ
              </span>
              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                {personnel.card_bio}
              </p>
            </div>
          )}

          {/* Social Profiles */}
          {(personnel.facebook_url || personnel.instagram_url || personnel.tiktok_url || personnel.linkedin_url) && (
            <div className="flex items-center gap-2 pt-2">
              <span className="text-xs text-slate-400 font-medium">โซเชียลมีเดีย:</span>
              <div className="flex items-center gap-1.5">
                {personnel.facebook_url && (
                  <a
                    href={personnel.facebook_url.startsWith('http') ? personnel.facebook_url : `https://${personnel.facebook_url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors"
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
                    className="p-2 rounded-xl bg-pink-50 hover:bg-pink-100 text-pink-700 transition-colors"
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
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors"
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
                    className="p-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 transition-colors"
                    title="LinkedIn"
                  >
                    <LinkedInIcon className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Credential Authenticity Notice */}
          <div className="pt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-200/60">
            <span>ปีการศึกษา {personnel.academic_year || '2567'}</span>
            <span>โรงเรียนสมคิดวิทยา อ.เมืองระยอง จ.ระยอง</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#b89058]/20 py-6 text-center text-xs text-slate-500 bg-white/50">
        <p className="font-semibold text-[#183e66]">
          {SCHOOL_INFO.nameTh} ({SCHOOL_INFO.nameEn})
        </p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          {SCHOOL_INFO.addressTh} • โทรศัพท์ 038-611251 • www.somkidvittaya.ac.th
        </p>
      </footer>
    </div>
  );
}
