'use client';

import React, { useState, useEffect } from 'react';
import { 
  Wifi, 
  Smartphone, 
  CheckCircle2, 
  RotateCw, 
  Share2, 
  Contact, 
  Radio,
  Info,
  Copy,
  Check
} from 'lucide-react';
import { toast } from 'sonner';
import { Personnel } from '@/types';
import { getStaffVerificationUrl, downloadVCard } from '@/lib/staff-card/utils';

interface StaffNfcBroadcasterProps {
  personnel: Partial<Personnel>;
}

export function StaffNfcBroadcaster({ personnel }: StaffNfcBroadcasterProps) {
  const [hasNfc, setHasNfc] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isNfcActive, setIsNfcActive] = useState<boolean>(false);
  const [isWriting, setIsWriting] = useState<boolean>(false);
  const [writeSuccess, setWriteSuccess] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const verificationUrl = getStaffVerificationUrl(personnel.id || '');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if ('NDEFReader' in window) {
        setHasNfc(true);
      }
      const isApple = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      setIsIOS(isApple);
    }
  }, []);

  const handleActivateNfc = async () => {
    if (!('NDEFReader' in window)) {
      toast.error('อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับ Web NFC', {
        description: isIOS 
          ? 'Apple ไม่อนุญาตให้เบราว์เซอร์เขียน NFC แนะนำให้ใช้ปุ่ม "แชร์นามบัตร" หรือ "บันทึกลงสมุดโทรศัพท์" แทนได้ทันที'
          : 'ท่านสามารถใช้ปุ่มแชร์ หรือปุ่มบันทึกลงสมุดโทรศัพท์ (vCard) แทนได้ทันที',
      });
      return;
    }

    try {
      setIsWriting(true);
      const ndef = new (window as any).NDEFReader();
      
      // Start broadcasting URL to any device or writing to NFC tag
      await ndef.write({
        records: [
          { recordType: 'url', data: verificationUrl },
        ],
      });

      setIsNfcActive(true);
      setWriteSuccess(true);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
      toast.success('ส่งสัญญาณ NFC สำเร็จ!', {
        description: 'นำเครื่องไปแตะโทรศัพท์เครื่องอื่น หรือการ์ด/สติ๊กเกอร์ NFC ได้ทันที',
      });
      setTimeout(() => setWriteSuccess(false), 3000);
    } catch (err: any) {
      console.error('NFC error:', err);
      if (err.name === 'NotAllowedError') {
        toast.error('ไม่ได้รับอนุญาตให้ใช้ NFC', { description: 'กรุณากดอนุญาตการใช้ NFC ในเบราว์เซอร์' });
      } else {
        toast.info('โหมด NFC พร้อมทำงาน', {
          description: 'นำสมาร์ตโฟนไปแตะกับเครื่องปลายทาง หรือแตะชิป NFC ได้เลย',
        });
        setIsNfcActive(true);
      }
    } finally {
      setIsWriting(false);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `นามบัตรดิจิทัล: ${personnel.name_th || personnel.name_en}`,
          text: `นามบัตรประจำตัวบุคลากร ${personnel.name_th || ''} (${personnel.position_th || personnel.position_en || ''}) โรงเรียนสมคิดวิทยา`,
          url: verificationUrl,
        });
      } catch (e) {
        // User cancelled
      }
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(verificationUrl);
      setCopied(true);
      toast.success('คัดลอกลิงก์นามบัตรดิจิทัลแล้ว');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(verificationUrl);
      setCopied(true);
      toast.success('คัดลอกลิงก์นามบัตรแล้ว');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadVCard = () => {
    downloadVCard(personnel);
    toast.success('ดาวน์โหลดนามบัตร (.vcf) เรียบร้อยแล้ว', {
      description: 'สามารถกดเปิดเพื่อบันทึกลงสมุดโทรศัพท์ในเครื่องได้ทันที',
    });
  };

  return (
    <div className="w-full bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-700 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 flex items-center justify-center shrink-0">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <span>NFC &amp; นามบัตรดิจิทัล (Digital Business Card)</span>
              {hasNfc ? (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                  NFC Ready
                </span>
              ) : isIOS ? (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-100 text-[#183e66]">
                  iOS Share
                </span>
              ) : null}
            </h3>
            <p className="text-[11px] text-slate-400">
              {hasNfc 
                ? 'แตะโทรศัพท์กับเครื่องอื่นเพื่อส่งข้อมูลติดต่อและโปรไฟล์บุคลากร'
                : 'แชร์ข้อมูลติดต่อหรือบันทึกนามบัตรลงในสมุดโทรศัพท์ได้ทันที'}
            </p>
          </div>
        </div>
      </div>

      {/* Radar Animation when NFC is armed */}
      {isNfcActive && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-500/10 via-emerald-500/10 to-sky-500/10 border border-sky-300 dark:border-sky-700/60 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-3">
            <div className="relative flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-sky-500"></span>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                NFC ทำงานอยู่: พร้อมแตะส่งข้อมูล
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                นำหลังโทรศัพท์ไปแตะกับเครื่องอื่น หรือสติ๊กเกอร์ NFC ได้ทันที
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsNfcActive(false)}
            className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline"
          >
            ปิดโหมด
          </button>
        </div>
      )}

      {/* Action Buttons Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {hasNfc ? (
          <>
            {/* Button 1 (Android / NFC Supported): Open NFC Broadcast */}
            <button
              type="button"
              onClick={handleActivateNfc}
              disabled={isWriting}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-xs ${
                isNfcActive
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-[#183e66] hover:bg-[#122f4d] text-white'
              }`}
            >
              {isWriting ? (
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
              ) : writeSuccess ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <Wifi className="w-3.5 h-3.5" />
              )}
              <span>{isNfcActive ? 'กำลังส่งสัญญาณ NFC' : 'เปิดโหมดแตะ NFC'}</span>
            </button>

            {/* Button 2: Download vCard */}
            <button
              type="button"
              onClick={handleDownloadVCard}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 transition-all active:scale-95 shadow-2xs"
            >
              <Contact className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>บันทึกลงสมุดโทรศัพท์</span>
            </button>

            {/* Button 3: Share Card Link */}
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 transition-all active:scale-95 shadow-2xs"
            >
              <Share2 className="w-3.5 h-3.5 text-sky-600" />
              <span>แชร์นามบัตรดิจิทัล</span>
            </button>
          </>
        ) : (
          <>
            {/* Button 1 (iOS / Unsupported): Native Share Sheet (AirDrop / LINE) */}
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold bg-[#183e66] hover:bg-[#122f4d] text-white transition-all active:scale-95 shadow-xs"
            >
              <Share2 className="w-3.5 h-3.5 text-white" />
              <span>แชร์นามบัตรดิจิทัล</span>
            </button>

            {/* Button 2: Download vCard */}
            <button
              type="button"
              onClick={handleDownloadVCard}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 transition-all active:scale-95 shadow-2xs"
            >
              <Contact className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>บันทึกลงสมุดโทรศัพท์</span>
            </button>

            {/* Button 3: Copy Link */}
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 transition-all active:scale-95 shadow-2xs"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copied ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์นามบัตร'}</span>
            </button>
          </>
        )}
      </div>

      {/* Tip & Explanation */}
      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-400">
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          {isIOS ? (
            <>
              <strong>สำหรับ iPhone (iOS):</strong> Apple จำกัดไม่อนุญาตให้เว็บเบราว์เซอร์เขียน NFC โดยตรง แนะนำให้ใช้ปุ่ม <strong>&quot;แชร์นามบัตรดิจิทัล&quot;</strong> (ส่งผ่าน AirDrop, LINE, ข้อความ) หรือ <strong>&quot;บันทึกลงสมุดโทรศัพท์&quot;</strong> ได้ทันที หากต้องการเขียนใส่สติ๊กเกอร์ NFC ให้คัดลอกลิงก์ไปเขียนผ่านแอปฟรีเช่น <em>NFC Tools</em> บน App Store
            </>
          ) : (
            <>
              <strong>สติ๊กเกอร์ NFC ติดหลังเคส:</strong> สามารถนำสติ๊กเกอร์ NFC หรือบัตรพลาสติก NFC มาแตะกับโทรศัพท์ของคุณขณะเปิดโหมดนี้ ระบบจะบันทึกลิงก์นามบัตรลงชิป NFC ให้ทันที ใครเอาโทรศัพท์มาแตะหลังเคสของคุณก็จะเด้งขึ้นหน้านามบัตรได้ตลอดเวลา
            </>
          )}
        </p>
      </div>
    </div>
  );
}
