'use client';

import React from 'react';
import { 
  Printer, 
  FileDown, 
  FileSpreadsheet, 
  ExternalLink, 
  Sliders, 
  Sparkles,
  ChevronDown
} from 'lucide-react';
import { PaperSize } from '@/lib/documents/types';

interface DocumentActionBarProps {
  title: string;
  documentNumber?: string;
  paperSize?: PaperSize;
  onPrint: () => void | Promise<void>;
  onDownloadPdf?: () => void | Promise<void>;
  onExportExcel?: () => void | Promise<void>;
  onOpenCalibration?: () => void;
  onOpenFullPreview?: () => void;
  isPrinting?: boolean;
  extraActions?: React.ReactNode;
}

export function DocumentActionBar({
  title,
  documentNumber,
  paperSize = 'A4_PORTRAIT',
  onPrint,
  onDownloadPdf,
  onExportExcel,
  onOpenCalibration,
  onOpenFullPreview,
  isPrinting = false,
  extraActions
}: DocumentActionBarProps) {
  const paperLabels: Record<PaperSize, string> = {
    A4_PORTRAIT: 'A4 แนวตั้ง',
    A4_LANDSCAPE: 'A4 แนวนอน',
    A3_LANDSCAPE: 'A3 แนวนอน',
    A5_PORTRAIT: 'A5 เล่มเดี่ยว',
    A5_LANDSCAPE: 'A5 แนวนอน (ครึ่ง A4)',
    THERMAL_80MM: 'ม้วนสลิป 80 มม.',
    THERMAL_58MM: 'ม้วนสลิป 58 มม.'
  };

  return (
    <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
      {/* Title & Document Info */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#7B1C3E]/10 dark:bg-[#7B1C3E]/20 text-[#7B1C3E] dark:text-pink-400 flex items-center justify-center font-bold">
          <Printer className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
              {title}
            </h3>
            {documentNumber && (
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                เลขที่: {documentNumber}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
            <span>ขนาดหน้ากระดาษ: <strong className="text-slate-700 dark:text-slate-300">{paperLabels[paperSize]}</strong></span>
            <span>•</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">คมชัดระดับเวกเตอร์ 100%</span>
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {onOpenCalibration && (
          <button
            type="button"
            onClick={onOpenCalibration}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer"
            title="ปรับพิกัดการพิมพ์ระดับมิลลิเมตรสำหรับกระดาษแบบพิมพ์จริง"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>ปรับจูนพิกัดพิมพ์</span>
          </button>
        )}

        {onOpenFullPreview && (
          <button
            type="button"
            onClick={onOpenFullPreview}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer"
            title="เปิดดูตัวอย่างเอกสารในแท็บใหม่"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>ดูตัวอย่างในแท็บใหม่</span>
          </button>
        )}

        {onExportExcel && (
          <button
            type="button"
            onClick={onExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold transition cursor-pointer"
            title="ส่งออกตารางเป็นไฟล์ Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>ส่งออก Excel</span>
          </button>
        )}

        {onDownloadPdf && (
          <button
            type="button"
            onClick={onDownloadPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
            title="บันทึกเอกสารเป็นไฟล์ PDF เวกเตอร์ความละเอียดสูง"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>ดาวน์โหลด PDF</span>
          </button>
        )}

        <button
          type="button"
          disabled={isPrinting}
          onClick={onPrint}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#7B1C3E] hover:bg-[#631430] disabled:bg-[#7B1C3E]/50 text-white rounded-xl text-xs font-bold shadow-md shadow-[#7B1C3E]/20 transition cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>{isPrinting ? 'กำลังเตรียมพิมพ์...' : 'สั่งพิมพ์ (Print)'}</span>
        </button>

        {extraActions}
      </div>
    </div>
  );
}
