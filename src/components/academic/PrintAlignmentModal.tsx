'use client';

import React, { useState, useEffect } from 'react';
import { Sliders, RotateCcw, Save, Printer, HelpCircle, X, Check } from 'lucide-react';
import { 
  DocumentType, 
  PrintAlignmentProfile, 
  savePrintProfile, 
  DEFAULT_PRINT_PROFILES 
} from '@/lib/academic/print-alignment';
import { toast } from 'sonner';

interface PrintAlignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  docType: DocumentType;
  currentProfile: PrintAlignmentProfile;
  onProfileChange: (newProfile: PrintAlignmentProfile) => void;
}

export function PrintAlignmentModal({
  isOpen,
  onClose,
  docType,
  currentProfile,
  onProfileChange
}: PrintAlignmentModalProps) {
  const [profile, setProfile] = useState<PrintAlignmentProfile>(currentProfile);

  useEffect(() => {
    setProfile(currentProfile);
  }, [currentProfile]);

  if (!isOpen) return null;

  const handleSliderChange = (field: keyof PrintAlignmentProfile, value: any) => {
    const updated = { ...profile, [field]: value };
    setProfile(updated);
    onProfileChange(updated);
  };

  const handleReset = () => {
    const defaultVal = DEFAULT_PRINT_PROFILES[docType];
    setProfile(defaultVal);
    onProfileChange(defaultVal);
    toast.info('รีเซ็ตค่าพิกัดการพิมพ์กลับสู่ค่ามาตรฐานแล้ว');
  };

  const handleSave = () => {
    savePrintProfile(profile);
    toast.success('บันทึกการตั้งค่าเครื่องพิมพ์นี้เรียบร้อยแล้ว');
    onClose();
  };

  const handlePrintTestGrid = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาตป็อปอัป');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>แผ่นทดสอบสอบเทียบพิกัดเครื่องพิมพ์ (10mm Calibration Grid)</title>
          <style>
            @page { size: A4 portrait; margin: 0; }
            body { margin: 0; padding: 0; font-family: sans-serif; }
            .grid-container {
              width: 210mm;
              height: 297mm;
              position: relative;
              box-sizing: border-box;
              background-image: 
                linear-gradient(to right, #e2e8f0 1px, transparent 1px),
                linear-gradient(to bottom, #e2e8f0 1px, transparent 1px);
              background-size: 10mm 10mm;
              border: 1px solid #94a3b8;
            }
            .major-grid {
              position: absolute;
              inset: 0;
              background-image: 
                linear-gradient(to right, #94a3b8 1px, transparent 1px),
                linear-gradient(to bottom, #94a3b8 1px, transparent 1px);
              background-size: 50mm 50mm;
            }
            .center-cross {
              position: absolute;
              left: 105mm;
              top: 148.5mm;
              width: 20mm;
              height: 20mm;
              transform: translate(-50%, -50%);
              border-left: 2px solid #dc2626;
              border-top: 2px solid #dc2626;
            }
            .header-info {
              position: absolute;
              top: 15mm;
              left: 15mm;
              background: rgba(255,255,255,0.9);
              padding: 8px 12px;
              border: 1px solid #cbd5e1;
              font-size: 12px;
            }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="grid-container">
            <div class="major-grid"></div>
            <div class="center-cross"></div>
            <div class="header-info">
              <strong>แผ่นทดสอบสอบเทียบพิกัดการพิมพ์ SVPortal (10mm Grid)</strong><br/>
              1. นำแผ่นนี้ไปวางทาบกับแบบพิมพ์ ปพ. จริงบนโต๊ะไฟหรือกระจกหน้าต่าง<br/>
              2. อ่านค่าระยะเคลื่อน (มิลลิเมตร) ในแนวนอน (X) และแนวตั้ง (Y)<br/>
              3. นำค่าที่ได้มากรอกในแถบเลื่อนปรับแต่ง
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#7B1C3E]/10 flex items-center justify-center text-[#7B1C3E]">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                ปรับแต่งพิกัดเครื่องพิมพ์ (Calibration)
              </h3>
              <p className="text-xs text-slate-500">
                ชดเชยการเยื้องกระดาษระดับมิลลิเมตร ป้องกันพิมพ์ตกกรอบ
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            โหมดการพิมพ์
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleSliderChange('mode', 'OVERLAY')}
              className={`p-3 rounded-xl border text-left transition-all ${
                profile.mode === 'OVERLAY'
                  ? 'border-[#7B1C3E] bg-[#7B1C3E]/5 text-[#7B1C3E] font-bold shadow-xs'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <div className="text-xs font-bold">พิมพ์ทับกระดาษจริง (Overlay)</div>
              <div className="text-[10px] text-slate-500 mt-0.5">ซ่อนตาราง พิมพ์เฉพาะข้อมูลลงกระดาษตราครุฑ</div>
            </button>
            <button
              type="button"
              onClick={() => handleSliderChange('mode', 'FULL_COPY')}
              className={`p-3 rounded-xl border text-left transition-all ${
                profile.mode === 'FULL_COPY'
                  ? 'border-[#7B1C3E] bg-[#7B1C3E]/5 text-[#7B1C3E] font-bold shadow-xs'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <div className="text-xs font-bold">พิมพ์ฉบับสำเนา (Full Copy)</div>
              <div className="text-[10px] text-slate-500 mt-0.5">พิมพ์ครบทั้งตราครุฑ ตาราง และข้อความ</div>
            </button>
          </div>
        </div>

        {/* Sliders */}
        <div className="space-y-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
          {/* X Offset */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                เลื่อนแนวนอน (X-Offset)
              </span>
              <span className="font-mono px-2 py-0.5 rounded bg-white dark:bg-slate-800 border text-[#7B1C3E] font-bold">
                {profile.offsetXmm > 0 ? `+${profile.offsetXmm}` : profile.offsetXmm} มม.
              </span>
            </div>
            <input
              type="range"
              min="-20"
              max="20"
              step="0.5"
              value={profile.offsetXmm}
              onChange={(e) => handleSliderChange('offsetXmm', parseFloat(e.target.value))}
              className="w-full accent-[#7B1C3E] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>← เลื่อนซ้าย (-20mm)</span>
              <span>ตรงกลาง (0)</span>
              <span>เลื่อนขวา (+20mm) →</span>
            </div>
          </div>

          {/* Y Offset */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                เลื่อนแนวตั้ง (Y-Offset)
              </span>
              <span className="font-mono px-2 py-0.5 rounded bg-white dark:bg-slate-800 border text-[#7B1C3E] font-bold">
                {profile.offsetYmm > 0 ? `+${profile.offsetYmm}` : profile.offsetYmm} มม.
              </span>
            </div>
            <input
              type="range"
              min="-20"
              max="20"
              step="0.5"
              value={profile.offsetYmm}
              onChange={(e) => handleSliderChange('offsetYmm', parseFloat(e.target.value))}
              className="w-full accent-[#7B1C3E] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>↑ เลื่อนขึ้น (-20mm)</span>
              <span>ตรงกลาง (0)</span>
              <span>เลื่อนลง (+20mm) ↓</span>
            </div>
          </div>

          {/* Font Scale */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                ขนาดตัวอักษร (Font Scale)
              </span>
              <span className="font-mono px-2 py-0.5 rounded bg-white dark:bg-slate-800 border text-[#7B1C3E] font-bold">
                {profile.fontScalePercent}%
              </span>
            </div>
            <input
              type="range"
              min="85"
              max="115"
              step="1"
              value={profile.fontScalePercent}
              onChange={(e) => handleSliderChange('fontScalePercent', parseInt(e.target.value, 10))}
              className="w-full accent-[#7B1C3E] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>85% (เล็กลง)</span>
              <span>100% (ปกติ)</span>
              <span>115% (ใหญ่ขึ้น)</span>
            </div>
          </div>
        </div>

        {/* Quick Helper Banner */}
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs">
          <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1 leading-relaxed">
            <p className="font-semibold">เทคนิคจากครูทะเบียนมืออาชีพ:</p>
            <p className="text-[11px] text-amber-700 dark:text-amber-300">
              พิมพ์แผ่นทดสอบลงบนกระดาษรีไซเคิลธรรมดาก่อน แล้วนำไปซ้อนกับกระดาษตราครุฑจริงส่องกับแสงแดดหรือไฟโต๊ะ เพื่อดูว่าต้องเลื่อนกี่มิลลิเมตร
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintTestGrid}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>พิมพ์แผ่นทดสอบ (10mm)</span>
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-xl text-xs font-medium transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>คืนค่าเดิม</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#7B1C3E] hover:bg-[#631430] text-white rounded-xl text-xs font-bold shadow-md shadow-[#7B1C3E]/20 transition cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>บันทึกพิกัดนี้</span>
          </button>
        </div>

      </div>
    </div>
  );
}
