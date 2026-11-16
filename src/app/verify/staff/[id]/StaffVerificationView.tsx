'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  Building2, 
  Phone, 
  Globe, 
  Mail, 
  Calendar, 
  ExternalLink,
  Award,
  ArrowRight,
  RotateCw,
  MessageCircle,
  Video,
  MapPin,
  Contact,
  Share2,
  Sparkles,
  FileText
} from 'lucide-react';
import { FacebookIcon, InstagramIcon, LinkedInIcon } from '@/components/staff-card/SocialIcons';
import { toast } from 'sonner';
import { Personnel } from '@/types';
import { StaffIdCard } from '@/components/staff-card/StaffIdCard';
import { SCHOOL_INFO, DEFAULT_ACADEMIC_YEAR } from '@/lib/constants/school';
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
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-4 sm:p-6 font-sans">
        <header className="max-w-2xl mx-auto w-full flex items-center justify-between py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <Image src="/SV-Portal.png" alt="Logo" width={40} height={40} className="object-contain" />
            <div>
              <h1 className="text-sm font-bold text-slate-800">{SCHOOL_INFO.nameTh}</h1>
              <p className="text-[11px] text-slate-500 uppercase">{SCHOOL_INFO.nameEn}</p>
            </div>
          </div>
          <a
            href={SCHOOL_INFO.websiteUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-sky-600 hover:text-sky-700 flex items-center gap-1 font-medium"
          >
            <span>เว็บไซต์โรงเรียน</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </header>

        <main className="max-w-md mx-auto w-full my-auto text-center py-12 px-4 bg-white rounded-3xl shadow-sm border border-slate-200">
          <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-4 border border-rose-100">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">ไม่พบข้อมูลบุคลากร</h2>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            รหัสประจำตัวบุคลากร <code className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700">{requestedId}</code> ไม่มีอยู่ในสารบบของโรงเรียนสมคิดวิทยา หรืออาจหมดวาระการปฏิบัติหน้าที่แล้ว
          </p>
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs text-slate-600 space-y-1 mb-6 text-left">
            <p className="font-semibold text-slate-700">ต้องการสอบถามข้อมูลเพิ่มเติม?</p>
            <p>กรุณาติดต่อฝ่ายธุรการและบริหารงานบุคคล โทร: <a href="tel:038-611251" className="text-sky-600 font-bold">038-611251</a></p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl text-xs font-bold bg-[#183e66] text-white hover:bg-[#122f4d] transition-all shadow-xs"
          >
            เข้าสู่หน้าหลักระบบ SV Portal
          </Link>
        </main>

        <footer className="text-center text-xs text-slate-400 py-4 border-t border-slate-200">
          © {new Date().getFullYear()} {SCHOOL_INFO.nameTh} ({SCHOOL_INFO.nameEn}) • All rights reserved.
        </footer>
      </div>
    );
  }

  const nameInfo = formatStaffName(personnel.name_en, personnel.name_th);
  const categoryLabel = personnel.category === 'executive' 
    ? 'คณะผู้บริหาร (Executive)' 
    : personnel.category === 'staff' 
    ? 'บุคลากรสายสนับสนุน (Support Staff)' 
    : 'ครูผู้สอน (Teacher)';

  const handleDownloadContact = () => {
    downloadVCard(personnel);
    toast.success('ดาวน์โหลดข้อมูลผู้ติดต่อ (.vcf) แล้ว สามารถเปิดเพื่อบันทึกลงโทรศัพท์ได้ทันที');
  };

  const handleShare = async () => {
    const url = getStaffVerificationUrl(personnel.id);
    if (navigator.share) {
      try {
        await navigator.share({
          title: `นามบัตรดิจิทัล: ${personnel.name_th || personnel.name_en}`,
          text: `นามบัตรประจำตัวบุคลากร ${personnel.name_th} (${personnel.position_th || personnel.position_en}) โรงเรียนสมคิดวิทยา`,
          url: url,
        });
      } catch (e) {}
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      toast.success('คัดลอกลิงก์นามบัตรดิจิทัลแล้ว');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 flex flex-col justify-between p-4 sm:p-6 font-sans">
      {/* Top Header */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between py-4 border-b border-slate-200/80">
        <div className="flex items-center gap-3">
          <Image src="/SV-Portal.png" alt="Logo" width={44} height={44} className="object-contain" priority />
          <div>
            <h1 className="text-sm font-bold text-slate-800">{SCHOOL_INFO.nameTh}</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">{SCHOOL_INFO.nameEn} • สังกัด สช.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <Share2 className="w-3.5 h-3.5 text-sky-600" />
            <span>แชร์นามบัตร</span>
          </button>
          <a
            href={SCHOOL_INFO.websiteUrl}
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <span>เว็บไซต์โรงเรียน</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </a>
        </div>
      </header>

      {/* Main Verification Card */}
      <main className="max-w-4xl mx-auto w-full my-6 flex flex-col lg:flex-row gap-8 items-center lg:items-start justify-center">
        {/* Left: Verification Badge & Details */}
        <div className="w-full lg:max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200/80 space-y-5">
          {/* Verified Green Banner */}
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-800">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-emerald-600 tracking-wider uppercase">
                Official Verification Passed
              </p>
              <h2 className="text-sm font-bold text-emerald-900 leading-tight">
                ยืนยันความถูกต้อง: บุคลากรทางการศึกษา
              </h2>
            </div>
          </div>

          {/* Quick Action Contact Bar (Call / Line / Add Contact) */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-around gap-2">
            {personnel.phone ? (
              <a
                href={`tel:${personnel.phone}`}
                className="flex flex-col items-center gap-1 text-[11px] font-bold text-slate-700 hover:text-emerald-700 p-1.5 rounded-xl transition-colors"
                title={`โทร: ${personnel.phone}`}
              >
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-2xs">
                  <Phone className="w-5 h-5" />
                </div>
                <span>โทรติดต่อ</span>
              </a>
            ) : null}

            {personnel.line_id ? (
              <a
                href={`https://line.me/ti/p/~${personnel.line_id}`}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col items-center gap-1 text-[11px] font-bold text-slate-700 hover:text-emerald-600 p-1.5 rounded-xl transition-colors"
                title={`LINE ID: ${personnel.line_id}`}
              >
                <div className="w-10 h-10 rounded-full bg-[#06C755]/15 text-[#06C755] flex items-center justify-center shadow-2xs">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <span>แชท LINE</span>
              </a>
            ) : null}

            {personnel.email ? (
              <a
                href={`mailto:${personnel.email}`}
                className="flex flex-col items-center gap-1 text-[11px] font-bold text-slate-700 hover:text-sky-700 p-1.5 rounded-xl transition-colors"
                title={`อีเมล: ${personnel.email}`}
              >
                <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center shadow-2xs">
                  <Mail className="w-5 h-5" />
                </div>
                <span>ส่งอีเมล</span>
              </a>
            ) : null}

            <button
              type="button"
              onClick={handleDownloadContact}
              className="flex flex-col items-center gap-1 text-[11px] font-bold text-slate-700 hover:text-indigo-700 p-1.5 rounded-xl transition-colors"
              title="บันทึกผู้ติดต่อลงสมุดโทรศัพท์ (.vcf)"
            >
              <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shadow-2xs">
                <Contact className="w-5 h-5" />
              </div>
              <span>บันทึกรายชื่อ</span>
            </button>
          </div>

          {/* Profile Details */}
          <div className="space-y-4">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                ชื่อ-นามสกุล (ไทย)
              </span>
              <p className="text-lg font-bold text-slate-800">
                {personnel.name_th}
              </p>
            </div>

            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Full Name (English)
              </span>
              <p className="text-base font-bold text-[#183e66]">
                {nameInfo.fullNameEn}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  ตำแหน่ง (Position)
                </span>
                <p className="text-xs font-bold text-slate-700 mt-0.5">
                  {personnel.position_th}
                </p>
                <p className="text-[11px] text-slate-500 font-medium">
                  {personnel.position_en}
                </p>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  กลุ่มงาน (Category)
                </span>
                <p className="text-xs font-bold text-indigo-700 mt-0.5">
                  {categoryLabel}
                </p>
              </div>
            </div>

            {/* Office room & Bio */}
            {(personnel.office_room || personnel.card_bio) && (
              <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-2 text-xs">
                {personnel.office_room && (
                  <div className="flex items-start gap-2 text-slate-700">
                    <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">ห้องพักครู / สถานที่ติดต่อ:</span>
                      <p className="font-semibold text-slate-800">{personnel.office_room}</p>
                    </div>
                  </div>
                )}
                {personnel.card_bio && (
                  <div className="flex items-start gap-2 text-slate-700 pt-1 border-t border-slate-200/60">
                    <FileText className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">เกี่ยวกับ / งานที่รับผิดชอบ:</span>
                      <p className="text-slate-600 leading-relaxed">{personnel.card_bio}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Social Media Links if any */}
            {(personnel.facebook_url || personnel.instagram_url || personnel.tiktok_url || personnel.linkedin_url) && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  ช่องทางโซเชียลมีเดีย
                </span>
                <div className="flex flex-wrap gap-2">
                  {personnel.facebook_url && (
                    <a
                      href={personnel.facebook_url.startsWith('http') ? personnel.facebook_url : `https://${personnel.facebook_url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold hover:bg-blue-100 transition-colors"
                    >
                      <FacebookIcon className="w-3.5 h-3.5" />
                      <span>Facebook</span>
                    </a>
                  )}
                  {personnel.instagram_url && (
                    <a
                      href={personnel.instagram_url.startsWith('http') ? personnel.instagram_url : `https://instagram.com/${personnel.instagram_url.replace('@', '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pink-50 text-pink-700 border border-pink-200 text-xs font-semibold hover:bg-pink-100 transition-colors"
                    >
                      <InstagramIcon className="w-3.5 h-3.5" />
                      <span>Instagram</span>
                    </a>
                  )}
                  {personnel.tiktok_url && (
                    <a
                      href={personnel.tiktok_url.startsWith('http') ? personnel.tiktok_url : `https://tiktok.com/@${personnel.tiktok_url.replace('@', '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold hover:bg-slate-200 transition-colors"
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>TikTok</span>
                    </a>
                  )}
                  {personnel.linkedin_url && (
                    <a
                      href={personnel.linkedin_url.startsWith('http') ? personnel.linkedin_url : `https://${personnel.linkedin_url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 text-sky-800 border border-sky-200 text-xs font-semibold hover:bg-sky-100 transition-colors"
                    >
                      <LinkedInIcon className="w-3.5 h-3.5" />
                      <span>LinkedIn</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* School Stamp Verification Seal */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-slate-700">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>การรับรองโดย {SCHOOL_INFO.nameTh}</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              ข้อมูลนี้ได้รับการรับรองจากฐานข้อมูลทะเบียนบุคลากรของโรงเรียนสมคิดวิทยา จังหวัดระยอง ตามพระราชบัญญัติโรงเรียนเอกชน พ.ศ. 2550
            </p>
            <div className="pt-2 flex items-center justify-between text-[10px] text-slate-400 font-mono border-t border-slate-200/60">
              <span>รหัสรับรอง: SV-{personnel.id.slice(0, 8).toUpperCase()}</span>
              <span>ตรวจสอบเมื่อ: {new Date().toLocaleDateString('th-TH')}</span>
            </div>
          </div>
        </div>

        {/* Right: Interactive Digital ID Card */}
        <div className="flex flex-col items-center">
          <div className="mb-2 text-center">
            <span className="text-xs font-bold text-slate-500 tracking-wider uppercase">
              ตัวอย่างบัตรประจำตัวดิจิทัล (Live Digital ID)
            </span>
            <p className="text-[11px] text-slate-400">แตะที่บัตรเพื่อพลิกดูหน้า-หลัง</p>
          </div>

          <StaffIdCard
            personnel={personnel}
            width={340}
            showControls={true}
            isFlipped={isFlipped}
            onFlipChange={setIsFlipped}
          />
        </div>
      </main>

      {/* Bottom Footer */}
      <footer className="max-w-4xl mx-auto w-full text-center text-xs text-slate-400 py-6 border-t border-slate-200/80 space-y-1">
        <p className="font-medium text-slate-500">
          {SCHOOL_INFO.addressTh} • โทรศัพท์: {SCHOOL_INFO.phone} • อีเมล: {SCHOOL_INFO.email}
        </p>
        <p className="text-[11px]">
          © {new Date().getFullYear()} {SCHOOL_INFO.nameTh} ({SCHOOL_INFO.nameEn}) • All rights reserved.
        </p>
      </footer>
    </div>
  );
}
