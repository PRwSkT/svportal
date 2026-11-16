'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  RotateCw, 
  Download, 
  Share2, 
  Copy, 
  Check, 
  ExternalLink, 
  ShieldCheck, 
  Sparkles, 
  Smartphone, 
  User, 
  ArrowLeft,
  Loader2,
  AlertCircle,
  Edit3,
  Phone,
  MessageCircle,
  MapPin,
  Video,
  FileText
} from 'lucide-react';
import { FacebookIcon, InstagramIcon, LinkedInIcon } from '@/components/staff-card/SocialIcons';
import { exportCardToPng } from '@/lib/staff-card/export-image';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { StaffIdCard } from '@/components/staff-card/StaffIdCard';
import { StaffNfcBroadcaster } from '@/components/staff-card/StaffNfcBroadcaster';
import { StaffContactEditModal } from '@/components/staff-card/StaffContactEditModal';
import { Personnel } from '@/types';
import { formatStaffName, getStaffVerificationUrl } from '@/lib/staff-card/utils';
import { SCHOOL_INFO } from '@/lib/constants/school';

export default function StaffIdCardSelfServicePage() {
  const { user, appUser, isLoading: authLoading } = useAuth();
  const [personnel, setPersonnel] = useState<Personnel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMyCard = async () => {
      try {
        const res = await fetch('/api/staff/id-card');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load card');
        setPersonnel(data.personnel);
      } catch (err: any) {
        console.error('Error loading card:', err);
        toast.error('ไม่สามารถโหลดข้อมูลบัตรได้', { description: err.message });
      } finally {
        setIsLoading(false);
      }
    };

    if (!authLoading && user) {
      fetchMyCard();
    } else if (!authLoading && !user) {
      setIsLoading(false);
    }
  }, [authLoading, user]);

  const nameInfo = formatStaffName(personnel?.name_en, personnel?.name_th);
  const verificationUrl = personnel ? getStaffVerificationUrl(personnel.id) : '';

  const handleCopyLink = () => {
    if (navigator.clipboard && verificationUrl) {
      navigator.clipboard.writeText(verificationUrl);
      setCopied(true);
      toast.success('คัดลอกลิงก์ตรวจสอบบัตรแล้ว');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadImage = async (side: 'front' | 'back') => {
    const targetRef = side === 'front' ? frontRef.current : backRef.current;
    if (!targetRef) return;

    setIsExporting(true);
    const sideTitle = side === 'front' ? 'หน้าบัตร' : 'หลังบัตร';
    const toastId = toast.loading(`กำลังสร้างรูปภาพบัตร (${sideTitle})...`);

    try {
      const cleanName = (nameInfo.fullNameEn || 'staff').toLowerCase().replace(/\s+/g, '_');
      const filename = `somkid_card_${cleanName}_${side}.png`;
      const dataUrl = await exportCardToPng(targetRef, filename);
      
      // Also open in image preview modal for easy tap-and-hold saving on mobile
      setPreviewImage({ url: dataUrl, title: `รูปภาพ${sideTitle}` });
      toast.success(`ดาวน์โหลดรูปบัตร (${sideTitle}) สำเร็จ!`, { 
        id: toastId, 
        description: 'หากต้องการบันทึกลงแกลเลอรี่ สามารถแตะค้างที่รูปภาพแล้วเลือก "บันทึกรูปภาพ" ได้เลยครับ' 
      });
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาดในการดาวน์โหลด', { id: toastId, description: err.message });
    } finally {
      setIsExporting(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-[#183e66] animate-spin mb-3" />
        <p className="text-sm text-slate-500 font-medium">กำลังโหลดบัตรประจำตัวบุคลากรออนไลน์...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-3xl text-center shadow-sm border border-slate-200">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-800 mb-1">กรุณาเข้าสู่ระบบ</h2>
        <p className="text-xs text-slate-500 mb-4">เข้าสู่ระบบ SV Portal เพื่อดูบัตรประจำตัวของคุณ</p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-xs font-bold bg-[#183e66] text-white hover:bg-[#122f4d]"
        >
          เข้าสู่ระบบ
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 font-sans">
      {/* Top Breadcrumb & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <Link
            href="/home"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 font-medium mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>กลับสู่หน้าหลัก</span>
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">
              บัตรประจำตัวบุคลากรออนไลน์
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              Digital Staff ID
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            บัตรประจำตัวดิจิทัลและนามบัตรอิเล็กทรอนิกส์ (NFC &amp; vCard) ของโรงเรียนสมคิดวิทยา
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsContactModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300/80 transition-colors shadow-2xs"
          >
            <Edit3 className="w-3.5 h-3.5 text-amber-600" />
            <span>แก้ไขข้อมูลติดต่อ / โซเชียล</span>
          </button>

          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
            <span>{copied ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Card Viewer + Features */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Interactive 3D Card Preview */}
        <div className="lg:col-span-6 flex flex-col items-center">
          <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-200/80 dark:border-slate-800 flex flex-col items-center w-full">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              แตะที่บัตรเพื่อพลิกดูหน้า-หลัง
            </span>

            <StaffIdCard
              personnel={personnel || {}}
              width={330}
              showControls={true}
              isFlipped={isFlipped}
              onFlipChange={setIsFlipped}
              frontRef={frontRef}
              backRef={backRef}
            />

            {/* Download Buttons */}
            <div className="grid grid-cols-2 gap-2 w-full max-w-[330px] mt-4">
              <button
                type="button"
                disabled={isExporting}
                onClick={() => handleDownloadImage('front')}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 shadow-2xs transition-all active:scale-95 disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5 text-sky-600" />
                <span>โหลดหน้าบัตร</span>
              </button>

              <button
                type="button"
                disabled={isExporting}
                onClick={() => handleDownloadImage('back')}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 shadow-2xs transition-all active:scale-95 disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5 text-sky-600" />
                <span>โหลดหลังบัตร</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: NFC Broadcaster & Card Info */}
        <div className="lg:col-span-6 space-y-4">
          {/* NFC Tap-to-Share Broadcaster */}
          <StaffNfcBroadcaster personnel={personnel || {}} />

          {/* Cardholder Information Card */}
          <div className="p-6 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/80 dark:border-slate-700 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <User className="w-4 h-4 text-sky-600" />
                <span>ข้อมูลและนามบัตรดิจิทัลของคุณ</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsContactModalOpen(true)}
                className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>แก้ไข</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-700/60">
                <span className="text-slate-400">ชื่อ-นามสกุล (ไทย):</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{personnel?.name_th}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-700/60">
                <span className="text-slate-400">Full Name (English):</span>
                <span className="font-bold text-[#183e66] dark:text-sky-300">{nameInfo.fullNameEn}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-700/60">
                <span className="text-slate-400">ตำแหน่ง (Position):</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">{personnel?.position_th}</span>
              </div>

              {/* Phone */}
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-700/60">
                <span className="text-slate-400 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" /> เบอร์โทรศัพท์:
                </span>
                <span className="font-bold text-emerald-600">
                  {personnel?.phone || <span className="text-slate-300 font-normal">ยังไม่ได้ระบุ</span>}
                </span>
              </div>

              {/* LINE ID */}
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-700/60">
                <span className="text-slate-400 flex items-center gap-1">
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-500" /> LINE ID:
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {personnel?.line_id ? `@${personnel.line_id}` : <span className="text-slate-300 font-normal">ยังไม่ได้ระบุ</span>}
                </span>
              </div>

              {/* Office Room */}
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-700/60">
                <span className="text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" /> ห้องพักครู / สถานที่:
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {personnel?.office_room || <span className="text-slate-300 font-normal">ยังไม่ได้ระบุ</span>}
                </span>
              </div>

              {/* Bio */}
              {personnel?.card_bio && (
                <div className="py-2 border-b border-slate-100 dark:border-slate-700/60">
                  <span className="text-slate-400 block mb-1">เกี่ยวกับ / คำแนะนำตัว:</span>
                  <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed bg-slate-50 dark:bg-slate-700/40 p-2.5 rounded-xl">
                    {personnel.card_bio}
                  </p>
                </div>
              )}

              {/* Education History */}
              {personnel?.education_history && (
                <div className="py-2 border-b border-slate-100 dark:border-slate-700/60">
                  <span className="text-slate-400 block mb-1">ประวัติการศึกษา:</span>
                  <p className="text-slate-700 dark:text-slate-200 text-[11px] leading-relaxed bg-slate-50 dark:bg-slate-700/40 p-2.5 rounded-xl whitespace-pre-line font-medium">
                    {personnel.education_history}
                  </p>
                </div>
              )}

              {/* Experience History */}
              {personnel?.experience_history && (
                <div className="py-2 border-b border-slate-100 dark:border-slate-700/60">
                  <span className="text-slate-400 block mb-1">ประวัติการทำงาน / ผลงาน:</span>
                  <p className="text-slate-700 dark:text-slate-200 text-[11px] leading-relaxed bg-slate-50 dark:bg-slate-700/40 p-2.5 rounded-xl whitespace-pre-line font-medium">
                    {personnel.experience_history}
                  </p>
                </div>
              )}

              {/* Card Validity Info */}
              <div className="py-2 border-b border-slate-100 dark:border-slate-700/60 grid grid-cols-3 gap-2 text-center bg-slate-50 dark:bg-slate-700/40 p-2 rounded-xl">
                <div>
                  <span className="block text-[10px] text-slate-400">ปีการศึกษา</span>
                  <span className="font-bold text-[#183e66] dark:text-sky-300 text-xs">{personnel?.academic_year || '2567'}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400">วันออกบัตร</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">{personnel?.card_issue_date || '16 พ.ค. 2567'}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400">วันหมดอายุ</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400 text-[11px]">{personnel?.card_expire_date || '15 พ.ค. 2569'}</span>
                </div>
              </div>

              {/* Social Media Preview */}
              {(personnel?.facebook_url || personnel?.instagram_url || personnel?.tiktok_url || personnel?.linkedin_url) && (
                <div className="py-2 flex items-center gap-2">
                  <span className="text-slate-400">โซเชียลมีเดีย:</span>
                  <div className="flex items-center gap-1.5">
                    {personnel?.facebook_url && (
                      <span className="p-1 rounded-lg bg-blue-50 text-blue-600 text-[10px] font-bold">Facebook</span>
                    )}
                    {personnel?.instagram_url && (
                      <span className="p-1 rounded-lg bg-pink-50 text-pink-600 text-[10px] font-bold">Instagram</span>
                    )}
                    {personnel?.tiktok_url && (
                      <span className="p-1 rounded-lg bg-slate-100 text-slate-800 text-[10px] font-bold">TikTok</span>
                    )}
                    {personnel?.linkedin_url && (
                      <span className="p-1 rounded-lg bg-sky-50 text-sky-700 text-[10px] font-bold">LinkedIn</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Add to Home Screen Tip */}
          <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200/80 dark:border-sky-800/60 flex items-start gap-3">
            <Smartphone className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
            <div className="text-xs text-sky-900 dark:text-sky-200 space-y-0.5">
              <p className="font-bold">เพิ่มลงหน้าจอโฮมมือถือ (Add to Home Screen):</p>
              <p className="text-[11px] text-sky-800 dark:text-sky-300 leading-relaxed">
                เปิดหน้านี้ใน Safari (iOS) หรือ Chrome (Android) แล้วกดปุ่ม <strong>&quot;แชร์ &gt; เพิ่มไปยังหน้าจอโฮม&quot;</strong> เพื่อเปิดแสดงบัตรและนามบัตรดิจิทัลได้ทันทีทุกที่ทุกเวลา
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Contact Modal */}
      <StaffContactEditModal
        personnel={personnel}
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        onUpdated={(updated) => setPersonnel(updated)}
      />

      {/* Image Preview / Save to Photos Modal for iOS and Mobile */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl flex flex-col items-center border border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-[#183e66] dark:text-sky-300 mb-1">
              {previewImage.title} (ความละเอียดสูง)
            </h3>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mb-3 text-center">
              💡 สำหรับ iPhone/iPad: แตะค้างที่รูปภาพด้านล่าง แล้วเลือก &quot;บันทึกรูปภาพ&quot; (Save Image) เพื่อเก็บเข้าแกลเลอรี่ได้ทันที
            </p>

            <div className="max-h-[60vh] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 shadow-inner mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewImage.url}
                alt={previewImage.title}
                className="w-full h-auto object-contain max-h-[58vh]"
              />
            </div>

            <div className="w-full flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <a
                href={previewImage.url}
                download={`somkid_${previewImage.title}.png`}
                className="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold bg-[#183e66] hover:bg-[#122f4d] text-white text-center shadow-xs transition-colors"
              >
                ดาวน์โหลดไฟล์
              </a>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
