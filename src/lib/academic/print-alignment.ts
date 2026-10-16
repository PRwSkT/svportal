/**
 * Print Alignment Engine for Thai Ministry of Education Controlled Documents
 * ระบบสอบเทียบพิกัดการพิมพ์ระดับมิลลิเมตรสำหรับเอกสาร ปพ.1, ปพ.2, ปพ.3 และ ปพ.6
 * รองรับทั้งโหมดพิมพ์ทับกระดาษจริง (Overlay Mode) และโหมดพิมพ์ฉบับสำเนาสมบูรณ์ (Full Copy Mode)
 */

export type DocumentType = 'PP1_FRONT' | 'PP1_BACK' | 'PP2_CERTIFICATE' | 'PP3_ROSTER' | 'PP6_BOOKLET';

export interface PrintAlignmentProfile {
  id: string;
  name: string;
  docType: DocumentType;
  offsetXmm: number; // การเลื่อนแนวนอน (-30mm ถึง +30mm)
  offsetYmm: number; // การเลื่อนแนวตั้ง (-30mm ถึง +30mm)
  fontScalePercent: number; // ขนาดตัวอักษร (85% ถึง 115%)
  linePitchScalePercent: number; // ระยะห่างระหว่างบรรทัด (85% ถึง 115%)
  mode: 'OVERLAY' | 'FULL_COPY';
  updatedAt: string;
}

export const DEFAULT_PRINT_PROFILES: Record<DocumentType, PrintAlignmentProfile> = {
  PP1_FRONT: {
    id: 'default_pp1_front',
    name: 'มาตรฐาน ปพ.1 (หน้าแรก)',
    docType: 'PP1_FRONT',
    offsetXmm: 0,
    offsetYmm: 0,
    fontScalePercent: 100,
    linePitchScalePercent: 100,
    mode: 'OVERLAY',
    updatedAt: new Date().toISOString()
  },
  PP1_BACK: {
    id: 'default_pp1_back',
    name: 'มาตรฐาน ปพ.1 (หน้าหลัง)',
    docType: 'PP1_BACK',
    offsetXmm: 0,
    offsetYmm: 0,
    fontScalePercent: 100,
    linePitchScalePercent: 100,
    mode: 'OVERLAY',
    updatedAt: new Date().toISOString()
  },
  PP2_CERTIFICATE: {
    id: 'default_pp2',
    name: 'มาตรฐาน ปพ.2 (ประกาศนียบัตรครุฑดุนนูน)',
    docType: 'PP2_CERTIFICATE',
    offsetXmm: 0,
    offsetYmm: 0,
    fontScalePercent: 100,
    linePitchScalePercent: 100,
    mode: 'OVERLAY',
    updatedAt: new Date().toISOString()
  },
  PP3_ROSTER: {
    id: 'default_pp3',
    name: 'มาตรฐาน ปพ.3 (รน.ช. สำหรับ สช.)',
    docType: 'PP3_ROSTER',
    offsetXmm: 0,
    offsetYmm: 0,
    fontScalePercent: 100,
    linePitchScalePercent: 100,
    mode: 'FULL_COPY',
    updatedAt: new Date().toISOString()
  },
  PP6_BOOKLET: {
    id: 'default_pp6',
    name: 'มาตรฐาน ปพ.6 (สมุดพก 16 หน้า)',
    docType: 'PP6_BOOKLET',
    offsetXmm: 0,
    offsetYmm: 0,
    fontScalePercent: 100,
    linePitchScalePercent: 100,
    mode: 'FULL_COPY',
    updatedAt: new Date().toISOString()
  }
};

/**
 * คำนวณพิกัด CSS สไตล์ในหน่วยมิลลิเมตรหลังชดเชยการเลื่อน (Offset Calibration)
 */
export function calculateCalibratedStyle(params: {
  leftMm: number;
  topMm: number;
  profile: PrintAlignmentProfile;
  baseFontSizePt?: number;
  widthMm?: number;
  heightMm?: number;
  textAlign?: 'left' | 'center' | 'right';
}): React.CSSProperties {
  const { leftMm, topMm, profile, baseFontSizePt = 11, widthMm, heightMm, textAlign = 'left' } = params;

  const calibratedLeft = Math.round((leftMm + profile.offsetXmm) * 10) / 10;
  const calibratedTop = Math.round((topMm + profile.offsetYmm) * 10) / 10;
  const scaledFontSize = Math.round((baseFontSizePt * (profile.fontScalePercent / 100)) * 10) / 10;

  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${calibratedLeft}mm`,
    top: `${calibratedTop}mm`,
    fontSize: `${scaledFontSize}pt`,
    lineHeight: `${profile.linePitchScalePercent}%`,
    textAlign
  };

  if (widthMm !== undefined) {
    style.width = `${widthMm}mm`;
  }
  if (heightMm !== undefined) {
    style.height = `${heightMm}mm`;
  }

  return style;
}

/**
 * โหลดโปรไฟล์จาก LocalStorage พร้อม Fallback
 */
export function loadPrintProfile(docType: DocumentType): PrintAlignmentProfile {
  if (typeof window === 'undefined') return DEFAULT_PRINT_PROFILES[docType];

  try {
    const key = `svportal_print_alignment_${docType}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...DEFAULT_PRINT_PROFILES[docType],
        ...parsed
      };
    }
  } catch (err) {
    console.warn('Failed to load print profile from storage:', err);
  }

  return DEFAULT_PRINT_PROFILES[docType];
}

/**
 * บันทึกโปรไฟล์ลง LocalStorage
 */
export function savePrintProfile(profile: PrintAlignmentProfile): void {
  if (typeof window === 'undefined') return;
  try {
    const key = `svportal_print_alignment_${profile.docType}`;
    localStorage.setItem(key, JSON.stringify({
      ...profile,
      updatedAt: new Date().toISOString()
    }));
  } catch (err) {
    console.error('Failed to save print profile to storage:', err);
  }
}

/**
 * สร้าง CSS Print Stylesheet มาตรฐาน A4 ไร้ขอบ
 */
export const PRINT_CSS_A4_PORTRAIT = `
@media print {
  @page {
    size: A4 portrait;
    margin: 0;
  }
  body {
    margin: 0;
    padding: 0;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .no-print {
    display: none !important;
  }
  .print-page {
    page-break-after: always;
    break-after: page;
    width: 210mm;
    height: 297mm;
    position: relative;
    overflow: hidden;
    background: white;
  }
}
`;

export const PRINT_CSS_A4_LANDSCAPE = `
@media print {
  @page {
    size: A4 landscape;
    margin: 0;
  }
  body {
    margin: 0;
    padding: 0;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .no-print {
    display: none !important;
  }
  .print-page-landscape {
    page-break-after: always;
    break-after: page;
    width: 297mm;
    height: 210mm;
    position: relative;
    overflow: hidden;
    background: white;
  }
}
`;
