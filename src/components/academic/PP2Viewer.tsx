'use client';

import React from 'react';
import { PP2CertificateData } from '@/lib/academic/pp2-engine';
import { PrintAlignmentProfile, calculateCalibratedStyle, PRINT_CSS_A4_LANDSCAPE } from '@/lib/academic/print-alignment';
import { Printer, Sliders, Award } from 'lucide-react';

interface PP2ViewerProps {
  data: PP2CertificateData;
  profile: PrintAlignmentProfile;
  onOpenCalibration: () => void;
}

export function PP2Viewer({ data, profile, onOpenCalibration }: PP2ViewerProps) {
  const isOverlay = profile.mode === 'OVERLAY';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS_A4_LANDSCAPE }} />

      {/* Control Bar (Hidden during Print) */}
      <div className="no-print bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">
              ประกาศนียบัตรระดับประถมศึกษา (ปพ.2)
            </h3>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>โหมด:</span>
              <span className={`font-bold ${isOverlay ? 'text-amber-600' : 'text-indigo-600'}`}>
                {isOverlay ? 'พิมพ์ทับกระดาษการ์ดทองจริง (Overlay)' : 'พิมพ์ฉบับสมบูรณ์ (Full Certificate)'}
              </span>
              <span>• เลขที่: {data.certificateNumber}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenCalibration}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>ปรับจูนพิกัดพิมพ์</span>
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#7B1C3E] hover:bg-[#631430] text-white rounded-xl text-xs font-bold shadow-md shadow-[#7B1C3E]/20 transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>พิมพ์ประกาศนียบัตร (Print)</span>
          </button>
        </div>
      </div>

      {/* A4 Landscape Certificate Sheet (297mm x 210mm) */}
      <div className="overflow-x-auto flex justify-center pb-8">
        <div 
          className="print-page-landscape bg-white shadow-2xl border border-slate-300 text-slate-900 relative"
          style={{
            width: '297mm',
            minHeight: '210mm',
            boxSizing: 'border-box',
            fontFamily: '"Sarabun", "TH Sarabun New", serif'
          }}
        >
          {/* Full Copy Decorative Elements */}
          {!isOverlay && (
            <>
              {/* Outer Golden Border */}
              <div className="absolute inset-[8mm] border-[3px] border-[#D4AF37] pointer-events-none p-1.5">
                <div className="w-full h-full border border-[#D4AF37]/60 p-1">
                  <div className="w-full h-full border-[2px] border-[#7B1C3E]/40"></div>
                </div>
              </div>

              {/* Embossed Garuda Symbol */}
              <div className="absolute left-[148.5mm] top-[20mm] -translate-x-1/2 text-center">
                <div className="w-16 h-16 mx-auto mb-2 flex items-center justify-center font-bold text-xs border-2 border-[#D4AF37] rounded-full text-[#7B1C3E] bg-[#D4AF37]/10">
                  ตราครุฑ
                </div>
                <h2 className="text-2xl font-extrabold text-[#7B1C3E] tracking-wide">
                  {data.schoolName}
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  อำเภอ{data.district} จังหวัด{data.province}
                </p>
                <div className="mt-4 text-sm font-semibold text-slate-700">
                  ประกาศนียบัตรฉบับนี้ให้ไว้เพื่อแสดงว่า
                </div>
              </div>

              {/* Sub-Header text */}
              <div className="absolute left-[20mm] top-[108mm] right-[20mm] text-center text-sm space-y-1">
                <p>ได้สำเร็จการศึกษาตาม{data.curriculumName}</p>
                <p className="font-bold text-base text-[#7B1C3E]">ระดับประถมศึกษา</p>
                <p className="text-xs text-slate-600 mt-2">ให้ไว้ ณ วันที่ {data.graduationDateTh}</p>
              </div>
            </>
          )}

          {/* Calibrated Overlay Values */}
          {/* Certificate Serial Number (Top Right) */}
          <div style={calculateCalibratedStyle({ leftMm: 220, topMm: 16, profile, baseFontSizePt: 10 })}>
            เลขที่: <span className="font-mono">{data.certificateNumber}</span>
          </div>

          {/* Student Name (Center Hero Text) */}
          <div style={calculateCalibratedStyle({ leftMm: 148.5, topMm: 85, profile, baseFontSizePt: 22, textAlign: 'center' })}>
            <div className="-translate-x-1/2 font-extrabold text-slate-900 tracking-tight whitespace-nowrap">
              {data.fullNameTh}
            </div>
            <div className="-translate-x-1/2 text-xs font-serif text-slate-500 tracking-wider whitespace-nowrap mt-1">
              ({data.fullNameEn})
            </div>
          </div>

          {/* Signatures */}
          <div style={calculateCalibratedStyle({ leftMm: 55, topMm: 155, profile, baseFontSizePt: 10, textAlign: 'center' })}>
            <div>ลงชื่อ..............................................................</div>
            <div className="mt-1.5 font-bold">({data.chairmanName})</div>
            <div className="text-xs text-slate-500">ประธานกรรมการบริหารโรงเรียน</div>
          </div>

          <div style={calculateCalibratedStyle({ leftMm: 195, topMm: 155, profile, baseFontSizePt: 10, textAlign: 'center' })}>
            <div>ลงชื่อ..............................................................</div>
            <div className="mt-1.5 font-bold">({data.directorName})</div>
            <div className="text-xs text-slate-500">ผู้อำนวยการโรงเรียน{data.schoolName}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
