'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Copy,
  Check,
  Download,
  Palette,
  Sliders,
  Image as ImageIcon,
  ExternalLink,
  Printer,
  Sparkles,
  QrCode,
} from 'lucide-react';
import { toast } from 'sonner';

export interface FormQRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  formTitle: string;
  formSlug: string;
}

// CI Colors matching SV Portal QR Generator
const CI = {
  cream: '#E6E6D7',
  blue: '#173D66',
  red: '#6E0D22',
  black: '#111111',
  gold: '#b6a555',
  white: '#ffffff',
  slateBg: '#F4F7F9',
};

// Presets matching SV Portal exactly
type PresetKey = 'ruby' | 'sapphire' | 'luxury_navy' | 'crimson_night' | 'minimal' | 'royal_gold';

interface PresetConfig {
  name: string;
  qrColor: string;
  bgColor: string;
  dotsStyle: 'classy' | 'rounded' | 'dots' | 'square' | 'classy-rounded' | 'extra-rounded';
  cornerSquareColor: string;
  cornerSquareStyle: 'square' | 'dot' | 'extra-rounded';
  cornerDotColor: string;
  cornerDotStyle: 'dot' | 'square';
  logo: string;
  previewBg: string;
  previewBorder?: string;
}

const PRESETS: Record<PresetKey, PresetConfig> = {
  ruby: {
    name: 'Ruby Red',
    qrColor: CI.red,
    bgColor: CI.white,
    dotsStyle: 'classy',
    cornerSquareColor: CI.red,
    cornerSquareStyle: 'square',
    cornerDotColor: CI.red,
    cornerDotStyle: 'dot',
    logo: '/qr-generator/logo/sv-logo-social.png',
    previewBg: CI.red,
  },
  sapphire: {
    name: 'Sapphire',
    qrColor: CI.blue,
    bgColor: CI.slateBg,
    dotsStyle: 'rounded',
    cornerSquareColor: CI.blue,
    cornerSquareStyle: 'dot',
    cornerDotColor: CI.blue,
    cornerDotStyle: 'dot',
    logo: '/qr-generator/logo/sv-logo-social.png',
    previewBg: CI.blue,
  },
  luxury_navy: {
    name: 'Luxury Navy',
    qrColor: CI.cream,
    bgColor: CI.blue,
    dotsStyle: 'dots',
    cornerSquareColor: CI.cream,
    cornerSquareStyle: 'dot',
    cornerDotColor: CI.cream,
    cornerDotStyle: 'dot',
    logo: '/qr-generator/logo.png',
    previewBg: CI.blue,
    previewBorder: CI.cream,
  },
  crimson_night: {
    name: 'Crimson Night',
    qrColor: CI.cream,
    bgColor: CI.red,
    dotsStyle: 'classy-rounded',
    cornerSquareColor: CI.cream,
    cornerSquareStyle: 'square',
    cornerDotColor: CI.cream,
    cornerDotStyle: 'dot',
    logo: '/qr-generator/logo.png',
    previewBg: CI.red,
    previewBorder: CI.cream,
  },
  minimal: {
    name: 'Minimalist',
    qrColor: CI.black,
    bgColor: CI.white,
    dotsStyle: 'square',
    cornerSquareColor: CI.black,
    cornerSquareStyle: 'square',
    cornerDotColor: CI.black,
    cornerDotStyle: 'square',
    logo: '',
    previewBg: CI.black,
    previewBorder: CI.white,
  },
  royal_gold: {
    name: 'Royal Gold',
    qrColor: CI.gold,
    bgColor: CI.white,
    dotsStyle: 'classy-rounded',
    cornerSquareColor: CI.gold,
    cornerSquareStyle: 'square',
    cornerDotColor: CI.gold,
    cornerDotStyle: 'dot',
    logo: '/qr-generator/logo/sv-logo-social.png',
    previewBg: CI.gold,
    previewBorder: CI.white,
  },
};

const LOGO_OPTIONS = [
  { id: '/qr-generator/logo/sv-logo-social.png', label: 'ตราสัญลักษณ์โรงเรียน (Main Logo)' },
  { id: '/qr-generator/logo.png', label: 'SV Portal' },
  { id: '/qr-generator/logo/IMG_1484.PNG', label: 'SIRITHAM' },
  { id: '/qr-generator/logo/svsc.png', label: 'SV Sports Club' },
  { id: '/qr-generator/logo/svaquatics-centre.png', label: 'SV Aquatics Centre' },
  { id: '/qr-generator/logo/SV-lion.png', label: 'SV Lion' },
  { id: '', label: 'ไม่ใส่โลโก้ (None)' },
];

