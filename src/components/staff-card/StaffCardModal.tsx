'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  RotateCw, 
  Download, 
  Share2, 
  Copy, 
  Check, 
  ExternalLink, 
  Sparkles,
  ShieldCheck,
  Loader2,
  Contact,
  Edit3
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';
import { Personnel } from '@/types';
import { StaffIdCard } from './StaffIdCard';
import { StaffContactEditModal } from './StaffContactEditModal';
import { getStaffVerificationUrl, formatStaffName, downloadVCard } from '@/lib/staff-card/utils';

interface StaffCardModalProps {
  personnel: Partial<Personnel> | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: (updated: Personnel) => void;
}

export function StaffCardModal({ personnel, isOpen, onClose, onUpdated }: StaffCardModalProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !personnel) return null;

  const nameInfo = formatStaffName(personnel.name_en, personnel.name_th);
  const verificationUrl = getStaffVerificationUrl(personnel.id || '');

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(verificationUrl);
      setCopied(true);
      toast.success('คัดลอกลิงก์ตรวจสอบบัตรเรียบร้อยแล้ว');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadVCard = () => {
    downloadVCard(personnel);
    toast.success('ดาวน์โหลดนามบัตร (.vcf) เรียบร้อยแล้ว');
  };

  const handleDownloadImage = async (side: 'front' | 'back') => {
    const targetRef = side === 'front' ? frontRef.current : backRef.current;
    if (!targetRef) {
      toast.error('ไม่พบส่วนแสดงผลบัตร');
      return;
    }

    setIsExporting(true);
    const toastId = toast.loading(`กำลังบันทึกรูปบัตร (${side === 'front' ? 'ด้านหน้า' : 'ด้านหลัง'})...`);

    try {
      const canvas = await html2canvas(targetRef, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        onclone: (_, element) => {
          element.style.transform = 'none';
          element.style.opacity = '1';
          element.style.visibility = 'visible';
        },
      });

      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      const cleanName = (nameInfo.fullNameEn || 'staff').toLowerCase().replace(/\s+/g, '_');
      a.download = `somkid_card_${cleanName}_${side}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      toast.success(`ดาวน์โหลดรูปบัตร (${side === 'front' ? 'ด้านหน้า' : 'ด้านหลัง'}) สำเร็จ!`, { id: toastId });
    } catch (err: any) {
      console.error('Download error:', err);
      toast.error('เกิดข้อผิดพลาดในการสร้างรูปภาพ', { id: toastId, description: err.message });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col items-center"
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
            <div className="text-center mb-5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800 mb-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>บัตรประจำตัวบุคลากรออนไลน์ (Digital ID)</span>
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {personnel.name_th || nameInfo.fullNameEn}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {personnel.position_th || personnel.position_en}
              </p>
            </div>

            {/* The ID Card Preview */}
            <div className="my-2">
              <StaffIdCard
                personnel={personnel}
                width={340}
                showControls={false}
                isFlipped={isFlipped}
                onFlipChange={setIsFlipped}
                frontRef={frontRef}
                backRef={backRef}
              />
            </div>

            {/* Action Toolbar */}
            <div className="w-full mt-6 space-y-3">
              {/* Flip, Download, and vCard buttons */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setIsFlipped(!isFlipped)}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all active:scale-98"
                >
                  <RotateCw className="w-3.5 h-3.5 text-sky-600" />
                  <span>{isFlipped ? 'ดูหน้าบัตร' : 'พลิกหลังบัตร'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadVCard}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all active:scale-98"
                >
                  <Contact className="w-3.5 h-3.5 text-indigo-600" />
                  <span>โหลด vCard</span>
                </button>

                <button
                  type="button"
                  disabled={isExporting}
                  onClick={() => handleDownloadImage(isFlipped ? 'back' : 'front')}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold bg-[#183e66] hover:bg-[#122f4d] text-white shadow-xs transition-all active:scale-98 disabled:opacity-50"
                >
                  {isExporting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>ดาวน์โหลดรูป</span>
                </button>
              </div>

              {/* Edit Contact Info button */}
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                <span>แก้ไขเบอร์โทร, LINE ID, ห้องพักครู &amp; โซเชียลมีเดีย</span>
              </button>

              {/* Verification Link Row */}
              <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-xs">
                <span className="text-[11px] font-semibold text-slate-500 shrink-0 pl-1">ลิงก์นามบัตร:</span>
                <input
                  type="text"
                  readOnly
                  value={verificationUrl}
                  className="flex-1 bg-transparent border-none text-[11px] font-mono text-slate-600 dark:text-slate-300 truncate focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="p-1.5 rounded-lg bg-white dark:bg-slate-700 hover:bg-slate-100 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 transition-colors shrink-0"
                  title="คัดลอกลิงก์"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <a
                  href={verificationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg bg-white dark:bg-slate-700 hover:bg-slate-100 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 transition-colors shrink-0"
                  title="เปิดหน้าตรวจสอบตัวตน"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>

      {/* Contact Edit Modal */}
      <StaffContactEditModal
        personnel={personnel}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onUpdated={(updated) => {
          onUpdated?.(updated);
        }}
      />
    </>
  );
}
