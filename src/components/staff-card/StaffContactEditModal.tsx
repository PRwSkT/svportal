'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Save, 
  Phone, 
  MessageCircle, 
  Video, 
  MapPin, 
  FileText, 
  Sparkles,
  Loader2,
  CheckCircle2,
  Globe
} from 'lucide-react';
import { FacebookIcon, InstagramIcon, LinkedInIcon } from './SocialIcons';
import { toast } from 'sonner';
import { Personnel } from '@/types';
import { getAutoCardValidity } from '@/lib/staff-card/utils';

interface StaffContactEditModalProps {
  personnel: Partial<Personnel> | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: (updated: Personnel) => void;
}

export function StaffContactEditModal({
  personnel,
  isOpen,
  onClose,
  onUpdated,
}: StaffContactEditModalProps) {
  const [formData, setFormData] = useState({
    name_en: '',
    image_url: '',
    phone: '',
    line_id: '',
    facebook_url: '',
    instagram_url: '',
    tiktok_url: '',
    linkedin_url: '',
    office_room: '',
    card_bio: '',
    education_history: '',
    experience_history: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (personnel) {
      setFormData({
        name_en: personnel.name_en || '',
        image_url: personnel.image_url || '',
        phone: personnel.phone || '',
        line_id: personnel.line_id || '',
        facebook_url: personnel.facebook_url || '',
        instagram_url: personnel.instagram_url || '',
        tiktok_url: personnel.tiktok_url || '',
        linkedin_url: personnel.linkedin_url || '',
        office_room: personnel.office_room || '',
        card_bio: personnel.card_bio || '',
        education_history: personnel.education_history || '',
        experience_history: personnel.experience_history || '',
      });
    }
  }, [personnel, isOpen]);

  if (!isOpen || !personnel) return null;

  const validity = getAutoCardValidity(personnel);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const toastId = toast.loading('กำลังบันทึกข้อมูลติดต่อและโซเชียลมีเดีย...');

    try {
      const res = await fetch('/api/staff/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personnel_id: personnel.id,
          ...formData,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update contact info');

      toast.success('บันทึกข้อมูลติดต่อและโซเชียลมีเดียเรียบร้อยแล้ว!', { id: toastId });
      onUpdated?.(data.personnel);
      onClose();
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาดในการบันทึก', { id: toastId, description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col max-h-[90vh] overflow-y-auto"
        >
          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="mb-5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800 mb-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>นามบัตรส่วนตัว &amp; ข้อมูลติดต่อดิจิทัล</span>
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              แก้ไขข้อมูลติดต่อและโซเชียลมีเดีย
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ข้อมูลเหล่านี้จะแสดงบนหน้านามบัตรเมื่อมีคนแตะ NFC หรือสแกน QR Code จากบัตรของคุณ
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* English Name & Profile Photo URL */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                  <span>ชื่อภาษาอังกฤษบนหน้าบัตร</span>
                </label>
                <input
                  type="text"
                  placeholder="เช่น CHATTRAPORN CHIMPOO หรือ ADMIN"
                  value={formData.name_en}
                  onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 uppercase"
                />
                <p className="text-[10px] text-slate-400 mt-1">จะถูกจัดวางเป็นชื่อตัวใหญ่และนามสกุลบนหน้าบัตร</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-indigo-600" />
                  <span>ลิงก์รูปถ่ายประจำตัว (Portrait URL)</span>
                </label>
                <input
                  type="url"
                  placeholder="เช่น https://.../photo.png (รูปพื้นหลังโปร่งใสหรือภาพถ่ายตรง)"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">หากไม่ใส่ จะแสดงตราสัญลักษณ์ประจำตัวแทน</p>
              </div>
            </div>

            {/* Phone & Office Room */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>เบอร์โทรศัพท์ติดต่อ</span>
                </label>
                <input
                  type="tel"
                  placeholder="เช่น 081-234-5678"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-600" />
                  <span>ห้องพักครู / สถานที่ติดต่อ</span>
                </label>
                <input
                  type="text"
                  placeholder="เช่น ห้องพักครู อาคาร 1 ชั้น 2"
                  value={formData.office_room}
                  onChange={(e) => setFormData({ ...formData, office_room: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>
            </div>

            {/* LINE ID */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
                <span>LINE ID (สำหรับกดแอดเพื่อนทันที)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="เช่น kru_somkid หรือ somkid1960"
                  value={formData.line_id}
                  onChange={(e) => setFormData({ ...formData, line_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-mono">
                  line.me/ti/p/~{formData.line_id || '...'}
                </span>
              </div>
            </div>

            {/* Facebook & Instagram */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <FacebookIcon className="w-3.5 h-3.5 text-blue-600" />
                  <span>Facebook Profile / Page</span>
                </label>
                <input
                  type="text"
                  placeholder="ลิงก์โปรไฟล์ Facebook หรือชื่อผู้ใช้"
                  value={formData.facebook_url}
                  onChange={(e) => setFormData({ ...formData, facebook_url: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <InstagramIcon className="w-3.5 h-3.5 text-pink-600" />
                  <span>Instagram</span>
                </label>
                <input
                  type="text"
                  placeholder="เช่น @somkid_teacher หรือลิงก์"
                  value={formData.instagram_url}
                  onChange={(e) => setFormData({ ...formData, instagram_url: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>
            </div>

            {/* TikTok & LinkedIn */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5 text-slate-800 dark:text-slate-200" />
                  <span>TikTok</span>
                </label>
                <input
                  type="text"
                  placeholder="เช่น @kru.somkid หรือลิงก์"
                  value={formData.tiktok_url}
                  onChange={(e) => setFormData({ ...formData, tiktok_url: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <LinkedInIcon className="w-3.5 h-3.5 text-sky-700" />
                  <span>LinkedIn</span>
                </label>
                <input
                  type="text"
                  placeholder="ลิงก์โปรไฟล์ LinkedIn"
                  value={formData.linkedin_url}
                  onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>
            </div>

            {/* Card Bio / Introduction */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>คำแนะนำตัวสั้นๆ / งานที่รับผิดชอบ</span>
              </label>
              <textarea
                rows={2}
                placeholder="เช่น ครูประจำชั้น ป.2/1 หัวหน้ากลุ่มสาระภาษาอังกฤษ..."
                value={formData.card_bio}
                onChange={(e) => setFormData({ ...formData, card_bio: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              />
            </div>

            {/* Education & Experience */}
            <div className="space-y-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
              <h4 className="text-xs font-bold text-[#183e66] dark:text-sky-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>ประวัติการศึกษาและประสบการณ์ทำงาน</span>
              </h4>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ประวัติการศึกษา (Education Background)
                </label>
                <textarea
                  rows={2}
                  placeholder="เช่น ปริญญาตรี ครุศาสตรบัณฑิต (เกียรตินิยม) จุฬาลงกรณ์มหาวิทยาลัย"
                  value={formData.education_history}
                  onChange={(e) => setFormData({ ...formData, education_history: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ประวัติการทำงาน / ผลงาน (Experience)
                </label>
                <textarea
                  rows={2}
                  placeholder="เช่น ครูผู้สอนวิชาภาษาอังกฤษ โรงเรียนสมคิดวิทยา (2563 - ปัจจุบัน)"
                  value={formData.experience_history}
                  onChange={(e) => setFormData({ ...formData, experience_history: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>
            </div>

            {/* Card Validity & Auto-Renew Status (Read-Only) */}
            <div className="p-3.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-900 dark:text-amber-200">
                  อายุบัตรประจำตัว (จัดการโดยระบบอัตโนมัติ)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                  Auto-Renew
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center bg-white/80 dark:bg-slate-900/70 p-2.5 rounded-xl border border-amber-200/50 dark:border-amber-800/30">
                <div>
                  <span className="block text-[10px] text-slate-400">ปีการศึกษา</span>
                  <span className="text-xs font-bold text-[#183e66] dark:text-sky-300">{validity.academicYear}</span>
                </div>
                <div className="border-x border-amber-200/50 dark:border-amber-800/30">
                  <span className="block text-[10px] text-slate-400">วันออกบัตร</span>
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">{validity.issueDate}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400">วันหมดอายุ</span>
                  <span className="text-[11px] font-bold text-[#183e66] dark:text-sky-300">{validity.expireDate}</span>
                </div>
              </div>

              <p className="text-[10px] text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
                ระบบจะต่ออายุบัตรให้อัตโนมัติทุกปีการศึกษาตราบใดที่ยังมีชื่อปฏิบัติงานอยู่ในระบบโรงเรียน (ไม่สามารถแก้ไขด้วยตนเองได้)
              </p>
            </div>

            {/* Buttons */}
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#183e66] hover:bg-[#122f4d] text-white shadow-xs transition-all active:scale-95 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>บันทึกข้อมูลนามบัตร</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