export function FormQRCodeModal({ isOpen, onClose, formTitle, formSlug }: FormQRCodeModalProps) {
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>('ruby');
  const [qrColor, setQrColor] = useState(PRESETS.ruby.qrColor);
  const [bgColor, setBgColor] = useState(PRESETS.ruby.bgColor);
  const [dotsStyle, setDotsStyle] = useState<PresetConfig['dotsStyle']>(PRESETS.ruby.dotsStyle);
  const [cornerSquareStyle, setCornerSquareStyle] = useState<PresetConfig['cornerSquareStyle']>(PRESETS.ruby.cornerSquareStyle);
  const [cornerSquareColor, setCornerSquareColor] = useState(PRESETS.ruby.cornerSquareColor);
  const [cornerDotStyle, setCornerDotStyle] = useState<PresetConfig['cornerDotStyle']>(PRESETS.ruby.cornerDotStyle);
  const [cornerDotColor, setCornerDotColor] = useState(PRESETS.ruby.cornerDotColor);
  const [selectedLogo, setSelectedLogo] = useState(PRESETS.ruby.logo);
  const [logoSize, setLogoSize] = useState(0.38);
  const [logoMargin, setLogoMargin] = useState(10);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const qrContainerRef = useRef<HTMLDivElement>(null);
  const qrCodeInstanceRef = useRef<any>(null);

  const fullFormUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/forms/${formSlug}`
    : `https://sv-portal.somkidvittaya.ac.th/forms/${formSlug}`;

  // Apply Preset
  const handleSelectPreset = (key: PresetKey) => {
    setSelectedPreset(key);
    const p = PRESETS[key];
    setQrColor(p.qrColor);
    setBgColor(p.bgColor);
    setDotsStyle(p.dotsStyle);
    setCornerSquareColor(p.cornerSquareColor);
    setCornerSquareStyle(p.cornerSquareStyle);
    setCornerDotColor(p.cornerDotColor);
    setCornerDotStyle(p.cornerDotStyle);
    setSelectedLogo(p.logo);
  };

  // Initialize or update QRCodeStyling
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    async function setupQR() {
      try {
        const QRCodeStylingModule = await import('qr-code-styling');
        const QRCodeStyling = QRCodeStylingModule.default;

        if (!isMounted) return;

        const options = {
          width: 720,
          height: 720,
          margin: 40,
          type: 'canvas' as const,
          data: fullFormUrl,
          image: selectedLogo || undefined,
          dotsOptions: {
            color: qrColor,
            type: dotsStyle,
          },
          backgroundOptions: {
            color: bgColor,
          },
          imageOptions: {
            crossOrigin: 'anonymous',
            margin: logoMargin,
            imageSize: logoSize,
          },
          cornersSquareOptions: {
            type: cornerSquareStyle,
            color: cornerSquareColor,
          },
          cornersDotOptions: {
            type: cornerDotStyle,
            color: cornerDotColor,
          },
        };

        if (!qrCodeInstanceRef.current) {
          qrCodeInstanceRef.current = new QRCodeStyling(options);
          if (qrContainerRef.current) {
            qrContainerRef.current.innerHTML = '';
            qrCodeInstanceRef.current.append(qrContainerRef.current);
          }
        } else {
          qrCodeInstanceRef.current.update(options);
        }
      } catch (err) {
        console.error('Failed to load QRCodeStyling:', err);
      }
    }

    setupQR();

    return () => {
      isMounted = false;
    };
  }, [
    isOpen,
    fullFormUrl,
    qrColor,
    bgColor,
    dotsStyle,
    cornerSquareStyle,
    cornerSquareColor,
    cornerDotStyle,
    cornerDotColor,
    selectedLogo,
    logoSize,
    logoMargin,
  ]);

  // Clean instance on unmount
  useEffect(() => {
    if (!isOpen) {
      qrCodeInstanceRef.current = null;
    }
  }, [isOpen]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullFormUrl);
      setIsCopied(true);
      toast.success('คัดลอกลิงก์แบบฟอร์มเรียบร้อยแล้ว');
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error('ไม่สามารถคัดลอกลิงก์ได้');
    }
  };

  const handleDownload = async (format: 'png' | 'svg') => {
    if (!qrCodeInstanceRef.current) return;
    setIsDownloading(true);
    const toastId = toast.loading(`กำลังสร้างไฟล์ ${format.toUpperCase()} ความละเอียดสูง...`);
    try {
      await qrCodeInstanceRef.current.download({
        name: `sv-form-qr-${formSlug}`,
        extension: format,
      });
      toast.success(`ดาวน์โหลดไฟล์ ${format.toUpperCase()} เรียบร้อยแล้ว`, { id: toastId });
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาดในการดาวน์โหลด', { id: toastId, description: err?.message });
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Get current QR image from canvas
    const canvas = qrContainerRef.current?.querySelector('canvas');
    const qrDataUrl = canvas ? canvas.toDataURL('image/png') : '';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>พิมพ์ QR Code: ${formTitle}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap');
            body {
              font-family: 'Montserrat', sans-serif, system-ui;
              margin: 0;
              padding: 40px;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              background-color: #ffffff;
              color: #173D66;
            }
            .standee {
              width: 100%;
              max-width: 480px;
              border: 3px solid #6E0D22;
              border-radius: 28px;
              padding: 40px 32px;
              text-align: center;
              box-shadow: 0 10px 25px rgba(0,0,0,0.06);
            }
            .header-logo {
              max-height: 60px;
              margin-bottom: 16px;
            }
            .school-name {
              font-size: 16px;
              font-weight: 700;
              color: #6E0D22;
              letter-spacing: 0.5px;
              margin-bottom: 4px;
            }
            .title {
              font-size: 20px;
              font-weight: 700;
              color: #0F172A;
              margin-bottom: 24px;
              line-height: 1.3;
            }
            .qr-box {
              background: #ffffff;
              display: inline-block;
              padding: 16px;
              border-radius: 20px;
              border: 1px solid #E2E8F0;
              margin-bottom: 20px;
            }
            .qr-img {
              width: 280px;
              height: 280px;
              display: block;
            }
            .instructions {
              font-size: 14px;
              font-weight: 600;
              color: #475569;
              margin-bottom: 6px;
            }
            .url {
              font-size: 12px;
              color: #64748B;
              word-break: break-all;
            }
            @media print {
              body { padding: 0; }
              .standee { border: 2px solid #6E0D22; box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <div class="standee">
            <img src="/qr-generator/logo/sv-logo-social.png" class="header-logo" alt="Somkidvittaya School" />
            <div class="school-name">โรงเรียนสมคิดวิทยา (SOMKIDVITTAYA SCHOOL)</div>
            <div class="title">${formTitle}</div>
            <div class="qr-box">
              <img src="${qrDataUrl}" class="qr-img" alt="QR Code" />
            </div>
            <div class="instructions">สแกนด้วยโทรศัพท์มือถือเพื่อเข้าสู่แบบฟอร์ม</div>
            <div class="url">${fullFormUrl}</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header matching SV Portal Corporate Panel */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 via-white to-slate-50 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#6E0D22]/10 text-[#6E0D22] flex items-center justify-center border border-[#6E0D22]/20">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-xs tracking-wider uppercase text-[#6E0D22]">SV PORTAL</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-xs font-semibold text-slate-500">QR Code Generator Tool</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 line-clamp-1">
                  {formTitle || 'แบบฟอร์มโรงเรียนสมคิดวิทยา'}
                </h3>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Main Layout: Left Controls + Right Live Preview */}
          <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-50/50">
            {/* Left Controls Column (7 Cols) */}
            <div className="order-last lg:order-first lg:col-span-7 space-y-5">
              {/* Step 1: Content Link Info */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  1. ปลายทางลิงก์แบบฟอร์ม (Form URL)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={fullFormUrl}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 select-all"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                    title="คัดลอกลิงก์"
                  >
                    {isCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    <span>{isCopied ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
                  </button>
                </div>
              </div>

              {/* Step 2: Choose Presets (Matching SV Portal Presets) */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    2. เลือกชุดธีมสีมาตรฐาน (Choose Preset)
                  </label>
                  <span className="text-[11px] text-slate-400 font-medium">สีมาตรฐานโรงเรียน</span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {(Object.keys(PRESETS) as PresetKey[]).map((key) => {
                    const preset = PRESETS[key];
                    const isActive = selectedPreset === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleSelectPreset(key)}
                        className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                          isActive
                            ? 'border-[#6E0D22] bg-[#6E0D22]/5 shadow-xs ring-2 ring-[#6E0D22]/30'
                            : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div
                          className="w-7 h-7 rounded-lg shadow-xs border border-slate-200/60"
                          style={{
                            backgroundColor: preset.previewBg,
                            borderColor: preset.previewBorder || 'rgba(0,0,0,0.1)',
                          }}
                        />
                        <span className={`text-[10px] font-bold leading-tight ${isActive ? 'text-[#6E0D22]' : 'text-slate-600'}`}>
                          {preset.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 3: Logo Settings */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  3. ตราสัญลักษณ์ตรงกลาง (Logo Settings)
                </label>

                <div>
                  <select
                    value={selectedLogo}
                    onChange={(e) => {
                      setSelectedLogo(e.target.value);
                      setSelectedPreset('ruby');
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6E0D22]"
                  >
                    {LOGO_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedLogo && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                        <span>ขนาดโลโก้</span>
                        <span>{Math.round(logoSize * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="0.5"
                        step="0.05"
                        value={logoSize}
                        onChange={(e) => setLogoSize(parseFloat(e.target.value))}
                        className="w-full accent-[#6E0D22] cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                        <span>ระยะขอบรอบโลโก้</span>
                        <span>{logoMargin}px</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="20"
                        step="2"
                        value={logoMargin}
                        onChange={(e) => setLogoMargin(parseInt(e.target.value))}
                        className="w-full accent-[#6E0D22] cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Step 4: Advanced Customization (Accordion) */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full px-4 py-3 text-left font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-slate-500" />
                    4. การปรับแต่งขั้นสูง (Advanced Customization)
                  </span>
                  <span className="text-[11px] font-medium text-slate-400">
                    {showAdvanced ? 'ซ่อน' : 'แสดง'}
                  </span>
                </button>

                {showAdvanced && (
                  <div className="p-4 pt-2 border-t border-slate-100 space-y-4 text-xs">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">รูปแบบจุด (Dots Style)</label>
                        <select
                          value={dotsStyle}
                          onChange={(e) => setDotsStyle(e.target.value as any)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                        >
                          <option value="classy">Classy (สไตล์โรงเรียน)</option>
                          <option value="rounded">Rounded (จุดมน)</option>
                          <option value="dots">Dots (จุดกลม)</option>
                          <option value="square">Square (สี่เหลี่ยมดั้งเดิม)</option>
                          <option value="classy-rounded">Classy Rounded</option>
                          <option value="extra-rounded">Extra Rounded</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">สีของจุด QR Code</label>
                        <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl">
                          <input
                            type="color"
                            value={qrColor}
                            onChange={(e) => setQrColor(e.target.value)}
                            className="w-6 h-6 border-0 p-0 rounded cursor-pointer"
                          />
                          <span className="font-mono text-[11px] uppercase">{qrColor}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">กรอบมุมนอก (Outer Corner)</label>
                        <select
                          value={cornerSquareStyle}
                          onChange={(e) => setCornerSquareStyle(e.target.value as any)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                        >
                          <option value="square">Square (เหลี่ยม)</option>
                          <option value="dot">Dot (มน)</option>
                          <option value="extra-rounded">Extra Rounded</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">สีพื้นหลัง (Background)</label>
                        <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl">
                          <input
                            type="color"
                            value={bgColor}
                            onChange={(e) => setBgColor(e.target.value)}
                            className="w-6 h-6 border-0 p-0 rounded cursor-pointer"
                          />
                          <span className="font-mono text-[11px] uppercase">{bgColor}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Preview Column (5 Cols) - Matching SV Portal Preview Panel (Appears first on mobile) */}
            <div className="order-first lg:order-last lg:col-span-5 flex flex-col items-center justify-between bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/90 shadow-sm">
              <div className="w-full text-center">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-3">
                  ตัวอย่าง QR Code จริง (Live Preview)
                </span>

                {/* SV Portal Styled QR Canvas Wrapper */}
                <div
                  className="p-5 rounded-3xl mx-auto shadow-md border inline-block transition-all"
                  style={{
                    backgroundColor: bgColor,
                    borderColor: bgColor === '#ffffff' ? '#E2E8F0' : 'rgba(0,0,0,0.1)',
                  }}
                >
                  <div
                    ref={qrContainerRef}
                    className="w-56 h-56 sm:w-64 sm:h-64 flex items-center justify-center overflow-hidden rounded-2xl"
                  />
                </div>

                <div className="mt-3 text-[11px] font-mono text-slate-500 truncate max-w-xs mx-auto">
                  /forms/{formSlug}
                </div>
              </div>

              {/* Action Buttons: High-Res PNG, Vector SVG, Print */}
              <div className="w-full space-y-2.5 mt-6 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleDownload('png')}
                  disabled={isDownloading}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#6E0D22] hover:bg-[#520919] text-white rounded-2xl text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>ดาวน์โหลด PNG ความละเอียดสูง (1024x1024)</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownload('svg')}
                    disabled={isDownloading}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>ไฟล์เวกเตอร์ SVG</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrint}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-600" />
                    <span>พิมพ์ป้ายตั้งโต๊ะ</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
